/*
 * SPACE COMMANDO – station layout
 *
 * Builds the three-deck station route from connected room chunks and checks
 * every chunk by simulating the player's real movement against its solids.
 * The opening corridor is authored; later rooms vary with a reproducible
 * seed. A chunk that fails validation is rebuilt with derived seeds, then
 * replaced by its fixed fallback, then by a plain connector.
 *
 * The player body physics live here so the game and the validator share
 * one implementation of acceleration, jumping and collision.
 */
(function (root) {
  'use strict';

  const SLAB = 14;          // deck slab thickness
  const CATWALK = 10;       // catwalk thickness
  const WALL = 24;          // bulkhead width
  const LADDER_WIDTH = 16;
  const HEADROOM = 40;      // minimum clear gap between stacked solids
  const APPROACH = 20;      // clear floor beside a ladder foot
  const DISMOUNT = 36;      // landing beside a ladder top, each side
  const JUMP_TOLERANCE = 6; // take-off timing slack required for route jumps

  // ---------------------------------------------------------------------------
  // Shared body physics (mirrors the original updatePlayer code path).

  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function steer(body, direction, speed, grounded, m) {
    const target = direction * speed;
    const change = target - body.vx;
    const slowing = !direction || (Math.sign(body.vx) === direction && Math.abs(body.vx) > speed);
    const accel = grounded ? (slowing ? m.groundBrake : m.groundAccel) : (slowing ? m.airBrake : m.airAccel);
    body.vx += Math.sign(change) * Math.min(Math.abs(change), accel);
  }

  // Move horizontally then vertically against solids, landing on tops and
  // stopping on undersides. Returns the body.
  function moveBody(body, solids, world) {
    body.onGround = false;
    const prevX = body.x;
    body.x = Math.max(0, Math.min(world.width - body.width, body.x + body.vx));
    for (const ob of solids) {
      if (!overlaps(body, ob)) continue;
      if (prevX + body.width <= ob.x) body.x = ob.x - body.width;
      else if (prevX >= ob.x + ob.width) body.x = ob.x + ob.width;
      else continue;
      body.vx = 0;
    }
    const prevY = body.y;
    body.y += body.vy;
    for (const ob of solids) {
      if (body.x + body.width <= ob.x || body.x >= ob.x + ob.width) continue;
      if (prevY + body.height <= ob.y && body.y + body.height >= ob.y) {
        body.y = ob.y - body.height;
        body.vy = 0;
        body.onGround = true;
      } else if (prevY >= ob.y + ob.height && body.y < ob.y + ob.height) {
        body.y = ob.y + ob.height;
        body.vy = 0;
      }
    }
    if (body.y + body.height >= world.groundY) {
      body.y = world.groundY - body.height;
      body.vy = 0;
      body.onGround = true;
    }
    return body;
  }

  // Peak rise of a jump with the per-tick integration used by the game.
  function jumpHeight(m) {
    let vy = -m.jumpSpeed;
    let rise = 0;
    for (;;) {
      vy += m.gravity;
      if (vy >= 0) return rise;
      rise -= vy;
    }
  }

  // ---------------------------------------------------------------------------
  // Seeded randomness

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function chunkSeed(seed, index, attempt) {
    return (seed ^ Math.imul(index + 1, 0x9E3779B1) ^ Math.imul(attempt + 1, 0x85EBCA77)) >>> 0;
  }

  // ---------------------------------------------------------------------------
  // Chunk builders. Each returns explicit entry/exit points, solids (floors,
  // catwalks, platforms, walls and cover), ladders with top and bottom
  // endpoints, and candidate encounter points. Drop surfaces are derived
  // from the walkable floors once the route is validated.

  const ladder = (x, top, bottom) => ({ type: 'ladder', x, width: LADDER_WIDTH, top, bottom, y: top, height: bottom - top });
  const point = (x, y) => ({ x, y });
  const slab = (x, y, width, role = 'floor') => ({ type: 'slab', role, x, y, width, height: SLAB });
  const catwalk = (x, y, width) => ({ type: 'catwalk', role: 'catwalk', x, y, width, height: CATWALK });
  const cover = (type, x, y, width, height) => ({ type, role: 'cover', x, y, width, height });
  // Stage art can fix each cover type's width-to-height ratio so the drawn
  // sprite fills its collision box without distortion.
  const coverWidth = (c, type, width, height) => {
    const aspect = c.coverAspect?.[type];
    return aspect ? Math.max(20, Math.min(76, Math.round(height * aspect))) : width;
  };
  const wall = (x, top, bottom) => ({ type: 'wall', role: 'wall', x, y: top, width: WALL, height: bottom - top });

  function samplePoints(list, x0, x1, y, step, keepOut) {
    for (let x = x0; x <= x1; x += step) {
      if (keepOut.some(([a, b]) => x + 32 > a && x < b)) continue;
      list.push(point(Math.round(x), y));
    }
  }

  function buildOpening(c) {
    const G = c.deckY[0];
    const D1 = c.deckY[1];
    return {
      kind: 'opening', x0: 0, x1: 900,
      entry: point(100, G), exit: point(880, G),
      solids: [
        cover('crate', 343, G - 22, 42, 22),
        { type: 'platform', role: 'platform', x: 515, y: G - 86, width: 134, height: 12 },
        slab(0, D1, 900, 'ceiling')
      ],
      ladders: [ladder(574, G - 86, G)],
      encounters: [point(680, G), point(800, G), point(430, G), point(150, G)]
    };
  }

  function buildCargoBay(c, rng, x0, safe) {
    const G = c.deckY[0];
    const D1 = c.deckY[1];
    const x1 = x0 + 1050;
    const mx = Math.round(x0 + 640 + rng() * 60);
    const lx = Math.round(mx + 56 + rng() * (x1 - mx - 56 - 140));
    const solids = [slab(mx, D1, x1 - mx)];
    const ladders = [ladder(lx, D1, G)];
    const keepOut = [[lx - 60, lx + LADDER_WIDTH + 60]];
    // An optional shelf catwalk that a floor jump can reach.
    let shelf = null;
    if (safe || rng() < 0.75) {
      const elevation = safe ? 70 : Math.round(64 + rng() * 14);
      const sw = Math.round(96 + rng() * 34);
      // Keep the shelf well short of the mezzanine so the ladder stays the way up.
      const sx = Math.round(x0 + 220 + rng() * Math.max(0, mx - 300 - sw - (x0 + 220)));
      shelf = catwalk(sx, G - elevation, sw);
      solids.push(shelf);
    }
    // Cargo: crates, shields and barricades, with an occasional stack.
    const types = ['crate', 'shield', 'barricade'];
    let x = x0 + 70 + rng() * 60;
    while (x < mx - 90) {
      const type = types[Math.floor(rng() * types.length)];
      const h = Math.round(20 + rng() * 8);
      const w = coverWidth(c, type, Math.round(32 + rng() * 32), h);
      const underShelf = shelf && x + w > shelf.x - 4 && x < shelf.x + shelf.width + 4;
      // Cover under the shelf must keep standing headroom below it.
      const limit = underShelf ? (G - shelf.y) - shelf.height - HEADROOM : Infinity;
      if (h <= limit) {
        solids.push(cover(type, Math.round(x), G - h, w, h));
        keepOut.push([x - 4, x + w + 4]);
        if (!underShelf && type === 'crate' && rng() < 0.45) {
          solids.push(cover('crate', Math.round(x + 4), G - h - 22, Math.min(w - 8, coverWidth(c, 'crate', w - 8, 22)), 22));
        }
      }
      x += w + 96 + rng() * 150;
    }
    const encounters = [];
    samplePoints(encounters, x0 + 30, x1 - 40, G, 105, keepOut);
    samplePoints(encounters, mx + 20, x1 - 40, D1, 110, [[lx - 40, lx + 56]]);
    return { kind: 'cargoBay', x0, x1, entry: point(x0 + 10, G), exit: point(x1 - 10, G), solids, ladders, encounters };
  }

  function buildShaft(c, rng, x0) {
    const G = c.deckY[0];
    const D1 = c.deckY[1];
    const D2 = c.deckY[2];
    const x1 = x0 + 500;
    const sx = Math.round(x0 + 120 + rng() * 170);
    const upperStart = Math.round(sx - 90 - rng() * 60);
    const solids = [
      slab(x0, D1, x1 - x0),
      slab(upperStart, D2, x1 - upperStart),
      // Bulkheads close the lower and middle decks: the route continues upward.
      wall(x1 - WALL, D1 + SLAB, G),
      wall(x1 - WALL, D2 + SLAB, D1)
    ];
    const ladders = [ladder(sx, D1, G), ladder(sx, D2, D1)];
    const keepOut = [[sx - 60, sx + LADDER_WIDTH + 60], [x1 - WALL - 40, x1]];
    if (rng() < 0.6) {
      const raw = Math.round(34 + rng() * 20);
      const h = Math.round(20 + rng() * 6);
      const type = rng() < 0.5 ? 'shield' : 'barricade';
      const w = coverWidth(c, type, raw, h);
      const px = Math.round(sx + 110 + rng() * Math.max(0, x1 - WALL - 90 - w - (sx + 110)));
      solids.push(cover(type, px, D2 - h, w, h));
      keepOut.push([px - 4, px + w + 4]);
    }
    const encounters = [];
    samplePoints(encounters, x0 + 20, x1 - WALL - 50, G, 100, keepOut);
    samplePoints(encounters, x0 + 20, x1 - WALL - 50, D1, 100, keepOut);
    samplePoints(encounters, upperStart + 10, x1 - 40, D2, 100, keepOut);
    return { kind: 'ladderShaft', x0, x1, entry: point(x0 + 10, G), exit: point(x1 - 10, D2), solids, ladders, encounters };
  }

  // Upper-deck rooms. "bridge" crosses a wide gap on staggered catwalks;
  // "hatch" has a jumpable gap under an overhead catwalk and a cover
  // gallery. Both drop safely onto a closed maintenance segment of the
  // middle deck that has a ladder back up.
  function buildUpperRoom(c, rng, x0, x1, variant, safe) {
    const D1 = c.deckY[1];
    const D2 = c.deckY[2];
    const solids = [slab(x0, D1, x1 - x0), wall(x1 - WALL, D2 + SLAB, D1)];
    const keepOut = [];
    const catwalks = [];
    let gs;
    let gw;
    if (variant === 'bridge') {
      gs = Math.round(x0 + 200 + rng() * 160);
      gw = Math.round(safe ? 130 : 130 + rng() * 60);
      const e1 = Math.round(safe ? 54 : 52 + rng() * 8);
      const c1 = catwalk(Math.round(gs - 90 - rng() * 40), D2 - e1, Math.round(100 + rng() * 20));
      const e2 = Math.min(66, Math.round(e1 + 6 + rng() * 8));
      const c2 = catwalk(Math.round(c1.x + c1.width + 24 + rng() * 30), D2 - e2, Math.round(80 + rng() * 20));
      catwalks.push(c1, c2);
      if (c2.x + c2.width < gs + gw + 24) {
        const e3 = Math.round(52 + rng() * 6);
        catwalks.push(catwalk(Math.round(c2.x + c2.width + 24 + rng() * 20), D2 - e3, 92));
      }
    } else {
      gs = Math.round(x0 + 260 + rng() * 200);
      gw = Math.round(safe ? 60 : 56 + rng() * 24);
      const e = Math.round(54 + rng() * 8);
      catwalks.push(catwalk(Math.round(x0 + 80 + rng() * 80), D2 - e, Math.round(120 + rng() * 30)));
    }
    solids.push(slab(x0, D2, gs - x0), slab(gs + gw, D2, x1 - gs - gw), ...catwalks);
    keepOut.push([gs - 60, gs + gw + 60]);
    const lx = Math.round(gs + gw + 60 + rng() * Math.max(0, Math.min(140, x1 - WALL - 80 - (gs + gw + 60))));
    const ladders = [ladder(lx, D2, D1)];
    keepOut.push([lx - 60, lx + LADDER_WIDTH + 60], [x1 - WALL - 40, x1]);
    // Cover on the far deck, clear of the gap and the ladder.
    const pieces = variant === 'hatch' ? 3 : 1 + Math.floor(rng() * 2);
    let px = gs + gw + 70 + rng() * 40;
    for (let i = 0; i < pieces && px < x1 - 90; i++) {
      const raw = Math.round(32 + rng() * 26);
      const h = Math.round(20 + rng() * 7);
      const type = rng() < 0.5 ? 'barricade' : 'shield';
      const w = coverWidth(c, type, raw, h);
      const blocked = keepOut.some(([a, b]) => px + w > a && px < b) ||
        catwalks.some(cw => px + w > cw.x && px < cw.x + cw.width && cw.y + cw.height > D2 - h - HEADROOM);
      if (!blocked) {
        solids.push(cover(type, Math.round(px), D2 - h, w, h));
        keepOut.push([px - 4, px + w + 4]);
      }
      px += w + 80 + rng() * 120;
    }
    const encounters = [];
    samplePoints(encounters, x0 + 20, x1 - 40, D2, 100, keepOut);
    samplePoints(encounters, x0 + 30, x1 - WALL - 50, D1, 110, [[lx - 40, lx + 56]]);
    return { kind: variant === 'bridge' ? 'catwalkBridge' : 'hatchGallery', x0, x1, entry: point(x0 + 10, D2), exit: point(x1 - 10, D2), solids, ladders, encounters };
  }

  // A stage start: open floor at the entry with a little cover ahead.
  function buildStart(c, rng, x0, x1) {
    const G = c.deckY[0];
    const type = rng() < 0.5 ? 'crate' : 'barricade';
    const h = Math.round(20 + rng() * 6);
    const w = coverWidth(c, type, Math.round(36 + rng() * 20), h);
    const px = Math.round(x0 + 340 + rng() * 120);
    const encounters = [];
    samplePoints(encounters, x0 + 300, x1 - 40, G, 105, [[px - 4, px + w + 4]]);
    return { kind: 'start', x0, x1, entry: point(100, G), exit: point(x1 - 10, G), solids: [cover(type, px, G - h, w, h)], ladders: [], encounters };
  }

  // Terraces: two staggered ledges climb from the floor to a middle-deck
  // shelf, with a ladder as a second way up. The first ledge is high enough
  // to walk under; each rise stays well inside jump height.
  function buildTerraces(c, rng, x0, x1, safe) {
    const G = c.deckY[0];
    const D1 = c.deckY[1];
    const solids = [];
    const keepOut = [];
    const r1 = Math.round(safe ? 54 : 52 + rng() * 8);
    const r2 = Math.round(safe ? 44 : 40 + rng() * 6);
    let sx = Math.round(x0 + 150 + rng() * 60);
    let y = G;
    for (const rise of [r1, r2]) {
      y -= rise;
      const w = Math.round(110 + rng() * 40);
      solids.push({ ...catwalk(sx, y, w), type: 'terrace' });
      keepOut.push([sx - 20, sx + w + 20]);
      sx += w + Math.round(44 + rng() * 36);
    }
    const shelfStart = sx;
    solids.push(slab(shelfStart, D1, x1 - shelfStart));
    const lx = Math.round(shelfStart + 60 + rng() * Math.max(0, Math.min(220, x1 - shelfStart - 160)));
    const ladders = [ladder(lx, D1, G)];
    keepOut.push([lx - 60, lx + LADDER_WIDTH + 60]);
    // Floor cover before the first ledge and under the shelf.
    for (const [a, b] of [[x0 + 40, solids[0].x - 40], [shelfStart + 20, x1 - 60]]) {
      if (b - a < 80 || rng() < 0.25) continue;
      const type = rng() < 0.5 ? 'crate' : 'barricade';
      const h = Math.round(20 + rng() * 6);
      const w = coverWidth(c, type, Math.round(34 + rng() * 22), h);
      const px = Math.round(a + rng() * Math.max(0, b - a - w));
      if (keepOut.some(([p, q]) => px + w > p && px < q)) continue;
      solids.push(cover(type, px, G - h, w, h));
      keepOut.push([px - 4, px + w + 4]);
    }
    const encounters = [];
    samplePoints(encounters, x0 + 30, x1 - 40, G, 105, keepOut);
    samplePoints(encounters, shelfStart + 20, x1 - 40, D1, 110, [[lx - 40, lx + 56]]);
    return { kind: 'terraces', x0, x1, entry: point(x0 + 10, G), exit: point(x1 - 10, D1), solids, ladders, encounters };
  }

  // The last-resort connector: continuous decks at the entry and exit
  // heights joined by one ladder.
  function buildPlain(c, kind, x0, x1, entryY, exitY) {
    const D1 = c.deckY[1];
    const D2 = c.deckY[2];
    const G = c.deckY[0];
    const solids = [];
    const ladders = [];
    if (exitY === D2) {
      solids.push(slab(x0, D1, x1 - x0), slab(x0, D2, x1 - x0), wall(x1 - WALL, D2 + SLAB, D1));
      if (entryY === G) {
        solids.push(wall(x1 - WALL, D1 + SLAB, G));
        ladders.push(ladder(x0 + 200, D1, G));
      }
      ladders.push(ladder(x0 + 200, D2, D1));
    } else if (exitY === D1) {
      solids.push(slab(x0 + 120, D1, x1 - x0 - 120));
      ladders.push(ladder(x0 + 200, D1, G));
    }
    const encounters = [];
    samplePoints(encounters, x0 + 30, x1 - 60, exitY, 110, [[x0 + 140, x0 + 276]]);
    return { kind: kind + ':plain', x0, x1, entry: point(x0 + 10, entryY), exit: point(x1 - 10, exitY), solids, ladders, encounters };
  }

  // ---------------------------------------------------------------------------
  // Surfaces, reachability and validation

  // Standable tops: each solid's top minus anything resting on it, merged
  // with neighbouring tops at the same height.
  function extractSurfaces(solids) {
    const spans = [];
    for (const s of solids) {
      let parts = [[s.x, s.x + s.width]];
      for (const o of solids) {
        if (o === s || o.y >= s.y || o.y + o.height <= s.y - HEADROOM + 0.01) continue;
        parts = parts.flatMap(([a, b]) => {
          if (o.x >= b || o.x + o.width <= a) return [[a, b]];
          return [[a, Math.min(b, o.x)], [Math.max(a, o.x + o.width), b]].filter(([p, q]) => q - p > 0.5);
        });
      }
      for (const [a, b] of parts) spans.push({ y: s.y, x0: a, x1: b, roles: new Set([s.role]) });
    }
    spans.sort((a, b) => a.y - b.y || a.x0 - b.x0);
    const merged = [];
    for (const span of spans) {
      const last = merged.at(-1);
      if (last && Math.abs(last.y - span.y) < 0.01 && span.x0 <= last.x1 + 0.01) {
        last.x1 = Math.max(last.x1, span.x1);
        span.roles.forEach(role => last.roles.add(role));
      } else merged.push(span);
    }
    merged.forEach((surface, id) => { surface.id = id; });
    return merged;
  }

  // The surface a body of the given width stands on with its feet at y.
  function surfaceUnder(surfaces, left, width, feetY) {
    let best = null;
    for (const s of surfaces) {
      if (Math.abs(s.y - feetY) > 0.6 || left + width <= s.x0 || left >= s.x1) continue;
      const centre = left + width / 2;
      const distance = Math.max(0, s.x0 - centre, centre - s.x1);
      if (!best || distance < best.distance) best = { surface: s, distance };
    }
    return best?.surface || null;
  }

  // Simulate a take-off with the real physics, holding a direction.
  function simulate(c, solids, start, dir, vx, jump, release) {
    const m = c.movement;
    const body = { x: start, y: 0, width: c.body.width, height: c.body.height, vx, vy: 0, onGround: true };
    body.y = c._feet - body.height;
    for (let t = 0; t < 260; t++) {
      // A released stick stops steering once the body is airborne.
      steer(body, release && !body.onGround ? 0 : dir, m.runSpeed, body.onGround, m);
      if (t === 0 && jump) body.vy = -m.jumpSpeed;
      body.vy += m.gravity;
      const wasGrounded = body.onGround;
      moveBody(body, solids, c.world);
      if (body.onGround && (t > 0 || !wasGrounded)) {
        if (!jump && t < 1) continue;
        return { x: body.x, feet: body.y + body.height, ticks: t + 1 };
      }
    }
    return null;
  }

  function buildGraph(c, solids, ladders, surfaces, window) {
    const edges = surfaces.map(() => []);
    const add = (from, to, info) => { if (from && to && from !== to) edges[from.id].push({ to: to.id, ...info }); };
    const m = c.movement;
    const near = (x0, x1) => solids.filter(s => s.x + s.width > x0 - 260 && s.x < x1 + 260);
    for (const s of surfaces) {
      if (s.x1 < window.x0 || s.x0 > window.x1) continue;
      const local = near(s.x0, s.x1);
      const w = c.body.width;
      const starts = new Set([s.x0 - w + 1, s.x1 - 1]);
      for (let x = s.x0 - w / 2; x <= s.x1 - w / 2; x += 24) starts.add(x);
      starts.add(s.x0 - w / 2);
      starts.add(s.x1 - w / 2);
      for (const x of starts) {
        const body = { x, y: s.y - c.body.height, width: w, height: c.body.height };
        if (local.some(o => overlaps(body, o))) continue;
        c._feet = s.y;
        const runLeft = s.x1 - (x + w) >= 12;   // room behind when heading left
        const runRight = x - s.x0 >= 12;        // room behind when heading right
        const tries = [[0, 0, true], [1, 0, true], [-1, 0, true]];
        if (runRight) tries.push([1, m.runSpeed, true]);
        if (runLeft) tries.push([-1, -m.runSpeed, true]);
        if (x >= s.x1 - 1 - 0.01) tries.push([1, m.runSpeed, false], [1, 0, false], [1, 0, false, true]);
        if (x <= s.x0 - w + 1 + 0.01) tries.push([-1, -m.runSpeed, false], [-1, 0, false], [-1, 0, false, true]);
        const outcomes = new Map();
        for (const [dir, vx, jump, release] of tries) {
          const landing = simulate(c, local, x, dir, vx, jump, release);
          if (!landing) continue;
          const to = surfaceUnder(surfaces, landing.x, w, landing.feet);
          if (!to || to === s) continue;
          let robust;
          if (jump) {
            // Route jumps must tolerate imperfect timing: taking off a little
            // early (or either side, for standing jumps) reaches the same place.
            const offsets = vx ? [-dir * JUMP_TOLERANCE] : [-JUMP_TOLERANCE / 2, JUMP_TOLERANCE / 2];
            robust = offsets.every(offset => {
              const early = { x: x + offset, y: s.y - c.body.height, width: w, height: c.body.height };
              if (early.x + w <= s.x0 || early.x >= s.x1 || local.some(o => overlaps(early, o))) return false;
              const again = simulate(c, local, x + offset, dir, vx, jump);
              return again && surfaceUnder(surfaces, again.x, w, again.feet) === to;
            });
          } else {
            // Walking off must land in the same place at any walking speed,
            // and whether or not the direction is held after the edge.
            const key = `drop${dir}`;
            if (!outcomes.has(key)) outcomes.set(key, []);
            outcomes.get(key).push(to);
          }
          add(s, to, { kind: jump ? 'jump' : 'drop', x, dir, vx, ticks: landing.ticks, robust: jump ? robust : null });
        }
        for (const [key, targets] of outcomes) {
          const dir = Number(key.slice(4));
          const same = targets.every(t => t === targets[0]);
          for (const e of edges[s.id]) if (e.kind === 'drop' && e.x === x && e.dir === dir) e.robust = same;
        }
      }
    }
    const ladderChecks = [];
    for (const l of ladders) {
      if (l.x + l.width < window.x0 || l.x > window.x1) continue;
      const check = checkLadder(c, l, solids, surfaces);
      ladderChecks.push(check);
      if (check.ok) {
        add(check.bottomSurface, check.topSurface, { kind: 'ladder', x: l.x, ladder: l, dir: -1, ticks: check.climbTicks, robust: true });
        add(check.topSurface, check.bottomSurface, { kind: 'ladder', x: l.x, ladder: l, dir: 1, ticks: check.climbTicks, robust: true });
      }
    }
    return { edges, ladderChecks };
  }

  function checkLadder(c, l, solids, surfaces) {
    const cx = l.x + l.width / 2;
    const half = c.body.width / 2;
    const bottomSurface = surfaces.find(s => Math.abs(s.y - l.bottom) < 0.6 && s.x0 <= cx && s.x1 >= cx) || null;
    const topSurface = surfaces.find(s => Math.abs(s.y - l.top) < 0.6 && s.x0 <= cx && s.x1 >= cx) || null;
    const approach = Boolean(bottomSurface && bottomSurface.x0 <= l.x - APPROACH && bottomSurface.x1 >= l.x + l.width + APPROACH);
    const dismount = Boolean(topSurface && topSurface.x0 <= l.x - DISMOUNT && topSurface.x1 >= l.x + l.width + DISMOUNT);
    const column = { x: cx - half, y: l.top - HEADROOM, width: half * 2, height: l.bottom - l.top + HEADROOM };
    // Only the landing slab the ladder connects to may cross the climb column.
    const blockers = solids.filter(s => overlaps(column, s) && Math.abs(s.y - l.top) > 0.01);
    const headroom = !solids.some(s => overlaps({ x: cx - half, y: l.top - HEADROOM, width: half * 2, height: HEADROOM }, s));
    const footroom = !solids.some(s => overlaps({ x: cx - half, y: l.bottom - HEADROOM, width: half * 2, height: HEADROOM }, s) && Math.abs(s.y - l.top) > 0.01);
    const climbTicks = Math.ceil((l.bottom - l.top) / c.movement.climbSpeed);
    const beyondJump = l.bottom - l.top > jumpHeight(c.movement);
    const ok = approach && dismount && !blockers.length && headroom && footroom;
    return { x: l.x, top: l.top, bottom: l.bottom, ok, approach, dismount, clearColumn: !blockers.length, headroom, footroom, climbTicks, beyondJump, bottomSurface, topSurface };
  }

  function stackingHeadroom(solids) {
    const faults = [];
    for (const a of solids) for (const b of solids) {
      if (a === b || a.x >= b.x + b.width || a.x + a.width <= b.x) continue;
      const gap = b.y - (a.y + a.height); // a above b
      if (gap <= 0.01 || gap >= HEADROOM - 0.01) continue;
      // Only facing surfaces count: skip pairs with a solid filling the space between.
      const x0 = Math.max(a.x, b.x);
      const x1 = Math.min(a.x + a.width, b.x + b.width);
      const filled = solids.some(m => m !== a && m !== b && m.x < x1 && m.x + m.width > x0 &&
        m.y >= a.y + a.height - 0.01 && m.y + m.height <= b.y + 0.01);
      if (!filled) faults.push({ above: a, below: b, gap });
    }
    return faults;
  }

  // Reachability over all simulated moves, or only robust ones (route moves
  // that tolerate imperfect timing).
  function reach(edges, from, reverse, robustOnly) {
    const seen = new Set([from]);
    const queue = [from];
    const back = reverse ? edges.map(() => []) : null;
    if (reverse) edges.forEach((list, i) => list.forEach(e => back[e.to].push({ to: i, robust: e.robust })));
    const graph = reverse ? back : edges;
    while (queue.length) {
      const node = queue.shift();
      for (const e of graph[node]) if ((!robustOnly || e.robust) && !seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
    }
    return seen;
  }

  function shortestPath(edges, from, to) {
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const node = queue.shift();
      if (node === to) break;
      for (const e of edges[node]) if (e.robust && !prev.has(e.to)) { prev.set(e.to, { node, edge: e }); queue.push(e.to); }
    }
    if (!prev.has(to)) return null;
    const steps = [];
    for (let n = to; prev.get(n); n = prev.get(n).node) steps.unshift({ from: prev.get(n).node, ...prev.get(n).edge });
    return steps;
  }

  // Validate a candidate chunk in the context of everything already built.
  function validate(c, context, chunk, entry, final) {
    // Stand-in for the next chunk: the exit deck continues to the world end.
    const stub = final ? [] : [slab(chunk.x1, chunk.exit.y, c.worldWidth - chunk.x1, 'stub')];
    const solids = [...context, ...chunk.solids, ...stub];
    // Surfaces come from every solid so bulkheads split floors correctly;
    // movement is simulated from one room back up to the chunk's end.
    const window = { x0: chunk.x0 - 900, x1: chunk.x1 + 40 };
    const local = solids;
    const surfaces = extractSurfaces(local);
    const faults = stackingHeadroom(chunk.solids.concat(context.filter(s => s.x + s.width > chunk.x0 - 40 && s.x < chunk.x1 + 40)));
    const { edges, ladderChecks } = buildGraph(c, local, c._ladders.concat(chunk.ladders), surfaces, window);
    const from = surfaceUnder(surfaces, entry.x - 16, 32, entry.y);
    const to = surfaceUnder(surfaces, chunk.exit.x - 16, 32, chunk.exit.y);
    const reasons = [];
    const where = r => `${r.type}@${Math.round(r.x)},${Math.round(r.y)}`;
    if (faults.length) reasons.push(`headroom ${faults.map(f => `${where(f.above)}/${where(f.below)}:${Math.round(f.gap)}`).join(' ')}`);
    const badLadders = ladderChecks.filter(l => chunk.ladders.some(k => k.x === l.x && k.top === l.top) && !l.ok);
    if (badLadders.length) reasons.push(`ladder ${badLadders.map(l => l.x).join(',')}`);
    if (!from || !to) reasons.push('entry or exit not on a surface');
    let path = null;
    if (from && to) {
      const forward = reach(edges, from.id);
      const backward = reach(edges, to.id, true, true);
      if (!reach(edges, from.id, false, true).has(to.id)) reasons.push('exit unreachable');
      const stuck = [...forward].filter(id => !backward.has(id) && surfaces[id].x1 > chunk.x0 && surfaces[id].x0 < chunk.x1);
      if (stuck.length) reasons.push(`softlock ${stuck.map(id => `${Math.round(surfaces[id].x0)}-${Math.round(surfaces[id].x1)}@${surfaces[id].y}`).join(' ')}`);
      path = shortestPath(edges, from.id, to.id);
    }
    return { ok: !reasons.length, reasons, path, surfaces, edges, ladderChecks };
  }

  // ---------------------------------------------------------------------------
  // Station assembly

  // Room order per stage. Every stage climbs from the lower deck to the
  // upper deck and ends at the world's right edge.
  const STAGE_PLANS = {
    // Orbital station: the authored corridor, cargo bay, shaft and upper rooms.
    station: [
      { kind: 'opening', width: 900 },
      { kind: 'cargoBay', width: 1050 },
      { kind: 'ladderShaft', width: 500 },
      { kind: 'upper', variant: 'bridge', width: 850 },
      { kind: 'upper', width: 850 },
      { kind: 'upper' }
    ],
    // CyberCity: street level, access ladders up the block, rooftop catwalks.
    cyber: [
      { kind: 'start', width: 600 },
      { kind: 'cargoBay', width: 1050 },
      { kind: 'ladderShaft', width: 500 },
      { kind: 'upper', variant: 'bridge', width: 950 },
      { kind: 'upper', width: 950 },
      { kind: 'upper' }
    ],
    // Jungle Planet: root ledges up to the middle deck, vine ladders and canopy routes.
    jungle: [
      { kind: 'start', width: 600 },
      { kind: 'terraces', width: 1000 },
      { kind: 'ladderShaft', width: 500 },
      { kind: 'upper', variant: 'bridge', width: 950 },
      { kind: 'upper', variant: 'bridge', width: 950 },
      { kind: 'upper' }
    ],
    // Desert Temple Ruins: sandstone terraces, then ladder passages between halls.
    desert: [
      { kind: 'start', width: 600 },
      { kind: 'terraces', width: 1000 },
      { kind: 'ladderShaft', width: 500 },
      { kind: 'upper', variant: 'hatch', width: 950 },
      { kind: 'upper', width: 950 },
      { kind: 'upper', variant: 'hatch' }
    ]
  };

  function build(config) {
    const c = {
      ...config,
      world: { width: config.worldWidth, groundY: config.deckY[0] },
      _ladders: []
    };
    const seed = (config.seed >>> 0);
    const G = c.deckY[0];
    const floor = { type: 'deck', role: 'floor', x: 0, y: G, width: c.worldWidth, height: c.worldHeight - G };
    const solids = [floor];
    const ladders = [];
    const encounters = [];
    const chunks = [];
    const plan = STAGE_PLANS[config.stage || 'station'];
    let x = 0;
    let entry = null;
    plan.forEach((step, index) => {
      const x0 = x;
      const x1 = step.width ? x0 + step.width : c.worldWidth;
      const final = index === plan.length - 1;
      const make = (rng, safe) => {
        if (step.kind === 'opening') return buildOpening(c);
        if (step.kind === 'start') return buildStart(c, rng, x0, x1);
        if (step.kind === 'terraces') return buildTerraces(c, rng, x0, x1, safe);
        if (step.kind === 'cargoBay') return buildCargoBay(c, rng, x0, safe);
        if (step.kind === 'ladderShaft') return buildShaft(c, rng, x0);
        const variant = step.variant || (rng() < 0.5 ? 'bridge' : 'hatch');
        return buildUpperRoom(c, rng, x0, x1, variant, safe);
      };
      const attempts = [];
      let chosen = null;
      const tries = step.kind === 'opening' ? 1 : 4;
      for (let attempt = 0; attempt < tries && !chosen; attempt++) {
        const candidate = make(mulberry32(chunkSeed(seed, index, attempt)), false);
        const forced = config.forceFail?.includes(index) || config.forceFail?.includes(candidate.kind);
        const result = forced ? { ok: false, reasons: ['forced failure'] } : validate(c, solids, candidate, entry || candidate.entry, final);
        attempts.push({ attempt, ok: result.ok, reasons: result.reasons });
        if (result.ok) chosen = { chunk: candidate, result, source: attempt ? `seed+${attempt}` : 'seed' };
      }
      if (!chosen && step.kind !== 'opening') {
        // Fixed fallback parameters, then a plain connector.
        const fallback = make(() => 0.5, true);
        const forced = config.forceFail?.includes('fallback');
        const result = forced ? { ok: false, reasons: ['forced failure'] } : validate(c, solids, fallback, entry, final);
        attempts.push({ attempt: 'fallback', ok: result.ok, reasons: result.reasons });
        if (result.ok) chosen = { chunk: fallback, result, source: 'fallback' };
        else {
          const prevY = entry.y;
          const exitY = { cargoBay: G, start: G, terraces: c.deckY[1] }[step.kind] ?? c.deckY[2];
          const plain = buildPlain(c, step.kind, x0, x1, prevY, exitY);
          const plainResult = validate(c, solids, plain, entry, final);
          attempts.push({ attempt: 'plain', ok: plainResult.ok, reasons: plainResult.reasons });
          chosen = { chunk: plain, result: plainResult, source: 'plain' };
        }
      }
      const chunk = chosen.chunk;
      chunk.index = index;
      chunk.source = chosen.source;
      chunk.attempts = attempts;
      solids.push(...chunk.solids);
      ladders.push(...chunk.ladders);
      c._ladders = ladders;
      encounters.push(...chunk.encounters);
      chunks.push(chunk);
      entry = chunk.exit;
      x = x1;
    });
    return finish(c, seed, solids, ladders, encounters, chunks);
  }

  function finish(c, seed, solids, ladders, encounters, chunks) {
    const surfaces = extractSurfaces(solids);
    const window = { x0: -Infinity, x1: Infinity };
    const { edges, ladderChecks } = buildGraph(c, solids, ladders, surfaces, window);
    const start = chunks[0].entry;
    const goal = chunks.at(-1).exit;
    const from = surfaceUnder(surfaces, start.x - 16, 32, start.y);
    const to = surfaceUnder(surfaces, goal.x - 16, 32, goal.y);
    if (!from || !to) throw new Error(`station ${seed}: start or goal off surface ` + JSON.stringify(chunks.map(ch => [ch.kind, ch.source, ch.attempts])));
    const forward = reach(edges, from.id);
    const backward = reach(edges, to.id, true, true);
    const softlocks = [...forward].filter(id => !backward.has(id));
    const path = shortestPath(edges, from.id, to.id) || [];
    const onPath = new Set(path.map(step => `${step.from}>${step.to}`));
    // Optional loops: a ladder or drop off the mandatory route that can return.
    const loops = [];
    edges.forEach((list, a) => {
      if (!forward.has(a)) return;
      for (const e of list) {
        if (e.kind === 'jump' || !e.robust || onPath.has(`${a}>${e.to}`) || !forward.has(e.to)) continue;
        if (surfaces[a].y === surfaces[e.to].y) continue;
        if (reach(edges, e.to, false, true).has(a)) loops.push({ kind: e.kind, from: a, to: e.to, x: Math.round(e.x) });
      }
    });
    const accessible = surfaces.filter(s => forward.has(s.id));
    // Drops settle on walkable floors and catwalks, never on top of cover.
    const dropSurfaces = accessible.filter(s => [...s.roles].some(role => role !== 'cover'));
    // Enemy navigation ignores cover, which walkers hop or shoot around.
    const structural = solids.filter(s => s.role !== 'cover');
    const regions = extractSurfaces(structural).filter(r => r.x1 - r.x0 >= 24);
    regions.forEach((r, id) => {
      r.id = id;
      r.accessible = accessible.some(s => Math.abs(s.y - r.y) < 0.6 && s.x1 > r.x0 && s.x0 < r.x1);
    });
    const navEdges = regions.map(() => []);
    for (const l of ladders) {
      const cx = l.x + l.width / 2;
      const bottom = regions.find(r => Math.abs(r.y - l.bottom) < 0.6 && r.x0 <= cx && r.x1 >= cx);
      const top = regions.find(r => Math.abs(r.y - l.top) < 0.6 && r.x0 <= cx && r.x1 >= cx);
      if (!bottom || !top) continue;
      navEdges[bottom.id].push({ to: top.id, kind: 'ladder', ladder: l, x: cx, dir: -1 });
      navEdges[top.id].push({ to: bottom.id, kind: 'ladder', ladder: l, x: cx, dir: 1 });
    }
    for (const r of regions) {
      for (const side of [-1, 1]) {
        const edgeX = side < 0 ? r.x0 : r.x1;
        const probe = edgeX + side * 28;
        const bodyAtEdge = { x: probe - 16, y: r.y - 32, width: 32, height: 32 };
        if (structural.some(s => overlaps(bodyAtEdge, s))) continue;
        let landing = null;
        for (const t of regions) {
          if (t.y <= r.y + 0.6 || t.x0 > probe || t.x1 < probe) continue;
          if (!landing || t.y < landing.y) landing = t;
        }
        if (landing) navEdges[r.id].push({ to: landing.id, kind: 'drop', x: edgeX + side * 6, dir: side });
      }
    }
    const placed = [];
    for (const p of encounters) {
      const surface = surfaceUnder(accessible, p.x, 32, p.y);
      if (!surface || p.x < surface.x0 || p.x + 32 > surface.x1) continue;
      if (ladders.some(l => p.x + 32 > l.x - 24 && p.x < l.x + l.width + 24 && p.y > l.top - 1 && p.y < l.bottom + 1)) continue;
      const region = regions.find(r => Math.abs(r.y - p.y) < 0.6 && r.x0 <= p.x + 16 && r.x1 >= p.x + 16);
      if (region) placed.push({ ...p, region: region.id });
    }
    const describe = step => ({ kind: step.kind, from: Math.round(surfaces[step.from].y), to: Math.round(surfaces[step.to].y), x: Math.round(step.x) });
    const report = {
      seed,
      jumpHeight: +jumpHeight(c.movement).toFixed(2),
      chunks: chunks.map(ch => ({ kind: ch.kind, x0: ch.x0, x1: ch.x1, source: ch.source, attempts: ch.attempts })),
      ladders: ladderChecks.map(({ bottomSurface, topSurface, ...rest }) => rest),
      mandatory: path.map(describe),
      climbs: path.filter(step => step.kind === 'ladder').length,
      loops: loops.length,
      loopSamples: loops.slice(0, 6),
      reachableSurfaces: forward.size,
      softlocks: softlocks.length,
      headroomFaults: stackingHeadroom(solids).length,
      encounters: placed.length,
      ok: reach(edges, from.id, false, true).has(to.id) && !softlocks.length && ladderChecks.every(l => l.ok) && loops.length > 0 && !stackingHeadroom(solids).length
    };
    // The validated movement graph, kept for route checks and tooling.
    const graph = { surfaces, edges, start: from.id, goal: to.id, path };
    return { seed, solids, ladders, surfaces, accessible, dropSurfaces, regions, navEdges, encounters: placed, chunks, report, start, goal, graph };
  }

  const api = { build, STAGE_PLANS, moveBody, steer, overlaps, jumpHeight, extractSurfaces, surfaceUnder, shortestPath, mulberry32, SLAB, CATWALK, WALL, LADDER_WIDTH, HEADROOM };
  root.SpaceStation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
