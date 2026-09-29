import { diffVersions, type DiffIndicator } from "@/lib/artifact/diff";
import type { ReportData } from "@/lib/db/repository/report-data";
import { barChart, columns, donut, dotRange, groupedBars, heatmap, lineChart, stackedBars, tornado } from "@/lib/export/chart-svg";

import { REPORT_CHAPTERS, type ChapterKey, type ChapterState } from "./chapters";

// The G1–G7 report as an ordered list of blocks (headings, narrative, tables,
// charts). The PDF and the Word renderer both consume this list, so the two
// formats always carry the same content.

export type Cell = string | number | boolean | null | undefined;
export interface Column {
  header: string;
  weight?: number;
  align?: "left" | "right";
}

export type Block =
  | { type: "cover"; title: string; subtitle: string; rows: [string, Cell][]; note: string }
  | { type: "heading"; text: string; level: 1 | 2 | 3 }
  | { type: "narrative"; attribution: string; paragraphs: string[] }
  | { type: "kv"; rows: [string, Cell][] }
  | { type: "table"; columns: Column[]; rows: Cell[][]; size?: number }
  | { type: "chart"; title: string; svg: string }
  | { type: "note"; text: string };

export interface ReportMeta {
  generatedAt: Date;
  generatedBy: string;
  modelId: string;
  users: Map<string, string>;
  /** Panelist names by panel code — only when an Admin requests the report (docs/07 P6). */
  identities?: Map<string, { fullName: string; field: string }>;
}

/** Seat label with its persona code, e.g. "Pakar 1 · P02". */
const seatName = (seats: { seatIndex: number; label: string; expert: { panelCode: string } | null }[], seatIndex: number | null | undefined, fallback?: string) => {
  const s = seats.find((x) => x.seatIndex === seatIndex);
  const label = s?.label ?? fallback ?? (seatIndex ? `Pakar ${seatIndex}` : "—");
  return s?.expert ? `${label} · ${s.expert.panelCode}` : label;
};

const dt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) : null);
const n3 = (v: number | null | undefined) => (v === null || v === undefined ? null : v.toFixed(3));
const tallyText = (t: unknown) => {
  const x = (t ?? {}) as Record<string, number>;
  return `terima ${x.TERIMA ?? 0} · revisi ${x.TERIMA_DENGAN_REVISI ?? 0} · tolak ${x.TOLAK ?? 0} (n ${x.total ?? (x.TERIMA ?? 0) + (x.TERIMA_DENGAN_REVISI ?? 0) + (x.TOLAK ?? 0)})`;
};
const byCode = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
const countBy = <T,>(xs: T[], key: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {});

const DECISIONS = ["TERIMA", "REVISI", "PEMBAHASAN_KHUSUS", "TIDAK_SEPAKAT", "PERTAHANKAN_SEMENTARA"];
const POSITIONS = ["TERIMA", "TERIMA_DENGAN_REVISI", "TOLAK"];
const ACTIONS = ["RUMUS_ULANG", "TAMBAH", "HAPUS", "GABUNG", "PECAH", "PINDAH"];
const EVIDENCE_KINDS = ["NORMATIF", "IMPLEMENTASI", "OPERASIONAL", "HASIL", "PERBAIKAN"];
const GATES = ["G1_BASELINE", "G2_FGD", "G3_DELPHI", "G4_CONTENT_LOCK", "G5_AHP", "G6_SCORING", "G7_PILOT"];

function indicatorsOf(d: ReportData, versionId: string) {
  return d.domains.filter((x) => x.versionId === versionId).flatMap((dom) => dom.aspects.flatMap((a) => a.indicators.map((i) => ({ dom, a, i }))));
}

function toDiff(rows: ReturnType<typeof indicatorsOf>): DiffIndicator[] {
  return rows.map(({ dom, a, i }) => ({
    code: i.code,
    name: i.name,
    domainCode: dom.code,
    aspectCode: a.code,
    deleted: !!i.deletedAt,
    operationalDefinition: i.operationalDefinition,
    assessmentObject: i.assessmentObject,
    boundaryNote: i.boundaryNote,
    rubric: i.rubricLevels.map((r) => ({ level: r.level, label: r.label, descriptor: r.descriptor })),
    evidence: i.evidence.map((e) => ({ kind: e.kind, minimumFor: e.minimumFor, mandatory: e.mandatory, description: e.description })),
  }));
}

