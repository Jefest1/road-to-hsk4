// Pinyin helpers: split into syllables, add tone marks, grade typed answers.
var TM = {a:"āáǎà", e:"ēéěè", i:"īíǐì", o:"ōóǒò", u:"ūúǔù", "ü":"ǖǘǚǜ"};
var MARK = {};
Object.keys(TM).forEach(function(v){ Array.from(TM[v]).forEach(function(c,i){ MARK[c] = [v, i+1]; }); });
var VOW = "aeiouü";
function baseCh(c){ var l = c.toLowerCase(); return MARK[l] ? MARK[l][0] : l; }
function toneCh(c){ var l = c.toLowerCase(); return MARK[l] ? MARK[l][1] : 0; }
function isLetter(c){ var l = c.toLowerCase(); return (l >= "a" && l <= "z") || l === "ü" || !!MARK[l]; }

// Split a run of pinyin letters into syllables: "xuésheng" -> ["xué","sheng"].
function splitChunk(chunk){
  var ch = Array.from(chunk), b = ch.map(baseCh), n = ch.length;
  var isV = function(i){ return i < n && VOW.indexOf(b[i]) >= 0; };
  var out = [], i = 0;
  while (i < n){
    var s = i;
    while (i < n && !isV(i)) i++;
    while (isV(i)) i++;
    if (i < n){
      if (b[i] === "n" && b[i+1] === "g" && !isV(i+2)) i += 2;
      else if (b[i] === "n" && !isV(i+1)) i += 1;
      else if (b[i] === "r" && !isV(i+1)) i += 1;
    }
    if (i < n && b[i] === "r" && !isV(i+1) && b[i-1] === "n") i += 1;
    if (i === s) i++;
    out.push(ch.slice(s, i).join(""));
  }
  return out;
}
function syllInfo(s){
  var base = "", tone = 0;
  Array.from(s).forEach(function(c){ base += baseCh(c); tone = tone || toneCh(c); });
  return {base: base, tone: tone};
}
function chunks(py){
  var out = [], buf = "";
  Array.from(py).forEach(function(c){ if (isLetter(c)) buf += c; else { if (buf) out.push(buf); buf = ""; } });
  if (buf) out.push(buf);
  return out;
}
function pySylls(py){
  var res = [];
  chunks(py).forEach(function(c){ splitChunk(c).forEach(function(s){ res.push(syllInfo(s)); }); });
  return res;
}
function markSyl(base, tone){
  if (!tone) return base;
  var idx = base.indexOf("a");
  if (idx < 0) idx = base.indexOf("e");
  if (idx < 0 && base.indexOf("ou") >= 0) idx = base.indexOf("o");
  if (idx < 0) for (var k = base.length - 1; k >= 0; k--) if ("iouü".indexOf(base[k]) >= 0){ idx = k; break; }
  if (idx < 0) return base;
  return base.slice(0, idx) + TM[base[idx]][tone - 1] + base.slice(idx + 1);
}
// Read what the learner typed: tone numbers (ni3hao3), tone marks (nǐhǎo) or no tones.
function parseInput(raw){
  var s = String(raw || "").normalize("NFC").toLowerCase().replace(/u:/g, "ü").replace(/v/g, "ü");
  var out = [], buf = "";
  function flush(tone){
    if (!buf) return;
    if (tone !== null){ var inf = syllInfo(buf); out.push({base: inf.base, tone: (tone >= 1 && tone <= 4) ? tone : 0}); }
    else splitChunk(buf).forEach(function(x){
      var inf = syllInfo(x);
      // A trailing "r" with no vowel belongs to the syllable before it (yi1dian3r).
      if (!/[aeiouü]/.test(inf.base) && out.length) out[out.length - 1].base += inf.base;
      else out.push(inf);
    });
    buf = "";
  }
  Array.from(s).forEach(function(c){
    if (isLetter(c)) buf += c;
    else if (c >= "0" && c <= "5") flush(+c);
    else flush(null);
  });
  flush(null);
  return out;
}
function normLetters(s){ return s.replace(/([jqxy])ü/g, "$1u"); }
// Compare typed pinyin with the answer. kind: right | tones | wrong | empty
function grade(input, py, hz){
  var U = parseInput(input), T = pySylls(py);
  var uL = normLetters(U.map(function(x){ return x.base; }).join(""));
  var tL = normLetters(T.map(function(x){ return x.base; }).join(""));
  if (!uL) return {kind: "empty"};
  if (uL !== tL){
    var hint = (uL.replace(/ü/g, "u") === tL.replace(/ü/g, "u")) ? "ü" : null;
    return {kind: "wrong", hint: hint, user: U};
  }
  var ok = true, lenient = false;
  if (U.length === T.length){
    for (var k = 0; k < T.length; k++){
      var ut = U[k].tone, tt = T[k].tone;
      if (ut === tt) continue;
      if (tt === 0 && ut !== 0){ lenient = true; continue; }
      if (T[k].base === "bu" && hz.indexOf("不") >= 0 && tt === 2 && ut === 4) continue;
      if (T[k].base === "yi" && hz.indexOf("一") >= 0 && (tt === 2 || tt === 4) && ut === 1) continue;
      ok = false;
    }
  } else {
    var a = U.map(function(x){ return x.tone; }).filter(Boolean).join(",");
    var b = T.map(function(x){ return x.tone; }).filter(Boolean).join(",");
    ok = a === b;
  }
  return {kind: ok ? "right" : "tones", lenient: ok && lenient, user: U};
}
function hasThirdPair(T){
  for (var k = 0; k + 1 < T.length; k++) if (T[k].tone === 3 && T[k+1].tone === 3) return true;
  return false;
}
