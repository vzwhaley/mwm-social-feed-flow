# Moon Whale Media — Logo & Font Style Guide

The per-site brand reference for every Moon Whale Media product: which font
each logo wordmark uses, the accent palette, where the source lockup lives,
and how it behaves on dark backgrounds (the promo cards' native environment).
Compiled 2026-08-14 from each site's live components and Tailwind configs.

---

## The company brand (Moon Whale Media, LLC)

| Element | Treatment |
|---|---|
| Company font | **Spantaran** — `Spantaran.ttf`, shipped in every site's `public/fonts/` as Tailwind `font-brand` |
| **Exclusivity rule** | Spantaran is used **ONLY** for Moon Whale Media company references: the `by moon whale media, llc` tagline/signature (always lowercase, always a link to https://moonwhale.media) and company URLs like `moonwhale.media`. **Never** for product wordmarks, headings, or body text. |
| Logo | Whale-tail-in-moon art (purple/pink gradient). Round-cropped version: `brands/moonwhalemedia/assets/mwm-logo-round.png` (source: Desktop `mwm_logo.jpg`). Appears bottom-right on every social card. |
| Tagline | The `by moon whale media, llc` line is **mandatory** in every product lockup — never ship mark-only or wordmark-only (see the `mwm-brand` skill). |
| Boilerplate | "Moon Whale Media, LLC" · © lines read `© <year> Moon Whale Media, LLC` |

---

## CoderStudyFlow — coderstudyflow.com

| Element | Treatment |
|---|---|
| Wordmark font | **JetBrains Mono** (bold; site `font-display`, loaded from Bunny with Figtree) |
| Wordmark | `CoderStudy` in ink `#0f172a` (white on dark) + `Flow` in brand amber + superscript ™ |
| Mark | Amber code-brackets + cap glyph (`public/favicon.svg`) |
| Body font | Figtree |
| Accent | Terminal amber — Tailwind `amber` as `brand`; buttons `bg-brand-500` (#f59e0b) with `text-ink` (white-on-amber fails AA); small text uses `brand-700`+ |
| Theme | Dark "terminal" hero, retro amber on ink `#0f172a` |
| Lockup source | `coder-study-flow-web/resources/js/Components/BrandLogo.vue` |
| On dark | Native — white + amber |

## NewsroomFlow — newsroomflow.app

| Element | Treatment |
|---|---|
| Wordmark font | **Source Serif 4** (Georgia fallback; site `font-serif`, bold) — newspaper-style serif |
| Wordmark | `Newsroom` ink (white in dark variant) + `Flow` brand-600 `#2563eb` (brand-400 `#60a5fa` on dark) + ™ |
| Mark | Newspaper outline SVG, `currentColor` (brand-600 light / brand-300 `#93c5fd` dark) |
| Body font | Figtree |
| Accent | Blue — Tailwind blue as `brand` (600 `#2563eb` primary); ink `#0f172a` |
| Lockup source | `newsroom-flow-web/resources/js/Components/BrandLogo.vue` (has explicit light/dark variants); rendered: `public/img/email-logo.png` (LIGHT bg only) |
| On dark | Use the component's dark variant (white/blue) — the email PNG is ink-colored and disappears on dark |

## AstrologerFlow — astrologerflow.app

| Element | Treatment |
|---|---|
| Wordmark font | **Cormorant Garamond** (Georgia fallback; site `font-display`) — elegant serif |
| Wordmark | `Astrologer` white + `Flow` cyan, ™ |
| Mark | Crescent moon with stars, blue→violet gradient, soft glow |
| Body font | Figtree |
| Accent | Violet/cyan on the "cosmic" deep-purple scale (`cosmic-950 #070713` …); promo accent `#8b5cf6` |
| Lockup source | `astrologerflow-web/public/images/logo-lockup.png` (dark-native) + `logo-mark.png`; component `ApplicationLogo.vue` |
| On dark | Native — white/cyan on transparent |

## FileManagerFlow — filemanagerflow.app

| Element | Treatment |
|---|---|
| Wordmark font | **Figtree SemiBold (600)** (site `sans`; letter-spacing −2 at display sizes) |
| Wordmark | `FileManagerFlow` gray-900 `#111827` + ™; dark treatment flips wordmark to white (blessed in the SVG source comments) |
| Mark | Indigo rounded tile `#4F46E5` (locked hex — never recolor) + white folder + indigo content lines |
| Tagline colors | gray-600 `#4B5563` light / slate-300 `#cbd5e1` dark |
| Accent | Indigo `#4F46E5` (Tailwind indigo-600; mirrored by hex in the Android/iOS themes) |
| Lockup source | `filemanagerflow-web/public/img/logo-full.svg` (vector master, 2560×540, extensively documented in-file) + `logo.svg`, `logo-mark.svg` |
| On dark | White-wordmark recolor of logo-full.svg (indigo tile unchanged) |

## MyEmergencyScreen — myemergencyscreen.com

| Element | Treatment |
|---|---|
| Wordmark font | **Inter ExtraBold** (site `sans`, `font-extrabold tracking-tight`) |
| Wordmark | `My Emergency Screen` white (dark) / brand-navy (light) + superscript ™ |
| Mark | Navy gradient badge `#1B4F8A → #0D2B52`, white phone screen, red medical cross + heartbeat pulse `#C0392B` |
| Accent | Emergency red `#C0392B` + brand navy |
| Tagline colors | slate-300 dark / slate-600 light |
| Lockup source | `myemergencyscreen-web/resources/js/Components/BrandLogo.vue` (no rendered PNG on the site — social asset rendered from component markup) |
| On dark | Native (dark variant: white wordmark) |

## SocialStashFlow — socialstashflow.app

| Element | Treatment |
|---|---|
| Wordmark font | **Outfit** (site `font-display`, bold, `tracking-tight`) |
| Wordmark | `SocialStash` white + `Flow` in red gradient text (`from-red-500 to-red-400`, bg-clip-text) + ™ |
| Mark | Red gradient rounded-xl tile (`from-red-600 to-red-500`, glow shadow) with white bookmark + punched-out play triangle |
| Body font | Figtree |
| Accent | Red `#ef4444` on near-black ink (`ink-950 #050505`) — "dark cinematic board" |
| Tagline color | slate-400 |
| Lockup source | `social-stash-flow-web/resources/js/Components/StashLogo.vue` (no rendered PNG — social asset rendered from component markup) |
| On dark | Native — the whole site is dark |

## The Cardback Cantina — thecardbackcantina.com

| Element | Treatment |
|---|---|
| Wordmark font | **DM Sans Bold (700)** (site `font-display`) |
| Wordmark | `The Cardback Cantina` — white on dark (header) / blue-900 on light. **No orange/amber** — the amber `cantina-logo-dark-transparent.png` is NOT the site lockup. |
| Mark | Blue cardback/tablet emblem image: `public/images/cardback-mark.png` |
| Accent | Blue (blue-600 buttons, blue-400 tagline link on dark) |
| Tagline colors | slate-300 dark / slate-500 light; llc link blue-600 light / blue-400 dark |
| Lockup source | `the-cardback-cantina-web/resources/js/Components/ApplicationLogo.vue` (live web-font text + mark image) |
| On dark | Native (header IS dark navy) |

---

## Rules of thumb when rendering any lockup

1. **Read the component, not an old PNG.** The source of truth is each site's
   `BrandLogo.vue` / `ApplicationLogo.vue` + `tailwind.config.js` — rendered
   PNGs on disk can be stale or wrong-background variants.
2. **Spantaran = company only.** Product wordmark in the product's font;
   `by moon whale media, llc` in Spantaran; ™ always present.
3. **Embed fonts as base64 data URIs** when rendering with headless Chrome
   (file:// font subresources are unreliable); use legacy `--headless` +
   `--default-background-color=00000000` for transparent PNGs.
4. **Dark cards use dark variants** — never a white chip behind a logo; if a
   lockup only exists ink-on-transparent, rebuild its documented dark
   treatment (white wordmark, marks/accents unchanged).
5. Social-card copies of all logo assets live in
   `brands/moonwhalemedia/assets/logos/<product>.png` in this repo.
