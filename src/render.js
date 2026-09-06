(function () {
  'use strict';
  const T = THREE, { blocks, items, hash, clamp } = CB;
  const faces = [
    { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
    { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] }
  ];
  const presets = {
    low: { ratio: .85, shadow: 0, water: 1, detail: .25, particles: 30 },
    medium: { ratio: 1, shadow: 1024, water: 48, detail: .55, particles: 70 },
    high: { ratio: 1.5, shadow: 2048, water: 80, detail: 1, particles: 140 },
    ultra: { ratio: 2, shadow: 4096, water: 128, detail: 1, particles: 220 }
  };
  function atlas() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    for (const [id, block] of Object.entries(blocks)) for (let top = 0; top <= 1; top++) {
      const tile = +id * 2 + top, ox = tile % 8 * 64, oy = Math.floor(tile / 8) * 64;
      const base = new T.Color(block.color);
      if (+id === 2 && !top) base.set('#957657');
      ctx.fillStyle = '#' + base.getHexString(); ctx.fillRect(ox, oy, 64, 64);
      for (let x = 0; x < 64; x += 4) for (let y = 0; y < 64; y += 4) {
        const n = hash(x + tile * 3, y, 112); if (n < .55) continue;
        const c = base.clone().multiplyScalar(.85 + n * .24);
        ctx.fillStyle = '#' + c.getHexString(); ctx.fillRect(ox + x, oy + y, 3 + Math.floor(n * 4), 2 + Math.floor(n * 3));
      }
      if (+id === 2 && !top) { ctx.fillStyle = blocks[2].color; ctx.fillRect(ox, oy, 64, 10); for (let x = 0; x < 64; x += 8) ctx.fillRect(ox + x, oy + 8, 8, 3 + hash(x, tile) * 7); }
      if (+id === 5 || +id === 9 || +id === 10) {
        ctx.strokeStyle = '#594b3540'; ctx.lineWidth = 2;
        for (let n = 0; n < 4; n++) { ctx.beginPath(); if (+id === 5 && !top) { ctx.moveTo(ox + 9 + n * 15, oy); ctx.lineTo(ox + 6 + n * 15, oy + 64); } else { ctx.moveTo(ox, oy + n * 16); ctx.lineTo(ox + 64, oy + n * 16); } ctx.stroke(); }
        if (+id === 5 && top) { ctx.strokeRect(ox + 12, oy + 12, 40, 40); ctx.strokeRect(ox + 22, oy + 22, 20, 20); }
      }
      if (+id === 8) { ctx.fillStyle = '#8dd2d0'; for (let i = 0; i < 5; i++) { const x = ox + hash(i, 3) * 48 + 4, y = oy + hash(i, 5) * 48 + 4; ctx.fillRect(x, y, 5, 9); } }
      if (+id === 10 && top) { ctx.strokeStyle = '#eee1b5'; ctx.lineWidth = 3; ctx.strokeRect(ox + 8, oy + 8, 48, 48); ctx.beginPath(); ctx.moveTo(ox + 12, oy + 48); ctx.lineTo(ox + 48, oy + 16); ctx.stroke(); }
      if (+id === 11) { ctx.strokeStyle = '#50645c70'; ctx.lineWidth = 3; ctx.strokeRect(ox + 2, oy + 2, 60, 60); ctx.beginPath(); ctx.moveTo(ox + 4, oy + 59); ctx.lineTo(ox + 59, oy + 4); ctx.stroke(); }
      if (+id === 12) { ctx.fillStyle = '#fff0b4'; ctx.fillRect(ox + 8, oy + 8, 48, 48); ctx.strokeStyle = '#876849'; ctx.lineWidth = 5; ctx.strokeRect(ox + 6, oy + 6, 52, 52); }
    }
    const texture = new T.CanvasTexture(canvas); texture.magFilter = T.NearestFilter; texture.minFilter = T.NearestMipmapLinearFilter; texture.colorSpace = T.SRGBColorSpace;
    return texture;
  }
  class Renderer {
    constructor(canvas, quality = 'high') {
      this.canvas = canvas;
      this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12;
      this.scene = new T.Scene(); this.scene.background = new T.Color('#a9c8d1'); this.scene.fog = new T.FogExp2('#a9c8d1', .016);
      this.camera = new T.PerspectiveCamera(73, 1, .045, 180); this.camera.rotation.order = 'YXZ';
      this.sun = new T.DirectionalLight('#ffe2b5', 2.4); this.sun.position.set(20, 35, 15);
      this.sun.shadow.camera.left = -34; this.sun.shadow.camera.right = 34; this.sun.shadow.camera.top = 34; this.sun.shadow.camera.bottom = -34;
      this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 120; this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .035;
      this.scene.add(this.sun); this.scene.add(this.sun.target);
      this.ambient = new T.HemisphereLight('#d4edf5', '#6c7151', 1.65); this.scene.add(this.ambient);
      this.texture = atlas(); this.terrainMaterial = new T.MeshStandardMaterial({ map: this.texture, roughness: 1, vertexColors: true });
      this.worldGroup = new T.Group(); this.scene.add(this.worldGroup); this.chunks = new Map(); this.world = null;
      this.boxGeometry = new T.BoxGeometry(1, 1, 1); this.materials = new Map(); this.entityMeshes = new Map(); this.dropMeshes = new Map(); this.fruitMeshes = [];
      this.detail = new T.Group(); this.scene.add(this.detail); this.particles = []; this.lanterns = [];
      this.selection = new T.LineSegments(new T.EdgesGeometry(this.boxGeometry), new T.LineBasicMaterial({ color: '#fff3cf', transparent: true, opacity: .95 }));
      this.selection.scale.setScalar(1.007); this.scene.add(this.selection);
      this.cracks = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({ color: '#3e3430', transparent: true, opacity: .85 })); this.scene.add(this.cracks);
      this.guide = new T.Group(); this.scene.add(this.guide); this.makeGuide();
      this.sunDisc = new T.Mesh(new T.SphereGeometry(3.2, 12, 8), new T.MeshBasicMaterial({ color: '#fff0c7', fog: false })); this.scene.add(this.sunDisc);
      this.clouds = new T.Group(); this.scene.add(this.clouds);
      for (let i = 0; i < 14; i++) {
        const g = new T.Group(); for (let n = 0; n < 4; n++) this.part(g, [n * 2.5, hash(i, n) * .6, 0], [4 + hash(n, i) * 4, .8, 2.5], '#f3eddf');
        g.position.set((hash(i, 1) - .5) * 120, 25 + hash(i, 2) * 8, (hash(i, 3) - .5) * 120); this.clouds.add(g);
      }
      this.handScene = new T.Scene(); this.handCamera = new T.PerspectiveCamera(65, 1, .01, 10); this.handGroup = new T.Group(); this.handScene.add(this.handGroup);
      this.handLight = new T.HemisphereLight('#ffffff', '#a09175', 2.8); this.handScene.add(this.handLight); this.heldId = -1;
      this.setQuality(quality);
    }
    material(color, emissive = false) {
      const k = color + emissive;
      if (!this.materials.has(k)) this.materials.set(k, new T.MeshStandardMaterial({ color, roughness: .86, ...(emissive ? { emissive: color, emissiveIntensity: .6 } : {}) }));
      return this.materials.get(k);
    }
    part(group, position, size, color, emissive = false) {
      const mesh = new T.Mesh(this.boxGeometry, this.material(color, emissive)); mesh.position.set(...position); mesh.scale.set(...size); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
    }
    setQuality(name) {
      this.quality = name in presets ? name : 'high'; this.settings = presets[this.quality];
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.settings.ratio));
      this.renderer.shadowMap.enabled = this.settings.shadow > 0; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.sun.castShadow = this.settings.shadow > 0;
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      this.sun.shadow.mapSize.set(this.settings.shadow || 512, this.settings.shadow || 512);
      this.sun.shadow.needsUpdate = true;
      this.makeWater(); if (this.world) this.makeDetails(this.world);
    }
    makeWater() {
      if (this.water) { this.scene.remove(this.water); this.water.geometry.dispose(); this.water.material.dispose(); }
      const geometry = new T.PlaneGeometry(220, 220, this.settings.water, this.settings.water); geometry.rotateX(-Math.PI / 2);
      const material = new T.ShaderMaterial({
        transparent: true, depthWrite: false, uniforms: { time: { value: 0 }, daylight: { value: 1 }, sky: { value: new T.Color('#a9c8d1') }, wave: { value: this.quality === 'low' ? 0 : 1 } },
        vertexShader: `uniform float time; uniform float wave; varying vec3 wp; void main(){vec3 p=position;p.y+=(sin(p.x*.32+time*.7)+cos(p.z*.4+time*.5))*.055*wave;wp=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`,
        fragmentShader: `uniform float time;uniform float daylight;uniform vec3 sky; varying vec3 wp;void main(){float ripple=sin(wp.x*2.1+wp.z*.6+time*.9)*cos(wp.z*1.8-wp.x*.3-time*.6);float glint=pow(max(0.,ripple),14.);vec3 c=mix(vec3(.09,.34,.40),vec3(.24,.59,.61),.55+.2*ripple)*daylight;c+=glint*.22*daylight;float fog=1.-exp(-pow(length(cameraPosition-wp)*.014,2.));gl_FragColor=vec4(mix(c,sky,fog),.83);}`
      });
      this.water = new T.Mesh(geometry, material); this.water.position.y = 1.65; this.water.renderOrder = 2; this.scene.add(this.water);
    }
    buildChunk(world, cx, cz) {
      const positions = [], normals = [], uvs = [], colors = [];
      for (let x = cx * 8; x < cx * 8 + 8; x++) for (let z = cz * 8; z < cz * 8 + 8; z++) for (let y = 0; y <= 30; y++) {
        const id = world.get(x, y, z); if (!id) continue;
        for (const f of faces) {
          if (world.get(x + f.n[0], y + f.n[1], z + f.n[2])) continue;
          const tile = id * 2 + (f.n[1] > 0 ? 1 : 0), col = tile % 8, row = Math.floor(tile / 8);
          const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
          for (const index of [0, 1, 2, 0, 2, 3]) {
            const v = f.v[index], ambient = .92 + hash(x + y, z, world.seed) * .08;
            let ao = 0;
            const outside = [x + f.n[0], y + f.n[1], z + f.n[2]], axes = [0, 1, 2].filter(a => f.n[a] === 0);
            for (const a of axes) { const p = [...outside]; p[a] += v[a] ? 1 : -1; if (world.get(...p)) ao++; }
            const brightness = ambient * (1 - ao * .12);
            positions.push(x + v[0], y + v[1], z + v[2]); normals.push(...f.n); colors.push(brightness, brightness, brightness);
            uvs.push((col + .008 + uv[index][0] * .984) / 8, 1 - (row + .992 - uv[index][1] * .984) / 4);
          }
        }
      }
      const chunkKey = `${cx},${cz}`, old = this.chunks.get(chunkKey);
      if (old) { this.worldGroup.remove(old); old.geometry.dispose(); this.chunks.delete(chunkKey); }
      if (!positions.length) return;
      const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.computeBoundingSphere();
      const mesh = new T.Mesh(geometry, this.terrainMaterial); mesh.castShadow = true; mesh.receiveShadow = true; this.worldGroup.add(mesh); this.chunks.set(chunkKey, mesh);
    }
    syncWorld(world) {
      if (this.world !== world) {
        for (const mesh of this.chunks.values()) { this.worldGroup.remove(mesh); mesh.geometry.dispose(); }
        this.chunks.clear();
        for (const mesh of [...this.entityMeshes.values(), ...this.dropMeshes.values()]) this.scene.remove(mesh);
        this.entityMeshes.clear(); this.dropMeshes.clear();
        for (const p of this.particles) this.scene.remove(p.mesh); this.particles = [];
        this.world = world; this.makeDetails(world);
        for (let x = -4; x <= 3; x++) for (let z = -4; z <= 3; z++) world.dirty.add(`${x},${z}`);
      }
      if (world.dirty.size) {
        for (const k of world.dirty) this.buildChunk(world, ...k.split(',').map(Number));
        world.dirty.clear(); this.updateLanterns(world); this.updateGuide(world);
      }
    }
    makeDetails(world) {
      this.detail.clear(); this.fruitMeshes = [];
      for (const d of world.decor) {
        if (hash(d.x, d.z) > this.settings.detail || (Math.abs(d.x) < 3 && Math.abs(d.z) < 4)) continue;
        const g = new T.Group();
        this.part(g, [0, .13, 0], [.045, .26, .045], '#78915e');
        if (d.flower) { this.part(g, [0, .28, 0], [.18, .06, .12], hash(d.x, d.z) > .5 ? '#e7cc8d' : '#c89e9c'); }
        else { const leaf = this.part(g, [.055, .13, 0], [.04, .22, .12], '#92a36d'); leaf.rotation.z = -.45; }
        g.position.set(d.x, d.y, d.z); this.detail.add(g); g.userData.base = d;
      }
      for (const f of world.fruits) {
        const g = new T.Group(); const body = this.part(g, [0, 0, 0], [.3, .26, .28], '#eaa363'); body.rotation.z = .12;
        this.part(g, [0, .16, 0], [.04, .09, .04], '#6d704b'); this.part(g, [.07, .18, 0], [.15, .04, .08], '#8caa67');
        g.position.set(f.x, f.y, f.z); this.detail.add(g); this.fruitMeshes.push({ mesh: g, fruit: f });
      }
    }
    makeGuide() {
      const material = new T.LineBasicMaterial({ color: '#e8cd94', transparent: true, opacity: .24, depthWrite: false });
      this.guideCells = [];
      for (let y = 4; y <= 6; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
        const needed = y === 6 ? Math.abs(x) <= 1 && Math.abs(z) <= 1 : (Math.abs(x) === 2 || Math.abs(z) === 2) && !(x === 0 && z === 2);
        if (!needed) continue;
        const mesh = new T.LineSegments(new T.EdgesGeometry(this.boxGeometry), material); mesh.position.set(x + .5, y + .5, z + .5); mesh.scale.setScalar(.985); this.guide.add(mesh); this.guideCells.push({ mesh, p: [x, y, z] });
      }
      const marker = new T.Mesh(new T.RingGeometry(3.55, 3.58, 4), new T.MeshBasicMaterial({ color: '#ead5a8', transparent: true, opacity: .6, side: T.DoubleSide })); marker.rotation.x = -Math.PI / 2; marker.rotation.z = Math.PI / 4; marker.position.set(.5, 4.007, .5); this.scene.add(marker);
    }
    updateGuide(world) { for (const c of this.guideCells) c.mesh.visible = !world.get(...c.p); }
    updateLanterns(world) {
      for (const light of this.lanterns) this.scene.remove(light); this.lanterns = [];
      for (const [k, id] of world.cells) if (id === 12 && this.lanterns.length < 8) { const p = k.split(',').map(Number); const light = new T.PointLight('#ffd99d', 10, 9, 2); light.position.set(p[0] + .5, p[1] + 1.2, p[2] + .5); this.scene.add(light); this.lanterns.push(light); }
    }
    creatureMesh(c) {
      const g = new T.Group();
      if (c.type === 'gloamray') {
        const body = this.part(g, [0, .88, 0], [.92, .36, .74], '#606c87'); body.rotation.y = Math.PI / 4;
        this.part(g, [0, 1.11, 0], [.5, .25, .46], '#a4acb0');
        for (const side of [-1, 1]) {
          const fin = this.part(g, [side * .7, .84, 0], [.64, .13, .65], '#8596a0'); fin.rotation.z = side * .22;
          const tip = this.part(g, [side * .98, .72, 0], [.18, .42, .22], '#d1bda3'); tip.rotation.z = side * -.3;
        }
        this.part(g, [0, .79, .42], [.56, .075, .06], '#f5ca8b', true);
        this.part(g, [0, .55, -.28], [.18, .36, .17], '#636784');
      } else {
        this.part(g, [0, .37, 0], [.65, .42, .9], '#9caa90'); this.part(g, [0, .57, -.12], [.54, .2, .6], '#c5c1a2');
        this.part(g, [0, .29, .48], [.38, .23, .24], '#aa9276');
        for (const side of [-1, 1]) {
          this.part(g, [side * .38, .15, .15], [.24, .09, .38], '#6c8b83');
          this.part(g, [side * .16, .4, .53], [.045, .045, .03], '#343e3a');
        }
      }
      const bar = new T.Group(); this.part(bar, [0, 0, 0], [1, .06, .03], '#293b41'); const fill = this.part(bar, [0, 0, .018], [.96, .035, .025], c.type === 'gloamray' ? '#e9ae86' : '#a4bf9d'); bar.position.y = c.type === 'gloamray' ? 1.75 : 1.03; g.add(bar); g.userData.bar = bar; g.userData.fill = fill;
      this.scene.add(g); return g;
    }
    syncEntities(game, dt) {
      const live = new Set();
      for (const c of game.creatures) {
        live.add(c.id); let mesh = this.entityMeshes.get(c.id);
        if (!mesh) { mesh = this.creatureMesh(c); this.entityMeshes.set(c.id, mesh); }
        mesh.visible = !c.dead;
        mesh.position.set(c.pos[0], c.pos[1] + (c.type === 'gloamray' ? Math.sin(c.age * 4) * .09 : Math.sin(c.age * 7) * .025), c.pos[2]); mesh.rotation.y = c.yaw;
        mesh.scale.setScalar(c.hit > 0 ? 1 + Math.sin(c.hit * 24) * .08 : 1);
        mesh.userData.bar.visible = c.health < c.maxHealth || (c.type === 'gloamray' && c.state !== 'patrol');
        mesh.userData.bar.quaternion.copy(this.camera.quaternion).premultiply(mesh.quaternion.clone().invert()); mesh.userData.fill.scale.x = .96 * c.health / c.maxHealth;
      }
      for (const [id, mesh] of this.entityMeshes) if (!live.has(id)) { this.scene.remove(mesh); this.entityMeshes.delete(id); }
      const drops = new Set();
      for (const d of game.drops) {
        drops.add(d.uid); let mesh = this.dropMeshes.get(d.uid);
        if (!mesh) { mesh = new T.Mesh(this.boxGeometry, this.material(items[d.id].color)); mesh.scale.setScalar(.22); mesh.castShadow = true; this.scene.add(mesh); this.dropMeshes.set(d.uid, mesh); }
        mesh.position.set(...d.pos); mesh.rotation.set(d.age * .5, d.age * 2, .15);
      }
      for (const [id, mesh] of this.dropMeshes) if (!drops.has(id)) { this.scene.remove(mesh); this.dropMeshes.delete(id); }
      for (const f of this.fruitMeshes) { f.mesh.visible = !f.fruit.collected; f.mesh.position.y = f.fruit.y + Math.sin(game.age * 2 + f.fruit.x) * .035; }
      for (const child of this.detail.children) if (child.userData.base) { const d = child.userData.base; child.visible = !!game.world.get(Math.floor(d.x), d.y - 1, Math.floor(d.z)); }
    }
    emit(event) {
      if (!['mine', 'hit', 'collect', 'place'].includes(event.type)) return;
      const color = event.type === 'hit' ? '#eac195' : items[event.id]?.color || '#e6d4a8';
      const count = event.type === 'mine' ? 12 : 5;
      for (let i = 0; i < count && this.particles.length < this.settings.particles; i++) {
        const mesh = new T.Mesh(this.boxGeometry, this.material(color)); mesh.scale.setScalar(.045 + Math.random() * .035);
        const p = event.pos || [0, 4, 0]; mesh.position.set(p[0] + (event.type === 'mine' ? .5 : 0), p[1] + .5, p[2] + (event.type === 'mine' ? .5 : 0));
        this.scene.add(mesh); this.particles.push({ mesh, velocity: new T.Vector3((Math.random() - .5) * 3, Math.random() * 3 + 1, (Math.random() - .5) * 3), life: .6 });
      }
    }
    equip(id) {
      this.heldId = id; this.handGroup.clear();
      const sleeve = this.part(this.handGroup, [.34, -.39, -.57], [.19, .34, .22], '#5b7c79'); sleeve.rotation.x = -.3;
      const hand = this.part(this.handGroup, [.32, -.22, -.63], [.17, .19, .2], '#dab995'); hand.rotation.x = -.3;
      if (!id) return;
      const item = items[id], g = new T.Group(); g.position.set(.29, -.11, -.68); g.rotation.z = -.22; this.handGroup.add(g);
      if (item.category === 'pick') { this.part(g, [0, .05, 0], [.045, .43, .05], '#ab8359'); this.part(g, [0, .24, 0], [.32, .075, .07], item.color); this.part(g, [-.15, .2, 0], [.06, .12, .07], item.color); }
      else if (item.category === 'sword') { this.part(g, [0, -.03, 0], [.05, .18, .05], '#8d7150'); this.part(g, [0, .08, 0], [.2, .045, .07], '#a58c69'); this.part(g, [0, .3, 0], [.075, .42, .045], item.color); const tip = this.part(g, [0, .53, 0], [.05, .06, .04], '#efd0a0'); tip.rotation.z = .35; }
      else if (item.icon === 'sticks') { this.part(g, [0, .1, 0], [.05, .38, .05], item.color); }
      else this.part(g, [0, .03, 0], [.22, .22, .22], item.color);
    }
    updateCracks(hit, progress) {
      this.cracks.visible = !!hit && progress > .05;
      if (!this.cracks.visible) return;
      const points = [], p = hit.p, f = faces.find(face => face.n.every((v, i) => v === hit.normal[i])) || faces[2];
      const axes = [0, 1, 2].filter(a => f.n[a] === 0), nAxis = [0, 1, 2].find(a => f.n[a] !== 0);
      for (let i = 0; i < Math.ceil(progress * 9); i++) {
        const angle = i * 2.4, a = [.5, .5, .5], b = [.5, .5, .5];
        a[nAxis] = b[nAxis] = f.n[nAxis] > 0 ? 1.006 : -.006;
        a[axes[0]] += Math.sin(angle) * .07; a[axes[1]] += Math.cos(angle) * .07;
        b[axes[0]] += Math.sin(angle) * (.15 + progress * .32); b[axes[1]] += Math.cos(angle) * (.15 + progress * .32);
        points.push(...a.map((v, j) => v + p[j]), ...b.map((v, j) => v + p[j]));
      }
      this.cracks.geometry.dispose(); this.cracks.geometry = new T.BufferGeometry(); this.cracks.geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    }
    atmosphere(game) {
      const phase = game.time.phase, t = clamp(game.time.progress, 0, 1);
      const stops = [['#dcb79c', '#b6ced0'], ['#b6ced0', '#b8c8c5'], ['#b8c8c5', '#263d59'], ['#263d59', '#dcb79c']];
      const blend = phase === 3 ? (t < .78 ? 0 : (t - .78) / .22) : t;
      const sky = new T.Color(stops[phase][0]).lerp(new T.Color(stops[phase][1]), blend);
      if (phase === 3 && t < .78) sky.lerp(new T.Color('#14283e'), Math.sin(t / .78 * Math.PI) * .65);
      this.scene.background.copy(sky); this.scene.fog.color.copy(sky);
      const intensity = phase === 0 ? .9 + t : phase === 1 ? 1.9 : phase === 2 ? 1.9 - t * 1.5 : .4 + blend * .5;
      const angle = phase === 0 ? .2 + t * .3 : phase === 1 ? .5 + t * 1.9 : phase === 2 ? 2.4 + t * .6 : .55 + t * 1.8;
      this.sun.position.set(Math.cos(angle) * 42, Math.sin(angle) * 45 + 5, 18); this.sun.intensity = intensity;
      this.sun.color.set(phase === 3 && t < .78 ? '#a6c5f5' : phase === 2 ? '#ffd19a' : '#ffebcd');
      this.ambient.intensity = phase === 3 ? .7 + blend * .3 : 1.25; this.ambient.color.copy(sky).lerp(new T.Color('#e9f3ee'), .35);
      this.sunDisc.position.copy(this.sun.position).multiplyScalar(1.6); this.sunDisc.material.color.copy(this.sun.color); this.sunDisc.scale.setScalar(phase === 3 ? .6 : 1);
      this.water.material.uniforms.time.value = game.age; this.water.material.uniforms.sky.value.copy(sky); this.water.material.uniforms.daylight.value = phase === 3 ? .45 + blend * .25 : .95;
      this.scene.fog.density = phase === 3 ? .024 : .015;
      this.handLight.intensity = phase === 3 ? 1.1 + blend : 2.4; this.handLight.color.copy(this.sun.color);
    }
    render(game, hit, dt, guide = false, cinematic = false) {
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      if (this.width !== w || this.height !== h) { this.width = w; this.height = h; this.renderer.setSize(w, h, false); this.camera.aspect = this.handCamera.aspect = w / h; this.camera.updateProjectionMatrix(); this.handCamera.updateProjectionMatrix(); }
      this.syncWorld(game.world); this.atmosphere(game);
      const p = game.player, eye = p.eye;
      this.camera.position.set(eye[0], eye[1] + (p.moving && p.grounded ? Math.sin(p.walk) * .022 : 0), eye[2]); this.camera.rotation.set(p.pitch, -p.yaw, 0, 'YXZ');
      // Core yaw is positive toward +X; Three's camera looks down -Z.
      if (cinematic) { this.camera.position.set(14, 12, 22); this.camera.lookAt(-2, 4.5, -2); }
      this.syncEntities(game, dt);
      this.selection.visible = !!hit; if (hit) this.selection.position.set(hit.p[0] + .5, hit.p[1] + .5, hit.p[2] + .5);
      this.updateCracks(hit, game.mining.progress); this.guide.visible = guide;
      for (const cloud of this.clouds.children) { cloud.position.x += dt * .17; if (cloud.position.x > 75) cloud.position.x = -75; }
      for (const particle of this.particles) { particle.life -= dt; particle.velocity.y -= dt * 7; particle.mesh.position.addScaledVector(particle.velocity, dt); particle.mesh.scale.multiplyScalar(Math.exp(-dt * 1.5)); if (particle.life <= 0) this.scene.remove(particle.mesh); }
      this.particles = this.particles.filter(particle => particle.life > 0);
      this.renderer.autoClear = true; this.renderer.render(this.scene, this.camera);
      if (cinematic) return;
      const id = game.inventory.current?.id || 0; if (id !== this.heldId) this.equip(id);
      const swing = Math.sin(clamp(game.swing / .38, 0, 1) * Math.PI);
      this.handGroup.position.set(-swing * .14, (p.moving ? Math.sin(p.walk) * .012 : 0) - swing * .06, -swing * .14); this.handGroup.rotation.set(-swing * .7, swing * .3, swing * .25);
      this.renderer.autoClear = false; this.renderer.clearDepth(); this.renderer.render(this.handScene, this.handCamera);
    }
  }
  Object.assign(CB, { Renderer, presets });
})();
