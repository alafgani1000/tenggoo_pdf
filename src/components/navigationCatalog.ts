import type React from 'react';
import {
  Archive,
  ArrowLeftRight,
  Binary,
  Bot,
  ClipboardList,
  Crop,
  EyeOff,
  FileImage,
  FileSearch,
  FileText,
  FolderOpen,
  GitCompare,
  Grid,
  Image as ImageIcon,
  ImagePlus,
  Info,
  KeyRound,
  Layers,
  LayoutGrid,
  Minimize2,
  QrCode,
  RefreshCw,
  RotateCw,
  ScanLine,
  ScanSearch,
  Scissors,
  ShieldCheck,
  ShieldOff,
  Sliders,
  Stamp,
  Table,
  Tags,
  Zap,
} from 'lucide-react';
import type { ImageToolId } from './ImageToolsStudio.tsx';
import type { UtilityTab } from './UtilityToolsStudio.tsx';

export type NavCategoryId = 'pdf' | 'image' | 'utility' | 'pipeline';

export type PdfSubTabId =
  | 'merge'
  | 'split'
  | 'reorder'
  | 'rotate'
  | 'compress'
  | 'pdf-to-image'
  | 'image-to-pdf'
  | 'watermark'
  | 'page-numbers'
  | 'unlock'
  | 'extract-text'
  | 'pdf-metadata'
  | 'stamp-image'
  | 'redact-pdf'
  | 'redact-text'
  | 'crop-pdf'
  | 'form-pdf'
  | 'nup-pdf'
  | 'extract-tables';

export type ImageSubTabId = ImageToolId;
export type UtilitySubTabId = UtilityTab;

export interface NavToolEntry {
  id: string;
  hash: string;
  name: string;
  shortDesc: string;
  category: NavCategoryId;
  subGroup: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badgeColor: string;
  pdfTab?: PdfSubTabId;
  imageTool?: ImageSubTabId;
  utilityTool?: UtilitySubTabId;
}

export const CATEGORY_LABELS: Record<NavCategoryId, string> = {
  pdf: 'PDF Tools',
  image: 'Image Tools',
  utility: 'Doc & Utilities',
  pipeline: 'AI Agent & Pipeline',
};

