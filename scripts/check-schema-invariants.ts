/**
 * Pemeriksa invarian skema. Dijalankan di CI sebelum `prisma validate`.
 *
 * Menegakkan aturan yang tidak bisa dinyatakan Prisma sendiri, terutama
 * P1 pada docs/07-RESEARCH-INTEGRITY.md: setiap tabel yang menyimpan
 * penilaian, transkrip, skor, bobot, atau respons WAJIB punya dataOrigin.
 */
import { readFileSync } from 'node:fs';

/** Model yang menyimpan penilaian/keluaran dan karena itu wajib ber-dataOrigin. */
const JUDGEMENT_BEARING = [
  'FgdSession',
  'DelphiRound',
  'DelphiRating',
  'AhpSession',
  'Assessment',
  'FormResponse',
] as const;

/** Model yang sengaja TIDAK ber-dataOrigin karena mewarisi dari induknya. */
const INHERITS_ORIGIN = [
  'FgdStage', 'FgdItem', 'FgdUtterance', 'FgdPosition', 'FgdSuggestion',
  'FgdDecisionRecord', 'DelphiItemResult', 'AhpMatrix', 'AhpWeight',
  'SensitivityScenario', 'IndicatorScore',
] as const;

interface Model { name: string; body: string; fields: string[] }

function parseModels(schema: string): Model[] {
  const out: Model[] = [];
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(schema)) !== null) {
    const body = m[2];
    const fields = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@') && !l.startsWith('///'))
      .map((l) => l.split(/\s+/)[0]);
    out.push({ name: m[1], body, fields });
  }
  return out;
}

function main(): void {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  const models = parseModels(schema);
  const byName = new Map(models.map((m) => [m.name, m]));
  const errors: string[] = [];
  const notes: string[] = [];

  // ── P1: dataOrigin wajib ──────────────────────────────────────────
  for (const name of JUDGEMENT_BEARING) {
    const model = byName.get(name);
    if (!model) { errors.push(`Model ${name} tidak ditemukan`); continue; }
    if (!model.fields.includes('dataOrigin')) {
      errors.push(`P1: model ${name} menyimpan penilaian tetapi tidak punya kolom dataOrigin`);
    }
  }

  // Model baru yang tidak terdaftar di kedua daftar harus diputuskan secara sadar.
  const known = new Set<string>([...JUDGEMENT_BEARING, ...INHERITS_ORIGIN]);
  const suspicious = models.filter(
    (m) => !known.has(m.name) && /rating|score|position|vote|response|weight|matrix|utterance/i.test(m.name),
  );
  for (const m of suspicious) {
    errors.push(`P1: model ${m.name} tampak menyimpan penilaian tetapi belum diputuskan status origin-nya`);
  }

  // ── Kelengkapan relasi dua arah ───────────────────────────────────
  const relationRe = /(\w+)\s+(\w+)(\[\])?\s+@relation/g;
  for (const model of models) {
    let r: RegExpExecArray | null;
    const re = new RegExp(relationRe.source, 'g');
    while ((r = re.exec(model.body)) !== null) {
      const targetModel = byName.get(r[2]);
      if (!targetModel) continue;
      const hasBackRef = new RegExp(`\\b${model.name}(\\[\\])?\\b`).test(targetModel.body);
      if (!hasBackRef) errors.push(`Relasi ${model.name}.${r[1]} -> ${r[2]} tanpa relasi balik`);
    }
  }

  // ── Kolom kritis yang tidak boleh non-nullable ────────────────────
  const relevance = byName.get('DelphiRating')?.body.match(/relevance\s+Int(\??)/);
  if (relevance && relevance[1] !== '?') {
    errors.push('DelphiRating.relevance harus nullable — sel kosong tidak boleh diimputasi (§3.8.3)');
  }
  const level = byName.get('IndicatorScore')?.body.match(/level\s+Int(\??)/);
  if (level && level[1] !== '?') {
    errors.push('IndicatorScore.level harus nullable untuk menampung data hilang (§3.10.1)');
  }

  // ── Kolom yang wajib ada pada model tertentu ──────────────────────
  const required: Record<string, string[]> = {
    DelphiItemResult: ['validRaters'],
    Indicator: ['isControlledException'],
    Provider: ['envKeyName', 'approved'],
    PersonaBrief: ['deidFindings', 'status'],
    FgdSuggestion: ['notAdoptedReason'],
    AhpWeight: ['archived'],
  };
  for (const [name, cols] of Object.entries(required)) {
    const model = byName.get(name);
    if (!model) { errors.push(`Model ${name} tidak ditemukan`); continue; }
    for (const c of cols) {
      if (!model.fields.includes(c)) errors.push(`Model ${name} wajib punya kolom ${c}`);
    }
  }

  // ── Kunci API tidak boleh tersimpan di basis data ─────────────────
  if (/apiKey|secretKey|accessToken/i.test(schema)) {
    errors.push('Skema tampak menyimpan kredensial. Kunci API hanya boleh dari variabel lingkungan.');
  }

  notes.push(`${models.length} model diperiksa`);
  notes.push(`${JUDGEMENT_BEARING.length} model wajib dataOrigin, ${INHERITS_ORIGIN.length} mewarisi dari induk`);

  for (const n of notes) console.log(`  ${n}`);
  if (errors.length > 0) {
    console.error('\nGAGAL:');
    for (const e of errors) console.error(`  x ${e}`);
    process.exit(1);
  }
  console.log('\nOK — seluruh invarian skema terpenuhi.');
}

main();
