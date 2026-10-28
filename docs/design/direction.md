# Crowns direction (overhaul, 27 Oct 2026)

Faisal's asks: `p-checklist-2026-10-27.md`. Faisal said "just do it": references are picked by the design bot from the hunt and named per section below, so every choice can be traced and swapped.

## Register and thesis

Hybrid: a brand showcase on the homepage, a fast tracker everywhere else.
Thesis: a night-blue vault where every game's chase cards circle a gold crown, and live prices show which ones are rising.

## Contract (taken from the homepage Faisal likes; every page follows it)

- Ground: navy `#060c1e` to `#0b1838`, the topographic contour field, film-soft vignette. Never flip to a light page (G8).
- Text: ink `#eaf2ff`, dim `#90a6cc`. Body 17px at 2560 (16px floor), micro labels 12px minimum.
- One accent: gold `#ffd24a` (light `#ffe9a8`, deep `#d99a2e`), spent on the crown, the primary action and money that matters. Blue `#3b82ff`/`#6aa8ff` only for focus and data lines.
- Real colour comes from the cards: carousel ground = the set's colour, inspect ground = the card's colour (standing rule, G12).
- Rising = green `#3ddc84`, falling = red `#ff5a5a`, always with the arrow and the unit (%, $).
- Type: Anton for display (uppercase, tight), DM Sans for UI and body, tabular figures for prices.
- Radii: cards keep the physical TCG corner (4.5% / 3.2%); panels 14px; buttons are pills only when single-line.
- Icons: none from stock sets (G5). Real marks only: game logos, set logos, card art, the crown.
- Motion: one easing family, `cubic-bezier(.16,1,.3,1)` (expo-out) for arrivals, `power2.inOut` for scrubs; 450 to 700 ms for arrivals, 180 ms for hovers. Nothing bobs or floats on a loop (G3) except the crown's slow turn, which is the logo.

## Clichés refused

- Floating glass "stat cards" beside a hero (the old spotlight side panels): replaced by real set logos and real cards.
- Generic thin slider as the carousel dial: replaced (see Dial).
- Gradient text, purple-to-blue AI glow, emoji, stock line icons.

## Sections and their references

Filled in as each section is built. Each row: what it follows, from where, and why.

| section | follows | source |
|---|---|---|
| Header | Homepage floating bar, darker fade at the top (Faisal, 27 Oct) | current build |
| Crown (logo + hero centrepiece) | Culture study direction "Foil, not bullion" + "crown as a set symbol": cards standing as the points, stepping up to a tall centre card, gold refractor foil with etched spiral lines on a satin-black band (Higgsfield concept-11). Modelled by Meshy 7.1 from concept-11 (assets/crown/crown.glb, slimmed in Blender), lit in crown3d.js with a dark studio; the coded version stays as the fallback and read as "gold bars on a plate" in review. The imperial Meshy crown was dropped: it read as museum regalia, and gold on navy is One Piece's card back | docs/design/culture/study.md, docs/design/crown/concept-11.png |
| Hero ring around the crown | Shaky Picks (myshaky.com/picks): a ring of cards around one centred element; Rabo Art Collection (art.rabobank.nl): tilted ellipse, near cards cross in front of the centre, far ones pass behind | hunt/hero-crown 1, 2 |
| Spotlight + trending strip | PokeData home: real set logo, name, then that set's top card with price; Collectr: real game logos on dark | hunt/trending-strip 1, 3 |
| Set page | Scryfall set page: one slim header (logo, card count, release date, total set value) then a fast whole-set browse; Pokedesk: set logo + completion + value; Wizards Hobbit gallery: set hero with key art | hunt/set-page 1, 4, 3 |
| Dial | 21st.dev matte-scrub-slider (waveform) + filmstrip-scrub (thumbnail tip); Ruler Picker for the readout | hunt/21st, hunt/scrubber 1, 5 |
| Product page | Nothing Phone (3): product centred, feature tiles around it, compact buy panel; StockX ETB: market price, last sale, trust rows; Teenage Engineering EP-133: restraint | hunt/product-page 1, 2, 4 |
| Rip Lab pack | Pokémon TCG Pocket: swipe across the top, the tear follows your finger, then the cards; Dribbble "Pack Opening 3D" sports cards: foil crinkle and highlights on near-black | hunt/pack-rip 1, 2 |
| Crown, arcade (replaces the rows above, 27 Oct late) | Faisal's call: the older royal crown's mode (gold, sapphires) made arcade-like, "really good quality" but stylised, with cards fitted all around. Higgsfield arcade-35 → Meshy 7.1 → `assets/crown/crown-arcade.glb`; cards seated in its ten measured windows, card backs inside; `light: 'arcade'` (warm sky over deep blue floor, warm key, cool rim). Header logo = the same crown without cards, animated WebP | docs/design/crown/arcade-35.png, arcade-35-slots-refined.json |
| This week's spotlight | Faisal's own homepage stage: the grid floor and lamp under "SPOTLIGHT" came from his original PSD and he kept it ("It looks great, just gotta be better done"), so the reviewer's call to drop the grid is overruled by his approval (G26). What changed is the light: a theatre followspot, one beam from a fixed rig above, its pool drawn on the floor, cards in its path; it travels to the card you point at (his "more interactive") | Faisal's PSD stage, theatre followspot practice |
| This week's spotlight: filling the stage (28 Oct) | Faisal: "so much dead space to the left, to the right, even above it... just gotta be better done". Kept: title, three cards (lead centre under the crown), the lamp fixed on the lead, the week / month / year tabs, the big gold price, the flip, hover bigger. Changed: the title sits just under the header and runs to 150px; cards scale with the screen's height (lead 403px wide at 2560x1440, was 300); the two side cards stand in podium order (2 left, 1 centre, 3 right) and each gets a wing on its outer side, the way Netflix's Top 10 row sets a large rank numeral beside each title: the rank (steel face like SPOTLIGHT), name, price, move, set, all from home-trending.js. The rank is counted from the window's five movers by the size of the move, never assumed from list order. Not used: the 4th and 5th cards as flanking cards (Faisal rejected the five-card stage, CR12/G11) and a movers strip on the floor (the 30-day movers ticker already runs right under it). Wing motion: on a tab change each wing fades out 200 ms, takes the new words and fades back in 200 ms (left with the first card flip, right 180 ms later), same as the caption; on scroll-in the wings slide 28px toward their cards inside the scrubbed entrance | Netflix Top 10 row ("large, unmissable numbers next to each title", about.netflix.com/news/see-whats-popular-on-netflix, Feb 2020); Olympic podium order; Faisal's own Netflix top-10 ask on Beacon (BC7) |
| New set spotlights | PokeData home's set row (real set logo, then that set's top card with its price in one row) under four lamps hung from a rig above the frame, one per game, coloured to the set; Faisal asked for "a spotlight for each one" | hunt/trending-strip 1 |

