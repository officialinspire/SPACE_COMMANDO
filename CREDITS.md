# SPACE COMMANDO credits and attribution

The in-game Credits screen (title menu → Credits, or Mission complete → Credits) shows the same information. Only attributions confirmed by a record in this repository are given names. Gaps are listed at the end for review.

## Project

- **SPACE COMMANDO** is a teamInspire project.
- **AI-assisted development:** Claude (Anthropic) and Codex (OpenAI).

## Sound effects

All of these are CC0 1.0, per [assets/audio/field-sfx/README.md](assets/audio/field-sfx/README.md).

| Clip | Source | Creator |
| --- | --- | --- |
| pistol-fire.mp3 | Single Pistol Gunshot 3.2.wav (Freesound) | morganpurkis |
| rifle-fire.mp3 | Machine Gun 001 - single shot.ogg (Freesound) | pgi |
| shotgun-fire.mp3 | shotgun-one-shot.wav (Freesound) | DeltaCode |
| laser-fire.mp3 | Sci-Fi Sounds, laserSmall_003.ogg (OpenGameArt) | Kenney |
| grenade-explosion.mp3 | Explosion / Gun (Freesound); the station blasts | SamsterBirdies |
| pistol-reload.mp3 | Taurus G2c Magazine Release (Freesound) | NoonerBear |
| rifle-reload.mp3 | Assault Rifle Reload (Freesound) | qubodup |
| shotgun-pump.mp3 | R870 Pump 1 (Freesound) | qubodup |
| laser-reload.mp3 | Power Charge (Freesound) | Sojan |
| alien-hurt.mp3 | Creature Monster Alien Vocal FX-6.wav (Freesound) | CVLTIV8R |
| ghost-hurt.mp3 | Creepy Ghost Hit (Freesound) | gmoney514093 |
| robot-damaged.mp3 | videogame sci-fi metalish damage efect (Freesound) | saangosu |
| robot-move.mp3 | MnG - Mech Step.wav (Freesound) | SergeyIonov |
| zombie-hurt.mp3 | Monster Sound Effects Pack, monster-3.wav (OpenGameArt) | Ogrebane |

Story cues (radio squelch, the Analyst's signature, playback glitch, seal release, station alarm, courier ignition, archive drone and fly buzz) are synthesized in the game code (`combat-audio.js`) and are original. Door, relay, blast and ship-fire cues reuse the CC0 clips above. See the Story cues table in [assets/audio/field-sfx/README.md](assets/audio/field-sfx/README.md).

## Typeface

**Barlow Condensed** SemiBold and Bold is by The Barlow Project Authors and licensed under the SIL Open Font License 1.1. It was packaged by Fontsource (`@fontsource/barlow-condensed` 5.1.0). See [assets/fonts/README.md](assets/fonts/README.md) and [assets/fonts/OFL.txt](assets/fonts/OFL.txt).

## Dependencies

No third-party code ships with the game: it's plain HTML, CSS and JavaScript with no libraries. The font above is the only third-party dependency.

## Attribution gaps for review

These files ship with the game, but no record in the repository names their creator, source or licence. They're credited by title or description only, without names.

- **Music:** all ten tracks:
  - Space Commando_ Main Menu
  - Space Station_ Level 1 Ambient
  - Jungle Planet_ Level Theme
  - Cyber City_ Urban Warfare
  - Desert Ruins_ Ancient Temple
  - Orbital Station (Ambient Cutscene)
  - Jungle Planet_ Emergency Crash Landing
  - CyberCity Escape (Cloudline Break)
  - Desolate Desert Ruins
  - Iron and Sand (Instrumental Credits)

  There's no composer, source or licence for any of them.
- **Legacy audio:** `menu_background_music.mp3`, `game-background-music.mp3` and `starting-menu-theme-music.mp3`, used as music fallbacks. Also `pistol_shoot.mp3`, `rifle_shoot.mp3`, `shotgun_shoot.mp3`, `laser_shoot.mp3`, `select_sfx.mp3`, `player_jump.mp3`, `player_damage.mp3` and `enemy_death.mp3`. They have no source record.
- **Combat cue bank:** `assets/audio/combat-bank.mp3` has no source record. The README only covers `assets/audio/field-sfx/`.
- **Art:**
  - the player, enemy, pickup and expansion-enemy sprite sheets (`assets/sprites/`, `assets/characters/`);
  - the station parallax (`assets/station/`, `space_station_parallax.png`);
  - the three environment kits (`assets/environments/`);
  - the story stills and radio portraits (`assets/story/` and their PNG sources);
  - the title art (`assets/ui/orbital-breach*`), the star map (`assets/ui/star-map.webp`) and the legacy `space-commando-sprite-sheet.png`.

  The READMEs under `assets/characters/` describe frame layouts but not creators or licences.
- **Intro video:** `inspiresoftwareintro.mp4` has no creator or licence record.
- **Project name:** the repository owner appears as "OFFICIAL INSPIRE" and "officialinspire". The credits use "teamInspire" as directed; confirm the preferred form.
