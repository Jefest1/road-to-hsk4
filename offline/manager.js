// Free offline translation: downloads Mozilla's engine and English<->Chinese models once,
// checks each file against the SHA-256 Mozilla publishes, and translates in a worker thread.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Worker } = require("worker_threads");

const MANIFEST = require("./manifest.json");
const TOTAL = MANIFEST.files.reduce((s, f) => s + f.size, 0);
const IDLE_MS = 10 * 60 * 1000;

function createOffline({ dataDir, fetchFn, onProgress }) {
  const dir = path.join(dataDir, "offline-translation");
  const fileOf = (f) => path.join(dir, f.key + ".bin");
  let dl = null; // {done, total, ctl}
  let lastError = "";
  let worker = null, idleTimer = null, nextId = 1;
  const pending = new Map();

  const has = (f) => { try { return fs.statSync(fileOf(f)).size === f.size; } catch (e) { return false; } };
  const installed = () => MANIFEST.files.every(has);
  const status = () => ({
    installed: installed(),
    total: TOTAL,
    downloading: dl ? { done: dl.done, total: dl.total } : null,
    error: lastError
  });

  async function download() {
    if (dl) return status();
    lastError = "";
    const ctl = new AbortController();
    const todo = MANIFEST.files.filter((f) => !has(f));
    dl = { done: TOTAL - todo.reduce((s, f) => s + f.size, 0), total: TOTAL, ctl };
    fs.mkdirSync(dir, { recursive: true });
    let lastSent = 0;
    const tell = (force) => { const now = Date.now(); if (force || now - lastSent > 250) { lastSent = now; onProgress(status()); } };
    tell(true);
    try {
      for (const f of todo) {
        const res = await fetchFn(f.url, { signal: ctl.signal });
        if (!res.ok) throw new Error("The download server answered " + res.status + ".");
        const tmp = fileOf(f) + ".part";
        const out = fs.createWriteStream(tmp);
        const hash = crypto.createHash("sha256");
        const reader = res.body.getReader();
        let got = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            hash.update(value);
            got += value.length;
            dl.done += value.length;
            if (!out.write(Buffer.from(value.buffer, value.byteOffset, value.byteLength))) await new Promise((r) => out.once("drain", r));
            tell(false);
          }
        } finally {
          await new Promise((r) => out.end(r));
        }
        if (got !== f.size || hash.digest("hex") !== f.sha256) {
          fs.rmSync(tmp, { force: true });
          throw new Error("A downloaded file didn't match Mozilla's checksum, so it was thrown away. Try again.");
        }
        fs.renameSync(tmp, fileOf(f));
      }
    } catch (e) {
      const aborted = ctl.signal.aborted;
      for (const f of MANIFEST.files) fs.rmSync(fileOf(f) + ".part", { force: true });
      lastError = aborted ? "" : String((e && e.message) || e).slice(0, 200);
      if (!aborted && /fetch|network|ERR_|ENOTFOUND|ECONN|ETIMEDOUT/i.test(lastError)) lastError = "Couldn't reach Mozilla's download server. Check your internet connection and try again.";
    } finally {
      dl = null;
      onProgress(status());
    }
    return status();
  }
  function cancel() { if (dl) dl.ctl.abort(); }
  function remove() {
    cancel();
    stopWorker();
    fs.rmSync(dir, { recursive: true, force: true });
    return status();
  }

  function workerPath() {
    // Inside the installed app this file sits in app.asar; the worker and engine are unpacked beside it.
    return path.join(__dirname, "worker.js").replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
  }
  function stopWorker() {
    clearTimeout(idleTimer);
    if (worker) { worker.terminate(); worker = null; }
    for (const p of pending.values()) p({ ok: false, code: "engine", message: "Stopped." });
    pending.clear();
  }
  function getWorker() {
    if (worker) return worker;
    worker = new Worker(workerPath());
    worker.on("message", (m) => { const p = pending.get(m.id); if (p) { pending.delete(m.id); p(m.ok ? { ok: true, text: m.text } : { ok: false, code: "engine", message: m.message }); } });
    worker.on("error", (e) => { const w = worker; worker = null; for (const p of pending.values()) p({ ok: false, code: "engine", message: String(e && e.message) }); pending.clear(); if (w) w.terminate(); });
    return worker;
  }
  function translate(text) {
    if (!installed()) return Promise.resolve({ ok: false, code: "not_installed" });
    text = String(text || "").trim().slice(0, 1200);
    if (!text) return Promise.resolve({ ok: false, code: "empty" });
    const zh = /[㐀-鿿]/.test(text);
    const pair = zh ? "zh-en" : "en-zh";
    const files = MANIFEST.files.filter((f) => f.pair === pair);
    const paths = {};
    for (const f of files) paths[f.type] = fileOf(f);
    const modelName = files.find((f) => f.type === "model").name;
    const engine = fileOf(MANIFEST.files.find((f) => f.key === "engine"));
    clearTimeout(idleTimer);
    return new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, (r) => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(stopWorker, IDLE_MS); // free the memory when translation hasn't been used for a while
        resolve(r.ok ? { ok: true, text: r.text, from: zh ? "zh" : "en" } : r);
      });
      getWorker().postMessage({ id, pair, text, paths, modelName, engine });
    });
  }

  return { status, download, cancel, remove, translate, stop: stopWorker };
}

module.exports = { createOffline, TOTAL };
