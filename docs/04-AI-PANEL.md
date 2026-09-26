# 04 — Panel Pakar AI

## 1. Gagasan

Setiap kursi panel dijalankan oleh **model yang berbeda**, dengan **persona berbeda** yang diturunkan dari CV pakar asli. Tujuannya bukan meniru orangnya, melainkan memperoleh keragaman sudut pandang yang cukup untuk **menguji apakah instrumen tahan terhadap kritik** sebelum pakar manusia melihatnya.

```
Pakar 1  → OpenAI gpt-4o         → persona: IT governance, 15 th, PTN besar
Pakar 2  → DeepSeek deepseek-chat→ persona: IT governance, 9 th, praktisi
Pakar 3  → Qwen qwen-max         → persona: manajemen PT, struktural
Pakar 4  → Anthropic claude-*    → persona: manajemen PT, akademisi
Pakar 5  → Google gemini-*       → persona: SPBE, asesor
Pakar 6  → Mistral mistral-large → persona: sustainability / public value
```

Jumlah kursi dapat diatur. Preset bawaan: **FGD_6** dan **DELPHI_8** sesuai R1–V1.7 §3.7.1 dan §3.8.1.

---

## 2. Mengapa model berbeda per kursi

Enam kursi dari satu model yang sama menghasilkan keluaran yang sangat berkorelasi — panel semacam itu akan "menyetujui" instrumen karena homogenitas, bukan karena instrumennya baik. Memakai keluarga model berbeda (arsitektur, data latih, dan RLHF berbeda) memberi variasi yang lebih berguna untuk **stress-test**.

UI menampilkan peringatan korelasi bila dua kursi memakai `ModelProfile` yang sama, dan menghitung metrik kesamaan keluaran antar-kursi (kesamaan kosakata dan tingkat kesepakatan) setelah tiap sesi. Metrik ini **bukan** temuan penelitian; ia hanya diagnostik kualitas simulasi.

---

## 3. Provider

`lib/ai/provider-registry.ts` memetakan `Provider.key` ke factory Vercel AI SDK.

| Key | Paket | Catatan |
|---|---|---|
| `openai` | `@ai-sdk/openai` | |
| `anthropic` | `@ai-sdk/anthropic` | |
| `google` | `@ai-sdk/google` | |
| `deepseek` | `@ai-sdk/deepseek` | |
| `mistral` | `@ai-sdk/mistral` | |
| `xai` | `@ai-sdk/xai` | |
| `qwen` | `createOpenAICompatible` | endpoint DashScope compatible-mode |
| `custom-*` | `createOpenAICompatible` | model lokal (Ollama, vLLM) |

Kunci API hanya dibaca dari variabel lingkungan di server. `Provider.envKeyName` menyimpan **nama** variabelnya, tidak pernah nilainya.

```ts
export function resolveModel(profile: ModelProfile) {
  const factory = registry[profile.provider.key];
  if (!factory) throw new Error(`Provider tidak dikenal: ${profile.provider.key}`);
  return factory(profile.modelId);
}
```

Mode `MOCK_AI=1` menukar seluruh registry dengan fixture deterministik di `lib/ai/mock/`.

---

## 4. Persona

### 4.1 Pipeline pembentukan

```
CV (PDF/DOCX)
   │ ekstraksi teks
   ▼
generateObject(PersonaExtractionSchema)
   │
   ▼
PersonaBrief mentah
   │ de-identifikasi otomatis (NER + daftar tolak) + tinjauan peneliti
   ▼
PersonaBrief APPROVED
   │ render template
   ▼
systemPrompt (disimpan, diberi versi)
```

### 4.2 Apa yang diekstrak

```ts
const PersonaExtractionSchema = z.object({
  expertiseAreas:  z.array(z.string()).max(8),
  yearsExperience: z.number().int().nullable(),
  institutionType: z.enum(['PTN_BESAR','PTN_MENENGAH','PTS','KEMENTERIAN','INDUSTRI','LAINNYA']).nullable(),
  researchFocus:   z.array(z.string()).max(8),
  methodStance:    z.string().max(400),    // kecenderungan metodologis dari publikasinya
  vocabularyHints: z.array(z.string()).max(15),
  emphasisBias:    z.string().max(300),    // apa yang cenderung ditekankan
});
```

### 4.3 Apa yang **tidak boleh** masuk

Nama, gelar, institusi, kota, judul publikasi spesifik, nomor, alamat, atau apa pun yang memungkinkan identifikasi. Filter de-identifikasi berjalan **sebelum** brief disimpan, dan lagi sebelum brief dikirim ke provider. Brief yang gagal filter tidak dapat di-`APPROVED`.

### 4.4 Template system prompt kursi

```
Anda berperan sebagai anggota panel pakar dalam simulasi uji instrumen penelitian.

PROFIL KOMPETENSI ANDA
- Bidang: {expertiseAreas}
- Pengalaman: sekitar {yearsExperience} tahun
- Latar institusi: {institutionType}
- Fokus perhatian: {researchFocus}
- Kecenderungan metodologis: {methodStance}
- Hal yang biasanya Anda tekankan: {emphasisBias}

KONTEKS
Anda menilai artefak DCGMI — indeks kematangan tata kelola kampus digital untuk
perguruan tinggi Indonesia. Struktur yang dinilai: {artifactSummary}.

TUGAS ANDA
Menguji logika, kejelasan, kelengkapan, keterukuran, dan kesesuaian konteks
komponen yang disajikan. Anda TIDAK menghitung validitas isi.

CARA ANDA MERESPONS
- Berbicara dari sudut pandang bidang Anda, bukan dari sudut pandang umum.
- Tunjukkan masalah konkret: tumpang tindih konstruk, bukti yang sulit diperoleh
  di PT Indonesia, deskriptor level yang tidak terbedakan, definisi ganda.
- Bila Anda setuju, katakan setuju. Jangan mencari kesalahan yang tidak ada.
- Sebut konteks Indonesia bila relevan (akreditasi, SPBE, PDP, keragaman PTN/PTS).
- Maksimal {maxWords} kata.

BATAS
Anda adalah simulasi untuk uji instrumen. Jangan mengaku sebagai orang tertentu,
jangan mengarang data institusi nyata, jangan mengutip sumber yang tidak Anda yakini.
Bila informasi tidak cukup untuk menilai, katakan demikian.
```

