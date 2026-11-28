# SPACE COMMANDO combat sound sources

These MP3s are trimmed, faded and gain-adjusted mono game cues. Every source in the table is labeled [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) by its uploader or pack. The YouTube links show where three clips were discovered. The file inputs came from the linked Freesound high-quality previews and the Kenney and Ogrebane source packs.

| File | Suggested event | Source and creator | YouTube preview |
| --- | --- | --- | --- |
| [pistol-fire.mp3](pistol-fire.mp3) | Pistol round | [Single Pistol Gunshot 3.2.wav by morganpurkis](https://freesound.org/people/morganpurkis/sounds/388194/) | [Pistol preview](https://www.youtube.com/watch?v=MA70sPBdzgI) |
| [rifle-fire.mp3](rifle-fire.mp3) | One rifle round for automatic fire | [Machine Gun 001 - single shot.ogg by pgi](https://freesound.org/people/pgi/sounds/212601/) | [Rifle preview](https://www.youtube.com/watch?v=qgl5Ju4h_UY&t=44s) |
| [shotgun-fire.mp3](shotgun-fire.mp3) | One shotgun shell, regardless of pellet count | [shotgun-one-shot.wav by DeltaCode](https://freesound.org/people/DeltaCode/sounds/668353/) |  |
| [laser-fire.mp3](laser-fire.mp3) | One laser discharge | [Kenney, Sci-Fi Sounds, laserSmall_003.ogg](https://opengameart.org/content/sci-fi-sounds) |  |
| [grenade-explosion.mp3](grenade-explosion.mp3) | Grenade detonation when supported | [Explosion / Gun by SamsterBirdies](https://freesound.org/people/SamsterBirdies/sounds/587445/) |  |
| [pistol-reload.mp3](pistol-reload.mp3) | Pistol reload start | [Taurus G2c Magazine Release by NoonerBear](https://freesound.org/people/NoonerBear/sounds/589845/) |  |
| [rifle-reload.mp3](rifle-reload.mp3) | Rifle reload start | [Assault Rifle Reload by qubodup](https://freesound.org/people/qubodup/sounds/815879/) |  |
| [shotgun-pump.mp3](shotgun-pump.mp3) | Shotgun reload completion | [R870 Pump 1 by qubodup](https://freesound.org/people/qubodup/sounds/844178/) |  |
| [laser-reload.mp3](laser-reload.mp3) | Laser cell recharge start | [Power Charge by Sojan](https://freesound.org/people/Sojan/sounds/407052/) |  |
| [alien-hurt.mp3](alien-hurt.mp3) | Ravel Scout hurt | [Creature Monster Alien Vocal FX-6.wav by CVLTIV8R](https://freesound.org/people/CVLTIV8R/sounds/803033/) |  |
| [ghost-hurt.mp3](ghost-hurt.mp3) | Phase Echo hurt | [Creepy Ghost Hit by gmoney514093](https://freesound.org/people/gmoney514093/sounds/363175/) | [Ghost preview](https://www.youtube.com/watch?v=ijxM06JGxOc&t=564s) |
| [robot-damaged.mp3](robot-damaged.mp3) | Sentry Unit hurt | [videogame sci-fi metalish damage efect by saangosu](https://freesound.org/people/saangosu/sounds/781093/) |  |
| [robot-move.mp3](robot-move.mp3) | One Sentry Unit locomotion cue | [MnG - Mech Step.wav by SergeyIonov](https://freesound.org/people/SergeyIonov/sounds/467401/) |  |
| [zombie-hurt.mp3](zombie-hurt.mp3) | Breach Infantry hurt | [Ogrebane, Monster Sound Effects Pack, monster-3.wav](https://opengameart.org/content/monster-sound-effects-pack) |  |

Use the gun sounds once per confirmed round. Apply a short per-enemy cooldown to hurt cues. Trigger robot locomotion on steps or movement transitions so it stays sparse. The current weapon list has no grenade event. Use the detonation clip once that event exists.

## Faction special cues

Each special plays its cues once per event through `combat-audio.js`, within the existing voice limits (enemy 6, hurt 3, move 2; the oldest voice in a full group is cut). When a cue name has no field clip it plays from `combat-bank.mp3`, which has every name below. If Web Audio is unavailable, only defeats fall back to `enemy_death.mp3`; the other cues stay silent.

| Event | When it plays | CyberCity Police | CyberCity Thug | Jungle Dinosaur | Dark Elf Ranger |
| --- | --- | --- | --- | --- | --- |
| Charge (tell) | Windup starts; a tell that cancels and restarts within 0.9 s does not repeat it | `robotWarn` | `zombieWarn` | `alienWarn` | `ghostWarn` |
| Attack / movement | Trigger frame resolves: shot, dash launch or pounce leap | `rifleFire` (Breach Pulse) | `robotAttack` (Shock Dash) | `alienAttack` (Pounce Bite) | `laserFire` (Violet Lance) |
| Landing | Pounce touches down, starting the vulnerable recovery | — | — | `robotMove` (heavy step, *move* group) | — |
| Impact on a solid | Dash or pounce stops on cover or a wall; Breach Pulse breaks on a solid | `robotAttack` | `robotDown` | `robotMove` | — (the lance ends in sparks) |
| Player hit | The special's one hit lands | `player_damage.mp3` (shared) | same | same | same |
| Hurt | One per enemy per 260 ms | `robotHurt` | `zombieHurt` | `alienHurt` | `ghostHurt` |
| Defeat | Once, when the enemy is removed | `robotDown` | `zombieDown` | `alienDown` | `ghostDown` |

## Music tracks

Music plays through HTML audio elements, separate from these cues, so the Music and Sound effects levels stay independent. Stage themes are chosen by stage ID: menu, `station` (Space Station Level 1 Ambient), `jungle`, `cyber`, `desert`. The story cues are the docking scene (Orbital Station Ambient Cutscene), the CyberCity launch scene and the CyberCity clear screen (CyberCity Escape, Cloudline Break), the archive reveal (Desolate Desert Ruins), the Space Station clear screen (Jungle Planet Emergency Crash Landing), and Mission complete (Iron and Sand, Instrumental Credits). If a story cue can't load, the matching stage theme stands in; if a stage theme and its legacy fallback can't load, the menu theme stands in. Either way the missing track is retried 15 s later the next time it's wanted.
