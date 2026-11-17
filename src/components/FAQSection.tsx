import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleQuestionMark,
  Cpu,
  DatabaseZap,
  ExternalLink,
  FileCheck2,
  HardDrive,
  Lock,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const ARCHITECTURE_PILLARS = [
  {
    title: 'Zero Cloud Upload',
    description:
      'Seluruh dokumen PDF, gambar, dan arsip diproses 100% di memori RAM perangkat Anda melalui WebAssembly & Web Workers. Tidak ada file yang dikirim ke server.',
    icon: HardDrive,
    accent: 'text-emerald-700 bg-emerald-50 border-emerald-200/70',
  },
  {
    title: 'Offline-Ready',
    description:
      'Semua tool inti tetap berjalan penuh tanpa koneksi internet. Anda bisa mengujinya kapan saja dengan mematikan Wi-Fi atau mengaktifkan mode pesawat.',
    icon: WifiOff,
    accent: 'text-indigo-700 bg-indigo-50 border-indigo-200/70',
  },
  {
    title: 'Open-Source & Auditable',
    description:
      'Tidak ada database, cookies pelacak isi dokumen, ataupun telemetri tersembunyi. Kode sumber terbuka penuh dan siap diaudit secara independen.',
    icon: ShieldCheck,
    accent: 'text-slate-700 bg-slate-100 border-slate-200',
  },
];

const DATA_PROTECTION_COMMITMENTS = [
  {
    title: 'Pemrosesan Memori Sementara (RAM-Only)',
    description:
      'Dokumen hanya dimuat sementara di RAM selama manipulasi berlangsung dan otomatis terhapus saat tab ditutup atau halaman dimuat ulang.',
    icon: DatabaseZap,
  },
  {
    title: 'Keamanan Kata Sandi & Redaksi Permanen',
    description:
      'Password PDF dan sensor area/teks (NIK, email, nomor HP) diproses lokal di perangkat Anda. Mode burn-in me-rasterisasi halaman agar teks terhapus permanen.',
    icon: Lock,
  },
  {
    title: 'Kepatuhan Dokumen Kantor, Instansi & Legal',
    description:
      'Tanpa transfer biner ke pihak ketiga serta mendukung mode desktop Tauri dan CLI/MCP lokal untuk alur kerja dokumen internal yang sensitif.',
    icon: FileCheck2,
  },
];

