// Keyboard and mouse flight controls: W/S throttle, mouse or arrows for
// pitch and roll, A/D rudder, Space brake, C camera, R restart.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.cameraPressed = false;
    this.restartPressed = false;
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "KeyC") this.cameraPressed = true;
      if (e.code === "KeyR") this.restartPressed = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    canvas.addEventListener("mousemove", (e) => {
      this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }
  read() {
    const k = this.keys;
    let pitch = 0, roll = 0, yaw = 0, throttle = 0;
    if (k.has("KeyW") || k.has("ShiftLeft")) throttle += 1;
    if (k.has("KeyS") || k.has("ControlLeft")) throttle -= 1;
    if (k.has("ArrowUp")) pitch += 1;
    if (k.has("ArrowDown")) pitch -= 1;
    if (k.has("ArrowLeft")) roll += 1;
    if (k.has("ArrowRight")) roll -= 1;
    if (k.has("KeyA")) yaw += 1;
    if (k.has("KeyD")) yaw -= 1;
    if (Math.abs(this.mouseX) > 0.06) roll += -this.mouseX * 0.9;
    if (Math.abs(this.mouseY) > 0.06) pitch += -this.mouseY * 0.8;
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      yaw,
      throttle,
      brake: k.has("Space"),
    };
  }
  takeCamera() { const v = this.cameraPressed; this.cameraPressed = false; return v; }
  takeRestart() { const v = this.restartPressed; this.restartPressed = false; return v; }
}
