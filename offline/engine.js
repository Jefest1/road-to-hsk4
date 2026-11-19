// Offline translation with Mozilla's Bergamot engine (the one inside Firefox), run in a Node worker thread.
// The engine (bergamot-translator.wasm) and the models are downloaded once into the app's data folder.
// vendor/bergamot-translator.js is Mozilla's loader for that wasm, MPL-2.0.
"use strict";
const fs = require("fs");
const path = require("path");

const ALIGN = { model: 256, lex: 64, vocab: 64, srcvocab: 64, trgvocab: 64 };

function loadLoader() {
  const code = fs.readFileSync(path.join(__dirname, "..", "vendor", "bergamot-translator.js"), "utf8");
  // The loader is a plain script that defines loadBergamot(Module).
  return new Function(code + "\nreturn loadBergamot;")();
}

function startWasm(wasmBinary) {
  const loadBergamot = loadLoader();
  return new Promise((resolve, reject) => {
    const mod = loadBergamot({
      INITIAL_MEMORY: 41943040,
      print: () => {},
      printErr: () => {},
      onAbort: () => reject(new Error("The translation engine failed to start.")),
      onRuntimeInitialized: async () => { await Promise.resolve(); resolve(mod); },
      wasmBinary
    });
  });
}

function textConfig(cfg) {
  const indent = "            ";
  let out = "\n";
  for (const [k, v] of Object.entries(cfg)) out += `${indent}${k}: ${v}\n`;
  return out + indent;
}

class Engine {
  constructor(bergamot) {
    this.b = bergamot;
    this.models = {};
    this.service = new bergamot.BlockingService({ cacheSize: 0 });
  }
  // files: {model, lex, vocab | srcvocab+trgvocab} as Buffers; modelName decides the gemm precision, as Firefox does.
  addModel(pair, files, modelName) {
    const b = this.b, mem = {};
    for (const [type, buf] of Object.entries(files)) {
      const m = new b.AlignedMemory(buf.byteLength, ALIGN[type]);
      m.getByteArrayView().set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
      mem[type] = m;
    }
    const vocabs = new b.AlignedMemoryList();
    if (mem.vocab) vocabs.push_back(mem.vocab);
    else { vocabs.push_back(mem.srcvocab); vocabs.push_back(mem.trgvocab); }
    const config = textConfig({
      "beam-size": "1", normalize: "1.0", "word-penalty": "0", "max-length-break": "128",
      "mini-batch-words": "1024", workspace: "128", "max-length-factor": "2.0", "skip-cost": "true",
      "cpu-threads": "0", quiet: "true", "quiet-translation": "true",
      "gemm-precision": /intgemm8\.bin$/.test(modelName) ? "int8shiftAll" : "int8shiftAlphaAll",
      alignment: "soft"
    });
    const [from, to] = pair.split("-");
    this.models[pair] = new b.TranslationModel(from, to, config, mem.model, mem.lex || null, vocabs, null);
  }
  translate(pair, text) {
    const b = this.b, model = this.models[pair];
    if (!model) throw new Error("Model not loaded: " + pair);
    const messages = new b.VectorString(), options = new b.VectorResponseOptions();
    let responses = null;
    try {
      messages.push_back(text);
      options.push_back({ qualityScores: false, alignment: false, html: false });
      responses = this.service.translate(model, messages, options);
      return responses.get(0).getTranslatedText();
    } finally {
      messages.delete(); options.delete(); if (responses) responses.delete();
    }
  }
}

module.exports = { startWasm, Engine };
