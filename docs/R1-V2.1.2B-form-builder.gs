/**
 * R1–V2.1.2B — DCGMI Google Forms builder, patch 1, 20 September 2026.
 * Sumber: dua workbook R1–V2.1.2A (lihat SOURCE di akhir berkas).
 * Salinan isi terverifikasi, bukan pembaca perubahan Excel secara live.
 * Jalankan buatFormTEST(); ulangi fungsi yang sama jika status BUILDING.
 * Tidak menghapus form/respons, tidak menerbitkan, tidak mengirim undangan.
 * Form dan spreadsheet baru dimiliki akun Google yang menjalankan skrip.
 */
const CONFIG = {
  CONTACT: "Prof. Dr. Syopiansyah Jaya Putra M.Sis., IPU., ASEAN.Eng",

  DATA_POLICY: "Data digunakan untuk keperluan penelitian",

  SUMMARY_URL:
    "https://drive.google.com/drive/folders/1rShSufm05_ISeENdUrMOVsYigpMLfR6n?usp=sharing",
  // TRUE hanya setelah Google Form TEST benar-benar diuji
  GOOGLE_FORM_TEST_PASSED: true,

  // Sesuaikan dengan pengujian sebenarnya
  TEST_EVIDENCE_NOTE:
    "23 September 2026; T01/T02; PASS; durasi pengisian 15 menit",

  // TRUE jika Anda sudah mengakui bahwa rubrik level 1–5
  // memang belum termasuk dalam sumber saat ini

  LIMITED_REVIEW_SCOPE_ACKNOWLEDGED: true,

  // Jangan 999.
  // Buat Form secara bertahap agar tidak timeout.
  BUILD_BATCH_SIZE: 30,

  // Beri jarak yang aman dari hard timeout Apps Script.
  MAX_RUN_MS: 120000,
};
const PREFIX = "R1_V212B_20260920_";
const FIELDS = [
  ["decision", "Initial Decision", "Keputusan awal", "MC", true],
  ["evidence", "Evidence Feasibility", "Kelayakan bukti", "MC", true],
  ["clarity", "Clarity", "Kejelasan", "MC", true],
  [
    "overlap",
    "Overlap / Placement",
    "Tumpang tindih / penempatan",
    "MC",
    false,
  ],
  [
    "comment",
    "Substantive Comment",
    "Alasan / komentar substantif",
    "PARA",
    true,
  ],
  ["revision", "Revision Suggestion", "Usulan perbaikan", "PARA", true],
];

function buatFormTEST() {
  return build_("TEST");
}
function buatFormPRODUCTION() {
  return build_("PRODUCTION");
}
function verifikasiTEST() {
  return verifyMode_("TEST");
}
function verifikasiPRODUCTION() {
  return verifyMode_("PRODUCTION");
}
function tampilkanTautan() {
  ["TEST", "PRODUCTION"].forEach(function (mode) {
    const s = state_(mode);
    if (s) logLinks_(mode, s);
  });
}
function eksporResponsTEST() {
  return exportResponses_("TEST");
}
function eksporResponsPRODUCTION() {
  return exportResponses_("PRODUCTION");
}

function assert_(ok, message) {
  if (!ok) throw new Error(message);
}
function same_(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function sha_(text) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    text,
    Utilities.Charset.UTF_8,
  )
    .map(function (b) {
      return ("0" + (b & 255).toString(16)).slice(-2);
    })
    .join("");
}
function state_(mode) {
  const v = PropertiesService.getScriptProperties().getProperty(PREFIX + mode);
  return v ? JSON.parse(v) : null;
}
function save_(mode, s) {
  PropertiesService.getScriptProperties().setProperty(
    PREFIX + mode,
    JSON.stringify(s),
  );
}
function validateSource_() {
  assert_(
    sha_(JSON.stringify(DATA)) === DATA_SHA256,
    "Isi snapshot berubah. Gunakan skrip asli atau audit ulang versi sumber.",
  );
  assert_(DATA.items.length === 43, "Harus tepat 43 indikator.");
  assert_(
    new Set(DATA.items.map((x) => x.id)).size === 43,
    "ID indikator tidak unik.",
  );
  assert_(
    new Set(DATA.items.map((x) => x.domainCode)).size === 8,
    "Domain bukan 8.",
  );
  assert_(
    new Set(DATA.items.map((x) => x.aspectCode)).size === 15,
    "Aspek bukan 15.",
  );
  assert_(
    DATA.options.decision.length === 7 &&
      DATA.options.evidence.length === 4 &&
      DATA.options.clarity.length === 3,
    "Daftar pilihan berubah.",
  );
  assert_(DATA.experts.length === 6, "Panel produksi harus enam kode pakar.");
  DATA.items.forEach(function (x) {
    [
      "id",
      "domainCode",
      "domain",
      "aspectCode",
      "aspect",
      "indicator",
      "definition",
      "minimumEvidence",
      "strengtheningEvidence",
      "prompt",
      "qualitativeRule",
    ].forEach(function (k) {
      assert_(
        typeof x[k] === "string" && x[k].length > 0,
        "Sumber kosong: " + x.id + " / " + k,
      );
    });
  });
}
function configured_(s) {
  return typeof s === "string" && s.trim().length > 0 && s.indexOf("[ISI") < 0;
}
function productionReadiness_() {
  const issues = [];

  if (CONFIG.GOOGLE_FORM_TEST_PASSED !== true) {
    issues.push(
      "GOOGLE_FORM_TEST_PASSED masih false. " +
        "Selesaikan dry-run pada Google Form TEST, lalu ubah menjadi true.",
    );
  }

  if (!configured_(CONFIG.TEST_EVIDENCE_NOTE)) {
    issues.push(
      "TEST_EVIDENCE_NOTE belum diisi. " +
        "Isi tanggal, penguji, hasil dry-run, dan durasi.",
    );
  }

  if (!configured_(CONFIG.CONTACT) || !configured_(CONFIG.DATA_POLICY)) {
    issues.push("CONTACT atau DATA_POLICY belum lengkap.");
  }

  if (!/^https:\/\//.test(CONFIG.SUMMARY_URL)) {
    issues.push("SUMMARY_URL belum berupa URL HTTPS yang dapat diakses pakar.");
  }

  if (CONFIG.LIMITED_REVIEW_SCOPE_ACKNOWLEDGED !== true) {
    issues.push(
      "LIMITED_REVIEW_SCOPE_ACKNOWLEDGED masih false. " +
        "Ubah menjadi true setelah menyetujui bahwa " +
        "rubrik/deskriptor level 1–5 belum termasuk dalam sumber.",
    );
  }

  const s = state_("TEST");

  if (!s) {
    issues.push(
      "State TEST belum ada. Jalankan buatFormTEST() terlebih dahulu.",
    );
  } else if (s.status !== "BUILT") {
    issues.push(
      "Form TEST belum berstatus BUILT. Status sekarang: " +
        String(s.status) +
        ". Jalankan kembali buatFormTEST() sampai selesai.",
    );
  } else if (!s.formId) {
    issues.push(
      "State TEST tidak memiliki formId. " +
        "Periksa Script Properties / Form TEST.",
    );
  } else {
    try {
      verifyForm_(FormApp.openById(s.formId), plan_("TEST"), s, "TEST");
    } catch (err) {
      issues.push("Verifikasi Form TEST gagal: " + err.message);
    }
  }

  return {
    ready: issues.length === 0,
    issues: issues,
  };
}

// Jalankan fungsi ini SEBELUM buatFormPRODUCTION().
//
// Fungsi ini hanya mengecek kesiapan.
// Tidak membuat atau menghapus Google Form.
function cekKesiapanPRODUCTION() {
  validateSource_();

  const result = productionReadiness_();

  if (result.ready) {
    console.log(
      "READY — semua syarat PRODUCTION terpenuhi. " +
        "Jalankan buatFormPRODUCTION().",
    );
  } else {
    console.log(
      "NOT READY — PRODUCTION belum dapat dibuat:\n- " +
        result.issues.join("\n- "),
    );
  }

  return result;
}

