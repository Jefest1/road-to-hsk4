// Checks the written content. Usage: node tools/check-content.js <path to cedict.txt>
// - pinyin lines up with the characters, and each reading exists in CC-CEDICT
// - every word in a sentence is taught in that lesson or earlier
// - grammar, Q&A and passage data are well formed
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "..");
const ctx = {window:{}, console}; ctx.window = ctx; vm.createContext(ctx);
for (const f of ["js/pinyin.js","data/decks.js","data/sentences.js","data/practice.js","data/basics.js"]) vm.runInContext(fs.readFileSync(path.join(root,f),"utf8"), ctx);
const {HSK, pySylls, syllInfo} = ctx;
const pinyinOf = n => n.replace(/u:/g,"ü").toLowerCase();

// char -> set of "base+tone" readings from CC-CEDICT, aligned by position
const readings = new Map();
const add = (c,r) => { if (!readings.has(c)) readings.set(c,new Set()); readings.get(c).add(r); };
for (const line of fs.readFileSync(process.argv[2],"utf8").split("\n")){
  const m = line.match(/^\S+ (\S+) \[([^\]]+)\]/); if (!m) continue;
  const ch = Array.from(m[1]), sy = m[2].split(" ");
  if (ch.length !== sy.length) continue;
  ch.forEach((c,i) => { const t = sy[i].match(/^([a-zA-Z:]+)([1-5])$/); if (t) add(c, pinyinOf(t[1]) + (t[2] === "5" ? 0 : +t[2])); });
}
const PUNCT = /[，。？！、：；“”…·\s\/（）()A-Za-z0-9\-]/g;
const issues = {pinyin:[], scope:[], data:[]};

function checkPinyin(hz, py, where){
  const chars = Array.from(hz.replace(PUNCT,""));
  const T = pySylls(py);
  const seq = [];
  // Merge erhua: 儿 after a syllable ending in r
  let i = 0;
  for (const s of T){
    if (i >= chars.length){ seq.push([null,s]); continue; }
    const er = /[^e]r$|^.+[ae]r$/.test(s.base) && s.base !== "er";
    seq.push([chars[i], er ? {base:s.base.replace(/r$/,""), tone:s.tone} : s]);
    i++;
    if (er && chars[i] === "儿") i++;
  }
  if (i !== chars.length || seq.some(x => !x[0])) { issues.pinyin.push(`${where}: ${chars.length} characters but ${T.length} syllables: ${hz} | ${py}`); return; }
  for (const [c,s] of seq){
    const set = readings.get(c); if (!set) { issues.pinyin.push(`${where}: no dictionary reading for ${c} in ${hz}`); continue; }
    const bases = new Set([...set].map(r => r.replace(/\d$/,"")));
    const b = s.base.replace(/([jqxy])ü/,"$1u");
    const has = [...bases].some(x => x.replace(/([jqxy])ü/,"$1u") === b);
    if (!has){ issues.pinyin.push(`${where}: ${c} read as ${s.base}${s.tone}, dictionary has ${[...set].join("/")} in ${hz}`); continue; }
    const okTone = s.tone === 0 || [...set].some(r => r.replace(/([jqxy])ü/,"$1u") === b + s.tone) || (c === "一" && (s.tone === 2 || s.tone === 4)) || (c === "不" && s.tone === 2);
    if (!okTone) issues.pinyin.push(`${where}: ${c} read as ${s.base}${s.tone}, dictionary has ${[...set].join("/")} in ${hz}`);
  }
}

