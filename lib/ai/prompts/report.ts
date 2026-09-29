import { SIMULATION_BOUNDARY, type PromptSpec } from "./fgd";

// docs/09 `report.chapter.narrate`: prose for one chapter of the G1–G7 report.
// The narrator only restates the facts given; it never invents numbers and
// never presents simulation output as research findings.

export const REPORT_SYSTEM = `Anda penulis laporan teknis untuk dry-run instrumen penelitian DCGMI. Anda menulis dalam Bahasa Indonesia baku, lugas, dan faktual.

ATURAN
- Gunakan HANYA angka, kode, dan kutipan yang ada di FAKTA. Jangan mengarang angka, sumber, atau kesimpulan.
- Semua data adalah keluaran simulasi (dataOrigin SIMULATED) untuk menguji instrumen, bukan hasil penelitian. Jangan menyebutnya "temuan", "hasil penelitian", "validitas terbukti", atau sejenisnya; gunakan "hasil uji coba", "keluaran simulasi".
- Kursi panel adalah persona simulasi; jangan mengatribusikan pendapat kepada orang nyata.
- Bila fakta kosong atau tahap belum dijalankan, katakan demikian secara eksplisit.
- Jangan menulis ulang tabel lengkap; tabel lengkap dicetak terpisah. Rujuk angka kunci dan jelaskan maknanya bagi kesiapan instrumen.

${SIMULATION_BOUNDARY}`;

export interface NarrateContext {
  chapterTitle: string;
  facts: string;
}

export const REPORT_CHAPTER_NARRATE: PromptSpec<NarrateContext> = {
  id: "report.chapter.narrate",
  version: "1.0.0",
  render: (c) => `BAB: ${c.chapterTitle}

FAKTA (JSON)
${c.facts}

Tulis narasi bab ini dalam 3–6 paragraf (maksimal 700 kata): apa yang dijalankan, angka kunci, butir atau komponen yang bermasalah beserta alasannya (kutip argumen atau catatan bila ada di FAKTA), status gate dan syarat yang belum terpenuhi, serta implikasinya bagi tahap berikutnya. Paragraf pertama menyatakan bahwa ini keluaran simulasi. Tanpa judul, tanpa daftar berpoin, tanpa Markdown.`,
};
