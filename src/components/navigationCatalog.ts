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

export type NavCategoryId = 'pdf' | 'image' | 'data' | 'utility' | 'pipeline';

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
  handledFiles: string;
  category: NavCategoryId;
  subGroup: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badgeColor: string;
  pdfTab?: PdfSubTabId;
  imageTool?: ImageSubTabId;
  utilityTool?: UtilitySubTabId;
}

export const CATEGORY_LABELS: Record<NavCategoryId, string> = {
  pdf: 'File PDF',
  image: 'File Gambar',
  data: 'File Teks & Data',
  utility: 'File Arsip & Umum',
  pipeline: 'Multi-File Pipeline',
};

export const CATEGORY_FILE_HINTS: Record<NavCategoryId, string> = {
  pdf: '.pdf',
  image: 'JPG, PNG, WebP, ICO',
  data: 'MD, TXT, CSV, JSON',
  utility: 'ZIP & Semua File',
  pipeline: 'PDF + Gambar + ZIP',
};

export const NAV_TOOLS: NavToolEntry[] = [
  // ================= FILE PDF: Susun & Halaman PDF =================
  {
    id: 'pdf:merge',
    hash: 'merge-pdf',
    name: 'Gabung PDF',
    shortDesc: 'Gabungkan beberapa PDF menjadi satu dokumen',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Susun & Halaman PDF',
    icon: Layers,
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    pdfTab: 'merge',
  },
  {
    id: 'pdf:split',
    hash: 'split-pdf',
    name: 'Pisah PDF',
    shortDesc: 'Ekstrak atau pecah halaman PDF berdasarkan rentang',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Susun & Halaman PDF',
    icon: Scissors,
    badgeColor: 'text-pink-700 bg-pink-50 border-pink-200',
    pdfTab: 'split',
  },
  {
    id: 'pdf:reorder',
    hash: 'atur-halaman-pdf',
    name: 'Atur Halaman',
    shortDesc: 'Ubah urutan, duplikasi, atau hapus halaman visual',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Susun & Halaman PDF',
    icon: ArrowLeftRight,
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    pdfTab: 'reorder',
  },
  {
    id: 'pdf:rotate',
    hash: 'putar-pdf',
    name: 'Putar PDF',
    shortDesc: 'Putar orientasi halaman PDF 90°, 180°, atau 270°',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Susun & Halaman PDF',
    icon: RotateCw,
    badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
    pdfTab: 'rotate',
  },
  {
    id: 'pdf:crop-pdf',
    hash: 'potong-margin-pdf',
    name: 'Potong Margin',
    shortDesc: 'Pangkas ruang kosong di tepi halaman PDF',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Susun & Halaman PDF',
    icon: Crop,
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    pdfTab: 'crop-pdf',
  },
  {
    id: 'pdf:nup-pdf',
    hash: 'cetak-nup-pdf',
    name: 'Cetak N-up',
    shortDesc: 'Gabung 2, 4, 6, atau 9 halaman ke satu lembar cetak',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Susun & Halaman PDF',
    icon: LayoutGrid,
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    pdfTab: 'nup-pdf',
  },

  // ================= FILE PDF: Kompres, Konversi & Ekstrak PDF =================
  {
    id: 'pdf:compress',
    hash: 'kompres-pdf',
    name: 'Kompres PDF',
    shortDesc: 'Perkecil ukuran file PDF secara lokal (Ghostscript WASM)',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Kompres, Konversi & Ekstrak PDF',
    icon: Zap,
    badgeColor: 'text-orange-700 bg-orange-50 border-orange-200',
    pdfTab: 'compress',
  },
  {
    id: 'pdf:pdf-to-image',
    hash: 'pdf-ke-gambar',
    name: 'PDF ke Gambar',
    shortDesc: 'Render halaman PDF menjadi PNG/JPG resolusi tinggi',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Kompres, Konversi & Ekstrak PDF',
    icon: FileImage,
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    pdfTab: 'pdf-to-image',
  },
  {
    id: 'pdf:extract-text',
    hash: 'ekstrak-teks-pdf',
    name: 'Ekstrak Teks',
    shortDesc: 'Ekstrak teks terstruktur per halaman (Markdown/TXT/JSON)',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Kompres, Konversi & Ekstrak PDF',
    icon: FileSearch,
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    pdfTab: 'extract-text',
  },
  {
    id: 'pdf:extract-tables',
    hash: 'ekstrak-tabel-pdf',
    name: 'Ekstrak Tabel',
    shortDesc: 'Ekstrak baris & kolom tabel PDF ke Markdown, CSV, atau JSON',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Kompres, Konversi & Ekstrak PDF',
    icon: Table,
    badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
    pdfTab: 'extract-tables',
  },

  // ================= FILE PDF: Edit, Stempel & Form PDF =================
  {
    id: 'pdf:stamp-image',
    hash: 'stempel-pdf',
    name: 'Tanda Tangan & Stempel',
    shortDesc: 'Gambar tanda tangan di layar atau tempel logo/QR ke PDF',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Edit, Stempel & Form PDF',
    icon: ImagePlus,
    badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
    pdfTab: 'stamp-image',
  },
  {
    id: 'pdf:watermark',
    hash: 'watermark-pdf',
    name: 'Watermark PDF',
    shortDesc: 'Tambahkan teks watermark diagonal, lurus, atau grid',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Edit, Stempel & Form PDF',
    icon: Stamp,
    badgeColor: 'text-violet-700 bg-violet-50 border-violet-200',
    pdfTab: 'watermark',
  },
  {
    id: 'pdf:page-numbers',
    hash: 'nomor-halaman-pdf',
    name: 'Nomor Halaman',
    shortDesc: 'Beri nomor halaman otomatis di header atau footer',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Edit, Stempel & Form PDF',
    icon: Binary,
    badgeColor: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    pdfTab: 'page-numbers',
  },
  {
    id: 'pdf:form-pdf',
    hash: 'form-pdf',
    name: 'Form AcroForm',
    shortDesc: 'Inspeksi dan isi field formulir PDF interaktif via JSON',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Edit, Stempel & Form PDF',
    icon: ClipboardList,
    badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
    pdfTab: 'form-pdf',
  },

  // ================= FILE PDF: Keamanan, Sensor & Metadata PDF =================
  {
    id: 'pdf:unlock',
    hash: 'buka-kunci-pdf',
    name: 'Buka Kunci PDF',
    shortDesc: 'Hapus proteksi password dari PDF yang Anda miliki',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Keamanan, Sensor & Metadata PDF',
    icon: KeyRound,
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
    pdfTab: 'unlock',
  },
  {
    id: 'pdf:redact-pdf',
    hash: 'sensor-pdf',
    name: 'Sensor Area',
    shortDesc: 'Tutup area sensitif secara permanen (burn-in piksel)',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Keamanan, Sensor & Metadata PDF',
    icon: EyeOff,
    badgeColor: 'text-slate-800 bg-slate-100 border-slate-300',
    pdfTab: 'redact-pdf',
  },
  {
    id: 'pdf:redact-text',
    hash: 'sensor-teks-pdf',
    name: 'Sensor PII / Kata',
    shortDesc: 'Deteksi & sensor otomatis NIK, Email, No. HP, atau regex',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Keamanan, Sensor & Metadata PDF',
    icon: ScanSearch,
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
    pdfTab: 'redact-text',
  },
  {
    id: 'pdf:pdf-metadata',
    hash: 'metadata-pdf',
    name: 'Metadata PDF',
    shortDesc: 'Inspeksi, ubah, atau hapus metadata Author/Title PDF',
    handledFiles: '.pdf',
    category: 'pdf',
    subGroup: 'Keamanan, Sensor & Metadata PDF',
    icon: Tags,
    badgeColor: 'text-sky-700 bg-sky-50 border-sky-200',
    pdfTab: 'pdf-metadata',
  },

  // ================= FILE GAMBAR: Optimasi & Konversi Gambar =================
  {
    id: 'image:image.compress',
    hash: 'image-kompres',
    name: 'Kompres Gambar',
    shortDesc: 'Perkecil ukuran JPG/PNG/WebP batch dengan maxWidth',
    handledFiles: 'JPG, PNG, WebP',
    category: 'image',
    subGroup: 'Optimasi & Konversi Gambar',
    icon: Minimize2,
    badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
    imageTool: 'image.compress',
  },
  {
    id: 'image:image.convert',
    hash: 'image-konversi',
    name: 'Konversi Format Gambar',
    shortDesc: 'Ubah format batch antara PNG, JPEG, WebP, dan ICO',
    handledFiles: 'PNG, JPG, WebP, ICO',
    category: 'image',
    subGroup: 'Optimasi & Konversi Gambar',
    icon: RefreshCw,
    badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
    imageTool: 'image.convert',
  },
  {
    id: 'pdf:image-to-pdf',
    hash: 'gambar-ke-pdf',
    name: 'Gambar ke PDF',
    shortDesc: 'Konversi kumpulan foto JPG/PNG menjadi satu PDF',
    handledFiles: 'JPG, PNG, WebP',
    category: 'image',
    subGroup: 'Optimasi & Konversi Gambar',
    icon: ImageIcon,
    badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
    pdfTab: 'image-to-pdf',
  },

  // ================= FILE GAMBAR: Ukuran, Pas Foto & KTP Sheet =================
  {
    id: 'image:image.resize',
    hash: 'image-resize',
    name: 'Resize Gambar',
    shortDesc: 'Ubah dimensi px atau persentase (inside/contain/cover)',
    handledFiles: 'JPG, PNG, WebP',
    category: 'image',
    subGroup: 'Ukuran, Pas Foto & KTP Sheet',
    icon: Sliders,
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    imageTool: 'image.resize',
  },
  {
    id: 'image:image.crop',
    hash: 'image-crop',
    name: 'Crop & Pas Foto',
    shortDesc: 'Potong rasio 1:1, 3:4, 4:6 pas foto, 16:9, atau custom',
    handledFiles: 'JPG, PNG, WebP',
    category: 'image',
    subGroup: 'Ukuran, Pas Foto & KTP Sheet',
    icon: Crop,
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    imageTool: 'image.crop',
  },
  {
    id: 'image:image.rotate_flip',
    hash: 'image-putar',
    name: 'Putar & Balik Gambar',
    shortDesc: 'Rotate 90/180/270° dan mirror horizontal/vertikal',
    handledFiles: 'JPG, PNG, WebP',
    category: 'image',
    subGroup: 'Ukuran, Pas Foto & KTP Sheet',
    icon: RotateCw,
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    imageTool: 'image.rotate_flip',
  },
  {
    id: 'image:image.grid_sheet',
    hash: 'image-grid',
    name: 'Grid / KTP Sheet',
    shortDesc: 'Gabung beberapa foto atau KTP ke satu lembar A4/Letter',
    handledFiles: 'JPG, PNG, WebP',
    category: 'image',
    subGroup: 'Ukuran, Pas Foto & KTP Sheet',
    icon: Grid,
    badgeColor: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    imageTool: 'image.grid_sheet',
  },

  // ================= FILE GAMBAR: Scanner, Watermark & Inspeksi Gambar =================
  {
    id: 'image:image.scan_enhance',
    hash: 'image-scan',
    name: 'Scan Enhancer',
    shortDesc: 'Bersihkan bayangan abu-abu pada foto dokumen kertas',
    handledFiles: 'JPG, PNG, WebP',
    category: 'image',
    subGroup: 'Scanner, Watermark & Inspeksi Gambar',
    icon: ScanLine,
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    imageTool: 'image.scan_enhance',
  },
  {
    id: 'image:image.watermark',
    hash: 'image-watermark',
    name: 'Watermark Gambar',
    shortDesc: 'Pasang teks watermark pada banyak gambar sekaligus',
    handledFiles: 'JPG, PNG, WebP',
    category: 'image',
    subGroup: 'Scanner, Watermark & Inspeksi Gambar',
    icon: Stamp,
    badgeColor: 'text-violet-700 bg-violet-50 border-violet-200',
    imageTool: 'image.watermark',
  },
  {
    id: 'image:image.strip_metadata',
    hash: 'image-hapus-exif',
    name: 'Hapus EXIF & GPS',
    shortDesc: 'Hapus data lokasi GPS & kamera demi privasi foto',
    handledFiles: 'JPG, PNG, WebP',
    category: 'image',
    subGroup: 'Scanner, Watermark & Inspeksi Gambar',
    icon: ShieldOff,
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
    imageTool: 'image.strip_metadata',
  },
  {
    id: 'image:image.diff',
    hash: 'image-diff',
    name: 'Bandingkan 2 Gambar',
    shortDesc: 'Buat visual diff heatmap untuk mendeteksi perubahan piksel',
    handledFiles: 'JPG, PNG, WebP',
    category: 'image',
    subGroup: 'Scanner, Watermark & Inspeksi Gambar',
    icon: GitCompare,
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
    imageTool: 'image.diff',
  },
  {
    id: 'image:image.info',
    hash: 'image-info',
    name: 'Info Gambar',
    shortDesc: 'Inspeksi resolusi piksel, rasio aspek, dan ukuran file',
    handledFiles: 'JPG, PNG, WebP',
    category: 'image',
    subGroup: 'Scanner, Watermark & Inspeksi Gambar',
    icon: Info,
    badgeColor: 'text-slate-700 bg-slate-100 border-slate-200',
    imageTool: 'image.info',
  },

  // ================= FILE TEKS & DATA: File Markdown, Tabel & Teks =================
  {
    id: 'utility:util.md_to_pdf',
    hash: 'markdown-ke-pdf',
    name: 'Markdown ke PDF',
    shortDesc: 'Render teks atau file Markdown menjadi dokumen PDF rapi',
    handledFiles: '.md, .txt',
    category: 'data',
    subGroup: 'File Markdown, Tabel & Teks',
    icon: FileText,
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    utilityTool: 'util.md_to_pdf',
  },
  {
    id: 'utility:util.table_to_pdf',
    hash: 'tabel-ke-pdf',
    name: 'Tabel CSV/JSON ke PDF',
    shortDesc: 'Konversi data CSV atau JSON array menjadi tabel laporan PDF',
    handledFiles: '.csv, .json',
    category: 'data',
    subGroup: 'File Markdown, Tabel & Teks',
    icon: Table,
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    utilityTool: 'util.table_to_pdf',
  },
  {
    id: 'utility:util.qr_generate',
    hash: 'buat-qr-code',
    name: 'QR Code Generator',
    shortDesc: 'Buat gambar QR Code PNG dari teks atau URL siap tempel',
    handledFiles: 'Teks / URL',
    category: 'data',
    subGroup: 'File Markdown, Tabel & Teks',
    icon: QrCode,
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    utilityTool: 'util.qr_generate',
  },

  // ================= FILE ARSIP & UMUM: File Arsip ZIP & Checksum =================
  {
    id: 'utility:util.zip_pack',
    hash: 'pack-zip',
    name: 'Pack ke ZIP',
    shortDesc: 'Gabungkan banyak file menjadi satu arsip .zip',
    handledFiles: 'Semua File -> .zip',
    category: 'utility',
    subGroup: 'File Arsip ZIP & Checksum',
    icon: Archive,
    badgeColor: 'text-orange-700 bg-orange-50 border-orange-200',
    utilityTool: 'util.zip_pack',
  },
  {
    id: 'utility:util.zip_unpack',
    hash: 'ekstrak-zip',
    name: 'Ekstrak ZIP',
    shortDesc: 'Buka dan filter isi file .zip secara lokal',
    handledFiles: '.zip',
    category: 'utility',
    subGroup: 'File Arsip ZIP & Checksum',
    icon: FolderOpen,
    badgeColor: 'text-orange-700 bg-orange-50 border-orange-200',
    utilityTool: 'util.zip_unpack',
  },
  {
    id: 'utility:util.hash_checksum',
    hash: 'hash-checksum',
    name: 'Hash SHA-256 / SHA-512',
    shortDesc: 'Hitung checksum integritas file secara kriptografis',
    handledFiles: 'Semua File',
    category: 'utility',
    subGroup: 'File Arsip ZIP & Checksum',
    icon: ShieldCheck,
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    utilityTool: 'util.hash_checksum',
  },

  // ================= MULTI-FILE PIPELINE =================
  {
    id: 'pipeline:studio',
    hash: 'pipeline',
    name: 'AI Agent & Pipeline Studio',
    shortDesc: 'Rangkai kombinasi PDF + Gambar + Arsip & salin perintah CLI/MCP',
    handledFiles: 'Multi-File',
    category: 'pipeline',
    subGroup: 'Otomasi Lintas File',
    icon: Bot,
    badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
  },
];

/**
 * Mengembalikan seluruh tool berdasarkan jenis file yang ditangani.
 */
export function getToolsByCategory(category: NavCategoryId): NavToolEntry[] {
  return NAV_TOOLS.filter((tool) => tool.category === category);
}

export function findNavToolById(id: string): NavToolEntry | undefined {
  return NAV_TOOLS.find((tool) => tool.id === id);
}

export function findNavToolByHash(rawHash: string): NavToolEntry | undefined {
  const hash = rawHash.replace(/^#/, '').trim();
  if (!hash) return undefined;
  if (hash === 'image-tools') return findNavToolById('image:image.compress');
  if (hash === 'utilities') return findNavToolById('utility:util.zip_pack');
  return NAV_TOOLS.find((tool) => tool.hash === hash);
}
