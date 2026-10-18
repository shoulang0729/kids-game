/* Self-contained WebGL 3D renderer. No network assets. */
window.createClawScene = function (canvas) {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) throw Error("3D表示にはWebGLが必要です。Safariなど別のブラウザで開いてね。");
  const vs = `attribute vec3 p;attribute vec3 n;uniform mat4 model,vp;uniform mat3 normal;varying vec3 N,W,L;void main(){vec4 w=model*vec4(p,1.);W=w.xyz;L=p;N=normalize(normal*n);gl_Position=vp*w;}`;
  const fs = `precision highp float;varying vec3 N,W,L;uniform vec4 color;uniform vec3 eye;uniform float material;uniform float textured;uniform sampler2D decal;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
void main(){vec3 nn=normalize(N),v=normalize(eye-W);vec3 l=normalize(vec3(-3.,7.,6.)-W),l2=normalize(vec3(4.,5.,-2.)-W);float d=max(dot(nn,l),0.),d2=max(dot(nn,l2),0.);float h=max(dot(nn,normalize(l+v)),0.);vec3 base=color.rgb;float rough=.42;if(material>1.5&&material<2.5){float fibers=hash(floor(L*82.));float weave=sin(L.x*330.)*sin(L.y*330.);base*=.91+fibers*.13+weave*.025;rough=.88;if(max(base.r,max(base.g,base.b))<.28)rough=.13;}if(textured>.5){vec4 t=texture2D(decal,L.xy*.5+.5);base=t.rgb;}
vec3 rgb=base*(.35+.52*d+.19*d2)+vec3(.15)*pow(h,mix(110.,9.,rough));
if(material>.5&&material<1.5){vec3 r=reflect(-v,nn);float strip=pow(max(0.,1.-abs(r.y-.7)*4.),7.);float strip2=pow(max(0.,1.-abs(r.x+.35)*8.),8.);vec3 env=mix(vec3(.12,.17,.23),vec3(.84,.90,.93),smoothstep(-.2,.8,r.y));rgb=mix(rgb,base*env*.75,.6)+vec3(.8,.9,1.)*strip*.65+vec3(1.,.93,.85)*strip2*.45+vec3(.6)*pow(h,120.);}
if(material>2.5&&material<3.5)rgb=base*1.06;if(material>4.5){vec2 tile=fract(W.xz*.5);float grout=step(.018,tile.x)*step(.018,tile.y);float checker=mod(floor(W.x*.5)+floor(W.z*.5),2.);rgb=base*(.85+checker*.13)*(.7+.3*d)*(.75+.25*grout)+vec3(.12,.16,.18)*pow(h,95.);}float rim=pow(1.-max(dot(nn,v),0.),4.);rgb+=vec3(.045,.065,.08)*rim;float fog=clamp((length(eye-W)-10.)/40.,0.,.22);gl_FragColor=vec4(mix(rgb,vec3(.045,.06,.11),fog),color.a);}`;
  function shader(type, s) {
    const x = gl.createShader(type);
    gl.shaderSource(x, s);
    gl.compileShader(x);
    if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(x));
    return x;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const loc = {};
  for (const n of ["model", "vp", "normal", "color", "eye", "material", "textured", "decal"])
    loc[n] = gl.getUniformLocation(prog, n);
  const pa = gl.getAttribLocation(prog, "p"),
    na = gl.getAttribLocation(prog, "n");
  gl.enableVertexAttribArray(pa);
  gl.enableVertexAttribArray(na);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const white = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, white);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255, 255]),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function mul(a, b) {
    let o = Array(16).fill(0);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return o;
  }
  const sub = (a, b) => a.map((v, i) => v - b[i]),
    dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    norm = (a) => {
      let l = Math.hypot(...a);
      return a.map((x) => x / l);
    };
  function view(e, t) {
    let z = norm(sub(e, t)),
      x = norm(cross([0, 1, 0], z)),
      y = cross(z, x);
    return [
      x[0],
      y[0],
      z[0],
      0,
      x[1],
      y[1],
      z[1],
      0,
      x[2],
      y[2],
      z[2],
      0,
      -dot(x, e),
      -dot(y, e),
      -dot(z, e),
      1,
    ];
  }
  function perspective(aspect) {
    let f = 1 / Math.tan(1.02 / 2),
      n = 0.1,
      far = 80;
    return [
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (far + n) / (n - far),
      -1,
      0,
      0,
      (2 * far * n) / (n - far),
      0,
    ];
  }
  function mesh(data) {
    let b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { b, count: data.length / 6 };
  }
  let s = [];
  function vertex(a, n) {
    s.push(...a, ...n);
  }
  function tri(a, b, c, normal) {
    for (let p of [a, b, c]) vertex(p, normal || p);
  }
  for (let j = 0; j < 16; j++)
    for (let i = 0; i < 24; i++) {
      let pt = (a, b) => [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)],
        a = (j * Math.PI) / 16,
        b = (i * Math.PI * 2) / 24,
        c = ((j + 1) * Math.PI) / 16,
        d = ((i + 1) * Math.PI * 2) / 24;
      tri(pt(a, b), pt(c, b), pt(c, d));
      tri(pt(a, b), pt(c, d), pt(a, d));
    }
  const sphere = mesh(s);
  s = [];
  for (let axis = 0; axis < 3; axis++)
    for (let sign of [-1, 1]) {
      let a = (axis + 1) % 3,
        b = (axis + 2) % 3,
        pts = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map((p) => {
          let v = [0, 0, 0];
          v[axis] = sign;
          v[a] = p[0];
          v[b] = p[1];
          return v;
        }),
        nn = [0, 0, 0];
      nn[axis] = sign;
      tri(pts[0], pts[1], pts[2], nn);
      tri(pts[0], pts[2], pts[3], nn);
    }
  const cube = mesh(s);
  s = [];
  for (let i = 0; i < 24; i++) {
    let a = (i * Math.PI) / 12,
      b = ((i + 1) * Math.PI) / 12,
      p = [Math.cos(a), -1, Math.sin(a)],
      q = [Math.cos(b), -1, Math.sin(b)],
      r = [q[0], 1, q[2]],
      t = [p[0], 1, p[2]];
    for (let v of [p, q, r, p, r, t]) vertex(v, [v[0], 0, v[2]]);
    tri([0, 1, 0], t, r, [0, 1, 0]);
    tri([0, -1, 0], q, p, [0, -1, 0]);
  }
  const cylinder = mesh(s);
  s = [];
  const top = [0, 1, 0],
    bottom = [0, -1, 0];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3,
      b = ((i + 1) * Math.PI) / 3,
      p = [Math.cos(a) * 0.65, 0, Math.sin(a) * 0.65],
      q = [Math.cos(b) * 0.65, 0, Math.sin(b) * 0.65];
    tri(top, p, q, norm(cross(sub(p, top), sub(q, top))));
    tri(bottom, q, p, norm(cross(sub(q, bottom), sub(p, bottom))));
  }
  const crystalMesh = mesh(s);
  const palette = [
    "#bd865b",
    "#e4a7be",
    "#74b997",
    "#d8ad5e",
    "#5c7da7",
    "#d584ab",
    "#bd9976",
    "#ba9bd3",
    "#eeeeeb",
    "#d69053",
    "#87bf6c",
    "#a8adba",
    "#d7b270",
    "#e8a6b8",
    "#9aafc4",
    "#a4c787",
    "#f1d479",
    "#7f9fb8",
    "#7ba798",
    "#9b9fa7",
  ];
  let material = 0,
    machineX = 0;
  function color(c, a = 1) {
    return [...[1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255), a];
  }
  function shape(mesh, x, y, z, sx, sy, sz, c, alpha = 1, rot = 0) {
    gl.uniform1f(loc.material, mesh === crystalMesh ? 1 : material);
    x += machineX;
    let co = Math.cos(rot),
      si = Math.sin(rot);
    let m = [co * sx, 0, -si * sx, 0, 0, sy, 0, 0, si * sz, 0, co * sz, 0, x, y, z, 1];
    gl.uniformMatrix4fv(loc.model, false, m);
    gl.uniformMatrix3fv(loc.normal, false, [
      co / sx,
      0,
      -si / sx,
      0,
      0,
      1 / sy,
      0,
      si / sz,
      0,
      co / sz,
    ]);
    gl.uniform4fv(loc.color, color(c, alpha));
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.b);
    gl.vertexAttribPointer(pa, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(na, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }
  const ball = (x, y, z, a, b, c, col, al = 1) => shape(sphere, x, y, z, a, b, c, col, al),
    box = (x, y, z, a, b, c, col, al = 1) => shape(cube, x, y, z, a, b, c, col, al),
    disc = (x, y, z, r, col, al) => shape(cylinder, x, y, z, r, 0.005, r, col, al);
  function bar(a, b, r, col) {
    gl.uniform1f(loc.material, 1);
    let y = norm(sub(b, a)),
      x = norm(cross(Math.abs(y[0]) > 0.9 ? [0, 0, 1] : [1, 0, 0], y)),
      z = cross(x, y),
      h = Math.hypot(...sub(b, a)) / 2,
      m = [
        ...x.map((v) => v * r),
        0,
        ...y.map((v) => v * h),
        0,
        ...z.map((v) => v * r),
        0,
        ...a.map((v, i) => (v + b[i]) / 2 + (i === 0 ? machineX : 0)),
        1,
      ];
    gl.uniformMatrix4fv(loc.model, false, m);
    gl.uniformMatrix3fv(loc.normal, false, [
      ...x.map((v) => v / r),
      ...y.map((v) => v / h),
      ...z.map((v) => v / r),
    ]);
    gl.uniform4fv(loc.color, color(col));
    gl.bindBuffer(gl.ARRAY_BUFFER, cylinder.b);
    gl.vertexAttribPointer(pa, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(na, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.TRIANGLES, 0, cylinder.count);
  }
  function plush(kind, x, y, z, rot = 0, tilt = 0, size = 1) {
    material = 2;
    let col = palette[kind];
    let parts = [];
    const p = (a, b, c, d, e, f, g) => parts.push([a, b, c, d, e, f, g]);
    p(0, 0.29, 0, 0.26, 0.31, 0.23, col);
    p(0, 0.66, 0.015, 0.29, 0.25, 0.25, col);
    p(0, 0.23, 0.19, 0.17, 0.19, 0.06, "#eadbd1");
    p(-0.19, 0.07, 0.16, 0.14, 0.1, 0.17, col);
    p(0.19, 0.07, 0.16, 0.14, 0.1, 0.17, col);
    p(-0.29, 0.34, 0, 0.12, 0.18, 0.12, col);
    p(0.29, 0.34, 0, 0.12, 0.18, 0.12, col);
    if (kind === 8) {
      p(-0.22, 0.85, 0, 0.13, 0.14, 0.1, "#303744");
      p(0.22, 0.85, 0, 0.13, 0.14, 0.1, "#303744");
      p(-0.11, 0.69, 0.235, 0.09, 0.1, 0.035, "#343746");
      p(0.11, 0.69, 0.235, 0.09, 0.1, 0.035, "#343746");
      p(-0.3, 0.34, 0, 0.12, 0.18, 0.12, "#343746");
      p(0.3, 0.34, 0, 0.12, 0.18, 0.12, "#343746");
    } else if (kind === 9) {
      p(-0.21, 0.92, 0, 0.1, 0.21, 0.09, col);
      p(0.21, 0.92, 0, 0.1, 0.21, 0.09, col);
      p(0, 0.58, 0.25, 0.19, 0.1, 0.13, "#f1e5d4");
      p(0, 0.18, -0.3, 0.16, 0.13, 0.3, col);
      p(0, 0.18, -0.53, 0.12, 0.1, 0.12, "#f2e5dc");
    } else if (kind === 10) {
      p(-0.18, 0.85, 0.08, 0.13, 0.12, 0.12, col);
      p(0.18, 0.85, 0.08, 0.13, 0.12, 0.12, col);
      p(-0.18, 0.86, 0.18, 0.065, 0.07, 0.035, "#edf0d7");
      p(0.18, 0.86, 0.18, 0.065, 0.07, 0.035, "#edf0d7");
      p(-0.19, 0.86, 0.21, 0.03, 0.04, 0.02, "#273642");
      p(0.19, 0.86, 0.21, 0.03, 0.04, 0.02, "#273642");
    } else if (kind === 11) {
      p(-0.29, 0.78, 0, 0.21, 0.22, 0.14, col);
      p(0.29, 0.78, 0, 0.21, 0.22, 0.14, col);
      p(-0.29, 0.78, 0.09, 0.13, 0.14, 0.08, "#ded3d2");
      p(0.29, 0.78, 0.09, 0.13, 0.14, 0.08, "#ded3d2");
      p(0, 0.62, 0.27, 0.08, 0.13, 0.06, "#364250");
    } else if (kind === 12) {
      for (let i = 0; i < 10; i++) {
        let a = (i * Math.PI) / 5;
        p(Math.cos(a) * 0.29, 0.66 + Math.sin(a) * 0.25, -0.02, 0.12, 0.12, 0.12, "#a2754e");
      }
      p(0, 0.6, 0.23, 0.18, 0.12, 0.08, "#f1dcc2");
    } else if (kind === 13) {
      p(-0.21, 0.88, 0, 0.12, 0.16, 0.08, col);
      p(0.21, 0.88, 0, 0.12, 0.16, 0.08, col);
      p(0, 0.59, 0.28, 0.15, 0.09, 0.06, "#c97f9e");
      p(-0.05, 0.59, 0.337, 0.023, 0.026, 0.01, "#87596e");
      p(0.05, 0.59, 0.337, 0.023, 0.026, 0.01, "#87596e");
    } else if (kind === 14) {
      p(0, 0.96, 0, 0.03, 0.17, 0.03, "#8da3b6");
      p(0, 1.12, 0, 0.07, 0.07, 0.07, "#d97c91");
      p(-0.32, 0.69, 0, 0.07, 0.12, 0.12, "#647f9b");
      p(0.32, 0.69, 0, 0.07, 0.12, 0.12, "#647f9b");
      p(0, 0.69, 0.23, 0.23, 0.14, 0.055, "#45687d");
      p(0, 0.3, 0.22, 0.1, 0.11, 0.025, "#94dbc9");
    } else if (kind === 15) {
      p(-0.15, 0.99, 0, 0.035, 0.2, 0.035, col);
      p(0.15, 0.99, 0, 0.035, 0.2, 0.035, col);
      p(-0.15, 1.17, 0, 0.07, 0.07, 0.07, "#b0dab0");
      p(0.15, 1.17, 0, 0.07, 0.07, 0.07, "#b0dab0");
      p(-0.12, 0.7, 0.23, 0.065, 0.09, 0.03, "#294145");
      p(0.12, 0.7, 0.23, 0.065, 0.09, 0.03, "#294145");
    } else if (kind === 16) {
      p(0, 0.59, 0.28, 0.12, 0.06, 0.09, "#dc9d51");
      p(-0.25, 0.32, 0.02, 0.17, 0.13, 0.12, "#e9c06b");
      p(0.25, 0.32, 0.02, 0.17, 0.13, 0.12, "#e9c06b");
      p(0, 0.92, 0, 0.035, 0.14, 0.035, "#e3bd66");
    } else if (kind === 17) {
      p(0, 0.38, -0.26, 0.07, 0.25, 0.16, "#5d829f");
      p(0, 0.6, 0.26, 0.23, 0.12, 0.14, "#cfdce0");
      p(-0.37, 0.29, 0, 0.2, 0.07, 0.13, col);
      p(0.37, 0.29, 0, 0.2, 0.07, 0.13, col);
      p(0, 0.15, -0.41, 0.17, 0.07, 0.22, col);
    } else if (kind === 18) {
      p(-0.19, 0.93, -0.03, 0.06, 0.2, 0.06, "#e4cf9d");
      p(0.19, 0.93, -0.03, 0.06, 0.2, 0.06, "#e4cf9d");
      p(-0.35, 0.45, -0.1, 0.22, 0.2, 0.07, "#9cabc8");
      p(0.35, 0.45, -0.1, 0.22, 0.2, 0.07, "#9cabc8");
      p(0, 0.15, -0.35, 0.13, 0.1, 0.27, col);
      p(0, 0.6, 0.23, 0.22, 0.12, 0.12, col);
    } else if (kind === 19) {
      p(-0.22, 0.87, 0, 0.13, 0.14, 0.09, col);
      p(0.22, 0.87, 0, 0.13, 0.14, 0.09, col);
      p(-0.13, 0.69, 0.23, 0.13, 0.09, 0.045, "#424952");
      p(0.13, 0.69, 0.23, 0.13, 0.09, 0.045, "#424952");
      for (let i = 0; i < 4; i++)
        p(0, 0.18, -0.25 - i * 0.1, 0.12, 0.1, 0.07, i % 2 ? "#4b525d" : "#a7acb4");
    } else if (kind === 1) {
      p(-0.14, 1.02, 0, 0.095, 0.3, 0.09, col);
      p(0.14, 1.02, 0, 0.095, 0.3, 0.09, col);
      p(-0.14, 1.03, 0.075, 0.045, 0.21, 0.025, "#bd739b");
      p(0.14, 1.03, 0.075, 0.045, 0.21, 0.025, "#bd739b");
    } else if (kind === 2) {
      p(0, 0.6, 0.22, 0.23, 0.13, 0.18, col);
      for (let i = 0; i < 4; i++) p(0, 0.35 + i * 0.13, -0.23, 0.08, 0.1, 0.09, "#e6c775");
      p(0, 0.14, -0.32, 0.12, 0.1, 0.27, col);
    } else if (kind === 4) {
      p(0, 0.55, 0.21, 0.22, 0.27, 0.07, "#eeeeeb");
      p(0, 0.59, 0.3, 0.1, 0.055, 0.09, "#edbb5b");
    } else if (kind === 5) {
      for (let i = 0; i < 6; i++) {
        let a = (i * Math.PI) / 3;
        p(Math.cos(a) * 0.27, 0.08, Math.sin(a) * 0.27, 0.13, 0.11, 0.13, col);
      }
    } else {
      p(-0.22, 0.85, 0, 0.12, kind === 6 ? 0.23 : 0.13, 0.09, col);
      p(0.22, 0.85, 0, 0.12, kind === 6 ? 0.23 : 0.13, 0.09, col);
      if (kind === 7) {
        p(0, 0.96, 0.09, 0.06, 0.2, 0.06, "#ffe0a2");
        p(0, 0.73, -0.2, 0.23, 0.18, 0.13, "#d1bcf5");
      }
    }
    p(-0.105, 0.69, 0.235, 0.037, 0.044, 0.028, "#172235");
    p(0.105, 0.69, 0.235, 0.037, 0.044, 0.028, "#172235");
    p(-0.116, 0.705, 0.257, 0.012, 0.014, 0.009, "#ffffff");
    p(0.094, 0.705, 0.257, 0.012, 0.014, 0.009, "#ffffff");
    if (kind !== 4) p(0, 0.59, 0.27, 0.05, 0.036, 0.035, kind === 1 ? "#c46694" : "#423440");
    p(0.21, 0.18, -0.19, 0.045, 0.075, 0.008, "#eee6d8");
    for (let a of parts) {
      let [px, py, pz, sx, sy, sz, c] = a,
        co = Math.cos(rot),
        si = Math.sin(rot);
      let lx = px * Math.cos(tilt) - py * Math.sin(tilt),
        ly = px * Math.sin(tilt) + py * Math.cos(tilt);
      ball(
        x + (lx * co + pz * si) * size,
        y + ly * size,
        z + (-lx * si + pz * co) * size,
        sx * size,
        sy * size,
        sz * size,
        c,
      );
    }
    material = 0;
  }
  s = [];
  tri([-1, -1, 0], [1, -1, 0], [1, 1, 0], [0, 0, 1]);
  tri([-1, -1, 0], [1, 1, 0], [-1, 1, 0], [0, 0, 1]);
  const quad = mesh(s),
    labels = new Map();
  function label(text, x, y, z, sx, sy, fg = "#354756", bg = "#dce4e5") {
    let key = text + fg + bg;
    if (!labels.has(key)) {
      if (labels.size >= 96) {
        const oldest = labels.keys().next().value;
        gl.deleteTexture(labels.get(oldest));
        labels.delete(oldest);
      }
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 64;
      const c2 = c.getContext("2d");
      c2.fillStyle = bg;
      c2.fillRect(0, 0, 512, 64);
      c2.fillStyle = fg;
      c2.font = "bold 32px system-ui,sans-serif";
      c2.textAlign = "center";
      c2.textBaseline = "middle";
      c2.fillText(text, 256, 34, 490);
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      labels.set(key, t);
    }
    gl.bindTexture(gl.TEXTURE_2D, labels.get(key));
    gl.uniform1i(loc.decal, 0);
    gl.uniform1f(loc.textured, 1);
    material = 0;
    shape(quad, x, y, z, sx, sy, 1, "#ffffff");
    gl.uniform1f(loc.textured, 0);
  }
  const player = { x: 0, z: 11.5, yaw: 0, pitch: -0.06 };
  let currentVP = null;
  function look(dx, dy) {
    player.yaw += dx;
    player.pitch = Math.max(-1.15, Math.min(1.12, player.pitch + dy));
  }
  function reset() {
    Object.assign(player, { x: 0, z: 11.5, yaw: 0, pitch: -0.06 });
  }
  function solid(x, z) {
    if (z < -5 || z > 14) return true;
    const c = -20 + Math.round((x + 20) / 8) * 8;
    return x > c - 3.45 && x < c + 3.45 && z > -1.95 && z < 2.82;
  }
  function walk(x, z, dt, dash = false) {
    let len = Math.max(1, Math.hypot(x, z));
    x /= len;
    z /= len;
    let dx = (x * Math.cos(player.yaw) + z * Math.sin(player.yaw)) * (dash ? 6.3 : 3.0) * dt,
      dz = (x * Math.sin(player.yaw) - z * Math.cos(player.yaw)) * (dash ? 6.3 : 3.0) * dt;
    if (!solid(player.x + dx, player.z)) player.x += dx;
    if (!solid(player.x, player.z + dz)) player.z += dz;
  }
  function distance(x) {
    return Math.hypot(player.x - x, player.z - 1.8);
  }
  function project(p) {
    if (!currentVP) return null;
    let out = Array(4).fill(0),
      v = [...p, 1];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[r] += currentVP[k * 4 + r] * v[k];
    if (out[3] < 0.1) return null;
    let x = out[0] / out[3],
      y = out[1] / out[3];
    if (Math.abs(x) > 1.05 || Math.abs(y) > 1.05) return null;
    return { x: (x * 0.5 + 0.5) * canvas.clientWidth, y: (0.5 - y * 0.5) * canvas.clientHeight };
  }
  const clampValue = (v, a, b) => Math.max(a, Math.min(b, v));
  const wx = (x) => (x - 325) / 100,
    wz = (y) => (y - 330) / 100;
  function drawMachine(data) {
    material = 0;
    machineX = data.offset;
    box(0, -0.55, 0, 3.12, 0.5, 1.65, "#d0d6d9");
    box(0, -0.27, 1.69, 3.1, 0.28, 0.09, "#e1dfdf");
    box(0, -0.18, 1.8, 2.8, 0.022, 0.025, data.color);
    // Bed split leaves a physical opening for delivered prizes.
    box(0.66, -0.025, 0, 2.32, 0.1, 1.48, "#d6b6c1");
    box(-2.3, -0.025, -0.65, 0.62, 0.1, 0.81, "#d6b6c1");
    box(-2.3, -0.025, 1.27, 0.62, 0.1, 0.21, "#d6b6c1");
    box(-2.3, -0.025, 0.65, 0.58, 0.04, 0.52, "#121a2d");
    box(-2.3, -0.47, 1.8, 0.59, 0.3, 0.025, "#161b2f");
    box(-2.3, -0.78, 1.91, 0.6, 0.035, 0.19, "#d7d7df");
    box(-2.3, -0.82, 1.8, 0.64, 0.025, 0.025, "#90e9db");
    if (data.type === "moving") {
      material = 1;
      for (let i = 0; i < 14; i++) {
        let x = -1.4 + i * 0.29;
        bar([x, 0.085, -1.35], [x, 0.085, 1.35], 0.045, "#a1b4c1");
      }
      material = 3;
      const bx = -1.4 + ((data.clock * 0.4) % 3.7);
      box(bx, 0.14, 1.41, 0.14, 0.025, 0.04, "#def5b2");
      material = 0;
    }
    if (data.type === "slippery") {
      material = 1;
      box(0.65, 0.085, 0, 2.28, 0.008, 1.4, "#a1b3c8");
      material = 0;
    }
    material = 1;
    for (let x of [-3, 3])
      for (let z of [-1.55, 1.55]) {
        box(x, 2, z, 0.07, 2.05, 0.07, "#bac5d2");
        box(x + (x < 0 ? 0.083 : -0.083), 2, z, 0.017, 1.96, 0.025, "#b8f4ea");
      }
    box(0, 4.12, 0, 3.13, 0.19, 1.68, "#c6d2d8");
    box(0, 4.12, 1.71, 3.12, 0.19, 0.07, "#e3e7e9");
    box(0, 4.1, 1.79, 2.68, 0.1, 0.018, "#ebe5eb");
    for (let i = 0; i < 11; i++)
      ball(-2.6 + i * 0.52, 4.13, 1.83, 0.035, 0.035, 0.025, i % 2 ? "#ffe0a1" : "#9df0e0");
    for (let z of [-1.4, 1.4]) bar([-2.9, 3.86, z], [2.9, 3.86, z], 0.035, "#d9e1e5");
    let cx = wx(data.claw.x),
      cz = wz(data.claw.y),
      cy = 3.35 - data.claw.z * 2.4;
    bar([cx, 3.8, -1.4], [cx, 3.8, 1.4], 0.05, "#cad6df");
    box(cx, 3.78, cz, 0.24, 0.1, 0.19, "#c0c9d4");
    bar([cx, 3.72, cz], [cx, cy + 0.17, cz], 0.023, "#344052");
    for (let j = 0; j < 7; j++) {
      let y = cy + 0.3 + (j * (3.45 - cy)) / 7;
      shape(cylinder, cx, y, cz, 0.045, 0.012, 0.045, "#94a2b3");
    }
    ball(cx, 0.09, cz, 0.36, 0.008, 0.29, "#384254", 0.18);
    if (data.aimHelp && ["idle", "aim"].includes(data.state)) {
      for (let i = 0; i < 28; i++) {
        let a = (i * Math.PI) / 14;
        ball(
          cx + Math.cos(a) * 0.34,
          0.095,
          cz + Math.sin(a) * 0.34,
          0.025,
          0.008,
          0.025,
          "#87e8cf",
        );
      }
    }
    for (const p of data.prizes) {
      disc(wx(p.x), 0.087, wz(p.y), 0.4, "#5a4657", 0.045);
      disc(wx(p.x), 0.091, wz(p.y), 0.3, "#493646", 0.08);
      plush(p.kind, wx(p.x), 0.1, wz(p.y), p.rot, p.tilt || 0, p.size || 1);
    }
    if (data.fallen) {
      const f = data.fallen;
      plush(f.prize.kind, wx(f.x), f.height, wz(f.y), f.rot, f.tilt || 0, f.prize.size || 1);
    }
    if (data.target && ["lift", "carry", "drop", "prize"].includes(data.state)) {
      const pose = data.heldPose();
      let h = pose.height;
      if (data.state === "drop" || data.state === "prize") h = data.delivery?.height ?? -0.7;
      plush(
        data.target.kind,
        wx(pose.x),
        h,
        wz(pose.y) + (data.state === "prize" ? Math.min(1, data.phase / 0.5) * 1.16 : 0),
        pose.rot,
        pose.tilt,
        data.target.size || 1,
      );
    }
    material = 1;
    shape(cylinder, cx, cy + 0.1, cz, 0.22, 0.16, 0.22, "#d7dde4");
    shape(cylinder, cx, cy + 0.21, cz, 0.14, 0.08, 0.14, "#9b82c2");
    ball(cx, cy + 0.1, cz + 0.215, 0.05, 0.045, 0.025, "#9bf7e0");
    let spread =
      (0.15 + data.claw.open * (data.armCount === 2 ? 0.42 : 0.29)) *
      (data.type === "giant" ? 1.3 : data.type === "mini" ? 0.8 : 1);
    for (let i = 0; i < data.armCount; i++) {
      let a = data.armCount === 2 ? i * Math.PI : (i * Math.PI * 2) / 3 + 0.5,
        co = Math.cos(a),
        si = Math.sin(a),
        p = [cx + co * 0.13, cy - 0.02, cz + si * 0.13],
        q = [cx + co * spread, cy - 0.3, cz + si * spread],
        r = [cx + co * (spread - 0.035), cy - 0.55, cz + si * (spread - 0.035)],
        tip = [
          cx + co * Math.max(0.025, spread - 0.23),
          cy - 0.64,
          cz + si * Math.max(0.025, spread - 0.23),
        ];
      bar(p, q, 0.032, "#d2dce4");
      bar([p[0], p[1] + 0.08, p[2]], [q[0], q[1] + 0.06, q[2]], 0.018, "#8b9aa8");
      ball(...p, 0.06, 0.06, 0.06, "#7e8a94");
      ball(...q, 0.055, 0.055, 0.055, "#586777");
      bar(q, r, 0.029, "#dce5e9");
      bar(r, tip, 0.024, "#d7e0e6");
      ball(...tip, 0.035, 0.025, 0.035, "#81909c");
      bar([cx + co * 0.09, cy + 0.12, cz + si * 0.09], [q[0], q[1] + 0.1, q[2]], 0.016, "#a4b5bf");
    }
    // Detailed cabinet, sloped control deck, locks, vents and prize chute.
    material = 0;
    box(0, -0.92, 0, 3.14, 0.08, 1.7, "#56616f");
    box(1.1, -0.52, 1.78, 1.55, 0.3, 0.08, "#c7d3d8");
    box(1.1, -0.22, 2.03, 1.55, 0.07, 0.5, "#d9dfe1");
    const controls = data.real
      ? [
          [0.25, 2.05, "#df698d"],
          [1.2, 2.05, "#4aafcc"],
          [2.25, 2.05, "#e8bd71"],
        ]
      : [
          [-0.05, 2.05, "#4aafcc"],
          [1.15, 2.05, "#4aafcc"],
          [0.55, 1.68, "#4aafcc"],
          [0.55, 2.42, "#4aafcc"],
          [2.15, 2.05, "#e8bd71"],
        ];
    for (const [x, z, col] of controls) {
      shape(cylinder, x, -0.1, z, 0.17, 0.055, 0.17, "#aabcc9");
      shape(cylinder, x, -0.025, z, 0.13, 0.045, 0.13, col);
    }
    box(2.64, -0.49, 1.88, 0.13, 0.19, 0.025, "#66727f");
    box(2.64, -0.41, 1.92, 0.018, 0.1, 0.01, "#121e2d");
    ball(2.64, -0.58, 1.92, 0.05, 0.05, 0.025, "#abbcc5");
    for (let i = 0; i < 6; i++) box(1.7 + i * 0.14, -0.76, 1.89, 0.035, 0.05, 0.01, "#4b5969");
    box(-2.3, -0.41, 1.9, 0.57, 0.22, 0.012, "#8699a8", 0.2);
    label("PRIZE OUT", -2.3, -0.93, 1.94, 0.59, 0.07, "#b7eee2", "#354450");
    label(data.title, 0, 4.12, 1.8, 2.54, 0.14, "#4e5a6c", "#e2e6e8");
    label(
      data.real ? "1  →    2  ↑    START" : "←  ↑  ↓  →    CATCH",
      1.0,
      -0.25,
      2.28,
      0.68,
      0.065,
      "#425464",
      "#d9dfe1",
    );
    label(
      data.state === "aim" ? "TIME " + Math.ceil(data.timeLeft) : "FREE PLAY",
      1.08,
      -0.52,
      1.89,
      0.59,
      0.09,
      "#b8f6c9",
      "#1e3340",
    );
    label("DO NOT SHAKE", 0, 1.0, -1.5, 0.7, 0.07, "#7e676c", "#dfd6d7");
    for (const x of [-2.87, 2.87])
      for (const y of [0.16, 3.87]) {
        material = 1;
        ball(x, y, 1.64, 0.035, 0.035, 0.018, "#c3cdd2");
        box(x, y, 1.663, 0.022, 0.004, 0.003, "#586371");
      }
    material = 3;
    for (let z of [-1.39, 1.39]) box(0, 3.98, z, 2.8, 0.015, 0.025, "#f3fff5");
    material = 0;
    // Side and rear glass, kept faint so all prizes stay visible.
    gl.depthMask(false);
    material = 1;
    box(0, 2.15, 1.56, 2.92, 1.75, 0.006, "#c1dce5", 0.025);
    box(0, 2, -1.54, 2.92, 1.86, 0.008, "#a1c6e0", 0.055);
    for (let x of [-2.98, 2.98]) box(x, 2, 0, 0.008, 1.86, 1.49, "#a1d6e0", 0.045);
    box(-2.85, 2.5, 1.555, 0.028, 0.9, 0.004, "#e5f5ff", 0.12);
    box(2.85, 2.8, 1.555, 0.028, 0.6, 0.004, "#e5f5ff", 0.1);
    material = 0;
    gl.depthMask(true);
    // Confetti floats in the actual 3D world after a catch.
    for (const p of data.particles) {
      ball(
        wx(p.x),
        0.3 + (485 - p.y) / 100,
        wz(390) + Math.sin(p.x) * 0.5,
        0.035,
        0.055,
        0.025,
        p.color,
      );
    }
  }
  function drawArcade(g) {
    machineX = g.offset;
    material = 0;
    const col = g.type === "basket" ? "#cb8353" : g.type === "moles" ? "#9d7cbd" : "#638ba9";
    box(0, -0.42, 0, 1.8, 0.6, 2.1, col);
    box(0, 0.23, 0, 1.85, 0.07, 2.15, "#b7c9ce");
    for (const x of [-1.6, 1.6])
      for (const z of [-1.8, 1.8]) box(x, -0.85, z, 0.1, 0.25, 0.1, "#354758");
    box(0, 0.27, 2.12, 1.8, 0.1, 0.12, col);
    label(g.name, 0, 3.85, -1.5, 1.75, 0.18, "#dff5ed", "#324b60");
    label(
      g.state === "playing"
        ? Math.ceil(g.time) + "s  " + g.score + (g.type === "hockey" ? " : " + g.cpu : " POINTS")
        : g.type === "basket" || g.type === "hockey"
          ? "TOUCH TO PLAY"
          : "START / FREE PLAY",
      0,
      0.02,
      2.23,
      1.1,
      0.11,
      "#c7f7c8",
      "#263d4c",
    );
    if (g.type !== "basket" && g.type !== "hockey")
      shape(cylinder, 0.8, 0.3, 2.05, 0.17, 0.08, 0.17, "#f1cf85");
    if (g.type === "basket") {
      box(0, 2.7, -1.6, 1.4, 0.75, 0.07, "#c6d5d9");
      box(0, 2.55, -1.51, 0.42, 0.29, 0.012, "#e9f1ee");
      for (const x of [-0.43, 0.43]) box(x, 2.55, -1.48, 0.012, 0.29, 0.008, "#b46a60");
      for (const y of [2.26, 2.84]) box(0, y, -1.48, 0.43, 0.012, 0.008, "#b46a60");
      for (const x of [-1.75, 1.75]) {
        bar([x, 0.32, -1.8], [x, 3.6, -1.8], 0.04, "#98acb9");
        bar([x, 0.32, 1.65], [x, 2.0, 1.65], 0.04, "#98acb9");
        bar([x, 3.6, -1.8], [x, 2.0, 1.65], 0.035, "#a1b4c0");
        for (let i = 0; i < 9; i++)
          bar([x, 0.35 + i * 0.25, -1.8], [x, 0.35 + i * 0.17, 1.65], 0.008, "#6b8594");
      }
      for (let i = 0; i < 24; i++) {
        let a = (i * Math.PI) / 12,
          b = ((i + 1) * Math.PI) / 12;
        bar(
          [Math.cos(a) * 0.45, 2.2, -0.9 + Math.sin(a) * 0.45],
          [Math.cos(b) * 0.45, 2.2, -0.9 + Math.sin(b) * 0.45],
          0.035,
          "#e98f59",
        );
        if (i % 2 === 0) {
          bar(
            [Math.cos(a) * 0.44, 2.16, -0.9 + Math.sin(a) * 0.44],
            [Math.cos(a + 0.25) * 0.25, 1.65, -0.9 + Math.sin(a + 0.25) * 0.25],
            0.009,
            "#d2deda",
          );
          bar(
            [Math.cos(a + 0.25) * 0.25, 1.65, -0.9 + Math.sin(a + 0.25) * 0.25],
            [Math.cos(a + 0.5) * 0.44, 2.16, -0.9 + Math.sin(a + 0.5) * 0.44],
            0.009,
            "#d2deda",
          );
        }
      }
      box(0, 0.48, 1.7, 1.05, 0.1, 0.03, "#283d4d");
      box(0, 0.48, 1.74, 0.2, 0.065, 0.012, "#79d3a2");
      box(-1.0 + g.charge * 2, 0.48, 1.78, 0.035, 0.09, 0.01, "#ffe5ae");
      let b = g.ball || { x: 0, y: 0.6, z: 1.2 };
      ball(b.x, b.y, b.z, 0.15, 0.15, 0.15, "#d99050");
      for (let i = 0; i < 12; i++) {
        let a = (i * Math.PI) / 6,
          b2 = ((i + 1) * Math.PI) / 6;
        bar(
          [b.x + Math.cos(a) * 0.151, b.y + Math.sin(a) * 0.151, b.z],
          [b.x + Math.cos(b2) * 0.151, b.y + Math.sin(b2) * 0.151, b.z],
          0.004,
          "#483a30",
        );
      }
    } else if (g.type === "moles") {
      for (let i = 0; i < 9; i++) {
        let x = ((i % 3) - 1) * 0.95,
          z = (Math.floor(i / 3) - 1) * 0.8,
          h = g.holes[i];
        disc(x, 0.32, z, 0.35, "#253a42", 1);
        if (h.up > 0) {
          ball(x, 0.7, z, 0.23, 0.27, 0.23, "#b48e71");
          ball(x - 0.08, 0.78, z + 0.21, 0.026, 0.033, 0.02, "#263b48");
          ball(x + 0.08, 0.78, z + 0.21, 0.026, 0.033, 0.02, "#263b48");
          ball(x, 0.7, z + 0.235, 0.055, 0.035, 0.025, "#d1a4ad");
          ball(x, 0.95, z, 0.2, 0.05, 0.19, "#e0b969");
        }
        if (h.hit > 0) {
          material = 3;
          ball(x, 1.1, z, 0.11, 0.11, 0.11, "#ffe09c");
          material = 0;
        }
      }
      label("TAP THE MOLES!", 0, 1.6, -1.7, 1.5, 0.16, "#f6dfb4", "#4b4562");
    } else if (g.type === "hockey") {
      material = 1;
      box(0, 0.32, 0, 1.38, 0.015, 1.85, "#d1eaeb");
      material = 0;
      for (let x of [-1.45, 1.45]) box(x, 0.42, 0, 0.07, 0.1, 1.92, "#5e91aa");
      for (let z of [-1.9, 1.9]) {
        box(-1.0, 0.42, z, 0.4, 0.1, 0.065, "#5e91aa");
        box(1.0, 0.42, z, 0.4, 0.1, 0.065, "#5e91aa");
        box(0, 0.31, z, 0.57, 0.01, 0.09, "#263d4d");
      }
      box(0, 0.34, 0, 1.35, 0.002, 0.012, "#6b99ad");
      for (let i = 0; i < 32; i++) {
        let a = (i * Math.PI) / 16;
        ball(Math.cos(a) * 0.42, 0.345, Math.sin(a) * 0.42, 0.015, 0.005, 0.015, "#7eacba");
      }
      shape(cylinder, g.puck.x, 0.38, g.puck.z, 0.13, 0.035, 0.13, "#e4b9d7");
      for (const [p, c] of [
        [g.paddle, "#609ed5"],
        [g.ai, "#dc7b8e"],
      ]) {
        shape(cylinder, p.x, 0.39, p.z, 0.23, 0.045, 0.23, c);
        shape(cylinder, p.x, 0.48, p.z, 0.09, 0.075, 0.09, c);
      }
      label("5 GOALS TO WIN", 0, 1.6, -1.7, 1.5, 0.16, "#c0e9e8", "#324b60");
    } else if (g.type === "crystal") {
      material = 1;
      shape(cylinder, 0, 0.42, 0, 1.38, 0.06, 1.38, "#7e9fae");
      shape(cylinder, 0, 0.49, 0, 1.25, 0.015, 1.25, "#b6cfd7");
      material = 0;
      for (const c of g.gems) {
        if (c.cooldown > 0) continue;
        const angle = c.angle + g.clock * 0.75;
        shape(
          crystalMesh,
          Math.cos(angle) * 0.95,
          0.65,
          Math.sin(angle) * 0.95,
          0.16,
          0.23,
          0.16,
          c.color,
          1,
          angle,
        );
      }
      let t = g.scoopTimer > 0 ? 1 - g.scoopTimer / 0.9 : 0,
        sy = g.scoopTimer > 0 ? 0.6 + Math.sin(t * Math.PI) * 0.7 : 0.6;
      material = 1;
      bar([0, 0.7, 2], [0, sy, 1.02], 0.045, "#c3d7df");
      shape(cylinder, 0, sy, 1.02, 0.36, 0.035, 0.28, "#c1d3dc");
      material = 0;
      for (let i = 0; i < g.cargo.length; i++)
        shape(crystalMesh, (i - 1) * 0.13, sy + 0.15, 1.02, 0.1, 0.16, 0.1, g.cargo[i]);
      shape(cylinder, -0.8, 0.3, 2.05, 0.17, 0.08, 0.17, "#b8a4f2");
      for (let i = 0; i < Math.min(10, g.score); i++)
        shape(
          crystalMesh,
          -1.3 + (i % 5) * 0.13,
          0.53,
          1.5 + Math.floor(i / 5) * 0.14,
          0.06,
          0.1,
          0.06,
          ["#a4ead9", "#d4b3f2"][i % 2],
        );
      if (g.prizesWon) box(1.25, 0.53, 1.55, 0.18, 0.18, 0.18, "#e5bd79");
      label("5 CRYSTALS = TREASURE", 0, 1.6, -1.7, 1.6, 0.14, "#dbd0f3", "#344a60");
    } else if (g.type === "timing") {
      box(0, 2.1, -1.1, 1.48, 1.4, 0.12, "#32445b");
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12,
          x = Math.sin(a) * 1.06,
          y = 2.1 + Math.cos(a) * 1.06;
        material = i === g.lightIndex && g.state === "playing" ? 3 : 0;
        ball(
          x,
          y,
          -0.93,
          0.095,
          0.095,
          0.06,
          i === 0 ? "#ffdd83" : i === g.lightIndex ? "#a5ffe2" : "#536f87",
        );
      }
      material = 3;
      label("★ STOP HERE ★", 0, 3.48, -0.9, 1.1, 0.12, "#ffe39e", "#32445b");
      material = 0;
      label(g.attempts + " / 10", 0, 2.1, -0.9, 0.65, 0.13, "#d8ebd8", "#32445b");
      shape(cylinder, -0.8, 0.3, 2.05, 0.17, 0.08, 0.17, "#e38a9d");
    }
  }

  function planePoint(clientX, clientY, y) {
    const r = canvas.getBoundingClientRect(),
      nx = ((clientX - r.left) / r.width) * 2 - 1,
      ny = 1 - ((clientY - r.top) / r.height) * 2,
      f = [
        Math.sin(player.yaw) * Math.cos(player.pitch),
        Math.sin(player.pitch),
        -Math.cos(player.yaw) * Math.cos(player.pitch),
      ],
      right = [Math.cos(player.yaw), 0, Math.sin(player.yaw)],
      up = [
        -Math.sin(player.yaw) * Math.sin(player.pitch),
        Math.cos(player.pitch),
        Math.cos(player.yaw) * Math.sin(player.pitch),
      ],
      t = Math.tan(0.51),
      aspect = canvas.clientWidth / canvas.clientHeight,
      d = f.map((v, i) => v + right[i] * nx * t * aspect + up[i] * ny * t);
    if (Math.abs(d[1]) < 0.00001) return null;
    const distance = (y - 1.85) / d[1];
    if (distance <= 0) return null;
    return { x: player.x + d[0] * distance, z: player.z + d[2] * distance };
  }
  // Ray-plane mapping lets screen taps follow perspective without changing the player's view.
  function verticalPoint(clientX, clientY, z) {
    const r = canvas.getBoundingClientRect(),
      nx = ((clientX - r.left) / r.width) * 2 - 1,
      ny = 1 - ((clientY - r.top) / r.height) * 2,
      f = [
        Math.sin(player.yaw) * Math.cos(player.pitch),
        Math.sin(player.pitch),
        -Math.cos(player.yaw) * Math.cos(player.pitch),
      ],
      right = [Math.cos(player.yaw), 0, Math.sin(player.yaw)],
      up = [
        -Math.sin(player.yaw) * Math.sin(player.pitch),
        Math.cos(player.pitch),
        Math.cos(player.yaw) * Math.sin(player.pitch),
      ],
      t = Math.tan(0.51),
      aspect = canvas.clientWidth / canvas.clientHeight,
      d = f.map((v, i) => v + right[i] * nx * t * aspect + up[i] * ny * t);
    if (Math.abs(d[2]) < 0.00001) return null;
    const distance = (z - player.z) / d[2];
    if (distance <= 0) return null;
    return { x: player.x + d[0] * distance, y: 1.85 + d[1] * distance };
  }
  const videoTextures = new Map();
  function videoScreen(v, x, y, z, sx, sy) {
    let record = videoTextures.get(v);
    if (!record) {
      record = { texture: gl.createTexture(), frame: -1 };
      videoTextures.set(v, record);
    }
    gl.bindTexture(gl.TEXTURE_2D, record.texture);
    if (record.frame !== v.frame) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v.canvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      record.frame = v.frame;
    }
    gl.uniform1i(loc.decal, 0);
    gl.uniform1f(loc.textured, 1);
    material = 3;
    shape(quad, x, y, z, sx, sy, 1, "#ffffff");
    gl.uniform1f(loc.textured, 0);
    material = 0;
  }
  function drawVideo(v) {
    machineX = v.offset;
    material = 0;
    box(0, -0.25, 0.2, 1.45, 0.8, 0.95, "#263c52");
    box(0, 1.7, -0.45, 1.52, 1.8, 0.45, "#354c66");
    box(0, 3.6, -0.15, 1.62, 0.23, 0.72, v.color);
    box(0, 0.32, 1.38, 1.52, 0.12, 0.6, "#738b9a");
    box(0, 2.02, 0.03, 1.43, 1.02, 0.07, "#142738");
    videoScreen(v, 0, 2.02, 0.12, 1.34, 0.9);
    material = 1;
    for (const x of [-1.43, 1.43]) bar([x, 0.5, 0.8], [x, 3.35, 0.0], 0.04, "#7e9baa");
    material = 0;
    label(v.icon + " " + v.name, 0, 3.61, 0.59, 1.42, 0.14, "#243e54", v.color);
    shape(cylinder, 1.12, 0.42, 1.82, 0.18, 0.075, 0.18, v.color);
    const keys = v.engine.def.buttons;
    for (let i = 0; i < keys.length; i++) {
      const x = keys.length <= 1 ? -0.5 : -1.15 + i * (1.85 / Math.max(1, keys.length - 1));
      shape(
        cylinder,
        x,
        0.42,
        1.82,
        0.15,
        0.075,
        0.15,
        ["#d69bab", "#9cbece", "#ddc78f", "#97c6ba"][i % 4],
      );
    }
    label("START / BEST " + v.score, 0, 0.02, 1.18, 1.1, 0.12, "#d0eadf", "#253c50");
    box(-0.8, 0.47, 1.4, 0.09, 0.1, 0.09, "#b0c9cf");
    bar([-0.8, 0.48, 1.4], [-0.8, 0.78, 1.4], 0.035, "#6c849a");
    ball(-0.8, 0.8, 1.4, 0.11, 0.11, 0.11, v.color);
    for (let i = 0; i < 3; i++)
      shape(
        cylinder,
        0.55 + i * 0.22,
        0.48,
        1.4,
        0.075,
        0.035,
        0.075,
        ["#d69bab", "#9cbece", "#ddc78f"][i],
      );
  }
  function ring3D(x, y, z, r, color) {
    for (let i = 0; i < 20; i++) {
      const a = (i * Math.PI) / 10,
        b = ((i + 1) * Math.PI) / 10;
      bar(
        [x + Math.cos(a) * r, y, z + Math.sin(a) * r],
        [x + Math.cos(b) * r, y, z + Math.sin(b) * r],
        0.022,
        color,
      );
    }
  }
  function drawField(g) {
    machineX = g.offset;
    material = 0;
    const ground = -0.91;
    box(
      0,
      -0.98,
      0,
      g.id === "field-bowling" ? 1.22 : 1.6,
      0.07,
      1.95,
      g.id === "field-bowling" ? "#a58b68" : g.id === "field-rings" ? "#8a8f9a" : "#5b8b6e",
    );
    for (const x of [-1.58, 1.58]) box(x, -0.9, 0, 0.035, 0.12, 1.95, "#ccd7d0");
    box(0, -0.9, -1.94, 1.6, 0.12, 0.035, "#ccd7d0");
    box(0, -0.9, 1.94, 1.6, 0.12, 0.035, "#ccd7d0");
    bar([-1.55, 2.6, -1.9], [1.55, 2.6, -1.9], 0.035, "#94aeb6");
    for (const x of [-1.55, 1.55]) bar([x, -0.95, -1.9], [x, 2.6, -1.9], 0.035, "#7f9ba6");
    label(g.name, 0, 2.42, -1.84, 1.48, 0.13, "#e1f1e7", "#2d4858");
    label(
      g.state === "playing"
        ? g.id === "field-golf"
          ? g.score + "/3 HOLES  " + g.shots + " SHOTS"
          : g.score + " / " + Math.ceil(g.time) + " SEC"
        : g.state === "done"
          ? "TOUCH TO REPLAY"
          : "TOUCH THE COURSE",
      0,
      2.1,
      -1.83,
      1.25,
      0.1,
      "#ead7a5",
      "#2d4858",
    );
    // Physical sports have no control stand or buttons.
    if (g.id === "field-golf") {
      material = 2;
      box(0, -0.906, 0, 1.48, 0.008, 1.83, "#5b9473");
      material = 0;
      disc(g.hole.x, -0.895, g.hole.z, 0.16, "#182c2b", 1);
      bar([g.hole.x, -0.9, g.hole.z], [g.hole.x, 0.08, g.hole.z], 0.016, "#d1dad7");
      box(g.hole.x + 0.13, -0.02, g.hole.z, 0.13, 0.08, 0.012, "#d18a94");
      for (const o of g.obstacles) box(o.x, -0.79, o.z, o.w / 2, 0.16, o.d / 2, "#ae9570");
      if (!g.sunk) {
        disc(g.ball.x, -0.895, g.ball.z, 0.11, "#29463b", 0.3);
        ball(g.ball.x, g.ball.y, g.ball.z, 0.085, 0.085, 0.085, "#e8e9dd");
      }
      const angle = Math.atan(g.aimX),
        swing = Math.sin((g.swingAge / 0.35) * Math.PI) * 0.25,
        x = g.ball.x - Math.sin(angle) * (0.3 + swing),
        z = g.ball.z + Math.cos(angle) * (0.3 + swing);
      bar([x, -0.72, z], [x - 0.14, 0.35, z + 0.12], 0.018, "#afbfca");
      box(x, -0.76, z, 0.14, 0.035, 0.045, "#a3adb7");
      if (!g.moving && g.state === "playing") {
        for (let i = 1; i < 8; i++)
          disc(
            g.ball.x + Math.sin(angle) * i * 0.13,
            -0.89,
            g.ball.z - Math.cos(angle) * i * 0.13,
            0.014,
            "#d3e6bd",
            0.65,
          );
      }
    } else if (g.id === "field-bowling") {
      for (let i = 0; i < 13; i++) box(-1.14 + i * 0.19, -0.906, 0, 0.006, 0.002, 1.82, "#bda583");
      for (const x of [-1.34, 1.34]) box(x, -0.97, 0, 0.11, 0.025, 1.8, "#4b6170");
      for (const p of g.pins) {
        const lean = p.tilt || 0,
          dx = Math.sin(lean) * Math.sin(p.dir || 0),
          dz = -Math.sin(lean) * Math.cos(p.dir || 0);
        bar(
          [p.x, ground + 0.045, p.z],
          [p.x + dx * 0.14, ground + 0.045 + Math.cos(lean) * 0.14, p.z + dz * 0.14],
          0.062,
          "#dce4e2",
        );
        bar(
          [p.x + dx * 0.14, ground + 0.045 + Math.cos(lean) * 0.14, p.z + dz * 0.14],
          [p.x + dx * 0.25, ground + 0.045 + Math.cos(lean) * 0.25, p.z + dz * 0.25],
          0.033,
          "#e5ebe7",
        );
        ball(
          p.x + dx * 0.29,
          ground + 0.045 + Math.cos(lean) * 0.29,
          p.z + dz * 0.29,
          0.054,
          0.054,
          0.054,
          "#e8e8df",
        );
        ball(
          p.x + dx * 0.22,
          ground + 0.045 + Math.cos(lean) * 0.22,
          p.z + dz * 0.22,
          0.035,
          0.035,
          0.035,
          "#c6798b",
        );
      }
      disc(g.ball.x, -0.906, g.ball.z, 0.14, "#58483a", 0.26);
      ball(g.ball.x, g.ball.y + 0.035, g.ball.z, 0.13, 0.13, 0.13, "#6b91b0");
      for (let i = 0; i < 3; i++)
        ball(
          g.ball.x - 0.025 + i * 0.025,
          g.ball.y + 0.115,
          g.ball.z + 0.055,
          0.011,
          0.011,
          0.01,
          "#24394b",
        );
    } else if (g.id === "field-soccer") {
      for (let z = -1.5; z < 1.9; z += 0.45) box(0, -0.907, z, 1.46, 0.003, 0.11, "#6f9876");
      for (const x of [-1.08, 1.08]) bar([x, ground, -1.67], [x, 1.15, -1.67], 0.035, "#d9e4df");
      bar([-1.08, 1.15, -1.67], [1.08, 1.15, -1.67], 0.035, "#d9e4df");
      for (let x = -1.05; x <= 1.1; x += 0.21)
        bar([x, ground, -1.89], [x, 1.15, -1.89], 0.008, "#a5b7af");
      for (let y = ground; y < 1.2; y += 0.19)
        bar([-1.08, y, -1.9], [1.08, y, -1.9], 0.008, "#a5b7af");
      const k = g.targetX;
      ball(k, 0.62, -1.25, 0.13, 0.13, 0.13, "#cbb19b");
      shape(cylinder, k, 0.2, -1.25, 0.16, 0.27, 0.11, "#b47d8e");
      for (const s of [-1, 1]) {
        bar([k + s * 0.11, -0.08, -1.25], [k + s * 0.22, ground, -1.25], 0.06, "#44677e");
        bar([k + s * 0.13, 0.39, -1.25], [k + s * 0.5, 0.13, -1.25], 0.052, "#c7ac93");
      }
      disc(g.ball.x, -0.9, g.ball.z, 0.13, "#29483c", 0.3);
      ball(g.ball.x, g.ball.y, g.ball.z, 0.11, 0.11, 0.11, "#e7e6d9");
      ball(g.ball.x, g.ball.y + 0.075, g.ball.z + 0.075, 0.028, 0.025, 0.025, "#405564");
    } else if (g.id === "field-archery") {
      for (const [r, col] of [
        [0.6, "#d8e0dd"],
        [0.45, "#5e8da7"],
        [0.3, "#c88b98"],
        [0.14, "#ead199"],
      ])
        ball(0, 0.65, -1.67 + (0.6 - r) * 0.04, r, r, 0.025, col);
      box(0, 0.65, -1.73, 0.65, 0.65, 0.03, "#8c7967");
      if (g.state === "playing" && !g.moving) {
        ball(g.aimX, g.aimY, -1.6, 0.025, 0.025, 0.01, "#a4f3d4");
        bar([g.aimX - 0.06, g.aimY, -1.6], [g.aimX + 0.06, g.aimY, -1.6], 0.008, "#eaf6ed");
        bar([g.aimX, g.aimY - 0.06, -1.6], [g.aimX, g.aimY + 0.06, -1.6], 0.008, "#eaf6ed");
      }
      if (g.arrow) {
        const a = g.arrow;
        bar([a.x, a.y, a.z + 0.3], [a.x, a.y, a.z], 0.01, "#b4cad1");
        ball(a.x, a.y, a.z, 0.022, 0.018, 0.035, "#d7ded8");
      }
      const bend = 0.2 + g.power * 0.15;
      bar([-0.45, -0.35, 1.4], [-0.65, 0.05, 1.3], 0.025, "#b29270");
      bar([-0.65, 0.05, 1.3], [-0.45, 0.45, 1.4], 0.025, "#b29270");
      bar([-0.45, -0.35, 1.4], [-0.45, 0.05, 1.4 + bend], 0.007, "#d7ddd1");
      bar([-0.45, 0.05, 1.4 + bend], [-0.45, 0.45, 1.4], 0.007, "#d7ddd1");
    } else if (g.id === "field-rings") {
      for (const [x, z, col] of [
        [-0.7, -0.5, "#c88da1"],
        [0, -1.1, "#a4c8d5"],
        [0.7, -0.5, "#dec38e"],
      ]) {
        disc(x, -0.905, z, 0.18, "#677a87", 1);
        shape(cylinder, x, -0.7, z, 0.036, 0.25, 0.036, col);
      }
      if (g.moving || g.resolved) ring3D(g.ball.x, g.ball.y, g.ball.z, 0.19, "#dec18b");
      else ring3D(0, -0.25, 1.3, 0.19, "#dec18b");
    } else if (g.id === "field-batting") {
      box(0, -0.901, 1.2, 0.24, 0.005, 0.15, "#dce4dc");
      for (const x of [-1.45, 1.45]) {
        for (let z = -1.8; z <= 1.8; z += 0.4) bar([x, ground, z], [x, 1.4, z], 0.008, "#8ba4ac");
        for (let y = -0.8; y <= 1.4; y += 0.3) bar([x, y, -1.8], [x, y, 1.8], 0.008, "#8ba4ac");
      }
      const swing = Math.sin((g.swingAge / 0.3) * Math.PI);
      bar([0.7, -0.45, 1.45], [0.85 - swing * 0.8, 0.15, 1.1 - swing * 0.4], 0.035, "#bba17c");
      ball(g.ball.x, g.ball.y, g.ball.z, 0.075, 0.075, 0.075, "#ece8dc");
      ball(g.ball.x, g.ball.y + 0.035, g.ball.z + 0.052, 0.02, 0.02, 0.01, "#cc9499");
    }
  }
  function visible(x) {
    let dx = x - player.x,
      dz = -player.z,
      forward = dx * Math.sin(player.yaw) - dz * Math.cos(player.yaw),
      side = dx * Math.cos(player.yaw) + dz * Math.sin(player.yaw);
    return (
      forward > -4 &&
      Math.abs(side) <
        Math.max(0, forward) * Math.tan(0.51) * (canvas.clientWidth / canvas.clientHeight) + 5
    );
  }
  function draw(input) {
    for (const [v, r] of videoTextures)
      if (!(input.videos || []).includes(v)) {
        gl.deleteTexture(r.texture);
        videoTextures.delete(v);
      }
    machineX = 0;
    material = 0;
    let ratio = Math.min(window.devicePixelRatio || 1, 1.5),
      w = Math.max(1, Math.floor(canvas.clientWidth * ratio)),
      h = Math.max(1, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.06, 0.09, 0.13, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    let eye = [player.x, 1.85, player.z],
      dir = [
        Math.sin(player.yaw) * Math.cos(player.pitch),
        Math.sin(player.pitch),
        -Math.cos(player.yaw) * Math.cos(player.pitch),
      ];
    currentVP = mul(
      perspective(w / h),
      view(
        eye,
        eye.map((x, i) => x + dir[i]),
      ),
    );
    gl.uniform3fv(loc.eye, eye);
    gl.uniformMatrix4fv(loc.vp, false, currentVP);
    const segment = Math.round(player.x / 16) * 16;
    material = 5;
    box(segment, -1.14, 3, 64, 0.06, 19, "#445461");
    material = 0;
    box(segment, 2.2, -3.1, 64, 3.3, 0.1, "#263e50");
    box(segment, 5.6, 4, 64, 0.1, 10, "#26394c");
    material = 3;
    for (let x = segment - 60; x <= segment + 60; x += 8)
      box(x, 5.45, 3, 0.08, 0.018, 7, "#d9ebe5");
    material = 0;
    for (let x = segment - 44; x <= segment + 44; x += 22)
      label("∞  KOCHAN ARCADE  ∞", x, 4.9, -2.95, 3.6, 0.23, "#b4f2e4", "#263e50");
    for (const m of input.machines) {
      m.aimHelp = input.aimHelp;
      if (visible(m.offset)) drawMachine(m);
    }
    machineX = 0;
    for (const g of input.arcades || []) {
      if (visible(g.offset)) drawArcade(g);
    }
    machineX = 0;
    for (const v of input.videos || []) {
      if (visible(v.offset)) drawVideo(v);
    }
    machineX = 0;
    for (const f of input.fields || []) {
      if (visible(f.offset)) drawField(f);
    }
    machineX = 0;
  }
  return { draw, planePoint, verticalPoint, walk, look, reset, distance, project, player };
};
