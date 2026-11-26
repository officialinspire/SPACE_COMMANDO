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
  const voiceLimits = { fire: 5, reload: 2, enemy: 6 };
  const active = [];
  const Audio = window.AudioContext || window.webkitAudioContext;
  let context;
  let bank;
  // Request the bytes before the intro without creating a gated AudioContext.
  const bankBytes = Audio
    ? fetch(new URL('assets/audio/combat-bank.mp3', document.baseURI))
      .then(response => response.ok ? response.arrayBuffer() : null).catch(() => null)
    : null;

  function unlock() {
    if (!Audio) return;
    try {
      if (!context) {
        context = new Audio();
        bankBytes.then(bytes => bytes && context.decodeAudioData(bytes))
          .then(buffer => { bank = buffer; }, () => {});
      }
      if (context.state !== 'running') context.resume().catch(() => {});
    } catch {
      // Existing HTML audio clips remain available if Web Audio is blocked.
    }
  }

  for (const event of ['pointerdown', 'keydown', 'click']) {
    window.addEventListener(event, unlock, { capture: true, passive: true });
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
    if (!bank || context.state !== 'running' || !cues[name]) return false;
    const voices = active.filter(voice => voice.group === group);
    if (voices.length >= voiceLimits[group]) stopVoice(voices[0]);
    const source = context.createBufferSource();
    const gain = context.createGain();
    const panner = context.createStereoPanner?.();
    const voice = { source, gain, panner, group };
    source.buffer = bank;
    gain.gain.value = volume;
    source.connect(gain);
    if (panner) {
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(context.destination);
    } else gain.connect(context.destination);
    source.onended = () => release(voice);
    active.push(voice);
    const [offset, length] = cues[name];
    source.start(context.currentTime, offset / BANK_SAMPLE_RATE, length / BANK_SAMPLE_RATE);
    return true;
  }

  window.combatAudio = {
    play,
    stop(group) {
      for (const voice of [...active]) {
        if (!group || voice.group === group) stopVoice(voice);
      }
    }
  };
})();