function validateProduction_() {
  const result = productionReadiness_();

  assert_(
    result.ready,
    "PRODUCTION belum siap:\n- " + result.issues.join("\n- "),
  );
}
function title_(mode) {
  return "R1-V2.1.2B — Pra-Reviu Pakar DCGMI — " + mode;
}
function description_(mode) {
  // Form TEST sengaja tidak bergantung pada SUMMARY_URL.
  //
  // Dengan demikian SUMMARY_URL dapat diisi setelah dry-run
  // tanpa membuat signature Form TEST berubah.
  const summaryUrl = mode === "TEST" ? "" : CONFIG.SUMMARY_URL;

  return (
    "Digital Campus Governance Maturity Index (DCGMI) — pra-reviu pakar sebelum FGD 90 menit.\n" +
    "Baseline provisional: 8 domain, 15 aspek, 43 indikator. Objek reviu adalah kualitas instrumen, bukan kondisi kampus. Tahap ini bukan Delphi/CVI, AHP, atau penskoran institusi.\n\n" +
    "Tiap indikator memiliki enam bidang respons. Keputusan, kelayakan bukti, kejelasan, alasan, dan usulan diisi mengikuti workbook FGD. Tumpang tindih/penempatan adalah bidang pelengkap dari spesifikasi pakar.\n" +
    "Alasan dan usulan bermakna wajib bila keputusan selain Dapat dipertahankan. Untuk item yang dipertahankan tanpa catatan, tulis Tidak ada catatan / Tidak ada usulan. Pilih Tidak dapat menilai bila diperlukan dan jelaskan alasannya.\n" +
    "Rubrik lengkap/deskriptor level 1–5 tidak terdapat pada dua workbook sumber; Form ini tidak mengklaim telah menelaah rubrik tersebut.\n\n" +
    "Partisipasi sukarela. Anda dapat berhenti tanpa mengirim jawaban. Jawaban yang dikirim menggunakan kode pakar; kode bukan anonimitas penuh karena daftar identitas disimpan terpisah oleh tim. Persetujuan rekaman FGD diminta terpisah sebelum FGD.\n" +
    "Ringkasan penelitian: " +
    summaryUrl +
    "\nKontak: " +
    CONFIG.CONTACT +
    "\nTata kelola data: " +
    CONFIG.DATA_POLICY +
    "\nWaktu pengisian Form harus diukur saat dry-run; estimasi Excel 25–35 menit belum merupakan durasi terverifikasi Form ini."
  );
}
function bukaPRODUCTIONUntukPakar() {
  validateSource_();

  const s = state_("PRODUCTION");

  assert_(
    s,
    "State PRODUCTION tidak ditemukan. Jalankan buatFormPRODUCTION() terlebih dahulu.",
  );

  assert_(
    s.status === "BUILT",
    "DILARANG membuka PRODUCTION. Status sekarang: " +
      s.status +
      ". Build harus BUILT terlebih dahulu.",
  );

  const form = FormApp.openById(s.formId);
  const plan = plan_("PRODUCTION");

  assert_(
    s.cursor === plan.length,
    "PRODUCTION belum lengkap. Cursor: " + s.cursor + " / " + plan.length,
  );

  assert_(
    form.getItems().length === plan.length,
    "PRODUCTION belum lengkap. Item aktual: " +
      form.getItems().length +
      " / " +
      plan.length,
  );

  // Verifikasi penuh sebelum dibuka
  verifyForm_(form, plan, s, "PRODUCTION");

  if (form.supportsAdvancedResponderPermissions()) {
    form.setPublished(true);
  }

  form.setAcceptingResponses(true);

  console.log("PRODUCTION DIBUKA untuk pakar.");
  console.log("STATUS      : " + s.status);
  console.log("ITEM        : " + form.getItems().length + " / " + plan.length);
  console.log("RESPONSES   : " + form.getResponses().length);
  console.log("RESPONSE URL: " + form.getPublishedUrl());

  return form.getPublishedUrl();
}
function tutupTESTSetelahDryRun() {
  const s = state_("TEST");

  assert_(s && s.formId, "State/Form TEST tidak ditemukan.");

  assert_(
    s.status === "BUILT",
    "Form TEST belum berstatus BUILT. Status sekarang: " + String(s.status),
  );

  const form = FormApp.openById(s.formId);

  // Tutup penerimaan respons
  form.setAcceptingResponses(false);

  // Jika akun mendukung publication control, unpublish juga
  if (form.supportsAdvancedResponderPermissions()) {
    form.setPublished(false);
  }

  const responseCount = form.getResponses().length;

  console.log("TEST ditutup setelah dry-run.");
  console.log("STATUS      : " + s.status);
  console.log("RESPONSES   : " + responseCount);
  console.log("ACCEPTING   : " + form.isAcceptingResponses());

  if (form.supportsAdvancedResponderPermissions()) {
    console.log("PUBLISHED   : " + form.isPublished());
  }

  console.log("EDIT URL    : " + form.getEditUrl());

  return {
    status: s.status,
    responses: responseCount,
    accepting: form.isAcceptingResponses(),
    published: form.supportsAdvancedResponderPermissions()
      ? form.isPublished()
      : null,
  };
}
function plan_(mode) {
  const plan = [];
  function add(type, key, title, help, required, choices, extra) {
    plan.push(
      Object.assign(
        {
          type: type,
          key: key,
          title: title,
          help: help || "",
          required: !!required,
          choices: choices || [],
        },
        extra || {},
      ),
    );
  }
  add(
    "MC",
    "consent",
    "Persetujuan mengikuti pra-reviu",
    "Tidak bersedia akan mengakhiri formulir sebelum identitas dan pertanyaan indikator. Jika memilih mengirim penolakan, hanya pilihan ini dan waktu pengiriman tercatat; Anda juga boleh menutup formulir tanpa mengirim.",
    true,
    ["Bersedia", "Tidak bersedia"],
    { consent: true },
  );
  add(
    "PAGE",
    "profile",
    "Kode peserta",
    "Gunakan hanya kode yang diberikan tim. Identitas, afiliasi, dan kompetensi disimpan pada daftar panel terpisah.",
    false,
  );
  add(
    "MC",
    "expert",
    "Kode pakar / penguji",
    mode === "TEST"
      ? "Khusus pengujian teknis, bukan data pakar."
      : "P01–P06 adalah kode pakar aktif. Jangan memilih kode orang lain.",
    true,
    mode === "TEST" ? ["T01", "T02"] : DATA.experts,
  );
  let domain = "";
  DATA.items.forEach(function (x) {
    if (domain !== x.domainCode) {
      domain = x.domainCode;
      add(
        "PAGE",
        domain,
        domain + " — " + x.domain,
        "Reviu paket indikator pada domain ini berdasarkan definisi dan bukti yang ditampilkan.",
        false,
      );
    }
    FIELDS.forEach(function (f) {
      const key = f[0];
      let help = "";
      if (key === "decision")
        help =
          "Domain: " +
          x.domainCode +
          " — " +
          x.domain +
          "\nAspek: " +
          x.aspectCode +
          " — " +
          x.aspect +
          "\nIndikator: " +
          x.indicator +
          "\nDefinisi operasional: " +
          x.definition +
          "\nBukti minimum: " +
          x.minimumEvidence +
          "\nBukti penguat: " +
          x.strengtheningEvidence +
          "\n\n" +
          x.prompt +
          "\n\n" +
          x.qualitativeRule +
          "\nBatas bahan: deskriptor level 1–5 belum disertakan dalam sumber ini.";
      if (key === "evidence")
        help =
          "Nilai kelayakan bukti minimum/penguat di atas, bukan ketersediaannya pada kampus Anda.";
      if (key === "clarity")
        help = "Nilai kejelasan label dan definisi operasional.";
      if (key === "overlap")
        help =
          "Bidang pelengkap dari 02_Reviu_Pakar / 99_Lists. Bila ada, sebutkan ID indikator terkait dalam komentar.";
      if (key === "comment")
        help =
          x.qualitativeRule +
          ". Untuk keputusan Dapat dipertahankan tanpa catatan, tulis Tidak ada catatan. Jangan hanya menulis tanda pisah untuk item bermasalah.";
      if (key === "revision")
        help =
          "Tuliskan usulan konkret atau penjelasan bila belum dapat mengusulkan revisi. Untuk item dipertahankan tanpa usulan, tulis Tidak ada usulan.";
      add(
        f[3],
        x.id + ":" + key,
        x.id + " — " + f[2] + (key === "decision" ? ": " + x.indicator : ""),
        help,
        f[4],
        DATA.options[key],
        { canonicalId: x.id, field: key, excelColumn: f[1] },
      );
    });
  });
  add(
    "PAGE",
    "overall",
    "Catatan lintas-indikator",
    "Bagian penutup ini adalah pelengkap operasional, bukan skala CVI.",
    false,
  );
  add(
    "PARA",
    "overallComment",
    "Catatan umum, kekosongan cakupan, atau kandidat indikator baru",
    "Cantumkan domain/aspek dan alasan. Usulan belum otomatis menjadi indikator baru.",
    false,
  );
  add(
    "MC",
    "fgdAvailability",
    "Kesediaan mengikuti FGD 90 menit",
    "Jadwal dan persetujuan perekaman dikonfirmasi terpisah oleh tim.",
    false,
    ["Bersedia", "Perlu konfirmasi jadwal", "Tidak bersedia"],
  );
  return plan;
}

