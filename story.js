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

  const SPEAKERS = {
    commando: { label: 'Commando' },
    'squad-leader': { label: 'Squad Leader', portrait: 'squad-leader' },
    analyst: { label: 'Analyst · recovered log', portrait: 'analyst' },
    commander: { label: 'Commander', portrait: 'commander' },
    'elf-leader': { label: 'Dark Elf Leader', portrait: 'elf-leader' },
    'police-commander': { label: 'Police Commander', portrait: 'police-commander' },
    'thug-leader': { label: 'Thug Leader', portrait: 'thug-leader' },
    recorder: { label: 'Colonial recorder' },
    interference: { label: 'Interference' },
    archive: { label: 'Archive' },
    narration: { label: '' }
  };

  // Every caption has a stable id. Lines stay short so they clear on their own.
  const LINES = {
    'dock-commander': { speaker: 'commander', text: 'Recover our analyst. If you lose this channel, use their last beacon.' },
    'dock-approach': { speaker: 'narration', text: 'The contact missed a scheduled check-in. The docking cradle still answers. Life-support telemetry is dead.' },
    'dock-seal': { speaker: 'squad-leader', text: 'Seal’s open. No pressure on the other side.' },
    'breach-hold': { speaker: 'squad-leader', text: 'I can hold the bulkhead. Go. The analyst’s last ping was observation.' },
    'breach-static': { speaker: 'interference', text: 'CHAOS.' },
    'analyst-found': { speaker: 'commando', text: 'Found the analyst. I have the drive.' },
    'analyst-log': { speaker: 'analyst', text: 'I sent the same packet six times. Every time it came back with something inside it.' },
    'scuttle-arm': { speaker: 'commando', text: 'Emergency shuttle is still green. I’m taking that as permission.' },
    'scuttle-warning': { speaker: 'narration', text: 'Self-destruct armed. The main dock is overrun.' },

    'jungle-mast': { speaker: 'commando', text: 'Relay mast, still blinking. Someone left the lights on.' },
    'recorder-log': { speaker: 'recorder', text: 'Evacuation order stands. The perimeter can stop trucks. It can’t stop whatever just ate one.' },
    'recorder-still': { speaker: 'recorder', text: 'It went still for a second. Then it moved like a different animal.' },
    'elf-demand': { speaker: 'elf-leader', text: 'You brought that drive out of the station. Give it to me.' },
    'elf-rumor': { speaker: 'commando', text: 'I thought your people were a rumor.' },
    'elf-centuries': { speaker: 'elf-leader', text: 'A rumor doesn’t fight you for three centuries.' },
    'relay-up': { speaker: 'commando', text: 'Relay has power. Sending the distress header.' },
    'relay-heard': { speaker: 'commander', text: 'We heard your distress call. So did CyberCity. Their survey hauler is already descending.' },
    'relay-war': { speaker: 'commando', text: 'We’re at war with them.' },
    'relay-hide': { speaker: 'commander', text: 'Which is why I said hide in the cargo bay.' },
    'relay-secret': { speaker: 'commander', text: 'And that war with the elves? The public has never heard of it. Keep it that way.' },

    'cyber-scan': { speaker: 'police-commander', text: 'Freight Nine. Hold position for identity scan. Compliance is the only warning you get.' },
    'cyber-toll': { speaker: 'thug-leader', text: 'Street tax. Pay here or explain yourself to the people with badges.' },
    'cyber-decline': { speaker: 'commando', text: 'I was hoping to avoid both conversations.' },
    'cyber-lockdown': { speaker: 'police-commander', text: 'Gate sealed. Any pilot attempting launch forfeits protection.' },
    'cyber-gate': { speaker: 'commando', text: 'Impound gate is open. Courier’s mine.' },
    'escape-break': { speaker: 'narration', text: 'The courier breaks atmosphere. Clear line of sight to the fleet.' },
    'escape-sent': { speaker: 'commando', text: 'Full packet sent. Tell me we’re going home.' },
    'escape-stop': { speaker: 'commander', text: 'After one stop. Your analyst found the entrance to an archive. I need eyes on it before anyone else gets there.' },
    'escape-wake': { speaker: 'commander', text: 'Something else cleared that port in your wake. Stay sharp.' },

    'ruins-elf': { speaker: 'elf-leader', text: 'That record survived three centuries of your wars. It can survive another.' },
    'ruins-reply': { speaker: 'commando', text: 'You didn’t fly all this way to leave it alone.' },
    'ruins-power': { speaker: 'commando', text: 'Terminal live. One more and the archive wakes up.' },
    'archive-architect': { speaker: 'archive', text: 'Architect designation: FLYZRDS. Galactic construction complete. Life-seeding record available.' },
    'archive-host': { speaker: 'archive', text: 'Dinosaur host active. Original FLYZRD consciousness retained.' },
    'archive-occupied': { speaker: 'commando', text: 'The dinosaur was occupied?' },
    'archive-human': { speaker: 'commander', text: 'Pull up the human record.' },
    'archive-program': { speaker: 'archive', text: 'Filed beside the elven record. Same program.' },
    'archive-hold': { speaker: 'commander', text: 'Keep that transmission open until the record is copied.' },
    'uplink-cut': { speaker: 'elf-leader', text: 'Cut the transmission.' },
    'uplink-done': { speaker: 'commando', text: 'Commander, I’m bringing you the drive. I’m also bringing you a lizard problem.' }
  };

  // Scene frames: art is a story still; fallback is an existing environment
  // image used when the still is missing. `essential` lines replay as radio
  // captions after Skip so no instruction is lost.
  const SCENES = {
    docking: {
      title: 'Docking',
      frames: [
        { art: 'assets/story/docking.webp', fallback: 'assets/station/distant.webp', lines: ['dock-approach', 'dock-commander'] },
        { art: 'assets/station/distant.webp', fallback: 'assets/ui/orbital-breach.webp', lines: ['dock-seal'] }
      ],
      music: 'dock',
      essential: ['dock-commander']
    },
    escape: {
      title: 'CyberCity launch',
      frames: [
        { art: 'assets/story/courier.webp', fallback: 'assets/environments/cyberpunk-city/background.webp', lines: ['escape-break'] },
        { art: 'assets/story/orbit.webp', fallback: 'assets/ui/star-map.webp', lines: ['escape-sent', 'escape-stop', 'escape-wake'] }
      ],
      music: 'escape',
      essential: ['escape-stop']
    },
    archive: {
      title: 'The archive',
      frames: [
        { art: 'assets/story/archive-masters.webp', fallback: 'assets/environments/desert-temple-ruins/background.webp', lines: ['archive-architect'] },
        { art: 'assets/story/archive-host.webp', fallback: 'assets/environments/desert-temple-ruins/background.webp', lines: ['archive-host', 'archive-occupied'] },
        { art: 'assets/story/archive-masters.webp', fallback: 'assets/environments/desert-temple-ruins/background.webp', lines: ['archive-human', 'archive-program', 'archive-hold'] }
      ],
      music: 'reveal',
      essential: ['archive-architect', 'archive-hold']
    }
  };

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
          done: { lines: ['analyst-found', 'analyst-log'] }, checkpoint: true },
        { id: 'scuttle', type: 'interact', anchors: ['scuttle'], text: 'Arm the station’s self-destruct on the upper deck.',
          done: { lines: ['scuttle-arm', 'scuttle-warning'], duck: true }, checkpoint: true },
        { id: 'escape', type: 'reach', text: 'Reach the emergency shuttle.', timer: 75, meter: 'Self-destruct', spawnRate: 1.35,
          fail: 'The self-destruct went off before the shuttle cleared.' }
      ],
      triggers: [
        { id: 'breach', at: { chunk: 0, f: 0.4 }, lines: ['breach-hold', 'breach-static'], duck: true }
      ],
      exitLocked: 'The shuttle won’t launch yet. Recover the drive and arm the station first.',
      clear: 'The shuttle gets clear. The damage leaves it only enough range to reach the nearest planet.',
      clearMusic: 'crash'
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
          done: { lines: ['relay-up'] }, checkpoint: true },
        { id: 'upload', type: 'hold', anchor: 'relay', seconds: 18, meter: 'Upload', text: 'Hold position by the relay while the distress call uploads.',
          spawnRate: 1.25, done: { lines: ['relay-heard', 'relay-war', 'relay-hide', 'relay-secret'], duck: true }, checkpoint: true },
        { id: 'hauler', type: 'reach', text: 'Board the CyberCity hauler before it lifts off.' }
      ],
      triggers: [
        { id: 'mast', at: { chunk: 0, f: 0.35 }, lines: ['jungle-mast'] },
        { id: 'elves', at: { chunk: 3, f: 0.2 }, lines: ['elf-demand', 'elf-rumor', 'elf-centuries'], duck: true }
      ],
      interactions: { recorder: { lines: ['recorder-log', 'recorder-still'] } },
      exitLocked: 'The hauler isn’t here yet. Get the distress call out first.',
      clear: 'You ride out under the hauler’s scan line. Next stop: CyberCity.'
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
          done: { lines: ['cyber-gate'] }, checkpoint: true },
        { id: 'courier', type: 'reach', text: 'Reach the impounded courier and launch.', exitScene: 'escape' }
      ],
      triggers: [
        { id: 'scan', at: { chunk: 0, f: 0.3 }, lines: ['cyber-scan'] },
        { id: 'toll', at: { chunk: 1, f: 0.15 }, lines: ['cyber-toll', 'cyber-decline'] },
        { id: 'lockdown', at: { chunk: 3, f: 0.1 }, lines: ['cyber-lockdown'], duck: true }
      ],
      exitLocked: 'The launch gate is sealed. Open the impound from the control terminal.',
      clear: 'HQ decrypted a coordinate set from the drive. The courier diverts to a desert world.',
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
          progress: { lines: ['ruins-power'] }, checkpoint: true },
        { id: 'activate', type: 'interact', anchors: ['archive'], text: 'Open the archive with the drive.',
          done: { scene: 'archive' }, checkpoint: true },
        { id: 'uplink', type: 'hold', anchor: 'archive', seconds: 22, meter: 'Copying record', text: 'Hold the archive uplink until the record is copied.',
          spawnRate: 1.3, cues: [{ at: 0.4, lines: ['uplink-cut'], duck: true }], done: { lines: ['uplink-done'], duck: true }, checkpoint: true },
        { id: 'extract', type: 'reach', text: 'Reach the courier for extraction.' }
      ],
      triggers: [
        { id: 'threshold-elf', at: { chunk: 1, f: 0.3 }, lines: ['ruins-elf', 'ruins-reply'], duck: true }
      ],
      exitLocked: 'Extraction can wait. The archive record comes first.',
      clear: 'HQ received the recording.',
      endCard: 'Far across the dunes, a dinosaur calls: “RAWR :3”',
      endMusic: 'credits'
    }
  };

  root.SpaceStory = { SPEAKERS, LINES, SCENES, STAGES };
})(typeof window !== 'undefined' ? window : globalThis);