## Pricing tiers: two options for Faisal to pick (27 Oct, `docs/design/tiers/`)

Faisal picked **A, rarity cards** (27 Oct). It is ported into index.html as `section.pricing#pricing` with `tc-` prefixed classes; option B stays on file only.

Card faces, round 2 (Faisal, 27 Oct: "one should be like a holographic full art of premium. Other one should just be like a really basic card free. And then collector should be ... something really cool looking", designed on Higgsfield "with proper information and proper referencing"): Free = a plain matte common, Premium = a rainbow-holo full art (ref: Umbreon ex SIR, assets/chase/01), Collector = a gold hyper-rare full art with the Crowns crown as the art (refs: crown logo, Smaug gold foil assets/chase/08, TCG Pocket crown rares). Faces are GPT Image 2.5 art with no text (briefs and job ids in garden-gpt-image-2/prompt/pricing-card-*.md, files in assets/pricing/); the name, price, lines and rarity mark are HTML set into each face's zones.

Faisal on the old three SaaS panels: "you're using paneling... paneling is not the answer for everything" (CR8). Same offers, prices, feature lists and CTAs (all to app.html); no tinted boxes, no pill badges, no tracked-caps labels, no sparkle bullets, no gradient text, no sourceless glow, no idle loops. Heading stays DM Sans 700 sentence case (index.html notes Anton read too heavy here). Ground is the `.lightzone` navy `#0c1a3c` that sits behind `#pricing` today.

| option | follows | source |
|---|---|---|
| A, rarity cards | The tiers as one card template climbing the rarity ladder: Free = common (Pokémon S&V silver border, printed art box, circle mark), Premium = rare holo (same border, holofoil in the art box, star mark), Collector = crown gold (full-art etched gold foil after the Topps SuperFractor spiral and TCG Pocket crown rares, the June crown as its rarity mark). The price is the card's art. One key light, top left, for every card | culture/study.md §1 (rarity marks, foil and finish, frames) |
| B, price list | The hobby's own price-list grammar (PSA /pricing: name, price, the unit tight to the figure, every price on one edge) without its boxes, with Crowns' Anton numerals at full size; Goldin for restraint only. Set like a book table: heavy rule above and below, hairlines between rows, the price first and largest in each row, the name heading its own feature list, the button on the name's line. Gold goes on the one price the headline points at ($6) | culture/study.md §3; psacard.com/pricing (checked headless 27 Oct) |

Motion rows (timing.md defaults: arrivals 450 to 700 ms expo-out, hovers 180 ms). Like app.js, both run full motion by default (owner's call: this machine reports reduce from a Windows setting) and `?motion=reduced` opts out:

| option | trigger | what moves | from → to | duration · easing | order | interrupted | reduced |
|---|---|---|---|---|---|---|---|
| A | hand first in view (wide) | the three cards start stacked as a deck on the Free slot, Free on top, and are dealt out to their slots | deck (−6°, scaled to the Free card) → rest, fully opaque | 650 ms · expo-out | Free, Premium, Collector, 110 ms apart; each button fades in as its card lands | plays once, never replays | `?motion=reduced`: none |
| A | each card scrolls in (phone) | the card settles | 24px low, opacity 0 → rest | 550 ms · expo-out | per card | plays once | `?motion=reduced`: none |
| A | hover a tier | the card grows (never brightens), its button grows | scale 1 → 1.045 (button 1.06) | 180 ms · expo-out | together | reverses from where it is | same (no travel, no flash) |
| B | list first in view (wide), each row as it scrolls in (phone) | the row's rule draws, then its price rolls up into its own window figure by figure like a ticker, then its words fade in | rule scaleX 0 → 1; each figure 105% below its window → rest | 900 ms rule, 700 ms per figure (60 ms apart), 450 ms words · expo-out | rows 130 ms apart | plays once | `?motion=reduced`: none |
| B | hover a button | the button grows | scale 1 → 1.05 | 180 ms · expo-out | n/a | reverses | same |
