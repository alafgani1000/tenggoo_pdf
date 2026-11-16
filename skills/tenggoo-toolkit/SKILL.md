---
name: tenggoo-toolkit
description: Headless PDF, Image, Document/QR/Table/ZIP/Hash Utility toolkit and multi-step Pipeline engine callable directly by AI Agents (Antigravity, Codex, Claude Code, Cursor) via CLI, global binaries, MCP server, or TypeScript SDK.
---

# Tenggoo Toolkit (`tenggoo_pdf`)

Use this skill whenever the user or an automated workflow needs local, privacy-preserving PDF manipulation, PII auto-redaction, AcroForm reading/filling, visual/text document comparison, image scan enhancement, QR generation, Markdown/CSV-to-PDF rendering, ZIP archiving, cryptographic hashing, or multi-step pipelines.

## 1. Direct Access Interfaces for AI Agents

### A. CLI (`bin/tenggoo.mjs` or `node --no-warnings --experimental-strip-types src/agent/cli.ts`)
```bash
# Discover all 38 tools with full JSON schemas
node bin/tenggoo.mjs list --json
node bin/tenggoo.mjs describe pdf.redact_text --json

# Run a single tool
node bin/tenggoo.mjs run pdf.redact_text -i contract.pdf -o redacted.pdf --presetPattern all_pii --json
node bin/tenggoo.mjs run pdf.form_inspect -i application.pdf --json
node bin/tenggoo.mjs run util.table_to_pdf -i sales.csv -o sales_report.pdf --orientation landscape --json

# Combine multiple tools in a single pipeline (output of step N feeds step N+1)
node bin/tenggoo.mjs pipeline \
  -i scan1.jpg scan2.jpg \
  --step "image.scan_enhance:mode=whiten-bg" \
  --step "image.grid_sheet:columns=2,rows=1,pageSize=A4" \
  --step "pdf.from_images:pageSize=A4,margin=20" \
  --step "pdf.watermark:text=CONFIDENTIAL,opacity=0.25" \
  -o final_report.pdf --json
```

### B. MCP Server (`bin/tenggoo-mcp.mjs` or `npm run mcp`)
Start over `stdio` (newline-delimited JSON-RPC 2.0):
- Command: `node bin/tenggoo-mcp.mjs`
- Working directory: `<repo-root>`
- Exposes all 38 tools as `tenggoo_<category>_<name>` plus `tenggoo_pipeline_run` for chaining arbitrary steps (**39 MCP tools** total).

### C. TypeScript SDK (`src/core/index.ts`)
```ts
import { runPipeline, getTool } from './src/core/index.ts';
```

---

## 2. Tool Catalog (38 Tools)

### PDF Tools (`pdf.*` — 21 Tools)
| Tool ID | MCP Tool Name | Description | Key Parameters |
| :--- | :--- | :--- | :--- |
| `pdf.merge` | `tenggoo_pdf_merge` | Merge 2+ PDFs into one | `outputName` |
| `pdf.split` | `tenggoo_pdf_split` | Extract or split pages | `mode` (`ranges` \| `each_page` \| `separate_ranges`), `ranges` |
| `pdf.reorder` | `tenggoo_pdf_reorder` | Reorder/subset/duplicate pages | `pageOrder` (`number[]`), `rotation` |
| `pdf.rotate` | `tenggoo_pdf_rotate` | Rotate pages 90/180/270° | `angle`, `pageRange` |
| `pdf.compress` | `tenggoo_pdf_compress` | Reduce PDF size via stream packing & optional raster downsampling | `quality` (`low` \| `medium` \| `high` \| `pro`), `preserveText` |
| `pdf.watermark` | `tenggoo_pdf_watermark` | Add text watermark | `text`, `position`, `opacity`, `fontSize`, `rotation`, `color`, `pageRange` |
| `pdf.page_numbers` | `tenggoo_pdf_page_numbers` | Add page numbers | `format`, `position`, `startNumber`, `skipFirstPage`, `fontSize`, `color`, `margin` |
| `pdf.from_images` | `tenggoo_pdf_from_images` | Convert images to PDF | `pageSize` (`fit` \| `A4` \| `Letter`), `orientation`, `margin`, `outputName` |
| `pdf.to_images` | `tenggoo_pdf_to_images` | Render PDF pages as images | `format` (`png` \| `jpeg` \| `webp`), `scale`, `pageRange`, `quality`, `password` |
| `pdf.unlock` | `tenggoo_pdf_unlock` | Decrypt password PDF | `password`, `scale` |
| `pdf.extract_text` | `tenggoo_pdf_extract_text` | Extract text layer from PDF | `format` (`markdown` \| `txt` \| `json`), `pageRange`, `password` |
| `pdf.metadata` | `tenggoo_pdf_metadata` | Inspect/set/clear PDF metadata | `action` (`inspect` \| `set` \| `clear`), `title`, `author`, `subject`, `keywords`, `creator` |
| `pdf.stamp_image` | `tenggoo_pdf_stamp_image` | Stamp signature/logo/QR onto PDF | `position`, `width`, `height`, `margin`, `x`, `y`, `opacity`, `pageRange` |
| `pdf.redact` | `tenggoo_pdf_redact` | Black out PDF region (`burnIn` destroys text layer) | `preset` (`top-banner` \| `bottom-banner` \| `center-strip` \| `custom`), `x`, `y`, `width`, `height`, `label`, `pageRange`, `burnIn` |
| `pdf.crop_margins` | `tenggoo_pdf_crop_margins` | Trim white margins on PDF pages | `margin`, `top`, `bottom`, `left`, `right`, `pageRange` |
| `pdf.redact_text` | `tenggoo_pdf_redact_text` | Auto-locate and redact text/regex/PII (NIK, email, phone) | `query`, `isRegex`, `presetPattern` (`none` \| `nik` \| `email` \| `phone` \| `all_pii`), `caseSensitive`, `label`, `burnIn`, `pageRange` |
| `pdf.form_inspect` | `tenggoo_pdf_form_inspect` | Inspect interactive AcroForm fields & values | *(none)* |
| `pdf.form_fill` | `tenggoo_pdf_form_fill` | Fill AcroForm fields from JSON (and optionally create/flatten) | `values`, `createFields`, `flatten` |
| `pdf.diff_text` | `tenggoo_pdf_diff_text` | Compare text page-by-page between 2 PDFs | `format` (`markdown` \| `json`) |
| `pdf.nup` | `tenggoo_pdf_nup` | Arrange 2/4/6/9 PDF pages per output sheet | `pagesPerSheet`, `pageSize`, `orientation`, `margin`, `drawBorder` |
| `pdf.extract_tables` | `tenggoo_pdf_extract_tables` | Cluster PDF positioned text into Markdown/CSV/JSON tables | `format` (`markdown` \| `csv` \| `json`), `rowTolerancePt`, `pageRange` |

