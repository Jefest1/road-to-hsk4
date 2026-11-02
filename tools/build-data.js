// Builds data/gen/* from the source datasets.
// Usage: node tools/build-data.js <dir with cedict.txt, mmah-dictionary.txt, x-hanzi-writer-*.tgz folders>
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, ".."), src = process.argv[2];
const out = path.join(root, "data", "gen"); fs.mkdirSync(path.join(out, "strokes"), {recursive:true});
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
for (const f of ["js/pinyin.js","data/decks.js","data/basics.js"]) vm.runInContext(fs.readFileSync(path.join(root,f),"utf8"), ctx);
const {HSK, markSyl} = ctx;
const HW = path.join(src, "x-hanzi-writer-data-2.0.1.tgz", "package");

// ---- CC-CEDICT
function toPinyin(raw){
  const parts = raw.split(" "); let res = "", prev = false;
  for (const p of parts){
    const m = p.match(/^([A-Za-z:]+)([1-5])$/);
    if (!m){ if (/^[A-Za-z]$/.test(p)) { res += p; continue; } return null; }
    const cap = m[1][0] !== m[1][0].toLowerCase();
    const base = m[1].toLowerCase().replace(/u:/g,"ü");
    if (base === "r" && m[2] === "5"){ res += "r"; continue; }
    let syl = markSyl(base, m[2] === "5" ? 0 : +m[2]);
    if (cap) syl = syl[0].toUpperCase() + syl.slice(1);
    if (res && /^[aeoāáǎàēéěèōóǒò]/i.test(syl)) res += "'";
    res += syl; prev = true;
  }
  return res;
}
const SKIP = /\b(city|county|district|prefecture|province|village|town|township|river|mountain|surname|dynasty|emperor|author|writer|poet|philosopher|politician|king of|Japanese|Korean)\b/i;
const entries = [], charFreq = new Map();
for (const line of fs.readFileSync(path.join(src,"cedict.txt"),"utf8").split("\n")){
  if (!line || line[0] === "#") continue;
  const m = line.match(/^\S+ (\S+) \[([^\]]+)\] \/(.+)\/\s*$/); if (!m) continue;
  const hz = m[1];
  if (/[A-Za-z0-9，·]/.test(hz)) continue;
  const chars = Array.from(hz); if (chars.length > 6) continue;
  chars.forEach(c => charFreq.set(c, (charFreq.get(c)||0) + 1));
  const senses = m[3].split("/").filter(s => !/^(variant of|old variant|archaic variant|see |see also|CL:|Taiwan pr\.|also pr\.|abbr\. for)/i.test(s));
  if (!senses.length) continue;
  const cap = /^[A-Z]/.test(m[2]);
  const gloss = senses.slice(0,3).join("; ").replace(/\s*\[[^\]]*\]/g,"").replace(/\|\S+/g,"");
  if (cap && (SKIP.test(gloss) || chars.length > 3)) continue;
  const py = toPinyin(m[2]); if (!py) continue;
  entries.push({hz, py, gloss: gloss.slice(0,120), cap, raw:m[2]});
}
// Dictionary order: short words made of common characters first; rare characters and names sink.
const score = e => { const ch = Array.from(e.hz), f = Math.min(...ch.map(c => charFreq.get(c)||0)); return ch.length * 40 - f / 40 + (e.cap ? 60 : 0) + (f < 8 ? 120 : 0); };
entries.sort((a,b) => score(a) - score(b));
fs.writeFileSync(path.join(out,"dict.js"), "HSK.dictRaw=" + JSON.stringify(entries.map(e => e.hz+"\t"+e.py+"\t"+e.gloss).join("\n")) + ";\n");

// ---- Which characters to support: simplified characters in CC-CEDICT, plus everything the app teaches
const charset = new Set();
for (const c of charFreq.keys()) if (fs.existsSync(path.join(HW, c + ".json"))) charset.add(c);
const extra = [];
HSK.decks.forEach(d => d.items.forEach(w => Array.from(w[0]).forEach(c => extra.push(c))));
HSK.radicals.forEach(r => { Array.from(r[0]+r[1]).forEach(c => extra.push(c)); });
extra.forEach(c => { if (fs.existsSync(path.join(HW, c + ".json"))) charset.add(c); });

