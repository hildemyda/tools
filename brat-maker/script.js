(function(){
  // ══════════════════════════════════════════════════════════════
  //  Port dari plugin bot WhatsApp (@napi-rs/canvas) ke Canvas API browser.
  //  Algoritma (fitText, wrapWords, drawLine, downscale-upscale buat efek
  //  buram) dipertahankan SAMA PERSIS — cuma sumber teksnya dari <textarea>,
  //  bukan flag command, dan gak perlu render/encode buffer manual karena
  //  browser bisa drawImage(canvas, ...) antar-canvas langsung.
  // ══════════════════════════════════════════════════════════════

  const CANVAS_SIZE = 512;
  const PAD = 28;
  const MAX_FONT = 260;
  const MIN_FONT = 14;
  const FONT_STEP = 2;
  const LINE_H_RATIO = 0.92;
  const LINE_GAP_PX = 8;
  const BLUR_PX = 1.4;
  const RENDER_SCALE = 0.5;

  const FONT_FAMILY = "'Archivo Narrow', 'Arial Narrow', Arial, sans-serif";
  const fontString = (size) => `${size}px ${FONT_FAMILY}`;
  const lineHeightFor = (fontSize) => fontSize * LINE_H_RATIO + LINE_GAP_PX;

  function toWords(text){
    return text.trim().split(/\s+/).filter(Boolean);
  }

  function wrapWords(ctx, words, maxWidth){
    const lines = [];
    let current = [];
    for (const w of words) {
      const test = [...current, w].join(' ');
      if (current.length > 0 && ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = [w];
      } else {
        current.push(w);
      }
    }
    if (current.length) lines.push(current);
    return lines;
  }

  function fitText(ctx, words, boxW, boxH){
    let fontSize = MAX_FONT;
    let lines = [words];

    for (; fontSize >= MIN_FONT; fontSize -= FONT_STEP) {
      ctx.font = fontString(fontSize);
      const wrapped = wrapWords(ctx, words, boxW);
      const lineH = lineHeightFor(fontSize);
      const totalH = wrapped.length * lineH;
      const widest = Math.max(...wrapped.map(l => ctx.measureText(l.join(' ')).width));
      if (totalH <= boxH && widest <= boxW) { lines = wrapped; break; }
      lines = wrapped;
    }

    return { fontSize: Math.max(fontSize, MIN_FONT), lines };
  }

  function drawLine(ctx, words, x, y, boxW, isLastLine){
    const shouldJustify = words.length > 1 && !isLastLine;

    if (!shouldJustify) {
      ctx.textAlign = 'left';
      ctx.fillText(words.join(' '), x, y);
      return;
    }

    const widths = words.map(w => ctx.measureText(w).width);
    const wordsWidth = widths.reduce((a, b) => a + b, 0);
    const gap = (boxW - wordsWidth) / (words.length - 1);

    ctx.textAlign = 'left';
    let cx = x;
    words.forEach((w, i) => {
      ctx.fillText(w, cx, y);
      cx += widths[i] + gap;
    });
  }

  // ---- UI wiring ----
  const textInput = document.getElementById('textInput');
  const darkToggle = document.getElementById('darkToggle');
  const hdToggle = document.getElementById('hdToggle');
  const nobgToggle = document.getElementById('nobgToggle');
  const canvas = document.getElementById('canvas');
  const finalCtx = canvas.getContext('2d');
  const emptyHint = document.getElementById('emptyHint');
  const downloadPngBtn = document.getElementById('downloadPngBtn');
  const downloadWebpBtn = document.getElementById('downloadWebpBtn');
  const shareBtn = document.getElementById('shareBtn');
  const toast = document.getElementById('toast');

  [darkToggle, hdToggle, nobgToggle].forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      render();
    });
  });

  let renderTimer = null;
  textInput.addEventListener('input', () => {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 120);
  });

  function render(){
    const text = textInput.value.trim();
    finalCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (!text) {
      emptyHint.classList.remove('hidden');
      downloadPngBtn.disabled = true;
      downloadWebpBtn.disabled = true;
      shareBtn.disabled = true;
      return;
    }
    emptyHint.classList.add('hidden');
    downloadPngBtn.disabled = false;
    downloadWebpBtn.disabled = false;
    shareBtn.disabled = false;

    const dark = darkToggle.classList.contains('active');
    const hd = hdToggle.classList.contains('active');
    const nobg = nobgToggle.classList.contains('active');

    const renderScale = hd ? 1 : RENDER_SCALE;
    const blurPx = hd ? 0 : BLUR_PX;

    const words = toWords(text);
    const boxW = CANVAS_SIZE - PAD * 2;
    const boxH = CANVAS_SIZE - PAD * 2;

    const measureCtx = document.createElement('canvas').getContext('2d');
    const { fontSize, lines } = fitText(measureCtx, words, boxW, boxH);
    const lineH = lineHeightFor(fontSize);

    // Canvas kerja: resolusi setengahnya (kecuali -hd), sama seperti versi bot.
    const workSize = Math.round(CANVAS_SIZE * renderScale);
    const workCanvas = document.createElement('canvas');
    workCanvas.width = workSize;
    workCanvas.height = workSize;
    const ctx = workCanvas.getContext('2d');
    ctx.scale(renderScale, renderScale);

    if (!nobg) {
      ctx.fillStyle = dark ? '#000000' : '#ffffff';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }

    ctx.font = fontString(fontSize);
    ctx.fillStyle = dark ? '#ffffff' : '#000000';
    ctx.textBaseline = 'top';
    if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;

    lines.forEach((lineWords, i) => {
      const y = PAD + i * lineH;
      const isLastLine = i === lines.length - 1;
      drawLine(ctx, lineWords, PAD, y, boxW, isLastLine);
    });
    ctx.filter = 'none';

    // Upscale balik ke ukuran final -> ini yang bikin tepinya kelihatan
    // buram/kasar khas brat asli (di browser cukup drawImage antar-canvas,
    // gak perlu encode/decode buffer kayak di sisi bot).
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(workCanvas, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  const WA_LIMIT = 100 * 1024; // batas ukuran stiker WhatsApp

  function toBlob(mime, q){
    return new Promise(res => canvas.toBlob(res, mime, q));
  }

  // WebP: turunkan kualitas bertahap sampai di bawah 100KB
  async function webpUnder100k(){
    let blob = null;
    for (const q of [0.95, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15]){
      blob = await toBlob('image/webp', q);
      if (!blob || blob.size <= WA_LIMIT) break;
    }
    return blob;
  }

  function saveBlob(blob, name){
    const link = document.createElement('a');
    link.download = name;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  }

  const kb = b => Math.round(b.size / 1024) + 'KB';

  async function handleDownload(mime, ext){
    if (ext === 'webp'){
      const blob = await webpUnder100k();
      if (!blob) return showToast('Gagal membuat WebP');
      saveBlob(blob, 'brat.webp');
      return showToast(blob.size <= WA_LIMIT ? 'WebP ' + kb(blob) + ', siap jadi stiker' : 'WebP ' + kb(blob) + ', masih di atas 100KB');
    }
    const blob = await toBlob(mime);
    if (!blob) return showToast('Gagal membuat file');
    saveBlob(blob, 'brat.' + ext);
    showToast('Berhasil diunduh');
  }

  // Bagikan lewat menu bagikan HP, lalu pilih WhatsApp
  async function handleShare(){
    const blob = await webpUnder100k();
    if (!blob) return showToast('Gagal membuat WebP');
    const file = new File([blob], 'brat.webp', { type: 'image/webp' });
    if (navigator.canShare && navigator.canShare({ files: [file] })){
      try { await navigator.share({ files: [file] }); }
      catch (e) { if (e && e.name !== 'AbortError') showToast('Gagal membagikan'); }
    } else {
      saveBlob(blob, 'brat.webp');
      showToast('Bagikan tidak didukung, WebP diunduh');
    }
  }

  downloadPngBtn.addEventListener('click', () => handleDownload('image/png', 'png'));
  downloadWebpBtn.addEventListener('click', () => handleDownload('image/webp', 'webp'));
  shareBtn.addEventListener('click', handleShare);

  function showToast(msg){
    document.getElementById('toastMsg').textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // Pastikan web font sudah kepasang sebelum render pertama, biar measureText
  // (buat auto-fit ukuran font) akurat sejak awal, bukan ngukur pakai fallback dulu.
  if (document.fonts && document.fonts.ready) {
    document.fonts.load(`16px 'Archivo Narrow'`).then(render).catch(render);
    document.fonts.ready.then(render);
  }
  render();
})();
