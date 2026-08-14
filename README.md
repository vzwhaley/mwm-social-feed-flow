# Social Feed Flow — the Moon Whale Media Social Auto-Poster (mwm-social-feed-flow)

Cross-brand engine that turns product content into branded images and posts
them to social media on a schedule with **zero manual interaction**. First
brand: **CoderStudyFlow** (4 posts/day — a random practice question rendered as
a terminal-style card, answer behind a permalink on the site).

## How a post happens

1. **Pick** — `engine/run.mjs` picks a random *unused* question from
   `data/<brand>.json` (exported from the product; see below), skipping
   anything too long to fit the card. Used hashes accumulate in
   `state/<brand>.json` so nothing repeats until the pool cycles.
2. **Render** — the brand template (`brands/<brand>/template.html`) is filled
   in and screenshotted to a 1080×1080 PNG by **headless Chrome** (no
   puppeteer, no npm deps — plain `chrome --headless --screenshot`).
3. **Publish** — direct API calls (no third-party scheduler fees):
   - **Facebook Page**: photo post with caption, then an auto-comment
     "💡 See the correct answer at CoderStudyFlow™ 👉 <answer link>".
   - **X**: media upload + tweet (OAuth 1.0a signed in-process).
   - **Instagram**: stubbed until image hosting is wired (IG requires a
     public image URL).
   - **LinkedIn**: stubbed pending Community Management API approval.
4. **Schedule** — `.github/workflows/post.yml` cron-fires 4×/day
   (6a/12p/6p/12a US Eastern) and commits the updated state file back.

The answer link goes to `coderstudyflow.com/answer/{track}/{sha1(question)}` —
a public, noindexed landing page in the product that shows exactly that
question with the correct answer, the explanation, and Start-Free/Study-CTA.
The hash key means links survive database reseeds and the bank cannot be
enumerated (you need the question text to build a URL).

## Refresh the question pool

From `coder-study-flow-web`:

```bash
php artisan social:export
```

writes `data/coderstudyflow.json` here (easy/medium only — hard questions stay
Pro-only). Re-run after each release build, then commit.

## Local dry run (no tokens needed)

```bash
node engine/run.mjs --brand coderstudyflow --dry-run
```

Renders `out/coderstudyflow-latest.png` and writes
`out/coderstudyflow-latest.json` (caption + comment + answer URL) without
posting anywhere. Note: dry-run never advances state/, so repeated dry-runs
can pick the same product - real posts rotate via the committed history.

## Going live — credentials

Set these as **GitHub Actions secrets** (Settings → Secrets and variables →
Actions) — never commit them:

| Secret | What / where |
|---|---|
| `FB_PAGE_ID` | The Facebook Page's numeric id (Page → About). Default = the CoderStudyFlow page. |
| `FB_PAGE_TOKEN` | Long-lived Page access token: Meta developer app (Business type) → Business Manager → System User → generate token with `pages_manage_posts`, `pages_read_engagement`. Posting to your OWN page needs no App Review. |
| `MOONWHALEMEDIA_FB_PAGE_ID` / `MOONWHALEMEDIA_FB_PAGE_TOKEN` | Same recipe for the Moon Whale Media page. Any brand can be pointed at its own page via `<BRAND>_FB_PAGE_ID`-style secrets (brand slug uppercased, no dashes) — prefixed secrets beat the defaults. |
| `X_API_KEY` / `X_API_SECRET` | X developer app (free tier: 500 posts/mo). |
| `X_ACCESS_TOKEN` / `X_ACCESS_SECRET` | User access token/secret for the brand account (Read & Write). |
| `IG_USER_ID` / `IG_ACCESS_TOKEN` | Later: Instagram Business account linked to the FB Page (same Meta app). |
| `LI_ORG_ID` / `LI_ACCESS_TOKEN` | Later: LinkedIn Company Page via Community Management API (requires approval). |

Enable/disable networks per brand in `brands/<brand>/config.json`
(`"networks": {"facebook": true, ...}`) — a network with `false` or missing
secrets is skipped with a log line, never a crash.

## Repo layout

```
BRAND_STYLE_GUIDE.md                  # per-site logo/font/accent reference
brands/coderstudyflow/                # quiz campaign: config + terminal card
brands/moonwhalemedia/                # promo campaign: config + product card
brands/moonwhalemedia/assets/         # round MWM logo, Spantaran.ttf,
                                      #   logos/<product>.png (official lockups),
                                      #   page screenshots (+ csf-tracks/)
data/coderstudyflow.json              # exported question pool (private repo!)
data/mwm-products.json                # promo copy deck (all products)
data/coderstudyflow-track-promos.json # generated: one promo per track
data/coderstudyflow-tracks.json       # track manifest (from the product DB)
engine/run.mjs                        # orchestrator (pick -> render -> publish)
engine/render.mjs                     # headless-Chrome HTML -> PNG (+ MWM logo
                                      #   and Spantaran data-URI injection)
engine/publishers/{facebook,x,instagram,linkedin}.mjs
tools/capture-homes.mjs               # screenshot every promo page
tools/generate-csf-track-promos.mjs   # regenerate per-track promos
state/<brand>.json                    # cooldown history (committed by CI)
out/                                  # rendered images (gitignored)
```

House brand rules (fonts per product, Spantaran = company-only, dark-variant
lockups) live in **BRAND_STYLE_GUIDE.md** — read it before touching templates.

## The promo campaign (Moon Whale Media page)

`brands/moonwhalemedia` is a `type: "promo"` campaign: every MWM product
carries a **stack of promos** in `data/mwm-products.json` — one overview plus
feature drill-downs, each with its own card title, caption blurb, and
optionally its own page screenshot (pricing page, guides page, ...), so the
images vary as much as the copy. The card is the product wordmark + a mock
browser window framing a real page screenshot + an accent CTA band + the
Moon Whale Media footer.

**No-repeat picker:** a promo that posted within `cooldown_days` (5) is
ineligible, and the same product never posts twice in a row. State keeps the
post history; if every promo is somehow inside the cooldown, the
least-recently-posted one runs rather than nothing.

**Screenshots:** `node tools/capture-homes.mjs` captures every product home +
every promo-specific page (from `capture_url` — currently the Herd dev hosts,
since the production domains are not live yet). All 7 products currently have
captures and are in rotation. Products with no reachable site are skipped
automatically until their screenshot exists. **Recapture from the LIVE domains
after each product launches** (dev captures can show the dev-only ad
placeholder), then commit the new PNGs.

Growing the deck = editing `data/mwm-products.json` — add promos freely; more
promos means longer before anything repeats.

## Adding another brand / campaign

1. Content source: a `quiz` brand needs an exporter emitting the question
   record shape (`question` + `hash` + `answer_url`); a `promo` brand needs a
   product entry (with promos) in a data file.
2. Here: `brands/<slug>/config.json` (+ template if the look differs).
3. Add the brand to the workflow matrix and its `<BRAND>_FB_*` secrets.

**PRIVATE REPO.** `data/*.json` is proprietary question-bank content
(© Moon Whale Media, LLC) — this repository must never be public.
