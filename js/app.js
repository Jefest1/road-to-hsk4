(function(){
"use strict";
const APP_VERSION = "2.0.0";

// ---------- Small helpers ----------
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rand = n => Math.floor(Math.random()*n);
const shuffle = a => { a = a.slice(); for (let i = a.length-1; i > 0; i--){ const j = rand(i+1); [a[i],a[j]] = [a[j],a[i]]; } return a; };
const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset()*60000)/86400000);
const days = n => n <= 0 ? "today" : n === 1 ? "1 day" : n + " days";
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const isZh = s => /[㐀-鿿]/.test(s);
const cleanTile = t => t.replace(/[，。？！、：；“”\s]/g,"");
function readJSON(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } }
function writeJSON(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
const scripts = {};
function loadScript(src){
  if (!scripts[src]) scripts[src] = new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = () => ok(); s.onerror = () => { delete scripts[src]; no(new Error("load " + src)); }; document.head.appendChild(s); });
  return scripts[src];
}
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.6 6a8 8 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const playBtn = (text, cls, label) => `<button class="play ${cls||""}" data-act="say" data-text="${esc(text)}" aria-label="${esc(label||"Play pronunciation")}">${SPEAKER}</button>`;
const strokeBtn = hz => `<button class="ghost sm" data-act="strokes" data-hz="${esc(hz)}">Strokes</button>`;
function pyHTML(py){
  let out = "", buf = "";
  const flush = () => { if (!buf) return; splitChunk(buf).forEach(s => { out += `<span class="t${syllInfo(s).tone}">${esc(s)}</span>`; }); buf = ""; };
  for (const c of py){ if (isLetter(c)) buf += c; else { flush(); out += esc(c); } }
  flush();
  return out;
}
const syllsHTML = arr => arr.map((s, k) => (k > 0 && /^[aeo]/.test(s.base) ? "'" : "") + `<span class="t${s.tone}">${esc(markSyl(s.base, s.tone))}</span>`).join("");
function hzBlock(hz, playable){
  const chars = Array.from(hz);
  const inner = (chars.length <= 4 && !/[，。？！、：…,.?!\s]/.test(hz))
    ? `<div class="grid g${chars.length}" lang="zh-CN">${chars.map(c => `<span class="cell"><i>${esc(c)}</i></span>`).join("")}</div>`
    : `<p class="sent" lang="zh-CN">${esc(hz)}</p>`;
  return playable ? `<button class="hzbtn" data-act="say" data-text="${esc(hz)}" aria-label="Play ${esc(hz)}" title="Tap to hear it">${inner}</button>` : inner;
}
const seg = (act, opts, cur) => `<div class="seg" role="group">${opts.map(([v,l]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${v===cur}">${esc(l)}</button>`).join("")}</div>`;

// ---------- Content tables ----------
const POS = {pr:"pronoun",adj:"adjective",v:"verb",n:"noun","v/n":"verb / noun","n/v":"noun / verb","n/adj":"noun / adjective",qp:"question particle",qpr:"question word",m:"measure word",nu:"number",adv:"adverb",p:"particle",conj:"conjunction",pn:"name",phrase:"phrase",t:"time word",prep:"preposition"};
const INTERVALS = [0,1,2,4,7,14,30,60], NEW_PER = 10, H24 = 864e5, H26 = 936e5;
const MINE = {id:"mine", lesson:0, group:"mine", name:"My words", note:"saved from Look up", items:[]};
const DECKS = HSK.decks.concat([MINE]);
const DECK_BY_ID = Object.fromEntries(DECKS.map(d => [d.id, d]));
const firstRead = new Map();
const makeItem = (a, deck) => {
  const hz = a[0], py = a[1];
  if (!firstRead.has(hz)) firstRead.set(hz, py.toLowerCase());
  return {hz, py, en:a[2], pos:a[3]||"", deck, k: firstRead.get(hz) === py.toLowerCase() ? hz : hz + "|" + py.toLowerCase()};
};
const BY_DECK = {};
HSK.decks.forEach(d => { BY_DECK[d.id] = d.items.map(a => makeItem(a, d.id)); });
BY_DECK.mine = [];
const DICT = new Map(), WORDS = [];
const seenK = new Set();
HSK.decks.forEach(d => BY_DECK[d.id].forEach(it => { if (!DICT.has(it.hz)) DICT.set(it.hz, it); if (!seenK.has(it.k)){ seenK.add(it.k); WORDS.push(it); } }));
const SENT = [];
Object.keys(HSK.sentences).forEach(n => HSK.sentences[n].forEach(s => {
  const tiles = s[0].split("/").map(cleanTile).filter(Boolean);
  const hz = s[0].replace(/\//g,"");
  SENT.push({hz, py:s[1], en:s[2], lesson:+n, tiles, k:"s:"+hz, len:Array.from(tiles.join("")).length});
}));
const QA = HSK.qa.map((q,i) => ({lesson:q[0], q:q[1], qpy:q[2], qen:q[3], a:q[4], apy:q[5], aen:q[6], k:"q:"+i}));
const GRAM = HSK.grammar.map((g,i) => ({lesson:g[0], q:g[1], en:g[2], opts:g[3], why:g[4], k:"g:"+g[1]}));

// ---------- Preferences (this browser) ----------
const UI_KEY = "road-hsk4-ui-v1", PROG_KEY = "road-hsk4-progress-v1";
const PRESETS = [
 ["My family intro","大家好！我是加纳人。我家有七口人：爸爸、妈妈、两个弟弟、两个妹妹和我。我是大哥。这张照片是我家的照片。这是我爸爸，我爸爸是老师。这是我妈妈，我妈妈是商人。这是我女朋友，她是律师。我的两个妹妹都是学生。我大妹妹是大学生，我小妹妹是小学生。我大弟弟做建筑工作。我小弟弟也是学生，他是高中生。谢谢！再见！"],
 ["Four tones","妈，麻，马，骂。八，拔，把，爸。"],
 ["Numbers 1–10","一，二，三，四，五，六，七，八，九，十。"],
 ["Days of the week","星期一，星期二，星期三，星期四，星期五，星期六，星期天。"],
 ["Greetings","你好！请问，您贵姓？你叫什么名字？谢谢！不客气！再见！"]
];
const ui = Object.assign({view:"home", studyMode:"cards", pmode:null, selected:null, pickMode:"multi", goal:40, theme:"system", reminders:true,
  slow:false, voice:null, pinyinFront:false, cardDir:"read", listenSrc:"words", listenSub:"pick", toneSub:"syll", listFilter:"all", sentLen:"all", trDir:"zh", basicsTab:"pinyin", radTab:"browse", lkTab:"lookup", sayText:PRESETS[0][1]}, readJSON(UI_KEY) || {});
const classIds = HSK.decks.filter(d => d.group === "class").map(d => d.id);
if (!Array.isArray(ui.selected)){
  // Older versions kept "up to lesson X" plus extras. Keep what was picked, and add L3 D2 now that the class has done it.
  const order = HSK.decks.filter(d => d.lesson > 0).map(d => d.id);
  let picked = classIds.slice();
  if (ui.upTo && order.includes(ui.upTo)){ picked = order.slice(0, order.indexOf(ui.upTo)+1); classIds.forEach(id => { if (!picked.includes(id)) picked.push(id); }); }
  (Array.isArray(ui.extras) ? ui.extras : []).forEach(id => { if (DECK_BY_ID[id] && id !== "sent") picked.push(id); });
  ui.selected = picked;
}
ui.selected = ui.selected.filter(id => DECK_BY_ID[id]);
if (!ui.selected.length) ui.selected = classIds.slice();
if (!["home","lessons","study","practice","basics","lookup","settings"].includes(ui.view)) ui.view = "home";
if (!["cards","strokes","write","free"].includes(ui.studyMode)) ui.studyMode = "cards";
ui.view = "home"; ui.pmode = null;
ui.goal = Math.max(10, Math.min(300, +ui.goal || 40));
const saveUI = () => writeJSON(UI_KEY, ui);
let themeTouched = false;
function applyTheme(){
  const root = document.documentElement;
  if (ui.theme === "dark" || ui.theme === "light"){ root.setAttribute("data-theme", ui.theme); themeTouched = true; }
  else if (themeTouched){ root.removeAttribute("data-theme"); themeTouched = false; }
}

// ---------- Progress ----------
function blankProgress(){ return {cards:{}, days:[], daily:{}, tones:[[0,0],[0,0],[0,0],[0,0],[0,0]], mine:[], lastAt:0, streak:0, streakDay:0, updatedAt:0}; }
function serialize(p){
  const t = today(), daily = {};
  Object.entries(p.daily).forEach(([d,n]) => { if (+d > t - 60) daily[d] = n; });
  return {v:3, updatedAt:p.updatedAt, days:p.days.slice(-120), daily, tones:p.tones, mine:p.mine, lastAt:p.lastAt, streak:p.streak, streakDay:p.streakDay,
    cards:Object.entries(p.cards).map(([h,c]) => [h, c.b, c.due, c.r, c.w, c.t])};
}
function deserialize(o){
  const p = blankProgress();
  if (!o || typeof o !== "object") return p;
  if (Array.isArray(o.cards)) o.cards.forEach(a => { if (Array.isArray(a) && typeof a[0] === "string") p.cards[a[0]] = {b:+a[1]||0, due:+a[2]||0, r:+a[3]||0, w:+a[4]||0, t:+a[5]||0}; });
  if (Array.isArray(o.days)) p.days = o.days.filter(n => typeof n === "number");
  if (o.daily && typeof o.daily === "object") Object.entries(o.daily).forEach(([d,n]) => { if (/^\d+$/.test(d) && typeof n === "number") p.daily[d] = n; });
  if (Array.isArray(o.tones) && o.tones.length === 5) p.tones = o.tones.map(x => Array.isArray(x) ? [+x[0]||0, +x[1]||0] : [0,0]);
  if (Array.isArray(o.mine)) p.mine = o.mine.filter(a => Array.isArray(a) && typeof a[0] === "string");
  p.updatedAt = +o.updatedAt || 0;
  p.lastAt = +o.lastAt || 0; p.streak = +o.streak || 0; p.streakDay = +o.streakDay || 0;
  if (!p.lastAt && p.days.length){
    // Saved before the 26-hour rule: count back through study days once.
    p.lastAt = Math.max(0, ...Object.values(p.cards).map(c => c.t));
    const s = new Set(p.days); let d = Math.max(...p.days), n = 0; p.streakDay = d;
    while (s.has(d)){ n++; d--; }
    p.streak = n;
  }
  return p;
}
let progress = deserialize(readJSON(PROG_KEY));
function syncMine(){ BY_DECK.mine = progress.mine.map(a => makeItem(a, "mine")); }
syncMine();
function mergeIn(other){
  Object.entries(other.cards).forEach(([h,c]) => { const m = progress.cards[h]; if (!m || c.t > m.t) progress.cards[h] = c; });
  progress.days = Array.from(new Set(progress.days.concat(other.days))).sort((a,b) => a-b).slice(-120);
  Object.entries(other.daily).forEach(([d,n]) => { progress.daily[d] = Math.max(progress.daily[d] || 0, n); });
  const sum = t => t.reduce((s,x) => s + x[0] + x[1], 0);
  if (sum(other.tones) > sum(progress.tones)) progress.tones = other.tones;
  other.mine.forEach(a => { if (!progress.mine.some(b => b[0] === a[0] && b[1] === a[1])) progress.mine.push(a); });
  if (other.lastAt > progress.lastAt){ progress.lastAt = other.lastAt; progress.streak = other.streak; progress.streakDay = other.streakDay; }
  progress.updatedAt = Math.max(progress.updatedAt, other.updatedAt);
  syncMine();
}
let remote = null, syncState = "local", saveTimer = null, saving = false, again = false;
function tellApp(){ if (window.hsk && window.hsk.setStreak) window.hsk.setStreak({lastAt:progress.lastAt, streak:progress.streak}); }
function save(){
  progress.updatedAt = Date.now();
  writeJSON(PROG_KEY, serialize(progress));
  tellApp();
  if (remote){ clearTimeout(saveTimer); saveTimer = setTimeout(flush, 2500); }
}
async function flush(){
  if (!remote) return;
  if (saving){ again = true; return; }
  saving = true;
  try { await remote.set(serialize(progress)); syncState = "account"; }
  catch(e){ if (e && e.code === "unavailable") setTimeout(flush, 4000 + rand(3000)); else { remote = null; syncState = "local"; } }
  saving = false;
  if (again){ again = false; flush(); }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && remote && saveTimer){ clearTimeout(saveTimer); saveTimer = null; flush(); } });
async function initRemote(){
  if (!window.claude || typeof window.claude.use !== "function") return;
  try {
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!db || !user) return;
    const uid = await user.id();
    if (!uid) return;
    const ref = db.doc("data/users/" + uid + "/progress");
    const snap = await ref.get();
    const before = JSON.stringify(serialize(progress));
    if (snap.exists) mergeIn(deserialize(snap.data()));
    remote = ref; syncState = "account";
    writeJSON(PROG_KEY, serialize(progress));
    const theirs = snap.exists ? JSON.stringify(serialize(deserialize(snap.data()))) : "";
    if (JSON.stringify(serialize(progress)) !== theirs) flush();
    if (JSON.stringify(serialize(progress)) !== before){ cq = null; renderAll(); }
  } catch(e){ remote = null; syncState = "local"; }
}
const card = k => progress.cards[k];
function markDay(){
  const t = today(), now = Date.now();
  if (!progress.days.includes(t)) progress.days.push(t);
  progress.daily[t] = (progress.daily[t] || 0) + 1;
  // Streak: gone once 26 hours pass with no study. Otherwise each new calendar day adds one.
  if (progress.lastAt && now - progress.lastAt > H26) progress.streak = 1;
  else if (progress.streakDay !== t) progress.streak = (progress.streak || 0) + 1;
  progress.streakDay = t; progress.lastAt = now;
}
const streakNow = () => (!progress.lastAt || Date.now() - progress.lastAt > H26) ? 0 : (progress.streak || 0);
function review(k, g){
  const t = today(), c = card(k) ? {...card(k)} : {b:0, due:t, r:0, w:0, t:0};
  if (g === 0){ c.b = 0; c.due = t; c.w++; }
  else { c.b = Math.min(7, c.b + (g === 2 ? 2 : 1)); c.due = t + INTERVALS[c.b]; c.r++; }
  c.t = Date.now(); progress.cards[k] = c; markDay(); save();
}
function quizResult(k, ok){
  const t = today(), c = card(k) ? {...card(k)} : {b:0, due:t, r:0, w:0, t:0};
  if (ok) c.r++; else { c.w++; c.b = Math.max(0, c.b - 1); c.due = t; }
  c.t = Date.now(); progress.cards[k] = c; markDay(); save();
}
function status(k){
  const c = card(k);
  if (!c) return "new";
  if (c.w > c.r || (c.b === 0 && c.w > 0)) return "weak";
  return c.b >= 3 ? "known" : "learning";
}

// ---------- Scope: what the current lesson selection covers ----------
function selectedItems(){
  const seen = new Set(), out = [];
  DECKS.forEach(d => { if (ui.selected.includes(d.id)) BY_DECK[d.id].forEach(it => { if (!seen.has(it.k)){ seen.add(it.k); out.push(it); } }); });
  return out;
}
function lessonScope(){
  const s = new Set(ui.selected.map(id => DECK_BY_ID[id].lesson).filter(n => n > 0));
  if (!s.size){
    const top = ui.selected.includes("hsk2") ? 10 : ui.selected.includes("hsk1") ? 5 : 3;
    for (let n = 1; n <= top; n++) s.add(n);
  }
  return s;
}
function scopeLabel(){
  const sel = DECKS.filter(d => ui.selected.includes(d.id));
  if (sel.length === 1) return sel[0].name;
  const nums = new Set(sel.filter(d => d.lesson > 0).map(d => d.lesson));
  const extra = sel.filter(d => !d.lesson).length;
  const lessons = [...nums].sort((a,b) => a-b);
  const contiguous = lessons.length > 1 && lessons[lessons.length-1] - lessons[0] === lessons.length - 1;
  let t = lessons.length === 0 ? "" : contiguous ? `L${lessons[0]}–${lessons[lessons.length-1]}` : lessons.length === 1 ? `L${lessons[0]}` : lessons.length + " lessons";
  if (extra) t += (t ? " + " : "") + extra + " list" + (extra > 1 ? "s" : "");
  return t;
}
function sentencesInScope(){
  const s = lessonScope();
  let list = SENT.filter(x => s.has(x.lesson));
  if (ui.sentLen === "short") list = list.filter(x => x.len < 14);
  else if (ui.sentLen === "long") list = list.filter(x => x.len >= 14);
  return list.length ? list : SENT.filter(x => s.has(x.lesson));
}
function pickWeighted(pool, recent, keyOf){
  keyOf = keyOf || (x => x.k);
  if (!pool.length) return null;
  const avoid = new Set(recent.slice(-Math.min(6, Math.max(0, pool.length - 1))));
  const cand = pool.filter(x => !avoid.has(keyOf(x)));
  const ws = cand.map(x => { const c = card(keyOf(x)); if (!c) return 2; let w = 1; if (c.w > c.r) w += 3; if (c.b <= 1) w += 1.5; if (c.b >= 4) w *= .5; return w; });
  let r = Math.random() * ws.reduce((a,b) => a+b, 0), chosen = cand[cand.length-1];
  for (let k = 0; k < cand.length; k++){ r -= ws[k]; if (r <= 0){ chosen = cand[k]; break; } }
  recent.push(keyOf(chosen)); if (recent.length > 24) recent.shift();
  return chosen;
}
function statsNow(){
  const t = today(), items = selectedItems();
  let known = 0, learning = 0, due = 0;
  WORDS.forEach(it => { const c = card(it.k); if (!c) return; if (c.b >= 3) known++; else learning++; });
  items.forEach(it => { const c = card(it.k); if (c && c.due <= t) due++; });
  const weak = items.filter(it => status(it.k) === "weak").sort((a,b) => (card(b.k).w - card(b.k).r) - (card(a.k).w - card(a.k).r));
  const newLeft = items.filter(i => !card(i.k)).length;
  const since = progress.lastAt ? Date.now() - progress.lastAt : 0;
  return {t, due, known, learning, streak:streakNow(), todayN:progress.daily[t] || 0, newLeft, weak, total:items.length, since, msLeft: H26 - since};
}
const fmtLeft = ms => { const m = Math.max(0, Math.round(ms/60000)); return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`; };

