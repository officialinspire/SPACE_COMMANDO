# SPACE COMMANDO next-phase upgrade prompts

Run each prompt in Claude Code from the latest `main`. Finish and verify one deployment before starting the next. Run Prompt 4 after the new audio files are available.

## Repository review

Baseline `4874643` runs as a static Canvas game on GitHub Pages. `index.html` handles launch, the Inspire intro, and fullscreen. `styles.css` fits the 800 × 450 canvas and handheld controls to phone portrait and landscape. `index.js` handles simulation, rendering, combat, menus, and mobile input. `combat-audio.js` plays the current 25-cue Web Audio bank. Runtime art lives under `assets/sprites/`, `assets/station/`, and `assets/ui/`. The player and enemy source sheets are documented under `assets/characters/`.

| Area | Current behavior | Upgrade implication |
| --- | --- | --- |
| Camera | `cameraLeft()` follows X with a fixed 150-unit lead. The full 800 × 450 world area is visible. Rendering, ranged attack visibility, and enemy audio use camera assumptions. | Use one unshaken two-axis view for visibility and spatial audio. Apply zoom to the world without scaling the HUD or touch controls. |
| Station | `generateEnvironment()` builds a 5,000-unit horizontal arena with one ground height and six ladders from that deck. Player collision, enemy placement, pickup placement, and projectile bounds use the ground or canvas size. | Add connected decks with explicit ladder endpoints. Move all world bounds and surface queries together. |
| Feedback | `fireRound()` triggers muzzle effects, audio, and weapon-specific sprite recoil. Shake is triggered by damage, shotgun hits, and pickups. The renderer reads horizontal shake only. Touch presses can already vibrate. | Add a bounded camera impulse on actual shots and coordinate device haptics with that event. Keep the current fire and aim rules. |
| Audio | Menu and gameplay music use separate HTML audio elements and fades initiated in several state handlers. The two current tracks are about 10.6 MiB combined. Combat SFX use a 106 KiB cue bank with voice caps and legacy fallbacks. | Route music from game state, map the uploaded cues individually, and keep a fallback for each unavailable file. |
| Touch input | In Chromium mobile emulation, Shop pointerdown opens the shop and the subsequent zero-detail touch click closes it. The accessibility click path assumes a detail of zero means keyboard activation. | Keep pointer taps and keyboard activation distinct. Verify a single touch opens the shop and the next closes it. |

