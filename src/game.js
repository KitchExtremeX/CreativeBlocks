(function () {
  'use strict';
  const { World, Inventory, Player, Creature, blocks, items, recipes, key, hash, clamp } = CB;
  class DayNight {
    constructor() { this.phase = 0; this.elapsed = 0; this.day = 1; this.durations = [25, 260, 35, 100]; }
    get name() { return ['Dawn', 'Day', 'Dusk', 'Night'][this.phase]; }
    get remaining() { return Math.max(0, this.durations[this.phase] - this.elapsed); }
    get progress() { return this.elapsed / this.durations[this.phase]; }
    advance() { const old = this.phase; this.phase = (this.phase + 1) % 4; this.elapsed = 0; if (old === 3) this.day++; return old; }
    update(dt) { this.elapsed += dt; return this.elapsed >= this.durations[this.phase] ? this.advance() : null; }
  }
  class Game {
    constructor(seed = 4817) { this.seed = seed; this.listeners = []; this.reset(); }
    reset() {
      this.world = new World(this.seed); this.inventory = new Inventory(); this.player = new Player(this.world); this.time = new DayNight();
      this.state = 'playing'; this.drops = []; this.creatures = []; this.events = []; this.age = 0; this.serial = 0;
      this.mining = { key: '', progress: 0 }; this.cooldown = 0; this.swing = 0; this.attackCooldown = 0;
      this.stats = { gathered: 0, crafted: 0, built: 0, defeated: 0, sheltered: 0, tool: false, station: false };
      this.shelter = this.world.shelter(this.player); this.protected = false; this.checkClock = 0;
      this.stationAccess = null; this.message = 'Find the fallen timber to your left. Your first morning starts here.';
      for (const [x, z] of [[-3, 11], [9, 8], [-12, 5], [4, -8]]) this.creatures.push(new Creature(++this.serial, 'pebblefin', [x + .5, this.world.ground(x, z), z + .5]));
      this.emit('reset');
    }
    emit(type, detail = {}) { this.events.push({ type, ...detail }); }
    tell(message) { this.message = message; this.emit('message', { message }); }
    lanternNear(pos, range) {
      for (const [k, id] of this.world.cells) if (id === 12) { const p = k.split(',').map(Number); if (Math.hypot(p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]) < range) return true; }
      return false;
    }
    spawnDrop(id, count, position) {
      this.drops.push({ uid: ++this.serial, id, count, pos: [...position], age: 0, velocity: 2.2 });
    }
    updateDrops(dt) {
      for (const drop of this.drops) {
        drop.age += dt;
        const target = this.player.pos.map((v, i) => v + (i === 1 ? .85 : 0));
        const delta = target.map((v, i) => v - drop.pos[i]), d = Math.hypot(...delta);
        if (drop.age > .22 && d < 4 && this.inventory.capacity(drop.id) >= drop.count) {
          if (d < .5) {
            this.inventory.add(drop.id, drop.count); this.stats.gathered += drop.count; drop.taken = true;
            this.emit('collect', { id: drop.id, pos: drop.pos });
          } else drop.pos = drop.pos.map((v, i) => v + delta[i] / d * Math.min(d, dt * 8));
        } else {
          drop.velocity -= dt * 8;
          const floor = this.world.ground(drop.pos[0], drop.pos[2], drop.pos[1]) + .2;
          drop.pos[1] = Math.max(floor, drop.pos[1] + drop.velocity * dt);
          if (drop.pos[1] === floor) drop.velocity = 0;
        }
      }
      this.drops = this.drops.filter(d => !d.taken);
      for (const f of this.world.fruits) if (!f.collected && Math.hypot(f.x - this.player.pos[0], f.y - this.player.pos[1] - .6, f.z - this.player.pos[2]) < 1.9) {
        f.collected = true; this.spawnDrop(24, 1, [f.x, f.y, f.z]);
      }
    }
    mineSpeed(id) {
      const tool = items[this.inventory.current?.id];
      if (tool?.category === 'pick') return blocks[id].category === 'rock' ? tool.speed : 1.3;
      return 1;
    }
    mine(hit, dt, held) {
      const target = hit ? key(...hit.p) : '';
      if (!held || target !== this.mining.key) this.mining = { key: target, progress: 0 };
      if (!held || !hit || this.cooldown > 0 || hit.distance > 5 || !Number.isFinite(blocks[hit.id].seconds) || this.world.get(...hit.p) !== hit.id) return;
      this.mining.progress += dt * this.mineSpeed(hit.id) / blocks[hit.id].seconds;
      this.swing = Math.max(this.swing, .15);
      if (this.mining.progress >= 1) {
        this.world.set(...hit.p, 0); this.spawnDrop(blocks[hit.id].drop, 1, hit.p.map(v => v + .5));
        if (hit.id === 6 && hash(hit.p[0], hit.p[2], this.world.seed + hit.p[1]) > .68) this.spawnDrop(24, 1, hit.p.map(v => v + .5));
        if (items[this.inventory.current?.id]?.category === 'pick' && this.inventory.wear()) this.tell('Your pickaxe wore out. Craft a replacement.');
        this.emit('mine', { id: hit.id, pos: hit.p }); this.mining.progress = 0; this.cooldown = .16; this.checkClock = 0;
      }
    }
    place(hit) {
      const slot = this.inventory.current, id = slot?.id;
      if (!hit || hit.distance > 5 || this.cooldown > 0 || !blocks[id]?.place || this.world.get(...hit.adjacent)) return false;
      const p = hit.adjacent;
      if (p[1] < 1 || p[1] > 24 || Math.abs(p[0]) > 30 || Math.abs(p[2]) > 30 || this.player.overlaps(p)) return false;
      for (const c of this.creatures) if (!c.dead && Math.abs(c.pos[0] - p[0] - .5) < .9 && Math.abs(c.pos[2] - p[2] - .5) < .9 && Math.abs(c.pos[1] - p[1]) < 1.4) return false;
      this.world.set(...p, id, true); this.inventory.consumeSelected(); this.stats.built++; this.cooldown = .2; this.swing = .25; this.checkClock = 0;
      this.emit('place', { id, pos: p });
      if (id === 10) this.tell('Crafting station placed. Aim at it and press E to access advanced recipes.');
      return true;
    }
    accessStation(hit) {
      if (hit?.id !== 10 || hit.distance > 4.5 || this.world.get(...hit.p) !== 10) return false;
      this.stationAccess = [...hit.p]; this.stats.station = true; this.emit('station'); return true;
    }
    get atStation() {
      const s = this.stationAccess;
      return !!s && this.world.get(...s) === 10 && Math.hypot(s[0] + .5 - this.player.pos[0], s[1] - this.player.pos[1], s[2] + .5 - this.player.pos[2]) < 4.6;
    }
    craft(id) {
      const recipe = recipes.find(r => r.id === id); if (!recipe) return false;
      const error = this.inventory.craft(recipe, this.atStation);
      if (error) { this.tell(error); return false; }
      this.stats.crafted++; if (items[recipe.out].category) this.stats.tool = true;
      this.emit('craft', { id: recipe.out }); this.tell(`${items[recipe.out].name} crafted${recipe.count > 1 ? ' ×' + recipe.count : ''}.`); return true;
    }
    eat() {
      const slot = this.inventory.current;
      if (!slot || !this.player.eat(items[slot.id])) { this.tell('Select a food item first, or save it until you are hungry.'); return false; }
      this.inventory.consumeSelected(); this.emit('eat'); this.tell('A small meal. A little more time.'); return true;
    }
    creatureTarget() {
      let result = null;
      const origin = this.player.eye, direction = this.player.direction;
      for (const creature of this.creatures) if (!creature.dead) {
        const center = [creature.pos[0], creature.pos[1] + (creature.type === 'gloamray' ? .95 : .45), creature.pos[2]];
        const v = center.map((n, i) => n - origin[i]), along = v.reduce((n, value, i) => n + value * direction[i], 0);
        const perpendicular = Math.hypot(...v.map((value, i) => value - direction[i] * along));
        if (along > 0 && along < 4 && perpendicular < (creature.type === 'gloamray' ? .8 : .6) && (!result || along < result.distance)) {
          if (!this.world.ray(origin, direction, Math.max(0, along - .7))) result = { creature, distance: along };
        }
      }
      return result;
    }
    attack(target = this.creatureTarget()) {
      if (this.attackCooldown > 0) return false;
      this.attackCooldown = .48; this.swing = .38; this.emit('swing');
      if (!target || target.distance > 3.3) return false;
      const tool = items[this.inventory.current?.id], damage = tool?.damage || 6;
      const killed = target.creature.hurt(damage, this.player.direction);
      if (tool?.durability) this.inventory.wear();
      this.emit('hit', { pos: target.creature.pos, hostile: target.creature.type === 'gloamray' });
      if (killed) {
        this.stats.defeated++; this.spawnDrop(target.creature.type === 'gloamray' ? 8 : 25, target.creature.type === 'gloamray' ? 2 : 1, target.creature.pos.map((v, i) => v + (i === 1 ? .7 : 0)));
        this.tell(target.creature.type === 'gloamray' ? 'The Gloamray fades. The rest of the night is yours.' : 'A forager morsel drops. Select food and press F to eat.');
      }
      return true;
    }
    phaseChanged(old) {
      if (this.time.phase === 3) {
        this.tell('NIGHTFALL · A Gloamray stirs. A complete shelter protects you. Survive until morning.');
        const candidates = [[-10, 6], [10, 6], [0, -10], [0, 15]];
        candidates.sort((a, b) => Math.abs(Math.hypot(a[0] - this.player.pos[0], a[1] - this.player.pos[2]) - 12) - Math.abs(Math.hypot(b[0] - this.player.pos[0], b[1] - this.player.pos[2]) - 12));
        for (const [x, z] of candidates) if (Math.hypot(x - this.player.pos[0], z - this.player.pos[2]) >= 8) {
          const y = CB.surface(this.world, x, z, this.world.height(x, z) + 1);
          if (y !== null) { this.creatures.push(new Creature(++this.serial, 'gloamray', [x + .5, y, z + .5])); break; }
        }
        this.emit('night');
      }
      if (old === 3) {
        this.creatures = this.creatures.filter(c => c.type !== 'gloamray');
        if (this.player.health > 0 && this.stats.sheltered >= 5) { this.state = 'victory'; this.emit('victory'); }
        else this.tell('Morning has arrived. Finish your shelter and spend five nighttime seconds inside to complete the expedition.');
      }
    }
    advanceTime() { this.phaseChanged(this.time.advance()); }
    update(dt, keys = new Set()) {
      if (this.state !== 'playing') return;
      dt = clamp(dt, 0, .1); this.age += dt;
      this.cooldown = Math.max(0, this.cooldown - dt); this.attackCooldown = Math.max(0, this.attackCooldown - dt); this.swing = Math.max(0, this.swing - dt);
      const before = this.player.health; this.player.update(dt, keys, this.world);
      if (this.player.health < before - 1) this.emit('hurt');
      this.checkClock -= dt;
      if (this.checkClock <= 0) { this.checkClock = .2; this.shelter = this.world.shelter(this.player); }
      this.protected = this.shelter.valid && this.shelter.inside;
      if (this.protected && this.time.phase === 3) this.stats.sheltered += dt;
      for (const c of this.creatures) c.update(dt, this);
      this.updateDrops(dt);
      if (this.player.health <= 0) { this.state = 'defeat'; this.emit('defeat'); return; }
      const old = this.time.update(dt); if (old !== null) this.phaseChanged(old);
    }
  }
  Object.assign(CB, { DayNight, Game });
})();
