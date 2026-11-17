// Terapkan tema tersimpan sebelum halaman tampil (hindari berkedip), lalu pasang tombol tema di topbar.
(function(){
  try { (function () { var m = document.cookie.match(/(?:^|;\s*)theme=(light|dark)/); var t = m ? m[1] : localStorage.getItem('theme'); if (t === 'light') document.documentElement.classList.add('light'); })(); } catch (e) {}
  document.addEventListener('DOMContentLoaded', function(){
    var bar = document.querySelector('.topbar');
    if (!bar) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'theme-btn';
    b.setAttribute('aria-label', 'Ganti tema terang atau gelap');
    var svg = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    b.innerHTML = '<svg class="sun" '+svg+'><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
      + '<svg class="moon" '+svg+'><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
    b.addEventListener('click', function(){
      var light = !document.documentElement.classList.contains('light');
      document.documentElement.classList.toggle('light', light);
      try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch(e) {}
      try {
        var shared = /(^|\.)alpa\.my\.id$/.test(location.hostname) ? '; domain=.alpa.my.id' : '';
        document.cookie = 'theme=' + (light ? 'light' : 'dark') + shared + '; path=/; max-age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
      } catch(e) {}
    });
    bar.appendChild(b);
  });
})();
