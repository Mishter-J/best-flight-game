// Procedural Aurelia Isles heightfield: seeded value noise, island falloff,
// vertex colours by height and slope, plus the sea and runway geometry.
import { WORLD, RUNWAY } from "./config.js";

function hash2(x, z) {
  let h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function smoothNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function terrainHeight(x, z) {
  const half = WORLD.size / 2;
  const nx = x / half, nz = z / half;
  const dist = Math.sqrt(nx * nx + nz * nz);
  const falloff = Math.max(0, 1 - Math.pow(dist, 2.4));
  let h = 0;
  h += smoothNoise(x * 0.0016 + 7, z * 0.0016 + 3) * 150;
  h += smoothNoise(x * 0.005 + 21, z * 0.005 + 11) * 55;
  h += smoothNoise(x * 0.016 + 5, z * 0.016 + 17) * 14;
  h = (h - 55) * falloff * 0.85;
  // Flatten a shelf for the airstrip.
  const dx = x - RUNWAY.x, dz = z - RUNWAY.z;
  const along = dx * Math.sin(RUNWAY.heading) + dz * Math.cos(RUNWAY.heading);
  const across = dx * Math.cos(RUNWAY.heading) - dz * Math.sin(RUNWAY.heading);
  const strip = Math.exp(-Math.pow(across / 80, 2)) * Math.exp(-Math.pow(along / 500, 2));
  h = h * (1 - strip) + 6 * strip;
  return h;
}

function colourFor(h, slope) {
  if (h < 1.5) return [0.93, 0.85, 0.58];            // sand
  if (h < 28 && slope < 0.68) return [0.26, 0.58, 0.24]; // grass
  if (h < 48 && slope < 0.75) return [0.38, 0.52, 0.22];  // scrub
  if (h < 78) return [0.50, 0.44, 0.38];              // rock
  return [0.94, 0.95, 0.97];                          // snow caps
}

export function buildTerrainMesh() {
  const n = WORLD.grid, half = WORLD.size / 2, step = WORLD.size / n;
  const pos = [], col = [], idx = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = -half + i * step, z = -half + j * step;
      const h = terrainHeight(x, z);
      const hx = terrainHeight(x + step, z) - h, hz = terrainHeight(x, z + step) - h;
      const slope = Math.sqrt(hx * hx + hz * hz) / step;
      const c = colourFor(h, slope);
      const shade = 0.92 + hash2(i * 3, j * 5) * 0.14;
      pos.push(x, h, z);
      col.push(c[0] * shade, c[1] * shade, c[2] * shade);
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  return { positions: new Float32Array(pos), colours: new Float32Array(col), indices: new Uint32Array(idx) };
}

export function buildSeaMesh() {
  const s = WORLD.size * 2.4;
  return {
    positions: new Float32Array([-s, 0, -s, s, 0, -s, -s, 0, s, s, 0, s]),
    colours: new Float32Array([0.10, 0.38, 0.55, 0.10, 0.38, 0.55, 0.10, 0.38, 0.55, 0.10, 0.38, 0.55]),
    indices: new Uint32Array([0, 2, 1, 1, 2, 3]),
  };
}

export function buildRunwayMesh() {
  const { x, z, heading, length, width } = RUNWAY;
  const sx = Math.sin(heading), cz = Math.cos(heading);
  const px = cz, pz = -sx;
  const y = terrainHeight(x, z) + 0.6;
  const pos = [], col = [], idx = [];
  function quad(cx, cz2, w, l, rgb) {
    const base = pos.length / 3;
    const corners = [[-w, -l], [w, -l], [-w, l], [w, l]];
    for (const [a, b] of corners) {
      pos.push(cx + px * a + sx * b, y, cz2 + pz * a + cz * b);
      col.push(rgb[0], rgb[1], rgb[2]);
    }
    idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  quad(x, z, width / 2, length / 2, [0.16, 0.17, 0.19]);
  for (let i = -4; i <= 4; i++) quad(x + sx * i * 34, z + cz * i * 34, 0.7, 7, [0.95, 0.95, 0.95]);
  quad(x - sx * (length / 2 - 6), z - cz * (length / 2 - 6), width / 2 - 2, 2.2, [0.98, 0.85, 0.3]);
  quad(x + sx * (length / 2 - 6), z + cz * (length / 2 - 6), width / 2 - 2, 2.2, [0.98, 0.85, 0.3]);
  return { positions: new Float32Array(pos), colours: new Float32Array(col), indices: new Uint32Array(idx) };
}

export function runwaySurfaceY() {
  return terrainHeight(RUNWAY.x, RUNWAY.z) + 0.6;
}

export function onRunway(x, z) {
  const dx = x - RUNWAY.x, dz = z - RUNWAY.z;
  const along = dx * Math.sin(RUNWAY.heading) + dz * Math.cos(RUNWAY.heading);
  const across = dx * Math.cos(RUNWAY.heading) - dz * Math.sin(RUNWAY.heading);
  return Math.abs(along) < RUNWAY.length / 2 && Math.abs(across) < RUNWAY.width / 2;
}
