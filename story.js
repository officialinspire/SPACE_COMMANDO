// Campaign story data: speakers, radio lines, one-shot triggers, staged
// objectives and the three still-image scenes. index.js runs it; nothing
// here is shown on the star map or in Quickplay, which has no story.
//
// Anchors are placed by station-layout.js (placeStory) on validated
// surfaces: `chunks` are indexes into the stage plan, `decks` index DECK_Y
// (0 lower, 1 middle, 2 upper) in preference order, `f` is the position
// across the chunk. A door is a full-height barrier at the end of a chunk
// that stays shut until the listed anchors are done, so the player can't
// pass a required interaction they could no longer walk back to.
(function (root) {
  'use strict';

  // Speaker IDs are roles until the cast has names. `signal` is a voice the
  // player can't identify yet; the same recording later plays as `analyst`.
  const SPEAKERS = {
    commando: { label: 'Commando' },
    // `radio` speakers key up with a squelch at the start of a transmission
    // and release one when it ends; `sfx` plays on each of their lines.
    'squad-leader': { label: 'Squad Leader', portrait: 'squad-leader', radio: true },
    squad: { label: 'Squad channel', radio: true },
    signal: { label: 'Unknown signal' },
    analyst: { label: 'Analyst · recovered log', portrait: 'analyst' },
    commander: { label: 'Fleet Commander', portrait: 'commander', radio: true },
    priestess: { label: 'Dark Elf Priestess', portrait: 'elf-leader' },
    'police-commander': { label: 'Police Commander', portrait: 'police-commander', radio: true },
    'thug-leader': { label: 'Thug Leader', portrait: 'thug-leader' },
    recorder: { label: 'Colonial recorder', sfx: 'playback-glitch' },
    interference: { label: 'Interference', radio: true },
    archive: { label: 'Archive', sfx: 'playback-glitch' },
    narration: { label: '' }
  };

  // The analyst's last transmission. Heard as an unknown signal on the way
  // in and again at her remains, with the same text and signature tag.
  const PACKET_SIX = 'Packet six. Observation bay. If you hear this, knock twice.';
  const PACKET_SIGNATURE = 'PKT-06 · 1.4 kHz carrier';

  // Every caption has a stable id. Banter plays on safe stretches; pressure
  // points get one short `urgent` line that cuts in. `hold` gives a reveal
  // a minimum reading time in ms.
  const LINES = {
    // Docking (scene)
    'dock-ramp': { speaker: 'squad-leader', text: 'Easy on the ramp.' },
    'dock-door': { speaker: 'commando', text: 'Last time you said “easy,” we bought a door.' },
    'dock-squad': { speaker: 'squad', text: 'That door had it coming.' },
    'dock-orders': { speaker: 'commander', text: 'Recover the analyst and her drive. If this channel drops, follow her beacon. Not the station’s.' },
    'dock-seal': { speaker: 'squad-leader', text: 'Seal’s open. No pressure on the other side.' },
    'dock-hotel': { speaker: 'squad', text: 'No air, no lights, no welcome party. Five stars.' },

    // Space Station
    'corridor-tomb': { speaker: 'squad', text: 'Smells like a tomb with good lighting.' },
    'breach-hold': { speaker: 'squad-leader', text: 'Breach! I’ve got the bulkhead.' },
    'breach-go': { speaker: 'squad-leader', text: 'Her last ping was observation. Go. Bring her home.' },
    'breach-static': { speaker: 'interference', text: 'CHAOS.' },
    'packet-heard': { speaker: 'signal', text: PACKET_SIX, signature: PACKET_SIGNATURE, sfx: 'analyst-signature' },
    'packet-knock': { speaker: 'commando', text: 'Knocking twice.' },
    'packet-dismiss': { speaker: 'commander', text: 'That isn’t live traffic. Keep moving.' },
    'analyst-found': { speaker: 'commando', text: 'Found her. Observation bay.' },
    'analyst-log': { speaker: 'analyst', text: PACKET_SIX, signature: PACKET_SIGNATURE, sfx: 'analyst-signature' },
    'analyst-pocket': { speaker: 'commander', text: 'Check her left pocket.' },
    'analyst-how': { speaker: 'commando', text: 'Drive’s in her left pocket. How did you know that?' },
    'analyst-standard': { speaker: 'commander', text: 'Standard issue. Move.' },
    'scuttle-arm': { speaker: 'commando', text: 'Self-destruct armed. Shuttle’s still green.' },
    'scuttle-time': { speaker: 'commander', text: 'Seventy-five seconds. You’ll make it.' },

    // Jungle Planet
    'jungle-mast': { speaker: 'commando', text: 'Relay mast’s still blinking. Somebody paid the power bill.' },
    'jungle-switch': { speaker: 'commander', text: 'Use the main switch. Leave the backup alone.' },
    'jungle-why': { speaker: 'commando', text: 'What’s wrong with the backup?' },
    'jungle-nothing': { speaker: 'commander', text: 'Nothing you need today.' },
    'recorder-log': { speaker: 'recorder', text: 'Evacuation stands. The fence stops trucks. It does not stop whatever ate one.' },
    'recorder-still': { speaker: 'recorder', text: 'Specimen four stopped mid-charge. Stood perfectly still. Then it moved like something else took the controls.' },
    'elf-kneel': { speaker: 'priestess', text: 'Kneel, human. I like my blasphemers at eye level.' },
    'elf-you-first': { speaker: 'commando', text: 'Sure. You first.' },
    'elf-mudborn': { speaker: 'priestess', text: 'Three centuries your fleets have bled on our moons, mudborn, and your people still tell bedtime stories about us.' },
    'elf-ears': { speaker: 'commando', text: 'Funny. Ours say you’re a tree cult with good cheekbones.' },
    'elf-drive': { speaker: 'priestess', text: 'Bring me the drive. I will make your ending a hymn.' },
    'relay-up': { speaker: 'commando', text: 'Relay live. Sending distress.' },
    'upload-hold': { speaker: 'commander', text: 'Hold the upload. Whatever she says about us, don’t answer.' },
    'relay-heard': { speaker: 'commander', text: 'Distress received. So did CyberCity. Their survey hauler is already inbound.' },
    'relay-war': { speaker: 'commando', text: 'We’re at war with CyberCity.' },
    'relay-cargo': { speaker: 'commander', text: 'Which is why you’ll be in their cargo bay, not their cockpit.' },
    'relay-elves': { speaker: 'commando', text: 'Anything I should know about the elves?' },
    'relay-offline': { speaker: 'commander', text: 'Nothing for an open channel.' },

    // CyberCity
    'cyber-scan': { speaker: 'police-commander', text: 'Freight Nine, hold for identity scan. Compliance is appreciated. Noncompliance is processed.' },
    'cyber-smell': { speaker: 'commando', text: 'Charming city. Smells like wet batteries.' },
    'cyber-bypass': { speaker: 'commander', text: 'Stay off the concourse. The scanners there run on four-twelve. The freight bypass doesn’t.' },
    'cyber-toll': { speaker: 'thug-leader', text: 'Street tax. Pay here, or explain yourself to the people with badges.' },
    'cyber-rate': { speaker: 'commando', text: 'What’s the rate?' },
    'cyber-apology': { speaker: 'thug-leader', text: 'I take cash, contraband, or a sincere apology with cash.' },
    'cyber-long-way': { speaker: 'commando', text: 'I’ll take the long way.' },
    'cyber-teeth': { speaker: 'thug-leader', text: 'Long way’s taxed too. You just pay in teeth.' },
    'cyber-lockdown': { speaker: 'police-commander', text: 'Port breach logged. You are cleared to surrender. Launch remains unauthorized.' },
    'cyber-gate': { speaker: 'commando', text: 'Impound gate open.' },
    'cyber-fine': { speaker: 'police-commander', text: 'Unauthorized gate movement noted. A fine has been issued.' },
    // CyberCity launch (scene)
    'escape-sent': { speaker: 'commando', text: 'Clear sky. Full packet sent. Tell me we’re going home.' },
    'escape-stop': { speaker: 'commander', text: 'Not yet. Your analyst found an archive entrance on a desert world. Get there before anyone else.' },
    'escape-who': { speaker: 'commando', text: 'Anyone like who?' },
    'escape-anyone': { speaker: 'commander', text: 'Anyone.' },

    // Ancient Planet Ruins
    'ruins-scorch': { speaker: 'commando', text: 'Laser scorch on the steps. The elves beat us here.' },
    'ruins-faster': { speaker: 'commander', text: 'Then be faster inside.' },
    'ruins-elf': { speaker: 'priestess', text: 'This archive outlived three centuries of your wars, mudborn. It will outlive you.' },
    'ruins-door': { speaker: 'priestess', text: 'Kneel at the door, and I may let you watch me open it.' },
    'ruins-pass': { speaker: 'commando', text: 'Hard pass. I brought my own key.' },
    'ruins-power': { speaker: 'commando', text: 'One terminal live. One to go.' },
    // Archive (scene)
    'archive-architect': { speaker: 'archive', text: 'Architect designation: FLYZRDS. Galactic construction complete.', hold: 4200 },
    'archive-operator': { speaker: 'archive', text: 'Host accepted. Operator: FLYZRD.', hold: 4200 },
    'archive-driving': { speaker: 'commando', text: 'Something was driving that dinosaur.' },
    'archive-human': { speaker: 'commander', text: 'Pull the human record. Keep it off the open channel.' },
    'archive-program': { speaker: 'archive', text: 'Human record filed beside the elven record. One seeding program.', hold: 4200 },
    'archive-hold': { speaker: 'commander', text: 'Hold the uplink until the record copies.' },
    'uplink-cut': { speaker: 'priestess', text: 'Cut the transmission.' },
    'uplink-lying': { speaker: 'commander', text: 'Keep it running. Whatever she tells you, she’s lying.' },
    'uplink-everyone': { speaker: 'commando', text: 'Everyone keeps saying that about everyone.' },
    'uplink-done': { speaker: 'commando', text: 'Commander, I’m bringing you the drive. I’m also bringing you a lizard problem.' },
    'uplink-person': { speaker: 'commander', text: 'Bring the drive. We’ll discuss the lizard in person.' }
  };

  // Scene frames: art is a story still; fallback is an existing environment
  // image used when the still is missing. The stills carry the visuals, so
  // captions are dialogue, not description. `essential` lines replay as
  // radio captions after Skip so no instruction or reveal is lost.
  const SCENES = {
    docking: {
      title: 'Docking',
      frames: [
        { art: 'assets/story/docking.webp', fallback: 'assets/station/distant.webp', lines: ['dock-ramp', 'dock-door', 'dock-squad', 'dock-orders'] },
        { art: 'assets/station/distant.webp', fallback: 'assets/ui/orbital-breach.webp', lines: ['dock-seal', 'dock-hotel'] }
      ],
      music: 'dock',
      essential: ['dock-orders']
    },
    escape: {
      title: 'CyberCity launch',
      frames: [
        { art: 'assets/story/courier.webp', fallback: 'assets/environments/cyberpunk-city/background.webp', lines: ['escape-sent'],
          sfx: [['courier-ignition', 0], ['ship-fire', 1.0]] },
        { art: 'assets/story/orbit.webp', fallback: 'assets/ui/star-map.webp', lines: ['escape-stop', 'escape-who', 'escape-anyone'] }
      ],
      music: 'escape',
      essential: ['escape-stop']
    },
    // The FLYZRDS and the host transfer are in the art; the captions name them.
    archive: {
      title: 'The archive',
      frames: [
        { art: 'assets/story/archive-masters.webp', fallback: 'assets/environments/desert-temple-ruins/background.webp', lines: ['archive-architect'],
          sfx: [['archive-wake', 0]] },
        { art: 'assets/story/archive-host.webp', fallback: 'assets/environments/desert-temple-ruins/background.webp', lines: ['archive-operator', 'archive-driving'],
          sfx: [['fly-buzz', 0.2]] },
        { art: 'assets/story/archive-masters.webp', fallback: 'assets/environments/desert-temple-ruins/background.webp', lines: ['archive-human', 'archive-program'] }
      ],
      music: 'reveal',
      essential: ['archive-architect', 'archive-operator', 'archive-program']
    }
  };

  // Story sound cues. `clip` is a cleared field recording (see
  // assets/audio/field-sfx/README.md), played with an optional rate,
  // low-pass and repeats; `synth` is an original recipe in combat-audio.js.
  // A clip that fails to load plays silence unless it names a fallbackSynth.
  // Levels stay low so cues sit under captions; the story bus ducks further
  // while a caption is on screen.
  const SFX = {
    'radio-in': { synth: 'squelch', gain: 0.16 },
    'radio-out': { synth: 'squelch', release: true, gain: 0.11 },
    'analyst-signature': { synth: 'carrier', gain: 0.13 },
    'playback-glitch': { synth: 'glitch', gain: 0.08 },
    'bulkhead-servo': { clip: 'robotMove', rate: 0.62, lowpass: 1800, gain: 0.55 },
    'seal-release': { synth: 'hiss', gain: 0.12 },
    'relay-startup': { clip: 'laserReload', rate: 0.85, gain: 0.42 },
    'station-alarm': { synth: 'alarm', cycles: 6, gain: 0.07 },
    'distant-blast': { clip: 'grenadeExplosion', rate: 0.72, lowpass: 600, gain: 0.55 },
    'station-blast': { clip: 'grenadeExplosion', rate: 0.6, lowpass: 1300, gain: 0.85 },
    'courier-ignition': { synth: 'ignition', gain: 0.32 },
    'ship-fire': { clip: 'laserFire', rate: 0.6, repeat: 3, gap: 0.14, lowpass: 2600, gain: 0.3 },
    'archive-wake': { synth: 'drone', gain: 0.2 },
    'fly-buzz': { synth: 'buzz', gain: 0.045 }
  };
  // Every door opens with the bulkhead servo, then the seal releases.
  const DOOR_SFX = [['bulkhead-servo', 0], ['seal-release', 0.32]];

  // Per stage: anchors, doors, ordered steps and one-shot triggers.
  // Step types: interact (all listed anchors), hold (stay in the anchor's
  // zone), reach (the exit). A checkpoint step is where a retry resumes.
  const STAGES = {
    station: {
      start: { scene: 'docking' },
      anchors: {
        analyst: { kind: 'remains', chunks: [1], decks: [1, 0], f: [0.62, 0.78, 0.45, 0.3], prompt: 'Recover the field drive' },
        scuttle: { kind: 'console', chunks: [3], decks: [2], f: [0.55, 0.4, 0.7, 0.25], prompt: 'Arm the self-destruct' }
      },
      doors: [
        { id: 'bay-lock', chunk: 1, until: ['analyst'], label: 'Observation lockdown' },
        { id: 'dock-seal', chunk: 3, until: ['scuttle'], label: 'Dock bulkhead' }
      ],
      steps: [
        { id: 'recover', type: 'interact', anchors: ['analyst'], text: 'Find the analyst in the observation bay.',
          done: { lines: ['analyst-found', 'analyst-log', 'analyst-pocket', 'analyst-how', 'analyst-standard'], duck: true }, checkpoint: true },
        { id: 'scuttle', type: 'interact', anchors: ['scuttle'], text: 'Arm the self-destruct on the upper deck.',
          done: { lines: ['scuttle-arm', 'scuttle-time'], duck: true, urgent: true, sfx: [['station-alarm', 0]] }, checkpoint: true },
        { id: 'escape', type: 'reach', text: 'Reach the emergency shuttle.', timer: 75, meter: 'Self-destruct', spawnRate: 1.35,
          // The dock goes in stages behind the player.
          timerSfx: [{ left: 50, sfx: 'distant-blast' }, { left: 22, sfx: 'distant-blast' }],
          fail: 'The self-destruct went off before the shuttle cleared.' }
      ],
      triggers: [
        { id: 'corridor', at: { chunk: 0, f: 0.15 }, lines: ['corridor-tomb'] },
        { id: 'breach', at: { chunk: 0, f: 0.4 }, lines: ['breach-hold', 'breach-go', 'breach-static'], duck: true, urgent: true },
        // Heard before the player knows whose voice it is.
        { id: 'packet', at: { chunk: 0, f: 0.85 }, lines: ['packet-heard', 'packet-knock', 'packet-dismiss'] }
      ],
      exitLocked: 'Shuttle locked. Recover the drive and arm the station first.',
      clear: 'The shuttle clears the blast. Its damaged drive can only reach the nearest planet.',
      clearMusic: 'crash',
      clearSfx: [['station-blast', 0.5]]
    },
    jungle: {
      anchors: {
        recorder: { kind: 'recorder', optional: true, chunks: [1], decks: [0], f: [0.3, 0.45, 0.6], prompt: 'Play the field recorder' },
        relay: { kind: 'switch', chunks: [4], decks: [2], f: [0.5, 0.35, 0.65, 0.25], prompt: 'Restore relay power', zone: 150 }
      },
      doors: [
        { id: 'relay-fence', chunk: 4, until: ['relay'], label: 'Facility fence' }
      ],
      steps: [
        { id: 'relay', type: 'interact', anchors: ['relay'], text: 'Reach the research facility and restore the relay’s power.',
          done: { lines: ['relay-up'], urgent: true, sfx: [['relay-startup', 0]] }, checkpoint: true },
        { id: 'upload', type: 'hold', anchor: 'relay', seconds: 18, meter: 'Upload', text: 'Stay by the relay while the distress call uploads.',
          spawnRate: 1.25, cues: [{ at: 0.35, lines: ['upload-hold'], urgent: true }],
          done: { lines: ['relay-heard', 'relay-war', 'relay-cargo', 'relay-elves', 'relay-offline'], duck: true }, checkpoint: true },
        { id: 'hauler', type: 'reach', text: 'Board the CyberCity hauler before it lifts off.' }
      ],
      triggers: [
        { id: 'mast', at: { chunk: 0, f: 0.3 }, lines: ['jungle-mast', 'jungle-switch', 'jungle-why', 'jungle-nothing'] },
        { id: 'elves', at: { chunk: 3, f: 0.2 }, lines: ['elf-kneel', 'elf-you-first', 'elf-mudborn', 'elf-ears', 'elf-drive'], duck: true, urgent: true }
      ],
      interactions: { recorder: { lines: ['recorder-log', 'recorder-still'] } },
      exitLocked: 'No hauler yet. Send the distress call first.',
      clear: 'You ride out in the hauler’s cargo bay, under CyberCity’s scan line.'
    },
    cyber: {
      anchors: {
        terminal: { kind: 'console', chunks: [4], decks: [2], f: [0.5, 0.35, 0.65, 0.25], prompt: 'Open the impound gate' }
      },
      doors: [
        { id: 'impound', chunk: 4, until: ['terminal'], label: 'Impound gate' }
      ],
      steps: [
        { id: 'terminal', type: 'interact', anchors: ['terminal'], text: 'Climb to the impound control terminal.',
          done: { lines: ['cyber-gate', 'cyber-fine'] }, checkpoint: true },
        { id: 'courier', type: 'reach', text: 'Reach the impounded courier and launch.', exitScene: 'escape' }
      ],
      triggers: [
        { id: 'scan', at: { chunk: 0, f: 0.2 }, lines: ['cyber-scan', 'cyber-smell', 'cyber-bypass'] },
        { id: 'toll', at: { chunk: 1, f: 0.15 }, lines: ['cyber-toll', 'cyber-rate', 'cyber-apology', 'cyber-long-way', 'cyber-teeth'] },
        { id: 'lockdown', at: { chunk: 3, f: 0.1 }, lines: ['cyber-lockdown'], duck: true, urgent: true }
      ],
      exitLocked: 'The launch gate is sealed. Open the impound from the control terminal.',
      clear: 'Fleet decrypted coordinates from the drive. The courier diverts to a desert world.',
      // The launch cue carries on under the clear screen.
      clearMusic: 'escape'
    },
    desert: {
      anchors: {
        'terminal-a': { kind: 'console', chunks: [3, 4], decks: [2, 1], f: [0.5, 0.3, 0.7], prompt: 'Restore archive power' },
        'terminal-b': { kind: 'console', chunks: [4, 3], decks: [1, 2], f: [0.55, 0.35, 0.75], prompt: 'Restore archive power' },
        archive: { kind: 'archive', chunks: [5], decks: [2], f: [0.4, 0.3, 0.5, 0.2], prompt: 'Insert the drive', zone: 150 }
      },
      doors: [
        { id: 'threshold', chunk: 4, until: ['terminal-a', 'terminal-b'], label: 'Inner threshold' }
      ],
      steps: [
        { id: 'power', type: 'interact', anchors: ['terminal-a', 'terminal-b'], text: 'Restore power at both archive terminals.',
          progress: { lines: ['ruins-power'], sfx: [['relay-startup', 0]] }, done: { sfx: [['relay-startup', 0]] }, checkpoint: true },
        { id: 'activate', type: 'interact', anchors: ['archive'], text: 'Open the archive with the drive.',
          done: { scene: 'archive', lines: ['archive-hold'] }, checkpoint: true },
        { id: 'uplink', type: 'hold', anchor: 'archive', seconds: 22, meter: 'Copying record', text: 'Hold the archive uplink until the record copies.',
          spawnRate: 1.3, cues: [{ at: 0.4, lines: ['uplink-cut'], duck: true, urgent: true }, { at: 0.65, lines: ['uplink-lying', 'uplink-everyone'] }],
          done: { lines: ['uplink-done', 'uplink-person'], duck: true }, checkpoint: true },
        { id: 'extract', type: 'reach', text: 'Reach the courier for extraction.' }
      ],
      triggers: [
        { id: 'arrival', at: { chunk: 0, f: 0.3 }, lines: ['ruins-scorch', 'ruins-faster'] },
        { id: 'threshold-elf', at: { chunk: 1, f: 0.3 }, lines: ['ruins-elf', 'ruins-door', 'ruins-pass'], duck: true }
      ],
      exitLocked: 'Extraction can wait. The archive record comes first.',
      clear: 'Fleet received the record. Nobody has announced it.',
      endCard: 'Far across the dunes, a dinosaur calls: “RAWR :3”',
      endMusic: 'credits'
    }
  };

  root.SpaceStory = { SPEAKERS, LINES, SCENES, STAGES, SFX, DOOR_SFX };
})(typeof window !== 'undefined' ? window : globalThis);
