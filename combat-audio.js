(() => {
  'use strict';

  const BANK_SAMPLE_RATE = 44100;
  // Start and duration in source samples. The cue bank also contains short silent gaps.
  const cues = {
    pistolFire: [0, 9261],
    rifleFire: [11290, 7056],
    shotgunFire: [20375, 17199],
    laserFire: [39603, 6174],
    dryFire: [47806, 2470],
    pistolReload: [52305, 8379],
    pistolReady: [62713, 6615],
    rifleReload: [71357, 11466],
    rifleReady: [84852, 7938],
    shotgunReload: [94819, 13671],
    shotgunReady: [110519, 10143],
    laserReload: [122691, 14553],
    laserReady: [139273, 12348],
    zombieWarn: [153650, 11246],
    zombieAttack: [166925, 10584],
    zombieDown: [179538, 17199],
    ghostWarn: [198766, 12789],
    ghostAttack: [213584, 10584],
    ghostDown: [226197, 17199],
    robotWarn: [245425, 17640],
    robotAttack: [265094, 8820],
    robotDown: [275943, 16317],
    alienWarn: [294289, 12436],
    alienAttack: [308754, 9614],
    alienDown: [320397, 15435],
  };
  // Field recordings that replace bank cues (assets/audio/field-sfx/README.md).
  // Gains match each clip's loudest 150 ms to the bank cue it replaces,
  // limited so the clip peak stays at or below -1 dBFS. Cues without a clip,
  // or whose clip fails to load or decode, play from the bank instead.
  const clipFiles = {
    pistolFire: ['pistol-fire.mp3', 0.5],
    rifleFire: ['rifle-fire.mp3', 0.73],
    shotgunFire: ['shotgun-fire.mp3', 0.92],
    laserFire: ['laser-fire.mp3', 1.6],
    pistolReload: ['pistol-reload.mp3', 2.8],
    rifleReload: ['rifle-reload.mp3', 2.6],
    laserReload: ['laser-reload.mp3', 1.78],
    shotgunReady: ['shotgun-pump.mp3', 2.78],
    zombieHurt: ['zombie-hurt.mp3', 2.26],
    ghostHurt: ['ghost-hurt.mp3', 2.1],
    robotHurt: ['robot-damaged.mp3', 2.5],
    alienHurt: ['alien-hurt.mp3', 2.33],
    robotMove: ['robot-move.mp3', 1.9]
    // grenade-explosion.mp3 is ready for a detonation event; none exists yet,
    // so it is not requested.
  };
  const voiceLimits = { fire: 5, reload: 2, enemy: 6, hurt: 3, move: 2 };
  const active = [];
  const clips = {};
  const Audio = window.AudioContext || window.webkitAudioContext;
  let context;
  let bank;
  let output;
  let fireBus;
  let unlocked = false;
  const fetchBytes = path => fetch(new URL(path, document.baseURI))
    .then(response => response.ok ? response.arrayBuffer() : null).catch(() => null);
  // Request the bytes before the intro without creating a gated AudioContext.
  const bankBytes = Audio ? fetchBytes('assets/audio/combat-bank.mp3') : null;
  const clipBytes = Audio
    ? Object.fromEntries(Object.entries(clipFiles).map(([name, [file]]) => [name, fetchBytes('assets/audio/field-sfx/' + file)]))
    : {};

  function decode(bytes) {
    // Promise form with a callback fallback for older WebKit.
    return new Promise((resolve, reject) => {
      const result = context.decodeAudioData(bytes, resolve, reject);
      if (result?.then) result.then(resolve, reject);
    });
  }

  function unlock() {
    if (!Audio) return;
    try {
      if (!context) {
        context = new Audio();
        // A gentle limiter keeps stacked cues from clipping small speakers.
        output = context.createDynamicsCompressor();
        output.threshold.value = -6;
        output.knee.value = 6;
        output.ratio.value = 12;
        output.attack.value = 0.003;
        output.release.value = 0.12;
        output.connect(context.destination);
        fireBus = context.createGain();
        fireBus.connect(output);
        bankBytes.then(bytes => bytes && decode(bytes)).then(buffer => { bank = buffer; }, () => {});
        for (const [name, bytes] of Object.entries(clipBytes)) {
          bytes.then(data => data && decode(data)).then(buffer => { if (buffer) clips[name] = buffer; }, () => {});
        }
      }
      unlocked = true;
      if (context.state !== 'running' && !document.hidden) context.resume().catch(() => {});
    } catch {
      // Existing HTML audio clips remain available if Web Audio is blocked.
    }
  }

  for (const event of ['pointerdown', 'keydown', 'click']) {
    window.addEventListener(event, unlock, { capture: true, passive: true });
  }
  // Suspend with the tab and resume on return, so no cue plays while hidden.
  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden) context.suspend().catch(() => {});
    else if (unlocked) context.resume().catch(() => {});
  });

  // Enemy warnings briefly duck gunfire so they stay audible under sustained fire.
  function duckFire() {
    const now = context.currentTime;
    fireBus.gain.cancelScheduledValues(now);
    fireBus.gain.setValueAtTime(fireBus.gain.value, now);
    fireBus.gain.linearRampToValueAtTime(0.55, now + 0.03);
    fireBus.gain.setValueAtTime(0.55, now + 0.28);
    fireBus.gain.linearRampToValueAtTime(1, now + 0.65);
  }

  function release(voice) {
    const index = active.indexOf(voice);
    if (index >= 0) active.splice(index, 1);
    voice.source.disconnect();
    voice.gain.disconnect();
    voice.panner?.disconnect();
  }

  function stopVoice(voice) {
    voice.source.onended = null;
    voice.source.stop();
    release(voice);
  }

  function play(name, group, volume, pan = 0) {
    if (!context || context.state !== 'running') return false;
    const clip = clips[name];
    if (!clip && (!bank || !cues[name])) return false;
    const voices = active.filter(voice => voice.group === group);
    if (voices.length >= voiceLimits[group]) stopVoice(voices[0]);
    const source = context.createBufferSource();
    const gain = context.createGain();
    const panner = context.createStereoPanner?.();
    const voice = { source, gain, panner, group };
    source.buffer = clip || bank;
    gain.gain.value = volume * (clip ? clipFiles[name][1] : 1);
    source.connect(gain);
    const bus = group === 'fire' ? fireBus : output;
    if (panner) {
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(bus);
    } else gain.connect(bus);
    source.onended = () => release(voice);
    active.push(voice);
    if (clip) source.start(context.currentTime);
    else {
      const [offset, length] = cues[name];
      source.start(context.currentTime, offset / BANK_SAMPLE_RATE, length / BANK_SAMPLE_RATE);
    }
    if (name.endsWith('Warn')) duckFire();
    return true;
  }

  window.combatAudio = {
    play,
    // Which source a cue would use right now: 'clip', 'bank' or null.
    source: name => clips[name] ? 'clip' : (bank && cues[name] ? 'bank' : null),
    // Active voices, optionally for one group (diagnostics and tests).
    voices: group => active.filter(voice => !group || voice.group === group).length,
    stop(group) {
      for (const voice of [...active]) {
        if (!group || voice.group === group) stopVoice(voice);
      }
    }
  };
})();
