(function () {
  'use strict';
  const { blocks, hash, key } = CB;
  class World {
    constructor(seed = 4817) {
      this.seed = seed;
      this.cells = new Map();
      this.placed = new Set();
      this.version = 0;
      this.dirty = new Set();
      this.fruits = [];
      this.decor = [];
      this.generate();
    }
    get(x, y, z) { return this.cells.get(key(x, y, z)) || 0; }
    solid(x, y, z) { return !!blocks[this.get(Math.floor(x), Math.floor(y), Math.floor(z))]?.solid; }
    set(x, y, z, id, placed = false) {
      const k = key(x, y, z);
      if (id) this.cells.set(k, id); else this.cells.delete(k);
      this.placed.delete(k);
      if (placed && id) this.placed.add(k);
      this.version++;
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) this.dirty.add(`${Math.floor((x + dx) / 8)},${Math.floor((z + dz) / 8)}`);
    }
    ground(x, z, ceiling = 30) {
      x = Math.floor(x); z = Math.floor(z);
      for (let y = Math.min(30, Math.floor(ceiling)); y >= 0; y--) if (this.get(x, y, z)) return y + 1;
      return 0;
    }
    height(x, z) {
      const r = Math.hypot(x * .96, z * 1.07);
      if (r > 25 + hash(x, z, this.seed) * 2) return -1;
      if (r > 22) return 1;
      if (r > 19) return 2;
      if (Math.abs(x) <= 6 && z >= -6 && z <= 9) return 3;
      const hills = 3 * Math.exp(-((x - 11) ** 2 + (z + 8) ** 2) / 65) + 4 * Math.exp(-((x + 12) ** 2 + (z + 10) ** 2) / 55);
      return Math.max(3, Math.floor(3 + hills + Math.sin(x * .25) * Math.cos(z * .3) * .65));
    }
    generate() {
      for (let x = -28; x <= 28; x++) for (let z = -28; z <= 28; z++) {
        const h = this.height(x, z);
        if (h < 0) continue;
        for (let y = 0; y <= h; y++) {
          let id = y === 0 ? 1 : y === h ? (h < 3 ? 7 : 2) : y >= h - 1 ? 3 : 4;
          if (y > 0 && y < h - 1 && hash(x + y * 15, z, this.seed) > .91) id = 8;
          this.set(x, y, z, id);
        }
        if (h >= 3 && hash(x + 100, z, this.seed) > .84) this.decor.push({ x: x + .5, y: h + 1, z: z + .5, flower: hash(x, z + 3, this.seed) > .72 });
      }
      // Spacious saltwood groves and reachable fallen timber near camp.
      const trees = [[-7, 1], [-10, 7], [-12, -3], [-16, -10], [-5, -11], [3, -12], [10, -11], [14, -3], [11, 5], [7, 12], [-4, 15], [-15, 10], [17, 9], [0, -19]];
      for (const [x, z] of trees) {
        const h = this.ground(x, z), trunk = 3 + Math.floor(hash(x, z, this.seed) * 2);
        for (let y = 0; y < trunk; y++) this.set(x, h + y, z, 5);
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 1; dy++) {
          if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 4) continue;
          if (!this.get(x + dx, h + trunk + dy, z + dz)) this.set(x + dx, h + trunk + dy, z + dz, 6);
        }
        this.fruits.push({ x: x + 1.7, y: this.height(x + 1, z + 2) + 1.28, z: z + 2.5, collected: false });
      }
      for (let z = 0; z < 5; z++) this.set(-5, 4, z, 5);
      for (let x = 6; x < 10; x++) for (let z = -1; z < 2; z++) this.set(x, this.ground(x, z), z, x === 9 ? 8 : 4);
      // An open seam in the northern hill gives access without deep excavation.
      for (let z = -10; z <= -7; z++) this.set(10, this.ground(10, z) - 1, z, 8);
      this.fruits.push({ x: -4.5, y: 4.3, z: 4.5, collected: false });
    }
    ray(origin, direction, range = 5) {
      // Amanatides–Woo grid traversal: exact face and range, including negative coordinates.
      const p = origin.map(Math.floor), step = direction.map(v => v >= 0 ? 1 : -1);
      const delta = direction.map(v => Math.abs(v) < 1e-10 ? Infinity : Math.abs(1 / v));
      const next = direction.map((v, i) => Math.abs(v) < 1e-10 ? Infinity : ((p[i] + (step[i] > 0 ? 1 : 0)) - origin[i]) / v);
      let distance = 0, previous = [...p], normal = [0, 0, 0];
      while (distance <= range) {
        const id = this.get(...p);
        if (id) return { p: [...p], adjacent: previous, normal, id, distance };
        let axis = next[0] < next[1] ? 0 : 1;
        if (next[2] < next[axis]) axis = 2;
        if (!Number.isFinite(next[axis])) break;
        previous = [...p]; distance = next[axis]; next[axis] += delta[axis]; p[axis] += step[axis];
        normal = [0, 0, 0]; normal[axis] = -step[axis];
      }
      return null;
    }
    nearbyStation(position, range = 4) {
      for (const [k, id] of this.cells) if (id === 10) {
        const p = k.split(',').map(Number);
        if (Math.hypot(p[0] + .5 - position[0], p[1] - position[1], p[2] + .5 - position[2]) <= range) return p;
      }
      return null;
    }
    shelterAt(cx, cy, cz) {
      let floor = 0, roof = 0, walls = 0;
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
        if (this.get(cx + x, cy - 1, cz + z)) floor++;
        if (this.placed.has(key(cx + x, cy + 2, cz + z))) roof++;
      }
      // One two-block doorway, in any cardinal wall, is permitted.
      let gaps = [];
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
        if (Math.abs(x) !== 2 && Math.abs(z) !== 2) continue;
        let filled = 0;
        for (let y = 0; y < 2; y++) if (this.placed.has(key(cx + x, cy + y, cz + z))) { walls++; filled++; }
        if (!filled && !this.get(cx + x, cy, cz + z) && !this.get(cx + x, cy + 1, cz + z) && ((x === 0 && Math.abs(z) === 2) || (z === 0 && Math.abs(x) === 2))) gaps.push([x, z]);
      }
      return { floor, roof, walls, valid: floor === 9 && roof === 9 && (walls === 32 || (walls === 30 && gaps.length === 1)), center: [cx, cy, cz] };
    }
    shelter(player) {
      const guide = this.shelterAt(0, 4, 0);
      let best = guide;
      const y = Math.round(player.pos[1]);
      for (let x = Math.floor(player.pos[0]) - 1; x <= Math.floor(player.pos[0]) + 1; x++) for (let z = Math.floor(player.pos[2]) - 1; z <= Math.floor(player.pos[2]) + 1; z++) {
        const s = this.shelterAt(x, y, z);
        if (s.valid) { best = s; break; }
      }
      const [x, base, z] = best.center;
      best.inside = player.pos[0] > x - .72 && player.pos[0] < x + 1.72 && player.pos[2] > z - .72 && player.pos[2] < z + 1.72 && Math.abs(player.pos[1] - base) < .15;
      return best;
    }
  }
  CB.World = World;
})();
