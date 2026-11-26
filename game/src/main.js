// Ringrunner game loop: sorties, ring threading, landings, scoring,
// and the staged screenshot poses the maker captured for the dossier.
import { MISSIONS, RINGS, SCORE, RUNWAY } from "./config.js";
import { buildTerrainMesh, buildSeaMesh, buildRunwayMesh, runwaySurfaceY, onRunway } from "./terrain.js";
import { buildAircraftMesh, buildRingMesh, FlightModel } from "./aircraft.js";
import { Renderer } from "./render.js";
import { Input } from "./input.js";
import { Hud } from "./hud.js";

const canvas = document.getElementById("gl");
const renderer = new Renderer(canvas);
renderer.upload("terrain", buildTerrainMesh());
renderer.upload("sea", buildSeaMesh());
renderer.upload("runway", buildRunwayMesh());
renderer.upload("aircraft", buildAircraftMesh());

const input = new Input(canvas);
const hud = new Hud();
const plane = new FlightModel();

let cameraMode = "chase";
let missionIndex = 0;
let ringCursor = 0;
let score = 0;
let elapsed = 0;
let flying = false;
let wasAirborne = false;
let finished = false;

function currentMission() { return MISSIONS[missionIndex]; }
function nextRingId() {
  const rings = currentMission().rings;
  return ringCursor < rings.length ? rings[ringCursor] : -1;
}
function refreshRings() {
  renderer.upload("rings", buildRingMesh(RINGS, nextRingId()));
}
function startMission(index) {
  missionIndex = index;
  ringCursor = 0;
  elapsed = 0;
  wasAirborne = false;
  finished = false;
  plane.reset(currentMission().fuel ?? 100);
  refreshRings();
  document.getElementById("menu").classList.add("hidden");
  document.getElementById("end").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");
  flying = true;
  hud.showBanner(currentMission().name, performance.now() / 1000);
}
function endSortie(won, reason) {
  flying = false;
  finished = true;
  const mission = currentMission();
  let total = score;
  if (won) {
    total += SCORE.landing;
    if (plane.lastSink < 2.2) total += SCORE.gentleLanding;
    total += Math.max(0, Math.round((mission.par - elapsed) * SCORE.timeBonusPerSec));
    total += Math.round(plane.hull * SCORE.hullPerPoint);
  }
  const title = document.getElementById("end-title");
  const text = document.getElementById("end-text");
  const stats = document.getElementById("end-stats");
  title.textContent = won ? "SORTIE COMPLETE" : "SORTIE LOST";
  text.textContent = reason;
  const mins = Math.floor(elapsed / 60), secs = Math.floor(elapsed % 60);
  stats.textContent = "Score " + total + " · Time " + mins + ":" + String(secs).padStart(2, "0") +
    " · Hull " + Math.round(plane.hull) + "% · Fuel " + Math.round(plane.fuel) + "%";
  document.getElementById("end").classList.remove("hidden");
  if (won && missionIndex < MISSIONS.length - 1) {
    document.getElementById("again-btn").textContent = "NEXT SORTIE";
  } else {
    document.getElementById("again-btn").textContent = "FLY AGAIN";
  }
  score = won ? total : score;
}
function checkRings(now) {
  const id = nextRingId();
  if (id < 0) return;
  const ring = RINGS[id];
  const d = Math.hypot(plane.pos.x - ring.x, plane.pos.y - ring.y, plane.pos.z - ring.z);
  if (d < ring.r) {
    ringCursor++;
    score += SCORE.ring;
    refreshRings();
    hud.showBanner(ringCursor >= currentMission().rings.length ? "ALL RINGS — LAND ON THE STRIP" : "RING " + ringCursor + " THREADED", now);
  }
}
function stepGame(dt, now) {
  if (input.takeCamera()) cameraMode = cameraMode === "chase" ? "cockpit" : "chase";
  if (input.takeRestart()) { startMission(missionIndex); return; }
  plane.step(dt, input.read());
  elapsed += dt;
  if (!plane.onGround) wasAirborne = true;
  checkRings(now);
  if (plane.crashed) {
    endSortie(false, "The Kestrel came down too hard. Walk away, chalk it up, and fly the sortie again.");
    return;
  }
  const ringsDone = ringCursor >= currentMission().rings.length;
  if (ringsDone && wasAirborne && plane.onGround && plane.speed < 3 && onRunway(plane.pos.x, plane.pos.z)) {
    endSortie(true, plane.lastSink < 2.2
      ? "A greased touchdown on the Aurelia strip. The courier office signs your chit without a word."
      : "Down and stopped on the strip. The gear groans, but the cargo is home.");
  }
}

document.getElementById("start-btn").addEventListener("click", () => { score = 0; startMission(0); });
document.getElementById("again-btn").addEventListener("click", () => {
  if (missionIndex < MISSIONS.length - 1 && finished) startMission(missionIndex + 1);
  else { score = 0; startMission(0); }
});

// Staged poses for the maker's screenshots: real renders, frozen physics.
const shot = new URLSearchParams(location.search).get("shot");
function stageShot(name) {
  document.getElementById("menu").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");
  flying = false;
  if (name === "cover") {
    cameraMode = "chase";
    plane.pos = { x: -252, y: 130, z: 332 };
    plane.yaw = Math.atan2(-300 - -252, 260 - 332);
    plane.pitch = 0.03; plane.roll = -0.18; plane.speed = 58; plane.throttle = 0.72; plane.fuel = 84;
    ringCursor = 0;
  } else if (name === "cockpit") {
    cameraMode = "cockpit";
    const fx = Math.sin(RUNWAY.heading), fz = Math.cos(RUNWAY.heading);
    plane.pos = { x: RUNWAY.x - fx * 260, y: runwaySurfaceY() + 42, z: RUNWAY.z - fz * 260 };
    plane.yaw = RUNWAY.heading; plane.pitch = -0.10; plane.roll = 0.05; plane.speed = 34; plane.throttle = 0.3; plane.fuel = 41;
    ringCursor = 3;
  } else if (name === "bank") {
    cameraMode = "chase";
    plane.pos = { x: 300, y: 205, z: -180 };
    plane.yaw = Math.atan2(560 - 300, -90 - -180);
    plane.pitch = 0.08; plane.roll = 0.62; plane.speed = 66; plane.throttle = 0.85; plane.fuel = 63;
    ringCursor = 3;
  } else if (name === "end") {
    cameraMode = "chase";
    plane.pos = { x: RUNWAY.x + Math.sin(RUNWAY.heading) * 40, y: runwaySurfaceY() + 1.2, z: RUNWAY.z + Math.cos(RUNWAY.heading) * 40 };
    plane.yaw = RUNWAY.heading; plane.pitch = 0; plane.roll = 0; plane.speed = 0; plane.throttle = 0; plane.fuel = 37; plane.hull = 92;
    ringCursor = 3; elapsed = 128; score = 750;
    endSortie(true, "A greased touchdown on the Aurelia strip. The courier office signs your chit without a word.");
  }
  refreshRings();
  hud.update(plane, currentMission(), score, elapsed, nextRingId(), 0);
}
if (shot) stageShot(shot); else refreshRings();

let last = performance.now();
function loop(nowMs) {
  const now = nowMs / 1000;
  const dt = Math.min(0.05, (nowMs - last) / 1000);
  last = nowMs;
  if (flying) stepGame(dt, now);
  renderer.frame(plane, cameraMode);
  if (flying || shot) hud.update(plane, currentMission(), score, elapsed, nextRingId(), now);
  if (shot) window.__shotReady = true;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
