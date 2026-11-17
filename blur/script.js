(function(){
  const $ = id => document.getElementById(id);
  const dropzone = $('dropzone'), fileInput = $('fileInput'), editor = $('editor');
  const canvas = $('canvas'), maskView = $('maskView');
  const SRC_MAX = 2000, PREVIEW_MAX = 720;
  let src = null, prevCv = null, prevS = null, raf = 0, wantOverlay = false, overlayTimer;
  let cacheKey = '', cacheB = null;
  const st = { type:'gauss', area:'all', erase:false, str:40, ang:0, cx:50, cy:50, band:25, brush:10, strokes:[] };

  /* ================= Mesin blur ================= */
  // Box blur satu arah (empat kanal), tepi diperpanjang
  function box1D(s, d, n, lines, along, across, r){
    r = Math.min(r, (n - 1) >> 1);
    if (r < 1){ d.set(s); return; }
    const iarr = 1 / (r + r + 1);
    for (let l = 0; l < lines; l++){
      for (let c = 0; c < 4; c++){
        let ti = l * across + c, li = ti, ri = ti + r * along;
        const fv = s[ti], lv = s[ti + (n - 1) * along];
        let val = (r + 1) * fv;
        for (let j = 0; j < r; j++) val += s[ti + j * along];
        for (let j = 0; j <= r; j++){ val += s[ri] - fv; ri += along; d[ti] = val * iarr; ti += along; }
        for (let j = r + 1; j < n - r; j++){ val += s[ri] - s[li]; ri += along; li += along; d[ti] = val * iarr; ti += along; }
        for (let j = n - r; j < n; j++){ val += lv - s[li]; li += along; d[ti] = val * iarr; ti += along; }
      }
    }
  }
  function boxPass(a, b, w, h, r){ box1D(a, b, w, h, 4, w * 4, r); box1D(b, a, h, w, w * 4, 4, r); }
  function boxesForGauss(sigma, n){
    const wi = Math.sqrt(12 * sigma * sigma / n + 1); let wl = Math.floor(wi); if (wl % 2 === 0) wl--;
    const wu = wl + 2, m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
    const out = []; for (let i = 0; i < n; i++) out.push(i < m ? wl : wu); return out;
  }
  function gaussBlur(S, w, h, sigma){
    if (sigma < 0.5) return S;
    const a = new Uint8ClampedArray(S), b = new Uint8ClampedArray(S.length);
    boxesForGauss(sigma, 3).forEach(bs => boxPass(a, b, w, h, (bs - 1) / 2 | 0));
    return a;
  }
  function boxBlur(S, w, h, r){
    const a = new Uint8ClampedArray(S), b = new Uint8ClampedArray(S.length); boxPass(a, b, w, h, Math.max(1, r)); return a;
  }
  const cl = (v, m) => v < 0 ? 0 : v >= m ? m - 1 : v;

  function motion(S, w, h, len, ang){
    const out = new Uint8ClampedArray(S.length), N = Math.max(3, Math.min(48, Math.round(len)));
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < N; i++){
        const t = (i / (N - 1) - 0.5) * len, p = (cl(Math.round(y + dy * t), h) * w + cl(Math.round(x + dx * t), w)) * 4;
        r += S[p]; g += S[p + 1]; b += S[p + 2]; a += S[p + 3];
      }
      const o = (y * w + x) * 4; out[o] = r / N; out[o + 1] = g / N; out[o + 2] = b / N; out[o + 3] = a / N;
    }
    return out;
  }
  function zoom(S, w, h, cx, cy, amt){
    const out = new Uint8ClampedArray(S.length), N = 32;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      const vx = (cx - x) * amt, vy = (cy - y) * amt; let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < N; i++){
        const t = i / (N - 1), p = (cl(Math.round(y + vy * t), h) * w + cl(Math.round(x + vx * t), w)) * 4;
        r += S[p]; g += S[p + 1]; b += S[p + 2]; a += S[p + 3];
      }
      const o = (y * w + x) * 4; out[o] = r / N; out[o + 1] = g / N; out[o + 2] = b / N; out[o + 3] = a / N;
    }
    return out;
  }
  function spin(S, w, h, cx, cy, A){
    const out = new Uint8ClampedArray(S.length), N = 32, cs = [], sn = [];
    for (let i = 0; i < N; i++){ const t = (i / (N - 1) - 0.5) * A; cs.push(Math.cos(t)); sn.push(Math.sin(t)); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      const rx = x - cx, ry = y - cy; let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < N; i++){
        const sx = cl(Math.round(cx + rx * cs[i] - ry * sn[i]), w), sy = cl(Math.round(cy + rx * sn[i] + ry * cs[i]), h), p = (sy * w + sx) * 4;
        r += S[p]; g += S[p + 1]; b += S[p + 2]; a += S[p + 3];
      }
      const o = (y * w + x) * 4; out[o] = r / N; out[o + 1] = g / N; out[o + 2] = b / N; out[o + 3] = a / N;
    }
    return out;
  }
  function bokeh(S, w, h, rad){
    if (rad < 1) return S;
    const out = new Uint8ClampedArray(S.length), N = 48, ox = [], oy = [];
    for (let i = 0; i < N; i++){ const rr = Math.sqrt((i + 0.5) / N) * rad, th = i * 2.39996; ox.push(Math.cos(th) * rr); oy.push(Math.sin(th) * rr); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < N; i++){
        const p = (cl(Math.round(y + oy[i]), h) * w + cl(Math.round(x + ox[i]), w)) * 4;
        r += S[p]; g += S[p + 1]; b += S[p + 2]; a += S[p + 3];
      }
      const o = (y * w + x) * 4; out[o] = r / N; out[o + 1] = g / N; out[o + 2] = b / N; out[o + 3] = a / N;
    }
    return out;
  }
  function pixelate(cv, w, h, bs){
    const sw = Math.max(1, Math.ceil(w / bs)), sh = Math.max(1, Math.ceil(h / bs));
    const t = document.createElement('canvas'); t.width = sw; t.height = sh;
    const tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(cv, 0, 0, sw, sh);
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    const og = o.getContext('2d'); og.imageSmoothingEnabled = false; og.drawImage(t, 0, 0, sw, sh, 0, 0, sw * bs, sh * bs);
    return og.getImageData(0, 0, w, h).data;
  }
  function tilt(S, w, h, sigma){
    const B = gaussBlur(S, w, h, sigma), out = new Uint8ClampedArray(S.length);
    const a = st.ang * Math.PI / 180, sn = Math.sin(a), cs = Math.cos(a), cx = w / 2, cy = st.cy / 100 * h;
    const half = st.band / 100 * h / 2, fall = Math.max(w, h) * 0.2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      let m = (Math.abs((x - cx) * sn - (y - cy) * cs) - half) / fall; m = m < 0 ? 0 : m > 1 ? 1 : m;
      const p = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out[p + c] = S[p + c] * (1 - m) + B[p + c] * m;
    }
    return out;
  }
  function frost(S, w, h, rad){
    const out = new Uint8ClampedArray(S.length); let s = 123456789;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296 - 0.5; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      const p = (cl(Math.round(y + rnd() * 2 * rad), h) * w + cl(Math.round(x + rnd() * 2 * rad), w)) * 4, o = (y * w + x) * 4;
      out[o] = S[p]; out[o + 1] = S[p + 1]; out[o + 2] = S[p + 2]; out[o + 3] = S[p + 3];
    }
    return boxBlur(out, w, h, Math.round(rad * 0.25));
  }
  function blurPixels(cv, S, w, h){
    const R = st.str / 100 * 100 * Math.max(w, h) / 1000;
    switch (st.type){
      case 'gauss':  return gaussBlur(S, w, h, R * 0.5);
      case 'box':    return boxBlur(S, w, h, Math.round(R * 0.5));
      case 'motion': return motion(S, w, h, R * 1.2, st.ang * Math.PI / 180);
      case 'zoom':   return zoom(S, w, h, st.cx / 100 * w, st.cy / 100 * h, st.str / 100 * 0.6);
      case 'spin':   return spin(S, w, h, st.cx / 100 * w, st.cy / 100 * h, st.str / 100 * Math.PI / 2);
      case 'bokeh':  return bokeh(S, w, h, R * 0.5);
      case 'pixel':  return pixelate(cv, w, h, Math.max(2, Math.round(R * 0.6)));
      case 'tilt':   return tilt(S, w, h, R * 0.5);
      case 'frost':  return frost(S, w, h, R * 0.4);
    }
    return S;
  }

  /* ================= Kuas (mask) ================= */
  function maskCanvas(w, h){
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#fff';
    st.strokes.forEach(s => {
      g.globalCompositeOperation = s.e ? 'destination-out' : 'source-over';
      g.lineWidth = s.b * Math.max(w, h); g.beginPath();
      s.p.forEach((q, i) => { const x = q[0] * w, y = q[1] * h; if (!i) g.moveTo(x, y); g.lineTo(x, y); });
      g.stroke();
    });
    return c;
  }
  function applyMask(S, B, w, h, mc){
    mc = mc || maskCanvas(w, h);
    const md = mc.getContext('2d').getImageData(0, 0, w, h).data;
    const A = gaussBlur(md, w, h, Math.max(0.5, Math.max(w, h) * 0.0004 * st.brush));
    const out = new Uint8ClampedArray(S.length);
    for (let p = 0; p < out.length; p += 4){
      const m = A[p + 3] / 255, k = 1 - m;
      out[p] = B[p] * m + S[p] * k; out[p + 1] = B[p + 1] * m + S[p + 1] * k;
      out[p + 2] = B[p + 2] * m + S[p + 2] * k; out[p + 3] = B[p + 3] * m + S[p + 3] * k;
    }
    return out;
  }

  /* ================= Pratinjau ================= */
  function schedule(overlay){ if (overlay) wantOverlay = true; if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
  function render(){
    if (!prevCv) return;
    const w = prevCv.width, h = prevCv.height;
    if (canvas.width !== w){ canvas.width = maskView.width = w; canvas.height = maskView.height = h; }
    const key = [st.type, st.str, st.ang, st.cx, st.cy, st.band].join('|');
    if (key !== cacheKey){ cacheB = st.str === 0 ? prevS : blurPixels(prevCv, prevS, w, h); cacheKey = key; }
    let out = cacheB, mc = null;
    if (st.area === 'brush'){ mc = maskCanvas(w, h); out = applyMask(prevS, cacheB, w, h, mc); }
    canvas.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
    if (wantOverlay && mc){
      const g = maskView.getContext('2d'); g.clearRect(0, 0, w, h); g.drawImage(mc, 0, 0);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(29,185,84,.55)'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
      maskView.classList.add('show'); clearTimeout(overlayTimer); overlayTimer = setTimeout(() => maskView.classList.remove('show'), 900);
    }
    wantOverlay = false;
  }

  /* ================= Kontrol ================= */
  const PARAMS = {
    str:   { l:'Kekuatan',    min:0,  max:100, def:40, u:'' },
    ang:   { l:'Sudut',       min:0,  max:180, def:0,  u:'°' },
    cx:    { l:'Pusat X',     min:0,  max:100, def:50, u:'%' },
    cy:    { l:'Pusat Y',     min:0,  max:100, def:50, u:'%' },
    band:  { l:'Lebar fokus', min:2,  max:100, def:25, u:'%' },
    brush: { l:'Kuas',        min:2,  max:40,  def:10, u:'%' }
  };
  const TYPES = [
    { id:'gauss', n:'Gaussian', p:['str'] }, { id:'box', n:'Box', p:['str'] }, { id:'motion', n:'Gerak', p:['str','ang'] },
    { id:'zoom', n:'Zoom', p:['str','cx','cy'] }, { id:'spin', n:'Putar', p:['str','cx','cy'] }, { id:'bokeh', n:'Bokeh', p:['str'] },
    { id:'pixel', n:'Pixel', p:['str'] }, { id:'tilt', n:'Tilt-shift', p:['str','band','ang','cy'] }, { id:'frost', n:'Kaca', p:['str'] }
  ];
  let curKey = 'str';
  const chipsEl = $('chips'), rg = $('rg'), nu = $('nu'), rs = $('rs');
  const keys = () => TYPES.find(t => t.id === st.type).p.concat(st.area === 'brush' ? ['brush'] : []);
  const label = k => (st.type === 'tilt' && k === 'cy') ? 'Posisi' : PARAMS[k].l;

  function sync(){
    const ks = keys(); if (ks.indexOf(curKey) < 0) curKey = ks[0];
    const d = PARAMS[curKey], v = st[curKey];
    rg.min = nu.min = d.min; rg.max = nu.max = d.max; rg.value = nu.value = v; nu.dataset.cur = v; rs.disabled = (v === d.def);
    chipsEl.innerHTML = '';
    ks.forEach(k => {
      const b = document.createElement('button'), p = PARAMS[k];
      b.type = 'button'; b.className = 'chip' + (k === curKey ? ' act' : '');
      b.innerHTML = (st[k] !== p.def ? '<span class="dot"></span>' : '') + '<small>' + label(k) + '</small><b>' + st[k] + p.u + '</b>';
      b.addEventListener('click', () => { curKey = k; sync(); });
      chipsEl.appendChild(b);
    });
  }
  function setP(v, fromNum){
    const d = PARAMS[curKey]; v = Math.min(d.max, Math.max(d.min, Math.round(v)));
    st[curKey] = v; rg.value = v; nu.dataset.cur = v; if (!fromNum) nu.value = v;
    rs.disabled = (v === d.def); sync(); schedule();
  }
  function bindNumber(el, apply){
    el.addEventListener('input', () => {
      if (el.value === '' || el.value === '-') return;
      const min = +el.min, max = +el.max; let v = Math.round(+el.value);
      if (v > max){ v = max; el.value = max; }
      if (v >= min) apply(v);
    });
    el.addEventListener('change', () => {
      const min = +el.min, max = +el.max; let v = Math.round(+el.value);
      if (isNaN(v) || el.value === '') v = +el.dataset.cur;
      v = Math.min(max, Math.max(min, v)); el.value = v; apply(v);
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); });
  }
  rg.addEventListener('input', () => setP(+rg.value));
  rs.addEventListener('click', () => setP(PARAMS[curKey].def));
  bindNumber(nu, v => setP(v, true));
  [['stepM', -1], ['stepP', 1]].forEach(([id, dir]) => {
    const b = $(id); let t, iv;
    const go = () => setP(st[curKey] + dir), stop = () => { clearTimeout(t); clearInterval(iv); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); go(); t = setTimeout(() => { iv = setInterval(go, 60); }, 400); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
  $('resetAll').addEventListener('click', () => { Object.keys(PARAMS).forEach(k => { st[k] = PARAMS[k].def; }); sync(); schedule(); });

  // Jenis blur
  const typesEl = $('types');
  TYPES.forEach(t => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'type-btn' + (t.id === st.type ? ' active' : ''); b.textContent = t.n;
    b.addEventListener('click', () => {
      st.type = t.id; typesEl.querySelectorAll('.type-btn').forEach(x => x.classList.toggle('active', x === b)); sync(); schedule();
    });
    typesEl.appendChild(b);
  });

  // Area + kuas
  function seg(id, fn){
    const box = $(id);
    box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      box.querySelectorAll('button').forEach(x => x.classList.remove('active')); b.classList.add('active'); fn(b);
    }));
  }
  seg('areaSeg', b => {
    st.area = b.dataset.a; $('brushBox').hidden = st.area !== 'brush'; canvas.classList.toggle('painting', st.area === 'brush');
    sync(); schedule(st.area === 'brush');
  });
  seg('modeSeg', b => { st.erase = b.dataset.m === 'erase'; });
  $('undoBtn').addEventListener('click', () => { st.strokes.pop(); schedule(true); });
  $('clearBtn').addEventListener('click', () => { st.strokes = []; schedule(true); });

  let stroke = null;
  const pt = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  canvas.addEventListener('pointerdown', e => {
    if (st.area !== 'brush') return;
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    stroke = { e: st.erase, b: st.brush / 100, p: [pt(e)] }; st.strokes.push(stroke); schedule(true);
  });
  canvas.addEventListener('pointermove', e => {
    if (!stroke) return;
    const p = pt(e), l = stroke.p[stroke.p.length - 1];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 0.002) return;
    stroke.p.push(p); schedule(true);
  });
  ['pointerup', 'pointercancel'].forEach(ev => canvas.addEventListener(ev, () => { stroke = null; }));
  canvas.addEventListener('contextmenu', e => { if (st.area === 'brush') e.preventDefault(); });

  /* ================= Unduh + muat foto ================= */
  let tt;
  function toast(msg){
    $('toastMsg').textContent = msg; $('toast').classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => $('toast').classList.remove('show'), 1800);
  }
  $('downloadBtn').addEventListener('click', () => {
    if (!src) return;
    const btn = $('downloadBtn'); btn.disabled = true; toast('Memproses…');
    setTimeout(() => {
      try {
        const w = src.width, h = src.height, S = src.getContext('2d').getImageData(0, 0, w, h).data;
        const B = st.str === 0 ? S : blurPixels(src, S, w, h);
        const out = st.area === 'brush' ? applyMask(S, B, w, h) : B;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
        c.toBlob(blob => {
          btn.disabled = false;
          if (!blob) return toast('Gagal membuat file');
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'blur-' + st.type + '.png';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          toast('PNG diunduh');
        }, 'image/png');
      } catch (err) { btn.disabled = false; toast('Gagal memproses, coba foto lebih kecil'); }
    }, 40);
  });

  function scaled(im, max){
    const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, c.width, c.height); return c;
  }
  function load(file){
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const base = document.createElement('canvas'); base.width = im.naturalWidth; base.height = im.naturalHeight;
      base.getContext('2d').drawImage(im, 0, 0); URL.revokeObjectURL(url);
      src = scaled(base, SRC_MAX); prevCv = scaled(src, PREVIEW_MAX);
      prevS = prevCv.getContext('2d').getImageData(0, 0, prevCv.width, prevCv.height).data;
      cacheKey = ''; st.strokes = []; canvas.width = 0;
      dropzone.hidden = true; editor.hidden = false; sync(); render();
    };
    im.onerror = () => toast('Foto tidak bisa dibuka');
    im.src = url;
  }
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { load(fileInput.files[0]); fileInput.value = ''; });
  $('changeBtn').addEventListener('click', () => fileInput.click());
  ['dragover','dragenter'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
  dropzone.addEventListener('drop', e => load(e.dataTransfer.files[0]));
})();