// ---------- Speech ----------
const hasTTS = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
let voice = null, zhVoices = [], voicesChecked = false, interacted = false, booted = false;
function loadVoices(){
  if (!hasTTS) return;
  const vs = speechSynthesis.getVoices() || [];
  const zh = vs.filter(v => /^(zh|cmn)/i.test(v.lang) && !/hk|yue|mo|tw/i.test(v.lang));
  const rank = v => (/zh[-_]cn|cmn|hans/i.test(v.lang) ? 4 : 0) + (/natural|online|neural/i.test(v.name) ? 3 : 0) + (/google/i.test(v.name) ? 2 : 0) + (/xiaoxiao|yunxi|yaoyao|tingting|lili/i.test(v.name) ? 1 : 0) + (/desktop/i.test(v.name) ? -1 : 0);
  zh.sort((a,b) => rank(b) - rank(a));
  zhVoices = zh;
  const before = voice;
  voice = zh.find(v => v.name === ui.voice) || zh[0] || null;
  if (vs.length) voicesChecked = true;
  if (before !== voice && booted){ renderBanner(); if (ui.view === "settings") renderStage(); }
}
function speak(text, slow){
  if (!hasTTS || !text) return;
  const clean = String(text).replace(/…/g, "，");
  const parts = clean.length > 60 ? clean.split(/(?<=[。！？])/).filter(Boolean) : [clean];
  try { speechSynthesis.cancel(); } catch(e){}
  setTimeout(() => parts.forEach(p => {
    const u = new SpeechSynthesisUtterance(p);
    u.lang = voice ? voice.lang : "zh-CN";
    if (voice) u.voice = voice;
    u.rate = (slow === undefined ? ui.slow : slow) ? 0.6 : 0.9;
    try { speechSynthesis.speak(u); } catch(e){}
  }), 40);
}
const voiceProblem = () => !hasTTS || (voicesChecked && !voice);
function renderBanner(){
  const el = $("voiceBanner");
  if (!voiceProblem()){ el.innerHTML = ""; return; }
  const why = hasTTS ? "No Mandarin voice on this device, so audio is silent." : "This browser can't play speech.";
  el.innerHTML = `<div class="notice" role="status"><details><summary>${why} How to fix it</summary>
    <ul><li><strong>Quickest:</strong> open this page in Google Chrome or Microsoft Edge. Both come with Mandarin voices.</li>
    <li><strong>Phone:</strong> iPhone: Settings → Accessibility → Spoken Content → Voices → Chinese. Android: Settings → Text-to-speech → install Chinese.</li>
    <li><strong>Windows:</strong> Settings → Time &amp; language → Speech → Add voices → Chinese (Simplified, China), then restart the app.</li></ul>
    <button class="ghost sm" data-act="test">Test sound</button></details></div>`;
}

