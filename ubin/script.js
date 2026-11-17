(function(){
  const $ = id => document.getElementById(id);
  const dropzone = $('dropzone'), fileInput = $('fileInput'), editor = $('editor'), canvas = $('canvas');
  const SRC_MAX = 800, PREVIEW_MAX = 720, CMIN = 64, CMAX = 4096;
  let src = null, tintCv = null, raf = 0;
  const st = { w:1080, h:1080, size:200, gap:0, offset:0, rot:0, sx:0, sy:0, mode:'row', mirror:false, bg:'transparent', tint:false, tintColor:'#111112' };

  // ---- Gambar pola (cv = kanvas tujuan, s = skala; pratinjau kecil, unduhan skala 1) ----
  function render(cv, s){
    const img = st.tint && tintCv ? tintCv : src;
    const W = Math.round(st.w * s), H = Math.round(st.h * s);
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    if (st.bg !== 'transparent'){ g.fillStyle = st.bg; g.fillRect(0, 0, W, H); }
    const k = st.size * s / Math.max(img.width, img.height);
    const snap = st.rot === 0; // tanpa rotasi: tepi ubin dibulatkan ke piksel utuh (tanpa garis tipis)
    let tw = img.width * k, th = img.height * k;
    if (snap){ tw = Math.max(1, Math.round(tw)); th = Math.max(1, Math.round(th)); }
    const cw = tw + st.gap * s, ch = th + st.gap * s, off = st.offset / 100;
    const ox = st.sx * s, oy = st.sy * s;
    const rmax = Math.ceil((H / 2 + Math.abs(oy)) / ch) + 2, cmax = Math.ceil((W / 2 + Math.abs(ox)) / cw) + 2;
    const rad = st.rot * Math.PI / 180, odd = n => Math.abs(n) % 2 === 1;
    for (let r = -rmax; r <= rmax; r++){
      for (let c = -cmax; c <= cmax; c++){
        let x = W / 2 + c * cw + ox, y = H / 2 + r * ch + oy;
        if (st.mode === 'row' && odd(r)) x += off * cw;
        if (st.mode === 'col' && odd(c)) y += off * ch;
        const fx = st.mirror && odd(c), fy = st.mirror && odd(r);
        g.save();
        if (snap){
          g.translate(Math.round(x - tw / 2) + (fx ? tw : 0), Math.round(y - th / 2) + (fy ? th : 0));
          g.scale(fx ? -1 : 1, fy ? -1 : 1);
          g.drawImage(img, 0, 0, tw, th);
        } else {
          g.translate(x, y); g.rotate(rad); g.scale(fx ? -1 : 1, fy ? -1 : 1);
          g.drawImage(img, -tw / 2, -th / 2, tw, th);
        }
        g.restore();
      }
    }
  }
  function draw(){ if (src) render(canvas, Math.min(1, PREVIEW_MAX / Math.max(st.w, st.h))); }
  function schedule(){ if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }

  // Gambar satu warna: pertahankan transparansi, ganti semua warna piksel
  function buildTint(){
    if (!src) return;
    tintCv = document.createElement('canvas'); tintCv.width = src.width; tintCv.height = src.height;
    const t = tintCv.getContext('2d');
    t.fillStyle = st.tintColor; t.fillRect(0, 0, src.width, src.height);
    t.globalCompositeOperation = 'destination-in'; t.drawImage(src, 0, 0);
  }

  // ---- Kolom angka: batas atas langsung dipaksa, batas bawah saat selesai mengetik ----
  function bindNumber(el, apply){
    el.addEventListener('input', () => {
      if (el.value === '' || el.value === '-') return;
      const min = +el.min, max = +el.max;
      let v = Math.round(+el.value);
      if (v > max){ v = max; el.value = max; }
      if (v >= min) apply(v);
    });
    el.addEventListener('change', () => {
      const min = +el.min, max = +el.max;
      let v = Math.round(+el.value);
      if (isNaN(v) || el.value === '') v = +el.dataset.cur;
      v = Math.min(max, Math.max(min, v)); el.value = v; apply(v);
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); });
  }

  // ---- Pengaturan pola: chip + satu slider ----
  const PR = [
    { k:'size',   l:'Ukuran',  min:30,   max:600, def:200, u:'' },
    { k:'gap',    l:'Jarak',   min:0,    max:200, def:0,   u:'' },
    { k:'offset', l:'Offset',  min:0,    max:100, def:0,   u:'%' },
    { k:'rot',    l:'Rotasi',  min:-180, max:180, def:0,   u:'°' },
    { k:'sx',     l:'Geser X', min:-500, max:500, def:0,   u:'' },
    { k:'sy',     l:'Geser Y', min:-500, max:500, def:0,   u:'' }
  ];
  let cur = 0;
  const chipsEl = $('chips'), rg = $('rg'), nu = $('nu'), rs = $('rs');
  function buildChips(){
    chipsEl.innerHTML = '';
    PR.forEach((d, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (i === cur ? ' act' : '');
      b.innerHTML = (st[d.k] !== d.def ? '<span class="dot"></span>' : '') + '<small>' + d.l + '</small><b>' + st[d.k] + d.u + '</b>';
      b.addEventListener('click', () => { cur = i; sync(); });
      chipsEl.appendChild(b);
    });
  }
  function sync(){
    const d = PR[cur], v = st[d.k];
    rg.min = nu.min = d.min; rg.max = nu.max = d.max; rg.value = nu.value = v; nu.dataset.cur = v;
    rs.disabled = (v === d.def); buildChips();
  }
  function setP(v, fromNum){
    const d = PR[cur];
    v = Math.min(d.max, Math.max(d.min, Math.round(v)));
    st[d.k] = v; rg.value = v; nu.dataset.cur = v;
    if (!fromNum) nu.value = v;
    rs.disabled = (v === d.def); buildChips(); schedule();
  }
  rg.addEventListener('input', () => setP(+rg.value));
  rs.addEventListener('click', () => setP(PR[cur].def));
  bindNumber(nu, v => setP(v, true));
  [['stepM', -1], ['stepP', 1]].forEach(([id, dir]) => {
    const b = $(id); let t, iv;
    const go = () => setP(st[PR[cur].k] + dir);
    const stop = () => { clearTimeout(t); clearInterval(iv); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); go(); t = setTimeout(() => { iv = setInterval(go, 60); }, 400); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
    b.addEventListener('contextmenu', e => e.preventDefault());
  });

  // ---- Arah offset (buka ke bawah), mirror, ganti warna ----
  const modeBtn = $('modeBtn'), modePanel = $('modePanel');
  function setMode(v){
    st.mode = v; $('modeLabel').textContent = v === 'row' ? 'Baris' : 'Kolom';
    modePanel.querySelectorAll('.opt-item').forEach(x => x.classList.toggle('active', x.dataset.v === v)); schedule();
  }
  function togglePanel(open){ modePanel.hidden = !open; modeBtn.setAttribute('aria-expanded', open); }
  modeBtn.addEventListener('click', () => togglePanel(modePanel.hidden));
  modePanel.querySelectorAll('.opt-item').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.v); togglePanel(false); }));

  function setMirror(on){ st.mirror = on; $('mirrorSw').setAttribute('aria-checked', on); schedule(); }
  $('mirrorSw').addEventListener('click', () => setMirror(!st.mirror));

  function setTint(on){ st.tint = on; $('tintSw').setAttribute('aria-checked', on); $('tintBox').hidden = !on; if (on) buildTint(); schedule(); }
  $('tintSw').addEventListener('click', () => setTint(!st.tint));
  const tintBox = $('tintBox');
  function pickTint(color, el){
    st.tintColor = color; tintBox.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    el.classList.add('active'); buildTint(); schedule();
  }
  tintBox.querySelectorAll('button.swatch').forEach(b => b.addEventListener('click', () => pickTint(b.dataset.color, b)));
  $('tintCustom').addEventListener('input', e => pickTint(e.target.value, e.target.closest('.swatch')));

  $('resetAll').addEventListener('click', () => {
    PR.forEach(d => { st[d.k] = d.def; });
    setMode('row'); setMirror(false); sync(); schedule();
  });

  // ---- Ukuran kanvas (preset + bebas) ----
  const wIn = $('wIn'), hIn = $('hIn');
  function setCanvas(w, h){ st.w = w; st.h = h; wIn.value = w; hIn.value = h; wIn.dataset.cur = w; hIn.dataset.cur = h; schedule(); }
  bindNumber(wIn, v => { st.w = v; wIn.dataset.cur = v; schedule(); });
  bindNumber(hIn, v => { st.h = v; hIn.dataset.cur = v; schedule(); });
  wIn.dataset.cur = hIn.dataset.cur = 1080;
  const sizeSeg = $('sizeSeg');
  sizeSeg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    sizeSeg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $('customSize').hidden = !b.dataset.custom;
    if (!b.dataset.custom) setCanvas(+b.dataset.w, +b.dataset.h);
  }));

  // ---- Latar belakang ----
  const swatches = $('bgSwatches');
  function setBg(color, el){
    st.bg = color; swatches.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    el.classList.add('active'); schedule();
  }
  swatches.querySelectorAll('button.swatch').forEach(b => b.addEventListener('click', () => setBg(b.dataset.color, b)));
  $('customColor').addEventListener('input', e => setBg(e.target.value, e.target.closest('.swatch')));

  // ---- Unduh (selalu ukuran penuh) ----
  let tt;
  function toast(msg){
    $('toastMsg').textContent = msg; $('toast').classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => $('toast').classList.remove('show'), 1600);
  }
  $('downloadBtn').addEventListener('click', () => {
    if (!src) return;
    const out = document.createElement('canvas');
    render(out, 1);
    out.toBlob(blob => {
      if (!blob) return toast('Gagal, coba ukuran kanvas lebih kecil');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'ubin-' + st.w + 'x' + st.h + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('PNG diunduh');
    }, 'image/png');
  });

  // ---- Muat gambar ----
  function load(file){
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, SRC_MAX / Math.max(im.naturalWidth, im.naturalHeight));
      src = document.createElement('canvas');
      src.width = Math.max(1, Math.round(im.naturalWidth * k)); src.height = Math.max(1, Math.round(im.naturalHeight * k));
      const sg = src.getContext('2d'); sg.imageSmoothingQuality = 'high'; sg.drawImage(im, 0, 0, src.width, src.height);
      URL.revokeObjectURL(url);
      if (st.tint) buildTint();
      dropzone.hidden = true; editor.hidden = false; sync(); draw();
    };
    im.onerror = () => toast('Gambar tidak bisa dibuka');
    im.src = url;
  }
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { load(fileInput.files[0]); fileInput.value = ''; });
  $('changeBtn').addEventListener('click', () => fileInput.click());
  ['dragover','dragenter'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
  dropzone.addEventListener('drop', e => load(e.dataTransfer.files[0]));
})();
