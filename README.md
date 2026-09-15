# bpplus-js-reservoir

Pulse wave analysis, reservoir–excess pressure and pressure-only wave intensity
for Uscom BP+ measurements, in JavaScript. A port of
[BPplus-Reservoir](https://github.com/adh30/BPplus-Reservoir) (`bpp_Res2`
beta7) by Alun Hughes and Kim Parker.

**A research analysis, not a result of the BP+ and not for diagnosis.**

- No build step, no dependencies, no DOM. ES modules that run in a browser and
  in Node.
- All 89 values `bpp_Res2.m` writes to `resdata.xls`, under the same column
  names, plus the series its four figures are drawn from.
- Checked against MATLAB running `bpp_Res2.m` itself, over every recording in
  [bpplus-reservoir-vectors](https://github.com/doingnz/bpplus-reservoir-vectors).

## Use

```js
import { analyseReservoir, reservoirInput } from './reservoir/index.js';

// A BpPlusMeasurement from the BP+ JavaScript SDK, or anything with value(tag).
const result = analyseReservoir(reservoirInput(measurement));

result.processed;          // false below 6 dB SNR, as in the MATLAB
result.values.re_aosevr;   // any resdata.xls column
result.errors;             // sections that could not be computed, and why
result.series.sevr;        // what the SEVR figure is drawn from
```

A section that cannot be computed fails on its own: a wave intensity peak that
cannot be found costs the wave intensity values, not the reservoir fit. The
MATLAB stops the whole batch instead.

`resultsCsv([result.values])` gives a CSV with the `resdata.xls` headers, so a
row can be pooled with MATLAB output.

## Corrections to beta7

The port corrects defects in beta7 that change a value or a figure, each listed
in `CORRECTIONS` with the upstream issue it was reported in. A row written with
corrections carries `re_resvers` `beta7-bpconnect`.

```js
analyseReservoir(input, { compatibility: 'beta7' });   // as bpp_Res2.m beta7
```

One exception: the diastolic R² is computed only when more than 10 samples
remain, in both modes, as proposed upstream in
[adh30/BPplus-Reservoir#47](https://github.com/adh30/BPplus-Reservoir/pull/47).
beta7 computes it from however few there are. No test vector has so few.

That is what the tests compare against MATLAB, so the comparison stays valid
however many corrections there are. The corrections, and the upstream pull
requests that propose them, are tracked in the vectors repository's
`corrections.json`.

## The brachial beat

beta7 draws the pulse traces from `baEstimate` but computes the brachial values
from `sAveragePulse` scaled to the cuff pressures, so its figure is not the
waveform its numbers come from. Here the two share a source:

```js
analyseReservoir(input);                               // sBaseLined: beta7's brachial values
analyseReservoir(input, { normalise: true });          // sAveragePulse normalised to 0–1 first
analyseReservoir(input, { brachial: 'baEstimate' });   // the mean of the selected baEstimate pulses
```

With `sBaseLined`, the pulse traces are `sBaseLined` scaled by the same gain and
offset as `sAveragePulse`. With `baEstimate`, pulses of different lengths are
averaged sample by sample over those long enough to have each sample, to the
length of `sAveragePulse` (`averageBeats`). `re_resvers` records the choice; the
beta7 mode ignores both options.

## Taking it into a project

Like the BP+ SDK, most consumers copy `reservoir/` into their own tree rather
than install it — a REDCap external module or a PWA has to serve the files
itself. Copy it from a tag, record the tag, and check the copy has not been
edited, as [bpconnect](https://github.com/doingnz/bpconnect) does.

## Tests

```bash
git clone --branch v0.1.0 https://github.com/doingnz/bpplus-reservoir-vectors vectors
node test/run.mjs
```

Known answers for the ported MATLAB built-ins, then every vector: the beta7
analysis against MATLAB's values in all 89 columns, and the corrected analysis
against what each correction promises. `VECTORS.json` names the vectors tag this
version is checked against; CI checks out exactly that.

## Versions

- `RESERVOIR_JS_VERSION` in `reservoir/index.js` and `package.json` must agree;
  the tests fail otherwise.
- `ANALYSIS_VERSION` (`beta7`) is the `bpp_Res2` release the port follows.
- A change that alters any value in `compatibility: 'beta7'` is a bug unless the
  vectors changed with it.

## Licence

GPL-3.0-or-later, as the MATLAB original is. Its authors have been asked to
relicense it under MIT; if they agree, this port will follow. Authors,
references and what was ported from where: [reservoir/NOTICE.md](reservoir/NOTICE.md).
