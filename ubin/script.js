(function(){
  const $ = id => document.getElementById(id);
  const dropzone = $('dropzone'), fileInput = $('fileInput'), editor = $('editor'), canvas = $('canvas');
  const SRC_MAX = 800, PREVIEW_MAX = 720, CMIN = 64, CMAX = 4096;
  let src = null, bgCv = null, bgUrl = '', raf = 0;
  const st = { w:1080, h:1080, size:200, gap:0, offset:0, rot:0, mode:'row', mirror:false, bgType:'none', bgColor:'#FFFFFF' };

  // ---- Gambar pola (cv = kanvas tujuan, s = skala; pratinjau kecil, unduhan skala 1) ----
  function render(cv, s){
    const img = src;
    const W = Math.round(st.w * s), H = Math.round(st.h * s);
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    if (st.bgType === 'image' && bgCv){
      // gambar latar: penuhi kanvas (cover), dipusatkan
      const bk = Math.max(W / bgCv.width, H / bgCv.height), bw = bgCv.width * bk, bh = bgCv.height * bk;
      g.drawImage(bgCv, (W - bw) / 2, (H - bh) / 2, bw, bh);
    } else if (st.bgType === 'color'){ g.fillStyle = st.bgColor; g.fillRect(0, 0, W, H); }
    const k = st.size * s / Math.max(img.width, img.height);
    const snap = st.rot === 0; // tanpa rotasi: tepi ubin dibulatkan ke piksel utuh (tanpa garis tipis)
    let tw = img.width * k, th = img.height * k;
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
    { k:'rot',    l:'Rotasi',  min:-180, max:180, def:0,   u:'°' }
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

  // ---- Arah offset (buka ke bawah) dan mirror ----
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

  $('resetAll').addEventListener('click', () => {
    PR.forEach(d => { st[d.k] = d.def; });
    setMode('row'); setMirror(false); sync(); schedule();
  });

  // ---- Ukuran kanvas: preset rasio, ukuran selalu tampil, "Ubah" untuk angka bebas ----
  const wIn = $('wIn'), hIn = $('hIn'), sizeSeg = $('sizeSeg'), lockBtn = $('lockBtn');
  let lock = false, ratio = 1;
  function showSize(){
    $('sizeVal').textContent = st.w + ' × ' + st.h + ' px';
    $('sizeBadge').textContent = st.w + ' × ' + st.h;
    wIn.value = st.w; hIn.value = st.h; wIn.dataset.cur = st.w; hIn.dataset.cur = st.h;
    sizeSeg.querySelectorAll('button').forEach(b => b.classList.toggle('active', +b.dataset.w === st.w && +b.dataset.h === st.h));
  }
  function setCanvas(w, h){ st.w = w; st.h = h; showSize(); schedule(); }
  const clampSize = v => Math.min(CMAX, Math.max(CMIN, Math.round(v)));
  bindNumber(wIn, v => { st.w = v; if (lock) st.h = clampSize(v / ratio); showSize(); schedule(); });
  bindNumber(hIn, v => { st.h = v; if (lock) st.w = clampSize(v * ratio); showSize(); schedule(); });
  sizeSeg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => setCanvas(+b.dataset.w, +b.dataset.h)));
  $('editSize').addEventListener('click', () => {
    const box = $('customSize'); box.hidden = !box.hidden; $('editSize').setAttribute('aria-expanded', !box.hidden);
  });
  lockBtn.addEventListener('click', () => {
    lock = !lock; if (lock) ratio = st.w / st.h;
    lockBtn.setAttribute('aria-pressed', lock); lockBtn.classList.toggle('on', lock);
  });
  showSize();

  // ---- Latar belakang: transparan, putih, hitam, warna sendiri, gambar sendiri ----
  const swatches = $('bgSwatches'), colorSwatch = $('colorSwatch'), colorFill = $('colorFill'), customColor = $('customColor');
  const imgSwatch = $('imgSwatch'), imgFill = $('imgFill'), bgImgInput = $('bgImgInput');
  let colorPicked = false;
  function activate(el){ swatches.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s === el)); schedule(); }
  swatches.querySelectorAll('button.swatch[data-type]').forEach(b => {
    if (b === imgSwatch) return;
    b.addEventListener('click', () => {
      if (b.dataset.type === 'none'){ st.bgType = 'none'; }
      else { st.bgType = 'color'; st.bgColor = b.dataset.color; }
      activate(b);
    });
  });
  // warna sendiri: ketuk pertama membuka pemilih warna; setelah ada pilihan, ketuk saat tidak aktif hanya memakainya lagi
  customColor.addEventListener('click', e => {
    if (colorPicked && !colorSwatch.classList.contains('active')){
      e.preventDefault(); st.bgType = 'color'; st.bgColor = customColor.value; activate(colorSwatch);
    }
  });
  customColor.addEventListener('input', () => {
    colorPicked = true; colorFill.classList.add('picked'); colorFill.style.background = customColor.value;
    st.bgType = 'color'; st.bgColor = customColor.value; activate(colorSwatch);
  });
  // gambar sendiri: sama, ketuk saat aktif untuk mengganti gambarnya
  imgSwatch.addEventListener('click', () => {
    if (bgCv && !imgSwatch.classList.contains('active')){ st.bgType = 'image'; activate(imgSwatch); }
    else bgImgInput.click();
  });
  bgImgInput.addEventListener('change', () => {
    const f = bgImgInput.files[0]; bgImgInput.value = '';
    if (!f || !f.type.startsWith('image/')) return;
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => {
      const k = Math.min(1, CMAX / Math.max(im.naturalWidth, im.naturalHeight));
      bgCv = document.createElement('canvas');
      bgCv.width = Math.max(1, Math.round(im.naturalWidth * k)); bgCv.height = Math.max(1, Math.round(im.naturalHeight * k));
      const bg = bgCv.getContext('2d'); bg.imageSmoothingQuality = 'high'; bg.drawImage(im, 0, 0, bgCv.width, bgCv.height);
      if (bgUrl) URL.revokeObjectURL(bgUrl);
      bgUrl = url; imgFill.style.backgroundImage = 'url("' + url + '")'; imgFill.classList.add('picked');
      st.bgType = 'image'; activate(imgSwatch);
    };
    im.onerror = () => { URL.revokeObjectURL(url); toast('Gambar latar tidak bisa dibuka'); };
    im.src = url;
  });

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
      dropzone.hidden = true; editor.hidden = false; sync(); showSize(); draw();
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
