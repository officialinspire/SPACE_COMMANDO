# SPACE COMMANDO player sprite sources

The PNGs are full-resolution source art for the right-facing commando. The approved identity pose is in `commando-identity.png`. Read frames left to right, then top to bottom where a clip wraps across rows.

| Source file | Frame order |
| --- | --- |
| `unarmed-idle-run.png` | Row 1 has four idle poses. Rows 2–3 have eight run poses. |
| `unarmed-traversal.png` | Row 1 has three jump poses. Row 2 has three landing poses. Row 3 has two crouch idle poses and a spare crouch stride. |
| `unarmed-crouch-walk.png` | Six crouch-walk poses. |
| `unarmed-ladder-climb.png` | Six ladder-climb poses. |
| `unarmed-hit-downed.png` | The first two poses show hit reactions. The remaining four show the downed sequence. |
| `pistol-fire.png` | Three pistol fire poses in ready, kick, settle order. |
| `pistol-reload-source.png` | Use the six pistol reload poses in rows 2–3. Skip the rifle poses in row 1. |
| `rifle-fire-reload.png` | Three standing fire poses in row 1 and six reload poses in rows 2–3. |
| `rifle-run-fire.png` | Eight rifle run-and-fire poses. |
| `rifle-up-crouch-fire.png` | Three upward fire poses in row 1 and three crouched fire poses in row 2. |
| `scattergun-fire-reload.png` | Three fire poses in row 1 and six reload poses in rows 2–3. This art maps to the existing `shotgun` weapon ID. |
| `laser-fire-reload.png` | Three standing fire poses in row 1 and six power-cell reload poses in rows 2–3. |

Measure each frame from the actual artwork before packing. Check transparent gutters at gameplay size and align feet or body origins by clip. Record muzzle anchors for firing frames and mirror them with the sprite when facing left. Keep projectiles, muzzle flashes and smoke separate from the character frames.

The unarmed opening and weapon-specific clips are art sources for the gameplay integration stage. The current game uses its original runtime atlas.
