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
posting anywhere.

## Going live — credentials

Set these as **GitHub Actions secrets** (Settings → Secrets and variables →
Actions) — never commit them:

| Secret | What / where |
|---|---|
| `FB_PAGE_ID` | The Facebook Page's numeric id (Page → About). |
| `FB_PAGE_TOKEN` | Long-lived Page access token: Meta developer app (Business type) → Business Manager → System User → generate token with `pages_manage_posts`, `pages_read_engagement`. Posting to your OWN page needs no App Review. |
| `X_API_KEY` / `X_API_SECRET` | X developer app (free tier: 500 posts/mo). |
| `X_ACCESS_TOKEN` / `X_ACCESS_SECRET` | User access token/secret for the brand account (Read & Write). |
| `IG_USER_ID` / `IG_ACCESS_TOKEN` | Later: Instagram Business account linked to the FB Page (same Meta app). |
| `LI_ORG_ID` / `LI_ACCESS_TOKEN` | Later: LinkedIn Company Page via Community Management API (requires approval). |

Enable/disable networks per brand in `brands/<brand>/config.json`
(`"networks": {"facebook": true, ...}`) — a network with `false` or missing
secrets is skipped with a log line, never a crash.

## Repo layout

```
brands/coderstudyflow/config.json   # schedule, networks, caption/hashtags, urls
brands/coderstudyflow/template.html # 1080x1080 terminal-card template
data/coderstudyflow.json            # exported question pool (private repo!)
engine/run.mjs                      # orchestrator (pick -> render -> publish)
engine/render.mjs                   # headless-Chrome HTML -> PNG
engine/publishers/{facebook,x,instagram,linkedin}.mjs
state/coderstudyflow.json           # used-question hashes (committed by CI)
out/                                # rendered images (gitignored)
```

## Adding another brand (AstrologerFlow, etc.)

1. Product side: add an exporter that emits the same record shape
   (`question`-like content + `hash` + `answer_url`/`link`).
2. Here: `brands/<slug>/config.json` + `brands/<slug>/template.html`.
3. Add the brand to the workflow matrix and its secrets.

**PRIVATE REPO.** `data/*.json` is proprietary question-bank content
(© Moon Whale Media, LLC) — this repository must never be public.