// ---------- Shell ----------
const ICONS = {
  home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  lessons:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 7h6M9 11h6"/>',
  study:'<rect x="3" y="5" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>',
  practice:'<path d="M9 11l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
  basics:'<path d="M4 14l4-9 4 9M5.5 11h5M14 5h6M17 5v14M14 19h6"/>',
  lookup:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M2 12h3M19 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/>'
};
const icon = v => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[v]}</svg>`;
const VIEWS = [["home","Today"],["lessons","Lessons"],["study","Study"],["practice","Practice"],["basics","Basics"],["lookup","Look up"],["settings","Settings"]];
const TITLES = {home:["Today","Your plan for this session"], lessons:["Lessons","Pick what you want to learn"], study:["Study","Learn characters: reading, strokes and writing"], practice:["Practice","Questions from the lessons you picked"], basics:["Basics","The sounds and building blocks of Chinese"], lookup:["Look up","English, pinyin or characters"], settings:["Settings","Audio, goals and progress"]};
function renderNav(){
  const s = statsNow();
  $("nav").innerHTML = `<div class="logo"><div class="seal" lang="zh-CN" aria-hidden="true">学</div><div><b>Road to HSK</b><small>v${APP_VERSION}</small></div></div>` +
    VIEWS.map(([v,l], i) => (i === 6 ? '<div class="spacer"></div>' : "") + `<button class="navbtn" data-view="${v}" aria-current="${ui.view === v ? "page" : "false"}">${icon(v)}<span>${l}</span>${v === "study" && s.due ? `<span class="cnt">${s.due}</span>` : ""}</button>`).join("");
  const [title, sub] = TITLES[ui.view];
  $("pageTitle").textContent = title; $("pageSub").textContent = sub;
  const risk = s.streak && s.since >= H24;
  $("pills").innerHTML = `<span class="pill" title="Answers today / daily goal"><b>${s.todayN}</b>/${ui.goal} today</span>
    <span class="pill${risk ? " risk" : s.streak ? " hot" : ""}" title="Streak ends after 26 hours without study"><b>${s.streak}</b> day${s.streak === 1 ? "" : "s"}${risk ? " · " + fmtLeft(s.msLeft) + " left" : ""}</span>
    <button class="pill" data-view="lessons" title="Change lessons">${esc(scopeLabel())}</button>`;
}
function renderAll(){ applyTheme(); renderNav(); renderStage(); renderBanner(); }
const stage = $("stage");
function renderStage(){
  ({home:renderHome, lessons:renderLessons, study:renderStudy, practice:renderPractice, basics:renderBasics, lookup:renderLookup, settings:renderSettings}[ui.view] || renderHome)();
}
function goView(v){
  ui.view = v; resetArmed = false; saveUI(); renderNav(); renderStage(); focusInput();
  try { window.scrollTo(0, 0); } catch(e){}
}
function setSelection(ids){ ui.selected = ids.length ? ids : ui.selected; saveUI(); resetModes(); renderNav(); }
let cq = null;
function resetModes(){ cq = null; Object.values(PS).forEach(s => { s.cur = null; s.q = null; s.ans = null; }); wr.cur = null; st.cur = null; rd.p = null; quiz.list = null; }

// ---------- Today ----------
function ringSVG(frac){
  const r = 23, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return `<svg class="ring" viewBox="0 0 54 54" aria-hidden="true"><circle class="bg" cx="27" cy="27" r="${r}"/><circle class="fg" cx="27" cy="27" r="${r}" stroke-dasharray="${(c*f).toFixed(1)} ${c.toFixed(1)}"/></svg>`;
}
function chartSVG(){
  const t = today(), ds = []; for (let k = 13; k >= 0; k--) ds.push(t - k);
  const max = Math.max(ui.goal, ...ds.map(d => progress.daily[d] || 0));
  const W = 420, H = 84, pad = 14, bw = (W - 2*pad) / 14, gy = H - 18 - (ui.goal / max) * (H - 30);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Answers per day, last 14 days">
    <line x1="${pad}" x2="${W-pad}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" stroke-dasharray="3 3"/>
    ${ds.map((d, k) => { const n = progress.daily[d] || 0, h = n ? Math.max(2, (n / max) * (H - 30)) : 0; return `<rect class="${d === t ? "today" : ""}" x="${(pad + k*bw + 2).toFixed(1)}" y="${(H - 18 - h).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>`; }).join("")}
    <text x="${pad}" y="${H-4}">2 weeks ago</text><text x="${W-pad}" y="${H-4}" text-anchor="end">today</text></svg>`;
}
const DRILLS = [["pinyin","Type pinyin with tones"],["listen","Listen and choose"],["tones","Train your ear on tones"],["grammar","Fill the grammar gap"],["translate","Build sentences from English"],["answer","Choose the natural reply"],["read","Read a short passage"]];
function renderHome(){
  const s = statsNow();
  let heroT, heroP, heroBtn;
  if (s.due){ heroT = `${s.due} ${s.due === 1 ? "word is" : "words are"} due for review`; heroP = "Reviews come first: they keep what you learned from fading."; heroBtn = `<button class="primary" data-act="go-review">Start reviews</button>`; }
  else if (s.newLeft){ heroT = `Nothing due. Learn ${Math.min(NEW_PER, s.newLeft)} new words?`; heroP = `${s.newLeft} words in ${esc(scopeLabel())} are still new to you.`; heroBtn = `<button class="primary" data-act="go-new">Learn new words</button>`; }
  else { heroT = "You're caught up"; heroP = "Every word you picked has been reviewed. Take the quiz, or pick the next lesson."; heroBtn = `<button class="primary" data-act="go-mode" data-m="quiz">Take the quiz</button>`; }
  const drill = DRILLS[s.t % DRILLS.length];
  const items = selectedItems().filter(i => !/…/.test(i.hz));
  const ofDay = items.length ? items[s.t % items.length] : null;
  const dayCh = ofDay ? Array.from(ofDay.hz)[0] : null;
  const MAX = 1200, marks = [[150,"HSK 1"],[300,"HSK 2"],[600,"HSK 3"],[1200,"HSK 4"]], next = marks.find(([n]) => n > s.known) || marks[3];
  const risk = s.streak && s.since >= H24;
  stage.innerHTML = `<div class="set">
    ${risk ? `<div class="notice risk"><strong>Your ${s.streak}-day streak ends in ${fmtLeft(s.msLeft)}.</strong> One answer keeps it going.</div>` : ""}
    <section class="hero"><div><h2>${heroT}</h2><p>${heroP}</p></div>${heroBtn}</section>
    <div class="tiles">
      <div class="tile goal">${ringSVG(s.todayN / ui.goal)}<div><span class="label">Daily goal</span><span class="v">${s.todayN}<small> / ${ui.goal}</small></span><span class="d">${s.todayN >= ui.goal ? "Done for today." : (ui.goal - s.todayN) + " answers to go"}</span></div></div>
      <div class="tile"><span class="label">Streak</span><span class="v">${s.streak}<small> ${s.streak === 1 ? "day" : "days"}</small></span><span class="d">${s.streak ? (s.since < H24 ? "Study again within " + fmtLeft(s.msLeft) : "Almost over") : "Answer one question to start."}</span></div>
      <div class="tile"><span class="label">Words known</span><span class="v">${s.known}<small> / ${next[0]}</small></span><span class="d">${next[0] - s.known} more to ${next[1]}</span></div>
    </div>
    <section class="panel section"><h3>Today's plan</h3><div class="plan">
      <div class="item"><span class="dotn${s.due ? "" : " done"}">${s.due ? "1" : "✓"}</span><div><b>Review</b><small>${s.due ? s.due + " due" : "Nothing due"}</small></div><button class="ghost sm" data-act="go-review">Open</button></div>
      <div class="item"><span class="dotn">2</span><div><b>New words</b><small>${s.newLeft ? s.newLeft + " left in " + esc(scopeLabel()) : "All seen"}</small></div><button class="ghost sm" data-act="go-new">Learn</button></div>
      <div class="item"><span class="dotn">3</span><div><b>Today's drill</b><small>${esc(drill[1])}</small></div><button class="ghost sm" data-act="go-mode" data-m="${drill[0]}">Start</button></div>
      ${dayCh ? `<div class="item"><span class="dotn">4</span><div><b>Character of the day: <span class="zh" lang="zh-CN">${esc(dayCh)}</span></b><small>See how it's written, stroke by stroke</small></div><button class="ghost sm" data-act="strokes" data-hz="${esc(dayCh)}">Study</button></div>` : ""}
    </div></section>
    ${s.weak.length ? `<section class="panel section"><h3>Words you keep missing <button class="link" data-act="go-weak">Review these</button></h3><div class="list">${s.weak.slice(0, 5).map(it => `<div class="item">${playBtn(it.hz)}<span class="hz" lang="zh-CN">${esc(it.hz)}</span><span class="py">${pyHTML(it.py)}</span><span class="en">${esc(it.en)}</span></div>`).join("")}</div></section>` : ""}
    <section class="panel section"><h3>Last two weeks <span class="muted" style="font-weight:400;font-size:.84rem">dashed line = goal</span></h3>${chartSVG()}</section>
    <section class="panel section"><div class="bar-row"><span><b>${s.known}</b> words known</span><span class="muted">${s.learning} learning</span></div>
      <div><div class="track"><div class="fill" style="width:${Math.min(100, s.known/MAX*100)}%"></div>${marks.map(([n], k) => `<span class="tick${k===3?" last":""}" style="left:${n/MAX*100}%"></span>`).join("")}</div>
      <div class="tlabels">${marks.map(([n,l], k) => `<span class="tl${k===3?" last":""}" style="left:${n/MAX*100}%"><b>${l}</b>${n}</span>`).join("")}</div></div>
      <p class="hint" style="font-size:.8rem">A word counts as known after you recall it in reviews spread over several days. Milestones are the classic HSK word totals.</p></section>
  </div>`;
}

// ---------- Lessons ----------
let openDeck = null;
const GROUPS = [["class","Covered in class"],["book","Coming up in the textbook"],["hsk","HSK word lists"],["mine","Saved by you"]];
function lessonRow(d){
  const items = BY_DECK[d.id], k = items.filter(it => status(it.k) === "known").length, on = ui.selected.includes(d.id), pct = items.length ? k/items.length*100 : 0;
  return `<div class="lrow${on ? " on" : ""}" data-act="pick" data-id="${d.id}" role="checkbox" aria-checked="${on}" tabindex="0">
    <span class="mark ${ui.pickMode === "multi" ? "multi" : "single"}">${on ? "✓" : ""}</span>
    <span><span class="nm">${esc(d.name)}</span> <span class="nt">${esc(d.note)}</span> <span class="lcount">${k}/${items.length}</span></span>
    <span class="acts">${ui.pickMode === "multi" && d.lesson ? `<button class="link" data-act="upto" data-id="${d.id}" title="Select everything up to this lesson">Up to here</button>` : ""}<button class="ghost sm" data-act="opendeck" data-id="${d.id}">Open</button></span>
    <span class="lbar"><i style="width:${pct}%"></i></span></div>`;
}
function renderLessons(){
  if (openDeck) return renderDeck();
  const n = selectedItems().length;
  stage.innerHTML = `<div class="set">
    <div class="panel"><div class="bar-row">${seg("pickmode", [["single","One lesson"],["multi","Several lessons"]], ui.pickMode)}<span class="score"><b>${esc(scopeLabel())}</b> · ${n} words</span></div>
      <div class="btnrow l"><button class="ghost sm" data-act="sel-class">All class lessons</button><button class="ghost sm" data-act="sel-all">All 20 lessons</button><button class="ghost sm" data-act="opendeck" data-id="__sel">See selected words</button><button class="primary sm" data-act="go-study-now">Study these</button></div>
    </div>
    ${GROUPS.map(([g, label]) => {
      const ds = DECKS.filter(d => d.group === g && (d.id !== "mine" || BY_DECK.mine.length));
      if (!ds.length) return "";
      return `<section class="panel section"><div><h3>${esc(label)}</h3>${g === "book" ? `<p class="hint" style="font-size:.84rem">Written from the textbook, not your teacher's slides, so they may differ slightly. Send me the slides when you reach them.</p>` : ""}</div><div>${ds.map(lessonRow).join("")}</div></section>`;
    }).join("")}</div>`;
}
function wordTable(items){
  const counts = {all:items.length, new:0, learning:0, known:0, weak:0};
  items.forEach(it => counts[status(it.k)]++);
  const shown = ui.listFilter === "all" ? items : items.filter(it => status(it.k) === ui.listFilter);
  return `<div class="bar-row">${seg("filter", [["all","All"],["new","New"],["learning","Learning"],["known","Known"],["weak","Weak"]].map(([v,l]) => [v, l + " " + counts[v]]), ui.listFilter)}</div>
    <div class="legend"><span><i class="dot new"></i>New</span><span><i class="dot learning"></i>Learning</span><span><i class="dot known"></i>Known</span><span><i class="dot weak"></i>Weak</span></div>
    ${shown.length ? `<div class="tablewrap"><table><thead><tr><th></th><th>字</th><th>Pinyin</th><th>Meaning</th><th></th></tr></thead><tbody>
    ${shown.map(it => `<tr><td><i class="dot ${status(it.k)}" title="${status(it.k)}"></i></td><td class="hz" lang="zh-CN">${esc(it.hz)}</td><td class="py">${pyHTML(it.py)}</td><td class="en">${esc(it.en)}</td><td class="ac">${playBtn(it.hz)} ${/…/.test(it.hz) ? "" : strokeBtn(it.hz)}</td></tr>`).join("")}
    </tbody></table></div>` : `<p class="hint">No words in this group.</p>`}`;
}
function renderDeck(){
  const sel = openDeck === "__sel", d = DECK_BY_ID[openDeck];
  const items = sel ? selectedItems() : BY_DECK[openDeck];
  const lesson = d && d.lesson, sCount = lesson ? SENT.filter(x => x.lesson === lesson).length : 0;
  stage.innerHTML = `<div class="set"><div class="panel">
    <div class="bar-row"><button class="link" data-act="closedeck">← All lessons</button>${d ? `<button class="primary sm" data-act="only" data-id="${d.id}">Study only this</button>` : ""}</div>
    <h3 style="font-size:1.15rem">${d ? esc(d.name) + " · " + esc(d.note) : "Selected words"}</h3>
    ${lesson ? `<p class="hint">${items.length} words · ${sCount} sentences · ${GRAM.filter(g => g.lesson === lesson).length} grammar questions · ${HSK.passages.filter(p => p.l === lesson).length} reading passage(s), shared across this lesson's dialogues.</p>` : ""}
    ${wordTable(items)}</div></div>`;
}

// ---------- Study: cards, strokes, write, free write ----------
const studyTabs = () => `<div class="bar-row">${seg("study", [["cards","Cards"],["strokes","Strokes"],["write","Write"],["free","Free write"]], ui.studyMode)}</div>`;
function renderStudy(){
  ({cards:renderCards, strokes:renderStrokes, write:renderWrite, free:renderFree}[ui.studyMode] || renderCards)();
}
function buildQueue(kind){
  const t = today(), items = selectedItems();
  let list;
  if (kind === "cram"){ const seen = items.filter(i => card(i.k)); list = shuffle(seen.length >= 5 ? seen : items).slice(0, 20); }
  else if (kind === "weak"){ const w = items.filter(i => status(i.k) === "weak"); list = shuffle(w.length ? w : items.filter(i => card(i.k))).slice(0, 20); kind = "cram"; }
  else if (kind === "more"){ list = items.filter(i => !card(i.k)).slice(0, NEW_PER); }
  else {
    const due = items.filter(i => { const c = card(i.k); return c && c.due <= t; }).sort((a,b) => card(a.k).due - card(b.k).due);
    list = due.concat(items.filter(i => !card(i.k)).slice(0, NEW_PER));
  }
  cq = {list, i:0, shown:false, done:0, again:0, cram:kind === "cram", auto:null};
}
const exIndex = new Map();
function exampleFor(it){
  if (!exIndex.size) SENT.forEach(s => s.tiles.forEach(t => { if (!exIndex.has(t)) exIndex.set(t, []); exIndex.get(t).push(s); }));
  const scope = lessonScope();
  const hits = (exIndex.get(it.hz) || []).slice().sort((a,b) => (scope.has(b.lesson) ? 1 : 0) - (scope.has(a.lesson) ? 1 : 0) || a.len - b.len);
  if (!hits.length) return "";
  const s = hits[0];
  return `<div class="answer" style="align-items:flex-start;text-align:left"><span class="label">In a sentence</span><div class="row" style="justify-content:flex-start">${playBtn(s.hz)}<span class="zh" style="font-size:1.2rem" lang="zh-CN">${esc(s.hz)}</span></div><span class="py" style="font-size:.96rem;font-weight:500">${pyHTML(s.py)}</span><span class="note">${esc(s.en)}</span></div>`;
}
function renderCards(){
  if (!cq) buildQueue();
  const dirs = seg("dir", [["read","Read 字"],["recall","English → 字"],["hear","Listen → 字"]], ui.cardDir);
  const it = cq.list[cq.i];
  if (!it){
    const left = selectedItems().filter(i => !card(i.k)).length;
    const msg = cq.list.length ? `Session done: ${cq.done} answers, ${cq.again} sent back for another look.` : "Nothing is due in these lessons right now.";
    stage.innerHTML = `<div class="set">${studyTabs()}<div class="panel c"><p class="en big">${esc(msg)}</p><p class="hint">${left} new ${left === 1 ? "word" : "words"} left in ${esc(scopeLabel())}.</p>
      <div class="btnrow">${left ? `<button class="primary" data-act="more">Learn ${Math.min(NEW_PER, left)} new words</button>` : ""}<button class="ghost" data-act="cram">Review 20 at random</button></div></div></div>`;
    return;
  }
  const c = card(it.k), isNew = !c, b = c ? c.b : 0;
  let front;
  if (ui.cardDir === "read") front = hzBlock(it.hz, cq.shown) + (ui.pinyinFront && !cq.shown ? `<p class="py big">${pyHTML(it.py)}</p>` : "");
  else if (ui.cardDir === "recall") front = `<p class="en big">${esc(it.en)}</p>${it.pos ? `<p class="pos">${esc(POS[it.pos] || it.pos)}</p>` : ""}${cq.shown ? "" : `<p class="hint">Say it out loud in Chinese, then check.</p>`}`;
  else front = `${playBtn(it.hz, "huge", "Play the word again")}${cq.shown ? "" : `<p class="hint">Listen, then picture the characters and the meaning.</p>`}`;
  const back = cq.shown ? `<div class="answer">${ui.cardDir !== "read" ? hzBlock(it.hz, true) : ""}
      <div class="row"><p class="py big">${pyHTML(it.py)}</p>${playBtn(it.hz)}${/…/.test(it.hz) ? "" : strokeBtn(it.hz)}</div>${ui.cardDir !== "recall" ? `<p class="en">${esc(it.en)}</p>` : ""}</div>${exampleFor(it)}` : "";
  const controls = cq.shown
    ? `<div class="grades"><button class="g again" data-act="grade" data-g="0">Again<small>${cq.cram ? "missed it" : "today"}</small></button>
       <button class="g good" data-act="grade" data-g="1" id="goodBtn">Good<small>${cq.cram ? "knew it" : days(INTERVALS[Math.min(7, b+1)])}</small></button>
       <button class="g easy" data-act="grade" data-g="2">Easy<small>${cq.cram ? "too easy" : days(INTERVALS[Math.min(7, b+2)])}</small></button></div>`
    : `<button class="primary wide" data-act="flip" id="flipBtn">Show answer <kbd>Space</kbd></button>`;
  stage.innerHTML = `<div class="set">${studyTabs()}<div class="bar-row">${dirs}<span class="score">${cq.i + 1} of ${cq.list.length}</span></div>
    <div class="panel c"><div class="bar-row wide"><span class="hint">${esc(DECK_BY_ID[it.deck].name)}</span>${isNew ? '<span class="src">New</span>' : ""}</div>
    <div class="face">${front}</div>${back}${controls}</div></div>`;
  if (ui.cardDir === "hear" && !cq.shown && interacted && cq.auto !== cq.i){ cq.auto = cq.i; speak(it.hz); }
}

// Stroke data and character study
HSK.strokeData = {};
HSK.strokeBucket = o => { Object.assign(HSK.strokeData, o); };
const strokeBucketOf = c => c.codePointAt(0) % 64;
async function strokeData(c){
  if (!HSK.strokeData[c]) { try { await loadScript(`data/gen/strokes/s${strokeBucketOf(c)}.js`); } catch(e){ return null; } }
  return HSK.strokeData[c] || null;
}
const charsReady = () => loadScript("data/gen/chars.js").catch(() => {});
const charFacts = c => (HSK.chars && HSK.chars[c]) || null;
function charPinyin(c){ const d = DICT.get(c); if (d) return d.py; const f = charFacts(c); return f ? f[2].split(",")[0].trim() : ""; }
function fanHTML(d){
  const n = d.strokes.length;
  return `<div class="fan" aria-label="Stroke order, ${n} strokes">${d.strokes.map((_, k) => `<svg viewBox="0 0 1024 1024" aria-hidden="true"><g transform="scale(1,-1) translate(0,-900)">${d.strokes.slice(0, k+1).map((p, i) => `<path class="${i === k ? "cur" : "old"}" d="${p}"/>`).join("")}</g></svg>`).join("")}</div>`;
}
let csWriter = null, csMsg = "";
function mountWriter(el, c){
  const size = Math.min(el.clientWidth || 220, 220);
  el.innerHTML = "";
  csWriter = HanziWriter.create(el, c, {width:size, height:size, padding:8, showOutline:true, strokeColor:css("--ink"), outlineColor:css("--line"), drawingColor:css("--t4"), highlightColor:css("--t1"), strokeAnimationSpeed:ui.slow ? .6 : 1, delayBetweenStrokes:ui.slow ? 500 : 280, charDataLoader:(ch, ok, no) => { strokeData(ch).then(d => d ? ok(d) : no(new Error("no stroke data"))); }});
}
async function fillCharStudy(host, hz, idx){
  const chars = Array.from(hz).filter(isZh);
  const c = chars[idx] || chars[0];
  csMsg = "";
  await charsReady();
  const d = await strokeData(c), f = charFacts(c), word = DICT.get(hz), py = charPinyin(c);
  const rad = f && f[0] ? radicalOf(f[0]) : null;
  const related = WORDS.filter(w => w.hz !== c && w.hz.includes(c)).slice(0, 6);
  host.innerHTML = `${chars.length > 1 ? `<div class="charpick">${chars.map((x,i) => `<button data-act="cs-pick" data-i="${i}" data-hz="${esc(hz)}" aria-pressed="${x === c && i === idx}">${esc(x)}</button>`).join("")}</div>` : ""}
    ${d ? `<div class="writer" id="csWriter"></div>
    <div class="btnrow"><button class="primary sm" data-act="cs-play">Play strokes</button><button class="ghost sm" data-act="cs-quiz">Trace it</button>${playBtn(c)}</div>
    <p class="hint" id="csNote">${d.strokes.length} stroke${d.strokes.length === 1 ? "" : "s"}. Red shows the stroke being added.</p>${fanHTML(d)}` : `<p class="en big zh" lang="zh-CN">${esc(c)}</p><p class="hint">No stroke data for this character.</p>`}
    <dl class="facts">
      ${py ? `<dt>Pinyin</dt><dd class="py">${pyHTML(py)}</dd>` : ""}
      <dt>Meaning</dt><dd>${esc(DICT.get(c) ? DICT.get(c).en : f ? f[3] : "")}</dd>
      ${word && hz !== c ? `<dt>In the word</dt><dd><span class="zh" lang="zh-CN">${esc(hz)}</span> ${pyHTML(word.py)}, ${esc(word.en)}</dd>` : ""}
      ${f && f[0] ? `<dt>Radical</dt><dd><span class="zh" lang="zh-CN">${esc(f[0])}</span>${rad ? ` ${esc(rad[2])}, ${esc(rad[3])}` : ""}</dd>` : ""}
      ${related.length ? `<dt>Also in</dt><dd class="zh" lang="zh-CN">${related.map(w => esc(w.hz)).join("、")}</dd>` : ""}
    </dl>`;
  if (d) mountWriter($("csWriter"), c);
}
function openChar(hz){
  const dlg = $("charDlg");
  dlg.innerHTML = `<div class="dlg"><div class="dlg-top"><b>How to write it</b><button class="ghost sm" data-act="cs-close">Close</button></div><div class="dlg" id="csHost" style="padding:0;align-self:stretch"><p class="hint">Loading…</p></div></div>`;
  if (dlg.showModal && !dlg.open) dlg.showModal();
  fillCharStudy($("csHost"), hz, 0);
}
function renderStrokes(){
  const pool = selectedItems().filter(i => !/…/.test(i.hz));
  if (!st.cur || !pool.includes(st.cur)) st.cur = pool[0] || null;
  if (!st.cur){ stage.innerHTML = `<div class="set">${studyTabs()}<div class="panel c"><p class="hint">Pick a lesson with words first.</p></div></div>`; return; }
  const idx = pool.indexOf(st.cur), it = st.cur;
  stage.innerHTML = `<div class="set">${studyTabs()}<div class="panel c">
    <div class="bar-row wide"><button class="ghost sm" data-act="st-prev" ${idx ? "" : "disabled"}>← Previous</button><span class="score">${idx+1} of ${pool.length}</span><button class="ghost sm" data-act="st-next" ${idx < pool.length-1 ? "" : "disabled"}>Next →</button></div>
    <div class="row"><span class="zh" style="font-size:1.6rem" lang="zh-CN">${esc(it.hz)}</span><span class="py">${pyHTML(it.py)}</span>${playBtn(it.hz)}</div><p class="note">${esc(it.en)}</p>
    <div class="dlg" id="csHost" style="padding:0;align-self:stretch"><p class="hint">Loading…</p></div></div></div>`;
  fillCharStudy($("csHost"), it.hz, 0);
}

// Drawing pad shared by Write and Free write
function makePad(canvas, strokes, onChange){
  const dpr = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr); ctx.lineWidth = Math.max(5, r.width / 40); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = css("--ink") || "#000";
  const redraw = () => { ctx.clearRect(0, 0, r.width, r.height); strokes.forEach(s => { ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); s.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(s[s.length-1][0] + .1, s[s.length-1][1]); ctx.stroke(); }); };
  redraw();
  let cur = null;
  const pos = e => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  canvas.addEventListener("pointerdown", e => { interacted = true; try { canvas.setPointerCapture(e.pointerId); } catch(x){} cur = [pos(e)]; ctx.beginPath(); ctx.moveTo(cur[0][0], cur[0][1]); ctx.lineTo(cur[0][0] + .1, cur[0][1]); ctx.stroke(); e.preventDefault(); });
  canvas.addEventListener("pointermove", e => { if (!cur) return; const p = pos(e), l = cur[cur.length-1]; if (Math.hypot(p[0]-l[0], p[1]-l[1]) < 1.5) return; ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); cur.push(p); });
  const up = () => { if (!cur) return; strokes.push(cur); cur = null; if (onChange) onChange(); };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  return {redraw};
}
const padHTML = (ch, revealed) => `<div class="padwrap${revealed ? " revealed" : ""}"><span class="cell" lang="zh-CN"><i>${esc(ch || "")}</i></span><canvas class="pad" id="pad" aria-label="Drawing area"></canvas></div>`;
const recogLoad = () => loadScript("data/gen/recog.js");
const preferSet = () => { const s = new Set(); WORDS.forEach(w => Array.from(w.hz).forEach(c => s.add(c))); return s; };
let PREFER = null;
function candHTML(c, hit, act){
  const py = charPinyin(c);
  return `<button class="cand${hit ? " hit" : ""}" data-act="${act}" data-c="${esc(c)}"><span class="zh" lang="zh-CN">${esc(c)}</span><small>${py ? pyHTML(py) : "&nbsp;"}</small></button>`;
}

// Write from memory
const wr = {cur:null, i:0, strokes:[], check:null, hits:[], recent:[], pad:null};
function nextWrite(){
  wr.cur = pickWeighted(selectedItems().filter(i => !/…/.test(i.hz) && Array.from(i.hz).filter(isZh).length <= 4 && Array.from(i.hz).every(isZh)), wr.recent);
  wr.i = 0; wr.strokes = []; wr.check = null; wr.hits = [];
}
function renderWrite(){
  if (!wr.cur) nextWrite();
  const it = wr.cur;
  if (!it){ stage.innerHTML = `<div class="set">${studyTabs()}<div class="panel c"><p class="hint">Pick a lesson with words first.</p></div></div>`; return; }
  const chars = Array.from(it.hz), ch = chars[wr.i], last = wr.i === chars.length - 1, b = card(it.k) ? card(it.k).b : 0;
  let controls;
  if (!wr.check) controls = `<div class="btnrow"><button class="ghost" data-act="pad-undo">Undo</button><button class="ghost" data-act="pad-clear">Clear</button><button class="primary" data-act="wr-check">Check <kbd>Space</kbd></button></div>`;
  else {
    const ck = wr.check, top = ck.cands[0];
    const verdict = !ck.drew ? `<div class="fb wrong"><strong>Nothing drawn.</strong> Here's the character.</div>`
      : ck.hit === 0 ? `<div class="fb right"><strong>Correct.</strong> It reads your writing as ${esc(ch)}.</div>`
      : ck.hit > 0 ? `<div class="fb tones"><strong>Close.</strong> ${esc(ch)} was among its guesses, but ${esc(top)} came first. Compare with the grey character.</div>`
      : `<div class="fb wrong"><strong>Not quite.</strong> This looks more like ${esc(top || "something else")}. Compare with the grey character.</div>`;
    controls = verdict + (ck.cands.length ? `<div class="cands">${ck.cands.map(c => candHTML(c, c === ch, "strokes")).join("")}</div>` : "") +
      `<div class="btnrow"><button class="ghost sm" data-act="strokes" data-hz="${esc(ch)}">Stroke order for ${esc(ch)}</button></div>` +
      (last ? `<div class="grades"><button class="g again" data-act="wr-grade" data-g="0">Again<small>today</small></button><button class="g good" data-act="wr-grade" data-g="1">Good<small>${days(INTERVALS[Math.min(7, b+1)])}</small></button><button class="g easy" data-act="wr-grade" data-g="2">Easy<small>${days(INTERVALS[Math.min(7, b+2)])}</small></button></div>`
            : `<button class="primary wide" data-act="wr-nextch">Next character</button>`);
  }
  stage.innerHTML = `<div class="set">${studyTabs()}<div class="panel c">
    <div class="row"><span class="py big">${pyHTML(it.py)}</span>${playBtn(it.hz)}</div><p class="note">${esc(it.en)}</p>
    ${chars.length > 1 ? `<p class="hint">Character ${wr.i+1} of ${chars.length}: ${chars.map((c,i) => i < wr.i ? esc(c) : "＿").join(" ")}</p>` : ""}
    ${padHTML(ch, !!wr.check)}${controls}</div></div>`;
  wr.pad = makePad($("pad"), wr.strokes);
}

