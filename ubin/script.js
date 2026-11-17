(function(){
  const $ = id => document.getElementById(id);
  const dropzone = $('dropzone'), fileInput = $('fileInput'), editor = $('editor');
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const SRC_MAX = 800;
  let src = null, raf = 0;
  const st = { w:1080, h:1080, size:200, gap:0, offset:0, rot:0, mode:'row', mirror:false, bg:'transparent' };

  function schedule(){ if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }

  function draw(){
    if (!src) return;
    canvas.width = st.w; canvas.height = st.h;
    ctx.clearRect(0, 0, st.w, st.h);
    if (st.bg !== 'transparent'){ ctx.fillStyle = st.bg; ctx.fillRect(0, 0, st.w, st.h); }
    const k = st.size / Math.max(src.width, src.height);
    const tw = src.width * k, th = src.height * k;
    const cw = tw + st.gap, ch = th + st.gap, off = st.offset / 100;
    const rmax = Math.ceil(st.h / 2 / ch) + 2, cmax = Math.ceil(st.w / 2 / cw) + 2;
    const rad = st.rot * Math.PI / 180, odd = n => Math.abs(n) % 2 === 1;
    for (let r = -rmax; r <= rmax; r++){
      for (let c = -cmax; c <= cmax; c++){
        let x = st.w / 2 + c * cw, y = st.h / 2 + r * ch;
        if (st.mode === 'row' && odd(r)) x += off * cw;
        if (st.mode === 'col' && odd(c)) y += off * ch;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(rad);
        ctx.scale(st.mirror && odd(c) ? -1 : 1, st.mirror && odd(r) ? -1 : 1);
        ctx.drawImage(src, -tw / 2, -th / 2, tw, th);
        ctx.restore();
      }
    }
  }

  // Slider + tombol +/-
  [['size','size'],['gap','gap'],['offset','offset'],['rot','rot']].forEach(([id, key]) => {
    const el = $(id), out = $(id + 'Val');
    el.addEventListener('input', () => { st[key] = +el.value; out.textContent = el.value; schedule(); });
  });
  document.querySelectorAll('.step-btn').forEach(b => b.addEventListener('click', () => {
    const el = $(b.dataset.for), v = Math.min(+el.max, Math.max(+el.min, +el.value + +b.dataset.step));
    el.value = v; el.dispatchEvent(new Event('input'));
  }));

  // Tombol pilihan (segmented)
  function seg(id, fn){
    const box = $(id);
    box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      box.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); fn(b); schedule();
    }));
  }
  seg('modeSeg', b => st.mode = b.dataset.v);
  seg('mirrorSeg', b => st.mirror = b.dataset.v === '1');
  seg('sizeSeg', b => { st.w = +b.dataset.w; st.h = +b.dataset.h; });

  // Latar belakang
  const swatches = $('bgSwatches');
  function setBg(color, el){
    st.bg = color;
    swatches.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    el.classList.add('active'); schedule();
  }
  swatches.querySelectorAll('button.swatch').forEach(b => b.addEventListener('click', () => setBg(b.dataset.color, b)));
  $('customColor').addEventListener('input', e => setBg(e.target.value, e.target.closest('.swatch')));

  // Unduh
  let tt;
  function toast(msg){
    $('toastMsg').textContent = msg; $('toast').classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => $('toast').classList.remove('show'), 1600);
  }
  $('downloadBtn').addEventListener('click', () => {
    draw();
    canvas.toBlob(blob => {
      if (!blob) return toast('Gagal membuat file');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'ubin-' + st.w + 'x' + st.h + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('PNG diunduh');
    }, 'image/png');
  });

  // Muat gambar
  function load(file){
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, SRC_MAX / Math.max(im.naturalWidth, im.naturalHeight));
      src = document.createElement('canvas');
      src.width = Math.max(1, Math.round(im.naturalWidth * k)); src.height = Math.max(1, Math.round(im.naturalHeight * k));
      src.getContext('2d').drawImage(im, 0, 0, src.width, src.height);
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