function build_(mode) {
  const lock = LockService.getScriptLock();

  assert_(lock.tryLock(10000), "Ada proses lain. Coba lagi setelah selesai.");

  try {
    validateSource_();

    if (mode === "PRODUCTION") {
      validateProduction_();
    }

    const plan = plan_(mode);

    const signature = sha_(
      JSON.stringify({
        plan: plan,
        description: description_(mode),
        data: DATA_SHA256,
      }),
    );

    let s = state_(mode);
    let form;

    if (s) {
      assert_(
        s.signature === signature,
        "Konfigurasi/isi berubah setelah build. " +
          "Jangan menimpa Form. " +
          "Gunakan proyek Apps Script baru untuk versi baru.",
      );

      assert_(
        s.formId,
        "Pembuatan Form sebelumnya terputus sebelum ID tersimpan. " +
          "Periksa Drive; jangan otomatis membuat duplikat.",
      );

      form = FormApp.openById(s.formId);

      if (s.status === "BUILT") {
        verifyForm_(form, plan, s, mode);

        logLinks_(mode, s);

        return;
      }

      assert_(
        !form.isAcceptingResponses() && form.getResponses().length === 0,

        "Form yang belum selesai tidak boleh menerima respons. " +
          "Tutup dahulu; tidak ada data yang dihapus oleh skrip.",
      );
    } else {
      // Marker sebelum create:
      // bila API sukses tetapi respons jaringan hilang,
      // proses berhenti dengan aman.

      s = {
        status: "CREATING",
        signature: signature,
        cursor: 0,
        pending: null,
        ids: [],
        dataHash: DATA_SHA256,
      };

      save_(mode, s);

      form = FormApp.create(title_(mode), false);

      s.formId = form.getId();

      save_(mode, s);

      form.setAcceptingResponses(false);
    }

    configureForm_(form, mode);

    s.status = "BUILDING";

    save_(mode, s);

    const start = Date.now();

    let count = 0;

    let existing = form.getItems();

    assert_(
      existing.length === s.cursor ||
        (s.pending === s.cursor && existing.length === s.cursor + 1),

      "Jumlah item berbeda dari checkpoint. " +
        "Jangan mengedit manual selama build.",
    );

    for (let i = 0; i < s.cursor; i++) {
      assert_(
        String(existing[i].getId()) === s.ids[i],
        "Urutan/ID item berubah pada " + i,
      );

      verifyItem_(existing[i], plan[i]);
    }

    while (
      s.cursor < plan.length &&
      count < CONFIG.BUILD_BATCH_SIZE &&
      Date.now() - start < CONFIG.MAX_RUN_MS
    ) {
      const p = plan[s.cursor];

      s.pending = s.cursor;

      save_(mode, s);

      let item = existing[s.cursor];

      if (!item) {
        item = addItem_(form, p.type);
      }

      assert_(typeOf_(item) === p.type, "Tipe item checkpoint tidak sesuai.");

      configureItem_(item, p);

      s.ids[s.cursor] = String(item.getId());

      s.cursor++;

      s.pending = null;

      save_(mode, s);

      count++;
    }

    if (s.cursor < plan.length) {
      console.log(
        "BUILDING " +
          s.cursor +
          "/" +
          plan.length +
          ". Jalankan lagi buatForm" +
          mode +
          "().",
      );

      logLinks_(mode, s);

      return;
    }

    const items = form.getItems();

    const consent = typed_(items[0], "MC");

    consent.setChoices([
      consent.createChoice("Bersedia", FormApp.PageNavigationType.CONTINUE),

      consent.createChoice("Tidak bersedia", FormApp.PageNavigationType.SUBMIT),
    ]);

    verifyForm_(form, plan, s, mode);

    if (!s.sheetId) {
      assert_(
        !s.sheetCreatePending,
        "Pembuatan lembar respons sebelumnya terputus. " +
          "Periksa Drive; jangan membuat duplikat.",
      );

      s.sheetCreatePending = true;

      save_(mode, s);

      const ss = SpreadsheetApp.create(
        title_(mode) + " — Respons dan Pemetaan",
      );

      s.sheetId = ss.getId();

      s.sheetCreatePending = false;

      save_(mode, s);
    }

    const ss = SpreadsheetApp.openById(s.sheetId);

    form.setDestination(FormApp.DestinationType.SPREADSHEET, s.sheetId);

    writeMetadata_(ss, form, plan, s, mode);

    s.status = "BUILT";

    save_(mode, s);

    console.log(
      "BUILT — isi dan pemetaan terverifikasi. " +
        "Form belum dipublikasikan. " +
        "Uji pada Google tetap diperlukan.",
    );

    logLinks_(mode, s);
  } finally {
    lock.releaseLock();
  }
}
/**
 * Cek kondisi Form TEST saat ini.
 */
function cekKondisiTEST() {
  const s = state_("TEST");

  if (!s) {
    console.log("State TEST tidak ditemukan.");
    return;
  }

  console.log("STATUS STATE : " + s.status);
  console.log("CURSOR       : " + s.cursor + " / " + plan_("TEST").length);
  console.log("FORM ID      : " + (s.formId || "-"));

  if (!s.formId) {
    return;
  }

  const form = FormApp.openById(s.formId);

  console.log("ITEM AKTUAL  : " + form.getItems().length);
  console.log("RESPONSES    : " + form.getResponses().length);
  console.log("ACCEPTING    : " + form.isAcceptingResponses());

  if (form.supportsAdvancedResponderPermissions()) {
    console.log("PUBLISHED    : " + form.isPublished());
  }

  console.log("EDIT URL     : " + form.getEditUrl());
  console.log("RESPONSE URL : " + form.getPublishedUrl());
}

/**
 * Digunakan jika TEST masih BUILDING tetapi BELUM ADA RESPONSE.
 *
 * Menutup Form kembali supaya build dapat dilanjutkan.
 * Tidak menghapus Form.
 * Tidak menghapus response.
 */
function pulihkanTESTBuilding() {
  const s = state_("TEST");

  assert_(s && s.formId, "State/Form TEST tidak ditemukan.");

  const form = FormApp.openById(s.formId);
  const responses = form.getResponses().length;

  assert_(
    responses === 0,
    "Form sudah memiliki " +
      responses +
      " respons. Fungsi ini tidak akan menghapus respons.",
  );

  form.setAcceptingResponses(false);

  if (form.supportsAdvancedResponderPermissions()) {
    form.setPublished(false);
  }

  console.log("Form TEST berhasil ditutup kembali.");
  console.log("STATUS : " + s.status);
  console.log("CURSOR : " + s.cursor + " / " + plan_("TEST").length);
  console.log("ITEM   : " + form.getItems().length);
  console.log("");
  console.log("Sekarang jalankan kembali buatFormTEST().");
}

/**
 * Digunakan HANYA jika Form BUILDING ternyata SUDAH mempunyai response.
 *
 * Form lama TIDAK dihapus.
 * Response lama TIDAK dihapus.
 *
 * Hanya checkpoint TEST direset sehingga buatFormTEST()
 * berikutnya membuat Form TEST baru.
 */
function buatUlangTESTAman() {
  const props = PropertiesService.getScriptProperties();
  const key = PREFIX + "TEST";

  const raw = props.getProperty(key);

  assert_(raw, "State TEST tidak ditemukan.");

  const s = JSON.parse(raw);

  if (s.formId) {
    const form = FormApp.openById(s.formId);

    console.log("FORM TEST LAMA TIDAK DIHAPUS.");
    console.log("FORM EDIT LAMA: " + form.getEditUrl());
    console.log("RESPONSES LAMA : " + form.getResponses().length);

    form.setAcceptingResponses(false);

    if (form.supportsAdvancedResponderPermissions()) {
      form.setPublished(false);
    }
  }

  // Simpan salinan state lama untuk audit/recovery.
  const archiveKey =
    PREFIX +
    "TEST_ARCHIVE_" +
    Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd_HHmmss");

  props.setProperty(archiveKey, raw);

  // Hanya hapus pointer/checkpoint TEST aktif.
  props.deleteProperty(key);

  console.log("");
  console.log("State TEST lama sudah diarsipkan.");
  console.log("Tidak ada Form atau response yang dihapus.");
  console.log("Sekarang jalankan buatFormTEST() untuk membuat TEST baru.");
}
function configureForm_(form, mode) {
  if (form.supportsAdvancedResponderPermissions()) {
    form.setPublished(false);
  }

  form
    .setAcceptingResponses(false)
    .setDescription(description_(mode))
    .setIsQuiz(false)
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setAllowResponseEdits(false)
    .setPublishingSummary(false)
    .setShowLinkToRespondAgain(false)
    .setShuffleQuestions(false)
    .setProgressBar(true)
    .setConfirmationMessage(
      "Terima kasih. Pengiriman tidak berarti indikator telah tervalidasi. Tim akan menelaah kelengkapan dan menyiapkan FGD.",
    );

  // Jangan panggil setCustomClosedFormMessage()
  // ketika Form belum dipublikasikan.
}
function typeOf_(item) {
  const t = String(item.getType());
  return (
    { MULTIPLE_CHOICE: "MC", PARAGRAPH_TEXT: "PARA", PAGE_BREAK: "PAGE" }[t] ||
    t
  );
}
function addItem_(form, type) {
  if (type === "MC") return form.addMultipleChoiceItem();
  if (type === "PARA") return form.addParagraphTextItem();
  if (type === "PAGE") return form.addPageBreakItem();
  throw new Error("Tipe tidak dikenal: " + type);
}
function typed_(item, type) {
  const method =
    type === "MC"
      ? "asMultipleChoiceItem"
      : type === "PARA"
        ? "asParagraphTextItem"
        : "asPageBreakItem";

  return typeof item[method] === "function" ? item[method]() : item;
}

