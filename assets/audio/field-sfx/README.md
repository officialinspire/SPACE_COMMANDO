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

### Director behaviour

Each frame the director turns the screen into one desired track plus an entry key. A new key (a new stage entry, scene opening, clear screen or completion) starts a story cue or stage theme from the top. The same key (pause, Shop, Settings from pause, game over and Retry, a hidden tab, mute and unmute) continues from the same position.

- **Fades:** linear in gain from wherever the track is, so any fade can be cancelled or reversed. Fade-in is 900 ms and only advances once the track is actually playing. Fade-out is 700 ms. At most one track fades in and one fades out; any older one stops.
- **Ducking:** pause, pause Settings and game over duck the current track to 0.45, the Shop to 0.6, and major radio beats to 0.72. Each track eases its own duck with a 120 ms attack and a 300 ms release time constant. An outgoing track keeps the duck it had.
- **Music level:** eases over 150 ms, so muting fades out.
- **Stale playback:** a play request or media event that arrives after a track stopped being wanted, or after the tab was hidden, can't restart it.
- **Failures:** a track that hasn't started within 10 s hands over to its stand-in and is retried later.
- **Streaming:** sources are set only when a track is first wanted, so boot fetches no music and only active tracks stream.
- **Credits:** Mission complete starts Iron and Sand (Instrumental Credits). Its Credits screen continues the same track without restarting it, and Credits opened from the title starts it fresh.


## Story cues

Story events (radio key-ups, doors, the scuttle, the courier launch and the archive) play short cues defined in `story.js` (`SFX`). They play through a story bus in `combat-audio.js`, on the same Sound effects master and limiter as combat. The bus holds at most 4 voices, ducks to 0.55 while a caption is on screen, and stops every pending, delayed or looping cue on Skip, scene close, retry, stage transitions, the star map, Sound effects off, and a hidden tab.

| Cue | When | Source | License |
| --- | --- | --- | --- |
| `radio-in` / `radio-out` | A radio speaker keys up / the transmission ends | Synthesized in `combat-audio.js` (band-passed noise burst) | Original, part of the game code |
| `analyst-signature` | Both plays of the Analyst's packet-six recording; renders sample-identical every time | Synthesized (1.4 kHz carrier with two knocks and a hiss bed) | Original |
| `playback-glitch` | Archive and colonial recorder lines | Synthesized (fixed stutter of short square blips) | Original |
| `bulkhead-servo` | A story door opening (once per real unlock; checkpoint reloads are silent) | `robot-move.mp3` at 0.62× rate, low-passed | CC0 1.0 (SergeyIonov) |
| `seal-release` | 0.32 s after the servo | Synthesized (decaying high hiss) | Original |
| `relay-startup` | Jungle relay power, each archive terminal | `laser-reload.mp3` at 0.85× rate | CC0 1.0 (Sojan) |
| `station-alarm` | Arming the self-destruct (six restrained pulses) | Synthesized (two-tone square through a low-pass) | Original |
| `distant-blast` | 50 s and 22 s left on the countdown | `grenade-explosion.mp3` at 0.72×, low-pass 600 Hz (about 12 dB under the station theme) | CC0 1.0 (SamsterBirdies) |
| `station-blast` | Space Station clear screen | `grenade-explosion.mp3` at 0.6×, low-pass 1.3 kHz | CC0 1.0 (SamsterBirdies) |
| `courier-ignition` | CyberCity launch scene, first frame | Synthesized (low rumble sweep over a sub tone) | Original |
| `ship-fire` | One second into the launch: three brief exterior shots | `laser-fire.mp3` at 0.6×, low-passed | CC0 1.0 (Kenney) |
| `archive-wake` | Archive reveal, first frame | Synthesized (detuned saw drone, opening filter) | Original |
| `fly-buzz` | Archive reveal, host frame (very faint) | Synthesized (saw with a 28 Hz flutter) | Original |

Missing files: if a field clip fails to load or decode, its cue is silent (no fallback). The synthesized cues need no files. Dialogue never depends on these cues; every line is a caption.
