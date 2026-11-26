// HUD: speed / heading / altitude tapes, fuel, hull and throttle bars,
// the mission line, warning banner and the island minimap.
import { WORLD, RUNWAY, RINGS } from "./config.js";

const el = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.speed = el("hud-speed");
    this.heading = el("hud-heading");
    this.alt = el("hud-alt");
    this.fuel = el("fuel-fill");
    this.hull = el("hull-fill");
    this.thr = el("thr-fill");
    this.missionTitle = el("mission-title");
    this.missionText = el("mission-text");
    this.scoreLine = el("score-line");
    this.banner = el("banner");
    this.warn = el("warn");
    this.map = el("minimap").getContext("2d");
    this.bannerUntil = 0;
  }
  showBanner(text, now) {
    this.banner.textContent = text;
    this.banner.classList.remove("hidden");
    this.bannerUntil = now + 2.4;
  }
  update(plane, mission, score, elapsed, nextRing, now) {
    this.speed.textContent = String(plane.speedKt());
    this.heading.textContent = String(plane.headingDeg()).padStart(3, "0");
    this.alt.textContent = String(plane.altitudeFt());
    this.fuel.style.width = plane.fuel.toFixed(0) + "%";
    this.hull.style.width = plane.hull.toFixed(0) + "%";
    this.thr.style.width = (plane.throttle * 100).toFixed(0) + "%";
    this.missionTitle.textContent = mission.name;
    this.missionText.textContent = mission.text;
    const mins = Math.floor(elapsed / 60), secs = Math.floor(elapsed % 60);
    this.scoreLine.textContent = "SCORE " + score + " · " + mins + ":" + String(secs).padStart(2, "0");
    this.warn.classList.toggle("hidden", !plane.stalled);
    if (now > this.bannerUntil) this.banner.classList.add("hidden");
    this.drawMap(plane, nextRing);
  }
  drawMap(plane, nextRing) {
    const ctx = this.map, s = 150, half = WORLD.size / 2;
    const px = (x) => ((x + half) / WORLD.size) * s;
    const pz = (z) => s - ((z + half) / WORLD.size) * s;
    ctx.fillStyle = "#0a2e47";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#2e7d46";
    ctx.beginPath();
    ctx.ellipse(s / 2, s / 2, s * 0.36, s * 0.30, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e8e8e8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px(RUNWAY.x - Math.sin(RUNWAY.heading) * 150), pz(RUNWAY.z - Math.cos(RUNWAY.heading) * 150));
    ctx.lineTo(px(RUNWAY.x + Math.sin(RUNWAY.heading) * 150), pz(RUNWAY.z + Math.cos(RUNWAY.heading) * 150));
    ctx.stroke();
    RINGS.forEach((ring, i) => {
      ctx.fillStyle = i === nextRing ? "#ffd23c" : "#7ddcff";
      ctx.beginPath();
      ctx.arc(px(ring.x), pz(ring.z), 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#ff5a4e";
    ctx.beginPath();
    ctx.arc(px(plane.pos.x), pz(plane.pos.z), 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