function configureItem_(item, p) {
  const t = typed_(item, p.type);
  t.setTitle(p.title).setHelpText(p.help);
  if (p.type !== "PAGE") t.setRequired(p.required);
  if (p.type === "MC") t.setChoiceValues(p.choices).showOtherOption(false);
}
function verifyItem_(item, p) {
  assert_(typeOf_(item) === p.type, "Tipe berbeda: " + p.key);
  const t = typed_(item, p.type);
  assert_(
    t.getTitle() === p.title && t.getHelpText() === p.help,
    "Judul/petunjuk berbeda: " + p.key,
  );
  if (p.type !== "PAGE")
    assert_(t.isRequired() === p.required, "Status wajib berbeda: " + p.key);
  if (p.type === "MC") {
    assert_(
      same_(
        t.getChoices().map((c) => c.getValue()),
        p.choices,
      ),
      "Pilihan berbeda: " + p.key,
    );
    assert_(!t.hasOtherOption(), "Opsi lain tidak diizinkan: " + p.key);
  }
}
function verifyForm_(form, plan, s, mode) {
  const items = form.getItems();

  assert_(
    items.length === plan.length,
    "Jumlah item Form belum lengkap/berubah.",
  );

  items.forEach(function (item, i) {
    assert_(String(item.getId()) === s.ids[i], "ID/urutan Form berbeda: " + i);

    verifyItem_(item, plan[i]);
  });

  const choices = typed_(items[0], "MC").getChoices();

  assert_(
    choices[0].getPageNavigationType() ===
      FormApp.PageNavigationType.CONTINUE &&
      choices[1].getPageNavigationType() === FormApp.PageNavigationType.SUBMIT,

    "Cabang persetujuan belum benar.",
  );

  assert_(form.getDescription() === description_(mode), "Pengantar berbeda.");

  assert_(
    !form.collectsEmail() &&
      !form.isPublishingSummary() &&
      !form.isQuiz() &&
      !form.getShuffleQuestions(),

    "Pengaturan privasi/urutan tidak sesuai.",
  );

  assert_(
    !form.hasLimitOneResponsePerUser() &&
      !form.canEditResponse() &&
      !form.hasRespondAgainLink(),

    "Pengaturan respons berbeda.",
  );

  if (s.sheetId && s.status === "BUILT") {
    assert_(form.getDestinationId() === s.sheetId, "Tujuan respons berubah.");
  }

  return {
    status: "PASS_CONTENT",
    indicators: 43,
    questions: plan.filter((p) => p.type !== "PAGE").length,
    formItems: plan.length,
    liveHumanTest: "NOT_INFERRED",
  };
}
function verifyMode_(mode) {
  validateSource_();

  const s = state_(mode);

  assert_(s && s.status === "BUILT", "Build belum selesai.");

  const report = verifyForm_(
    FormApp.openById(s.formId),

    plan_(mode),

    s,

    mode,
  );

  console.log(JSON.stringify(report));

  logLinks_(mode, s);

  return report;
}
function writeMetadata_(ss, form, plan, s, mode) {
  function table(name, rows) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, rows[0].length)
      .setBackground("#1F4E78")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    sh.getDataRange().setWrap(true);
    sh.setColumnWidths(1, rows[0].length, 180);
  }
  table("Build_Info", [
    ["Parameter", "Value"],
    ["Version", "R1–V2.1.2B"],
    ["Mode", mode],
    ["Form edit URL", form.getEditUrl()],
    ["Response URL", form.getPublishedUrl()],
    ["Data SHA-256", DATA_SHA256],
    ["Build signature", s.signature],
    ["Source questions", SOURCE.questions.file],
    ["Source FGD", SOURCE.fgd.file],
    ["Source questions SHA-256", SOURCE.questions.sha256],
    ["Source FGD SHA-256", SOURCE.fgd.sha256],
    [
      "Status",
      "BUILT — publication and human Google dry-run are separate gates",
    ],
    [
      "Reported Excel test",
      "T01/T02 selesai menurut konfirmasi Prof. 20 September 2026; tidak diimpor sebagai data pakar.",
    ],
    ["Google test evidence", CONFIG.TEST_EVIDENCE_NOTE || "BELUM DIKONFIRMASI"],
    [
      "Scope limitation",
      "Rubrik/deskriptor level 1–5 tidak tersedia pada kedua workbook sumber.",
    ],
    [
      "Cached dashboard",
      "Tidak diimpor. Ekspor selalu membaca jawaban Form aktual.",
    ],
    [
      "Privacy",
      "Kode bukan autentikasi/anonimitas penuh. Daftar panel disimpan terpisah.",
    ],
  ]);
  table(
    "Item_Map",
    [
      [
        "Order",
        "Google Item ID",
        "Key",
        "Canonical ID",
        "Field",
        "Excel destination",
        "Required",
        "Title",
      ],
    ].concat(
      plan.map(function (p, i) {
        return [
          i + 1,
          s.ids[i],
          p.key,
          p.canonicalId || "",
          p.field || "",
          p.excelColumn || "",
          p.required,
          p.title,
        ];
      }),
    ),
  );
}
function logLinks_(mode, s) {
  console.log(mode + " / " + s.status);
  if (s.formId)
    console.log(
      "FORM EDIT: https://docs.google.com/forms/d/" + s.formId + "/edit",
    );
  if (s.sheetId)
    console.log(
      "SHEETS: https://docs.google.com/spreadsheets/d/" + s.sheetId + "/edit",
    );
}