interface PrivacyPolicyViewProps {
  onOpenFaq?: () => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onOpenFaq }) => {
  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 py-2">
      {/* Header Kebijakan Privasi */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold mb-3">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span>Privacy &amp; Policy</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Kebijakan Privasi &amp; Keamanan Data Lokal
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-2xl leading-relaxed">
          Semua manipulasi PDF, gambar, penyensoran PII, serta otomasi pipeline di Work Tool Super App
          berjalan langsung di perangkat Anda tanpa pengunggahan ke server cloud eksternal.
        </p>

        {/* 3 Kartu Pilar Arsitektur */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {ARCHITECTURE_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col gap-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg border ${pillar.accent}`}>
                    <Icon size={17} />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">{pillar.title}</h2>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{pillar.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Komitmen Perlindungan Data & Dokumen */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Komitmen Perlindungan Data &amp; Dokumen
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Standar teknis bagaimana Work Tool Super App menangani file, metadata, dan kata sandi Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DATA_PROTECTION_COMMITMENTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-slate-200/80 p-4 space-y-2 bg-white"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Icon size={16} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">{item.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3 Cara Membuktikan Secara Transparan */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              3 Cara Membuktikan Secara Transparan
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Anda dapat memverifikasi sendiri bahwa tidak ada file yang dikirim ke luar perangkat.
            </p>
          </div>
          {onOpenFaq && (
            <button
              type="button"
              onClick={onOpenFaq}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
            >
              <CircleQuestionMark size={14} />
              <span>Buka Menu Khusus FAQ</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>1. Uji Mode Offline / Pesawat</span>
            </div>
            <p className="leading-relaxed">
              Matikan Wi-Fi atau data seluler setelah aplikasi terbuka, lalu jalankan gabung, sensor,
              kompres, atau olah gambar. Semua tetap berjalan normal.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>2. Periksa Network Tab (F12)</span>
            </div>
            <p className="leading-relaxed">
              Buka DevTools &gt; tab <em>Network</em>. Saat mengolah file, tidak ada payload biner
              dokumen yang diunggah ke endpoint eksternal mana pun.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>3. Audit Kode Sumber GitHub</span>
            </div>
            <p className="leading-relaxed">
              Seluruh kode sumber terbuka untuk diaudit langsung di{' '}
              <a
                href="https://github.com/alafgani1000/tenggoo_pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-0.5 font-semibold"
              >
                GitHub <ExternalLink size={11} />
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

interface FAQSectionProps {
  onOpenPrivacy?: () => void;
}

export const FAQSection: React.FC<FAQSectionProps> = ({ onOpenPrivacy }) => {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'item-1': true,
  });

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const faqs: FAQItem[] = [
    {
      id: 'item-1',
      question: 'Apakah file PDF, gambar, dan dokumen saya aman dan tidak akan bocor?',
      icon: ShieldCheck,
      answer: (
        <p>
          <strong className="text-slate-900 font-semibold">Sangat aman.</strong> Berbeda dengan
          layanan online konvensional yang mewajibkan unggahan dokumen ke server cloud pihak ketiga,{' '}
          <span className="font-semibold text-indigo-700">
            Work Tool Super App memproses 100% file secara lokal di perangkat Anda (Client-Side)
          </span>
          . File Anda tidak pernah dikirim atau meninggalkan komputer maupun smartphone Anda sedetik
          pun.
        </p>
      ),
    },
    {
      id: 'item-2',
      question: 'Bagaimana cara membuktikan bahwa file tidak dikirim ke server?',
      icon: WifiOff,
      answer: (
        <div className="space-y-2 text-sm text-slate-600">
          <p>Anda dapat membuktikannya sendiri secara transparan dengan 3 cara mudah:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-slate-700">
            <li>
              <strong className="text-slate-800">Uji Mode Offline / Pesawat:</strong> Setelah halaman
              terbuka, matikan koneksi Wi-Fi atau data seluler, lalu proses dokumen (gabung, sensor,
              kompres, atau olah gambar). Aplikasi tetap bekerja lancar tanpa internet.
            </li>
            <li>
              <strong className="text-slate-800">Periksa Network Tab:</strong> Tekan{' '}
              <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono">
                F12
              </kbd>{' '}
              &gt; tab <em>Network</em>. Saat memproses file, tidak ada unggahan payload biner
              dokumen ke server eksternal mana pun.
            </li>
            <li>
              <strong className="text-slate-800">Kode Terbuka (Open Source):</strong> Seluruh kode
              sumber aplikasi terbuka di{' '}
              <a
                href="https://github.com/alafgani1000/tenggoo_pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-0.5 font-medium"
              >
                GitHub <ExternalLink size={12} />
              </a>{' '}
              dan dapat diaudit langsung oleh tim keamanan Anda.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'item-3',
      question: 'Apakah Work Tool Super App menyimpan data dokumen, teks, atau gambar saya?',
      icon: DatabaseZap,
      answer: (
        <p>
          <strong className="text-slate-900 font-semibold">Tidak sama sekali.</strong> Kami tidak
          menyediakan database atau penyimpanan cloud. Dokumen Anda hanya dimuat sementara ke dalam
          memori RAM selama proses berlangsung, lalu terhapus seketika begitu halaman ditutup atau
          di-refresh.
        </p>
      ),
    },
    {
      id: 'item-4',
      question:
        'Jika saya mengolah file sensitif, ber-password, atau menyensor PII/NIK, apakah aman?',
      icon: Lock,
      answer: (
        <p>
          <strong className="text-slate-900 font-semibold">Aman.</strong> Pada fitur seperti{' '}
          <em>Buka Kunci PDF</em>, <em>Sensor Area / Teks (Redact)</em>, dan{' '}
          <em>Hapus Metadata EXIF</em>, kata sandi maupun isi dokumen hanya diproses oleh engine
          lokal di memori perangkat Anda. Untuk mode redaksi burn-in, halaman di-rasterisasi ulang
          secara lokal sehingga teks asli benar-benar terhapus dan tidak bisa diekstrak kembali.
        </p>
      ),
    },
    {
      id: 'item-5',
      question: 'Teknologi apa yang digunakan untuk memproses PDF & gambar tanpa server?',
      icon: Cpu,
      answer: (
        <p>
          Work Tool Super App memanfaatkan teknologi lokal modern:{' '}
          <strong>WebAssembly (Ghostscript WASM)</strong> untuk kompresi PDF berperforma tinggi,{' '}
          <strong>PDF-Lib &amp; PDF.js</strong> untuk manipulasi dan rendering halaman langsung di
          memori, <strong>HTML5 Canvas</strong> untuk pemrosesan gambar &amp; EXIF stripping, serta{' '}
          <strong>Web Workers</strong> agar pemrosesan tetap responsif tanpa membekukan layar.
        </p>
      ),
    },
    {
      id: 'item-6',
      question:
        'Apakah Work Tool Super App aman digunakan untuk keperluan kantor, instansi, atau dokumen legal?',
      icon: FileCheck2,
      answer: (
        <p>
          <strong className="text-slate-900 font-semibold">Ya.</strong> Karena nol transfer data ke
          pihak ketiga serta dukungan eksekusi lokal via aplikasi desktop (Tauri) maupun CLI/MCP
          lokal, Work Tool Super App sangat cocok untuk alur kerja dokumen internal, legal, keuangan, dan
          kepatuhan perlindungan data pribadi.
        </p>
      ),
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 py-2">
      {/* Header Menu Khusus FAQ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold mb-2.5">
            <CircleQuestionMark size={14} className="text-indigo-600" />
            <span>Menu Khusus FAQ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            FAQ — Pertanyaan Umum seputar Keamanan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-2xl">
            Jawaban lengkap terkait keamanan dokumen, pemrosesan offline, kata sandi, dan teknologi
            client-side di Work Tool Super App.
          </p>
        </div>

        {onOpenPrivacy && (
          <button
            type="button"
            onClick={onOpenPrivacy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold transition-colors shrink-0 self-start sm:self-center"
          >
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Lihat Privacy &amp; Policy</span>
          </button>
        )}
      </div>

      {/* Daftar Accordion FAQ */}
      <section className="space-y-2.5">
        {faqs.map((faq) => {
          const isOpen = !!openItems[faq.id];
          const Icon = faq.icon;

          return (
            <div
              key={faq.id}
              className="bg-white rounded-xl border border-slate-200/90 shadow-sm transition-colors overflow-hidden hover:border-slate-300"
            >
              <button
                type="button"
                onClick={() => toggleItem(faq.id)}
                className="w-full text-left px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg shrink-0 transition-colors ${
                      isOpen ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon size={17} />
                  </div>
                  <span className="font-semibold text-slate-800 text-sm sm:text-base leading-snug">
                    {faq.question}
                  </span>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-slate-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-indigo-600' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 sm:px-5 pb-4 pt-2 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
};
