// Orchestrator: pick content -> render the card -> publish to every enabled
// network -> update state. Two campaign types:
//   quiz  (default) - random unused question card (e.g. CoderStudyFlow)
//   promo           - rotating product-marketing card (e.g. Moon Whale Media)
//
//   node engine/run.mjs --brand <slug> [--dry-run] [--network <name>]
//
// --dry-run renders the image + writes the caption/comment payload to out/
// without calling any network API or touching state.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, renderQuestionCard, renderTemplate } from './render.mjs';
import * as facebook from './publishers/facebook.mjs';
import * as x from './publishers/x.mjs';
import * as instagram from './publishers/instagram.mjs';
import * as linkedin from './publishers/linkedin.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLISHERS = { facebook, x, instagram, linkedin };

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, dflt = null) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
};

const brand = opt('brand');
if (!brand) {
    console.error('Usage: node engine/run.mjs --brand <slug> [--dry-run] [--network <name>]');
    process.exit(1);
}
const dryRun = flag('dry-run');
const onlyNetwork = opt('network');

// Per-brand secrets: CODERSTUDYFLOW_FB_PAGE_ID overrides FB_PAGE_ID, etc., so
// one workflow can serve many pages. Unprefixed names remain the fallback.
const prefix = brand.replace(/[^a-z0-9]/gi, '').toUpperCase();
for (const name of ['FB_PAGE_ID', 'FB_PAGE_TOKEN', 'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET', 'IG_USER_ID', 'IG_ACCESS_TOKEN', 'LI_ORG_ID', 'LI_ACCESS_TOKEN']) {
    if (process.env[`${prefix}_${name}`]) {
        process.env[name] = process.env[`${prefix}_${name}`];
    }
}

const config = JSON.parse(readFileSync(join(ROOT, 'brands', brand, 'config.json'), 'utf8'));

let state = {};
try {
    state = JSON.parse(readFileSync(join(ROOT, config.state_file), 'utf8'));
} catch { /* first run */ }

const outDir = join(ROOT, 'out');
mkdirSync(outDir, { recursive: true });
const imagePath = join(outDir, `${brand}-latest.png`);

let caption, commentMessage, stateAfterSuccess, pickedLabel;

