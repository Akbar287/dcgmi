import type { ReportData } from "@/lib/db/repository/report-data";

import type { ChapterKey } from "./chapters";

// Structured facts per chapter for the narrator (researcher decision 29 Sep
// 2026: numbers, tables, and transcript quotes; never personas, CVs, or
// panelist identities). The narrator may only use what is here.

const MAX_CHARS = 60_000;
const clip = (s: string | null | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : null);
const count = <T,>(xs: T[], key: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {});

function roles(d: ReportData) {
  const fgdVersion = [...d.lineage].reverse().find((v) => d.fgd.some((s) => s.versionId === v.id));
  const delphiVersion = [...d.lineage].reverse().find((v) => d.delphi.some((r) => r.versionId === v.id));
  const locked = [...d.lineage].reverse().find((v) => v.status === "CONTENT_LOCKED");
  return { fgdVersion, delphiVersion, locked };
}

function gateTable(d: ReportData) {
  return d.lineage.map((v) => ({
    version: v.label,
    status: v.status,
    gates: Object.fromEntries(Object.entries(d.evaluations[v.id]).map(([g, e]) => [g, { record: d.gates.find((x) => x.versionId === v.id && x.gate === g)?.status ?? "—", met: e.passed, unmet: e.unmet.slice(0, 8) }])),
  }));
}

