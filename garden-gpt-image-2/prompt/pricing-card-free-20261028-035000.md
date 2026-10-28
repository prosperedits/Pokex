# Crowns pricing card: Free: the common card (GPT Image 2.5 on Higgsfield)

Model gpt_image_2_5, quality high, resolution 2k, aspect 2:3 (the inner face of a 63x88 mm card; the site draws the printed border and trims about 2.5% top and bottom), 2 variants.
Build: the image is text-free card art; the site typesets the name, price, lines and rarity mark in real HTML on top (exact spelling, accessible, no AI-mangled small text).

## References (in this order, role image_references)
- Reference 1: a screenshot of the Crowns homepage hero (navy ground, gold crown with sapphires): the world and colours. (media 46478644-18c6-41e0-ab2d-2bc02d9117ca)
- Reference 2: a screenshot of the current pricing section with the three cards: what is being replaced; keep the same card proportions and zone layout, but redesign the face. (media 76231277-6085-4df9-ab0f-c0b2889c410b)

## Copy the site sets on this card (from index.html; NOT drawn in the image)
- Tier name: Free
- Price: $0 /mo
- Lines: Free access to the last 3 sets of every universe | Live prices & daily USD/EUR snapshots | Basic watchlist
- Rarity mark: silver circle (common)
- Button under the card (HTML): Start free

## Prompt sent
This is the printed face of one trading card for Crowns, a premium price tracker for Pokémon, Magic, Lorcana and One Piece collectors. The card is one of three pricing tiers on the Crowns homepage: Free, Premium and Collector, which climb a rarity ladder like real cards (common, holo rare, gold hyper rare).
Crowns world (match the reference screenshots of the real site): near-black and deep midnight-navy grounds, Crowns gold #FFD24A (warm, polished, used for money and the crown), the crown logo's polished gold with faceted sapphire-blue gems, real trading-card culture (foil, holo, full arts, printed card stock), heavy condensed uppercase display type in the spirit of Anton on the site.
Output: ONLY the inner face of the card, edge to edge, portrait. No outer card border or rounded corners (the website draws a thin printed border around it), no background around the card, no hands, no table, no perspective: a flat, straight-on scan of the face. Keep everything important at least 4% away from the top and bottom edges, because the image is trimmed slightly there.
Layout zones (the website sets all text in real HTML type on top of these zones, so the image itself must contain NO text at all: no letters, no numbers, no symbols, no logos, no watermark, no signature):
- Name bar: a slim band across the top 4% to 11% of the face, left part clear and calm, where the tier name goes.
- Price zone: from 13% to 50% of the height, centred, a calm open area where one very large price numeral is set; keep fine detail and bright highlights away from its centre so big type on top stays readable.
- Text box: an empty rectangular text box from about 55% to 92% of the height, inset about 7% from the left and right edges, quiet and even in tone, large enough for up to 7 short lines of small text. Leave it completely empty.
- Rarity corner: the bottom-right corner just under the text box stays clear (a real rarity mark is placed there by the site).

Reference 1: a screenshot of the Crowns homepage hero (navy ground, gold crown with sapphires): the world and colours.
Reference 2: a screenshot of the current pricing section with the three cards: what is being replaced; keep the same card proportions and zone layout, but redesign the face.

THIS CARD: FREE, a really basic common card.
Plain, clean, honest and matte, like an ordinary common from a modern set: nothing shiny, no foil, no holo, no glow, no sparkles, no gold.
Face: flat matte card stock in deep slate navy with a faint printed paper grain, a thin cool-grey keyline frame.
Price zone: a simple printed art window (thin grey keyline) filled with a calm, flat, two-tone navy print: a few quiet offset-print halftone dots fading from the top-left corner, otherwise open and plain.
Text box: a plain, slightly lighter slate panel with a thin grey keyline, completely empty.
Mood: modest, tidy, trustworthy. The cheapest card in the set, and it looks it, but it is still well printed.

AVOID: any text, letters, numbers, price symbols, logos (no Pokemon, Magic, Lorcana or One Piece marks, no invented brand marks), watermarks or signatures; people or characters; an outer card border, rounded card corners, a background around the card or a photo of a card on a table; casino sparkle bursts, coins and slot-machine glitz; neon glow with no light source; purple-to-blue AI gradients; cartoon or childish styling.

## Result (27 Oct)
- Generated 2 variants (jobs 9997c12e-89bb-49f9-9d51-4871d824c80f, 4f9782a3-363d-49e1-a39f-d10023978a81), 2.75 credits each.
- Picked v1 (garden-gpt-image-2/image/free-v1.png): taller name bar, visible halftone. It drew a star in the corner (the rare mark, wrong for a common), painted out by hand: free-v1-clean.png.
- Shipped as assets/pricing/tier-free-600.webp and -1000.webp; the name, $0 /mo, the three lines and the silver circle are HTML.
