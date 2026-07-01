// ════════════════════════════════════════════════════════
// NEBULA BACKGROUND — shared WebGL layer (index.html + chart.html)
//
// 抽自 index.html 內建星雲背景，改為兩頁共用的單一事實來源。
// 行為：
//   • 若頁面已有 #nebula-bg / #nebula-canvas（如 index.html 內建 DOM）→ 直接沿用，
//     不注入任何 CSS，index 視覺完全不變（z-index 由頁面既有 CSS 決定）。
//   • 若頁面沒有（如 chart.html）→ 自建 DOM 置於 <body> 最前，並注入極簡 CSS
//     （#nebula-bg z-index:-1 沉到內容之後；body 背景轉透明讓星雲透出），
//     形成「深色卡片浮在星雲上」的整合視覺。
//
// WebGL 不可用時 fallback 純色底，不報錯、不留痕。
// Shader 內容與 index.html 原版逐字一致，僅包裝方式改為共用模組。
// ════════════════════════════════════════════════════════
(function () {
  if (typeof window === 'undefined') return;
  if (window.__NEBULA_BG__) return;
  window.__NEBULA_BG__ = true;

  function start() {
    var nebBg  = document.getElementById('nebula-bg');
    var canvas = document.getElementById('nebula-canvas');
    var created = false;

    // 頁面沒有內建星雲 DOM（chart.html）→ 自建 + 注入整合用 CSS
    if (!nebBg) {
      created = true;
      var css = document.createElement('style');
      css.setAttribute('data-nebula-bg', '');
      css.textContent =
        '#nebula-bg{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;' +
        'z-index:-1;overflow:hidden;background:#000;pointer-events:none;}' +
        '#nebula-canvas{position:absolute;top:0;left:0;width:100%;height:100%;display:block;}' +
        // 讓既有深藍 gradient 背景讓位給星雲；深色卡片（.panel/.chart-block）維持不透明浮於其上
        'body{background:transparent !important;}';
      document.head.appendChild(css);

      nebBg = document.createElement('div');
      nebBg.id = 'nebula-bg';
      canvas = document.createElement('canvas');
      canvas.id = 'nebula-canvas';
      nebBg.appendChild(canvas);
      document.body.insertBefore(nebBg, document.body.firstChild);
    }

    var gl = canvas && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    if (!gl) { if (nebBg) nebBg.style.background = '#0d0d1a'; return; }

    // Per-page randomization
    var PRESET      = Math.floor(Math.random() * 5);
    var RNG         = Math.random();
    var DRIFT_ANGLE = Math.random() * Math.PI * 2;

    var VS = 'attribute vec2 a_pos;\nvoid main(){gl_Position=vec4(a_pos,0.0,1.0);}';

    var FS = [
      'precision highp float;',
      'uniform vec2  u_res;',
      'uniform float u_time;',
      'uniform vec2  u_pan;',
      'uniform int   u_preset;',
      'uniform float u_rng;',

      'float hash(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+74.351);return fract(p.x*p.y);}',

      'float vn(vec2 p){',
      '  vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);',
      '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),',
      '             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}',

      'float fbm(vec2 p){',
      '  float v=0.0,a=0.5;mat2 rot=mat2(1.6,1.2,-1.2,1.6);',
      '  for(int i=0;i<6;i++){v+=a*vn(p);p=rot*p;a*=0.5;}return v;}',

      'vec3 stars(vec2 uv){',
      '  vec3 col=vec3(0.0);',
      '  vec2 g=floor(uv*260.0+u_rng*73.1);',
      '  vec2 lo=fract(uv*260.0+u_rng*73.1)-0.5;',
      '  float h=hash(g+u_rng*19.3);',
      '  float sz=0.05+0.07*hash(g+7.1);',
      '  float tw=0.75+0.25*sin(u_time*(2.0+h*5.0)+h*83.0);',
      '  col+=step(0.963,h)*tw*smoothstep(sz,0.0,length(lo))*vec3(0.85+0.15*h,0.9,1.0);',
      '  g=floor(uv*75.0+u_rng*131.7);',
      '  lo=fract(uv*75.0+u_rng*131.7)-0.5;',
      '  h=hash(g+u_rng*43.7+99.9);sz=0.04+0.05*h;',
      '  tw=0.8+0.2*sin(u_time*(1.5+h*3.5)+h*61.0);',
      '  float vis=step(0.94,h);',
      '  col+=(vis*smoothstep(sz,0.0,length(lo))+exp(-length(lo)*24.0)*vis*0.28)',
      '       *tw*(1.0+0.8*h)*vec3(0.9,0.92,1.0);',
      '  return col;}',

      'void main(){',
      '  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/min(u_res.x,u_res.y);',
      '  uv+=u_pan;',
      '  vec2 q=vec2(fbm(uv*1.3),fbm(uv*1.3+vec2(5.2,1.3)));',
      '  vec2 r=vec2(fbm(uv*1.2+4.0*q+vec2(1.7,9.2)+0.018*u_time),',
      '              fbm(uv*1.2+4.0*q+vec2(8.3,2.8)+0.014*u_time));',
      '  float f=fbm(uv+4.0*r);',
      '  float f2=fbm(uv*2.8+vec2(3.7,1.9)+0.012*u_time',
      '              +2.0*vec2(fbm(uv*2.8),fbm(uv*2.8+vec2(2.1,4.3))));',

      '  vec3 nbg=vec3(0.0),c1=vec3(0.0),c2=vec3(0.0),c3=vec3(0.0);',
      '  float dens=0.0,fils=0.0;',
      '  if(u_preset==0){',
      '    nbg=vec3(0.01,0.01,0.06);c1=vec3(0.05,0.25,0.72);',
      '    c2=vec3(0.10,0.52,0.90);c3=vec3(0.92,0.38,0.06);dens=0.68;fils=0.52;',
      '  }else if(u_preset==1){',
      '    nbg=vec3(0.04,0.02,0.01);c1=vec3(0.36,0.17,0.04);',
      '    c2=vec3(0.82,0.54,0.12);c3=vec3(1.00,0.88,0.42);dens=0.72;fils=0.38;',
      '  }else if(u_preset==2){',
      '    nbg=vec3(0.00,0.00,0.02);c1=vec3(0.05,0.07,0.15);',
      '    c2=vec3(0.22,0.28,0.44);c3=vec3(0.55,0.52,0.38);dens=0.28;fils=0.18;',
      '  }else if(u_preset==3){',
      '    nbg=vec3(0.00,0.00,0.03);c1=vec3(0.00,0.14,0.44);',
      '    c2=vec3(0.04,0.52,0.88);c3=vec3(0.38,0.85,1.00);dens=0.48;fils=0.88;',
      '  }else{',
      '    nbg=vec3(0.02,0.01,0.05);c1=vec3(0.18,0.05,0.32);',
      '    c2=vec3(0.48,0.10,0.68);c3=vec3(0.88,0.38,1.00);dens=0.62;fils=0.50;',
      '  }',

      '  float hs=(u_rng-0.5)*0.18;',
      '  c1+=vec3(hs,hs*0.4,-hs*0.6);',
      '  c2+=vec3(hs,hs*0.4,-hs*0.6);',
      '  c3+=vec3(hs*0.5,hs*0.2,-hs);',

      '  float absorp=smoothstep(0.44,0.70,fbm(uv*2.8+vec2(9.1,3.4)));',
      '  float cloud=pow(clamp(f,0.0,1.0),1.8)*dens*(1.0-absorp*0.65);',

      '  vec3 col=nbg;',
      '  col=mix(col,c1,cloud);',
      '  col=mix(col,c2,cloud*cloud);',
      '  float hot=pow(clamp(f*1.35-0.22,0.0,1.0),2.2);',
      '  col=mix(col,c3,hot*0.55);',
      '  float fil=pow(clamp(f2*1.5-0.42,0.0,1.0),2.0)*fils;',
      '  col+=fil*c3*0.38;',
      '  col+=stars(uv);',
      '  col=col/(col+0.42);',
      '  col=pow(max(col,0.0),vec3(0.88));',
      '  gl_FragColor=vec4(col,1.0);}',
    ].join('\n');

    function compileShader(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('Nebula shader error:', gl.getShaderInfoLog(sh)); return null;
      }
      return sh;
    }
    var vs = compileShader(gl.VERTEX_SHADER, VS);
    var fs = compileShader(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { nebBg.style.background = '#0d0d1a'; return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Nebula link error:', gl.getProgramInfoLog(prog));
      nebBg.style.background = '#0d0d1a'; return;
    }
    gl.useProgram(prog);

    var quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uRes    = gl.getUniformLocation(prog, 'u_res');
    var uTime   = gl.getUniformLocation(prog, 'u_time');
    var uPan    = gl.getUniformLocation(prog, 'u_pan');
    var uPreset = gl.getUniformLocation(prog, 'u_preset');
    var uRng    = gl.getUniformLocation(prog, 'u_rng');
    gl.uniform1i(uPreset, PRESET);
    gl.uniform1f(uRng, RNG);

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = Math.floor(window.innerWidth  * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    // ── Pan state (UV-space) ──────────────────────────────────
    var tx=0, ty=0, vx=0, vy=0;
    var dragging=false, lastX=0, lastY=0, autoT=0;

    function clampPan() {
      tx = Math.max(-0.5, Math.min(0.5, tx));
      ty = Math.max(-0.5, Math.min(0.5, ty));
    }

    // 拖曳平移只在頁面內建互動星雲（index，created=false）啟用；
    // chart 版 z-index:-1 + pointer-events:none 為純氛圍背景，不攔截命盤操作。
    if (!created) {
      nebBg.addEventListener('mousedown', function(e) {
        dragging=true; lastX=e.clientX; lastY=e.clientY; vx=0; vy=0;
        nebBg.classList.add('dragging'); e.preventDefault();
      });
      window.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        var minD = Math.min(window.innerWidth, window.innerHeight);
        vx = -(e.clientX - lastX) / minD;
        vy =  (e.clientY - lastY) / minD;
        tx += vx; ty += vy;
        lastX = e.clientX; lastY = e.clientY;
        clampPan();
      });
      window.addEventListener('mouseup', function() { dragging=false; nebBg.classList.remove('dragging'); });
      nebBg.addEventListener('touchstart', function(e) {
        dragging=true; lastX=e.touches[0].clientX; lastY=e.touches[0].clientY; vx=0; vy=0;
      }, { passive: true });
      window.addEventListener('touchmove', function(e) {
        if (!dragging) return;
        var minD = Math.min(window.innerWidth, window.innerHeight);
        vx = -(e.touches[0].clientX - lastX) / minD;
        vy =  (e.touches[0].clientY - lastY) / minD;
        tx += vx; ty += vy;
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
        clampPan();
      }, { passive: true });
      window.addEventListener('touchend', function() { dragging=false; });
    }

    // ── Render loop ───────────────────────────────────────────
    var t0 = performance.now();
    (function frame() {
      var t = (performance.now() - t0) * 0.001;
      if (!dragging) { vx *= 0.92; vy *= 0.92; tx += vx; ty += vy; }
      autoT += 0.00022;
      clampPan();
      var driftX = Math.sin(DRIFT_ANGLE) * Math.sin(autoT * 0.80) * 0.040
                 + Math.cos(DRIFT_ANGLE) * Math.cos(autoT * 0.55) * 0.025;
      var driftY = Math.cos(DRIFT_ANGLE) * Math.sin(autoT * 0.65) * 0.035
                 + Math.sin(DRIFT_ANGLE) * Math.cos(autoT * 0.40) * 0.020;
      gl.uniform2f(uRes,  canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uPan,  tx + driftX, ty + driftY);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(frame);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
