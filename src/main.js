(function () {
  'use strict';
  const $ = id => document.getElementById(id), { items, blocks, recipes, Game, Renderer, AudioSystem } = CB;
  const panels = ['welcome', 'pause', 'inventory', 'settings', 'ending'];
  function icon(id) {
    if (!id) return '<svg class="item-icon" viewBox="0 0 40 40" aria-hidden="true"><path d="M16 20h8" stroke="#d8e2d026"/></svg>';
    const item = items[id], c = item.color;
    let drawing;
    if (item.icon === 'pick') drawing = `<path d="m17 32 7-23" stroke="#b28d61" stroke-width="5"/><path d="M8 12 19 7l13 4 2 9-5-5-9-2-10 4z" fill="${c}"/>`;
    else if (item.icon === 'sword') drawing = `<path d="m10 32 7-10" stroke="#a48660" stroke-width="5"/><path d="m16 25 14-20 4-1 1 5-15 19z" fill="${c}"/><path d="m12 19 13 9" stroke="#c8a779" stroke-width="4"/>`;
    else if (item.icon === 'sticks') drawing = `<path d="m12 32 13-24m-7 25L30 12" stroke="${c}" stroke-width="4"/>`;
    else if (item.food) drawing = `<path d="M10 16 17 11l11 3 4 10-5 8-13-1-6-8z" fill="${c}"/><path d="m20 13 1-7 8 1-5 5z" fill="#8da46b"/><path d="m14 17-2 6" stroke="#fff4cf88" stroke-width="2"/>`;
    else drawing = `<path d="m20 5 14 8v15l-14 8-14-8V13z" fill="${c}"/><path d="m6 13 14 8 14-8-14-8z" fill="#fff" opacity=".2"/><path d="m20 21 14-8v15l-14 8z" fill="#000" opacity=".16"/>${id === 10 ? '<path d="m10 13 10 6 10-6-10-5z" fill="none" stroke="#eee1b5" stroke-width="1.5"/>' : ''}${id === 11 ? '<path d="m9 17 8 14m0-9-8 4" stroke="#596f60" stroke-width="1.6"/>' : ''}`;
    return `<svg class="item-icon" viewBox="0 0 40 40" aria-hidden="true">${drawing}</svg>`;
  }
  class App {
    constructor() {
      this.game = new Game(); this.audio = new AudioSystem(); this.renderer = new Renderer($('scene'));
      this.mode = 'welcome'; this.settingsFrom = 'welcome'; this.keys = new Set(); this.held = false; this.dragLook = false; this.guide = false;
      this.hit = null; this.targetCreature = null; this.swapFrom = null; this.sensitivity = 1; this.toastUntil = 0; this.feedUntil = 0;
      this.hotCache = ''; this.packCache = ''; this.mapVersion = -1; this.mapClock = 0; this.hudClock = 0; this.last = performance.now(); this.frames = 0; this.frameTime = 0;
      this.running = true; this.bind(); this.updateHUD(); this.setMenu('welcome');
      requestAnimationFrame(now => this.frame(now));
    }
    setMenu(mode) {
      this.mode = mode; this.keys.clear(); this.held = false; this.dragLook = false; this.game.mining.progress = 0;
      panels.forEach(id => $(id).hidden = id !== mode);
      $('hud').style.opacity = mode === 'welcome' || (mode === 'settings' && this.settingsFrom === 'welcome') ? '0' : '1';
      if (mode !== 'playing' && document.pointerLockElement) document.exitPointerLock();
      if (mode === 'inventory') { this.swapFrom = null; this.packCache = ''; this.updateInventory(); }
    }
    resume() {
      if (this.game.state !== 'playing') return;
      this.audio.start(); this.setMenu('playing'); $('scene').focus({ preventScroll: true });
      const fallback = () => this.notify('Mouse capture unavailable here. Hold middle mouse to look, or use arrow keys.');
      try { const request = $('scene').requestPointerLock(); if (request?.catch) request.catch(fallback); } catch (_) { fallback(); }
    }
    restart() { this.game.reset(); this.hotCache = ''; this.packCache = ''; this.mapVersion = -1; this.swapFrom = null; this.hit = null; this.targetCreature = null; this.guide = false; this.resume(); this.updateHUD(); }
    notify(text) { this.game.message = text; this.toastUntil = performance.now() + 6500; $('toast').textContent = text; $('toast').style.opacity = '1'; }
    openSettings() { this.settingsFrom = this.mode; this.setMenu('settings'); }
    openInventory() { if (this.game.state === 'playing') this.setMenu('inventory'); }
    bind() {
      $('scene').tabIndex = 0;
      $('startButton').onclick = () => this.resume(); $('resumeButton').onclick = () => this.resume();
      $('menuButton').onclick = () => this.setMenu('pause'); $('welcomeSettings').onclick = () => this.openSettings(); $('settingsButton').onclick = () => this.openSettings();
      $('closeSettings').onclick = () => this.setMenu(this.settingsFrom); $('closeInventory').onclick = () => this.resume();
      $('restartButton').onclick = $('endRestart').onclick = () => this.restart();
      $('guideButton').onclick = () => { this.guide = !this.guide; this.updateHUD(); };
      $('quality').onchange = () => { this.renderer.setQuality($('quality').value); this.updateHUD(); };
      $('sensitivity').oninput = () => { this.sensitivity = +$('sensitivity').value; $('sensitivityValue').value = this.sensitivity.toFixed(1); };
      $('volume').oninput = () => { this.audio.volume = +$('volume').value; $('volumeValue').value = Math.round(this.audio.volume * 100) + '%'; };
      $('fov').oninput = () => { this.renderer.camera.fov = +$('fov').value; this.renderer.camera.updateProjectionMatrix(); $('fovValue').value = $('fov').value + '°'; };
      document.addEventListener('keydown', e => this.keydown(e)); document.addEventListener('keyup', e => this.keys.delete(e.code));
      document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && this.mode === 'playing') this.setMenu('pause'); });
      window.addEventListener('blur', () => { if (this.mode === 'playing') this.setMenu('pause'); });
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'playing') this.setMenu('pause'); });
      document.addEventListener('mousemove', e => {
        if (this.mode !== 'playing' || (!document.pointerLockElement && !this.dragLook)) return;
        this.game.player.yaw += e.movementX * .0022 * this.sensitivity;
        this.game.player.pitch = CB.clamp(this.game.player.pitch - e.movementY * .0022 * this.sensitivity, -1.53, 1.53);
      });
      $('scene').addEventListener('mousedown', e => {
        if (this.mode !== 'playing') return;
        if (e.button === 0) this.held = true;
        if (e.button === 1) { e.preventDefault(); this.dragLook = true; }
        if (e.button === 2 && !this.game.place(this.hit)) this.notify('Select a building block and aim at a nearby face. Keep the space clear.');
      });
      document.addEventListener('mouseup', () => { this.held = false; this.dragLook = false; });
      document.addEventListener('contextmenu', e => e.preventDefault());
      document.addEventListener('wheel', e => { if (this.mode !== 'playing') return; e.preventDefault(); this.game.inventory.selected = (this.game.inventory.selected + Math.sign(e.deltaY) + 8) % 8; this.game.mining.progress = 0; }, { passive: false });
      $('hotbar').onclick = e => { const button = e.target.closest('[data-slot]'); if (button) { this.game.inventory.selected = +button.dataset.slot; this.updateHUD(); } };
      $('packSlots').onclick = e => {
        const button = e.target.closest('[data-slot]'); if (!button) return;
        const index = +button.dataset.slot, slot = this.game.inventory.slots[index];
        if (this.swapFrom === null) { this.swapFrom = index; $('itemDescription').textContent = slot ? `${items[slot.id].name}${slot.durability ? ' · ' + slot.durability + ' uses remaining' : ' · ' + slot.count + ' / 32'} — click another slot to move.` : 'Empty slot selected. Click another slot to swap.'; }
        else { this.game.inventory.swap(this.swapFrom, index); this.swapFrom = null; }
        this.packCache = ''; this.updateInventory();
      };
      $('recipes').onclick = e => { const button = e.target.closest('[data-recipe]'); if (!button || button.disabled) return; this.game.craft(button.dataset.recipe); $('craftFeedback').textContent = this.game.message; this.packCache = ''; this.updateInventory(); };
    }
    keydown(e) {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (['Space', 'F8', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Escape') {
        if (this.mode === 'settings') this.setMenu(this.settingsFrom);
        else if (this.mode !== 'welcome' && this.mode !== 'ending') this.setMenu('pause');
        return;
      }
      if (e.code === 'KeyR' && this.mode !== 'welcome') { this.restart(); return; }
      if (this.mode === 'inventory' && (e.code === 'KeyC' || e.code === 'KeyI')) { this.resume(); return; }
      const slot = /^Digit[1-8]$/.test(e.code) ? +e.code.slice(-1) - 1 : -1;
      if (this.mode === 'inventory' && slot >= 0 && this.swapFrom !== null) { this.game.inventory.swap(this.swapFrom, slot); this.swapFrom = null; this.packCache = ''; this.updateInventory(); return; }
      if (this.mode !== 'playing') return;
      this.keys.add(e.code);
      if (slot >= 0) { this.game.inventory.selected = slot; this.game.mining.progress = 0; }
      if (e.code === 'KeyC' || e.code === 'KeyI') this.openInventory();
      if (e.code === 'KeyG') this.guide = !this.guide;
      if (e.code === 'KeyF') this.game.eat();
      if (e.code === 'KeyE') { if (this.game.accessStation(this.hit)) this.openInventory(); else this.notify('Aim at a placed crafting station within reach, then press E.'); }
      if (e.code === 'F8') { this.game.advanceTime(); this.notify('DEBUG · Time advanced to ' + this.game.time.name); }
    }
    tick(dt) {
      if (this.mode !== 'playing' || this.game.state !== 'playing') return;
      const p = this.game.player;
      p.yaw += (Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft'))) * dt * 1.7;
      p.pitch = CB.clamp(p.pitch + (Number(this.keys.has('ArrowUp')) - Number(this.keys.has('ArrowDown'))) * dt * 1.2, -1.53, 1.53);
      this.game.update(dt, this.keys);
      this.hit = this.game.world.ray(p.eye, p.direction, 5); this.targetCreature = this.game.creatureTarget();
      if (this.game.state === 'playing') {
        const sword = items[this.game.inventory.current?.id]?.category === 'sword';
        if (this.held && (this.targetCreature || sword)) { this.game.attack(this.targetCreature); this.game.mine(this.hit, dt, false); }
        else this.game.mine(this.hit, dt, this.held);
      }
      if (this.game.state !== 'playing') this.showEnding();
    }
    showEnding() {
      const win = this.game.state === 'victory'; this.setMenu('ending');
      $('endSeal').textContent = win ? '☀' : '◌'; $('endEyebrow').textContent = win ? 'FIRST MORNING' : 'AN UNFINISHED STORY';
      $('endTitle').textContent = win ? 'A place of your own.' : 'The tide keeps turning.';
      $('endMessage').textContent = win ? 'You gathered, created, and found shelter in the dark. The sun has returned. This little corner of the island is yours.' : 'Your health reached zero. A fresh island, an empty pack, and another dawn are waiting for you.';
      const s = this.game.stats; $('endStats').innerHTML = `<div><b>${s.gathered}</b><span>RESOURCES GATHERED</span></div><div><b>${s.built}</b><span>BLOCKS PLACED</span></div><div><b>${s.crafted}</b><span>ITEMS CRAFTED</span></div>`;
    }
    updateInventory() {
      const inv = this.game.inventory, signature = inv.version + '/' + this.game.atStation + '/' + this.swapFrom;
      if (this.packCache === signature) return; this.packCache = signature;
      $('stationStatus').textContent = this.game.atStation ? '◈ STATION CONNECTED · Advanced recipes unlocked' : '○ FIELD CRAFTING · Place a station and access it with E for advanced recipes';
      $('recipes').innerHTML = recipes.map(r => `<article class="recipe"><div class="recipe-title">${icon(r.out)}<b>${items[r.out].name}</b></div><p>${r.text}</p><div class="ingredients">${Object.entries(r.cost).map(([id, n]) => `<div class="ingredient ${inv.count(id) >= n ? 'enough' : 'missing'}">${items[id].name} <span>${inv.count(id)} / ${n}</span></div>`).join('')}</div><button data-recipe="${r.id}" ${inv.canCraft(r, this.game.atStation) ? '' : 'disabled'}>${r.station && !this.game.atStation ? 'Station required' : 'Craft' + (r.count > 1 ? ' ×' + r.count : '')}</button></article>`).join('');
      $('packSlots').innerHTML = inv.slots.map((s, i) => `<button data-slot="${i}" class="${i < 8 ? 'hot' : ''} ${this.swapFrom === i ? 'active' : ''}" aria-label="Slot ${i + 1}: ${s ? items[s.id].name + ', ' + s.count : 'empty'}"><span class="key">${i < 8 ? i + 1 : ''}</span>${icon(s?.id)}<span class="quantity">${s ? s.count : ''}</span>${s ? items[s.id].name : 'Empty'}</button>`).join('');
    }
    drawMap() {
      const canvas = $('map'), ctx = canvas.getContext('2d'), w = this.game.world;
      if (this.mapVersion !== w.version) {
        this.mapVersion = w.version; this.mapBase = document.createElement('canvas'); this.mapBase.width = this.mapBase.height = 136;
        const b = this.mapBase.getContext('2d'); b.fillStyle = '#548184'; b.fillRect(0, 0, 136, 136);
        for (let x = -28; x <= 28; x++) for (let z = -28; z <= 28; z++) {
          const h = w.ground(x, z); if (!h) continue; const id = w.get(x, h - 1, z);
          b.fillStyle = blocks[id].color; b.fillRect(68 + x * 2.1, 68 + z * 2.1, 2.2, 2.2);
        }
        b.strokeStyle = '#f2d9a2'; b.lineWidth = 1; b.strokeRect(63, 63, 10, 10);
      }
      ctx.drawImage(this.mapBase, 0, 0); const p = this.game.player; ctx.save(); ctx.translate(68 + p.pos[0] * 2.1, 68 + p.pos[2] * 2.1); ctx.rotate(p.yaw); ctx.fillStyle = '#fff0ca'; ctx.strokeStyle = '#29454a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.5, 4); ctx.lineTo(0, 2); ctx.lineTo(-3.5, 4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#f0e4c2'; ctx.font = '8px sans-serif'; ctx.fillText('N', 65, 10);
      $('coords').textContent = Math.floor(p.pos[0]) + ' / ' + Math.floor(p.pos[2]);
    }
    updateHUD() {
      const g = this.game, p = g.player, inv = g.inventory, s = g.stats;
      for (const [id, value] of [['health', p.health], ['energy', p.energy], ['food', p.hunger]]) { $(id + 'Value').textContent = Math.ceil(value); $(id + 'Bar').style.width = value + '%'; }
      $('hurt').style.opacity = Math.min(1, p.flash * 1.6);
      $('phase').textContent = g.time.name + ' · ' + g.time.day; const seconds = Math.ceil(g.time.remaining);
      $('timeLeft').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} ${g.time.phase === 3 ? 'until morning' : 'remaining'}`;
      $('phaseIcon').textContent = g.time.phase === 3 ? '☾' : '◒'; $('timeRing').style.strokeDashoffset = g.time.progress * 94.25;
      const objectives = [[s.gathered >= 3, 'Gather island resources'], [s.tool, 'Craft your first tool'], [g.shelter.valid || s.sheltered >= 5, 'Build a sheltered home'], [g.state === 'victory', 'Survive until morning']];
      $('objectives').innerHTML = objectives.map(([done, text]) => `<li class="${done ? 'done' : ''}"><i>${done ? '✓' : '○'}</i>${text}</li>`).join('');
      $('objectiveCount').textContent = objectives.filter(o => o[0]).length + ' / 4';
      $('guideButton').innerHTML = `${this.guide ? 'Hide' : 'Show'} shelter blueprint <kbd>G</kbd>`;
      $('shelterDetail').textContent = g.shelter.valid ? (g.protected ? 'REFUGE COMPLETE · You are protected.' : 'REFUGE COMPLETE · Return inside.') : this.guide ? `Walls ${g.shelter.walls}/30 · Roof ${g.shelter.roof}/9 · Floor ${g.shelter.floor}/9. Keep the doorway open.` : g.time.phase === 3 ? 'Stay alive until the sun returns. Your complete shelter protects you.' : 'Darkness arrives after dusk. Make time to build.';
      const slot = inv.current, item = items[slot?.id];
      $('selectedLabel').innerHTML = `${item?.name || 'Empty hand'}<small>${slot?.durability ? slot.durability + ' / ' + item.durability + ' USES' : item?.food ? 'PRESS F TO EAT · +' + item.food + ' NOURISHMENT' : item?.place ? 'RIGHT CLICK TO PLACE' : 'READY TO EXPLORE'}</small>`;
      const signature = inv.version + '/' + inv.selected;
      if (signature !== this.hotCache) {
        this.hotCache = signature;
        $('hotbar').innerHTML = inv.slots.slice(0, 8).map((s, i) => `<button data-slot="${i}" class="${i === inv.selected ? 'selected' : ''}" title="${s ? items[s.id].name : 'Empty slot'}" aria-label="Hotbar ${i + 1}: ${s ? items[s.id].name + ', ' + s.count : 'empty'}"><span class="key">${i + 1}</span>${icon(s?.id)}<span class="quantity">${s && !s.durability ? s.count : ''}</span>${s?.durability ? `<span class="durability"><i style="width:${s.durability / items[s.id].durability * 100}%"></i></span>` : ''}</button>`).join('');
      }
      $('targetInfo').innerHTML = this.targetCreature ? `<b>${this.targetCreature.creature.type === 'gloamray' ? 'Gloamray' : 'Pebblefin'}</b><small>${this.targetCreature.creature.health} / ${this.targetCreature.creature.maxHealth} HEALTH · LMB STRIKE</small>` : this.hit ? `<b>${blocks[this.hit.id].name}</b><small>${this.hit.id === 1 ? 'PROTECTED ISLAND FOUNDATION' : this.hit.id === 10 ? 'E · ACCESS CRAFTING STATION' : 'HOLD LMB TO GATHER'}</small>` : '';
      $('miningProgress').style.opacity = g.mining.progress > 0 ? '1' : '0'; $('miningProgress').firstElementChild.style.width = Math.min(100, g.mining.progress * 100) + '%';
      $('qualityLabel').textContent = this.renderer.quality.toUpperCase() + ' / SHADOWS ' + (this.renderer.settings.shadow ? 'ON' : 'OFF');
      if (performance.now() > this.toastUntil) $('toast').style.opacity = '0';
      if (performance.now() > this.feedUntil) $('pickupFeed').textContent = '';
      if (this.mode === 'inventory') this.updateInventory(); this.drawMap();
    }
    events() {
      for (const event of this.game.events.splice(0)) {
        this.audio.play(event); this.renderer.emit(event);
        if (event.type === 'message') this.notify(event.message);
        if (event.type === 'collect') { $('pickupFeed').textContent = '+ ' + items[event.id].name; this.feedUntil = performance.now() + 2200; }
      }
    }
    frame(now) {
      if (!this.running) return;
      const elapsed = (now - this.last) / 1000, dt = Math.min(elapsed, .05); this.last = now;
      this.tick(dt); this.events(); this.hudClock += dt;
      if (this.hudClock > .08) { this.updateHUD(); this.hudClock = 0; }
      const cinematic = this.mode === 'welcome' || (this.mode === 'settings' && this.settingsFrom === 'welcome');
      this.renderer.render(this.game, this.hit, this.mode === 'playing' ? dt : 0, this.guide, cinematic);
      this.frames++; this.frameTime += elapsed;
      if (this.frameTime >= 1) { $('fps').textContent = Math.round(this.frames / this.frameTime) + ' FPS'; this.frames = 0; this.frameTime = 0; }
      requestAnimationFrame(time => this.frame(time));
    }
  }
  try { CB.app = new App(); }
  catch (error) { $('fatal').textContent = 'The 3D renderer could not start. Enable browser hardware acceleration and reload. ' + error.message; $('startButton').disabled = true; console.error(error); }
  CB.icon = icon;
  if (location.search.includes('test=1')) { const script = document.createElement('script'); script.src = 'tests/browser.js'; document.body.append(script); }
})();