// Ekspor manual saat dibutuhkan. Tidak mengubah sumber Excel, raw responses,
// atau ekspor sebelumnya; tidak menghitung CVI atau menetapkan keputusan FGD.
function exportResponses_(mode) {
  const lock = LockService.getScriptLock();
  assert_(lock.tryLock(10000), "Proses lain sedang berjalan.");
  try {
    verifyMode_(mode);
    const s = state_(mode),
      form = FormApp.openById(s.formId),
      plan = plan_(mode);
    const records = form.getResponses().map(function (r) {
      const byId = {};
      r.getItemResponses().forEach(
        (ir) => (byId[String(ir.getItem().getId())] = ir.getResponse()),
      );
      const values = {};
      plan.forEach((p, i) => {
        if (p.type !== "PAGE") values[p.key] = byId[s.ids[i]] || "";
      });
      return {
        id: r.getId(),
        timestamp: r.getTimestamp().toISOString(),
        values: values,
      };
    });
    const result = normalize_(records, mode),
      ss = SpreadsheetApp.openById(s.sheetId);
    const stamp =
      Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd_HHmmss") +
      "_" +
      Utilities.getUuid().slice(0, 6);
    function write(name, rows) {
      const sh = ss.insertSheet(name + "_" + stamp);
      sh.getRange(1, 1, rows.length, rows[0].length).setValues(
        rows.map((row) => row.map(safeCell_)),
      );
      sh.setFrozenRows(1);
      sh.getDataRange().setWrap(true);
      sh.getRange(1, 1, 1, rows[0].length)
        .setBackground("#1F4E78")
        .setFontColor("#ffffff")
        .setFontWeight("bold");
      sh.setColumnWidths(1, rows[0].length, 160);
    }
    write("DataEntry", result.data);
    write("Supplement", result.supplement);
    write("QC", result.qc);
    console.log(
      "Ekspor baru selesai. Cocokkan Expert ID + Canonical ID, bukan posisi baris. Respons duplikat/invalid tidak dipilih otomatis; periksa QC.",
    );
    return {
      rows: result.data.length - 1,
      qualityIssues: result.qc.length - 1,
    };
  } finally {
    lock.releaseLock();
  }
}
function safeCell_(x) {
  // Mencegah teks responden menjadi formula saat setValues.
  return typeof x === "string" && /^[\s]*[=+@-]/.test(x) ? "'" + x : x;
}
function normalize_(records, mode) {
  const codes = mode === "TEST" ? ["T01", "T02"] : DATA.experts;
  const grouped = {},
    qc = [["Response ID", "Timestamp", "Expert ID", "Issue", "Detail"]];
  codes.forEach((c) => (grouped[c] = []));
  records.forEach(function (r) {
    const v = r.values,
      code = v.expert;
    if (v.consent !== "Bersedia") {
      qc.push([
        r.id,
        r.timestamp,
        "",
        "EXCLUDED_NO_CONSENT",
        "Tidak dipindahkan ke data indikator.",
      ]);
      return;
    }
    if (codes.indexOf(code) < 0) {
      qc.push([
        r.id,
        r.timestamp,
        code,
        "INVALID_EXPERT",
        "Kode tidak sesuai mode.",
      ]);
      return;
    }
    grouped[code].push(r);
  });
  const data = [DATA.dataHeaders.slice()];
  const supplement = [
    [
      "Response ID",
      "Timestamp",
      "Expert ID",
      "Canonical ID",
      "Overlap / Placement",
      "Overall Comment",
      "FGD Availability",
    ],
  ];
  let number = 0;
  codes.forEach(function (code) {
    const candidates = grouped[code];
    let record = candidates.length === 1 ? candidates[0] : null;
    if (candidates.length > 1)
      candidates.forEach((r) =>
        qc.push([
          r.id,
          r.timestamp,
          code,
          "DUPLICATE_EXPERT",
          "Semua respons kode ini ditahan; tim harus menyelesaikan duplikasi dari sumber.",
        ]),
      );
    if (!candidates.length)
      qc.push(["", "", code, "MISSING_RESPONSE", "Belum ada respons setuju."]);
    DATA.items.forEach(function (x) {
      number++;
      const row = [
        "R" + String(number).padStart(3, "0"),
        code,
        x.id,
        x.domainCode,
        x.indicator,
        "",
        "",
        "",
        "",
        "",
      ];
      if (record) {
        const v = record.values,
          vals = {};
        FIELDS.forEach((f) => (vals[f[0]] = v[x.id + ":" + f[0]] || ""));
        let invalid = false;
        ["decision", "evidence", "clarity"].forEach(function (k) {
          if (DATA.options[k].indexOf(vals[k]) < 0) {
            invalid = true;
            qc.push([
              record.id,
              record.timestamp,
              code,
              "INVALID_OR_MISSING_FIELD",
              x.id + ":" + k,
            ]);
          }
        });
        if (vals.overlap && DATA.options.overlap.indexOf(vals.overlap) < 0) {
          invalid = true;
          qc.push([record.id, record.timestamp, code, "INVALID_OVERLAP", x.id]);
        }
        if (!String(vals.comment).trim() || !String(vals.revision).trim()) {
          invalid = true;
          qc.push([
            record.id,
            record.timestamp,
            code,
            "MISSING_QUALITATIVE",
            x.id,
          ]);
        }
        if (vals.decision !== DATA.options.decision[0]) {
          [vals.comment, vals.revision].forEach(function (t) {
            if (
              /^(?:[-–—.]|tidak ada(?: catatan| usulan)?|n\/?a|nihil)$/i.test(
                String(t).trim(),
              )
            ) {
              invalid = true;
              qc.push([
                record.id,
                record.timestamp,
                code,
                "QUALITATIVE_REVIEW_REQUIRED",
                x.id + ": jawaban placeholder untuk item non-accept.",
              ]);
            }
          });
        }
        if (!invalid)
          row.splice(
            5,
            5,
            vals.decision,
            vals.evidence,
            vals.clarity,
            vals.comment,
            vals.revision,
          );
        supplement.push([
          record.id,
          record.timestamp,
          code,
          x.id,
          vals.overlap,
          v.overallComment || "",
          v.fgdAvailability || "",
        ]);
      }
      data.push(row);
    });
  });
  return { data: data, supplement: supplement, qc: qc };
}
function bukaTESTUntukDryRun() {
  validateSource_();

  const s = state_("TEST");

  assert_(
    s,
    "State TEST tidak ditemukan. Jalankan buatFormTEST() terlebih dahulu.",
  );

  assert_(
    s.status === "BUILT",
    "DILARANG membuka TEST. Status sekarang: " +
      s.status +
      ". Build harus BUILT terlebih dahulu.",
  );

  const form = FormApp.openById(s.formId);

  const plan = plan_("TEST");

  assert_(
    s.cursor === plan.length,
    "DILARANG membuka TEST. Cursor baru " +
      s.cursor +
      " / " +
      plan.length +
      ".",
  );

  assert_(
    form.getItems().length === plan.length,
    "DILARANG membuka TEST. Item Form baru " +
      form.getItems().length +
      " / " +
      plan.length +
      ".",
  );

  verifyForm_(form, plan, s, "TEST");

  if (form.supportsAdvancedResponderPermissions()) {
    form.setPublished(true);
  }

  form.setAcceptingResponses(true);

  console.log("TEST SIAP untuk dry-run.");
  console.log("STATUS    : " + s.status);
  console.log("ITEM      : " + form.getItems().length + " / " + plan.length);
  console.log("RESPONSES : " + form.getResponses().length);
  console.log("URL       : " + form.getPublishedUrl());

  return form.getPublishedUrl();
}
const DATA_SHA256 =
  "352364f6c735f5102751de3583af858b1d44b1f6476b9c10c00566ab0786c4eb";
