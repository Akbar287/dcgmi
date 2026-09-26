# 07 — Pagar Integritas Riset

Dokumen ini adalah bagian terpenting dari repositori. Bacalah sebelum menulis fitur apa pun yang menyentuh data, prompt, atau ekspor.

---

## 1. Masalah yang dicegah

Aplikasi ini menghasilkan sesuatu yang **bentuknya sama persis** dengan data penelitian: transkrip FGD, rating Delphi, nilai I-CVI, matriks pairwise, bobot AHP, skor kematangan. Bedanya hanya pada sumbernya — model bahasa, bukan pakar manusia.

Kemiripan bentuk itulah risikonya. Berkas yang tercecer, tangkapan layar yang dipakai di slide, atau tabel yang tersalin ke naskah bisa dengan mudah terbaca sebagai hasil. R1–V1.7 §4.3 sudah menyatakan batasnya secara eksplisit:

> *"Controlled dry-run internal, ketika diaktifkan, hanya menguji instruksi, navigasi, percabangan, konsistensi kode, penyimpanan, dan ekspor dengan data dummy atau penguji internal. Kegiatan tersebut tidak menghasilkan data penelitian dan tidak boleh dilaporkan sebagai FGD, Delphi, validitas isi, atau uji institusional."*

Pagar berikut membuat batas itu ditegakkan oleh sistem, bukan oleh ingatan orang.

---

## 2. Tujuh pagar teknis

### P1 — `dataOrigin` pada setiap baris
Setiap tabel yang menyimpan penilaian, transkrip, skor, bobot, atau respons memiliki kolom `dataOrigin: SIMULATED | REAL`. Tidak ada pengecualian. Tabel baru tanpa kolom ini ditolak di review.

### P2 — Tidak ada agregasi lintas origin
```ts
assertSingleOrigin(rows);   // dipanggil di setiap fungsi agregasi repository
```
Melempar `OriginMismatchError`. Ada uji e2e yang memastikan ini benar-benar melempar, bukan sekadar mencatat.

### P3 — Tidak ada jalur promosi
Tidak ada endpoint, server action, skrip, atau perintah yang mengubah `SIMULATED` menjadi `REAL`. Data pakar manusia masuk melalui form intake terpisah yang menulis `REAL` sejak awal. Bila seseorang meminta fitur "konversi", jawabannya tidak.

### P4 — Watermark ekspor yang tidak dapat dimatikan
| Format | Bentuk watermark |
|---|---|
| PDF | Teks diagonal di setiap halaman + header + footer |
| XLSX | Baris beku di atas setiap sheet + nama sheet berawalan `SIM_` |
| CSV | Tiga baris komentar di awal berkas + sufiks `_SIMULATED` pada nama berkas |
| JSON | Field `_warning` di tingkat akar + `_dataOrigin` |

Isi peringatan: *"KELUARAN SIMULASI — controlled dry-run internal. Bukan data penelitian. Tidak boleh dilaporkan sebagai hasil FGD, Delphi, validitas isi, AHP, atau uji institusional. R1–V1.7 §3.12, §4.3."*

Tidak ada parameter untuk menonaktifkannya.

**Implementasi:** `lib/export/watermark.ts` (murni, diuji) menentukan asal data dari baris ekspor; apa pun yang tidak terbukti REAL saja diberi watermark, termasuk tabel tanpa kolom origin di modul simulasi dan tabel artefak. Berlaku untuk `/api/export/table`, ekspor rekalkulasi, dan paket reproduksibilitas. Kriteria §6.5 diperiksa langsung di Audit → Paket Reproduksi.

### P5 — Banner UI permanen
Strip peringatan di bawah topbar setiap kali konteks aktif `SIMULATED`. Tidak dapat ditutup. Muncul juga pada pratinjau cetak dan tangkapan layar.

### P6 — De-identifikasi persona
CV pakar tidak pernah dikirim utuh ke provider mana pun. Yang dikirim adalah `PersonaBrief` yang sudah melewati filter de-identifikasi dan disetujui peneliti. Lihat `docs/04-AI-PANEL.md` §4.

### P7 — Gate yang tidak dapat di-bypass
Tidak ada flag `--force`, tidak ada mode admin yang melewati gate, tidak ada variabel lingkungan yang melonggarkannya. Peran Admin pun tidak melewati gate: gate hanya dapat di-`PASSED` oleh Admin setelah syaratnya terpenuhi, dan tindakan itu tercatat di `AuditEvent`.

---

## 3. Pagar prosedural

Hal-hal yang tidak bisa dipaksakan oleh kode, tetapi harus disepakati tim:

