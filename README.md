# tools.alpa.my.id — AlphOols

AlphOols: kumpulan mini tools gratis, terutama untuk desain. Situs statis (tanpa server, tanpa login), berjalan di GitHub Pages.

| URL | Tool |
|---|---|
| `/` | Daftar tools |
| `/kolase/` | Kolase foto |
| `/round-foto/` | Bulatkan sudut foto |
| `/brat-maker/` | Brat Maker |
| `/ig-post/` | Tampilan postingan IG + frame story |
| `/qr-code/` | Pembuat QR Code (PNG dan SVG) |
| `/ubin/` | Ulangi gambar jadi pola ubin (offset, mirror, rotasi) |
| `/color-picker/` | Ambil warna dari foto + palet otomatis |
| `/bongkar-plp/` | Bongkar file Pixellab (.plp) |

## Tema
Mengikuti alpa.my.id (gelap dan terang, kotak-kotak tipis di background, font Inter).
- Hub dan 404: `css/style.css` + `js/site.js` (salinan dari repo alpa).
- Halaman tool: `theme.css` (warna) + `theme.js` (tombol tema). Pilihan tema disimpan di browser.

## Deploy
1. Buat repo `hildemyda/tools`, upload semua isi folder ini (termasuk `CNAME`).
2. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. Di Pages → Custom domain: `tools.alpa.my.id`, lalu centang *Enforce HTTPS* setelah tersedia.
4. DNS (tempat domain alpa.my.id dikelola): tambah record `CNAME`, host `tools`, tujuan `hildemyda.github.io`.

## Menambah tool baru
Buat folder baru (misal `/nama-tool/` dengan `index.html`), tautkan `/theme.css` dan `/theme.js` di `<head>`, lalu tambah satu kartu di `index.html` hub.
