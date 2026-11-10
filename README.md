# Low Tide Signal

Tap the tide dial to raise or lower the water, then tap a marked item to recover it or operate a mechanism. Restore six harbor signals and find an optional keepsake at each installation. Open the logbook to replay unlocked chapters. Inspect a submerged target to see which tide it needs. A hint highlights a useful next step and caps that attempt at two stars.

Play with touch or mouse, or press 1, 2 and 3 to set the tide and use Tab and Enter to select hotspots. The controls remain usable if WebGL is unavailable. Music, surf and effects are synthesized locally and start after an interaction. Muting and chapter progress persist in the browser.

[Returning Scales by Meeppp on Combos](https://combos.game/zh-CN/play/87185b0add2b39d0d378a00731474489) informed the dark ferry composition and environmental hotspots. We played the ferry opening and inspected the deck and sea. This project's waterline controls, puzzles, locations, artwork, audio and text were implemented independently.

## Run and rebuild

Open the root `index.html` directly or use a static server. `standalone.html` is the same self-contained build. Run `python build.py` to regenerate the HTML and root-index ZIP. Run `node core-tests.mjs` and `node sdk-tests.mjs` for controller and mock host checks. Three.js is bundled under the license in `vendor/`.

## GameWave

A successful tide change or object interaction starts the host round. Restoring a signal ends it. A saved unfinished chapter starts the next host session on its next committed action. The local checkpoint is saved in `low-tide-signal-v1`. Only this game's profile merges with its own recognized cloud envelope. Confirmed positive likes unlock copper lanterns and confirmed direct comments unlock a harbor pennant. The rewards are optional and deduplicated within the saved profile. The [official integration document](https://rg975ojk5z.feishu.cn/wiki/MQg7wMknzieOkukxyWVc4UB0nDh) was rechecked November 11, 2026. The mock tests do not establish actual GameWave host behavior.