if ((config.type ?? 'quiz') === 'promo') {
    // ---- PROMO: product-fair rotation + per-promo cooldown -------------------
    // Every product carries a stack of promos (overview + feature drill-downs,
    // each optionally with its own page screenshot); a product may also declare
    // promos_file (generated promos, e.g. one per CoderStudyFlow track). The
    // picker chooses a PRODUCT first - fair rotation regardless of deck size -
    // then a random promo of that product outside the cooldown window. The same
    // product never posts twice in a row.
    const deck = JSON.parse(readFileSync(join(ROOT, config.data_file), 'utf8'));
    const cooldownDays = config.cooldown_days ?? 5;
    const history = state.history ?? [];
    const cutoff = Date.now() - cooldownDays * 86_400_000;
    const recentIds = new Set(history.filter((h) => Date.parse(h.at) > cutoff).map((h) => h.id));
    const lastProduct = history.at(-1)?.product ?? null;
    const forcePromo = opt('promo'); // testing: render a specific promo id

    // Flatten to candidates whose screenshot actually exists on disk.
    const candidates = [];
    for (const product of deck.products) {
        let promos = product.promos ?? [];
        if (product.promos_file) {
            try {
                promos = promos.concat(JSON.parse(readFileSync(join(ROOT, product.promos_file), 'utf8')));
            } catch {
                console.warn(`WARN ${product.key}: promos_file ${product.promos_file} missing/unreadable - using inline promos only.`);
            }
        }
        let skipped = 0;
        for (const promo of promos) {
            const shot = promo.screenshot ?? product.screenshot;
            if (!existsSync(join(ROOT, shot))) { skipped++; continue; }
            candidates.push({ product, promo, shot });
        }
        if (skipped > 0) {
            console.warn(`SKIP ${product.key}: ${skipped} promo(s) missing screenshots - run tools/capture-homes.mjs`);
        }
    }
    if (candidates.length === 0) {
        console.error('No promos have screenshots yet. Run: node tools/capture-homes.mjs');
        process.exit(1);
    }

    let chosen;
    if (forcePromo) {
        chosen = candidates.find((c) => c.promo.id === forcePromo);
        if (!chosen) { console.error(`--promo ${forcePromo}: not found or screenshot missing.`); process.exit(1); }
        pickedLabel = `${chosen.product.name} / ${chosen.promo.id} (FORCED via --promo)`;
    } else {
        // Product-first: rotate among products that still have eligible promos.
        const eligible = candidates.filter((c) => !recentIds.has(c.promo.id));
        const byProduct = new Map();
        for (const c of eligible) {
            (byProduct.get(c.product.key) ?? byProduct.set(c.product.key, []).get(c.product.key)).push(c);
        }
        let productKeys = [...byProduct.keys()].filter((k) => k !== lastProduct);
        if (productKeys.length === 0) productKeys = [...byProduct.keys()];

        if (productKeys.length > 0) {
            // Prefer the product that posted least recently (fair round-robin).
            const lastByProduct = new Map();
            for (const h of history) lastByProduct.set(h.product, Date.parse(h.at));
            productKeys.sort((a, b) => (lastByProduct.get(a) ?? 0) - (lastByProduct.get(b) ?? 0));
            const productPool = byProduct.get(productKeys[0]);
            chosen = productPool[Math.floor(Math.random() * productPool.length)];
            pickedLabel = `${chosen.product.name} / ${chosen.promo.id} (product pool ${productPool.length}, ${byProduct.size} products eligible, cooldown ${cooldownDays}d)`;
        } else {
            console.warn(`All ${candidates.length} promos are inside the ${cooldownDays}-day cooldown - relaxing to least-recently-posted.`);
            const lastPosted = new Map(history.map((h) => [h.id, Date.parse(h.at)]));
            chosen = [...candidates].sort((a, b) => (lastPosted.get(a.promo.id) ?? 0) - (lastPosted.get(b.promo.id) ?? 0))[0];
            pickedLabel = `${chosen.product.name} / ${chosen.promo.id} (cooldown relaxed)`;
        }
    }

    const { product, promo, shot } = chosen;

    // Screenshot -> data URI so the temp-file render has no path issues.
    const shotPath = join(ROOT, shot);
    const mime = extname(shotPath) === '.jpg' ? 'image/jpeg' : 'image/png';
    const shotSrc = `data:${mime};base64,${readFileSync(shotPath).toString('base64')}`;

    // Card header: the product's OFFICIAL logo lockup when one exists (each
    // site's real brand art, on a white chip if the lockup is ink-colored);
    // otherwise the text wordmark fallback (CoderStudyFlow's actual brand).
    let logoHtml;
    if (product.logo && existsSync(join(ROOT, product.logo))) {
        const logoSrc = `data:image/png;base64,${readFileSync(join(ROOT, product.logo)).toString('base64')}`;
        const img = `<img class="product-logo" src="${logoSrc}" alt="">`;
        logoHtml = product.logo_chip ? `<span class="logo-chip">${img}</span>` : img;
    } else {
        logoHtml = `<div class="wordmark">${escapeHtml(product.wordmark[0])}<span class="accent">${escapeHtml(product.wordmark[1])}</span><span class="tm">&trade;</span></div>`;
    }

    renderTemplate({
        templatePath: join(ROOT, config.template),
        outPath: imagePath,
        replacements: {
            ACCENT: product.accent,
            PRODUCT_LOGO_HTML: logoHtml,
            TAGLINE: escapeHtml(promo.title ?? product.tagline),
            DISPLAY_URL: escapeHtml(product.url.replace(/^https?:\/\//, '')),
            SCREENSHOT_SRC: shotSrc,
            CTA: escapeHtml(`Try ${product.name} → ${product.url.replace(/^https?:\/\//, '')}`),
        },
    });

    const fill = (s) => s
        .replaceAll('{blurb}', promo.blurb)
        .replaceAll('{product_name}', product.name)
        .replaceAll('{product_url}', product.url)
        .replaceAll('{site_url}', config.site_url);
    caption = config.caption.lines.map(fill).join('\n')
        + '\n\n' + config.caption.hashtags + ' ' + product.hashtags;
    commentMessage = fill(config.comment);

    stateAfterSuccess = (results) => {
        state.history = [...history, { id: promo.id, product: product.key, at: new Date().toISOString() }].slice(-500);
        state.last = { at: new Date().toISOString(), promo: promo.id, product: product.key, posts: results };
    };
} else {
    // ---- QUIZ: random unused question that fits the card --------------------
    const bank = JSON.parse(readFileSync(join(ROOT, config.data_file), 'utf8'));
    const used = new Set(state.used ?? []);

    const lim = config.limits;
    const fits = (r) =>
        r.question.length <= lim.question_max_chars &&
        r.choices.length === 4 &&
        r.choices.every((c) => c.text.length <= lim.choice_max_chars) &&
        (!r.code || (
            r.code.split('\n').length <= lim.code_max_lines &&
            r.code.split('\n').every((l) => l.length <= lim.code_max_cols) &&
            r.question.length <= 120 // question + code both on the card: keep short
        ));

    const pool = bank.filter((r) => !used.has(r.hash) && fits(r));
    if (pool.length === 0) {
        console.error(`Pool exhausted for ${brand} (${bank.length} total, ${used.size} used). Reset state or re-export.`);
        process.exit(1);
    }
    const record = pool[Math.floor(Math.random() * pool.length)];
    pickedLabel = `[${record.track}] ${record.question.slice(0, 80)}... (pool ${pool.length})`;

    renderQuestionCard({
        templatePath: join(ROOT, config.template),
        record,
        outPath: imagePath,
    });

    const fill = (s) => s
        .replaceAll('{track}', record.track)
        .replaceAll('{site_url}', config.site_url)
        .replaceAll('{answer_url}', record.answer_url)
        .replaceAll('{track_url}', record.track_url ?? config.site_url);

    let hashtags = config.caption.hashtags;
    if (config.caption.track_hashtag) {
        hashtags += ' #' + record.track.replace(/[^A-Za-z0-9]+/g, '');
    }
    caption = config.caption.lines.map(fill).join('\n') + '\n\n' + hashtags;
    commentMessage = fill(config.comment);

    stateAfterSuccess = (results) => {
        state.used = [...used, record.hash];
        state.last = { at: new Date().toISOString(), hash: record.hash, track: record.track, posts: results };
    };
}

console.log(`Picked ${pickedLabel}`);
console.log(`Rendered ${imagePath}`);

// ---- publish ----------------------------------------------------------------
const enabled = Object.entries(config.networks)
    .filter(([name, on]) => on && (!onlyNetwork || name === onlyNetwork));

if (dryRun) {
    const payload = { brand, picked: pickedLabel, caption, comment: commentMessage, networks: enabled.map(([n]) => n) };
    writeFileSync(join(outDir, `${brand}-latest.json`), JSON.stringify(payload, null, 2));
    console.log('DRY RUN - nothing posted. Payload written to out/. Caption:\n');
    console.log(caption + '\n\nComment: ' + commentMessage);
    process.exit(0);
}

const results = [];
for (const [name] of enabled) {
    try {
        const res = await PUBLISHERS[name].publish({ imagePath, caption, commentMessage });
        console.log(`Posted to ${name}:`, JSON.stringify(res));
        results.push(res);
    } catch (err) {
        // One network failing must not stop the others.
        console.error(`FAILED ${name}: ${err.message}`);
    }
}

if (results.length === 0) {
    console.error('No network succeeded - state NOT advanced.');
    process.exit(1);
}

stateAfterSuccess(results);
writeFileSync(join(ROOT, config.state_file), JSON.stringify(state, null, 2));
console.log('State advanced.');
