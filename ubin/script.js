(function(){
  const $ = id => document.getElementById(id);
  const dropzone = $('dropzone'), fileInput = $('fileInput'), editor = $('editor'), canvas = $('canvas');
  const SRC_MAX = 800, PREVIEW_MAX = 720, CMIN = 64, CMAX = 4096;
  let src = null, raf = 0;
  const st = { w:1080, h:1080, size:200, gap:0, offset:0, rot:0, mode:'row', mirror:false, bg:'transparent' };

  // ---- Gambar pola (cv = kanvas tujuan, s = skala; pratinjau kecil, unduhan skala 1) ----
  function render(cv, s){
    const W = Math.round(st.w * s), H = Math.round(st.h * s);
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    if (st.bg !== 'transparent'){ g.fillStyle = st.bg; g.fillRect(0, 0, W, H); }
    const k = st.size * s / Math.max(src.width, src.height);
    const snap = st.rot === 0; // tanpa rotasi: tepi ubin dibulatkan ke piksel utuh (tanpa garis tipis)
    let tw = src.width * k, th = src.height * k;
    if (snap){ tw = Math.max(1, Math.round(tw)); th = Math.max(1, Math.round(th)); }
    const cw = tw + st.gap * s, ch = th + st.gap * s, off = st.offset / 100;
    const rmax = Math.ceil(H / 2 / ch) + 2, cmax = Math.ceil(W / 2 / cw) + 2;
    const rad = st.rot * Math.PI / 180, odd = n => Math.abs(n) % 2 === 1;
    for (let r = -rmax; r <= rmax; r++){
      for (let c = -cmax; c <= cmax; c++){
        let x = W / 2 + c * cw, y = H / 2 + r * ch;
        if (st.mode === 'row' && odd(r)) x += off * cw;
        if (st.mode === 'col' && odd(c)) y += off * ch;
        const fx = st.mirror && odd(c), fy = st.mirror && odd(r);
        g.save();
        if (snap){
          g.translate(Math.round(x - tw / 2) + (fx ? tw : 0), Math.round(y - th / 2) + (fy ? th : 0));
          g.scale(fx ? -1 : 1, fy ? -1 : 1);
          g.drawImage(src, 0, 0, tw, th);
        } else {
          g.translate(x, y); g.rotate(rad); g.scale(fx ? -1 : 1, fy ? -1 : 1);
          g.drawImage(src, -tw / 2, -th / 2, tw, th);
        }
        g.restore();
      }
    }
  }
  function draw(){ if (src) render(canvas, Math.min(1, PREVIEW_MAX / Math.max(st.w, st.h))); }
  function schedule(){ if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }

  // ---- Kolom angka: batas atas langsung dipaksa, batas bawah saat selesai mengetik ----
  function bindNumber(el, min, max, apply){
    el.addEventListener('input', () => {
      if (el.value === '' || el.value === '-') return;
      let v = Math.round(+el.value);
      if (v > max){ v = max; el.value = max; }
      if (v >= min) apply(v);
    });
    el.addEventListener('change', () => {
      let v = Math.round(+el.value);
      if (isNaN(v) || el.value === '') v = +el.dataset.cur;
      v = Math.min(max, Math.max(min, v)); el.value = v; apply(v);
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); });
  }

  // ---- Slider ----
  const SL = [
    { k:'size',   label:'Ukuran', min:30,   max:600, def:200, unit:'' },
    { k:'gap',    label:'Jarak',  min:0,    max:200, def:0,   unit:'' },
    { k:'offset', label:'Offset', min:0,    max:100, def:0,   unit:'%' },
    { k:'rot',    label:'Rotasi', min:-180, max:180, def:0,   unit:'°' }
  ];
  const RESET_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
  SL.forEach(d => {
    const el = document.createElement('div'); el.className = 'ctl';
    el.innerHTML =
      '<div class="ctl-head"><span class="ctl-name">' + d.label + '</span><div class="ctl-right">' +
      '<input class="num" type="number" min="' + d.min + '" max="' + d.max + '" step="1" value="' + d.def + '" aria-label="' + d.label + '">' +
      '<span class="unit">' + d.unit + '</span>' +
      '<button type="button" class="reset-btn" aria-label="Reset ' + d.label + '" disabled>' + RESET_SVG + '</button></div></div>' +
      '<div class="slider-control"><button type="button" class="step-btn" data-s="-1">−</button>' +
      '<input type="range" min="' + d.min + '" max="' + d.max + '" step="1" value="' + d.def + '">' +
      '<button type="button" class="step-btn" data-s="1">+</button></div>';
    $('sliders').appendChild(el);
    d.num = el.querySelector('.num'); d.range = el.querySelector('input[type=range]'); d.reset = el.querySelector('.reset-btn');
    d.num.dataset.cur = d.def;
    d.set = (v, fromNum) => {
      v = Math.min(d.max, Math.max(d.min, Math.round(v)));
      st[d.k] = v; d.range.value = v; d.num.dataset.cur = v;
      if (!fromNum) d.num.value = v;
      d.reset.disabled = (v === d.def); schedule();
    };
    d.range.addEventListener('input', () => d.set(+d.range.value));
    d.reset.addEventListener('click', () => d.set(d.def));
    bindNumber(d.num, d.min, d.max, v => d.set(v, true));
    // tombol − / +: 1 per ketukan, tahan untuk mengulang
    el.querySelectorAll('.step-btn').forEach(b => {
      let t, iv;
      const go = () => d.set(+d.range.value + +b.dataset.s);
      const stop = () => { clearTimeout(t); clearInterval(iv); };
      b.addEventListener('pointerdown', e => { e.preventDefault(); go(); t = setTimeout(() => { iv = setInterval(go, 60); }, 400); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
      b.addEventListener('contextmenu', e => e.preventDefault());
    });
  });

  $('modeSel').addEventListener('change', e => { st.mode = e.target.value; schedule(); });
  $('mirrorSel').addEventListener('change', e => { st.mirror = e.target.value === '1'; schedule(); });
  $('resetAll').addEventListener('click', () => {
    SL.forEach(d => d.set(d.def));
    st.mode = 'row'; st.mirror = false; $('modeSel').value = 'row'; $('mirrorSel').value = '0'; schedule();
  });

  // ---- Ukuran kanvas (preset + bebas) ----
  const wIn = $('wIn'), hIn = $('hIn');
  function setCanvas(w, h){ st.w = w; st.h = h; wIn.value = w; hIn.value = h; wIn.dataset.cur = w; hIn.dataset.cur = h; schedule(); }
  bindNumber(wIn, CMIN, CMAX, v => { st.w = v; wIn.dataset.cur = v; schedule(); });
  bindNumber(hIn, CMIN, CMAX, v => { st.h = v; hIn.dataset.cur = v; schedule(); });
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
      dropzone.hidden = true; editor.hidden = false; draw();
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
