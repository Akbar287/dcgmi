// Report charts as SVG (researcher request 29 Sep 2026: bar, heatmap, donut and
// more at every gate). Pure functions: the same SVG is rasterised for the PDF
// and the Word report. Dataviz rules: thin marks, recessive grid, values
// printed on the chart, a legend for ≥ 2 series, categorical hues in a fixed
// order, one blue ramp for magnitude, and every chart followed by its table.

export const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#7a5cd6", "#4bb3c7", "#9a7b4f"];
const RAMP = ["#e8f1fc", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"];
const INK = { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781", grid: "#e1e0d9", baseline: "#c3c2b7", surface: "#ffffff", empty: "#f4f3ef" };
const FONT = "DejaVu Sans";

export const CHART_WIDTH = 900;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Approximate DejaVu Sans advance width per character class (SVG has no text metrics before rendering). */
const textW = (s: string, size: number) =>
  [...s].reduce((n, ch) => n + (/[A-Z_]/.test(ch) ? 0.72 : /[a-z]/.test(ch) ? 0.58 : /[0-9]/.test(ch) ? 0.64 : /\s/.test(ch) ? 0.32 : 0.6), 0) * size;
const fmt = (v: number, digits: number) => v.toFixed(digits).replace(".", ",");
const clipLabel = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function text(x: number, y: number, s: string, o: { size?: number; color?: string; anchor?: "start" | "middle" | "end"; bold?: boolean } = {}) {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${FONT}" font-size="${o.size ?? 13}" fill="${o.color ?? INK.primary}" text-anchor="${o.anchor ?? "start"}"${o.bold ? ' font-weight="bold"' : ""}>${esc(s)}</text>`;
}

function frame(height: number, title: string, body: string, subtitle?: string) {
  const head = text(0, 20, title, { size: 16, bold: true }) + (subtitle ? text(0, 40, subtitle, { size: 12, color: INK.secondary }) : "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${Math.ceil(height)}" viewBox="0 0 ${CHART_WIDTH} ${Math.ceil(height)}"><rect width="100%" height="100%" fill="${INK.surface}"/>${head}${body}</svg>`;
}

function legend(y: number, items: { label: string; color: string }[], x0 = 0) {
  let x = x0;
  let row = y;
  let out = "";
  for (const it of items) {
    const w = 22 + textW(it.label, 12) + 18;
    if (x + w > CHART_WIDTH && x > x0) {
      x = x0;
      row += 20;
    }
    out += `<rect x="${x}" y="${row - 11}" width="12" height="12" rx="2" fill="${it.color}"/>` + text(x + 18, row, it.label, { size: 12 });
    x += w;
  }
  return { svg: out, bottom: row + 10 };
}

function rampColor(v: number, min: number, max: number) {
  const t = max === min ? 1 : (v - min) / (max - min);
  return RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.round(t * (RAMP.length - 1))))];
}

export interface BarRow {
  label: string;
  value: number | null;
  note?: string;
}

/** Horizontal bars with printed values; null = held (dashed outline). */
export function barChart(title: string, rows: BarRow[], o: { max?: number; min?: number; digits?: number; reference?: { value: number; label: string }; subtitle?: string; nullLabel?: string } = {}) {
  const digits = o.digits ?? 2;
  const top = o.subtitle ? 60 : 44;
  const bar = 18;
  const gap = 8;
  const labelW = Math.min(300, Math.max(60, ...rows.map((r) => textW(clipLabel(r.label, 46), 13))) + 12);
  const plotX = labelW;
  // Right margin sized to the longest printed value so nothing is cut off.
  const valueW = Math.max(40, ...rows.map((r) => textW(r.value === null ? (r.note ?? o.nullLabel ?? "ditahan") : `${fmt(r.value, digits)}${r.note ? ` ${r.note}` : ""}`, 12))) + 16;
  const plotW = CHART_WIDTH - labelW - Math.min(valueW, 320);
  const min = o.min ?? 0;
  const max = Math.max(o.max ?? 0, ...rows.map((r) => r.value ?? 0), 1e-9);
  const px = (v: number) => plotX + ((v - min) / (max - min || 1)) * plotW;
  const height = top + rows.length * (bar + gap) + 36;
  let body = "";
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4;
    const x = px(v);
    body += `<line x1="${x}" y1="${top - 6}" x2="${x}" y2="${height - 28}" stroke="${INK.grid}" stroke-width="1"/>` + text(x, height - 10, fmt(v, digits > 2 ? 2 : digits), { size: 11, color: INK.muted, anchor: "middle" });
  }
  rows.forEach((r, i) => {
    const y = top + i * (bar + gap);
    body += text(labelW - 10, y + bar - 4, clipLabel(r.label, 46), { size: 13, anchor: "end" });
    if (r.value === null) {
      body += `<rect x="${plotX}" y="${y}" width="${plotW}" height="${bar}" fill="none" stroke="#d98f1f" stroke-dasharray="4 3"/>` + text(plotX + plotW + 8, y + bar - 4, r.note ?? o.nullLabel ?? "ditahan", { size: 12, color: INK.secondary });
      return;
    }
    body += `<rect x="${plotX}" y="${y}" width="${Math.max(1, px(r.value) - plotX)}" height="${bar}" rx="3" fill="${CATEGORICAL[0]}"/>` + text(px(r.value) + 6, y + bar - 4, `${fmt(r.value, digits)}${r.note ? ` ${r.note}` : ""}`, { size: 12, color: INK.secondary });
  });
  if (o.reference) {
    const x = px(o.reference.value);
    body += `<line x1="${x}" y1="${top - 10}" x2="${x}" y2="${height - 28}" stroke="${INK.primary}" stroke-width="1.5" stroke-dasharray="6 4"/>` + text(x + 4, top - 12, o.reference.label, { size: 11 });
  }
  return frame(height, title, body, o.subtitle);
}

/** Horizontal stacked bars with legend and printed segment counts. */
export function stackedBars(title: string, categories: string[], rows: { label: string; counts: Record<string, number> }[], o: { subtitle?: string; percent?: boolean } = {}) {
  const lg = legend(o.subtitle ? 64 : 48, categories.map((c, i) => ({ label: c, color: CATEGORICAL[i % CATEGORICAL.length] })));
  const top = lg.bottom + 10;
  const bar = 20;
  const gap = 8;
  const labelW = Math.min(280, Math.max(60, ...rows.map((r) => textW(clipLabel(r.label, 40), 13))) + 12);
  const plotW = CHART_WIDTH - labelW - 60;
  const totals = rows.map((r) => categories.reduce((n, c) => n + (r.counts[c] ?? 0), 0));
  const maxTotal = o.percent ? 1 : Math.max(1, ...totals);
  const height = top + rows.length * (bar + gap) + 10;
  let body = lg.svg;
  rows.forEach((r, i) => {
    const y = top + i * (bar + gap);
    body += text(labelW - 10, y + bar - 5, clipLabel(r.label, 40), { size: 13, anchor: "end" });
    let x = labelW;
    categories.forEach((c, ci) => {
      const n = r.counts[c] ?? 0;
      if (!n) return;
      const w = ((o.percent ? n / (totals[i] || 1) : n) / maxTotal) * plotW;
      body += `<rect x="${x}" y="${y}" width="${Math.max(1, w - 2)}" height="${bar}" fill="${CATEGORICAL[ci % CATEGORICAL.length]}"/>`;
      if (w > 26) body += text(x + w / 2 - 1, y + bar - 5, String(n), { size: 12, color: "#ffffff", anchor: "middle" });
      x += w;
    });
    const segments = categories.filter((c) => (r.counts[c] ?? 0) > 0).length;
    // The total is printed when it adds information (several segments, or one too narrow for its own label).
    if (segments > 1 || ((totals[i] / (maxTotal || 1)) * plotW <= 26 && !o.percent)) body += text(x + 6, y + bar - 5, String(totals[i]), { size: 12, color: INK.secondary });
  });
  return frame(height, title, body, o.subtitle);
}

/** Horizontal grouped bars: one group per category, one bar per series. */
export function groupedBars(title: string, categories: string[], series: { name: string; values: (number | null)[] }[], o: { max?: number; digits?: number; subtitle?: string } = {}) {
  const digits = o.digits ?? 2;
  const lg = legend(o.subtitle ? 64 : 48, series.map((s, i) => ({ label: s.name, color: CATEGORICAL[i % CATEGORICAL.length] })));
  const top = lg.bottom + 10;
  const bar = 14;
  const groupH = series.length * (bar + 3) + 12;
  const labelW = Math.min(280, Math.max(60, ...categories.map((c) => textW(clipLabel(c, 40), 13))) + 12);
  const plotW = CHART_WIDTH - labelW - 110;
  const max = Math.max(o.max ?? 0, ...series.flatMap((s) => s.values.map((v) => v ?? 0)), 1e-9);
  const height = top + categories.length * groupH + 10;
  let body = lg.svg;
  categories.forEach((c, ci) => {
    const y0 = top + ci * groupH;
    body += text(labelW - 10, y0 + (series.length * (bar + 3)) / 2 + 4, clipLabel(c, 40), { size: 13, anchor: "end" });
    series.forEach((s, si) => {
      const y = y0 + si * (bar + 3);
      const v = s.values[ci];
      if (v === null || v === undefined) {
        body += `<rect x="${labelW}" y="${y}" width="${plotW}" height="${bar}" fill="none" stroke="#d98f1f" stroke-dasharray="4 3"/>` + text(labelW + plotW + 6, y + bar - 3, "ditahan", { size: 11, color: INK.secondary });
        return;
      }
      const w = (v / max) * plotW;
      body += `<rect x="${labelW}" y="${y}" width="${Math.max(1, w)}" height="${bar}" rx="2" fill="${CATEGORICAL[si % CATEGORICAL.length]}"/>` + text(labelW + w + 6, y + bar - 3, fmt(v, digits), { size: 11, color: INK.secondary });
    });
  });
  return frame(height, title, body, o.subtitle);
}

/** Vertical columns (histograms, before/after counts); several series side by side. */
export function columns(title: string, categories: string[], series: { name: string; values: number[] }[], o: { subtitle?: string; digits?: number; yLabel?: string } = {}) {
  const digits = o.digits ?? 0;
  const lg = series.length > 1 ? legend(o.subtitle ? 64 : 48, series.map((s, i) => ({ label: s.name, color: CATEGORICAL[i % CATEGORICAL.length] }))) : { svg: "", bottom: o.subtitle ? 50 : 34 };
  const top = lg.bottom + 24;
  const plotH = 240;
  const left = 56;
  const plotW = CHART_WIDTH - left - 20;
  const max = Math.max(1e-9, ...series.flatMap((s) => s.values));
  const slot = plotW / Math.max(1, categories.length);
  const bw = Math.min(46, (slot - 12) / series.length);
  const py = (v: number) => top + plotH - (v / max) * plotH;
  let body = lg.svg;
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    body += `<line x1="${left}" y1="${py(v)}" x2="${left + plotW}" y2="${py(v)}" stroke="${INK.grid}"/>` + text(left - 8, py(v) + 4, fmt(v, v % 1 ? 1 : 0), { size: 11, color: INK.muted, anchor: "end" });
  }
  categories.forEach((c, ci) => {
    const cx = left + ci * slot + slot / 2;
    series.forEach((s, si) => {
      const v = s.values[ci] ?? 0;
      const x = cx - (series.length * bw) / 2 + si * bw;
      body += `<rect x="${x + 1}" y="${py(v)}" width="${bw - 2}" height="${top + plotH - py(v)}" rx="2" fill="${CATEGORICAL[si % CATEGORICAL.length]}"/>`;
      if (v) body += text(x + bw / 2, py(v) - 5, fmt(v, digits), { size: 11, color: INK.secondary, anchor: "middle" });
    });
    body += text(cx, top + plotH + 18, clipLabel(c, 18), { size: 12, anchor: "middle" });
  });
  body += `<line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}" stroke="${INK.baseline}"/>`;
  if (o.yLabel) body += text(left, top - 10, o.yLabel, { size: 11, color: INK.muted });
  return frame(top + plotH + 34, title, body, o.subtitle);
}

/** Donut with the total in the centre and a legend carrying value and share. */
export function donut(title: string, slices: { label: string; value: number }[], o: { subtitle?: string; digits?: number; centerLabel?: string } = {}) {
  const digits = o.digits ?? 0;
  const total = slices.reduce((n, s) => n + s.value, 0);
  const top = o.subtitle ? 60 : 44;
  const r = 110;
  const cx = 150;
  const cy = top + r + 10;
  let body = "";
  let angle = -Math.PI / 2;
  if (total <= 0) body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK.empty}" stroke-width="46"/>`;
  slices.forEach((s, i) => {
    if (s.value <= 0 || total <= 0) return;
    const a = (s.value / total) * Math.PI * 2;
    const color = CATEGORICAL[i % CATEGORICAL.length];
    if (a >= Math.PI * 2 - 1e-9) {
      body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="46"/>`;
    } else {
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(angle + a);
      const y2 = cy + r * Math.sin(angle + a);
      body += `<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="${color}" stroke-width="46"/>`;
      // 2px surface gap between segments.
      body += `<line x1="${cx + (r - 24) * Math.cos(angle)}" y1="${cy + (r - 24) * Math.sin(angle)}" x2="${cx + (r + 24) * Math.cos(angle)}" y2="${cy + (r + 24) * Math.sin(angle)}" stroke="${INK.surface}" stroke-width="2"/>`;
    }
    angle += a;
  });
  body += text(cx, cy + 2, fmt(total, digits), { size: 26, bold: true, anchor: "middle" }) + text(cx, cy + 24, o.centerLabel ?? "total", { size: 12, color: INK.secondary, anchor: "middle" });
  slices.forEach((s, i) => {
    const y = top + 30 + i * 28;
    const pct = total > 0 ? (s.value / total) * 100 : 0;
    body += `<rect x="330" y="${y - 12}" width="14" height="14" rx="3" fill="${CATEGORICAL[i % CATEGORICAL.length]}"/>` + text(352, y, clipLabel(s.label, 44), { size: 13 }) + text(CHART_WIDTH - 10, y, `${fmt(s.value, digits)} (${fmt(pct, 1)}%)`, { size: 13, color: INK.secondary, anchor: "end" });
  });
  return frame(Math.max(cy + r + 40, top + 30 + slices.length * 28 + 10), title, body, o.subtitle);
}

/** Matrix with one blue ramp; values printed; null cells are left empty; a ramp legend is always shown. */
export function heatmap(title: string, rowLabels: string[], colLabels: string[], values: (number | null)[][], o: { subtitle?: string; digits?: number; min?: number; max?: number; rowTitle?: string; colTitle?: string; frameDiagonal?: boolean } = {}) {
  const digits = o.digits ?? 0;
  const labelW = Math.min(240, Math.max(40, ...rowLabels.map((l) => textW(clipLabel(l, 34), 12))) + 12);
  const cellW = Math.max(16, Math.min(70, (CHART_WIDTH - labelW - 10) / Math.max(1, colLabels.length)));
  const cellH = Math.max(14, Math.min(34, cellW * 0.7));
  const colFont = cellW < 26 ? 9 : 11;
  const rotate = colLabels.some((c) => textW(c, colFont) > cellW - 4);
  const colLabelH = rotate ? Math.min(150, Math.max(...colLabels.map((c) => textW(clipLabel(c, 22), colFont))) * 0.8 + 14) : 22;
  const top = (o.subtitle ? 60 : 44) + colLabelH;
  const flat = values.flat().filter((v): v is number => v !== null);
  const min = o.min ?? Math.min(0, ...flat);
  const max = o.max ?? Math.max(1, ...flat);
  let body = "";
  colLabels.forEach((c, j) => {
    const x = labelW + j * cellW + cellW / 2;
    body += rotate
      ? `<text x="${x}" y="${top - 6}" font-family="${FONT}" font-size="${colFont}" fill="${INK.secondary}" transform="rotate(-55 ${x} ${top - 6})">${esc(clipLabel(c, 22))}</text>`
      : text(x, top - 8, c, { size: colFont, color: INK.secondary, anchor: "middle" });
  });
  rowLabels.forEach((rl, i) => {
    const y = top + i * cellH;
    body += text(labelW - 8, y + cellH / 2 + 4, clipLabel(rl, 34), { size: 12, anchor: "end" });
    colLabels.forEach((_, j) => {
      const v = values[i]?.[j] ?? null;
      const x = labelW + j * cellW;
      const fill = v === null ? INK.empty : rampColor(v, min, max);
      const diag = o.frameDiagonal && i === j;
      body += `<rect x="${x + 1}" y="${y + 1}" width="${cellW - 2}" height="${cellH - 2}" fill="${fill}"${diag ? ` stroke="${INK.primary}" stroke-width="1.5"` : ""}/>`;
      if (v !== null && cellW >= 22) {
        const dark = (v - min) / (max - min || 1) > 0.55;
        body += text(x + cellW / 2, y + cellH / 2 + 4, fmt(v, digits), { size: cellW < 30 ? 9 : 11, color: dark ? "#ffffff" : INK.primary, anchor: "middle" });
      }
    });
  });
  // Ramp legend: identity of each step is printed, never colour alone.
  let ly = top + rowLabels.length * cellH + 22;
  const steps = RAMP.length;
  body += text(0, ly, "skala", { size: 11, color: INK.muted });
  for (let k = 0; k < steps; k++) {
    const v = min + ((max - min) * k) / (steps - 1);
    const x = 48 + k * 64;
    body += `<rect x="${x}" y="${ly - 11}" width="20" height="12" fill="${RAMP[k]}" stroke="${INK.grid}"/>` + text(x + 24, ly, fmt(v, digits > 0 ? digits : max - min < 10 ? 1 : 0), { size: 11, color: INK.secondary });
  }
  body += `<rect x="${48 + steps * 64}" y="${ly - 11}" width="20" height="12" fill="${INK.empty}" stroke="${INK.grid}"/>` + text(48 + steps * 64 + 24, ly, "tidak ada", { size: 11, color: INK.secondary });
  ly += 20;
  const axis = [o.rowTitle ? `baris: ${o.rowTitle}` : null, o.colTitle ? `kolom: ${o.colTitle}` : null, !cellW || cellW < 22 ? "nilai lengkap di tabel berikut" : null, o.frameDiagonal ? "bingkai = diagonal (sepakat)" : null].filter(Boolean).join(" · ");
  body += text(0, ly, axis, { size: 11, color: INK.muted });
  return frame(ly + 10, title, body, o.subtitle);
}

/** One or more lines over an ordinal x axis (e.g. cumulative calls per hour). */
export function lineChart(title: string, xLabels: string[], series: { name: string; values: number[] }[], o: { subtitle?: string; digits?: number; yLabel?: string } = {}) {
  const lg = series.length > 1 ? legend(o.subtitle ? 64 : 48, series.map((s, i) => ({ label: s.name, color: CATEGORICAL[i % CATEGORICAL.length] }))) : { svg: "", bottom: o.subtitle ? 50 : 34 };
  const top = lg.bottom + 20;
  const plotH = 220;
  const left = 70;
  const plotW = CHART_WIDTH - left - 60;
  const max = Math.max(1e-9, ...series.flatMap((s) => s.values));
  const px = (i: number) => left + (xLabels.length <= 1 ? plotW / 2 : (i / (xLabels.length - 1)) * plotW);
  const py = (v: number) => top + plotH - (v / max) * plotH;
  let body = lg.svg;
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    body += `<line x1="${left}" y1="${py(v)}" x2="${left + plotW}" y2="${py(v)}" stroke="${INK.grid}"/>` + text(left - 8, py(v) + 4, fmt(v, o.digits ?? 0), { size: 11, color: INK.muted, anchor: "end" });
  }
  const every = Math.max(1, Math.ceil(xLabels.length / 10));
  xLabels.forEach((l, i) => {
    if (i % every === 0 || i === xLabels.length - 1) body += text(px(i), top + plotH + 18, l, { size: 11, color: INK.secondary, anchor: "middle" });
  });
  series.forEach((s, si) => {
    const color = CATEGORICAL[si % CATEGORICAL.length];
    body += `<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${s.values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ")}"/>`;
    const last = s.values.length - 1;
    if (last >= 0) body += `<circle cx="${px(last)}" cy="${py(s.values[last])}" r="4" fill="${color}"/>` + text(px(last) + 8, py(s.values[last]) + 4, fmt(s.values[last], o.digits ?? 0), { size: 12, color: INK.secondary });
  });
  if (o.yLabel) body += text(left, top - 8, o.yLabel, { size: 11, color: INK.muted });
  body += `<line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}" stroke="${INK.baseline}"/>`;
  return frame(top + plotH + 34, title, body, o.subtitle);
}

/** Tornado: for each element the range across scenarios around its base value. */
export function tornado(title: string, rows: { label: string; base: number; low: number; high: number }[], o: { subtitle?: string; digits?: number } = {}) {
  const digits = o.digits ?? 3;
  const lg = legend(o.subtitle ? 64 : 48, [{ label: "turun dari bobot dasar", color: CATEGORICAL[1] }, { label: "naik dari bobot dasar", color: CATEGORICAL[0] }]);
  const top = lg.bottom + 12;
  const bar = 18;
  const gap = 10;
  const labelW = 70;
  const plotW = CHART_WIDTH - labelW - 280;
  const lo = Math.min(...rows.map((r) => r.low));
  const hi = Math.max(...rows.map((r) => r.high));
  const px = (v: number) => labelW + ((v - lo) / (hi - lo || 1)) * plotW;
  const sorted = [...rows].sort((a, b) => b.high - b.low - (a.high - a.low));
  const axisY = top + sorted.length * (bar + gap) + 4;
  let body = lg.svg;
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    body += `<line x1="${px(v)}" y1="${top - 4}" x2="${px(v)}" y2="${axisY}" stroke="${INK.grid}"/>` + text(px(v), axisY + 16, fmt(v, 2), { size: 11, color: INK.muted, anchor: "middle" });
  }
  sorted.forEach((r, i) => {
    const y = top + i * (bar + gap);
    body += text(labelW - 10, y + bar - 4, r.label, { size: 13, anchor: "end" });
    body += `<rect x="${px(r.low)}" y="${y}" width="${Math.max(1, px(r.base) - px(r.low))}" height="${bar}" fill="${CATEGORICAL[1]}"/>`;
    body += `<rect x="${px(r.base)}" y="${y}" width="${Math.max(1, px(r.high) - px(r.base))}" height="${bar}" fill="${CATEGORICAL[0]}"/>`;
    body += `<line x1="${px(r.base)}" y1="${y - 3}" x2="${px(r.base)}" y2="${y + bar + 3}" stroke="${INK.primary}" stroke-width="2"/>`;
    body += text(labelW + plotW + 12, y + bar - 4, `${fmt(r.low, digits)} – ${fmt(r.high, digits)} (dasar ${fmt(r.base, digits)})`, { size: 11, color: INK.secondary });
  });
  return frame(axisY + 30, title, body, o.subtitle);
}

/** Aggregate bar with every individual value as a dot, so variation is never hidden. */
export function dotRange(title: string, rows: { label: string; aggregate: number | null; individual: number[] }[], o: { subtitle?: string; digits?: number } = {}) {
  const digits = o.digits ?? 3;
  const top = (o.subtitle ? 60 : 44) + 4;
  const bar = 16;
  const gap = 10;
  const labelW = Math.min(200, Math.max(60, ...rows.map((r) => textW(r.label, 13))) + 12);
  const plotW = CHART_WIDTH - labelW - 180;
  const max = Math.max(1e-9, ...rows.flatMap((r) => [r.aggregate ?? 0, ...r.individual]));
  const px = (v: number) => labelW + (v / max) * plotW;
  const height = top + rows.length * (bar + gap) + 36;
  let body = "";
  rows.forEach((r, i) => {
    const y = top + i * (bar + gap);
    body += text(labelW - 10, y + bar - 3, r.label, { size: 13, anchor: "end" });
    if (r.aggregate !== null) body += `<rect x="${labelW}" y="${y + 3}" width="${Math.max(1, px(r.aggregate) - labelW)}" height="${bar - 6}" rx="2" fill="#9ec5f4"/>`;
    for (const v of r.individual) body += `<circle cx="${px(v)}" cy="${y + bar / 2}" r="4.5" fill="${INK.primary}" stroke="${INK.surface}" stroke-width="2"/>`;
    const lo = r.individual.length ? Math.min(...r.individual) : null;
    const hi = r.individual.length ? Math.max(...r.individual) : null;
    body += text(labelW + plotW + 14, y + bar - 3, `${r.aggregate === null ? "—" : fmt(r.aggregate, digits)}${lo !== null ? ` (${fmt(lo, digits)}–${fmt(hi!, digits)})` : ""}`, { size: 12, color: INK.secondary });
  });
  body += text(0, height - 10, "batang = agregat; titik = nilai individual kursi", { size: 11, color: INK.muted });
  return frame(height, title, body, o.subtitle);
}
