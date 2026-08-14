// Capture homepage screenshots for the promo campaign.
//
//   node tools/capture-homes.mjs [--only <key>] [--dev]
//
// Reads data/mwm-products.json and screenshots each product's capture_url
// (top of the home page, 1440x1100 desktop viewport) into
// brands/moonwhalemedia/assets/<key>-home.png. Products whose site is
// unreachable are skipped with a warning - re-run any time a homepage
// changes. Run locally (screenshots are committed; the Actions runner
// cannot reach *.test dev hosts).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from '../engine/render.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

const deck = JSON.parse(readFileSync(join(ROOT, 'data', 'mwm-products.json'), 'utf8'));

// One capture job per product home + per promo that declares its own page
// (inline promos AND generated promos_file entries). Duplicate screenshot
// targets are deduped so shared pages capture once.
const jobs = [];
const seen = new Set();
const add = (key, url, screenshot) => {
    if (!screenshot || seen.has(screenshot)) return;
    seen.add(screenshot);
    jobs.push({ key, url, screenshot });
};
for (const product of deck.products) {
    if (only && product.key !== only) continue;
    add(product.key, product.capture_url, product.screenshot);
    let promos = product.promos ?? [];
    if (product.promos_file) {
        try {
            promos = promos.concat(JSON.parse(readFileSync(join(ROOT, product.promos_file), 'utf8')));
        } catch { /* generated file not present yet */ }
    }
    for (const promo of promos) {
        if (promo.capture_url && promo.screenshot) {
            add(promo.id, promo.capture_url, promo.screenshot);
        }
    }
}

for (const job of jobs) {
    if (!job.url) {
        console.warn(`SKIP ${job.key}: no capture_url configured (site not reachable yet)`);
        continue;
    }
    const outPath = join(ROOT, job.screenshot);
    mkdirSync(dirname(outPath), { recursive: true });
    const { url } = job;
    const product = job; // key reused in logs below

    try {
        execFileSync(findChrome(), [
            '--headless',
            '--disable-gpu',
            '--hide-scrollbars',
            '--force-device-scale-factor=1',
            // Wide desktop viewport; the promo card crops to the TOP of the page.
            '--window-size=1440,1100',
            '--virtual-time-budget=15000',
            `--user-data-dir=${join(tmpdir(), 'mwm-social-chrome-cap')}`,
            `--screenshot=${outPath}`,
            url,
        ], { stdio: 'pipe', timeout: 60_000 });

        const size = statSync(outPath).size;
        if (size < 20_000) {
            console.warn(`WARN ${product.key}: capture looks empty (${size} bytes) - check ${url}`);
        } else {
            console.log(`OK   ${product.key}: ${url} -> ${job.screenshot} (${Math.round(size / 1024)} KB)`);
        }
    } catch (err) {
        console.warn(`SKIP ${product.key}: could not capture ${url} (${err.message.split('\n')[0]})`);
    }
}
