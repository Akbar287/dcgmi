# 09 — Pustaka Prompt

Semua prompt tinggal di `lib/ai/prompts/` sebagai modul TypeScript, bukan string yang tersebar di kode. Setiap prompt punya `id` dan `version`; keduanya disimpan bersama setiap keluaran agar run lama dapat direproduksi.

```ts
export const FGD_SEAT_ARGUE = {
  id: 'fgd.seat.argue',
  version: '1.0.0',
  render: (ctx: SeatContext) => string,
};
```

Mengubah isi prompt **wajib** menaikkan `version`. Run yang sudah tersimpan tetap menunjuk versi lamanya.

---

## 1. Aturan penulisan prompt

1. **Beri peran, bukan identitas.** "Anda anggota panel dengan kompetensi X", bukan "Anda adalah Prof. Y".
2. **Sertakan batas simulasi di setiap prompt kursi.** Model harus tahu ia sedang menguji instrumen.
3. **Minta kekhususan.** Perintah "kritik komponen ini" menghasilkan kritik generik. Perintah "sebutkan bukti yang sulit diperoleh PT Indonesia untuk indikator ini" menghasilkan sesuatu yang berguna.
4. **Izinkan setuju.** Tanpa ini model akan mengarang keberatan demi tampak kritis, dan simulasi kehilangan nilai diagnostiknya.
5. **Pisahkan menilai dari memutuskan.** Argumen dan voting adalah dua panggilan berbeda.
6. **Batasi panjang.** Transkrip yang bertele-tele menyulitkan notulis dan memahalkan run.
7. **Jangan pernah menyisipkan hasil yang diharapkan.** Prompt tidak boleh memuat contoh nilai I-CVI, bobot, atau skor.

---

## 2. Daftar prompt

| ID | Dipakai di | Keluaran |
|---|---|---|
| `persona.extract` | Ekstraksi CV | `PersonaExtractionSchema` |
| `persona.deidentify.check` | Filter de-id | daftar temuan penanda identitas |
| `persona.system` | System prompt kursi | teks |
| `fgd.facilitator.present` | Fasilitator | teks penyajian komponen |
| `fgd.facilitator.probe` | Fasilitator | probe sesuai §3.7.2 |
| `fgd.seat.argue` (v1.1.0: maks. 150 kata, langsung ke inti) | Kursi | argumen |
| `fgd.seat.crosstalk` (v1.1.0: maks. 75 kata, langsung ke inti) | Kursi | tanggapan atas argumen lain |
| `fgd.seat.vote` | Kursi | `VoteSchema` |
| `fgd.notetaker.extract` (v1.1.0: aturan kutipan maks. 30 kata dari satu bagian utuh) | Notulis | `NoteExtractionSchema` |
| `fgd.summarize.item` | Notulis | ringkasan komponen |
| `delphi.seat.rate` | Kursi | `RatingSchema` |
| `delphi.seat.comment` | Kursi | komentar kejelasan |
| `ahp.seat.pairwise` | Kursi | `PairwiseSchema` |
| `ahp.seat.review` | Kursi | revisi pasangan tidak konsisten |
| `scoring.assessor.evidence` (v1.1.0: locator tanpa tanda kutip pembungkus) | Simulasi asesor | pilihan level + locator + alasan |
| `report.chapter.narrate` (v1.0.0) | Narasi bab laporan G1–G7 (`anthropic/claude-sonnet-5`) | teks polos 3–6 paragraf, ≤ 700 kata, hanya dari fakta bab |

---

## 3. Blok batas wajib

Ditempelkan ke setiap prompt kursi:

```
BATAS SIMULASI
Anda adalah simulasi untuk menguji kesiapan instrumen penelitian, bukan
pengganti pakar manusia. Jangan mengaku sebagai orang tertentu. Jangan
mengarang data institusi nyata, angka statistik, atau kutipan sumber yang
tidak Anda yakini. Bila informasi yang diberikan tidak cukup untuk menilai,
katakan demikian secara eksplisit alih-alih menebak.
```

---

## 4. Konteks yang diberikan ke kursi

| Kursi | Menerima |
|---|---|
| FGD, semua kursi | Artefak + komponen aktif + transkrip komponen berjalan |
| FGD, tanggapan silang | Ditambah argumen kursi lain pada komponen itu |
| FGD, voting | Argumen sendiri + komponen; **tanpa** voting kursi lain |
| Delphi R1, kursi lama | Artefak pasca-FGD |
| Delphi R1, kursi `isNewMember` | Artefak saja — **tanpa** transkrip FGD, **tanpa** distribusi keputusan FGD |
| Delphi R2/R3 | Ditambah umpan balik anonim: skor pribadi, median, IQR, distribusi |
| AHP | Hierarki yang sudah content-locked + definisi domain/aspek |

Isolasi kursi baru diuji oleh unit test yang memeriksa prompt hasil render tidak memuat penanda konteks FGD.

---

## 5. Anti-pola

| Jangan | Karena |
|---|---|
| "Anda pakar terkemuka Indonesia di bidang…" | Mendorong nada otoritatif tanpa isi |
| "Berikan kritik tajam" | Menghasilkan keberatan yang dibuat-buat |
| "Nilai relevansi, biasanya 3 atau 4" | Menanamkan hasil ke dalam prompt |
| "Setujui bila tidak ada masalah besar" | Mengaburkan ambang keputusan |
| Meletakkan aturan Tabel 3.5 di prompt kursi | Aturan keputusan milik `lib/method/`, bukan model |
| Menggabungkan argumen + voting dalam satu panggilan | Voting jadi rasionalisasi argumen sendiri |
