# ANODOS — Combined Project Package

```
ANODOS_Project/
├── docs/
│   ├── ANODOS_Backend___Complete_Project_Report.txt   # full backend report
│   ├── ANODOS_Team_Handoff_Document.docx              # team handoff / integration contracts
│   ├── ANODOS_demo_script.md                          # 8-step live demo script
│   └── ANODOS_Progress_Summary.md                     # current progress + remaining work
├── data/
│   ├── ANODOS_MASTER_DATASET.csv                      # 100,000 rows x 66 cols (simulated)
│   └── ANODOS_MASTER_DATASET.xlsx                     # same dataset, Excel format
└── digital-twin/                                      # Person 2's 3D Digital Twin (Vite + JS)
    ├── src/  dist/  scripts/  index.html  package.json ...
    └── anodos-digital-twin/INTEGRATION_CONTRACT.md    # /state + /ws integration contract
```

Notes
- The dataset is simulated (public/reference data + MATLAB augmentation) — never present it as real KONE data.
- `node_modules/` was left out of `digital-twin/`; run `npm install` inside that folder, then `npm run dev`.
