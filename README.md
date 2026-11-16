# tools.alpa.my.id — Mini Tools

Kumpulan mini tools gratis, terutama untuk desain. Situs statis (tanpa server, tanpa login), berjalan di GitHub Pages.

| URL | Tool |
|---|---|
| `/` | Daftar tools |
| `/qolase/` | Kolase foto |
| `/round-foto/` | Bulatkan sudut foto |
| `/brat-maker/` | Brat Maker |
| `/ig-post/` | Tampilan postingan IG + frame story |
| `/bongkar-plp/` | Bongkar file Pixellab (.plp) |

## Deploy
1. Buat repo `hildemyda/tools`, upload semua isi folder ini (termasuk `CNAME`).
2. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. Di Pages → Custom domain: `tools.alpa.my.id`, lalu centang *Enforce HTTPS* setelah tersedia.
4. DNS (tempat domain alpa.my.id dikelola): tambah record `CNAME`, host `tools`, tujuan `hildemyda.github.io`.

## Menambah tool baru
Buat folder baru (misal `/nama-tool/` dengan `index.html`), lalu tambah satu kartu di `index.html` hub.