export function buildReportBlocks(d: ReportData, chapters: ChapterState[], meta: ReportMeta): Block[] {
  const out: Block[] = [];
  const h = (text: string, level: 1 | 2 | 3) => out.push({ type: "heading", text, level });
  const table = (columns: Column[], rows: Cell[][], size?: number) => out.push({ type: "table", columns, rows, size });
  const chart = (title: string, svg: string) => out.push({ type: "chart", title, svg });
  const note = (text: string) => out.push({ type: "note", text });
  const kv = (rows: [string, Cell][]) => out.push({ type: "kv", rows });

  const root = d.lineage[0];
  const ch = (k: ChapterKey) => chapters.find((c) => c.key === k)!;
  const fgdVersion = [...d.lineage].reverse().find((v) => d.fgd.some((s) => s.versionId === v.id));
  const delphiVersion = [...d.lineage].reverse().find((v) => d.delphi.some((r) => r.versionId === v.id));
  const locked = [...d.lineage].reverse().find((v) => v.status === "CONTENT_LOCKED");
  const code = (id: string) => d.indicatorCode.get(id) ?? id;
  const sessions0 = () => d.fgd.find((x) => x.versionId === fgdVersion?.id);

  const narrative = (k: ChapterKey) => {
    const c = ch(k);
    out.push({
      type: "narrative",
      attribution: `Narasi disusun oleh AI (${meta.modelId}) ${dt(c.generatedAt) ?? ""}${c.edited ? ", disunting peneliti" : ""}; disetujui ${c.approvedById ? (meta.users.get(c.approvedById) ?? c.approvedById) : "—"} ${dt(c.approvedAt) ?? ""}. Angka di narasi bersumber dari tabel di bab ini.`,
      paragraphs: (c.narrative ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    });
  };

  const gateBlock = (versionId: string, gate: string) => {
    const rec = d.gates.find((g) => g.versionId === versionId && g.gate === gate);
    const e = d.evaluations[versionId]?.[gate];
    kv([
      ["Gate", gate],
      ["Status tercatat", rec?.status ?? "PENDING"],
      ["Diputuskan", dt(rec?.decidedAt)],
      ["Catatan keputusan", rec?.note ?? null],
      ["Evaluasi saat ini", e ? (e.passed ? "syarat terpenuhi" : "syarat belum terpenuhi") : null],
      ["Syarat belum terpenuhi", e?.unmet.join("; ") || "—"],
      ["Peringatan", e?.warnings.join("; ") || "—"],
    ]);
  };

  const artifactFull = (versionId: string, label: string) => {
    const rows = indicatorsOf(d, versionId);
    const doms = d.domains.filter((x) => x.versionId === versionId);
    const active = rows.filter((r) => !r.i.deletedAt);
    h(`Artefak lengkap ${label}`, 2);
    chart(`Jumlah indikator aktif per domain — ${label}`, barChart(`Jumlah indikator aktif per domain — ${label}`, doms.map((dom) => ({ label: `${dom.code} ${dom.name}`, value: dom.aspects.reduce((n, a) => n + a.indicators.filter((i) => !i.deletedAt).length, 0) })), { digits: 0 }));
    const complete = active.filter(({ i }) => i.operationalDefinition && i.rubricLevels.length === 5 && i.evidence.some((e) => e.mandatory)).length;
    chart(`Kelengkapan indikator — ${label}`, donut(`Kelengkapan indikator — ${label}`, [{ label: "Lengkap (definisi, rubrik 1–5, bukti wajib)", value: complete }, { label: "Belum lengkap", value: active.length - complete }], { centerLabel: "indikator" }));
    chart(`Persyaratan bukti wajib per jenis dan domain — ${label}`, stackedBars(`Persyaratan bukti wajib per jenis dan domain — ${label}`, EVIDENCE_KINDS, doms.map((dom) => ({ label: dom.code, counts: countBy(dom.aspects.flatMap((a) => a.indicators.filter((i) => !i.deletedAt).flatMap((i) => i.evidence.filter((e) => e.mandatory))), (e) => e.kind) }))));
    table([{ header: "Domain", weight: 1 }, { header: "Nama", weight: 3 }, { header: "Rasional", weight: 5 }, { header: "SDGs", weight: 1.2 }], doms.map((dom) => [dom.code, dom.name, dom.rationale, dom.sdgTags.join(", ")]));
    table([{ header: "Aspek", weight: 1 }, { header: "Domain", weight: 0.8 }, { header: "Nama", weight: 3 }, { header: "Rasional", weight: 5 }], doms.flatMap((dom) => dom.aspects.map((a) => [a.code, dom.code, a.name, a.rationale])));
    h(`Indikator ${label}`, 3);
    table(
      [{ header: "Kode", weight: 0.7 }, { header: "D/A", weight: 0.8 }, { header: "Nama", weight: 2 }, { header: "Definisi operasional", weight: 4 }, { header: "Objek penilaian", weight: 2.5 }, { header: "Catatan batas", weight: 2.5 }, { header: "Sumber", weight: 1.6 }, { header: "Status", weight: 1 }],
      rows.map(({ dom, a, i }) => [i.code, `${dom.code}/${a.code}`, i.name, i.operationalDefinition, i.assessmentObject, i.boundaryNote, i.sources.join("; "), `${i.isControlledException ? "CH-08 " : ""}${i.deletedAt ? "dihapus" : "aktif"}`]),
      6.3,
    );
    h(`Rubrik 1–5 ${label}`, 3);
    table([{ header: "Kode", weight: 0.7 }, { header: "Level", weight: 0.5, align: "right" }, { header: "Label", weight: 1.2 }, { header: "Deskriptor", weight: 7 }], rows.flatMap(({ i }) => i.rubricLevels.map((r) => [i.code, r.level, r.label, r.descriptor])), 6.3);
    h(`Persyaratan bukti ${label}`, 3);
    table([{ header: "Kode", weight: 0.7 }, { header: "Jenis", weight: 1.2 }, { header: "Min. level", weight: 0.7, align: "right" }, { header: "Wajib", weight: 0.6 }, { header: "Deskripsi", weight: 6 }], rows.flatMap(({ i }) => i.evidence.map((e) => [i.code, e.kind, e.minimumFor, e.mandatory, e.description])), 6.3);
  };

  // Cover.
  out.push({
    type: "cover",
    title: "LAPORAN LENGKAP DRY-RUN INSTRUMEN DCGMI",
    subtitle: `Gate G1 sampai G7 — garis versi ${d.lineage.map((v) => v.label).join(" → ")}`,
    rows: [
      ["Dibuat", dt(meta.generatedAt)],
      ["Oleh", meta.generatedBy],
      ["Model narasi", meta.modelId],
      ["Asal data", "SIMULATED — keluaran dry-run untuk menguji instrumen (R1–V1.7 §3.12, §4.3)"],
      ["Isi", "Seluruh data tersimpan, bukan ringkasan: artefak, gate, change log, transkrip FGD, rating Delphi per kursi, penilaian pasangan AHP, skor indikator, pilot, dan log panggilan model."],
    ],
    note: "Setiap narasi bab ditulis AI dari fakta terstruktur bab tersebut, ditinjau, dan disetujui sebelum laporan dibuat. Tabel dan grafik dihasilkan langsung dari basis data. Keputusan prosedural (adopsi usulan, revisi, tinjauan Delphi, content lock, kelulusan gate) dan persetujuan bab dibuat oleh AI peneliti atas nama peneliti utama (lihat CHANGELOG-METHOD).",
  });

  // 1. Intro.
  h(`1. ${REPORT_CHAPTERS[0].title}`, 1);
  narrative("intro");
  h("Garis versi", 2);
  table([{ header: "Versi", weight: 1.8 }, { header: "Status", weight: 1.1 }, { header: "Induk", weight: 1.8 }, { header: "Dibuat", weight: 1.3 }, { header: "Dikunci", weight: 1.3 }, { header: "Catatan", weight: 3 }], d.lineage.map((v) => [v.label, v.status, d.lineage.find((p) => p.id === v.parentId)?.label ?? null, dt(v.createdAt), dt(v.contentLockedAt), v.note]));
  const panelSeats = [...(sessions0()?.config.seats ?? []), ...((d.delphi.at(-1)?.config.seats ?? []).filter((x) => x.isNewMember))];
  if (panelSeats.length) {
    h("Komposisi panel", 2);
    table(
      [{ header: "Kode", weight: 0.6 }, ...(meta.identities ? [{ header: "Nama pakar (sumber CV persona)", weight: 2.6 }] : []), { header: "Bidang", weight: 1.4 }, { header: "Kursi FGD", weight: 0.8 }, { header: "Kursi Delphi", weight: 0.9 }, { header: "Model AI kursi", weight: 1.8 }],
      [...new Set(panelSeats.map((x) => x.expert?.panelCode).filter((c): c is string => !!c))].sort(byCode).map((c) => {
        const fgdSeat = sessions0()?.config.seats.find((x) => x.expert?.panelCode === c);
        const delSeat = d.delphi.at(-1)?.config.seats.find((x) => x.expert?.panelCode === c);
        return [c, ...(meta.identities ? [meta.identities.get(c)?.fullName ?? "—"] : []), (fgdSeat ?? delSeat)?.field, fgdSeat ? `Pakar ${fgdSeat.seatIndex}` : "—", delSeat ? `Pakar ${delSeat.seatIndex}` : "—", (fgdSeat ?? delSeat)?.modelProfile.label];
      }),
    );
    note("Persona setiap kursi disusun dari CV pakar tanpa penanda identitas. Seluruh ujaran, posisi, rating, dan alasan dalam laporan ini adalah keluaran model AI yang memerankan persona tersebut, bukan pernyataan atau pendapat pakar yang bersangkutan.");
  }
  h("Status gate per versi", 2);
  const statusOf = (vId: string, g: string) => d.gates.find((x) => x.versionId === vId && x.gate === g)?.status ?? "BELUM ADA";
  chart("Status gate per versi", stackedBars("Status gate per versi", ["PASSED", "PENDING", "FAILED", "BELUM ADA"], d.lineage.map((v) => ({ label: v.label, counts: countBy(GATES, (g) => statusOf(v.id, g)) }))));
  const lineStatus = GATES.map((g) => [...d.lineage].reverse().map((v) => d.gates.find((x) => x.versionId === v.id && x.gate === g)).find(Boolean));
  chart("Garis proses G1–G7 (status terjauh di garis versi)", donut("Garis proses G1–G7 (status terjauh di garis versi)", ["PASSED", "PENDING", "FAILED"].map((s) => ({ label: s, value: lineStatus.filter((r) => (r?.status ?? "PENDING") === s).length })).concat([{ label: "belum dievaluasi", value: lineStatus.filter((r) => !r).length }]), { centerLabel: "gate" }));
  table([{ header: "Versi", weight: 1.8 }, ...GATES.map((g) => ({ header: g.split("_")[0], weight: 1 }))], d.lineage.map((v) => [v.label, ...GATES.map((g) => `${d.gates.find((x) => x.versionId === v.id && x.gate === g)?.status ?? "—"}${d.evaluations[v.id]?.[g]?.passed ? " / ok" : ""}`)]));
  note("ok = syarat terpenuhi pada evaluasi saat laporan dibuat; status = keputusan tercatat.");

  // 2. G1.
  h(`2. ${REPORT_CHAPTERS[1].title}`, 1);
  narrative("g1");
  for (const v of d.lineage) {
    h(`G1 ${v.label}`, 3);
    gateBlock(v.id, "G1_BASELINE");
  }
  artifactFull(root.id, root.label);

  // 3. G2.
  h(`3. ${REPORT_CHAPTERS[2].title}`, 1);
  narrative("g2");
  const sessions = d.fgd.filter((s) => s.versionId === fgdVersion?.id);
  if (fgdVersion) gateBlock(fgdVersion.id, "G2_FGD");
  const allItems = sessions.flatMap((s) => s.stages.flatMap((st) => st.items.map((i) => ({ s, st, i }))));
  if (allItems.length) {
    const stageTitles = [...new Set(allItems.map((x) => x.st.title))];
    const positions = allItems.flatMap((x) => x.i.positions.map((p) => ({ ...p, stage: x.st.title })));
    const suggestions = allItems.flatMap((x) => x.i.suggestions);
    const seats = [...new Set(positions.map((p) => p.seatIndex))].sort((a, b) => a - b);
    h("Ringkasan grafis FGD", 2);
    chart("Keputusan komponen per tahap agenda", stackedBars("Keputusan komponen per tahap agenda (Tabel 3.5)", DECISIONS, stageTitles.map((title) => ({ label: title, counts: countBy(allItems.filter((x) => x.st.title === title && x.i.decision), (x) => x.i.decision!.decision) }))));
    chart("Sebaran posisi kursi", donut("Sebaran posisi kursi (semua komponen)", POSITIONS.map((p) => ({ label: p, value: positions.filter((x) => x.position === p).length })), { centerLabel: "posisi" }));
    const fgdSeats = sessions[0]?.config.seats ?? [];
    chart("Posisi per kursi", stackedBars("Posisi per kursi (proporsi)", POSITIONS, seats.map((s) => ({ label: seatName(fgdSeats, s), counts: countBy(positions.filter((p) => p.seatIndex === s), (p) => p.position) })), { percent: true }));
    chart("Proporsi non-terima kursi × tahap", heatmap("Proporsi posisi non-terima (%) — kursi × tahap", seats.map((s) => seatName(fgdSeats, s)), stageTitles, seats.map((s) => stageTitles.map((t) => {
      const ps = positions.filter((p) => p.seatIndex === s && p.stage === t);
      return ps.length ? Math.round((ps.filter((p) => p.position !== "TERIMA").length / ps.length) * 100) : null;
    })), { min: 0, max: 100, rowTitle: "kursi", colTitle: "tahap agenda" }));
    chart("Usulan notulis per jenis tindakan", columns("Usulan notulis per jenis tindakan", ACTIONS, [{ name: "usulan", values: ACTIONS.map((a) => suggestions.filter((x) => x.action === a).length) }], { yLabel: "jumlah usulan" }));
    chart("Keputusan adopsi usulan", donut("Keputusan adopsi usulan notulis", [{ label: "Diadopsi", value: suggestions.filter((x) => x.adopted === true).length }, { label: "Tidak diadopsi (dengan alasan)", value: suggestions.filter((x) => x.adopted === false).length }, { label: "Belum diputuskan", value: suggestions.filter((x) => x.adopted === null).length }], { centerLabel: "usulan" }));
  }
  for (const [si, s] of sessions.entries()) {
    h(`Sesi FGD ${si + 1} — ${s.config.name} (${s.mode}, seed ${s.seed}, ${s.status})`, 2);
    table([{ header: "Kursi", weight: 0.6 }, { header: "Label", weight: 1 }, { header: "Kode", weight: 0.6 }, { header: "Bidang", weight: 1.4 }, { header: "Model", weight: 2 }], s.config.seats.map((x) => [x.seatIndex, x.label, x.expert?.panelCode ?? null, x.field, `${x.modelProfile.label} (${x.modelProfile.modelId})`]));
    const items = s.stages.flatMap((st) => st.items.map((i) => ({ st, i })));
    h("Keputusan per komponen", 3);
    table([{ header: "Tahap", weight: 1.4 }, { header: "Komponen", weight: 2.4 }, { header: "Keputusan", weight: 1.4 }, { header: "Aturan", weight: 1.1 }, { header: "Rekap", weight: 1.6 }, { header: "Catatan", weight: 1.6 }, { header: "Resolusi peneliti", weight: 2.2 }], items.map(({ st, i }) => [st.title, i.title, i.decision?.decision ?? i.status, i.decision?.ruleFired ?? null, i.decision ? tallyText(i.decision.tally) : null, i.decision?.note ?? null, i.decision?.resolutionNote ?? null]), 6.2);
    h("Posisi kursi", 3);
    table([{ header: "Komponen", weight: 2.2 }, { header: "Kursi", weight: 1.1 }, { header: "Posisi", weight: 1.4 }, { header: "Tindakan", weight: 1 }, { header: "Alasan", weight: 5 }], items.flatMap(({ i }) => i.positions.map((p) => [i.title, seatName(s.config.seats, p.seatIndex), p.position, p.proposedAction, p.reason])), 6.2);
    h("Usulan notulis dan keputusan adopsi", 3);
    table([{ header: "Komponen", weight: 2 }, { header: "Kursi", weight: 1.1 }, { header: "Tindakan", weight: 1 }, { header: "Kutipan", weight: 3 }, { header: "Alasan", weight: 2 }, { header: "Diadopsi", weight: 0.7 }, { header: "Alasan tidak", weight: 1.6 }, { header: "Diterapkan", weight: 1.2 }], items.flatMap(({ i }) => i.suggestions.map((x) => [i.title, seatName(s.config.seats, x.seatIndex), x.action, x.quote, x.rationale, x.adopted, x.notAdoptedReason, dt(x.appliedAt)])), 6.2);
    h("Transkrip lengkap", 3);
    table([{ header: "Komponen", weight: 1.6 }, { header: "#", weight: 0.35, align: "right" }, { header: "Pembicara", weight: 1.2 }, { header: "Jenis", weight: 0.9 }, { header: "Ujaran", weight: 7 }, { header: "Model · prompt", weight: 1.8 }], items.flatMap(({ i }) => i.utterances.map((u) => [i.title, u.turn, u.seatIndex ? seatName(s.config.seats, u.seatIndex, u.speaker) : u.speaker, u.kind, u.content, `${u.modelId ?? ""} · ${u.promptId ?? ""}@${u.promptVersion ?? ""} · ${u.tokensIn ?? "?"}/${u.tokensOut ?? "?"}`])), 6);
  }

  // 4. Derived version.
  h(`4. ${REPORT_CHAPTERS[3].title}`, 1);
  narrative("derive");
  const adopted = d.fgd.flatMap((s) => s.stages.flatMap((st) => st.items.flatMap((i) => i.suggestions))).filter((x) => x.adopted === true);
  if (adopted.length) chart("Tugas revisi dari usulan yang diadopsi", donut("Tugas revisi dari usulan FGD yang diadopsi", [{ label: "Diterapkan di versi turunan", value: adopted.filter((x) => x.appliedAt).length }, { label: "Ditunda / belum diterapkan", value: adopted.filter((x) => !x.appliedAt).length }], { centerLabel: "tugas" }));
  for (let k = 1; k < d.lineage.length; k++) {
    const parent = d.lineage[k - 1];
    const v = d.lineage[k];
    h(`${parent.label} → ${v.label}`, 2);
    const log = d.changeLog.filter((c) => c.versionId === v.id);
    const kinds = [...new Set(log.map((c) => c.action))];
    const targets = [...new Set(log.map((c) => c.targetType))];
    if (log.length) chart(`Perubahan ${v.label} per target dan tindakan`, stackedBars(`Change log ${v.label}: jenis target × tindakan`, kinds, targets.map((t) => ({ label: t, counts: countBy(log.filter((c) => c.targetType === t), (c) => c.action) }))));
    const diff = diffVersions(toDiff(indicatorsOf(d, parent.id)), toDiff(indicatorsOf(d, v.id)));
    table([{ header: "Kode", weight: 0.8 }, { header: "Jenis perubahan", weight: 1.4 }, { header: "Nama", weight: 2.4 }, { header: "Rincian", weight: 5 }], diff.map((x) => [x.code, x.kind, x.name, x.detail]));
    h(`Change log ${v.label}`, 3);
    table([{ header: "Waktu", weight: 1.2 }, { header: "Target", weight: 1.4 }, { header: "Tindakan", weight: 1 }, { header: "Alasan", weight: 2.8 }, { header: "Sumber keputusan", weight: 2.2 }, { header: "Dampak / nilai lama", weight: 3.2 }], log.map((c) => [dt(c.createdAt), `${c.targetType} ${c.targetCode}`, c.action, c.reason, c.decisionSource, c.impactNote]), 6.2);
  }

  // 5. G3.
  h(`5. ${REPORT_CHAPTERS[4].title}`, 1);
  narrative("g3");
  if (delphiVersion) gateBlock(delphiVersion.id, "G3_DELPHI");
  for (const r of d.delphi.filter((x) => x.versionId === delphiVersion?.id)) {
    h(`Ronde ${r.roundNumber} (${r.dataOrigin}, ${r.config.name}, S-CVI/Ave ronde ${n3(r.scaleSCviAve)}, final ${dt(r.finalizedAt) ?? "—"})`, 2);
    table([{ header: "Kursi", weight: 0.6 }, { header: "Label", weight: 1 }, { header: "Kode", weight: 0.6 }, { header: "Bidang", weight: 1.4 }, { header: "Baru", weight: 0.6 }, { header: "Model", weight: 2 }], r.config.seats.map((x) => [x.seatIndex, x.label, x.expert?.panelCode ?? null, x.field, x.isNewMember, x.modelProfile.label]));
    const results = [...r.results].sort((a, b) => byCode(code(a.indicatorId), code(b.indicatorId)));
    const seatIdx = Array.from({ length: r.panelSize }, (_, i) => i + 1);
    chart(`I-CVI per butir R${r.roundNumber}`, barChart(`I-CVI per butir — ronde ${r.roundNumber}`, results.map((x) => ({ label: code(x.indicatorId), value: x.iCvi, note: `n=${x.validRaters}` })), { max: 1, reference: { value: 0.78, label: "0,78 (I_CVI_MIN)" }, digits: 3 }));
    chart(`Keputusan butir R${r.roundNumber}`, donut(`Keputusan butir — ronde ${r.roundNumber} (Tabel 3.6)`, ["PERTAHANKAN", "REVISI_NILAI_ULANG", "HAPUS_DARI_INTI", "TIDAK_SELESAI"].map((k) => ({ label: k, value: results.filter((x) => x.decision === k).length })), { centerLabel: "butir" }));
    chart(`Skor relevansi kursi × butir R${r.roundNumber}`, heatmap(`Skor relevansi (1–4) — kursi × butir, ronde ${r.roundNumber}`, seatIdx.map((s) => seatName(r.config.seats, s)), results.map((x) => code(x.indicatorId)), seatIdx.map((s) => results.map((x) => r.ratings.find((y) => y.indicatorId === x.indicatorId && y.seatIndex === s)?.relevance ?? null)), { min: 1, max: 4, rowTitle: "kursi", colTitle: "butir" }));
    chart(`Sebaran skor dan penanda kejelasan R${r.roundNumber}`, columns(`Penanda kejelasan per kursi — ronde ${r.roundNumber}`, seatIdx.map((s) => r.config.seats.find((x) => x.seatIndex === s)?.expert?.panelCode ?? `K${s}`), [{ name: "penanda kejelasan", values: seatIdx.map((s) => r.ratings.filter((y) => y.seatIndex === s && y.clarityFlag).length) }], { yLabel: "jumlah butir ditandai" }));
    table([{ header: "Kode", weight: 0.7 }, { header: "I-CVI", weight: 0.6, align: "right" }, { header: "n", weight: 0.35, align: "right" }, { header: "Median", weight: 0.6, align: "right" }, { header: "IQR", weight: 0.5, align: "right" }, { header: "Keputusan", weight: 1.5 }, { header: "Penanda", weight: 0.6, align: "right" }, { header: "Kritis", weight: 0.6 }, { header: "Konflik", weight: 0.6 }, { header: "Alasan", weight: 2.5 }, { header: "Catatan peneliti", weight: 2 }], results.map((x) => [code(x.indicatorId), n3(x.iCvi), x.validRaters, x.median, x.iqr, x.decision, x.clarityFlags, x.clarityCritical, x.constructConflict, x.reason, x.researcherNote]), 6.2);
    h(`Rating per kursi — ronde ${r.roundNumber}`, 3);
    table([{ header: "Kode", weight: 0.8 }, ...seatIdx.map((i) => ({ header: `K${i}${r.config.seats.find((x) => x.seatIndex === i)?.expert ? ` ${r.config.seats.find((x) => x.seatIndex === i)!.expert!.panelCode}` : ""}`, weight: 0.6, align: "right" as const }))], results.map((x) => [code(x.indicatorId), ...seatIdx.map((s) => {
      const rt = r.ratings.find((y) => y.indicatorId === x.indicatorId && y.seatIndex === s);
      return rt ? `${rt.relevance ?? "—"}${rt.clarityFlag ? "•" : ""}` : "—";
    })]));
    note("• = kursi menandai isu kejelasan; — = tidak menilai (tidak diimputasi).");
    h(`Alasan dan catatan kejelasan kursi — ronde ${r.roundNumber}`, 3);
    table([{ header: "Kode", weight: 0.7 }, { header: "Kursi", weight: 1.1 }, { header: "Skor", weight: 0.5, align: "right" }, { header: "Alasan", weight: 4 }, { header: "Catatan kejelasan", weight: 3 }, { header: "Galat", weight: 1.5 }], [...r.ratings].sort((a, b) => byCode(code(a.indicatorId), code(b.indicatorId)) || a.seatIndex - b.seatIndex).map((x) => [code(x.indicatorId), seatName(r.config.seats, x.seatIndex), x.relevance, x.reason, x.clarityNote, x.error]), 6);
  }

  // 6. G4.
  h(`6. ${REPORT_CHAPTERS[5].title}`, 1);
  narrative("g4");
  if (delphiVersion) gateBlock(delphiVersion.id, "G4_CONTENT_LOCK");
  if (locked) {
    gateBlock(locked.id, "G4_CONTENT_LOCK");
    if (delphiVersion) {
      const before = indicatorsOf(d, delphiVersion.id).filter((x) => !x.i.deletedAt);
      const after = indicatorsOf(d, locked.id).filter((x) => !x.i.deletedAt);
      const count = (vId: string) => {
        const doms = d.domains.filter((x) => x.versionId === vId);
        return [doms.length, doms.reduce((n, x) => n + x.aspects.length, 0), indicatorsOf(d, vId).filter((x) => !x.i.deletedAt).length];
      };
      chart("Butir ikut dan dikeluarkan saat content lock", donut("Butir saat content lock", [{ label: `Ikut ke ${locked.label}`, value: after.length }, { label: "Dikeluarkan dari inti", value: Math.max(0, before.length - after.length) }], { centerLabel: `butir ${delphiVersion.label}` }));
      chart("Struktur sebelum dan sesudah lock", columns("Struktur sebelum dan sesudah content lock", ["Domain", "Aspek", "Indikator"], [{ name: delphiVersion.label, values: count(delphiVersion.id) }, { name: locked.label, values: count(locked.id) }]));
    }
    artifactFull(locked.id, `${locked.label} (terkunci)`);
  }

  // 7. G5.
  h(`7. ${REPORT_CHAPTERS[6].title}`, 1);
  narrative("g5");
  if (locked) gateBlock(locked.id, "G5_AHP");
  for (const s of d.ahp.filter((x) => x.versionId === locked?.id)) {
    h(`Sesi AHP — ${s.config.name} (${s.status}, seed ${s.seed}, agregasi ${s.aggregation})`, 2);
    const groups = [...new Set(s.weights.map((x) => `${x.level}|${x.parentCode ?? ""}`))].sort((a, b) => (a.startsWith("DOMAIN") ? -1 : b.startsWith("DOMAIN") ? 1 : byCode(a, b)));
    for (const g of groups) {
      const [level, parent] = g.split("|");
      const ws = s.weights.filter((x) => x.level === level && (x.parentCode ?? "") === parent);
      const targets = [...new Set(ws.map((x) => x.targetCode))];
      const t = level === "DOMAIN" ? "Bobot antar-domain" : `Bobot antar-aspek dalam ${parent}`;
      chart(t, dotRange(t, targets.map((tc) => ({ label: tc, aggregate: ws.find((x) => x.targetCode === tc && x.seatIndex === null)?.weight ?? null, individual: ws.filter((x) => x.targetCode === tc && x.seatIndex !== null).map((x) => x.weight) }))));
    }
    const finals = new Map<string, (typeof s.matrices)[number]>();
    for (const m of s.matrices) {
      const key = `${m.parentCode ?? "DOMAIN"}|${m.seatIndex}`;
      if (!finals.has(key) || finals.get(key)!.attempt < m.attempt) finals.set(key, m);
    }
    const gList = [...new Set([...finals.values()].map((m) => m.parentCode ?? "DOMAIN"))].sort((a, b) => (a === "DOMAIN" ? -1 : b === "DOMAIN" ? 1 : byCode(a, b)));
    const sList = [...new Set([...finals.values()].map((m) => m.seatIndex))].sort((a, b) => a - b);
    chart("CR matriks akhir kursi × grup", heatmap("CR matriks akhir — grup × kursi (ambang 0,10)", gList, sList.map((x) => `K${x}`), gList.map((g) => sList.map((x) => finals.get(`${g}|${x}`)?.cr ?? null)), { digits: 3, min: 0, max: Math.max(0.2, ...[...finals.values()].map((m) => m.cr ?? 0)), rowTitle: "grup matriks", colTitle: "kursi" }));
    chart("Status matriks akhir", donut("Status matriks akhir", [...new Set([...finals.values()].map((m) => m.status))].map((st) => ({ label: st, value: [...finals.values()].filter((m) => m.status === st).length })), { centerLabel: "matriks" }));
    const base = Object.fromEntries(s.weights.filter((x) => x.level === "DOMAIN" && x.seatIndex === null).map((x) => [x.targetCode, x.weight]));
    const scen = s.sensitivity.map((x) => (x.result as { weights?: Record<string, number> }).weights ?? {});
    if (Object.keys(base).length && scen.length) {
      chart("Sensitivitas bobot domain", tornado("Sensitivitas bobot domain (±0,05 dan ±0,10)", Object.entries(base).map(([k, b]) => ({ label: k, base: b, low: Math.min(b, ...scen.map((w) => w[k] ?? b)), high: Math.max(b, ...scen.map((w) => w[k] ?? b)) }))));
      chart("Skenario yang mengubah urutan", donut("Skenario sensitivitas yang mengubah urutan domain", [{ label: "Urutan berubah", value: s.sensitivity.filter((x) => x.rankChanged).length }, { label: "Urutan tetap", value: s.sensitivity.filter((x) => !x.rankChanged).length }], { centerLabel: "skenario" }));
    }
    table([{ header: "Grup", weight: 1.2 }, { header: "Elemen", weight: 0.9 }, { header: "Kursi", weight: 0.7 }, { header: "Bobot", weight: 1, align: "right" }], s.weights.map((x) => [`${x.level}${x.parentCode ? `/${x.parentCode}` : ""}`, x.targetCode, x.seatIndex ?? "agregat", x.weight.toFixed(6)]));
    h("Matriks per kursi (semua percobaan)", 3);
    table([{ header: "Grup", weight: 1 }, { header: "Kursi", weight: 0.5, align: "right" }, { header: "Perc.", weight: 0.5, align: "right" }, { header: "n", weight: 0.35, align: "right" }, { header: "lambda max", weight: 0.9, align: "right" }, { header: "CI", weight: 0.8, align: "right" }, { header: "CR", weight: 0.8, align: "right" }, { header: "Status", weight: 1.4 }, { header: "Sel matriks", weight: 5 }], s.matrices.map((m) => [m.parentCode ?? "DOMAIN", m.seatIndex, m.attempt, m.size, m.lambdaMax?.toFixed(4), m.ci?.toFixed(4), m.cr?.toFixed(4), m.status, m.cells ? (m.cells as number[][]).map((row) => row.map((v) => (v >= 1 ? v.toFixed(2) : `1/${(1 / v).toFixed(2)}`)).join(" ")).join(" | ") : null]), 5.8);
    h("Penilaian pasangan dan alasannya", 3);
    table([{ header: "Grup", weight: 0.9 }, { header: "Kursi", weight: 0.5, align: "right" }, { header: "Perc.", weight: 0.5, align: "right" }, { header: "Pasangan", weight: 1.2 }, { header: "Pilihan", weight: 0.8 }, { header: "Intensitas", weight: 0.7, align: "right" }, { header: "Alasan", weight: 5 }], s.matrices.flatMap((m) => ((m.pairs as { i: number; j: number; preferred: string; intensity: number; reason: string; attempt: number }[] | null) ?? []).filter((p) => p.attempt === m.attempt).map((p) => [m.parentCode ?? "DOMAIN", m.seatIndex, m.attempt, `${m.elements[p.i]}–${m.elements[p.j]}`, p.preferred, p.intensity, p.reason])), 6);
    h("Sensitivitas", 3);
    table([{ header: "Skenario", weight: 1 }, { header: "Urutan awal", weight: 3 }, { header: "Urutan setelah", weight: 3 }, { header: "Berubah", weight: 0.7 }], s.sensitivity.map((x) => {
      const r = x.result as { rankBefore: string[]; rankAfter: string[] };
      return [x.name, r.rankBefore.join(" > "), r.rankAfter.join(" > "), x.rankChanged];
    }));
  }

  // 8. G6.
  h(`8. ${REPORT_CHAPTERS[7].title}`, 1);
  narrative("g6");
  if (locked) gateBlock(locked.id, "G6_SCORING");
  h("Profil institusi fiktif", 2);
  table([{ header: "Label", weight: 1.5 }, { header: "Deskripsi", weight: 6 }], d.profiles.map((p) => [p.label, p.description]));
  const scoring = d.assessments.filter((a) => a.versionId === locked?.id && a.purpose === "SCORING");
  type Roll = { domainProfile?: Record<string, number | null>; composite?: number | null; aspectScores?: Record<string, number | null>; missingReport?: { indicatorCode: string; kind: string; blocks: string }[] } | null;
  const done = scoring.filter((a) => a.status === "COMPLETED");
  if (done.length) {
    h("Ringkasan grafis penskoran", 2);
    const domainCodes = [...new Set(done.flatMap((a) => Object.keys((a.rollup as Roll)?.domainProfile ?? {})))].sort(byCode);
    const shortName = (a: (typeof done)[number]) => a.institutionLabel.replace("[FIKTIF] ", "").split(" — ")[0];
    chart("Profil domain per asesmen", groupedBars("Profil domain per asesmen (skala level 1–5; kosong = ditahan)", domainCodes, done.map((a) => ({ name: shortName(a), values: domainCodes.map((c) => (a.rollup as Roll)?.domainProfile?.[c] ?? null) })), { max: 5 }));
    chart("Jenis data hilang", donut("Jenis data hilang (semua asesmen penskoran selesai)", ["NONE", "MISSING_ADMINISTRATIF", "TIDAK_ADA_KAPABILITAS", "TIDAK_BERLAKU"].map((k) => ({ label: k === "NONE" ? "Data tersedia" : k, value: done.flatMap((a) => a.scores).filter((s) => s.missingKind === k).length })).filter((x) => x.value > 0), { centerLabel: "skor" }));
    chart("Sebaran level indikator", columns("Sebaran level indikator per asesmen", ["1", "2", "3", "4", "5"], done.map((a) => ({ name: shortName(a), values: [1, 2, 3, 4, 5].map((l) => a.scores.filter((s) => s.level === l).length) })), { yLabel: "jumlah indikator" }));
  }
  for (const a of scoring) {
    h(`Asesmen — ${a.institutionLabel} (${a.assessorRef}, ${a.status})`, 2);
    const roll = a.rollup as Roll;
    if (roll?.domainProfile) {
      chart(`Profil domain — ${a.institutionLabel}`, barChart(`Profil domain — ${a.institutionLabel}`, Object.entries(roll.domainProfile).map(([k, v]) => ({ label: k, value: v, note: v === null ? "ditahan — missing administratif" : undefined })), { max: 5, digits: 2 }));
      kv([["Skor komposit (ringkasan sekunder, PROVISIONAL)", roll.composite === null || roll.composite === undefined ? "ditahan — missing administratif" : roll.composite.toFixed(4)], ["Laporan data hilang", (roll.missingReport ?? []).map((m) => `${m.indicatorCode} ${m.kind} → ${m.blocks}`).join("; ") || "—"]]);
      table([{ header: "Aspek", weight: 1 }, { header: "Skor", weight: 1, align: "right" }], Object.entries(roll.aspectScores ?? {}).map(([k, v]) => [k, v === null ? "ditahan" : v.toFixed(4)]));
    }
    table([{ header: "Kode", weight: 0.7 }, { header: "Level", weight: 0.5, align: "right" }, { header: "Plafon", weight: 0.5, align: "right" }, { header: "Data hilang", weight: 1.4 }, { header: "Bukti terpenuhi", weight: 0.6, align: "right" }, { header: "Locator bukti", weight: 3 }, { header: "Alasan", weight: 3 }], [...a.scores].sort((x, y) => byCode(code(x.indicatorId), code(y.indicatorId))).map((s) => [code(s.indicatorId), s.level, s.levelCap, s.missingKind, s.satisfiedEvidence.length, s.evidenceLocator, s.rationale]), 6.2);
  }
  h("Rekalkulasi independen", 2);
  table([{ header: "Waktu", weight: 1.2 }, { header: "SHA-256 ekspor", weight: 4 }, { header: "Identik", weight: 0.7 }, { header: "Perbedaan", weight: 0.7, align: "right" }], d.recompute.filter((c) => c.versionId === locked?.id).map((c) => [dt(c.createdAt), c.exportSha256, c.ok, c.diffCount]));

  // 9. G7.
  h(`9. ${REPORT_CHAPTERS[8].title}`, 1);
  narrative("g7");
  if (locked) gateBlock(locked.id, "G7_PILOT");
  table([{ header: "Deklarasi", weight: 1 }, { header: "Referensi", weight: 2 }, { header: "Tanggal", weight: 1 }, { header: "Catatan", weight: 4 }, { header: "Dicatat", weight: 1.3 }], d.declarations.filter((x) => x.versionId === locked?.id).map((x) => [x.kind, x.reference, x.date, x.note, dt(x.createdAt)]));
  const domainOf = new Map(locked ? indicatorsOf(d, locked.id).map(({ dom, i }) => [i.id, dom.code]) : []);
  for (const run of d.pilots.filter((p) => p.versionId === locked?.id)) {
    h(`Run pilot ${dt(run.createdAt)} (seed ${run.seed})`, 2);
    for (const pid of run.profileIds) {
      const a = d.assessments.find((x) => x.pilotRunId === run.id && x.profileId === pid && x.pilotRole === "A");
      const b = d.assessments.find((x) => x.pilotRunId === run.id && x.profileId === pid && x.pilotRole === "B");
      if (!a || !b) continue;
      const m = Array.from({ length: 5 }, () => new Array<number>(5).fill(0));
      const rows: Cell[][] = [];
      const pairs: { domain: string; diff: number | null }[] = [];
      for (const sa of [...a.scores].sort((x, y) => byCode(code(x.indicatorId), code(y.indicatorId)))) {
        const sb = b.scores.find((x) => x.indicatorId === sa.indicatorId);
        const usable = sa.level && sb?.level && sa.missingKind !== "MISSING_ADMINISTRATIF" && sb.missingKind !== "MISSING_ADMINISTRATIF";
        if (usable) m[sa.level! - 1][sb!.level! - 1]++;
        const diff = usable ? Math.abs(sa.level! - sb!.level!) : null;
        pairs.push({ domain: domainOf.get(sa.indicatorId) ?? "?", diff });
        rows.push([code(sa.indicatorId), sa.level, sb?.level ?? null, sa.missingKind, sb?.missingKind ?? null, diff]);
      }
      h(`${a.institutionLabel}: A ${a.assessorRef} · B ${b.assessorRef}`, 3);
      chart("Matriks level A × B", heatmap("Matriks level asesor A × B", ["1", "2", "3", "4", "5"].map((l) => `A=${l}`), ["1", "2", "3", "4", "5"].map((l) => `B=${l}`), m, { rowTitle: "asesor A", colTitle: "asesor B", frameDiagonal: true }));
      chart("Selisih level A dan B", donut("Selisih level asesor A dan B per indikator", [{ label: "Sama persis", value: pairs.filter((p) => p.diff === 0).length }, { label: "Selisih 1 level", value: pairs.filter((p) => p.diff === 1).length }, { label: "Selisih ≥ 2 level", value: pairs.filter((p) => p.diff !== null && p.diff >= 2).length }, { label: "Dikeluarkan (missing administratif)", value: pairs.filter((p) => p.diff === null).length }], { centerLabel: "indikator" }));
      const doms = [...new Set(pairs.map((p) => p.domain))].sort(byCode);
      chart("Kesepakatan per domain", barChart("Kesepakatan level persis per domain", doms.map((dc) => {
        const ps = pairs.filter((p) => p.domain === dc && p.diff !== null);
        return { label: dc, value: ps.length ? ps.filter((p) => p.diff === 0).length / ps.length : null, note: ps.length ? `(${ps.length} butir)` : undefined };
      }), { max: 1, digits: 2, reference: { value: 0.8, label: "0,80 (PILOT_AGREEMENT_MIN)" } }));
      table([{ header: "Kode", weight: 0.8 }, { header: "Level A", weight: 0.6, align: "right" }, { header: "Level B", weight: 0.6, align: "right" }, { header: "Data hilang A", weight: 1.4 }, { header: "Data hilang B", weight: 1.4 }, { header: "|Selisih|", weight: 0.6, align: "right" }], rows);
    }
  }

  // 10. Closing + ledger appendix.
  h(`10. ${REPORT_CHAPTERS[9].title}`, 1);
  narrative("closing");
  if (d.calls.length) {
    h("Ringkasan grafis biaya dan panggilan model", 2);
    const cost = (xs: typeof d.calls) => xs.reduce((n, c) => n + (c.costUsd === null ? 0 : Number(c.costUsd)), 0);
    const kinds = [...new Set(d.calls.map((c) => c.kind))];
    chart("Biaya per tahap", donut("Biaya model per tahap (USD)", kinds.map((k) => ({ label: k, value: Number(cost(d.calls.filter((c) => c.kind === k)).toFixed(2)) })).sort((a, b) => b.value - a.value), { digits: 2, centerLabel: "USD" }));
    const models = [...new Set(d.calls.map((c) => c.modelId))];
    chart("Biaya per model", barChart("Biaya per model (USD)", models.map((m) => ({ label: m, value: cost(d.calls.filter((c) => c.modelId === m)), note: `(${d.calls.filter((c) => c.modelId === m).length} panggilan)` })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)), { digits: 2 }));
    const hours = [...new Set(d.calls.map((c) => new Date(c.createdAt).toISOString().slice(0, 13)))].sort();
    let running = 0;
    const cumulative = hours.map((hr) => (running += d.calls.filter((c) => new Date(c.createdAt).toISOString().slice(0, 13) === hr).length));
    let spent = 0;
    const cumCost = hours.map((hr) => (spent += cost(d.calls.filter((c) => new Date(c.createdAt).toISOString().slice(0, 13) === hr))));
    chart("Kumulatif panggilan model", lineChart("Kumulatif panggilan model per jam (UTC)", hours.map((hr) => `${hr.slice(11, 13)}:00`), [{ name: "panggilan", values: cumulative }], { yLabel: "panggilan" }));
    chart("Kumulatif biaya", lineChart("Kumulatif biaya per jam (UTC, USD)", hours.map((hr) => `${hr.slice(11, 13)}:00`), [{ name: "USD", values: cumCost }], { digits: 2, yLabel: "USD" }));
    chart("Panggilan berhasil dan gagal", donut("Panggilan model berhasil dan gagal", [{ label: "Berhasil", value: d.calls.filter((c) => c.ok).length }, { label: "Gagal (skema, jaringan, anggaran)", value: d.calls.filter((c) => !c.ok).length }], { centerLabel: "panggilan" }));
  }
  h("Lampiran — log seluruh panggilan model", 2);
  table([{ header: "Waktu", weight: 1.2 }, { header: "Jenis", weight: 0.8 }, { header: "Prompt", weight: 1.8 }, { header: "Model", weight: 1.8 }, { header: "Token in/out", weight: 0.9, align: "right" }, { header: "ms", weight: 0.5, align: "right" }, { header: "USD", weight: 0.7, align: "right" }, { header: "OK", weight: 0.4 }, { header: "Hash prompt", weight: 1.6 }], d.calls.map((c) => [dt(c.createdAt), c.kind, `${c.promptId}@${c.promptVersion}`, c.modelId, `${c.tokensIn ?? "?"}/${c.tokensOut ?? "?"}`, c.latencyMs, c.costUsd === null ? "?" : Number(c.costUsd).toFixed(6), c.ok, c.promptHash.slice(0, 16)]), 5.8);

  return out;
}

export const reportTitle = (d: ReportData) => `Laporan lengkap G1–G7 — ${d.lineage[d.lineage.length - 1].label}`;
