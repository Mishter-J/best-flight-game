// Ringrunner world constants: island layout, flight tuning and the three sorties.
export const WORLD = {
  size: 2400,          // metres across the playable square
  grid: 96,            // terrain grid resolution
  seaLevel: 0,
  ceiling: 900,        // soft altitude cap in metres
};

export const RUNWAY = { x: -520, z: 620, heading: 0.5, length: 380, width: 38 };

export const RINGS = [
  { x: -300, y: 120, z: 260, r: 26 },
  { x: -40, y: 165, z: -40, r: 24 },
  { x: 260, y: 130, z: -330, r: 24 },
  { x: 560, y: 190, z: -90, r: 22 },
  { x: 430, y: 110, z: 330, r: 22 },
  { x: 60, y: 150, z: 560, r: 20 },
];

export const FLIGHT = {
  maxThrustSpeed: 92,     // m/s at full throttle, level
  stallSpeed: 26,         // m/s where lift fades
  cruiseDrag: 0.012,
  pitchRate: 0.85,        // rad/s at full deflection
  rollRate: 1.9,
  yawRate: 0.55,
  gravity: 9.81,
  fuelBurn: 0.55,         // percent per second at full throttle
  startFuel: 100,
  hardLandingSink: 5.5,   // m/s sink that starts hurting the hull
  crashSink: 11,
};

export const MISSIONS = [
  {
    name: "SORTIE 1 · FIRST LIGHT",
    text: "Thread rings 1-3, then land on the strip",
    rings: [0, 1, 2],
    land: true,
    par: 150,
  },
  {
    name: "SORTIE 2 · THE LONG WAY ROUND",
    text: "Thread all six rings, then land",
    rings: [0, 1, 2, 3, 4, 5],
    land: true,
    par: 260,
  },
  {
    name: "SORTIE 3 · COURIER'S GAMBIT",
    text: "Six rings on a half tank — glide home and land",
    rings: [5, 4, 3, 2, 1, 0],
    land: true,
    fuel: 52,
    par: 240,
  },
];

export const SCORE = { ring: 250, landing: 500, gentleLanding: 250, timeBonusPerSec: 4, hullPerPoint: 6 };
