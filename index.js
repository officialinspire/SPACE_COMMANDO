/*
 * SPACE COMMANDO – Canvas Edition
 *
 * This version of the game implements a complete side‑scrolling shooter
 * using nothing more than the HTML5 Canvas API. It loads a single
 * sprite sheet for all actors (player and enemies) and a parallax
 * background image, then draws and animates everything manually. There
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
  // Define a base64 encoded version of the sprite sheet. Reading local files
  // over the file:// protocol can be blocked by some browsers, so
  // embedding the binary data as a Data URI ensures the image loads
  // reliably. If you replace the sprite sheet, regenerate this array
  // using `base64 -w0 file.png` and update the segments.
  const SPRITE_SEGMENTS = [
    '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'
  ];

  // Build the Data URI for the sprite sheet by concatenating segments. This
  // avoids extremely long literal strings while still embedding the
  // entire asset in the source.
  // Initialise the sprite sheet by loading the provided PNG.  Once the
  // image loads the sheetLoaded flag will be set to true.  Loading
  // directly from disk keeps the code cleaner than embedding a base64
  // encoded sprite sheet.  The SPRITE_SEGMENTS array defined above is
  // no longer used but retained for reference.
  const spriteSheet = new Image();
  spriteSheet.src = 'space-commando-sprite-sheet.png';
  let sheetLoaded = false;
  spriteSheet.onload = () => { sheetLoaded = true; };

  // Load the parallax background. This large image is drawn behind
  // everything else and scrolls slower than the foreground to give a
  // sense of depth.  If it fails to load, the game falls back to a
  // simple dark starfield.
  const backgroundImg = new Image();
  backgroundImg.src = 'space_station_parallax.png';
  let bgLoaded = false;
  backgroundImg.onload = () => { bgLoaded = true; };

  // Define frame coordinates (sx, sy) for each animation.  The sprite
  // sheet uses 32 px tiles.  You can adjust these indices if you
  // rearrange the sheet.  Frames for zombies and ghosts span two rows.
  const ANIMATIONS = {
    // Player running frames (row 0, cols 0–3)
    playerRun: [ {sx:0, sy:0}, {sx:32, sy:0}, {sx:64, sy:0}, {sx:96, sy:0} ],
    // Player shooting frames (row 0, cols 4–6). These show muzzle flash.
    playerShoot: [ {sx:128, sy:0}, {sx:160, sy:0}, {sx:192, sy:0} ],
    // Player idle frame (use first run frame)
    playerIdle: [ {sx:0, sy:0} ],
    // Player jumping frames (row 1, cols 0–1). These show the commando in mid‑air.
    playerJump: [ {sx:0, sy:32}, {sx:32, sy:32} ],
    // Robot walking frames (row 2, cols 0–3)
    robotWalk: [ {sx:0, sy:64}, {sx:32, sy:64}, {sx:64, sy:64}, {sx:96, sy:64} ],
    // Zombie walking frames (row 2 col4‑5 and row3 col0)
    zombieWalk: [ {sx:128, sy:64}, {sx:160, sy:64}, {sx:0, sy:96} ],
    // Zombie attack frames (row3 col0‑1)
    zombieAttack: [ {sx:0, sy:96}, {sx:32, sy:96} ],
    // Ghost floating frames (row3 col2‑5)
    ghostFloat: [ {sx:64, sy:96}, {sx:96, sy:96}, {sx:128, sy:96}, {sx:160, sy:96} ],
    // Alien walking frames (row4 col0‑3)
    alienWalk: [ {sx:0, sy:128}, {sx:32, sy:128}, {sx:64, sy:128}, {sx:96, sy:128} ],
    // Alien attack frame (row4 col4). Use as single frame.
    alienAttack: [ {sx:128, sy:128} ],
    // Ammo pickups (row5 col1–4) and coin (col6). These are used when
    // drawing pickups.
    ammoPistol: { sx:32, sy:160 }, // yellow bullet
    ammoRifle: { sx:64, sy:160 },  // grey magazine
    ammoShotgun: { sx:96, sy:160 }, // red shell
    ammoLaser: { sx:128, sy:160 }, // green battery
    coin: { sx:192, sy:160 } // gold coin
  };

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
    pistol:  { name:'Pistol',  cost:0,   damage:2, magazine:12, reloadTime:600,  bulletSpeed:6, fireRate:300, auto:false, ammoDrop:1 },
    // Assault rifle: first purchase.  Fully automatic, fires rapidly and
    // holds fifty rounds.  Reloads quickly and deals similar damage to
    // the pistol.  Enemies drop ammo cartridges containing ten rounds.
    rifle:   { name:'Rifle',   cost:100, damage:2, magazine:50, reloadTime:800,  bulletSpeed:8, fireRate:100, auto:true,  ammoDrop:10 },
    // Shotgun: second purchase.  Fires a high‑powered blast once per
    // trigger pull.  Holds five shells and takes longer to reload.  Each
    // pellet deals significant damage.  Enemies drop shells in packs of five.
    shotgun: { name:'Shotgun', cost:200, damage:8, magazine:5,  reloadTime:2000, bulletSpeed:5, fireRate:500, auto:false, pellets:3, spread:0.3, ammoDrop:5 },
    // Laser beam: third purchase.  Slow reload emphasises the need to
    // conserve shots.  The beam fires continuously while the trigger is
    // held until the magazine is depleted.  A reload time of four
    // seconds slows the pace relative to the other guns.  The high
    // damage per shot reflects the weapon's futuristic lethality.
    laser:   { name:'Laser',   cost:300, damage:5, magazine:30, reloadTime:4000, bulletSpeed:10, fireRate:80, auto:true,  ammoDrop:1 }
  };

  // Weapon order used in the shop menu
  const WEAPON_ORDER = ['pistol','rifle','shotgun','laser'];

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
    { type: 'ammo', ammoType: 'pistol', name: 'PISTOL AMMO', cost: 5, qty: 1 },
    { type: 'ammo', ammoType: 'rifle', name: 'RIFLE AMMO', cost: 10, qty: 10 },
    { type: 'ammo', ammoType: 'shotgun', name: 'SHOTGUN SHELLS', cost: 5, qty: 5 },
    { type: 'ammo', ammoType: 'laser', name: 'BATTERY', cost: 10, qty: 1 }
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
    musicVolume: 0.6
  };

  // Audio objects for background music.  These will be created in
  // init() so they can access the SETTINGS object.  gameMusic
  // accompanies gameplay and menuMusic accompanies all in‑game menus
  // including the shop, pause and settings screens.
  let gameMusic;
  let menuMusic;

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

  // Track total elapsed play time in milliseconds.  This value is incremented
  // during gameplay and used to scale enemy spawn rates and mix of enemy
  // types so that the game becomes more challenging the longer it is
  // played.
  let elapsedTime = 0;

  /**
   * Fade an audio track in over time.  Cancels any previous fade on
   * that track before starting.  The track begins playing at zero
   * volume and increments up to the provided targetVolume.  If the
   * global audio toggle is disabled the volume will remain at zero.
   *
   * @param {HTMLAudioElement} audio The audio element to fade in
   * @param {number} targetVolume The desired target volume (0–1)
   * @param {number} step Increment added to the volume each tick
   * @param {number} interval Milliseconds between volume updates
   */
  function fadeIn(audio, targetVolume = SETTINGS.musicVolume, step = 0.05, interval = 100) {
    if (!audio) return;
    if (audio.fadeInterval) {
      clearInterval(audio.fadeInterval);
    }
    // Start at zero to avoid abrupt starts
    audio.volume = 0;
    try { audio.play(); } catch (err) {}
    audio.fadeInterval = setInterval(() => {
      const maxVol = SETTINGS.audio ? targetVolume : 0;
      audio.volume = Math.min(maxVol, audio.volume + step);
      if (audio.volume >= maxVol) {
        clearInterval(audio.fadeInterval);
        audio.fadeInterval = null;
      }
    }, interval);
  }

  /**
   * Fade an audio track out over time.  Cancels any previous fade
   * operation.  Gradually reduces volume and pauses when silent.
   *
   * @param {HTMLAudioElement} audio The audio element to fade out
   * @param {number} step Decrement subtracted from the volume each tick
   * @param {number} interval Milliseconds between volume updates
   */
  function fadeOut(audio, step = 0.05, interval = 100) {
    if (!audio) return;
    if (audio.fadeInterval) {
      clearInterval(audio.fadeInterval);
    }
    audio.fadeInterval = setInterval(() => {
      audio.volume = Math.max(0, audio.volume - step);
      if (audio.volume <= 0) {
        try { audio.pause(); } catch (err) {}
        clearInterval(audio.fadeInterval);
        audio.fadeInterval = null;
      }
    }, interval);
  }

  /**
   * Initialize and run the game. This function sets up the canvas,
   * event listeners, game entities, and the main loop. All of the
   * gameplay logic lives within the nested helper functions.
   */
  function init() {
    // Update the document title so we know the script ran. If you see
    // this title in the browser tab, the JS has executed successfully.
    document.title = 'SPACE COMMANDO – A #teaminspire Production';
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const worldWidth = 5000; // world extends horizontally
    const groundY = height - 32;

    // Initialise background music once per session.  Creating audio
    // elements inside init() ensures they are tied to the document
    // lifecycle.  Loop both tracks and leave volumes at zero until
    // fadeIn() is called.  We defer playback to user interaction as
    // some browsers block autoplay.
    if (!gameMusic) {
      gameMusic = new Audio('game-background-music.mp3');
      gameMusic.loop = true;
      gameMusic.volume = 0;
    }
    if (!menuMusic) {
      menuMusic = new Audio('menu_background_music.mp3');
      menuMusic.loop = true;
      menuMusic.volume = 0;
    }

    // When the game first loads, attempt to start the menu music.
    // Autoplay may not work until the user interacts, but fadeIn() will
    // gracefully handle this by trying to play and adjusting volume.
    fadeIn(menuMusic);
    // Precompute random stars for a fallback starfield. These are drawn
    // if the background image fails to load or simply to add sparkle.
    const stars = [];
    for (let i=0; i<600; i++) {
      stars.push({ x: Math.random()*worldWidth, y: Math.random()*height*0.8, size: Math.random()*2+1, alpha: Math.random()*0.5+0.3 });
    }
    // Input state: track whether keys are pressed
    const keys = {};
    document.addEventListener('keydown', (e) => {
      keys[e.key] = true;
      // Prevent default scrolling on arrow keys and space.  Include both
      // space representations (' ', 'Space', 'Spacebar') to ensure the
      // browser never scrolls when jumping.
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Space','Spacebar'].includes(e.key)) {
        e.preventDefault();
      }
      handleMenuInput(e);
    });
    document.addEventListener('keyup', (e) => {
      // Clear key state
      keys[e.key] = false;
      // Also prevent default on release of movement keys to avoid scroll
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Space','Spacebar'].includes(e.key)) {
        e.preventDefault();
      }
    });

    // ---------------------------------------------------------------------
    // Mobile controls
    // Detect whether we are on a touch‑capable mobile device.  If so,
    // reveal the custom on‑screen controller and wire up each button to
    // simulate keyboard presses.  Using both touch and pointer events
    // ensures compatibility across browsers.  The data‑key attribute on
    // each button specifies which key should be set in the keys object
    // when pressed.  Menu navigation triggers handleMenuInput() immediately
    // on press so the purchase and settings menus respond without delay.
    const isMobile = /Mobi|Android|iPhone|iPad|iPod|Tablet/i.test(navigator.userAgent) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
    if (isMobile) {
      const ctrlBar = document.getElementById('mobile-controls');
      if (ctrlBar) {
        ctrlBar.style.display = 'flex';
        const buttons = ctrlBar.querySelectorAll('.control-btn');
        buttons.forEach(btn => {
          const keyName = btn.getAttribute('data-key');
          const press = (event) => {
            event.preventDefault();
            keys[keyName] = true;
            // Trigger immediate menu handling for Enter, Escape, P etc.
            handleMenuInput({ key: keyName });
          };
          const release = (event) => {
            event.preventDefault();
            keys[keyName] = false;
          };
          // Touch events
          btn.addEventListener('touchstart', press);
          btn.addEventListener('touchend', release);
          btn.addEventListener('touchcancel', release);
          // Pointer events for mouse / stylus
          btn.addEventListener('pointerdown', press);
          btn.addEventListener('pointerup', release);
          btn.addEventListener('pointerleave', release);
        });
      }
    }

    // Collections for dynamic entities
    let bullets = [];
    let enemyBullets = [];
    let enemies = [];
    let pickups = [];
    // Particle effects list. Each particle has x, y, vx, vy, life, maxLife
    // and a color string. Particles are spawned when enemies are destroyed
    // to create a simple explosion effect.
    let particles = [];
    let spawnCooldown = 0;
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
    let settingsSelection = 0;    // index of currently selected setting (difficulty/audio/particles)

    // Track the previous state when entering the settings menu so
    // Escaping settings returns the player to the correct screen
    let prevSettingsState = 'start';

    // World obstacles and ladders.  Obstacles include crates, barricades
    // and elevated platforms that the player can jump on or hide behind.
    // Ladders allow the player to climb up to platforms.  Both arrays are
    // regenerated on every restart to keep the landscape fresh.
    let obstacles = [];
    let ladders = [];

    /**
     * Populate the world with random crates, platforms and ladders.  The
     * horizontal placement is randomised within the world bounds while
     * vertical placement for platforms is chosen so they sit above the
     * ground.  Each platform has a ladder connecting it back to the
     * ground on most runs.  Crates, energy shields and barricades are
     * different obstacle types drawn in distinct colours.
     */
    function generateEnvironment() {
      obstacles = [];
      ladders = [];
      // Generate elevated platforms
      const platformCount = 6;
      for (let i=0; i<platformCount; i++) {
        // Spread platforms across the world width, leaving space near the start
        const sectionWidth = (worldWidth - 800) / platformCount;
        const baseX = 400 + i * sectionWidth;
        const x = baseX + Math.random() * sectionWidth * 0.5;
        const widthPl = 100 + Math.random() * 120;
        const heightPl = 12;
        // Place platforms roughly 100–160px above the ground
        const y = groundY - (100 + Math.random() * 60);
        obstacles.push({ type:'platform', x, y, width: widthPl, height: heightPl });
        // With high probability, add a ladder leading to this platform
        if (Math.random() < 0.8) {
          const ladderWidth = 16;
          const ladderX = x + widthPl/2 - ladderWidth/2;
          const ladderHeight = groundY - y;
          ladders.push({ type:'ladder', x: ladderX, y: y, width: ladderWidth, height: ladderHeight });
        }
      }
      // Generate ground obstacles (crates, shields, barricades)
      const obstacleCount = 14;
      const types = ['crate','shield','barricade'];
      for (let i=0; i<obstacleCount; i++) {
        const widthOb = 32 + Math.random()*32;
        // Keep obstacles low so the player can jump over them.  Restrict the
        // height range more tightly to encourage traversal over crates and
        // barricades.  The maximum height is around 28px which the player
        // can reliably clear with a jump.
        const heightOb = 20 + Math.random()*8;
        const x = 500 + Math.random() * (worldWidth - 600);
        const y = groundY - heightOb;
        const type = types[Math.floor(Math.random() * types.length)];
        obstacles.push({ type, x, y, width: widthOb, height: heightOb });
      }
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
      shootCooldown: 0,
      facing: 1,
      animTime: 0
      ,
      // Ladder flags: onLadder indicates the player is currently within the
      // bounds of a ladder; isClimbing is true while the player is actively
      // moving up or down the ladder.  Gravity is suppressed while
      // climbing.
      onLadder: false,
      isClimbing: false
      ,
      /**
       * Track whether the player is currently ducking.  When ducking the
       * player's height is reduced so they can hide behind low cover.
       * baseHeight stores the normal standing height so it can be
       * restored when the player stands back up.
       */
      isDucking: false,
      baseHeight: 32
    };

    // Initial environment creation.  This call populates the obstacles
    // and ladders arrays with randomised platforms and cover.  Without
    // this call the world would be empty at the first launch.
    generateEnvironment();

    /**
     * Reset all entities and player stats to their initial values. Called
     * when restarting after game over.
     */
    function restart() {
      bullets = [];
      enemyBullets = [];
      enemies = [];
      pickups = [];
      spawnCooldown = 0;
      gameState = 'play';
      player.x = 100;
      player.y = groundY - player.height;
      player.vx = 0;
      player.vy = 0;
      player.health = 100;
      player.gold = 0;
      player.weapon = 'pistol';
      player.ammoInClip = { pistol: WEAPONS.pistol.magazine, rifle: 0, shotgun: 0, laser: 0 };
      player.reserveAmmo = { pistol: WEAPONS.pistol.magazine * 2, rifle: 0, shotgun: 0, laser: 0 };
      player.reloading = false;
      player.reloadTimer = 0;
      player.shootCooldown = 0;
      player.facing = 1;
      player.animTime = 0;
      player.onLadder = false;
      player.isClimbing = false;
      player.isDucking = false;
      // restore standing height on restart
      player.height = player.baseHeight;

      // Regenerate the random obstacles and ladders on each restart so the
      // battlefield feels fresh.  This also clears any leftover
      // environment from the previous run.
      if (typeof generateEnvironment === 'function') {
        generateEnvironment();
      }
    }

    /**
     * Handle menu navigation and selection. When the shop is open,
     * arrow keys cycle through weapons and Enter purchases the selected
     * weapon if the player has enough gold. P toggles the shop.
     */
    function handleMenuInput(e) {
      // Handle input based on the current game state
      if (gameState === 'shop') {
        // Purchase menu navigation for both weapons and ammo items
        if (e.key === 'ArrowUp') {
          menuSelection = (menuSelection + SHOP_ITEMS.length - 1) % SHOP_ITEMS.length;
        } else if (e.key === 'ArrowDown') {
          menuSelection = (menuSelection + 1) % SHOP_ITEMS.length;
        } else if (e.key === 'Enter') {
          const item = SHOP_ITEMS[menuSelection];
          if (item.type === 'weapon') {
            const key = item.key;
            const w = WEAPONS[key];
            // Only allow purchase if not already equipped and enough gold
            if (player.weapon !== key && player.gold >= w.cost) {
              player.gold -= w.cost;
              player.weapon = key;
              // refill clip and grant two extra magazines of reserve
              player.ammoInClip[key] = w.magazine;
              player.reserveAmmo[key] += w.magazine * 2;
            }
          } else if (item.type === 'ammo') {
            // purchase ammunition
            if (player.gold >= item.cost) {
              player.gold -= item.cost;
              player.reserveAmmo[item.ammoType] += item.qty;
            }
          }
          // Play selection sound whenever a purchase is attempted
          try {
            selectSfx.currentTime = 0;
            selectSfx.play();
          } catch (err) {}
        } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
          // Close shop and resume play
          gameState = 'play';
          // resume game music
          fadeOut(menuMusic);
          fadeIn(gameMusic);
        }
      } else if (gameState === 'play') {
        if (e.key === 'p' || e.key === 'P') {
          // Open purchase menu
          gameState = 'shop';
          // Highlight the current weapon if present in the shop items.
          const idx = SHOP_ITEMS.findIndex(it => it.type === 'weapon' && it.key === player.weapon);
          menuSelection = idx >= 0 ? idx : 0;
          // switch music: fade out game track and fade in menu track
          fadeOut(gameMusic);
          fadeIn(menuMusic);
        } else if (e.key === 'Escape') {
          // Open pause/menu overlay
          gameState = 'menu';
          mainMenuSelection = 0;
          // swap music
          fadeOut(gameMusic);
          fadeIn(menuMusic);
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
            fadeOut(menuMusic);
            fadeIn(gameMusic);
          } else if (mainMenuSelection === 1) {
            // Restart game and return to start menu
            restart();
            gameState = 'start';
            fadeOut(menuMusic);
            fadeIn(menuMusic); // continue playing menu music for start screen
          } else if (mainMenuSelection === 2) {
            // Open settings menu
            prevSettingsState = 'menu';
            settingsSelection = 0;
            gameState = 'settings';
          }
          // Play selection sound when choosing an option on the pause menu
          try {
            selectSfx.currentTime = 0;
            selectSfx.play();
          } catch (err) {}
        } else if (e.key === 'Escape') {
          // cancel pause and resume play
          gameState = 'play';
          fadeOut(menuMusic);
          fadeIn(gameMusic);
        }
      } else if (gameState === 'settings') {
        // Settings menu categories: 0 difficulty, 1 audio, 2 particles
        const settingKeys = ['difficulty', 'audio', 'particles'];
        if (e.key === 'ArrowUp') {
          settingsSelection = (settingsSelection + settingKeys.length - 1) % settingKeys.length;
        } else if (e.key === 'ArrowDown') {
          settingsSelection = (settingsSelection + 1) % settingKeys.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter') {
          const key = settingKeys[settingsSelection];
          if (key === 'difficulty') {
            const difficulties = ['easy', 'normal', 'hard'];
            let idx = difficulties.indexOf(SETTINGS.difficulty);
            // cycle difficulty in direction based on arrow keys
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') idx = (idx + difficulties.length - 1) % difficulties.length;
            else idx = (idx + 1) % difficulties.length;
            SETTINGS.difficulty = difficulties[idx];
          } else if (key === 'audio') {
            // Toggle music on or off.  When turning off, fade out all
            // tracks.  When turning on, resume whichever track was
            // associated with the previous state when entering
            // settings.  If that state was gameplay, play game music,
            // otherwise play menu music.
            SETTINGS.audio = !SETTINGS.audio;
            if (!SETTINGS.audio) {
              fadeOut(gameMusic);
              fadeOut(menuMusic);
            } else {
              if (prevSettingsState === 'play') {
                fadeIn(gameMusic);
              } else {
                fadeIn(menuMusic);
              }
            }
          } else if (key === 'particles') {
            SETTINGS.particles = !SETTINGS.particles;
          }
          // Play selection sound when adjusting a setting
          try {
            selectSfx.currentTime = 0;
            selectSfx.play();
          } catch (err) {}
        } else if (e.key === 'Escape') {
          // Exit settings and return to the previous menu
          const returnState = prevSettingsState || 'start';
          // Switch audio tracks appropriately
          if (returnState === 'play') {
            // going back into gameplay
            fadeOut(menuMusic);
            fadeIn(gameMusic);
          } else {
            // returning to menu or start: ensure menu music is playing
            fadeOut(gameMusic);
            fadeIn(menuMusic);
          }
          gameState = returnState;
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
            // Begin gameplay
            restart();
            gameState = 'play';
            // swap music: stop menu music and start game music
            fadeOut(menuMusic);
            fadeIn(gameMusic);
          } else if (startMenuSelection === 1) {
            // open settings from start menu
            prevSettingsState = 'start';
            settingsSelection = 0;
            gameState = 'settings';
          }
          // Play selection sound on start menu action
          try {
            selectSfx.currentTime = 0;
            selectSfx.play();
          } catch (err) {}
        }
        // no escape action on start menu
      } else if (gameState === 'gameover') {
        if (e.key === 'Enter') {
          restart();
          // return to start screen after death
          gameState = 'start';
          // stop gameplay music and start menu music
          fadeOut(gameMusic);
          fadeIn(menuMusic);
          // Play selection sound on restart
          try {
            selectSfx.currentTime = 0;
            selectSfx.play();
          } catch (err) {}
        }
      }
    }

    /**
     * Spawn a new enemy ahead of the player. The type is selected
     * according to weights. Each enemy has its own speed, health and
     * attack behaviour.
     */
    function spawnEnemy() {
      // Choose the enemy type based on weighted probabilities that evolve
      // over time.  Early on the game favours zombies and ghosts.  As
      // elapsed play time increases, the weights shift toward robots and
      // aliens for a greater challenge.  After two minutes zombies and
      // ghosts become relatively rare.
      const minutes = elapsedTime / 60000;
      let zombieWeight = 0.4;
      let ghostWeight  = 0.25;
      let robotWeight  = 0.2;
      let alienWeight  = 0.15;
      if (minutes > 2) {
        zombieWeight = 0.25;
        ghostWeight  = 0.20;
        robotWeight  = 0.30;
        alienWeight  = 0.25;
      } else if (minutes > 1) {
        zombieWeight = 0.30;
        ghostWeight  = 0.23;
        robotWeight  = 0.27;
        alienWeight  = 0.20;
      }
      const r = Math.random();
      let type;
      if (r < zombieWeight) {
        type = 'zombie';
      } else if (r < zombieWeight + ghostWeight) {
        type = 'ghost';
      } else if (r < zombieWeight + ghostWeight + robotWeight) {
        type = 'robot';
      } else {
        type = 'alien';
      }
      const e = {
        type: type,
        x: player.x + width + 200 + Math.random() * 400,
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
        baseY: 0,
        phase: Math.random() * Math.PI * 2,
        // Horizontal direction: -1 moves left, 1 moves right.  All
        // enemies spawn moving towards the player from the right.  This
        // value may be flipped at random intervals to make enemies roam.
        dir: -1,
        // Timer controlling when the enemy will randomly change
        // direction.  A random initial value is used so enemies do not
        // synchronise their turns.
        changeDirTimer: 1000 + Math.random() * 2000
      };
      // Track whether the enemy is on the ground/platform.  Only used for
      // non‑floating enemies; ghosts float so this flag is ignored.
      e.onGround = false;
      if (type === 'zombie') {
        e.y = groundY - e.height;
        e.health = 3;
        e.maxHealth = 3;
        // Base speed magnitude.  Direction is controlled separately via e.dir.
        e.speed = 1 + Math.random() * 0.4;
      } else if (type === 'ghost') {
        // Ghosts float above the ground.  Store a baseline y and phase
        // for sinusoidal hovering.
        e.baseY = groundY - e.height - 80 - Math.random()*150;
        e.y = e.baseY;
        e.health = 2;
        e.maxHealth = 2;
        e.speed = 1.2;
      } else if (type === 'robot') {
        e.y = groundY - e.height;
        e.health = 4;
        e.maxHealth = 4;
        e.speed = 0.8;
        e.shootTimer = 2000 + Math.random()*1000;
      } else if (type === 'alien') {
        e.y = groundY - e.height;
        e.health = 3;
        e.maxHealth = 3;
        e.speed = 1.5;
        e.shootTimer = 2500 + Math.random()*1000;
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
      enemies.push(e);
    }

    /**
     * Spawn gold and ammo pickups at an enemy's location. Always drops
     * gold and randomly drops an ammo crate for a random weapon type.
     */
    function spawnPickups(enemy) {
      const goldCount = Math.floor(Math.random()*5)+4; // 4–8 gold
      pickups.push({ x: enemy.x, y: groundY - 20, width:12, height:12, type:'gold', value: goldCount });
      // 60% chance to drop ammo.  The ammo type depends on the enemy
      // defeated so that certain foes tend to drop relevant resources.
      // Robots drop rifle magazines and batteries; zombies drop pistol
      // bullets and rifle magazines; ghosts drop no ammo (only gold);
      // aliens drop shotgun shells and batteries.  Choose randomly from
      // the allowed types for the enemy.
      if (Math.random() < 0.6) {
        let allowed = [];
        if (enemy.type === 'robot') {
          allowed = ['rifle','laser'];
        } else if (enemy.type === 'zombie') {
          allowed = ['pistol','rifle'];
        } else if (enemy.type === 'ghost') {
          allowed = []; // ghosts only drop gold
        } else if (enemy.type === 'alien') {
          allowed = ['shotgun','laser'];
        } else {
          allowed = WEAPON_ORDER.slice();
        }
        if (allowed.length > 0) {
          const key = allowed[Math.floor(Math.random()*allowed.length)];
          pickups.push({ x: enemy.x+16, y: groundY - 20, width:12, height:12, type:'ammo', ammoType:key, value: WEAPONS[key].ammoDrop });
        }
      }
      // Occasionally drop a health pack (about 20% chance).  Health packs
      // provide a modest heal to the player and are deliberately rare.
      if (Math.random() < 0.2) {
        pickups.push({ x: enemy.x + 8, y: groundY - 20, width:12, height:12, type:'health', value: 5 });
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
        ghost:  '#aaaaff',
        robot:  '#888888',
        alien:  '#55ff55'
      };
      const col = colours[enemy.type] || '#ffaa55';
      const count = 6 + Math.floor(Math.random()*4);
      for (let i=0; i<count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2;
        particles.push({
          x: enemy.x + enemy.width/2,
          y: enemy.y + enemy.height/2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 400 + Math.random()*200,
          maxLife: 400 + Math.random()*200,
          color: col
        });
      }
    }

    /**
     * Axis‑aligned bounding box collision detection.
     */
    function rectIntersect(a,b) {
      return (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y);
    }

    /**
     * Update the game simulation. Handles input, movement, shooting,
     * reloading, enemy AI, collisions and spawning. dt is elapsed
     * milliseconds since the last update.
     */
    function updateGame(dt) {
      // Accumulate elapsed play time each update for difficulty scaling
      elapsedTime += dt;
      const wKey = player.weapon;
      const weapon = WEAPONS[wKey];
      player.animTime += dt;

      // Save the previous position for collision resolution.  Reset
      // onGround so collisions can set it appropriately.  These
      // variables are used later to detect vertical and horizontal
      // collisions with obstacles.
      const prevX = player.x;
      const prevY = player.y;
      const wasOnGround = player.onGround;
      player.onGround = false;

      // Determine whether the player is currently overlapping a ladder.
      // A ladder is a vertical rectangle defined in the ladders array.
      let ladderFound = false;
      for (let i=0; i<ladders.length; i++) {
        const lad = ladders[i];
        // Check for overlap with ladder.  Use >= when comparing the bottom of
        // the player with the top of the ladder so the player can press
        // down to transition into climbing from the exact platform edge.
        if (player.x + player.width > lad.x && player.x < lad.x + lad.width &&
            player.y + player.height >= lad.y && player.y < lad.y + lad.height) {
          ladderFound = true;
          break;
        }
      }
      player.onLadder = ladderFound;
      // Enter climbing mode when on a ladder and pressing up or down.  Exit
      // climbing when not overlapping a ladder.  While climbing, gravity
      // does not apply and vertical movement is controlled by key input.
      const upPress = keys['ArrowUp'] || keys['w'] || keys['W'];
      const downPress = keys['ArrowDown'] || keys['s'] || keys['S'];
      if (player.onLadder && (upPress || downPress)) {
        player.isClimbing = true;
      } else if (!player.onLadder) {
        player.isClimbing = false;
      }

      // Handle ducking: the player can crouch when on the ground and not
      // climbing or reloading.  When ducking the player's height is
      // reduced and their bottom remains anchored.  Ducking suppresses
      // movement speed but still allows shooting.  Low‑walking is
      // implemented by reducing moveSpeed while crouched.  We track the
      // previous ducking state to adjust the player height and y only when
      // transitioning to or from a crouch.
      const wasDucking = player.isDucking;
      player.isDucking = false;
      if (!player.isClimbing && player.onGround && downPress && !player.reloading) {
        player.isDucking = true;
      }
      // Transition into duck
      if (player.isDucking && !wasDucking) {
        // Reduce height to 60% of base and adjust y so the bottom stays on the ground
        const newH = Math.floor(player.baseHeight * 0.6);
        player.y += (player.height - newH);
        player.height = newH;
      } else if (!player.isDucking && wasDucking) {
        // Stand back up: restore height and adjust y upward so the bottom remains
        const newH = player.baseHeight;
        player.y -= (newH - player.height);
        player.height = newH;
      }

      // Movement
      let moveSpeed = 2.5;
      // slow movement while crouched
      if (player.isDucking) moveSpeed = 1.5;
      player.vx = 0;
      if (!player.reloading && gameState === 'play') {
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) { player.vx = -moveSpeed; player.facing = -1; }
        if (keys['ArrowRight'] || keys['d'] || keys['D']) { player.vx = moveSpeed; player.facing = 1; }
        // Jump
        // Detect spacebar across browsers: ' ' (space), 'Space', and
        // 'Spacebar'.  Only jump when onGround to prevent double jumps.
        const spacePressed = keys[' '] || keys['Space'] || keys['Spacebar'];
if (spacePressed && wasOnGround && !player.isClimbing) {
  player.vy = -8;
  player.onGround = false;
  try { jumpSfx.currentTime = 0; jumpSfx.play(); } catch (err) {}
}
        // Shooting
        const shootKey = (keys['z'] || keys['Z']);
        if (shootKey && player.ammoInClip[wKey] > 0 && player.shootCooldown <= 0) {
          // Determine if the player is attempting to shoot upward.  When
          // the up arrow (or W) is held at the moment the shot is
          // triggered we fire bullets vertically instead of horizontally.
          const shootUp = (keys['ArrowUp'] || keys['w'] || keys['W']);
          if (shootUp) {
            if (wKey === 'shotgun') {
              // Shotgun: fire multiple pellets vertically with slight horizontal spread
              const pellets = weapon.pellets || 3;
              for (let i = 0; i < pellets; i++) {
                const horiz = (Math.random() - 0.5) * weapon.spread * weapon.bulletSpeed;
                const bxW = 4;
                const bxH = 4;
                const bx = player.x + player.width / 2 - bxW / 2;
                const by = player.y - bxH;
                bullets.push({ x: bx, y: by, vx: horiz, vy: -weapon.bulletSpeed, width: bxW, height: bxH, damage: weapon.damage, from: 'player' });
              }
            } else if (wKey === 'laser') {
              // Vertical laser shot: tall thin beam
              const bxW = 4;
              const bxH = 12;
              const bx = player.x + player.width / 2 - bxW / 2;
              const by = player.y - bxH;
              bullets.push({ x: bx, y: by, vx: 0, vy: -weapon.bulletSpeed, width: bxW, height: bxH, damage: weapon.damage, from: 'player' });
            } else {
              // Pistol and rifle: single vertical bullet
              const bxW = 4;
              const bxH = 6;
              const bx = player.x + player.width / 2 - bxW / 2;
              const by = player.y - bxH;
              bullets.push({ x: bx, y: by, vx: 0, vy: -weapon.bulletSpeed, width: bxW, height: bxH, damage: weapon.damage, from: 'player' });
            }
          } else {
            // Horizontal shooting logic
            if (wKey === 'shotgun') {
              // shotgun fires multiple pellets with slight spread
              const pellets = weapon.pellets || 3;
              for (let i = 0; i < pellets; i++) {
                const angle = (Math.random() - 0.5) * weapon.spread;
                const vx = weapon.bulletSpeed * player.facing;
                const vy = weapon.bulletSpeed * angle;
                bullets.push({ x: player.x + (player.facing > 0 ? player.width : -6), y: player.y + player.height / 2 - 1, vx: vx, vy: vy, width: 4, height: 4, damage: weapon.damage, from: 'player' });
              }
            } else if (wKey === 'laser') {
              // laser bullet is longer and does less damage but fires very fast
              bullets.push({ x: player.x + (player.facing > 0 ? player.width : -12), y: player.y + player.height / 2 - 2, vx: weapon.bulletSpeed * player.facing, vy: 0, width: 12, height: 4, damage: weapon.damage, from: 'player' });
            } else {
              // pistol and rifle fire single bullet horizontally
              bullets.push({ x: player.x + (player.facing > 0 ? player.width : -6), y: player.y + player.height / 2 - 2, vx: weapon.bulletSpeed * player.facing, vy: 0, width: 6, height: 3, damage: weapon.damage, from: 'player' });
            }
          }
          // After firing bullets decrement ammo and set cooldown
          player.ammoInClip[wKey]--;
          player.shootCooldown = weapon.fireRate;
          // Play appropriate gunshot sound for the equipped weapon
          let sfxToPlay = null;
          if (wKey === 'pistol') sfxToPlay = pistolSfx;
          else if (wKey === 'rifle') sfxToPlay = rifleSfx;
          else if (wKey === 'shotgun') sfxToPlay = shotgunSfx;
          else if (wKey === 'laser') sfxToPlay = laserSfx;
          if (sfxToPlay) {
            try {
              sfxToPlay.currentTime = 0;
              sfxToPlay.play();
            } catch (err) {}
          }
        }
        // Reload
        if ((keys['x'] || keys['X']) && !player.reloading && player.ammoInClip[wKey] < weapon.magazine && player.reserveAmmo[wKey] > 0) {
          player.reloading = true;
          player.reloadTimer = weapon.reloadTime;
        }
        // Ladder climbing overrides horizontal and vertical movement.  When
        // climbing, horizontal movement is suppressed and vertical
        // movement is controlled by up/down keys.  Gravity is disabled
        // further below when climbing.  Only process climbing logic
        // during play state and when not reloading.
        if (player.isClimbing) {
          // lock facing so the sprite remains consistent while climbing
          // (optional; left/right keys are ignored on a ladder)
          player.vx = 0;
          if (upPress) {
            player.vy = -moveSpeed;
          } else if (downPress) {
            player.vy = moveSpeed;
          } else {
            player.vy = 0;
          }
        }
      }
      // Cooldowns
      player.shootCooldown = Math.max(0, player.shootCooldown - dt);
      // Reload progress
      if (player.reloading) {
        player.reloadTimer -= dt;
        if (player.reloadTimer <= 0) {
          const needed = weapon.magazine - player.ammoInClip[wKey];
          const ammoUsed = Math.min(needed, player.reserveAmmo[wKey]);
          player.ammoInClip[wKey] += ammoUsed;
          player.reserveAmmo[wKey] -= ammoUsed;
          player.reloading = false;
        }
      }
      // Gravity: if the player is climbing a ladder then gravity is
      // suppressed.  Otherwise a constant acceleration pulls them
      // downward.  Jumping sets an upward velocity earlier in the
      // update.
      if (!player.isClimbing) {
        player.vy += 0.35;
      }
      // Apply velocities
      player.x += player.vx;
      player.y += player.vy;
      // If climbing down a ladder and we reach the ground, snap to the
      // ground and exit climbing.  Without this check the player can
      // descend below the floor when holding down on a ladder.
      if (player.isClimbing && player.y + player.height > groundY) {
        player.y = groundY - player.height;
        player.vy = 0;
        player.onGround = true;
        player.isClimbing = false;
      }
      // Constrain player to horizontal world boundaries
      if (player.x < 0) player.x = 0;
      if (player.x > worldWidth - player.width) player.x = worldWidth - player.width;
      // Resolve collisions with obstacles (platforms, crates, shields, barricades)
      if (!player.isClimbing) {
        for (let oi = 0; oi < obstacles.length; oi++) {
          const ob = obstacles[oi];
          // Vertical landing: if the player's previous bottom was above the top
          // of the obstacle and the new bottom overlaps, snap the player on top.
          if (prevY + player.height <= ob.y &&
              player.y + player.height >= ob.y &&
              player.x + player.width > ob.x &&
              player.x < ob.x + ob.width) {
            player.y = ob.y - player.height;
            player.vy = 0;
            player.onGround = true;
          }
          // Horizontal collision: if the player overlaps horizontally and
          // vertically but did not land on top, push them out.
          if (rectIntersect(player, ob)) {
            if (prevX + player.width <= ob.x) {
              // Came from left
              player.x = ob.x - player.width;
            } else if (prevX >= ob.x + ob.width) {
              // Came from right
              player.x = ob.x + ob.width;
            }
          }
        }
      }
      // If the player hasn't landed on an obstacle or platform and has fallen
      // below the ground plane, snap to the ground.  This check is skipped
      // while climbing so that ladders work properly.
      if (!player.onGround && !player.isClimbing && player.y + player.height >= groundY) {
        player.y = groundY - player.height;
        player.vy = 0;
        player.onGround = true;
      }
      // Update player falling off world
      if (player.y > height + 200) {
        player.health = 0;
        gameState = 'gameover';
      }
      // Update bullets.  In addition to moving bullets and culling those
      // outside the world, we also check whether they collide with any
      // obstacles.  Bullets that hit a crate or platform are destroyed
      // immediately, allowing the player to take cover.
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        // Remove bullets that strike obstacles
        let removed = false;
        for (let oi = 0; oi < obstacles.length; oi++) {
          const ob = obstacles[oi];
          if (rectIntersect(b, ob)) {
            bullets.splice(i, 1);
            removed = true;
            break;
          }
        }
        if (removed) continue;
        // Remove bullets that leave the world
        if (b.x < 0 || b.x > worldWidth || b.y < -50 || b.y > height + 50) {
          bullets.splice(i, 1);
        }
      }
      // Update enemy bullets with the same obstacle check
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.x += b.vx;
        b.y += b.vy;
        let removed = false;
        for (let oi = 0; oi < obstacles.length; oi++) {
          const ob = obstacles[oi];
          if (rectIntersect(b, ob)) {
            enemyBullets.splice(i, 1);
            removed = true;
            break;
          }
        }
        if (removed) continue;
        if (b.x < 0 || b.x > worldWidth || b.y < -50 || b.y > height + 50) {
          enemyBullets.splice(i, 1);
        }
      }
      // Update enemies
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.animTime += dt;
        // Decrease attack timer if currently attacking
        if (e.attackTimer > 0) e.attackTimer = Math.max(0, e.attackTimer - dt);
        // Randomly change horizontal direction on a timer to make roaming behaviour
        e.changeDirTimer -= dt;
        if (e.changeDirTimer <= 0) {
          e.dir = (Math.random() < 0.5 ? -1 : 1);
          e.changeDirTimer = 1000 + Math.random() * 2000;
        }
        // Save previous positions for collision resolution
        const prevX = e.x;
        const prevY = e.y;
        // Horizontal movement will be overridden if climbing a ladder
        e.x += e.speed * e.dir;
        // Handle movement and gravity for non‑floating enemies
        if (e.type !== 'ghost') {
          let climbing = false;
          // Only certain enemy types can climb ladders.  Robots and
          // aliens will attempt to climb toward the player's vertical
          // position when intersecting a ladder.  Zombies are limited to
          // walking and jumping and cannot climb.
          if (e.type === 'robot' || e.type === 'alien') {
            for (let li = 0; li < ladders.length; li++) {
              const lad = ladders[li];
              // simple AABB overlap check
              if (e.x + e.width > lad.x && e.x < lad.x + lad.width &&
                  e.y + e.height > lad.y && e.y < lad.y + lad.height) {
                // If the player is above the enemy's centre, climb up; if below, climb down
                const enemyMidY = e.y + e.height / 2;
                const playerMidY = player.y + player.height / 2;
                const climbSpeed = 1.5;
                // align horizontally to the ladder centre to avoid falling off
                e.x = lad.x + lad.width / 2 - e.width / 2;
                // Determine climb direction
                if (playerMidY < enemyMidY - 8) {
                  e.vy = -climbSpeed;
                  climbing = true;
                } else if (playerMidY > enemyMidY + 8) {
                  e.vy = climbSpeed;
                  climbing = true;
                }
                break;
              }
            }
          }
          // If not climbing, apply gravity and horizontal motion
          if (!climbing) {
            // Apply gravity
            e.vy += 0.25;
          }
          // Apply vertical velocity
          e.y += e.vy;
          e.onGround = false;
          // Resolve collisions with obstacles for landing and side collisions
          for (let oi = 0; oi < obstacles.length; oi++) {
            const ob = obstacles[oi];
            // Vertical landing
            if (prevY + e.height <= ob.y && e.y + e.height >= ob.y &&
                e.x + e.width > ob.x && e.x < ob.x + ob.width) {
              e.y = ob.y - e.height;
              e.vy = 0;
              e.onGround = true;
            }
            // Horizontal collision: if intersecting after movement
            if (rectIntersect(e, ob)) {
              if (prevX + e.width <= ob.x) {
                // Came from left, push left
                e.x = ob.x - e.width;
                // Try to jump over the obstacle with some probability; otherwise reverse direction
                if (Math.random() < 0.5) {
                  e.vy = -6;
                } else {
                  e.dir *= -1;
                }
              } else if (prevX >= ob.x + ob.width) {
                // Came from right
                e.x = ob.x + ob.width;
                if (Math.random() < 0.5) {
                  e.vy = -6;
                } else {
                  e.dir *= -1;
                }
              }
            }
          }
          // Land on ground if falling below ground level
          if (!e.onGround && e.y + e.height >= groundY) {
            e.y = groundY - e.height;
            e.vy = 0;
            e.onGround = true;
          }
        } else {
          // Ghosts float up and down while moving horizontally
          e.phase += dt * 0.002;
          e.y = e.baseY + Math.sin(e.phase * 2) * 30;
        }
        // Shooting logic for armed enemies
        if (e.type === 'robot' || e.type === 'alien') {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            const dir = player.x < e.x ? -1 : 1;
            // Determine bullet speed and damage based on enemy type
            let bulletSpeed = 4;
            let dmg = 6;
            if (e.type === 'robot') { bulletSpeed = 4; dmg = 8; }
            if (e.type === 'alien') { bulletSpeed = 5; dmg = 6; }
            // Adjust bullet damage based on difficulty
            if (SETTINGS.difficulty === 'easy') dmg = Math.max(1, dmg - 2);
            else if (SETTINGS.difficulty === 'hard') dmg += 2;
            enemyBullets.push({ x: e.x + (dir < 0 ? -8 : e.width), y: e.y + e.height / 2 - 2, vx: dir * bulletSpeed, vy: 0, width: 8, height: 4, damage: dmg, from: 'enemy' });
            // Set an attack timer so that drawing can show an attack frame
            e.attackTimer = 200;
            // Reset the shoot timer with different cadence for each type
            if (e.type === 'robot') e.shootTimer = 2000 + Math.random() * 1000;
            else e.shootTimer = 2500 + Math.random() * 1000;
          }
        }
        // Remove enemies too far behind or ahead of the camera view
        if (e.x + e.width < player.x - width * 2 || e.x > player.x + width * 3) {
          enemies.splice(i, 1);
          continue;
        }
      }
      // Collisions: player bullets vs enemies
      for (let bi=bullets.length-1; bi>=0; bi--) {
        const b = bullets[bi];
        for (let ei=enemies.length-1; ei>=0; ei--) {
          const e = enemies[ei];
          if (rectIntersect(b,e)) {
            // Reduce health and mark hit. Flash red for 150ms.
            e.health -= b.damage;
            e.hitTimer = 150;
            // Remove bullet
            bullets.splice(bi,1);
            // If enemy dies, spawn particle explosion and pickups, then
            // remove it from the list
            if (e.health <= 0) {
              spawnParticles(e);
              spawnPickups(e);
              // Play enemy death sound effect
              try {
                enemyDeathSfx.currentTime = 0;
                enemyDeathSfx.play();
              } catch (err) {}
              enemies.splice(ei,1);
            }
            break;
          }
        }
      }
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
          // integrate velocity (approximate dt in seconds for better physics)
          const sec = dt / 1000;
          p.x += p.vx;
          p.y += p.vy;
          // apply gravity
          p.vy += 0.05;
          p.life -= dt;
          if (p.life <= 0) {
            particles.splice(i, 1);
          }
        }
      }
      // Enemy bullets vs player
      for (let i=enemyBullets.length-1; i>=0; i--) {
        const b = enemyBullets[i];
        if (rectIntersect(b, player)) {
          player.health -= b.damage;
          enemyBullets.splice(i,1);
          // Play damage sound when hit by a bullet
          try {
            playerDamageSfx.currentTime = 0;
            playerDamageSfx.play();
          } catch (err) {}
          if (player.health <= 0) {
            gameState = 'gameover';
          }
        }
      }
      // Enemies vs player contact
      for (let i=enemies.length-1; i>=0; i--) {
        const e = enemies[i];
        if (rectIntersect(e, player)) {
          // When an enemy collides with the player it deals damage and knocks
          // the player slightly backwards.  Set the enemy into an attack
          // state so the attack animation can be shown in drawGame().
          player.health -= 5;
          if (player.x < e.x) player.x -= 10; else player.x += 10;
          // Trigger attack animation for this enemy
          e.attackTimer = 200;
          // Play damage sound when enemy makes contact
          try {
            playerDamageSfx.currentTime = 0;
            playerDamageSfx.play();
          } catch (err) {}
          if (player.health <= 0) {
            gameState = 'gameover';
          }
        }
      }
      // Pickups vs player
      for (let i=pickups.length-1; i>=0; i--) {
        const p = pickups[i];
        if (rectIntersect(p, player)) {
          if (p.type === 'gold') {
            player.gold += p.value;
          } else if (p.type === 'ammo') {
            const key = p.ammoType;
            player.reserveAmmo[key] += p.value;
          } else if (p.type === 'health') {
            // Health packs restore a small amount of HP but cannot exceed the maximum
            player.health = Math.min(player.health + (p.value || 5), 100);
          }
          pickups.splice(i,1);
        }
      }
      // Spawn new enemies periodically
      spawnCooldown -= dt;
      if (spawnCooldown <= 0 && gameState === 'play') {
        spawnEnemy();
        // Base spawn cooldown in milliseconds.  As the game progresses the
        // interval between spawns decreases to ramp up the pressure.  The
        // reduction factor scales linearly over two minutes down to a
        // minimum of 40% of the base interval.  Difficulty still scales
        // the base value before the time factor is applied.
        let baseCooldown = 1200 + Math.random() * 1200;
        // Adjust spawn rate by difficulty: easy spawns slower, hard spawns faster
        if (SETTINGS.difficulty === 'easy') baseCooldown *= 1.4;
        else if (SETTINGS.difficulty === 'hard') baseCooldown *= 0.7;
        // Apply time‑based factor.  After two minutes the factor bottoms out
        // at 0.4.  Prior to that it linearly decreases from 1 to 0.4.
        const timeFactor = Math.max(0.4, 1 - (elapsedTime / 120000));
        spawnCooldown = baseCooldown * timeFactor;
      }
    }

    /**
     * Draw the entire scene. Handles parallax background, stars,
     * ground, pickups, enemies, bullets, player, HUD and overlays.
     */
    function drawGame() {
      const cameraX = Math.max(0, Math.min(worldWidth - width, player.x - 150));
      // Draw parallax background
      if (bgLoaded) {
        const scale = height / backgroundImg.height;
        const imgW = backgroundImg.width * scale;
        // Scroll background at half the camera speed for parallax effect
        const bgScroll = cameraX * 0.5;
        let x = - (bgScroll % imgW);
        while (x < width) {
          ctx.drawImage(backgroundImg, 0, 0, backgroundImg.width, backgroundImg.height,
                        x, 0, imgW, height);
          x += imgW;
        }
      } else {
        // Fallback dark space
        ctx.fillStyle = '#000010';
        ctx.fillRect(0,0,width,height);
      }
      // Draw starfield on top of background
      stars.forEach(s => {
        if (s.x >= cameraX - width && s.x <= cameraX + width*2) {
          const px = s.x - cameraX;
          ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
          ctx.fillRect(px, s.y, s.size, s.size);
        }
      });
      // Draw ground (semi‑transparent dark strip)
      ctx.fillStyle = 'rgba(0,0,30,0.8)';
      ctx.fillRect(0, groundY, width, height - groundY);
      // Draw pickups
      pickups.forEach(p => {
        const px = p.x - cameraX;
        // Draw each pickup based on its type.  Use sprite sheet frames for
        // coins and ammo; health packs are drawn manually so they work even
        // without a pre‑made asset.
        if (sheetLoaded) {
          if (p.type === 'gold') {
            const f = ANIMATIONS.coin;
            ctx.drawImage(spriteSheet, f.sx, f.sy, 32, 32, px, p.y, p.width, p.height);
          } else if (p.type === 'ammo') {
            let f;
            if (p.ammoType === 'pistol') f = ANIMATIONS.ammoPistol;
            else if (p.ammoType === 'rifle') f = ANIMATIONS.ammoRifle;
            else if (p.ammoType === 'shotgun') f = ANIMATIONS.ammoShotgun;
            else f = ANIMATIONS.ammoLaser;
            ctx.drawImage(spriteSheet, f.sx, f.sy, 32, 32, px, p.y, p.width, p.height);
          } else if (p.type === 'health') {
            // Draw a simple white box with a red cross to represent a health pack
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px, p.y, p.width, p.height);
            ctx.fillStyle = '#ff4444';
            // Horizontal bar of cross
            ctx.fillRect(px + p.width * 0.2, p.y + p.height * 0.45, p.width * 0.6, p.height * 0.1);
            // Vertical bar of cross
            ctx.fillRect(px + p.width * 0.45, p.y + p.height * 0.2, p.width * 0.1, p.height * 0.6);
          }
        } else {
          // Fallback colours when the sprite sheet isn't available
          if (p.type === 'gold') {
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(px, p.y, p.width, p.height);
          } else if (p.type === 'ammo') {
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(px, p.y, p.width, p.height);
          } else if (p.type === 'health') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px, p.y, p.width, p.height);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(px + p.width * 0.2, p.y + p.height * 0.45, p.width * 0.6, p.height * 0.1);
            ctx.fillRect(px + p.width * 0.45, p.y + p.height * 0.2, p.width * 0.1, p.height * 0.6);
          }
        }
      });

      // Draw obstacles and ladders.  Platforms are dark metallic beams, crates
      // are brown boxes, shields glow blue and barricades are grey.  Ladders
      // consist of vertical rails and evenly spaced rungs.  These are drawn
      // before enemies and bullets so they act as background cover.
      obstacles.forEach(ob => {
        const px = ob.x - cameraX;
        if (ob.type === 'crate') {
          // Draw a military/industrial style crate with rivets and
          // highlights.  Use layered rectangles and small rivet dots to
          // evoke a retro sci‑fi aesthetic reminiscent of early console
          // games such as Metroid.
          const baseCol = '#52402a';    // main crate colour
          const highlight = '#816b44';   // lighter colour for top/left edges
          const shadow = '#3b2c1a';      // darker colour for bottom/right edges
          // Base fill
          ctx.fillStyle = baseCol;
          ctx.fillRect(px, ob.y, ob.width, ob.height);
          // Top and left highlights
          ctx.fillStyle = highlight;
          // Top strip
          ctx.fillRect(px, ob.y, ob.width, Math.max(2, ob.height * 0.08));
          // Left strip
          ctx.fillRect(px, ob.y, Math.max(2, ob.width * 0.06), ob.height);
          // Bottom and right shadows
          ctx.fillStyle = shadow;
          ctx.fillRect(px, ob.y + ob.height - Math.max(2, ob.height * 0.08), ob.width, Math.max(2, ob.height * 0.08));
          ctx.fillRect(px + ob.width - Math.max(2, ob.width * 0.06), ob.y, Math.max(2, ob.width * 0.06), ob.height);
          // Add some horizontal girders across the crate
          ctx.fillStyle = '#705430';
          for (let gy = 0.25; gy < 1; gy += 0.25) {
            const yPos = ob.y + gy * ob.height - 1;
            ctx.fillRect(px + 4, yPos, ob.width - 8, 2);
          }
          // Draw rivets along the edges (small dots)
          ctx.fillStyle = '#2e1f0a';
          const rivetCountX = Math.max(2, Math.floor(ob.width / 20));
          const rivetCountY = Math.max(2, Math.floor(ob.height / 20));
          for (let i = 0; i < rivetCountX; i++) {
            const rx = px + 4 + i * ((ob.width - 8) / (rivetCountX - 1));
            // Top rivets
            ctx.fillRect(rx, ob.y + 2, 2, 2);
            // Bottom rivets
            ctx.fillRect(rx, ob.y + ob.height - 4, 2, 2);
          }
          for (let j = 0; j < rivetCountY; j++) {
            const ry = ob.y + 4 + j * ((ob.height - 8) / (rivetCountY - 1));
            // Left rivets
            ctx.fillRect(px + 2, ry, 2, 2);
            // Right rivets
            ctx.fillRect(px + ob.width - 4, ry, 2, 2);
          }
        } else {
          // Choose colour based on type for other obstacles
          let col;
          if (ob.type === 'platform') col = '#2b2b33';
          else if (ob.type === 'shield') col = '#3366cc';
          else if (ob.type === 'barricade') col = '#555555';
          else col = '#444444';
          ctx.fillStyle = col;
          ctx.fillRect(px, ob.y, ob.width, ob.height);
          // Add a highlight/outline for a bit of depth
          ctx.strokeStyle = '#222222';
          ctx.strokeRect(px, ob.y, ob.width, ob.height);
        }
      });
      // Draw ladders
      ladders.forEach(lad => {
        const px = lad.x - cameraX;
        // Draw two vertical rails
        ctx.fillStyle = '#666666';
        ctx.fillRect(px, lad.y, 4, lad.height);
        ctx.fillRect(px + lad.width - 4, lad.y, 4, lad.height);
        // Draw rungs every 8 pixels
        ctx.fillStyle = '#888888';
        for (let y=0; y<lad.height; y+=8) {
          ctx.fillRect(px + 4, lad.y + y, lad.width - 8, 2);
        }
      });
      // Draw enemies
      enemies.forEach(e => {
        const px = e.x - cameraX;
        // Draw health bar above each enemy.  A dark background bar shows
        // maximum health, with the filled portion representing current
        // health.  The bar width is proportional to the enemy width.
        const barWidth = e.width;
        const barHeight = 4;
        const healthPct = Math.max(0, e.health) / e.maxHealth;
        ctx.fillStyle = 'rgba(50,50,50,0.8)';
        ctx.fillRect(px, e.y - 8, barWidth, barHeight);
        ctx.fillStyle = healthPct > 0.5 ? '#33cc33' : (healthPct > 0.25 ? '#ddbb00' : '#cc3333');
        ctx.fillRect(px, e.y - 8, barWidth * healthPct, barHeight);

        // Choose animation frames based on type and whether the enemy is currently attacking.
        let frames;
        if (sheetLoaded) {
          // When attackTimer is active, select special attack frames if available.
          if (e.attackTimer > 0) {
            if (e.type === 'zombie') frames = ANIMATIONS.zombieAttack;
            else if (e.type === 'alien') frames = ANIMATIONS.alienAttack;
            else if (e.type === 'robot') frames = ANIMATIONS.robotWalk; // robots reuse walk frames
            else if (e.type === 'ghost') frames = ANIMATIONS.ghostFloat;
          }
          // Default walking/floating animations
          if (!frames) {
            if (e.type === 'robot') frames = ANIMATIONS.robotWalk;
            else if (e.type === 'zombie') frames = ANIMATIONS.zombieWalk;
            else if (e.type === 'ghost') frames = ANIMATIONS.ghostFloat;
            else if (e.type === 'alien') frames = ANIMATIONS.alienWalk;
          }
        }
        if (sheetLoaded && frames) {
          const idx = Math.floor(e.animTime / 150) % frames.length;
          const f = frames[idx];
          ctx.drawImage(spriteSheet, f.sx, f.sy, 32, 32, px, e.y, e.width, e.height);
          // If hit recently, overlay a semi‑transparent red flash
          if (e.hitTimer && e.hitTimer > 0) {
            const alpha = Math.min(0.6, e.hitTimer / 150 * 0.6);
            ctx.fillStyle = `rgba(255,0,0,${alpha})`;
            ctx.fillRect(px, e.y, e.width, e.height);
          }
        } else {
          // fallback coloured rectangles
          if (e.type === 'zombie') ctx.fillStyle = '#00aa00';
          else if (e.type === 'ghost') ctx.fillStyle = '#aaaaff';
          else if (e.type === 'alien') ctx.fillStyle = '#55ff55';
          else ctx.fillStyle = '#ff8844';
          ctx.fillRect(px, e.y, e.width, e.height);
        }
      });
      // Draw particle effects if enabled
      if (SETTINGS.particles) {
        particles.forEach(p => {
          const px = p.x - cameraX;
          // Fade based on remaining life
          const alpha = Math.max(0, p.life / p.maxLife);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha;
          ctx.fillRect(px, p.y, 4, 4);
          ctx.globalAlpha = 1;
        });
      }
      // Draw player bullets
      bullets.forEach(b => {
        const px = b.x - cameraX;
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(px, b.y, b.width, b.height);
      });
      // Draw enemy bullets
      enemyBullets.forEach(b => {
        const px = b.x - cameraX;
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(px, b.y, b.width, b.height);
      });
      // Draw player
      const ppx = player.x - cameraX;
      if (sheetLoaded) {
        // Determine which animation frames to use.  Jump takes priority,
        // followed by shooting, running, idle.  When crouching we reuse
        // the same frames but draw only the lower portion of each frame
        // (cropping off the top) to simulate ducking.  Shooting while
        // crouched uses the shoot frames; moving while crouched uses
        // running frames; otherwise the idle frame is used.
        let frames;
        const isShooting = (keys['z'] || keys['Z']) && player.shootCooldown > 0;
        if (!player.onGround) {
          frames = ANIMATIONS.playerJump;
        } else if (player.isDucking) {
          if (isShooting) {
            frames = ANIMATIONS.playerShoot;
          } else if (Math.abs(player.vx) > 0.1) {
            frames = ANIMATIONS.playerRun;
          } else {
            frames = ANIMATIONS.playerIdle;
          }
        } else {
          if (isShooting) {
            frames = ANIMATIONS.playerShoot;
          } else if (Math.abs(player.vx) > 0.1) {
            frames = ANIMATIONS.playerRun;
          } else {
            frames = ANIMATIONS.playerIdle;
          }
        }
        const idx = Math.floor(player.animTime / 150) % frames.length;
        const f = frames[idx];
        ctx.save();
        // Calculate cropping for crouch: when ducking we draw only the
        // bottom portion of the 32px sprite.  The amount to crop off the
        // top equals (32 - current player.height).
        const cropOffsetY = player.isDucking ? (32 - player.height) : 0;
        const cropHeight = player.isDucking ? player.height : 32;
        if (player.facing < 0) {
          ctx.translate(ppx + player.width, player.y);
          ctx.scale(-1,1);
          ctx.drawImage(spriteSheet, f.sx, f.sy + cropOffsetY, 32, cropHeight, 0, 0, player.width, player.height);
        } else {
          ctx.drawImage(spriteSheet, f.sx, f.sy + cropOffsetY, 32, cropHeight, ppx, player.y, player.width, player.height);
        }
        ctx.restore();
      } else {
        // fallback: simple rectangle when sprites are not loaded
        ctx.fillStyle = '#0077ff';
        ctx.fillRect(ppx, player.y, player.width, player.height);
      }
      // HUD: draw health bar, reload bar and ammo/weapon info using retro sci‑fi fonts.
      // These elements should only appear during gameplay and shop screens.  Hide
      // them on the start, pause and settings menus to avoid clutter behind the
      // overlays.  This conditional prevents the old text panels showing up
      // behind menus as seen in earlier builds.
      if (gameState === 'play' || gameState === 'shop') {
        const barX = 12;
        const barY = 12;
        const barW = 180;
        const barH = 14;
        // Health bar background
        ctx.fillStyle = 'rgba(20,20,40,0.7)';
        ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
        ctx.fillStyle = '#444444';
        ctx.fillRect(barX, barY, barW, barH);
        // Health bar fill
        const hPct = Math.max(0, player.health) / 100;
        ctx.fillStyle = hPct > 0.5 ? '#33ff33' : (hPct > 0.25 ? '#ffdd33' : '#ff3333');
        ctx.fillRect(barX, barY, barW * hPct, barH);
        // Health text overlay
        ctx.font = '14px "Press Start 2P", Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(`HP`, barX + barW + 6, barY + barH/2);

        // Draw GOLD, WEAPON and AMMO panels beneath the health bar.  Each
        // panel has a dark background and a neon outline to match the
        // health bar aesthetic.  Use the retro font for labels.
        const panelW = 180;
        const panelH = 14;
        const panelSpacing = 4;
        // Determine text values
        const wInfo = WEAPONS[player.weapon];
        const ammoText = `${player.ammoInClip[player.weapon]}/${player.reserveAmmo[player.weapon]}`;
        const panelLabels = [
          `GOLD: ${player.gold}`,
          `WEAPON: ${wInfo.name.toUpperCase()}`,
          `AMMO: ${ammoText}`
        ];
        for (let i = 0; i < panelLabels.length; i++) {
          const py = barY + barH + 6 + i * (panelH + panelSpacing);
          // background
          ctx.fillStyle = 'rgba(20,20,40,0.7)';
          ctx.fillRect(barX - 2, py - 2, panelW + 4, panelH + 4);
          ctx.fillStyle = '#333344';
          ctx.fillRect(barX, py, panelW, panelH);
          // outline
          ctx.strokeStyle = '#00aaff';
          ctx.lineWidth = 1;
          ctx.strokeRect(barX, py, panelW, panelH);
          // text
          ctx.font = '12px "Press Start 2P", Arial';
          ctx.fillStyle = '#88ccff';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.fillText(panelLabels[i], barX + 4, py + panelH / 2);
        }
        // Reload bar: show below the player sprite when reloading
        if (player.reloading) {
          const pct = 1 - player.reloadTimer / WEAPONS[player.weapon].reloadTime;
          const rW = player.width;
          const rH = 4;
          const rx = ppx;
          const ry = player.y - 8;
          ctx.fillStyle = 'rgba(20,20,40,0.7)';
          ctx.fillRect(rx - 1, ry - 1, rW + 2, rH + 2);
          ctx.fillStyle = '#5555aa';
          ctx.fillRect(rx, ry, rW, rH);
          ctx.fillStyle = '#88aaff';
          ctx.fillRect(rx, ry, rW * pct, rH);
        }
      }
      // Shop overlay
      if (gameState === 'shop') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, width, height);
        // Widen the shop panel to allow generous column spacing
        const panelW = 560;
        const rowSpacing = 36;
        const panelH = 220 + SHOP_ITEMS.length * rowSpacing;
        const panelX = (width - panelW) / 2;
        const panelY = (height - panelH) / 2;
        // Panel body and outline
        ctx.fillStyle = 'rgba(0, 0, 20, 0.9)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        // Title
        ctx.fillStyle = '#00ccff';
        ctx.font = '26px "Orbitron", Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SHOP', panelX + panelW / 2, panelY + 44);
        // Player gold top right
        ctx.font = '12px "Press Start 2P", Arial';
        ctx.fillStyle = '#88ccff';
        ctx.textAlign = 'right';
        ctx.fillText(`GOLD: ${player.gold}`, panelX + panelW - 16, panelY + 26);
        ctx.textAlign = 'left';
        // List items
        ctx.font = '14px "Press Start 2P", Arial';
        const listStartY = panelY + 100;
        SHOP_ITEMS.forEach((item, i) => {
          const y = listStartY + i * rowSpacing;
          const selected = (i === menuSelection);
          // Determine text based on type
          let nameText, costText, extraText;
          if (item.type === 'weapon') {
            const w = WEAPONS[item.key];
            nameText = w.name.toUpperCase();
            costText = `COST: ${w.cost}`;
            extraText = `MAG: ${w.magazine}`;
          } else {
            nameText = item.name.toUpperCase();
            costText = `COST: ${item.cost}`;
            extraText = `QTY: ${item.qty}`;
          }
          // Name column
          ctx.fillStyle = selected ? '#ffdd55' : '#cccccc';
          ctx.fillText(nameText, panelX + 20, y);
          // Cost column
          ctx.fillStyle = selected ? '#ffffaa' : '#8888aa';
          ctx.fillText(costText, panelX + 300, y);
          // Extra column (magazine/qty)
          ctx.fillStyle = selected ? '#ffffaa' : '#8888aa';
          ctx.fillText(extraText, panelX + 460, y);
        });
        // Instructions: centre bottom line.  Use top baseline to avoid overlap
        ctx.font = '12px "Orbitron", Arial';
        ctx.fillStyle = '#ffdd55';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('ENTER: BUY    P/ESC: CLOSE', panelX + panelW / 2, panelY + panelH - 44);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }
      // Game over overlay
      if (gameState === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0,0,width,height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff5555';
        ctx.font = '36px "Orbitron", Arial';
        ctx.fillText('GAME OVER', width/2, height/2 - 50);
        ctx.fillStyle = '#ffffff';
        ctx.font = '18px "Press Start 2P", Arial';
        ctx.fillText(`FINAL GOLD: ${player.gold}`, width/2, height/2 - 10);
        ctx.fillText('PRESS ENTER TO RESTART', width/2, height/2 + 24);
        ctx.textAlign = 'left';
      }

      // Start menu overlay
      if (gameState === 'start') {
        // Darken the scene behind the menu
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, width, height);
        // Widen the panel for ample space and breathe vertically
        const panelW = 480;
        const panelH = 260;
        const panelX = (width - panelW) / 2;
        const panelY = (height - panelH) / 2;
        // Panel base and outline
        ctx.fillStyle = 'rgba(0, 0, 20, 0.9)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        ctx.textAlign = 'center';
        // Title
        ctx.fillStyle = '#00ccff';
        ctx.font = '32px "Orbitron", Arial';
        ctx.fillText('SPACE COMMANDO', panelX + panelW / 2, panelY + 42);
        // Options
        const startOptions = ['START GAME', 'GAME SETTINGS'];
        ctx.font = '18px "Press Start 2P", Arial';
        const optStartY = panelY + 100;
        const optSpacing = 40;
        startOptions.forEach((opt, i) => {
          const y = optStartY + i * optSpacing;
          ctx.fillStyle = (i === startMenuSelection ? '#ffdd55' : '#cccccc');
          ctx.fillText(opt, panelX + panelW / 2, y);
        });
        // Instructions – split into two lines for better fit.  Use a top baseline
        // so that lines do not overlap even on pixelated fonts.  After drawing
        // restore the default text baseline.  Leave the text centred.
        ctx.font = '12px "Orbitron", Arial';
        ctx.fillStyle = '#ffdd55';
        ctx.textBaseline = 'top';
        const instrY = panelY + panelH - 52;
        ctx.fillText('ARROWS: NAVIGATE', panelX + panelW / 2, instrY);
        ctx.fillText('ENTER: SELECT', panelX + panelW / 2, instrY + 20);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }
      // Pause/menu overlay
      if (gameState === 'menu') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, width, height);
        const panelW = 480;
        const optionsCount = 3;
        const rowSpacing = 40;
        const panelH = 220 + optionsCount * rowSpacing;
        const panelX = (width - panelW) / 2;
        const panelY = (height - panelH) / 2;
        // Draw panel
        ctx.fillStyle = 'rgba(0, 0, 20, 0.9)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        ctx.textAlign = 'center';
        // Header
        ctx.fillStyle = '#00ccff';
        ctx.font = '30px "Orbitron", Arial';
        ctx.fillText('PAUSED', panelX + panelW / 2, panelY + 44);
        // Options
        const menuOptions = ['RETURN TO GAME', 'RESTART GAME', 'GAME SETTINGS'];
        ctx.font = '18px "Press Start 2P", Arial';
        const menuStartY = panelY + 100;
        menuOptions.forEach((opt, i) => {
          const y = menuStartY + i * rowSpacing;
          ctx.fillStyle = (i === mainMenuSelection ? '#ffdd55' : '#cccccc');
          ctx.fillText(opt, panelX + panelW / 2, y);
        });
        // Instructions: break across two lines.  Use a top baseline to
        // ensure proper line spacing with the retro font, then restore
        // baseline afterwards.
        ctx.font = '12px "Orbitron", Arial';
        ctx.fillStyle = '#ffdd55';
        ctx.textBaseline = 'top';
        const instrY = panelY + panelH - 52;
        ctx.fillText('ARROWS: NAVIGATE', panelX + panelW / 2, instrY);
        ctx.fillText('ENTER: SELECT    ESC: BACK', panelX + panelW / 2, instrY + 20);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }
      // Settings menu overlay
      if (gameState === 'settings') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, width, height);
        const settingKeys = ['difficulty', 'audio', 'particles'];
        // Panel sizing: wider and taller to comfortably fit labels and values
        const panelW = 520;
        const rowSpacing = 40;
        const panelH = 220 + settingKeys.length * rowSpacing;
        const panelX = (width - panelW) / 2;
        const panelY = (height - panelH) / 2;
        // Panel base and border
        ctx.fillStyle = 'rgba(0, 0, 20, 0.9)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        ctx.textAlign = 'center';
        // Header
        ctx.fillStyle = '#00ccff';
        ctx.font = '30px "Orbitron", Arial';
        ctx.fillText('SETTINGS', panelX + panelW / 2, panelY + 44);
        // Draw each setting: align labels left and values right
        ctx.font = '16px "Press Start 2P", Arial';
        const settingsStartY = panelY + 100;
        settingKeys.forEach((key, i) => {
          const y = settingsStartY + i * rowSpacing;
          const selected = (i === settingsSelection);
          let label;
          let value;
          if (key === 'difficulty') {
            label = 'DIFFICULTY';
            value = SETTINGS.difficulty.toUpperCase();
          } else if (key === 'audio') {
            label = 'MUSIC';
            value = SETTINGS.audio ? 'ON' : 'OFF';
          } else if (key === 'particles') {
            label = 'PARTICLES';
            value = SETTINGS.particles ? 'ON' : 'OFF';
          }
          // Highlight selected line
          ctx.fillStyle = selected ? '#ffdd55' : '#cccccc';
          ctx.textAlign = 'left';
          // 60px padding from left edge for labels
          ctx.fillText(label, panelX + 60, y);
          ctx.textAlign = 'right';
          // Align values 60px from right edge
          ctx.fillStyle = selected ? '#ffffaa' : '#8888aa';
          ctx.fillText(value, panelX + panelW - 60, y);
        });
        // Instructions: broken into two concise lines.  Set a top baseline
        // for consistent spacing, then restore alignment.
        ctx.font = '12px "Orbitron", Arial';
        ctx.fillStyle = '#ffdd55';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const instrY = panelY + panelH - 56;
        ctx.fillText('←/→/ENTER: CHANGE', panelX + panelW / 2, instrY);
        ctx.fillText('ARROWS: NAVIGATE    ESC: BACK', panelX + panelW / 2, instrY + 20);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }
    }
    // Main loop
    let lastTime = performance.now();
    function loop(now) {
      const dt = now - lastTime;
      lastTime = now;
      if (gameState === 'play') {
        updateGame(dt);
      }
      drawGame();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
  // Wait for DOM to be ready then initialize
  window.addEventListener('load', init);
})();