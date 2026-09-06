(function () {
  'use strict';
  const { items } = CB;
  class Inventory {
    constructor() { this.slots = Array(24).fill(null); this.selected = 0; this.version = 0; }
    get current() { return this.slots[this.selected]; }
    count(id) { return this.slots.reduce((n, s) => n + (s?.id === +id ? s.count : 0), 0); }
    capacity(id) { return this.slots.reduce((n, s) => n + (!s ? items[id].stack : s.id === id ? items[id].stack - s.count : 0), 0); }
    add(id, count = 1) {
      if (!items[id] || count <= 0 || !Number.isInteger(count) || this.capacity(id) < count) return false;
      for (const slot of this.slots) if (slot?.id === id && !items[id].durability) {
        const take = Math.min(count, items[id].stack - slot.count); slot.count += take; count -= take;
      }
      while (count > 0) {
        const amount = Math.min(count, items[id].stack), index = this.slots.indexOf(null);
        this.slots[index] = { id, count: amount, ...(items[id].durability ? { durability: items[id].durability } : {}) };
        count -= amount;
      }
      this.version++; return true;
    }
    remove(id, count = 1) {
      if (count < 1 || this.count(id) < count) return false;
      for (let i = 0; i < this.slots.length && count; i++) {
        const s = this.slots[i]; if (s?.id !== +id) continue;
        const take = Math.min(s.count, count); s.count -= take; count -= take;
        if (!s.count) this.slots[i] = null;
      }
      this.version++; return true;
    }
    consumeSelected() {
      const s = this.current; if (!s) return false;
      if (--s.count === 0) this.slots[this.selected] = null;
      this.version++; return true;
    }
    wear() {
      const s = this.current;
      if (!s?.durability) return false;
      if (--s.durability <= 0) { this.slots[this.selected] = null; this.version++; return true; }
      this.version++; return false;
    }
    swap(a, b) {
      if (a < 0 || a >= 24 || b < 0 || b >= 24) return;
      [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]]; this.version++;
    }
    craft(recipe, atStation = false) {
      if (recipe.station && !atStation) return 'Access a nearby crafting station first.';
      if (!Object.entries(recipe.cost).every(([id, n]) => this.count(id) >= n)) return 'You need more ingredients.';
      const saved = JSON.stringify(this.slots);
      for (const [id, n] of Object.entries(recipe.cost)) this.remove(+id, n);
      if (!this.add(recipe.out, recipe.count)) { this.slots = JSON.parse(saved); return 'Make room in your pack.'; }
      return null;
    }
    canCraft(recipe, atStation = false) {
      const copy = new Inventory(); copy.slots = JSON.parse(JSON.stringify(this.slots));
      return copy.craft(recipe, atStation) === null;
    }
  }
  CB.Inventory = Inventory;
})();
