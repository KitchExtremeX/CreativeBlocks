(function () {
  'use strict';
  const { clamp } = CB;
  class Player {
    constructor(world) {
      this.pos = [.5, world.ground(0, 7), 7.5];
      this.velocity = [0, 0, 0]; this.yaw = -.28; this.pitch = -.06;
      this.health = 100; this.energy = 100; this.hunger = 85;
      this.grounded = false; this.flash = 0; this.walk = 0; this.moving = false; this.sprinting = false;
      this.jumpLatch = false; this.fallPeak = this.pos[1]; this.regenClock = 0;
    }
    get eye() { return [this.pos[0], this.pos[1] + 1.58, this.pos[2]]; }
    get direction() { return [Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)]; }
    overlaps(p) {
      return this.pos[0] + .29 > p[0] && this.pos[0] - .29 < p[0] + 1 && this.pos[1] + 1.78 > p[1] && this.pos[1] < p[1] + 1 && this.pos[2] + .29 > p[2] && this.pos[2] - .29 < p[2] + 1;
    }
    collides(world, p) {
      for (let x = Math.floor(p[0] - .29 + 1e-5); x <= Math.floor(p[0] + .29 - 1e-5); x++)
        for (let y = Math.floor(p[1] + 1e-5); y <= Math.floor(p[1] + 1.78 - 1e-5); y++)
          for (let z = Math.floor(p[2] - .29 + 1e-5); z <= Math.floor(p[2] + .29 - 1e-5); z++)
            if (world.solid(x, y, z)) return true;
      return false;
    }
    moveAxis(world, axis, amount) {
      if (!amount) return false;
      const p = [...this.pos]; p[axis] += amount;
      if (!this.collides(world, p)) { this.pos = p; return false; }
      let low = 0, high = 1;
      for (let i = 0; i < 12; i++) {
        const middle = (low + high) / 2; p[axis] = this.pos[axis] + amount * middle;
        if (this.collides(world, p)) high = middle; else low = middle;
      }
      this.pos[axis] += amount * low;
      return true;
    }
    damage(amount) { this.health = Math.max(0, this.health - amount); this.flash = .5; this.regenClock = 0; }
    eat(item) {
      if (!item.food || (this.hunger >= 100 && this.health >= 100)) return false;
      this.hunger = Math.min(100, this.hunger + item.food); this.health = Math.min(100, this.health + item.heal); return true;
    }
    update(dt, keys, world) {
      let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
      let side = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
      const len = Math.hypot(forward, side) || 1;
      this.moving = !!(forward || side);
      this.sprinting = this.moving && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && this.energy > 1;
      this.energy = clamp(this.energy + dt * (this.sprinting ? -18 : 12), 0, 100);
      this.hunger = clamp(this.hunger - dt * (this.sprinting ? .15 : .055), 0, 100);
      this.regenClock += dt;
      if (this.hunger > 50 && this.regenClock > 8) this.health = Math.min(100, this.health + dt * .6);
      if (this.hunger <= 0) this.health = Math.max(0, this.health - dt * .65);
      const speed = this.sprinting ? 6.6 : 4.25;
      this.velocity[0] = (Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side) / len * speed;
      this.velocity[2] = (-Math.cos(this.yaw) * forward + Math.sin(this.yaw) * side) / len * speed;
      const wantsJump = keys.has('Space');
      if (wantsJump && !this.jumpLatch && this.grounded) { this.velocity[1] = 7.3; this.grounded = false; }
      this.jumpLatch = wantsJump;
      const steps = Math.max(1, Math.ceil(dt / (1 / 120))), step = dt / steps;
      for (let i = 0; i < steps; i++) {
        this.moveAxis(world, 0, this.velocity[0] * step);
        this.moveAxis(world, 2, this.velocity[2] * step);
        this.velocity[1] -= 20 * step;
        const landed = this.moveAxis(world, 1, this.velocity[1] * step);
        if (landed) {
          if (this.velocity[1] < 0) {
            if (!this.grounded && this.fallPeak - this.pos[1] > 3.5) this.damage(Math.floor((this.fallPeak - this.pos[1] - 3.5) * 9));
            this.grounded = true; this.fallPeak = this.pos[1];
          }
          this.velocity[1] = 0;
        } else { this.grounded = false; this.fallPeak = Math.max(this.fallPeak, this.pos[1]); }
      }
      if (this.pos[1] < -6 || Math.hypot(this.pos[0], this.pos[2]) > 42) {
        this.pos = [.5, world.ground(0, 7), 7.5]; this.velocity = [0, 0, 0]; this.fallPeak = this.pos[1]; this.damage(20);
      }
      this.flash = Math.max(0, this.flash - dt);
      if (this.moving && this.grounded) this.walk += dt * (this.sprinting ? 13 : 8);
    }
  }
  CB.Player = Player;
})();
