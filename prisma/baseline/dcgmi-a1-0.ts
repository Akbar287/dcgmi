/**
 * Baseline provisional DCGMI-A1.0 — R1-V1.7 §3.5, §4.2.
 *
 * 8 domain, 15 aspek, 43 indikator. Distribusi indikator 7-5-6-6-4-5-4-6.
 *
 * Struktur ini adalah OBJEK YANG AKAN DIUJI, bukan instrumen final. Perubahan
 * hanya boleh terjadi melalui alur FGD/Delphi di dalam aplikasi dengan
 * ChangeLogEntry, bukan dengan menyunting berkas ini.
 *
 * C20b dan C42 adalah controlled exceptions (CH-08). Jangan dihapus atau
 * dinomori ulang tanpa keputusan versi eksplisit.
 *
 * Pemetaan SDGs di bawah bersifat provisional dan akan diverifikasi pakar
 * keberlanjutan pada Tahap 4 (§3.8).
 */

export interface BaselineIndicator {
  code: string;
  name: string;
  isControlledException?: boolean;
  exceptionNote?: string;
}

export interface BaselineAspect {
  code: string;
  name: string;
  rationale: string;
  indicators: BaselineIndicator[];
}

export interface BaselineDomain {
  code: string;
  name: string;
  rationale: string;
  sdgTags: string[];
  slrStrings: string[];
  aspects: BaselineAspect[];
}

