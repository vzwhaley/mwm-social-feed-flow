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
    // ---- PROMO: pick randomly among promos OUTSIDE the cooldown window ------
    // Every product carries a stack of promos (overview + feature drill-downs,
    // each optionally with its own page screenshot). A promo that posted within
    // cooldown_days is ineligible, and the same product never posts twice in a
    // row - so at 4 posts/day the feed doesn't repeat itself.
    const deck = JSON.parse(readFileSync(join(ROOT, config.data_file), 'utf8'));
    const cooldownDays = config.cooldown_days ?? 5;
    const history = state.history ?? [];
    const cutoff = Date.now() - cooldownDays * 86_400_000;
    const recentIds = new Set(history.filter((h) => Date.parse(h.at) > cutoff).map((h) => h.id));
    const lastProduct = history.at(-1)?.product ?? null;

    // Flatten to candidates whose screenshot actually exists on disk.
    const candidates = [];
    for (const product of deck.products) {
        for (const promo of product.promos) {
            const shot = promo.screenshot ?? product.screenshot;
            if (!existsSync(join(ROOT, shot))) {
                console.warn(`SKIP ${promo.id}: screenshot missing (${shot}) - run tools/capture-homes.mjs`);
                continue;
            }
            candidates.push({ product, promo, shot });
        }
    }
    if (candidates.length === 0) {
        console.error('No promos have screenshots yet. Run: node tools/capture-homes.mjs');
        process.exit(1);
    }

    // Eligibility tiers: outside cooldown + different product than last post;
    // relax constraints only if a tier comes up empty (tiny decks still post).
    let pool = candidates.filter((c) => !recentIds.has(c.promo.id) && c.product.key !== lastProduct);
    if (pool.length === 0) pool = candidates.filter((c) => !recentIds.has(c.promo.id));
    if (pool.length === 0) {
        console.warn(`All ${candidates.length} promos are inside the ${cooldownDays}-day cooldown - relaxing to least-recently-posted.`);
        const lastPosted = new Map(history.map((h) => [h.id, Date.parse(h.at)]));
        pool = [...candidates].sort((a, b) => (lastPosted.get(a.promo.id) ?? 0) - (lastPosted.get(b.promo.id) ?? 0)).slice(0, 1);
    }

    const { product, promo, shot } = pool[Math.floor(Math.random() * pool.length)];
    pickedLabel = `${product.name} / ${promo.id} (pool ${pool.length}/${candidates.length}, cooldown ${cooldownDays}d)`;

    // Screenshot -> data URI so the temp-file render has no path issues.
    const shotPath = join(ROOT, shot);
    const mime = extname(shotPath) === '.jpg' ? 'image/jpeg' : 'image/png';
    const shotSrc = `data:${mime};base64,${readFileSync(shotPath).toString('base64')}`;

    renderTemplate({
        templatePath: join(ROOT, config.template),
        outPath: imagePath,
        replacements: {
            ACCENT: product.accent,
            WORDMARK_A: escapeHtml(product.wordmark[0]),
            WORDMARK_B: escapeHtml(product.wordmark[1]),
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
