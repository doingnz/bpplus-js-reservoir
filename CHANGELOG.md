# Changelog

## 0.1.1

Documentation only; no value changes.

- `reservoir/NOTICE.md` names the one way the beta7 mode differs from beta7
  (the diastolic R² guard) and links every correction and kept behaviour to
  the upstream issue it was reported in.

## 0.1.0

First release, moved out of bpconnect's `analysis/` folder unchanged apart from
`RESERVOIR_JS_VERSION`.

- A port of `bpp_Res2.m` beta7, `kreservoir_v15.m`, `BPfitres_v1.m` and `ai_v2.m`,
  with the MATLAB built-ins their values depend on reproduced in `matlab.js`.
- Agrees with MATLAB R2019b running `bpp_Res2.m` beta7 (BPplus-Reservoir
  2213898) on every BP+ recording in bpplus-reservoir-vectors v0.1.0, in all
  89 columns, to within 7e-8 relative.
- Corrections to beta7, off under `compatibility: 'beta7'`: diastolic duration
  (adh30/BPplus-Reservoir#25), the SEVR figure's end of systole (#27), and the
  pulse traces figure's pulses (#28).
- The diastolic R² needs more than 10 samples, in both modes (proposed
  upstream in #47), so the beta7 mode differs from beta7 when fewer remain.