export const BASELINE_A1_0: BaselineDomain[] = [
  {
    code: 'D1',
    name: 'Infrastruktur Teknologi Akademik',
    rationale: 'Seluruh aspek berkaitan dengan fondasi teknologi yang mendukung operasional akademik.',
    sdgTags: ['SDG4', 'SDG9'],
    slrStrings: ['S1', 'S3', 'S5'],
    aspects: [
      {
        code: 'A01',
        name: 'Infrastruktur Jaringan dan Komputasi',
        rationale: 'Ketiga kode berkaitan dengan fondasi fisik dan virtual infrastruktur TI.',
        indicators: [
          { code: 'C02', name: 'Konektivitas jaringan kampus' },
          { code: 'C03', name: 'Infrastruktur cloud computing' },
          { code: 'C04', name: 'Kapasitas pusat data' },
        ],
      },
      {
        code: 'A02',
        name: 'Platform Pembelajaran Digital',
        rationale: 'Keduanya berkaitan dengan platform yang digunakan mahasiswa untuk belajar.',
        indicators: [
          { code: 'C01', name: 'Ketersediaan LMS terintegrasi' },
          { code: 'C07', name: 'Sistem pembelajaran adaptif' },
        ],
      },
      {
        code: 'A03',
        name: 'Teknologi Emerging dan Inovasi',
        rationale: 'Keduanya berkaitan dengan adopsi dan pengembangan teknologi baru.',
        indicators: [
          { code: 'C05', name: 'Pengembangan aplikasi akademik' },
          { code: 'C06', name: 'Adopsi teknologi emerging' },
        ],
      },
    ],
  },
  {
    code: 'D2',
    name: 'Strategi dan Perencanaan Digital',
    rationale: 'Kedua aspek berkaitan dengan arah dan visi transformasi digital institusi.',
    sdgTags: ['SDG9', 'SDG16'],
    slrStrings: ['S1'],
    aspects: [
      {
        code: 'A04',
        name: 'Perencanaan Strategis Digital',
        rationale: 'Ketiganya berkaitan dengan perumusan arah digital institusi.',
        indicators: [
          { code: 'C08', name: 'Rencana strategis digital' },
          { code: 'C09', name: 'Keselarasan strategi digital dengan strategi institusi' },
          { code: 'C10', name: 'Roadmap transformasi digital' },
        ],
      },
      {
        code: 'A05',
        name: 'Inovasi Proses dan Kepemimpinan',
        rationale: 'Keduanya berkaitan dengan penggerak perubahan digital.',
        indicators: [
          { code: 'C11', name: 'Inovasi proses bisnis digital' },
          { code: 'C12', name: 'Kepemimpinan digital' },
        ],
      },
    ],
  },
  {
    code: 'D3',
    name: 'Tata Kelola dan Manajemen Digital',
    rationale: 'Kedua aspek berkaitan dengan kerangka organisasional tata kelola TI.',
    sdgTags: ['SDG16'],
    slrStrings: ['S1'],
    aspects: [
      {
        code: 'A06',
        name: 'Struktur dan Mekanisme Governance',
        rationale: 'Keempatnya berkaitan dengan struktur, kebijakan, dan mekanisme keputusan TI.',
        indicators: [
          { code: 'C13', name: 'Struktur governance teknologi informasi' },
          { code: 'C14', name: 'Koordinasi dan kolaborasi teknologi informasi' },
          { code: 'C17', name: 'Kebijakan teknologi informasi internal' },
          {
            code: 'C20b',
            name: 'Mekanisme pengambilan keputusan TI',
            isControlledException: true,
            exceptionNote:
              'Controlled exception R1-V1.7 CH-08. Hasil penajaman pengodean; penghapusan atau penomoran ulang memerlukan keputusan versi eksplisit dan pemeriksaan dampak.',
          },
        ],
      },
      {
        code: 'A07',
        name: 'Manajemen Risiko dan Layanan TI',
        rationale: 'Keduanya berkaitan dengan pengelolaan operasional dan risiko layanan TI.',
        indicators: [
          { code: 'C15', name: 'Manajemen risiko digital' },
          { code: 'C16', name: 'Manajemen layanan teknologi informasi' },
        ],
      },
    ],
  },
  {
    code: 'D4',
    name: 'Keamanan Siber dan Kepatuhan',
    rationale: 'Kedua aspek berkaitan dengan perlindungan dan kepatuhan regulasi.',
    sdgTags: ['SDG16'],
    slrStrings: ['S1', 'S2'],
    aspects: [
      {
        code: 'A08',
        name: 'Keamanan Siber dan Kriptografi',
        rationale: 'Ketiganya berkaitan dengan perlindungan teknis aset digital.',
        indicators: [
          { code: 'C18', name: 'Kematangan keamanan siber kampus' },
          { code: 'C19', name: 'Kriptografi dan enkripsi data' },
          { code: 'C20', name: 'Kapabilitas incident response' },
        ],
      },
      {
        code: 'A09',
        name: 'Audit dan Kepatuhan',
        rationale: 'Ketiganya berkaitan dengan pemeriksaan dan kepatuhan terhadap ketentuan.',
        indicators: [
          { code: 'C21', name: 'Audit teknologi digital' },
          { code: 'C22', name: 'Perlindungan data pribadi' },
          { code: 'C23', name: 'Kebijakan keamanan informasi' },
        ],
      },
    ],
  },
  {
    code: 'D5',
    name: 'Kapabilitas dan Budaya Digital',
    rationale: 'Kedua aspek berkaitan dengan dimensi manusia dalam transformasi digital.',
    sdgTags: ['SDG4'],
    slrStrings: ['S1', 'S4'],
    aspects: [
      {
        code: 'A10',
        name: 'Kompetensi dan Literasi Digital',
        rationale: 'Ketiganya berkaitan dengan kemampuan digital sivitas akademika.',
        indicators: [
          { code: 'C24', name: 'Kompetensi digital sumber daya manusia' },
          { code: 'C26', name: 'Pelatihan dan pengembangan digital' },
          { code: 'C27', name: 'Literasi digital sivitas akademika' },
        ],
      },
      {
        code: 'A11',
        name: 'Budaya Digital dan Kesiapan Perubahan',
        rationale: 'Aspek tunggal yang menangkap dimensi budaya organisasi.',
        indicators: [{ code: 'C25', name: 'Budaya digital dan keterbukaan terhadap inovasi' }],
      },
    ],
  },
  {
    code: 'D6',
    name: 'Pengelolaan Data dan Informasi',
    rationale: 'Kedua aspek berkaitan dengan siklus hidup dan pemanfaatan data.',
    sdgTags: ['SDG16', 'SDG17'],
    slrStrings: ['S1', 'S6'],
    aspects: [
      {
        code: 'A12',
        name: 'Manajemen dan Tata Kelola Data',
        rationale: 'Ketiganya berkaitan dengan pengelolaan dan mutu data institusional.',
        indicators: [
          { code: 'C28', name: 'Manajemen data institusional' },
          { code: 'C30', name: 'Kualitas dan integritas data' },
          { code: 'C32', name: 'Pengelolaan data penelitian' },
        ],
      },
      {
        code: 'A13',
        name: 'Analitika dan Pemanfaatan Data',
        rationale: 'Keduanya berkaitan dengan pemanfaatan data untuk keputusan.',
        indicators: [
          { code: 'C29', name: 'Analitika data dan dasbor' },
          { code: 'C31', name: 'Pengambilan keputusan berbasis data' },
        ],
      },
    ],
  },
  {
    code: 'D7',
    name: 'Keterpaduan Layanan Digital',
    rationale:
      'Aspek tunggal yang cukup koheren dan substansial untuk menjadi domain sendiri. D7 mewakili wujud kematangan, sedangkan D1 mewakili prasyaratnya.',
    sdgTags: ['SDG9', 'SDG17'],
    slrStrings: ['S1', 'S3'],
    aspects: [
      {
        code: 'A14',
        name: 'Integrasi dan Interoperabilitas Layanan',
        rationale: 'Keempatnya berkaitan dengan keterpaduan ekosistem layanan digital.',
        indicators: [
          { code: 'C33', name: 'Integrasi layanan digital kampus' },
          { code: 'C34', name: 'Single sign-on dan identitas digital' },
          { code: 'C35', name: 'Interoperabilitas sistem' },
          { code: 'C36', name: 'Layanan kampus berbasis perangkat bergerak' },
        ],
      },
    ],
  },
  {
    code: 'D8',
    name: 'Kepuasan dan Pengalaman Pengguna',
    rationale: 'Aspek tunggal yang merupakan ukuran akhir dari seluruh domain lainnya.',
    sdgTags: ['SDG4', 'SDG16'],
    slrStrings: ['S1'],
    aspects: [
      {
        code: 'A15',
        name: 'Kepuasan dan Pengalaman Pengguna',
        rationale: 'Keenamnya berkaitan dengan persepsi dan pengalaman pengguna akhir.',
        indicators: [
          { code: 'C37', name: 'Kepuasan pengguna layanan digital' },
          { code: 'C38', name: 'Kualitas dan tingkat layanan digital' },
          { code: 'C39', name: 'Tingkat adopsi dan pemanfaatan layanan' },
          { code: 'C40', name: 'Aksesibilitas dan inklusivitas digital' },
          { code: 'C41', name: 'Mekanisme umpan balik dan perbaikan berkelanjutan' },
          {
            code: 'C42',
            name: 'Pengalaman pengguna layanan digital',
            isControlledException: true,
            exceptionNote:
              'Controlled exception R1-V1.7 CH-08. Dipisahkan dari C37 karena kepuasan mengukur penilaian akhir sedangkan pengalaman mengukur proses interaksi. Pemisahan ini termasuk isu yang dibawa ke FGD.',
          },
        ],
      },
    ],
  },
];