1. **Penamaan berkas.** Setiap ekspor simulasi berawalan `SIM_`. Jangan diubah saat menyimpan.
2. **Slide dan naskah.** Tangkapan layar dari aplikasi ini hanya boleh dipakai untuk menjelaskan *kesiapan instrumen*, disertai keterangan bahwa isinya simulasi. Jangan pernah untuk mengilustrasikan temuan.
3. **Logbook Litapdimas.** Kegiatan dry-run dicatat sebagai *pengembangan dan uji instrumen*, bukan sebagai pelaksanaan FGD atau Delphi.
4. **Penyimpanan.** Direktori hasil simulasi terpisah dari direktori data lapangan. Tidak pernah satu folder.
5. **Pengarsipan.** Setelah data pakar manusia tersedia, hasil simulasi diarsipkan dan diberi label, tidak dihapus — jejaknya justru berguna untuk menunjukkan proses pengembangan instrumen.

---

## 4. Perlindungan data pakar

Berdasarkan R1–V1.7 §3.13.

| Aset | Aturan |
|---|---|
| CV | Bucket privat, URL bertanda tangan 15 menit, akses Admin/Tester. Tidak pernah dikirim ke provider |
| `PersonaBrief` | De-identifikasi wajib. Disimpan di basis data analisis |
| `PanelistIdentity` | Tabel terpisah, akses hanya Admin. Tidak pernah ikut dalam ekspor analisis |
| Transkrip simulasi | Memakai kode kursi (`Pakar 3`), bukan nama |

**Izin penggunaan CV.** Gunakan hanya CV yang tersedia publik atau yang pemiliknya telah memberi izin tertulis untuk tujuan ini. Simpan bukti izin. Seseorang yang setuju menjadi panelis FGD **tidak dengan sendirinya** setuju CV-nya dipakai membentuk persona AI — itu penggunaan berbeda yang butuh penjelasan terpisah.

**Atribusi.** Keluaran persona tidak boleh diatribusikan kepada orang yang CV-nya dipakai, dalam bentuk apa pun, termasuk secara informal dalam rapat.

---

## 5. Provider yang disetujui

Hanya provider berikut yang boleh menerima `PersonaBrief` dan konten artefak:

| Provider | Status | Catatan |
|---|---|---|
| OpenAI | Disetujui | Gunakan endpoint API (tanpa pelatihan atas data API) |
| Anthropic | Disetujui | |
| Google | Disetujui | |
| DeepSeek | Disetujui bersyarat | Periksa kebijakan retensi dan lokasi server sebelum memasukkan konten sensitif |
| Alibaba Qwen | Disetujui bersyarat | Idem |
| Mistral, xAI | Disetujui bersyarat | Idem |
| Model lokal | Disetujui | Pilihan paling aman untuk konten sensitif |

Menambah provider di luar daftar ini memerlukan keputusan peneliti utama dan pembaruan dokumen ini.

**Perantara yang disetujui — Vercel AI Gateway** (keputusan peneliti utama, 26 September 2026). Satu `AI_GATEWAY_API_KEY` dipakai untuk memanggil model provider di atas melalui Gateway. Konsekuensinya: `PersonaBrief` (sudah de-identifikasi) dan isi artefak melewati infrastruktur Vercel sebelum sampai ke provider model. Aplikasi hanya menerima model Gateway dari keluarga yang disetujui di tabel ini (`openai/`, `anthropic/`, `google/`; bersyarat: `deepseek/`, `alibaba/`, `mistral/`, `xai/`) — dicek di `lib/ai/models.ts`. Larangan di bawah tetap berlaku sepenuhnya untuk jalur Gateway.

**Jangan pernah dikirim ke provider mana pun:** identitas panelis, berkas CV mentah, bukti keamanan institusi, temuan audit, log sistem, atau dokumen sensitif perguruan tinggi (§3.13.1).

---

## 6. Batas yang harus ada di setiap laporan

Bila hasil dry-run disebut dalam dokumen apa pun, sertakan kalimat ini:

> Hasil yang disajikan berasal dari *controlled dry-run* internal dengan panel pakar tersimulasi. Kegiatan ini menguji kesiapan instrumen — instruksi, navigasi, percabangan, konsistensi kode, penyimpanan, ekspor, dan kebenaran formula — dan tidak menghasilkan data penelitian. Nilai relevansi, indeks validitas isi, bobot, dan skor yang muncul di dalamnya tidak dinyatakan sebagai hasil FGD, Delphi/CVI, AHP, maupun pengujian institusional.

---

## 7. Daftar periksa review kode

Setiap pull request yang menyentuh data, prompt, atau ekspor harus lulus:

- [ ] Tabel baru memiliki `dataOrigin`
- [ ] Fungsi agregasi baru memanggil `assertSingleOrigin`
- [ ] Ekspor baru memuat watermark
- [ ] Tidak ada nilai metodologis yang ditulis literal di luar `lib/method/constants.ts`
- [ ] Tidak ada jalur baru yang melewati `assertGate`
- [ ] Prompt baru tidak memuat identitas pakar
- [ ] Provider baru terdaftar di §5 dokumen ini
- [ ] Mutasi artefak baru menulis `ChangeLogEntry` dalam transaksi yang sama
