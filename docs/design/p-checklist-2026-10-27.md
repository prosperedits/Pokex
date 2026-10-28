# Faisal's asks, 27 Oct 2026 (Crowns premium overhaul)

Base: the local build at localhost:4173 (`Clauder\phantasmal`). The Oct 15 "Crowns" artifact is the rejected rendition: never build from it.

Status key: [ ] open, [~] in progress, [x] done and checked, [?] waiting on Faisal

## Whole site
1. [ ] Use the new tools (21st.dev in Chrome, Higgsfield, Meshy, Tripo, the design skills) so it feels premium and smooth.
2. [ ] Other pages are "severely lacking": raise them to the homepage's level.
3. [ ] Test everything: smoothness, rendering, layout at every width.

## Homepage
4. [ ] Keep the homepage look; make it crisper and more premium.
5. [x] Hero card carousel arranged around a crown (the crown at the centre of the ring).
6. [x] New 3D crown logo: a substantial piece of art (Higgsfield concept, then Meshy or Tripo for the model).
7. [x] The logo changes.
8. [x] Header stays floating, but its words are hard to read at the top: fade the background up into a much darker tone behind the header on first load (the frosted glass on scroll already fixes it lower down).
9. [x] Spotlight: foundation is fine, make it crisper.
10. [x] Spotlight: the side panels (Featured Set left, price chart right) read as AI; replace them.
11. [x] Spotlight: the bottom doesn't sit well with the text under it.
12. [x] Under the spotlight: trending things in place of the side panels, e.g. the newest Magic, One Piece and Pokémon set logos.
13. [x] Spotlight picks cards with potential, and stops showing the same thing for months.
14. [x] Check whether the live feed still works. (Found 27 Oct: data was a late-June snapshot. Refreshed 27 Oct; `node scripts/refresh-all.mjs` re-runs it.)

## Card carousel (set viewer)
15. [ ] Smoother motion, better rendering.
16. [x] Replace the dial at the bottom.

## Sets
17. [ ] Going into a set and opening it up: complete overhaul.
18. [x] Pokémon 30th Celebration: reachable from inside the carousel when switching sets (today only from the start).
19. [x] 30th Celebration: prices (today none at all).
20. [x] First Partner Illustration Series 1 and 2: better pictures.

## New and rebuilt pages
21. [x] New product page: everything shown in stock; a showcase to other companies of how we can optimize their store.
22. [ ] Rip Lab: a 3D pack you can actually rip open.

## Removed
23. [x] Delete the binder section completely. A future binder must be built new, never from the old one.

## Round 2 (Faisal, 27 Oct evening)
24. [ ] Crown: arcade-like style (very good quality, stylised and simplified, not ultra-real, less aggressive); the third concept direction is the best so far; cards must fit their slots well. New concepts first, then 3D.
25. [ ] Fix the lighting on the hero crown and its cards ("absolutely atrocious").
26. [ ] Spotlight new-sets strip is cut off (Reality Fracture, 30th Celebration, Hyperia City, The World's Strongest Warriors). No more cut-offs anywhere.
27. [ ] Sets page: keep the clickable game logos; the background must be completely different from the homepage, for every game.
28. [ ] Store demo: background completely different from the homepage.
29. [ ] Store demo: numbers must not change in that rolling way when switching sealed products.
30. [ ] Store demo: keep the top hits per product (top five); add a checkout and a carousel.
31. [ ] Store demo: all box images the same size (PC ETB and Build & Battle look bigger than the rest).
32. [ ] Store demo: a lot is missing; make it a complete product page.
33. [ ] Header logo: smooth, not laggy; it becomes the new crown WITHOUT cards (the cards change on the homepage).
