'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../src/data.js');
for (const file of ['world', 'inventory', 'player', 'creatures', 'game']) require('../src/' + file + '.js');
const { Game, World, Inventory, Player, Creature, DayNight, recipes, items, pathfind } = globalThis.CB;
const ticks = (g, seconds, keys = new Set()) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) g.update(1 / 60, keys); };
function shelter(g, cx = 0, cy = 4, cz = 0) {
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) g.world.set(cx + x, cy - 1, cz + z, 3);
  for (let y = 0; y <= 1; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if ((Math.abs(x) === 2 || Math.abs(z) === 2) && !(x === 0 && z === 2)) g.world.set(cx + x, cy + y, cz + z, 11, true);
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) g.world.set(cx + x, cy + 2, cz + z, 11, true);
}
test('seeded island contains every natural material, safe spawn, hills, beaches and accessible timber', () => {
  const g = new Game(), twin = new World(g.seed);
  assert.deepEqual([...g.world.cells], [...twin.cells]); assert.notDeepEqual([...g.world.cells], [...new World(172).cells]);
  for (let id = 1; id <= 8; id++) assert([...g.world.cells.values()].includes(id));
  assert.equal(g.player.collides(g.world, g.player.pos), false); assert(g.world.get(0, 3, 7));
  assert.equal(g.world.get(-5, 4, 2), 5); assert(g.world.height(11, -8) > g.world.height(0, 0));
  assert(g.world.fruits.length >= 10); assert.equal(g.creatures.length, 4);
});
test('grounded movement, jumping, ceiling collision and stable landing', () => {
  const g = new Game(); ticks(g, .1); assert(g.player.grounded);
  const z = g.player.pos[2]; ticks(g, .4, new Set(['KeyW'])); assert(g.player.pos[2] < z - 1);
  ticks(g, .15, new Set(['Space'])); assert(g.player.pos[1] > 4.4);
  ticks(g, 2); assert(Math.abs(g.player.pos[1] - 4) < .001); assert(g.player.grounded);
  g.player.pos = [.5, 4, .5]; g.world.set(0, 6, 0, 4); ticks(g, .1); ticks(g, .5, new Set(['Space']));
  assert(g.player.pos[1] < 4.23); assert(!g.player.collides(g.world, g.player.pos));
});
test('swept movement cannot tunnel through a wall and diagonal speed is normalized', () => {
  const g = new Game(); g.player.pos = [.5, 4, 1.5]; g.player.yaw = 0;
  for (let y = 4; y < 7; y++) g.world.set(0, y, 0, 4);
  ticks(g, 1, new Set(['KeyW', 'ShiftLeft'])); assert(g.player.pos[2] >= 1.29 - 1e-4);
  const a = new Game(), b = new Game(); a.player.yaw = b.player.yaw = 0;
  const ap = [...a.player.pos], bp = [...b.player.pos]; ticks(a, .3, new Set(['KeyW'])); ticks(b, .3, new Set(['KeyW', 'KeyD']));
  assert(Math.abs(Math.hypot(a.player.pos[0] - ap[0], a.player.pos[2] - ap[2]) - Math.hypot(b.player.pos[0] - bp[0], b.player.pos[2] - bp[2])) < .001);
});
test('sprint drains energy, release restores it, food replenishes hunger and health', () => {
  const g = new Game(); ticks(g, 1, new Set(['KeyW', 'ShiftLeft'])); assert(g.player.energy < 85);
  ticks(g, 2); assert.equal(g.player.energy, 100); g.player.hunger = 40; g.player.health = 60;
  g.inventory.add(24, 2); g.inventory.selected = g.inventory.slots.findIndex(s => s?.id === 24);
  assert(g.eat()); assert.equal(g.inventory.count(24), 1); assert.equal(g.player.hunger, 64); assert.equal(g.player.health, 67);
});
test('fall damage, ocean rescue and modified spawn recovery', () => {
  const g = new Game(); g.player.pos = [.5, 12, 7.5]; g.player.fallPeak = 12; ticks(g, 2);
  assert(g.player.health < 70); assert(g.player.health > 0);
  g.world.set(0, 4, 7, 4); g.player.pos = [35, -7, 0]; g.player.update(.01, new Set(), g.world);
  assert.equal(g.player.pos[1], 5); assert(!g.player.collides(g.world, g.player.pos));
});
test('exact ray traversal returns adjacent face and obeys reach', () => {
  const w = new World(); w.set(0, 5, 0, 4);
  const h = w.ray([.5, 5.5, 3.5], [0, 0, -1]); assert.deepEqual(h.p, [0, 5, 0]); assert.deepEqual(h.adjacent, [0, 5, 1]); assert.equal(h.distance, 2.5);
  assert.equal(w.ray([.5, 5.5, 7], [0, 0, -1], 5), null);
});
test('stack cap, full-pack rejection, selected-slot consumption and swapping', () => {
  const i = new Inventory(); assert(i.add(3, 65)); assert.equal(i.slots[0].count, 32); assert.equal(i.slots[2].count, 1);
  i.selected = 1; i.consumeSelected(); assert.equal(i.slots[0].count, 32); assert.equal(i.slots[1].count, 31);
  i.swap(2, 7); assert.equal(i.slots[7].count, 1);
  const full = new Inventory(); assert(full.add(3, 32 * 24)); assert(!full.add(4)); assert.equal(full.count(3), 768);
});
test('all eight recipes consume exact materials; advanced recipes require station', () => {
  for (const r of recipes) {
    const i = new Inventory(); for (const [id, n] of Object.entries(r.cost)) i.add(+id, n);
    if (r.station) { assert(i.craft(r, false)); assert.equal(i.count(r.out), 0); }
    assert.equal(i.craft(r, true), null); assert.equal(i.count(r.out), r.count);
    for (const id of Object.keys(r.cost)) assert.equal(i.count(+id), 0);
  }
});
test('craft capacity failure rolls back consumed ingredients', () => {
  const i = new Inventory(); i.add(5, 32); for (let s = 1; s < 24; s++) i.slots[s] = { id: 3, count: 32 };
  const before = JSON.stringify(i.slots); assert.equal(i.craft(recipes[0]), 'Make room in your pack.'); assert.equal(JSON.stringify(i.slots), before);
});
test('station must be placed, aimed at and accessed; moving away revokes access', () => {
  const g = new Game(); g.world.set(1, 4, 6, 10, true); assert(!g.atStation);
  assert(g.accessStation({ p: [1, 4, 6], id: 10, distance: 2 })); assert(g.atStation);
  g.player.pos[0] = 15; assert(!g.atStation); g.player.pos = [.5, 4, 7.5]; g.world.set(1, 4, 6, 0); assert(!g.atStation);
});
test('mining creates a physical drop, collects it once, and cannot break bedrock', () => {
  const g = new Game(); g.player.pos = [-4, 4, 2.5]; const hit = { p: [-5, 4, 2], id: 5, distance: 1 };
  for (let i = 0; i < 80; i++) g.mine(hit, 1 / 60, true);
  assert.equal(g.world.get(-5, 4, 2), 0); assert.equal(g.drops.length, 1); assert.equal(g.inventory.count(5), 0);
  ticks(g, 2); assert.equal(g.drops.length, 0); assert.equal(g.inventory.count(5), 1);
  g.mine({ p: [0, 0, 0], id: 1, distance: 3 }, 100, true); assert.equal(g.world.get(0, 0, 0), 1);
});
test('pickaxes improve mining speed, use durability, and break cleanly', () => {
  const g = new Game(); g.inventory.add(21); assert.equal(g.mineSpeed(4), 2.6); assert.equal(g.mineSpeed(5), 1.3);
  g.inventory.current.durability = 1; g.world.set(1, 5, 7, 4);
  g.mine({ p: [1, 5, 7], id: 4, distance: 1 }, 1, true); assert.equal(g.inventory.count(21), 0);
  g.inventory.add(22); assert.equal(g.mineSpeed(8), 4.4);
});
test('placing consumes one block; overlap, occupied cells, cooldown and range are rejected', () => {
  const g = new Game(); g.inventory.add(11, 8);
  assert(!g.place({ adjacent: [0, 4, 7], distance: 1 })); assert(!g.place({ adjacent: [1, 4, 5], distance: 8 }));
  assert(g.place({ adjacent: [1, 4, 5], distance: 3 })); assert.equal(g.inventory.count(11), 7);
  assert(!g.place({ adjacent: [1, 5, 5], distance: 3 })); g.cooldown = 0; assert(!g.place({ adjacent: [1, 4, 5], distance: 3 }));
});
test('shelter recognition, broken roof, interior boundaries, and alternate construction site', () => {
  const g = new Game(); shelter(g); g.player.pos = [.5, 4, .5]; let s = g.world.shelter(g.player); assert(s.valid && s.inside); assert.equal(s.walls, 30);
  g.world.set(0, 6, 0, 0); assert(!g.world.shelter(g.player).valid); g.world.set(0, 6, 0, 11, true);
  g.player.pos = [.5, 4, 3.5]; assert(!g.world.shelter(g.player).inside);
  const other = new Game(); shelter(other, 3, 8, 3); other.player.pos = [3.5, 8, 3.5]; assert(other.world.shelter(other.player).valid);
});
test('ground pathfinding routes around a wall without clipping or teleporting to roofs', () => {
  const g = new Game(); for (let z = 1; z <= 5; z++) for (let y = 4; y <= 6; y++) g.world.set(1, y, z, 4);
  const path = pathfind(g.world, [.5, 4, 3.5], [3.5, 4, 3.5]); assert(path.length > 3);
  for (const p of path) { assert(!g.world.solid(...p)); assert(!g.world.solid(p[0], p[1] + 1, p[2])); }
  assert.deepEqual(path.at(-1), [3.5, 4, 3.5]);
});
test('passive creatures wander, react to hits, and drop food', () => {
  const g = new Game(), c = g.creatures[0], before = [...c.pos]; ticks(g, 3); assert.notDeepEqual(c.pos, before);
  g.inventory.add(23); g.attack({ creature: c, distance: 1 }); assert(c.dead); assert(g.drops.some(d => d.id === 25));
});
test('night spawns original hostile at safe distance, with detection, attacks, cooldown, knockback and death', () => {
  const g = new Game(); g.advanceTime(); g.advanceTime(); g.advanceTime(); const c = g.creatures.find(c => c.type === 'gloamray'); assert(c);
  assert(Math.hypot(c.pos[0] - g.player.pos[0], c.pos[2] - g.player.pos[2]) >= 7.5);
  c.pos = [.5, 4, 8.7]; c.update(.01, g); assert(g.player.health < 100); const hp = g.player.health; c.update(.1, g); assert.equal(g.player.health, hp);
  g.inventory.add(23); g.inventory.selected = g.inventory.slots.findIndex(s => s?.id === 23); g.attack({ creature: c, distance: 1 }); assert.equal(c.health, 47); assert(c.hit > 0); assert(Math.hypot(...c.knock) > 0);
  g.attack({ creature: c, distance: 1 }); assert.equal(c.health, 47);
  for (let n = 0; n < 3; n++) { g.attackCooldown = 0; g.attack({ creature: c, distance: 1 }); }
  assert(c.dead); const health = g.player.health; c.update(2, g); assert.equal(g.player.health, health);
});
test('survive the full night in a crafted refuge and win at morning, not prematurely', () => {
  const g = new Game(); shelter(g); g.player.pos = [.5, 4, .5]; g.advanceTime(); g.advanceTime(); g.advanceTime();
  ticks(g, 30); assert.equal(g.state, 'playing'); assert(g.protected); assert(g.stats.sheltered >= 29); assert.equal(g.player.health, 100);
  ticks(g, 71); assert.equal(g.state, 'victory'); assert.equal(g.time.name, 'Dawn'); assert.equal(g.time.day, 2); assert(!g.creatures.some(c => c.type === 'gloamray'));
});
test('defeat stops simulation and repeated restart clears every gameplay system', () => {
  const g = new Game(); g.player.health = 1; const c = new Creature(99, 'gloamray', [.5, 4, 8.7]); g.creatures.push(c); ticks(g, .1); assert.equal(g.state, 'defeat');
  const age = g.age; ticks(g, 2); assert.equal(g.age, age);
  for (let i = 0; i < 4; i++) {
    g.inventory.add(5, 5); shelter(g); g.spawnDrop(24, 1, [1, 5, 1]); g.stats.sheltered = 20; g.reset();
    assert.equal(g.state, 'playing'); assert.equal(g.player.health, 100); assert.equal(g.player.energy, 100); assert.equal(g.time.name, 'Dawn'); assert.equal(g.world.placed.size, 0); assert.equal(g.drops.length, 0); assert.equal(g.creatures.length, 4); assert.equal(g.stats.sheltered, 0); assert(g.inventory.slots.every(s => !s));
  }
});
test('a pair of wall holes is not mistaken for a valid doorway', () => {
  const g = new Game(); shelter(g); g.player.pos = [.5, 4, .5];
  g.world.set(0, 4, 2, 11, true); g.world.set(0, 5, 2, 11, true);
  g.world.set(-2, 4, 0, 0); g.world.set(2, 5, 0, 0);
  assert.equal(g.world.shelter(g.player).walls, 30); assert(!g.world.shelter(g.player).valid);
});
test('all fruit is placed near walkable ground rather than on treetops', () => {
  const g = new Game();
  for (const f of g.world.fruits) assert(Math.abs(f.y - (g.world.height(Math.floor(f.x), Math.floor(f.z)) + 1)) < .4);
});
test('resource drops remain available when the inventory is full', () => {
  const g = new Game(); g.inventory.add(3, 32 * 24); g.spawnDrop(4, 1, [.5, 4.5, 7.5]); ticks(g, 1);
  assert.equal(g.drops.length, 1); assert.equal(g.inventory.count(4), 0);
  g.inventory.slots[0] = null; ticks(g, 1); assert.equal(g.drops.length, 0); assert.equal(g.inventory.count(4), 1);
});
