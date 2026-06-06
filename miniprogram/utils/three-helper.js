/**
 * 精简 3D 引擎（纯 WebGL Canvas，不依赖 three.js）
 * 功能：透视投影 + 简单渲染管线 + OrbitControls 逻辑
 */
class ThreeHelper {
  constructor(canvas, options = {}) {
    this.canvas  = canvas;
    this.gl      = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!this.gl) throw new Error('WebGL not supported');

    this.options = {
      fov:      60,
      near:     0.1,
      far:      1000,
      cameraY:  400,
      ...options,
    };

    this.objects   = [];
    this.rotX      = -Math.PI / 5;
    this.rotY      = Math.PI / 6;
    this.scale     = 1;
    this.centerX   = 0;
    this.centerY   = 0;
    this._lastX    = 0;
    this._lastY    = 0;
    this._dragging = false;

    this._initShaders();
    this._initGL();
    this._bindEvents();
    this.render();
  }

  /* ---------- WebGL 初始化 ---------- */

  _initShaders() {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, `
      attribute vec3 aPosition;
      attribute vec4 aColor;
      uniform mat4 uMVP;
      varying vec4 vColor;
      void main() {
        gl_Position = uMVP * vec4(aPosition, 1.0);
        vColor = aColor;
      }
    `);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, `
      precision mediump float;
      varying vec4 vColor;
      void main() {
        gl_FragColor = vColor;
      }
    `);
    gl.compileShader(fs);

    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    gl.useProgram(this.program);

    this.aPosition = gl.getAttribLocation(this.program, 'aPosition');
    this.aColor    = gl.getAttribLocation(this.program, 'aColor');
    this.uMVP      = gl.getUniformLocation(this.program, 'uMVP');
  }

  _initGL() {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.949, 0.953, 0.965, 1.0);
  }

  /* ---------- 矩阵运算 ---------- */

  _perspective(fov, aspect, near, far) {
    const f  = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0,                  0,
      0,          f, 0,                  0,
      0,          0, (far + near) * nf, -1,
      0,          0, 2 * far * near * nf, 0,
    ]);
  }

  _lookAt(eye, center, up) {
    const z = this._norm([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
    const x = this._norm(this._cross(up, z));
    const y = this._cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -this._dot(x, eye), -this._dot(y, eye), -this._dot(z, eye), 1,
    ]);
  }

  _multiply(a, b) {
    const out = new Float32Array(16);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        out[j * 4 + i] = 0;
        for (let k = 0; k < 4; k++)
          out[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
      }
    return out;
  }

  _norm(v) {
    const l = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/l, v[1]/l, v[2]/l];
  }

  _cross(a, b) {
    return [
      a[1]*b[2] - a[2]*b[1],
      a[2]*b[0] - a[0]*b[2],
      a[0]*b[1] - a[1]*b[0],
    ];
  }

  _dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

  _rotateX(m, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return this._multiply(m, new Float32Array([
      1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1,
    ]));
  }

  _rotateY(m, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return this._multiply(m, new Float32Array([
      c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1,
    ]));
  }

  /* ---------- 几何体 API ---------- */

  addBox(x, y, z, w, h, d, color) {
    const [r, g, b, a = 1] = this._parseColor(color);
    const hw = w/2, hh = h/2, hd = d/2;
    const verts = [
      /* 前面 */ -hw,-hh, hd, hw,-hh, hd, hw, hh, hd, -hw, hh, hd,
      /* 后面 */ hw,-hh,-hd, -hw,-hh,-hd, -hw,hh,-hd, hw,hh,-hd,
      /* 左面 */ -hw,-hh,-hd, -hw,-hh, hd, -hw,hh, hd, -hw,hh,-hd,
      /* 右面 */ hw,-hh, hd, hw,-hh,-hd, hw,hh,-hd, hw,hh, hd,
      /* 上面 */ -hw,hh, hd, hw,hh, hd, hw,hh,-hd, -hw,hh,-hd,
      /* 下面 */ -hw,-hh,-hd, hw,-hh,-hd, hw,-hh, hd, -hw,-hh, hd,
    ];
    const idx = [
      0,1,2,0,2,3, 4,5,6,4,6,7, 8,9,10,8,10,11,
      12,13,14,12,14,15, 16,17,18,16,18,19, 20,21,22,20,22,23,
    ];
    const colors = [];
    for (let i = 0; i < 24; i++) colors.push(r, g, b, a);
    const norm = [0,0,1, 0,0,-1, -1,0,0, 1,0,0, 0,1,0, 0,-1,0,
                  0,0,1, 0,0,-1, -1,0,0, 1,0,0, 0,1,0, 0,-1,0];
    const posAttr = new Float32Array(verts.map((v, i) => i % 3 === 1 ? v + y : v).map((v, i) => {
      if (i % 3 === 0) return v + x;
      if (i % 3 === 2) return v + z;
      return v;
    }));
    this.objects.push({ posAttr, norm: new Float32Array(norm), colors: new Float32Array(colors), idx: new Uint16Array(idx) });
  }

  /* ---------- 户型图渲染 ---------- */

  renderFloorplan(rooms, canvasW, canvasH) {
    this.objects = [];
    const scale = Math.min(canvasW, canvasH) * 0.8;
    const offsetX = canvasW / 2;
    const offsetY = canvasH / 0.4;
    const wallH = 80;

    rooms.forEach(room => {
      const color = room.color || '#4361ee';
      const pts = (room.walls || []).map(p => ({
        x: p.x * scale + offsetX,
        y: p.y * scale + offsetY,
      }));

      if (pts.length >= 3) {
        this._addFloorPolygon(pts, color, 0.15);
        this._addWallPolygon(pts, color, wallH);
        this._addDoorsAndWindows(room.doors || [], room.windows || [], pts, scale, offsetX, offsetY, wallH);
      } else {
        this.addBox(offsetX - 100, 0, offsetY - 100, 200, wallH, 200, color + '88');
      }
    });

    this.render();
  }

  _addFloorPolygon(pts, color, alpha) {
    const [r, g, b] = this._parseColor(color);
    const a = alpha || 0.3;
    const verts = [0, 0, 0]; // center (vertex 0)
    const idx = [];
    for (let i = 0; i < pts.length; i++) {
      verts.push(pts[i].x, 0, pts[i].y);
      idx.push(0, i + 1, ((i + 1) % pts.length) + 1);
    }
    const colorArray = [];
    for (let i = 0; i < pts.length + 1; i++) colorArray.push(r, g, b, a);
    this.objects.push({
      posAttr: new Float32Array(verts),
      colors: new Float32Array(colorArray),
      idx: new Uint16Array(idx),
      is3D: false,
    });
  }

  _addWallPolygon(pts, color, height) {
    const [r, g, b] = this._parseColor(color);
    const verts = [], idx = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
      const base = verts.length / 3;
      verts.push(p1.x, 0, p1.y, p2.x, 0, p2.y, p2.x, height, p2.y, p1.x, height, p1.y);
      idx.push(base, base+1, base+2, base, base+2, base+3);
    }
    this.objects.push({
      posAttr: new Float32Array(verts),
      colors: new Float32Array(Array(verts.length / 3).fill([r*0.6, g*0.6, b*0.6, 0.7]).flat()),
      idx: new Uint16Array(idx),
      is3D: true,
    });
  }

  _addDoorsAndWindows(doors, windows, pts, scale, ox, oy, wallH) {
    windows.forEach(wn => {
      const x = wn.x * scale + ox, z = wn.y * scale + oy;
      this.addBox(x, wallH * 0.3, z, 40, wallH * 0.4, 5, '#ffffff');
    });
    doors.forEach(d => {
      const x = d.x * scale + ox, z = d.y * scale + oy;
      this.addBox(x, wallH * 0.1, z, 30, wallH * 0.2, 5, '#ffd166');
    });
  }

  /* ---------- 渲染循环 ---------- */

  render() {
    const gl  = this.gl;
    const w   = this.canvas.width;
    const h   = this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const proj = this._perspective(
      this.options.fov * Math.PI / 180,
      w / h,
      this.options.near,
      this.options.far,
    );

    const eye   = [this.options.cameraX, this.options.cameraY, 500];
    const view  = this._lookAt(eye, [this.centerX, 0, this.centerY], [0, 1, 0]);
    let mat = this._multiply(proj, view);
    mat = this._rotateX(mat, this.rotX);
    mat = this._rotateY(mat, this.rotY);

    gl.uniformMatrix4fv(this.uMVP, false, mat);

    this.objects.forEach(obj => {
      const posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, obj.posAttr, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(this.aPosition);
      gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);

      const colBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
      gl.bufferData(gl.ARRAY_BUFFER, obj.colors, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(this.aColor);
      gl.vertexAttribPointer(this.aColor, 4, gl.FLOAT, false, 0, 0);

      const idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, obj.idx, gl.STATIC_DRAW);
      gl.drawElements(gl.TRIANGLES, obj.idx.length, gl.UNSIGNED_SHORT, 0);
    });
  }

  /* ---------- 交互 ---------- */

  _bindEvents() {
    const el = this.canvas;
    el.addEventListener('touchstart', e => {
      this._dragging = true;
      this._lastX = e.touches[0].clientX;
      this._lastY = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!this._dragging) return;
      const dx = e.touches[0].clientX - this._lastX;
      const dy = e.touches[0].clientY - this._lastY;
      this.rotY += dx * 0.01;
      this.rotX += dy * 0.01;
      this._lastX = e.touches[0].clientX;
      this._lastY = e.touches[0].clientY;
      this.render();
    }, { passive: true });
    el.addEventListener('touchend', () => { this._dragging = false; });
    el.addEventListener('mousedown', e => {
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
    el.addEventListener('mousemove', e => {
      if (!this._dragging) return;
      this.rotY += (e.clientX - this._lastX) * 0.01;
      this.rotX += (e.clientY - this._lastY) * 0.01;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this.render();
    });
    el.addEventListener('mouseup', () => { this._dragging = false; });
    el.addEventListener('wheel', e => {
      e.preventDefault();
      this.scale *= e.deltaY > 0 ? 0.95 : 1.05;
      this.options.cameraY /= e.deltaY > 0 ? 0.95 : 1.05;
      this.render();
    });
  }

  resetCamera() {
    this.rotX = -Math.PI / 5;
    this.rotY = Math.PI / 6;
    this.scale = 1;
    this.options.cameraY = 400;
    this.render();
  }

  dispose() {
    this.objects = [];
    this.gl = null;
  }

  _parseColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
  }
}

module.exports = ThreeHelper;
