import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ChevronDown, 
  WifiOff, 
  Lock, 
  Cpu, 
  FileCheck2, 
  DatabaseZap, 
  ExternalLink 
} from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const FAQSection: React.FC = () => {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'item-1': true, // item pertama terbuka secara default
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
      question: 'Apakah file PDF saya aman dan tidak akan bocor?',
      icon: ShieldCheck,
      answer: (
        <p>
          <strong className="text-slate-900 font-semibold">Sangat aman.</strong> Berbeda dengan layanan PDF online konvensional yang mengharuskan Anda mengunggah dokumen ke server cloud pihak ketiga, <span className="font-semibold text-purple-700">Tenggoo PDF memproses 100% file secara lokal di perangkat Anda (Client-Side)</span>. File Anda tidak pernah dikirim atau meninggalkan komputer/smartphone Anda sedetik pun.
        </p>
      ),
    },
    {
      id: 'item-2',
      question: 'Bagaimana cara membuktikan bahwa file tidak dikirim ke server?',
      icon: WifiOff,
      answer: (
        <div className="space-y-2 text-sm text-slate-600">
          <p>Anda dapat mengujinya sendiri secara transparan dengan 3 cara mudah:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-slate-700">
            <li>
              <strong className="text-slate-800">Coba Mode Offline / Pesawat:</strong> Buka situs ini, matikan koneksi Wi-Fi atau data seluler Anda, lalu proses dokumen (gabung, putar, kompres). Aplikasi tetap bekerja lancar tanpa internet!
            </li>
            <li>
              <strong className="text-slate-800">Periksa Network Tab:</strong> Tekan <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono">F12</kbd> di keyboard Anda (Inspect Element) &gt; tab <em>Network</em>. Saat mengolah PDF, Anda tidak akan melihat data biner dokumen dikirim ke server mana pun.
            </li>
            <li>
              <strong className="text-slate-800">Kode Terbuka (Open Source):</strong> Seluruh kode sumber aplikasi ini terbuka untuk publik di{' '}
              <a
                href="https://github.com/alafgani1000/tenggoo_pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:text-purple-800 underline inline-flex items-center gap-0.5 font-medium"
              >
                GitHub <ExternalLink size={12} />
              </a>{' '}
              dan siap diaudit oleh siapa saja.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'item-3',
      question: 'Apakah Tenggoo PDF menyimpan data dokumen, teks, atau gambar saya?',
      icon: DatabaseZap,
      answer: (
        <p>
          <strong className="text-slate-900 font-semibold">Tidak sama sekali.</strong> Kami tidak menyediakan database atau penyimpanan cloud. Dokumen Anda hanya dimuat sementara ke dalam memori RAM browser selama proses manipulasi berlangsung, dan otomatis terhapus seketika begitu halaman ditutup atau di-refresh.
        </p>
      ),
    },
    {
      id: 'item-4',
      question: 'Jika saya mengolah file sensitif atau ber-password, apakah password saya aman?',
      icon: Lock,
      answer: (
        <p>
          <strong className="text-slate-900 font-semibold">Aman.</strong> Pada fitur seperti <em>Buka Kunci PDF</em>, kata sandi yang Anda ketikkan hanya diproses oleh engine PDF lokal di memori perangkat Anda untuk proses dekripsi. Kata sandi tidak dicatat, tidak disimpan di cookies atau local storage, dan tidak dikirim ke internet.
        </p>
      ),
    },
    {
      id: 'item-5',
      question: 'Teknologi apa yang digunakan untuk memproses PDF tanpa server?',
      icon: Cpu,
      answer: (
        <p>
          Tenggoo PDF memanfaatkan teknologi web browser modern mutakhir: <strong>WebAssembly (Ghostscript WASM)</strong> untuk kompresi file berperforma tinggi, <strong>PDF-Lib</strong> untuk perakitan struktur halaman langsung di memori, dan <strong>Web Workers</strong> agar proses pengolahan dokumen besar berjalan di latar belakang tanpa membuat browser Anda lag atau macet.
        </p>
      ),
    },
    {
      id: 'item-6',
      question: 'Apakah Tenggoo PDF aman digunakan untuk keperluan kantor, instansi, atau dokumen legal?',
      icon: FileCheck2,
      answer: (
        <p>
          <strong className="text-slate-900 font-semibold">Ya.</strong> Karena tidak ada transfer data ke pihak ketiga, Tenggoo PDF sangat cocok dan patuh terhadap standar perlindungan privasi data pribadi.
        </p>
      ),
    },
  ];

  return (
    <section className="w-full max-w-4xl mx-auto mt-12 mb-8 px-2 sm:px-4">
      {/* Header section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200/80 text-purple-700 text-xs font-semibold mb-2.5 shadow-sm">
          <ShieldCheck size={14} className="text-purple-600" />
          <span>Keamanan & Transparansi Data</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
          Pertanyaan Umum seputar Keamanan
        </h2>
        <p className="text-sm text-slate-600 mt-1 max-w-xl mx-auto">
          Penjelasan teknis mengapa dokumen Anda 100% terlindungi dan tidak dapat dilihat oleh siapa pun.
        </p>
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {faqs.map((faq) => {
          const isOpen = !!openItems[faq.id];
          const Icon = faq.icon;

          return (
            <div
              key={faq.id}
              className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200/80 shadow-sm transition-all duration-200 overflow-hidden hover:border-slate-300"
            >
              <button
                type="button"
                onClick={() => toggleItem(faq.id)}
                className="w-full text-left px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg shrink-0 transition-colors ${
                    isOpen ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <span className="font-semibold text-slate-800 text-sm sm:text-base leading-snug">
                    {faq.question}
                  </span>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-slate-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'transform rotate-180 text-purple-600' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100/80">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
