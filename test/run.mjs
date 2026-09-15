/**
 * Tests for bpplus-js-reservoir. No dependencies, no browser.
 *
 *   node test/run.mjs [--vectors <folder>]
 *
 * 1. The MATLAB built-ins the port reproduces give known answers — values that
 *    follow from the mathematics, not values this code happened to compute.
 * 2. package.json and RESERVOIR_JS_VERSION agree.
 * 3. Every vector in bpplus-reservoir-vectors, analysed with
 *    { compatibility: 'beta7' }, agrees with the MATLAB result in all 89
 *    columns. A column the expected values lack is a failure, not a pass.
 * 4. On every vector, the corrected analysis does what each correction says.
 *
 * Vectors are read from --vectors, BPPLUS_RESERVOIR_VECTORS, or ./vectors,
 * where CI checks out the tag VECTORS.json names. Without them the run fails:
 * a run that compared nothing must not look like one that agreed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyseReservoir, reservoirInput, COLUMNS, RESERVOIR_JS_VERSION,
} from '../reservoir/index.js';
import {
  sgolayFirstDerivative, spline, fzero, fminsearch, findpeaks, round,
} from '../reservoir/matlab.js';
import { xmlSource } from './xml-source.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let failures = 0;

function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
}

function close(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

// ── 1. Known answers ─────────────────────────────────────────────────────────

{
  // The published 9-point cubic first-derivative Savitzky-Golay filter.
  const expected = [86, -142, -193, -126, 0, 126, 193, 142, -86].map(v => v / 1188);
  const g = sgolayFirstDerivative(3, 9);
  check('sgolay(3,9) first derivative', g.every((v, i) => close(v, expected[i], 1e-12)));
}

{
  // A not-a-knot cubic spline reproduces any cubic exactly, at any spacing.
  const f = x => 0.5 * x ** 3 - 2 * x ** 2 + x - 7;
  const x = [1, 2, 3, 10, 11, 12, 15, 16];
  const q = [4, 5.5, 7, 9, 13.2, 0, 17];
  const got = spline(x, x.map(f), q);
  check('spline is exact on a cubic', got.every((v, i) => close(v, f(q[i]), 1e-9)));
}

{
  const root = fzero(x => Math.cos(x) - x, 1, 1e-16);
  check('fzero finds cos(x) = x', close(root, 0.7390851332151607, 1e-14), String(root));
}

{
  const found = fminsearch(x => (x - 3) ** 2 + 1, 1, 1e-6);
  check('fminsearch finds a quadratic minimum', close(found.x, 3, 1e-5) && found.exitflag === 1, String(found.x));
}

{
  // Half-prominence width of a triangle is half its base.
  const y = [0, 0, 1, 2, 3, 4, 3, 2, 1, 0, 0];
  const p = findpeaks(y);
  check('findpeaks locates a triangle', p.locs.length === 1 && p.locs[0] === 6);
  check('findpeaks half-prominence width', close(p.widths[0], 4, 1e-12), String(p.widths[0]));

  // A plateau is one peak, at its first sample; the ends are never peaks.
  const flat = findpeaks([5, 1, 3, 3, 3, 1, 2, 0, 9]);
  check('findpeaks plateau and ends', flat.locs.join() === '3,7', flat.locs.join());

  const descending = findpeaks([0, 2, 0, 5, 0, 3, 0], { nPeaks: 1, sortStr: 'descend' });
  check('findpeaks SortStr descend', descending.locs[0] === 4);

  const tall = findpeaks([0, 2, 0, 5, 0, 3, 0], { minPeakHeight: 2 });
  check('findpeaks MinPeakHeight is strict', tall.locs.join() === '4,6', tall.locs.join());
}

check('round sends halves away from zero', round(2.5) === 3 && round(-2.5) === -3);

// ── 2. Version ───────────────────────────────────────────────────────────────

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
check('package.json version is RESERVOIR_JS_VERSION', pkg.version === RESERVOIR_JS_VERSION,
  `${pkg.version} vs ${RESERVOIR_JS_VERSION}`);

// ── 3 and 4. Vectors ─────────────────────────────────────────────────────────

const at = process.argv.indexOf('--vectors');
const vectorsDir = at > 0
  ? process.argv[at + 1]
  : (process.env.BPPLUS_RESERVOIR_VECTORS || path.join(root, 'vectors'));
const manifestFile = path.join(vectorsDir, 'manifest.json');

if (!fs.existsSync(manifestFile)) {
  check('test vectors are present', false, `no manifest.json in ${vectorsDir}`);
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const pin = JSON.parse(fs.readFileSync(path.join(root, 'VECTORS.json'), 'utf8'));
  console.log(`\n${manifest.vectors.length} vectors from ${vectorsDir}; VECTORS.json pins ${pin.ref}\n`);

  let compared = 0;
  for (const vector of manifest.vectors) {
    const xml = fs.readFileSync(path.join(vectorsDir, vector.xml), 'utf8');
    const source = xmlSource(xml);
    if (!source) {
      console.log(`skip  ${vector.name}: ${vector.format} XML; this port reads BP+ XML only`);
      continue;
    }

    const expectedFile = vector.expected?.beta7;
    if (!expectedFile) {
      check(`${vector.name}: has beta7 expected values`, false);
      continue;
    }
    const expected = JSON.parse(fs.readFileSync(path.join(vectorsDir, expectedFile), 'utf8'));
    const input = reservoirInput(source, { file: path.basename(vector.xml) });

    const beta7 = analyseReservoir(input, { compatibility: 'beta7' });
    const mismatches = [];
    for (const column of COLUMNS) {
      if (column.header === 're_file') continue;
      if (!(column.header in expected.values)) {
        mismatches.push(`${column.header}: missing from the expected values`);
        continue;
      }
      const want = expected.values[column.header];
      const got = beta7.values[column.header];
      if (!agrees(got, want, expected.tolerance ?? 1e-6)) {
        mismatches.push(`${column.header}: got ${got}, expected ${want}`);
      }
    }
    compared++;
    check(`${vector.name}: agrees with ${expected.source}`, mismatches.length === 0,
      mismatches.join('\n        '));

    // What each correction promises, on the same recording.
    const corrected = analyseReservoir(input);
    if (corrected.processed && corrected.errors.length === 0) {
      const v = corrected.values;
      check(`${vector.name}: diastolic duration is the beat less the ejection duration`,
        close(v.re_aodd, 60 / v.re_hr - v.re_ao_ed, 1e-12));
      check(`${vector.name}: SEVR figure ends systole where SEVR does`,
        corrected.series.sevr?.systoleEnd === round(v.re_ao_ed * v.re_sam_rate));
      const selected = input.sSelectedPulseIndexes
        .filter(p => p + 1 < input.sPulseStartIndexes.length)
        .map(p => p + 1);
      check(`${vector.name}: pulse traces are the selected pulses`,
        corrected.series.pulses?.numbers.join() === selected.join());
    }
  }
  check('at least one vector was compared', compared > 0);
}

function agrees(got, want, tolerance) {
  const missing = v => v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v));
  if (missing(want)) return missing(got);
  if (typeof want === 'string') return String(got) === want;
  return typeof got === 'number' && close(got, want, tolerance);
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
