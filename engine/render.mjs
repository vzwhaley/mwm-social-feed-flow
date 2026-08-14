// HTML -> PNG via headless Chrome. No puppeteer, no npm deps: fill the brand
// template, write a temp HTML file, screenshot it at 1080x1080.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CHROME_CANDIDATES = [
    process.env.CHROME_BIN,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function findChrome() {
    for (const p of CHROME_CANDIDATES) {
        if (existsSync(p)) return p;
    }
    throw new Error('Chrome not found. Set CHROME_BIN to the browser executable.');
}

export const escapeHtml = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function screenshotHtml(html, outPath) {
    const tmpHtml = join(tmpdir(), `mwm-social-${Date.now()}-${Math.floor(Math.random() * 1e6)}.html`);
    writeFileSync(tmpHtml, html, 'utf8');

    mkdirSync(resolve(outPath, '..'), { recursive: true });

    // Legacy --headless renders custom backgrounds more reliably (house lesson
    // from the NewsroomFlow logo renders); keep flags conservative.
    execFileSync(findChrome(), [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        `--screenshot=${resolve(outPath)}`,
        '--window-size=1080,1080',
        `--user-data-dir=${join(tmpdir(), 'mwm-social-chrome')}`,
        pathToFileURL(tmpHtml).href,
    ], { stdio: 'pipe' });

    const size = statSync(outPath).size;
    if (size < 10_000) {
        throw new Error(`Rendered image suspiciously small (${size} bytes): ${outPath}`);
    }
    return outPath;
}

/**
 * Generic template render: fill {{PLACEHOLDER}}s and screenshot the result.
 * NO escaping is applied here - the caller escapes text values (raw HTML like
 * data-URI <img> sources must pass through untouched).
 */
export function renderTemplate({ templatePath, replacements, outPath }) {
    let html = readFileSync(templatePath, 'utf8');
    for (const [key, value] of Object.entries(replacements)) {
        html = html.replaceAll(`{{${key}}}`, value);
    }
    // House rule: every card carries the round Moon Whale Media logo in the
    // bottom-right corner. Templates reference {{MWM_LOGO_SRC}}; the renderer
    // injects it as a data URI so temp-file rendering has no path issues.
    if (html.includes('{{MWM_LOGO_SRC}}')) {
        const logoPath = join(REPO_ROOT, 'brands', 'moonwhalemedia', 'assets', 'mwm-logo-round.png');
        const logo = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`;
        html = html.replaceAll('{{MWM_LOGO_SRC}}', logo);
    }
    // Spantaran is EXCLUSIVELY the Moon Whale Media company font: templates use
    // it for moonwhale.media / "by moon whale media, llc" references only.
    if (html.includes('{{SPANTARAN_SRC}}')) {
        const fontPath = join(REPO_ROOT, 'brands', 'moonwhalemedia', 'assets', 'Spantaran.ttf');
        const font = `data:font/ttf;base64,${readFileSync(fontPath).toString('base64')}`;
        html = html.replaceAll('{{SPANTARAN_SRC}}', font);
    }
    return screenshotHtml(html, outPath);
}

/** Quiz campaign: fill the template with a question record and screenshot it. */
export function renderQuestionCard({ templatePath, record, outPath }) {
    const letters = ['A', 'B', 'C', 'D'];
    const choicesHtml = record.choices
        .map((c, i) =>
            `<div class="choice"><span class="letter">${letters[i]})</span><span>${escapeHtml(c.text)}</span></div>`)
        .join('\n                ');

    return renderTemplate({
        templatePath,
        outPath,
        replacements: {
            TITLE: escapeHtml(`${record.track} · ${record.category ?? 'Practice'} · ${record.difficulty}`),
            QUESTION: escapeHtml(record.question),
            CODE_BLOCK: record.code ? `<div class="code">${escapeHtml(record.code)}</div>` : '',
            CHOICES: choicesHtml,
        },
    });
}
