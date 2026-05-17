# Tenggoo PDF

Tenggoo PDF adalah aplikasi untuk mengolah file PDF secara lokal (client-side): merge, split, dan compress PDF tanpa perlu mengunggah file ke server. Aplikasi ini tersedia sebagai web (Vite + React) dan desktop (Tauri).

## Fitur

- Merge PDF: gabungkan beberapa PDF menjadi satu.
- Split PDF: pecah PDF menjadi beberapa bagian/halaman.
- Compress PDF: optimasi ukuran PDF (tanpa upload).
- Privasi: file diproses di perangkat kamu, bukan di server.

## Cara Kerja (Ringkas)

UI dibuat dengan React. Kamu memilih fitur (Merge/Split/Compress) lalu memilih file PDF dari perangkat. Pemrosesan dilakukan di sisi client:

- Merge/Split menggunakan `pdf-lib` untuk membaca, memanipulasi, dan menghasilkan file PDF baru.
- Compress menggunakan WebAssembly (Ghostscript) untuk melakukan optimasi/kompresi PDF langsung di browser/desktop webview.
- Hasil diproduksi sebagai file baru yang kemudian bisa diunduh/disimpan oleh pengguna.

Catatan: karena pemrosesan dilakukan lokal, performa tergantung perangkat dan ukuran file.

## Teknologi

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- PDF: `pdf-lib`
- Kompresi: `@jspawn/ghostscript-wasm`
- Desktop: Tauri (Windows bundling via `src-tauri/`)

## Menjalankan (Web)

```bash
npm install
npm run dev
```

Build web:

```bash
npm run build
npm run preview
```

## Menjalankan (Desktop)

Prasyarat (umum):

- Node.js (disarankan Node 20)
- Rust toolchain (stable)
- Untuk Windows: Visual Studio Build Tools (MSVC) dan WebView2 runtime (biasanya sudah ada di Windows 11)

Dev desktop:

```bash
npm install
npm run desktop:dev
```

Build desktop:

```bash
npm run desktop:build
```

Artifact build Tauri akan muncul di folder `src-tauri/target/release/bundle/` (bergantung target OS).

## Release Desktop via GitHub Actions

Repo ini memakai workflow GitHub Actions: `.github/workflows/desktop-release.yml`.

Trigger release:

- Workflow akan jalan otomatis saat kamu push tag `v*` (contoh: `v0.2.0`).
- Workflow akan build Tauri (Windows) dan membuat GitHub Release + upload asset hasil build.

Contoh langkah release:

```bash
git pull
git tag v0.2.0
git push origin main v0.2.0
```

Pastikan versi aplikasi sudah dinaikkan konsisten:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

## Privasi & Keamanan

- Aplikasi ini tidak mengunggah PDF kamu ke server untuk diproses.
- Tetap berhati-hati saat membuka PDF dari sumber yang tidak dipercaya.

## Lisensi

Belum ditentukan. Jika ingin open-source yang jelas, tambahkan file `LICENSE` (misalnya MIT).
