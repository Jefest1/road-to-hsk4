// Handwriting recognition from the strokes you draw. Compares your strokes with reference strokes for
// about 8,000 characters, by position and direction. It tolerates a wrong stroke order but scores it lower.
window.HSK = window.HSK || {};
(function(){
  var ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  var DEC = {}; for (var a = 0; a < 64; a++) DEC[ALPHA[a]] = a / 63;
  var PTS = 6, table = null;

  function load(){
    if (table || !HSK.recogRaw) return;
    table = HSK.recogRaw.split("\n").map(function(line){
      var cp = String.fromCodePoint(line.codePointAt(0)), enc = line.slice(cp.length);
      return {c: cp, n: enc.length / (PTS * 2), enc: enc, d: null};
    });
  }
  function decode(e){
    if (e.d) return e.d;
    var d = new Float32Array(e.enc.length);
    for (var i = 0; i < e.enc.length; i++) d[i] = DEC[e.enc[i]];
    return e.d = d;
  }
  function resample(pts){
    var seg = [0], i;
    for (i = 1; i < pts.length; i++) seg.push(seg[i-1] + Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]));
    var L = seg[seg.length-1], res = [];
    if (!L || pts.length < 2){ for (i = 0; i < PTS; i++) res.push(pts[0][0], pts[0][1]); return res; }
    var j = 0;
    for (var k = 0; k < PTS; k++){
      var t = L * k / (PTS-1);
      while (j < seg.length-2 && seg[j+1] < t) j++;
      var dd = seg[j+1]-seg[j] || 1, f = (t-seg[j])/dd;
      res.push(pts[j][0]+(pts[j+1][0]-pts[j][0])*f, pts[j][1]+(pts[j+1][1]-pts[j][1])*f);
    }
    return res;
  }
  function normalize(strokes){
    var minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
    strokes.forEach(function(s){ s.forEach(function(p){ if(p[0]<minX)minX=p[0]; if(p[0]>maxX)maxX=p[0]; if(p[1]<minY)minY=p[1]; if(p[1]>maxY)maxY=p[1]; }); });
    var sc = Math.max(maxX-minX, maxY-minY, 1e-6), ox = (1-(maxX-minX)/sc)/2, oy = (1-(maxY-minY)/sc)/2;
    return strokes.map(function(s){
      var r = resample(s), out = new Float32Array(PTS*2);
      for (var i = 0; i < PTS; i++){ out[i*2] = (r[i*2]-minX)/sc+ox; out[i*2+1] = (r[i*2+1]-minY)/sc+oy; }
      return out;
    });
  }
  var LEN = PTS * 2, REV = 0.12;
  function dist(u, d, at){ // average point distance, allowing a stroke drawn backwards at a small cost
    var fw = 0, bw = 0;
    for (var i = 0; i < PTS; i++){
      var ux = u[i*2], uy = u[i*2+1];
      var dx = ux - d[at+i*2], dy = uy - d[at+i*2+1]; fw += Math.sqrt(dx*dx + dy*dy);
      var j = PTS-1-i; var bx = ux - d[at+j*2], by = uy - d[at+j*2+1]; bw += Math.sqrt(bx*bx + by*by);
    }
    fw /= PTS; bw = bw / PTS + REV;
    return fw < bw ? fw : bw;
  }
  // Strokes in writing order. Extra or missing strokes are allowed at a cost.
  function ordered(U, d, m){
    var n = U.length, SKIP = 0.28, prev = new Float32Array(m+1), cur = new Float32Array(m+1), i, j;
    for (j = 1; j <= m; j++) prev[j] = j * SKIP;
    for (i = 1; i <= n; i++){
      cur[0] = i * SKIP;
      for (j = 1; j <= m; j++){
        var v = prev[j-1] + dist(U[i-1], d, (j-1)*LEN);
        if (prev[j] + SKIP < v) v = prev[j] + SKIP;
        if (cur[j-1] + SKIP < v) v = cur[j-1] + SKIP;
        cur[j] = v;
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[m] / Math.max(n, m);
  }
  // Any order: each of your strokes takes its closest unused reference stroke.
  function anyOrder(U, d, m){
    var used = new Uint8Array(m), total = 0, n = U.length;
    for (var i = 0; i < n; i++){
      var best = 1e9, bj = -1;
      for (var j = 0; j < m; j++){ if (used[j]) continue; var v = dist(U[i], d, j*LEN); if (v < best){ best = v; bj = j; } }
      if (bj < 0){ total += 0.28; continue; }
      used[bj] = 1; total += best;
    }
    total += Math.max(0, m - n) * 0.28;
    return total / Math.max(n, m) + 0.02;
  }
  // strokes: [[[x,y],...],...]. prefer: optional set of characters the learner is studying.
  HSK.recognize = function(strokes, limit, prefer){
    load();
    if (!table || !strokes.length) return [];
    var U = normalize(strokes), n = U.length, res = [];
    var slack = Math.max(2, Math.round(n * 0.25));
    for (var i = 0; i < table.length; i++){
      var e = table[i]; if (Math.abs(e.n - n) > slack) continue;
      var s = ordered(U, decode(e), e.n);
      if (prefer && prefer.has(e.c)) s -= 0.012;
      res.push({c: e.c, e: e, s: s});
    }
    res.sort(function(a,b){ return a.s - b.s; });
    var top = res.slice(0, 80);
    top.forEach(function(r){
      var v = anyOrder(U, decode(r.e), r.e.n);
      if (prefer && prefer.has(r.c)) v -= 0.012;
      if (v < r.s) r.s = v;
    });
    top.sort(function(a,b){ return a.s - b.s; });
    return top.slice(0, limit || 6).map(function(r){ return {c: r.c, score: r.s}; });
  };
  HSK.recogReady = function(){ return !!HSK.recogRaw; };
})();