// Free write: draw anything, see what it is
const fw = {strokes:[], cands:[], text:[], timer:null, pad:null, loading:false};
function fwRecognize(){
  clearTimeout(fw.timer);
  fw.timer = setTimeout(async () => {
    if (!fw.strokes.length){ fw.cands = []; drawFwCands(); return; }
    if (!HSK.recogReady()){ fw.loading = true; drawFwCands(); await recogLoad().catch(() => {}); await charsReady(); fw.loading = false; }
    PREFER = PREFER || preferSet();
    fw.cands = HSK.recognize(fw.strokes, 8, PREFER).map(x => x.c);
    drawFwCands();
  }, 250);
}
function drawFwCands(){
  const el = $("fwCands"); if (!el) return;
  el.innerHTML = fw.loading ? `<p class="hint">Loading handwriting data…</p>` : fw.cands.length ? fw.cands.map((c,i) => candHTML(c, i === 0, "fw-add")).join("") : `<p class="hint">Write one character in the box. Guesses appear here with pinyin under each. Tap the right one.</p>`;
}
function fwComposeHTML(){
  return fw.text.length ? fw.text.map(c => { const py = charPinyin(c); return `<span class="ch"><span class="zh" lang="zh-CN">${esc(c)}</span><small>${py ? pyHTML(py) : ""}</small></span>`; }).join("") : `<p class="hint">Characters you tap appear here.</p>`;
}
function renderFree(){
  const text = fw.text.join("");
  stage.innerHTML = `<div class="set">${studyTabs()}<div class="panel c">
    ${padHTML("", false)}
    <div class="btnrow"><button class="ghost" data-act="pad-undo">Undo</button><button class="ghost" data-act="pad-clear">Clear</button></div>
    <div class="cands" id="fwCands"></div>
    <div class="answer"><div class="compose">${fwComposeHTML()}</div>
      ${text ? `<div class="btnrow">${playBtn(text)}<button class="ghost sm" data-act="fw-lookup">Look it up</button><button class="ghost sm" data-act="fw-del">Delete last</button><button class="ghost sm" data-act="fw-reset">Start over</button></div>` : ""}</div>
    <p class="hint" style="font-size:.82rem">Recognition works best with correct stroke order and one character at a time. It can be wrong, so check the pinyin.</p></div></div>`;
  fw.pad = makePad($("pad"), fw.strokes, fwRecognize);
  drawFwCands();
}

// ---------- Practice ----------
const MODES = [
 ["Sounds",[["pinyin","Pinyin","Type the pinyin with tones"],["tones","Tones","Hear a sound, name the tone"],["listen","Listen","Words and sentences by ear"]]],
 ["Meaning",[["grammar","Grammar","Fill the gap"],["answer","Answer","Choose the natural reply"],["translate","Translate","English ↔ Chinese"],["read","Read","Short passages with questions"]]],
 ["Test",[["quiz","Quiz","15 mixed questions, like an exam"]]]
];
const MODE_NAMES = {}; MODES.forEach(g => g[1].forEach(m => { MODE_NAMES[m[0]] = m[1]; }));
const mkS = () => ({cur:null, q:null, ans:null, input:"", right:0, total:0, recent:[], auto:null});
const PS = {pinyin:mkS(), listen:mkS(), tones:mkS(), grammar:mkS(), answer:mkS(), translate:mkS()};
const st = {cur:null};
const rd = {p:null, i:0, recent:[], pop:null, showPy:false, showEn:false, qa:{}, opts:null};
const quiz = {list:null, i:0, right:0, q:null, ans:null, wrong:[]};
function renderPractice(){
  if (!ui.pmode){
    const sc = sentencesInScope().length;
    stage.innerHTML = `<div class="set"><div class="bar-row"><span class="score">Questions come from <b>${esc(scopeLabel())}</b>: ${selectedItems().length} words, ${sc} sentences.</span><button class="link" data-view="lessons">Change lessons</button></div>
      ${MODES.map(([g, ms]) => `<section><p class="label" style="margin-bottom:6px">${g}</p><div class="cards">${ms.map(m => `<button class="mcard" data-act="go-mode" data-m="${m[0]}"><b>${m[1]}</b><small>${m[2]}</small></button>`).join("")}</div></section>`).join("")}</div>`;
    return;
  }
  ({pinyin:renderPinyin, tones:renderTones, listen:renderListen, grammar:renderGrammar, answer:renderAnswer, translate:renderTranslate, read:renderRead, quiz:renderQuiz}[ui.pmode])();
}
const modeHead = (score) => `<div class="bar-row"><div class="row"><button class="link" data-act="pback">← Practice</button><b>${esc(MODE_NAMES[ui.pmode])}</b></div>${score || ""}</div>`;
const scoreOf = s => `<span class="score">${s.right} of ${s.total} right</span>`;
function wrapMode(score, extra, body){ stage.innerHTML = `<div class="set">${modeHead(score)}${extra ? `<div class="bar-row">${extra}</div>` : ""}<div class="panel c">${body}</div></div>`; }
const lenSeg = () => seg("sentlen", [["all","All sentences"],["short","Short"],["long","Long"]], ui.sentLen);

// Generic multiple choice. q = {head, options:[{html, ok, plain}], after, onAnswer}
let mc = null, mcNext = null;
function mcHTML(s, next){
  mc = s; mcNext = next;
  const q = s.q, a = s.ans;
  return `<div class="face">${q.head}</div><div class="opts">${q.options.map((o,k) => {
    const cls = a ? (o.ok ? " right" : (a.k === k ? " wrong" : "")) : "";
    return `<button class="opt${cls}" data-act="mc" data-i="${k}" ${a ? "disabled" : ""}><span class="n">${k+1}</span><span class="${o.zh ? "zh" : ""}${o.plain && !a ? " nocolor" : ""}" ${o.zh ? 'lang="zh-CN"' : ""}>${o.html}</span></button>`;
  }).join("")}</div>${a ? (q.after ? q.after(a.ok) : "") + `<button class="primary wide" data-act="next" id="nextBtn">Next <kbd>Enter</kbd></button>` : ""}`;
}

// Typing pinyin
function typeArea(s, placeholder, showWord){
  return `<div class="pyin"><input id="pyIn" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(placeholder)}" value="${esc(s.input)}" ${s.ans ? "disabled" : ""} aria-label="Type the pinyin">${s.ans ? "" : `<button class="primary" data-act="check">Check</button>`}</div>
    ${s.ans ? feedback(s, showWord) + `<button class="primary wide" data-act="next" id="nextBtn">Next <kbd>Enter</kbd></button>` : `<p class="tip">Type tone numbers after each syllable: ma1 ma2 ma3 ma4. Leave light syllables without a number. Type v for ü (lv4shi1).</p>`}`;
}
function feedback(s, showWord){
  const g = s.ans, it = s.cur;
  const word = showWord ? `<div class="row" style="justify-content:flex-start"><span class="zh" style="font-size:1.25rem" lang="zh-CN">${esc(it.hz)}</span></div><p class="note">${esc(it.en)}</p>` : "";
  const ans = `<p class="row" style="justify-content:flex-start"><span class="lab">Answer</span><span class="py">${pyHTML(it.py)}</span>${playBtn(it.hz)}</p>`;
  const third = hasThirdPair(pySylls(it.py)) ? `<p class="note">Two third tones in a row: the first is spoken like a 2nd tone but still written as a 3rd.</p>` : "";
  if (g.kind === "right") return `<div class="fb right"><strong>Correct</strong>${ans}${g.lenient ? `<p class="note">One syllable here is light (neutral tone), so it has no tone mark.</p>` : ""}${third}${word}</div>`;
  if (g.kind === "tones") return `<div class="fb tones"><strong>Right sounds, check the tones</strong><p><span class="lab">You typed</span><span class="py">${syllsHTML(g.user)}</span></p>${ans}${third}${word}</div>`;
  return `<div class="fb wrong"><strong>Not quite</strong>${ans}${g.hint === "ü" ? `<p class="note">This word uses ü. Type it as v.</p>` : ""}${word}</div>`;
}
function submitType(s){
  const g = grade(s.input, s.cur.py, s.cur.hz);
  if (g.kind === "empty") return;
  s.ans = g; s.total++; if (g.kind === "right") s.right++;
  answeredAt = Date.now();
  quizResult(s.cur.k, g.kind === "right");
  renderNav(); renderStage();
  speak(s.cur.hz);
  const n = $("nextBtn"); if (n) n.focus({preventScroll:true});
}
function focusInput(){ const i = $("pyIn"); if (i && !i.disabled) i.focus({preventScroll:true}); }
let answeredAt = 0;
const tooSoon = () => Date.now() - answeredAt < 350;

function renderPinyin(){
  const s = PS.pinyin;
  if (!s.cur){ s.cur = pickWeighted(selectedItems().filter(i => Array.from(i.hz).every(c => isZh(c) || c === "…")), s.recent); s.ans = null; s.input = ""; }
  if (!s.cur) return wrapMode("", "", `<p class="hint">Pick a lesson with words first.</p>`);
  const it = s.cur;
  wrapMode(scoreOf(s), "", `<div class="face">${hzBlock(it.hz, !!s.ans)}<p class="en">${esc(it.en)}</p></div>${typeArea(s, "e.g. ni3 hao3")}`);
}

