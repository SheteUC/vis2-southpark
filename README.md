# South Park — Dialogue Anatomy

A level-based South Park dialogue explorer built on the public transcript dataset.
The full project write-up lives in [`docs/index.md`](docs/index.md).

## Links

- **Documentation (write-up):** [`docs/index.md`](docs/index.md) — published at [sheteuc.github.io/vis2-southpark](https://sheteuc.github.io/vis2-southpark/)
- **Live app:** [vis2-southpark.vercel.app](https://vis2-southpark.vercel.app)
- **Repository:** [SheteUC/vis2-southpark](https://github.com/SheteUC/vis2-southpark)
- **Dataset:** [yaylinda/south-park-dialog](https://github.com/yaylinda/south-park-dialog)

## Local run

```bash
npm install
python preprocess.py
python preprocess_timing.py
python preprocess_pairs.py
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

**Requirements:** Node 18+, Python 3, `pandas`, and `numpy`.
