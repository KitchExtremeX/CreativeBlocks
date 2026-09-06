/* Development-only integration runner. Enabled only with ?test=1. */
(async function () {
  'use strict';
  const app = CB.app, g = app?.game, checks = [], failures = [];
  const report = document.createElement('pre'); report.id = 'qa-results'; report.style.cssText = 'position:fixed;z-index:100;inset:12px auto auto 12px;max-height:94vh;overflow:auto;width:650px;padding:20px;background:#142d30f5;color:#e8e8d4;border:1px solid #d8c493;font:12px/1.6 monospace;white-space:pre-wrap;'; document.body.append(report);
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const check = async (name, fn) => {
    try { await fn(); checks.push(name); } catch (e) { failures.push(name + ': ' + e.message); }
    report.textContent = 'CreativeBlocks browser integration\n\n' + checks.map(n => 'PASS ' + n).join('\n') + '\n' + failures.map(n => 'FAIL ' + n).join('\n');
  };
  const key = code => document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  const up = code => document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  const press = code => { key(code); up(code); };
  const mouse = (type, button = 0) => document.getElementById('scene').dispatchEvent(new MouseEvent(type, { button, bubbles: true }));
  const ticks = (seconds) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) app.tick(1 / 60); };
  const aim = target => {
    const eye = g.player.eye, d = target.map((v, i) => v - eye[i]); g.player.yaw = Math.atan2(d[0], -d[2]); g.player.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    app.hit = g.world.ray(g.player.eye, g.player.direction); app.targetCreature = g.creatureTarget();
  };
  const choose = id => { let index = g.inventory.slots.findIndex(s => s?.id === id); assert(index >= 0, 'item ' + id + ' missing'); if (index >= 8) { g.inventory.swap(index, 0); index = 0; } press('Digit' + (index + 1)); };
  const craft = id => { app.updateInventory(); const button = document.querySelector(`[data-recipe="${id}"]`); assert(button && !button.disabled, id + ' recipe is disabled'); button.click(); };
  if (!app) { report.textContent = 'FAIL: Application failed to start'; return; }
  app.running = false;
  await check('WebGL starts and renders a textured island', () => { app.renderer.render(g, null, 0, false, true); assert(app.renderer.renderer.info.render.triangles > 500, 'no terrain triangles'); assert(document.querySelector('#fatal').textContent === '', 'renderer error'); });
  await check('WASD, sprint, jump and terrain collision via input handlers', () => {
    app.setMenu('playing'); ticks(.1); const start = [...g.player.pos]; key('KeyW'); key('ShiftLeft'); ticks(.5); up('KeyW'); up('ShiftLeft');
    assert(Math.hypot(g.player.pos[0] - start[0], g.player.pos[2] - start[2]) > 2, 'movement failed'); assert(g.player.energy < 95, 'sprint did not drain energy');
    const y = g.player.pos[1]; key('Space'); ticks(.15); up('Space'); assert(g.player.pos[1] > y + .3, 'jump failed'); ticks(1); assert(g.player.grounded, 'landing failed');
    for (const code of ['KeyA', 'KeyS', 'KeyD']) { const p = [...g.player.pos]; key(code); ticks(.08); up(code); assert(Math.hypot(g.player.pos[0] - p[0], g.player.pos[2] - p[2]) > .1, code + ' failed'); }
  });
  await check('Middle-drag mouse look, arrow fallback and sensitivity', () => {
    const before = g.player.yaw; mouse('mousedown', 1); const event = new MouseEvent('mousemove', { bubbles: true }); Object.defineProperties(event, { movementX: { value: 60 }, movementY: { value: -20 } }); document.dispatchEvent(event); mouse('mouseup', 1);
    assert(g.player.yaw > before, 'mouse look failed'); const pitch = g.player.pitch; key('ArrowUp'); ticks(.2); up('ArrowUp'); assert(g.player.pitch > pitch, 'arrow look failed');
    document.getElementById('sensitivity').value = '1.7'; document.getElementById('sensitivity').dispatchEvent(new Event('input')); assert(app.sensitivity === 1.7, 'sensitivity failed');
  });
  await check('Hold-left mining, cracking progress and physical resource collection', () => {
    for (let z = 0; z < 5; z++) {
      g.player.pos = [-3.4, 4, z + .5]; g.player.velocity = [0, 0, 0]; g.player.fallPeak = 4; aim([-4.99, 4.5, z + .5]);
      assert(app.hit?.id === 5, 'timber is not targetable'); mouse('mousedown'); ticks(.25); assert(g.mining.progress > 0, 'no mining progress'); app.renderer.render(g, app.hit, 0); assert(app.renderer.cracks.visible, 'no cracking geometry'); ticks(1); mouse('mouseup'); ticks(.8);
    }
    assert(g.inventory.count(5) >= 5, 'timber pickups not collected');
  });
  await check('Crafting opens with C, disables unavailable recipes, and creates tools', () => {
    press('KeyC'); assert(app.mode === 'inventory', 'crafting did not open');
    assert(document.querySelector('[data-recipe="stonepick"]').disabled, 'advanced recipe unlocked early');
    for (let i = 0; i < 5; i++) craft('planks'); craft('sticks'); craft('woodpick'); craft('station');
    assert(g.inventory.count(21) === 1 && g.inventory.count(10) === 1, 'equipment not crafted'); app.setMenu('playing'); choose(21); assert(g.mineSpeed(4) > 2, 'tool has no effect');
  });
  await check('Number keys, wheel selection and inventory slot swapping', () => {
    press('Digit8'); assert(g.inventory.selected === 7, 'number selection failed'); document.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, cancelable: true })); assert(g.inventory.selected === 0, 'wheel wrap failed');
    press('KeyI'); const before = g.inventory.slots[0]?.id; document.querySelector('#packSlots [data-slot="0"]').click(); document.querySelector('#packSlots [data-slot="20"]').click(); assert(g.inventory.slots[20]?.id === before, 'swap failed');
    document.querySelector('#packSlots [data-slot="20"]').click(); press('Digit1'); assert(g.inventory.slots[0]?.id === before, 'keyboard quick swap failed'); app.setMenu('playing');
  });
  await check('Right-click station placement and E access unlock advanced crafting', () => {
    choose(10); g.player.pos = [1.5, 4, 7.5]; g.player.velocity = [0, 0, 0]; g.cooldown = 0; aim([1.5, 3.99, 5.5]); assert(app.hit, 'no ground target'); const location = [...app.hit.adjacent]; mouse('mousedown', 2); mouse('mouseup', 2); assert(g.world.get(...location) === 10, 'station not placed');
    aim(location.map(v => v + .5)); press('KeyE'); assert(app.mode === 'inventory' && g.atStation, 'station access failed'); craft('sticks'); craft('sword'); for (let i = 0; i < 5; i++) craft('panels'); assert(g.inventory.count(11) === 40, 'panels not crafted'); app.setMenu('playing');
  });
  await check('Stone gathering with equipped pickaxe and station stone-pick recipe', () => {
    choose(21);
    for (const [x, z] of [[6, -1], [6, 0], [6, 1], [7, -1]]) {
      const y = g.world.ground(x, z) - 1; g.player.pos = [x - 1.1, g.world.ground(x - 1.1, z), z + .5]; g.player.fallPeak = g.player.pos[1]; g.player.velocity = [0, 0, 0]; aim([x + .01, y + .5, z + .5]);
      assert(app.hit?.id === 4, 'stone not targetable'); mouse('mousedown'); ticks(1.15); mouse('mouseup'); ticks(.8);
    }
    assert(g.inventory.count(4) >= 4, 'stone not collected: '+JSON.stringify({count:g.inventory.count(4),drops:g.drops,position:g.player.pos,selected:g.inventory.current,mining:g.mining}));
    g.player.pos = [1.5, 4, 7.5]; const station = g.stationAccess; assert(station, 'station lost'); aim(station.map(v => v + .5)); press('KeyE'); craft('sticks'); craft('stonepick'); assert(g.inventory.count(22) === 1, 'stone pick missing'); app.setMenu('playing');
  });
  await check('Block placement prevents overlapping the player', () => {
    choose(11); g.cooldown = 0; const count = g.inventory.count(11); app.hit = { adjacent: g.player.pos.map(Math.floor), distance: 1 }; mouse('mousedown', 2); mouse('mouseup', 2); assert(g.inventory.count(11) === count, 'overlap placement consumed a block');
  });
  await check('Food is collectible and F restores nourishment', () => {
    g.player.pos = [-4.5, 4, 4.5]; ticks(1); assert(g.inventory.count(24) > 0, 'sunfruit not collected'); g.player.hunger = 30; g.player.health = 75; choose(24); press('KeyF'); assert(g.player.hunger > 30 && g.player.health > 75, 'food had no effect');
  });
  await check('Shelter blueprint and validator recognize all placed walls and roof', () => {
    press('KeyG'); assert(app.guide, 'guide key failed');
    // Fixture positions isolate validation; resource spending and placement are separately tested.
    for (let y = 4; y <= 5; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if ((Math.abs(x) === 2 || Math.abs(z) === 2) && !(x === 0 && z === 2)) g.world.set(x, y, z, 11, true);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) g.world.set(x, 6, z, 11, true);
    g.player.pos = [.5, 4, .5]; g.player.fallPeak = 4; ticks(.3); assert(g.protected, 'shelter was not recognized');
  });
  await check('Night hostile detection, sword hit animation, damage, knockback and defeat', () => {
    app.setMenu('playing'); for (let n = 0; n < 4 && g.time.phase !== 3; n++) press('F8'); assert(g.time.phase === 3, 'time shortcut failed'); const c = g.creatures.find(c => c.type === 'gloamray'); assert(c, 'no nighttime creature');
    g.player.pos = [.5, 4, 4.5]; g.player.fallPeak = 4; g.protected = false; c.pos = [.5, 4, 5.8]; c.pathClock = 100; c.path = []; ticks(.1); assert(g.player.health < 82, 'creature did not attack');
    choose(23); aim([c.pos[0], c.pos[1] + .95, c.pos[2]]); mouse('mousedown'); ticks(.05); mouse('mouseup'); assert(c.health < 70 && c.hit > 0 && g.swing > 0, 'sword hit failed'); assert(Math.hypot(...c.knock) > 0, 'no knockback');
    for (let n = 0; n < 4 && !c.dead; n++) { c.pos = [.5, 4, 5.8]; c.knock = [0, 0]; c.path = []; c.pathClock = 100; g.attackCooldown = 0; aim([c.pos[0], c.pos[1] + .95, c.pos[2]]); mouse('mousedown'); ticks(.02); mouse('mouseup'); }
    assert(c.dead, 'hostile did not die');
  });
  await check('Full nighttime survival reaches a visible morning victory screen', () => {
    g.player.pos = [.5, 4, .5]; g.player.velocity = [0, 0, 0]; g.player.health = 100; g.checkClock = 0; ticks(101);
    assert(g.state === 'victory' && app.mode === 'ending', 'no victory screen'); assert(document.getElementById('endTitle').textContent === 'A place of your own.', 'wrong ending');
  });
  await check('Defeat screen and R reset health, world, inventory, enemies and time', () => {
    g.reset(); app.setMenu('playing'); g.player.health = 0; ticks(.02); assert(app.mode === 'ending' && g.state === 'defeat', 'no defeat screen');
    press('KeyR'); assert(g.state === 'playing' && g.player.health === 100 && g.time.phase === 0, 'restart failed'); assert(g.inventory.slots.every(s => !s), 'inventory persisted'); assert(g.world.placed.size === 0 && g.creatures.length === 4 && g.drops.length === 0, 'world state persisted');
    app.setMenu('pause');
  });
  await check('Low, medium, high and ultra graphics render without GL errors', () => {
    for (const quality of ['low', 'medium', 'high', 'ultra']) {
      document.getElementById('quality').value = quality; document.getElementById('quality').dispatchEvent(new Event('change')); app.renderer.render(g, null, 0);
      assert(app.renderer.quality === quality, 'quality setting ignored'); assert(app.renderer.renderer.getContext().getError() === 0, 'WebGL error at ' + quality);
    }
    app.renderer.setQuality('high');
  });
  await check('Pause stops simulation and settings adjust FOV and sound', () => {
    app.setMenu('pause'); const time = g.age; ticks(1); assert(g.age === time, 'pause did not stop time');
    document.getElementById('fov').value = '85'; document.getElementById('fov').dispatchEvent(new Event('input')); assert(app.renderer.camera.fov === 85, 'FOV failed');
    document.getElementById('volume').value = '.2'; document.getElementById('volume').dispatchEvent(new Event('input')); assert(app.audio.volume === .2, 'volume failed');
  });
  app.events(); app.updateHUD(); app.renderer.render(g, null, 0, false, true);
  report.dataset.status = failures.length ? 'failed' : 'passed'; report.dataset.passed = checks.length; report.dataset.failed = failures.length;
  report.textContent += `\n\nRESULT: ${checks.length} passed / ${failures.length} failed\nTest fixtures isolated to this test URL. Reload the normal URL to play.`;
})();