// Listening
function optionsFor(cur, pool, key, html){
  const sound = x => x.py.toLowerCase().replace(/[^a-züà-ǜ]/g, "");
  const ok = x => x !== cur && x.hz !== cur.hz && x.en !== cur.en && sound(x) !== sound(cur);
  let c = shuffle(pool.filter(ok));
  return shuffle([cur].concat(c.slice(0, 3))).map(x => ({html:html(x), ok:x === cur}));
}
function nextListen(){
  const s = PS.listen;
  const sent = ui.listenSrc === "sentences";
  const pool = sent ? sentencesInScope() : selectedItems();
  s.cur = pickWeighted(pool, s.recent); s.ans = null; s.input = ""; s.auto = null; s.q = null;
  if (s.cur && ui.listenSub === "pick"){
    const full = sent ? SENT : WORDS;
    const options = optionsFor(s.cur, pool.length >= 4 ? pool : full, "en", x => esc(x.en));
    const it = s.cur;
    s.q = {head:`<div class="row">${playBtn(it.hz, "huge", "Play again")}</div><button class="link" data-act="sayslow" data-text="${esc(it.hz)}">Play slowly</button><p class="hint">What does it mean? Keys 1–4.</p>`, options,
      after:() => `<div class="answer">${hzBlock(it.hz, true)}<p class="py">${pyHTML(it.py)}</p><p class="en">${esc(it.en)}</p></div>`,
      onAnswer:ok => quizResult(it.k, ok)};
  }
}
function renderListen(){
  const s = PS.listen;
  if (!s.cur) nextListen();
  const controls = seg("lsrc", [["words","Words"],["sentences","Sentences"]], ui.listenSrc) + seg("lsub", [["pick","Pick the meaning"],["write","Write what you hear"]], ui.listenSub) + (ui.listenSrc === "sentences" ? lenSeg() : "");
  if (!s.cur) return wrapMode("", controls, `<p class="hint">Nothing to practice yet.</p>`);
  const it = s.cur;
  if (ui.listenSub === "pick") wrapMode(scoreOf(s), controls, mcHTML(s, nextListen));
  else wrapMode(scoreOf(s), controls, `<div class="row">${playBtn(it.hz, "huge", "Play again")}</div><button class="link" data-act="sayslow" data-text="${esc(it.hz)}">Play slowly</button>${typeArea(s, "Type the pinyin you hear", true)}`);
  if (interacted && !s.ans && s.auto !== it.k){ s.auto = it.k; speak(it.hz); }
}

// Tones
const CHAO = {1:"55 high, level",2:"35 rising",3:"214 dip, rise",4:"51 falling"};
const CONTOUR = {1:"3,5 27,5",2:"3,18 27,5",3:"3,24 15,33 27,11",4:"3,5 27,33"};
const contour = t => `<svg class="contour t${t}" viewBox="0 0 30 38" aria-hidden="true"><path class="lv" d="M0 5H30M0 33H30"/><polyline points="${CONTOUR[t]}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const FULL_SYLL = Object.keys(HSK.syllables).filter(k => HSK.syllables[k].every(Boolean));
function toneVariants(T){
  const idx = T.map((s, k) => s.tone ? k : -1).filter(k => k >= 0);
  if (!idx.length) return [];
  if (T.length === 1){ const out = []; for (let t = 1; t <= 4; t++) if (t !== T[0].tone) out.push([{base:T[0].base, tone:t}]); return out; }
  const key = a => a.map(s => s.tone).join(""), seen = new Set([key(T)]), out = [];
  let guard = 0;
  while (out.length < 3 && guard++ < 80){
    const v = T.map(s => ({...s})), k = idx[rand(idx.length)];
    let nt; do { nt = 1 + rand(4); } while (nt === T[k].tone);
    v[k].tone = nt;
    if (idx.length > 1 && Math.random() < .35){ const k2 = idx[rand(idx.length)]; if (k2 !== k){ let n2; do { n2 = 1 + rand(4); } while (n2 === T[k2].tone); v[k2].tone = n2; } }
    if (!seen.has(key(v))){ seen.add(key(v)); out.push(v); }
  }
  return out;
}
const thirdNote = T => hasThirdPair(T) ? `<p class="note">Two third tones in a row: the first is spoken like a 2nd tone but still written as a 3rd.</p>` : "";
function nextTone(){
  const s = PS.tones;
  s.ans = null; s.auto = null; s.q = null;
  if (ui.toneSub === "syll"){
    const base = FULL_SYLL[rand(FULL_SYLL.length)], k = rand(4), set = HSK.syllables[base];
    s.cur = {base, k, set, hz:set[k]};
  } else {
    const pool = selectedItems().filter(i => /^[㐀-鿿]+$/.test(i.hz)).filter(i => { const T = pySylls(i.py); return T.length <= 4 && T.some(x => x.tone); });
    const it = pickWeighted(pool, s.recent);
    if (!it){ s.cur = null; return; }
    const T = pySylls(it.py);
    s.cur = {it, T, hz:it.hz};
    const options = shuffle([T].concat(toneVariants(T).slice(0, 3))).map(o => ({html:`<span class="py">${syllsHTML(o)}</span>`, ok:o === T, plain:true}));
    s.q = {head:`<div class="row">${playBtn(it.hz, "huge", "Play again")}</div><button class="link" data-act="sayslow" data-text="${esc(it.hz)}">Play slowly</button><p class="hint">Which spelling matches what you hear? Keys 1–4.</p>`, options,
      after:() => `<div class="answer">${hzBlock(it.hz, true)}<p class="en">${esc(it.en)}</p>${thirdNote(T)}</div>`, onAnswer:ok => quizResult(it.k, ok)};
  }
}
function renderTones(){
  const s = PS.tones;
  if (!s.cur) nextTone();
  const controls = seg("tsub", [["syll","Single sounds"],["word","Words from your lessons"]], ui.toneSub);
  if (!s.cur) return wrapMode(scoreOf(s), controls, `<p class="hint">Pick a lesson with words first.</p>`);
  const cur = s.cur;
  if (ui.toneSub === "word"){ wrapMode(scoreOf(s), controls, mcHTML(s, nextTone)); }
  else {
    const f = charFacts(cur.hz);
    let body = `<div class="row">${playBtn(cur.hz, "huge", "Play again")}</div><button class="link" data-act="sayslow" data-text="${esc(cur.hz)}">Play slowly</button><p class="hint">Which tone do you hear? Keys 1–4.</p><div class="tones4">${[1,2,3,4].map(t => {
      const cls = s.ans ? (t-1 === cur.k ? " right" : (s.ans.i === t-1 ? " wrong" : "")) : "";
      return `<button class="tonebtn${cls}" data-act="tone" data-i="${t-1}" ${s.ans ? "disabled" : ""}>${contour(t)}<span class="py t${t}">${esc(markSyl(cur.base, t))}</span><small>Tone ${t} · ${CHAO[t]}</small></button>`;
    }).join("")}</div>`;
    if (s.ans) body += `<div class="answer"><div class="row"><span class="zh" style="font-size:2rem" lang="zh-CN">${esc(cur.hz)}</span><span class="py big">${pyHTML(markSyl(cur.base, cur.k+1))}</span></div>${f ? `<p class="note">${esc(f[3])}</p>` : ""}
      <p class="hint">Compare: ${[0,1,2,3].map(t => `<button class="link" data-act="say" data-text="${esc(cur.set[t])}">${esc(markSyl(cur.base, t+1))}</button>`).join(" ")}</p></div><button class="primary wide" data-act="next" id="nextBtn">Next <kbd>Enter</kbd></button>`;
    body += `<div class="acc" aria-label="Your accuracy by tone">${[1,2,3,4].map(t => { const [r,w] = progress.tones[t], n = r+w, pct = n ? Math.round(r/n*100) : 0; return `<span>Tone ${t}</span><span class="bar"><i class="t${t}" style="width:${pct}%;background:currentColor"></i></span><span>${n ? pct + "% of " + n : "–"}</span>`; }).join("")}</div>`;
    wrapMode(scoreOf(s), controls, body);
  }
  if (interacted && !s.ans && s.auto !== cur.hz){ s.auto = cur.hz; speak(cur.hz); }
}

// Grammar
function gramQuestion(g, onAnswer){
  const full = g.q.includes("___") ? g.q.replace("___", g.opts[0]) : g.opts[0];
  const q = esc(g.q).replace("___", "<u>&nbsp;&nbsp;&nbsp;</u>");
  return {head:`<p class="gq" lang="zh-CN">${q}</p><p class="en">${esc(g.en)}</p>`,
    options:shuffle(g.opts.map((o,i) => ({html:esc(o), ok:i === 0, zh:true}))),
    after:ok => `<div class="fb ${ok ? "right" : "wrong"}"><strong>${ok ? "Correct" : "Not quite"}</strong><p class="row" style="justify-content:flex-start">${playBtn(full)}<span class="zh" lang="zh-CN" style="font-size:1.2rem">${esc(full)}</span></p><p>${esc(g.why)}</p></div>`,
    onAnswer};
}
function nextGrammar(){
  const s = PS.grammar, scope = lessonScope();
  const pool = GRAM.filter(g => scope.has(g.lesson));
  const g = pickWeighted(pool, s.recent); s.cur = g; s.ans = null;
  s.q = g ? gramQuestion(g, ok => quizResult(g.k, ok)) : null;
}
function renderGrammar(){
  const s = PS.grammar;
  if (!s.q) nextGrammar();
  if (!s.q) return wrapMode("", "", `<p class="hint">No grammar questions for this selection yet.</p>`);
  wrapMode(scoreOf(s), "", mcHTML(s, nextGrammar));
}

// Answer: choose the natural reply
function qaQuestion(x, onAnswer){
  const others = shuffle(QA.filter(o => o !== x && o.a !== x.a && lessonScope().has(o.lesson))).concat(shuffle(QA.filter(o => o !== x && o.a !== x.a)));
  const picks = []; others.forEach(o => { if (picks.length < 2 && !picks.some(p => p.a === o.a)) picks.push(o); });
  return {head:`<div class="row"><span class="gq" lang="zh-CN">${esc(x.q)}</span>${playBtn(x.q)}</div><p class="hint">Which reply fits?</p>`,
    options:shuffle([x].concat(picks)).map(o => ({html:esc(o.a), ok:o === x, zh:true})),
    after:() => `<div class="answer" style="align-items:flex-start;text-align:left"><p class="py" style="font-size:1rem">${pyHTML(x.qpy)}</p><p class="note">${esc(x.qen)}</p><div class="row" style="justify-content:flex-start">${playBtn(x.a)}<span class="zh" lang="zh-CN" style="font-size:1.2rem">${esc(x.a)}</span></div><p class="py" style="font-size:1rem">${pyHTML(x.apy)}</p><p class="note">${esc(x.aen)}</p></div>`,
    onAnswer};
}
function nextAnswer(){
  const s = PS.answer, scope = lessonScope();
  const x = pickWeighted(QA.filter(o => scope.has(o.lesson)), s.recent); s.cur = x; s.ans = null;
  s.q = x ? qaQuestion(x, ok => quizResult(x.k, ok)) : null;
}
function renderAnswer(){
  const s = PS.answer;
  if (!s.q) nextAnswer();
  if (!s.q) return wrapMode("", "", `<p class="hint">No questions for this selection yet.</p>`);
  wrapMode(scoreOf(s), "", mcHTML(s, nextAnswer));
}

// Translate
function nextTranslate(){
  const s = PS.translate;
  const pool = sentencesInScope().filter(x => x.tiles.length >= 3);
  s.cur = pickWeighted(pool, s.recent); s.ans = null; s.input = ""; s.placed = []; s.reveal = false;
  s.bank = s.cur ? shuffle(s.cur.tiles.map((t,i) => ({t, i}))) : [];
}
function renderTranslate(){
  const s = PS.translate;
  if (!s.cur) nextTranslate();
  const controls = seg("trdir", [["zh","English → Chinese"],["en","Chinese → English"]], ui.trDir) + lenSeg();
  if (!s.cur) return wrapMode("", controls, `<p class="hint">No sentences for this selection yet.</p>`);
  const it = s.cur;
  let body;
  if (ui.trDir === "zh"){
    const tray = s.placed.map(id => { const b = s.bank.find(x => x.i === id); return `<button class="tl-w" data-act="tile-back" data-i="${id}" ${s.ans ? "disabled" : ""}>${esc(b.t)}</button>`; }).join("");
    body = `<p class="en big">${esc(it.en)}</p><p class="hint">Tap the words in the right order.</p><div class="tray" lang="zh-CN">${tray || '<span class="hint">Your sentence goes here</span>'}</div>
      <div class="bank" lang="zh-CN">${s.bank.map(b => `<button class="tl-w" data-act="tile" data-i="${b.i}" ${s.placed.includes(b.i) || s.ans ? "disabled" : ""}>${esc(b.t)}</button>`).join("")}</div>`;
    if (!s.ans) body += `<div class="btnrow"><button class="ghost" data-act="tile-clear">Clear</button><button class="primary" data-act="tile-check" ${s.placed.length === s.bank.length ? "" : "disabled"}>Check</button></div>`;
    else body += `<div class="fb ${s.ans.ok ? "right" : "wrong"}"><strong>${s.ans.ok ? "Correct" : "Not this time"}</strong><p class="row" style="justify-content:flex-start">${playBtn(it.hz)}<span class="zh" lang="zh-CN" style="font-size:1.25rem">${esc(it.hz)}</span></p><p class="py" style="font-size:1rem">${pyHTML(it.py)}</p>${s.ans.ok ? "" : `<p class="note">Chinese word order can sometimes vary, but this is the order to learn.</p>`}</div><button class="primary wide" data-act="next" id="nextBtn">Next <kbd>Enter</kbd></button>`;
    mcNext = nextTranslate;
  } else {
    body = `<div class="row">${playBtn(it.hz)}<span class="sent" lang="zh-CN">${esc(it.hz)}</span></div><p class="hint">Say what it means in English, or type it below. Then compare.</p>
      <textarea class="say" id="trIn" style="font-family:var(--ui);font-size:1rem;min-height:64px" placeholder="Your translation" ${s.reveal ? "disabled" : ""}>${esc(s.input)}</textarea>`;
    if (!s.reveal) body += `<button class="primary wide" data-act="tr-show">Show the translation</button>`;
    else body += `<div class="fb tones"><span class="lab">Model answer</span><p>${esc(it.en)}</p><p class="py" style="font-size:1rem">${pyHTML(it.py)}</p></div><p class="hint">A computer can't fairly mark free translation, so be your own judge.</p><div class="btnrow"><button class="ghost" data-act="tr-grade" data-g="0">I missed it</button><button class="primary" data-act="tr-grade" data-g="1">I got it</button></div>`;
    mcNext = nextTranslate;
  }
  wrapMode(scoreOf(s), controls, body);
}

