# Verification record

Tested locally on September 5, 2026.

- **22 / 22** Node gameplay tests passed (`node --test tests/systems.test.cjs`).
- **16 / 16** in-browser integration checks passed (`/?test=1`).
- All four rendering presets completed with **zero WebGL errors**.
- No game JavaScript errors were observed in the completed browser checks.
- The single-file `CreativeBlocks.html` edition loaded successfully and its crafting and night screens were visually inspected.
- Screens checked: title, first-person gameplay, objective/HUD, inventory/crafting, nighttime lighting. The browser runner verifies visible victory and defeat screens.
- Pointer-lock requests were rejected by the embedded browser. The implemented middle-drag and arrow-key fallback controls passed. Native pointer-lock operation in a regular browser remains a separate environment check.

The browser runner uses real input handlers and production game systems, with controlled positions and a shelter fixture. It is accelerated integration testing, not an uninterrupted human playthrough. An early test-runner loop was corrected to be bounded; its setup also needed additional crafting ingredients and a grounded mining position. The final runner completes without those failures.

Three.js emits an upstream classic-build deprecation notice. The pinned local build is deliberately used to keep the game runnable from an offline HTML file. Its license is included in `vendor/THREE-LICENSE.txt`.
