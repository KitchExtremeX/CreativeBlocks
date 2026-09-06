(function (root) {
  'use strict';
  const CB = root.CB = root.CB || {};
  const blocks = {
    1: { name: 'Island bedrock', color: '#354956', solid: true, seconds: Infinity, drop: 0, place: false },
    2: { name: 'Grass soil', color: '#82975b', solid: true, seconds: .65, drop: 2, place: true, category: 'soil' },
    3: { name: 'Packed earth', color: '#a47956', solid: true, seconds: .55, drop: 3, place: true, category: 'soil' },
    4: { name: 'River stone', color: '#87949b', solid: true, seconds: 2.4, drop: 4, place: true, category: 'rock' },
    5: { name: 'Saltwood timber', color: '#ae8155', solid: true, seconds: 1.1, drop: 5, place: true, category: 'wood' },
    6: { name: 'Saltwood foliage', color: '#668c62', solid: true, seconds: .25, drop: 6, place: true, category: 'leaf' },
    7: { name: 'Shell sand', color: '#e2d5ad', solid: true, seconds: .45, drop: 7, place: true, category: 'soil' },
    8: { name: 'Cobalt seam', color: '#759da9', solid: true, seconds: 3, drop: 8, place: true, category: 'rock' },
    9: { name: 'Processed timber', color: '#d0a16c', solid: true, seconds: .5, drop: 9, place: true, category: 'wood' },
    10: { name: 'Crafting station', color: '#bd8e60', solid: true, seconds: 1, drop: 10, place: true, category: 'wood' },
    11: { name: 'Shelter panel', color: '#b5c3ad', solid: true, seconds: .3, drop: 11, place: true, category: 'wood' },
    12: { name: 'Tide lantern', color: '#f4d295', solid: true, seconds: .35, drop: 12, place: true, glow: true }
  };
  const items = {
    ...blocks,
    20: { name: 'Sticks', color: '#c4a076', icon: 'sticks' },
    21: { name: 'Wooden pickaxe', color: '#c89960', category: 'pick', speed: 2.6, durability: 36, damage: 10, icon: 'pick' },
    22: { name: 'Stone pickaxe', color: '#a5b5bf', category: 'pick', speed: 4.4, durability: 72, damage: 14, icon: 'pick' },
    23: { name: 'Wooden sword', color: '#e5bc81', category: 'sword', durability: 48, damage: 23, icon: 'sword' },
    24: { name: 'Sunfruit', color: '#eea45f', food: 24, heal: 7, icon: 'fruit' },
    25: { name: 'Forager morsel', color: '#d99187', food: 35, heal: 10, icon: 'food' }
  };
  for (const [id, b] of Object.entries(items)) { b.id = +id; b.stack = b.durability ? 1 : 32; }
  const recipes = [
    { id: 'planks', out: 9, count: 6, cost: { 5: 1 }, text: 'Six boards from one timber. The start of something.' },
    { id: 'sticks', out: 20, count: 4, cost: { 9: 1 }, text: 'Handles for your field tools.' },
    { id: 'station', out: 10, count: 1, cost: { 9: 4, 20: 2 }, text: 'Place it, aim at it, and press E to unlock advanced crafting.' },
    { id: 'woodpick', out: 21, count: 1, cost: { 9: 3, 20: 2 }, text: 'Mines rock 2.6× faster · 36 uses.' },
    { id: 'stonepick', out: 22, count: 1, cost: { 4: 4, 20: 2 }, station: true, text: 'Mines rock 4.4× faster · 72 uses.' },
    { id: 'sword', out: 23, count: 1, cost: { 9: 3, 20: 1 }, station: true, text: 'A light wooden blade · 23 damage · 48 uses.' },
    { id: 'panels', out: 11, count: 8, cost: { 9: 2 }, text: 'Eight lightweight blocks for walls and roofs.' },
    { id: 'lantern', out: 12, count: 1, cost: { 8: 2, 9: 1 }, station: true, text: 'Warm light. Slows a nearby night creature.' }
  ];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const key = (x, y, z) => `${x},${y},${z}`;
  const hash = (x, z, seed = 4817) => { const n = Math.sin(x * 127.1 + z * 311.7 + seed * .713) * 43758.5453; return n - Math.floor(n); };
  Object.assign(CB, { blocks, items, recipes, clamp, key, hash });
  if (typeof module !== 'undefined') module.exports = CB;
})(globalThis);
