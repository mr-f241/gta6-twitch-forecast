import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR!;
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR!;

const Z = [-1.645, -0.674, 0, 0.674, 1.645];

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
  const targetX = Math.log(targetP1);

  const comps: any[] = Array.isArray(input.comparables) ? input.comparables : [];
  const localMidnight: any[] = comps.filter((comp) => typeof comp?.unlock === "string" && /midnight local/i.test(comp.unlock));

  const rows: { hour: number; q: number[] }[] = [];
  for (let h = 2; h <= 24; h++) {
    const xs: number[] = [];
    const ys: number[] = [];
    const ws: number[] = [];
    for (const comp of localMidnight) {
      const hourly: any[] = Array.isArray(comp.hourly) ? comp.hourly : [];
      const i = hourly.findIndex((row: any) => String(row?.from).startsWith(String(comp.day_start).slice(0, 13)));
      if (i < 0) continue;
      const first = hourly[i]?.viewers;
      const row = hourly[i + (h - 1)];
      if (typeof first !== "number" || first < 3000 || first <= 0) continue;
      if (!row || typeof row.viewers !== "number" || row.viewers <= 0) continue;
      const x = Math.log(first);
      const y = Math.log(row.viewers);
      const w = Math.exp(-0.5 * Math.abs(x - targetX));
      xs.push(x);
      ys.push(y);
      ws.push(w);
    }

    if (xs.length === 0) {
      const sigma = 0.15 * Math.sqrt(h - 1);
      const med = targetP1;
      let q = Z.map((z) => Math.max(1, Math.round(med * Math.exp(z * sigma) * 100) / 100));
      for (let k = 1; k < q.length; k++) if (q[k] < q[k - 1]) q[k] = q[k - 1];
      rows.push({ hour: h, q });
      continue;
    }

    let wSum = 0, wxSum = 0, wySum = 0;
    for (let j = 0; j < xs.length; j++) {
      wSum += ws[j];
      wxSum += ws[j] * xs[j];
      wySum += ws[j] * ys[j];
    }
    const xbar = wSum > 0 ? wxSum / wSum : 0;
    const ybar = wSum > 0 ? wySum / wSum : 0;

    let sxx = 0, sxy = 0;
    for (let j = 0; j < xs.length; j++) {
      sxx += ws[j] * (xs[j] - xbar) * (xs[j] - xbar);
      sxy += ws[j] * (xs[j] - xbar) * (ys[j] - ybar);
    }

    let slope = 1;
    if (sxx !== 0) slope = sxy / sxx;
    const intercept = ybar - slope * xbar;

    let sse = 0;
    for (let j = 0; j < xs.length; j++) {
      const pred = intercept + slope * xs[j];
      const resid = ys[j] - pred;
      sse += ws[j] * resid * resid;
    }
    const residualSD = wSum > 0 ? Math.sqrt(sse / wSum) : 0;

    const prediction = intercept + slope * targetX;
    const width = 0.6 * residualSD + 0.01 * Math.sqrt(h - 1);
    const med = Math.exp(prediction);
    let q = Z.map((z) => Math.max(1, Math.round(med * Math.exp(z * width) * 100) / 100));
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
