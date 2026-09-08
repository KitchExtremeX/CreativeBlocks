# CreativeBlocks

**A place of your own.** An original, browser-playable 3D voxel survival island. Gather resources, craft equipment, build a refuge, and survive until morning.

## Start playing

- Open **CreativeBlocks.html** for the single-file offline edition. No install, network, or server is required.
- Alternatively, open **index.html**, double-click **Launch.cmd**, or run `npm start` / `node serve.cjs` in this folder.
- Click **Begin your story**. Use a desktop browser with WebGL and a keyboard/mouse. Sound begins only after a click.
- The embedded Codex preview may deny pointer lock. In that case the game offers middle-button drag and arrow-key looking. A regular desktop browser can use pointer lock normally; Esc releases it.

Everything used by the game is stored locally. Three.js 0.160.0 is vendored with its MIT license. All game code, textures, models, icons, particles, interface styling, and synthesized sounds were created for this prototype. Reference screenshots are not embedded or reused as assets.

## Controls

| Input | Action |
| --- | --- |
| WASD | Walk |
| Mouse | Look while captured |
| Space | Jump; release before jumping again |
| Shift | Sprint while energy remains |
| Hold left mouse | Mine a block or repeatedly strike a creature |
| Right mouse | Place the selected building block |
| 1–8 / mouse wheel | Select hotbar slot |
| C / I | Open or close crafting / pack |
| E | Access the crafting station you are aiming at |
| F | Eat selected food |
| G | Toggle the optional shelter blueprint |
| Esc | Pause / release the mouse |
| R | Immediately restart the entire world |
| F8 | Debug only: advance the time phase |
| Middle-mouse drag / arrows | Mouse-capture fallback |

In the pack, click one slot then another to swap them. Alternatively select a pack slot and press 1–8 to move it to the hotbar. Stack limit: 32. Tools occupy separate slots and show remaining durability. Crafting and pause menus stop the simulation.

## A reliable first-night route

1. **Gather the fallen timber to your left.** Five Saltwood timber blocks form a low row near spawn. Hold left mouse until a block breaks; the small dropped resource will fly into your pack. More timber is available in the trees.
2. **Make boards, sticks, and a wooden pickaxe.** C opens field crafting. One timber gives six processed timber. One processed timber gives four sticks. A wooden pickaxe needs three boards and two sticks.
3. **Place and access a crafting station.** Craft it with four boards and two sticks, select it, and right-click a nearby terrain face. Aim at the station and press E. A connected station unlocks the stone pickaxe, wooden sword, and tide lantern.
4. **Collect four river stone.** An exposed formation sits east of camp. Your pickaxe mines stone much faster than your hand. Return to the station for a stone pickaxe and sword; make additional sticks when needed.
5. **Build your refuge.** Craft shelter panels five times: ten boards become forty panels. G shows a guide at the central clearing. It needs **30 wall cells**, **9 roof cells**, and the existing **3×3 floor**. Walls are two blocks high; leave the front opening. Build using any solid material. You can also use these same dimensions elsewhere.
6. **Use temporary blocks to reach the roof.** A one-block step beside a wall lets you jump up onto the wall. A temporary two-block pillar beneath the first roof cell gives you a face to place against. Extend the roof sideways, then remove the pillar and step. Collect a few earth blocks for this; the forty panels cover the thirty-nine permanent cells with one spare.
7. **Find sunfruit and prepare for night.** Fruit rests near trees and collects when approached. Select it and press F to restore nourishment and some health. Passive Pebblefins can be hunted for food. A tide lantern provides light and slows the Gloamray within five blocks.
8. **Weather the night.** A complete refuge protects you when inside, including its doorway. Spend at least five nighttime seconds inside, then stay alive until morning. You may defend yourself with your sword or remain sheltered. Morning triggers victory after that shelter requirement is met.

The first night begins after **5 minutes 20 seconds** of active play: Dawn 25s, Day 260s, Dusk 35s. Night lasts **100 seconds**. Without a completed shelter visit, morning starts another cycle so the objective remains recoverable. F8 is available for faster testing, not needed for normal play. There is no world saving in this prototype; R starts again from the same seeded island.

## Implemented systems