export const NAV_TOOLS: NavToolEntry[] = [
  // ================= PDF: Susun & Halaman =================
  {
    id: 'pdf:merge',
    hash: 'merge-pdf',
    name: 'Gabung PDF',
    shortDesc: 'Gabungkan beberapa PDF menjadi satu dokumen',
    category: 'pdf',
    subGroup: 'Susun & Halaman',
    icon: Layers,
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    pdfTab: 'merge',
  },
  {
    id: 'pdf:split',
    hash: 'split-pdf',
    name: 'Pisah PDF',
    shortDesc: 'Ekstrak atau pecah halaman PDF berdasarkan rentang',
    category: 'pdf',
    subGroup: 'Susun & Halaman',
    icon: Scissors,
    badgeColor: 'text-pink-700 bg-pink-50 border-pink-200',
    pdfTab: 'split',
  },
  {
    id: 'pdf:reorder',
    hash: 'atur-halaman-pdf',
    name: 'Atur Halaman',
    shortDesc: 'Ubah urutan, duplikasi, atau hapus halaman visual',
    category: 'pdf',
    subGroup: 'Susun & Halaman',
    icon: ArrowLeftRight,
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    pdfTab: 'reorder',
  },
  {
    id: 'pdf:rotate',
    hash: 'putar-pdf',
    name: 'Putar PDF',
    shortDesc: 'Putar orientasi halaman PDF 90°, 180°, atau 270°',
    category: 'pdf',
    subGroup: 'Susun & Halaman',
    icon: RotateCw,
    badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
    pdfTab: 'rotate',
  },
  {
    id: 'pdf:nup-pdf',
    hash: 'cetak-nup-pdf',
    name: 'Cetak N-up',
    shortDesc: 'Gabung 2, 4, 6, atau 9 halaman ke satu lembar cetak',
    category: 'pdf',
    subGroup: 'Susun & Halaman',
    icon: LayoutGrid,
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    pdfTab: 'nup-pdf',
  },
  {
    id: 'pdf:crop-pdf',
    hash: 'potong-margin-pdf',
    name: 'Potong Margin',
    shortDesc: 'Pangkas ruang kosong di tepi halaman PDF',
    category: 'pdf',
    subGroup: 'Susun & Halaman',
    icon: Crop,
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    pdfTab: 'crop-pdf',
  },

  // ================= PDF: Optimasi & Konversi =================
  {
    id: 'pdf:compress',
    hash: 'kompres-pdf',
    name: 'Kompres PDF',
    shortDesc: 'Perkecil ukuran file PDF secara lokal (Ghostscript WASM)',
    category: 'pdf',
    subGroup: 'Optimasi & Konversi',
    icon: Zap,
    badgeColor: 'text-orange-700 bg-orange-50 border-orange-200',
    pdfTab: 'compress',
  },
  {
    id: 'pdf:pdf-to-image',
    hash: 'pdf-ke-gambar',
    name: 'PDF ke Gambar',
    shortDesc: 'Render halaman PDF menjadi PNG/JPG resolusi tinggi',
    category: 'pdf',
    subGroup: 'Optimasi & Konversi',
    icon: FileImage,
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    pdfTab: 'pdf-to-image',
  },
  {
    id: 'pdf:image-to-pdf',
    hash: 'gambar-ke-pdf',
    name: 'Gambar ke PDF',
    shortDesc: 'Konversi kumpulan foto JPG/PNG menjadi satu PDF',
    category: 'pdf',
    subGroup: 'Optimasi & Konversi',
    icon: ImageIcon,
    badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
    pdfTab: 'image-to-pdf',
  },

  // ================= PDF: Edit, Stempel & Form =================
  {
    id: 'pdf:watermark',
    hash: 'watermark-pdf',
    name: 'Watermark',
    shortDesc: 'Tambahkan teks watermark diagonal, lurus, atau grid',
    category: 'pdf',
    subGroup: 'Edit, Stempel & Form',
    icon: Stamp,
    badgeColor: 'text-violet-700 bg-violet-50 border-violet-200',
    pdfTab: 'watermark',
  },
  {
    id: 'pdf:page-numbers',
    hash: 'nomor-halaman-pdf',
    name: 'Nomor Halaman',
    shortDesc: 'Beri nomor halaman otomatis di header atau footer',
    category: 'pdf',
    subGroup: 'Edit, Stempel & Form',
    icon: Binary,
    badgeColor: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    pdfTab: 'page-numbers',
  },
  {
    id: 'pdf:stamp-image',
    hash: 'stempel-pdf',
    name: 'Tanda Tangan & Stempel',
    shortDesc: 'Gambar tanda tangan di layar atau tempel logo/QR ke PDF',
    category: 'pdf',
    subGroup: 'Edit, Stempel & Form',
    icon: ImagePlus,
    badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
    pdfTab: 'stamp-image',
  },
  {
    id: 'pdf:form-pdf',
    hash: 'form-pdf',
    name: 'Form AcroForm',
    shortDesc: 'Inspeksi dan isi field formulir PDF interaktif via JSON',
    category: 'pdf',
    subGroup: 'Edit, Stempel & Form',
    icon: ClipboardList,
    badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
    pdfTab: 'form-pdf',
  },

  // ================= PDF: Privasi & Ekstraksi Data =================
  {
    id: 'pdf:unlock',
    hash: 'buka-kunci-pdf',
    name: 'Buka Kunci PDF',
    shortDesc: 'Hapus proteksi password dari PDF yang Anda miliki',
    category: 'pdf',
    subGroup: 'Privasi & Ekstraksi Data',
    icon: KeyRound,
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
    pdfTab: 'unlock',
  },
  {
    id: 'pdf:redact-pdf',
    hash: 'sensor-pdf',
    name: 'Sensor Area',
    shortDesc: 'Tutup area sensitif secara permanen (burn-in piksel)',
    category: 'pdf',
    subGroup: 'Privasi & Ekstraksi Data',
    icon: EyeOff,
    badgeColor: 'text-slate-800 bg-slate-100 border-slate-300',
    pdfTab: 'redact-pdf',
  },
  {
    id: 'pdf:redact-text',
    hash: 'sensor-teks-pdf',
    name: 'Sensor PII / Kata',
    shortDesc: 'Deteksi & sensor otomatis NIK, Email, No. HP, atau regex',
    category: 'pdf',
    subGroup: 'Privasi & Ekstraksi Data',
    icon: ScanSearch,
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
    pdfTab: 'redact-text',
  },
  {
    id: 'pdf:pdf-metadata',
    hash: 'metadata-pdf',
    name: 'Metadata PDF',
    shortDesc: 'Inspeksi, ubah, atau hapus metadata Author/Title PDF',
    category: 'pdf',
    subGroup: 'Privasi & Ekstraksi Data',
    icon: Tags,
    badgeColor: 'text-sky-700 bg-sky-50 border-sky-200',
    pdfTab: 'pdf-metadata',
  },
  {
    id: 'pdf:extract-text',
    hash: 'ekstrak-teks-pdf',
    name: 'Ekstrak Teks',
    shortDesc: 'Ekstrak teks terstruktur per halaman (Markdown/TXT/JSON)',
    category: 'pdf',
    subGroup: 'Privasi & Ekstraksi Data',
    icon: FileSearch,
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    pdfTab: 'extract-text',
  },
  {
    id: 'pdf:extract-tables',
    hash: 'ekstrak-tabel-pdf',
    name: 'Ekstrak Tabel',
    shortDesc: 'Ekstrak baris & kolom tabel PDF ke Markdown, CSV, atau JSON',
    category: 'pdf',
    subGroup: 'Privasi & Ekstraksi Data',
    icon: Table,
    badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
    pdfTab: 'extract-tables',
  },

  // ================= IMAGE: Optimasi & Format =================
  {
    id: 'image:image.compress',
    hash: 'image-kompres',
    name: 'Kompres Gambar',
    shortDesc: 'Perkecil ukuran JPG/PNG/WebP batch dengan maxWidth',
    category: 'image',
    subGroup: 'Optimasi & Format',
    icon: Minimize2,
    badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
    imageTool: 'image.compress',
  },
  {
    id: 'image:image.convert',
    hash: 'image-konversi',
    name: 'Konversi Format Gambar',
    shortDesc: 'Ubah format batch antara PNG, JPEG, WebP, dan ICO',
    category: 'image',
    subGroup: 'Optimasi & Format',
    icon: RefreshCw,
    badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
    imageTool: 'image.convert',
  },

  // ================= IMAGE: Ukuran, Pas Foto & Grid =================
  {
    id: 'image:image.resize',
    hash: 'image-resize',
    name: 'Resize Gambar',
    shortDesc: 'Ubah dimensi px atau persentase (inside/contain/cover)',
    category: 'image',
    subGroup: 'Ukuran, Pas Foto & Grid',
    icon: Sliders,
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    imageTool: 'image.resize',
  },
  {
    id: 'image:image.crop',
    hash: 'image-crop',
    name: 'Crop & Pas Foto',
    shortDesc: 'Potong rasio 1:1, 3:4, 4:6 pas foto, 16:9, atau custom',
    category: 'image',
    subGroup: 'Ukuran, Pas Foto & Grid',
    icon: Crop,
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    imageTool: 'image.crop',
  },
  {
    id: 'image:image.rotate_flip',
    hash: 'image-putar',
    name: 'Putar & Balik Gambar',
    shortDesc: 'Rotate 90/180/270° dan mirror horizontal/vertikal',
    category: 'image',
    subGroup: 'Ukuran, Pas Foto & Grid',
    icon: RotateCw,
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    imageTool: 'image.rotate_flip',
  },
  {
    id: 'image:image.grid_sheet',
    hash: 'image-grid',
    name: 'Grid / KTP Sheet',
    shortDesc: 'Gabung beberapa foto atau KTP ke satu lembar A4/Letter',
    category: 'image',
    subGroup: 'Ukuran, Pas Foto & Grid',
    icon: Grid,
    badgeColor: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    imageTool: 'image.grid_sheet',
  },

  // ================= IMAGE: Scanner, Watermark & Inspeksi =================
  {
    id: 'image:image.scan_enhance',
    hash: 'image-scan',
    name: 'Scan Enhancer',
    shortDesc: 'Bersihkan bayangan abu-abu pada foto dokumen kertas',
    category: 'image',
    subGroup: 'Scanner, Watermark & Inspeksi',
    icon: ScanLine,
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    imageTool: 'image.scan_enhance',
  },
  {
    id: 'image:image.watermark',
    hash: 'image-watermark',
    name: 'Watermark Gambar',
    shortDesc: 'Pasang teks watermark pada banyak gambar sekaligus',
    category: 'image',
    subGroup: 'Scanner, Watermark & Inspeksi',
    icon: Stamp,
    badgeColor: 'text-violet-700 bg-violet-50 border-violet-200',
    imageTool: 'image.watermark',
  },
  {
    id: 'image:image.diff',
    hash: 'image-diff',
    name: 'Bandingkan 2 Gambar',
    shortDesc: 'Buat visual diff heatmap untuk mendeteksi perubahan piksel',
    category: 'image',
    subGroup: 'Scanner, Watermark & Inspeksi',
    icon: GitCompare,
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
    imageTool: 'image.diff',
  },
  {
    id: 'image:image.strip_metadata',
    hash: 'image-hapus-exif',
    name: 'Hapus EXIF & GPS',
    shortDesc: 'Hapus data lokasi GPS & kamera demi privasi foto',
    category: 'image',
    subGroup: 'Scanner, Watermark & Inspeksi',
    icon: ShieldOff,
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
    imageTool: 'image.strip_metadata',
  },
  {
    id: 'image:image.info',
    hash: 'image-info',
    name: 'Info Gambar',
    shortDesc: 'Inspeksi resolusi piksel, rasio aspek, dan ukuran file',
    category: 'image',
    subGroup: 'Scanner, Watermark & Inspeksi',
    icon: Info,
    badgeColor: 'text-slate-700 bg-slate-100 border-slate-200',
    imageTool: 'image.info',
  },

  // ================= UTILITY: Generator & Dokumen =================
  {
    id: 'utility:util.qr_generate',
    hash: 'buat-qr-code',
    name: 'QR Code Generator',
    shortDesc: 'Buat QR Code PNG yang siap ditempel ke PDF/Gambar',
    category: 'utility',
    subGroup: 'Generator & Dokumen',
    icon: QrCode,
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    utilityTool: 'util.qr_generate',
  },
  {
    id: 'utility:util.md_to_pdf',
    hash: 'markdown-ke-pdf',
    name: 'Markdown to PDF',
    shortDesc: 'Render teks atau file Markdown menjadi dokumen PDF rapi',
    category: 'utility',
    subGroup: 'Generator & Dokumen',
    icon: FileText,
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    utilityTool: 'util.md_to_pdf',
  },
  {
    id: 'utility:util.table_to_pdf',
    hash: 'tabel-ke-pdf',
    name: 'Table CSV/JSON -> PDF',
    shortDesc: 'Konversi data CSV atau JSON array menjadi tabel laporan PDF',
    category: 'utility',
    subGroup: 'Generator & Dokumen',
    icon: Table,
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    utilityTool: 'util.table_to_pdf',
  },

  // ================= UTILITY: Arsip & Integritas File =================
  {
    id: 'utility:util.zip_pack',
    hash: 'pack-zip',
    name: 'Pack ke ZIP',
    shortDesc: 'Gabungkan banyak file menjadi satu arsip .zip',
    category: 'utility',
    subGroup: 'Arsip & Integritas File',
    icon: Archive,
    badgeColor: 'text-orange-700 bg-orange-50 border-orange-200',
    utilityTool: 'util.zip_pack',
  },
  {
    id: 'utility:util.zip_unpack',
    hash: 'ekstrak-zip',
    name: 'Ekstrak ZIP',
    shortDesc: 'Buka dan filter isi file .zip secara lokal',
    category: 'utility',
    subGroup: 'Arsip & Integritas File',
    icon: FolderOpen,
    badgeColor: 'text-orange-700 bg-orange-50 border-orange-200',
    utilityTool: 'util.zip_unpack',
  },
  {
    id: 'utility:util.hash_checksum',
    hash: 'hash-checksum',
    name: 'Hash SHA-256 / SHA-512',
    shortDesc: 'Hitung checksum integritas file secara kriptografis',
    category: 'utility',
    subGroup: 'Arsip & Integritas File',
    icon: ShieldCheck,
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    utilityTool: 'util.hash_checksum',
  },

  // ================= PIPELINE & AI AGENT =================
  {
    id: 'pipeline:studio',
    hash: 'pipeline',
    name: 'AI Agent & Pipeline Studio',
    shortDesc: 'Rangkai kombinasi PDF + Image + Utility & salin perintah CLI/MCP',
    category: 'pipeline',
    subGroup: 'Otomasi & AI Agent',
    icon: Bot,
    badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
  },
];

export function findNavToolById(id: string): NavToolEntry | undefined {
  return NAV_TOOLS.find((tool) => tool.id === id);
}

export function findNavToolByHash(rawHash: string): NavToolEntry | undefined {
  const hash = rawHash.replace(/^#/, '').trim();
  if (!hash) return undefined;
  if (hash === 'image-tools') return findNavToolById('image:image.compress');
  if (hash === 'utilities') return findNavToolById('utility:util.qr_generate');
  return NAV_TOOLS.find((tool) => tool.hash === hash);
}
