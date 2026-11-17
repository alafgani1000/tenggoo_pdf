# Work Tool Super App

**Work Tool Super App** adalah toolkit pengolah file **100% lokal (Client-Side & On-Device)** untuk Web, Desktop (Tauri), dan **AI Agent** (Antigravity, OpenAI Codex, Claude Code, Cursor). Seluruh **38 fungsi** PDF, Image, dan Utility dibangun di atas satu *Headless Core Engine* (`src/core/`) sehingga dapat digunakan secara interaktif lewat GUI maupun dipanggil dan dikombinasikan langsung oleh AI Agent melalui **CLI (`tenggoo`)**, **MCP Server (`tenggoo-mcp`)**, dan **TypeScript SDK**.

---

## Fitur Utama (38 Tools + Pipeline Engine)

### 1. PDF Tools (21 Headless Tools)
- **Gabung (`pdf.merge`)** & **Pisah (`pdf.split`)** halaman PDF (per rentang atau per halaman).
- **Atur Halaman (`pdf.reorder`)** & **Putar PDF (`pdf.rotate`)** secara visual.
- **Kompres PDF (`pdf.compress`)** via Ghostscript WASM di GUI dan optimasi stream/raster di headless CLI/MCP.
- **PDF ke Gambar (`pdf.to_images`)** & **Gambar ke PDF (`pdf.from_images`)**.
- **Watermark (`pdf.watermark`)** & **Nomor Halaman (`pdf.page_numbers`)**.
- **Buka Kunci PDF (`pdf.unlock`)** terproteksi password secara lokal.
- **Ekstrak Teks (`pdf.extract_text`)** & **Ekstrak Tabel (`pdf.extract_tables`)** ke Markdown, CSV, TXT, atau JSON terstruktur.
- **Inspeksi & Edit Metadata (`pdf.metadata`)** (baca/ubah/hapus Title, Author, Subject, Keywords).
- **Tanda Tangan & Stempel Gambar (`pdf.stamp_image`)** lengkap dengan **Signature Pad** interaktif di layar (gambar tanda tangan langsung dengan mouse/sentuhan) atau upload logo/QR code.
- **Sensor Area (`pdf.redact`)** & **Sensor Otomatis PII/Regex (`pdf.redact_text`)** (deteksi otomatis NIK, email, no. HP, atau kata kunci dengan *burn-in* permanen).
- **Potong Margin (`pdf.crop_margins`)** secara seragam atau per sisi halaman.
- **Inspeksi & Isi Form AcroForm (`pdf.form_inspect`, `pdf.form_fill`)** secara otomatis dari JSON.
- **Bandingkan 2 PDF (`pdf.diff_text`)** & **Cetak N-up (`pdf.nup`)** (2, 4, 6, atau 9 halaman per lembar).

### 2. Image Tools (11 Tools)
- **Kompres Gambar (`image.compress`)**, **Konversi Format (`image.convert` PNG/JPG/WebP/ICO)**, **Resize (`image.resize`)**, & **Crop / Pas Foto (`image.crop` 1:1, 3:4, 4:6, 16:9)**.
- **Scan Enhancer (`image.scan_enhance`)** untuk membersihkan bayangan foto dokumen kertas agar tampak seperti hasil scanner.
- **Grid / KTP Sheet (`image.grid_sheet`)** untuk menyusun beberapa foto ke dalam 1 lembar A4/Letter.
- **Visual Image Diff (`image.diff`)** untuk membandingkan 2 gambar dan menyorot area perubahannya.
- **Putar & Balik (`image.rotate_flip`)**, **Watermark Gambar (`image.watermark`)**, **Hapus EXIF & GPS (`image.strip_metadata`)**, & **Info Gambar (`image.info`)**.

### 3. Document & Utilities (6 Tools)
- **QR Code Generator (`util.qr_generate`)**: buat QR code PNG siap tempel ke dokumen PDF.
- **Markdown to PDF (`util.md_to_pdf`)** & **CSV/JSON Table to PDF (`util.table_to_pdf`)**.
- **Pack & Unpack ZIP (`util.zip_pack`, `util.zip_unpack`)**.
- **File Checksum (`util.hash_checksum`)**: hitung hash integritas `SHA-256`, `SHA-1`, `SHA-512`.

### 4. Pipeline Studio & Productivity
- **Saved Custom Presets & `.pipeline.json` Export/Import** di [PipelineStudio.tsx](src/components/PipelineStudio.tsx).
- **Command Palette (`Ctrl+K`)** untuk melompat cepat ke fitur mana pun.

---

## Integrasi AI Agent (Antigravity, Codex, Claude Code, Cursor)

### 1. Melalui MCP Server (`stdio` JSON-RPC 2.0)
Mengekspose **39 MCP tools** (38 tool individu + `tenggoo_pipeline_run`):

```json
{
  "mcpServers": {
    "tenggoo-toolkit": {
      "command": "node",
      "args": ["bin/tenggoo-mcp.mjs"],
      "cwd": "D:/source_code/tenggoo_pdf"
    }
  }
}
```

### 2. Melalui CLI Global (`npm link` -> `tenggoo` / `node bin/tenggoo.mjs`)
```bash
# Lihat seluruh 38 tool beserta skema parameter JSON
node bin/tenggoo.mjs list --json

# Sensor otomatis NIK & Email di PDF
node bin/tenggoo.mjs run pdf.redact_text -i kontrak.pdf -o aman.pdf --presetPattern all_pii --json

# Kombinasikan beberapa tool sekaligus dalam satu pipeline
node bin/tenggoo.mjs pipeline \
  -i foto1.png foto2.png \
  --step "image.scan_enhance:mode=whiten-bg" \
  --step "image.grid_sheet:columns=2,rows=1,pageSize=A4" \
  --step "pdf.from_images:pageSize=A4,margin=20" \
  --step "pdf.watermark:text=CONFIDENTIAL,opacity=0.25" \
  -o laporan_final.pdf --json
```

### 3. Melalui Agent Skill
File skill resmi tersedia di [skills/tenggoo-toolkit/SKILL.md](skills/tenggoo-toolkit/SKILL.md).

---

## Menjalankan Aplikasi, Pengujian, & Build

Prasyarat: **Node.js 22+**.

```bash
# Install dependencies
npm install

# Jalankan GUI Web (Vite + React)
npm run dev

# Jalankan seluruh automated test suite (38 tools + pipeline)
npm test

# Jalankan ESLint & Production Build
npm run lint
npm run build
```

### Mode Desktop (Tauri)
```bash
npm run desktop:dev
npm run desktop:build
```

## Privasi & Keamanan
- Seluruh pemrosesan file berjalan **100% lokal di perangkat Anda** tanpa mengunggah file ke server eksternal.
