# Design

Canonical tokens: `brand/tokens.css` (single source of truth). Full reference: `brand/design-system.html`. Print one-pager: `brand/brand-book-a4.pdf`. Everything below was extracted from the official set logo + card art on 2026-06-10.

## Theme

Dark cinematic ember. Stage `#0B0A10` (near-black, faint violet undertone); raised surfaces `#14121D`; hairlines `#262333`. Dark is forced by the scene: card art and holo effects glow against a dark gallery wall; a light theme would flatten both.

## Color

- **Phantom** `#E763C6 → #7B3FA8` (primary accent; from "PHANTASMAL" chrome lettering)
- **Ember** `#F9C940 → #F08C1E → #E0451F` (heat and value; from "MEGA EVOLUTION" banner)
- **Spectral** `#7FD4F4 → #2C5BB4` (data, focus; from "FLAMES" ice lettering)
- **Ghostflame** `#6C2EA6` (ambient glow only)
- Price tiers (absolute USD thresholds): T1 `<$1` `#4B485A` · T2 `$1–5` `#56C271` · T3 `$5–20` `#3D9BE0` · T4 `$20–75` `#A85FE0` · T5 `≥$75` `#FF5A1F` · unpriced `#2E2B3A`
- Text ramp: `#EDEAF4` / `#9B95AB` (dim) / faint reserved for decorative-only elements

## Typography

- **Rolide** (licensed, `assets/fonts/`) — display: card titles, counters, poster type. Expanded sans, single weight + true italic; `font-synthesis: none` globally so no faux bold.
- **Soge + Lust** (licensed) — the POKEX wordmark ONLY: "POKE" in Soge handwriting (text color), "X" in Lust cyber-brush (ember + glow). Never for body or titles.
- **Outfit** (UI/body) — recessive geometric
- **JetBrains Mono** (prices, set numbers, timestamps)
- Scale: hero `clamp(28px–44px)`, card name `clamp(20px–30px)`, body 16, small 13, micro 11 with 0.14em tracking
- Site name: **POKEX** (sub-lockup "PHANTASMAL FLAMES" identifies the current set)

## Spacing

4-base scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 (`--s-1` … `--s-9`).

## Motion

- Glide `cubic-bezier(.22,1,.36,1)`; snap `cubic-bezier(.16,1,.3,1)` 450ms; zoom pop `cubic-bezier(.34,1.4,.64,1)` 550ms
- JS physics: friction 0.92/frame, wheel gain 0.0045, snap threshold 0.012
- Reduced motion: instant steps, no tilt/shine

## Texture

Monochrome grainy-gradient photographs (licensed pack, sources in `~/Downloads/grainy-gradient-backgrounds-*.zip`), always blend-mode layers, never literal backgrounds:
- `assets/grain-1.jpg` — diagonal light sweep; `body::before`, `mix-blend-mode: screen` at 0.26 — lifts the void stage.
- `assets/grain-2.jpg` — silky flow; `.zoom-grain` over the blurred card art in the inspect backdrop, `mix-blend-mode: overlay` at 0.55.
Being grayscale, they inherit all color from the layers beneath — add new uses the same way (screen to lift dark surfaces, overlay to texture imagery).

## Components

- **Minimap rail**: single ARIA slider, decorative per-card ticks colored by tier, current tick tall + glow
- **Price chip**: pill, mono, tier-tinted bg/border; T5 gets ember glow
- **Caption strip**: Unbounded name + mono metadata line
- **Zoom dialog**: native `<dialog>`, holo tilt + shine (intensity by rarity), per-variant price table, side panel ≥1024px / bottom sheet below
- Card corner radius `4.5% / 3.2%` (physical TCG ratio)