### Image Tools (`image.*` — 11 Tools)
| Tool ID | MCP Tool Name | Description | Key Parameters |
| :--- | :--- | :--- | :--- |
| `image.compress` | `tenggoo_image_compress` | Compress & optionally downscale | `quality` (1-100), `format` (`keep` \| `jpeg` \| `webp` \| `png`), `maxWidth` |
| `image.convert` | `tenggoo_image_convert` | Convert between PNG/JPG/WebP/ICO | `targetFormat` (`png` \| `jpeg` \| `webp` \| `ico`), `quality` |
| `image.resize` | `tenggoo_image_resize` | Resize by px or percentage | `width`, `height`, `scalePercent`, `fit` (`inside` \| `contain` \| `cover` \| `stretch`), `background` |
| `image.crop` | `tenggoo_image_crop` | Crop by aspect ratio or rect | `aspectRatio` (`1:1` \| `3:4` \| `4:6` \| `4:3` \| `16:9` \| `custom`), `x`, `y`, `width`, `height` |
| `image.rotate_flip` | `tenggoo_image_rotate_flip` | Rotate & mirror images | `angle` (0/90/180/270), `flipHorizontal`, `flipVertical` |
| `image.watermark` | `tenggoo_image_watermark` | Stamp text watermark on images | `text`, `position`, `fontSize`, `opacity`, `color` |
| `image.strip_metadata` | `tenggoo_image_strip_metadata` | Remove EXIF/GPS/camera data | *(none)* |
| `image.info` | `tenggoo_image_info` | Inspect image dimensions & bytes | *(none)* |
| `image.diff` | `tenggoo_image_diff` | Compare 2 images & generate red diff heatmap | `threshold` |
| `image.scan_enhance` | `tenggoo_image_scan_enhance` | Whiten shadows & boost document scan contrast | `mode` (`whiten-bg` \| `grayscale-contrast` \| `bw-threshold`), `contrast`, `threshold` |
| `image.grid_sheet` | `tenggoo_image_grid_sheet` | Combine multiple images into A4/Letter grid sheet | `columns`, `rows`, `pageSize`, `padding`, `background`, `outputName` |

### Utility Tools (`util.*` — 6 Tools)
| Tool ID | MCP Tool Name | Description | Key Parameters |
| :--- | :--- | :--- | :--- |
| `util.qr_generate` | `tenggoo_util_qr_generate` | Generate scannable PNG QR code | `text`, `size`, `margin`, `darkColor`, `lightColor`, `outputName` |
| `util.md_to_pdf` | `tenggoo_util_md_to_pdf` | Render Markdown/text to PDF | `markdown`, `title`, `pageSize`, `fontSize`, `margin`, `outputName` |
| `util.zip_pack` | `tenggoo_util_zip_pack` | Pack files into a `.zip` archive | `archiveName` |
| `util.zip_unpack` | `tenggoo_util_zip_unpack` | Extract files from a `.zip` archive | `filterExtensions` |
| `util.hash_checksum` | `tenggoo_util_hash_checksum` | Compute SHA-256 / SHA-1 / SHA-512 checksums | `algorithm` (`SHA-256` \| `SHA-1` \| `SHA-512`) |
| `util.table_to_pdf` | `tenggoo_util_table_to_pdf` | Render CSV/JSON array data to formatted PDF table | `data`, `title`, `pageSize`, `orientation`, `outputName` |
