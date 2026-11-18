import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR!;
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR!;

const Z = [-1.645, -0.674, 0, 0.674, 1.645];

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function comparableMedians(input: any): number[] {
  const comps: any[] = Array.isArray(input.comparables) ? input.comparables : [];
  const byHour: number[][] = Array.from({ length: 25 }, () => []);
  for (const comp of comps) {
    if (typeof comp?.unlock !== "string" || !/midnight local/i.test(comp.unlock)) continue;
    const hourly: any[] = Array.isArray(comp.hourly) ? comp.hourly : [];
    const i = hourly.findIndex((row: any) => String(row?.from).startsWith(String(comp.day_start).slice(0, 13)));
    if (i < 0) continue;
    const first = hourly[i]?.viewers;
    if (typeof first !== "number" || first < 3000) continue;
    for (let h = 2; h <= 24; h++) {
      const row = hourly[i + (h - 1)];
      if (row && typeof row.viewers === "number" && row.viewers > 0 && first > 0) {
        byHour[h].push(Math.log(row.viewers / first));
      }
    }
  }
  const result: number[] = Array(25).fill(1);
  for (let h = 2; h <= 24; h++) {
    if (byHour[h].length > 0) {
      const meanLog = byHour[h].reduce((a, b) => a + b, 0) / byHour[h].length;
      result[h] = Math.exp(1.35 * meanLog);
    }
  }
  return result;
}

function harden(rows: { hour: number; q: number[] }[]): { hour: number; q: number[] }[] {
  const byHour = new Map(rows.map((r) => [r.hour, r]));
  const out: { hour: number; q: number[] }[] = [];
  let prev = 1;
  for (let h = 2; h <= 24; h++) {
    const r = byHour.get(h);
    const q: number[] = [];
    for (let k = 0; k < 5; k++) {
      const n = Number(r?.q?.[k]);
      q.push(Number.isFinite(n) && n > 0 ? n : prev);
    }
    for (let k = 1; k < q.length; k++) if (!(q[k] >= q[k - 1])) q[k] = q[k - 1];
    for (let k = 0; k < q.length; k++) q[k] = Math.min(1e9, Math.max(0.01, Math.round(q[k] * 100) / 100));
    for (let k = 1; k < q.length; k++) if (q[k] < q[k - 1]) q[k] = q[k - 1];
    prev = q[4];
    out.push({ hour: h, q });
  }
  return out;
}

function forecast(input: any): { hour: number; q: number[] }[] {
  const known: any[] = Array.isArray(input.known) ? input.known : [];
  const hour1 = known.find((row: any) => row?.hour === 1);
  const targetP1 = Math.max(1, Number(hour1?.viewers) || 1);
  const ratios = comparableMedians(input);

  const rows: { hour: number; q: number[] }[] = [];
  for (let h = 2; h <= 24; h++) {
    const ratio = Number.isFinite(ratios[h]) ? ratios[h] : 1;
    const med = targetP1 * ratio;
    const sigma = 0.15 * Math.sqrt(h - 1);
    let q = Z.map((z) => Math.max(1, Math.round(med * Math.exp(z * sigma) * 100) / 100));
    for (let k = 1; k < q.length; k++) if (q[k] < q[k - 1]) q[k] = q[k - 1];
    rows.push({ hour: h, q });
  }
  return rows;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const files = readdirSync(INPUT_DIR).filter((f) => f.endsWith(".in")).sort();
for (const file of files) {
  const input = JSON.parse(readFileSync(join(INPUT_DIR, file), "utf8"));
  const hours = harden(forecast(input));
  if (hours.length !== 23 || hours.some((r, i) => r.hour !== i + 2 || r.q.length !== 5 || r.q.some((v) => !Number.isFinite(v) || v < 0.01 || v > 1e9) || r.q.some((v, k) => k > 0 && v < r.q[k - 1]))) {
    throw new Error(`invalid forecast for ${input.id}`);
  }
  writeFileSync(join(OUTPUT_DIR, `${input.id}.out`), JSON.stringify({ hours }));
}