[Repository](https://github.com/officialinspire/SPACE_COMMANDO) · [Live build](https://officialinspire.github.io/SPACE_COMMANDO/)

## 1. Bring the camera in close

```text
In officialinspire/SPACE_COMMANDO, sync to latest main and read any AGENTS.md, development.txt, index.html, styles.css, index.js, and the runtime art manifest. Implement a tighter world camera in the existing Canvas renderer. Keep the 800×450 logical canvas and current HUD, menu, and handheld control sizing. Start at 1.40× world zoom (roughly 571×321 visible world units). Compare 1.35× and 1.50× on a small phone viewport. Choose the closest framing that keeps jumps, ladder exits, and approaching enemies readable.

Replace cameraLeft() with a clamped X/Y world view. Keep the player around 35–40% across the frame when moving right and mirror that framing when moving left. Use a small, smoothed horizontal lead, a vertical dead zone that keeps the feet and next landing in view, and elapsed-time follow. Settle cleanly on turns. Snap only on spawn or restart. Apply one consistent transform to terrain, actors, pickups, particles, tracers, flashes, and floating feedback. Keep the HUD and damage overlay in logical screen coordinates. Keep station layers seam-safe with the existing parallax character and fallback. Clamp to explicit world bounds, keep the deck visible, and provide a little vertical look-ahead on climbs without changing physics or input.

Audit spawnEnemy(), updateGame(), playEnemyCue(), and render culling. Use unshaken world bounds on both axes for visibility. Keep spawns outside the frame or behind cover, with clearance and current first-attack grace. Preserve the opening encounter. At edges, delay spawning if there is no fair candidate. Hostile ranged attacks must have a visible windup before firing. Cancel the windup if the tell leaves view before release. Keep bullets already in flight. Allow a close, directional audio cue near the frame edge and avoid revealing distant spawns. Preserve enemy IDs, combat timing, economy, and shop.

Fix the confirmed duplicate activation in the handheld Shop control. The zero-detail click fallback can receive a touch-generated click after pointerdown handles the action. Keep one activation per tap while preserving keyboard and assistive-technology click activation. Verify Shop stays open after one real touch event sequence, then closes on the next tap. Check the Menu and Select buttons for the same duplication. Playtest turns, jumps, climbing, both world edges, muzzle alignment, near-edge encounters, and steady HUD on desktop and at 667×375 and 360×640. Compare 30 and 60 fps, resize/fullscreen, and restart. Run the build under /SPACE_COMMANDO/. Commit this stage alone, push and merge into main using the repo workflow, then confirm Pages deployed that SHA. Report zoom, usable world area, camera tuning, checks, and commit.
```

## 2. Build a vertical station route

```text
In officialinspire/SPACE_COMMANDO, start from the merged close-camera stage on main. Read applicable repo instructions, development.txt, current camera code, generateEnvironment(), updatePlayer(), spawnEnemy(), spawnPickups(), and projectile/terrain paths in index.js. Make climbing the primary way to advance through a run. Keep a short opening corridor with its introductory fight, then build a three-deck station route with a cargo bay, a ladder shaft, and staggered upper catwalks. Give at least one section an optional loop via a second ladder or a safe drop. Use the existing station art and terrain kit.

Build connected, data-driven room chunks with explicit entry and exit surfaces, floor and platform rectangles, ladder endpoints, and eligible encounter/drop surfaces. Keep the opening authored and vary later chunk combinations using a reproducible seed. Make every mandatory route reachable with the existing jump height, acceleration, and climbing speed. Guarantee clear ladder approaches and dismounts at both ends, headroom to stand, and usable landings even when cover is randomized. Support descending from an upper landing on keyboard and touch. Restrict any ladder passthrough to the connected span. Keep up+fire reserved for up-aim and keep crouch+fire and simultaneous move+jump+fire working.

Replace single-deck assumptions across player and enemy collision, spawns, pickup placement, projectile cleanup, terrain drawing, and camera bounds. Use actual world solids for projectile blocking while preserving first-contact swept collision. Enemies must fit their spawn surface and give the player a readable tell. Reuse the existing enemy behaviors on useful decks. Require viable escape or approach routes for enemies placed off the player's deck. Let drops settle on nearby accessible surfaces while retaining all drop amounts, rates, difficulty, and shop prices. Keep progression tied to reachable routes and retain the procedural run and difficulty ramp.

Test the opening, required route, optional loop, both directions on ladders, platform underside impacts, cover, drops on each deck, and all four enemy types across at least five recorded seeds. Include a full Android-sized touch climb from the opening to the upper deck and a restart. Check viewport and projectile bounds at the top and bottom. Run under /SPACE_COMMANDO/, commit independently, push and merge into main, and verify Pages deployed the SHA. Report the seed list, route and fallback used when a chunk fails validation.
```

## 3. Add shot kick and haptics

```text
In officialinspire/SPACE_COMMANDO, start from the merged vertical station stage. Read applicable repo instructions and inspect fireRound(), SHOT_FEEDBACK, recoilShear(), frameMuzzle(), drawGame(), effectsReduced(), and touch handling in index.js. Make weapons feel heavier by layering a short directional camera kick over the existing shoulder recoil. Trigger it once per successful round. A shotgun shell with five pellets must still trigger one camera kick and one haptic event. Dry fire, cooldown, and reload should never trigger shot kick.

Start with pistol at 1.5 logical screen px over 85 ms, rifle at 1.2 px over 65 ms, shotgun at 3.5 px over 130 ms, and laser at 0.6 px over 50 ms. Orient the kick opposite the shot for left, right, and up aim. Decay by elapsed time and cap combined displacement at about 5 px so sustained fire, pickup, and damage impulses stay readable. Use a separate render offset from the world camera. Draw the world with a small overscan or other bounded edge treatment to avoid blank strips. Keep the muzzle pose, flash, and projectile origin consistent while the player and camera settle. Preserve velocity, collision, fire rate, ammo, and hit registration. Keep the HUD, touch deck, and menu fixed. If adding a movement bob, keep it subtle, off by default, and disabled while aiming, climbing, or using reduced effects.

Reuse System/Reduced/Full effects settings and prefers-reduced-motion. Reduced effects must suppress camera kick and bob. Add a separate Haptics toggle and gate vibration on support and user interaction. Use a brief, rate-limited pulse on confirmed shots, with a stronger single pulse for the shotgun. Remove duplicate Fire button vibration for the same round. Clear active feedback on settings changes, pause, blur, game over, and restart. The game must work when vibration is unavailable.

Verify taps, sustained rifle and laser, one-shot shotgun handling, dry fire, blocked reloads, left/right/up, ladder aiming, camera edges, damage during shooting, and reduced effects. Compare frame rates and compare projectile/round counts with effects on and off. If a physical Android device is unavailable, verify the vibration API calls with automation and list device feel as pending. Test under /SPACE_COMMANDO/, commit independently, push and merge to main, and confirm Pages deployed the SHA. Report final per-weapon values, caps, and checks.
```

## 4. Integrate the new music and sound effects

```text
In officialinspire/SPACE_COMMANDO, start from latest main after the camera, vertical station, and feedback stages. Read applicable repo instructions, index.html, index.js, combat-audio.js, and the audio files currently in the checkout. Inventory the newly uploaded tracks and SFX before wiring anything. Check duration, silence, peaks, file weight, and loop boundaries. Create a compact mapping from existing music states and gameplay events to the supplied assets. Reuse the existing 25-cue bank and legacy files for missing or invalid cues. If the new assets have not landed, report what is missing and keep the current build playable. Publish an audio stage only when there is a verified change to ship.

Wire the new gameplay music and any supplied menu track. Route playback and fades from the actual boot and game states so intro, menu, play, pause, shop, settings, game over, and restart remain consistent. Support gesture unlock, failed play promises, and suspension/resume without duplicate music or lingering fades. Preserve independent Music and Sound effects settings. Use same-origin relative URLs under /SPACE_COMMANDO/. Stream music with a sensible preload policy. Keep short sounds latency-ready, normalize cue levels for phone speakers, trim long tails, and keep bounded voice counts across sustained shots and overlapping enemies.

Map new cues to the events already used in fireRound(), reload start/completion, and the four enemy families' windup, attack, and defeat hooks. Use valid additional uploaded cues for jump, landing, damage, pickups, or menu selection if present. Trigger each sound once per confirmed event. Retain positional gain and pan for visible or nearby enemies using the unshaken two-axis view. Keep warning cues audible over music and sustained fire. Preserve gun behavior, unlock prices, pickup economy, intro failure recovery, and the handheld controls.

Test the new files and fallbacks under /SPACE_COMMANDO/. Verify intro finish and skip, fast pause/shop cycles, Music and Sound effects independently, each weapon and enemy cue, restart, tab hide/resume, offline or failed requests, looping, and sustained fire at load. Listen on Android hardware when available and disclose if listening is unverified. Report the cue mapping, missing files, payload changes, and verification. Commit the tested work independently, push and merge to main, then confirm Pages deployed the SHA and verify live asset requests.
```
