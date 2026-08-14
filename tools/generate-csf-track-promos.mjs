// Generate one promo per CoderStudyFlow track (111 and counting) from the
// track manifest exported by the product:
//
//   data/coderstudyflow-tracks.json  (slug/name/questions/guides per track)
//     -> data/coderstudyflow-track-promos.json (promos_file for the deck)
//
// Titles/blurbs rotate across templates (seeded by index, so output is stable
// across runs) with REAL per-track counts injected. Each promo captures that
// track's own Study Center page - 111 visually distinct cards.
//
// Re-run after each release build:
//   php artisan social:export && (re-export the manifest) && node tools/generate-csf-track-promos.mjs && node tools/capture-homes.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEV_HOST = 'https://coderstudyflow.test';

const tracks = JSON.parse(readFileSync(join(ROOT, 'data', 'coderstudyflow-tracks.json'), 'utf8'));

const titleTemplates = [
    (t) => `The ${t.name} track: ${t.questions} questions, ${t.guides} study guides`,
    (t) => `Think you know ${t.name}? ${t.questions} questions say prove it`,
    (t) => `${t.name} interviews won't surprise you after ${t.questions} questions`,
    (t) => `Master ${t.name} - ${t.questions} questions with the why behind every answer`,
];

const blurbTemplates = [
    (t) => `The ${t.name} track packs ${t.questions} original questions and ${t.guides} study guides - every answer explained, every test freshly randomized. Start free and see where you stand. 🎯`,
    (t) => `Prepping for a ${t.name} interview or cert? Drill ${t.questions} questions by topic or take the Full Mix, then read the explanation behind every single answer. 💡`,
    (t) => `${t.name} is on the menu: ${t.questions} questions, ${t.guides} study guides, instant scoring, and a written WHY for every answer. Take a free test today. 🧠`,
    (t) => `From fundamentals to the tricky corners, the ${t.name} track's ${t.questions} questions and ${t.guides} guides cover what actually comes up. Randomized every attempt. 🚀`,
];

const promos = tracks.map((t, i) => ({
    id: `csf-track-${t.slug}`,
    title: titleTemplates[i % titleTemplates.length](t),
    blurb: blurbTemplates[(i + 1) % blurbTemplates.length](t),
    screenshot: `brands/moonwhalemedia/assets/csf-tracks/${t.slug}.png`,
    capture_url: `${DEV_HOST}/technologies/${t.slug}`,
}));

writeFileSync(
    join(ROOT, 'data', 'coderstudyflow-track-promos.json'),
    JSON.stringify(promos, null, 2),
);
console.log(`${promos.length} track promos written to data/coderstudyflow-track-promos.json`);
