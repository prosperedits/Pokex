# Crown hunt: human-modelled 3D crowns for the Crowns hero

Shortlist only, 28 Oct 2026. Nothing was downloaded, licensed, added to a project or bought.

Target: docs/design/crown/video/green-2.png. A wide, polished gold crown with 8 to 10 tall rounded points and no balls on the tips. It has smooth U-shaped valleys, a hexagonal sapphire under each point, and a plain band between two gold rims. There is no cap, fur or cross.

Ranking order: closeness of shape to green-2, then clean topology, then gems as separate objects, then a web-friendly polycount. None of the candidates matches green-2 exactly. Every pick needs some edits in Blender, and most need hex sapphires added.

Previews are saved as NN-slug.png in this folder. The top 6 are on contact.png. The -wire and -matcap images are Sketchfab Model Inspector captures that show topology.

How things were checked:
- Sketchfab topology was checked in the Model Inspector wireframe.
- Envato has no wireframe view, so Envato topology is judged from the renders only.
- Envato lists "polygons". If those are quads, the triangle count is roughly double.
- Sketchfab lists triangles.

## Top pick: 1, hwzzz "crown" (Sketchfab)

It is the closest in proportion: wide, with 8 tall points, thin walls and a plain band with two raised rims. That band is a clean place to float the card ring. It is also the only candidate whose topology I could check, and the wireframe shows an even, all-quad subdivision grid with no scan noise or lumps. The pearl tips are separate meshes, so we can delete them. It is free under CC-BY at 160,768 triangles, which is under the 300k budget. The work left is rounding the 8 tips and adding our own hex sapphires as separate glass meshes, which we would want anyway for transmission.

Runner-up: 2, Jabs3D (Envato). Its rounded, knobbed tips are closer to green-2's tip shape, and it ships as a GLB. Its topology is unchecked and its walls are chunky.

## 1. hwzzz "crown"

- URL: https://sketchfab.com/3d-models/crown-6ed8bc7e8f4a4d98bd09bc6b95319b68
- Source and license: Sketchfab, CC-BY 4.0 (credit "crown by hwzzz" with a link)
- Formats: Sketchfab's download dialog normally offers glTF, GLB and USDZ conversions plus the original upload. I did not open the dialog, so the original format is unconfirmed.
- Polycount: 160,768 triangles, 80,400 vertices
- Materials: 2 materials (gold and pearl), no textures
- Gems: none. The 8 pearl tips are separate sphere meshes.
- Topology: clean quad subdivision grid, checked in the wireframe (01-hwzzz-crown-wire.png)
- Closeness: the closest silhouette (wide, 8 points, plain ridged band). The points are sharp cones rather than green-2's rounded thick tips. We would delete the pearls, round and slightly thicken the tips, and add 8 hex sapphires below the points.

## 2. Jabs3D "3D golden crown icon"

- URL: https://app.envato.com/3d/c9a7c552-9aac-4eb9-a4cd-8ff5414f03ba (older link: https://elements.envato.com/3d-golden-crown-icon-S75L6Q9)
- Source and license: Envato Elements, included in Faisal's plan (Envato lifetime commercial license per download)
- Formats: blend, glb (glTF), png renders
- Polycount: 46K polygons
- Materials: listed as no textures, so gold is a shader material in the .blend
- Gems: none
- Topology: looks like a clean subdivision surface in the renders. Unchecked, because Envato has no wireframe view.
- Closeness: the best tip shape (rounded, slightly knobbed, no balls), with flared points and a plain double-ring band. It is chunkier and more cartoon-proportioned than green-2, with fewer, thicker points. We would thin the walls, check the point count, and add hex sapphires.

## 3. 22studiodsgn "Royal Bejeweled Golden Crown"

- URL: https://app.envato.com/3d/9c7da645-4ad1-49d9-84cb-1e9a29760bf0 (older link: https://elements.envato.com/royal-bejeweled-golden-crown-S24ZPZN)
- Source and license: Envato Elements, included in the plan
- Formats: blend, fbx, glb, obj, plus jpg and png renders
- Polycount: 107K polygons
- Materials: no textures listed. The gold, black band, sapphires and studs are separate shader materials.
- Gems: elongated hexagonal faceted sapphires. They look like separate meshes, with crisp facets and their own material.
- Topology: crisp bevels and facets in the render. Unchecked.
- Closeness: the closest in design language, with hex blue sapphires under the points and a black band between two gold torus rims, which is green-2's exact layout. The points are blocky and flat-topped (castellated) instead of tall and rounded, and the band has silver studs. We would remodel the points and remove the studs. It is also a good donor for ready-made hex sapphires.

## 4. TurboSquid "Gold crown with gemstone inlays"

- URL: https://app.envato.com/3d/6fc244d9-0620-40b2-bf1e-0c85a48e2a78 (older link: https://elements.envato.com/gold-crown-with-gemstone-inlays-7W3FWAB)
- Source and license: Envato Elements (a TurboSquid catalogue item), included in the plan
- Formats: blend, obj, fbx, jpg render
- Polycount: 26.7K polygons
- Materials: no textures listed. The scratched-gold look in the preview is a render material we would replace.
- Gems: round cabochons (emerald and sapphire) in raised bezels, probably separate meshes
- Topology: clean in the render. Unchecked.
- Closeness: wide, about 8 points, with gems set on the body under the points, as in green-2. The tips have small ball finials, and the body carries beading and engraved scrolls. We would remove the balls, beading and scrolls, and swap the cabochons for hex sapphires.

