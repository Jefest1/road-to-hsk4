# Road to HSK

A Chinese study app for Integrated Chinese Lessons 1–5 and HSK 1–2: flashcards with spaced review, handwriting practice, pinyin typing with tone checking, listening, tone and grammar drills, and read-aloud of any Chinese text using the Mandarin voices installed on the computer.

The whole app is one page, `index.html`. `main.js` and `preload.js` wrap it in Electron for Windows and add automatic updates from this repository's releases.

## Build

```
npm install
npx electron-builder --win nsis
```

The installer lands in `dist/`. To publish a release that installed copies pick up automatically, bump `version` in `package.json`, then run the build with `--publish always` and a `GH_TOKEN` that can write to this repository.
