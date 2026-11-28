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
    robotMove: ['robot-move.mp3', 1.9],
    // Muffled and reused as the station scuttle's distant blasts (story cues).
    grenadeExplosion: ['grenade-explosion.mp3', 1.4]
  };
  const voiceLimits = { fire: 5, reload: 2, enemy: 6, hurt: 3, move: 2 };
  // Story cues share the SFX master but have their own bus, cap and stop-all.
  const STORY_VOICE_LIMIT = 4;
  const storyVoices = [];
  let storyBus;
  let storyDucked = false;
  const active = [];
  const clips = {};
  const Audio = window.AudioContext || window.webkitAudioContext;
  let context;
  let bank;
  let output;
  let fireBus;
  let master;
  // Sound-effects volume (0-1) from the game's settings.
  let masterLevel = 1;
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
        master = context.createGain();
        master.gain.value = masterLevel;
        output.connect(master);
        master.connect(context.destination);
        fireBus = context.createGain();
        fireBus.connect(output);
        storyBus = context.createGain();
        storyBus.connect(output);
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
    // Pending, delayed and looping story cues never survive a hidden tab.
    if (document.hidden) stopStory();
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

  // ---------------------------------------------------------------------
  // Story cues: data-driven (story.js SFX), either a cleared clip played with
  // a rate, filter and repeats, or an original recipe synthesized here. Every
  // recipe is deterministic, so a cue sounds identical each time it plays.
  // Recipes take any BaseAudioContext, so tests can render them offline.
  let noise = null;
  function noiseFor(ctx) {
    if (noise && noise.sampleRate === ctx.sampleRate) return noise;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // A fixed linear-congruential sequence: the same noise every time.
    let x = 12345;
    for (let i = 0; i < data.length; i++) { x = (x * 1103515245 + 12345) >>> 0; data[i] = (x / 2147483648) - 1; }
    return (noise = buffer);
  }
  const env = (param, t, points) => {
    param.setValueAtTime(points[0][1], t + points[0][0]);
    for (const [at, v] of points.slice(1)) param.linearRampToValueAtTime(v, t + at);
  };
  function noiseSource(ctx, t, dur) {
    const src = ctx.createBufferSource();
    src.buffer = noiseFor(ctx);
    src.loop = true;
    src.start(t);
    src.stop(t + dur);
    return src;
  }
  function osc(ctx, type, freq, t, dur) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(t + dur);
    return o;
  }
  function filter(ctx, type, freq, q = 0.8) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }
  // Each recipe wires into `out` from time t and returns its length in seconds.
  const RECIPES = {
    // Radio key-up or release: a short band-limited noise burst with a click.
    squelch(ctx, out, t, o) {
      const dur = o.release ? 0.09 : 0.07;
      const n = noiseSource(ctx, t, dur);
      const bp = filter(ctx, 'bandpass', o.release ? 1500 : 2100, 1.4);
      const g = ctx.createGain();
      env(g.gain, t, [[0, 0], [0.004, 1], [dur * 0.5, 0.5], [dur, 0]]);
      n.connect(bp).connect(g).connect(out);
      return dur;
    },
    // The Analyst's signature: a 1.4 kHz carrier broken by two knocks.
    carrier(ctx, out, t) {
      const dur = 0.62;
      const o1 = osc(ctx, 'sine', 1400, t, dur);
      const g = ctx.createGain();
      env(g.gain, t, [[0, 0], [0.02, 0.7], [0.22, 0.7], [0.225, 0], [0.27, 0], [0.275, 0.7], [0.4, 0.7], [0.405, 0], [0.45, 0], [0.455, 0.7], [0.58, 0.55], [dur, 0]]);
      // Faint hiss bed so it reads as an old recording.
      const n = noiseSource(ctx, t, dur);
      const hp = filter(ctx, 'highpass', 3500);
      const ng = ctx.createGain();
      env(ng.gain, t, [[0, 0], [0.03, 0.08], [dur - 0.05, 0.08], [dur, 0]]);
      o1.connect(g).connect(out);
      n.connect(hp).connect(ng).connect(out);
      return dur;
    },
    // Seal release: a decaying high hiss.
    hiss(ctx, out, t) {
      const dur = 0.7;
      const n = noiseSource(ctx, t, dur);
      const hp = filter(ctx, 'highpass', 2600);
      const g = ctx.createGain();
      env(g.gain, t, [[0, 0], [0.02, 0.6], [dur, 0]]);
      n.connect(hp).connect(g).connect(out);
      return dur;
    },
    // Station alarm: a restrained two-tone pulse, filtered so it sits low.
    alarm(ctx, out, t, o) {
      const cycles = o.cycles || 6;
      const step = 0.42;
      const lp = filter(ctx, 'lowpass', 1600);
      lp.connect(out);
      for (let i = 0; i < cycles; i++) {
        const at = t + i * step;
        const tone = osc(ctx, 'square', i % 2 ? 620 : 780, at, step * 0.8);
        const g = ctx.createGain();
        env(g.gain, at, [[0, 0], [0.015, 0.35], [step * 0.7, 0.3], [step * 0.8, 0]]);
        tone.connect(g).connect(lp);
      }
      return cycles * step;
    },
    // Courier ignition: a low rumble that opens up, over a sub tone.
    ignition(ctx, out, t) {
      const dur = 1.8;
      const n = noiseSource(ctx, t, dur);
      const lp = filter(ctx, 'lowpass', 140);
      lp.frequency.setValueAtTime(140, t);
      lp.frequency.exponentialRampToValueAtTime(1100, t + 1.2);
      const g = ctx.createGain();
      env(g.gain, t, [[0, 0], [0.25, 0.6], [1.3, 0.9], [dur, 0]]);
      const sub = osc(ctx, 'sine', 42, t, dur);
      sub.frequency.linearRampToValueAtTime(58, t + dur);
      const sg = ctx.createGain();
      env(sg.gain, t, [[0, 0], [0.3, 0.5], [dur, 0]]);
      n.connect(lp).connect(g).connect(out);
      sub.connect(sg).connect(out);
      return dur;
    },
    // Archive waking: two detuned saws under a slowly opening filter.
    drone(ctx, out, t) {
      const dur = 2.6;
      const lp = filter(ctx, 'lowpass', 200);
      lp.frequency.setValueAtTime(200, t);
      lp.frequency.linearRampToValueAtTime(900, t + dur * 0.7);
      const g = ctx.createGain();
      env(g.gain, t, [[0, 0], [0.8, 0.5], [dur - 0.6, 0.45], [dur, 0]]);
      for (const f of [55, 82.4]) osc(ctx, 'sawtooth', f, t, dur).connect(lp);
      lp.connect(g).connect(out);
      return dur;
    },
    // A faint fly buzz: a nasal saw with a fast wing flutter.
    buzz(ctx, out, t) {
      const dur = 1.5;
      const tone = osc(ctx, 'sawtooth', 210, t, dur);
      tone.frequency.linearRampToValueAtTime(238, t + dur);
      const bp = filter(ctx, 'bandpass', 700, 2.5);
      const g = ctx.createGain();
      env(g.gain, t, [[0, 0], [0.3, 0.5], [dur - 0.3, 0.5], [dur, 0]]);
      const lfo = osc(ctx, 'sine', 28, t, dur);
      const depth = ctx.createGain();
      depth.gain.value = 0.35;
      lfo.connect(depth).connect(g.gain);
      tone.connect(bp).connect(g).connect(out);
      return dur;
    },
    // Archival playback glitch: a fixed stutter of short tonal blips.
    glitch(ctx, out, t) {
      const pattern = [[0, 1800, 0.025], [0.045, 600, 0.02], [0.07, 2400, 0.018], [0.11, 900, 0.03], [0.16, 1500, 0.02]];
      const lp = filter(ctx, 'lowpass', 3200);
      lp.connect(out);
      for (const [at, f, len] of pattern) {
        const o = osc(ctx, 'square', f, t + at, len);
        const g = ctx.createGain();
        env(g.gain, t + at, [[0, 0], [0.002, 0.4], [len, 0]]);
        o.connect(g).connect(lp);
      }
      return 0.2;
    }
  };

  // A cleared clip with an optional rate, low-pass and repeats.
  function clipCue(ctx, out, t, spec, buffer, offset = 0, length = null) {
    const repeats = spec.repeat || 1;
    let end = 0;
    for (let i = 0; i < repeats; i++) {
      const at = t + i * (spec.gap || 0.15);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = spec.rate || 1;
      let node = src;
      if (spec.lowpass) { const lp = filter(ctx, 'lowpass', spec.lowpass); src.connect(lp); node = lp; }
      node.connect(out);
      if (length !== null) src.start(at, offset, length); else src.start(at);
      end = Math.max(end, i * (spec.gap || 0.15) + (length ?? buffer.duration) / (spec.rate || 1));
    }
    return end;
  }

  function stopStoryVoice(voice) {
    const i = storyVoices.indexOf(voice);
    if (i >= 0) storyVoices.splice(i, 1);
    clearTimeout(voice.timer);
    try {
      const now = context.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + 0.04);
    } catch {}
    setTimeout(() => { try { voice.gain.disconnect(); } catch {} }, 80);
  }

  function stopStory() {
    for (const voice of [...storyVoices]) stopStoryVoice(voice);
  }

  // Play a story cue now or after `delay` seconds. Returns how it played:
  // 'clip', 'synth', 'silent' (its clip is missing and it has no fallback),
  // or false when audio isn't running.
  function playStory(id, spec, delay = 0) {
    if (!context || context.state !== 'running' || !storyBus) return false;
    let kind = 'synth';
    let render;
    if (spec.clip) {
      const buffer = clips[spec.clip];
      if (buffer) { kind = 'clip'; render = (out, t) => clipCue(context, out, t, spec, buffer); }
      else if (spec.fallbackSynth && RECIPES[spec.fallbackSynth]) render = (out, t) => RECIPES[spec.fallbackSynth](context, out, t, spec);
      else return 'silent';
    } else if (RECIPES[spec.synth]) {
      render = (out, t) => RECIPES[spec.synth](context, out, t, spec);
    } else return 'silent';
    if (storyVoices.length >= STORY_VOICE_LIMIT) stopStoryVoice(storyVoices[0]);
    const gain = context.createGain();
    gain.gain.value = spec.gain ?? 0.3;
    gain.connect(storyBus);
    const t = context.currentTime + Math.max(0, delay);
    const length = render(gain, t);
    const voice = { id, gain, timer: 0 };
    voice.timer = setTimeout(() => stopStoryVoice(voice), (delay + length + 0.2) * 1000);
    storyVoices.push(voice);
    return kind;
  }

  // Render a recipe offline (tests): peak and RMS, and a sample checksum.
  async function renderStory(spec) {
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtx || !RECIPES[spec.synth]) return null;
    const ctx = new OfflineCtx(1, 44100 * 3, 44100);
    const g = ctx.createGain();
    g.gain.value = spec.gain ?? 0.3;
    g.connect(ctx.destination);
    const length = RECIPES[spec.synth](ctx, g, 0, spec);
    const data = (await ctx.startRendering()).getChannelData(0);
    let peak = 0, sum = 0, hash = 0;
    const n = Math.ceil(length * 44100);
    for (let i = 0; i < n; i++) { const v = data[i]; peak = Math.max(peak, Math.abs(v)); sum += v * v; hash = (hash * 31 + Math.round(v * 1e4)) | 0; }
    return { length, peak, rms: Math.sqrt(sum / n), hash };
  }

  window.combatAudio = {
    play,
    playStory,
    stopStory,
    renderStory,
    storyVoices: () => storyVoices.length,
    storyIds: () => storyVoices.map(v => v.id),
    // Story cues sit lower while a caption is on screen.
    duckStory(on) {
      if (!storyBus || storyDucked === on) return;
      storyDucked = on;
      const target = on ? 0.55 : 1;
      const now = context.currentTime;
      storyBus.gain.cancelScheduledValues(now);
      storyBus.gain.setValueAtTime(storyBus.gain.value, now);
      storyBus.gain.linearRampToValueAtTime(target, now + 0.25);
    },
    // Sound-effects volume, applied after the limiter.
    setVolume(level) {
      masterLevel = Math.max(0, Math.min(1, level));
      if (master) master.gain.setValueAtTime(masterLevel, context.currentTime);
    },
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