Setiap perubahan template menaikkan `promptVersion` dan disimpan bersama hasilnya agar run lama tetap dapat direproduksi.

---

## 5. Peran non-pakar

### Fasilitator
Menyajikan komponen dan paket penilaiannya, mengajukan probe sesuai §3.7.2 (tumpang tindih, kekosongan konstruk, bukti yang sulit diperoleh, kompensasi skor, risiko penggunaan hasil), menjaga agenda corong, dan **tidak boleh** memberi posisi atau menyimpulkan.

### Notulis
Model terpisah. Membaca transkrip satu komponen dan mengeluarkan objek terstruktur:

```ts
const NoteExtractionSchema = z.object({
  suggestions: z.array(z.object({
    seatIndex: z.number().int(),
    action:    z.enum(['TAMBAH','HAPUS','GABUNG','PECAH','PINDAH','RUMUS_ULANG']),
    quote:     z.string(),      // harus kutipan verbatim dari transkrip
    rationale: z.string(),
  })),
});
```

Validasi: `quote` harus benar-benar substring dari utterance kursi tersebut. Bila tidak, ekstraksi diulang sekali; bila gagal lagi, langkah ditandai `FAILED`.

---

## 6. Voting

Voting **tidak** diambil dari teks bebas. Setiap kursi dipanggil ulang dengan `generateObject`:

```ts
const VoteSchema = z.object({
  position: z.enum(['TERIMA','TERIMA_DENGAN_REVISI','TOLAK']),
  reason:   z.string().min(20).max(600),
  proposedAction: z.enum(['TAMBAH','HAPUS','GABUNG','PECAH','PINDAH','RUMUS_ULANG']).nullable(),
});
```

Urutan bicara diacak per komponen untuk mengurangi efek jangkar posisi. Kursi tidak melihat voting kursi lain sebelum memberikan suaranya sendiri.

---

## 7. Delphi: anonimitas dan isolasi

Dua ketentuan §3.8.1 yang ditegakkan di kode, bukan sekadar dicatat:

1. **Kursi tidak melihat jawaban individu kursi lain.** Umpan balik antar-ronde hanya memuat skor pribadi, median, IQR, dan distribusi kelompok.
2. **Kursi `isNewMember = true` memiliki `contextScope = 'ARTIFACT_ONLY'`.** Pada ronde 1, orkestrator membangun prompt mereka tanpa transkrip FGD dan tanpa distribusi keputusan FGD. Ada uji unit yang memeriksa bahwa prompt yang dihasilkan tidak memuat penanda konteks FGD.

Rating Delphi memakai `generateObject`:

```ts
const RatingSchema = z.object({
  relevance:   z.number().int().min(1).max(4),
  clarityFlag: z.boolean(),
  clarityNote: z.string().max(300).nullable(),
});
```

Relevansi dan kejelasan sengaja dipisah agar skor relevansi tidak tercampur mutu redaksi.

---

## 8. AHP: pengisian matriks

Kursi tidak diminta mengisi matriks `n×n` sekaligus — beban itu memicu inkonsistensi buatan. Sebaliknya, kursi diminta menilai **pasangan satu per satu**:

```ts
const PairwiseSchema = z.object({
  preferred: z.enum(['A','B','EQUAL']),
  intensity: z.number().int().min(1).max(9),   // 1 bila EQUAL
  reason:    z.string().max(300),
});
```

Matriks disusun dari jawaban pasangan; resiprokal diisi otomatis. Untuk 8 domain ada 28 pasangan per kursi.

Bila `CR >= 0.10`, sistem mengembalikan ke kursi yang sama dengan daftar pasangan paling tidak konsisten dan meminta peninjauan — **tidak** memperbaiki angka secara otomatis (§3.9.2). Maksimal 2 putaran peninjauan; setelah itu matriks ditandai `RETURNED_UNRESOLVED` dan dikeluarkan dari agregasi, dengan catatan di laporan.

---

## 9. Biaya dan konkurensi

- Batas konkurensi default 4 panggilan paralel (`p-limit`).
- Estimasi biaya sebelum run: `jumlah komponen × (kursi × (argumen + vote) + notulis + fasilitator) × perkiraan token × tarif`.
- Pemutus otomatis bila `spentUsd > budgetUsd`.
- Retry: 2 kali dengan exponential backoff untuk kegagalan jaringan. Kegagalan skema **tidak** di-retry tanpa batas — 2 percobaan lalu `FAILED`.
- Setiap panggilan dicatat: model, `promptHash`, token masuk/keluar, latensi, biaya.

---

## 10. Yang tidak boleh dilakukan orkestrator

- Mengisi nilai default saat model gagal menjawab sesuai skema.
- Mengulang panggilan sampai memperoleh jawaban yang "diinginkan".
- Menyembunyikan kursi yang gagal dari perhitungan tanpa mencatatnya.
- Menyesuaikan `temperature` atau prompt di tengah run agar hasil lebih "rapi".
- Menulis apa pun dengan `dataOrigin: REAL`.

Semuanya akan membuat dry-run kehilangan nilai diagnostiknya, dan lebih buruk lagi, membuat keluarannya tampak seperti data.
