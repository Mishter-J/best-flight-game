// The Kestrel-9 courier: a low-poly airframe built from coloured boxes,
// and the flight model that flies it (throttle, lift, stall, ground roll).
import { FLIGHT, RUNWAY } from "./config.js";
import { terrainHeight, runwaySurfaceY, onRunway } from "./terrain.js";

function box(pos, col, idx, cx, cy, cz, sx, sy, sz, rgb) {
  const base = pos.length / 3;
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const faces = [
    [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], 1.0],
    [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], 0.72],
    [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz], 1.12],
    [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz], 0.55],
    [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], 0.85],
    [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], 0.85],
  ];
  for (const f of faces) {
    const shade = f[4];
    const start = pos.length / 3;
    for (let i = 0; i < 4; i++) {
      pos.push(cx + f[i][0], cy + f[i][1], cz + f[i][2]);
      col.push(rgb[0] * shade, rgb[1] * shade, rgb[2] * shade);
    }
    idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  return base;
}

export function buildAircraftMesh() {
  const pos = [], col = [], idx = [];
  const cream = [0.96, 0.90, 0.78], red = [0.85, 0.22, 0.18], dark = [0.13, 0.16, 0.20], glass = [0.25, 0.55, 0.75];
  box(pos, col, idx, 0, 0, 0.4, 1.5, 1.5, 7.2, cream);        // fuselage
  box(pos, col, idx, 0, 0.15, -3.4, 1.1, 1.1, 1.6, red);      // nose cowl
  box(pos, col, idx, 0, 0.75, -1.2, 1.2, 0.8, 2.0, glass);    // canopy
  box(pos, col, idx, 0, -0.1, -0.6, 11.5, 0.22, 1.7, red);    // main wing
  box(pos, col, idx, 0, 0.25, 3.7, 4.2, 0.18, 1.1, red);      // tailplane
  box(pos, col, idx, 0, 0.95, 3.7, 0.18, 1.5, 1.1, red);      // fin
  box(pos, col, idx, -2.2, -0.85, -0.6, 0.35, 0.7, 0.9, dark); // gear L
  box(pos, col, idx, 2.2, -0.85, -0.6, 0.35, 0.7, 0.9, dark);  // gear R
  box(pos, col, idx, 0, 0.15, -4.35, 0.25, 2.6, 0.12, dark);   // propeller
  return { positions: new Float32Array(pos), colours: new Float32Array(col), indices: new Uint32Array(idx) };
}

export function buildRingMesh(rings, nextIndex) {
  const pos = [], col = [], idx = [];
  rings.forEach((ring, ri) => {
    const segments = 28, tube = 2.3;
    const rgb = ri === nextIndex ? [1.0, 0.82, 0.25] : (ri < nextIndex ? [0.35, 0.85, 0.45] : [0.45, 0.75, 1.0]);
    const start = pos.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const cx = ring.x + Math.cos(a) * ring.r, cy = ring.y + Math.sin(a) * ring.r;
      pos.push(cx, cy, ring.z - tube, cx, cy, ring.z + tube);
      col.push(rgb[0], rgb[1], rgb[2], rgb[0] * 0.8, rgb[1] * 0.8, rgb[2] * 0.8);
    }
    for (let i = 0; i < segments; i++) {
      const a = start + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  return { positions: new Float32Array(pos), colours: new Float32Array(col), indices: new Uint32Array(idx) };
}

export class FlightModel {
  constructor() {
    this.reset(100);
  }
  reset(fuel) {
    this.pos = { x: RUNWAY.x - Math.sin(RUNWAY.heading) * 130, y: runwaySurfaceY() + 1.2, z: RUNWAY.z - Math.cos(RUNWAY.heading) * 130 };
    this.yaw = RUNWAY.heading;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.vy = 0;
    this.fuel = fuel;
    this.hull = 100;
    this.onGround = true;
    this.stalled = false;
    this.crashed = false;
    this.lastSink = 0;
  }
  step(dt, input) {
    if (this.crashed) return;
    this.throttle = Math.max(0, Math.min(1, this.throttle + input.throttle * dt * 0.55));
    const fuelUse = this.fuel > 0 ? this.throttle : 0;
    this.fuel = Math.max(0, this.fuel - fuelUse * FLIGHT.fuelBurn * dt);
    const targetSpeed = fuelUse * FLIGHT.maxThrustSpeed;
    const accel = (targetSpeed - this.speed) * 0.35 - Math.sin(this.pitch) * FLIGHT.gravity * 0.55;
    this.speed = Math.max(0, this.speed + accel * dt);
    if (input.brake && this.onGround) this.speed = Math.max(0, this.speed - 14 * dt);

    const authority = Math.min(1, this.speed / 45);
    this.roll += (input.roll * 0.95 - this.roll) * Math.min(1, dt * 4.5);
    this.pitch += input.pitch * FLIGHT.pitchRate * authority * dt;
    this.pitch = Math.max(-0.65, Math.min(0.6, this.pitch));
    this.yaw += (-Math.sin(this.roll) * 0.85 + input.yaw * FLIGHT.yawRate * authority) * dt;

    const lift = Math.min(1, this.speed / FLIGHT.stallSpeed);
    this.stalled = !this.onGround && this.speed < FLIGHT.stallSpeed;
    const sink = (1 - lift) * 9 + (this.stalled ? 5 : 0);
    this.vy = Math.sin(this.pitch) * this.speed * lift - sink;

    const fx = Math.sin(this.yaw) * Math.cos(this.pitch);
    const fz = Math.cos(this.yaw) * Math.cos(this.pitch);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    this.pos.y += this.vy * dt;

    const groundY = (onRunway(this.pos.x, this.pos.z) ? runwaySurfaceY() : terrainHeight(this.pos.x, this.pos.z)) + 1.2;
    if (this.pos.y <= groundY) {
      this.lastSink = -this.vy;
      if (!this.onGround) {
        if (this.lastSink > FLIGHT.crashSink || Math.abs(this.roll) > 0.7) {
          this.crashed = true;
          this.hull = 0;
        } else if (this.lastSink > FLIGHT.hardLandingSink) {
          this.hull = Math.max(1, this.hull - (this.lastSink - FLIGHT.hardLandingSink) * 9);
        }
      }
      this.pos.y = groundY;
      this.onGround = true;
      this.pitch *= 0.8;
      this.roll *= 0.8;
      if (this.speed < 2 && this.throttle < 0.05) this.speed = 0;
    } else {
      this.onGround = false;
    }
    if (this.pos.y > 900) this.pos.y = 900;
    this.pos.x = Math.max(-1150, Math.min(1150, this.pos.x));
    this.pos.z = Math.max(-1150, Math.min(1150, this.pos.z));
  }
  headingDeg() {
    let d = (this.yaw * 180 / Math.PI) % 360;
    if (d < 0) d += 360;
    return Math.round(d);
  }
  speedKt() { return Math.round(this.speed * 1.944); }
  altitudeFt() { return Math.round(Math.max(0, this.pos.y) * 3.281); }
}
