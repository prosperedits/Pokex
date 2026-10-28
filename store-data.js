// Crowns store demo: the shared catalogue model for store.html (the shop front) and product.html.
// Prices and images: window.SEALED_PRODUCTS (data/sealed.js, TCGplayer market via TCGCSV). The generated blocks
// below add what sealed.js does not carry: release dates, TCGplayer product ids and TCGplayer's product names.
// Nothing here is invented; anything not verified (pack contents for most boxes) is simply absent.
(() => {
  'use strict';
  // generated 27 Oct 2026 from TCGCSV (TCGplayer catalogue): set release dates, the TCGplayer product id behind each
  // tracked price (matched on the exact market price), and TCGplayer's own product names
  const CATALOG = {"sv01":{"n":"Scarlet & Violet","g":"pokemon","r":"2023-03-31","p":{"Booster Box":[476452,"Booster Box"],"Pokémon Center ETB":[478756,"Pokémon Center Elite Trainer Box (Miraidon)"],"Elite Trainer Box":[478335,"Elite Trainer Box (Koraidon)"],"Booster Bundle":[478258,"Booster Bundle"],"Bundle":[478275,"Sleeved Booster Pack Bundle (Set of 8)"],"Build & Battle Stadium":[478257,"Build & Battle Stadium"],"Build & Battle Box":[478253,"Build & Battle Box"]}},"sv02":{"n":"Paldea Evolved","g":"pokemon","r":"2023-06-09","p":{"Booster Box":[493975,"Booster Box"],"Pokémon Center ETB":[493973,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[493974,"Elite Trainer Box"],"Booster Bundle":[496914,"Booster Bundle"],"Build & Battle Stadium":[496935,"Build & Battle Stadium"],"Build & Battle Box":[496929,"Build & Battle Box"]}},"sv03":{"n":"Obsidian Flames","g":"pokemon","r":"2023-08-11","p":{"Booster Box":[501257,"Booster Box"],"Pokémon Center ETB":[501266,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[501264,"Elite Trainer Box"],"Booster Bundle":[501263,"Booster Bundle"],"Build & Battle Stadium":[501267,"Build & Battle Stadium"],"Build & Battle Box":[501268,"Build & Battle Box"]}},"sv03.5":{"n":"151","g":"pokemon","r":"2023-09-22","p":{"Pokémon Center ETB":[501999,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[503313,"Elite Trainer Box"],"Bundle":[662302,"Sam's Club 151 (4 Mini Tins + 4 Promo Cards Bundle)"],"Booster Bundle":[502000,"Booster Bundle"]}},"sv04":{"n":"Paradox Rift","g":"pokemon","r":"2023-11-03","p":{"Booster Box":[512821,"Booster Box"],"Pokémon Center ETB":[512801,"Pokémon Center Elite Trainer Box (Iron Valiant)"],"Elite Trainer Box":[512813,"Elite Trainer Box (Iron Valiant)"],"Booster Bundle":[512820,"Booster Bundle"],"Build & Battle Stadium":[514070,"Build & Battle Stadium"],"Build & Battle Box":[514068,"Build & Battle Box"]}},"sv04.5":{"n":"Paldean Fates","g":"pokemon","r":"2024-01-26","p":{"Pokémon Center ETB":[528039,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[528040,"Elite Trainer Box"],"Booster Bundle":[528771,"Booster Bundle"]}},"sv05":{"n":"Temporal Forces","g":"pokemon","r":"2024-03-22","p":{"Booster Box":[536225,"Booster Box"],"Pokémon Center ETB":[532853,"Pokémon Center Elite Trainer Box (Iron Leaves)"],"Elite Trainer Box":[532845,"Elite Trainer Box (Walking Wake)"],"Booster Bundle":[541017,"Booster Bundle"],"Bundle":[538807,"Sleeved Booster Pack Bundle (Set of 8)"],"Build & Battle Box":[537409,"Build & Battle Box Display"]}},"sv06":{"n":"Twilight Masquerade","g":"pokemon","r":"2024-05-24","p":{"Booster Box":[543846,"Booster Box"],"Pokémon Center ETB":[543844,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[543845,"Elite Trainer Box"],"Booster Bundle":[543852,"Booster Bundle"],"Build & Battle Box":[544386,"Build & Battle Box"]}},"sv06.5":{"n":"Shrouded Fable","g":"pokemon","r":"2024-08-02","p":{"Pokémon Center ETB":[552998,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[552999,"Elite Trainer Box"],"Booster Bundle":[553031,"Booster Bundle"]}},"sv07":{"n":"Stellar Crown","g":"pokemon","r":"2024-09-13","p":{"Booster Box":[557354,"Booster Box"],"Pokémon Center ETB":[557340,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[557350,"Elite Trainer Box"],"Booster Bundle":[557345,"Booster Bundle"],"Build & Battle Box":[557330,"Build & Battle Box"]}},"sv08":{"n":"Surging Sparks","g":"pokemon","r":"2024-11-08","p":{"Booster Box":[565606,"Booster Box"],"Pokémon Center ETB":[565632,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[565630,"Elite Trainer Box"],"Booster Bundle":[679564,"Booster Bundle (Retail)"],"Bundle":[565603,"Sleeved Booster Pack Bundle (Set of 4)"],"Build & Battle Box":[565599,"Build & Battle Box"]}},"sv08.5":{"n":"Prismatic Evolutions","g":"pokemon","r":"2025-01-17","p":{"Super-Premium Collection":[622770,"Super-Premium Collection"],"Premium Figure Collection":[650799,"Premium Figure Collection"],"Pokémon Center ETB":[593324,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[593355,"Elite Trainer Box"],"Booster Bundle":[600518,"Booster Bundle"]}},"sv09":{"n":"Journey Together","g":"pokemon","r":"2025-03-28","p":{"Booster Box":[610931,"Booster Box"],"Pokémon Center ETB":[610929,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[610930,"Elite Trainer Box"],"Booster Bundle":[610953,"Booster Bundle"],"Build & Battle Box":[610954,"Build & Battle Box"]}},"sv10":{"n":"Destined Rivals","g":"pokemon","r":"2025-05-30","p":{"Booster Box":[624679,"Booster Box"],"Pokémon Center ETB":[624675,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[624676,"Elite Trainer Box"],"Booster Bundle":[625670,"Booster Bundle"],"Build & Battle Box":[625677,"Build & Battle Box"]}},"sv10.5b":{"n":"Black Bolt","g":"pokemon","r":"2025-07-18","p":{"Pokémon Center ETB":[630687,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[630686,"Elite Trainer Box"],"Booster Bundle":[630431,"Booster Bundle"]}},"sv10.5w":{"n":"White Flare","g":"pokemon","r":"2025-07-18","p":{"Pokémon Center ETB":[630688,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[630689,"Elite Trainer Box"],"Booster Bundle":[630696,"Booster Bundle"]}},"me01":{"n":"Mega Evolution","g":"pokemon","r":"2025-09-26","p":{"Booster Box":[644298,"Booster Box"],"Pokémon Center ETB":[644282,"Pokémon Center Elite Trainer Box (Mega Lucario)"],"Elite Trainer Box":[644279,"Elite Trainer Box (Mega Gardevoir)"],"Booster Bundle":[644362,"Booster Bundle"],"Build & Battle Box":[644363,"Build & Battle Box"]}},"me02":{"n":"Phantasmal Flames","g":"pokemon","r":"2025-11-14","p":{"Booster Box":[654137,"Booster Box"],"Pokémon Center ETB":[654135,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[654136,"Elite Trainer Box"],"Booster Bundle":[654160,"Booster Bundle"],"Build & Battle Box":[654164,"Build & Battle Box Display"]}},"me02.5":{"n":"Ascended Heroes","g":"pokemon","r":"2026-01-30","p":{"Pokémon Center ETB":[668497,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[668496,"Elite Trainer Box"],"Bundle":[692541,"Costco Ascended Heroes Mega ex Box Bundle"],"Booster Bundle":[668541,"Booster Bundle"]}},"me03":{"n":"Perfect Order","g":"pokemon","r":"2026-03-27","p":{"Booster Box":[672394,"Booster Box"],"Pokémon Center ETB":[672404,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[672401,"Elite Trainer Box"],"Booster Bundle":[672396,"Booster Bundle"],"Build & Battle Box":[672400,"Build & Battle Box"]}},"me04":{"n":"Chaos Rising","g":"pokemon","r":"2026-05-22","p":{"Booster Box":[684444,"Booster Box"],"Pokémon Center ETB":[684452,"Pokémon Center Elite Trainer Box"],"Elite Trainer Box":[684450,"Elite Trainer Box"],"Booster Bundle":[684456,"Booster Bundle"],"Build & Battle Box":[684454,"Build & Battle Box"]}},"mtg-tdm":{"n":"Tarkir: Dragonstorm","g":"magic","r":"2025-04-11","p":{"Booster Box":[619645,"Play Booster Display"],"Bundle":[619653,"Bundle"]}},"mtg-fin":{"n":"Final Fantasy","g":"magic","r":"2025-06-13","p":{"Booster Box":[618890,"Play Booster Display"],"Bundle":[618897,"Bundle"]}},"mtg-eoe":{"n":"Edge of Eternities","g":"magic","r":"2025-08-01","p":{"Booster Box":[619672,"Collector Booster Display"],"Bundle":[619673,"Bundle"]}},"mtg-tla":{"n":"Avatar: The Last Airbender","g":"magic","r":"2025-11-21","p":{"Booster Box":[648643,"Play Booster Display"],"Bundle":[648684,"Bundle"]}},"mtg-spm":{"n":"Marvel's Spider-Man","g":"magic","r":"2025-09-26","p":{"Booster Box":[621107,"Play Booster Display"],"Bundle":[621115,"Bundle"]}},"mtg-dsk":{"n":"Duskmourn: House of Horror","g":"magic","r":"2024-09-27","p":{"Booster Box":[557241,"Play Booster Display"],"Bundle":[557249,"Bundle"]}},"mtg-blb":{"n":"Bloomburrow","g":"magic","r":"2024-08-02","p":{"Booster Box":[541235,"Play Booster Display"],"Bundle":[541241,"Bundle"]}},"mtg-mh3":{"n":"Modern Horizons 3","g":"magic","r":"2024-06-14","p":{"Booster Box":[541164,"Play Booster Display"],"Bundle":[541185,"Bundle"]}},"mtg-otj":{"n":"Outlaws of Thunder Junction","g":"magic","r":"2024-04-19","p":{"Booster Box":[541084,"Play Booster Display"],"Bundle":[541094,"Bundle"]}},"mtg-mkm":{"n":"Murders at Karlov Manor","g":"magic","r":"2024-02-09","p":{"Booster Box":[529964,"Play Booster Display"],"Bundle":[529971,"Bundle"]}},"lor-12":{"n":"Wilds Unknown","g":"lorcana","r":"2026-05-08","p":{"Booster Box":[678165,"Booster Box"],"Illumineer's Trove":[678168,"Illumineer's Trove"]}},"lor-11":{"n":"Winterspell","g":"lorcana","r":"2026-02-13","p":{"Booster Box":[664819,"Booster Box"],"Illumineer's Trove":[664826,"Illumineer's Trove"]}},"lor-10":{"n":"Whispers in the Well","g":"lorcana","r":"2025-11-07","p":{"Booster Box":[652703,"Booster Box"],"Illumineer's Trove":[652709,"Illumineer's Trove"],"Starter Deck":[652706,"Starter Deck (Sapphire & Steel)"]}},"lor-9":{"n":"Fabled","g":"lorcana","r":"2025-08-29","p":{"Booster Box":[645298,"Booster Box"],"Illumineer's Trove":[645299,"Illumineer's Trove"],"Starter Deck":[645305,"Starter Deck (Emerald & Ruby)"],"Gift Set":[645308,"Gift Set"]}},"lor-8":{"n":"Reign of Jafar","g":"lorcana","r":"2025-05-30","p":{"Booster Box":[623064,"Booster Box"],"Illumineer's Trove":[623061,"Illumineer's Trove"],"Starter Deck":[623058,"Starter Deck (Amber & Amethyst)"]}},"lor-7":{"n":"Archazia's Island","g":"lorcana","r":"2025-03-07","p":{"Booster Box":[607758,"Booster Box"],"Illumineer's Trove":[607761,"Illumineer's Trove"],"Starter Deck":[607802,"Starter Deck (Ruby & Sapphire)"]}},"lor-6":{"n":"Azurite Sea","g":"lorcana","r":"2024-11-15","p":{"Booster Box":[578093,"Booster Box"],"Illumineer's Trove":[578121,"Illumineer's Trove"],"Gift Set":[578122,"Stitch Collector's Gift Set"],"Starter Deck":[578123,"Starter Deck (Amber & Ruby)"]}},"lor-5":{"n":"Shimmering Skies","g":"lorcana","r":"2024-08-09","p":{"Booster Box":[555130,"Booster Box"],"Illumineer's Trove":[555148,"Illumineer's Trove"],"Starter Deck":[555144,"Starter Deck (Amethyst & Ruby)"]}},"lor-4":{"n":"Ursula's Return","g":"lorcana","r":"2024-05-17","p":{"Booster Box":[543859,"Booster Box"],"Illumineer's Trove":[543861,"Illumineer's Trove"],"Starter Deck":[543863,"Starter Deck (Amber & Amethyst)"]}},"lor-3":{"n":"Into the Inklands","g":"lorcana","r":"2024-02-23","p":{"Booster Box":[531521,"Booster Box"],"Illumineer's Trove":[531524,"Illumineer's Trove"],"Bundle":[614148,"Bundle"],"Gift Set":[531528,"Gift Set"],"Starter Deck":[531525,"Starter Deck Display"]}},"lor-2":{"n":"Rise of the Floodborn","g":"lorcana","r":"2023-11-17","p":{"Booster Box":[516276,"Booster Box"],"Illumineer's Trove":[516277,"Illumineer's Trove"],"Starter Deck":[516290,"Starter Deck (Amber & Sapphire)"]}},"lor-1":{"n":"The First Chapter","g":"lorcana","r":"2023-08-18","p":{"Booster Box":[485256,"Booster Box"],"Illumineer's Trove":[482411,"Illumineer's Trove"],"Bundle":[662116,"Collector Set Bundle"],"Gift Set":[482407,"Gift Set"],"Starter Deck":[482417,"Starter Deck (Amber & Amethyst)"]}},"op-OP16":{"n":"The Time of Battle","g":"onepiece","r":"2026-06-12","p":{"Booster Box":[689336,"Booster Box"]}},"op-OP15":{"n":"Adventure on Kami's Island","g":"onepiece","r":"2026-04-03","p":{"Booster Box":[682057,"Booster Box"]}},"op-OP14":{"n":"The Azure Sea's Seven","g":"onepiece","r":"2026-01-16","p":{"Booster Box":[665598,"Booster Box"]}},"op-OP13":{"n":"Carrying On His Will","g":"onepiece","r":"2025-11-07","p":{"Booster Box":[628352,"Booster Box"]}},"op-OP12":{"n":"Legacy of the Master","g":"onepiece","r":"2025-08-22","p":{"Booster Box":[628346,"Booster Box"]}},"op-OP11":{"n":"A Fist of Divine Speed","g":"onepiece","r":"2025-06-06","p":{"Booster Box":[620180,"Booster Box"]}},"op-OP10":{"n":"Royal Blood","g":"onepiece","r":"2025-03-21","p":{"Booster Box":[586671,"Booster Box"]}},"op-OP09":{"n":"Emperors in the New World","g":"onepiece","r":"2024-12-13","p":{"Booster Box":[563834,"Booster Box"]}},"op-OP08":{"n":"Two Legends","g":"onepiece","r":"2024-09-13","p":{"Booster Box":[542504,"Booster Box"]}},"op-OP07":{"n":"500 Years in the Future","g":"onepiece","r":"2024-06-28","p":{"Booster Box":[532106,"Booster Box"]}},"op-OP06":{"n":"Wings of the Captain","g":"onepiece","r":"2024-03-15","p":{"Booster Box":[515080,"Booster Box"]}},"op-OP05":{"n":"Awakening of the New Era","g":"onepiece","r":"2023-12-08","p":{"Booster Box":[498734,"Booster Box"]}},"op-OP01":{"n":"Romance Dawn","g":"onepiece","r":"2022-12-02","p":{"Booster Box":[450086,"Booster Box (Wave 1, Blue)"]}}};
  // top five cards per Magic, Lorcana and One Piece set: data/card-index-*.js (TCGplayer market, refreshed 27 Oct 2026)
  const HITS = {"mtg-tdm":[[619671,"Mox Jasper Serial Numbered","M",2824.99],[624038,"Ugin Eye of the Storms Showcase Halo Foil","M",466.21],[623963,"Elspeth Storm Slayer Showcase Halo Foil","M",322.27],[624015,"Craterhoof Behemoth Showcase Halo Foil","M",284.87],[624142,"Dracogenesis 0412 Showcase Halo Foil","M",138.7]],"mtg-fin":[[630948,"Traveling Chocobo Borderless Neon Ink Blue","M",1969.61],[630949,"Traveling Chocobo Borderless Neon Ink Green","M",1899.82],[630947,"Traveling Chocobo Borderless Neon Ink Pink","M",1893],[630946,"Traveling Chocobo Borderless Neon Ink Yellow","M",1845.67],[630986,"Sephiroth Fabled SOLDIER Borderless Surge Foil","M",825.1]],"mtg-eoe":[[638902,"Sothera the Supervoid Singularity Foil","M",1375.05],[644289,"Icetill Explorer Showcase Fracture Foil","M",395.42],[641754,"Exalted Sunborn Showcase Fracture Foil","M",280.7],[641761,"Starfield Vocalist Showcase Fracture Foil","M",224.33],[641882,"The Endstone Showcase Fracture Foil","M",140.54]],"mtg-tla":[[648742,"Avatar Aang Raised Foil","M",4737.63],[648746,"Toph the First Metalbender Borderless Neon Ink Foil","R",1054],[661970,"Aang Swift Savior Borderless Neon Ink Foil","R",618.74],[648745,"Katara the Fearless Borderless Neon Ink Foil","R",556.31],[648744,"Fire Lord Zuko Borderless Neon Ink Foil","R",537.44]],"mtg-spm":[[647614,"The Soul Stone Borderless","M",1856.74],[651362,"Spectacular Spider Man 0235 Borderless Textured Foil","R",479.52],[651364,"Spectacular Spider Man 0236 Borderless Textured Foil","R",345.63],[651369,"Spectacular Spider Man 0240 Borderless Textured Foil","R",264.52],[651368,"Spectacular Spider Man 0239 Borderless Textured Foil","R",250.67]],"mtg-dsk":[[578083,"Enduring Vitality Showcase Fracture Foil","M",343.22],[578884,"Overlord of the Balemurk Showcase Fracture Foil","M",331.08],[575064,"Valgavoth Terror Eater Showcase Textured Foil","M",303.02],[575160,"Enduring Curiosity Showcase Fracture Foil","M",247.75],[578060,"Enduring Courage Showcase Fracture Foil","M",234.82]],"mtg-blb":[[558443,"Lumra Bellow of the Woods Borderless Raised Foil","M",857.83],[559157,"Baylen the Haymaker Borderless Raised Foil","R",408.06],[558348,"Ral Crackling Wit Borderless Raised Foil","M",374.15],[558319,"Camellia the Seedmiser Borderless Raised Foil","R",253.69],[558681,"Vren the Relentless Borderless Raised Foil","R",250.35]],"mtg-mh3":[[555059,"Ulamog the Defiler Borderless Serial Numbered","M",2334.99],[555060,"Kozilek the Broken Reality Borderless Serial Numbered","M",1574.99],[552900,"Ocelot Pride Borderless","M",170.76],[552351,"Kaalia of the Vast 0343 Borderless","M",150.43],[541307,"Polluted Delta Retro Frame","R",133.2]],"mtg-otj":[[544432,"Bristly Bill Spine Sower Extended Art","M",86.07],[544435,"Terror of the Peaks Extended Art","M",53.04],[544392,"Bristly Bill Spine Sower","M",40.63],[544402,"Terror of the Peaks","M",34.27],[544655,"Goldvein Hydra Extended Art","M",14.9]],"mtg-mkm":[[537838,"Aurelia the Law Above Serial Numbered","R",699.99],[537832,"Vannifar Evolved Enigma Serial Numbered","M",600],[533428,"Delney Streetwise Lookout Showcase Invisible Ink","M",65.49],[532899,"Undercity Sewers Borderless","R",56.13],[533427,"Delney Streetwise Lookout Showcase","M",42.6]],"lor-12":[[690216,"Buzz Lightyear Jungle Ranger Iconic","Iconic",3613.09],[690217,"Merida Formidable Archer Iconic","Iconic",1675.36],[692220,"Alien True Believer Enchanted","Enchanted",299.1],[690747,"Youve Got a Friend in Me Enchanted","Enchanted",250.79],[692217,"Jessie Lively Cowgirl Enchanted","Enchanted",147.37]],"lor-11":[[673300,"Moana Curious Explorer Iconic","Iconic",1248.52],[673298,"Pocahontas Peacekeeper Iconic","Iconic",1071.31],[675515,"Elsa Ice Artisan Enchanted","Enchanted",714],[675279,"Eeyore In the Way Enchanted","Enchanted",525.82],[673068,"Ohana Means Family Enchanted","Enchanted",378.24]],"lor-10":[[657885,"Ariel Ethereal Voice Iconic","Iconic",1482.58],[657889,"Hades Looking for a Deal Iconic","Iconic",1066.67],[660011,"Spooky Sight Enchanted","Enchanted",732.91],[660029,"Cinderella Dream Come True Enchanted","Enchanted",499.24],[660041,"Cant Hold It Back Anymore Enchanted","Enchanted",256.42]],"lor-9":[[647663,"Mickey Mouse Brave Little Prince Iconic","Iconic",3875],[651106,"Minnie Mouse Sweetheart Princess Iconic","Iconic",3083.33],[651107,"Winnie the Pooh Hunny Wizard Enchanted","Enchanted",1410.97],[651123,"Ariel Adventurous Collector Enchanted","Enchanted",772.45],[651112,"Mickey Mouse Steamboat Pilot Enchanted","Enchanted",701.71]],"lor-8":[[633104,"Stitch Experiment 626 Enchanted","Enchanted",471.98],[631992,"It Means No Worries Enchanted","Enchanted",356.08],[632720,"Into the Unknown Enchanted","Enchanted",330.16],[633103,"Rapunzel High Climber Enchanted","Enchanted",306.72],[633099,"Bambi Little Prince Enchanted","Enchanted",244.93]],"lor-7":[[619749,"Mickey Mouse Inspirational Warrior Enchanted","Enchanted",429.38],[619748,"All Is Found Enchanted","Enchanted",279.21],[619733,"Aurora Waking Beauty Enchanted","Enchanted",268.01],[619737,"Donald Duck Flustered Sorcerer Enchanted","Enchanted",177.07],[619745,"Belle Mechanic Extraordinaire Enchanted","Enchanted",172.67]],"lor-6":[[592037,"Tigger In the Crows Nest Enchanted","Enchanted",158.81],[591999,"Baymax Personal Healthcare Companion Enchanted","Enchanted",115.64],[591998,"You Came Back Enchanted","Enchanted",104.85],[592031,"Tiana Restaurant Owner Enchanted","Enchanted",86.67],[592012,"We Could Be Immortals Enchanted","Enchanted",80.95]],"lor-5":[[562021,"Mufasa Ruler of Pride Rock Enchanted","Enchanted",333.41],[562007,"Snow White Fair Hearted Enchanted","Enchanted",162.88],[559716,"Donald Duck Pie Slinger Enchanted","Enchanted",117.91],[561980,"Scar Vengeful Lion Enchanted","Enchanted",111.76],[561984,"Robin Hood Sharpshooter Enchanted","Enchanted",94.82]],"lor-4":[[550549,"Ariel Sonic Warrior Enchanted","Enchanted",151.82],[550537,"Minnie Mouse Musketeer Champion Enchanted","Enchanted",126.3],[550544,"Cinderella Melody Weaver Enchanted","Enchanted",115.39],[551944,"Jasmine Desert Warrior Enchanted","Enchanted",105.39],[550718,"Look at This Family Enchanted","Enchanted",88.52]],"lor-3":[[539276,"Mickey Mouse Trumpeter Enchanted","Enchanted",205.38],[539164,"Ursula Deceiver of All Enchanted","Enchanted",110.42],[539171,"Robin Hood Champion of Sherwood Enchanted","Enchanted",105.14],[539168,"Scrooge McDuck Richest Duck in the World Enchanted","Enchanted",92.25],[539162,"The Sorcerers Hat Enchanted","Enchanted",73.15]],"lor-2":[[527802,"Cinderella Ballroom Sensation Enchanted","Enchanted",260.68],[528111,"Alice Growing Girl Enchanted","Enchanted",162.85],[527799,"Snow White Well Wisher Enchanted","Enchanted",126.92],[527800,"Beast Relentless Enchanted","Enchanted",71.75],[528113,"Hercules Divine Hero Enchanted","Enchanted",61.27]],"lor-1":[[510153,"Elsa Spirit of Winter Enchanted","Enchanted",952.84],[510154,"Mickey Mouse Wayward Sorcerer Enchanted","Enchanted",339.09],[510152,"Stitch Carefree Surfer Enchanted","Enchanted",259.19],[510162,"Simba Returned King Enchanted","Enchanted",215.39],[510156,"Mickey Mouse Artful Rogue Enchanted","Enchanted",212.19]],"op-OP16":[[695986,"Sakazuki Manga","SR",1111.83],[696052,"Kuzan Manga","R",1088.18],[696108,"Borsalino Manga","R",1001.12],[695324,"Ms All Sunday SP","SR",482.57],[695508,"PortgasDAce SP","SR",120.08]],"op-OP15":[[685479,"Enel OP15 118 Manga","SEC",896.2],[685313,"Koby EB04 044 Manga","SR",582.43],[685194,"MonkeyDLuffy SP","SR",524.12],[685011,"Boa Hancock SP","SR",501.25],[685009,"Zeus SP","R",356.44]],"op-OP14":[[671453,"Buggy OP09 051 SP Gold","R",1605.46],[670642,"Roronoa Zoro PRB02 006 SP","R",917.36],[671454,"Buggy OP09 051 SP","R",813.84],[671448,"Dracule Mihawk Manga","SEC",716.49],[671457,"Boa Hancock OP14 112 SP","SR",524.99]],"op-OP13":[[657401,"MonkeyDLuffy 118 Red Super Alternate Art","SEC",7500],[657411,"Sabo 120 Red Super Alternate Art","SEC",4800],[657402,"MonkeyDLuffy 118 Super Alternate Art","SEC",2208.62],[657442,"Shanks OP09 004 SP Gold","SR",1552.76],[657407,"PortgasDAce 119 Super Alternate Art","SEC",1101.42]],"op-OP12":[[646573,"MarshallDTeach SP Gold","SR",2026.51],[646572,"MarshallDTeach SP Silver","SR",1126.66],[643867,"Jewelry Bonney 118 Manga","SEC",728.82],[646566,"Zoro Juurou SP","SR",239.78],[646571,"PortgasDAce SP","SR",137.52]],"op-OP11":[[632504,"MonkeyDLuffy 119 SP Gold","SEC",13000],[632503,"MonkeyDLuffy 119 SP","SEC",5749.97],[632499,"MonkeyDLuffy 118 Manga","SEC",1293.32],[632509,"Luffy Tarou SP","SR",296.65],[632453,"Gear Two Alternate Art","R",264.6]],"op-OP10":[[617173,"Trafalgar Law 119 Manga","SEC",672.89],[617176,"EdwardNewgate SP","SR",233.91],[617175,"Sanji SP","SR",132.27],[617177,"Uso Hachi SP","C",106.93],[617174,"Charlotte Pudding SP","C",57.55]],"op-OP09":[[597035,"MarshallDTeach 093 Manga","SR",2000.99],[596925,"Shanks 004 Manga","SR",1795],[596984,"Buggy 051 Manga","R",1505.5],[596918,"Nami SP","SR",818.69],[596917,"Boa Hancock SP","SR",805.69]],"op-OP08":[[558162,"Silvers Rayleigh Parallel Manga","SEC",504.1],[558019,"PortgasDAce SP","SR",241.96],[558165,"Jewelry Bonney SP","C",186.77],[564551,"MonkeyDLuffy TR","TR",168.7],[558020,"Charlotte Pudding SP","R",88.88]],"op-OP07":[[545841,"Boa Hancock 051 Parallel Manga","SR",2177.13],[545927,"O Nami SP","R",459.58],[545823,"Boa Hancock 038 Parallel","L",99.1],[555691,"Trafalgar Law 010 TR","TR",98.92],[545923,"Donquixote Doflamingo SP","R",76.71]],"op-OP06":[[541660,"Roronoa Zoro Alternate Art Manga","SEC",2500],[541668,"Ms All Sunday SP","SR",264.53],[541664,"Nami TR","TR",239.66],[541665,"Buggy SP","UC",139.01],[541670,"Rebecca SP","SR",131.54]],"op-OP05":[[527019,"Trafalgar Law 069 Alternate Art Manga","SR",1700.87],[527020,"EustassCaptainKid Alternate Art Manga","SR",976.65],[527035,"Nami SP","R",536.05],[527038,"Uta SP","SEC",215.76],[527036,"Yamato SP","SEC",174.08]],"op-OP01":[[454666,"Shanks Parallel Manga Alternate Art","SEC",3998.74],[453506,"MonkeyDLuffy 003 Parallel","L",964.91],[454513,"Roronoa Zoro 001 Parallel","L",666.39],[454514,"Trafalgar Law 002 Parallel","L",457.62],[454536,"Nami Parallel","R",454.88]]};

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fmt2 = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function businessDays(n) {
    const d = new Date();
    while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n--; }
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  // demo store delivery settings (they compute dates; nothing ships)
  const SHIP = [{ k: 'tracked', name: 'Tracked delivery', days: 2 }, { k: 'express', name: 'Express delivery', days: 1 }];
  SHIP.forEach((s) => { s.date = businessDays(s.days); });

  const GAMES = [
    { id: 'pokemon', name: 'Pokémon', full: 'Pokémon Trading Card Game', logo: 'assets/logos/pokemon.png?v=79' },
    { id: 'magic', name: 'Magic', full: 'Magic: The Gathering', logo: 'assets/logos/magic.png?v=79' },
    { id: 'lorcana', name: 'Lorcana', full: 'Disney Lorcana', logo: 'assets/logos/lorcana.png?v=79' },
    { id: 'onepiece', name: 'One Piece', full: 'One Piece Card Game', logo: 'assets/logos/onepiece.png?v=79' },
  ];
  const gameOf = (id) => GAMES.find((g) => g.id === id);
  const seriesOf = (setId) => (/^me/.test(setId) ? 'Mega Evolution' : /^sv/.test(setId) ? 'Scarlet & Violet' : null);

  // what kind of box, from the tracked row's name; groups are the store's filter
  const TYPE = {
    'Booster Box': { key: 'display', group: 'boxes' },
    'Pokémon Center ETB': { key: 'pc-etb', group: 'etb' },
    'Elite Trainer Box': { key: 'etb', group: 'etb' },
    'Booster Bundle': { key: 'bundle', group: 'bundles' },
    'Bundle': { key: 'pack-bundle', group: 'bundles' },
    'Build & Battle Box': { key: 'bnb', group: 'bnb' },
    'Build & Battle Stadium': { key: 'bnb-stadium', group: 'bnb' },
    "Illumineer's Trove": { key: 'trove', group: 'trove' },
    'Starter Deck': { key: 'starter', group: 'decks' },
    'Super-Premium Collection': { key: 'spc', group: 'collections' },
    'Premium Figure Collection': { key: 'pfc', group: 'collections' },
    'Gift Set': { key: 'gift', group: 'collections' },
  };
  const GROUPS = [
    { id: 'boxes', name: 'Booster boxes' }, { id: 'etb', name: 'Elite Trainer Boxes' }, { id: 'bundles', name: 'Bundles' },
    { id: 'bnb', name: 'Build & Battle' }, { id: 'trove', name: 'Illumineer’s Troves' }, { id: 'decks', name: 'Starter decks' },
    { id: 'collections', name: 'Collections and gift sets' },
  ];

  // images. Re-cut (assets/product, BiRefNet, 27 Oct 2026): products whose old cutout lost the box, or showed
  // another variant than the one priced. 560px cutouts checked by eye (assets/sealed/tcg) for the product hero.
  const RECUT = [493975, 493973, 493974, 496914, 496935, 496929, 501266, 501264, 501999, 503313, 502000, 622770, 692541,
    618890, 618897, 621115, 557249, 541235, 541241, 541164, 541185, 516277, 478756, 532853, 532845, 619653, 619673, 662302];
  const HERO = [684452, 684454, 672404, 672401, 672396, 672400, 654135, 654136, 654160, 644282, 644279, 644362];
  const PACK = { 'me04': 'assets/sealed/tcg/684446.webp' };

  // Verified contents (27 Oct 2026), by TCGplayer product id. Each entry names its source.
  const SRC = {
    mwCR: { label: 'Midwest Cards', url: 'https://www.midwestcards.com/products/pokemon-mega-evolution-chaos-rising-pokemon-center-elite-trainer-box' },
    cyCR: { label: 'Coded Yellow', url: 'https://www.codedyellow.com/chaos-rising-elite-trainer-box/' },
    tsCR: { label: 'Top Shelf Co.', url: 'https://topshelfco.ca/products/pokemon-chaos-rising-build-battle-box' },
    mgCR: { label: 'm-g.com.au', url: 'https://www.m-g.com.au/?p=119071' },
    mwPO: { label: 'Midwest Cards', url: 'https://www.midwestcards.com/products/pokemon-mega-evolution-perfect-order-pokemon-center-elite-trainer-box' },
    mmPO: { label: 'Miniature Market', url: 'https://www.miniaturemarket.com/Pokemon-TCG-Perfect-Order-Elite-Trainer-Box/PKU10372' },
    box: { label: 'the box itself', url: null },
  };
  const PACK_LINE = 'Each pack holds 10 cards and 1 Basic Energy.';
  const CONTENTS = {
    684452: { packs: 11, src: SRC.mwCR, packLine: true, items: [
      ['11', 'Chaos Rising booster packs'], ['2', 'Full-art foil Fennekin promo cards, one with the Pokémon Center logo'],
      ['65', 'Card sleeves'], ['40', 'Energy cards'], ['6', 'Damage-counter dice'], ['1', 'Competition-legal coin-flip die'],
      ['1', 'Plastic coin'], ['1', 'Player’s guide to Chaos Rising'], ['1', 'Storage box with 6 dividers'], ['1', 'Pokémon TCG Live code card']] },
    684450: { packs: 9, src: SRC.cyCR, items: [
      ['9', 'Chaos Rising booster packs'], ['1', 'Full-art promo card'], ['65', 'Card sleeves with Mega Greninja art'],
      ['45', 'Energy cards'], ['6', 'Damage-counter dice'], ['1', 'Competition-legal coin-flip die'], ['2', 'Plastic condition markers'],
      ['1', 'Player’s guide'], ['1', 'Collector’s box with 4 dividers'], ['1', 'Pokémon TCG Live code card']] },
    684454: { packs: 4, src: SRC.tsCR, items: [['4', 'Chaos Rising booster packs'], ['40', 'Card ready-to-play deck'], ['1', 'Of 4 possible promo cards']] },
    684456: { packs: 6, src: SRC.box, items: [['6', 'Chaos Rising booster packs']] },
    684444: { packs: 36, src: SRC.mgCR, items: [['36', 'Chaos Rising booster packs']] },
    672404: { packs: 11, src: SRC.mwPO, packLine: true, items: [
      ['11', 'Perfect Order booster packs'], ['2', 'Full-art foil Tyrunt promo cards, one with the Pokémon Center logo'],
      ['65', 'Card sleeves'], ['40', 'Energy cards'], ['6', 'Damage-counter dice'], ['1', 'Competition-legal coin-flip die'],
      ['1', 'Plastic coin'], ['1', 'Player’s guide to Perfect Order'], ['1', 'Storage box with 6 dividers'], ['1', 'Pokémon TCG Live code card']] },
    672401: { packs: 9, src: SRC.mmPO, items: [
      ['9', 'Perfect Order booster packs'], ['1', 'Full-art foil Tyrunt promo card'], ['65', 'Card sleeves'], ['40', 'Energy cards'],
      ['6', 'Damage-counter dice'], ['1', 'Competition-legal coin-flip die'], ['1', 'Plastic coin'], ['1', 'Player’s guide'],
      ['1', 'Collector’s box'], ['1', 'Pokémon TCG Live code card']] },
  };

  // set logos: Pokémon from tcgdex (the app's source), Lorcana and the newest One Piece set from assets/setlogos
  function logoOf(setId) {
    if (setId === 'sv05' || setId === '30th') return `assets/setlogos/${setId}.png`;
    if (setId === 'me06') return null;   // Delta Reign: no logo published yet
    if (/^lor-\d+$/.test(setId) || setId === 'op-OP16') return `assets/setlogos/${setId}.${setId === 'op-OP16' ? 'png' : 'webp'}`;
    const m = setId.match(/^(sv|me)/);
    return m ? `https://assets.tcgdex.net/en/${m[1]}/${setId}/logo.png` : null;
  }

  // Demo states, chosen by Faisal (27 Oct 2026) so visitors see how a store shows them. Not live stock: the store's
  // footer says so. Coming soon is real: these sets release after today on TCGplayer's catalogue, and their prices
  // are TCGplayer presale market prices on 27 Oct 2026.
  const TODAY = '2026-10-27';
  const SOLD_OUT = [593355, 501999, 541241, 645298, 450086, 668497];
  const EXTRA = [
    { id: 712102, setId: 'me06', set: 'Delta Reign', game: 'pokemon', released: '2026-11-06', dataName: 'Elite Trainer Box', name: 'Elite Trainer Box', price: 105.54 },
    { id: 712094, setId: 'me06', set: 'Delta Reign', game: 'pokemon', released: '2026-11-06', dataName: 'Booster Box', name: 'Booster Box', price: 235.36 },
    { id: 704144, setId: '30th', set: '30th Celebration', game: 'pokemon', released: '2026-09-16', dataName: 'Pokémon Center ETB', name: 'Pokémon Center Elite Trainer Box', price: 294.03 },
    { id: 704143, setId: '30th', set: '30th Celebration', game: 'pokemon', released: '2026-09-16', dataName: 'Elite Trainer Box', name: 'Elite Trainer Box', price: 117.71 },
    { id: 706138, setId: 'mtg-tre', set: 'Star Trek', game: 'magic', released: '2026-11-13', dataName: 'Booster Box', name: 'Play Booster Display', price: 128.97 },
    { id: 706150, setId: 'mtg-tre', set: 'Star Trek', game: 'magic', released: '2026-11-13', dataName: 'Bundle', name: 'Bundle', price: 53.16 },
    { id: 723343, setId: 'lor-inkdark', set: 'Into the Inkdark', game: 'lorcana', released: '2027-02-05', dataName: "Illumineer's Trove", name: "Illumineer's Trove", price: 99.72 },
    { id: 711385, setId: 'op-EB-heroines2', set: 'Heroines Edition Vol. 2', game: 'onepiece', released: '2026-10-30', dataName: 'Booster Box', name: 'Extra Booster Box', price: 294.43 },
    { id: 712901, setId: 'op-dominance', set: 'The Dominance of God', game: 'onepiece', released: '2026-11-20', dataName: 'Booster Box', name: 'Booster Box', price: 350.6 },
  ];

  // ---- the product list
  let LIST = null;
  function products() {
    if (LIST) return LIST;
    const rows = window.SEALED_PRODUCTS || {};
    LIST = [];
    for (const [setId, arr] of Object.entries(rows)) {
      const c = CATALOG[setId];
      if (!c) continue;
      for (const r of arr) {
        const ref = c.p[r.name], t = TYPE[r.name];
        if (!ref || !t || !(r.marketUsd > 0)) continue;
        const [id, name] = ref;
        const own = RECUT.includes(id) ? `assets/product/${id}.webp` : null;
        LIST.push({
          id, setId, game: c.g, set: c.n, released: c.r, series: seriesOf(setId),
          dataName: r.name, name, key: t.key, group: t.group,
          price: r.marketUsd, checked: r.checked,
          img: own || r.img, hero: own || (HERO.includes(id) ? `assets/sealed/tcg/${id}.webp` : r.img),
          contents: CONTENTS[id] || null, pcExclusive: r.name === 'Pokémon Center ETB',
          status: SOLD_OUT.includes(id) ? 'sold' : null,
        });
      }
    }
    for (const x of EXTRA) {
      const t = TYPE[x.dataName];
      LIST.push({ ...x, series: seriesOf(x.setId), key: t.key, group: t.group, checked: '2026-10-27',
        img: `assets/product/${x.id}.webp`, hero: `assets/product/${x.id}.webp`, contents: null,
        pcExclusive: x.dataName === 'Pokémon Center ETB', status: x.released > TODAY ? 'soon' : null });
    }
    return LIST;
  }
  const byId = (id) => products().find((p) => p.id === +id) || null;
  const bySetKey = (setId, key) => products().find((p) => p.setId === setId && p.key === key) || null;
  const url = (p) => `product.html?id=${p.id}`;
  const setsOf = (game) => [...new Set(products().filter((p) => p.game === game).map((p) => p.setId))]
    .map((id) => { const p = products().find((x) => x.setId === id); return { id, name: p.set, released: p.released }; })
    .sort((a, b) => b.released.localeCompare(a.released));

  // ---- top cards: Pokémon from data/cards-<set>.js (TCGdex), the other games from the card index above
  const RARITY = { M: 'Mythic rare', R: 'Rare', U: 'Uncommon', C: 'Common', SEC: 'Secret rare', SR: 'Super rare', UC: 'Uncommon', L: 'Leader', TR: 'Treasure rare', SP: 'Special' };
  const prettyName = (n) => n.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  const loading = {};
  function loadCards(setId) {
    if (!/^(sv\d|me0[1-5]|30th$)/.test(setId)) return Promise.resolve(false);
    if (window.CARD_SETS && window.CARD_SETS[setId]) return Promise.resolve(true);
    if (loading[setId]) return loading[setId];
    loading[setId] = new Promise((res) => {
      const s = document.createElement('script');
      s.src = `data/cards-${setId}.js`; s.onload = () => res(true); s.onerror = () => res(false);
      document.head.appendChild(s);
    });
    return loading[setId];
  }
  function topCards(setId, n) {
    if (HITS[setId]) {
      return HITS[setId].slice(0, n).map(([id, name, rar, price]) => ({
        // TCGplayer names end with the treatment (“Elsa Spirit of Winter Enchanted”); the rarity line already says it
        name: prettyName(name).replace(new RegExp(' ' + rar + '$', 'i'), ''), rarity: RARITY[rar] || rar, price,
        img: `https://tcgplayer-cdn.tcgplayer.com/product/${id}_400w.jpg`, thumb: `https://tcgplayer-cdn.tcgplayer.com/product/${id}_200w.jpg`,
      }));
    }
    const S = window.CARD_SETS && window.CARD_SETS[setId];
    if (!S) return [];
    return S.cards.filter((c) => c.priceUsd > 0 && c.image && c.imageOk !== false).sort((a, b) => b.priceUsd - a.priceUsd).slice(0, n)
      .map((c) => {
        const full = /\.(jpg|png|webp)$/i.test(c.image);   // the 30th Celebration file carries full TCGplayer image urls
        return { name: c.name, rarity: c.rarity, price: c.priceUsd, img: full ? c.image : `${c.image}/high.webp`, thumb: full ? c.image.replace('_in_1000x1000', '_200w') : `${c.image}/low.webp` };
      });
  }
  function cardsSource(setId) {
    if (HITS[setId]) return 'TCGplayer market, 27 Oct 2026';
    const S = window.CARD_SETS && window.CARD_SETS[setId];
    return S ? `TCGplayer market via TCGdex, ${fmtDate(S.snapshotAt)}` : '';
  }

  // ---- Rip Lab model (ported from rip.html, same numbers); Pokémon only
  const RARE_SLOT = ['Double rare', 'Ultra Rare'];
  const REV_SLOT = ['Illustration rare', 'Special illustration rare', 'Hyper rare', 'ACE SPEC Rare', 'Shiny rare', 'Shiny Ultra Rare', 'Mega Hyper Rare', 'Black White Rare'];
  const FALLBACK = { 'Double rare': 0.135, 'Ultra Rare': 0.065, 'Illustration rare': 0.075, 'Special illustration rare': 0.025, 'Hyper rare': 0.013,
    'ACE SPEC Rare': 0.04, 'Shiny rare': 0.05, 'Shiny Ultra Rare': 0.013, 'Mega Hyper Rare': 0.012, 'Black White Rare': 0.010 };
  const STUDY = {
    'sv01': { 'Double rare': 0.1354, 'Ultra Rare': 0.0648, 'Illustration rare': 0.0752, 'Special illustration rare': 0.0301, 'Hyper rare': 0.0185 },
    'sv05': { 'Special illustration rare': 0.0116, 'Hyper rare': 0.0072, 'ACE SPEC Rare': 0.05 },
    'sv08': { 'Double rare': 0.167, 'Ultra Rare': 0.067, 'Illustration rare': 0.0769, 'Special illustration rare': 0.0115, 'Hyper rare': 0.0053, 'ACE SPEC Rare': 0.05 },
    'sv04': { 'ACE SPEC Rare': 0.0213 },
    'sv04.5': { 'Shiny rare': 0.18, 'Shiny Ultra Rare': 0.035, 'Special illustration rare': 0.02, 'Hyper rare': 0.012 },
  };
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const net = (p) => ((p || 0) >= 2 ? p * 0.8 : 0);
  const revPrice = (c) => (c.variants && c.variants['reverse-holofoil'] && c.variants['reverse-holofoil'].market) || c.priceUsd || 0;
  function packValue(setId) {
    if (!/^(sv|me)/.test(setId)) return null;   // the Rip Lab model covers Scarlet & Violet and Mega Evolution packs only
    const S = window.CARD_SETS && window.CARD_SETS[setId];
    if (!S || !S.cards || !S.cards.length) return null;
    if (S.cards.filter((c) => c.priceUsd > 0).length / S.cards.length < 0.5) return null;
    const byR = {};
    for (const c of S.cards) (byR[c.rarity] = byR[c.rarity] || []).push(c);
    const avg = (r) => mean((byR[r] || []).map((c) => net(c.priceUsd)));
    const rates = {};
    for (const r of Object.keys(byR)) if (RARE_SLOT.includes(r) || REV_SLOT.includes(r)) rates[r] = (STUDY[setId] && STUDY[setId][r] != null) ? STUDY[setId][r] : (FALLBACK[r] || 0);
    const revPool = [...(byR.Common || []), ...(byR.Uncommon || []), ...(byR.Rare || [])];
    const reverseAvg = mean(revPool.map((c) => net(revPrice(c))));
    const rh = RARE_SLOT.filter((r) => byR[r]), vh = REV_SLOT.filter((r) => byR[r]);
    const sR = rh.reduce((s, r) => s + rates[r], 0), sV = vh.reduce((s, r) => s + rates[r], 0);
    const rareSlot = Math.max(0, 1 - sR) * avg('Rare') + rh.reduce((s, r) => s + rates[r] * avg(r), 0);
    const revSlot = Math.max(0, 1 - sV) * reverseAvg + vh.reduce((s, r) => s + rates[r] * avg(r), 0);
    const ev = 4 * avg('Common') + 3 * avg('Uncommon') + reverseAvg + revSlot + rareSlot;
    return Number.isFinite(ev) ? ev : null;
  }
  const studied = (setId) => !!STUDY[setId];

  window.STORE = { GAMES, GROUPS, SHIP, PACK, PACK_LINE, fmt2, fmtDate, esc, gameOf, logoOf, products, byId, bySetKey, url, setsOf,
    loadCards, topCards, cardsSource, packValue, studied, CATALOG };
})();