| System | Implementation |
| --- | --- |
| World | Seeded radial island, varying hills, beaches, water, saltwood groves, surface stone and underground cobalt. Numeric block IDs in a coordinate map; eight natural block types and four manufactured blocks. |
| Movement | First-person yaw/pitch, substepped swept collision, normalized diagonal movement, jump latch, gravity, fall damage, safe ocean return, sprint energy, hunger, health and delayed health recovery. |
| Interaction | Exact voxel DDA ray traversal, five-block reach, visible outline, progressive cracks, tool-dependent mining time, cooldowns, protected bedrock, overlap and occupied-cell rejection. |
| Pickups | Physical resource cubes pop out, fall, rotate, and magnetize toward the player. They wait if the pack is full. Ground fruit and creature food use the same collection path. |
| Inventory | Twenty-four slots, eight-slot hotbar, stack limit 32, icons, names, quantities, selected models, swaps, and per-tool durability. |
| Crafting | Eight recipes with transaction rollback on capacity failure. Advanced recipes require a placed station that the player has aimed at and accessed. Access expires when the player moves away or the station is removed. |
| Tools / combat | Wooden and stone pickaxes, wooden sword, mining multipliers, breakage, animated hand/equipment, attack cooldown, ray-based creature targeting, occlusion checks, hit recoil, knockback and health bars. |
| Creatures | Four passive Pebblefins with wandering/flee behavior and food drops. One original Gloamray per night with patrol, line-of-sight/proximity detection, chase, attacks, damage cooldown, death and morning despawn. |
| Navigation | Bounded ground A* with one-block ascents and obstruction checks. It replans after world edits, avoids traversing roofs as if they were ground, and handles blocked destinations by approaching a reachable nearby cell. |
| Shelter | Detects a 3×3 floor, nine player-built roof cells, and two-course perimeter walls. Allows a single two-cell doorway or a fully closed perimeter. Separate checks determine whether the player is inside. Scattered wall holes fail validation. |
| Survival | Gradual Dawn/Day/Dusk/Night colors and lighting, nighttime hostile, sheltered objective progress, victory at morning, death screen, and complete instance-based reset. |
| Rendering | Merged exposed-face meshes in 8×8 chunks, generated pixel textures, vertex ambient occlusion, moving directional light and shadow maps, distance fog, animated water, geometric clouds, vegetation, particles and first-person equipment. |
| Audio | Local Web Audio synthesis for gathering, pickup, placement, crafting, station access, eating, strikes, hits, damage, nightfall and endings; no external sound files. |

## Graphics settings

| Preset | Pixel ratio cap | Shadow map | Water grid | Vegetation / particle budget |
| --- | --- | --- | --- | --- |
| Low | 0.85 | Off | Flat | 25% / 30 |
| Medium | 1.0 | 1024² | 48×48 | 55% / 70 |
| High | 1.5 | 2048² | 80×80 | 100% / 140 |
| Ultra | 2.0 | 4096² | 128×128 | 100% / 220 |

The settings menu also adjusts sensitivity, sound volume, and field of view. Ultra is intended for capable desktop GPUs. This is a stylized forward renderer: water has animated shading and highlights, not screen-space reflections or physically simulated waves. Low deliberately disables shadows.

## Code layout

- `src/data.js`: block/item definitions, recipes and shared math.
- `src/world.js`: generation, storage, ray traversal, station queries and shelter validation.
- `src/inventory.js`: stack handling, slot management, durability and atomic crafting.
- `src/player.js`: physics and survival stats.
- `src/creatures.js`: A* navigation and passive/hostile behavior.
- `src/game.js`: interaction, resource drops, combat, day/night, objectives and reset.
- `src/render.js`: Three.js scene, textures, chunks, shadows, water, models and effects.
- `src/audio.js`: procedural audio.
- `src/main.js`: actual input handlers, HUD, menus, map and animation loop.
- `tests/systems.test.cjs`: deterministic gameplay tests.
- `tests/browser.js`: opt-in browser integration runner; never loaded during normal play.
- `build.cjs`: regenerates the single-file offline edition from source.

## Verification

Run **`npm test`** (or `node --test tests/systems.test.cjs`): **22 tests pass**.

Open **http://127.0.0.1:4174/?test=1** after starting the server: **16 browser integration checks pass**. This development route runs accelerated simulations and displays its results. Reload the normal URL to play.

The browser suite exercises the production keyboard/mouse/menu handlers, real mining and collection, recipe buttons, pack swaps, station placement/access, tool effectiveness, food, combat, visible victory/defeat screens, reset, settings, and all four graphics presets. It uses controlled player positions and a shelter fixture to make the run deterministic; it is not an uninterrupted human playthrough. The system suite independently tests shelter geometry, missing cells, navigation, fall damage, resource availability, full inventory behavior and repeated resets.

Visual inspection confirmed the title screen, first-person island, textured terrain, moving shadows, HUD, hand model, crafting interface, and nighttime presentation. The embedded browser rejects pointer lock; its fallback controls were exercised. Regular-browser pointer lock is implemented through the standard API but was not independently verified in this embedded environment. The only observed vendor console warning is Three.js's notice that its classic script build is deprecated; that pinned build is retained for offline file compatibility. No gameplay or WebGL errors were reported by the completed browser suite.

## Scope and expansion

This is a compact desktop vertical slice, not a production-scale survival game. It deliberately excludes multiplayer, infinite terrain, saving/loading, complex fluids, farming, extensive enemy varieties, controller/touch input, external assets and network services. Navigation is bounded and a refuge has a deliberately simple measurable shape.

Production expansion would need persistent saves and migrations, configurable key bindings, broader accessibility modes, chunk streaming/workers, navigation stress tests for arbitrary constructions, content/balance playtesting, a larger animation/audio pipeline, GPU profiling on varied hardware, and broader browser/device validation.