export function chapterFacts(d: ReportData, key: ChapterKey): unknown {
  const r = roles(d);
  const code = (id: string) => d.indicatorCode.get(id) ?? id;
  switch (key) {
    case "intro":
      return {
        catatan: "Seluruh keluaran berasal dari dry-run simulasi (dataOrigin SIMULATED) untuk menguji instrumen; bukan hasil penelitian.",
        garisVersi: d.lineage.map((v) => ({ label: v.label, status: v.status, dibuat: v.createdAt.toISOString().slice(0, 10), catatan: v.note })),
        gate: gateTable(d),
        jumlah: { sesiFgd: d.fgd.length, rondeDelphi: d.delphi.length, sesiAhp: d.ahp.length, asesmen: d.assessments.length, panggilanModel: d.calls.length },
      };
    case "g1":
      return d.lineage.map((v) => {
        const dom = d.domains.filter((x) => x.versionId === v.id);
        const inds = dom.flatMap((x) => x.aspects.flatMap((a) => a.indicators.filter((i) => !i.deletedAt)));
        return {
          versi: v.label,
          struktur: `${dom.length} domain, ${dom.reduce((n, x) => n + x.aspects.length, 0)} aspek, ${inds.length} indikator`,
          indikatorPerDomain: Object.fromEntries(dom.map((x) => [x.code, x.aspects.reduce((n, a) => n + a.indicators.filter((i) => !i.deletedAt).length, 0)])),
          rubrikLengkap: inds.filter((i) => new Set(i.rubricLevels.map((l) => l.level)).size === 5).length,
          denganBuktiWajib: inds.filter((i) => i.evidence.some((e) => e.mandatory)).length,
          controlledException: inds.filter((i) => i.isControlledException).map((i) => i.code),
          g1: d.evaluations[v.id].G1_BASELINE,
          catatanGate: d.gates.find((g) => g.versionId === v.id && g.gate === "G1_BASELINE")?.note ?? null,
        };
      });
    case "g2": {
      const sessions = d.fgd.filter((s) => s.versionId === r.fgdVersion?.id);
      const items = sessions.flatMap((s) => s.stages.flatMap((st) => st.items.map((i) => ({ ...i, stageTitle: st.title }))));
      const notable = items.filter((i) => i.decision && i.decision.decision !== "TERIMA").slice(0, 40);
      return {
        versi: r.fgdVersion?.label,
        sesi: sessions.map((s) => ({ panel: s.config.name, mode: s.mode, status: s.status, seed: s.seed, komponen: s.stages.reduce((n, st) => n + st.items.length, 0) })),
        keputusanPerTahap: Object.fromEntries([...new Set(items.map((i) => i.stageTitle))].map((st) => [st, count(items.filter((i) => i.stageTitle === st && i.decision), (i) => i.decision!.decision)])),
        keputusan: count(items.filter((i) => i.decision), (i) => i.decision!.decision),
        usulan: { total: items.reduce((n, i) => n + i.suggestions.length, 0), diadopsi: items.reduce((n, i) => n + i.suggestions.filter((x) => x.adopted === true).length, 0), tidakDiadopsi: items.reduce((n, i) => n + i.suggestions.filter((x) => x.adopted === false).length, 0) },
        pembahasanKhusus: items.filter((i) => i.decision?.decision === "PEMBAHASAN_KHUSUS").map((i) => ({ komponen: i.title, tally: i.decision!.tally, resolusi: clip(i.decision!.resolutionNote, 300) })),
        kutipan: notable.map((i) => ({
          komponen: i.title,
          tahap: i.stageTitle,
          keputusan: i.decision!.decision,
          argumen: i.utterances.filter((u) => u.kind === "ARGUE").slice(0, 3).map((u) => ({ kursi: u.speaker, isi: clip(u.content, 350) })),
          usulan: i.suggestions.slice(0, 3).map((x) => ({ kursi: x.seatIndex, tindakan: x.action, kutipan: clip(x.quote, 200), diadopsi: x.adopted })),
        })),
        g2: r.fgdVersion ? d.evaluations[r.fgdVersion.id].G2_FGD : null,
      };
    }
    case "derive": {
      const child = r.delphiVersion ?? d.lineage.find((v) => v.parentId === r.fgdVersion?.id);
      const log = d.changeLog.filter((c) => c.versionId === child?.id);
      return { versiTurunan: child?.label, induk: r.fgdVersion?.label, perubahan: count(log, (c) => c.action), entri: log.slice(0, 80).map((c) => ({ target: `${c.targetType} ${c.targetCode}`, tindakan: c.action, alasan: clip(c.reason, 200), sumber: clip(c.decisionSource, 120) })) };
    }
    case "g3": {
      const rounds = d.delphi.filter((x) => x.versionId === r.delphiVersion?.id);
      return {
        versi: r.delphiVersion?.label,
        ronde: rounds.map((x) => ({
          ronde: x.roundNumber,
          origin: x.dataOrigin,
          butir: x.scopeCodes.length,
          sCviAveRonde: x.scaleSCviAve,
          keputusan: count(x.results, (res) => res.decision),
          belumPertahankan: x.results.filter((res) => res.decision !== "PERTAHANKAN").map((res) => ({ kode: code(res.indicatorId), iCvi: res.iCvi, median: res.median, iqr: res.iqr, keputusan: res.decision, penandaKejelasan: res.clarityFlags, kritis: res.clarityCritical, catatan: clip(res.researcherNote, 200) })),
          catatanKejelasan: x.ratings.filter((t) => t.clarityNote).slice(0, 20).map((t) => ({ kode: code(t.indicatorId), kursi: t.seatIndex, catatan: clip(t.clarityNote, 200) })),
        })),
        g3: r.delphiVersion ? d.evaluations[r.delphiVersion.id].G3_DELPHI : null,
      };
    }
    case "g4":
      return { versiTerkunci: r.locked?.label, sumber: r.delphiVersion?.label, dikunci: r.locked?.contentLockedAt?.toISOString() ?? null, dikeluarkan: d.changeLog.filter((c) => c.versionId === r.locked?.id && c.action === "HAPUS").map((c) => ({ kode: c.targetCode, alasan: c.reason })), g4: r.delphiVersion ? d.evaluations[r.delphiVersion.id].G4_CONTENT_LOCK : null };
    case "g5": {
      const s = d.ahp.filter((x) => x.versionId === r.locked?.id);
      return s.map((x) => ({
        panel: x.config.name,
        status: x.status,
        matriks: count(x.matrices.filter((m) => m.attempt === Math.max(...x.matrices.filter((y) => y.seatIndex === m.seatIndex && y.level === m.level && y.parentCode === m.parentCode).map((y) => y.attempt))), (m) => m.status),
        dikembalikan: x.matrices.filter((m) => m.attempt > 0).map((m) => ({ kursi: m.seatIndex, grup: m.parentCode ?? "DOMAIN", percobaan: m.attempt, cr: m.cr })),
        bobotDomainAgregat: Object.fromEntries(x.weights.filter((w) => w.level === "DOMAIN" && w.seatIndex === null).map((w) => [w.targetCode, Number(w.weight.toFixed(4))])),
        bobotAspekAgregat: x.weights.filter((w) => w.level === "ASPECT" && w.seatIndex === null).map((w) => ({ domain: w.parentCode, aspek: w.targetCode, bobot: Number(w.weight.toFixed(4)) })),
        sensitivitasUrutanBerubah: `${x.sensitivity.filter((y) => y.rankChanged).length} dari ${x.sensitivity.length}`,
        alasanPasangan: x.matrices.flatMap((m) => ((m.pairs as { reason?: string }[] | null) ?? []).slice(0, 1).map((p) => ({ kursi: m.seatIndex, alasan: clip(p.reason, 160) }))).slice(0, 12),
        g5: r.locked ? d.evaluations[r.locked.id].G5_AHP : null,
      }));
    }
    case "g6":
      return {
        asesmen: d.assessments.filter((a) => a.versionId === r.locked?.id && a.purpose === "SCORING").map((a) => {
          const roll = a.rollup as { domainProfile?: Record<string, number | null>; composite?: number | null; missingReport?: unknown[] } | null;
          return { institusi: a.institutionLabel, asesor: a.assessorRef, profilDomain: roll?.domainProfile, komposit: roll?.composite ?? null, laporanDataHilang: roll?.missingReport ?? [], jenisDataHilang: count(a.scores, (s) => s.missingKind) };
        }),
        rekalkulasi: d.recompute.filter((c) => c.versionId === r.locked?.id).map((c) => ({ ok: c.ok, perbedaan: c.diffCount, sha256: c.exportSha256.slice(0, 16) })),
        g6: r.locked ? d.evaluations[r.locked.id].G6_SCORING : null,
      };
    case "g7": {
      const e = r.locked ? d.evaluations[r.locked.id].G7_PILOT : null;
      return { runPilot: d.pilots.filter((p) => p.versionId === r.locked?.id).length, deklarasi: d.declarations.filter((x) => x.versionId === r.locked?.id).map((x) => ({ jenis: x.kind, referensi: x.reference, tanggal: x.date, catatan: x.note })), g7: e, catatan: "Pilot antar-asesor simulasi: dua asesor AI, profil fiktif; bukan pilot institusional." };
    }
    case "closing":
      return { gate: gateTable(d), panggilanModel: count(d.calls, (c) => c.kind), panggilanGagal: d.calls.filter((c) => !c.ok).length, catatanIntegritas: ["dataOrigin SIMULATED", "watermark di setiap halaman", "tidak ada jalur promosi SIMULATED → REAL", "ambang metodologis terkunci di lib/method/constants.ts"] };
  }
}

/** JSON sent to the model, capped so one chapter never exceeds the budgeted context. */
export function factsText(d: ReportData, key: ChapterKey): string {
  const s = JSON.stringify(chapterFacts(d, key), null, 1);
  return s.length > MAX_CHARS ? `${s.slice(0, MAX_CHARS)}\n…(dipotong untuk narasi; data lengkap tetap tercetak di tabel)` : s;
}