// Read
function nextPassage(){
  const scope = lessonScope();
  const pool = HSK.passages.map((p,i) => ({p, k:"p:"+p.title})).filter(x => scope.has(x.p.l));
  const x = pickWeighted(pool, rd.recent);
  rd.p = x ? x.p : null; rd.pop = null; rd.showPy = false; rd.showEn = false; rd.qa = {};
  rd.opts = rd.p ? rd.p.qs.map(q => shuffle(q[2].map((o,i) => ({o, ok:i === 0})))) : null;
}
function explainWord(t){
  const out = [], ch = Array.from(t); let i = 0;
  while (i < ch.length){
    let hit = null;
    for (let L = Math.min(6, ch.length - i); L >= 1; L--){ const w = DICT.get(ch.slice(i, i+L).join("")); if (w){ hit = w; i += L; break; } }
    if (hit) out.push(hit); else { const c = ch[i]; const f = charFacts(c); out.push({hz:c, py:f ? f[2].split(",")[0].trim() : "", en:f ? f[3] : "a name or a word from the dictionary"}); i++; }
  }
  return out;
}
function renderRead(){
  if (!rd.p) nextPassage();
  if (!rd.p) return wrapMode("", "", `<p class="hint">No passages for this selection yet.</p>`);
  const p = rd.p, plain = p.hz.replace(/\//g,""), correct = Object.values(rd.qa).filter(x => x.ok).length, done = Object.keys(rd.qa).length;
  const words = p.hz.split("/").map((t,i) => `<span class="w${rd.pop && rd.pop.i === i ? " on" : ""}" data-act="word" data-i="${i}">${esc(t)}</span>`).join("");
  const pop = rd.pop ? `<div class="pop">${explainWord(cleanTile(p.hz.split("/")[rd.pop.i])).map(w => `<span class="row">${playBtn(w.hz)}<span class="zh" lang="zh-CN">${esc(w.hz)}</span><span class="py" style="font-size:1rem">${pyHTML(w.py)}</span><span class="note">${esc(w.en)}</span></span>`).join("")}</div>` : "";
  const qs = p.qs.map((q,i) => {
    const a = rd.qa[i];
    return `<div class="q"><p class="zh" lang="zh-CN">${esc(q[0])}</p><p class="hint" style="font-size:.84rem">${esc(q[1])}</p><div class="opts">${rd.opts[i].map((o,k) => `<button class="opt${a ? (o.ok ? " right" : (a.k === k ? " wrong" : "")) : ""}" data-act="rq" data-q="${i}" data-i="${k}" ${a ? "disabled" : ""}><span class="zh" lang="zh-CN">${esc(o.o)}</span></button>`).join("")}</div></div>`;
  }).join("");
  wrapMode(`<span class="score">L${p.l}</span>`, "", `<div class="bar-row wide"><div style="text-align:left"><b class="zh" style="font-size:1.25rem" lang="zh-CN">${esc(p.title)}</b> <span class="muted">${esc(p.en)}</span></div>
      <div class="btnrow">${playBtn(plain, "", "Read the passage aloud")}<button class="ghost sm" data-act="rd-py" aria-pressed="${rd.showPy}">${rd.showPy ? "Hide" : "Show"} pinyin</button><button class="ghost sm" data-act="rd-en" aria-pressed="${rd.showEn}">${rd.showEn ? "Hide" : "Show"} English</button></div></div>
    <div class="passage" lang="zh-CN">${words}</div><p class="hint wide" style="text-align:left;font-size:.84rem">Tap any word to see what it means.</p>${pop}
    ${rd.showPy ? `<p class="py wide" style="text-align:left;font-size:1rem;font-weight:500">${pyHTML(p.py)}</p>` : ""}${rd.showEn ? `<p class="note wide" style="text-align:left">${esc(p.tr)}</p>` : ""}
    ${qs}${done === p.qs.length ? `<div class="fb ${correct === done ? "right" : "tones"}"><strong>${correct} of ${done} right</strong></div><button class="primary wide" data-act="rd-next">Next passage</button>` : ""}`);
}

// Quiz: 15 mixed questions
function quizQuestion(){
  const words = selectedItems().filter(i => /^[㐀-鿿]+$/.test(i.hz));
  const scope = lessonScope(), sents = SENT.filter(x => scope.has(x.lesson));
  const pool = words.length >= 4 ? words : WORDS;
  const w = () => pool[rand(pool.length)];
  const after = it => () => `<div class="answer">${hzBlock(it.hz, true)}<p class="py">${pyHTML(it.py)}</p><p class="en">${esc(it.en)}</p></div>`;
  const types = ["meaning","recall","tone","listen"];
  if (sents.length) types.push("cloze","cloze","listenS");
  if (GRAM.some(g => scope.has(g.lesson))) types.push("grammar","grammar");
  if (QA.some(g => scope.has(g.lesson))) types.push("answer");
  const t = types[rand(types.length)];
  if (t === "meaning"){ const it = w(); return {label:"What does it mean?", word:it, head:hzBlock(it.hz), options:optionsFor(it, pool, "en", x => esc(x.en)), after:after(it)}; }
  if (t === "recall"){ const it = w(); return {label:"Which is it?", word:it, head:`<p class="en big">${esc(it.en)}</p>`, options:optionsFor(it, pool, "hz", x => esc(x.hz)).map(o => ({...o, zh:true})), after:after(it)}; }
  if (t === "tone"){ const it = w(), T = pySylls(it.py), vs = toneVariants(T); if (vs.length < 3) return quizQuestion(); return {label:"Which spelling is right?", word:it, head:hzBlock(it.hz), options:shuffle([T].concat(vs.slice(0,3))).map(o => ({html:`<span class="py">${syllsHTML(o)}</span>`, ok:o === T, plain:true})), after:after(it)}; }
  if (t === "listen"){ const it = w(); return {label:"What do you hear?", word:it, say:it.hz, head:`${playBtn(it.hz, "huge", "Play again")}`, options:optionsFor(it, pool, "en", x => esc(x.en)), after:after(it)}; }
  if (t === "listenS"){ const it = sents[rand(sents.length)]; return {label:"What does the sentence mean?", word:it, say:it.hz, head:`${playBtn(it.hz, "huge", "Play again")}`, options:optionsFor(it, sents.length >= 4 ? sents : SENT, "en", x => esc(x.en)), after:() => `<div class="answer"><p class="sent" lang="zh-CN">${esc(it.hz)}</p><p class="py" style="font-size:1rem">${pyHTML(it.py)}</p><p class="en">${esc(it.en)}</p></div>`}; }
  if (t === "cloze"){
    const it = sents[rand(sents.length)];
    const cand = it.tiles.map((x,i) => ({x,i})).filter(o => DICT.has(o.x) && !/^(的|了|吗|呢|吧|也|是|我|你|他|她)$/.test(o.x));
    if (!cand.length) return quizQuestion();
    const hole = cand[rand(cand.length)], ans = DICT.get(hole.x);
    const same = shuffle(WORDS.filter(x => x.hz !== hole.x && x.pos === ans.pos && !it.tiles.includes(x.hz) && /^[㐀-鿿]+$/.test(x.hz) && (pool.includes(x) || Math.random() < .1)));
    const text = it.hz.replace(hole.x, "___");
    return {label:"Fill the gap", word:{k:it.k}, head:`<p class="gq" lang="zh-CN">${esc(text).replace("___","<u>&nbsp;&nbsp;&nbsp;</u>")}</p><p class="en">${esc(it.en)}</p>`, options:shuffle([{html:esc(hole.x), ok:true, zh:true}].concat(same.slice(0,3).map(x => ({html:esc(x.hz), ok:false, zh:true})))), after:() => `<div class="answer"><div class="row">${playBtn(it.hz)}<span class="zh" lang="zh-CN" style="font-size:1.2rem">${esc(it.hz)}</span></div><p class="py" style="font-size:1rem">${pyHTML(it.py)}</p></div>`};
  }
  if (t === "grammar"){ const list = GRAM.filter(g => scope.has(g.lesson)), g = list[rand(list.length)], q = gramQuestion(g); return {label:"Grammar", word:{k:g.k}, ...q}; }
  const list = QA.filter(g => scope.has(g.lesson)), x = list[rand(list.length)], q = qaQuestion(x);
  return {label:"Choose the natural reply", word:{k:x.k}, ...q};
}
function startQuiz(){ quiz.list = 15; quiz.i = 0; quiz.right = 0; quiz.ans = null; quiz.q = quizQuestion(); quiz.wrong = []; quiz.autoFor = -1; }
function nextQuiz(){ quiz.i++; quiz.ans = null; quiz.q = quiz.i < quiz.list ? quizQuestion() : null; }
function renderQuiz(){
  if (!quiz.list) startQuiz();
  if (quiz.i >= quiz.list){
    const pct = Math.round(quiz.right / quiz.list * 100);
    return wrapMode("", "", `<p class="en big">${quiz.right} of ${quiz.list} right (${pct}%)</p><p class="hint">${pct >= 90 ? "Excellent. Try the next lesson." : pct >= 70 ? "Good. Missed items come back in your reviews." : "Keep at it. Missed items come back in your reviews."}</p><div class="btnrow"><button class="primary" data-act="quiz-again">Take another quiz</button><button class="ghost" data-act="pback">Back to practice</button></div>`);
  }
  const q = quiz.q, s = {q:{head:`<p class="label">${esc(q.label)}</p>${q.head}`, options:q.options, after:q.after, onAnswer:ok => { if (q.word && q.word.k) quizResult(q.word.k, ok); if (ok) quiz.right++; }}, get ans(){ return quiz.ans; }, set ans(v){ quiz.ans = v; }, right:0, total:0};
  wrapMode(`<span class="score">Question ${quiz.i+1} of ${quiz.list}</span>`, "", mcHTML(s, nextQuiz));
  if (q.say && interacted && !quiz.ans && quiz.autoFor !== quiz.i){ quiz.autoFor = quiz.i; speak(q.say); }
}

// ---------- Basics ----------
function radicalOf(c){ return RAD_INDEX.get(c) || null; }
const RAD_INDEX = new Map();
HSK.radicals.forEach(r => { RAD_INDEX.set(r[0], r); Array.from(r[1]).forEach(v => RAD_INDEX.set(v, r)); });
const RAD_STROKES = (() => { const m = new Map(); let i = 0; HSK.radicalStrokes.forEach(([s,c]) => { for (let k = 0; k < c; k++) m.set(HSK.radicals[i++][0], s); }); return m; })();
const INITIALS = ["","b","p","m","f","d","t","n","l","g","k","h","j","q","x","zh","ch","sh","r","z","c","s"];
const FINALS = ["a","o","e","ai","ei","ao","ou","an","en","ang","eng","ong","i","ia","ie","iao","iu","ian","in","iang","ing","iong","u","ua","uo","uai","ui","uan","un","uang","ueng","ü","üe","üan","ün","er"];
function spell(ini, fin){
  if (ini === ""){
    const map = {i:"yi",ia:"ya",ie:"ye",iao:"yao",iu:"you",ian:"yan",in:"yin",iang:"yang",ing:"ying",iong:"yong",u:"wu",ua:"wa",uo:"wo",uai:"wai",ui:"wei",uan:"wan",un:"wen",uang:"wang",ueng:"weng","ü":"yu","üe":"yue","üan":"yuan","ün":"yun"};
    return map[fin] || fin;
  }
  if (/^[jqx]$/.test(ini) && fin[0] === "ü") return ini + "u" + fin.slice(1);
  return ini + fin;
}
const bs = {syl:null, rad:null, drill:null};
function renderBasics(){
  const tabs = seg("btab", [["pinyin","Pinyin chart"],["radicals","Radicals"],["strokes","Strokes"]], ui.basicsTab);
  if (ui.basicsTab === "radicals") return renderRadicals(tabs);
  if (ui.basicsTab === "strokes") return renderStrokeBasics(tabs);
  const S = HSK.syllables, sel = bs.syl;
  const rows = INITIALS.map(ini => {
    const cells = FINALS.map(f => { const sp = spell(ini, f); return `<td>${S[sp] ? `<button class="${sel === sp ? "on" : ""}" data-act="syl" data-s="${esc(sp)}">${esc(sp)}</button>` : ""}</td>`; }).join("");
    return `<tr><td>${esc(ini || "–")}</td>${cells}</tr>`;
  }).join("");
  const panel = sel ? `<div class="pop" style="justify-content:center"><b class="py big">${esc(sel)}</b>${[0,1,2,3].map(t => S[sel][t] ? `<button class="ghost sm" data-act="say" data-text="${esc(S[sel][t])}"><span class="t${t+1}">${esc(markSyl(sel, t+1))}</span> <span class="zh" lang="zh-CN">${esc(S[sel][t])}</span></button>` : "").join("")}</div>` : `<p class="hint">Tap any syllable to hear all its tones. Each sound plays through an example character.</p>`;
  stage.innerHTML = `<div class="set"><div class="bar-row">${tabs}<span class="score">${Object.keys(S).length} syllables</span></div>
    <div class="panel">${panel}<div class="pywrap"><table class="pytable"><thead><tr><th></th>${FINALS.map(f => `<th>${esc(f)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint" style="font-size:.82rem">Rows are initials (声母 shēngmǔ). Columns are finals (韵母 yùnmǔ). The first row has no initial, so its spelling starts with y or w where needed.</p></div>
    <section class="panel section"><h3>Sounds that trip up English speakers</h3><div class="list">${HSK.pinyinTips.map(t => `<div class="item">${playBtn(t[2])}<b style="min-width:6.5em">${esc(t[0])}</b><span class="en">${esc(t[1])}</span></div>`).join("")}</div></section></div>`;
}
function radDrillNext(){
  const s = bs.drill, list = HSK.radicals.filter(r => HSK.commonRadicals.includes(r[0]) || rand(5) === 0);
  const r = pickWeighted(list, s.recent, x => "r:" + x[0]); s.cur = r; s.ans = null;
  const shown = r[1] ? Array.from(r[1])[0] + " " + r[0] : r[0];
  const others = shuffle(HSK.radicals.filter(x => x !== r && x[3] !== r[3])).slice(0, 3);
  const ask = (rand(2) === 0 && HSK.chars) ? exampleChars(r) : [];
  if (ask.length){
    const c = ask[rand(ask.length)];
    s.q = {head:`<p class="sent" lang="zh-CN" style="font-size:3rem">${esc(c)}</p><p class="hint">Which radical does this character use?</p>`, options:shuffle([r].concat(others)).map(x => ({html:`<span class="zh">${esc(x[1] ? Array.from(x[1])[0] : x[0])}</span> ${esc(x[3])}`, ok:x === r})), after:() => radAfter(r, c), onAnswer:ok => quizResult("r:" + r[0], ok)};
  } else s.q = {head:`<p class="sent" lang="zh-CN" style="font-size:3rem">${esc(shown)}</p><p class="hint">What does this radical mean?</p>`, options:shuffle([r].concat(others)).map(x => ({html:esc(x[3]), ok:x === r})), after:() => radAfter(r), onAnswer:ok => quizResult("r:" + r[0], ok)};
}
const radAfter = (r, c) => `<div class="answer"><p class="row"><span class="zh" style="font-size:1.6rem" lang="zh-CN">${esc(r[0])}</span>${r[1] ? `<span class="zh" style="font-size:1.3rem" lang="zh-CN">${esc(r[1])}</span>` : ""}<span class="py">${pyHTML(r[2])}</span></p><p class="en">${esc(r[3])}</p></div>`;
function exampleChars(r){
  if (!HSK.chars) return [];
  const forms = [r[0]].concat(Array.from(r[1]));
  const seen = new Set(), out = [];
  WORDS.forEach(w => Array.from(w.hz).forEach(c => { if (seen.has(c)) return; seen.add(c); const f = HSK.chars[c]; if (f && forms.includes(f[0])) out.push(c); }));
  return out;
}
function renderRadicals(tabs){
  const mode = seg("rtab", [["browse","Browse"],["drill","Drill"]], ui.radTab);
  if (ui.radTab === "drill"){
    bs.drill = bs.drill || {recent:[], right:0, total:0, ans:null, q:null};
    if (!bs.drill.q) radDrillNext();
    const body = mcHTML(bs.drill, radDrillNext);
    stage.innerHTML = `<div class="set"><div class="bar-row">${tabs}${mode}${scoreOf(bs.drill)}</div><div class="panel c">${body}</div></div>`;
    return;
  }
  const common = HSK.radicals.filter(r => HSK.commonRadicals.includes(r[0]));
  const item = r => `<button class="rad${bs.rad === r[0] ? " on" : ""}" data-act="rad" data-r="${esc(r[0])}"><span class="zh" lang="zh-CN">${esc(r[1] ? Array.from(r[1])[0] : r[0])}</span><span><small><b>${esc(r[2])}</b></small><small>${esc(r[3])}</small></span></button>`;
  let detail = "";
  if (bs.rad){
    const r = RAD_INDEX.get(bs.rad), ex = exampleChars(r);
    detail = `<div class="pop" style="flex-direction:column;align-items:flex-start"><div class="row">${playBtn(r[0])}<span class="zh" style="font-size:2rem" lang="zh-CN">${esc(r[0])}</span>${r[1] ? `<span class="zh" style="font-size:1.5rem" lang="zh-CN">${esc(r[1])}</span>` : ""}<span class="py">${pyHTML(r[2])}</span><span>${esc(r[3])}</span><span class="muted">${RAD_STROKES.get(r[0])} strokes</span></div>
      ${ex.length ? `<div class="row" style="justify-content:flex-start"><span class="note">In your lessons:</span> ${ex.slice(0,14).map(c => `<button class="link zh" style="font-size:1.25rem" data-act="strokes" data-hz="${esc(c)}" lang="zh-CN">${esc(c)}</button>`).join("")}</div>` : `<p class="note">Not in any lesson's characters yet.</p>`}</div>`;
  }
  const groups = HSK.radicalStrokes.map(([s]) => s);
  stage.innerHTML = `<div class="set"><div class="bar-row">${tabs}${mode}</div>
    <div class="panel"><p class="note">Radicals (部首 bùshǒu) are the parts dictionaries sort characters by, and they often hint at meaning. There are 214. Learn these common ones first.</p>${detail}
    <p class="label">Most common</p><div class="rgrid">${common.map(item).join("")}</div></div>
    <section class="panel"><p class="label">All 214, by stroke count</p>${groups.map(s => `<p class="hint" style="margin-top:6px">${s} stroke${s > 1 ? "s" : ""}</p><div class="rgrid">${HSK.radicals.filter(r => RAD_STROKES.get(r[0]) === s).map(item).join("")}</div>`).join("")}</section></div>`;
}
function renderStrokeBasics(tabs){
  stage.innerHTML = `<div class="set"><div class="bar-row">${tabs}</div>
    <section class="panel section"><h3>The basic strokes</h3><div class="list">${HSK.strokes.map(s => `<div class="item"><button class="ghost sm zh" lang="zh-CN" data-act="strokes" data-hz="${esc(s[3])}">${esc(s[3])}</button><b style="min-width:4.5em"><span class="zh" lang="zh-CN">${esc(s[0])}</span> ${pyHTML(s[1])}</b><span class="en">${esc(s[2])}</span></div>`).join("")}</div></section>
    <section class="panel section"><h3>Stroke order rules</h3><div class="list">${HSK.strokeRules.map(r => `<div class="item"><button class="ghost sm zh" lang="zh-CN" data-act="strokes" data-hz="${esc(r[1])}">${esc(r[1])}</button><span class="en">${esc(r[0])}</span></div>`).join("")}</div><p class="hint" style="font-size:.84rem">Tap a character to watch it written.</p></section></div>`;
}

// ---------- Look up ----------
const lk = {q:"", timer:null, dict:null, loading:false};
async function dictReady(){
  if (lk.dict) return;
  await loadScript("data/gen/dict.js");
  lk.dict = HSK.dictRaw.split("\n").map(l => { const a = l.split("\t"); return {hz:a[0], py:a[1], en:a[2], low:(a[2]||"").toLowerCase()}; });
  HSK.dictRaw = null;
}
const pyKey = s => pySylls(s).map(x => normLetters(x.base)).join("");
function enScore(low, q){
  if (!low.includes(q)) return -1;
  let best = -1, pos = 0;
  for (const raw of low.split(/[;]/)){
    const seg = raw.replace(/\([^)]*\)/g,"").trim().replace(/^(to|a|an|the) /,"");
    // An exact first meaning beats the same word listed as a later meaning (老师 before 先生 for "teacher").
    if (seg === q) return pos * 0.1;
    if (seg.startsWith(q + " ") && (best < 0 || best > 1)) best = 1;
    pos++;
  }
  if (best >= 0) return best;
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return new RegExp("(^|[^a-z])" + safe + "([^a-z]|$)").test(low) ? 2 : -1;
}
function lookup(qRaw){
  const q = qRaw.trim().toLowerCase();
  if (!q) return {book:[], dict:[]};
  const zh = isZh(q), letters = !zh && /^[a-zü0-9:'\sà-ǜ]+$/i.test(q), withTone = letters && /[0-9à-ÿĀ-ǜ]/.test(q);
  const pk = letters ? parseInput(q).map(x => normLetters(x.base)).join("") : "", tones = withTone ? parseInput(q).map(x => x.tone).join("") : "";
  const score = e => {
    if (zh){ if (e.hz === q) return 0; if (e.hz.startsWith(q)) return 1; return e.hz.includes(q) ? 2 : -1; }
    let s = withTone ? -1 : enScore(e.low || e.en.toLowerCase(), q);
    if (letters && pk && pyKey(e.py) === pk){ const toneOk = !withTone || pySylls(e.py).map(x => x.tone).join("") === tones; if (toneOk) s = s < 0 ? 1.5 : Math.min(s, 1.5); }
    return s;
  };
  const rank = list => { const out = []; list.forEach((e,i) => { const s = score(e); if (s >= 0) out.push({e, s, i}); }); out.sort((a,b) => a.s - b.s || a.i - b.i); return out; };
  const book = rank(WORDS).slice(0, 15).map(x => x.e);
  const seen = new Set(book.map(x => x.hz + x.py.toLowerCase()));
  const dict = lk.dict ? rank(lk.dict).map(x => x.e).filter(e => !seen.has(e.hz + e.py.toLowerCase())).slice(0, 25) : [];
  return {book, dict};
}
function lkRow(e, src){
  const saved = progress.mine.some(a => a[0] === e.hz && a[1] === e.py) || (src && WORDS.includes(e));
  return `<tr><td class="hz" lang="zh-CN">${esc(e.hz)}</td><td class="py">${pyHTML(e.py)}</td><td class="en">${esc(e.en)}${src ? `<br><span class="src">${esc(DECK_BY_ID[e.deck].name)}</span>` : ""}</td><td class="ac">${playBtn(e.hz)} ${strokeBtn(e.hz)} ${saved ? "" : `<button class="ghost sm" data-act="save-word" data-hz="${esc(e.hz)}" data-py="${esc(e.py)}" data-en="${esc(e.en)}">Save</button>`}</td></tr>`;
}
function drawLookup(){
  const el = $("lkRes"); if (!el) return;
  if (!lk.q.trim()){ el.innerHTML = `<p class="hint">Try: lawyer, shi4, 老师. Results from your textbook come first, written the way the book writes them.</p>`; return; }
  const {book, dict} = lookup(lk.q);
  el.innerHTML = (book.length ? `<p class="label">From your textbook</p><div class="tablewrap"><table><tbody>${book.map(e => lkRow(e, true)).join("")}</tbody></table></div>` : "") +
    (dict.length ? `<p class="label" style="margin-top:8px">From the dictionary (CC-CEDICT)</p><div class="tablewrap"><table><tbody>${dict.map(e => lkRow(e, false)).join("")}</tbody></table></div><p class="hint" style="font-size:.8rem">Dictionary entries list tones as spoken alone, so 不 and 一 may differ from how the textbook marks them in a phrase.</p>` : "") +
    (!book.length && !dict.length ? (lk.dict ? `<p class="hint">No match. Try a simpler word.</p>` : `<p class="hint">Loading the dictionary…</p>`) : "");
}
function segmentWords(text){
  const ch = Array.from(text), out = [];
  let i = 0;
  while (i < ch.length){
    let found = null;
    for (let L = Math.min(6, ch.length - i); L >= 1; L--){ const it = DICT.get(ch.slice(i, i+L).join("")); if (it){ found = it; i += L; break; } }
    if (found){ if (!out.includes(found)) out.push(found); } else i++;
  }
  return out;
}
function foundHTML(){
  const found = segmentWords(ui.sayText || "");
  if (!found.length) return `<p class="hint">Words from your lessons show here with pinyin as you type.</p>`;
  return `<p class="label">Words from your lessons in this text</p><div class="list">` + found.map(it => `<div class="item">${playBtn(it.hz)}<span class="hz" lang="zh-CN">${esc(it.hz)}</span><span class="py" style="font-size:1rem">${pyHTML(it.py)}</span><span class="en">${esc(it.en)}</span></div>`).join("") + `</div>`;
}
function renderLookup(){
  const tabs = seg("lktab", [["lookup","Look up"],["say","Read aloud"]], ui.lkTab);
  if (ui.lkTab === "say"){
    stage.innerHTML = `<div class="set"><div class="bar-row">${tabs}</div><div class="panel">
      <textarea id="sayIn" class="say" lang="zh-CN" placeholder="例如：我家有七口人。" aria-label="Chinese text to read aloud">${esc(ui.sayText || "")}</textarea>
      <div class="btnrow l"><button class="primary" data-act="sayit">Play</button><button class="ghost" data-act="sayitslow">Play slowly</button><button class="ghost" data-act="stop">Stop</button></div>
      <div class="btnrow l">${PRESETS.map((p, k) => `<button class="ghost sm" data-act="preset" data-i="${k}">${esc(p[0])}</button>`).join("")}</div>
      <div id="found">${foundHTML()}</div></div></div>`;
    return;
  }
  stage.innerHTML = `<div class="set"><div class="bar-row">${tabs}</div><div class="panel"><input id="lkIn" class="search" type="search" autocomplete="off" spellcheck="false" placeholder="Type English, pinyin or characters" value="${esc(lk.q)}" aria-label="Search"><div id="lkRes"></div></div></div>`;
  drawLookup();
  dictReady().then(drawLookup).catch(() => { const el = $("lkRes"); if (el) el.innerHTML = `<p class="hint">The dictionary couldn't load. Your textbook words still work.</p>`; });
  const i = $("lkIn"); if (i){ i.focus({preventScroll:true}); i.setSelectionRange(i.value.length, i.value.length); }
}

// ---------- Settings ----------
let resetArmed = false, updStatus = "Checks automatically when the app starts.", copiedAt = 0;
function renderSettings(){
  const voiceRow = !hasTTS ? `<span class="d">Audio isn't supported in this browser.</span>`
    : zhVoices.length ? `<select id="voiceSel">${zhVoices.map(x => `<option value="${esc(x.name)}" ${voice && x.name === voice.name ? "selected" : ""}>${esc(x.name.replace(/^Microsoft |^Google /, "").replace(/ - Chinese.*|（.*）|\(.*\)/, "").trim())}</option>`).join("")}</select>`
    : `<span class="d">${voicesChecked ? "No Mandarin voice found" : "Looking for a Mandarin voice…"}</span>`;
  const where = window.hsk ? "Saved in the app on this computer." : syncState === "account" ? "Saved to your Claude account and shared across your devices." : "Saved in this browser.";
  stage.innerHTML = `<div class="set">
    <section class="panel section"><h3>Audio</h3>
      <div class="srow"><span><span class="k">Voice</span><span class="d">Mandarin voices on this device</span></span>${voiceRow}</div>
      <div class="srow"><span><span class="k">Speed</span><span class="d">Slow helps with tones</span></span>${seg("speed", [["normal","Normal"],["slow","Slow"]], ui.slow ? "slow" : "normal")}</div>
      <div class="srow"><span><span class="k">Test</span><span class="d" lang="zh-CN">你好！我是加纳人。</span></span><button class="ghost" data-act="test">Test sound</button></div>
    </section>
    <section class="panel section"><h3>Study</h3>
      <div class="srow"><span><span class="k">Daily goal</span><span class="d">Answers per day. 40 takes about 20 minutes.</span></span><input type="number" id="goalIn" min="10" max="300" step="5" value="${ui.goal}"></div>
      <div class="srow"><span><span class="k">Pinyin on card fronts</span><span class="d">Easier at first. Turn it off once you can read the characters.</span></span><input type="checkbox" id="pyFront" ${ui.pinyinFront ? "checked" : ""}></div>
      <div class="srow"><span><span class="k">Theme</span></span><select id="themeSel"><option value="system" ${ui.theme === "system" ? "selected" : ""}>Match system</option><option value="light" ${ui.theme === "light" ? "selected" : ""}>Light</option><option value="dark" ${ui.theme === "dark" ? "selected" : ""}>Dark</option></select></div>
    </section>
    <section class="panel section"><h3>Streak</h3>
      <p class="note">Study at least once every 26 hours. ${window.hsk ? "After 24 hours you get a reminder, and another with 30 minutes left." : "Reminders only work in the Windows app."}</p>
      ${window.hsk ? `<div class="srow"><span><span class="k">Reminders</span><span class="d">Runs in the system tray and starts with Windows, so it can remind you. Quit from the tray icon.</span></span><input type="checkbox" id="remIn" ${ui.reminders ? "checked" : ""}></div>` : ""}
    </section>
    <section class="panel section"><h3>Progress</h3>
      <div class="srow"><span><span class="k">Where it's saved</span><span class="d">${where}</span></span></div>
      <div class="srow"><span><span class="k">Weak words</span><span class="d">Copy the words you keep missing, to paste to Claude</span></span><span class="row"><button class="ghost" data-act="copyweak">Copy weak words</button>${Date.now() - copiedAt < 4000 ? '<span class="copied">Copied</span>' : ""}</span></div>
      <div class="srow"><span><span class="k">Start over</span><span class="d">Erases every review and score here</span></span><span class="row">${resetArmed ? `<button class="primary" style="background:var(--bad);border-color:var(--bad)" data-act="reset2">Yes, erase everything</button><button class="ghost" data-act="reset0">Keep it</button>` : `<button class="ghost" data-act="reset1">Reset progress…</button>`}</span></div>
      <textarea id="copyBox" class="say" hidden readonly aria-label="Weak words to copy"></textarea>
    </section>
    <section class="panel section"><h3>Keyboard</h3><div class="keys"><kbd>Space</kbd><span>Show the answer (Cards) or check your writing (Write)</span><kbd>1 2 3</kbd><span>Again, Good, Easy</span><kbd>1–4</kbd><span>Pick an option</span><kbd>Enter</kbd><span>Check your typing, then Next</span></div></section>
    <section class="panel section"><h3>About</h3>
      <div class="srow"><span><span class="k">Road to HSK v${APP_VERSION}</span><span class="d">${HSK.decks.filter(d => d.lesson).length} lesson sets, ${WORDS.length} words, ${SENT.length} sentences, ${GRAM.length} grammar questions, ${QA.length} Q&amp;A, ${HSK.passages.length} passages, 214 radicals.</span></span></div>
      ${window.hsk ? `<div class="srow"><span><span class="k">Updates</span><span class="d" id="updStatus">${esc(updStatus)}</span></span><button class="ghost" data-act="checkupd">Check for updates</button></div>` : ""}
      <p class="hint" style="font-size:.82rem">Practice text is original to this app. Vocabulary follows the Integrated Chinese lesson order. Stroke data from Make Me a Hanzi and Hanzi Writer (Arphic Public License, MIT). Dictionary from CC-CEDICT (CC BY-SA 4.0).</p>
    </section></div>`;
}

// ---------- Actions ----------
function afterAnswer(){ answeredAt = Date.now(); renderNav(); renderStage(); const n = $("nextBtn"); if (n) n.focus({preventScroll:true}); }
function padAction(fn){
  const s = ui.studyMode === "free" ? fw : wr;
  fn(s.strokes);
  if (s.pad) s.pad.redraw();
  if (ui.studyMode === "free") fwRecognize();
}
const A = {
  say: el => speak(el.dataset.text),
  sayslow: el => speak(el.dataset.text, true),
  test: () => speak("你好！我是加纳人。"),
  // Navigation
  "go-review": () => { ui.studyMode = "cards"; buildQueue(); goView("study"); },
  "go-new": () => { ui.studyMode = "cards"; buildQueue("more"); goView("study"); },
  "go-weak": () => { ui.studyMode = "cards"; buildQueue("weak"); goView("study"); },
  "go-mode": el => { ui.pmode = el.dataset.m; if (ui.pmode === "quiz") quiz.list = null; goView("practice"); },
  "go-study-now": () => { ui.studyMode = "cards"; buildQueue(); goView("study"); },
  pback: () => { ui.pmode = null; saveUI(); renderStage(); },
  study: el => { ui.studyMode = el.dataset.v; saveUI(); renderStage(); },
  // Lessons
  pickmode: el => { ui.pickMode = el.dataset.v; if (ui.pickMode === "single" && ui.selected.length > 1) setSelection([ui.selected[ui.selected.length-1]]); saveUI(); renderStage(); },
  pick: el => {
    const id = el.dataset.id, on = ui.selected.includes(id);
    if (ui.pickMode === "single") setSelection([id]);
    else if (on){ if (ui.selected.length > 1) setSelection(ui.selected.filter(x => x !== id)); }
    else setSelection(ui.selected.concat(id));
    renderStage();
  },
  upto: el => { const order = HSK.decks.filter(d => d.lesson).map(d => d.id); setSelection(order.slice(0, order.indexOf(el.dataset.id) + 1)); renderStage(); },
  "sel-class": () => { ui.pickMode = "multi"; setSelection(classIds.slice()); renderStage(); },
  "sel-all": () => { ui.pickMode = "multi"; setSelection(HSK.decks.filter(d => d.lesson).map(d => d.id)); renderStage(); },
  opendeck: el => { openDeck = el.dataset.id; renderStage(); try { window.scrollTo(0,0); } catch(e){} },
  closedeck: () => { openDeck = null; renderStage(); },
  only: el => { ui.pickMode = "single"; openDeck = null; setSelection([el.dataset.id]); ui.studyMode = "cards"; buildQueue(); goView("study"); },
  filter: el => { ui.listFilter = el.dataset.v; saveUI(); renderStage(); },
  // Cards
  dir: el => { ui.cardDir = el.dataset.v; saveUI(); if (cq){ cq.shown = false; cq.auto = null; } renderStage(); },
  flip: () => { if (!cq || cq.shown) return; cq.shown = true; answeredAt = Date.now(); renderStage(); speak(cq.list[cq.i].hz); const g = $("goodBtn"); if (g) g.focus({preventScroll:true}); },
  grade: el => {
    if (!cq || !cq.shown || tooSoon()) return;
    const g = +el.dataset.g, it = cq.list[cq.i];
    if (cq.cram) quizResult(it.k, g > 0); else review(it.k, g);
    if (g === 0){ cq.list.splice(Math.min(cq.list.length, cq.i + 4), 0, it); cq.again++; }
    cq.done++; cq.i++; cq.shown = false;
    renderStage(); renderNav();
    const f = $("flipBtn"); if (f) f.focus({preventScroll:true});
  },
  more: () => { buildQueue("more"); renderStage(); },
  cram: () => { buildQueue("cram"); renderStage(); },
  // Characters
  strokes: el => openChar(el.dataset.hz || el.dataset.c),
  "cs-close": () => { if (csWriter && csWriter.cancelQuiz) { try { csWriter.cancelQuiz(); } catch(e){} } $("charDlg").close(); },
  "cs-pick": el => fillCharStudy(el.closest("#csHost"), el.dataset.hz, +el.dataset.i),
  "cs-play": () => { if (csWriter){ try { csWriter.cancelQuiz(); } catch(e){} csWriter.showCharacter({duration:0}); csWriter.animateCharacter(); } },
  "cs-quiz": () => {
    if (!csWriter) return;
    const note = $("csNote");
    if (note) note.textContent = "Trace each stroke in order. A hint appears after a few misses.";
    csWriter.quiz({onComplete: s => { if (note) note.textContent = s.totalMistakes ? `Done, with ${s.totalMistakes} miss${s.totalMistakes === 1 ? "" : "es"}. Try again to get it clean.` : "Done, with no mistakes."; }});
  },
  "st-prev": () => { const p = selectedItems().filter(i => !/…/.test(i.hz)), i = p.indexOf(st.cur); if (i > 0){ st.cur = p[i-1]; renderStage(); } },
  "st-next": () => { const p = selectedItems().filter(i => !/…/.test(i.hz)), i = p.indexOf(st.cur); if (i < p.length-1){ st.cur = p[i+1]; renderStage(); } },
  // Write
  "pad-undo": () => padAction(s => { s.pop(); }),
  "pad-clear": () => padAction(s => { s.length = 0; }),
  "wr-check": async () => {
    if (!wr.cur || wr.check) return;
    const ch = Array.from(wr.cur.hz)[wr.i];
    answeredAt = Date.now();
    let cands = [];
    if (wr.strokes.length){
      if (!HSK.recogReady()){ await recogLoad().catch(() => {}); }
      await charsReady();
      PREFER = PREFER || preferSet();
      cands = HSK.recognize(wr.strokes, 6, PREFER).map(x => x.c);
    }
    wr.check = {cands, hit:cands.indexOf(ch), drew:wr.strokes.length > 0};
    wr.hits.push(wr.check.hit === 0);
    renderStage();
    speak(ch);
  },
  "wr-nextch": () => { wr.i++; wr.strokes = []; wr.check = null; renderStage(); },
  "wr-grade": el => { if (tooSoon()) return; review(wr.cur.k, +el.dataset.g); nextWrite(); renderNav(); renderStage(); },
  "fw-add": el => { fw.text.push(el.dataset.c); fw.strokes.length = 0; fw.cands = []; renderStage(); },
  "fw-del": () => { fw.text.pop(); renderStage(); },
  "fw-reset": () => { fw.text = []; fw.strokes.length = 0; fw.cands = []; renderStage(); },
  "fw-lookup": () => { lk.q = fw.text.join(""); ui.lkTab = "lookup"; goView("lookup"); },
  // Multiple choice and typing
  mc: el => {
    if (!mc || mc.ans) return;
    const k = +el.dataset.i, ok = !!mc.q.options[k].ok;
    mc.ans = {k, ok}; mc.total++; if (ok) mc.right++;
    if (mc.q.onAnswer) mc.q.onAnswer(ok);
    afterAnswer();
  },
  next: () => {
    if (tooSoon()) return;
    if (ui.view === "practice" && (ui.pmode === "pinyin")){ PS.pinyin.cur = null; }
    else if (ui.view === "practice" && ui.pmode === "tones") nextTone();
    else if (ui.view === "practice" && ui.pmode === "listen") nextListen();
    else if (mcNext) mcNext();
    renderStage(); focusInput();
  },
  check: () => { const s = ui.pmode === "listen" ? PS.listen : PS.pinyin, i = $("pyIn"); if (i) s.input = i.value; submitType(s); },
  lsrc: el => { ui.listenSrc = el.dataset.v; saveUI(); nextListen(); renderStage(); },
  lsub: el => { ui.listenSub = el.dataset.v; saveUI(); nextListen(); renderStage(); focusInput(); },
  sentlen: el => { ui.sentLen = el.dataset.v; saveUI(); if (ui.pmode === "listen") nextListen(); else nextTranslate(); renderStage(); },
  tsub: el => { ui.toneSub = el.dataset.v; saveUI(); nextTone(); renderStage(); },
  tone: el => {
    const s = PS.tones; if (s.ans || !s.cur) return;
    const i = +el.dataset.i, ok = i === s.cur.k;
    progress.tones[s.cur.k + 1][ok ? 0 : 1]++; markDay(); save();
    s.ans = {i, ok}; s.total++; if (ok) s.right++;
    afterAnswer();
  },
  // Translate
  trdir: el => { ui.trDir = el.dataset.v; saveUI(); nextTranslate(); renderStage(); },
  tile: el => { const s = PS.translate, i = +el.dataset.i; if (s.ans || s.placed.includes(i)) return; s.placed.push(i); renderStage(); },
  "tile-back": el => { const s = PS.translate, i = +el.dataset.i; if (s.ans) return; s.placed = s.placed.filter(x => x !== i); renderStage(); },
  "tile-clear": () => { PS.translate.placed = []; renderStage(); },
  "tile-check": () => {
    const s = PS.translate;
    const made = s.placed.map(id => s.bank.find(b => b.i === id).t).join(""), target = s.cur.tiles.join(""), ok = made === target;
    s.ans = {ok}; s.total++; if (ok) s.right++;
    quizResult(s.cur.k, ok);
    speak(s.cur.hz);
    afterAnswer();
  },
  "tr-show": () => { const s = PS.translate, i = $("trIn"); if (i) s.input = i.value; s.reveal = true; speak(s.cur.hz); renderStage(); },
  "tr-grade": el => { const s = PS.translate, ok = el.dataset.g === "1"; s.total++; if (ok) s.right++; quizResult(s.cur.k, ok); nextTranslate(); renderNav(); renderStage(); },
  // Read
  word: el => { const i = +el.dataset.i; rd.pop = rd.pop && rd.pop.i === i ? null : {i}; const y = window.scrollY; charsReady().then(() => { renderStage(); window.scrollTo(0, y); }); },
  "rd-py": () => { rd.showPy = !rd.showPy; renderStage(); },
  "rd-en": () => { rd.showEn = !rd.showEn; renderStage(); },
  rq: el => {
    const q = +el.dataset.q, k = +el.dataset.i; if (rd.qa[q]) return;
    const ok = rd.opts[q][k].ok; rd.qa[q] = {k, ok};
    quizResult("p:" + rd.p.title + ":" + q, ok);
    const y = window.scrollY; renderNav(); renderStage(); window.scrollTo(0, y);
  },
  "rd-next": () => { nextPassage(); renderStage(); try { window.scrollTo(0,0); } catch(e){} },
  "quiz-again": () => { startQuiz(); renderStage(); },
  // Basics
  btab: el => { ui.basicsTab = el.dataset.v; saveUI(); renderStage(); if (ui.basicsTab === "radicals") charsReady(); },
  syl: el => { bs.syl = el.dataset.s; const scroller = stage.querySelector(".pywrap"), x = scroller ? scroller.scrollLeft : 0, y = scroller ? scroller.scrollTop : 0; renderStage(); const w = stage.querySelector(".pywrap"); if (w){ w.scrollLeft = x; w.scrollTop = y; } const c = HSK.syllables[bs.syl].find(Boolean); if (c) speak(c); },
  rtab: el => { ui.radTab = el.dataset.v; saveUI(); charsReady().then(renderStage); },
  rad: el => { bs.rad = el.dataset.r; const y = window.scrollY; charsReady().then(() => { renderStage(); window.scrollTo(0, Math.min(y, 300)); }); },
  // Look up
  lktab: el => { ui.lkTab = el.dataset.v; saveUI(); renderStage(); },
  "save-word": el => { progress.mine.push([el.dataset.hz, el.dataset.py, el.dataset.en]); syncMine(); save(); drawLookup(); },
  sayit: () => speak(ui.sayText),
  sayitslow: () => speak(ui.sayText, true),
  stop: () => { try { speechSynthesis.cancel(); } catch(e){} },
  preset: el => { ui.sayText = PRESETS[+el.dataset.i][1]; saveUI(); renderStage(); speak(ui.sayText); },
  // Settings
  speed: el => { ui.slow = el.dataset.v === "slow"; saveUI(); renderStage(); },
  reset1: () => { resetArmed = true; renderStage(); },
  reset0: () => { resetArmed = false; renderStage(); },
  reset2: () => { progress = blankProgress(); syncMine(); resetArmed = false; resetModes(); save(); renderNav(); renderStage(); },
  checkupd: () => { if (window.hsk){ updStatus = "Checking…"; const e = $("updStatus"); if (e) e.textContent = updStatus; window.hsk.checkForUpdates(); } },
  copyweak: () => {
    const weak = selectedItems().filter(it => status(it.k) === "weak");
    const text = weak.length ? weak.map(it => `${it.hz}  ${it.py}  ${it.en}`).join("\n") : "No weak words yet.";
    const done = () => { copiedAt = Date.now(); renderStage(); setTimeout(() => { if (ui.view === "settings") renderStage(); }, 4100); };
    const fallback = () => { const box = $("copyBox"); if (!box) return; box.hidden = false; box.value = text; box.focus(); box.select(); };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch(e){ fallback(); }
  }
};
document.addEventListener("click", e => {
  const v = e.target.closest("[data-view]");
  if (v){ if (v.dataset.view === "practice") ui.pmode = null; if (v.dataset.view === "lessons") openDeck = null; goView(v.dataset.view); return; }
  // Buttons inside a lesson row act on their own, not on the row.
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const f = A[el.dataset.act]; if (f) f(el);
});
stage.addEventListener("input", e => {
  const t = e.target;
  if (t.id === "pyIn") (ui.pmode === "listen" ? PS.listen : PS.pinyin).input = t.value;
  if (t.id === "sayIn"){ ui.sayText = t.value; saveUI(); const f = $("found"); if (f) f.innerHTML = foundHTML(); }
  if (t.id === "lkIn"){ lk.q = t.value; clearTimeout(lk.timer); lk.timer = setTimeout(drawLookup, 180); }
});
stage.addEventListener("change", e => {
  const t = e.target;
  if (t.id === "pyFront"){ ui.pinyinFront = t.checked; saveUI(); }
  else if (t.id === "voiceSel"){ ui.voice = t.value; saveUI(); voice = zhVoices.find(x => x.name === ui.voice) || voice; speak("你好！我是加纳人。"); }
  else if (t.id === "goalIn"){ ui.goal = Math.max(10, Math.min(300, +t.value || 40)); saveUI(); renderNav(); }
  else if (t.id === "themeSel"){ ui.theme = t.value; saveUI(); applyTheme(); }
  else if (t.id === "remIn"){ ui.reminders = t.checked; saveUI(); if (window.hsk) window.hsk.setReminders(ui.reminders); }
});
stage.addEventListener("keydown", e => { if (e.target.id === "pyIn" && e.key === "Enter"){ e.preventDefault(); A.check(); } });
document.addEventListener("pointerdown", () => { interacted = true; }, {capture:true});
document.addEventListener("keydown", e => {
  interacted = true;
  if (e.metaKey || e.ctrlKey || e.altKey || ($("charDlg").open)) return;
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  const onBtn = tag === "BUTTON", k = e.key;
  if (e.target.classList && e.target.classList.contains("lrow") && (k === " " || k === "Enter")){ e.preventDefault(); A.pick(e.target); return; }
  if (ui.view === "study" && ui.studyMode === "cards" && cq && cq.list[cq.i]){
    if (!cq.shown && (k === " " || k === "Enter") && !onBtn){ e.preventDefault(); A.flip(); }
    else if (cq.shown && ["1","2","3"].includes(k)){ e.preventDefault(); A.grade({dataset:{g:String(+k - 1)}}); }
  } else if (ui.view === "study" && ui.studyMode === "write" && wr.cur){
    if (!wr.check && k === " " && !onBtn){ e.preventDefault(); A["wr-check"](); }
    else if (wr.check && ["1","2","3"].includes(k) && Array.from(wr.cur.hz).length - 1 === wr.i){ e.preventDefault(); A["wr-grade"]({dataset:{g:String(+k - 1)}}); }
  } else if (ui.view === "practice" || (ui.view === "basics" && ui.basicsTab === "radicals" && ui.radTab === "drill")){
    if (["1","2","3","4"].includes(k)){
      const btn = stage.querySelector(`[data-act="mc"][data-i="${+k - 1}"]:not(:disabled), [data-act="tone"][data-i="${+k - 1}"]:not(:disabled)`);
      if (btn){ e.preventDefault(); btn.click(); return; }
    }
    if (k === "Enter" && !onBtn){ const n = $("nextBtn"); if (n){ e.preventDefault(); n.click(); } }
  }
});
$("charDlg").addEventListener("close", () => { csWriter = null; if (ui.view === "study" && ui.studyMode === "strokes") renderStage(); });

// ---------- Start ----------
applyTheme();
renderAll();
booted = true;
if (hasTTS){
  loadVoices();
  if (speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged", loadVoices);
  setTimeout(() => { loadVoices(); voicesChecked = true; renderBanner(); }, 2500);
}
initRemote();
tellApp();
if (window.hsk){
  if (window.hsk.onUpdateStatus) window.hsk.onUpdateStatus(msg => { updStatus = msg; const el = $("updStatus"); if (el) el.textContent = msg; });
  if (window.hsk.setReminders) window.hsk.setReminders(ui.reminders);
}
setInterval(() => { if (ui.view === "home") { renderNav(); } }, 60000);
})();
