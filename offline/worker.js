// Worker thread: keeps the translation engine and models in memory and translates one text at a time.
"use strict";
const { parentPort } = require("worker_threads");
const fs = require("fs");
const { startWasm, Engine } = require("./engine.js");

let engine = null;
parentPort.on("message", async (m) => {
  try {
    if (!engine) engine = new Engine(await startWasm(fs.readFileSync(m.engine)));
    if (!engine.models[m.pair]) {
      const files = {};
      for (const [type, p] of Object.entries(m.paths)) files[type] = fs.readFileSync(p);
      engine.addModel(m.pair, files, m.modelName);
    }
    parentPort.postMessage({ id: m.id, ok: true, text: engine.translate(m.pair, m.text) });
  } catch (e) {
    parentPort.postMessage({ id: m.id, ok: false, message: String((e && e.message) || e) });
  }
});
