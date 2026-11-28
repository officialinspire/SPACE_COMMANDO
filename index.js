/*
 * SPACE COMMANDO – Canvas Edition
 *
 * This version of the game implements a complete side‑scrolling shooter
 * using the HTML5 Canvas API. It loads actor and pickup atlases and
 * a parallax background, then draws and animates each layer. There
 * are four enemy types (zombie, ghost, robot, alien) and four weapons
 * (pistol, assault rifle, shotgun and laser). Enemies drop gold and
 * ammo crates on death, and gold can be spent on new weapons via the
 * purchase menu.
 *
 * Controls:
 *   - Left/Right arrows or A/D: Move
 *   - Space: Jump
 *   - Z: Shoot/hold to fire automatic weapons
 *   - X: Reload current weapon
 *   - P: Open/close purchase menu
 *   - Up/Down: Navigate menu
 *   - Enter: Confirm purchase or restart after game over
 */

(() => {
  const legacySprites = loadSpriteImage(new URL('space-commando-sprite-sheet.png', document.baseURI));
  const atlases = {};
  const manifestURL = new URL('assets/sprites/manifest.json', document.baseURI);
  let artReady = false;

  function loadSpriteImage(url) {
    const image = new Image();
    const ready = new Promise((resolve, reject) => {
      image.onload = () => {
        if (image.decode) image.decode().then(resolve, reject);
        else resolve();
      };
      image.onerror = reject;
    });
    image.src = url.href;
    return { image, ready };
  }

  let legacyReady = false;
  legacySprites.ready.then(() => { legacyReady = true; }, () => {});

  async function preloadAtlases() {
    const controller = new AbortController();
    let timeout;
    const load = async () => {
      const response = await fetch(manifestURL, { signal: controller.signal });
      if (!response.ok) throw new Error('Sprite manifest unavailable');
      const manifest = await response.json();
      await Promise.allSettled(['player', 'enemies', 'pickups'].map(async name => {
        const entry = manifest?.[name];
        if (entry?.image !== name + '.webp' || !entry.clips) return;
        const asset = loadSpriteImage(new URL(entry.image, manifestURL));
        await asset.ready;
        if (!artReady) atlases[name] = { image: asset.image, clips: entry.clips };
      }));
    };
    try {
      await Promise.race([
        load(),
        new Promise(resolve => { timeout = setTimeout(resolve, 3500); })
      ]);
    } catch {
      // The legacy atlas and basic shapes remain available offline or on errors.
    } finally {
      artReady = true;
      clearTimeout(timeout);
      controller.abort();
    }
  }

  preloadAtlases();

  // Load the parallax background. This large image is drawn behind
  // everything else and scrolls slower than the foreground to give a
  // sense of depth.  If it fails to load, the game falls back to a
  // simple dark starfield.
  const legacyBackground = loadSpriteImage(new URL('space_station_parallax.png', document.baseURI));
  let bgLoaded = false;
  legacyBackground.ready.then(() => { bgLoaded = true; }, () => {});

  // Tile indexes are used only for the original atlas fallback.
  const LEGACY = {
    playerIdle: [0], playerRun: [0, 1, 2, 3], playerJump: [7, 8],
    zombie: [18, 19, 21], ghost: [23, 24, 25, 26],
    robot: [14, 15, 16, 17], alien: [28, 29, 30, 31],
    gold: 41, pistol: 36, rifle: 37, shotgun: 38, laser: 39
  };

  const STATION_LAYERS = [['distant', 0.12], ['middle', 0.35], ['near', 0.65]];
  const TERRAIN = {
    deckCap: [2, 2, 256, 15], deckBody: [2, 21, 256, 42], deckEnd: [262, 21, 115, 48],
    platform: [2, 73, 256, 28], ladder: [262, 73, 36, 156], crate: [302, 73, 112, 62],
    shield: [2, 233, 112, 48], barricade: [118, 233, 112, 42]
  };
  const TERRAIN_COLOR = { crate: '#544939', platform: '#2c3b51', shield: '#325b6b', barricade: '#514d43' };
  const AMMO_COLOR = { pistol: '#eccc87', rifle: '#c3cfe4', shotgun: '#e7a07d', laser: '#8ddfff' };
  const station = {};
  for (const name of [...STATION_LAYERS.map(([key]) => key), 'terrain']) {
    const asset = loadSpriteImage(new URL(`assets/station/${name}.webp`, document.baseURI));
    asset.ready.then(() => { station[name] = asset.image; }, () => {});
  }

  // The campaign route, in order, keyed by stable stage IDs (see the story
  // draft): Space Station, Jungle Planet, CyberCity, then the Ancient Planet
  // Ruins, which use the Desert Temple Ruins art. Everything that depends on
  // a stage looks it up by id; the array order is only the route.
  //   map       waypoint position on the star-map art, as fractions of its size
  //   briefing  map and Quickplay text; it never previews unreached story beats
  //   quickplay the fixed standalone loadout for a Quickplay session
  const STAGES = [
    { id: 'station', name: 'Space Station', music: 'play', map: [0.453, 0.139],
      objective: 'Recover the analyst’s research, then reach the shuttle.',
      briefing: 'Our contact missed a scheduled check-in. The docking cradle still answers, but life-support telemetry is dead.',
      quickplay: { health: 100, gold: 0, weapon: 'pistol', owned: ['pistol'], clip: { pistol: 12 }, reserve: { pistol: 24 } } },
    { id: 'jungle', name: 'Jungle Planet', env: 'jungle-planet', music: 'jungle', map: [0.529, 0.362],
      objective: 'Reach the abandoned research facility and restore its relay.',
      briefing: 'The damaged shuttle could only make the nearest planet. A colonial research site stands empty under the canopy.',
      quickplay: { health: 100, gold: 40, weapon: 'rifle', owned: ['pistol', 'rifle'], clip: { pistol: 12, rifle: 50 }, reserve: { pistol: 24, rifle: 60 } } },
    { id: 'cyber', name: 'CyberCity', env: 'cyberpunk-city', music: 'cyber', map: [0.472, 0.579],
      objective: 'Slip through the freight district and reach an impounded courier.',
      briefing: 'A CyberCity cargo hauler is the only ride off-world. The port says freight inspection. The police are scanning for a beacon.',
      quickplay: { health: 100, gold: 80, weapon: 'shotgun', owned: ['pistol', 'rifle', 'shotgun'], clip: { pistol: 12, rifle: 50, shotgun: 5 }, reserve: { pistol: 24, rifle: 60, shotgun: 15 } } },
    { id: 'desert', name: 'Ancient Planet Ruins', env: 'desert-temple-ruins', music: 'desert', map: [0.529, 0.815],
      objective: 'Open the archive, record it and reach extraction.',
      briefing: 'HQ decrypted the analyst’s coordinates to a ruined desert world. Wind cuts across the terraces. Someone may be there first.',
      quickplay: { health: 100, gold: 120, weapon: 'laser', owned: ['pistol', 'rifle', 'shotgun', 'laser'], clip: { pistol: 12, rifle: 50, shotgun: 5, laser: 30 }, reserve: { pistol: 24, rifle: 60, shotgun: 15, laser: 30 } } }
  ];
  const stageById = id => STAGES.find(stage => stage.id === id);

  // Closing credits. Only confirmed attributions: sound effects from
  // assets/audio/field-sfx/README.md and the font from assets/fonts/README.md.
  // The repository records no composer or artist names or licences for the
  // music and art, so those are listed without names. No story spoilers: the
  // roll is also reachable from the title.
  const CREDITS = [
    ['SPACE COMMANDO', ['A teamInspire project.']],
    ['Development', ['teamInspire', 'AI-assisted development with Claude (Anthropic) and Codex (OpenAI).']],
    ['Music', ['Space Commando: Main Menu', 'Space Station: Level 1 Ambient', 'Jungle Planet: Level Theme',
      'Cyber City: Urban Warfare', 'Desert Ruins: Ancient Temple', 'Orbital Station (Ambient Cutscene)',
      'Jungle Planet: Emergency Crash Landing', 'CyberCity Escape (Cloudline Break)', 'Desolate Desert Ruins',
      'Iron and Sand (Instrumental Credits)']],
    ['Art', ['Commando, enemy and pickup sprites', 'Orbital station, Jungle Planet, CyberCity and desert ruins environments',
      'Story stills, radio portraits, title art and star map']],
    ['Sound effects · CC0 1.0', [
      'Pistol fire: “Single Pistol Gunshot 3.2” by morganpurkis (Freesound)',
      'Rifle fire: “Machine Gun 001 - single shot” by pgi (Freesound)',
      'Shotgun fire: “shotgun-one-shot” by DeltaCode (Freesound)',
      'Laser fire: Sci-Fi Sounds, “laserSmall_003” by Kenney (OpenGameArt)',
      'Pistol reload: “Taurus G2c Magazine Release” by NoonerBear (Freesound)',
      'Rifle reload: “Assault Rifle Reload” by qubodup (Freesound)',
      'Shotgun pump: “R870 Pump 1” by qubodup (Freesound)',
      'Laser recharge: “Power Charge” by Sojan (Freesound)',
      'Alien hurt: “Creature Monster Alien Vocal FX-6” by CVLTIV8R (Freesound)',
      'Ghost hurt: “Creepy Ghost Hit” by gmoney514093 (Freesound)',
      'Robot hurt: “videogame sci-fi metalish damage efect” by saangosu (Freesound)',
      'Robot movement: “MnG - Mech Step” by SergeyIonov (Freesound)',
      'Zombie hurt: Monster Sound Effects Pack, “monster-3” by Ogrebane (OpenGameArt)',
      'Grenade detonation (included for a future event): “Explosion / Gun” by SamsterBirdies (Freesound)']],
    ['Typeface', ['Barlow Condensed SemiBold and Bold by The Barlow Project Authors, SIL Open Font License 1.1, packaged by Fontsource (@fontsource/barlow-condensed 5.1.0).']],
    ['Software', ['No third-party code libraries ship with the game.']],
    ['Thanks for playing', ['']]
  ];
  const stageOrder = id => STAGES.findIndex(stage => stage.id === id);

  // Campaign progress: versioned unlocks, clears and the last stage entry
  // (stage, seed and loadout) in localStorage. Bad or foreign data resets to
  // a fresh campaign; without storage, progress lasts for the session only.
  const SAVE_KEY = 'space-commando.campaign';
  const SAVE_VERSION = 1;
  const WEAPON_KEYS = ['pistol', 'rifle', 'shotgun', 'laser'];
  let storageNotice = '';
  let memorySave = null;
  const saveStorage = (() => {
    try {
      const probe = '__space-commando-probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch {
      storageNotice = 'Progress can’t be saved in this browser. It lasts until you close the page.';
      return null;
    }
  })();

  const STORY = window.SpaceStory;

  // Required anchors in the order the objectives ask for them.
  function storyPhases(data) {
    return data.steps.filter(step => step.type !== 'reach').map(step => step.anchors || [step.anchor])
      .filter((list, i, all) => all.findIndex(other => other.join() === list.join()) === i);
  }

  // A mid-stage checkpoint from untrusted data, or null. A bad checkpoint
  // only drops back to the stage entry; it never resets the campaign.
  function sanitizeCheckpoint(stageId, raw) {
    const data = STORY.STAGES[stageId];
    if (!data || !raw || typeof raw !== 'object') return null;
    const step = raw.step;
    if (!Number.isInteger(step) || step < 1 || step >= data.steps.length || !data.steps[step - 1].checkpoint) return null;
    const loadout = sanitizeLoadout(raw.loadout);
    if (!loadout || !(raw.at in data.anchors)) return null;
    const list = (value, allowed) => Array.isArray(value) ? [...new Set(value.filter(v => allowed.includes(v)))] : [];
    const done = list(raw.done, Object.keys(data.anchors));
    // Every anchor of the finished steps must be done.
    const needed = data.steps.slice(0, step).flatMap(s => s.anchors || []);
    if (!needed.every(id => done.includes(id))) return null;
    const fired = list(raw.fired, data.triggers.map(t => t.id));
    const elapsed = Number.isFinite(raw.elapsed) && raw.elapsed >= 0 ? Math.min(raw.elapsed, 3.6e7) : 0;
    return { step, at: raw.at, done, fired, loadout, elapsed };
  }

  function freshCampaign() {
    return { unlocked: ['station'], cleared: [], entry: null };
  }

  // A loadout from untrusted data: known weapons only, sane non-negative ammo.
  function sanitizeLoadout(raw) {
    if (!raw || typeof raw !== 'object') return null;
    // Out-of-range values are clamped rather than trusted.
    const int = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
    const owned = Array.isArray(raw.owned) ? WEAPON_KEYS.filter(key => raw.owned.includes(key)) : [];
    if (!owned.includes('pistol')) owned.unshift('pistol');
    const weapon = owned.includes(raw.weapon) ? raw.weapon : 'pistol';
    const clip = {};
    const reserve = {};
    for (const key of WEAPON_KEYS) {
      const has = owned.includes(key);
      clip[key] = has ? int(raw.clip?.[key], 0, WEAPONS[key].magazine, 0) : 0;
      reserve[key] = has ? int(raw.reserve?.[key], 0, 9999, 0) : 0;
    }
    return { health: int(raw.health, 1, 100, 100), gold: int(raw.gold, 0, 1e6, 0), weapon, owned, clip, reserve };
  }

  function loadCampaign() {
    let text = memorySave;
    if (saveStorage) {
      try { text = saveStorage.getItem(SAVE_KEY); } catch { text = memorySave; }
    }
    if (!text) return freshCampaign();
    try {
      const data = JSON.parse(text);
      if (data?.version !== SAVE_VERSION) throw new Error('version');
      // Clears are a prefix of the route, and only clears unlock the next
      // stage, so an edited unlock list can't skip ahead.
      const ids = STAGES.map(stage => stage.id);
      let clearedCount = 0;
      while (clearedCount < ids.length && Array.isArray(data.cleared) && data.cleared.includes(ids[clearedCount])) clearedCount++;
      const cleared = ids.slice(0, clearedCount);
      const unlocked = ids.slice(0, Math.min(ids.length, clearedCount + 1));
      let entry = null;
      if (data.entry) {
        const seed = Number.isInteger(data.entry.seed) && data.entry.seed >= 0 ? data.entry.seed >>> 0 : null;
        if (seed === null || !unlocked.includes(data.entry.stage)) throw new Error('entry');
        const loadout = sanitizeLoadout(data.entry.loadout) || sanitizeLoadout(stageById(data.entry.stage).quickplay);
        // Elapsed play time at entry keeps the difficulty ramp where it was.
        const elapsed = Number.isFinite(data.entry.elapsed) && data.entry.elapsed >= 0 ? Math.min(data.entry.elapsed, 3.6e7) : 0;
        entry = { stage: data.entry.stage, seed, loadout, elapsed, checkpoint: sanitizeCheckpoint(data.entry.stage, data.entry.checkpoint) };
      }
      return { unlocked, cleared, entry };
    } catch {
      storageNotice = 'Saved progress couldn’t be read, so the campaign was reset.';
      return freshCampaign();
    }
  }

  function saveCampaign(campaign) {
    const text = JSON.stringify({ version: SAVE_VERSION, ...campaign });
    memorySave = text;
    if (!saveStorage) return;
    try {
      saveStorage.setItem(SAVE_KEY, text);
    } catch {
      storageNotice = 'Progress couldn’t be saved. It lasts until you close the page.';
    }
  }

  // How each kit's sprites map onto the game. Rectangles come from
  // assets/environments/manifest.json. The numbers here were measured from
  // each sprite's alpha channel inside its manifest rectangle:
  //   box      opaque bounds [x, y, w, h] relative to the manifest rectangle
  //   body     rows of the box that form the solid part; the first is the
  //            walkable surface. The body is scaled to fill the collision
  //            rectangle, so rows above (rails, grass) and below (supports,
  //            vines) are non-solid trim.
  //   rails    columns of a ladder's two rails, mapped onto the ladder width
  //   surface  first solid row of a cover sprite (anything above is trim)
  // Cover types keep the sprite's width-to-height ratio (coverAspect).
  const ENV_ART = {
    'cyberpunk-city': {
      deck: { sprite: 'street-deck', box: [10, 6, 379, 104], body: [0, 104] },
      catwalk: { sprite: 'catwalk', box: [5, 6, 381, 124], body: [60, 100] },
      ladder: { sprite: 'access-ladder', box: [5, 5, 95, 349], rails: [12, 84] },
      wall: { sprite: 'utility-cabinet', box: [10, 12, 241, 227] },
      cover: {
        crate: { sprite: 'cargo-crate', box: [9, 12, 279, 210], surface: 8 },
        shield: { sprite: 'utility-cabinet', box: [10, 12, 241, 227], surface: 2 },
        barricade: { sprite: 'barricade', box: [8, 6, 389, 168], surface: 9 }
      },
      floorDecor: [{ sprite: 'vent', box: [5, 6, 320, 244], height: 34 }],
      hangDecor: [{ sprite: 'neon-fixture', box: [7, 9, 378, 172], height: 18 }, { sprite: 'cables-and-pipes', box: [8, 8, 377, 206], height: 22 }],
      tint: '#0b1020'
    },
    'jungle-planet': {
      deck: { sprite: 'root-deck', box: [8, 8, 386, 159], body: [20, 156] },
      catwalk: { sprite: 'stone-ledge', box: [8, 11, 389, 166], body: [12, 76] },
      ladder: { sprite: 'vine-ladder', box: [8, 7, 185, 386], rails: [30, 159] },
      wall: { sprite: 'mossy-boulder', box: [6, 7, 396, 194] },
      cover: {
        crate: { sprite: 'overgrown-crate', box: [10, 13, 381, 220], surface: 33 },
        shield: { sprite: 'mossy-boulder', box: [6, 7, 396, 194], surface: 33 },
        barricade: { sprite: 'fallen-trunk', box: [6, 8, 346, 187], surface: 16 }
      },
      floorDecor: [{ sprite: 'fern-clump', box: [7, 8, 377, 248], height: 30 }, { sprite: 'glowing-fungi', box: [5, 8, 224, 197], height: 26 }],
      hangDecor: [{ sprite: 'hanging-vines', box: [8, 10, 369, 359], height: 40 }],
      tint: '#07130d'
    },
    'desert-temple-ruins': {
      deck: { sprite: 'sandstone-deck', box: [7, 11, 389, 169], body: [4, 168] },
      catwalk: { sprite: 'lintel-platform', box: [6, 6, 387, 196], body: [0, 84] },
      ladder: { sprite: 'rope-ladder', box: [7, 5, 117, 365], rails: [6, 114] },
      wall: { sprite: 'cover-block', box: [6, 9, 263, 243] },
      cover: {
        crate: { sprite: 'cover-block', box: [6, 9, 263, 243], surface: 1 },
        shield: { sprite: 'cover-block', box: [6, 9, 263, 243], surface: 1 },
        barricade: { sprite: 'collapsed-wall', box: [5, 10, 414, 161], surface: 2 }
      },
      floorDecor: [{ sprite: 'clay-urn', box: [8, 7, 211, 302], height: 34 }, { sprite: 'pillar-base', box: [5, 8, 291, 289], height: 40 }],
      hangDecor: [{ sprite: 'bronze-lamp', box: [6, 8, 166, 265], height: 20 }],
      tint: '#1a1208'
    }
  };
  for (const art of Object.values(ENV_ART)) {
    art.coverAspect = Object.fromEntries(Object.entries(art.cover).map(([type, c]) => [type, +(c.box[2] / (c.box[3] - c.surface)).toFixed(3)]));
  }

  // Environment images load in the background; a stage whose art is
  // missing draws with the station terrain or flat colours instead.
  const envArt = {};
  const envManifestURL = new URL('assets/environments/manifest.json', document.baseURI);
  fetch(envManifestURL).then(r => r.ok ? r.json() : null).then(manifest => {
    for (const [id, level] of Object.entries(manifest?.levels || {})) {
      if (!ENV_ART[id]) continue;
      const entry = { rects: level.sprites || {} };
      envArt[id] = entry;
      const bg = loadSpriteImage(new URL(level.background, envManifestURL));
      bg.ready.then(() => { entry.background = bg.image; }, () => {});
      const objects = loadSpriteImage(new URL(level.objects, envManifestURL));
      objects.ready.then(() => { entry.objects = objects.image; }, () => {});
    }
  }).catch(() => {});

  const ACTOR_SCALE = 0.5;
  const ENEMY_COLOR = { zombie: '#00aa00', ghost: '#aaaaff', robot: '#ff8844', alien: '#55ff55' };
  const ENEMY_FALL = { zombie: 540, ghost: 440, robot: 540, alien: 540 };

  // Expansion enemies (assets/sprites/expansion-enemies/manifest.json). Frame
  // rectangles, origins, muzzles, contact points, draw scale and the special
  // clip's frame timing come from the manifest. Frames 0 and 1 of the special
  // clip are the windup, triggerFrame (2) resolves the attack once, and the
  // last frame is the recovery. The values below tune behaviour only.
  //   body      physics box [w, h]; hurt projectile hit area [w, h] from the art
  //   economy   existing family whose gold, ammo and health drops they use
  //   audio     existing family whose cues they use when a cue set has no entry
  //   cues      per-event cue names: field-sfx clips where a recording fits the
  //             attack (carbine, laser, armour damage), bank cues otherwise
  const EXPANSION = {
    'cybercity-police': { stages: ['cyber'], kind: 'projectile', body: [32, 32], hurt: [28, 50], health: 4, speed: 0.9,
      preferredRange: 230, reach: 520, damage: 7, shotSpeed: 4.6, firstDelay: [1200, 700], cooldown: [1900, 900],
      economy: 'robot', audio: 'robot', climbs: true,
      cues: { Warn: 'robotWarn', Attack: 'rifleFire', Hurt: 'robotHurt', Down: 'robotDown' } },
    'cybercity-thug': { stages: ['cyber'], kind: 'dash', body: [32, 32], hurt: [30, 52], health: 4, speed: 1.15,
      preferredRange: 36, reach: 70, damage: 7, dashSpeed: 8.5, firstDelay: [600, 600], cooldown: [1400, 600],
      economy: 'zombie', audio: 'zombie', climbs: true, hops: true,
      cues: { Warn: 'zombieWarn', Attack: 'robotAttack', Impact: 'robotDown', Hurt: 'zombieHurt', Down: 'zombieDown' } },
    'jungle-dinosaur': { stages: ['jungle'], kind: 'pounce', body: [64, 40], hurt: [84, 52], health: 7, speed: 1.0, minRun: 260,
      preferredRange: 40, reach: 190, damage: 9, pounce: [4.2, -4.6], firstDelay: [700, 600], cooldown: [1800, 700],
      vulnerable: 2, economy: 'alien', audio: 'alien', climbs: false, hops: true,
      cues: { Warn: 'alienWarn', Attack: 'alienAttack', Land: 'robotMove', Impact: 'robotMove', Hurt: 'alienHurt', Down: 'alienDown' } },
    // Laser rangers lead the jungle roster and return as guests at the ruins.
    'jungle-dark-elf': { stages: ['jungle'], guestStages: ['desert'], guestWeight: [0.2, 0.12], kind: 'laser', body: [32, 32], hurt: [28, 50], health: 3, speed: 1.05,
      preferredRange: 210, reach: 520, damage: 8, firstDelay: [1100, 700], cooldown: [2100, 900],
      economy: 'robot', audio: 'alien', climbs: true,
      cues: { Warn: 'ghostWarn', Attack: 'laserFire', Hurt: 'ghostHurt', Down: 'ghostDown' } }
  };
  for (const type of Object.keys(EXPANSION)) ENEMY_FALL[type] = 700;
  const expansionArt = {};
  const expansionManifestURL = new URL('assets/sprites/expansion-enemies/manifest.json', document.baseURI);
  fetch(expansionManifestURL).then(r => r.ok ? r.json() : null).then(manifest => {
    for (const [type, entry] of Object.entries(manifest?.enemies || {})) {
      if (!EXPANSION[type] || !entry.clips?.special || !entry.specialAttack) continue;
      const sheet = loadSpriteImage(new URL(entry.sheet, expansionManifestURL));
      sheet.ready.then(() => {
        const special = entry.clips.special;
        const trigger = entry.specialAttack.triggerFrame;
        const at = special.slice(0, trigger).reduce((sum, f) => sum + f.ms, 0);
        expansionArt[type] = {
          image: sheet.image, scale: entry.drawScale, clips: entry.clips, trigger,
          // Windup ends and the attack resolves here; recovery follows the trigger frame.
          triggerAt: at, triggerEnd: at + special[trigger].ms,
          total: special.reduce((sum, f) => sum + f.ms, 0)
        };
      }, () => {});
    }
  }).catch(() => {});


  // Packed records contain x, y, width, height, origin x/y, duration, and optional muzzle x/y.
  function clipFrame(atlas, name, time = 0, loop = false) {
    const frames = atlases[atlas]?.clips[name];
    if (!Array.isArray(frames) || !frames.length) return null;
    if (frames.some(frame => !Array.isArray(frame) || !Number.isFinite(frame[6]) || frame[6] <= 0)) return null;
    if (loop) time %= frames.reduce((sum, frame) => sum + frame[6], 0);
    for (const frame of frames) {
      if (time < frame[6]) return frame;
      time -= frame[6];
    }
    return frames.at(-1);
  }

  /**
   * Define weapons. Each weapon has a cost (gold), damage per bullet,
   * magazine size, reload time (ms), bullet speed, fire rate (ms per
   * shot) and whether it fires automatically when the shoot key is held.
   * The ammoDrop property indicates how many units of ammo a pickup gives.
   */
  const WEAPONS = {
    // Pistol: starting weapon.  Fires a single bullet with low to medium
    // damage, reloads quickly and holds a dozen shots.  The ammoDrop
    // reflects a single bullet dropped by enemies.
    pistol:  { name:'Pistol',  cost:0,   damage:3, magazine:12, reloadTime:550,  bulletSpeed:7, fireRate:220, auto:false, ammoDrop:1 },
    // Assault rifle: first purchase.  Fully automatic, fires rapidly and
    // holds fifty rounds.  Reloads quickly and deals similar damage to
    // the pistol.  Enemies drop ammo cartridges containing ten rounds.
    rifle:   { name:'Rifle',   cost:75, damage:4, magazine:50, reloadTime:800,  bulletSpeed:8.5, fireRate:90, auto:true,  ammoDrop:10 },
    // Shotgun: second purchase.  Fires a high‑powered blast once per
    // trigger pull.  Holds five shells and takes longer to reload.  Each
    // pellet deals significant damage.  Enemies drop shells in packs of five.
    shotgun: { name:'Shotgun', cost:150, damage:8, magazine:5,  reloadTime:2100, bulletSpeed:6, fireRate:620, auto:false, pellets:5, spread:0.26, ammoDrop:5 },
    // Laser beam: third purchase.  Slow reload emphasises the need to
    // conserve shots.  The beam fires continuously while the trigger is
    // held until the magazine is depleted.  A reload time of four
    // seconds slows the pace relative to the other guns.  The high
    // damage per shot reflects the weapon's futuristic lethality.
    laser:   { name:'Laser',   cost:200, damage:11, magazine:30, reloadTime:4000, bulletSpeed:13, fireRate:60, auto:true,  ammoDrop:1 }
  };

  // Velocities and acceleration are expressed per simulation tick.
  const STEP_MS = 1000 / 60;
  const MAX_FRAME_MS = 5 * STEP_MS;
  const MOVEMENT = {
    runSpeed: 3.35, crouchSpeed: 1.65, climbSpeed: 2.5,
    groundAccel: 0.9, groundBrake: 1.15,
    airAccel: 0.46, airBrake: 0.18,
    jumpSpeed: 8, gravity: 0.35,
    jumpBufferMs: 110, coyoteMs: 85
  };
  // World camera. The 800×450 canvas shows a zoomed window onto the world;
  // the HUD and screen overlays are drawn afterwards without the zoom.
  // At 1.75× the 800×450 canvas shows 457×257 world units: the player's
  // deck, the next deck's surface with ~85 units of standing room above it,
  // and 64% of the width ahead of the player (~310 units with lead).
  const CAMERA = {
    zoom: 1.75,
    anchor: 0.36,      // player centre as a fraction of view width when facing right (64% ahead)
    lead: 28,          // world units of extra look-ahead at full run speed
    leadMs: 240,       // lead smoothing time constant
    turnMs: 380,       // critically damped settle when the player turns
    turnHoldMs: 140,   // a facing must hold this long before the view swings (quick turns don't pump)
    followXMs: 60,     // horizontal follow time constant
    followYMs: 150,    // vertical settle time
    fallFollowMs: 105, // vertical settle time while falling toward a lower landing
    hudPx: 56,         // screen-space HUD band (canvas px); converted to world units by the zoom
    footroom: 22,      // dead zone: keep this much space below the next landing
    supportDeadband: 40 // landings closer than this to the resting deck (cover tops) don't move the view
  };
  // Dead zone above the collision top: sprite overhang (16), the screen-space
  // band (HUD, plus the objective panel when it sits over the playfield) in
  // world units, and a margin, for a band height in canvas px.
  CAMERA.headroomFor = bandPx => Math.round(16 + bandPx / CAMERA.zoom + 10);
  // Per-round feedback. recoil/duration drive the shoulder recoil pose;
  // kick/kickMs drive a short camera kick opposite the shot (canvas px);
  // pulse is the haptic length in ms (one pulse per round, not per pellet).
  const SHOT_FEEDBACK = {
    pistol:  { recoil: 1.4, duration: 85,  trail: 9,  kick: 1.5, kickMs: 85,  pulse: 12 },
    rifle:   { recoil: 1.8, duration: 70,  trail: 13, kick: 1.2, kickMs: 65,  pulse: 8 },
    shotgun: { recoil: 3.2, duration: 125, trail: 6,  kick: 3.5, kickMs: 130, pulse: 28 },
    laser:   { recoil: 0.65, duration: 48, trail: 24, kick: 0.6, kickMs: 50,  pulse: 6 }
  };
  // Combined kick and shake never move the world more than this (canvas px);
  // the background is drawn with matching overscan so edges stay covered.
  const RENDER_OFFSET_CAP = 5;
  const HAPTIC_MIN_GAP_MS = 70;

  const ENEMY_DROP_TABLES = {
    zombie: [
      { item: 'pistol', weight: 0.6 },
      { item: 'rifle', weight: 0.4 }
    ],
    robot: [
      { item: 'rifle', weight: 0.65 },
      { item: 'laser', weight: 0.35 }
    ],
    alien: [
      { item: 'shotgun', weight: 0.6 },
      { item: 'laser', weight: 0.4 }
    ]
  };

  function weightedChoice(entries) {
    if (!entries || !entries.length) return null;
    let total = 0;
    for (let i = 0; i < entries.length; i++) total += entries[i].weight;
    if (total <= 0) return null;
    let roll = Math.random() * total;
    for (let i = 0; i < entries.length; i++) {
      roll -= entries[i].weight;
      if (roll <= 0) return entries[i].item;
    }
    return entries[entries.length - 1].item;
  }

  /**
   * Shop items definition.  Extends the weapon list with purchasable
   * ammunition.  Each entry contains a type (weapon or ammo),
   * identifying key, display name, cost in gold and a quantity for
   * ammo purchases.  Weapons refer back to the WEAPONS object for
   * magazine sizes and other stats.
   */
  const SHOP_ITEMS = [
    // Weapons – names and costs are pulled from WEAPONS
    { type: 'weapon', key: 'pistol' },
    { type: 'weapon', key: 'rifle' },
    { type: 'weapon', key: 'shotgun' },
    { type: 'weapon', key: 'laser' },
    // Ammo – each entry defines a human‑readable name, cost per purchase
    // and the quantity of rounds provided.  These values reflect
    // balanced pricing: pistol bullets and shotgun shells are cheap,
    // rifle cartridges are mid‑priced and batteries (laser ammo) are
    // expensive.
    { type: 'ammo', ammoType: 'pistol', name: 'Pistol ammo', cost: 5, qty: 1 },
    { type: 'ammo', ammoType: 'rifle', name: 'Rifle ammo', cost: 10, qty: 10 },
    { type: 'ammo', ammoType: 'shotgun', name: 'Shotgun shells', cost: 5, qty: 5 },
    { type: 'ammo', ammoType: 'laser', name: 'Battery', cost: 10, qty: 1 }
  ];

  /**
   * Global game settings adjustable via the settings menu.  Difficulty
   * affects enemy health and spawn rate.  Audio toggles music
   * playback.  Particles toggles explosion effects.  musicVolume
   * controls the baseline volume for both music tracks.
   */
  const SETTINGS = {
    difficulty: 'normal',
    audio: true,
    particles: true,
    effects: 'system',
    sfx: true,
    haptics: true,
    musicVolume: 0.6,
    // Independent levels: 0 Off, 1 Low, 2 Medium, 3 High (the original mix).
    musicLevel: 3,
    sfxLevel: 3
  };
  const AUDIO_LEVELS = [0, 0.35, 0.7, 1];
  const AUDIO_LEVEL_NAMES = ['Off', 'Low', 'Medium', 'High'];

  const SETTING_KEYS = ['difficulty', 'audio', 'particles', 'effects', 'sfx', 'haptics'];
  const hapticsSupported = typeof navigator.vibrate === 'function';
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  function effectsReduced() {
    return SETTINGS.effects === 'reduced' || (SETTINGS.effects === 'system' && motionPreference.matches);
  }

  // Background music. Tracks stream from same-origin relative URLs and are
  // routed from the game state: the level theme plays during play, the
  // menu theme behind the start screen, pause, shop, settings and game
  // over, and nothing during the intro video. Each track loops inside its
  // silent tail, falls back to the previous file if it fails to load, and
  // has a gain trim that levels it with the other music.
  const MUSIC_TRACKS = {
    menu: { src: 'Space Commando_ Main Menu.mp3', tail: 2.69, gain: 0.74,
            fallback: 'menu_background_music.mp3', fallbackTail: 0, fallbackGain: 1 },
    play: { src: 'Space Station_ Level 1 Ambient.mp3', tail: 1.67, gain: 0.59,
            fallback: 'game-background-music.mp3', fallbackTail: 6.9, fallbackGain: 1 },
    // Stage themes fall back to the original game music if they fail to load.
    cyber: { src: 'Cyber City_ Urban Warfare.mp3', tail: 2.72, gain: 0.8,
             fallback: 'game-background-music.mp3', fallbackTail: 6.9, fallbackGain: 1 },
    jungle: { src: 'Jungle Planet_ Level Theme.mp3', tail: 1.81, gain: 0.78,
              fallback: 'game-background-music.mp3', fallbackTail: 6.9, fallbackGain: 1 },
    desert: { src: 'Desert Ruins_ Ancient Temple.mp3', tail: 1.25, gain: 0.68,
              fallback: 'game-background-music.mp3', fallbackTail: 6.9, fallbackGain: 1 },
    // Story cues: the three scenes, the shuttle's crash landing after the
    // station and the end credits. Each restarts from the top when it comes
    // in. Gains match the stage themes at about -18.6 LUFS; tails are the
    // measured trailing silence. A cue that can't load is replaced by its
    // `instead` track and retried later.
    dock: { src: 'Orbital Station (Ambient Cutscene).mp3', tail: 0.42, gain: 0.6, restart: true, instead: 'play' },
    escape: { src: 'CyberCity Escape (Cloudline Break).mp3', tail: 0.92, gain: 0.56, restart: true, instead: 'cyber' },
    reveal: { src: 'Desolate Desert Ruins.mp3', tail: 0.47, gain: 0.65, restart: true, instead: 'desert' },
    crash: { src: 'Jungle Planet_ Emergency Crash Landing.mp3', tail: 0, gain: 0.59, restart: true, instead: 'menu' },
    credits: { src: 'Iron and Sand (Instrumental Credits).mp3', tail: 1.48, gain: 0.63, restart: true, instead: 'menu' }
  };
  // Stage themes that can't play at all fall back to the menu theme.
  for (const name of ['play', 'cyber', 'jungle', 'desert']) MUSIC_TRACKS[name].instead = 'menu';
  // Fades are linear in gain from wherever the track is now, so any fade
  // can be reversed or cancelled mid-way. A fade-in only advances while the
  // track is actually playing. At most one track fades in and one fades out;
  // anything older is cut in `cutMs`.
  const MUSIC_FADE = { inMs: 900, outMs: 700, cutMs: 120 };
  // A track that hasn't started playing within this long (stalled or never
  // decodes) is treated as unavailable and its stand-in plays instead.
  const MUSIC_START_TIMEOUT_MS = 10000;
  // Changes to the Music level ease with this time constant.
  const MUSIC_LEVEL_MS = 150;
  // A track with nothing playable is retried after this long.
  const MUSIC_RETRY_MS = 15000;
  // Ducks scale the active track. Pause, pause settings and game over sit at
  // 0.45, the shop at 0.6, a major radio beat at 0.72. The duck eases in with
  // a 120 ms time constant (about 0.35 s to settle) and releases with 300 ms
  // (about 0.9 s), so leaving a menu swells the music back rather than jumping.
  const MUSIC_DUCK = { pause: 0.45, shop: 0.6, radio: 0.72, attackMs: 120, releaseMs: 300 };

  // -----------------------------------------------------------------------------
  // Sound effects
  //
  // Define short audio clips used throughout the game.  These include a jump
  // sound, four different weapon fire sounds and a selection click used when
  // interacting with menus.  If the corresponding audio files are not
  // available in the current directory they simply won't play, but keeping
  // these objects defined avoids errors when attempting to call .play().  All
  // clips are set to not loop and a modest volume by default.  Volume can be
  // tweaked here if needed.
  const jumpSfx    = new Audio('player_jump.mp3');
  const pistolSfx  = new Audio('pistol_shoot.mp3');
  const rifleSfx   = new Audio('rifle_shoot.mp3');
  const shotgunSfx = new Audio('shotgun_shoot.mp3');
  const laserSfx   = new Audio('laser_shoot.mp3');
  const selectSfx  = new Audio('select_sfx.mp3');
  // Additional sound effects for damage and death.  These clips play when
  // the player is hit or when an enemy dies.  They are initialised here
  // to share the same default volume and looping configuration as the
  // other effects.  If the files are missing, playback is simply
  // ignored without throwing an error.
  const playerDamageSfx = new Audio('player_damage.mp3');
  const enemyDeathSfx   = new Audio('enemy_death.mp3');
  [jumpSfx, pistolSfx, rifleSfx, shotgunSfx, laserSfx, selectSfx, playerDamageSfx, enemyDeathSfx].forEach(a => {
    if (a) {
      a.loop = false;
      a.volume = 0.6;
      a.baseVolume = 0.6;
    }
  });

  // Automatic weapons rotate through a fixed number of overlapping voices.
  const shotVoices = {
    pistol: [pistolSfx],
    rifle: [rifleSfx, ...Array.from({ length: 3 }, () => rifleSfx.cloneNode())],
    shotgun: [shotgunSfx],
    laser: [laserSfx, ...Array.from({ length: 3 }, () => laserSfx.cloneNode())]
  };
  const nextShotVoice = { pistol: 0, rifle: 0, shotgun: 0, laser: 0 };
  for (const key of ['rifle', 'laser']) {
    shotVoices[key].forEach(voice => { voice.volume = voice.baseVolume = key === 'rifle' ? 0.28 : 0.22; });
  }

  // Apply the Sound effects level to Web Audio cues and the HTML clips.
  function applySfxLevel() {
    const level = AUDIO_LEVELS[SETTINGS.sfxLevel];
    window.combatAudio?.setVolume(level);
    const clips = [jumpSfx, selectSfx, playerDamageSfx, enemyDeathSfx, ...Object.values(shotVoices).flat()];
    for (const clip of clips) clip.volume = (clip.baseVolume ?? 0.6) * level;
  }

  function playShot(key) {
    if (!SETTINGS.sfx) return;
    const level = key === 'shotgun' ? 0.60 : key === 'laser' ? 0.34 : 0.46;
    if (window.combatAudio?.play(key + 'Fire', 'fire', level)) return;
    const voices = shotVoices[key];
    const index = nextShotVoice[key];
    const voice = voices[index];
    nextShotVoice[key] = (index + 1) % voices.length;
    voice.currentTime = 0;
    voice.play().catch(() => {});
  }

  function playLegacyEffect(clip) {
    if (!SETTINGS.sfx) return;
    clip.currentTime = 0;
    clip.play().catch(() => {});
  }

  function stopEffects() {
    window.combatAudio?.stop();
    for (const voices of Object.values(shotVoices)) {
      for (const voice of voices) voice.pause();
    }
    for (const clip of [jumpSfx, playerDamageSfx, enemyDeathSfx]) clip.pause();
  }

  // Track total elapsed play time in milliseconds.  This value is incremented
  // during gameplay and used to scale enemy spawn rates and mix of enemy
  // types so that the game becomes more challenging the longer it is
  // played.
  let elapsedTime = 0;
  /**
   * Initialize and run the game. This function sets up the canvas,
   * event listeners, game entities, and the main loop. All of the
   * gameplay logic lives within the nested helper functions.
   */
  function init() {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const worldWidth = 5000; // world extends horizontally
    // Three decks: lower (the continuous station floor), middle and upper.
    // Deck spacing exceeds jump height, so ladders are the way up.
    const worldHeight = 560;
    const DECK_Y = [528, 388, 248];
    const groundY = DECK_Y[0];
    const physicsWorld = { width: worldWidth, groundY };
    const viewWidth = width / CAMERA.zoom;
    const viewHeight = height / CAMERA.zoom;
    const maxViewY = worldHeight - viewHeight;
    // Unshaken view in world units. Gameplay checks read this directly.
    // Canvas px from the top covered by screen-space UI over the playfield.
    let screenBandPx = CAMERA.hudPx;
    const camera = { x: 0, y: maxViewY, look: 1, lookVelocity: 0, lead: 0, yVelocity: 0, support: groundY, facing: 1, facingFor: 0 };

    // ---------------------------------------------------------------------
    // Music director. Each frame turns the screen into one desired state:
    // a track name and an entry key. A new key for a story cue or a stage
    // theme starts it from the top; the same key (pause, shop, retry, hidden
    // tab, mute) continues from where it was.
    //
    //   boot / intro             nothing (the intro video has its own sound)
    //   title, star map,
    //   title settings           menu theme
    //   stage gameplay           the stage theme, keyed by stage entry
    //   pause, pause settings,
    //   game over                the stage theme, ducked (retry continues it)
    //   shop                     the stage theme, ducked less
    //   cutscene                 its cue (dock, escape, reveal), keyed per opening
    //   stage clear              the stage's clear cue (station: crash landing;
    //                            CyberCity: the launch cue carries on), else menu
    //   mission complete         credits (Iron and Sand), keyed per completion
    //   credits screen           the same credits key, so it never restarts
    //   quickplay                the stage theme; its clear screen uses menu
    //
    // Sources are set only when a track is first wanted, so nothing streams
    // at boot and only the active tracks download.
    const music = {};
    let musicBlocked = false;
    let musicLast = null;
    let musicSeq = 0;
    // The track fading in (or playing) and the one fading out.
    // `level` eases toward the Music setting, so muting fades rather than cuts.
    const director = { current: null, outgoing: null, duck: 1, level: null };
    // Entry keys: a new stage entry, scene opening or end screen gets a new key.
    const musicEntry = { stage: 0, scene: 0, end: 0, credits: 0 };

    function trackSource(track) {
      const def = MUSIC_TRACKS[track.name];
      return track.failed ? def.fallback : def.src;
    }

    function ensureSource(track) {
      if (track.srcSet) return;
      track.srcSet = true;
      track.audio.preload = 'auto';
      track.audio.src = encodeURI(trackSource(track));
    }

    // Stop a track now and forget any play request still in flight.
    function stopTrack(track) {
      track.token = ++musicSeq;
      track.pending = false;
      track.ready = false;
      track.fade = 0;
      track.requestedAt = 0;
      if (!track.audio.paused) track.audio.pause();
      track.audio.volume = 0;
    }

    const isActive = track => director.current === track.name || director.outgoing === track.name;

    function startTrack(track) {
      if (track.pending || !track.audio.paused) return;
      ensureSource(track);
      const token = track.token = ++musicSeq;
      track.pending = true;
      track.requestedAt ||= performance.now();
      track.audio.volume = 0;
      let attempt;
      try { attempt = track.audio.play(); } catch { attempt = null; }
      const settle = ok => {
        if (token !== track.token) return;
        track.pending = false;
        // A play that resolves after the track stopped being wanted, or after
        // the tab was hidden, must not start it.
        if (ok && (!isActive(track) || document.hidden)) track.audio.pause();
      };
      if (attempt?.then) {
        attempt.then(() => settle(true), err => {
          settle(false);
          // Autoplay rejection waits for the next gesture instead of retrying
          // every frame. Missing or undecodable files are handled by 'error'.
          // A blocked start is waiting for a gesture, not failing.
          if (token === track.token && err?.name === 'NotAllowedError') { musicBlocked = true; track.requestedAt = 0; }
        });
      } else settle(true);
    }

    function markUnavailable(track) {
      track.unavailableUntil = performance.now() + MUSIC_RETRY_MS;
      stopTrack(track);
    }

    for (const [name, def] of Object.entries(MUSIC_TRACKS)) {
      const audio = new Audio();
      audio.preload = 'none';
      const track = { name, audio, fade: 0, duck: 1, gain: def.gain, tail: def.tail, restart: Boolean(def.restart),
        failed: false, pending: false, ready: false, srcSet: false, token: 0, key: null, requestedAt: 0, unavailableUntil: 0 };
      audio.addEventListener('error', () => {
        if (!track.srcSet) return;
        if (!track.failed && def.fallback) {
          // Primary file failed: switch to the legacy fallback and keep going.
          track.failed = true;
          track.gain = def.fallbackGain;
          track.tail = def.fallbackTail;
          track.pending = false;
          track.ready = false;
          track.requestedAt = isActive(track) ? performance.now() : 0;
          audio.src = encodeURI(def.fallback);
          audio.load();
          return;
        }
        // Nothing playable right now: its stand-in plays until a retry.
        markUnavailable(track);
      });
      // Fade-ins wait for real playback; buffering holds the fade where it is.
      audio.addEventListener('playing', () => {
        if (!isActive(track) || document.hidden) { audio.pause(); return; }
        track.ready = true;
        track.requestedAt = 0;
      });
      audio.addEventListener('waiting', () => { track.ready = false; });
      audio.addEventListener('pause', () => { track.ready = false; });
      // Loop inside the measured silent tail rather than waiting for the file end.
      audio.addEventListener('timeupdate', () => {
        if (track.tail && audio.duration && audio.currentTime >= audio.duration - track.tail + 0.12) audio.currentTime = 0;
      });
      audio.addEventListener('ended', () => {
        audio.currentTime = 0;
        // Only the current track loops; a late 'ended' can't revive anything else.
        if (director.current === name && !document.hidden) startTrack(track);
      });
      music[name] = track;
    }
    for (const event of ['pointerdown', 'keydown']) {
      window.addEventListener(event, () => { musicBlocked = false; }, { capture: true, passive: true });
    }
    // Hidden tabs stop everything at once. On return the desired state is
    // picked up again, continuing from the same positions with a fresh fade.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { musicLast = null; return; }
      for (const track of Object.values(music)) stopTrack(track);
      director.current = null;
      director.outgoing = null;
    });

    // The desired music state for the current screen.
    function wantedState() {
      if (document.body.dataset.boot !== 'ready' || !SETTINGS.audio || !SETTINGS.musicLevel || document.hidden) return null;
      const stageTrack = { name: STAGES[stageIndex].music, key: `stage:${musicEntry.stage}` };
      const campaignStory = playMode === 'campaign' ? STORY.STAGES[STAGES[stageIndex].id] : null;
      if (gameState === 'scene') {
        const cue = scene && STORY.SCENES[scene.id].music;
        return cue ? { name: cue, key: `scene:${musicEntry.scene}` } : stageTrack;
      }
      if (gameState === 'play' || gameState === 'menu' || gameState === 'shop') return stageTrack;
      if (gameState === 'settings') return prevSettingsState === 'menu' ? stageTrack : { name: 'menu', key: 'menu' };
      if (gameState === 'credits') return { name: 'credits', key: `credits:${musicEntry.credits}` };
      if (gameState === 'gameover') {
        if (endKind === 'dead') return stageTrack;
        if (campaignStory && endKind === 'complete') return { name: campaignStory.endMusic || 'credits', key: `credits:${musicEntry.credits}` };
        if (campaignStory && endKind === 'cleared' && campaignStory.clearMusic) {
          // A cue already playing (CyberCity's launch) carries on under its clear screen.
          const name = campaignStory.clearMusic;
          return { name, key: director.current === name ? music[name].key : `end:${musicEntry.end}` };
        }
      }
      return { name: 'menu', key: 'menu' };
    }

    function wantedMusic() {
      return wantedState()?.name ?? null;
    }

    // The wanted track, or the one standing in while it is unavailable. An
    // unavailable track is retried once its wait is over and it is wanted.
    function playableMusic(name) {
      for (let hops = 0; name && hops < 4; hops++) {
        const track = music[name];
        if (!track.unavailableUntil) return name;
        if (performance.now() >= track.unavailableUntil) {
          const def = MUSIC_TRACKS[name];
          track.unavailableUntil = 0;
          track.failed = false;
          track.gain = def.gain;
          track.tail = def.tail;
          track.srcSet = false;
          return name;
        }
        name = MUSIC_TRACKS[name].instead;
      }
      return null;
    }

    function musicDuck() {
      if (gameState === 'menu' || (gameState === 'settings' && prevSettingsState === 'menu')) return MUSIC_DUCK.pause;
      if (gameState === 'gameover' && endKind === 'dead') return MUSIC_DUCK.pause;
      if (gameState === 'shop') return MUSIC_DUCK.shop;
      if (gameState === 'play' && story?.caption?.major) return MUSIC_DUCK.radio;
      return 1;
    }

    // Make `name` the current track. The previous current one becomes the
    // outgoing track; an older outgoing track is cut.
    function bringIn(name, key) {
      const incoming = music[name];
      // An older outgoing track stops at once: never more than two audible.
      if (director.outgoing && director.outgoing !== name && director.outgoing !== director.current) {
        stopTrack(music[director.outgoing]);
        director.outgoing = null;
      }
      if (director.current && director.current !== name) director.outgoing = director.current;
      if (director.outgoing === name) director.outgoing = null;
      director.current = name;
      // A new entry key restarts story cues and stage themes from the top.
      // Re-entered while still fading out, it simply continues: no cut.
      if (key !== incoming.key) {
        const fresh = incoming.restart || name !== 'menu';
        if (fresh && incoming.key !== null && incoming.fade === 0) {
          try { incoming.audio.currentTime = 0; } catch {}
        }
        incoming.key = key;
      }
    }

    // Called every frame: one desired state, at most two audible tracks.
    function updateMusic(now) {
      const dt = musicLast === null ? 0 : Math.min(100, now - musicLast);
      musicLast = now;
      const state = wantedState();
      let name = state ? playableMusic(state.name) : null;
      // A stand-in keeps its own position instead of restarting.
      const key = name && name === state?.name ? state.key : (name ? music[name].key ?? 'standin' : null);
      if (name !== director.current || (name && key !== music[name].key)) {
        if (name) bringIn(name, key);
        else {
          if (director.current) {
            if (director.outgoing && director.outgoing !== director.current) stopTrack(music[director.outgoing]);
            director.outgoing = director.current;
          }
          director.current = null;
        }
      }
      // Duck: each track eases its own duck, faster down than back up. Only
      // the current track follows the screen; an outgoing track holds the
      // duck it had, so handing over never makes it jump louder.
      const duckTarget = musicDuck();
      const easeDuck = track => {
        const tau = duckTarget < track.duck ? MUSIC_DUCK.attackMs : MUSIC_DUCK.releaseMs;
        track.duck += (duckTarget - track.duck) * (dt ? 1 - Math.exp(-dt / tau) : 0);
        if (Math.abs(track.duck - duckTarget) < 0.002) track.duck = duckTarget;
      };
      // The Music level eases (150 ms time constant); while muting, the last
      // audible level carries the outgoing fade so it fades instead of cutting.
      const levelTarget = SETTINGS.audio ? SETTINGS.musicVolume * AUDIO_LEVELS[SETTINGS.musicLevel] : 0;
      if (director.level === null) director.level = levelTarget;
      if (levelTarget > 0 || director.current) director.level += (levelTarget - director.level) * (dt ? 1 - Math.exp(-dt / MUSIC_LEVEL_MS) : 0);
      if (Math.abs(director.level - levelTarget) < 0.002 && levelTarget > 0) director.level = levelTarget;
      const level = director.level;
      for (const track of Object.values(music)) {
        const role = track.name === director.current ? 'in' : (track.name === director.outgoing ? 'out' : (track.fade > 0 || !track.audio.paused ? 'cut' : null));
        if (!role) continue;
        if (role === 'in') {
          // A track coming in from silence takes the screen's duck at once.
          if (track.fade === 0) track.duck = duckTarget;
          else easeDuck(track);
          director.duck = track.duck;
          if (track.audio.paused && !track.pending && !musicBlocked && !document.hidden) startTrack(track);
          // A start that never gets going hands over to the stand-in.
          if (!track.ready && !musicBlocked && track.requestedAt && now - track.requestedAt > MUSIC_START_TIMEOUT_MS) { markUnavailable(track); continue; }
          if (track.ready && !track.audio.paused) track.fade = Math.min(1, track.fade + dt / MUSIC_FADE.inMs);
        } else {
          // Outgoing fades from its current gain; a stray track is cut quickly.
          track.fade = Math.max(0, track.fade - dt / (role === 'cut' ? MUSIC_FADE.cutMs : MUSIC_FADE.outMs));
          if (track.fade === 0) {
            stopTrack(track);
            if (role === 'out') director.outgoing = null;
            continue;
          }
        }
        track.audio.volume = Math.max(0, Math.min(1, track.fade * track.gain * track.duck * level));
      }
    }

    window.commandoMusic = { tracks: music, director, wanted: wantedMusic, state: wantedState, playing: () => director.current, duck: musicDuck };

    // Menu music starts after the intro video ends (see index.html), so the
    // two never overlap.
    // Used only when neither distant background can be loaded.
    const stars = [];
    for (let i=0; i<600; i++) {
      stars.push({
        x: Math.random() * worldWidth,
        y: Math.random() * height * 0.82,
        size: 0.7 + Math.random() * 1.5,
        alpha: 0.22 + Math.random() * 0.55
      });
    }
    // Track keyboard and touch independently so releasing either input
    // source cannot cancel a key still held by the other.
    const keyboardKeys = new Map();
    const touchKeys = new Map();
    const pressedKeys = new Set();
    let clearTouchInputs = () => {};
    let jumpBuffer = 0;
    let coyoteTime = 0;
    let accumulator = 0;
    let lastTime = null;

    function gameplayKey(key) {
      if (key === ' ' || key === 'Spacebar') return 'Space';
      return key.length === 1 ? key.toLowerCase() : key;
    }

    function held(key) {
      return keyboardKeys.has(key) || touchKeys.has(key);
    }

    function pressGameplayKey(source, key) {
      const wasHeld = held(key);
      source.set(key, (source.get(key) || 0) + 1);
      if (!wasHeld && gameState === 'play') pressedKeys.add(key);
    }

    function releaseGameplayKey(source, key) {
      const count = source.get(key) || 0;
      if (count <= 1) source.delete(key);
      else source.set(key, count - 1);
    }

    function resetGameplayInput() {
      keyboardKeys.clear();
      clearTouchInputs();
      pressedKeys.clear();
      jumpBuffer = 0;
      coyoteTime = 0;
      accumulator = 0;
      lastTime = null;
      stopEffects();
      clearShotFeedback();
    }

    // Shot feedback: camera kicks and haptic pulses. Kicks age with
    // simulation time and are drawn as a render offset, so they never
    // touch the camera, aim, collision or projectiles.
    let shotKicks = [];
    let lastPulseAt = -Infinity;

    function clearShotFeedback() {
      shotKicks = [];
      lastPulseAt = -Infinity;
      // A frozen shake would otherwise hold the world off-centre behind menus.
      screenShakeTimer = 0;
      cameraShakeX = 0;
      cameraShakeY = 0;
      if (hapticsSupported && SETTINGS.haptics) {
        try { navigator.vibrate(0); } catch {}
      }
    }

    function canPulse() {
      // Browsers only allow vibration after the page has had a user gesture.
      return hapticsSupported && SETTINGS.haptics && (navigator.userActivation?.hasBeenActive ?? true);
    }

    function pulse(ms, force = false) {
      if (!canPulse()) return;
      // Rate-limited in game time, which follows the fixed simulation steps.
      const now = elapsedTime;
      if (!force && now - lastPulseAt < HAPTIC_MIN_GAP_MS) return;
      lastPulseAt = now;
      try { navigator.vibrate(ms); } catch {}
    }

    function addShotKick(key, dirX, dirY) {
      const feedback = SHOT_FEEDBACK[key];
      // The view kicks opposite the shot, like the shoulder recoil.
      shotKicks.push({ x: -dirX, y: -dirY, amp: feedback.kick, ms: feedback.kickMs, age: 0 });
      // The shotgun fires one stronger pulse per shell.
      pulse(feedback.pulse, key === 'shotgun');
    }

    function updateShotKicks(dt) {
      for (let i = shotKicks.length - 1; i >= 0; i--) {
        shotKicks[i].age += dt;
        if (shotKicks[i].age >= shotKicks[i].ms) shotKicks.splice(i, 1);
      }
    }

    // World render offset in canvas px: kicks plus damage/impact shake,
    // capped in magnitude. Reduced effects suppress both.
    function renderOffset(reduced) {
      if (reduced) return { x: 0, y: 0 };
      let x = cameraShakeX;
      let y = 0;
      for (const k of shotKicks) {
        const left = 1 - k.age / k.ms;
        const amount = k.amp * left * left; // same ease as the shoulder recoil
        x += k.x * amount;
        y += k.y * amount;
      }
      const length = Math.hypot(x, y);
      const scale = length > RENDER_OFFSET_CAP ? RENDER_OFFSET_CAP / length : 1;
      return { x: x * scale, y: y * scale };
    }

    /**
     * Handle menu navigation and selection. When the shop is open,
     * arrow keys cycle through weapons and Enter purchases the selected
     * weapon if the player has enough gold. P toggles the shop.
     */
    function handleMenuInput(e) {
      if (document.body.dataset.boot !== 'ready') return;
      const previousState = gameState;
      if (gameState === 'shop') {
        // Purchase menu navigation for both weapons and ammo items
        if (e.key === 'ArrowUp') {
          menuSelection = (menuSelection + SHOP_ITEMS.length - 1) % SHOP_ITEMS.length;
        } else if (e.key === 'ArrowDown') {
          menuSelection = (menuSelection + 1) % SHOP_ITEMS.length;
        } else if (e.key === 'Enter') {
          const item = SHOP_ITEMS[menuSelection];
          shopNotice = '';
          if (item.type === 'weapon') {
            const key = item.key;
            const w = WEAPONS[key];
            const alreadyOwned = !!player.ownedWeapons[key];
            const previousWeapon = player.weapon;
            // Enter on a weapon row buys+equips if not owned, otherwise just equips.
            if (alreadyOwned) {
              player.weapon = key;
              shopNotice = `${w.name} equipped`;
            } else if (player.gold >= w.cost) {
              player.gold -= w.cost;
              player.ownedWeapons[key] = true;
              player.weapon = key;
              // refill clip and grant two extra magazines of reserve
              player.ammoInClip[key] = w.magazine;
              player.reserveAmmo[key] += w.magazine * 2;
              shopNotice = `${w.name} purchased and equipped`;
            } else {
              shopNotice = `Requires ${w.cost} gold`;
            }
            if (previousWeapon !== player.weapon) player.recoilTimer = 0;
            if (player.reloading && player.reloadWeaponKey !== player.weapon) {
              // Switching away cancels the pending reload without spending reserve.
              player.reloading = false;
              player.reloadTimer = 0;
              player.reloadWeaponKey = null;
            }
          } else if (item.type === 'ammo') {
            // purchase ammunition
            if (player.gold >= item.cost) {
              player.gold -= item.cost;
              player.reserveAmmo[item.ammoType] += item.qty;
              shopNotice = `Added ${item.qty} to reserve`;
            } else {
              shopNotice = `Requires ${item.cost} gold`;
            }
          }
          // Play selection sound whenever a purchase is attempted
          playLegacyEffect(selectSfx);
        } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
          // Close shop and resume play
          gameState = 'play';
        }
      } else if (gameState === 'play') {
        if (e.key === 'p' || e.key === 'P') {
          // Open purchase menu
          gameState = 'shop';
          shopNotice = '';
          // Highlight the current weapon if present in the shop items.
          const idx = SHOP_ITEMS.findIndex(it => it.type === 'weapon' && it.key === player.weapon);
          menuSelection = idx >= 0 ? idx : 0;
        } else if (e.key === 'Escape') {
          // Open pause/menu overlay
          gameState = 'menu';
          mainMenuSelection = 0;
        }
      } else if (gameState === 'menu') {
        // Pause menu options: 0 Resume, 1 Retry stage, 2 Star map, 3 Settings
        const optionsCount = 4;
        if (e.key === 'ArrowUp') {
          mainMenuSelection = (mainMenuSelection + optionsCount - 1) % optionsCount;
        } else if (e.key === 'ArrowDown') {
          mainMenuSelection = (mainMenuSelection + 1) % optionsCount;
        } else if (e.key === 'Enter') {
          if (mainMenuSelection === 0) {
            // Return to game
            gameState = 'play';
          } else if (mainMenuSelection === 1) {
            // Retry the stage from how it was entered.
            retryStage();
          } else if (mainMenuSelection === 2) {
            openStarMap();
          } else if (mainMenuSelection === 3) {
            // Open settings menu
            prevSettingsState = 'menu';
            settingsSelection = 0;
            gameState = 'settings';
          }
          // Play selection sound when choosing an option on the pause menu
          playLegacyEffect(selectSfx);
        } else if (e.key === 'Escape') {
          // cancel pause and resume play
          gameState = 'play';
        }
      } else if (gameState === 'settings') {
        if (e.key === 'ArrowUp') {
          settingsSelection = (settingsSelection + SETTING_KEYS.length - 1) % SETTING_KEYS.length;
        } else if (e.key === 'ArrowDown') {
          settingsSelection = (settingsSelection + 1) % SETTING_KEYS.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter') {
          const key = SETTING_KEYS[settingsSelection];
          if (key === 'difficulty') {
            const difficulties = ['easy', 'normal', 'hard'];
            let idx = difficulties.indexOf(SETTINGS.difficulty);
            // cycle difficulty in direction based on arrow keys
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') idx = (idx + difficulties.length - 1) % difficulties.length;
            else idx = (idx + 1) % difficulties.length;
            SETTINGS.difficulty = difficulties[idx];
          } else if (key === 'audio' || key === 'sfx') {
            // Music and Sound effects step independently through Off/Low/Medium/High.
            const levelKey = key === 'audio' ? 'musicLevel' : 'sfxLevel';
            const step = e.key === 'ArrowLeft' ? -1 : 1;
            SETTINGS[levelKey] = (SETTINGS[levelKey] + step + AUDIO_LEVELS.length) % AUDIO_LEVELS.length;
            SETTINGS[key] = SETTINGS[levelKey] > 0;
            if (key === 'sfx') {
              applySfxLevel();
              if (!SETTINGS.sfx) {
                stopEffects();
                selectSfx.pause();
              }
            }
            // The music director follows the music level on the next frame.
          } else if (key === 'particles') {
            SETTINGS.particles = !SETTINGS.particles;
          } else if (key === 'haptics') {
            if (SETTINGS.haptics) clearShotFeedback();
            SETTINGS.haptics = !SETTINGS.haptics;
          } else {
            const modes = ['system', 'reduced', 'full'];
            const step = e.key === 'ArrowLeft' ? -1 : 1;
            SETTINGS.effects = modes[(modes.indexOf(SETTINGS.effects) + step + modes.length) % modes.length];
          }
          clearShotFeedback();
          // Play selection sound when adjusting a setting
          playLegacyEffect(selectSfx);
        } else if (e.key === 'Escape') {
          // Exit settings and return to the previous menu
          gameState = prevSettingsState || 'start';
        }
      } else if (gameState === 'start') {
        // Start menu options: 0 Star map, 1 Settings, 2 Credits
        const optionsCount = 3;
        if (e.key === 'ArrowUp') {
          startMenuSelection = (startMenuSelection + optionsCount - 1) % optionsCount;
        } else if (e.key === 'ArrowDown') {
          startMenuSelection = (startMenuSelection + 1) % optionsCount;
        } else if (e.key === 'Enter') {
          if (startMenuSelection === 0) {
            if (!artReady) return;
            openStarMap();
          } else if (startMenuSelection === 1) {
            // open settings from start menu
            prevSettingsState = 'start';
            settingsSelection = 0;
            gameState = 'settings';
          } else if (startMenuSelection === 2) {
            openCredits('start');
          }
          // Play selection sound on start menu action
          playLegacyEffect(selectSfx);
        }
        // no escape action on start menu
      } else if (gameState === 'credits') {
        // Arrows and Page keys scroll the roll; Enter or Escape leaves.
        const roll = menuLayer.querySelector('.credits-roll');
        const steps = { ArrowDown: 48, ArrowUp: -48, PageDown: 0.85, PageUp: -0.85 };
        if (roll && e.key in steps) {
          const step = steps[e.key];
          roll.scrollTop += Math.abs(step) < 1 ? step * roll.clientHeight : step;
          creditsRoll.holdUntil = performance.now() + 3000;
        } else if (roll && (e.key === 'Home' || e.key === 'End')) {
          roll.scrollTop = e.key === 'Home' ? 0 : roll.scrollHeight;
          creditsRoll.holdUntil = performance.now() + 3000;
        } else if (e.key === 'Enter' || e.key === 'Escape') {
          playLegacyEffect(selectSfx);
          leaveCredits();
        }
      } else if (gameState === 'gameover') {
        const count = endOptions.length || 1;
        if (e.key === 'ArrowUp') endSelection = (endSelection + count - 1) % count;
        else if (e.key === 'ArrowDown') endSelection = (endSelection + 1) % count;
        else if (e.key === 'Enter' && endOptions[endSelection]) {
          playLegacyEffect(selectSfx);
          endOptions[endSelection][1]();
        }
      } else if (gameState === 'scene') {
        if (e.key === 'Escape') closeScene(true);
        else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Space' || e.key === 'ArrowRight') advanceScene();
      } else if (gameState === 'map') {
        // Rows: the four waypoints, then Continue, Quickplay and Back.
        const rows = STAGES.length + 3;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') mapRow = (mapRow + rows - 1) % rows;
        else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') mapRow = (mapRow + 1) % rows;
        if (mapRow < STAGES.length && e.key.startsWith('Arrow')) mapPick = mapRow;
        if (e.key === 'Enter') {
          playLegacyEffect(selectSfx);
          if (mapRow < STAGES.length) mapPick = mapRow;
          else if (mapRow === STAGES.length) continueCampaign();
          else if (mapRow === STAGES.length + 1) startQuickplay(STAGES[mapPick].id);
          else { gameState = 'start'; startMenuSelection = 0; }
        } else if (e.key === 'Escape') {
          gameState = 'start';
          startMenuSelection = 0;
        }
      }
      if (gameState !== previousState && (previousState === 'play' || gameState === 'play')) {
        resetGameplayInput();
      }
      syncMenu(e.key.startsWith('Arrow'));
    }

    const scrollKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
    document.addEventListener('keydown', e => {
      if (document.body.dataset.boot !== 'ready') return;
      const key = gameplayKey(e.key);
      if (e.target?.closest?.('button') && (key === 'Space' || key === 'Enter')) return;
      if (scrollKeys.includes(key)) e.preventDefault();
      if (e.repeat || keyboardKeys.has(key)) return;
      if (gameState === 'play') pressGameplayKey(keyboardKeys, key);
      // The game handles this Enter or Space itself. If a menu rebuild moves
      // focus to a button, the same press must not also activate it (that
      // turned one Enter on the start screen into Star map + Start campaign).
      if ((key === 'Enter' || key === 'Space') && gameState !== 'play') e.preventDefault();
      handleMenuInput(e);
    });
    document.addEventListener('keyup', e => {
      const key = gameplayKey(e.key);
      releaseGameplayKey(keyboardKeys, key);
      if (scrollKeys.includes(key) && !(key === 'Space' && e.target?.closest?.('button'))) e.preventDefault();
    });
    // Losing focus releases held input and pauses play, so timers and holds
    // never run while the player can't see or control the game.
    function autoPause() {
      resetGameplayInput();
      if (gameState === 'play' && document.body.dataset.boot === 'ready') {
        gameState = 'menu';
        mainMenuSelection = 0;
        syncMenu();
      }
    }
    window.addEventListener('blur', () => { windowFocused = false; autoPause(); });
    window.addEventListener('focus', () => { windowFocused = true; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); else resetGameplayInput(); });
    document.addEventListener('fullscreenchange', resetGameplayInput);
    window.addEventListener('orientationchange', resetGameplayInput);
    window.screen.orientation?.addEventListener('change', resetGameplayInput);
    // ---------------------------------------------------------------------
    // Mobile controls
    const isMobile =
      /Mobi|Android|iPhone|iPad|iPod|Tablet/i.test(navigator.userAgent) ||
      navigator.maxTouchPoints > 0;

    if (isMobile) {
      const ctrlBar = document.getElementById('mobile-controls');
      ctrlBar.hidden = false;
      document.body.setAttribute('data-touch', '');
      const buttons = Array.from(ctrlBar.querySelectorAll('.control-btn'));
      // These open or leave a menu, so they also go through the menu input.
      const menuKeys = new Set(['Escape', 'p', 'P']);
      // A pointer press is followed by a compatibility click; remember when
      // each control was last pressed so that click isn't counted twice.
      const pointerActivity = new WeakMap();
      const POINTER_CLICK_WINDOW = 1000;

      // A press that opens a menu hides the controls under the finger, so the
      // browser's click after it would land on the new menu (and could buy
      // something in the shop). That one click is swallowed.
      const swallowAfterUp = new Set();
      let swallowClicksUntil = 0;
      document.addEventListener('pointerup', event => {
        if (swallowAfterUp.delete(event.pointerId)) swallowClicksUntil = performance.now() + 400;
      }, true);
      document.addEventListener('click', event => {
        if (performance.now() < swallowClicksUntil && !ctrlBar.contains(event.target)) {
          event.preventDefault();
          event.stopPropagation();
          swallowClicksUntil = 0;
        }
      }, true);

      const vibrate = pointerType => {
        if ((pointerType === 'touch' || pointerType === 'pen') && canPulse()) navigator.vibrate(10);
      };

      // ------------------------------------------------ buttons: one pointer each
      const buttonPointers = new Map();
      const releaseButton = pointerId => {
        const btn = buttonPointers.get(pointerId);
        if (!btn) return;
        buttonPointers.delete(pointerId);
        releaseGameplayKey(touchKeys, btn.dataset.key);
        if (![...buttonPointers.values()].includes(btn)) btn.classList.remove('pressed');
      };
      for (const btn of buttons) {
        const key = btn.dataset.key;
        btn.addEventListener('pointerdown', event => {
          if (event.cancelable) event.preventDefault();
          event.stopPropagation();
          if (buttonPointers.has(event.pointerId)) return;
          pointerActivity.set(btn, performance.now());
          buttonPointers.set(event.pointerId, btn);
          btn.classList.add('pressed');
          try { btn.setPointerCapture(event.pointerId); } catch {}
          vibrate(event.pointerType);
          pressGameplayKey(touchKeys, key);
          if (menuKeys.has(key)) {
            swallowAfterUp.add(event.pointerId);
            handleMenuInput({ key, repeat: false });
          }
        }, { passive: false });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
          btn.addEventListener(type, event => {
            pointerActivity.set(btn, performance.now());
            releaseButton(event.pointerId);
          });
        }
        btn.addEventListener('contextmenu', event => event.preventDefault());
        // Keyboard and assistive activations have no pointer press.
        btn.addEventListener('click', event => {
          event.stopPropagation();
          if (performance.now() - (pointerActivity.get(btn) ?? -Infinity) < POINTER_CLICK_WINDOW) return;
          pressGameplayKey(touchKeys, key);
          if (menuKeys.has(key)) handleMenuInput({ key });
          releaseGameplayKey(touchKeys, key);
        });
      }

      // ------------------------------------------------------- thumb sticks
      // Positions are measured from the stick's centre as a fraction of its
      // radius. Inside the dead zone nothing is held. Horizontal input needs
      // HORIZONTAL; up and down need VERTICAL and an angle within 55° of
      // straight up or down, so a sideways drag never crouches or climbs.
      const STICK = { dead: 0.24, horizontal: 0.3, vertical: 0.5, verticalSlope: Math.tan(55 * Math.PI / 180), jumpZone: 0.36, travel: 0.55 };
      const sticks = [];
      function makeStick(el, kind) {
        const stick = { el, kind, knob: el.querySelector('.stick-knob'), pointerId: null, keys: new Set(), lastPointer: -Infinity };
        const setKeys = next => {
          for (const k of stick.keys) if (!next.has(k)) releaseGameplayKey(touchKeys, k);
          for (const k of next) if (!stick.keys.has(k)) pressGameplayKey(touchKeys, k);
          stick.keys = next;
        };
        const vector = event => {
          const box = el.getBoundingClientRect();
          const r = box.width / 2;
          return { x: (event.clientX - box.left - r) / r, y: (event.clientY - box.top - r) / r, r };
        };
        const directions = (v, keys) => {
          const d = Math.hypot(v.x, v.y);
          if (d < STICK.dead) return keys;
          if (kind === 'move' && Math.abs(v.x) >= STICK.horizontal) keys.add(v.x < 0 ? 'ArrowLeft' : 'ArrowRight');
          if (Math.abs(v.y) >= STICK.vertical && Math.abs(v.x) <= Math.abs(v.y) * STICK.verticalSlope) keys.add(v.y < 0 ? 'ArrowUp' : 'ArrowDown');
          return keys;
        };
        const show = v => {
          const d = Math.min(1, Math.hypot(v.x, v.y));
          const angle = Math.atan2(v.y, v.x);
          el.style.setProperty('--kx', `${Math.cos(angle) * d * STICK.travel * v.r}px`);
          el.style.setProperty('--ky', `${Math.sin(angle) * d * STICK.travel * v.r}px`);
        };
        stick.release = () => {
          if (stick.pointerId !== null) {
            try { el.releasePointerCapture(stick.pointerId); } catch {}
          }
          stick.pointerId = null;
          setKeys(new Set());
          el.dataset.active = 'false';
          el.dataset.jump = 'false';
          el.style.setProperty('--kx', '0px');
          el.style.setProperty('--ky', '0px');
        };
        el.addEventListener('pointerdown', event => {
          if (event.cancelable) event.preventDefault();
          event.stopPropagation();
          if (stick.pointerId !== null) return;
          stick.pointerId = event.pointerId;
          stick.lastPointer = performance.now();
          try { el.setPointerCapture(event.pointerId); } catch {}
          const v = vector(event);
          const keys = new Set();
          if (kind === 'move') {
            // A deliberate press in the centre jumps once; the same touch can
            // then drag into movement. A press on the ring only moves.
            if (Math.hypot(v.x, v.y) <= STICK.jumpZone) {
              keys.add('Space');
              el.dataset.jump = 'true';
              vibrate(event.pointerType);
            }
          } else {
            // Fire: one round on the press, sustained while held for automatics.
            keys.add('z');
          }
          setKeys(directions(v, keys));
          el.dataset.active = 'true';
          show(v);
        }, { passive: false });
        el.addEventListener('pointermove', event => {
          if (event.pointerId !== stick.pointerId) return;
          if (event.cancelable) event.preventDefault();
          const v = vector(event);
          const keys = new Set([...stick.keys].filter(k => k === 'Space' || k === 'z'));
          setKeys(directions(v, keys));
          show(v);
        }, { passive: false });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
          el.addEventListener(type, event => {
            if (event.pointerId !== stick.pointerId) return;
            stick.lastPointer = performance.now();
            stick.release();
          });
        }
        el.addEventListener('contextmenu', event => event.preventDefault());
        // Keyboard and assistive activation: the move stick jumps, the fire stick fires once.
        el.addEventListener('click', event => {
          event.stopPropagation();
          if (performance.now() - stick.lastPointer < POINTER_CLICK_WINDOW) return;
          const k = kind === 'move' ? 'Space' : 'z';
          pressGameplayKey(touchKeys, k);
          releaseGameplayKey(touchKeys, k);
        });
        sticks.push(stick);
        return stick;
      }
      makeStick(document.getElementById('stick-move'), 'move');
      makeStick(document.getElementById('stick-aim'), 'aim');

      // Called on blur, hidden tab, pause and other state changes, rotation
      // and fullscreen changes: every held control lets go.
      clearTouchInputs = () => {
        for (const stick of sticks) stick.release();
        for (const pointerId of [...buttonPointers.keys()]) releaseButton(pointerId);
        for (const btn of buttons) btn.classList.remove('pressed');
        touchKeys.clear();
      };
    }

    // Collections for dynamic entities
    let bullets = [];
    let enemyBullets = [];
    let enemies = [];
    let pickups = [];
    let fallenSprites = [];
    let lastLanding = -Infinity;
    let playerDownAt = 0;
    let playerShot = null;
    // Visual feedback lists for combat readability and impact.
    let floatingTexts = [];
    let shotFlashes = [];
    let screenShakeTimer = 0;
    let screenShakeStrength = 0;
    let cameraShakeX = 0;
    let cameraShakeY = 0;
    let damageOverlayTimer = 0;
    // Particle effects list. Each particle has x, y, vx, vy, life, maxLife
    // and a color string. Particles are spawned when enemies are destroyed
    // to create a simple explosion effect.
    let particles = [];
    const FIRST_ATTACK_GRACE = 850;
    const RANGED = {
      robot: { windup: 420, speed: 4.1, damage: 8, recovery: 1900 },
      alien: { windup: 300, speed: 5.1, damage: 6, recovery: 2200 }
    };
    const CLOSE_ATTACK = {
      zombie: { windup: 270, range: 55, rush: 2.2, recovery: 780 },
      ghost: { windup: 310, range: 50, rush: 1.55, recovery: 920 }
    };
    let spawnCooldown = 0;
    let openingEnemyPending = true;
    // Game state machine.  Additional states include:
    // 'start'  – initial start menu shown on page load
    // 'play'   – active gameplay
    // 'shop'   – purchase menu
    // 'menu'   – pause menu invoked with Escape
    // 'settings' – game settings menu
    // 'gameover' – player has died
    let gameState = 'start';
    // Selection indices for various menus
    let menuSelection = 0;        // for shop menu (weapon list)
    let mainMenuSelection = 0;    // for pause menu options
    let startMenuSelection = 0;   // for initial start menu
    let settingsSelection = 0;
    let shopNotice = '';

    // Track the previous state when entering the settings menu so
    // Escaping settings returns the player to the correct screen
    let prevSettingsState = 'start';

    // World solids and ladders come from the station layout: deck slabs,
    // catwalks, bulkheads and cover. The opening corridor is authored and
    // later rooms vary with a reproducible seed (?seed=N in the page URL
    // repeats a layout). Everything is rebuilt on restart.
    let obstacles = [];
    let ladders = [];
    let layout = null;
    let levelSeed = 0;
    const urlSeed = Number.parseInt(new URLSearchParams(location.search).get('seed'), 10);

    // Stage seeds derive from a base seed and the stage's stable id, so the
    // route order never changes a layout. The station uses the base seed
    // itself, so ?seed=N repeats the same station as before.
    let runSeed = 0;
    let stageIndex = 0;
    let stageBanner = null;
    let runComplete = false;
    let decorations = [];
    const EXIT_WIDTH = 46;
    // 'campaign' or 'quickplay'. Quickplay never reads or writes campaign data.
    let playMode = 'campaign';
    let campaign = loadCampaign();
    // How the current stage was entered, for Retry: { stage, seed, loadout, elapsed }.
    let sessionEntry = null;
    // End screen: 'dead', 'cleared', 'complete' or 'quickplay', with its actions.
    let endKind = null;
    let endOptions = [];
    let endSelection = 0;
    let mapRow = 0;
    let mapPick = 0;
    // Campaign story: placement, the running attempt and the open scene.
    let storyPlan = null;
    let story = null;
    let scene = null;
    let endReason = '';
    let leaving = false;
    let windowFocused = true;

    function stageSeed(id, base) {
      if (id === 'station') return base >>> 0;
      let hash = 0x811c9dc5;
      for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
      return (base ^ hash) >>> 0;
    }

    function freshSeed(id) {
      const base = Number.isFinite(urlSeed) ? urlSeed >>> 0 : (Math.random() * 2 ** 32) >>> 0;
      return stageSeed(id, base);
    }

    function defaultLoadout() {
      return { health: 100, gold: 0, weapon: 'pistol', owned: ['pistol'],
        clip: { pistol: WEAPONS.pistol.magazine, rifle: 0, shotgun: 0, laser: 0 },
        reserve: { pistol: WEAPONS.pistol.magazine * 2, rifle: 0, shotgun: 0, laser: 0 } };
    }

    function captureLoadout() {
      return sanitizeLoadout({
        health: Math.max(1, Math.min(100, Math.ceil(player.health))), gold: player.gold, weapon: player.weapon,
        owned: WEAPON_KEYS.filter(key => player.ownedWeapons[key]),
        clip: { ...player.ammoInClip }, reserve: { ...player.reserveAmmo }
      });
    }

    function applyLoadout(loadout) {
      const l = sanitizeLoadout(loadout) || defaultLoadout();
      player.health = l.health;
      player.gold = l.gold;
      player.weapon = l.weapon;
      player.ownedWeapons = Object.fromEntries(WEAPON_KEYS.map(key => [key, l.owned.includes(key)]));
      player.ammoInClip = { pistol: 0, rifle: 0, shotgun: 0, laser: 0, ...l.clip };
      player.reserveAmmo = { pistol: 0, rifle: 0, shotgun: 0, laser: 0, ...l.reserve };
    }

    // Begin a stage in either mode from a known seed and loadout. Campaign
    // entries are saved so Continue and Retry restore exactly this start.
    // A checkpoint resumes the same seed mid-stage with its own loadout.
    // A retry continues the stage theme; any other entry starts it fresh.
    function startStage(mode, id, seed, loadout, elapsed = 0, checkpoint = null, retry = false) {
      if (!retry) musicEntry.stage++;
      resetRunState();
      playMode = mode;
      applyLoadout(loadout);
      sessionEntry = { stage: id, seed, loadout: captureLoadout(), elapsed, checkpoint: mode === 'campaign' ? checkpoint || null : null };
      if (sessionEntry.checkpoint) applyLoadout(checkpoint.loadout);
      elapsedTime = sessionEntry.checkpoint ? checkpoint.elapsed : elapsed;
      if (mode === 'campaign') {
        campaign.entry = sessionEntry;
        saveCampaign(campaign);
      }
      enterStage(stageOrder(id), seed);
      setupStory(sessionEntry.checkpoint);
    }

    function continueCampaign() {
      const entry = campaign.entry;
      if (entry) startStage('campaign', entry.stage, entry.seed, entry.loadout, entry.elapsed || 0, entry.checkpoint);
      else startStage('campaign', 'station', freshSeed('station'), defaultLoadout());
    }

    // Retry stage starts over from the stage entry: objectives, timer, doors
    // and one-shot triggers all reset, and any checkpoint is dropped.
    function retryStage() {
      const entry = sessionEntry || { stage: 'station', seed: freshSeed('station'), loadout: defaultLoadout(), elapsed: 0 };
      startStage(playMode, entry.stage, entry.seed, entry.loadout, entry.elapsed, null, Boolean(sessionEntry));
    }

    function retryCheckpoint() {
      const entry = sessionEntry;
      if (!entry?.checkpoint) { retryStage(); return; }
      startStage(playMode, entry.stage, entry.seed, entry.loadout, entry.elapsed, entry.checkpoint, true);
    }

    function startQuickplay(id) {
      const stage = stageById(id);
      if (!stage || !campaign.unlocked.includes(id)) return;
      startStage('quickplay', id, freshSeed(id), stage.quickplay);
    }

    // Credits: after Mission complete the credits track carries on; from the
    // title it starts fresh.
    let creditsFrom = 'start';
    // The roll scrolls itself slowly unless effects are reduced; any manual
    // scroll, key or touch holds it for a few seconds.
    const creditsRoll = { holdUntil: 0, last: null, offset: 0 };
    function openCredits(from) {
      if (from !== 'complete') musicEntry.credits++;
      creditsFrom = from;
      creditsRoll.holdUntil = performance.now() + 1500;
      creditsRoll.last = null;
      creditsRoll.offset = 0;
      resetGameplayInput();
      gameState = 'credits';
    }

    // Leaving returns where Credits was opened: the Mission complete summary
    // (whose credits track carries on) or the title.
    function leaveCredits() {
      if (creditsFrom === 'complete') { gameState = 'gameover'; endSelection = Math.max(0, endOptions.length - 1); }
      else { gameState = 'start'; startMenuSelection = 2; }
    }

    function updateCreditsRoll(now) {
      if (gameState !== 'credits') return;
      const roll = menuLayer.querySelector('.credits-roll');
      const dt = creditsRoll.last === null ? 0 : Math.min(100, now - creditsRoll.last);
      creditsRoll.last = now;
      if (!roll || effectsReduced() || now < creditsRoll.holdUntil || document.hidden) return;
      // Sub-pixel accumulation keeps the 28 px/s scroll smooth.
      creditsRoll.offset += dt * 0.028;
      const whole = Math.floor(creditsRoll.offset);
      if (whole) { roll.scrollTop += whole; creditsRoll.offset -= whole; }
    }

    function openStarMap() {
      resetGameplayInput();
      gameState = 'map';
      mapPick = Math.max(0, stageOrder(campaign.entry?.stage || campaign.unlocked.at(-1)));
      mapRow = STAGES.length; // Campaign Continue
    }

    // End screens list their actions; Enter runs the selected one.
    function showEnd(kind) {
      endKind = kind;
      endSelection = 0;
      const next = STAGES[stageIndex + 1];
      const checkpoint = playMode === 'campaign' && sessionEntry?.checkpoint;
      endOptions = {
        dead: checkpoint ? [['Retry from checkpoint', retryCheckpoint], ['Restart stage', retryStage], ['Star map', openStarMap]]
          : [['Retry stage', retryStage], ['Star map', openStarMap]],
        quickplay: [['Retry stage', retryStage], ['Star map', openStarMap]],
        cleared: [[`Continue to ${next?.name}`, continueCampaign], ['Star map', openStarMap]],
        complete: [['Credits', () => openCredits('complete')], ['Star map', openStarMap]]
      }[kind];
      // Each clear screen is a new entry for its cue; a completion starts the credits.
      if (kind === 'cleared') musicEntry.end++;
      if (kind === 'complete') musicEntry.credits++;
      runComplete = kind === 'complete';
      if (kind !== 'dead') endReason = '';
      closeCaption();
      gameState = 'gameover';
      playerDownAt = performance.now();
      resetGameplayInput();
    }

    function generateEnvironment() {
      const stage = STAGES[stageIndex];
      layout = window.SpaceStation.build({
        seed: levelSeed, stage: stage.id, coverAspect: stage.env ? ENV_ART[stage.env].coverAspect : null,
        worldWidth, worldHeight, deckY: DECK_Y,
        movement: MOVEMENT, body: { width: 32, height: 32 }
      });
      obstacles = layout.solids;
      ladders = layout.ladders;
      decorations = stage.env ? placeDecorations(stage.env) : [];
      // Story anchors and doors exist only in the campaign.
      const data = playMode === 'campaign' ? STORY.STAGES[stage.id] : null;
      storyPlan = data ? window.SpaceStation.placeStory(layout, {
        worldWidth, worldHeight, deckY: DECK_Y, movement: MOVEMENT, body: { width: 32, height: 32 }
      }, { anchors: data.anchors, doors: data.doors, phases: storyPhases(data) }) : null;
      if (storyPlan) obstacles = [...layout.solids, ...storyPlan.doors.map(door => door.solid)];
    }

    // Non-solid props: floor pieces on walkable decks and hanging pieces
    // under slabs and catwalks, kept clear of ladders, cover and the exit.
    function placeDecorations(env) {
      const art = ENV_ART[env];
      const rng = window.SpaceStation.mulberry32(levelSeed ^ 0x5bd1e995);
      const list = [];
      const nearLadder = x => ladders.some(l => x > l.x - 48 && x < l.x + l.width + 48);
      const nearCover = (x, w) => obstacles.some(o => o.role === 'cover' && x + w > o.x - 8 && x < o.x + o.width + 8);
      for (const surface of layout.dropSurfaces) {
        for (let x = surface.x0 + 40 + rng() * 120; x < surface.x1 - 60; x += 220 + rng() * 260) {
          const decor = art.floorDecor[Math.floor(rng() * art.floorDecor.length)];
          const w = decor.height * decor.box[2] / decor.box[3];
          if (nearLadder(x + w / 2) || nearCover(x, w) || x > worldWidth - 160 || (surface.y === groundY && x < 240)) continue;
          list.push({ decor, x, y: surface.y - decor.height, w, h: decor.height, flip: rng() < 0.5, floor: true });
        }
      }
      for (const ob of obstacles) {
        if (!['slab', 'catwalk', 'terrace'].includes(ob.type) || ob.y >= groundY) continue;
        for (let x = ob.x + 30 + rng() * 80; x < ob.x + ob.width - 50; x += 260 + rng() * 260) {
          const decor = art.hangDecor[Math.floor(rng() * art.hangDecor.length)];
          const w = decor.height * decor.box[2] / decor.box[3];
          if (nearLadder(x + w / 2)) continue;
          list.push({ decor, x, y: ob.y + ob.height, w, h: decor.height, flip: rng() < 0.5 });
        }
      }
      return list;
    }

    // Enter a stage: build it, clear stage-local threats and effects, and
    // place the player at the start. Health, gold, weapons, ammo and
    // difficulty carry over.
    function enterStage(index, seed = stageSeed(STAGES[index].id, runSeed)) {
      stageIndex = index;
      levelSeed = seed >>> 0;
      bullets = [];
      enemyBullets = [];
      enemies = [];
      pickups = [];
      floatingTexts = [];
      shotFlashes = [];
      particles = [];
      fallenSprites = [];
      beams = [];
      slashes = [];
      damageOverlayTimer = 0;
      // The opening zombie belongs to the station, wherever it sits in the route.
      const opening = STAGES[index].id === 'station';
      openingEnemyPending = opening;
      spawnCooldown = opening ? 900 : 1800;
      player.x = 100;
      player.height = player.baseHeight;
      player.y = groundY - player.height;
      player.vx = 0;
      player.vy = 0;
      player.onGround = true;
      player.facing = 1;
      player.ladder = null;
      player.isClimbing = false;
      player.isDucking = false;
      player.invulnTimer = 0;
      player.hitFlashTimer = 0;
      lastLanding = -Infinity;
      resetGameplayInput();
      story = null;
      generateEnvironment();
      snapCamera();
      stageBanner = { text: playMode === 'quickplay' ? `Quickplay · ${STAGES[index].name}` : `Stage ${index + 1} · ${STAGES[index].name}`, at: performance.now() };
    }

    // The exit sits at the end of the upper deck on the stage's right edge.
    function atStageExit() {
      const goal = layout.goal;
      return player.onGround && !player.isClimbing && Math.abs(player.y + player.height - goal.y) < 1 &&
        player.x + player.width >= worldWidth - EXIT_WIDTH;
    }

    // Reaching the exit. A campaign clear unlocks the next waypoint and saves
    // its entry with the loadout carried out of this stage; a Quickplay clear
    // changes nothing in the campaign.
    function leaveStage() {
      // One clear per attempt, however the exit and its scene are reached.
      if (leaving) return;
      leaving = true;
      if (playMode === 'quickplay') { showEnd('quickplay'); return; }
      const id = STAGES[stageIndex].id;
      if (!campaign.cleared.includes(id)) campaign.cleared.push(id);
      const next = STAGES[stageIndex + 1];
      if (next) {
        if (!campaign.unlocked.includes(next.id)) campaign.unlocked.push(next.id);
        campaign.entry = { stage: next.id, seed: freshSeed(next.id), loadout: captureLoadout(), elapsed: elapsedTime };
        saveCampaign(campaign);
        showEnd('cleared');
      } else {
        campaign.entry = null;
        saveCampaign(campaign);
        showEnd('complete');
      }
    }

    // ---------------------------------------------------------------------
    // Campaign story. story.js holds the captions, speakers, one-shot
    // triggers, objectives and scenes; this runs one attempt of a stage.
    const storyHud = document.getElementById('story-hud');
    const objectivePanel = storyHud.querySelector('.story-objective');
    const objectiveText = document.getElementById('story-objective-text');
    const objectiveMeta = document.getElementById('story-objective-meta');
    const objectiveBar = storyHud.querySelector('.objective-progress');
    const captionBox = document.getElementById('story-caption');
    const liveRegion = document.getElementById('story-live');
    const interactButton = document.getElementById('interact-btn');
    const gameContainer = document.getElementById('game-container');
    const sceneLayer = document.getElementById('story-scene');
    const sceneArt = sceneLayer.querySelector('.scene-art');
    const sceneTitle = document.getElementById('scene-title');
    const sceneCaption = sceneLayer.querySelector('.scene-caption');
    const sceneNext = document.getElementById('scene-next');
    const sceneSkip = document.getElementById('scene-skip');
    const hudCache = new Map();

    function setCached(key, value, apply) {
      if (hudCache.get(key) === value) return;
      hudCache.set(key, value);
      apply(value);
    }

    function announce(text) {
      // A repeated message still re-announces.
      liveRegion.textContent = liveRegion.textContent === text ? `${text}​` : text;
    }

    function lineFor(id) {
      return STORY.LINES[id] || { speaker: 'narration', text: String(id) };
    }

    // Radio lines are brief and clear on their own.
    function lineDuration(line) {
      return Math.max(2600, Math.min(6000, 1400 + line.text.length * 46));
    }

    function fillCaption(box, line) {
      const speaker = STORY.SPEAKERS[line.speaker] || { label: '' };
      const portrait = box.querySelector('.caption-portrait');
      if (speaker.portrait) {
        portrait.onerror = () => { portrait.hidden = true; };
        portrait.src = `assets/story/portrait-${speaker.portrait}.webp`;
        portrait.hidden = false;
      } else portrait.hidden = true;
      box.querySelector('.caption-speaker').textContent = speaker.label;
      box.querySelector('.caption-text').textContent = line.text;
    }

    // Major beats duck the music slightly while their lines are on screen.
    function say(ids, major = false) {
      if (story) for (const id of ids) story.queue.push({ ...lineFor(id), major });
    }

    function closeCaption() {
      if (story) {
        story.queue = [];
        story.caption = null;
      }
      captionBox.hidden = true;
    }

    // Captions age with simulation time, so pause and menus hold them.
    function updateCaptions(dt) {
      if (story.caption) {
        story.caption.left -= dt;
        if (story.caption.left > 0) return;
        story.caption = null;
        captionBox.hidden = true;
      }
      const line = story.queue.shift();
      if (!line) return;
      story.caption = { line, left: lineDuration(line), major: Boolean(line.major) };
      fillCaption(captionBox, line);
      captionBox.classList.toggle('major', Boolean(line.major));
      // Restart the entrance so each new line is noticed.
      captionBox.classList.remove('enter');
      void captionBox.offsetWidth;
      captionBox.classList.add('enter');
      captionBox.hidden = false;
      const label = STORY.SPEAKERS[line.speaker]?.label;
      announce(label ? `${label}: ${line.text}` : line.text);
    }

    function setupStory(checkpoint) {
      const data = playMode === 'campaign' && storyPlan ? STORY.STAGES[STAGES[stageIndex].id] : null;
      closeCaption();
      hudCache.clear();
      if (!data) {
        story = null;
        storyHud.hidden = true;
        interactButton.hidden = true;
        return;
      }
      story = { data, step: 0, done: new Set(), fired: new Set(), timer: null, hold: 0, cues: new Set(), warned: new Set(),
        queue: [], caption: null, near: null, announcedNear: null, exitHintAt: -Infinity, closedDoors: [] };
      if (checkpoint) {
        story.step = checkpoint.step;
        checkpoint.done.forEach(id => story.done.add(id));
        checkpoint.fired.forEach(id => story.fired.add(id));
        const at = storyPlan.anchors[checkpoint.at];
        if (at) {
          player.x = at.x;
          player.y = at.y - player.height;
          snapCamera();
        }
      }
      syncDoors();
      beginStep();
      if (!checkpoint && data.start?.scene) openScene(data.start.scene);
    }

    // A step's timer and hold progress always start fresh, including after
    // a checkpoint retry.
    function beginStep() {
      const step = story.data.steps[story.step];
      story.timer = step?.timer ? step.timer * 1000 : null;
      story.hold = 0;
      story.cues = new Set();
      story.warned = new Set();
    }

    function syncDoors() {
      story.closedDoors = storyPlan.doors.filter(door => !door.until.every(id => story.done.has(id)));
      obstacles = [...layout.solids, ...story.closedDoors.map(door => door.solid)];
    }

    function closedDoorX() {
      return story?.closedDoors.length ? Math.min(...story.closedDoors.map(door => door.solid.x)) : Infinity;
    }

    function storyExitOpen() {
      return !story || story.data.steps[story.step]?.type === 'reach';
    }

    function anchorInRange(a) {
      const feet = player.y + player.height;
      return !player.isClimbing && Math.abs(feet - a.y) < 3 && Math.abs(player.x + player.width / 2 - (a.x + 16)) < 40;
    }

    function inHoldZone(id) {
      const a = storyPlan.anchors[id];
      const zone = story.data.anchors[id].zone || 140;
      return Math.abs(player.y + player.height - a.y) < 3 && Math.abs(player.x + player.width / 2 - (a.x + 16)) < zone;
    }

    // Anchors the player can use right now: the current step's unfinished
    // ones, plus optional extras such as the jungle recorder.
    function activeAnchors() {
      const step = story.data.steps[story.step];
      const ids = step?.type === 'interact' ? step.anchors.filter(id => !story.done.has(id)) : [];
      for (const [id, a] of Object.entries(story.data.anchors)) {
        if (a.optional && !story.done.has(id) && storyPlan.anchors[id]) ids.push(id);
      }
      return ids;
    }

    function updateStory(dt, interactTap) {
      const data = story.data;
      for (const trigger of data.triggers) {
        if (story.fired.has(trigger.id)) continue;
        const chunk = layout.chunks[trigger.at.chunk];
        if (player.x + player.width / 2 >= chunk.x0 + trigger.at.f * (chunk.x1 - chunk.x0)) {
          story.fired.add(trigger.id);
          say(trigger.lines, Boolean(trigger.duck));
        }
      }
      story.near = activeAnchors().find(id => anchorInRange(storyPlan.anchors[id])) || null;
      if (story.near && story.announcedNear !== story.near) announce(`${isMobile ? 'Use' : 'Press E'}: ${data.anchors[story.near].prompt}`);
      story.announcedNear = story.near;
      if (interactTap && story.near) {
        interact(story.near);
        if (gameState !== 'play') return;
      }
      const step = data.steps[story.step];
      if (step?.type === 'hold') {
        if (inHoldZone(step.anchor)) story.hold += dt;
        const progress = story.hold / (step.seconds * 1000);
        for (const cue of step.cues || []) {
          if (progress >= cue.at && !story.cues.has(cue.at)) {
            story.cues.add(cue.at);
            say(cue.lines, Boolean(cue.duck));
          }
        }
        if (progress >= 1) completeStep(step.anchor);
      } else if (story.timer !== null) {
        story.timer -= dt;
        const left = Math.ceil(story.timer / 1000);
        for (const mark of [30, 10]) {
          if (left <= mark && !story.warned.has(mark)) {
            story.warned.add(mark);
            announce(`${mark} seconds left.`);
          }
        }
        if (story.timer <= 0) {
          endReason = step.fail;
          showEnd('dead');
          return;
        }
      }
      if (gameState === 'play') updateCaptions(dt);
    }

    function interact(id) {
      story.done.add(id);
      playLegacyEffect(selectSfx);
      const step = story.data.steps[story.step];
      if (story.data.anchors[id].optional) {
        say(story.data.interactions?.[id]?.lines || []);
        return;
      }
      if (step.anchors.every(a => story.done.has(a))) completeStep(id);
      else {
        syncDoors();
        say(step.progress?.lines || []);
      }
    }

    function completeStep(at) {
      const step = story.data.steps[story.step];
      const done = step.done || {};
      say(done.lines || [], Boolean(done.duck));
      story.step += 1;
      syncDoors();
      beginStep();
      const save = () => { if (step.checkpoint) saveCheckpoint(at); };
      // A scene's checkpoint is saved once it closes, so leaving mid-scene
      // replays it.
      if (done.scene) openScene(done.scene, save);
      else save();
    }

    function saveCheckpoint(at) {
      if (playMode !== 'campaign' || !sessionEntry) return;
      const required = [...story.done].filter(id => !story.data.anchors[id].optional);
      sessionEntry.checkpoint = { step: story.step, at, done: required, fired: [...story.fired], loadout: captureLoadout(), elapsed: elapsedTime };
      campaign.entry = sessionEntry;
      saveCampaign(campaign);
    }

    // An exit that isn't open yet holds the player back and says why.
    function blockExit() {
      player.x = Math.min(player.x, worldWidth - EXIT_WIDTH - player.width - 2);
      player.vx = Math.min(0, player.vx);
      if (elapsedTime - story.exitHintAt > 4500) {
        story.exitHintAt = elapsedTime;
        story.queue.unshift({ speaker: 'narration', text: story.data.exitLocked });
      }
    }

    // Objective panel, captions and the contextual Interact button.
    function syncStoryHud() {
      const show = Boolean(story) && gameState === 'play';
      setCached('show', show, v => { storyHud.hidden = !v; });
      setCached('motion', effectsReduced(), v => { storyHud.classList.toggle('reduce-motion', v); });
      const prompt = show && story.near ? story.data.anchors[story.near].prompt : '';
      setCached('interact', prompt, v => {
        interactButton.hidden = !v;
        interactButton.setAttribute('aria-label', v ? `Interact: ${v}` : 'Interact');
      });
      if (!show) { screenBandPx = CAMERA.hudPx; return; }
      // When the objective panel covers the top of the playfield (it sits
      // above it in portrait), the camera keeps the player's head below it.
      const canvasBox = canvas.getBoundingClientRect();
      const panelBox = objectivePanel.getBoundingClientRect();
      const panelBottom = (panelBox.bottom - canvasBox.top) * height / canvasBox.height;
      screenBandPx = panelBox.top >= canvasBox.top && panelBottom > CAMERA.hudPx ? Math.min(height * 0.4, panelBottom) : CAMERA.hudPx;
      const step = story.data.steps[story.step];
      setCached('objective', step?.text || '', v => { objectiveText.textContent = v; });
      const parts = [];
      let urgent = false;
      if (story.timer !== null) {
        const sec = Math.max(0, Math.ceil(story.timer / 1000));
        parts.push(`${step.meter || 'Time'} ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
        urgent = sec <= 10;
      }
      let progress = null;
      if (step?.type === 'hold') {
        progress = Math.min(1, story.hold / (step.seconds * 1000));
        parts.push(`${step.meter || 'Progress'} ${Math.floor(progress * 100)}%${inHoldZone(step.anchor) ? '' : ' · stay in range'}`);
      } else if (step?.type === 'interact' && step.anchors.length > 1) {
        parts.push(`${step.anchors.filter(id => story.done.has(id)).length} of ${step.anchors.length}`);
      }
      if (prompt) parts.push(`${isMobile ? 'Use' : 'E'} · ${prompt}`);
      setCached('meta', parts.join(' · '), v => { objectiveMeta.textContent = v; });
      setCached('urgent', urgent, v => { objectivePanel.dataset.urgent = String(v); });
      setCached('bar', progress === null ? -1 : Math.round(progress * 100), v => {
        objectiveBar.hidden = v < 0;
        objectiveBar.firstElementChild.style.width = `${Math.max(0, v)}%`;
      });
    }

    // Still-image scenes pause the simulation. Next advances, Skip (or
    // Escape) closes and replays the scene's essential lines as captions.
    function openScene(id, onDone = null) {
      const data = STORY.SCENES[id];
      musicEntry.scene++;
      resetGameplayInput();
      const beats = data.frames.flatMap((frame, f) => frame.lines.map(line => ({ frame: f, line })));
      scene = { id, data, beats, index: -1, left: 0, onDone, returnFocus: document.activeElement };
      gameState = 'scene';
      sceneTitle.textContent = data.title;
      sceneLayer.hidden = false;
      gameContainer.inert = true;
      menuLayer.inert = true;
      showBeat(0);
      syncMenu();
      sceneNext.focus({ preventScroll: true });
    }

    // Missing story art falls back to an existing environment image.
    function setSceneArt(frame) {
      if (sceneArt.dataset.frame === frame.art) return;
      sceneArt.dataset.frame = frame.art;
      sceneArt.hidden = false;
      sceneArt.onerror = () => {
        if (sceneArt.dataset.frame !== frame.art) return;
        if (frame.fallback && !sceneArt.src.endsWith(frame.fallback)) sceneArt.src = frame.fallback;
        else sceneArt.hidden = true;
      };
      sceneArt.src = frame.art;
    }

    function showBeat(index) {
      scene.index = index;
      const beat = scene.beats[index];
      setSceneArt(scene.data.frames[beat.frame]);
      const line = lineFor(beat.line);
      fillCaption(sceneCaption, line);
      scene.left = lineDuration(line) + 900;
      sceneNext.textContent = index === scene.beats.length - 1 ? 'Continue' : 'Next';
    }

    function advanceScene() {
      if (!scene) return;
      if (scene.index + 1 < scene.beats.length) showBeat(scene.index + 1);
      else closeScene(false);
    }

    function closeSceneView() {
      const closed = scene;
      scene = null;
      sceneLayer.hidden = true;
      gameContainer.inert = false;
      menuLayer.inert = false;
      return closed;
    }

    function closeScene(skipped) {
      if (!scene) return;
      const closed = closeSceneView();
      gameState = 'play';
      resetGameplayInput();
      if (skipped) say(closed.data.essential || [], true);
      const back = closed.returnFocus;
      if (back?.isConnected && back !== document.body && !sceneLayer.contains(back)) back.focus({ preventScroll: true });
      else if (sceneLayer.contains(document.activeElement)) document.activeElement.blur();
      syncMenu();
      closed.onDone?.();
    }

    sceneNext.addEventListener('click', advanceScene);
    sceneSkip.addEventListener('click', () => closeScene(true));
    // Keep keyboard focus inside the open scene.
    document.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || !scene) return;
      e.preventDefault();
      const items = [sceneNext, sceneSkip];
      const i = items.indexOf(document.activeElement);
      items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    });

    function drawStory(view) {
      if (!story) return;
      const reduced = effectsReduced();
      const now = performance.now();
      for (const door of story.closedDoors) {
        const s = door.solid;
        if (!onScreen(view, s.x, s.y, s.width, s.height)) continue;
        ctx.fillStyle = '#18212d';
        ctx.fillRect(s.x, s.y, s.width, s.height);
        ctx.fillStyle = 'rgba(244,195,123,0.55)';
        for (let y = s.y + 10; y < s.y + s.height; y += 30) ctx.fillRect(s.x + 2, y, s.width - 4, 6);
        ctx.fillStyle = '#ff9f86';
        for (const deck of DECK_Y) ctx.fillRect(s.x + s.width / 2 - 2, deck - 52, 4, 4);
      }
      const step = story.data.steps[story.step];
      const active = new Set(activeAnchors());
      const holding = step?.type === 'hold' ? step.anchor : null;
      if (holding) {
        const a = storyPlan.anchors[holding];
        const zone = story.data.anchors[holding].zone || 140;
        const progress = Math.min(1, story.hold / (step.seconds * 1000));
        ctx.fillStyle = 'rgba(138,221,223,0.16)';
        ctx.fillRect(a.x + 16 - zone, a.y - 4, zone * 2, 4);
        ctx.fillStyle = 'rgba(138,221,223,0.75)';
        ctx.fillRect(a.x + 16 - zone, a.y - 4, zone * 2 * progress, 4);
      }
      for (const [id, a] of Object.entries(storyPlan.anchors)) {
        if (!onScreen(view, a.x - 20, a.y - 100, 72, 100)) continue;
        const def = story.data.anchors[id];
        const live = active.has(id) || holding === id;
        const color = live ? '#f4c37b' : (story.done.has(id) ? '#8fd486' : '#6f8197');
        if (def.kind === 'remains') {
          ctx.fillStyle = '#3a4350';
          ctx.fillRect(a.x + 2, a.y - 7, 28, 7);
          ctx.fillStyle = '#56606d';
          ctx.fillRect(a.x + 24, a.y - 10, 8, 8);
          ctx.fillStyle = color;
          ctx.fillRect(a.x + 8, a.y - 9, 4, 3);
        } else {
          const wide = def.kind === 'archive';
          if (def.kind === 'switch') {
            ctx.fillStyle = '#3b4a55';
            ctx.fillRect(a.x + 15, a.y - 96, 3, 70);
            const blink = reduced || Math.floor(now / 520) % 2 === 0;
            ctx.fillStyle = blink ? '#ff6b5e' : '#5a2b28';
            ctx.fillRect(a.x + 13, a.y - 100, 7, 5);
          }
          ctx.fillStyle = wide ? '#5b4a33' : '#243243';
          ctx.fillRect(a.x + (wide ? -4 : 6), a.y - (wide ? 20 : 28), wide ? 40 : 20, wide ? 20 : 28);
          ctx.fillStyle = color;
          ctx.fillRect(a.x + (wide ? 4 : 9), a.y - (wide ? 16 : 25), wide ? 24 : 14, wide ? 4 : 9);
        }
        if (live && !story.done.has(id)) {
          const bob = reduced ? 0 : Math.sin(now / 240) * 2;
          const cx = a.x + 16;
          const top = a.y - 46 + bob;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(cx - 5, top);
          ctx.lineTo(cx + 5, top);
          ctx.lineTo(cx, top + 6);
          ctx.closePath();
          ctx.fill();
          if (story.near === id) {
            ctx.font = '700 8px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffe3b8';
            ctx.fillText(isMobile ? 'USE' : 'E', cx, top - 4);
            ctx.textAlign = 'left';
          }
        }
      }
    }

    // The nav region (structural walkable surface) under a body, projecting
    // down through cover or air to the highest region below.
    function regionAt(body) {
      const centre = body.x + body.width / 2;
      const feet = body.y + body.height;
      let best = null;
      for (const r of layout.regions) {
        if (r.x0 > centre || r.x1 < centre || r.y < feet - 0.6) continue;
        if (!best || r.y < best.y) best = r;
      }
      return best;
    }

    // The first nav edge on a route from one region to another.
    function nextNavEdge(from, to, ladders = true) {
      if (!from || !to || from === to) return null;
      const first = new Map([[from.id, null]]);
      const queue = [from.id];
      while (queue.length) {
        const node = queue.shift();
        if (node === to.id) return first.get(node);
        for (const edge of layout.navEdges[node]) {
          if (first.has(edge.to) || (!ladders && edge.kind === 'ladder')) continue;
          first.set(edge.to, first.get(node) || edge);
          queue.push(edge.to);
        }
      }
      return null;
    }

    function routeExists(from, to, ladders = true) {
      return Boolean(from && to && (from === to || nextNavEdge(from, to, ladders)));
    }

    // Lowest solid underside above a point (the ceiling of the room it is in).
    function ceilingAbove(x, y) {
      let ceiling = 0;
      for (const ob of obstacles) {
        if (ob.role === 'cover' || x < ob.x || x > ob.x + ob.width) continue;
        const bottom = ob.y + ob.height;
        if (bottom <= y && bottom > ceiling) ceiling = bottom;
      }
      return ceiling;
    }

    // Player stats and physics
    const player = {
      x: 100,
      y: groundY - 32,
      vx: 0,
      vy: 0,
      width: 32,
      height: 32,
      onGround: false,
      health: 100,
      gold: 0,
      weapon: 'pistol',
      ammoInClip: { pistol: WEAPONS.pistol.magazine, rifle: 0, shotgun: 0, laser: 0 },
      reserveAmmo: { pistol: WEAPONS.pistol.magazine * 2, rifle: 0, shotgun: 0, laser: 0 },
      reloading: false,
      reloadTimer: 0,
      reloadWeaponKey: null,
      shootCooldown: 0,
      recoilTimer: 0,
      recoilUp: false,
      recoilFacing: 1,
      facing: 1,
      animTime: 0
      ,
      // The ladder being climbed, if any. isClimbing is true while the
      // player is on it; gravity and collisions are suppressed only within
      // that ladder's span.
      ladder: null,
      isClimbing: false
      ,
      /**
       * Track whether the player is currently ducking.  When ducking the
       * player's height is reduced so they can hide behind low cover.
       * baseHeight stores the normal standing height so it can be
       * restored when the player stands back up.
       */
      isDucking: false,
      baseHeight: 32,
      // Owned weapons persist for the current run and prevent re-buying.
      ownedWeapons: { pistol: true, rifle: false, shotgun: false, laser: false },
      // Brief invulnerability window after taking damage.
      invulnTimer: 0,
      // Flash timer used for visible hit feedback.
      hitFlashTimer: 0
    };

    // Initial environment creation.  This call populates the obstacles
    // and ladders arrays with randomised platforms and cover.  Without
    // this call the world would be empty at the first launch.
    runSeed = Number.isFinite(urlSeed) ? urlSeed >>> 0 : (Math.random() * 2 ** 32) >>> 0;
    levelSeed = stageSeed('station', runSeed);
    generateEnvironment();
    snapCamera();

    /**
     * Reset all entities and player stats to their initial values. Called
     * when restarting after game over.
     */
    // A fresh campaign attempt from the station (unlocks are kept).
    function restart() {
      startStage('campaign', 'station', freshSeed('station'), defaultLoadout());
    }

    // Clear everything a stage attempt touches; startStage applies the loadout.
    function resetRunState() {
      elapsedTime = 0;
      fallenSprites = [];
      lastLanding = -Infinity;
      playerDownAt = 0;
      playerShot = null;
      bullets = [];
      enemyBullets = [];
      enemies = [];
      pickups = [];
      floatingTexts = [];
      shotFlashes = [];
      particles = [];
      beams = [];
      slashes = [];
      screenShakeTimer = 0;
      screenShakeStrength = 0;
      cameraShakeX = 0;
      cameraShakeY = 0;
      damageOverlayTimer = 0;
      spawnCooldown = 900;
      openingEnemyPending = true;
      gameState = 'play';
      runComplete = false;
      endKind = null;
      endReason = '';
      leaving = false;
      story = null;
      storyPlan = null;
      if (scene) closeSceneView();
      stageBanner = null;
      player.x = 100;
      player.height = player.baseHeight;
      player.y = groundY - player.height;
      player.vx = 0;
      player.vy = 0;
      player.onGround = true;
      player.health = 100;
      player.gold = 0;
      player.weapon = 'pistol';
      player.ammoInClip = { pistol: WEAPONS.pistol.magazine, rifle: 0, shotgun: 0, laser: 0 };
      player.reserveAmmo = { pistol: WEAPONS.pistol.magazine * 2, rifle: 0, shotgun: 0, laser: 0 };
      player.ownedWeapons = { pistol: true, rifle: false, shotgun: false, laser: false };
      player.reloading = false;
      player.reloadTimer = 0;
      player.reloadWeaponKey = null;
      player.shootCooldown = 0;
      player.recoilTimer = 0;
      player.facing = 1;
      player.animTime = 0;
      player.ladder = null;
      player.isClimbing = false;
      player.isDucking = false;
      player.invulnTimer = 0;
      player.hitFlashTimer = 0;
      resetGameplayInput();
      menuSelection = 0;
      mainMenuSelection = 0;
    }

    /**
     * Spawn a new enemy outside the frame. The type is selected
     * according to weights. Each enemy has its own speed, health and
     * attack behaviour. Returns false when no fair position exists so the
     * caller can retry shortly instead.
     */
    function spawnEnemy() {
      // Choose enemy type from a smooth, time-based distribution so difficulty
      // ramps up steadily instead of jumping between hard thresholds.
      const minutes = elapsedTime / 60000;
      const progress = Math.min(1, minutes / 3);
      const typeWeights = {
        zombie: 0.45 - progress * 0.23,
        ghost: 0.27 - progress * 0.12,
        robot: 0.17 + progress * 0.18,
        alien: 0.11 + progress * 0.17
      };
      const teach = openingEnemyPending && elapsedTime < 4000 && player.x < 464;
      // CyberCity and Jungle Planet field their own pair once its art has
      // loaded; the ramp shifts from the melee to the ranged member like the
      // original roster. Station and Desert Temple Ruins keep the original four.
      const stageId = STAGES[stageIndex].id;
      const local = Object.keys(EXPANSION).filter(t => EXPANSION[t].stages.includes(stageId) && expansionArt[t]);
      const melee = local.find(t => ['dash', 'pounce'].includes(EXPANSION[t].kind));
      const shooter = local.find(t => ['projectile', 'laser'].includes(EXPANSION[t].kind));
      // Guests (the returning elf rangers at the ruins) join that stage's
      // original roster with a small weight that grows with the ramp.
      const guests = Object.keys(EXPANSION).filter(t => EXPANSION[t].guestStages?.includes(stageId) && expansionArt[t])
        .map(t => ({ item: t, weight: EXPANSION[t].guestWeight[0] + progress * EXPANSION[t].guestWeight[1] }));
      const type = teach ? 'zombie' : (melee && shooter ? weightedChoice([
        { item: melee, weight: 0.6 - progress * 0.2 },
        { item: shooter, weight: 0.4 + progress * 0.2 }
      ]) : weightedChoice([
        { item: 'zombie', weight: typeWeights.zombie },
        { item: 'ghost', weight: typeWeights.ghost },
        { item: 'robot', weight: typeWeights.robot },
        { item: 'alien', weight: typeWeights.alien },
        ...guests
      ])) || 'zombie';
      const spawnDir = Math.random() < 0.65 ? 1 : -1;
      // Distances keep the gap beyond the view edge the zoom-1.40 camera had,
      // so enemies arrive on screen as quickly at any zoom.
      const spawnOffset = viewWidth * (1 - CAMERA.anchor) + 590 + Math.random() * 280;
      const spawnX = teach ? Math.max(camera.x + viewWidth + 110, player.x + 240) : player.x + spawnDir * spawnOffset;
      const e = {
        type: type,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        width: 32,
        height: 32,
        health: 2,
        maxHealth: 2,
        animTime: 0,
        // Time remaining for red flash when taking damage (ms). Set
        // when the enemy is hit and decremented each update.
        hitTimer: 0,
        // When an enemy fires it briefly enters an attack state.  This
        // timer counts down and is used to select attack frames in
        // drawGame().  For melee enemies this is set when they hit
        // the player.
        attackTimer: 0,
        shootTimer: 0,
        windupTimer: 0,
        queuedShot: false,
        targetDir: -1,
        spawnGrace: FIRST_ATTACK_GRACE,
        contactDamageTimer: 0,
        preferredRange: 120,
        baseY: 0,
        // Ladder navigation: the ladder being climbed and its direction.
        ladder: null,
        climbDir: 0,
        navEdge: null,
        offRouteTimer: 0,
        phase: Math.random() * Math.PI * 2,
        // Horizontal direction: -1 moves left, 1 moves right.  All
        // enemies spawn moving towards the player from the right.  This
        // value may be flipped at random intervals to make enemies roam.
        dir: -1,
        // Timer controlling when the enemy will randomly change
        // direction.  A random initial value is used so enemies do not
        // synchronise their turns.
        changeDirTimer: 1200 + Math.random() * 1600,
        pathRecalcTimer: 0,
        animVariance: 0.85 + Math.random() * 0.35
      };
      // Track whether the enemy is on the ground/platform.  Only used for
      // non‑floating enemies; ghosts float so this flag is ignored.
      e.onGround = false;
      if (type === 'zombie') {
        e.y = groundY - e.height;
        e.health = 3;
        e.maxHealth = 3;
        e.speed = 1.05 + Math.random() * 0.28;
        e.preferredRange = 28;
      } else if (type === 'ghost') {
        // Ghosts float above the ground and bob while weaving around the player.
        e.baseY = groundY - e.height - 90 - Math.random() * 140;
        e.y = e.baseY;
        e.health = 2;
        e.maxHealth = 2;
        e.speed = 0.95 + Math.random() * 0.2;
        e.preferredRange = 38;
        e.changeDirTimer = 900 + Math.random() * 900;
      } else if (type === 'robot') {
        e.y = groundY - e.height;
        e.health = 4;
        e.maxHealth = 4;
        e.speed = 0.85;
        e.preferredRange = 240;
        e.shootTimer = 1200 + Math.random() * 700;
      } else if (type === 'alien') {
        e.y = groundY - e.height;
        e.health = 3;
        e.maxHealth = 3;
        e.speed = 1.2;
        e.preferredRange = 190;
        e.shootTimer = 1000 + Math.random() * 700;
      } else if (EXPANSION[type]) {
        const def = EXPANSION[type];
        [e.width, e.height] = def.body;
        e.y = groundY - e.height;
        e.health = def.health;
        e.maxHealth = def.health;
        e.speed = def.speed * (0.92 + Math.random() * 0.16);
        e.preferredRange = def.preferredRange;
        // shootTimer is the special's cooldown for these enemies.
        e.shootTimer = def.firstDelay[0] + Math.random() * def.firstDelay[1];
        e.special = null;
      }
      // Modify enemy health based on difficulty settings.  On easy
      // difficulty reduce hit points by one (minimum 1).  On hard
      // difficulty increase hit points by one.  Normal leaves the
      // values unchanged.
      if (SETTINGS.difficulty === 'easy') {
        e.health = Math.max(1, e.health - 1);
        e.maxHealth = Math.max(1, e.maxHealth - 1);
      } else if (SETTINGS.difficulty === 'hard') {
        e.health += 1;
        e.maxHealth += 1;
      }
      // The frame covers the unshaken view and where the camera is heading,
      // on both axes, so an enemy cannot appear inside a view that is still
      // panning or on a deck the camera is moving to.
      const targetX = cameraTargetX();
      const targetY = cameraTargetY();
      const frame = {
        x0: Math.min(camera.x, targetX) - 40, x1: Math.max(camera.x, targetX) + viewWidth + 40,
        y0: Math.min(camera.y, targetY) - 24, y1: Math.max(camera.y, targetY) + viewHeight + 24
      };
      const clearance = 16;
      const fair = (x, y) => {
        if (x + e.width > frame.x0 && x < frame.x1 && y + e.height > frame.y0 && y < frame.y1) return false;
        if (Math.abs(x - player.x) < 196) return false;
        const zone = { x: x - clearance, y, width: e.width + clearance * 2, height: e.height };
        return !obstacles.some(obstacle => rectIntersect(zone, obstacle)) &&
          !enemies.some(enemy => rectIntersect(zone, enemy));
      };
      const place = (x, y) => {
        e.x = x;
        e.y = y;
        e.baseY = y;
        e.dir = x < player.x ? 1 : -1;
        e.onGround = type !== 'ghost';
        enemies.push(e);
        openingEnemyPending = false;
        return true;
      };
      if (teach) {
        // The introductory zombie walks in along the opening corridor.
        const y = groundY - e.height;
        for (let offset = 0; offset <= 256; offset += 32) {
          const x = Math.min(worldWidth - e.width - 32, spawnX + offset);
          if (fair(x, y)) return place(x, y);
        }
        return false;
      }
      // Later enemies use the station's encounter points. Walkers need a
      // ladder or drop route to the player's deck; ghosts fly but stay in
      // the room's clear height.
      const playerRegion = regionAt(player);
      let best = null;
      const barrier = closedDoorX();
      for (const point of layout.encounters) {
        const dx = point.x - player.x;
        if (Math.abs(dx) > 1400 || point.x + e.width > barrier) continue;
        let y = point.y - e.height;
        if (type === 'ghost') {
          const low = point.y - e.height - 12;
          const high = ceilingAbove(point.x + e.width / 2, point.y) + 26;
          y = Math.max(Math.min(high, low), Math.min(low, point.y - e.height - 90 - Math.random() * 140));
        } else {
          const region = layout.regions[point.region];
          // Wide bodies need the whole footprint on the surface; non-climbers
          // need a route without ladders.
          if (point.x < region.x0 + 4 || point.x + e.width > region.x1 - 4) continue;
          // Large bodies need a long enough run to be seen and dodged.
          if (EXPANSION[type]?.minRun && region.x1 - region.x0 < EXPANSION[type].minRun) continue;
          if (!routeExists(region, playerRegion, EXPANSION[type]?.climbs ?? true)) continue;
        }
        if (!fair(point.x, y)) continue;
        const score = Math.abs(dx - spawnDir * spawnOffset) + Math.abs(point.y - player.y) * 0.5 + Math.random() * 60;
        if (!best || score < best.score) best = { x: point.x, y, score };
      }
      return best ? place(best.x, best.y) : false;
    }

    /**
     * Spawn gold and ammo pickups at an enemy's location. Always drops
     * gold and randomly drops an ammo crate for a random weapon type.
     */
    // Drops fall from the enemy and settle 8 units above an accessible floor
    // or catwalk (never on cover), the way they rested on the old deck.
    function dropPickup(enemy, pickup) {
      const startY = enemy.y + enemy.height - 20;
      const centre = pickup.x + pickup.width / 2;
      let best = null;
      for (const surface of layout.dropSurfaces) {
        if (surface.y < startY + 19.5) continue;
        const reachX = Math.max(0, surface.x0 + 6 - centre, centre - (surface.x1 - 6));
        // Prefer the first surface directly below, then the nearest one.
        const score = reachX ? 10000 + reachX + (surface.y - startY) * 0.1 : surface.y;
        if (!best || score < best.score) best = { surface, score };
      }
      if (!best) {
        for (const surface of layout.dropSurfaces) {
          const reachX = Math.max(0, surface.x0 - centre, centre - surface.x1) + Math.abs(surface.y - startY);
          if (!best || reachX < best.score) best = { surface, score: reachX };
        }
      }
      const surface = best.surface;
      pickup.x = clamp(pickup.x, surface.x0, surface.x1 - pickup.width);
      pickup.restY = surface.y - 20;
      pickup.y = Math.min(startY, pickup.restY);
      pickup.vy = 0;
      pickups.push(pickup);
    }

    function spawnPickups(enemy) {
      const goldByType = { zombie: [4, 7], ghost: [6, 10], robot: [5, 8], alien: [5, 9] };
      // Expansion enemies use an existing family's drops, keeping the economy.
      const family = EXPANSION[enemy.type]?.economy || enemy.type;
      const [goldMin, goldMax] = goldByType[family] || [4, 7];
      const goldCount = goldMin + Math.floor(Math.random() * (goldMax - goldMin + 1));
      dropPickup(enemy, { x: enemy.x, width:12, height:12, type:'gold', value: goldCount });

      const ammoDropChance = {
        easy:   { zombie: 0.7, ghost: 0.0, robot: 0.8, alien: 0.75 },
        normal: { zombie: 0.62, ghost: 0.0, robot: 0.72, alien: 0.66 },
        hard:   { zombie: 0.54, ghost: 0.0, robot: 0.64, alien: 0.58 }
      };
      const difficultyTable = ammoDropChance[SETTINGS.difficulty] || ammoDropChance.normal;
      if (Math.random() < (difficultyTable[family] ?? 0.6)) {
        const table = ENEMY_DROP_TABLES[family];
        const key = weightedChoice(table);
        if (key && WEAPONS[key]) {
          dropPickup(enemy, { x: enemy.x + 16, width:12, height:12, type:'ammo', ammoType:key, value: WEAPONS[key].ammoDrop });
        }
      }

      const healthDropChance = SETTINGS.difficulty === 'easy' ? 0.22 : (SETTINGS.difficulty === 'hard' ? 0.1 : 0.16);
      if (Math.random() < healthDropChance) {
        dropPickup(enemy, { x: enemy.x + 8, width:12, height:12, type:'health', value: 5 });
      }
    }

    /**
     * Spawn a burst of particles at the given enemy's position. Each enemy
     * type has its own colour. The number of particles and their initial
     * velocities are randomised. Particles fade and fall under gravity.
     */
    function spawnParticles(enemy) {
      // Skip spawning particles when disabled in settings
      if (!SETTINGS.particles) return;
      const colours = {
        zombie: '#55aa55',
        ghost:  '#a6c0ff',
        robot:  '#b7c7dc',
        alien:  '#72ff88'
      };
      const col = colours[enemy.type] || '#ffaa55';
      const count = 11 + Math.floor(Math.random() * 7);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 3.4;
        const life = 300 + Math.random() * 260;
        particles.push({
          x: enemy.x + enemy.width / 2,
          y: enemy.y + enemy.height / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.7,
          drag: 0.972,
          gravity: 0.068,
          life,
          maxLife: life,
          color: col,
          kind: 'death',
          size: 1.8 + Math.random() * 2.2,
          glow: 0.45 + Math.random() * 0.35
        });
      }
    }

    function spawnHitSparks(x, y, weapon) {
      if (!SETTINGS.particles) return;
      const tint = { laser: '#9dfdff', shotgun: '#ffd8a0', police: '#6fc8ff', elf: '#c58bff', thug: '#ffb36b' }[weapon] || '#fff59a';
      const count = weapon === 'shotgun' ? 8 : 5;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * (weapon === 'shotgun' ? 3.8 : 2.6);
        const life = 120 + Math.random() * 90;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.35,
          drag: 0.94,
          gravity: 0.055,
          life,
          maxLife: life,
          color: tint,
          kind: 'spark',
          size: 1.4 + Math.random() * 1.4,
          glow: 0.35
        });
      }
    }

    function spawnMuzzleParticles(x, y, dirX, dirY, kind) {
      if (!SETTINGS.particles) return;
      const count = kind === 'shotgun' ? 10 : (kind === 'laser' ? 7 : 5);
      const color = kind === 'laser' ? '#8cf6ff' : '#ffdca8';
      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * (kind === 'shotgun' ? 1.1 : 0.55);
        const speed = 1 + Math.random() * (kind === 'shotgun' ? 4 : 2.6);
        const vx = dirX * speed + spread;
        const vy = dirY * speed + spread * 0.45 - 0.25;
        const life = 80 + Math.random() * 60;
        particles.push({
          x,
          y,
          vx,
          vy,
          drag: 0.92,
          gravity: 0.035,
          life,
          maxLife: life,
          color,
          kind: 'muzzle',
          size: 1.1 + Math.random() * 1.4,
          glow: 0.42
        });
      }
    }

    function spawnPickupSparkle(pickup) {
      if (!SETTINGS.particles) return;
      const col = pickup.type === 'gold' ? '#ffe589' : (pickup.type === 'health' ? '#9bff9f' : '#8ddfff');
      const life = 220 + Math.random() * 160;
      particles.push({
        x: pickup.x + pickup.width * 0.5,
        y: pickup.y + pickup.height * 0.45,
        vx: (Math.random() - 0.5) * 0.55,
        vy: -0.15 - Math.random() * 0.35,
        drag: 0.965,
        gravity: -0.002,
        life,
        maxLife: life,
        color: col,
        kind: 'pickup',
        size: 0.9 + Math.random() * 1.2,
        glow: 0.3
      });
    }

    /**
     * Axis‑aligned bounding box collision detection.
     */
    function rectIntersect(a,b) {
      return (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y);
    }

    function addFloatingText(x, y, text, color) {
      floatingTexts.push({ x, y, text, color: color || '#ffffff', life: 700, maxLife: 700, vy: -0.35 });
    }

    function addShotFlash(x, y, dirX, dirY, kind) {
      shotFlashes.push({
        x, y, dirX, dirY,
        kind: kind || 'default',
        life: kind === 'shotgun' ? 90 : (kind === 'laser' ? 75 : 60),
        maxLife: kind === 'shotgun' ? 90 : (kind === 'laser' ? 75 : 60)
      });
    }

    // Apply damage to the player while respecting invulnerability frames.
    function damagePlayer(amount) {
      if (player.invulnTimer > 0) return false;
      player.health -= amount;
      player.invulnTimer = 520;
      player.hitFlashTimer = 180;
      damageOverlayTimer = 120;
      screenShakeTimer = Math.max(screenShakeTimer, 130);
      screenShakeStrength = Math.max(screenShakeStrength, 5);
      if (player.health <= 0) showEnd('dead');
      playLegacyEffect(playerDamageSfx);
      return true;
    }

    // Sweep the projectile center against a rectangle expanded by its
    // half extents. Return the first fraction of the step in contact.
    function projectileEntry(x, y, dx, dy, bullet, target) {
      const left = target.x - bullet.width / 2;
      const top = target.y - bullet.height / 2;
      const right = target.x + target.width + bullet.width / 2;
      const bottom = target.y + target.height + bullet.height / 2;
      if ((!dx && (x < left || x > right)) || (!dy && (y < top || y > bottom))) {
        return Infinity;
      }
      const tx = dx > 0 ? (left - x) / dx : (right - x) / dx;
      const ty = dy > 0 ? (top - y) / dy : (bottom - y) / dy;
      const exitX = dx > 0 ? (right - x) / dx : (left - x) / dx;
      const exitY = dy > 0 ? (bottom - y) / dy : (top - y) / dy;
      const entry = Math.max(0, dx ? tx : -Infinity, dy ? ty : -Infinity);
      const exit = Math.min(1, dx ? exitX : Infinity, dy ? exitY : Infinity);
      return entry <= exit && exit > 0 ? entry : Infinity;
    }

    function projectileHit(bullet, x, y, dx, dy, targets) {
      let time = Infinity;
      let target = null;
      for (const group of [obstacles, targets]) {
        for (const candidate of group) {
          const contact = projectileEntry(x, y, dx, dy, bullet, candidate);
          if (contact < time) {
            time = contact;
            target = candidate;
          }
        }
      }
      return target ? { target, x: x + dx * time, y: y + dy * time } : null;
    }

    function advanceProjectiles(projectiles, targets, onHit) {
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const b = projectiles[i];
        const x = b.x + b.width / 2;
        const y = b.y + b.height / 2;
        let hit = null;
        // Check the path to the muzzle on the first tick so the barrel
        // cannot put a projectile on the far side of a thin blocker.
        if (b.origin) {
          const origin = b.origin;
          hit = projectileHit(b, origin.x, origin.y, x - origin.x, y - origin.y, targets);
          b.origin = null;
        }
        if (!hit) hit = projectileHit(b, x, y, b.vx, b.vy, targets);
        if (hit) {
          projectiles.splice(i, 1);
          onHit(b, hit);
          if (gameState !== 'play') return;
          continue;
        }
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < 0 || b.x > worldWidth || b.y < -50 || b.y > worldHeight + 50) {
          projectiles.splice(i, 1);
        }
      }
    }

    function playerMuzzle(up, frame, kick) {
      const center = player.x + player.width / 2;
      const offset = frameMuzzle(frame, player.facing, kick);
      if (offset) {
        return { x: center + offset.x, y: player.y + player.height + offset.y };
      }
      // Aim-specific positions for the legacy atlas and poses without a weapon.
      return {
        x: center + (up ? 0 : 7 * player.facing),
        y: player.y + (up ? 0 : Math.max(2, 14.5 - (player.baseHeight - player.height)))
      };
    }

    function fireRound(key, weapon, up) {
      player.ammoInClip[key]--;
      player.recoilTimer = SHOT_FEEDBACK[key].duration;
      player.recoilUp = up;
      player.recoilFacing = player.facing;
      playerShot = { key, at: elapsedTime, up, facing: player.facing };
      const { frame, kick } = playerSprite();
      const muzzle = playerMuzzle(up, frame, kick);
      const dirX = up ? 0 : player.facing;
      const dirY = up ? -1 : 0;
      const origin = { x: player.x + player.width / 2, y: player.y + player.height / 2 };
      const pellets = weapon.pellets || 1;
      const size = key === 'shotgun' ? 3 : (key === 'laser' ? 4 : 2);
      for (let pellet = 0; pellet < pellets; pellet++) {
        const angle = pellets > 1 ? (2 * pellet / (pellets - 1) - 1) * weapon.spread : 0;
        bullets.push({
          x: muzzle.x - size / 2, y: muzzle.y - size / 2,
          vx: (dirX + dirY * angle) * weapon.bulletSpeed,
          vy: (dirY - dirX * angle) * weapon.bulletSpeed,
          width: size, height: size, damage: weapon.damage, weapon: key, origin,
          muzzleX: muzzle.x, muzzleY: muzzle.y
        });
      }
      const kind = key === 'shotgun' || key === 'laser' ? key : 'default';
      addShotFlash(muzzle.x, muzzle.y, dirX, dirY, kind);
      spawnMuzzleParticles(muzzle.x, muzzle.y, dirX, dirY, kind);
      addShotKick(key, dirX, dirY);
      playShot(key);
    }

    function updatePlayer(dt) {
      const key = player.weapon;
      const weapon = WEAPONS[key];
      const wasGrounded = player.onGround;
      const up = held('ArrowUp') || held('w');
      const down = held('ArrowDown') || held('s');
      const left = held('ArrowLeft') || held('a');
      const right = held('ArrowRight') || held('d');
      const shootTap = pressedKeys.has('z');
      const trigger = shootTap || (weapon.auto && held('z'));
      const aimingUp = up && (shootTap || held('z'));

      if (pressedKeys.has('Space')) jumpBuffer = MOVEMENT.jumpBufferMs;
      if (wasGrounded) coyoteTime = MOVEMENT.coyoteMs;

      const bottom = player.y + player.height;
      const touching = lad => player.x + player.width > lad.x && player.x < lad.x + lad.width;
      // Up+Fire aims upward and Down+Fire crouch-fires, so neither climbs.
      const wantsUp = up && !aimingUp;
      const wantsDown = down && !up && !held('z') && !shootTap;
      // Ladders have explicit endpoints: up takes a ladder that continues
      // above the feet, down one that continues below them, which is how
      // the player descends from an upper landing.
      let ladder = player.isClimbing ? player.ladder : null;
      if (!ladder && wantsUp) ladder = ladders.find(lad => touching(lad) && bottom > lad.top + 0.5 && bottom <= lad.bottom + 0.5);
      if (!ladder && wantsDown) ladder = ladders.find(lad => touching(lad) && bottom >= lad.top - 0.5 && bottom < lad.bottom - 0.5);
      const stand = { x: player.x, y: bottom - player.baseHeight, width: player.width, height: player.baseHeight };
      const canStand = !player.isDucking || !obstacles.some(obstacle => rectIntersect(stand, obstacle));
      const climbIntent = wantsUp || (down && !held('z') && !shootTap);
      // Stepping sideways off a ladder is only allowed where the body is clear
      // of solids, so the player can never let go inside a deck slab.
      const embedded = player.isClimbing && obstacles.some(obstacle => rectIntersect(player, obstacle));
      const letGo = left !== right && !embedded;
      player.isClimbing = Boolean(canStand && ladder && !letGo && (player.isClimbing || wantsUp || wantsDown));
      player.ladder = player.isClimbing ? ladder : null;
      if (player.isClimbing) {
        jumpBuffer = 0;
        coyoteTime = 0;
      }

      player.isDucking = !player.isClimbing && ((wasGrounded && down && !up) || !canStand);
      player.height = player.isDucking ? Math.floor(player.baseHeight * 0.6) : player.baseHeight;
      player.y = bottom - player.height;

      if (player.isClimbing) {
        player.vx = 0;
        player.vy = climbIntent ? (up ? -MOVEMENT.climbSpeed : MOVEMENT.climbSpeed) : 0;
      } else {
        const direction = Number(right) - Number(left);
        const speed = player.isDucking ? MOVEMENT.crouchSpeed : MOVEMENT.runSpeed;
        if (direction) player.facing = direction;
        window.SpaceStation.steer(player, direction, speed, wasGrounded, MOVEMENT);
        if (jumpBuffer > 0 && coyoteTime > 0 && canStand) {
          player.vy = -MOVEMENT.jumpSpeed;
          jumpBuffer = 0;
          coyoteTime = 0;
          playLegacyEffect(jumpSfx);
        }
        player.vy += MOVEMENT.gravity;
      }
      if (pressedKeys.has('x') && !player.reloading && player.ammoInClip[key] < weapon.magazine && player.reserveAmmo[key] > 0) {
        player.reloading = true;
        player.reloadTimer = weapon.reloadTime;
        player.reloadWeaponKey = key;
        if (SETTINGS.sfx) window.combatAudio?.play(key + 'Reload', 'reload', 0.42);
      }

      if (player.isClimbing) {
        // Within the ladder span collisions are skipped: the only solid the
        // validated climb column crosses is the landing slab at the top.
        player.onGround = false;
        const target = ladder.x + ladder.width / 2 - player.width / 2;
        player.x += clamp(target - player.x, -2, 2);
        player.y += player.vy;
        const feet = player.y + player.height;
        if (player.vy < 0 && feet <= ladder.top) {
          player.y = ladder.top - player.height;
          player.isClimbing = false;
          player.ladder = null;
          player.onGround = true;
          player.vy = 0;
        } else if (player.vy > 0 && feet >= ladder.bottom) {
          player.y = ladder.bottom - player.height;
          player.isClimbing = false;
          player.ladder = null;
          player.onGround = true;
          player.vy = 0;
        }
      } else {
        window.SpaceStation.moveBody(player, obstacles, physicsWorld);
      }

      const cooldown = player.shootCooldown - dt;
      const cooldownWasRunning = player.shootCooldown > 0;
      player.shootCooldown = Math.max(0, cooldown);
      if (player.reloading) {
        player.reloadTimer = Math.max(0, player.reloadTimer - dt);
        if (!player.reloadTimer) {
          const reloadKey = player.reloadWeaponKey;
          const needed = WEAPONS[reloadKey].magazine - player.ammoInClip[reloadKey];
          const used = Math.min(needed, player.reserveAmmo[reloadKey]);
          if (SETTINGS.sfx) window.combatAudio?.play(reloadKey + 'Ready', 'reload', 0.46);
          player.ammoInClip[reloadKey] += used;
          player.reserveAmmo[reloadKey] -= used;
          player.reloading = false;
          player.reloadWeaponKey = null;
        }
      } else if (trigger) {
        if (player.ammoInClip[key] > 0 && player.shootCooldown <= 0) {
          const cadenceCarry = weapon.auto && !shootTap && cooldownWasRunning ? cooldown : 0;
          fireRound(key, weapon, aimingUp);
          player.shootCooldown = weapon.fireRate + cadenceCarry;
        } else if (shootTap && player.ammoInClip[key] === 0) {
          if (SETTINGS.sfx) window.combatAudio?.play('dryFire', 'fire', 0.32);
          addFloatingText(player.x + player.width / 2, player.y - 6,
            player.reserveAmmo[key] ? 'RELOAD' : 'NO AMMO', '#ffd66b');
        }
      }
      jumpBuffer = Math.max(0, jumpBuffer - dt);
      coyoteTime = Math.max(0, coyoteTime - dt);
      pressedKeys.clear();
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    // Fraction of the remaining distance covered in dt for an exponential follow.
    function settle(dt, ms) {
      return 1 - Math.exp(-dt / ms);
    }

    // Critically damped approach used for turns and vertical moves so the
    // camera eases in and out instead of starting at full speed.
    function smoothDamp(value, velocity, target, ms, dt) {
      const omega = 2 / ms;
      const t = omega * dt;
      const decay = 1 / (1 + t + 0.48 * t * t + 0.235 * t * t * t);
      const change = value - target;
      const temp = (velocity + omega * change) * dt;
      return [target + (change + temp) * decay, (velocity - omega * temp) * decay];
    }

    // The highest surface under the player's feet: the ground or the
    // top of a platform or crate the player is above.
    function nextLanding() {
      const feet = player.y + player.height;
      let landing = groundY;
      for (const ob of obstacles) {
        if (ob.x < player.x + player.width && ob.x + ob.width > player.x &&
            ob.y >= feet - 1 && ob.y < landing) landing = ob.y;
      }
      return landing;
    }

    // Where the current arc comes down, assuming the player keeps their
    // horizontal speed: the first surface top the feet cross on the way down.
    // Framing this instead of the floor straight below keeps a hop over a
    // gap, or onto cover, from dipping the view toward the floor beneath.
    function predictedLanding() {
      let x = player.x, y = player.y + player.height, vy = player.vy;
      for (let t = 0; t < 120; t++) {
        vy += MOVEMENT.gravity;
        const next = y + vy;
        x = clamp(x + player.vx, 0, worldWidth - player.width);
        if (vy > 0) {
          for (const ob of obstacles) {
            if (ob.y >= y - 0.01 && ob.y <= next && x + player.width > ob.x && x < ob.x + ob.width) return ob.y;
          }
        }
        if (next >= groundY) return groundY;
        y = next;
      }
      return nextLanding();
    }

    function cameraTargetX() {
      const anchor = 0.5 - (0.5 - CAMERA.anchor) * camera.look;
      const x = player.x + player.width / 2 - viewWidth * anchor + camera.lead;
      return clamp(x, 0, worldWidth - viewWidth);
    }

    // Vertical dead zone. The view rests on the deck and only rises when
    // the player's head would enter the headroom band, while keeping the
    // feet and the surface below them in frame.
    function cameraTargetY() {
      // While rising, frame the predicted apex so the camera starts moving at take-off.
      const rising = !player.isClimbing && player.vy < 0;
      const head = rising ? player.y - player.vy * player.vy / (2 * MOVEMENT.gravity) : player.y;
      const feet = player.y + player.height;
      // Rest with the supporting deck where the lower deck sat at the old
      // single-deck framing. The support only changes on landing or while
      // climbing, so ordinary jumps stay inside the dead zone.
      const rest = clamp(camera.support + 32 - viewHeight, 0, maxViewY);
      let y = Math.min(rest, head - CAMERA.headroomFor(screenBandPx));
      // In the air the view frames where the arc lands, but never below the
      // take-off deck until the apex: rising past a crate's side can stall
      // the horizontal speed and briefly point the prediction into a gap.
      const airborne = !player.onGround && !player.isClimbing;
      const landing = !airborne ? nextLanding() : (player.vy < 0 ? Math.min(predictedLanding(), camera.support) : predictedLanding());
      y = Math.max(y, landing + CAMERA.footroom - viewHeight);
      y = Math.min(y, head - 24);
      return clamp(Math.max(y, feet + 8 - viewHeight), 0, maxViewY);
    }

    function snapCamera() {
      camera.look = player.facing;
      camera.facing = player.facing;
      camera.facingFor = CAMERA.turnHoldMs;
      camera.lookVelocity = 0;
      camera.lead = 0;
      camera.yVelocity = 0;
      camera.support = player.y + player.height;
      camera.x = cameraTargetX();
      camera.y = cameraTargetY();
    }

    function updateCamera(dt) {
      // The resting deck follows landings and climbs, but not hops onto
      // cover or other small steps, so short hops don't pump the view.
      const feet = player.y + player.height;
      if (player.isClimbing || (player.onGround && Math.abs(feet - camera.support) >= CAMERA.supportDeadband)) camera.support = feet;
      // The view swings only after a turn has held briefly.
      if (player.facing !== camera.facing) {
        camera.facingFor += dt;
        if (camera.facingFor >= CAMERA.turnHoldMs) camera.facing = player.facing;
      } else camera.facingFor = 0;
      [camera.look, camera.lookVelocity] = smoothDamp(camera.look, camera.lookVelocity, camera.facing, CAMERA.turnMs, dt);
      const leadTarget = clamp(player.vx / MOVEMENT.runSpeed, -1, 1) * CAMERA.lead;
      camera.lead += (leadTarget - camera.lead) * settle(dt, CAMERA.leadMs);
      camera.x += (cameraTargetX() - camera.x) * settle(dt, CAMERA.followXMs);
      // Falls are followed a little faster so the landing below reads sooner.
      const targetY = cameraTargetY();
      const falling = !player.onGround && !player.isClimbing && player.vy > 0 && targetY > camera.y;
      [camera.y, camera.yVelocity] = smoothDamp(camera.y, camera.yVelocity, targetY, falling ? CAMERA.fallFollowMs : CAMERA.followYMs, dt);
      // Hard limits: the whole player always stays in frame.
      const centre = player.x + player.width / 2;
      camera.x = clamp(camera.x, centre + 24 - viewWidth, centre - 24);
      camera.y = clamp(camera.y, player.y + player.height + 4 - viewHeight, player.y + player.height - 52);
      camera.x = clamp(camera.x, 0, worldWidth - viewWidth);
      camera.y = clamp(camera.y, 0, maxViewY);
    }

    // True when a rectangle is inside the unshaken view, shrunk by inset.
    function inCameraView(rect, inset = 0) {
      return rect.x >= camera.x + inset && rect.x + rect.width <= camera.x + viewWidth - inset &&
        rect.y >= camera.y && rect.y + rect.height <= camera.y + viewHeight;
    }

    const ENEMY_CUE_LEVEL = { Warn: 0.48, Attack: 0.42, Down: 0.42, Hurt: 0.36, Move: 0.26, Land: 0.34, Impact: 0.3 };
    // A tell that cancels and restarts quickly warns only once.
    const WARN_CUE_GAP_MS = 900;
    const HURT_CUE_GAP_MS = 260;
    // Sentry Unit footsteps: on starting to move, then at a walking cadence.
    const ROBOT_STEP_MS = 1500;
    const ROBOT_START_GAP_MS = 1000;

    function playEnemyCue(enemy, cue) {
      const def = EXPANSION[enemy.type];
      const name = def?.cues?.[cue] ?? (def?.audio || enemy.type) + cue;
      return playCueAt(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, name, cue);
    }

    // A positional cue: panned and attenuated by distance from the player.
    function playCueAt(x, y, name, cue) {
      if (!SETTINGS.sfx) return false;
      const offset = x - player.x - player.width / 2;
      // Threats in or just outside the frame, or close to the player even
      // when the tighter view leaves them off screen, stay audible.
      const nearView = x >= camera.x - 48 && x <= camera.x + viewWidth + 48 &&
        y >= camera.y - 48 && y <= camera.y + viewHeight + 48;
      if (!nearView && Math.abs(offset) > 420) return false;
      const pan = Math.max(-0.72, Math.min(0.72, offset / 330));
      const gain = (ENEMY_CUE_LEVEL[cue] ?? 0.42) / (1 + Math.abs(offset) / 720);
      const group = cue === 'Hurt' ? 'hurt' : (cue === 'Move' || cue === 'Land' ? 'move' : 'enemy');
      const played = Boolean(window.combatAudio?.play(name, group, gain, pan));
      if (!played && cue === 'Down') playLegacyEffect(enemyDeathSfx);
      return played;
    }

    // A burst or a shotgun's pellets play one hurt cue per enemy per window.
    function playEnemyHurt(enemy) {
      if (elapsedTime - (enemy.hurtCueAt ?? -Infinity) < HURT_CUE_GAP_MS) return;
      enemy.hurtCueAt = elapsedTime;
      playEnemyCue(enemy, 'Hurt');
    }

    // ---------------------------------------------------------------------
    // Expansion enemy specials

    let beams = [];
    let slashes = [];

    // The special-clip frame for an elapsed time, and its index.
    function specialFrame(type, t) {
      const frames = expansionArt[type].clips.special;
      for (let i = 0; i < frames.length; i++) {
        if (t < frames[i].ms) return [frames[i], i];
        t -= frames[i].ms;
      }
      return [frames.at(-1), frames.length - 1];
    }

    // A frame point (muzzle or contact) in world units, mirrored with facing.
    function framePoint(e, frame, point, facing) {
      const art = expansionArt[e.type];
      return {
        x: e.x + e.width / 2 + (point[0] - frame.origin[0]) * art.scale * facing,
        y: e.y + e.height + (point[1] - frame.origin[1]) * art.scale
      };
    }

    // The muzzle of the nearest special frame that has one.
    function specialMuzzle(e, facing, index) {
      const frames = expansionArt[e.type].clips.special;
      for (let i = index; i >= 0; i--) if (frames[i].muzzle) return framePoint(e, frames[i], frames[i].muzzle, facing);
      const first = frames.find(f => f.muzzle);
      return first ? framePoint(e, first, first.muzzle, facing) : { x: e.x + e.width / 2 + facing * e.width / 2, y: e.y + e.height * 0.35 };
    }

    // First solid crossing a horizontal shot from x0 toward x1 at height y.
    function firstSolidAlong(x0, x1, y) {
      const left = Math.min(x0, x1);
      const right = Math.max(x0, x1);
      let hit = null;
      for (const ob of obstacles) {
        if (y < ob.y || y > ob.y + ob.height || ob.x + ob.width < left || ob.x > right) continue;
        const face = x1 > x0 ? ob.x : ob.x + ob.width;
        const edge = x1 > x0 ? Math.max(face, x0) : Math.min(face, x0);
        if (!hit || Math.abs(edge - x0) < Math.abs(hit - x0)) hit = edge;
      }
      return hit;
    }

    // Distance along a segment to the first solid it crosses, or null.
    function solidOnSegment(x0, y0, x1, y1) {
      const length = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.ceil(length / 3));
      for (let i = 1; i <= steps; i++) {
        const x = x0 + (x1 - x0) * i / steps;
        const y = y0 + (y1 - y0) * i / steps;
        if (x < 0 || x > worldWidth) return length * i / steps;
        for (const ob of obstacles) {
          if (x >= ob.x && x <= ob.x + ob.width && y >= ob.y && y <= ob.y + ob.height) return length * i / steps;
        }
      }
      return null;
    }

    // Ranged specials aim from the muzzle at the player's centre, within a
    // shallow angle, and need that whole line free of solids.
    const AIM_SLOPE = 0.5;
    function shotLine(muzzle, dir) {
      const tx = player.x + player.width / 2;
      const ty = player.y + player.height / 2;
      const run = (tx - muzzle.x) * dir;
      if (run < 8 || Math.abs(ty - muzzle.y) > run * AIM_SLOPE) return null;
      const blocked = solidOnSegment(muzzle.x, muzzle.y, tx, ty);
      const length = Math.hypot(tx - muzzle.x, ty - muzzle.y);
      return { clear: blocked === null, tx, ty, ux: (tx - muzzle.x) / length, uy: (ty - muzzle.y) / length, length };
    }
    const shotLineClear = (muzzle, dir) => Boolean(shotLine(muzzle, dir)?.clear);

    function specialDamage(def) {
      if (SETTINGS.difficulty === 'easy') return Math.max(1, def.damage - 2);
      if (SETTINGS.difficulty === 'hard') return def.damage + 2;
      return def.damage;
    }

    // A dash or pounce hitting a solid: sparks and one impact cue.
    function stopSpecialMove(e, x, y) {
      if (!e.moveVx) return;
      e.moveVx = 0;
      spawnHitSparks(x, y, 'enemy');
      playEnemyCue(e, 'Impact');
    }

    function endSpecial(e, def) {
      e.special = null;
      e.moveVx = 0;
      e.shootTimer = def.cooldown[0] + Math.random() * def.cooldown[1];
    }

    // One melee contact zone per attack; it can only hurt the player once.
    function meleeHit(e, def, zone) {
      if (e.special.hit || !rectIntersect(zone, player)) return;
      e.special.hit = true;
      if (damagePlayer(specialDamage(def))) {
        const push = 14 * e.special.dir;
        const from = player.x;
        player.x = clamp(player.x + push, 0, worldWidth - player.width);
        if (!player.isClimbing && obstacles.some(ob => rectIntersect(player, ob))) player.x = from;
      }
    }

    // Runs in the fixed simulation step. Start: grace over, cooldown done,
    // standing, visible in the unshaken view, on the player's level and in
    // reach; ranged attacks also need a clear shot line.
    function updateSpecial(e, dt, visible, dx, absDx, dy) {
      const def = EXPANSION[e.type];
      const art = expansionArt[e.type];
      if (!art) return;
      if (!e.special) {
        e.shootTimer = Math.max(0, e.shootTimer - dt);
        if (e.shootTimer || e.spawnGrace || !visible || !e.onGround || e.ladder) return;
        const dir = dx < 0 ? -1 : 1;
        const ranged = def.kind === 'projectile' || def.kind === 'laser';
        if (ranged) {
          if (absDx > def.reach || Math.abs(dy) > 55 || !shotLineClear(specialMuzzle(e, dir, 0), dir)) return;
        } else {
          const gap = dir > 0 ? player.x - (e.x + e.width) : e.x - (player.x + player.width);
          if (gap > def.reach || gap < -8 || Math.abs(dy) > 30) return;
          if (firstSolidAlong(e.x + e.width / 2, player.x + player.width / 2, e.y + e.height - 10) !== null) return;
          // A pounce needs floor all the way to where it lands, so it never
          // leaps off a ledge and its vulnerable landing is always reachable.
          if (def.kind === 'pounce' && !pounceLandingSupported(e, def, dir)) return;
        }
        e.special = { kind: def.kind, t: 0, dir, fired: false, hit: false, airborne: false };
        e.targetDir = dir;
        e.dir = dir;
        if (elapsedTime - (e.warnCueAt ?? -Infinity) >= WARN_CUE_GAP_MS) {
          e.warnCueAt = elapsedTime;
          playEnemyCue(e, 'Warn');
        }
        return;
      }
      const sp = e.special;
      const wasFired = sp.fired;
      // A pounce holds its trigger frame until it lands.
      if (!(sp.kind === 'pounce' && sp.fired && sp.airborne)) sp.t += dt;
      if (!sp.fired) {
        const ranged = sp.kind === 'projectile' || sp.kind === 'laser';
        // Windup tells cancel when the enemy leaves the view, is knocked off
        // its feet, or cover comes between it and the player.
        const [, index] = specialFrame(e.type, Math.min(sp.t, art.triggerAt - 1));
        if (!visible || !e.onGround || (ranged && !shotLineClear(specialMuzzle(e, sp.dir, index), sp.dir))) {
          e.special = null;
          e.shootTimer = 360;
          return;
        }
        if (sp.t < art.triggerAt) return;
        // The trigger frame resolves exactly once.
        sp.fired = true;
        resolveSpecial(e, def, art, sp);
      }
      if (sp.kind === 'dash' && sp.t < art.triggerEnd) {
        const [frame] = specialFrame(e.type, sp.t);
        const contact = frame.contact ? framePoint(e, frame, frame.contact, sp.dir) : { x: e.x + (sp.dir > 0 ? e.width : 0), y: e.y + e.height / 2 };
        meleeHit(e, def, { x: Math.min(contact.x, e.x + e.width / 2), y: contact.y - 10, width: Math.abs(contact.x - (e.x + e.width / 2)) + 6, height: 20 });
        if (SETTINGS.particles && Math.random() < 0.6) spawnHitSparks(contact.x, contact.y, 'thug');
      } else if (sp.kind === 'dash') e.moveVx = 0;
      if (sp.kind === 'pounce' && sp.fired) {
        if (wasFired && sp.airborne && e.onGround) {
          // Landing: the bite closes from the chest to the jaw (it can still
          // only hit once), then a vulnerable recovery begins. Without this a
          // mid-range arc carried the jaw over the player's head.
          sp.airborne = false;
          e.moveVx = 0;
          const frame = art.clips.special[art.trigger];
          const jaw = framePoint(e, frame, frame.contact, sp.dir);
          const chest = e.x + e.width / 2;
          meleeHit(e, def, { x: Math.min(chest, jaw.x), y: e.y, width: Math.abs(jaw.x - chest) + 4, height: e.height });
          sp.t = art.triggerEnd;
          sp.vulnerable = true;
          playEnemyCue(e, 'Land');
        }
        if (sp.airborne) {
          const frame = art.clips.special[art.trigger];
          const jaw = framePoint(e, frame, frame.contact, sp.dir);
          meleeHit(e, def, { x: jaw.x - 14, y: jaw.y - 11, width: 28, height: 22 });
        }
      }
      if (sp.t >= art.total) endSpecial(e, def);
    }

    // The pounce arc's landing span at the same feet height: ballistic
    // flight from the pounce velocity under enemy gravity (0.25 per tick).
    function pounceLandingSupported(e, def, dir) {
      const airTicks = Math.ceil(-2 * def.pounce[1] / 0.25);
      const travel = def.pounce[0] * airTicks;
      const feet = e.y + e.height;
      const x0 = dir > 0 ? e.x : e.x - travel;
      const x1 = dir > 0 ? e.x + e.width + travel : e.x + e.width;
      if (x0 < 0 || x1 > worldWidth) return false;
      if (feet >= groundY - 0.5) return true;
      // Merged walkable surfaces at this height must cover the whole span.
      const spans = obstacles.filter(ob => Math.abs(ob.y - feet) < 0.6 && ob.role !== 'cover').map(ob => [ob.x, ob.x + ob.width]).sort((a, b) => a[0] - b[0]);
      let reach = x0;
      for (const [a, b] of spans) { if (a > reach + 0.5) break; reach = Math.max(reach, b); }
      return spans.length > 0 && spans[0][0] <= x0 + 0.5 && reach >= x1 - 0.5;
    }

    function resolveSpecial(e, def, art, sp) {
      const frame = art.clips.special[art.trigger];
      playEnemyCue(e, 'Attack');
      if (sp.kind === 'projectile' || sp.kind === 'laser') {
        const muzzle = framePoint(e, frame, frame.muzzle, sp.dir);
        // Aim is taken when the trigger frame starts; the windup checks kept the line clear.
        const aim = shotLine(muzzle, sp.dir) || { ux: sp.dir, uy: 0 };
        if (sp.kind === 'projectile') {
          // One blue pulse from the carbine muzzle; it flies and can be blocked like any shot.
          enemyBullets.push({ x: muzzle.x - 5, y: muzzle.y - 2, vx: aim.ux * def.shotSpeed, vy: aim.uy * def.shotSpeed,
            width: 10, height: 4, damage: specialDamage(def), kind: 'police', origin: { x: e.x + e.width / 2, y: muzzle.y } });
          spawnHitSparks(muzzle.x, muzzle.y, 'police');
        } else {
          // One brief violet lance: it ends at the first solid or at the player.
          let reach = def.reach;
          const wall = solidOnSegment(muzzle.x, muzzle.y, muzzle.x + aim.ux * reach, muzzle.y + aim.uy * reach);
          if (wall !== null) reach = wall;
          let hit = false;
          for (let d = 0; d <= reach; d += 3) {
            const point = { x: muzzle.x + aim.ux * d, y: muzzle.y + aim.uy * d, width: 1, height: 1 };
            if (rectIntersect(point, player)) { reach = d; hit = true; break; }
          }
          if (hit) damagePlayer(specialDamage(def));
          const end = { x: muzzle.x + aim.ux * reach, y: muzzle.y + aim.uy * reach };
          beams.push({ x0: muzzle.x, y0: muzzle.y, x1: end.x, y1: end.y, life: frame.ms, maxLife: frame.ms, hit });
          spawnHitSparks(end.x, end.y, 'elf');
        }
      } else if (sp.kind === 'dash') {
        e.moveVx = sp.dir * def.dashSpeed;
      } else if (sp.kind === 'pounce') {
        e.moveVx = sp.dir * def.pounce[0];
        e.vy = def.pounce[1];
        e.onGround = false;
        sp.airborne = true;
        slashes.push({ e, life: 260, maxLife: 260 });
      }
    }

    function updateGame(dt) {
      elapsedTime += dt;
      player.animTime += dt;
      player.invulnTimer = Math.max(0, player.invulnTimer - dt);
      player.hitFlashTimer = Math.max(0, player.hitFlashTimer - dt);
      player.recoilTimer = Math.max(0, player.recoilTimer - dt);
      const wasGrounded = player.onGround;
      const interactTap = pressedKeys.has('e') || pressedKeys.has('Enter');
      // Age kicks before this tick's shots so a new kick shows at full strength.
      updateShotKicks(dt);
      updatePlayer(dt);
      updateCamera(dt);
      if (atStageExit()) {
        if (story && !storyExitOpen()) blockExit();
        else {
          const exitScene = story?.data.steps[story.step]?.exitScene;
          if (exitScene) openScene(exitScene, leaveStage);
          else leaveStage();
          return;
        }
      }
      if (story) {
        updateStory(dt, interactTap);
        if (gameState !== 'play') return;
      }
      if (!wasGrounded && player.onGround) lastLanding = elapsedTime;
      fallenSprites = fallenSprites.filter(enemy => elapsedTime - enemy.at < ENEMY_FALL[enemy.type]);
      // Update enemies against the unshaken view. Walkers route to the
      // player's deck by ladders and safe drops.
      const playerRegion = regionAt(player);
      const playerCeiling = ceilingAbove(player.x + player.width / 2, player.y);
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.animTime += dt;
        // The first-attack grace starts once the enemy has entered the frame.
        if (inCameraView(e)) e.spawnGrace = Math.max(0, (e.spawnGrace || 0) - dt);
        const ranged = RANGED[e.type];
        const closeAttack = CLOSE_ATTACK[e.type];
        const wantsStrike = closeAttack && e.attackTimer > 115;
        // Expansion specials hold the enemy in place except for their own dash or pounce.
        const braced = (ranged && (e.queuedShot || e.attackTimer > 75)) || Boolean(e.special);
        const closeWindup = closeAttack && e.windupTimer > 0;
        if (e.attackTimer > 0) e.attackTimer = Math.max(0, e.attackTimer - dt);
        if (e.contactDamageTimer > 0) e.contactDamageTimer = Math.max(0, e.contactDamageTimer - dt);

        const prevX = e.x;
        const prevY = e.y;
        const wasEnemyGrounded = e.onGround;
        const playerMidY = player.y + player.height / 2;
        const enemyMidY = e.y + e.height / 2;
        const dx = player.x - e.x;
        const absDx = Math.abs(dx);

        e.changeDirTimer -= dt;
        e.pathRecalcTimer -= dt;

        if (e.type === 'ghost') {
          if (e.pathRecalcTimer <= 0) {
            const comfort = e.preferredRange;
            if (absDx > comfort + 20) e.dir = dx < 0 ? -1 : 1;
            else if (absDx < comfort - 20) e.dir = dx < 0 ? 1 : -1;
            else if (Math.random() < 0.15) e.dir *= -1;
            e.pathRecalcTimer = 220 + Math.random() * 220;
          }
          e.phase += dt * 0.0017;
          const bob = Math.sin(e.phase * 4) * 22;
          // Ghosts phase through decks toward the player's level, hovering
          // below the ceiling of the player's room.
          const farHover = camera.support - e.height - 115;
          const hover = Math.max(playerCeiling + 26, absDx < 154 ? playerMidY - e.height / 2 - 8 : farHover);
          if (!closeWindup) e.baseY += (hover - e.baseY) * 0.032;
          if (!closeWindup) e.x += wantsStrike ? closeAttack.rush * e.targetDir : e.speed * e.dir;
          e.y = clamp(e.baseY + bob, 4, groundY - e.height - 12);
        } else if (e.ladder) {
          // Climbing follows the ladder's own span, then steps off at its end.
          const lad = e.ladder;
          e.x = lad.x + lad.width / 2 - e.width / 2;
          e.y += e.climbDir * (e.type === 'alien' ? 1.7 : (e.type === 'robot' ? 1.35 : 1.2));
          e.vy = 0;
          e.onGround = false;
          const feet = e.y + e.height;
          const end = e.climbDir < 0 ? (feet <= lad.top ? lad.top : null) : (feet >= lad.bottom ? lad.bottom : null);
          if (end !== null) {
            e.y = end - e.height;
            e.ladder = null;
            e.navEdge = null;
            e.onGround = true;
            e.pathRecalcTimer = 0;
          }
        } else {
          if (e.pathRecalcTimer <= 0) {
            const region = regionAt(e);
            const climbs = EXPANSION[e.type]?.climbs ?? true;
            e.navEdge = e.onGround && region !== playerRegion ? nextNavEdge(region, playerRegion, climbs) : null;
            e.offRoute = region !== playerRegion && !e.navEdge;
            if (e.navEdge) {
              const goal = e.navEdge.kind === 'drop' ? e.navEdge.x + e.navEdge.dir * 30 : e.navEdge.x;
              e.dir = goal > e.x + e.width / 2 ? 1 : -1;
            } else if (e.type === 'zombie') {
              e.dir = dx < 0 ? -1 : 1;
            } else {
              const prefer = e.preferredRange;
              if (absDx > prefer + 24) e.dir = dx < 0 ? -1 : 1;
              else if (absDx < prefer - 24) e.dir = dx < 0 ? 1 : -1;
              else if (Math.random() < 0.18) e.dir *= -1;
            }
            e.pathRecalcTimer = 180 + Math.random() * 180;
          }
          if (!e.navEdge && e.changeDirTimer <= 0 && Math.random() < 0.25) {
            e.dir *= -1;
            e.changeDirTimer = 1000 + Math.random() * 1000;
          }

          if (e.moveVx) {
            // Dash: stop at a ledge rather than running off it.
            if (e.special?.kind === 'dash' && e.onGround) {
              const lead = e.moveVx > 0 ? e.x + e.width + e.moveVx : e.x + e.moveVx;
              const feet = e.y + e.height;
              const supported = feet >= groundY - 0.5 || obstacles.some(ob => Math.abs(ob.y - feet) < 0.6 && lead >= ob.x && lead <= ob.x + ob.width);
              if (!supported) e.moveVx = 0;
            }
            e.x += e.moveVx;
          } else if (!braced && !closeWindup) {
            const ladderEdge = e.navEdge?.kind === 'ladder' ? e.navEdge : null;
            if (ladderEdge) {
              const offset = ladderEdge.x - (e.x + e.width / 2);
              e.x += clamp(offset, -e.speed, e.speed);
              if (Math.abs(offset) < 1.5 && e.onGround) {
                e.ladder = ladderEdge.ladder;
                e.climbDir = ladderEdge.dir;
              }
            } else {
              e.x += wantsStrike ? closeAttack.rush * e.targetDir : e.speed * e.dir;
            }
          }

          if (!e.ladder) {
            e.vy += 0.25;
            e.y += e.vy;
            e.onGround = false;
            let hop = false;

            for (let oi = 0; oi < obstacles.length; oi++) {
              const ob = obstacles[oi];
              const overX = e.x + e.width > ob.x && e.x < ob.x + ob.width;
              if (overX && prevY + e.height <= ob.y && e.y + e.height >= ob.y) {
                e.y = ob.y - e.height;
                e.vy = 0;
                e.onGround = true;
              } else if (overX && prevY >= ob.y + ob.height && e.y < ob.y + ob.height) {
                // Hops stop against deck undersides.
                e.y = ob.y + ob.height;
                e.vy = 0;
              }
              if (rectIntersect(e, ob)) {
                // Zombies and aliens hop low cover; bulkheads turn everyone back.
                const canHop = ob.role === 'cover' && wasEnemyGrounded && !braced && !closeWindup &&
                  (e.type === 'zombie' || e.type === 'alien' || EXPANSION[e.type]?.hops);
                if (prevX + e.width <= ob.x) {
                  e.x = ob.x - e.width;
                  if (canHop && !e.special) hop = true;
                  else e.dir = -1;
                  stopSpecialMove(e, ob.x, e.y + e.height / 2);
                } else if (prevX >= ob.x + ob.width) {
                  e.x = ob.x + ob.width;
                  if (canHop && !e.special) hop = true;
                  else e.dir = 1;
                  stopSpecialMove(e, ob.x + ob.width, e.y + e.height / 2);
                }
              }
            }

            if (!e.onGround && e.y + e.height >= groundY) {
              e.y = groundY - e.height;
              e.vy = 0;
              e.onGround = true;
            }
            if (hop) e.vy = -5.6;
          }
        }

        e.walking = e.onGround && !e.special && Math.abs(e.x - prevX) > 0.15;
        if (e.type === 'robot') {
          const moving = Boolean(e.ladder) || (e.onGround && Math.abs(e.x - prevX) > 0.2);
          const since = elapsedTime - (e.stepCueAt ?? -Infinity);
          // A start plays a step unless one just did; walking repeats at a cadence.
          if (moving && since >= (e.wasMoving ? ROBOT_STEP_MS : ROBOT_START_GAP_MS)) {
            playEnemyCue(e, 'Move');
            e.stepCueAt = elapsedTime;
          }
          e.wasMoving = moving;
        }

        const visible = inCameraView(e, 20);
        if (EXPANSION[e.type]) {
          updateSpecial(e, dt, visible, dx, absDx, playerMidY - enemyMidY);
        } else if (ranged) {
          if (e.queuedShot) {
            e.windupTimer = Math.max(0, e.windupTimer - dt);
            if (!visible || !e.onGround) {
              e.queuedShot = false;
              e.windupTimer = 0;
              e.attackTimer = 0;
              e.shootTimer = 360;
            } else if (!e.windupTimer) {
              let damage = ranged.damage;
              if (SETTINGS.difficulty === 'easy') damage = Math.max(1, damage - 2);
              else if (SETTINGS.difficulty === 'hard') damage += 2;
              enemyBullets.push({
                x: e.x + (e.targetDir < 0 ? -8 : e.width), y: e.y + e.height / 2 - 2,
                vx: e.targetDir * ranged.speed, vy: 0, width: 8, height: 4,
                damage, kind: e.type
              });
              playEnemyCue(e, 'Attack');
              e.queuedShot = false;
              e.attackTimer = 140;
              e.shootTimer = ranged.recovery + Math.random() * 900;
            }
          } else {
            e.shootTimer = Math.max(0, e.shootTimer - dt);
            if (!e.shootTimer && !e.spawnGrace && visible && e.onGround &&
                absDx < 520 && Math.abs(playerMidY - enemyMidY) <= 55) {
              e.targetDir = dx < 0 ? -1 : 1;
              e.queuedShot = true;
              e.windupTimer = ranged.windup;
              e.attackTimer = ranged.windup;
              playEnemyCue(e, 'Warn');
            }
          }
        } else if (closeAttack) {
          if (closeWindup) {
            e.windupTimer = Math.max(0, e.windupTimer - dt);
            if (!e.windupTimer) {
              e.attackTimer = 200;
              playEnemyCue(e, 'Attack');
            }
          } else if (!e.attackTimer && !e.contactDamageTimer && !e.spawnGrace &&
                     absDx < closeAttack.range && Math.abs(playerMidY - enemyMidY) < 36) {
            e.targetDir = dx < 0 ? -1 : 1;
            e.windupTimer = closeAttack.windup;
            playEnemyCue(e, 'Warn');
          }
        }
        e.x = Math.max(0, Math.min(worldWidth - e.width, e.x));

        // Walkers with no route to the player's deck give up their slot once
        // they have been out of view for a while.
        e.offRouteTimer = e.offRoute && !e.ladder && !inCameraView(e) ? e.offRouteTimer + dt : 0;
        if (e.x + e.width < player.x - width * 2 || e.x > player.x + width * 3 || e.offRouteTimer > 4000) {
          enemies.splice(i, 1);
          continue;
        }
      }
      // Expansion enemies are hit on an area sized from their art; the
      // original four keep their collision boxes.
      const targets = enemies.map(e => {
        const def = EXPANSION[e.type];
        if (!def) return e;
        const [w, h] = def.hurt;
        return { x: e.x + e.width / 2 - w / 2, y: e.y + e.height - h, width: w, height: h, enemy: e };
      });
      advanceProjectiles(bullets, targets, (b, hit) => {
        spawnHitSparks(hit.x, hit.y, b.weapon);
        const enemy = hit.target.enemy || hit.target;
        const index = enemies.indexOf(enemy);
        if (index < 0) return;
        // A dinosaur caught in its landing recovery takes extra damage.
        const vulnerable = enemy.special?.vulnerable ? EXPANSION[enemy.type].vulnerable : 1;
        enemy.health -= b.damage * vulnerable;
        enemy.hitTimer = 170;
        if (enemy.health > 0) playEnemyHurt(enemy);
        const direction = Math.sign(b.vx) || (player.x < enemy.x ? 1 : -1);
        const force = b.weapon === 'shotgun' ? 4.2 : (b.weapon === 'laser' ? 2.8 : 1.8);
        enemy.x += direction * force;
        if (enemy.type !== 'ghost') enemy.vx = (enemy.vx || 0) + direction * 0.15;
        if (b.weapon === 'shotgun') {
          screenShakeTimer = Math.max(screenShakeTimer, 55);
          screenShakeStrength = Math.max(screenShakeStrength, 2.2);
        }
        if (enemy.health <= 0) {
          addFloatingText(enemy.x + enemy.width / 2, enemy.y - 8, '+DROP', '#ffd66b');
          spawnParticles(enemy);
          spawnPickups(enemy);
          playEnemyCue(enemy, 'Down');
          fallenSprites.push({
            type: enemy.type, x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height,
            facing: enemySprite(enemy).facing, at: elapsedTime
          });
          enemies.splice(index, 1);
        }
      });
      advanceProjectiles(enemyBullets, [player], (b, hit) => {
        spawnHitSparks(hit.x, hit.y, 'enemy');
        if (hit.target === player) damagePlayer(b.damage);
        // A Breach Pulse breaking on cover or a wall plays one impact cue.
        else if (b.kind === 'police') playCueAt(hit.x, hit.y, 'robotAttack', 'Impact');
      });
      if (gameState !== 'play') return;
      // Decrement hit timers on enemies
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.hitTimer > 0) {
          e.hitTimer = Math.max(0, e.hitTimer - dt);
        }
      }
      // Update particle effects if enabled; otherwise clear list
      if (!SETTINGS.particles) {
        particles = [];
      } else {
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          const sec = Math.min(0.033, dt / 1000);
          p.x += p.vx * (sec * 60);
          p.y += p.vy * (sec * 60);
          p.vx *= p.drag || 0.97;
          p.vy = p.vy * (p.drag || 0.97) + (p.gravity || 0.05);
          p.life -= dt;
          if (p.life <= 0) {
            particles.splice(i, 1);
          }
        }
      }
      // Enemies vs player contact with per-enemy contact cooldown so overlap
      // does not rapidly drain HP.
      for (let i=enemies.length-1; i>=0; i--) {
        const e = enemies[i];
        if (rectIntersect(e, player)) {
          const closeAttack = CLOSE_ATTACK[e.type];
          const inStrike = e.attackTimer > 115 && (player.x - e.x) * e.targetDir >= -6;
          // Expansion enemies only hurt through their specials.
          if (!EXPANSION[e.type] && !e.spawnGrace && e.contactDamageTimer <= 0 && (!closeAttack || inStrike)) {
            const baseDamage = e.type === 'zombie' ? 5 : (e.type === 'ghost' ? 4 : (e.type === 'robot' ? 6 : 5));
            if (damagePlayer(baseDamage)) {
              const push = e.type === 'robot' ? 12 : 9;
              const pushedFrom = player.x;
              player.x = Math.max(0, Math.min(worldWidth - player.width, player.x + (player.x < e.x ? -push : push)));
              if (!player.isClimbing && obstacles.some(ob => rectIntersect(player, ob))) player.x = pushedFrom;
              e.contactDamageTimer = closeAttack?.recovery || 780;
            }
          }
        }
      }
      if (gameState !== 'play') return;
      // Pickups settle onto their surface, then are collected on contact.
      for (let i=pickups.length-1; i>=0; i--) {
        const p = pickups[i];
        if (p.y < p.restY) {
          p.vy = Math.min(9, p.vy + MOVEMENT.gravity);
          p.y = Math.min(p.restY, p.y + p.vy);
        }
        if (rectIntersect(p, player)) {
          if (p.type === 'gold') {
            player.gold += p.value;
            addFloatingText(player.x + player.width / 2, player.y - 6, `+${p.value} GOLD`, '#ffd700');
          } else if (p.type === 'ammo') {
            const key = p.ammoType;
            player.reserveAmmo[key] += p.value;
            addFloatingText(player.x + player.width / 2, player.y - 6, `+${p.value} ${key.toUpperCase()}`, '#77ddff');
          } else if (p.type === 'health') {
            // Health packs restore a small amount of HP but cannot exceed the maximum
            player.health = Math.min(player.health + (p.value || 5), 100);
            addFloatingText(player.x + player.width / 2, player.y - 6, `+${p.value || 5} HP`, '#8dff8d');
          }
          screenShakeTimer = Math.max(screenShakeTimer, 30);
          screenShakeStrength = Math.max(screenShakeStrength, 1.4);
          pickups.splice(i,1);
        }
      }
      // Update short-lived shot flashes and floating pickup/combat text.
      for (let i = shotFlashes.length - 1; i >= 0; i--) {
        const f = shotFlashes[i];
        f.life -= dt;
        if (f.life <= 0) shotFlashes.splice(i, 1);
      }
      for (const list of [beams, slashes]) {
        for (let i = list.length - 1; i >= 0; i--) {
          list[i].life -= dt;
          if (list[i].life <= 0) list.splice(i, 1);
        }
      }
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const t = floatingTexts[i];
        t.life -= dt;
        t.y += t.vy;
        if (t.life <= 0) floatingTexts.splice(i, 1);
      }
      if (SETTINGS.particles && pickups.length) {
        const spawnChance = Math.min(0.3, (dt / 16.67) * 0.08);
        for (let i = 0; i < pickups.length; i++) {
          if (Math.random() < spawnChance) spawnPickupSparkle(pickups[i]);
        }
      }
      screenShakeTimer = Math.max(0, screenShakeTimer - dt);
      screenShakeStrength = Math.max(0.35, screenShakeStrength * Math.pow(0.94, dt / 16.67));
      const shakeFalloff = Math.max(0, Math.min(1, screenShakeTimer / 150));
      if (screenShakeTimer > 0.01) {
        cameraShakeX = (Math.random() * 2 - 1) * screenShakeStrength * shakeFalloff;
        cameraShakeY = (Math.random() * 2 - 1) * screenShakeStrength * 0.55 * shakeFalloff;
      } else {
        cameraShakeX *= 0.7;
        cameraShakeY *= 0.7;
      }
      damageOverlayTimer = Math.max(0, damageOverlayTimer - dt);

      // Spawn new enemies periodically with a smoother ramp and cap to avoid
      // sudden overcrowding.
      spawnCooldown -= dt * (story?.data.steps[story.step]?.spawnRate || 1);
      if (spawnCooldown <= 0 && gameState === 'play') {
        const maxEnemies = SETTINGS.difficulty === 'easy' ? 8 : (SETTINGS.difficulty === 'hard' ? 14 : 11);
        const delayed = enemies.length < maxEnemies && !spawnEnemy();
        const difficultyScale = SETTINGS.difficulty === 'easy' ? 1.22 : (SETTINGS.difficulty === 'hard' ? 0.82 : 1);
        const progress = Math.min(1, elapsedTime / 180000);
        const minCooldown = 650;
        const maxCooldown = 1650;
        const cooldown = maxCooldown - (maxCooldown - minCooldown) * progress;
        // Without a fair position the spawn waits briefly and tries again.
        spawnCooldown = delayed ? 350 : (cooldown + Math.random() * 300) * difficultyScale;
      }
    }

    /**
     * Draw the entire scene. Handles parallax background, stars,
     * ground, pickups, enemies, bullets, player, HUD and overlays.
     */
    function recoilShear(frame, scale, kick) {
      return kick / Math.max(1, frame[5] * scale);
    }

    function frameMuzzle(frame, facing, kick) {
      if (!frame || frame.length !== 9) return null;
      const x = (frame[7] - frame[4]) * ACTOR_SCALE;
      const y = (frame[8] - frame[5]) * ACTOR_SCALE;
      return { x: (x + y * recoilShear(frame, ACTOR_SCALE, kick)) * facing, y };
    }

    function drawSprite(atlas, frame, x, y, facing = 1, scale = ACTOR_SCALE, kick = 0) {
      const image = atlases[atlas]?.image;
      if (!image || !Array.isArray(frame) || frame.length < 7) return false;
      const [sx, sy, w, h, ax, ay] = frame;
      if (![sx, sy, w, h, ax, ay].every(Number.isFinite) || sx < 0 || sy < 0 ||
          w <= 0 || h <= 0 || sx + w > image.naturalWidth || sy + h > image.naturalHeight) return false;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing, 1);
      ctx.imageSmoothingEnabled = true;
      if (kick) ctx.transform(1, 0, recoilShear(frame, scale, kick), 1, 0, 0);
      ctx.drawImage(image, sx, sy, w, h, -ax * scale, -ay * scale, w * scale, h * scale);
      ctx.restore();
      return true;
    }

    function drawLegacy(tile, x, y, w, h, facing = 1) {
      if (!legacyReady || !Number.isInteger(tile)) return false;
      ctx.save();
      ctx.translate(x + (facing < 0 ? w : 0), y);
      ctx.scale(facing, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(legacySprites.image, tile % 7 * 32, Math.floor(tile / 7) * 32, 32, 32, 0, 0, w, h);
      ctx.restore();
      return true;
    }

    function playerSprite() {
      const get = (name, time, loop) => clipFrame('player', name, time, loop);
      const key = player.weapon;
      const moving = Math.abs(player.vx) > 0.1;
      const shotAge = playerShot ? elapsedTime - playerShot.at : Infinity;
      const shot = playerShot?.key === key && playerShot.facing === player.facing && shotAge < SHOT_FEEDBACK[key].duration;
      let frame;
      if (gameState === 'start') frame = get('idle', performance.now(), true);
      else if (gameState === 'gameover' && endKind === 'dead') frame = get('down', performance.now() - playerDownAt);
      else if (player.hitFlashTimer > 0) frame = get('hit', 180 - player.hitFlashTimer);
      else if (player.isClimbing) frame = get('climb', Math.abs(player.vy) > 0.1 ? player.animTime : 0, true);
      else if (player.reloading && player.onGround && !player.isDucking) {
        frame = get(key + 'Reload', WEAPONS[key].reloadTime - player.reloadTimer);
      } else if (shot) {
        if (playerShot.up && key === 'rifle' && player.onGround && !player.isDucking) {
          frame = get('rifleUp', shotAge);
        } else if (!playerShot.up && player.onGround) {
          if (player.isDucking && key === 'rifle') frame = get('rifleCrouchFire', shotAge);
          else if (!player.isDucking) {
            frame = moving && key === 'rifle' ? get('rifleRun', player.animTime, true) : get(key + 'Fire', shotAge);
          }
        }
      }
      if (!frame) {
        if (!player.onGround) {
          frame = get('jump', player.vy < -1.7 ? 0 : player.vy > 1.7 ? 200 : 100);
        } else if (player.isDucking) {
          frame = get(moving ? 'crouchWalk' : 'crouch', player.animTime, true);
        } else if (elapsedTime - lastLanding < 132) {
          frame = get('land', elapsedTime - lastLanding);
        } else if (moving) {
          frame = (key === 'rifle' && get('rifleRun', player.animTime, true)) || get('run', player.animTime, true);
        } else {
          frame = get(key + 'Fire') || get('idle', player.animTime, true);
        }
      }
      const recoil = player.recoilFacing === player.facing && !player.recoilUp
        ? SHOT_FEEDBACK[key].recoil * (player.recoilTimer / SHOT_FEEDBACK[key].duration) ** 2 : 0;
      return { frame, kick: shot && !player.hitFlashTimer && !player.isClimbing && gameState !== 'gameover' ? recoil : 0 };
    }

    // Expansion poses: the special clip while attacking (windup, trigger,
    // recovery), hurt while flinching, walk while moving, idle otherwise.
    function expansionPose(enemy) {
      const art = expansionArt[enemy.type];
      const sp = enemy.special;
      const facing = sp ? sp.dir : (enemy.dir || 1);
      if (sp) return { frame: specialFrame(enemy.type, sp.t)[0], facing };
      if (enemy.hitTimer > 0) return { frame: art.clips.hurt[0], facing };
      if (enemy.walking) {
        const walk = art.clips.walk;
        const cycle = walk.reduce((sum, f) => sum + f.ms, 0);
        let t = (enemy.animTime / (enemy.animVariance || 1)) % cycle;
        for (const f of walk) { if (t < f.ms) return { frame: f, facing }; t -= f.ms; }
      }
      return { frame: art.clips.idle[0], facing };
    }

    // Draw an expansion frame with its origin on the feet; mirroring flips
    // the anchor offsets with the sprite.
    function drawExpansionFrame(type, frame, footX, footY, facing) {
      const art = expansionArt[type];
      if (!art || !frame) return false;
      const [sx, sy, w, h] = frame.rect;
      const [ox, oy] = frame.origin;
      ctx.save();
      ctx.translate(footX, footY);
      ctx.scale(facing, 1);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(art.image, sx, sy, w, h, -ox * art.scale, -oy * art.scale, w * art.scale, h * art.scale);
      ctx.restore();
      return true;
    }

    function enemySprite(enemy) {
      if (EXPANSION[enemy.type] && expansionArt[enemy.type]) return expansionPose(enemy);
      const get = (name, time, loop) => clipFrame('enemies', enemy.type + name, time, loop);
      const ranged = RANGED[enemy.type];
      const attacking = enemy.windupTimer > 0 || enemy.attackTimer > 0;
      const facing = attacking ? enemy.targetDir : enemy.dir;
      let frame;
      if (enemy.windupTimer > 0) {
        // Prioritize the telegraph over hit flinches while a strike is queued.
        frame = get('Attack', enemy.type === 'ghost' ? 0 : 55);
      } else if (enemy.hitTimer > 0) frame = get('Hit', 170 - enemy.hitTimer);
      else if (enemy.attackTimer > 0) {
        const strike = enemy.type === 'ghost' ? 45 : 120;
        frame = get('Attack', strike + (ranged ? 140 : 200) - enemy.attackTimer);
      }
      frame ||= get('Move', enemy.animTime / (enemy.animVariance || 1), true);
      return { frame, facing: facing || 1 };
    }

    function enemyOrigin(enemy) {
      return enemy.type === 'ghost' ? enemy.y + enemy.height * 0.36 : enemy.y + enemy.height;
    }

    // Reflection gives identical edge samples at every repeat, including the planet
    // horizon and translucent trusses. Each panel overlaps its neighbour by one
    // pixel so fractional scroll positions never open a seam.
    // cropHeight limits a layer's height from its top (the ceiling truss);
    // other layers are never clipped, since a lifted layer starts above the canvas.
    function drawLayer(image, scroll, scale = 1, top = 0, cropHeight = Infinity) {
      const tileWidth = width * scale;
      const tileHeight = image.height * tileWidth / image.width;
      let tile = Math.floor(scroll / tileWidth);
      const clipBottom = Math.min(height, top + cropHeight);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      if (clipBottom < top + tileHeight) {
        ctx.beginPath();
        ctx.rect(0, 0, width, clipBottom);
        ctx.clip();
      }
      for (let x = tile * tileWidth - scroll; x < width; x += tileWidth, tile++) {
        const flip = tile % 2 !== 0;
        ctx.save();
        ctx.translate(x + (flip ? tileWidth + 1 : 0), top);
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(image, 0, 0, tileWidth + 1, tileHeight);
        ctx.restore();
      }
      ctx.restore();
    }

    // Station layers stay in screen space. Each scrolls with the zoomed deck
    // at its parallax rate and magnifies in proportion, so distant layers
    // barely change while the near truss tracks the foreground.
    function drawStation(view) {
      const screenX = view.x * CAMERA.zoom;
      const rise = (maxViewY - view.y) * CAMERA.zoom;
      const env = STAGES[stageIndex].env;
      if (env) {
        // Environment stages: one painted backdrop with slow parallax.
        const bg = envArt[env]?.background;
        if (bg) {
          const scale = 1 + (CAMERA.zoom - 1) * 0.15;
          const tileHeight = bg.height * width * scale / bg.width;
          const lift = Math.min(rise * 0.15, Math.max(0, tileHeight - height));
          drawLayer(bg, screenX * 0.15, scale, height - tileHeight + lift);
        } else drawStars(screenX);
        ctx.fillStyle = 'rgba(5,10,18,0.2)';
        ctx.fillRect(0, 0, width, height);
        return;
      }
      if (!station.distant) {
        if (bgLoaded) drawLayer(legacyBackground.image, screenX * 0.12);
        else drawStars(screenX);
      }
      for (const [name, speed] of STATION_LAYERS) {
        const image = station[name];
        if (!image) continue;
        const scale = 1 + (CAMERA.zoom - 1) * speed;
        const tileHeight = image.height * width * scale / image.width;
        if (name === 'near') {
          // The ceiling truss hangs from the top edge.
          drawLayer(image, screenX * speed, scale, 0, 100 * scale);
        } else {
          // Deck-anchored layers rise with the camera without exposing their top edge.
          const lift = Math.min(rise * speed, Math.max(0, tileHeight - height));
          drawLayer(image, screenX * speed, scale, height - tileHeight + lift);
        }
      }
      // The station stack sits behind the combat silhouettes. A small neutral
      // veil makes the deck-level silhouettes readable against the blue planet.
      ctx.fillStyle = 'rgba(5,10,18,0.17)';
      ctx.fillRect(0, 0, width, height);
    }

    // Used only when neither distant background can be loaded.
    function drawStars(screenX) {
      ctx.fillStyle = '#080f20';
      ctx.fillRect(0, 0, width, height);
      for (const star of stars) {
        const x = star.x - screenX * 0.12;
        if (x >= 0 && x < width) {
          ctx.fillStyle = `rgba(205,230,255,${star.alpha})`;
          ctx.fillRect(x, star.y, star.size, star.size);
        }
      }
    }

    function envSource(env, def) {
      const art = envArt[env];
      const rect = art?.rects[def.sprite];
      if (!art?.objects || !rect) return null;
      return { image: art.objects, sx: rect[0] + def.box[0], sy: rect[1] + def.box[1], sw: def.box[2], sh: def.box[3] };
    }

    function drawEnvImage(src, x, y, w, h, flip) {
      if (!flip) { ctx.drawImage(src.image, src.sx, src.sy, src.sw, src.sh, x, y, w, h); return; }
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(src.image, src.sx, src.sy, src.sw, src.sh, 0, 0, w, h);
      ctx.restore();
    }

    // A deck or ledge: the sprite's body rows fill the solid's height and
    // tiles repeat along its width, clipped exactly at the solid's ends.
    // Trim above and below the body draws outside the solid and is not solid.
    function drawEnvBand(env, def, ob, view) {
      const src = envSource(env, def);
      if (!src) return false;
      const [top, bottom] = def.body;
      const scale = ob.height / (bottom - top);
      const tileW = src.sw * scale;
      const drawTop = ob.y - top * scale;
      const first = Math.max(0, Math.floor((view.x - WORLD_OVERSCAN - ob.x) / tileW));
      const last = Math.min(ob.x + ob.width, view.x + viewWidth + WORLD_OVERSCAN);
      ctx.save();
      ctx.beginPath();
      ctx.rect(ob.x, drawTop - 1, ob.width, src.sh * scale + 2);
      ctx.clip();
      for (let i = first, x = ob.x + first * tileW; x < last; i++, x += tileW) {
        drawEnvImage(src, x, drawTop, tileW + 0.5, src.sh * scale, i % 2 === 1);
      }
      ctx.restore();
      return true;
    }

    function drawEnvTerrain(view, env) {
      const art = ENV_ART[env];
      const deckDepth = worldHeight - groundY;
      const floor = { x: 0, y: groundY, width: worldWidth, height: deckDepth };
      ctx.fillStyle = art.tint;
      ctx.fillRect(view.x - WORLD_OVERSCAN, groundY, viewWidth + WORLD_OVERSCAN * 2, deckDepth + WORLD_OVERSCAN);
      drawEnvBand(env, art.deck, floor, view);
      for (const ob of layout.solids) {
        if (ob.role !== 'wall' || !onScreen(view, ob.x, ob.y, ob.width, ob.height)) continue;
        const src = envSource(env, art.wall);
        if (!src) continue;
        const tileH = src.sh * ob.width / src.sw;
        ctx.save();
        ctx.beginPath();
        ctx.rect(ob.x, ob.y, ob.width, ob.height);
        ctx.clip();
        for (let y = ob.y + ob.height - tileH, i = 0; y > ob.y - tileH; y -= tileH, i++) drawEnvImage(src, ob.x, y, ob.width, tileH + 0.5, i % 2 === 1);
        ctx.restore();
      }
      // Ladder rails map onto the ladder's width; rungs repeat to its ends.
      const ladderSrc = envSource(env, art.ladder);
      for (const ladder of ladders) {
        const top = ladder.top - 12;
        if (!onScreen(view, ladder.x, top, ladder.width, ladder.bottom - top)) continue;
        if (!ladderSrc) continue;
        const [r0, r1] = art.ladder.rails;
        const scale = ladder.width / (r1 - r0);
        const w = ladderSrc.sw * scale;
        const tileH = ladderSrc.sh * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(ladder.x - r0 * scale, top, w, ladder.bottom - top);
        ctx.clip();
        for (let y = top; y < ladder.bottom; y += tileH - 2) drawEnvImage(ladderSrc, ladder.x - r0 * scale, y, w, tileH, false);
        ctx.restore();
      }
      for (const ob of layout.solids) {
        if (ob.role === 'wall' || ob.type === 'deck' || !onScreen(view, ob.x, ob.y, ob.width, ob.height, 24)) continue;
        if (ob.role === 'cover') {
          const def = art.cover[ob.type] || art.cover.crate;
          const src = envSource(env, def);
          if (!src) continue;
          const scaleY = ob.height / (src.sh - def.surface);
          drawEnvImage(src, ob.x, ob.y - def.surface * scaleY, ob.width, src.sh * scaleY, false);
        } else {
          drawEnvBand(env, ob.type === 'slab' || ob.role === 'ceiling' ? art.deck : art.catwalk, ob, view);
        }
      }
      // Floor props are dimmed so they read as scenery, not cover.
      for (const d of decorations) {
        if (!onScreen(view, d.x, d.y, d.w, d.h)) continue;
        const src = envSource(env, d.decor);
        if (!src) continue;
        ctx.globalAlpha = d.floor ? 0.72 : 0.9;
        drawEnvImage(src, d.x, d.y, d.w, d.h, d.flip);
        ctx.globalAlpha = 1;
      }
    }

    // The stage exit: a lit gate at the right end of the final upper deck.
    function drawExitGate(view) {
      const goal = layout.goal;
      const x = worldWidth - EXIT_WIDTH;
      const top = goal.y - 58;
      if (!onScreen(view, x, top, EXIT_WIDTH, 58)) return;
      const pulse = 0.55 + Math.sin(performance.now() / 260) * 0.15;
      const glow = ctx.createLinearGradient(x, 0, worldWidth, 0);
      glow.addColorStop(0, 'rgba(244,195,123,0)');
      glow.addColorStop(1, `rgba(244,195,123,${0.38 * pulse})`);
      ctx.fillStyle = glow;
      ctx.fillRect(x, top, EXIT_WIDTH, 58);
      ctx.fillStyle = '#2a2f3a';
      ctx.fillRect(x, top - 4, 4, 62);
      ctx.fillRect(worldWidth - 6, top - 4, 6, 62);
      ctx.fillRect(x, top - 6, EXIT_WIDTH, 5);
      ctx.fillStyle = `rgba(255,227,184,${0.75 + pulse * 0.25})`;
      ctx.font = '700 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const sealed = story && !storyExitOpen();
      if (sealed) ctx.fillStyle = '#ff9f86';
      ctx.fillText(sealed ? 'SEALED' : (playMode === 'campaign' && stageIndex + 1 === STAGES.length ? 'EXTRACT' : 'EXIT'), x + EXIT_WIDTH / 2, top - 9);
      ctx.textAlign = 'left';
    }

    function drawTerrainTile(type, x, y, w, h, flip = false) {
      if (!station.terrain) return false;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      if (flip) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        x = y = 0;
      }
      ctx.drawImage(station.terrain, ...TERRAIN[type], x, y, w, h);
      ctx.restore();
      return true;
    }

    // Rectangle test against the drawn view, expanded by margin, for culling.
    function onScreen(view, x, y, w, h, margin = 0) {
      margin += WORLD_OVERSCAN;
      return x + w >= view.x - margin && x <= view.x + viewWidth + margin &&
        y + h >= view.y - margin && y <= view.y + viewHeight + margin;
    }

    // Tile a terrain texture along a long solid so it never stretches.
    function drawTiled(type, x, y, w, h, tileWidth) {
      for (let tx = x, tile = 0; tx < x + w; tx += tileWidth, tile++) {
        const span = Math.min(tileWidth, x + w - tx) + 0.5;
        drawTerrainTile(type, tx, y, span, h, tile % 2 !== 0);
      }
    }

    // Bulkheads reuse the deck plating turned on end.
    function drawWall(ob) {
      if (!station.terrain) return;
      const [sx, sy, sw, sh] = TERRAIN.deckBody;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ob.x, ob.y, ob.width, ob.height);
      ctx.clip();
      ctx.translate(ob.x + ob.width, ob.y);
      ctx.rotate(Math.PI / 2);
      for (let ty = 0; ty < ob.height; ty += 96) {
        ctx.drawImage(station.terrain, sx, sy, sw, sh, ty, 0, 96.5, ob.width);
      }
      ctx.restore();
    }

    // Drawn in world units under the camera transform.
    function drawTerrain(view) {
      const env = STAGES[stageIndex].env;
      if (env && envArt[env]?.objects) {
        drawEnvTerrain(view, env);
        drawExitGate(view);
        return;
      }
      drawTerrainBase(view);
      drawExitGate(view);
    }

    // Station terrain, also the fallback when a stage's kit art is missing.
    function drawTerrainBase(view) {
      const left = view.x - WORLD_OVERSCAN;
      const right = view.x + viewWidth + WORLD_OVERSCAN;
      // The lower deck runs past the world bottom to fill the overscan.
      const deckDepth = worldHeight - groundY + WORLD_OVERSCAN;
      ctx.fillStyle = '#101b2b';
      ctx.fillRect(left, groundY, right - left, deckDepth);
      const tileWidth = 128;
      for (let tile = Math.floor(left / tileWidth); tile * tileWidth < right; tile++) {
        // A half-unit overlap hides antialiased seams between scaled tiles.
        const x = tile * tileWidth;
        drawTerrainTile('deckBody', x, groundY + 6, tileWidth + 0.5, deckDepth - 6, tile % 2 !== 0);
        drawTerrainTile('deckCap', x, groundY, tileWidth + 0.5, 7, tile % 2 !== 0);
      }
      if (left < 51) drawTerrainTile('deckEnd', 0, groundY, 51, deckDepth, true);
      if (right > worldWidth - 51) drawTerrainTile('deckEnd', worldWidth - 51, groundY, 51, deckDepth);

      for (const ob of layout.solids) {
        if (ob.role !== 'wall' || !onScreen(view, ob.x, ob.y, ob.width, ob.height)) continue;
        ctx.fillStyle = '#1a2738';
        ctx.fillRect(ob.x, ob.y, ob.width, ob.height);
        drawWall(ob);
        ctx.fillStyle = 'rgba(178,205,224,0.4)';
        ctx.fillRect(ob.x, ob.y, 1 / CAMERA.zoom, ob.height);
        ctx.fillRect(ob.x + ob.width - 1 / CAMERA.zoom, ob.y, 1 / CAMERA.zoom, ob.height);
      }
      // Ladders run between their endpoints; the rails rise above the top
      // landing to mark where the player can climb back down.
      for (const ladder of ladders) {
        const top = ladder.top - 12;
        const span = ladder.bottom - top;
        if (!onScreen(view, ladder.x, top, ladder.width, span)) continue;
        const x = ladder.x;
        if (drawTerrainTile('ladder', x, top, ladder.width, span)) continue;
        ctx.fillStyle = '#65788a';
        ctx.fillRect(x, top, 3, span);
        ctx.fillRect(x + ladder.width - 3, top, 3, span);
        for (let rung = 4; rung < span; rung += 8) {
          ctx.fillRect(x + 3, top + rung, ladder.width - 6, 2);
        }
      }
      for (const obstacle of layout.solids) {
        if (obstacle.role === 'wall' || obstacle.type === 'deck') continue;
        if (!onScreen(view, obstacle.x, obstacle.y, obstacle.width, obstacle.height)) continue;
        const x = obstacle.x;
        ctx.fillStyle = TERRAIN_COLOR[obstacle.type] || TERRAIN_COLOR.platform;
        ctx.fillRect(x, obstacle.y, obstacle.width, obstacle.height);
        if (obstacle.type === 'slab' || obstacle.type === 'catwalk' || obstacle.type === 'terrace') {
          // Long decks tile the catwalk truss with a deck cap on top.
          drawTiled('platform', x, obstacle.y, obstacle.width, obstacle.height, 128);
          if (obstacle.type === 'slab') drawTiled('deckCap', x, obstacle.y, obstacle.width, 4, 128);
        } else {
          drawTerrainTile(obstacle.type, x, obstacle.y, obstacle.width, obstacle.height);
        }
        ctx.fillStyle = 'rgba(178,205,224,0.66)';
        ctx.fillRect(x, obstacle.y, obstacle.width, 1 / CAMERA.zoom);
      }
    }

    // The drawn view is the unshaken camera. Shake and shot kicks are a
    // separate screen-space render offset (see renderOffset).
    function renderView() {
      return { x: camera.x, y: camera.y };
    }

    // Overscan that keeps the frame edges covered under the largest offset.
    const WORLD_OVERSCAN = RENDER_OFFSET_CAP / CAMERA.zoom + 1;
    const BACKGROUND_OVERSCAN = 1 + 2 * (RENDER_OFFSET_CAP + 1) / height;

    function drawExpansionEnemy(e) {
      const { frame, facing } = expansionPose(e);
      const art = expansionArt[e.type];
      const footX = e.x + e.width / 2;
      const footY = e.y + e.height;
      const top = footY - frame.origin[1] * art.scale;
      const healthPct = Math.max(0, e.health) / e.maxHealth;
      const barW = Math.max(28, EXPANSION[e.type].hurt[0] * 0.7);
      ctx.fillStyle = 'rgba(50,50,50,0.8)';
      ctx.fillRect(footX - barW / 2, top - 7, barW, 4);
      ctx.fillStyle = healthPct > 0.5 ? '#33cc33' : (healthPct > 0.25 ? '#ddbb00' : '#cc3333');
      ctx.fillRect(footX - barW / 2, top - 7, barW * healthPct, 4);
      const sp = e.special;
      // Windup tell: the ranged pair show a charging aim line toward the player.
      if (sp && !sp.fired && (sp.kind === 'projectile' || sp.kind === 'laser')) {
        const [, index] = specialFrame(e.type, sp.t);
        const muzzle = specialMuzzle(e, sp.dir, index);
        const line = shotLine(muzzle, sp.dir);
        const charge = Math.min(1, sp.t / art.triggerAt);
        if (line) {
          const reach = 26 + charge * 34;
          ctx.strokeStyle = sp.kind === 'laser' ? `rgba(197,139,255,${0.25 + charge * 0.55})` : `rgba(111,200,255,${0.25 + charge * 0.55})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(muzzle.x, muzzle.y); ctx.lineTo(muzzle.x + line.ux * reach, muzzle.y + line.uy * reach); ctx.stroke();
        }
        ctx.fillStyle = sp.kind === 'laser' ? `rgba(214,170,255,${0.35 + charge * 0.6})` : `rgba(160,220,255,${0.35 + charge * 0.6})`;
        ctx.beginPath(); ctx.arc(muzzle.x, muzzle.y, 1.5 + charge * 2.2, 0, Math.PI * 2); ctx.fill();
      }
      drawExpansionFrame(e.type, frame, footX, footY, facing);
      // A pulsing glow marks the dinosaur's vulnerable landing.
      if (sp?.vulnerable) {
        ctx.globalAlpha = 0.25 + Math.sin(performance.now() / 70) * 0.12;
        ctx.fillStyle = '#ffe27a';
        ctx.fillRect(footX - 36, footY - 46, 72, 46);
        ctx.globalAlpha = 1;
      }
    }

    // Violet lances and bite arcs, drawn in code.
    function drawSpecialEffects(view) {
      for (const b of beams) {
        const t = b.life / b.maxLife;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(160,90,255,${0.35 * t})`;
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
        ctx.strokeStyle = `rgba(230,200,255,${0.9 * t})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
        ctx.fillStyle = `rgba(214,170,255,${0.8 * t})`;
        ctx.beginPath(); ctx.arc(b.x1, b.y1, 3 + (1 - t) * 4, 0, Math.PI * 2); ctx.fill();
        ctx.lineCap = 'butt';
      }
      for (const s of slashes) {
        const e = s.e;
        if (!enemies.includes(e) || !e.special) continue;
        const art = expansionArt[e.type];
        const frame = art.clips.special[art.trigger];
        const jaw = framePoint(e, frame, frame.contact, e.special.dir);
        const t = s.life / s.maxLife;
        ctx.strokeStyle = `rgba(255,236,200,${0.8 * t})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(jaw.x - e.special.dir * 6, jaw.y, 12, e.special.dir > 0 ? -1.1 : Math.PI - 0.9, e.special.dir > 0 ? 0.9 : Math.PI + 1.1);
        ctx.stroke();
      }
    }

    function drawGame() {
      const reduced = effectsReduced();
      const view = renderView();
      const offset = renderOffset(reduced);
      const zoom = CAMERA.zoom;
      // The background moves with the offset and is drawn slightly enlarged
      // about the centre so its edges never show.
      ctx.save();
      ctx.translate(width / 2 + offset.x, height / 2 + offset.y);
      ctx.scale(BACKGROUND_OVERSCAN, BACKGROUND_OVERSCAN);
      ctx.translate(-width / 2, -height / 2);
      drawStation(view);
      ctx.restore();
      // One transform maps world units to canvas pixels for everything in the
      // world. The HUD and overlays below are drawn after it is removed.
      ctx.save();
      ctx.setTransform(zoom, 0, 0, zoom, offset.x - view.x * zoom, offset.y - view.y * zoom);
      drawTerrain(view);
      drawStory(view);
      // Draw pickups
      pickups.forEach(p => {
        if (!onScreen(view, p.x, p.y, p.width, p.height, 24)) return;
        const wave = (elapsedTime * 0.006) + p.x * 0.02;
        const bob = Math.sin(wave) * 2.4;
        const pulse = 1 + Math.sin(wave * 0.8) * 0.12;
        const drawW = p.width * pulse;
        const drawH = p.height * pulse;
        const px = p.x - (drawW - p.width) / 2;
        const py = p.y + bob - (drawH - p.height) / 2;
        const icon = p.type === 'ammo' ? p.ammoType : p.type;
        const frame = clipFrame('pickups', icon);
        const iconScale = frame ? Math.max(drawW, drawH) * 1.18 / Math.max(frame[2], frame[3]) : 1;
        if (p.type === 'health') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px, py, drawW, drawH);
          ctx.strokeStyle = '#8eff95';
          ctx.lineWidth = 1;
          ctx.strokeRect(px - 1, py - 1, drawW + 2, drawH + 2);
          ctx.fillStyle = '#ff4444';
          ctx.fillRect(px + drawW * 0.2, py + drawH * 0.45, drawW * 0.6, drawH * 0.1);
          ctx.fillRect(px + drawW * 0.45, py + drawH * 0.2, drawW * 0.1, drawH * 0.6);
        } else if (!drawSprite('pickups', frame, px + drawW / 2, py + drawH / 2, 1, iconScale) &&
                   !drawLegacy(LEGACY[icon], px, py, drawW, drawH)) {
          ctx.fillStyle = p.type === 'gold' ? '#ffd700' : '#55ddff';
          ctx.fillRect(px, py, drawW, drawH);
        }
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = p.type === 'gold' ? '#ffd700' : (p.type === 'health' ? '#88ff88' : '#55ddff');
        ctx.beginPath();
        ctx.ellipse(px + drawW / 2, py + drawH / 2, drawW * 1.2, drawH * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
        if (p.type === 'ammo') {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = AMMO_COLOR[p.ammoType] || AMMO_COLOR.rifle;
          ctx.fillRect(px - 1, py + drawH + 1, drawW + 2, 1.5);
        }
        ctx.globalAlpha = 1;
      });


      // Draw enemies. Sprites extend past the collision box, hence the margin.
      enemies.forEach(e => {
        if (!onScreen(view, e.x, e.y, e.width, e.height, 90)) return;
        if (EXPANSION[e.type] && expansionArt[e.type]) { drawExpansionEnemy(e); return; }
        const px = e.x;
        const { frame, facing } = enemySprite(e);
        const originY = enemyOrigin(e);
        const barY = Math.min(e.y, frame ? originY - frame[5] * ACTOR_SCALE : e.y) - 8;
        const healthPct = Math.max(0, e.health) / e.maxHealth;
        ctx.fillStyle = 'rgba(50,50,50,0.8)';
        ctx.fillRect(px, barY, e.width, 4);
        ctx.fillStyle = healthPct > 0.5 ? '#33cc33' : (healthPct > 0.25 ? '#ddbb00' : '#cc3333');
        ctx.fillRect(px, barY, e.width * healthPct, 4);

        if (e.queuedShot && e.windupTimer > 0) {
          const chargePct = 1 - e.windupTimer / RANGED[e.type].windup;
          const aimDir = e.targetDir || (player.x < e.x ? -1 : 1);
          const eyeX = px + (aimDir < 0 ? 2 : e.width - 2);
          const eyeY = e.y + e.height / 2;
          ctx.strokeStyle = e.type === 'robot' ? `rgba(255,170,90,${0.25 + chargePct * 0.55})` : `rgba(255,207,105,${0.2 + chargePct * 0.5})`;
          ctx.lineWidth = e.type === 'robot' ? 2 : 1.5;
          ctx.beginPath();
          ctx.moveTo(eyeX, eyeY);
          ctx.lineTo(eyeX + aimDir * (28 + chargePct * 20), eyeY);
          ctx.stroke();
        }

        if (!drawSprite('enemies', frame, px + e.width / 2, originY, facing)) {
          const frames = LEGACY[e.type];
          const tile = frames?.[Math.floor(e.animTime / 140) % frames.length];
          if (!drawLegacy(tile, px, e.y, e.width, e.height, facing)) {
            ctx.fillStyle = ENEMY_COLOR[e.type];
            ctx.fillRect(px, e.y, e.width, e.height);
          }
        }
      });
      for (const enemy of fallenSprites) {
        if (!onScreen(view, enemy.x, enemy.y, enemy.width, enemy.height, 90)) continue;
        if (EXPANSION[enemy.type] && expansionArt[enemy.type]) {
          drawExpansionFrame(enemy.type, expansionArt[enemy.type].clips.downed[0], enemy.x + enemy.width / 2, enemy.y + enemy.height, enemy.facing);
          continue;
        }
        const frame = clipFrame('enemies', enemy.type + 'Down', elapsedTime - enemy.at);
        drawSprite('enemies', frame, enemy.x + enemy.width / 2, enemyOrigin(enemy), enemy.facing);
      }
      // Draw particle effects if enabled
      if (SETTINGS.particles) {
        particles.forEach(p => {
          const size = p.size || 2.2;
          if (!onScreen(view, p.x, p.y, 0, 0, size * 2)) return;
          const alpha = Math.max(0, p.life / p.maxLife);
          ctx.globalAlpha = alpha * (p.glow ? 0.38 + p.glow : 0.5);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size * 1.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
          ctx.fillRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
          ctx.globalAlpha = 1;
        });
      }
      // A short, velocity-aligned tracer follows each bright projectile core.
      bullets.forEach(b => {
        if (!onScreen(view, b.x, b.y, b.width, b.height, 26)) return;
        const x = b.x + b.width / 2;
        const y = b.y + b.height / 2;
        const speed = Math.hypot(b.vx, b.vy);
        const trail = Math.min(SHOT_FEEDBACK[b.weapon].trail, Math.hypot(x - b.muzzleX, y - b.muzzleY));
        const laser = b.weapon === 'laser';
        ctx.strokeStyle = laser ? 'rgba(78,239,255,0.58)' : 'rgba(255,185,74,0.68)';
        ctx.lineWidth = laser ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(x - b.vx / speed * trail, y - b.vy / speed * trail);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(8,14,26,0.8)';
        ctx.fillRect(x - b.width / 2 - 0.7, y - b.height / 2 - 0.7, b.width + 1.4, b.height + 1.4);
        ctx.fillStyle = laser ? '#d1ffff' : '#fff6ce';
        ctx.fillRect(x - b.width / 2, y - b.height / 2, b.width, b.height);
      });
      // Draw muzzle/shot flashes
      shotFlashes.forEach(f => {
        if (!onScreen(view, f.x, f.y, 0, 0, 24)) return;
        const t = f.life / f.maxLife;
        const len = f.kind === 'laser' ? 20 : (f.kind === 'shotgun' ? 15 : 10);
        ctx.globalAlpha = Math.max(0, t * (reduced ? 0.35 : 0.9));
        ctx.strokeStyle = f.kind === 'laser' ? '#99ffff' : '#ffdd88';
        ctx.lineWidth = f.kind === 'shotgun' ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x + f.dirX * len, f.y + f.dirY * len);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      // Draw enemy bullets
      drawSpecialEffects(view);
      enemyBullets.forEach(b => {
        if (!onScreen(view, b.x, b.y, b.width, b.height, 4)) return;
        if (b.kind === 'police') {
          // Blue breach pulse with a short glowing tail along its flight.
          const cx = b.x + b.width / 2, cy = b.y + b.height / 2, sp = Math.hypot(b.vx, b.vy) || 1;
          ctx.strokeStyle = 'rgba(80,170,255,0.45)';
          ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(cx - b.vx / sp * 14, cy - b.vy / sp * 14); ctx.lineTo(cx, cy); ctx.stroke();
          ctx.strokeStyle = '#bfe6ff';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx - b.vx / sp * 7, cy - b.vy / sp * 7); ctx.lineTo(cx + b.vx / sp * 3, cy + b.vy / sp * 3); ctx.stroke();
          return;
        }
        ctx.fillStyle = 'rgba(255,92,92,0.35)';
        ctx.fillRect(b.x - 1, b.y - 1, b.width + 2, b.height + 2);
        ctx.fillStyle = b.kind === 'alien' ? '#ffc75b' : '#ff6668';
        ctx.fillRect(b.x, b.y, b.width, b.height);
        ctx.fillStyle = '#fff0ce';
        ctx.fillRect(b.x + (b.vx > 0 ? b.width - 3 : 0), b.y + 1, 3, 2);
      });
      // Draw player
      const ppx = player.x;
      const { frame, kick } = playerSprite();
      if (!drawSprite('player', frame, ppx + player.width / 2, player.y + player.height, player.facing, ACTOR_SCALE, kick)) {
        const frames = !player.onGround ? LEGACY.playerJump
          : Math.abs(player.vx) > 0.1 ? LEGACY.playerRun : LEGACY.playerIdle;
        const tile = frames[Math.floor(player.animTime / 110) % frames.length];
        if (!drawLegacy(tile, ppx, player.y, player.width, player.height, player.facing)) {
          ctx.fillStyle = '#0077ff';
          ctx.fillRect(ppx, player.y, player.width, player.height);
        }
      }
      ctx.restore();

      // Screen space from here on. Floating text keeps its canvas size and
      // follows its world position.
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      floatingTexts.forEach(t => {
        ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, (t.x - view.x) * zoom + offset.x, (t.y - view.y) * zoom + offset.y);
      });
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';

      if (damageOverlayTimer > 0) {
        const alpha = (damageOverlayTimer / 120) * (reduced ? 0.055 : 0.18);
        ctx.fillStyle = `rgba(255,45,40,${alpha})`;
        ctx.fillRect(0, 0, width, height);
      }
      if (gameState === 'play') {
        drawHUD();
        drawStageBanner();
      }
    }

    // A short title card when a stage begins.
    function drawStageBanner() {
      if (!stageBanner) return;
      const age = performance.now() - stageBanner.at;
      if (age > 2600) { stageBanner = null; return; }
      const alpha = Math.min(1, age / 250, (2600 - age) / 500);
      ctx.globalAlpha = alpha;
      ctx.font = '700 26px "Barlow Condensed", system-ui, sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(stageBanner.text).width + 36;
      ctx.fillStyle = 'rgba(10,18,29,0.82)';
      // Below the HUD and objective panel, above the player's deck.
      ctx.fillRect(width / 2 - w / 2, 150, w, 40);
      ctx.fillStyle = '#ffe3b8';
      ctx.fillText(stageBanner.text, width / 2, 179);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    function drawHUD() {
      const health = Math.max(0, Math.ceil(player.health));
      const weapon = WEAPONS[player.weapon];
      const rounds = player.ammoInClip[player.weapon];
      const low = rounds <= Math.max(1, Math.floor(weapon.magazine * 0.25));
      ctx.fillStyle = 'rgba(10,18,29,0.96)';
      ctx.fillRect(9, 8, 324, 48);
      ctx.strokeStyle = '#415368';
      ctx.lineWidth = 1;
      ctx.strokeRect(9.5, 8.5, 324, 48);
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillStyle = '#e5eff5';
      ctx.fillText(`HP ${health}%`, 19, 29);
      ctx.fillStyle = '#26374a';
      ctx.fillRect(19, 41, 71, 5);
      ctx.fillStyle = health > 30 ? '#8adddf' : '#f39a7f';
      ctx.fillRect(19, 41, 71 * health / 100, 5);
      ctx.fillStyle = '#e5eff5';
      ctx.fillText(weapon.name, 107, 29);
      ctx.fillStyle = low ? '#f4c37b' : '#e5eff5';
      ctx.fillText(`${rounds} / ${player.reserveAmmo[player.weapon]}`, 181, 29);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f4c37b';
      ctx.fillText(`${player.gold} G`, 323, 29);
      ctx.textAlign = 'left';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.fillStyle = '#aebed0';
      if (player.reloading) {
        const duration = WEAPONS[player.reloadWeaponKey || player.weapon].reloadTime;
        const progress = Math.max(0, Math.min(1, 1 - player.reloadTimer / duration));
        ctx.fillText('Reloading', 107, 47);
        ctx.fillStyle = '#26374a';
        ctx.fillRect(167, 41, 83, 5);
        ctx.fillStyle = '#8adddf';
        ctx.fillRect(167, 41, 83 * progress, 5);
      } else {
        ctx.fillText('MAG / RES', 181, 46);
      }
      ctx.textAlign = 'right';
      ctx.fillStyle = '#8adddf';
      ctx.fillText(playMode === 'quickplay' ? 'QUICKPLAY' : `STAGE ${stageIndex + 1}/${STAGES.length}`, 323, 46);
      ctx.textAlign = 'left';
    }

    // Native menu controls sit over the Canvas, sharing the game's keyboard
    // selection indices and shop actions with the touch controls.
    const menuLayer = document.getElementById('game-menu');
    let menuMode;
    let menuRows = [];
    let shopGold;
    let shopStatus;

    function element(tag, className, value) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (value) node.textContent = value;
      return node;
    }

    function selectedRow() {
      if (gameState === 'start') return startMenuSelection;
      if (gameState === 'menu') return mainMenuSelection;
      if (gameState === 'settings') return settingsSelection;
      if (gameState === 'shop') return menuSelection;
      if (gameState === 'map') return mapRow;
      if (gameState === 'gameover') return endSelection;
      if (gameState === 'credits') return 0;
      return 0;
    }

    function selectRow(index) {
      if (gameState === 'start') startMenuSelection = index;
      if (gameState === 'menu') mainMenuSelection = index;
      if (gameState === 'settings') settingsSelection = index;
      if (gameState === 'shop') menuSelection = index;
      if (gameState === 'map') {
        mapRow = index;
        if (index < STAGES.length) mapPick = index;
      }
      if (gameState === 'gameover') endSelection = index;
    }

    // Waypoint status for the campaign: cleared, available or locked.
    function waypointStatus(stage) {
      if (campaign.cleared.includes(stage.id)) return 'cleared';
      return campaign.unlocked.includes(stage.id) ? 'available' : 'locked';
    }

    function unlockCondition(stage) {
      const previous = STAGES[stageOrder(stage.id) - 1];
      return previous ? `Clear ${previous.name} in the campaign to unlock.` : '';
    }

    let mapParts = null;
    function buildStarMap(panel) {
      const body = element('div', 'map-body');
      const chart = element('div', 'star-map');
      const art = element('img', 'star-map-art');
      art.alt = '';
      art.decoding = 'async';
      // Without the backdrop the waypoints become a plain list over the title art.
      art.addEventListener('load', () => chart.classList.add('has-art'));
      art.addEventListener('error', () => {
        chart.classList.add('no-art');
        menuLayer.classList.add('map-fallback');
      });
      art.src = 'assets/ui/star-map.webp';
      chart.append(art);
      const svgNS = 'http://www.w3.org/2000/svg';
      const route = document.createElementNS(svgNS, 'svg');
      route.setAttribute('class', 'map-route');
      route.setAttribute('viewBox', '0 0 100 100');
      route.setAttribute('preserveAspectRatio', 'none');
      route.setAttribute('aria-hidden', 'true');
      const segments = [];
      for (let i = 1; i < STAGES.length; i++) {
        const line = document.createElementNS(svgNS, 'line');
        const [x1, y1] = STAGES[i - 1].map;
        const [x2, y2] = STAGES[i].map;
        line.setAttribute('x1', x1 * 100); line.setAttribute('y1', y1 * 100);
        line.setAttribute('x2', x2 * 100); line.setAttribute('y2', y2 * 100);
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        route.append(line);
        segments.push(line);
      }
      chart.append(route);
      const list = element('ol', 'waypoints');
      list.setAttribute('aria-label', 'Waypoints');
      STAGES.forEach((stage, i) => {
        const item = element('li');
        const row = addMenuRow(item, stage.name, i, true);
        row.classList.add('waypoint');
        row.style.setProperty('--x', `${stage.map[0] * 100}%`);
        row.style.setProperty('--y', `${stage.map[1] * 100}%`);
        // The ring frames the planet; only the label carries a background.
        const label = element('span', 'wp-label');
        label.append(...row.childNodes);
        row.append(element('span', 'wp-marker'), label);
        list.append(item);
      });
      chart.append(list);
      const side = element('div', 'map-side');
      const brief = element('article', 'map-brief');
      brief.id = 'map-brief';
      brief.setAttribute('aria-live', 'polite');
      const briefName = element('h3');
      const briefStatus = element('p', 'map-status');
      const briefObjective = element('p', 'map-objective');
      const briefText = element('p', 'map-text');
      brief.append(briefName, briefStatus, briefObjective, briefText);
      const actions = element('div', 'menu-options map-actions');
      // Campaign Continue is the amber primary action; Quickplay is a
      // separate cyan-outlined run that never touches campaign progress.
      addMenuRow(actions, 'Continue', STAGES.length, true).classList.add('action-campaign');
      addMenuRow(actions, 'Quickplay', STAGES.length + 1, true).classList.add('action-quickplay');
      addMenuRow(actions, 'Back', STAGES.length + 2, false).classList.add('action-back');
      const notice = element('p', 'map-notice');
      notice.setAttribute('role', 'status');
      side.append(brief, actions, notice);
      body.append(chart, side);
      panel.append(body);
      mapParts = { segments, briefName, briefStatus, briefObjective, briefText, notice };
    }

    function syncStarMap() {
      const statusText = { cleared: 'Cleared', available: 'Available', locked: 'Locked' };
      STAGES.forEach((stage, i) => {
        const { row, value } = menuRows[i];
        const status = waypointStatus(stage);
        const next = campaign.entry?.stage === stage.id;
        row.dataset.status = status;
        row.dataset.next = String(next);
        row.setAttribute('aria-pressed', String(i === mapPick));
        const picked = i === mapPick;
        // Every state is written out, not only coloured.
        value.textContent = (status === 'locked' ? '🔒 ' : status === 'cleared' ? '✓ ' : '') + statusText[status] +
          (next ? ' · Next' : '') + (picked ? ' · Selected' : '');
        // Spoken state: name, status and, when locked, how to unlock it.
        row.setAttribute('aria-label', `${stage.name}. ${statusText[status]}${next ? ', next campaign stop' : ''}${picked ? ', selected' : ''}. ${status === 'locked' ? unlockCondition(stage) : ''}`.trim());
      });
      mapParts.segments.forEach((line, i) => line.setAttribute('class', campaign.unlocked.includes(STAGES[i + 1].id) ? 'open' : 'locked'));
      const picked = STAGES[mapPick];
      const status = waypointStatus(picked);
      mapParts.briefName.textContent = picked.name;
      mapParts.briefStatus.textContent = status === 'locked' ? `Locked · ${unlockCondition(picked)}` : statusText[status];
      mapParts.briefObjective.textContent = status === 'locked' ? '' : picked.objective;
      mapParts.briefText.textContent = status === 'locked' ? '' : picked.briefing;
      const entry = campaign.entry;
      const complete = STAGES.every(stage => campaign.cleared.includes(stage.id));
      const cont = menuRows[STAGES.length];
      cont.name.textContent = entry ? `Continue · ${stageById(entry.stage).name}` : (complete ? 'Replay campaign' : 'Start campaign');
      const kit = entry?.checkpoint?.loadout || entry?.loadout;
      cont.value.textContent = entry ? `${entry.checkpoint ? 'Checkpoint · ' : ''}${WEAPONS[kit.weapon].name} · ${kit.health}% · ${kit.gold} G` : 'From Space Station';
      const quick = menuRows[STAGES.length + 1];
      const locked = status === 'locked';
      quick.name.textContent = `Quickplay · ${picked.name}`;
      quick.value.textContent = locked ? 'Locked' : 'Standalone loadout';
      quick.row.setAttribute('aria-disabled', String(locked));
      mapParts.notice.textContent = storageNotice;
    }

    function addMenuRow(parent, label, index, detail) {
      const row = element('button', 'menu-row');
      row.type = 'button';
      const name = element('span', '', label);
      row.append(name);
      const value = detail ? element('span', 'menu-detail') : null;
      if (value) row.append(value);
      row.addEventListener('focus', () => {
        selectRow(index);
        syncMenu();
      });
      row.addEventListener('click', () => {
        selectRow(index);
        handleMenuInput({ key: 'Enter' });
      });
      parent.append(row);
      menuRows[index] = { row, name, value };
      return row;
    }

    function addBackButton(parent, label, className) {
      const back = element('button', className, label);
      back.type = 'button';
      back.addEventListener('click', () => handleMenuInput({ key: 'Escape' }));
      parent.append(back);
    }

    function buildMenu(mode) {
      menuRows = [];
      menuLayer.replaceChildren();
      menuLayer.classList.toggle('title-art', mode === 'start');
      menuLayer.classList.toggle('map-layer', mode === 'map');
      menuLayer.classList.remove('map-fallback');
      menuLayer.hidden = mode === 'play' || mode === 'boot' || mode === 'scene';
      if (menuLayer.hidden) return;

      const panel = element('section', mode === 'shop' ? 'menu-panel shop-panel' : (mode === 'map' ? 'menu-panel map-panel' : 'menu-panel'));
      const endHeading = { dead: 'Game over', quickplay: 'Quickplay clear', cleared: 'Stage clear', complete: 'Mission complete' }[endKind] || 'Game over';
      const heading = element(mode === 'start' ? 'h1' : 'h2', '', {
        start: 'SPACE COMMANDO', menu: 'Paused', settings: 'Settings', shop: 'Shop', map: 'Star map', credits: 'Credits',
        gameover: endHeading
      }[mode]);
      heading.id = 'menu-heading';
      panel.setAttribute('aria-labelledby', heading.id);
      menuLayer.append(panel);
      if (mode === 'shop') {
        const header = element('div', 'shop-heading');
        shopGold = element('span', 'shop-gold');
        header.append(heading, shopGold);
        panel.append(header);
        const grid = element('div', 'shop-grid');
        for (const [column, title] of ['Weapons', 'Ammunition'].entries()) {
          const group = element('section', 'shop-group');
          group.append(element('h3', '', title));
          const list = element('div', 'menu-options');
          SHOP_ITEMS.slice(column * 4, (column + 1) * 4).forEach((item, i) => {
            const weapon = WEAPONS[item.key];
            const row = addMenuRow(list, weapon?.name || item.name, column * 4 + i, true);
            row.classList.add('shop-row');
            const detail = weapon ? `Damage ${weapon.damage} · Mag ${weapon.magazine}` : `+${item.qty} to reserve`;
            row.append(element('small', '', detail));
          });
          group.append(list);
          grid.append(group);
        }
        panel.append(grid);
        const footer = element('div', 'shop-footer');
        shopStatus = element('output');
        footer.append(shopStatus);
        addBackButton(footer, 'Close shop', 'system-button');
        panel.append(footer);
        return;
      }

      panel.append(heading);
      if (mode === 'map') {
        buildStarMap(panel);
        return;
      }
      if (mode === 'credits') {
        panel.classList.add('credits-panel');
        const roll = element('div', 'credits-roll');
        // Focusable and labelled, so keyboard and screen-reader users can read it.
        roll.tabIndex = 0;
        roll.setAttribute('role', 'region');
        roll.setAttribute('aria-label', 'Credits');
        for (const [title, lines] of CREDITS) {
          const section = element('section');
          section.append(element('h3', '', title));
          for (const line of lines) if (line) section.append(element('p', '', line));
          roll.append(section);
        }
        // A touch, wheel or drag on the roll holds the auto-scroll.
        for (const type of ['pointerdown', 'wheel', 'touchstart']) {
          roll.addEventListener(type, () => { creditsRoll.holdUntil = performance.now() + 3000; }, { passive: true });
        }
        panel.append(roll);
        panel.append(element('p', 'menu-hint', effectsReduced() ? 'Scroll or use the arrow keys to read.' : 'The credits scroll on their own; scroll or use the arrow keys to read at your pace.'));
        const options = element('div', 'menu-options');
        addMenuRow(options, creditsFrom === 'complete' ? 'Skip credits' : 'Back', 0, false).classList.add('primary');
        panel.append(options);
        return;
      }
      const options = element('div', 'menu-options');
      const labels = {
        start: ['Star map', 'Settings', 'Credits'],
        menu: ['Resume', 'Retry stage', 'Star map', 'Settings'],
        settings: ['Difficulty', 'Music', 'Particles', 'Camera shake and flashes', 'Sound effects', 'Haptics'],
        gameover: endOptions.map(([label]) => label)
      }[mode];
      if (mode === 'gameover') {
        const stage = STAGES[stageIndex];
        const next = STAGES[stageIndex + 1];
        const summary = {
          dead: playMode === 'quickplay' ? `Quickplay · ${stage.name}` : `Reached stage ${stageIndex + 1} · ${stage.name}`,
          quickplay: `${stage.name} cleared · campaign progress unchanged`,
          cleared: `${stage.name} cleared · ${next?.name} unlocked`,
          complete: `All ${STAGES.length} stages cleared`
        }[endKind] || stage.name;
        const data = playMode === 'campaign' ? STORY.STAGES[stage.id] : null;
        if (endKind === 'dead' && endReason) panel.append(element('p', 'gameover-summary', endReason));
        if (data && (endKind === 'cleared' || endKind === 'complete')) panel.append(element('p', 'gameover-story', data.clear));
        panel.append(element('p', 'gameover-summary', `${summary} · Gold: ${player.gold}`));
        if (data && endKind === 'complete' && data.endCard) panel.append(element('p', 'gameover-card', data.endCard));
      }
      labels.forEach((label, index) => {
        const row = addMenuRow(options, label, index, mode === 'settings');
        // The first action on the start, pause and results screens is the primary one.
        if (index === 0 && (mode === 'start' || mode === 'menu' || mode === 'gameover')) row.classList.add('primary');
      });
      panel.append(options);
      if (mode === 'settings') addBackButton(panel, 'Back', 'system-button menu-back');
      if (mode === 'start' && !isMobile) {
        panel.append(element('p', 'menu-hint', 'Move: A/D or arrows · Jump: Space · Fire: Z · Reload: X · Interact: E · Shop: P'));
      }
    }

    function syncMenu(moveFocus = false) {
      const mode = document.body.dataset.boot === 'ready' ? gameState : 'boot';
      const changed = mode !== menuMode;
      if (changed) {
        menuMode = mode;
        buildMenu(mode);
        document.body.toggleAttribute('data-playing', mode === 'play' || mode === 'scene');
        document.body.dataset.state = mode;
      }
      if (menuLayer.hidden) return;
      const selected = selectedRow();
      menuRows.forEach(({ row }, i) => {
        row.dataset.selected = String(i === selected);
      });

      if (mode === 'start') {
        menuRows[0].row.disabled = !artReady;
        menuRows[0].name.textContent = artReady ? 'Star map' : 'Loading sprites…';
      } else if (mode === 'settings') {
        const effectText = SETTINGS.effects === 'system' ? (effectsReduced() ? 'System · Reduced' : 'System · Full') :
          SETTINGS.effects === 'full' ? 'Full' : 'Reduced';
        const hapticText = hapticsSupported ? (SETTINGS.haptics ? 'On' : 'Off') : (SETTINGS.haptics ? 'On · not supported' : 'Off');
        const values = [SETTINGS.difficulty, AUDIO_LEVEL_NAMES[SETTINGS.musicLevel], SETTINGS.particles ? 'On' : 'Off', effectText, AUDIO_LEVEL_NAMES[SETTINGS.sfxLevel], hapticText];
        menuRows.forEach(({ value }, i) => { value.textContent = values[i]; });
      } else if (mode === 'map') {
        syncStarMap();
      } else if (mode === 'shop') {
        shopGold.textContent = `${player.gold} gold`;
        shopStatus.textContent = shopNotice;
        SHOP_ITEMS.forEach((item, i) => {
          const owned = item.type === 'weapon' && player.ownedWeapons[item.key];
          const value = owned ? (player.weapon === item.key ? 'Equipped' : 'Equip') :
            `${item.cost ?? WEAPONS[item.key].cost} G`;
          menuRows[i].value.textContent = value;
        });
      }
      if (changed || moveFocus) {
        const row = menuRows[selected]?.row;
        if (row && !row.disabled) row.focus();
      }
    }

    document.addEventListener('commando-ready', () => syncMenu());
    motionPreference.addEventListener?.('change', () => syncMenu());
    syncMenu();

    // Fixed simulation ticks keep input, movement, enemy AI and shot cadence
    // consistent on fast and slow displays. Drop excess time after a stall.
    function loop(now) {
      const frameMs = lastTime === null ? 0 : Math.min(MAX_FRAME_MS, now - lastTime);
      lastTime = now;
      if (gameState === 'play' && !document.hidden) {
        accumulator += frameMs;
        while (accumulator + 0.000001 >= STEP_MS && gameState === 'play') {
          accumulator = Math.max(0, accumulator - STEP_MS);
          updateGame(STEP_MS);
        }
      } else {
        accumulator = 0;
      }
      if (gameState === 'scene' && scene && !document.hidden && windowFocused) {
        scene.left -= frameMs;
        if (scene.left <= 0) advanceScene();
      }
      syncStoryHud();
      updateCreditsRoll(now);
      if ((document.body.dataset.boot === 'ready' && gameState !== menuMode) ||
          (menuMode === 'start' && menuRows[0].row.disabled !== !artReady)) syncMenu();
      updateMusic(now);
      drawGame();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
  // Wait for DOM to be ready then initialize
  window.addEventListener('load', init);
})();
