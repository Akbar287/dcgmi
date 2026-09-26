# CLAUDE.md

Instruksi kerja untuk Claude Code di repositori ini.

> **Baca `AGENTS.md` lebih dulu.** Dokumen itu berisi kontrak rekayasa yang mengikat. File ini hanya menambahkan hal-hal yang khusus untuk cara kerja Claude Code.

---

## Apa proyek ini

DCGMI Dry-Run Console — perangkat lunak untuk **menguji instrumen penelitian** DCGMI sebelum dipakai pada pakar manusia. Panel pakar disimulasikan oleh beberapa model AI yang berbeda, masing-masing diberi persona dari CV pakar asli.

Satu kalimat yang harus selalu diingat: **keluaran aplikasi ini adalah uji instrumen, bukan hasil penelitian.**

---

## Urutan baca saat memulai sesi

1. `AGENTS.md` — aturan yang mengikat
2. `SPECIFICATION.md` — apa yang dibangun
3. `docs/05-METHOD-RULES.md` — bila menyentuh perhitungan
4. `docs/07-RESEARCH-INTEGRITY.md` — bila menyentuh data, ekspor, atau prompt

Jangan mulai menulis kode sebelum tahu modul mana yang disentuh dan gate apa yang berlaku padanya.

---

## Cara Claude bekerja di repo ini

**Rencanakan dulu untuk tugas besar.** Bila permintaan menyentuh lebih dari tiga berkas atau menyentuh `lib/method/`, tulis rencana singkat lebih dahulu dan konfirmasikan sebelum mengeksekusi.

**Test-first untuk kode metodologis.** Semua di `lib/method/` ditulis dengan urutan: baca test vector di `docs/05-METHOD-RULES.md` → tulis test → tulis implementasi → `pnpm method:verify`.

**Jangan menebak nilai metodologis.** Kalau sebuah ambang tidak tercantum di `docs/05-METHOD-RULES.md`, berhenti dan tanya. Jangan mengambil nilai dari ingatan tentang literatur umum — naskah R1–V1.7 punya koreksi yang menyimpang dari default literatur (contoh: ambang lama 0,75 diturunkan statusnya menjadi statistik deskriptif, yang mengikat adalah 0,78).

**Selalu verifikasi sebelum menyatakan selesai.**

```bash
pnpm check && pnpm method:verify
```

**Jangan buat berkas dokumentasi baru** kecuali diminta. Dokumen di `docs/` sudah lengkap; perbarui yang ada.

---

## Rambu khusus

Berhenti dan minta konfirmasi peneliti bila sebuah tugas mengarah ke salah satu dari ini:

| Situasi                                                       | Alasan                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| Mengubah konstanta di `lib/method/constants.ts`               | Mengubah definisi metodologis penelitian                       |
| Menambah jalur yang menggabungkan data `SIMULATED` dan `REAL` | Melanggar batas klaim R1–V1.7 §3.12                            |
| Menghapus atau melemahkan watermark ekspor                    | Berisiko keluaran simulasi terbaca sebagai hasil               |
| Mengubah seed baseline 8–15–43                                | Struktur hanya boleh berubah lewat alur FGD/Delphi di aplikasi |
| Menyentuh `C20b` atau `C42`                                   | Controlled exception, butuh keputusan versi eksplisit          |
| Mengirim isi CV pakar ke provider baru                        | Tata kelola data R1–V1.7 §3.13                                 |

Bila pengguna memintanya tetap, kerjakan **hanya** setelah mereka menyatakan paham konsekuensinya, dan catat di `CHANGELOG-METHOD.md`.

---

## Gaya keluaran

- Jawab ringkas. Kode bicara sendiri; jangan menarasikan ulang diff.
- Bahasa antarmuka aplikasi: Indonesia. Bahasa kode, komentar teknis, dan nama variabel: Inggris.
- Bila ragu antara dua tafsir metodologis, sebutkan keduanya dan tanya — jangan pilih diam-diam.

---

## Perintah cepat

```bash
pnpm dev                 pnpm check
pnpm method:verify       pnpm db:seed
pnpm test:unit -- cvi    pnpm db:studio
```

---

## Catatan tentang biaya token

Simulasi FGD memanggil banyak model secara paralel dan bisa mahal. Saat mengembangkan orkestrator, gunakan `MOCK_AI=1` di `.env.local` agar provider dipalsukan oleh fixture di `lib/ai/mock/`. Jangan pernah menjalankan sesi FGD penuh hanya untuk memeriksa perubahan tata letak.