/**
 * Contoh paket penilaian lengkap — R1-V1.7 Tabel 3.17.
 * Satu indikator diisi penuh agar tim melihat bentuk targetnya. Sisanya
 * sengaja dibiarkan kosong supaya G1_BASELINE benar-benar gagal sampai
 * rubrik dan persyaratan bukti dilengkapi.
 */
export const EXAMPLE_PACKAGE = {
  indicatorCode: 'C01',
  operationalDefinition:
    'Ketersediaan learning management system institusional yang terintegrasi dengan sistem akademik dan digunakan sebagai kanal resmi pembelajaran.',
  assessmentObject: 'Platform LMS institusional beserta integrasi dan tata kelola penggunaannya.',
  boundaryNote:
    'Tidak mencakup platform konferensi video dan repositori materi yang berdiri sendiri; keduanya dinilai pada indikator lain.',
  sources: ['Bravo-Jaico et al. (2025)', 'Chounta et al. (2024)'],
  rubric: [
    { level: 1, label: 'Initial', descriptor: 'Belum ada LMS; pembelajaran sepenuhnya tatap muka tanpa dukungan platform digital.' },
    { level: 2, label: 'Developing', descriptor: 'LMS sudah ada tetapi bersifat standalone, digunakan oleh sebagian kecil dosen, tanpa integrasi ke sistem akademik.' },
    { level: 3, label: 'Defined', descriptor: 'LMS terstandarisasi dan terintegrasi dengan SIAKAD; digunakan oleh mayoritas dosen; kebijakan penggunaan sudah terdokumentasi.' },
    { level: 4, label: 'Managed', descriptor: 'LMS terintegrasi penuh dengan learning analytics; penggunaan termonitor; laporan pemanfaatan berkala; perbaikan berbasis data.' },
    { level: 5, label: 'Optimized', descriptor: 'LMS adaptive AI-driven dengan personalisasi jalur belajar; integrasi dengan sistem pendukung keputusan; menjadi rujukan nasional.' },
  ],
  evidence: [
    { kind: 'NORMATIF' as const, mandatory: true, minimumFor: 3, description: 'Kebijakan atau SK penggunaan LMS institusional yang berlaku dan bertanggal.' },
    { kind: 'IMPLEMENTASI' as const, mandatory: true, minimumFor: 2, description: 'Bukti instansi LMS aktif beserta cakupan mata kuliah yang terdaftar.' },
    { kind: 'OPERASIONAL' as const, mandatory: false, minimumFor: 4, description: 'Laporan pemanfaatan berkala: jumlah kelas aktif, keterlibatan dosen dan mahasiswa.' },
    { kind: 'HASIL' as const, mandatory: false, minimumFor: 4, description: 'Analisis learning analytics yang dipakai untuk keputusan akademik.' },
    { kind: 'PERBAIKAN' as const, mandatory: false, minimumFor: 5, description: 'Jejak perbaikan berbasis data dan personalisasi jalur belajar.' },
  ],
};
