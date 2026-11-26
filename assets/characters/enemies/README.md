# SPACE COMMANDO enemy sprite sources

These PNGs are source sheets for the game's four existing enemy types. All art faces right. Read frames left to right, then top to bottom. Paths are relative to this guide.

| Enemy | Game ID | Movement | Attack | Hit and defeat |
| --- | --- | --- | --- | --- |
| Breach Infantry | `zombie` | [Walk](breach-infantry/source/walk.png), 6 frames | [Lunge](breach-infantry/source/lunge.png), 4 frames in guard, windup, strike, recovery order | [Hit and collapse](breach-infantry/source/hit-collapse.png), 2 hit frames followed by 4 collapse frames |
| Phase Echo | `ghost` | [Drift](phase-echo/source/drift.png), 6 frames | [Contact](phase-echo/source/contact.png), 3 frames in windup, reach, recovery order | [Hit and dissolve](phase-echo/source/hit-dissolve.png), 2 hit frames followed by 4 dissolve frames |
| Sentry Unit | `robot` | [Patrol](sentry-unit/source/patrol.png), 6 frames | [Windup and fire](sentry-unit/source/windup-fire.png), 4 frames in ready, brace, recoil, recovery order | [Hit and power-down](sentry-unit/source/hit-power-down.png), 2 hit frames followed by 4 power-down frames |
| Ravel Scout | `alien` | [Stalk](ravel-scout/source/stalk.png), 6 frames | [Windup and attack](ravel-scout/source/windup-attack.png), 4 frames in ready, throat expansion, attack, recovery order | [Hit and collapse](ravel-scout/source/hit-collapse.png), 2 hit frames followed by 4 collapse frames |

Use the sheets linked above for atlas packing. Initial versions of Phase Echo's hit and dissolve sheet and Ravel Scout's stalk sheet are in their respective `source/variants/` folders. Earlier rifle aim and laser player sheets are in [player/source/variants](../player/source/variants).

Measure the crop of each pose. Give the widest lunge, contact and collapse poses room beyond a uniform cell boundary. Ravel Scout's last two collapse poses have a gap just left of the nominal grid line. Keep grounded feet aligned to a shared baseline. Use Phase Echo's helmet center as the reference point through its dissolve. Mirror the sprite and attachment coordinates together. Render projectiles and flashes in the game.

These files are source artwork. The current game reads its existing runtime atlas.
