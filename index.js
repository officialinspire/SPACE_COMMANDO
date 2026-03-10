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
    // Player crouching frames.  Because the sprite sheet does not
    // include dedicated crouch poses, reuse the idle frame for a
    // simple crouch.  When drawing these frames while ducking the
    // renderer will crop off the top portion of the sprite based on
    // player.height.  This array remains separate for clarity and
    // future extensibility.
    playerCrouch: [ {sx:0, sy:0} ],
    // Player crouch shooting frames.  Reuse the standing shoot frames.
    // These frames include muzzle flash.  When ducking the draw
    // function crops the top portion so the commando appears crouched.
    playerCrouchShoot: [ {sx:128, sy:0}, {sx:160, sy:0}, {sx:192, sy:0} ],
    // Player crouch walking frames.  Use the running frames to imply
    // movement while crouched.  As with other crouch animations the
    // draw routine crops the top based on player.height.
    playerCrouchWalk: [ {sx:0, sy:0}, {sx:32, sy:0}, {sx:64, sy:0}, {sx:96, sy:0} ],
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
  function updateControlsHeight() {
      const ctrl = document.getElementById('mobile-controls');
      if (!ctrl) return;
      window.requestAnimationFrame(() => {
        const h = Math.ceil(ctrl.getBoundingClientRect().height) || 0;
        document.documentElement.style.setProperty('--controls-height', h + 'px');
      });
    }

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

    // Expose fadeIn and menuMusic to window so intro video handler can start music
    window.fadeIn = fadeIn;
    window.menuMusic = menuMusic;

    // Menu music will start after the intro video ends (see index.html)
    // This prevents audio overlap between the intro video and background music.
    // Precompute random stars for a fallback starfield. These are drawn
    // if the background image fails to load or simply to add sparkle.
    const stars = [];
    for (let i=0; i<600; i++) {
      const layer = Math.random() < 0.35 ? 0 : (Math.random() < 0.7 ? 1 : 2);
      stars.push({
        x: Math.random() * worldWidth,
        y: Math.random() * height * 0.82,
        size: (layer === 0 ? 0.7 : (layer === 1 ? 1.2 : 1.8)) + Math.random() * 1.1,
        alpha: 0.22 + Math.random() * 0.55,
        layer,
        twinkle: Math.random() * Math.PI * 2
      });
    }
    // Input state: track whether keys are pressed
    const keys = {};
    // Edge-trigger bookkeeping for gameplay actions that should only
    // fire once per press (jump/reload and semi-auto shooting).
    let prevGameplayInput = { jump: false, shoot: false, reload: false };

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
            const alreadyOwned = !!player.ownedWeapons[key];
            // Enter on a weapon row buys+equips if not owned, otherwise just equips.
            if (alreadyOwned) {
              player.weapon = key;
            } else if (player.gold >= w.cost) {
              player.gold -= w.cost;
              player.ownedWeapons[key] = true;
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

    document.addEventListener('keydown', (e) => {
      keys[e.key] = true;
      // Prevent default scrolling on arrow keys and space.  Include both
      // space representations (' ', 'Space', 'Spacebar') to ensure the
      // browser never scrolls when jumping.
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Space','Spacebar'].includes(e.key)) {
        e.preventDefault();
      }
      // Ignore browser key-repeat for menu actions to avoid duplicate
      // selections, purchases and sound effects from a long press.
      if (!e.repeat) {
        handleMenuInput(e);
      }
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
    const isMobile =
      /Mobi|Android|iPhone|iPad|iPod|Tablet/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);

    if (isMobile) {
      const ctrlBar = document.getElementById('mobile-controls');
      if (ctrlBar) {
        ctrlBar.style.display = 'flex';
        updateControlsHeight();
        window.addEventListener('resize', updateControlsHeight);
        window.addEventListener('orientationchange', () => setTimeout(updateControlsHeight, 60));
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', updateControlsHeight);
        }

        const buttons = Array.from(ctrlBar.querySelectorAll('.control-btn'));
        const menuKeys = new Set(['Enter', 'Escape', 'p', 'P', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
        const pointerToButton = new Map();
        const activePointersByButton = new Map();
        const activeCountByKey = new Map();
        let lastTouchInteractionAt = 0;

        const setKeyState = (keyName, pressed) => {
          if (pressed) {
            const next = (activeCountByKey.get(keyName) || 0) + 1;
            activeCountByKey.set(keyName, next);
            keys[keyName] = true;
            return;
          }
          const next = Math.max((activeCountByKey.get(keyName) || 0) - 1, 0);
          if (next === 0) {
            activeCountByKey.delete(keyName);
            keys[keyName] = false;
          } else {
            activeCountByKey.set(keyName, next);
            keys[keyName] = true;
          }
        };

        const pressButton = (btn, keyName, pointerId, event, pointerType) => {
          if (event.cancelable) event.preventDefault();
          event.stopPropagation();

          const setForButton = activePointersByButton.get(btn) || new Set();
          if (setForButton.has(pointerId)) return;

          setForButton.add(pointerId);
          activePointersByButton.set(btn, setForButton);
          pointerToButton.set(pointerId, btn);
          if (setForButton.size === 1) btn.classList.add('pressed');
          setKeyState(keyName, true);

          if (pointerType === 'touch' || pointerType === 'pen') {
            lastTouchInteractionAt = performance.now();
            if (navigator.vibrate) navigator.vibrate(10);
          }

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
          setKeyState(keyName, false);

          if (setForButton.size === 0) {
            activePointersByButton.delete(btn);
            btn.classList.remove('pressed');
          }
        };

        const clearAllMobileInputs = () => {
          pointerToButton.forEach((btn, pointerId) => {
            const keyName = btn.getAttribute('data-key');
            releaseButton(btn, keyName, pointerId);
          });
          activeCountByKey.forEach((_, keyName) => {
            keys[keyName] = false;
          });
          activeCountByKey.clear();
          activePointersByButton.clear();
          pointerToButton.clear();
          buttons.forEach((btn) => btn.classList.remove('pressed'));
        };

        buttons.forEach((btn) => {
          const keyName = btn.getAttribute('data-key');

          btn.addEventListener('pointerdown', (event) => {
            pressButton(btn, keyName, event.pointerId, event, event.pointerType);
            if (btn.setPointerCapture) {
              try { btn.setPointerCapture(event.pointerId); } catch (err) {}
            }
          }, { passive: false });

          btn.addEventListener('pointerup', (event) => {
            releaseButton(btn, keyName, event.pointerId, event);
          }, { passive: false });

          btn.addEventListener('pointercancel', (event) => {
            releaseButton(btn, keyName, event.pointerId, event);
          }, { passive: false });

          btn.addEventListener('lostpointercapture', (event) => {
            releaseButton(btn, keyName, event.pointerId, event);
          }, { passive: false });

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
          const btn = pointerToButton.get(event.pointerId);
          if (!btn) return;
          const rect = btn.getBoundingClientRect();
          const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
          if (!inside) {
            const keyName = btn.getAttribute('data-key');
            releaseButton(btn, keyName, event.pointerId, event);
          }
        }, { passive: false });

        window.addEventListener('blur', clearAllMobileInputs);
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) clearAllMobileInputs();
        });

        ctrlBar.addEventListener('click', (event) => {
          if (performance.now() - lastTouchInteractionAt < 450) {
            event.preventDefault();
            event.stopPropagation();
          }
        }, true);
      }
    }

    // Collections for dynamic entities
    let bullets = [];
    let enemyBullets = [];
    let enemies = [];
    let pickups = [];
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
      reloadWeaponKey: null,
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

    /**
     * Reset all entities and player stats to their initial values. Called
     * when restarting after game over.
     */
    function restart() {
      elapsedTime = 0;
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
      spawnCooldown = 0;
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
      player.facing = 1;
      player.animTime = 0;
      player.onLadder = false;
      player.isClimbing = false;
      player.isDucking = false;
      player.invulnTimer = 0;
      player.hitFlashTimer = 0;
      prevGameplayInput = { jump: false, shoot: false, reload: false };
      Object.keys(keys).forEach((k) => { keys[k] = false; });
      menuSelection = 0;
      mainMenuSelection = 0;

      // Regenerate the random obstacles and ladders on each restart so the
      // battlefield feels fresh.  This also clears any leftover
      // environment from the previous run.
      if (typeof generateEnvironment === 'function') {
        generateEnvironment();
      }
    }

    /**
     * Spawn a new enemy ahead of the player. The type is selected
     * according to weights. Each enemy has its own speed, health and
     * attack behaviour.
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
      const type = weightedChoice([
        { item: 'zombie', weight: typeWeights.zombie },
        { item: 'ghost', weight: typeWeights.ghost },
        { item: 'robot', weight: typeWeights.robot },
        { item: 'alien', weight: typeWeights.alien }
      ]) || 'zombie';
      const spawnDir = Math.random() < 0.65 ? 1 : -1;
      const spawnOffset = width + 140 + Math.random() * 280;
      const spawnX = spawnDir > 0 ? (player.x + spawnOffset) : (player.x - spawnOffset);
      const e = {
        type: type,
        x: Math.max(32, Math.min(worldWidth - 64, spawnX)),
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
        contactDamageTimer: 0,
        preferredRange: 120,
        baseY: 0,
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
        e.preferredRange = 90;
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
      enemies.push(e);
    }

    /**
     * Spawn gold and ammo pickups at an enemy's location. Always drops
     * gold and randomly drops an ammo crate for a random weapon type.
     */
    function spawnPickups(enemy) {
      const goldByType = { zombie: [4, 7], ghost: [6, 10], robot: [5, 8], alien: [5, 9] };
      const [goldMin, goldMax] = goldByType[enemy.type] || [4, 7];
      const goldCount = goldMin + Math.floor(Math.random() * (goldMax - goldMin + 1));
      pickups.push({ x: enemy.x, y: groundY - 20, width:12, height:12, type:'gold', value: goldCount });

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
          pickups.push({ x: enemy.x + 16, y: groundY - 20, width:12, height:12, type:'ammo', ammoType:key, value: WEAPONS[key].ammoDrop });
        }
      }

      const healthDropChance = SETTINGS.difficulty === 'easy' ? 0.22 : (SETTINGS.difficulty === 'hard' ? 0.1 : 0.16);
      if (Math.random() < healthDropChance) {
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
      try {
        playerDamageSfx.currentTime = 0;
        playerDamageSfx.play();
      } catch (err) {}
      if (player.health <= 0) {
        gameState = 'gameover';
        // Transition to menu track on death so gameover/start screens
        // always use the same music context.
        fadeOut(gameMusic);
        fadeIn(menuMusic);
      }
      return true;
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
      player.invulnTimer = Math.max(0, player.invulnTimer - dt);
      player.hitFlashTimer = Math.max(0, player.hitFlashTimer - dt);

      const jumpPressed = keys[' '] || keys['Space'] || keys['Spacebar'];
      const shootPressed = keys['z'] || keys['Z'];
      const reloadPressed = keys['x'] || keys['X'];
      const jumpJustPressed = jumpPressed && !prevGameplayInput.jump;
      const shootJustPressed = shootPressed && !prevGameplayInput.shoot;
      const reloadJustPressed = reloadPressed && !prevGameplayInput.reload;

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
      if (player.isDucking) moveSpeed = 1.5;
      const moveLeft = keys['ArrowLeft'] || keys['a'] || keys['A'];
      const moveRight = keys['ArrowRight'] || keys['d'] || keys['D'];
      let desiredVX = 0;
      if (!player.reloading && gameState === 'play') {
        if (moveLeft) { desiredVX = -moveSpeed; player.facing = -1; }
        if (moveRight) { desiredVX = moveSpeed; player.facing = 1; }
        const accel = (player.onGround ? 0.34 : 0.18) * (dt / 16.67);
        const friction = (player.onGround ? 0.78 : 0.9);
        if (Math.abs(desiredVX) > 0.01) {
          player.vx += (desiredVX - player.vx) * Math.min(1, accel);
        } else {
          player.vx *= Math.pow(friction, dt / 16.67);
          if (Math.abs(player.vx) < 0.03) player.vx = 0;
        }
        // Jump
        // Detect spacebar across browsers: ' ' (space), 'Space', and
        // 'Spacebar'.  Only jump when onGround to prevent double jumps.
if (jumpJustPressed && wasOnGround && !player.isClimbing) {
  player.vy = -8;
  player.onGround = false;
  try { jumpSfx.currentTime = 0; jumpSfx.play(); } catch (err) {}
}
        // Shooting
        const shootKey = weapon.auto ? shootPressed : shootJustPressed;
        if (shootKey && player.ammoInClip[wKey] > 0 && player.shootCooldown <= 0) {
          // Determine if the player is attempting to shoot upward.  When
          // the up arrow (or W) is held at the moment the shot is
          // triggered we fire bullets vertically instead of horizontally.
          const shootUp = (keys['ArrowUp'] || keys['w'] || keys['W']);
          let muzzleX = player.x + player.width / 2;
          let muzzleY = player.y + player.height / 2;
          if (shootUp) {
            muzzleX = player.x + player.width / 2;
            muzzleY = player.y;
            if (wKey === 'shotgun') {
              // Chunky shotgun cone uses consistent spread with slight random jitter.
              const baseSpread = [-0.22, -0.1, 0, 0.1, 0.22];
              for (let i = 0; i < baseSpread.length; i++) {
                const horiz = (baseSpread[i] + (Math.random() - 0.5) * 0.03) * weapon.bulletSpeed;
                const bxW = 4;
                const bxH = 4;
                const bx = player.x + player.width / 2 - bxW / 2;
                const by = player.y - bxH;
                bullets.push({ x: bx, y: by, vx: horiz, vy: -weapon.bulletSpeed, width: bxW, height: bxH, damage: weapon.damage, from: 'player', weapon: wKey });
              }
            } else if (wKey === 'laser') {
              const bxW = 5;
              const bxH = 18;
              const bx = player.x + player.width / 2 - bxW / 2;
              const by = player.y - bxH;
              bullets.push({ x: bx, y: by, vx: 0, vy: -weapon.bulletSpeed, width: bxW, height: bxH, damage: weapon.damage, from: 'player', weapon: wKey, beam: true });
            } else {
              const bxW = 4;
              const bxH = 6;
              const bx = player.x + player.width / 2 - bxW / 2;
              const by = player.y - bxH;
              bullets.push({ x: bx, y: by, vx: 0, vy: -weapon.bulletSpeed, width: bxW, height: bxH, damage: weapon.damage, from: 'player', weapon: wKey });
            }
          } else {
            muzzleX = player.x + (player.facing > 0 ? player.width : 0);
            muzzleY = player.y + player.height / 2;
            if (wKey === 'shotgun') {
              const baseSpread = [-0.24, -0.12, 0, 0.12, 0.24];
              for (let i = 0; i < baseSpread.length; i++) {
                const angle = baseSpread[i] + (Math.random() - 0.5) * 0.04;
                const vx = weapon.bulletSpeed * player.facing;
                const vy = weapon.bulletSpeed * angle;
                bullets.push({ x: player.x + (player.facing > 0 ? player.width : -6), y: player.y + player.height / 2 - 1, vx: vx, vy: vy, width: 4, height: 4, damage: weapon.damage, from: 'player', weapon: wKey });
              }
            } else if (wKey === 'laser') {
              bullets.push({ x: player.x + (player.facing > 0 ? player.width : -18), y: player.y + player.height / 2 - 2, vx: weapon.bulletSpeed * player.facing, vy: 0, width: 18, height: 4, damage: weapon.damage, from: 'player', weapon: wKey, beam: true });
            } else {
              bullets.push({ x: player.x + (player.facing > 0 ? player.width : -6), y: player.y + player.height / 2 - 2, vx: weapon.bulletSpeed * player.facing, vy: 0, width: 6, height: 3, damage: weapon.damage, from: 'player', weapon: wKey });
            }
          }
          const flashKind = wKey === 'shotgun' ? 'shotgun' : (wKey === 'laser' ? 'laser' : 'default');
          addShotFlash(muzzleX, muzzleY, shootUp ? 0 : player.facing, shootUp ? -1 : 0, flashKind);
          spawnMuzzleParticles(muzzleX, muzzleY, shootUp ? 0 : player.facing, shootUp ? -1 : 0, flashKind);
          if (wKey === 'shotgun') {
            screenShakeTimer = Math.max(screenShakeTimer, 90);
            screenShakeStrength = Math.max(screenShakeStrength, 3.4);
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
              if (wKey === 'laser') {
                if (sfxToPlay.paused || sfxToPlay.currentTime > 0.08) sfxToPlay.currentTime = 0;
              } else {
                sfxToPlay.currentTime = 0;
              }
              sfxToPlay.play();
            } catch (err) {}
          }
        }
        // Reload
        if (reloadJustPressed && !player.reloading && player.ammoInClip[wKey] < weapon.magazine && player.reserveAmmo[wKey] > 0) {
          player.reloading = true;
          player.reloadTimer = weapon.reloadTime;
          player.reloadWeaponKey = wKey;
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
          const reloadKey = player.reloadWeaponKey || wKey;
          const reloadWeapon = WEAPONS[reloadKey];
          const needed = reloadWeapon.magazine - player.ammoInClip[reloadKey];
          const ammoUsed = Math.min(needed, player.reserveAmmo[reloadKey]);
          player.ammoInClip[reloadKey] += ammoUsed;
          player.reserveAmmo[reloadKey] -= ammoUsed;
          player.reloading = false;
          player.reloadWeaponKey = null;
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
        if (e.attackTimer > 0) e.attackTimer = Math.max(0, e.attackTimer - dt);
        if (e.contactDamageTimer > 0) e.contactDamageTimer = Math.max(0, e.contactDamageTimer - dt);

        const prevX = e.x;
        const prevY = e.y;
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
          const chaseYOffset = Math.max(-40, Math.min(45, (playerMidY - enemyMidY) * 0.16));
          e.baseY += ((groundY - e.height - 120 + chaseYOffset) - e.baseY) * 0.04;
          e.x += e.speed * e.dir;
          e.y = e.baseY + bob;
          if (e.y > groundY - e.height - 12) e.y = groundY - e.height - 12;
        } else {
          if (e.pathRecalcTimer <= 0) {
            if (e.type === 'zombie') {
              e.dir = dx < 0 ? -1 : 1;
            } else {
              const prefer = e.preferredRange;
              if (absDx > prefer + 24) e.dir = dx < 0 ? -1 : 1;
              else if (absDx < prefer - 24) e.dir = dx < 0 ? 1 : -1;
              else if (Math.random() < 0.18) e.dir *= -1;
            }
            e.pathRecalcTimer = 180 + Math.random() * 180;
          }
          if (e.changeDirTimer <= 0 && Math.random() < 0.25) {
            e.dir *= -1;
            e.changeDirTimer = 1000 + Math.random() * 1000;
          }

          e.x += e.speed * e.dir;

          let climbing = false;
          if (e.type === 'robot' || e.type === 'alien') {
            for (let li = 0; li < ladders.length; li++) {
              const lad = ladders[li];
              const closeToLadder = Math.abs((e.x + e.width / 2) - (lad.x + lad.width / 2)) < 18;
              const inVerticalSpan = e.y + e.height > lad.y && e.y < lad.y + lad.height;
              const wantVertical = Math.abs(playerMidY - enemyMidY) > 30;
              if (closeToLadder && inVerticalSpan && wantVertical) {
                e.x = lad.x + lad.width / 2 - e.width / 2;
                const climbSpeed = e.type === 'alien' ? 1.7 : 1.35;
                e.vy = playerMidY < enemyMidY ? -climbSpeed : climbSpeed;
                climbing = true;
                break;
              }
            }
          }

          if (!climbing) e.vy += 0.25;
          e.y += e.vy;
          e.onGround = false;

          for (let oi = 0; oi < obstacles.length; oi++) {
            const ob = obstacles[oi];
            if (prevY + e.height <= ob.y && e.y + e.height >= ob.y && e.x + e.width > ob.x && e.x < ob.x + ob.width) {
              e.y = ob.y - e.height;
              e.vy = 0;
              e.onGround = true;
            }
            if (rectIntersect(e, ob)) {
              if (prevX + e.width <= ob.x) {
                e.x = ob.x - e.width;
                if (e.onGround && (e.type === 'zombie' || e.type === 'alien')) e.vy = -5.6;
                else e.dir = -1;
              } else if (prevX >= ob.x + ob.width) {
                e.x = ob.x + ob.width;
                if (e.onGround && (e.type === 'zombie' || e.type === 'alien')) e.vy = -5.6;
                else e.dir = 1;
              }
            }
          }

          if (!e.onGround && e.y + e.height >= groundY) {
            e.y = groundY - e.height;
            e.vy = 0;
            e.onGround = true;
          }
        }

        if (e.type === 'robot' || e.type === 'alien') {
          if (!e.queuedShot) {
            e.shootTimer -= dt;
            if (e.shootTimer <= 0) {
              e.targetDir = dx < 0 ? -1 : 1;
              e.queuedShot = true;
              e.windupTimer = e.type === 'robot' ? 420 : 300;
              e.attackTimer = e.windupTimer;
            }
          } else {
            e.windupTimer -= dt;
            if (e.windupTimer <= 0) {
              let bulletSpeed = e.type === 'robot' ? 4.1 : 5.1;
              let dmg = e.type === 'robot' ? 8 : 6;
              if (SETTINGS.difficulty === 'easy') dmg = Math.max(1, dmg - 2);
              else if (SETTINGS.difficulty === 'hard') dmg += 2;
              enemyBullets.push({ x: e.x + (e.targetDir < 0 ? -8 : e.width), y: e.y + e.height / 2 - 2, vx: e.targetDir * bulletSpeed, vy: 0, width: 8, height: 4, damage: dmg, from: 'enemy' });
              e.queuedShot = false;
              e.attackTimer = 140;
              if (e.type === 'robot') e.shootTimer = 1900 + Math.random() * 900;
              else e.shootTimer = 2200 + Math.random() * 900;
            }
          }
        }

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
            e.hitTimer = 170;
            spawnHitSparks(b.x + b.width * 0.5, b.y + b.height * 0.5, b.weapon);
            const kx = (b.vx === 0 ? (player.x < e.x ? 1 : -1) : Math.sign(b.vx));
            const impactForce = b.weapon === 'shotgun' ? 4.2 : (b.weapon === 'laser' ? 2.8 : 1.8);
            e.x += kx * impactForce;
            if (e.type !== 'ghost') {
              e.vx = (e.vx || 0) + kx * 0.15;
            }
            if (b.weapon === 'shotgun') {
              screenShakeTimer = Math.max(screenShakeTimer, 55);
              screenShakeStrength = Math.max(screenShakeStrength, 2.2);
            }
            // Remove bullet
            bullets.splice(bi,1);
            // If enemy dies, spawn particle explosion and pickups, then
            // remove it from the list
            if (e.health <= 0) {
              addFloatingText(e.x + e.width / 2, e.y - 8, '+DROP', '#ffd66b');
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
      // Enemy bullets vs player
      for (let i=enemyBullets.length-1; i>=0; i--) {
        const b = enemyBullets[i];
        if (rectIntersect(b, player)) {
          enemyBullets.splice(i,1);
          damagePlayer(b.damage);
        }
      }
      // Enemies vs player contact with per-enemy contact cooldown so overlap
      // does not rapidly drain HP.
      for (let i=enemies.length-1; i>=0; i--) {
        const e = enemies[i];
        if (rectIntersect(e, player)) {
          if (e.contactDamageTimer <= 0) {
            const baseDamage = e.type === 'zombie' ? 5 : (e.type === 'ghost' ? 4 : (e.type === 'robot' ? 6 : 5));
            if (damagePlayer(baseDamage)) {
              const push = e.type === 'robot' ? 12 : 9;
              if (player.x < e.x) player.x -= push; else player.x += push;
              e.attackTimer = 200;
              e.contactDamageTimer = e.type === 'ghost' ? 920 : 780;
            }
          }
        }
      }
      prevGameplayInput.jump = jumpPressed;
      prevGameplayInput.shoot = shootPressed;
      prevGameplayInput.reload = reloadPressed;
      // Pickups vs player
      for (let i=pickups.length-1; i>=0; i--) {
        const p = pickups[i];
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
        if (enemies.length < maxEnemies) {
          spawnEnemy();
        }
        const difficultyScale = SETTINGS.difficulty === 'easy' ? 1.22 : (SETTINGS.difficulty === 'hard' ? 0.82 : 1);
        const progress = Math.min(1, elapsedTime / 180000);
        const minCooldown = 650;
        const maxCooldown = 1650;
        const cooldown = maxCooldown - (maxCooldown - minCooldown) * progress;
        spawnCooldown = (cooldown + Math.random() * 300) * difficultyScale;
      }
    }

    /**
     * Draw the entire scene. Handles parallax background, stars,
     * ground, pickups, enemies, bullets, player, HUD and overlays.
     */
    function drawGame() {
      const uiPulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
      const cameraX = Math.max(0, Math.min(worldWidth - width, player.x - 150 + cameraShakeX));
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
      // Draw layered starfield on top of background
      stars.forEach(s => {
        if (s.x >= cameraX - width && s.x <= cameraX + width * 2) {
          const parallax = s.layer === 0 ? 0.18 : (s.layer === 1 ? 0.34 : 0.56);
          const twinkle = 0.72 + Math.sin(performance.now() * (0.0018 + s.layer * 0.0013) + s.twinkle) * 0.28;
          const px = s.x - cameraX * parallax;
          ctx.fillStyle = `rgba(205,230,255,${Math.max(0.08, s.alpha * twinkle)})`;
          ctx.fillRect(px, s.y + s.layer * 5, s.size, s.size);
        }
      });
      // Draw ground (semi‑transparent dark strip)
      ctx.fillStyle = 'rgba(0,0,30,0.8)';
      ctx.fillRect(0, groundY, width, height - groundY);
      // Draw pickups
      pickups.forEach(p => {
        const wave = (elapsedTime * 0.006) + p.x * 0.02;
        const bob = Math.sin(wave) * 2.4;
        const pulse = 1 + Math.sin(wave * 0.8) * 0.12;
        const drawW = p.width * pulse;
        const drawH = p.height * pulse;
        const px = p.x - cameraX - (drawW - p.width) / 2;
        const py = p.y + bob - (drawH - p.height) / 2;
        if (sheetLoaded) {
          if (p.type === 'gold') {
            const f = ANIMATIONS.coin;
            ctx.drawImage(spriteSheet, f.sx, f.sy, 32, 32, px, py, drawW, drawH);
            ctx.strokeStyle = `rgba(255,244,140,${0.55 + 0.3 * Math.sin(wave * 1.8)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px - 1, py + drawH * 0.2);
            ctx.lineTo(px + drawW + 2, py + drawH * 0.85);
            ctx.stroke();
          } else if (p.type === 'ammo') {
            let f;
            if (p.ammoType === 'pistol') f = ANIMATIONS.ammoPistol;
            else if (p.ammoType === 'rifle') f = ANIMATIONS.ammoRifle;
            else if (p.ammoType === 'shotgun') f = ANIMATIONS.ammoShotgun;
            else f = ANIMATIONS.ammoLaser;
            ctx.drawImage(spriteSheet, f.sx, f.sy, 32, 32, px, py, drawW, drawH);
          } else if (p.type === 'health') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px, py, drawW, drawH);
            ctx.strokeStyle = '#8eff95';
            ctx.lineWidth = 1;
            ctx.strokeRect(px - 1, py - 1, drawW + 2, drawH + 2);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(px + drawW * 0.2, py + drawH * 0.45, drawW * 0.6, drawH * 0.1);
            ctx.fillRect(px + drawW * 0.45, py + drawH * 0.2, drawW * 0.1, drawH * 0.6);
          }
        } else {
          ctx.fillStyle = p.type === 'gold' ? '#ffd700' : (p.type === 'health' ? '#ffffff' : '#55ddff');
          ctx.fillRect(px, py, drawW, drawH);
        }
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = p.type === 'gold' ? '#ffd700' : (p.type === 'health' ? '#88ff88' : '#55ddff');
        ctx.beginPath();
        ctx.ellipse(px + drawW / 2, py + drawH / 2, drawW * 1.2, drawH * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
        if (p.type === 'ammo') {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = '#8ddfff';
          ctx.fillRect(px - 1, py + drawH + 1, drawW + 2, 1.5);
        }
        ctx.globalAlpha = 1;
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
        if (e.queuedShot && e.windupTimer > 0) {
          const chargePct = Math.max(0, Math.min(1, 1 - (e.windupTimer / (e.type === 'robot' ? 420 : 300))));
          const aimDir = e.targetDir || (player.x < e.x ? -1 : 1);
          const eyeX = px + (aimDir < 0 ? 2 : e.width - 2);
          const eyeY = e.y + e.height / 2;
          ctx.strokeStyle = e.type === 'robot' ? `rgba(255,170,90,${0.25 + chargePct * 0.55})` : `rgba(130,255,130,${0.2 + chargePct * 0.5})`;
          ctx.lineWidth = e.type === 'robot' ? 2 : 1.5;
          ctx.beginPath();
          ctx.moveTo(eyeX, eyeY);
          ctx.lineTo(eyeX + aimDir * (28 + chargePct * 20), eyeY);
          ctx.stroke();
        }

        if (sheetLoaded && frames) {
          const baseAnimStep = e.type === 'ghost' ? 130 : (e.type === 'zombie' ? 170 : (e.type === 'robot' ? 145 : 125));
          const animStep = baseAnimStep * (e.animVariance || 1);
          const idx = Math.floor(e.animTime / animStep) % frames.length;
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
          const alpha = Math.max(0, p.life / p.maxLife);
          const size = p.size || 2.2;
          ctx.globalAlpha = alpha * (p.glow ? 0.38 + p.glow : 0.5);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(px, p.y, size * 1.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
          ctx.fillRect(px - size * 0.5, p.y - size * 0.5, size, size);
          ctx.globalAlpha = 1;
        });
      }
      // Draw player bullets
      bullets.forEach(b => {
        const px = b.x - cameraX;
        if (b.weapon === 'laser') {
          const horizontal = Math.abs(b.vx) > Math.abs(b.vy);
          const trail = horizontal ? 24 : 18;
          const tx = horizontal ? (px - (b.vx > 0 ? trail : 0)) : (px - 2);
          const ty = horizontal ? (b.y - 2) : (b.y - (b.vy < 0 ? trail : 0));
          ctx.fillStyle = 'rgba(90,245,255,0.25)';
          ctx.fillRect(tx, ty, horizontal ? trail + b.width : b.width + 4, horizontal ? b.height + 4 : trail + b.height);
          ctx.fillStyle = '#baffff';
          ctx.fillRect(px, b.y, b.width, b.height);
        } else if (b.weapon === 'shotgun') {
          ctx.fillStyle = '#ffe0a6';
          ctx.fillRect(px - 0.5, b.y - 0.5, b.width + 1, b.height + 1);
          ctx.fillStyle = '#fff8db';
          ctx.fillRect(px, b.y, Math.max(1, b.width - 1), Math.max(1, b.height - 1));
        } else {
          ctx.fillStyle = '#ffe86d';
          ctx.fillRect(px - 0.5, b.y - 0.5, b.width + 1, b.height + 1);
          ctx.fillStyle = '#fffce3';
          ctx.fillRect(px, b.y, Math.max(1, b.width - 1), Math.max(1, b.height - 1));
        }
      });
      // Draw muzzle/shot flashes
      shotFlashes.forEach(f => {
        const t = f.life / f.maxLife;
        const px = f.x - cameraX;
        const len = f.kind === 'laser' ? 20 : (f.kind === 'shotgun' ? 15 : 10);
        ctx.globalAlpha = Math.max(0, t * 0.9);
        ctx.strokeStyle = f.kind === 'laser' ? '#99ffff' : '#ffdd88';
        ctx.lineWidth = f.kind === 'shotgun' ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(px, f.y);
        ctx.lineTo(px + f.dirX * len, f.y + f.dirY * len);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      // Draw enemy bullets
      enemyBullets.forEach(b => {
        const px = b.x - cameraX;
        ctx.fillStyle = 'rgba(255,92,92,0.35)';
        ctx.fillRect(px - 1, b.y - 1, b.width + 2, b.height + 2);
        ctx.fillStyle = '#ff6060';
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
        const weapon = WEAPONS[player.weapon];
        // Determine if the player is currently shooting.  We rely on
        // shootCooldown > 0 to indicate a shot has been fired this
        // frame, which syncs the animation to actual firing rather than
        // key presses alone.
        const isShooting = player.shootCooldown > Math.max(35, weapon.fireRate * 0.45);
        if (!player.onGround) {
          // In mid‑air use the jump animation regardless of crouch.
          frames = ANIMATIONS.playerJump;
        } else if (player.isDucking) {
          // When ducking select special crouch animations.  These reuse
          // existing standing frames but are separated to allow
          // customisation later.  Shooting while crouched uses the
          // crouch shoot frames; moving uses crouch walk; otherwise use
          // the idle crouch.
          if (isShooting) {
            frames = ANIMATIONS.playerCrouchShoot;
          } else if (Math.abs(player.vx) > 0.1) {
            frames = ANIMATIONS.playerCrouchWalk;
          } else {
            frames = ANIMATIONS.playerCrouch;
          }
        } else {
          // Standing animations.  Use shooting frames if a shot was
          // recently fired; otherwise select running or idle.
          if (isShooting) {
            frames = ANIMATIONS.playerShoot;
          } else if (Math.abs(player.vx) > 0.1) {
            frames = ANIMATIONS.playerRun;
          } else {
            frames = ANIMATIONS.playerIdle;
          }
        }
        const playerAnimStep = !player.onGround ? 120 : (player.isDucking ? (Math.abs(player.vx) > 0.1 ? 95 : 180) : (Math.abs(player.vx) > 0.1 ? 92 : 210));
        const idx = Math.floor(player.animTime / playerAnimStep) % frames.length;
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
        if (player.hitFlashTimer > 0) {
          const alpha = Math.min(0.55, (player.hitFlashTimer / 180) * 0.55);
          ctx.fillStyle = `rgba(255,80,80,${alpha})`;
          ctx.fillRect(ppx, player.y, player.width, player.height);
        }
      } else {
        // fallback: simple rectangle when sprites are not loaded
        ctx.fillStyle = '#0077ff';
        ctx.fillRect(ppx, player.y, player.width, player.height);
      }
      // Floating combat/pickup feedback text
      floatingTexts.forEach(t => {
        const alpha = Math.max(0, t.life / t.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = t.color;
        ctx.font = '11px "Press Start 2P", Arial';
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x - cameraX, t.y);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      });

      // HUD: draw health bar, reload bar and ammo/weapon info using retro sci‑fi fonts.
      // These elements should only appear during gameplay and shop screens.  Hide
      // them on the start, pause and settings menus to avoid clutter behind the
      // overlays.  This conditional prevents the old text panels showing up
      // behind menus as seen in earlier builds.
      if (gameState === 'play' || gameState === 'shop') {
        const panelX = 14;
        const panelY = 12;
        const panelW = Math.min(360, width * 0.48);
        const panelH = 146;
        const wInfo = WEAPONS[player.weapon];
        const hpPct = Math.max(0, Math.min(1, player.health / 100));
        const clip = player.ammoInClip[player.weapon];
        const reserve = player.reserveAmmo[player.weapon];

        ctx.fillStyle = 'rgba(4, 10, 22, 0.93)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = `rgba(110, 215, 255, ${0.74 + uiPulse * 0.2})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.fillStyle = '#d9f6ff';
        ctx.font = '700 13px "Orbitron", Arial';
        ctx.fillText('COMBAT STATUS', panelX + 12, panelY + 20);

        const barW = panelW - 24;
        const hpY = panelY + 36;
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.fillRect(panelX + 12, hpY, barW, 18);
        ctx.fillStyle = hpPct > 0.5 ? '#39ff83' : (hpPct > 0.25 ? '#ffd960' : '#ff6767');
        ctx.fillRect(panelX + 12, hpY, barW * hpPct, 18);
        ctx.strokeStyle = 'rgba(210, 240, 255, 0.65)';
        ctx.strokeRect(panelX + 12, hpY, barW, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "Press Start 2P", Arial';
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 2;
        ctx.strokeText(`HEALTH ${Math.max(0, Math.floor(player.health))}%`, panelX + 16, hpY + 13);
        ctx.fillText(`HEALTH ${Math.max(0, Math.floor(player.health))}%`, panelX + 16, hpY + 13);

        const infoRows = [
          ['GOLD', `${player.gold}`],
          ['WEAPON', wInfo.name.toUpperCase()],
          ['AMMO', `${clip} / ${reserve}`]
        ];
        ctx.font = '700 13px "Orbitron", Arial';
        infoRows.forEach((row, i) => {
          const rowY = hpY + 40 + i * 24;
          const isAmmoRow = row[0] === 'AMMO';
          if (isAmmoRow && clip <= Math.max(1, Math.floor(wInfo.magazine * 0.25))) {
            ctx.fillStyle = `rgba(255, 184, 89, ${0.33 + uiPulse * 0.2})`;
            ctx.fillRect(panelX + 12, rowY - 14, barW, 19);
          }
          ctx.fillStyle = '#a9d4f0';
          ctx.fillText(row[0], panelX + 14, rowY);
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'right';
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.lineWidth = 2;
          ctx.strokeText(row[1], panelX + panelW - 16, rowY);
          ctx.fillText(row[1], panelX + panelW - 16, rowY);
          ctx.textAlign = 'left';
        });

        if (player.reloading) {
          const reloadHudKey = player.reloadWeaponKey || player.weapon;
          const pct = 1 - player.reloadTimer / WEAPONS[reloadHudKey].reloadTime;
          const rY = panelY + panelH + 6;
          ctx.fillStyle = 'rgba(8,15,30,0.84)';
          ctx.fillRect(panelX, rY, panelW, 16);
          ctx.fillStyle = '#223249';
          ctx.fillRect(panelX + 2, rY + 2, panelW - 4, 12);
          ctx.fillStyle = '#5dd8ff';
          ctx.fillRect(panelX + 2, rY + 2, (panelW - 4) * pct, 12);
          ctx.fillStyle = '#eefbff';
          ctx.font = '8px "Press Start 2P", Arial';
          ctx.strokeStyle = 'rgba(0,0,0,0.85)';
          ctx.lineWidth = 2;
          ctx.strokeText('RELOADING...', panelX + 6, rY + 11);
          ctx.fillText('RELOADING...', panelX + 6, rY + 11);
        }
      }
      // -------------------------------------------------------------------
      // Shop overlay
      //
      // The original shop panel used a fixed row height and panel base
      // height which caused the menu to extend off the bottom of the
      // canvas when the list of items grew.  To ensure the entire
      // purchase menu fits inside the game canvas, compute the row
      // spacing and overall panel height dynamically based on the
      // available canvas height.  A slightly smaller base height is
      // used and rows are spaced a bit tighter than the original 36px.
      if (gameState === 'shop') {
        // Dim the background behind the shop panel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, width, height);

        // Panel width stays generous to allow three columns (name, cost,
        // extra) without truncation.  If the canvas is narrower than
        // 560px (unlikely on desktop), clamp the width to 90% of the
        // canvas width.
        const panelW = Math.min(580, width * 0.9);

        // Base height allocated for the header, gold display and
        // instructions.  This is slightly reduced from the original
        // design to leave more room for the item list.
        const baseHeight = 200;

        // Compute a reasonable row spacing.  Start with 36px spacing but
        // if the panel would exceed the available height, reduce the
        // spacing proportionally so that all entries fit.  Reserve
        // 40px padding at the top and bottom inside the panel to
        // accommodate the title and instructions.
        let rowSpacing = 36;
        let panelH = baseHeight + SHOP_ITEMS.length * rowSpacing;
        const maxPanelHeight = height - 40;
        if (panelH > maxPanelHeight) {
          rowSpacing = Math.floor((maxPanelHeight - baseHeight) / SHOP_ITEMS.length);
          // Never allow the row spacing to shrink below 24px for
          // legibility.  If this occurs the list may scroll off
          // screen, but is preferable to unreadable text.
          if (rowSpacing < 24) rowSpacing = 24;
          panelH = baseHeight + SHOP_ITEMS.length * rowSpacing;
        }

        const panelX = (width - panelW) / 2;
        const panelY = (height - panelH) / 2;

        // Draw the panel body and border
        ctx.fillStyle = 'rgba(4, 10, 22, 0.94)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.65 + uiPulse * 0.2})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        // Title with glow effect
        ctx.font = 'bold 32px "Orbitron", Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00ccff';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#00ccff';
        ctx.fillText('SHOP', panelX + panelW / 2, panelY + 48);
        ctx.shadowBlur = 0;

        // Player gold top right
        ctx.font = '11px "Press Start 2P", Arial';
        ctx.fillStyle = '#88ccff';
        ctx.textAlign = 'right';
        ctx.fillText(`GOLD: ${player.gold}`, panelX + panelW - 20, panelY + 28);
        ctx.textAlign = 'left';

        // Draw the list of items.  Start a bit lower to make room for
        // the title and gold display.  Use the computed rowSpacing
        // when positioning each entry.
        ctx.font = '16px "Orbitron", Arial';
        const listStartY = panelY + 95;
        SHOP_ITEMS.forEach((item, i) => {
          const y = listStartY + i * rowSpacing;
          const selected = (i === menuSelection);
          let nameText, costText, extraText;
          if (item.type === 'weapon') {
            const w = WEAPONS[item.key];
            nameText = w.name.toUpperCase();
            const owned = !!player.ownedWeapons[item.key];
            const canAfford = player.gold >= w.cost;
            if (player.weapon === item.key) {
              costText = 'EQUIPPED';
            } else if (owned) {
              costText = 'OWNED';
            } else if (!canAfford) {
              costText = 'LOCKED';
            } else {
              costText = `BUY ${w.cost}G`;
            }
            const fireRateHint = `${Math.round(60 / Math.max(1, w.fireRate / 8))}`;
            extraText = `DMG ${w.damage}  MAG ${w.magazine}  FR ${fireRateHint}`;
          } else {
            nameText = item.name.toUpperCase();
            costText = player.gold >= item.cost ? `BUY ${item.cost}G` : 'LOCKED';
            extraText = `QTY: ${item.qty}`;
          }
          if (selected) {
            ctx.fillStyle = `rgba(32, 72, 102, ${0.58 + uiPulse * 0.2})`;
            ctx.fillRect(panelX + 16, y - 17, panelW - 32, 26);
            ctx.strokeStyle = 'rgba(255, 221, 120, 0.85)';
            ctx.lineWidth = 2;
            ctx.strokeRect(panelX + 16, y - 17, panelW - 32, 26);
          }
          // Name column with glow on selected
          if (selected) {
            ctx.shadowColor = '#ffdd55';
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#ffdd55';
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#aaaaaa';
          }
          ctx.fillText(nameText, panelX + 30, y);
          // Cost column
          ctx.shadowBlur = 0;
          if (costText === 'LOCKED') ctx.fillStyle = '#ff7676';
          else if (costText.startsWith('BUY')) ctx.fillStyle = selected ? '#a6ffd2' : '#79eeb8';
          else ctx.fillStyle = selected ? '#ffffaa' : '#888888';
          ctx.strokeStyle = 'rgba(0,0,0,0.72)';
          ctx.lineWidth = 2;
          ctx.strokeText(costText, panelX + panelW * 0.55, y);
          ctx.fillText(costText, panelX + panelW * 0.55, y);
          // Extra column (magazine/qty)
          ctx.fillStyle = selected ? '#fff7bd' : '#a3adb8';
          ctx.strokeStyle = 'rgba(0,0,0,0.72)';
          ctx.lineWidth = 2;
          ctx.strokeText(extraText, panelX + panelW * 0.82, y);
          ctx.fillText(extraText, panelX + panelW * 0.82, y);
        });
        ctx.shadowBlur = 0;

        // Instructions at the bottom of the panel
        ctx.font = '12px "Orbitron", Arial';
        ctx.fillStyle = '#88ccff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const selectedItem = SHOP_ITEMS[menuSelection];
        let actionHint = 'ENTER: BUY';
        if (selectedItem && selectedItem.type === 'weapon' && player.ownedWeapons[selectedItem.key]) {
          actionHint = player.weapon === selectedItem.key ? 'ENTER: EQUIPPED' : 'ENTER: EQUIP';
        }
        ctx.fillText(`${actionHint}  P/ESC: CLOSE`, panelX + panelW / 2, panelY + panelH - 42);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }
      if (damageOverlayTimer > 0) {
        const alpha = Math.min(0.22, (damageOverlayTimer / 120) * 0.22);
        ctx.fillStyle = `rgba(255,30,30,${alpha})`;
        ctx.fillRect(0, 0, width, height);
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
        const panelH = 280;
        const panelX = (width - panelW) / 2;
        const panelY = (height - panelH) / 2;
        // Panel base and outline
        ctx.fillStyle = 'rgba(4, 10, 22, 0.94)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.65 + uiPulse * 0.2})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        ctx.textAlign = 'center';
        // Title with glow effect
        ctx.font = 'bold 36px "Orbitron", Arial';
        ctx.shadowColor = '#00ccff';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#00ccff';
        ctx.strokeStyle = 'rgba(0,0,0,0.72)';
        ctx.lineWidth = 3;
        ctx.strokeText('SPACE COMMANDO', panelX + panelW / 2, panelY + 50);
        ctx.fillText('SPACE COMMANDO', panelX + panelW / 2, panelY + 50);
        ctx.shadowBlur = 0;
        // Options
        const startOptions = ['START GAME', 'GAME SETTINGS'];
        ctx.font = '22px "Orbitron", Arial';
        const optStartY = panelY + 120;
        const optSpacing = 50;
        startOptions.forEach((opt, i) => {
          const y = optStartY + i * optSpacing;
          const selected = (i === startMenuSelection);
          if (selected) {
            ctx.fillStyle = `rgba(36, 80, 112, ${0.56 + uiPulse * 0.2})`;
            ctx.fillRect(panelX + 34, y - 24, panelW - 68, 34);
          }
          if (selected) {
            ctx.shadowColor = '#ffdd55';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#ffdd55';
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#aaaaaa';
          }
          ctx.fillText(opt, panelX + panelW / 2, y);
        });
        ctx.shadowBlur = 0;
        // Instructions – split into two lines for better fit
        ctx.font = '12px "Orbitron", Arial';
        ctx.fillStyle = '#88ccff';
        ctx.textBaseline = 'top';
        const instrY = panelY + panelH - 55;
        ctx.fillText('ARROWS: NAVIGATE', panelX + panelW / 2, instrY);
        ctx.fillText('ENTER: SELECT', panelX + panelW / 2, instrY + 20);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }
      // Pause/menu overlay
      if (gameState === 'menu') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, width, height);
        const panelW = 500;
        const optionsCount = 3;
        const rowSpacing = 50;
        const panelH = 240 + optionsCount * rowSpacing;
        const panelX = (width - panelW) / 2;
        const panelY = (height - panelH) / 2;
        // Draw panel
        ctx.fillStyle = 'rgba(4, 10, 22, 0.94)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.65 + uiPulse * 0.2})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        ctx.textAlign = 'center';
        // Header with glow effect
        ctx.font = 'bold 34px "Orbitron", Arial';
        ctx.shadowColor = '#00ccff';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#00ccff';
        ctx.strokeStyle = 'rgba(0,0,0,0.72)';
        ctx.lineWidth = 3;
        ctx.strokeText('PAUSED', panelX + panelW / 2, panelY + 50);
        ctx.fillText('PAUSED', panelX + panelW / 2, panelY + 50);
        ctx.shadowBlur = 0;
        // Options
        const menuOptions = ['RETURN TO GAME', 'RESTART GAME', 'GAME SETTINGS'];
        ctx.font = '20px "Orbitron", Arial';
        const menuStartY = panelY + 120;
        menuOptions.forEach((opt, i) => {
          const y = menuStartY + i * rowSpacing;
          const selected = (i === mainMenuSelection);
          if (selected) {
            ctx.fillStyle = `rgba(36, 80, 112, ${0.56 + uiPulse * 0.2})`;
            ctx.fillRect(panelX + 34, y - 24, panelW - 68, 34);
          }
          if (selected) {
            ctx.shadowColor = '#ffdd55';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#ffdd55';
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#aaaaaa';
          }
          ctx.fillText(opt, panelX + panelW / 2, y);
        });
        ctx.shadowBlur = 0;
        // Instructions: break across two lines
        ctx.font = '12px "Orbitron", Arial';
        ctx.fillStyle = '#88ccff';
        ctx.textBaseline = 'top';
        const instrY = panelY + panelH - 55;
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
        const panelW = 540;
        const rowSpacing = 48;
        const panelH = 240 + settingKeys.length * rowSpacing;
        const panelX = (width - panelW) / 2;
        const panelY = (height - panelH) / 2;
        // Panel base and border
        ctx.fillStyle = 'rgba(4, 10, 22, 0.94)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.65 + uiPulse * 0.2})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        ctx.textAlign = 'center';
        // Header with glow effect
        ctx.font = 'bold 34px "Orbitron", Arial';
        ctx.shadowColor = '#00ccff';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#00ccff';
        ctx.strokeStyle = 'rgba(0,0,0,0.72)';
        ctx.lineWidth = 3;
        ctx.strokeText('SETTINGS', panelX + panelW / 2, panelY + 50);
        ctx.fillText('SETTINGS', panelX + panelW / 2, panelY + 50);
        ctx.shadowBlur = 0;
        // Draw each setting: align labels left and values right
        ctx.font = '18px "Orbitron", Arial';
        const settingsStartY = panelY + 120;
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
          if (selected) {
            ctx.fillStyle = `rgba(36, 80, 112, ${0.56 + uiPulse * 0.2})`;
            ctx.fillRect(panelX + 34, y - 24, panelW - 68, 34);
          }
          // Highlight selected line with glow
          if (selected) {
            ctx.shadowColor = '#ffdd55';
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#ffdd55';
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#aaaaaa';
          }
          ctx.textAlign = 'left';
          // 70px padding from left edge for labels
          ctx.fillText(label, panelX + 70, y);
          ctx.shadowBlur = 0;
          ctx.textAlign = 'right';
          // Align values 70px from right edge
          ctx.fillStyle = selected ? '#ffffaa' : '#888888';
          ctx.fillText(value, panelX + panelW - 70, y);
        });
        ctx.shadowBlur = 0;
        // Instructions: broken into two concise lines
        ctx.font = '12px "Orbitron", Arial';
        ctx.fillStyle = '#88ccff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const instrY = panelY + panelH - 55;
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
