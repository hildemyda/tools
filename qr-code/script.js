(function(){
  const $ = id => document.getElementById(id);
  const textInput = $('textInput'), canvas = $('canvas'), emptyHint = $('emptyHint');
  const fgColor = $('fgColor'), bgColor = $('bgColor'), transToggle = $('transToggle');
  const marginRange = $('marginRange'), marginVal = $('marginVal');
  const pngBtn = $('downloadPngBtn'), svgBtn = $('downloadSvgBtn');
  const state = { level: 'M', size: 1024, transparent: false };
  let current = null; // hasil encode terakhir

  // ---- Utilitas warna ----
  function lum(hex){
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function ratio(a, b){
    const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  // ---- Gambar ke kanvas dengan skala bulat supaya tepi kotak tajam ----
  function draw(cv, px, margin){
    const total = current.size + margin * 2;
    const scale = Math.max(1, Math.floor(px / total));
    cv.width = cv.height = total * scale;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!state.transparent){ ctx.fillStyle = bgColor.value; ctx.fillRect(0, 0, cv.width, cv.height); }
    ctx.fillStyle = fgColor.value;
    for (let y = 0; y < current.size; y++){
      for (let x = 0; x < current.size; x++){
        if (current.modules[y][x]) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
      }
    }
  }

  function svgString(margin){
    const total = current.size + margin * 2;
    let d = '';
    for (let y = 0; y < current.size; y++){
      for (let x = 0; x < current.size; x++){
        if (current.modules[y][x]) d += 'M' + (x + margin) + ' ' + (y + margin) + 'h1v1h-1z';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges">' +
      (state.transparent ? '' : '<rect width="' + total + '" height="' + total + '" fill="' + bgColor.value + '"/>') +
      '<path d="' + d + '" fill="' + fgColor.value + '"/></svg>';
  }

  // ---- Perbarui tampilan ----
  function update(){
    const text = textInput.value;
    const bytes = new TextEncoder().encode(text).length;
    $('charNote').textContent = text.length + ' karakter' + (bytes !== text.length ? ' (' + bytes + ' byte)' : '');
    marginVal.textContent = marginRange.value;

    // peringatan warna
    const warn = $('colorWarn');
    let msg = '';
    if (!state.transparent){
      if (lum(fgColor.value) > lum(bgColor.value)) msg = 'Warna QR lebih terang dari latar. Sebagian aplikasi pemindai tidak bisa membaca QR terbalik.';
      else if (ratio(fgColor.value, bgColor.value) < 3) msg = 'Kontras warna rendah, QR bisa sulit dipindai.';
    } else {
      msg = 'Latar transparan: pastikan QR nanti ditaruh di atas warna yang terang.';
    }
    warn.textContent = msg; warn.hidden = !msg;

    if (!text){
      current = null; emptyHint.classList.remove('hidden');
      canvas.width = canvas.height = 300;
      canvas.getContext('2d').clearRect(0, 0, 300, 300);
      pngBtn.disabled = svgBtn.disabled = true;
      $('qrInfo').textContent = '';
      return;
    }
    try {
      current = QR.encode(text, state.level);
    } catch (err) {
      current = null; pngBtn.disabled = svgBtn.disabled = true;
      emptyHint.textContent = 'Teks terlalu panjang untuk QR Code. Persingkat atau turunkan level ketahanan.';
      emptyHint.classList.remove('hidden');
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      $('qrInfo').textContent = '';
      return;
    }
    emptyHint.classList.add('hidden');
    const margin = +marginRange.value;
    draw(canvas, 340 * Math.min(window.devicePixelRatio || 1, 2), margin);
    pngBtn.disabled = svgBtn.disabled = false;
    $('qrInfo').textContent = current.size + '×' + current.size + ' kotak · versi ' + current.version;
  }

  // ---- Unduh ----
  function save(blob, name){
    const a = document.createElement('a');
    a.download = name; a.href = URL.createObjectURL(blob); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    showToast('Berhasil diunduh');
  }
  pngBtn.addEventListener('click', () => {
    if (!current) return;
    const out = document.createElement('canvas');
    draw(out, state.size, +marginRange.value);
    out.toBlob(b => { if (b) save(b, 'qrcode.png'); else showToast('Gagal membuat gambar'); }, 'image/png');
  });
  svgBtn.addEventListener('click', () => {
    if (!current) return;
    save(new Blob([svgString(+marginRange.value)], { type: 'image/svg+xml' }), 'qrcode.svg');
  });

  function showToast(msg){
    $('toastMsg').textContent = msg; $('toast').classList.add('show');
    clearTimeout(showToast._t); showToast._t = setTimeout(() => $('toast').classList.remove('show'), 2200);
  }

  // ---- Kontrol ----
  function chipGroup(rowId, attr, apply){
    $(rowId).addEventListener('click', e => {
      const b = e.target.closest('.toggle-chip'); if (!b) return;
      [].forEach.call($(rowId).querySelectorAll('.toggle-chip'), c => c.classList.toggle('active', c === b));
      apply(b.dataset[attr]);
    });
  }
  chipGroup('levelRow', 'level', v => { state.level = v; emptyHint.textContent = 'Ketik isi QR di atas buat mulai'; update(); });
  chipGroup('sizeRow', 'size', v => { state.size = +v; });
  transToggle.addEventListener('click', () => {
    state.transparent = !state.transparent;
    transToggle.classList.toggle('active', state.transparent);
    bgColor.disabled = state.transparent;
    update();
  });
  [textInput, fgColor, bgColor, marginRange].forEach(el => el.addEventListener('input', () => {
    if (el === textInput) emptyHint.textContent = 'Ketik isi QR di atas buat mulai';
    update();
  }));

  update();
})();
