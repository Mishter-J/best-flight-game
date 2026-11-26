// WebGL2 renderer: one lit vertex-colour shader with distance fog,
// chase and cockpit cameras, and the sun-warm Aurelia sky.
const VERT = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aCol;
uniform mat4 uMVP;
uniform mat4 uModel;
out vec3 vCol;
out float vFog;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vec4 clip = uMVP * vec4(aPos, 1.0);
  gl_Position = clip;
  vCol = aCol;
  vFog = clamp(clip.w / 1600.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec3 vCol;
in float vFog;
out vec4 outCol;
void main() {
  vec3 fogCol = vec3(0.62, 0.78, 0.90);
  outCol = vec4(mix(vCol, fogCol, vFog * 0.85), 1.0);
}`;

function mat4Identity() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
function mat4Mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (near - far); o[11] = -1;
  o[14] = (2 * far * near) / (near - far);
  return o;
}
function mat4LookAt(eye, target, up) {
  const zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  const zl = Math.hypot(zx, zy, zz) || 1;
  const z = [zx / zl, zy / zl, zz / zl];
  const xl = Math.hypot(up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]) || 1;
  const x = [(up[1] * z[2] - up[2] * z[1]) / xl, (up[2] * z[0] - up[0] * z[2]) / xl, (up[0] * z[1] - up[1] * z[0]) / xl];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return new Float32Array([
    x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1,
  ]);
}
function mat4Translate(x, y, z) {
  const o = mat4Identity(); o[12] = x; o[13] = y; o[14] = z; return o;
}
function mat4RotY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
}
function mat4RotX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
}
function mat4RotZ(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]);
}

export class Renderer {
  constructor(canvas) {
    this.gl = canvas.getContext("webgl2", { antialias: true, preserveDrawingBuffer: true });
    if (!this.gl) throw new Error("WebGL2 unavailable");
    const gl = this.gl;
    const vs = this.compile(gl.VERTEX_SHADER, VERT);
    const fs = this.compile(gl.FRAGMENT_SHADER, FRAG);
    this.prog = gl.createProgram();
    gl.attachShader(this.prog, vs);
    gl.attachShader(this.prog, fs);
    gl.linkProgram(this.prog);
    this.uMVP = gl.getUniformLocation(this.prog, "uMVP");
    this.uModel = gl.getUniformLocation(this.prog, "uModel");
    gl.enable(gl.DEPTH_TEST);
    this.meshes = new Map();
  }
  compile(type, src) {
    const gl = this.gl;
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }
  upload(name, mesh) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const pb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const cb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.colours, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    this.meshes.set(name, { vao, count: mesh.indices.length });
  }
  draw(name, vp, model) {
    const gl = this.gl;
    const m = this.meshes.get(name);
    if (!m) return;
    gl.uniformMatrix4fv(this.uModel, false, model);
    gl.uniformMatrix4fv(this.uMVP, false, mat4Mul(vp, model));
    gl.bindVertexArray(m.vao);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
  }
  frame(plane, cameraMode) {
    const gl = this.gl;
    const canvas = gl.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.55, 0.74, 0.90, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    const aspect = canvas.width / Math.max(1, canvas.height);
    const proj = mat4Perspective(1.15, aspect, 0.5, 4200);
    const fx = Math.sin(plane.yaw), fz = Math.cos(plane.yaw);
    let eye, target, up = [0, 1, 0];
    if (cameraMode === "cockpit") {
      eye = [plane.pos.x - fx * 0.4, plane.pos.y + 1.7, plane.pos.z - fz * 0.4];
      target = [plane.pos.x + fx * 60, plane.pos.y + 1.2 + Math.sin(plane.pitch) * 40, plane.pos.z + fz * 60];
      up = [Math.sin(plane.roll) * -1, Math.cos(plane.roll), 0];
    } else {
      eye = [plane.pos.x - fx * 17, plane.pos.y + 5.5, plane.pos.z - fz * 17];
      target = [plane.pos.x + fx * 26, plane.pos.y + 1.5, plane.pos.z + fz * 26];
    }
    const vp = mat4Mul(proj, mat4LookAt(eye, target, up));
    const ident = mat4Identity();
    this.draw("sea", vp, ident);
    this.draw("terrain", vp, ident);
    this.draw("runway", vp, ident);
    this.draw("rings", vp, ident);
    if (cameraMode !== "cockpit") {
      let model = mat4Translate(plane.pos.x, plane.pos.y, plane.pos.z);
      model = mat4Mul(model, mat4RotY(plane.yaw + Math.PI));
      model = mat4Mul(model, mat4RotX(plane.pitch));
      model = mat4Mul(model, mat4RotZ(plane.roll));
      this.draw("aircraft", vp, model);
    } else {
      // Cockpit coaming: nose + wing roots stay in frame so instruments read as flown.
      let model = mat4Translate(plane.pos.x, plane.pos.y - 0.85, plane.pos.z);
      model = mat4Mul(model, mat4RotY(plane.yaw + Math.PI));
      model = mat4Mul(model, mat4RotX(plane.pitch));
      model = mat4Mul(model, mat4RotZ(plane.roll));
      this.draw("aircraft", vp, model);
    }
  }
}
