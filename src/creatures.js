(function () {
  'use strict';
  const { hash } = CB;
  // Ground-based A*: never treats treetops or roofs as teleport destinations.
  function surface(world, x, z, fromY) {
    for (let y = Math.min(29, Math.floor(fromY + 1.05)); y >= Math.max(1, Math.floor(fromY - 3)); y--) {
      if (world.get(x, y - 1, z) && !world.get(x, y, z) && !world.get(x, y + 1, z)) return y;
    }
    return null;
  }
  function pathfind(world, start, target, limit = 1000) {
    const sx = Math.floor(start[0]), sz = Math.floor(start[2]), tx = Math.floor(target[0]), tz = Math.floor(target[2]);
    const nodeKey = (x, z) => `${x},${z}`;
    const first = { x: sx, z: sz, y: start[1], cost: 0, score: Math.abs(sx - tx) + Math.abs(sz - tz), parent: null };
    const open = [first], costs = new Map([[nodeKey(sx, sz), 0]]);
    let nearest = first;
    for (let tries = 0; open.length && tries < limit; tries++) {
      let best = 0;
      for (let i = 1; i < open.length; i++) if (open[i].score < open[best].score) best = i;
      const node = open.splice(best, 1)[0], distance = Math.abs(node.x - tx) + Math.abs(node.z - tz);
      if (distance < Math.abs(nearest.x - tx) + Math.abs(nearest.z - tz)) nearest = node;
      if (distance === 0) { nearest = node; break; }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = node.x + dx, z = node.z + dz, y = surface(world, x, z, node.y);
        if (y === null) continue;
        const cost = node.cost + 1 + Math.abs(y - node.y) * .25, k = nodeKey(x, z);
        if (cost >= (costs.get(k) ?? Infinity)) continue;
        costs.set(k, cost); open.push({ x, z, y, cost, score: cost + Math.abs(x - tx) + Math.abs(z - tz), parent: node });
      }
    }
    const result = [];
    for (let n = nearest; n.parent; n = n.parent) result.unshift([n.x + .5, n.y, n.z + .5]);
    return result;
  }
  class Creature {
    constructor(id, type, pos) {
      this.id = id; this.type = type; this.pos = [...pos]; this.home = [...pos];
      this.health = type === 'gloamray' ? 70 : 18; this.maxHealth = this.health;
      this.state = 'patrol'; this.path = []; this.pathClock = 0; this.cooldown = 0; this.hit = 0;
      this.age = 0; this.yaw = 0; this.dead = false; this.wander = 0; this.knock = [0, 0];
    }
    hurt(amount, direction) {
      if (this.dead) return false;
      this.health = Math.max(0, this.health - amount); this.hit = .35;
      this.knock = [direction[0] * 4.5, direction[2] * 4.5];
      this.pathClock = 0; this.state = this.type === 'gloamray' ? 'chase' : 'flee';
      if (!this.health) { this.dead = true; this.state = 'defeated'; }
      return this.dead;
    }
    update(dt, game) {
      const { world, player } = game;
      this.age += dt; this.hit = Math.max(0, this.hit - dt); this.cooldown = Math.max(0, this.cooldown - dt);
      if (this.dead) return;
      this.pathClock -= dt;
      const delta = player.eye.map((v, i) => v - (this.pos[i] + (i === 1 ? .9 : 0))), distance = Math.hypot(...delta);
      const hostile = this.type === 'gloamray';
      const visible = distance < 5 || (distance < 15 && !world.ray([this.pos[0], this.pos[1] + .9, this.pos[2]], delta.map(v => v / distance), Math.max(0, distance - .2)));
      if (hostile && (visible || (this.state === 'chase' && distance < 22))) this.state = 'chase';
      else if (hostile) this.state = 'patrol';
      if (this.pathClock <= 0) {
        this.pathClock = hostile ? .65 : 2.5;
        let target;
        if (hostile && this.state === 'chase') target = player.pos;
        else {
          this.wander++;
          const angle = hash(this.id + this.wander, 31, world.seed) * Math.PI * 2;
          target = [this.home[0] + Math.sin(angle) * 5, this.pos[1], this.home[2] + Math.cos(angle) * 5];
          if (!hostile && this.state === 'flee') target = [this.pos[0] - delta[0] * 2, this.pos[1], this.pos[2] - delta[2] * 2];
        }
        this.path = pathfind(world, this.pos, target, hostile ? 1200 : 300);
      }
      let speed = hostile ? (this.state === 'chase' ? 2.65 : 1.15) : this.state === 'flee' ? 2.6 : .75;
      if (hostile && game.lanternNear(this.pos, 5)) speed *= .45;
      if (this.path.length && distance > (hostile ? 1.45 : 0)) {
        const next = this.path[0], dx = next[0] - this.pos[0], dz = next[2] - this.pos[2], length = Math.hypot(dx, dz);
        if (length < .06) { this.pos = [...next]; this.path.shift(); }
        else {
          const amount = Math.min(length, speed * dt), x = this.pos[0] + dx / length * amount, z = this.pos[2] + dz / length * amount;
          const y = surface(world, Math.floor(x), Math.floor(z), this.pos[1]);
          if (y !== null) { this.pos = [x, y, z]; this.yaw = Math.atan2(dx, dz); } else { this.path = []; this.pathClock = 0; }
        }
      }
      if (Math.hypot(...this.knock) > .05) {
        const x = this.pos[0] + this.knock[0] * dt, z = this.pos[2] + this.knock[1] * dt;
        const y = surface(world, Math.floor(x), Math.floor(z), this.pos[1]);
        if (y !== null) this.pos = [x, y, z];
        this.knock = this.knock.map(v => v * Math.exp(-dt * 9));
      }
      if (hostile && distance < 1.9 && visible && this.cooldown <= 0 && !game.protected) {
        this.state = 'attack'; this.cooldown = 1.2; player.damage(12); game.emit('hurt', { pos: player.pos });
      }
      if (!hostile && this.state === 'flee' && this.hit === 0 && distance > 7) this.state = 'patrol';
    }
  }
  Object.assign(CB, { Creature, pathfind, surface });
})();