// Vocabulary known at each lesson
const lessons = HSK.decks.filter(d => d.lesson > 0);
const NAMES = new Set(["李友","王朋","高文中","白英爱","常","高","王","李"]);
const known = {};
for (let n = 1; n <= 20; n++){
  const s = new Set(n > 1 ? known[n-1] : []);
  lessons.filter(d => d.lesson === n).forEach(d => d.items.forEach(w => { s.add(w[0]); w[0].split("…").forEach(p => s.add(p)); }));
  known[n] = s;
}
const clean = t => t.replace(/[，。？！、：；“”\s]/g,"");
const allowCompound = (t, set) => { // a tile made entirely of known single words is fine (大弟弟, 七口人)
  const ch = Array.from(t); const dp = Array(ch.length+1).fill(false); dp[0] = true;
  for (let i = 0; i < ch.length; i++) if (dp[i]) for (let L = 1; L <= ch.length - i; L++){ const w = ch.slice(i,i+L).join(""); if (set.has(w) || NAMES.has(w)) dp[i+L] = true; }
  return dp[ch.length];
};
const miss = new Map();
function checkScope(hz, n, where){
  for (const raw of hz.split("/")){
    const t = clean(raw); if (!t) continue;
    if (!allowCompound(t, known[n])){ issues.scope.push(`L${n} ${where}: "${t}" in ${hz.replace(/\//g,"")}`); miss.set(t,(miss.get(t)||0)+1); }
  }
}

let nS = 0;
for (const [n, list] of Object.entries(HSK.sentences)) list.forEach((s,i) => {
  nS++; checkPinyin(s[0], s[1], `sentence L${n}#${i}`); checkScope(s[0], +n, "sentence");
  if (!s[2]) issues.data.push(`sentence L${n}#${i} has no English`);
});
const scopeWhole = (t,n,w) => { const x = t.replace(/[，。？！、：；“”\s_a-zA-Z…()]/g,''); if (x && !allowCompound(x, known[n])) issues.scope.push(`L${n} ${w}: ${t}`); };
HSK.qa.forEach((q,i) => { checkPinyin(q[1],q[2],`qa#${i}q`); checkPinyin(q[4],q[5],`qa#${i}a`); scopeWhole(q[1],q[0],'qa'); scopeWhole(q[4],q[0],'qa'); });
HSK.grammar.forEach(g => { scopeWhole(g[1],g[0],'grammar'); g[3].forEach(o => scopeWhole(o,g[0],'grammar option')); });
HSK.passages.forEach(p => p.qs.forEach(q => { scopeWhole(q[0],p.l,'passage q'); q[2].forEach(o => scopeWhole(o,p.l,'passage option')); }));
HSK.passages.forEach((p,i) => {
  checkPinyin(p.hz,p.py,`passage#${i}`); checkScope(p.hz,p.l,`passage ${p.title}`);
  if (!p.tr) issues.data.push(`passage ${p.title} has no translation`);
  p.qs.forEach(q => { if (q.length !== 3 || q[2].length !== 3) issues.data.push(`passage ${p.title} bad question`); });
});
HSK.grammar.forEach((g,i) => { if (g.length !== 5 || g[3].length !== 3) issues.data.push(`grammar#${i} shape`); if (new Set(g[3]).size !== 3) issues.data.push(`grammar#${i} duplicate options: ${g[1]}`); });
HSK.decks.forEach(d => d.items.forEach(w => { if (!/…/.test(w[0])) checkPinyin(w[0], w[1], `deck ${d.id}`); }));
if (HSK.radicals.length !== 214) issues.data.push(`radicals: ${HSK.radicals.length}, expected 214`);
let start = 0; HSK.radicalStrokes.forEach(([s,c]) => { start += c; }); if (start !== 214) issues.data.push("radicalStrokes do not add up");

const seen = {};
for (const [k,v] of Object.entries(issues)){ console.log(`\n== ${k}: ${v.length}`); v.slice(0, +process.argv[3] || 120).forEach(x => console.log("  " + x)); }
console.log(`\nWords not yet taught (add to a deck or reword): ${[...miss.entries()].sort((a,b)=>b[1]-a[1]).map(([t,c])=>t+"×"+c).join(" ")}`);
const nW = new Set(); lessons.forEach(d => d.items.forEach(w => nW.add(w[0])));
console.log(`\nTotals: ${lessons.length} lesson decks, ${nW.size} lesson words, ${nS} sentences, ${HSK.qa.length} Q&A, ${HSK.grammar.length} grammar, ${HSK.passages.length} passages, ${HSK.radicals.length} radicals`);