const SOURCE = {
  questions: {
    file: "R1-V2.1.2A_Instrumen-Pertanyaan-Penelitian-Terkendali-V1.0-Reviewed.xlsx",
    libraryId: "libfile_5d14811759e08191981f27a95c13411a",
    version: 0,
    sha256: "008bade6f44ba5f397029458093de161bbd84e2bd166cea8a3354981b8830dd9",
  },
  fgd: {
    file: "R1-V2.1.2A_Instrumen-Pengumpulan-Data-FGD-DCGMI-V1.0-Reviewed.xlsx",
    libraryId: "libfile_cc89c277017081919ce4d769a762f7c2",
    version: 0,
    sha256: "5bf056fc427bd372ed84dab6ce7bc223f6319db4ea132714ca87a2d8de44d8fa",
  },
};
// BEGIN VERIFIED EXCEL SNAPSHOT — jangan edit manual.
const DATA = {
  items: [
    {
      no: 1,
      id: "D1-A01-C02",
      domainCode: "D1",
      domain: "Infrastruktur Teknologi Akademik",
      aspectCode: "A01",
      aspect: "Infrastruktur Jaringan dan Komputasi",
      indicator: "Konektivitas jaringan kampus",
      definition:
        "Cakupan, kapasitas, dan keandalan jaringan kampus, mencakup ketersediaan Wi-Fi di area akademik, kapasitas bandwidth per pengguna, dan tingkat ketersediaan layanan jaringan.",
      minimumEvidence:
        "Topologi jaringan; peta cakupan Wi-Fi; kapasitas bandwidth; log ketersediaan dan insiden",
      strengtheningEvidence: "Uji cakupan independen; laporan masalah pengguna",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Konektivitas jaringan kampus” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 2,
      id: "D1-A01-C03",
      domainCode: "D1",
      domain: "Infrastruktur Teknologi Akademik",
      aspectCode: "A01",
      aspect: "Infrastruktur Jaringan dan Komputasi",
      indicator: "Infrastruktur cloud computing",
      definition:
        "Tingkat pemanfaatan layanan komputasi awan untuk menopang beban kerja akademik dan administratif, mencakup model layanan yang digunakan dan cakupan sistem yang telah bermigrasi.",
      minimumEvidence:
        "Katalog layanan cloud; inventaris deployment/migrasi; catatan ketersediaan dan biaya",
      strengtheningEvidence: "Reviu arsitektur; bukti vendor dan SLA",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Infrastruktur cloud computing” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 3,
      id: "D1-A01-C04",
      domainCode: "D1",
      domain: "Infrastruktur Teknologi Akademik",
      aspectCode: "A01",
      aspect: "Infrastruktur Jaringan dan Komputasi",
      indicator: "Kapasitas pusat data",
      definition:
        "Ketersediaan dan kapasitas pusat data institusi, mencakup keberadaan fasilitas, tingkat redundansi, serta mekanisme pemulihan bencana.",
      minimumEvidence:
        "Inventaris pusat data; kapasitas/pemanfaatan; redundansi; catatan uji backup dan disaster recovery",
      strengtheningEvidence: "Audit dan bukti uji pemulihan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Kapasitas pusat data” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 4,
      id: "D1-A02-C01",
      domainCode: "D1",
      domain: "Infrastruktur Teknologi Akademik",
      aspectCode: "A02",
      aspect: "Platform Pembelajaran Digital",
      indicator: "Ketersediaan LMS terintegrasi",
      definition:
        "Keberadaan sistem manajemen pembelajaran institusional yang terintegrasi dengan sistem akademik, mencakup cakupan mata kuliah yang menggunakannya dan tingkat pemanfaatan aktif.",
      minimumEvidence:
        "Inventaris LMS; arsitektur integrasi; laporan cakupan mata kuliah dan penggunaan aktif",
      strengtheningEvidence:
        "Data penggunaan dosen/mahasiswa; ketersediaan layanan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Ketersediaan LMS terintegrasi” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 5,
      id: "D1-A02-C07",
      domainCode: "D1",
      domain: "Infrastruktur Teknologi Akademik",
      aspectCode: "A02",
      aspect: "Platform Pembelajaran Digital",
      indicator: "Sistem pembelajaran adaptif",
      definition:
        "Penerapan sistem pembelajaran yang menyesuaikan materi atau alur belajar berdasarkan data perilaku dan capaian mahasiswa.",
      minimumEvidence:
        "Dokumentasi fungsi pembelajaran adaptif; ruang lingkup implementasi; algoritma dan data",
      strengtheningEvidence:
        "Capaian pembelajaran dan bukti pengalaman pengguna",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Sistem pembelajaran adaptif” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 6,
      id: "D1-A03-C05",
      domainCode: "D1",
      domain: "Infrastruktur Teknologi Akademik",
      aspectCode: "A03",
      aspect: "Teknologi Emerging dan Inovasi",
      indicator: "Pengembangan aplikasi akademik",
      definition:
        "Kapasitas institusi membangun dan memutakhirkan aplikasi pendukung layanan akademik dan administratif secara terencana.",
      minimumEvidence:
        "Portofolio aplikasi; roadmap rilis; catatan pengembangan dan perubahan",
      strengtheningEvidence: "UAT dan bukti kinerja rilis",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Pengembangan aplikasi akademik” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 7,
      id: "D1-A03-C06",
      domainCode: "D1",
      domain: "Infrastruktur Teknologi Akademik",
      aspectCode: "A03",
      aspect: "Teknologi Emerging dan Inovasi",
      indicator: "Adopsi teknologi emerging",
      definition:
        "Tingkat adopsi teknologi mutakhir seperti kecerdasan buatan, Internet of Things, serta realitas virtual dan tertambah dalam proses akademik maupun layanan kampus.",
      minimumEvidence:
        "Portofolio AI/IoT/VR/AR yang disetujui; use case; catatan tata kelola dan evaluasi",
      strengtheningEvidence: "Analisis manfaat-risiko; bukti adopsi",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Adopsi teknologi emerging” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 8,
      id: "D2-A04-C08",
      domainCode: "D2",
      domain: "Strategi dan Perencanaan Digital",
      aspectCode: "A04",
      aspect: "Perencanaan Strategis Digital",
      indicator: "Rencana strategis digital",
      definition:
        "Keberadaan dokumen rencana strategis teknologi informasi yang disahkan pimpinan, memuat sasaran terukur dan periode berlaku yang jelas.",
      minimumEvidence:
        "Strategi digital institusi yang memuat sasaran, KPI, anggaran, pemilik, dan siklus reviu",
      strengtheningEvidence: "Bukti pemantauan implementasi",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Rencana strategis digital” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 9,
      id: "D2-A04-C09",
      domainCode: "D2",
      domain: "Strategi dan Perencanaan Digital",
      aspectCode: "A04",
      aspect: "Perencanaan Strategis Digital",
      indicator: "Keselarasan strategi digital dengan strategi institusi",
      definition:
        "Tingkat keterkaitan yang terdokumentasi antara sasaran rencana strategis teknologi informasi dan sasaran rencana strategis institusi.",
      minimumEvidence:
        "Matriks keterlacakan inisiatif digital terhadap renstra dan KPI institusi",
      strengtheningEvidence: "Reviu portofolio dan notulen tata kelola",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Keselarasan strategi digital dengan strategi institusi” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 10,
      id: "D2-A04-C10",
      domainCode: "D2",
      domain: "Strategi dan Perencanaan Digital",
      aspectCode: "A04",
      aspect: "Perencanaan Strategis Digital",
      indicator: "Roadmap transformasi digital",
      definition:
        "Keberadaan peta jalan transformasi digital yang memuat tahapan, target waktu, dan penanggung jawab pada setiap tahap.",
      minimumEvidence:
        "Roadmap bertenggat; milestone; dependensi; sumber daya; laporan kemajuan",
      strengtheningEvidence: "Bukti manajemen perubahan dan realisasi manfaat",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Roadmap transformasi digital” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 11,
      id: "D2-A05-C11",
      domainCode: "D2",
      domain: "Strategi dan Perencanaan Digital",
      aspectCode: "A05",
      aspect: "Inovasi Proses dan Kepemimpinan",
      indicator: "Inovasi proses bisnis digital",
      definition:
        "Cakupan proses bisnis akademik dan administratif yang telah dirancang ulang berbasis digital, bukan sekadar dialihmediakan.",
      minimumEvidence:
        "Register proses yang didigitalisasi/didesain ulang; bukti sebelum-sesudah; metrik otomasi",
      strengtheningEvidence:
        "Bukti manfaat pemangku kepentingan dan kontrol proses",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Inovasi proses bisnis digital” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 12,
      id: "D2-A05-C12",
      domainCode: "D2",
      domain: "Strategi dan Perencanaan Digital",
      aspectCode: "A05",
      aspect: "Inovasi Proses dan Kepemimpinan",
      indicator: "Kepemimpinan digital",
      definition:
        "Keberadaan peran kepemimpinan digital pada tataran pimpinan institusi beserta keterlibatannya dalam pengarahan inisiatif transformasi digital.",
      minimumEvidence:
        "Mandat kepemimpinan; sponsorship; catatan keputusan; pengawasan portofolio digital",
      strengtheningEvidence: "Komunikasi pimpinan dan komitmen sumber daya",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Kepemimpinan digital” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 13,
      id: "D3-A06-C13",
      domainCode: "D3",
      domain: "Tata Kelola dan Manajemen Digital",
      aspectCode: "A06",
      aspect: "Struktur dan Mekanisme Governance",
      indicator: "Struktur governance teknologi informasi",
      definition:
        "Keberadaan struktur tata kelola teknologi informasi yang formal, mencakup peran setingkat CIO atau CDO serta komite pengarah teknologi informasi.",
      minimumEvidence:
        "Piagam tata kelola TI/digital; komite; peran; akuntabilitas dan garis pelaporan",
      strengtheningEvidence: "Notulen dan tindak lanjut keputusan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Struktur governance teknologi informasi” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 14,
      id: "D3-A06-C14",
      domainCode: "D3",
      domain: "Tata Kelola dan Manajemen Digital",
      aspectCode: "A06",
      aspect: "Struktur dan Mekanisme Governance",
      indicator: "Koordinasi dan kolaborasi teknologi informasi",
      definition:
        "Keberadaan mekanisme koordinasi teknologi informasi antar-unit dan antar-fakultas yang berjalan secara reguler dan terdokumentasi.",
      minimumEvidence:
        "Forum koordinasi; RACI; alur lintas unit; catatan kolaborasi",
      strengtheningEvidence:
        "Bukti penyelesaian isu dan partisipasi pemangku kepentingan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Koordinasi dan kolaborasi teknologi informasi” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 15,
      id: "D3-A06-C17",
      domainCode: "D3",
      domain: "Tata Kelola dan Manajemen Digital",
      aspectCode: "A06",
      aspect: "Struktur dan Mekanisme Governance",
      indicator: "Kebijakan teknologi informasi internal",
      definition:
        "Keberadaan kebijakan dan regulasi internal bidang teknologi informasi yang disahkan, ditinjau berkala, dan disosialisasikan kepada sivitas akademika.",
      minimumEvidence:
        "Kebijakan TI/digital disahkan; kontrol versi; sosialisasi; pemantauan kepatuhan",
      strengtheningEvidence: "Catatan pengecualian dan reviu",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Kebijakan teknologi informasi internal” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 16,
      id: "D3-A06-C20b",
      domainCode: "D3",
      domain: "Tata Kelola dan Manajemen Digital",
      aspectCode: "A06",
      aspect: "Struktur dan Mekanisme Governance",
      indicator: "Mekanisme pengambilan keputusan TI",
      definition:
        "Keberadaan mekanisme formal pengambilan keputusan TI, mencakup pembagian kewenangan, forum atau komite, kriteria prioritas, dan dokumentasi keputusan.",
      minimumEvidence:
        "Matriks hak keputusan; mandat komite; kriteria keputusan; log keputusan",
      strengtheningEvidence: "Bukti eskalasi dan pelacakan hasil keputusan",
      priority: "CRITICAL-CONTROL",
      prompt:
        "Apakah paket indikator “Mekanisme pengambilan keputusan TI” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 17,
      id: "D3-A07-C15",
      domainCode: "D3",
      domain: "Tata Kelola dan Manajemen Digital",
      aspectCode: "A07",
      aspect: "Manajemen Risiko dan Layanan TI",
      indicator: "Manajemen risiko digital",
      definition:
        "Keberadaan proses identifikasi, penilaian, dan mitigasi risiko teknologi informasi yang terdokumentasi serta ditinjau secara berkala.",
      minimumEvidence:
        "Register risiko digital; risk appetite; pemilik mitigasi; pemantauan dan eskalasi",
      strengtheningEvidence: "Temuan audit dan penyelesaian perlakuan risiko",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Manajemen risiko digital” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 18,
      id: "D3-A07-C16",
      domainCode: "D3",
      domain: "Tata Kelola dan Manajemen Digital",
      aspectCode: "A07",
      aspect: "Manajemen Risiko dan Layanan TI",
      indicator: "Manajemen layanan teknologi informasi",
      definition:
        "Penerapan praktik manajemen layanan teknologi informasi, mencakup pengelolaan insiden, permintaan layanan, dan perubahan melalui mekanisme yang terdokumentasi.",
      minimumEvidence:
        "Katalog layanan TI; SLA/OLA; catatan insiden, permintaan, perubahan, dan problem",
      strengtheningEvidence:
        "Laporan kinerja layanan dan perbaikan berkelanjutan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Manajemen layanan teknologi informasi” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 19,
      id: "D4-A08-C18",
      domainCode: "D4",
      domain: "Keamanan Siber dan Kepatuhan",
      aspectCode: "A08",
      aspect: "Keamanan Siber dan Kriptografi",
      indicator: "Kematangan keamanan siber kampus",
      definition:
        "Tingkat penerapan kendali keamanan siber institusi, mencakup keberadaan fungsi keamanan informasi, pemantauan ancaman, dan pengujian kerentanan secara berkala.",
      minimumEvidence:
        "Kerangka keamanan siber; cakupan kontrol; hasil asesmen; rencana peningkatan",
      strengtheningEvidence: "Bukti kerentanan dan assurance",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Kematangan keamanan siber kampus” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 20,
      id: "D4-A08-C19",
      domainCode: "D4",
      domain: "Keamanan Siber dan Kepatuhan",
      aspectCode: "A08",
      aspect: "Keamanan Siber dan Kriptografi",
      indicator: "Kriptografi dan enkripsi data",
      definition:
        "Penerapan enkripsi pada data saat disimpan maupun saat ditransmisikan, beserta pengelolaan kunci kriptografi yang terdokumentasi.",
      minimumEvidence:
        "Standar enkripsi/kriptografi; catatan pengelolaan kunci; cakupan implementasi",
      strengtheningEvidence: "Konfigurasi teknis dan bukti audit",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Kriptografi dan enkripsi data” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 21,
      id: "D4-A08-C20",
      domainCode: "D4",
      domain: "Keamanan Siber dan Kepatuhan",
      aspectCode: "A08",
      aspect: "Keamanan Siber dan Kriptografi",
      indicator: "Kapabilitas incident response",
      definition:
        "Keberadaan prosedur penanganan insiden keamanan yang terdokumentasi, mencakup pelaporan, eskalasi, pemulihan, serta pengujian kesiapan secara berkala.",
      minimumEvidence:
        "Rencana respons insiden; peran; playbook; latihan; catatan insiden dan pemulihan",
      strengtheningEvidence: "Lessons learned dan metrik respons",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Kapabilitas incident response” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 22,
      id: "D4-A09-C21",
      domainCode: "D4",
      domain: "Keamanan Siber dan Kepatuhan",
      aspectCode: "A09",
      aspect: "Audit dan Kepatuhan",
      indicator: "Audit teknologi digital",
      definition:
        "Pelaksanaan audit teknologi informasi secara berkala terhadap aplikasi dan infrastruktur, beserta tindak lanjut atas temuan audit.",
      minimumEvidence:
        "Rencana audit TI/digital; laporan; temuan; pelacakan tindakan korektif",
      strengtheningEvidence: "Bukti assurance independen",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Audit teknologi digital” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 23,
      id: "D4-A09-C22",
      domainCode: "D4",
      domain: "Keamanan Siber dan Kepatuhan",
      aspectCode: "A09",
      aspect: "Audit dan Kepatuhan",
      indicator: "Perlindungan data pribadi",
      definition:
        "Tingkat kepatuhan institusi terhadap ketentuan perlindungan data pribadi, mencakup pendataan pemrosesan data, dasar pemrosesan, dan mekanisme pemenuhan hak subjek data.",
      minimumEvidence:
        "Kebijakan privasi; inventaris pemrosesan; consent/hak subjek; asesmen dampak",
      strengtheningEvidence: "Reviu kepatuhan dan catatan insiden",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Perlindungan data pribadi” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 24,
      id: "D4-A09-C23",
      domainCode: "D4",
      domain: "Keamanan Siber dan Kepatuhan",
      aspectCode: "A09",
      aspect: "Audit dan Kepatuhan",
      indicator: "Kebijakan keamanan informasi",
      definition:
        "Keberadaan kebijakan keamanan informasi yang disahkan pimpinan, mencakup klasifikasi informasi, hak akses, dan kewajiban pengguna.",
      minimumEvidence:
        "Paket kebijakan keamanan informasi; pemilik; siklus reviu; bukti awareness",
      strengtheningEvidence: "Catatan kepatuhan dan pengecualian",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Kebijakan keamanan informasi” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 25,
      id: "D5-A10-C24",
      domainCode: "D5",
      domain: "Kapabilitas dan Budaya Digital",
      aspectCode: "A10",
      aspect: "Kompetensi dan Literasi Digital",
      indicator: "Kompetensi digital sumber daya manusia",
      definition:
        "Tingkat kompetensi digital dosen dan tenaga kependidikan yang terukur melalui pemetaan kompetensi atau sertifikasi yang diakui institusi.",
      minimumEvidence:
        "Kerangka kompetensi; profil peran; hasil asesmen dan analisis gap",
      strengtheningEvidence: "Bukti kinerja dan sertifikasi",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Kompetensi digital sumber daya manusia” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 26,
      id: "D5-A10-C26",
      domainCode: "D5",
      domain: "Kapabilitas dan Budaya Digital",
      aspectCode: "A10",
      aspect: "Kompetensi dan Literasi Digital",
      indicator: "Pelatihan dan pengembangan digital",
      definition:
        "Keberadaan program pelatihan kompetensi digital yang terencana, beserta cakupan peserta dan keberulangannya dalam satu periode akademik.",
      minimumEvidence:
        "Rencana pelatihan digital; partisipasi/kelulusan; learning pathway; asesmen tindak lanjut",
      strengtheningEvidence: "Bukti penerapan keterampilan dan hasil",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Pelatihan dan pengembangan digital” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 27,
      id: "D5-A10-C27",
      domainCode: "D5",
      domain: "Kapabilitas dan Budaya Digital",
      aspectCode: "A10",
      aspect: "Kompetensi dan Literasi Digital",
      indicator: "Literasi digital sivitas akademika",
      definition:
        "Tingkat literasi digital mahasiswa, dosen, dan tenaga kependidikan yang diukur melalui instrumen penilaian yang berlaku di institusi.",
      minimumEvidence:
        "Kerangka literasi digital; hasil asesmen lintas kelompok pemangku kepentingan",
      strengtheningEvidence:
        "Data partisipasi, sertifikasi, dan penggunaan dukungan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Literasi digital sivitas akademika” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 28,
      id: "D5-A11-C25",
      domainCode: "D5",
      domain: "Kapabilitas dan Budaya Digital",
      aspectCode: "A11",
      aspect: "Budaya Digital dan Kesiapan Perubahan",
      indicator: "Budaya digital dan keterbukaan terhadap inovasi",
      definition:
        "Tingkat penerimaan sivitas akademika terhadap perubahan berbasis digital, tercermin dari keberadaan program pengelolaan perubahan dan tingkat partisipasi dalam inisiatif digital.",
      minimumEvidence:
        "Asesmen kesiapan perubahan; praktik inovasi; insentif; bukti adopsi",
      strengtheningEvidence: "Bukti persepsi dan perilaku pemangku kepentingan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Budaya digital dan keterbukaan terhadap inovasi” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 29,
      id: "D6-A12-C28",
      domainCode: "D6",
      domain: "Pengelolaan Data dan Informasi",
      aspectCode: "A12",
      aspect: "Manajemen dan Tata Kelola Data",
      indicator: "Manajemen data institusional",
      definition:
        "Keberadaan tata kelola data institusional, mencakup kepemilikan data, kamus data, dan prosedur pengelolaan siklus hidup data.",
      minimumEvidence:
        "Piagam tata kelola data; ownership/stewardship; kontrol siklus hidup dan metadata",
      strengtheningEvidence: "Catatan isu dan kepatuhan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Manajemen data institusional” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 30,
      id: "D6-A12-C30",
      domainCode: "D6",
      domain: "Pengelolaan Data dan Informasi",
      aspectCode: "A12",
      aspect: "Manajemen dan Tata Kelola Data",
      indicator: "Kualitas dan integritas data",
      definition:
        "Tingkat kelengkapan, ketepatan, dan konsistensi data institusional yang diukur melalui pemeriksaan mutu data secara berkala.",
      minimumEvidence:
        "Aturan kualitas data; hasil profiling; log isu; remediasi dan kontrol integritas",
      strengtheningEvidence: "Rekonsiliasi atau assurance independen",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Kualitas dan integritas data” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 31,
      id: "D6-A12-C32",
      domainCode: "D6",
      domain: "Pengelolaan Data dan Informasi",
      aspectCode: "A12",
      aspect: "Manajemen dan Tata Kelola Data",
      indicator: "Pengelolaan data penelitian",
      definition:
        "Keberadaan pengelolaan data penelitian institusi, mencakup repositori, kebijakan berbagi data, dan penerapan prinsip data terbuka.",
      minimumEvidence:
        "Kebijakan data penelitian; repositori; data-management plan; kontrol keterbukaan/akses",
      strengtheningEvidence: "Penggunaan repositori dan bukti kepatuhan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Pengelolaan data penelitian” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 32,
      id: "D6-A13-C29",
      domainCode: "D6",
      domain: "Pengelolaan Data dan Informasi",
      aspectCode: "A13",
      aspect: "Analitika dan Pemanfaatan Data",
      indicator: "Analitika data dan dasbor",
      definition:
        "Ketersediaan dasbor dan kapabilitas analitik yang menyajikan data institusional secara terkini bagi pengambil keputusan.",
      minimumEvidence:
        "Inventaris platform analitika/dasbor; use case; kontrol refresh dan akses",
      strengtheningEvidence: "Bukti penggunaan untuk keputusan dan manfaat",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Analitika data dan dasbor” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 33,
      id: "D6-A13-C31",
      domainCode: "D6",
      domain: "Pengelolaan Data dan Informasi",
      aspectCode: "A13",
      aspect: "Analitika dan Pemanfaatan Data",
      indicator: "Pengambilan keputusan berbasis data",
      definition:
        "Tingkat pemanfaatan data institusional sebagai dasar pengambilan keputusan pimpinan, tercermin dari keberadaan mekanisme pelaporan berbasis data yang rutin.",
      minimumEvidence:
        "Catatan keputusan yang ditautkan ke data/analitika; reviu KPI dan tindak lanjut",
      strengtheningEvidence: "Bukti hasil dan mutu keputusan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Pengambilan keputusan berbasis data” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 34,
      id: "D7-A14-C33",
      domainCode: "D7",
      domain: "Keterpaduan Layanan Digital",
      aspectCode: "A14",
      aspect: "Integrasi dan Interoperabilitas Layanan",
      indicator: "Integrasi layanan digital kampus",
      definition:
        "Tingkat keterhubungan antar-sistem layanan kampus melalui mekanisme integrasi terkelola seperti antarmuka pemrograman aplikasi atau sistem penghubung layanan.",
      minimumEvidence:
        "Arsitektur enterprise/layanan; katalog integrasi; dokumentasi API dan aliran data",
      strengtheningEvidence: "Pemantauan integrasi dan bukti layanan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Integrasi layanan digital kampus” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 35,
      id: "D7-A14-C34",
      domainCode: "D7",
      domain: "Keterpaduan Layanan Digital",
      aspectCode: "A14",
      aspect: "Integrasi dan Interoperabilitas Layanan",
      indicator: "Single sign-on dan identitas digital",
      definition:
        "Keberadaan pengelolaan identitas digital terpusat beserta cakupan sistem yang telah menggunakan autentikasi tunggal.",
      minimumEvidence:
        "Arsitektur identitas dan akses; cakupan SSO; log MFA dan akses",
      strengtheningEvidence: "Insiden akses pengguna dan bukti ketersediaan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Single sign-on dan identitas digital” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 36,
      id: "D7-A14-C35",
      domainCode: "D7",
      domain: "Keterpaduan Layanan Digital",
      aspectCode: "A14",
      aspect: "Integrasi dan Interoperabilitas Layanan",
      indicator: "Interoperabilitas sistem",
      definition:
        "Tingkat kemampuan sistem institusi bertukar data dengan sistem eksternal, termasuk sistem pelaporan nasional pendidikan tinggi.",
      minimumEvidence:
        "Standar interoperabilitas; katalog API; uji antarmuka; log pertukaran data",
      strengtheningEvidence: "Bukti kegagalan, latency, dan rekonsiliasi",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Interoperabilitas sistem” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 37,
      id: "D7-A14-C36",
      domainCode: "D7",
      domain: "Keterpaduan Layanan Digital",
      aspectCode: "A14",
      aspect: "Integrasi dan Interoperabilitas Layanan",
      indicator: "Layanan kampus berbasis perangkat bergerak",
      definition:
        "Ketersediaan layanan kampus yang dapat diakses melalui perangkat bergerak beserta cakupan layanan yang telah tersedia di dalamnya.",
      minimumEvidence:
        "Portofolio layanan mobile; inventaris fitur/cakupan; metrik ketersediaan dan penggunaan",
      strengtheningEvidence: "Umpan balik pengguna dan bukti aksesibilitas",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Layanan kampus berbasis perangkat bergerak” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 38,
      id: "D8-A15-C37",
      domainCode: "D8",
      domain: "Kepuasan dan Pengalaman Pengguna",
      aspectCode: "A15",
      aspect: "Kepuasan dan Pengalaman Pengguna",
      indicator: "Kepuasan pengguna layanan digital",
      definition:
        "Tingkat kepuasan mahasiswa, dosen, dan tenaga kependidikan terhadap layanan digital kampus yang diukur melalui survei berkala.",
      minimumEvidence:
        "Survei kepuasan terstandar; data respons; tren keluhan dan penyelesaian",
      strengtheningEvidence: "Triangulasi dengan metrik layanan",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Kepuasan pengguna layanan digital” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 39,
      id: "D8-A15-C38",
      domainCode: "D8",
      domain: "Kepuasan dan Pengalaman Pengguna",
      aspectCode: "A15",
      aspect: "Kepuasan dan Pengalaman Pengguna",
      indicator: "Kualitas dan tingkat layanan digital",
      definition:
        "Keberadaan perjanjian tingkat layanan beserta tingkat pemenuhannya pada periode berjalan.",
      minimumEvidence:
        "Definisi SLA; laporan kinerja; metrik availability, response, dan resolution",
      strengtheningEvidence: "Bukti dampak pelanggan dan pengecualian",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Kualitas dan tingkat layanan digital” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 40,
      id: "D8-A15-C39",
      domainCode: "D8",
      domain: "Kepuasan dan Pengalaman Pengguna",
      aspectCode: "A15",
      aspect: "Kepuasan dan Pengalaman Pengguna",
      indicator: "Tingkat adopsi dan pemanfaatan layanan",
      definition:
        "Proporsi pengguna aktif terhadap total pengguna potensial pada layanan digital utama institusi dalam satu periode.",
      minimumEvidence:
        "Analitika penggunaan/adopsi menurut layanan dan kelompok pengguna",
      strengtheningEvidence:
        "Survei/wawancara untuk menjelaskan hambatan adopsi",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Tingkat adopsi dan pemanfaatan layanan” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 41,
      id: "D8-A15-C40",
      domainCode: "D8",
      domain: "Kepuasan dan Pengalaman Pengguna",
      aspectCode: "A15",
      aspect: "Kepuasan dan Pengalaman Pengguna",
      indicator: "Aksesibilitas dan inklusivitas digital",
      definition:
        "Tingkat pemenuhan kaidah aksesibilitas pada layanan digital, mencakup dukungan bagi pengguna berkebutuhan khusus dan ketersediaan antarmuka multibahasa.",
      minimumEvidence:
        "Audit aksesibilitas; standar desain inklusif; bukti akomodasi dan akses",
      strengtheningEvidence: "Uji pengguna dengan kelompok beragam",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Aksesibilitas dan inklusivitas digital” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 42,
      id: "D8-A15-C41",
      domainCode: "D8",
      domain: "Kepuasan dan Pengalaman Pengguna",
      aspectCode: "A15",
      aspect: "Kepuasan dan Pengalaman Pengguna",
      indicator: "Mekanisme umpan balik dan perbaikan berkelanjutan",
      definition:
        "Keberadaan kanal umpan balik pengguna beserta bukti tindak lanjut perbaikan layanan berdasarkan umpan balik tersebut.",
      minimumEvidence:
        "Kanal umpan balik; log isu-ke-perbaikan; bukti penutupan dan reviu",
      strengtheningEvidence: "Persepsi pemangku kepentingan atas responsivitas",
      priority: "STANDARD",
      prompt:
        "Apakah paket indikator “Mekanisme umpan balik dan perbaikan berkelanjutan” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
    {
      no: 43,
      id: "D8-A15-C42",
      domainCode: "D8",
      domain: "Kepuasan dan Pengalaman Pengguna",
      aspectCode: "A15",
      aspect: "Kepuasan dan Pengalaman Pengguna",
      indicator: "Pengalaman pengguna layanan digital",
      definition:
        "Kualitas pengalaman interaksi pengguna dengan layanan digital, mencakup kemudahan penggunaan, konsistensi antarmuka, efisiensi penyelesaian tugas, dan pengalaman lintas kanal.",
      minimumEvidence:
        "Evaluasi usability/UX; keberhasilan, waktu, dan error tugas; konsistensi journey lintas kanal",
      strengtheningEvidence: "Triangulasi wawancara, survei, dan observasi",
      priority: "CRITICAL-CONTROL",
      prompt:
        "Apakah paket indikator “Pengalaman pengguna layanan digital” relevan, jelas, tidak redundan, dapat dinilai melalui bukti yang realistis, dan sesuai dengan konteks perguruan tinggi Indonesia?",
      qualitativeRule:
        "Alasan dan usulan perbaikan wajib untuk keputusan selain ‘Dapat dipertahankan’",
    },
  ],
  options: {
    decision: [
      "Dapat dipertahankan",
      "Perlu perbaikan redaksi/definisi",
      "Berpotensi tumpang tindih",
      "Perlu dipindahkan/digabungkan/dipecah",
      "Dipertimbangkan untuk dihapus",
      "Perlu dibahas dalam FGD",
      "Tidak dapat menilai",
    ],
    evidence: [
      "Bukti memadai dan realistis",
      "Bukti tersedia tetapi perlu diperjelas",
      "Bukti sulit diperoleh",
      "Tidak dapat menilai",
    ],
    clarity: ["Jelas", "Perlu perbaikan", "Tidak dapat menilai"],
    overlap: [
      "Tidak tumpang tindih",
      "Berpotensi tumpang tindih",
      "Perlu dipindahkan/digabungkan/dipecah",
      "Tidak dapat menilai",
    ],
  },
  experts: ["P01", "P02", "P03", "P04", "P05", "P06"],
  dataHeaders: [
    "Record ID",
    "Expert ID",
    "Canonical ID",
    "Domain",
    "Indicator",
    "Initial Decision",
    "Evidence Feasibility",
    "Clarity",
    "Substantive Comment",
    "Revision Suggestion",
  ],
};
