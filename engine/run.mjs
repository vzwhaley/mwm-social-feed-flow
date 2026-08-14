// Orchestrator: pick a random unused question -> render the card -> publish
// to every enabled network -> mark the question used.
//
//   node engine/run.mjs --brand coderstudyflow [--dry-run] [--network facebook]
//
// --dry-run renders the image + writes the caption/comment payload to out/
// without calling any network API or touching state.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderQuestionCard } from './render.mjs';
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

const config = JSON.parse(readFileSync(join(ROOT, 'brands', brand, 'config.json'), 'utf8'));
const bank = JSON.parse(readFileSync(join(ROOT, config.data_file), 'utf8'));

let state = { used: [] };
try {
    state = JSON.parse(readFileSync(join(ROOT, config.state_file), 'utf8'));
} catch { /* first run */ }
const used = new Set(state.used);

// ---- pick: random unused question that FITS the card ----------------------
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
console.log(`Picked [${record.track}] ${record.question.slice(0, 80)}... (pool ${pool.length})`);

// ---- render ----------------------------------------------------------------
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(ROOT, 'out');
mkdirSync(outDir, { recursive: true });
const imagePath = join(outDir, `${brand}-latest.png`);
renderQuestionCard({
    templatePath: join(ROOT, config.template),
    record,
    outPath: imagePath,
});
console.log(`Rendered ${imagePath}`);

// ---- captions ---------------------------------------------------------------
const fill = (s) => s
    .replaceAll('{track}', record.track)
    .replaceAll('{site_url}', config.site_url)
    .replaceAll('{answer_url}', record.answer_url)
    .replaceAll('{track_url}', record.track_url ?? config.site_url);

let hashtags = config.caption.hashtags;
if (config.caption.track_hashtag) {
    hashtags += ' #' + record.track.replace(/[^A-Za-z0-9]+/g, '');
}
const caption = config.caption.lines.map(fill).join('\n') + '\n\n' + hashtags;
const commentMessage = fill(config.comment);

// ---- publish ----------------------------------------------------------------
const results = [];
const enabled = Object.entries(config.networks)
    .filter(([name, on]) => on && (!onlyNetwork || name === onlyNetwork));

if (dryRun) {
    const payload = { brand, stamp, record: { track: record.track, hash: record.hash, answer_url: record.answer_url }, caption, comment: commentMessage, networks: enabled.map(([n]) => n) };
    writeFileSync(join(outDir, `${brand}-latest.json`), JSON.stringify(payload, null, 2));
    console.log('DRY RUN - nothing posted. Payload written to out/. Caption:\n');
    console.log(caption + '\n\nComment: ' + commentMessage);
    process.exit(0);
}

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
    console.error('No network succeeded - question NOT marked used.');
    process.exit(1);
}

// ---- mark used ---------------------------------------------------------------
state.used = [...used, record.hash];
state.last = { at: new Date().toISOString(), hash: record.hash, track: record.track, posts: results };
writeFileSync(join(ROOT, config.state_file), JSON.stringify(state, null, 2));
console.log(`Marked used (${state.used.length}/${bank.length}).`);