// ---- Stroke data, in buckets the page loads on demand with a script tag
const BUCKETS = 64, buckets = Array.from({length:BUCKETS}, () => ({}));
const bucketOf = c => c.codePointAt(0) % BUCKETS;
const recog = [];
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function resample(pts, n){
  const seg = [0]; for (let i = 1; i < pts.length; i++) seg.push(seg[i-1] + Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]));
  const L = seg[seg.length-1]; if (!L) return Array(n).fill(pts[0]);
  const res = []; let j = 0;
  for (let k = 0; k < n; k++){ const t = L * k / (n-1); while (j < seg.length-2 && seg[j+1] < t) j++; const d = seg[j+1]-seg[j] || 1, f = (t-seg[j])/d; res.push([pts[j][0]+(pts[j+1][0]-pts[j][0])*f, pts[j][1]+(pts[j+1][1]-pts[j][1])*f]); }
  return res;
}
for (const c of charset){
  const j = JSON.parse(fs.readFileSync(path.join(HW, c + ".json"),"utf8"));
  buckets[bucketOf(c)][c] = {strokes:j.strokes, medians:j.medians, radStrokes:j.radStrokes};
  // Normalize like the recognizer does: y down, fit the longer side to 0..1, centred.
  const strokes = j.medians.map(m => m.map(p => [p[0], 900 - p[1]]));
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9; strokes.flat().forEach(([x,y]) => { minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y); });
  const sc = Math.max(maxX-minX, maxY-minY, 1), ox = (1-(maxX-minX)/sc)/2, oy = (1-(maxY-minY)/sc)/2;
  let enc = "";
  strokes.forEach(s => resample(s,6).forEach(([x,y]) => {
    const nx = Math.round(((x-minX)/sc+ox)*63), ny = Math.round(((y-minY)/sc+oy)*63);
    enc += ALPHA[Math.max(0,Math.min(63,nx))] + ALPHA[Math.max(0,Math.min(63,ny))];
  }));
  recog.push(c + enc);
}
buckets.forEach((b,i) => fs.writeFileSync(path.join(out,"strokes",`s${i}.js`), `HSK.strokeBucket(${JSON.stringify(b)});\n`));
fs.writeFileSync(path.join(out,"recog.js"), "HSK.recogRaw=" + JSON.stringify(recog.join("\n")) + ";\n");

// ---- Character facts from Make Me a Hanzi: radical, parts, pinyin, meaning
const chars = {};
for (const line of fs.readFileSync(path.join(src,"mmah-dictionary.txt"),"utf8").split("\n")){
  if (!line) continue; const j = JSON.parse(line);
  if (!charset.has(j.character)) continue;
  chars[j.character] = [j.radical||"", (j.decomposition||"").replace(/[？?]/g,""), (j.pinyin||[]).slice(0,3).join(", "), (j.definition||"").slice(0,90)];
}
fs.writeFileSync(path.join(out,"chars.js"), "HSK.chars=" + JSON.stringify(chars) + ";\n");

// ---- One clear example character per syllable and tone, for the pinyin chart
const deckRead = new Map();
HSK.decks.forEach(d => d.items.forEach(w => { const ch = Array.from(w[0]); if (ch.length === 1 && !/[…]/.test(w[0])) deckRead.set(w[0] + "|" + w[1].toLowerCase(), true); }));
const single = new Map();
for (const e of entries){ if (Array.from(e.hz).length !== 1 || e.cap) continue; if (!single.has(e.hz)) single.set(e.hz, new Set()); single.get(e.hz).add(e.py); }
const syll = {};
for (const [c, reads] of single){
  if (!charset.has(c)) continue;
  for (const py of reads){
    const inf = vm.runInContext(`syllInfo(${JSON.stringify(py)})`, ctx);
    if (!inf.tone || /r$/.test(inf.base) && inf.base !== "er") continue;
    const k = inf.base;
    const inDeck = deckRead.has(c + "|" + py);
    const s = (inDeck ? 1e6 : 0) + (reads.size === 1 ? 1000 : 0) + (charFreq.get(c)||0);
    syll[k] = syll[k] || [null,null,null,null];
    const cur = syll[k][inf.tone-1];
    if (!cur || cur[1] < s) syll[k][inf.tone-1] = [c, s];
  }
}
Object.keys(syll).forEach(k => { syll[k] = syll[k].map(x => x ? x[0] : ""); });
fs.writeFileSync(path.join(out,"syllables.js"), "HSK.syllables=" + JSON.stringify(syll) + ";\n");

const size = f => (fs.statSync(path.join(out,f)).size/1048576).toFixed(2)+"MB";
const sb = buckets.reduce((a,_,i) => a + fs.statSync(path.join(out,"strokes",`s${i}.js`)).size, 0);
console.log(`dict ${entries.length} entries ${size("dict.js")}; recog ${recog.length} chars ${size("recog.js")}; chars ${size("chars.js")}; syllables ${Object.keys(syll).length} ${size("syllables.js")}; strokes ${(sb/1048576).toFixed(1)}MB in ${BUCKETS} files`);
