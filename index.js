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

  const ACTOR_SCALE = 0.5;
  const ENEMY_COLOR = { zombie: '#00aa00', ghost: '#aaaaff', robot: '#ff8844', alien: '#55ff55' };
  const ENEMY_FALL = { zombie: 540, ghost: 440, robot: 540, alien: 540 };

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
  const CAMERA = {
    zoom: 1.4,
    anchor: 0.39,      // player centre as a fraction of view width when facing right
    lead: 24,          // world units of extra look-ahead at full run speed
    leadMs: 240,       // lead smoothing time constant
    turnMs: 420,       // critically damped settle when the player turns
    followXMs: 60,     // horizontal follow time constant
    followYMs: 150,    // vertical settle time
    headroom: 64,      // dead zone above the collision top: sprite (16) + HUD band (41) + margin
    footroom: 22       // dead zone: keep this much space below the next landing
  };
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
    musicVolume: 0.6
  };

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
            fallback: 'game-background-music.mp3', fallbackTail: 6.9, fallbackGain: 1 }
  };
  const MUSIC_FADE_MS = 700;

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
    shotVoices[key].forEach(voice => { voice.volume = key === 'rifle' ? 0.28 : 0.22; });
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
    const camera = { x: 0, y: maxViewY, look: 1, lookVelocity: 0, lead: 0, yVelocity: 0, support: groundY };

    // Music tracks start with metadata only and stream once they play.
    const music = {};
    let musicBlocked = false;
    let musicLast = null;
    function startTrack(track) {
      if (track.pending) return;
      track.pending = true;
      track.audio.preload = 'auto';
      const done = () => { track.pending = false; };
      const attempt = track.audio.play();
      // Autoplay rejection waits for the next gesture instead of retrying every frame.
      if (attempt?.then) attempt.then(done, () => { done(); musicBlocked = true; });
      else done();
    }
    for (const [name, def] of Object.entries(MUSIC_TRACKS)) {
      const audio = new Audio();
      audio.preload = 'metadata';
      const track = { name, audio, level: 0, gain: def.gain, tail: def.tail, failed: false, pending: false };
      audio.addEventListener('error', () => {
        if (track.failed) return;
        track.failed = true;
        track.gain = def.fallbackGain;
        track.tail = def.fallbackTail;
        audio.src = encodeURI(def.fallback);
        audio.load();
      });
      // Loop inside the silent tail rather than waiting for the file end.
      audio.addEventListener('timeupdate', () => {
        if (track.tail && audio.duration && audio.currentTime >= audio.duration - track.tail + 0.12) audio.currentTime = 0;
      });
      audio.addEventListener('ended', () => {
        audio.currentTime = 0;
        if (track.level > 0) startTrack(track);
      });
      audio.src = encodeURI(def.src);
      music[name] = track;
    }
    for (const event of ['pointerdown', 'keydown']) {
      window.addEventListener(event, () => { musicBlocked = false; }, { capture: true, passive: true });
    }
    // Hidden tabs pause at once; the director fades back in on return.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { musicLast = null; return; }
      for (const track of Object.values(music)) {
        track.audio.pause();
        track.level = 0;
        track.audio.volume = 0;
      }
    });

    function wantedMusic() {
      if (document.body.dataset.boot !== 'ready' || !SETTINGS.audio || document.hidden) return null;
      return gameState === 'play' ? 'play' : 'menu';
    }

    // Called every frame: fade each track toward its target for the state.
    function updateMusic(now) {
      const dt = musicLast === null ? 0 : Math.min(100, now - musicLast);
      musicLast = now;
      const wanted = wantedMusic();
      for (const track of Object.values(music)) {
        const target = track.name === wanted ? Math.min(1, track.gain * SETTINGS.musicVolume) : 0;
        const step = dt / MUSIC_FADE_MS;
        // A track that is not playing yet (blocked or buffering) waits at zero, so it still fades in.
        if (target > track.level && !track.audio.paused) track.level = Math.min(target, track.level + step);
        else if (target < track.level) track.level = Math.max(target, track.level - step);
        if (target > 0 && track.audio.paused && !musicBlocked && !document.hidden) startTrack(track);
        track.audio.volume = Math.max(0, Math.min(1, track.level));
        if (!target && !track.level && !track.audio.paused) track.audio.pause();
      }
    }
    window.commandoMusic = { tracks: music, wanted: wantedMusic };

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
        // Pause menu options: 0: Return to Game, 1: Restart Game, 2: Game Settings
        const optionsCount = 3;
        if (e.key === 'ArrowUp') {
          mainMenuSelection = (mainMenuSelection + optionsCount - 1) % optionsCount;
        } else if (e.key === 'ArrowDown') {
          mainMenuSelection = (mainMenuSelection + 1) % optionsCount;
        } else if (e.key === 'Enter') {
          if (mainMenuSelection === 0) {
            // Return to game
            gameState = 'play';
          } else if (mainMenuSelection === 1) {
            // Restart game and return to start menu
            restart();
            gameState = 'start';
            startMenuSelection = 0;
          } else if (mainMenuSelection === 2) {
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
          } else if (key === 'audio') {
            // Toggle music; the music director follows on the next frame.
            SETTINGS.audio = !SETTINGS.audio;
          } else if (key === 'particles') {
            SETTINGS.particles = !SETTINGS.particles;
          } else if (key === 'sfx') {
            SETTINGS.sfx = !SETTINGS.sfx;
            if (!SETTINGS.sfx) {
              stopEffects();
              selectSfx.pause();
            }
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
        // Start menu options: 0 Start Game, 1 Game Settings
        const optionsCount = 2;
        if (e.key === 'ArrowUp') {
          startMenuSelection = (startMenuSelection + optionsCount - 1) % optionsCount;
        } else if (e.key === 'ArrowDown') {
          startMenuSelection = (startMenuSelection + 1) % optionsCount;
        } else if (e.key === 'Enter') {
          if (startMenuSelection === 0) {
            if (!artReady) return;
            // Begin gameplay
            restart();
            gameState = 'play';
          } else if (startMenuSelection === 1) {
            // open settings from start menu
            prevSettingsState = 'start';
            settingsSelection = 0;
            gameState = 'settings';
          }
          // Play selection sound on start menu action
          playLegacyEffect(selectSfx);
        }
        // no escape action on start menu
      } else if (gameState === 'gameover') {
        if (e.key === 'Enter') {
          restart();
          // return to start screen after death
          gameState = 'start';
          startMenuSelection = 0;
          // Play selection sound on restart
          playLegacyEffect(selectSfx);
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
      handleMenuInput(e);
    });
    document.addEventListener('keyup', e => {
      const key = gameplayKey(e.key);
      releaseGameplayKey(keyboardKeys, key);
      if (scrollKeys.includes(key) && !(key === 'Space' && e.target?.closest?.('button'))) e.preventDefault();
    });
    window.addEventListener('blur', resetGameplayInput);
    document.addEventListener('visibilitychange', resetGameplayInput);
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
      if (ctrlBar) {
        ctrlBar.hidden = false;
        document.body.setAttribute('data-touch', '');

        const buttons = Array.from(ctrlBar.querySelectorAll('.control-btn'));
        const menuKeys = new Set(['Enter', 'Escape', 'p', 'P', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
        const pointerToButton = new Map();
        const activePointersByButton = new Map();
        const directionPad = ctrlBar.querySelector('.direction-pad');
        const directionPointers = new Set();
        // A pointer activation is followed by a compatibility click whose
        // detail can be 0 on touch screens. Remember when each control was
        // last pressed or released by a pointer so that click is ignored.
        const pointerActivity = new WeakMap();
        const POINTER_CLICK_WINDOW = 1000;

        const pressButton = (btn, keyName, pointerId, event, pointerType) => {
          if (event.cancelable) event.preventDefault();
          event.stopPropagation();

          const setForButton = activePointersByButton.get(btn) || new Set();
          if (setForButton.has(pointerId)) return;

          setForButton.add(pointerId);
          activePointersByButton.set(btn, setForButton);
          pointerToButton.set(pointerId, btn);
          if (setForButton.size === 1) btn.classList.add('pressed');
          pressGameplayKey(touchKeys, keyName);

          // Fire is confirmed by the per-round shot pulse instead.
          if ((pointerType === 'touch' || pointerType === 'pen') && keyName !== 'z' && canPulse()) navigator.vibrate(10);

          if (menuKeys.has(keyName) && setForButton.size === 1) {
            handleMenuInput({ key: keyName, repeat: false });
          }
        };

        const releaseButton = (btn, keyName, pointerId, event) => {
          const setForButton = activePointersByButton.get(btn);
          if (!setForButton || !setForButton.has(pointerId)) return;

          if (event && event.cancelable) event.preventDefault();
          if (event) event.stopPropagation();

          setForButton.delete(pointerId);
          pointerToButton.delete(pointerId);
          releaseGameplayKey(touchKeys, keyName);

          if (setForButton.size === 0) {
            activePointersByButton.delete(btn);
            btn.classList.remove('pressed');
          }
        };

        clearTouchInputs = () => {
          pointerToButton.forEach((btn, pointerId) => {
            const keyName = btn.getAttribute('data-key');
            releaseButton(btn, keyName, pointerId);
          });
          touchKeys.clear();
          activePointersByButton.clear();
          directionPointers.clear();
          pointerToButton.clear();
          buttons.forEach((btn) => btn.classList.remove('pressed'));
        };

        const finishPointer = event => {
          const { pointerId } = event;
          directionPointers.delete(pointerId);
          const current = pointerToButton.get(pointerId);
          if (current) releaseButton(current, current.dataset.key, pointerId, event);
        };

        buttons.forEach((btn) => {
          const keyName = btn.dataset.key;

          btn.addEventListener('pointerdown', (event) => {
            pointerActivity.set(btn, performance.now());
            if (event.pointerType !== 'mouse' && directionPad.contains(btn)) {
              directionPointers.add(event.pointerId);
            }
            pressButton(btn, keyName, event.pointerId, event, event.pointerType);
            if (btn.setPointerCapture) {
              try { btn.setPointerCapture(event.pointerId); } catch (err) {}
            }
          }, { passive: false });

          for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            btn.addEventListener(type, finishPointer, { passive: false });
          }
          btn.addEventListener('pointerup', () => pointerActivity.set(btn, performance.now()));

          btn.addEventListener('pointerleave', (event) => {
            if (event.pointerType === 'mouse') {
              releaseButton(btn, keyName, event.pointerId, event);
            }
          }, { passive: false });

          btn.addEventListener('touchcancel', () => {
            const setForButton = activePointersByButton.get(btn);
            if (!setForButton) return;
            Array.from(setForButton).forEach((pointerId) => {
              releaseButton(btn, keyName, pointerId);
            });
          }, { passive: true });

          btn.addEventListener('contextmenu', (event) => event.preventDefault());
          btn.addEventListener('dragstart', (event) => event.preventDefault());
          btn.addEventListener('selectstart', (event) => event.preventDefault());
        });

        ctrlBar.addEventListener('pointermove', (event) => {
          if (event.pointerType === 'mouse') return;
          const { pointerId, clientX, clientY } = event;
          const current = pointerToButton.get(pointerId);
          if (directionPointers.has(pointerId) && gameState === 'play') {
            const hit = document.elementFromPoint(clientX, clientY);
            const next = hit?.closest('.control-btn');
            if (next && directionPad.contains(next)) {
              if (next === current) return;
              if (current) releaseButton(current, current.dataset.key, pointerId);
              pressButton(next, next.dataset.key, pointerId, event, event.pointerType);
              return;
            }
            // Maintain the held direction while rocking across the center.
            if (directionPad.contains(hit)) return;
          }
          if (!current) return;
          const bounds = current.getBoundingClientRect();
          if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) {
            releaseButton(current, current.dataset.key, pointerId, event);
          }
        }, { passive: false });

        // Keyboard and assistive-technology activations have no pointerdown.
        // Clicks that follow a pointer press on the same control already acted.
        ctrlBar.addEventListener('click', event => {
          const btn = event.target.closest('.control-btn');
          const key = btn?.dataset.key;
          if (!key) return;
          if (performance.now() - (pointerActivity.get(btn) ?? -Infinity) < POINTER_CLICK_WINDOW) return;
          pressGameplayKey(touchKeys, key);
          if (menuKeys.has(key)) handleMenuInput({ key });
          releaseGameplayKey(touchKeys, key);
        });
      }
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

    function generateEnvironment() {
      levelSeed = Number.isFinite(urlSeed) ? urlSeed >>> 0 : (Math.random() * 2 ** 32) >>> 0;
      layout = window.SpaceStation.build({
        seed: levelSeed, worldWidth, worldHeight, deckY: DECK_Y,
        movement: MOVEMENT, body: { width: 32, height: 32 }
      });
      obstacles = layout.solids;
      ladders = layout.ladders;
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
    function nextNavEdge(from, to) {
      if (!from || !to || from === to) return null;
      const first = new Map([[from.id, null]]);
      const queue = [from.id];
      while (queue.length) {
        const node = queue.shift();
        if (node === to.id) return first.get(node);
        for (const edge of layout.navEdges[node]) {
          if (first.has(edge.to)) continue;
          first.set(edge.to, first.get(node) || edge);
          queue.push(edge.to);
        }
      }
      return null;
    }

    function routeExists(from, to) {
      return Boolean(from && to && (from === to || nextNavEdge(from, to)));
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
    generateEnvironment();
    snapCamera();

    /**
     * Reset all entities and player stats to their initial values. Called
     * when restarting after game over.
     */
    function restart() {
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
      screenShakeTimer = 0;
      screenShakeStrength = 0;
      cameraShakeX = 0;
      cameraShakeY = 0;
      damageOverlayTimer = 0;
      spawnCooldown = 900;
      openingEnemyPending = true;
      gameState = 'play';
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

      // Regenerate the random obstacles and ladders on each restart so the
      // battlefield feels fresh.  This also clears any leftover
      // environment from the previous run.
      if (typeof generateEnvironment === 'function') {
        generateEnvironment();
      }
      snapCamera();
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
      const type = teach ? 'zombie' : weightedChoice([
        { item: 'zombie', weight: typeWeights.zombie },
        { item: 'ghost', weight: typeWeights.ghost },
        { item: 'robot', weight: typeWeights.robot },
        { item: 'alien', weight: typeWeights.alien }
      ]) || 'zombie';
      const spawnDir = Math.random() < 0.65 ? 1 : -1;
      const spawnOffset = width + 140 + Math.random() * 280;
      const spawnX = teach ? Math.max(680, player.x + 240) : player.x + spawnDir * spawnOffset;
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
      for (const point of layout.encounters) {
        const dx = point.x - player.x;
        if (Math.abs(dx) > 1400) continue;
        let y = point.y - e.height;
        if (type === 'ghost') {
          const low = point.y - e.height - 12;
          const high = ceilingAbove(point.x + e.width / 2, point.y) + 26;
          y = Math.max(Math.min(high, low), Math.min(low, point.y - e.height - 90 - Math.random() * 140));
        } else if (!routeExists(layout.regions[point.region], playerRegion)) continue;
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
      const [goldMin, goldMax] = goldByType[enemy.type] || [4, 7];
      const goldCount = goldMin + Math.floor(Math.random() * (goldMax - goldMin + 1));
      dropPickup(enemy, { x: enemy.x, width:12, height:12, type:'gold', value: goldCount });

      const ammoDropChance = {
        easy:   { zombie: 0.7, ghost: 0.0, robot: 0.8, alien: 0.75 },
        normal: { zombie: 0.62, ghost: 0.0, robot: 0.72, alien: 0.66 },
        hard:   { zombie: 0.54, ghost: 0.0, robot: 0.64, alien: 0.58 }
      };
      const difficultyTable = ammoDropChance[SETTINGS.difficulty] || ammoDropChance.normal;
      if (Math.random() < (difficultyTable[enemy.type] ?? 0.6)) {
        const table = ENEMY_DROP_TABLES[enemy.type];
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
      const tint = weapon === 'laser' ? '#9dfdff' : (weapon === 'shotgun' ? '#ffd8a0' : '#fff59a');
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
      if (player.health <= 0) {
        gameState = 'gameover';
        playerDownAt = performance.now();
        resetGameplayInput();
      }
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
      let y = Math.min(rest, head - CAMERA.headroom);
      y = Math.max(y, nextLanding() + CAMERA.footroom - viewHeight);
      y = Math.min(y, head - 24);
      return clamp(Math.max(y, feet + 8 - viewHeight), 0, maxViewY);
    }

    function snapCamera() {
      camera.look = player.facing;
      camera.lookVelocity = 0;
      camera.lead = 0;
      camera.yVelocity = 0;
      camera.support = player.y + player.height;
      camera.x = cameraTargetX();
      camera.y = cameraTargetY();
    }

    function updateCamera(dt) {
      if (player.onGround || player.isClimbing) camera.support = player.y + player.height;
      [camera.look, camera.lookVelocity] = smoothDamp(camera.look, camera.lookVelocity, player.facing, CAMERA.turnMs, dt);
      const leadTarget = clamp(player.vx / MOVEMENT.runSpeed, -1, 1) * CAMERA.lead;
      camera.lead += (leadTarget - camera.lead) * settle(dt, CAMERA.leadMs);
      camera.x += (cameraTargetX() - camera.x) * settle(dt, CAMERA.followXMs);
      [camera.y, camera.yVelocity] = smoothDamp(camera.y, camera.yVelocity, cameraTargetY(), CAMERA.followYMs, dt);
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

    const ENEMY_CUE_LEVEL = { Warn: 0.48, Attack: 0.42, Down: 0.42, Hurt: 0.36, Move: 0.26 };
    const HURT_CUE_GAP_MS = 260;
    // Sentry Unit footsteps: on starting to move, then at a walking cadence.
    const ROBOT_STEP_MS = 1500;
    const ROBOT_START_GAP_MS = 1000;

    function playEnemyCue(enemy, cue) {
      if (!SETTINGS.sfx) return;
      const x = enemy.x + enemy.width / 2;
      const y = enemy.y + enemy.height / 2;
      const offset = x - player.x - player.width / 2;
      // Threats in or just outside the frame, or close to the player even
      // when the tighter view leaves them off screen, stay audible.
      const nearView = x >= camera.x - 48 && x <= camera.x + viewWidth + 48 &&
        y >= camera.y - 48 && y <= camera.y + viewHeight + 48;
      if (!nearView && Math.abs(offset) > 420) return;
      const pan = Math.max(-0.72, Math.min(0.72, offset / 330));
      const gain = (ENEMY_CUE_LEVEL[cue] ?? 0.42) / (1 + Math.abs(offset) / 720);
      const group = cue === 'Hurt' ? 'hurt' : (cue === 'Move' ? 'move' : 'enemy');
      if (!window.combatAudio?.play(enemy.type + cue, group, gain, pan) && cue === 'Down') {
        playLegacyEffect(enemyDeathSfx);
      }
    }

    // A burst or a shotgun's pellets play one hurt cue per enemy per window.
    function playEnemyHurt(enemy) {
      if (elapsedTime - (enemy.hurtCueAt ?? -Infinity) < HURT_CUE_GAP_MS) return;
      enemy.hurtCueAt = elapsedTime;
      playEnemyCue(enemy, 'Hurt');
    }

    function updateGame(dt) {
      elapsedTime += dt;
      player.animTime += dt;
      player.invulnTimer = Math.max(0, player.invulnTimer - dt);
      player.hitFlashTimer = Math.max(0, player.hitFlashTimer - dt);
      player.recoilTimer = Math.max(0, player.recoilTimer - dt);
      const wasGrounded = player.onGround;
      // Age kicks before this tick's shots so a new kick shows at full strength.
      updateShotKicks(dt);
      updatePlayer(dt);
      updateCamera(dt);
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
        const braced = ranged && (e.queuedShot || e.attackTimer > 75);
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
            e.navEdge = e.onGround && region !== playerRegion ? nextNavEdge(region, playerRegion) : null;
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

          if (!braced && !closeWindup) {
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
                  (e.type === 'zombie' || e.type === 'alien');
                if (prevX + e.width <= ob.x) {
                  e.x = ob.x - e.width;
                  if (canHop) hop = true;
                  else e.dir = -1;
                } else if (prevX >= ob.x + ob.width) {
                  e.x = ob.x + ob.width;
                  if (canHop) hop = true;
                  else e.dir = 1;
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
        if (ranged) {
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
      advanceProjectiles(bullets, enemies, (b, hit) => {
        spawnHitSparks(hit.x, hit.y, b.weapon);
        const enemy = hit.target;
        const index = enemies.indexOf(enemy);
        if (index < 0) return;
        enemy.health -= b.damage;
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
          if (!e.spawnGrace && e.contactDamageTimer <= 0 && (!closeAttack || inStrike)) {
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
      spawnCooldown -= dt;
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
      else if (gameState === 'gameover') frame = get('down', performance.now() - playerDownAt);
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

    function enemySprite(enemy) {
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
    function drawLayer(image, scroll, scale = 1, top = 0, cropHeight = height) {
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
      if (!station.distant) {
        if (bgLoaded) drawLayer(legacyBackground.image, screenX * 0.12);
        else {
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

      for (const ob of obstacles) {
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
      for (const obstacle of obstacles) {
        if (obstacle.role === 'wall' || obstacle.type === 'deck') continue;
        if (!onScreen(view, obstacle.x, obstacle.y, obstacle.width, obstacle.height)) continue;
        const x = obstacle.x;
        ctx.fillStyle = TERRAIN_COLOR[obstacle.type] || TERRAIN_COLOR.platform;
        ctx.fillRect(x, obstacle.y, obstacle.width, obstacle.height);
        if (obstacle.type === 'slab' || obstacle.type === 'catwalk') {
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
        if (!onScreen(view, e.x, e.y, e.width, e.height, 72)) return;
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
        if (!onScreen(view, enemy.x, enemy.y, enemy.width, enemy.height, 72)) continue;
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
      enemyBullets.forEach(b => {
        if (!onScreen(view, b.x, b.y, b.width, b.height, 4)) return;
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
      if (gameState === 'play') drawHUD();
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
      return 0;
    }

    function selectRow(index) {
      if (gameState === 'start') startMenuSelection = index;
      if (gameState === 'menu') mainMenuSelection = index;
      if (gameState === 'settings') settingsSelection = index;
      if (gameState === 'shop') menuSelection = index;
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
      menuLayer.hidden = mode === 'play' || mode === 'boot';
      if (menuLayer.hidden) return;

      const panel = element('section', mode === 'shop' ? 'menu-panel shop-panel' : 'menu-panel');
      const heading = element(mode === 'start' ? 'h1' : 'h2', '', {
        start: 'SPACE COMMANDO', menu: 'Paused', settings: 'Settings', shop: 'Shop', gameover: 'Game over'
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
      const options = element('div', 'menu-options');
      const labels = {
        start: ['Start game', 'Settings'],
        menu: ['Resume', 'Restart game', 'Settings'],
        settings: ['Difficulty', 'Music', 'Particles', 'Camera shake and flashes', 'Sound effects', 'Haptics'],
        gameover: ['Restart']
      }[mode];
      if (mode === 'gameover') {
        panel.append(element('p', 'gameover-summary', `Gold collected: ${player.gold}`));
      }
      labels.forEach((label, index) => addMenuRow(options, label, index, mode === 'settings'));
      panel.append(options);
      if (mode === 'settings') addBackButton(panel, 'Back', 'system-button menu-back');
      if (mode === 'start' && !isMobile) {
        panel.append(element('p', 'menu-hint', 'Move: A/D or arrows · Jump: Space · Fire: Z · Reload: X · Shop: P'));
      }
    }

    function syncMenu(moveFocus = false) {
      const mode = document.body.dataset.boot === 'ready' ? gameState : 'boot';
      const changed = mode !== menuMode;
      if (changed) {
        menuMode = mode;
        buildMenu(mode);
        document.body.toggleAttribute('data-playing', mode === 'play');
      }
      if (menuLayer.hidden) return;
      const selected = selectedRow();
      menuRows.forEach(({ row }, i) => {
        row.dataset.selected = String(i === selected);
      });

      if (mode === 'start') {
        menuRows[0].row.disabled = !artReady;
        menuRows[0].name.textContent = artReady ? 'Start game' : 'Loading sprites…';
      } else if (mode === 'settings') {
        const effectText = SETTINGS.effects === 'system' ? (effectsReduced() ? 'System · Reduced' : 'System · Full') :
          SETTINGS.effects === 'full' ? 'Full' : 'Reduced';
        const hapticText = hapticsSupported ? (SETTINGS.haptics ? 'On' : 'Off') : (SETTINGS.haptics ? 'On · not supported' : 'Off');
        const values = [SETTINGS.difficulty, SETTINGS.audio ? 'On' : 'Off', SETTINGS.particles ? 'On' : 'Off', effectText, SETTINGS.sfx ? 'On' : 'Off', hapticText];
        menuRows.forEach(({ value }, i) => { value.textContent = values[i]; });
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