## 5. bartama_graphic "Crown"

- URL: https://app.envato.com/3d/5c11f783-5967-4487-ae14-8d90c4b8bc9a (older link: https://elements.envato.com/crown-YZRFHSW)
- Source and license: Envato Elements, included in the plan
- Formats: blend, obj with mtl, png renders
- Polycount: 1.8M polygons. That is far over budget, so we would need to decimate or rebuild the subdivision level.
- Materials: no textures listed (shader materials)
- Gems: one hex amethyst, diamond-cut emeralds and pearls on the band, likely separate meshes
- Topology: smooth and clean in the render. Unchecked.
- Closeness: polished gold, no balls on the tips, and a smooth band between two rims, with a hex gem. It has only 5 or 6 tall sharp points, and the gems sit on the band, which needs to stay clear for the card ring. We would add points, round them, and move the gems up.

## 6. Graphicted_ "Crown with wavy orange top and light blue accents"

- URL: https://app.envato.com/3d/8d7cada3-30ac-4c89-ac88-0e1e5145e658 (older link: https://elements.envato.com/crown-with-wavy-orange-top-and-light-blue-accents-GYU84PM)
- Source and license: Envato Elements, included in the plan
- Formats: glb, obj with mtl
- Polycount: 138.9K polygons
- Materials: texture included (probably a colour gradient). It would be re-shaded to gold.
- Gems: round light-blue gems around the base, probably separate
- Topology: clean in the render. Unchecked. Because it has a texture and a high count, it is the one I would check most carefully for an AI-generated mesh before using it.
- Closeness: wide, with 10 rounded lobe tips and U-shaped valleys, the closest tip rhythm to green-2. The lobes are short and stubby, it is copper with light-blue piping, and the gems are round. We would stretch the lobes, re-shade to gold, and swap in hex sapphires.

## Also considered, not in the top 6

- 07 Šimon Ustal "Crown - Royalty - 3December", Sketchfab, CC-BY, 124,384 triangles. https://sketchfab.com/3d-models/crown-royalty-3december-6f204b258be743ed8fb2171e1e65f6a3. Its topology is checked and clean, and its gems are separate. It has 16 short points with balls on a tall bowl, so it is far from green-2's shape.
- 08 mikethornley "Crown Prop", Sketchfab, CC-BY, 20,512 triangles. https://sketchfab.com/3d-models/crown-prop-bf00a703e9e64bc68946f72284b96960. It has about 8 ball-tipped points and gems on the band. The matcap shows sculpted waviness, close to the lumpiness Faisal rejected.
- 09 Pieter Ferreira (Badboy17Aiden) "Golden crown", Sketchfab, CC-BY, 8,316 triangles. https://sketchfab.com/3d-models/golden-crown-5689a9525a2c425d93f7d483b93d8cfa. It is a game-ready low-poly mesh with a baked normal map, so re-shading loses the detail. It has antique alternating spikes with balls and fleurs-de-lis.
- 10 showmedia "CROWN EMOJI", Sketchfab, CC-BY, 18,452 triangles. https://sketchfab.com/3d-models/crown-emoji-3205d319c5854499a02266ac2e472835. It has faceted hex gems as separate meshes and U-shaped valleys. It has only 5 egg-tipped points, a tall body and messy boolean triangulation.
- 11 Hidden Territory "Lowpoly Cartoony Crown", Sketchfab and Fab free, CC-BY, 6,082 triangles. https://sketchfab.com/3d-models/lowpoly-cartoony-crown-3cfe12f5e4ea4c8aa4856823a5eb4b8b. It is a cartoon crown with 5 ball-tipped points and gems on the band.
- Excluded: "Golden Royal Crown (LIMITED U)" (made with the Rodin AI tool), "Golden crown" by bursacpetar0606 (119,998 faces and 60,000 vertices, the round numbers typical of decimated AI output), and "golden_crown" by Sosselim22321 (same mesh stats as 09, so likely a re-upload).

## Notes

- Fab (free filter, searches "crown", "gold crown" and "king crown") added nothing new. Its free crowns are mirrors of Sketchfab items (Hidden Territory, Lucas Presoto), velvet-cap crowns or stylised spikes.
- Envato: Faisal is signed in on app.envato.com, and the item pages show a Download button. The old elements.envato.com pages now redirect there. Per the design-sources rule, any download would go into a new Envato project for this job.
- CC-BY picks need a visible credit line (title, author, link and license) somewhere on the site.

## Open questions

- Do we model the 8 hex sapphires ourselves, or lift the faceted sapphires from 3 onto the body of 1?
- Is a CC-BY credit line in the site footer acceptable for the hero model?
- Should I download 1 (free) and 2 (Envato, into a new project) and render both under our gold and glass shaders to compare side by side?
