/* Meridian：画面と あそび（data.js・lines.js・glyphs.js のあとに読む） */
(() => {
const OPTKEY = 'suuji-mori-opt', PICKEY = 'suuji-mori-pics';
const ROUND = 5, MAXPICS = 12;

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = s => document.querySelector(s);
const stage = $('#stage'), bubble = $('#bubble'), starsEl = $('#stars'), homeBtn = $('#homeBtn'), spacer = $('#spacer');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- 保存 ---------- */
// 声の設定とえらんだ教科は共通。なれ度・なかまは教科ごとに別々に保存
// load は ok(値) が true のときだけ 値を返す（こわれた・古い形のデータは使わない）
const load = (key, ok) => { try { const v = JSON.parse(localStorage.getItem(key)); return v && ok(v) ? v : null; } catch(e) { return null; } };
const store = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch(e) { return false; } };
let opt = { voice: true, subj: 'num' };
const savedOpt = load(OPTKEY, () => true);
if (savedOpt) Object.assign(opt, savedOpt);
else if (load(SUBJ.num.key, old => old.voice === false)) opt.voice = false;  // むかしは 声の設定を 記録といっしょに保存していた
const saveOpt = () => store(OPTKEY, opt);
const fresh = () => ({ lv: Array(S.max+1).fill(0), evo: Array(S.max+1).fill(1), caught: {}, unlocked: S.start || 3, allOpen: false });
let state;
const save = () => store(S.key, state);
// むかしの「1〜10」と「11〜30」の記録を、1〜30 の記録に まとめる（まだ無いときに いちどだけ。むかしの記録は消さない）
(function mergeOldNumbers(){
  if (load(SUBJ.num.key, () => true)) return;
  const ok = len => s => Array.isArray(s.lv) && s.lv.length === len;
  const a = load('suuji-mori-v1', ok(11)), b = load('suuji-mori-big-v1', ok(21));
  if (!a && !b) return;
  const lv = Array(31).fill(0), evo = Array(31).fill(1), caught = {};
  const take = (old, from, to, shift) => { if (!old) return;
    for (let n = from; n <= to; n++){ lv[n + shift] = old.lv[n] || 0; evo[n + shift] = (old.evo && old.evo[n]) || 1; if (old.caught && old.caught[n]) caught[n + shift] = true; } };
  take(a, 1, 10, 0); take(b, 1, 20, 10);
  // 1〜10 が ぜんぶ出ていれば、11〜30 の進みを つづける
  const unlocked = !a ? 3 : a.unlocked < 10 ? a.unlocked : Math.min(30, 10 + (b ? b.unlocked : 0));
  store(SUBJ.num.key, { lv, evo, caught, unlocked, allOpen: !!((a && a.allOpen) || (b && b.allOpen)) });
})();
function useSubj(id){
  S = SUBJ[id] || SUBJ.num; opt.subj = S.id; saveOpt();
  const saved = load(S.key, s => Array.isArray(s.lv) && s.lv.length === S.max+1);
  state = Object.assign(fresh(), saved);
  delete state.voice;
  pendingNew = null; lastT = 0;
  if (!S.modes.some(m => m[0] === lastGame)) lastGame = hasMode('find')(S) ? 'find' : S.modes[0][0];
}
let pics = load(PICKEY, Array.isArray) || [];
const savePics = () => store(PICKEY, pics);

/* ---------- こえ と おと ---------- */
let jaVoice = null, enVoice = null, lastSpoken = '';
// 端末に入っている声のうち、なるべく自然な声をえらぶ（Edge の Natural、Apple の 拡張/プレミアム など）
const NATURAL = /Natural|Neural|Online|Premium|Enhanced|プレミアム|拡張|高品質/i;
const isNat = v => !!v && NATURAL.test(v.name);
const voices = re => ('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter(v => re.test(v.lang));
function bestVoice(vs, fav){
  const rank = v => (isNat(v) ? 4 : 0) + (fav.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  return vs.slice().sort((a,b) => rank(b) - rank(a))[0] || null;
}
function pickVoice(){
  if (!('speechSynthesis' in window)) return;
  const ja = voices(/^ja/i), en = voices(/^en/i), us = en.filter(v => /^en[-_]US/i.test(v.lang));
  jaVoice = ja.find(v => v.name === opt.jaName) || bestVoice(ja, /Nanami|Kyoko|O-ren|Google/i);
  enVoice = en.find(v => v.name === opt.enName) || bestVoice(us.length ? us : en, /Ava|Jenny|Aria|Samantha|Google/i);
}
if ('speechSynthesis' in window){ pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
// VOICEVOX で作った音声：voice/clips.js が window.VOICE = { credit, ids:[...] } を入れる（なければ ぜんぶ ブラウザの声）
const VOICE = window.VOICE || { ids: [] };
const CLIPS = new Set(VOICE.ids);
const useClips = () => opt.clips !== false && CLIPS.size > 0;
const clipUrl = c => `voice/${clipId(c.ja)}.m4a`;
const player = new Audio();
// iPhone は さいしょの タップの中で いちど鳴らした audio でないと あとから鳴らせないので、無音を鳴らしておく
document.addEventListener('pointerdown', () => { if (player.paused) { player.src = silentWav(); player.play().catch(() => {}); } }, { capture: true, once: true });
// 0.01秒の 無音の WAV
function silentWav(){
  const n = 240, d = new DataView(new ArrayBuffer(44 + n*2)), txt = (o, s) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF'); d.setUint32(4, 36 + n*2, true); txt(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
  d.setUint32(24, 24000, true); d.setUint32(28, 48000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); txt(36, 'data'); d.setUint32(40, n*2, true);
  return URL.createObjectURL(new Blob([d], { type: 'audio/wav' }));
}
let sayGen = 0;
const speaking = new Set();  // 再生中の utterance を持っておく（Chrome で GC されて途中で切れるのを防ぐ）
function stopVoice(){
  sayGen++;
  player.onended = player.onerror = null; player.pause();
  if ('speechSynthesis' in window) try { speechSynthesis.cancel(); } catch(e) {}
}
// かたまりを じゅんばんに：日本語は 音声ファイル → なければ ブラウザの声、英語は ブラウザの英語の声
// done：読みおわったら よぶ（とちゅうで ほかの文に かわったら よばない）
function say(t, done){
  lastSpoken = t;
  if (!opt.voice) return done && done();
  stopVoice();
  const gen = sayGen, alive = () => gen === sayGen, steps = chunks(t);
  const clip = c => c.ja && useClips() && CLIPS.has(clipId(c.ja));
  // つぎの音声を先に読みこんでおくと つなぎめの間が短くなる
  if (/^https?:/.test(location.protocol)) steps.filter(clip).forEach(c => fetch(clipUrl(c)).catch(() => {}));
  const run = i => {
    if (!alive()) return;
    if (i >= steps.length) return done && done();
    const c = steps[i], next = () => run(i + 1);
    clip(c) ? playClip(c, next, alive) : speak(c, next, alive);
  };
  // cancel 直後に speak すると Safari で先頭が落ちるので ひと呼吸おく
  setTimeout(() => run(0), 0);
}
function playClip(c, done, alive){
  let fin = false;
  const end = ok => { if (fin || !alive()) return; fin = true; player.onended = player.onerror = null; ok ? done() : speak(c, done, alive); };
  player.onended = () => end(true); player.onerror = () => end(false);
  player.src = clipUrl(c);
  const p = player.play(); if (p) p.catch(() => end(false));
}
function speak(c, done, alive){
  if (!('speechSynthesis' in window)) return done();
  const en = !c.ja && (!!enVoice || !jaVoice);
  let text = c.ja || (en ? c.en : c.kana);
  // 1文字だけの英字は「A.」にして文字の名前として読ませる（A が冠詞 "uh" にならないように）
  if (en && /^[A-Za-z]$/.test(text)) text = text.toUpperCase() + '.';
  try {
    const u = new SpeechSynthesisUtterance(text);
    // はやさは ふつう（英語だけ ほんの少しゆっくり）。自然な声は 高さを いじると かえって不自然になるので そのまま
    if (en){ u.lang = 'en-US'; if (enVoice) u.voice = enVoice; u.rate = .95; u.pitch = isNat(enVoice) ? 1 : 1.05; }
    else { u.lang = 'ja-JP'; if (jaVoice) u.voice = jaVoice; u.rate = 1; u.pitch = isNat(jaVoice) ? 1 : 1.1; }
    speaking.add(u);
    u.onend = u.onerror = () => { speaking.delete(u); if (alive()) done(); };
    speechSynthesis.speak(u);
  } catch(e) { done(); }
}
let ac;
const audio = () => { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state !== 'running') ac.resume(); return ac; };
// iPhone：タップの中で 音を 起こしておく（あとから 鳴らす ピアノの音のため）。消音スイッチでも 鳴るように
document.addEventListener('pointerdown', () => { try { audio(); } catch(e) {} }, { capture: true });
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e) {}
// おとあて では 効果音の高さを 1もんごとに ずらす（きまった高さの音が 答えの手がかりに ならないように）
let sfxShift = 1;
const reshift = () => { sfxShift = S.ear ? 2 ** ((Math.floor(Math.random() * 13) - 6) / 12) : 1; };
function tone(f, at=0, dur=.22, type='sine', vol=.16){
  if (!opt.voice) return;
  try {
    audio(); f *= sfxShift;
    const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t+.02); g.gain.exponentialRampToValueAtTime(.0001, t+dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t+dur+.05);
  } catch(e) {}
}
// ピアノの おと：倍音を かさねて、高い倍音ほど はやく 小さくなる。高さは 本当の高さ（MIDI 69 = ラ = 440Hz）
function piano(m, at = 0, dur = 1.8, vol = .2){
  if (!opt.voice) return;
  try {
    audio();
    const f = 440 * 2 ** ((m - 69) / 12), t = ac.currentTime + at, out = ac.createGain();
    out.gain.setValueAtTime(.0001, t); out.gain.exponentialRampToValueAtTime(vol, t + .006);
    out.gain.exponentialRampToValueAtTime(.0001, t + dur);
    out.connect(ac.destination);
    [[1,1],[2,.55],[3,.3],[4,.16],[5,.08],[6,.05]].forEach(([h, v]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f * h;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(v * .01, t + dur / (1 + h * .5));
      o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
    });
  } catch(e) {}
}
const NOTES = [523,587,659,784,880,1047,1175,1319,1568,1760];
const note = n => NOTES[(n-1) % NOTES.length];
const chime = () => [784,988,1175,1568].forEach((f,i)=>tone(f,i*.08,.3,'triangle',.14));
const boop = () => { tone(330,0,.16,'sine',.12); tone(262,.12,.22,'sine',.1); };
const popSnd = () => { tone(1200,0,.05,'square',.06); tone(600,.03,.08,'triangle',.1); };
const fanfare = () => [523,659,784,1047,784,1047].forEach((f,i)=>tone(f,i*.12,.28,'triangle',.14));
const sparkle = () => [1319,1568,1760,2093,1760,2093,2637].forEach((f,i)=>tone(f,i*.07,.18,'sine',.1));

function guide(text, speak, done){ bubble.textContent = text; say(speak || text, done); }
// LINE の文を ふきだしに出して 読む／読むだけ／読んでから done
const tell = (key, ...a) => guide(...LINE[key](...a));
const tellThen = (done, key, ...a) => guide(...LINE[key](...a), done);
const sayLine = (key, ...a) => say(LINE[key](...a)[1]);
const bounce = (el, s = 1.15) => el.animate([{transform:'scale(1)'},{transform:`scale(${s})`},{transform:'scale(1)'}], {duration:350});
// その番号の音：ドレミの教科は ピアノの音（わおんは 和音を いっしょに）、ほかは 番号ごとの音
const playN = n => { const ms = S.midis(n); ms.forEach(m => piano(m, 0, 2, .2 / Math.sqrt(ms.length))); };
const ding = n => S.pitch ? playN(n) : tone(note(n), 0, .3, 'triangle', .14);
// わおん の 旗
const flagSVG = c => `<svg class="flagsvg" viewBox="0 0 60 60" aria-hidden="true"><rect x="9" y="5" width="4" height="52" rx="2" fill="#8A6A4A"/>
  <path d="M13 8 Q30 1 52 10 L52 34 Q32 27 13 34Z" fill="${c}" stroke="rgba(31,61,53,.25)" stroke-width="1.5"/></svg>`;
// タップした数字・文字を 読んで 音を鳴らす（ドレミは 音を きいてから 名前）
const tapSay = (el, text, n) => { ding(n); bounce(el); S.pitch ? later(() => say(text), 450) : say(text); };

function burst(el, n=18){
  if (reduce || !el) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2;
  for (let i=0;i<n;i++){
    const s = document.createElement('i'); s.className = 'bit';
    s.style.left = cx+'px'; s.style.top = cy+'px'; s.style.background = pick(CONF);
    document.body.appendChild(s);
    const a = Math.random()*Math.PI*2, d = 60 + Math.random()*130;
    s.animate([{transform:'translate(-50%,-50%)',opacity:1},
      {transform:`translate(calc(-50% + ${Math.cos(a)*d}px), calc(-50% + ${Math.sin(a)*d+50}px)) rotate(${Math.random()*540}deg) scale(.5)`,opacity:0}],
      {duration:900+Math.random()*500,easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish = () => s.remove();
  }
}

/* ---------- なかまモンスター（SVGで組み立て） ---------- */
const mirror = s => s + `<g transform="translate(200 0) scale(-1 1)">${s}</g>`;
const EARS = {
  horn:   c => `<path d="M88 72 L100 18 L112 72Z" fill="#FFD54A"/>`,
  horn2:  c => mirror(`<path d="M70 78 L62 26 L92 66Z" fill="#FFD54A"/>`),
  bunny:  c => mirror(`<ellipse cx="76" cy="46" rx="14" ry="36" transform="rotate(-14 76 46)" fill="${c}"/><ellipse cx="76" cy="48" rx="6" ry="24" transform="rotate(-14 76 48)" fill="#FFB3C1"/>`),
  cat:    c => mirror(`<path d="M50 96 L54 30 L98 66Z" fill="${c}"/><path d="M60 82 L62 46 L86 66Z" fill="#FFB3C1"/>`),
  round:  c => mirror(`<circle cx="56" cy="70" r="24" fill="${c}"/><circle cx="56" cy="70" r="12" fill="#FFB3C1"/>`),
  antenna:c => mirror(`<path d="M84 68 Q74 42 64 28" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="62" cy="25" r="10" fill="#FFD54A"/>`),
  leaf:   c => `<path d="M100 66 Q99 46 106 36" stroke="#2C7352" stroke-width="6" fill="none" stroke-linecap="round"/><ellipse cx="122" cy="32" rx="20" ry="11" transform="rotate(-24 122 32)" fill="#5BBF7F"/>`,
  fin:    c => `<path d="M64 76 Q100 4 136 76Z" fill="#7FD3F0"/>` + mirror(`<path d="M40 128 Q14 112 22 92 Q38 104 46 112Z" fill="#7FD3F0"/>`),
};
const STAR = (cx, cy, r) => `<path d="M${cx} ${cy-r} L${cx+r*.28} ${cy-r*.28} L${cx+r} ${cy} L${cx+r*.28} ${cy+r*.28} L${cx} ${cy+r} L${cx-r*.28} ${cy+r*.28} L${cx-r} ${cy} L${cx-r*.28} ${cy-r*.28}Z" fill="#FFD54A"/>`;
function monSVG(n, st){
  const c = S.color[n], s = [0,.78,.9,1][st];
  // おなか：1〜10 は点の数、11〜30 と ABC はその文字
  const dots = !(S.dots && S.dots(n))
    ? `<text x="100" y="163" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="${S.flags && S.label[n].length > 2 ? 30 * 2.4 / S.label[n].length : 30}" fill="${c}">${S.label[n]}</text>`
    : (n <= 5 ? range(0,n-1).map(i => [78 + i*11, 152]) : range(0,n-1).map(i => [78 + (i%5)*11, i<5 ? 146 : 158]))
      .map(([x,y]) => `<circle cx="${x}" cy="${y}" r="4.3" fill="${c}"/>`).join('');
  const eye = `<circle cx="78" cy="108" r="13" fill="#fff"/><circle cx="80" cy="110" r="8" fill="#1F3D35"/><circle cx="83" cy="106" r="3" fill="#fff"/>`;
  return `<svg class="mon" viewBox="0 0 200 200" aria-hidden="true">
    <g transform="translate(100 186) scale(${s}) translate(-100 -186)">
      ${st >= 3 ? mirror(`<ellipse cx="38" cy="104" rx="36" ry="20" transform="rotate(-28 38 104)" fill="#fff" stroke="${c}" stroke-width="3"/>`) : ''}
      ${EARS[S.mon[n][1]](c)}
      ${mirror(`<ellipse cx="74" cy="176" rx="17" ry="10" fill="${c}"/>`)}
      <ellipse cx="100" cy="120" rx="64" ry="58" fill="${c}"/>
      <ellipse cx="80" cy="84" rx="20" ry="10" fill="#fff" opacity=".22"/>
      ${mirror(eye)}
      ${mirror(`<ellipse cx="62" cy="128" rx="9" ry="6" fill="#FF8FA3" opacity=".75"/>`)}
      <path d="M90 126 Q100 136 110 126" stroke="#1F3D35" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="100" cy="152" rx="36" ry="20" fill="#fff" opacity=".85"/>
      ${dots}
      ${st >= 2 ? STAR(100, 80, 10) : ''}
    </g>
    ${st >= 3 ? STAR(26, 40, 12) + STAR(176, 54, 9) + STAR(172, 168, 11) : ''}
  </svg>`;
}
const stars = st => '★'.repeat(st) + '☆'.repeat(3-st);
const CAPSULE = `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="60" rx="34" ry="32" fill="#E7B04A"/><ellipse cx="38" cy="66" rx="8" ry="13" fill="#fff" opacity=".35"/>
  <path d="M14 52 Q14 22 50 22 Q86 22 86 52 Q50 60 14 52Z" fill="#8A5A2B"/><circle cx="34" cy="38" r="3" fill="#6E4520"/><circle cx="50" cy="32" r="3" fill="#6E4520"/><circle cx="66" cy="38" r="3" fill="#6E4520"/><circle cx="42" cy="47" r="3" fill="#6E4520"/><circle cx="58" cy="47" r="3" fill="#6E4520"/>
  <path d="M50 22 L52 9" stroke="#5B3A1A" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="70" r="7" fill="#fff" stroke="#8A5A2B" stroke-width="3"/></svg>`;

/* ---------- まなびの しくみ ----------
   lv: 0〜3 の「なれ度」。1回目で正解 → +1、まちがえた → -1。
   出てくる数字は 1〜3 から。いま出ている数字がぜんぶ lv2 以上になったら次の数字が登場。
   にがてな数字ほど出やすく、なれるほど選択肢がふえる（2択→3択→4択）。
   なれ度が上がるとモンスターが進化する（進化は下がらない）。 */
let pendingNew = null, lastT = 0;
const pool = () => range(1, state.allOpen ? S.max : state.unlocked);
// ok：その遊びで出せる番号だけに しぼる（つぎは なに？は 3 から、書く遊びは 字形のある 1〜10 だけ）
// from：出ている番号の かわりに ここから出す（10を つくろう は 10 になる しき ぜんぶ）
function pickTarget(ok = () => true, from = pool()){
  const all = from.filter(ok), p = all.length > 1 ? all.filter(n => n !== lastT) : all;
  const w = p.map(n => (4 - state.lv[n]) ** 2 + (n === state.unlocked && !state.allOpen ? 4 : 0));
  let r = Math.random() * w.reduce((a,b)=>a+b,0), t = p[p.length-1];
  for (let i=0;i<p.length;i++){ r -= w[i]; if (r <= 0){ t = p[i]; break; } }
  return lastT = t;
}
function makeChoices(t){
  const p = pool(), k = Math.min(p.length, [2,3,4,4][state.lv[t]]);
  if (S.all) return p;  // わおん：出ている旗 ぜんぶを いつも おなじ ならびで（色を さがしやすい）
  const near = S.near ? shuffle(S.near(t).filter(n => n !== t && p.includes(n))) : [];
  const rest = shuffle(p.filter(n => n !== t && !near.includes(n)));
  return shuffle([t, ...[...new Set(near), ...rest].slice(0, k-1)]);
}
function record(n, good){
  state.lv[n] = Math.max(0, Math.min(3, state.lv[n] + (good ? 1 : -1)));
  round.hits.push(n);
  const st = state.lv[n] >= 3 ? 3 : state.lv[n] >= 2 ? 2 : 1;
  if (st > state.evo[n]){ round.evolved.push({n, from: state.evo[n], to: st}); state.evo[n] = st; }
  if (state.unlocked < S.max && range(1, state.unlocked).every(x => state.lv[x] >= (S.need || 2))){
    state.unlocked++; pendingNew = state.unlocked;
  }
  save();
}
const pickItem = () => pics.length && Math.random() < .5 ? pick(pics) : pick(ITEMS);

/* ---------- がめん ---------- */
const QUIZ = ['find','count','pair','next','key','name','ear'], ADDQ = ['awase','fueru','ten'], GAMES = [...QUIZ, ...ADDQ, 'balloon', 'trace', 'write'];
let mode = null, lastGame = 'find', timers = [], spawnTimer = null, token = 0, q = null, cur = 1, counted = 0;
let round = {done:0, hits:[], evolved:[]};
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const wait = ms => new Promise(r => later(r, ms));
function clearTimers(){ timers.forEach(clearTimeout); timers = []; clearInterval(spawnTimer); spawnTimer = null; }
function setMode(m){
  clearTimers(); mode = m; token++;
  const game = GAMES.includes(m);
  if (game) lastGame = m;
  starsEl.hidden = !game; spacer.hidden = game; homeBtn.hidden = m === 'home';
  drawStars();
}
const newRound = () => { round = {done:0, hits:[], evolved:[]}; drawStars(); };
function drawStars(){ starsEl.innerHTML = range(1,ROUND).map(i => `<span class="${i<=round.done?'on':''}">★</span>`).join(''); }
const caughtCount = () => range(1,S.max).filter(n => state.caught[n]).length;

function home(){
  setMode('home');
  const tabs = Object.values(SUBJ).map(s => `<button data-subj="${s.id}" aria-pressed="${s === S}">${s.tab}</button>`).join('')
    + '<button data-go="nurie" aria-pressed="false">🎨 ぬりえ</button>';
  const stones = range(1,S.max).map(n => n <= pool().length
    ? `<button class="stone" data-learn="${n}" style="--c:${S.color[n]}" aria-label="${S.yomi[n]}">${state.lv[n]>=3?'<span class="crown">👑</span>':''}${S.flags ? '' : S.label[n]}</button>`
    : `<span class="stone locked" aria-hidden="true">🌱</span>`).join('');
  stage.innerHTML = `
    <div class="subj" role="group" aria-label="なにを まなぶ？">${tabs}</div>
    <div class="path-label">${S.name}の みち</div>
    <div class="path${S.max > 13 ? ' many' : ''}${S.cols ? ' facts' : ''}${S.pitch ? ' notes' : ''}"${S.cols ? ` style="grid-template-columns:repeat(${S.cols},minmax(0,1fr))"` : ''}>${stones}</div>
    <div class="modes">${S.modes.map(([go, c, ic, t, sm], i, all) =>
      `<button class="mode${all.length <= 3 || (all.length % 2 && i === all.length-1) ? ' wide' : ''}" data-go="${go}" style="--c:${c}"><span class="ic">${ic}</span>${t}<small>${sm}</small></button>`).join('')}</div>
    <button class="book-btn" data-go="book">📖 なかま ずかん <b>${caughtCount()} / ${S.max}</b></button>`;
  tell('home');
}

function learn(n){ setMode('learn'); cur = n || pendingNew || pool().length; pendingNew = null; renderLearn(); }
// 単語のなかの その文字を 色づけ（fox の x など）
const markWord = (w, l) => { const i = w.indexOf(l); return i < 0 ? esc(w) : esc(w.slice(0,i)) + `<b>${esc(l)}</b>` + esc(w.slice(i+1)); };
// みる：教科ごとの カードの中身
const LEARN_CARD = {
  num: n => n <= 10 ? `<button class="bignum" data-n="${n}" aria-label="${YOMI[n]}">${n}</button>
       <div class="hint">${n} は ${HINT[n][1]} <span class="em">${HINT[n][0]}</span></div>
       ${frame(n, pickItem())}`
    : `<button class="bignum" data-n="${n}" aria-label="${S.yomi[n]}"><span class="tens">${S.label[n][0]}</span>${S.label[n][1]}</button>
       <div class="hint">${S.label[n]} は ${tenHint(S.val(n))}</div>
       ${qty(n, pickItem())}`,
  // たしざん：2つの グループを ぜんぶ かぞえると「?」に こたえが出る
  add: n => { const [a, b] = S.fact[n];
    return `<button class="bignum eqbig" data-n="${n}" aria-label="${S.yomi[n]}">${a}+${b}</button>
       ${groups(a, b, true)}
       <div class="hint">${a} と ${b} で <b class="q">?</b></div>`; },
  // けんばん：けんばんの その場所に 色。おとあて：その音を くりかえし きける
  key: n => noteCard(n), oto: n => noteCard(n),
  // わおん：大きな 旗 と 和音の なまえ
  waon: n => `<button class="bignum flagbig" data-n="${n}" aria-label="${S.yomi[n]}">${flagSVG(S.color[n])}</button>
    <div class="hint">${S.label[n]}の はた：<b>${WAON[n][4]}</b></div>
    <button class="play" data-play="cur" aria-label="もういちど きく">🔊</button>`,
  abc: n => `<button class="bignum" data-n="${n}" aria-label="${S.yomi[n]}">${S.label[n]}<span class="lo">${S.lower[n]}</span></button>
       <button class="word" data-word="${n}" aria-label="${esc(WORD[n][1])}"><span class="em">${WORD[n][0]}</span><span>${markWord(WORD[n][1], S.lower[n])}</span></button>`,
};
function noteCard(n){
  const k = S.nt(n), [nm, , , m, hint] = NOTE[k];
  return `<button class="bignum" data-n="${n}" aria-label="${nm}">${nm}</button>
    ${S.ear ? `<button class="play" data-play="cur" aria-label="${nm}の おと">🔊</button>` : `<div class="hint">${hint}</div>`}
    ${keyboard({ on: WHITE.indexOf(m), names: true })}`;
}
function renderLearn(){
  const n = cur;
  counted = 0;
  stage.innerHTML = `
    <div class="card" style="--c:${S.color[n]}">${LEARN_CARD[S.id](n)}</div>
    <div class="nav">
      <button class="arrow" data-step="-1" ${n<=1?'disabled':''} aria-label="まえの ${S.name}">◀</button>
      <button class="arrow" data-step="1" ${n>=S.max?'disabled':''} aria-label="つぎの ${S.name}">▶</button>
    </div>`;
  // おとあて：読みおわったら その音を 鳴らす
  if (S.ear) tellThen(() => playN(n), 'learn', n); else tell('learn', n);
}
/* ---------- けんばん ----------
   まんなかの ド から 上の ド まで（白 8・黒 5）。どの鍵盤も さわると 本当の高さで 鳴る。
   on：色をつける 白鍵（0〜7）、star：★の 白鍵、names：ぜんぶの 白鍵に なまえ、ans：白鍵で こたえる（data-ans は 音の番号） */
const WHITE = [60,62,64,65,67,69,71,72], BLACK = [[61,1],[63,2],[66,4],[68,5],[70,6]];  // [高さ, 右どなりの白鍵]
const PC = {0:1, 2:2, 4:3, 5:4, 7:5, 9:6, 11:7};  // 白鍵の高さ → NOTE の音（ド=1）
const noteOf = m => PC[m % 12] || 0;
function keyboard({ on = -1, star = -1, names = false, ans = false } = {}){
  const w = WHITE.map((m, i) => { const k = noteOf(m), [nm, , c] = NOTE[k];
    return `<button class="key w${i === on ? ' on' : ''}" data-key="${m}"${ans ? ` data-ans="${k}"` : ''} style="--c:${c}" aria-label="${ans || star >= 0 ? 'けんばん' : nm}">${i === star ? '<span class="kstar">★</span>' : ''}<span class="nm">${nm}</span></button>`; }).join('');
  const b = BLACK.map(([m, r]) => `<button class="key b" data-key="${m}" style="--k:${r}" aria-label="くろい けんばん"></button>`).join('');
  return `<div class="kb${names ? ' names' : ''}">${w}${b}</div>`;
}
function keyTap(el){
  const m = +el.dataset.key, k = noteOf(m);
  piano(m);
  // どこ かな？：白鍵で こたえる（黒鍵は 音だけ）
  if (mode === 'key'){ if (q.over) return; if (!k) return tell('keyBlack'); return answer(k, el); }
  // みる：さわった音の なまえを 読む
  if (mode === 'learn' && k){ bounce(el, 1.04); later(() => sayLine('noteName', k), 350); }
}
const playQ = () => playN(q.t);

// 10のわく：5こまでは1だん、6こからは2だん
const face = it => typeof it === 'string' ? it : `<img src="${it.src}" alt="" draggable="false">`;
const faceLabel = it => typeof it === 'string' ? it : esc(it.name || 'え');
function frame(n, it){
  const cells = n <= 5 ? 5 : 10;
  return `<div class="frame">${range(0,cells-1).map(i => i < n
    ? `<button class="cell item" aria-label="${faceLabel(it)}">${face(it)}</button>`
    : `<span class="cell"></span>`).join('')}</div>`;
}
// 10のたば：そろった10は1列まるごと1つのボタン、のこりは1マスずつ
function bars(v, it){
  const full = Math.floor(v/10), ones = v % 10, f = face(it);
  const rows = range(1, full).map(() => `<button class="tenrow" aria-label="10">${`<span class="cell item">${f}</span>`.repeat(10)}</button>`);
  if (ones) rows.push(`<div class="tenrow">${range(0,9).map(i => i < ones
    ? `<button class="cell item" aria-label="${faceLabel(it)}">${f}</button>`
    : `<span class="cell"></span>`).join('')}</div>`);
  return `<div class="bars">${rows.join('')}</div>`;
}
const qty = (n, it) => S.tens && S.tens(n) ? bars(S.val(n), it) : frame(n, it);
const tenHint = v => v % 10 ? `<b>${v - v % 10}</b> と <b>${v % 10}</b>` : `<b>10</b> が ${v/10}つ`;
function countTap(el){
  if (el.classList.contains('tapped')) return sayLine('num', +el.dataset.c);
  counted += el.classList.contains('tenrow') ? 10 : 1; el.dataset.c = counted;
  el.classList.add('tapped'); el.insertAdjacentHTML('beforeend', `<span class="tag">${counted}</span>`);
  tone(note(counted), 0, .25, 'triangle', .13);
  sayLine('num', counted);
  if (mode === 'learn' && counted === S.val(cur)){
    later(() => { const qm = $('.card .q'); if (qm) qm.textContent = counted;
      chime(); burst($('.bignum'), 24); tell('total', counted); }, 650);
  }
}

// せいかい：ほめて 星をふやし、5つ たまったら ごほうび
function win(n, next, ms){
  const praise = () => tell(mode === 'ten' ? 'rightTen' : ADDQ.includes(mode) ? 'rightAdd' : 'right', pick(PRAISE), n, mode);
  // おとあて：さきに その音を きかせてから ほめる
  mode === 'ear' ? later(praise, 900) : praise();
  round.done++; drawStars();
  later(() => round.done >= ROUND ? reward() : next(), ms);
}
function startQuiz(kind){ setMode(kind); newRound(); nextQ(); }
function nextQ(){
  const t = pickTarget(mode === 'next' ? n => S.val(n) >= 3 : undefined); q = {t, miss:0, over:false};
  reshift();
  const lab = mode === 'pair' ? S.lower : S.label;
  const btns = makeChoices(t).map(n => `<button class="choice" data-ans="${n}" style="--c:${S.color[n]}" aria-label="${S.yomi[n]}">${S.flags ? flagSVG(S.color[n]) + `<span>${lab[n]}</span>` : lab[n]}</button>`).join('');
  if (mode === 'key'){
    stage.innerHTML = `<button class="hear" id="hear">🔊 もういちど きく</button><div class="card count-card">${keyboard({ ans: true })}</div>`;
    tell('keyFind', t);
  } else if (mode === 'name'){
    // ★は その音の 白鍵（ド は 下か 上の どちらか）
    const at = pick(WHITE.map((m, i) => noteOf(m) === S.nt(t) ? i : -1).filter(i => i >= 0));
    stage.innerHTML = `<div class="card count-card">${keyboard({ star: at })}</div><div class="choices notes">${btns}</div>`;
    tell('keyName');
  } else if (mode === 'ear'){
    // 音の ボタンだけ（選択肢は 音を 鳴らさない：くらべて あてないように）
    stage.innerHTML = `<button class="play big" data-play="q" aria-label="もういちど きく">🔊</button><div class="choices ${S.flags ? 'flags' : 'notes'}">${btns}</div>`;
    tellThen(playQ, 'ear');
  } else if (mode === 'find'){
    stage.innerHTML = `<button class="hear" id="hear">🔊 もういちど きく</button><div class="choices">${btns}</div>`;
    tell('find', t);
  } else if (mode === 'pair'){
    // 問題の文字は黒にして、色で こたえが わからないようにする
    stage.innerHTML = `<div class="card count-card" style="--c:var(--ink)"><button class="bignum" data-n="${t}" aria-label="${S.yomi[t]}">${S.label[t]}</button></div><div class="choices">${btns}</div>`;
    tell('pair', t);
  } else if (mode === 'next'){
    // まえの 2つを みて、つぎの数を えらぶ（11 のときは 9、10 から）
    const v = S.val(t), seq = [v-2, v-1].map(x => `<button class="bignum" data-v="${x}" aria-label="${numYomi(x)}">${x}</button>`);
    stage.innerHTML = `<div class="card count-card seq">${seq.join('<span class="comma">,</span>')}<span class="comma">,</span><span class="q">?</span></div><div class="choices">${btns}</div>`;
    tell('next', t);
  } else {
    counted = 0;
    const it = pickItem(), nm = typeof it === 'string' ? '' : it.name;
    stage.innerHTML = `<div class="card count-card">${qty(t, it)}</div><div class="choices">${btns}</div>`;
    tell('count', nm);
  }
}
function answer(n, el){
  if (q.over) return;
  if (n === q.t){
    q.over = true;
    el.classList.add('right'); burst(el);
    mode === 'ear' ? playQ() : chime();
    record(q.t, q.miss === 0);
    stage.querySelectorAll('.choice').forEach(b => b.disabled = true);
    win(n, nextQ, mode === 'ear' ? 2800 : 1700);
  } else {
    // まちがいは やさしく：その数字の なまえを おしえて、もう一度
    q.miss++; boop();
    el.classList.add('wrong'); el.disabled = true;
    if (mode === 'count') tell('wrongCount', S.val(n));
    else if (mode === 'ear') tellThen(playQ, 'wrongEar', n);  // もういちど おなじ音
    else tell({ find: 'wrongFind', pair: 'wrongPair', next: 'wrongNext', key: 'wrongKey', name: 'wrongName' }[mode], n, q.t);
    if (q.miss >= 2) stage.querySelector(`[data-ans="${q.t}"]`).classList.add('glow');
  }
}

/* ---------- たしざん ----------
   こたえは しきの番号ではなく 数（1〜10）で えらぶ。なれ度は しきの番号に つける。
   あわせて：2つの グループが くっつく（合併）。ふえると：バスに あとから のってくる（増加・数えたし）。
   10を つくろう：10の わくの あいている数（10の 合成）。 */
// グループの ならべかた：4 は 2×2、5〜9 は 3れつ（サイコロの ように まとまりで 見える）
const cols = k => k <= 3 ? k : k === 4 ? 2 : 3;
const grp = (k, it) => `<div class="grp" style="--k:${cols(k)}">${range(1, k).map(() =>
  `<button class="cell item" aria-label="${faceLabel(it)}">${face(it)}</button>`).join('')}</div>`;
function groups(a, b, joined){
  const it = pickItem(), it2 = pick(ITEMS.filter(x => x !== it));
  return `<div class="groups${joined ? ' joined' : ''}" style="--cols:${cols(a) + cols(b)}">${grp(a, it)}<span class="plus">+</span>${grp(b, it2)}</div>`;
}
// こたえの 選択肢：となりの数（±1、±2）を 優先して まぜる
function numChoices(v, t, hi){
  const k = [2,3,4,4][state.lv[t]], ok = x => x >= 1 && x <= hi && x !== v;
  const near = [...shuffle([v-1, v+1]), ...shuffle([v-2, v+2])].filter(ok);
  const rest = shuffle(range(1, hi).filter(x => ok(x) && !near.includes(x)));
  return shuffle([v, ...near, ...rest].slice(0, k));
}
const TENS = range(1, SUBJ.add.max).filter(n => SUBJ.add.val(n) === 10);
function startAdd(kind){ setMode(kind); newRound(); nextAdd(); }
function nextAdd(){
  const t = pickTarget(undefined, mode === 'ten' ? TENS : pool()), [a, b] = S.fact[t];
  q = {t, ans: mode === 'ten' ? b : a + b, miss:0, over:false};
  counted = mode === 'fueru' ? a : 0;
  const btns = numChoices(q.ans, t, mode === 'ten' ? 9 : 10).map(v =>
    `<button class="choice" data-ans="${v}" style="--c:${COLOR[v]}" aria-label="${numYomi(v)}">${v}</button>`).join('');
  if (mode === 'awase'){
    stage.innerHTML = `<div class="card add-card"><div class="eq">${a} + ${b} = <span class="q">?</span></div>${groups(a, b)}</div>
      <div class="choices">${btns}</div>`;
    later(() => { const g = $('.groups'); if (g){ g.classList.add('joined'); tone(523, 0, .12, 'triangle', .1); tone(784, .1, .2, 'triangle', .1); } }, 1300);
    tell('awase', t);
  } else if (mode === 'fueru'){
    // のっている子は さわれない（さいごの子に a の 番号）。のってくる子を さわると a+1 から かぞえる
    const rider = pick(ANIMALS), comer = pick(ANIMALS.filter(x => x !== rider));
    const seats = range(0, 9).map(i => i < a ? `<span class="cell item">${rider}${i === a-1 ? `<span class="tag">${a}</span>` : ''}</span>`
      : i < a + b ? `<button class="cell item come" aria-label="${comer}" disabled><span class="pas">${comer}</span></button>`
      : `<span class="cell"></span>`).join('');
    stage.innerHTML = `<div class="card add-card"><div class="eq">${a} + ${b} = <span class="q">?</span></div>
      <div class="bus"><div class="frame">${seats}</div></div></div><div class="choices" hidden>${btns}</div>`;
    tell('fueru', t);
    stage.querySelectorAll('.come').forEach((el, i) => later(() => {
      const p = el.firstChild, bus = $('.bus').getBoundingClientRect(), r = el.getBoundingClientRect();
      el.disabled = false; p.style.visibility = 'visible';
      if (!reduce) p.animate([{transform:`translateX(${bus.right - r.left}px)`}, {transform:'none'}], {duration:700, easing:'cubic-bezier(.3,.7,.4,1)'});
      tone(note(a + i + 1), .55, .2, 'triangle', .12);
    }, 1800 + i * 800));
    later(() => { stage.querySelector('.choices').hidden = false; tell('fueruAsk', t); }, 1800 + b * 800 + 400);
  } else {
    // 10の わく：a こ うまっていて、あいている所を さわって かぞえられる
    const it = pickItem(), cells = range(0, 9).map(i => i < a ? `<span class="cell item">${face(it)}</span>`
      : `<button class="cell hole" aria-label="あいてる ところ"></button>`).join('');
    stage.innerHTML = `<div class="card add-card"><div class="eq">${a} + <span class="q">?</span> = 10</div><div class="frame">${cells}</div></div>
      <div class="choices">${btns}</div>`;
    tell('ten', t);
  }
}
function answerAdd(v, el){
  if (q.over) return;
  if (v === q.ans){
    q.over = true;
    el.classList.add('right'); chime(); burst(el);
    record(q.t, q.miss === 0);
    stage.querySelectorAll('.choice').forEach(b => b.disabled = true);
    const qm = $('.eq .q'); qm.textContent = v; qm.classList.add('ok');
    // 10を つくろう：あいていた所に ほしが はいって 10 に なる
    stage.querySelectorAll('.hole').forEach((h, i) => { h.disabled = true; later(() => { h.innerHTML = '⭐'; h.classList.add('filled'); tone(note(10 - q.ans + i + 1), 0, .15, 'triangle', .1); }, i * 120); });
    win(q.t, nextAdd, 2200);
  } else {
    q.miss++; boop();
    el.classList.add('wrong'); el.disabled = true;
    tell(mode === 'ten' ? 'wrongTen' : 'wrongAdd', v);
    if (q.miss >= 2) stage.querySelector(`[data-ans="${q.ans}"]`).classList.add('glow');
  }
}

function balloon(){ setMode('balloon'); newRound(); nextBalloon(); }
function nextBalloon(){
  clearTimers();
  const t = pickTarget(); q = {t, miss:0, hit:0, over:false};
  stage.innerHTML = `<div class="goal"><span class="goal-num">${S.label[t]}</span><span class="goal-dots">${'<i></i>'.repeat(3)}</span></div><div class="sky" id="sky"></div>`;
  tell('balloon', t);
  spawn(); spawnTimer = setInterval(spawn, 1150);
}
function spawn(){
  const sky = $('#sky'); if (!sky || q.over) return;
  const others = pool().filter(x => x !== q.t);
  const n = Math.random() < .45 ? q.t : pick(others);
  const w = document.createElement('div'); w.className = 'bwrap';
  w.style.left = (3 + Math.random()*78) + '%';
  w.innerHTML = `<button class="balloon" data-n="${n}" style="--bc:${pick(BALLOON)};animation-delay:-${(Math.random()*2).toFixed(2)}s" aria-label="${S.yomi[n]}">${S.label[n]}</button>`;
  sky.appendChild(w);
  const a = w.animate([{transform:'translateY(0)'},{transform:`translateY(${-(sky.clientHeight + 190)}px)`}],
    {duration: 7000 + Math.random()*2500, easing:'linear'});
  a.onfinish = () => w.remove();
  w._a = a;
}
function popBalloon(b){
  if (q.over || b.disabled) return;
  const n = +b.dataset.n, w = b.parentElement;
  if (n === q.t){
    b.disabled = true; popSnd(); burst(b, 12); w._a.pause();
    b.animate([{transform:'scale(1)',opacity:1},{transform:'scale(1.5)',opacity:0}],{duration:220,fill:'forwards'}).onfinish = () => w.remove();
    q.hit++;
    stage.querySelectorAll('.goal-dots i').forEach((d,i) => d.classList.toggle('on', i < q.hit));
    if (q.hit >= 3){
      q.over = true; clearInterval(spawnTimer); chime();
      record(q.t, q.miss <= 1);
      win(q.t, nextBalloon, 1800);
    } else say(V(n));
  } else {
    q.miss++; boop();
    b.animate([{transform:'rotate(0)'},{transform:'rotate(-18deg)'},{transform:'rotate(18deg)'},{transform:'rotate(0)'}],{duration:400});
    tell('is', n);
  }
}

/* ---------- なぞりがき ----------
   いまの画の 緑の丸から なぞる。手本の線から はずれすぎなければ 進み、指をはなしても 進みは のこる。
   なぞった分だけ 手本の線に色がつく（指の線そのものではないので ガタガタでも きれいに見える）。
   ガイドつきで かならず できるので なれ度は 上げ下げせず、ごほうびの候補にだけ入れる。 */
const TOL = 16, AHEAD = 8;
let tr = null;
const ptsAttr = p => p.map(([x,y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
// なぞりがきは 出ている数字に しばられず、ぜんぶの数字・文字を まぜた山から じゅんばんに出す（1回の中で 同じのは出ない）
let traceDeck = [];
function pickTrace(){
  if (!traceDeck.length) traceDeck = shuffle(range(1, S.max).filter(n => n !== lastT && S.glyph(n)));
  return lastT = traceDeck.pop();
}
function trace(){ setMode('trace'); newRound(); traceDeck = []; nextTrace(); }
function nextTrace(){
  const t = pickTrace(), g = S.glyph(t), w = g.w || 100;
  q = {t, over:false};
  tr = { strokes: (g.s || g).map(strokePts), si:0, idx:0, on:false };
  const lines = cls => tr.strokes.map(p => `<polyline class="${cls}" points="${cls === 'tg' ? ptsAttr(p) : ''}"/>`).join('');
  stage.innerHTML = `<div class="card count-card" style="--c:${S.color[t]}">
    <svg class="trace" id="tsvg" viewBox="0 0 ${w} 100" role="img" aria-label="${S.yomi[t]}">${lines('tg')}${lines('ink')}
      <polygon class="arr" points="6,0 -4,5.5 -4,-5.5"/><circle class="dot" r="7.5"/></svg></div>`;
  drawTrace();
  tell('trace', t);
}
function drawTrace(){
  const svg = $('#tsvg'); if (!svg) return;
  const tg = svg.querySelectorAll('.tg'), ink = svg.querySelectorAll('.ink'), dot = svg.querySelector('.dot'), arr = svg.querySelector('.arr');
  tr.strokes.forEach((p, i) => {
    tg[i].classList.toggle('later', i > tr.si);
    ink[i].setAttribute('points', ptsAttr(i < tr.si ? p : i === tr.si ? p.slice(0, tr.idx+1) : []));
  });
  const p = tr.strokes[tr.si];
  dot.style.display = arr.style.display = p ? '' : 'none';
  if (!p) return;
  dot.setAttribute('cx', p[tr.idx][0]); dot.setAttribute('cy', p[tr.idx][1]);
  // 向きの矢印：いまの所から すこし先に
  const k = Math.min(tr.idx + 5, p.length - 2);
  if (k <= tr.idx){ arr.style.display = 'none'; return; }
  const ang = Math.atan2(p[k+1][1] - p[k-1][1], p[k+1][0] - p[k-1][0]) * 180 / Math.PI;
  arr.setAttribute('transform', `translate(${p[k][0].toFixed(1)} ${p[k][1].toFixed(1)}) rotate(${ang.toFixed(0)})`);
}
const svgPt = (svg, e) => { const m = svg.getScreenCTM().inverse(), pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return [pt.x, pt.y]; };
function traceDown(svg, e){
  e.preventDefault();
  if (q.over) return;
  if (dist(svgPt(svg, e), tr.strokes[tr.si][tr.idx]) <= TOL + 4){ tr.on = true; try { svg.setPointerCapture(e.pointerId); } catch(err) {} }
  else svg.querySelector('.dot').animate([{opacity:1},{opacity:.2},{opacity:1},{opacity:.2},{opacity:1}], {duration:700});
}
function traceMove(e){
  const svg = $('#tsvg'); if (!svg) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  for (const ev of evs.length ? evs : [e]){
    if (!tr.on) break;
    const pt = svgPt(svg, ev), p = tr.strokes[tr.si];
    for (let j = Math.min(tr.idx + AHEAD, p.length - 1); j > tr.idx; j--){
      if (dist(pt, p[j]) <= TOL){
        if (Math.floor(j / 6) > Math.floor(tr.idx / 6)) tone(440 + j * 6, 0, .07, 'sine', .05);
        tr.idx = j; break;
      }
    }
    if (tr.idx >= p.length - 1) strokeDone();
  }
  drawTrace();
}
function strokeDone(){
  tr.on = false; tr.si++; tr.idx = 0;
  if (tr.si < tr.strokes.length){ tone(784, 0, .2, 'triangle', .12); return tell('traceNext'); }
  const n = q.t, svg = $('#tsvg');
  q.over = true; drawTrace();
  chime(); burst(svg, 24);
  svg.animate([{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1)'}], {duration:500});
  round.hits.push(n);  // なぞりがきは なれ度を変えず、ごほうびの候補にだけ入れる
  win(n, nextTrace, 1800);
}

/* ---------- かいてみよう ----------
   うすい手本の上に 自由に書く。書いた線と 手本を くらべて 判定する（書き順と 書いた向きは見ない）。
   点には 線の向き（0〜180°）もつけて、近くても 向きが ちがう線は 合っていないとみなす（O と D、H と M などを見分ける）。
   ・手本の点のうち 同じ向きの書いた線が W_HIT 以内にある わりあい：全体で 88% 以上、どの画も 85% 以上
   ・書いた点のうち 同じ向きの手本が W_HIT 以内にある わりあい：90% 以上、長さも 手本の2倍まで（ぐちゃぐちゃ塗りは ×）
   ぜんたいが すこし ずれて書いていても いいように、書いた線を 手本に いちばん合う所まで（W_SHIFT まで）ずらしてから くらべる。
   指をはなして すこし待ち、書けていれば 自動で せいかい。「できた！」で その場で判定し、だめなら どこが だめかを 見せる。
   なぞりがきと同じく なれ度は 上げ下げせず、ごほうびの候補にだけ入れる。 */
const W_HIT = 11, W_ANG = Math.PI / 6, W_SHIFT = 5, W_WAIT = 900;
let wr = null;
// 書いた線を 2 ずつの点に（すばやく書くと 点が とびとびになるので）
function dense(pts){
  const out = [pts[0]];
  for (let i=1;i<pts.length;i++){
    const [x0, y0] = pts[i-1], [x1, y1] = pts[i], k = Math.ceil(dist(pts[i-1], pts[i]) / 2);
    for (let j=1;j<=k;j++) out.push([x0 + (x1-x0)*j/k, y0 + (y1-y0)*j/k]);
  }
  return out;
}
// 点に 線の向きをつける：[x, y, 向き]（k こ前と後の点から。指の ふるえで ぶれないよう 書いた線は 広めに見る）
const withDir = (p, k) => p.map((pt, i) => { const a = p[Math.max(0, i-k)], b = p[Math.min(p.length-1, i+k)];
  return [pt[0], pt[1], (Math.atan2(b[1]-a[1], b[0]-a[0]) + Math.PI) % Math.PI]; });
const angGap = (a, b) => { const d = Math.abs(a - b) % Math.PI; return Math.min(d, Math.PI - d); };
const match = (pt, set) => set.some(p => dist(pt, p) <= W_HIT && angGap(pt[2], p[2]) <= W_ANG);
const rate = a => a.filter(Boolean).length / a.length;
const pathLen = s => s.reduce((a, p) => a + p.slice(1).reduce((b, pt, i) => b + dist(pt, p[i]), 0), 0);
// 書いた点を それぞれ いちばん近い手本の点へ よせる平均で ずらす（3回くりかえす）
function bestShift(tpl, ink){
  const lim = v => Math.max(-W_SHIFT, Math.min(W_SHIFT, v));
  let dx = 0, dy = 0;
  for (let it=0;it<3;it++){
    let sx = 0, sy = 0;
    for (const [x, y] of ink){
      let b = tpl[0], bd = Infinity;
      for (const q of tpl){ const d = Math.hypot(x+dx-q[0], y+dy-q[1]); if (d < bd){ bd = d; b = q; } }
      sx += b[0] - x - dx; sy += b[1] - y - dy;
    }
    dx = lim(dx + sx / ink.length); dy = lim(dy + sy / ink.length);
  }
  return [dx, dy];
}
function write(){ setMode('write'); newRound(); nextWrite(); }
function nextWrite(){
  const t = pickTarget(n => !!S.glyph(n)), g = S.glyph(t), w = g.w || 100, gd = (g.s || g).map(strokePts);
  q = {t, miss:0, over:false};
  wr = { gd, ink: [], cur: null, gen: 0, len: pathLen(gd) };
  stage.innerHTML = `<div class="card count-card" style="--c:${S.color[t]}">
    <svg class="trace write" id="wsvg" viewBox="0 0 ${w} 100" role="img" aria-label="${S.yomi[t]}">
      ${gd.map(p => `<polyline class="wg" points="${ptsAttr(p)}"/>`).join('')}<g class="gaps"></g><g class="inks"></g></svg>
    <div class="row"><button class="pill alt" data-wact="clear" disabled>けす</button><button class="pill" data-wact="done" disabled>できた！</button></div></div>`;
  tell('write', t);
}
const writeBtns = () => stage.querySelectorAll('[data-wact]').forEach(b => b.disabled = q.over || !wr.ink.length);
function writeDown(svg, e){
  e.preventDefault();
  if (q.over) return;
  wr.gen++;
  svg.querySelector('.gaps').innerHTML = '';
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  el.setAttribute('class', 'ink');
  svg.querySelector('.inks').appendChild(el);
  const pt = svgPt(svg, e);
  wr.cur = { pts: [pt, [pt[0] + .1, pt[1]]], el };  // 点だけでも 見えるように 2点にしておく
  wr.ink.push(wr.cur);
  el.setAttribute('points', ptsAttr(wr.cur.pts));
  try { svg.setPointerCapture(e.pointerId); } catch(err) {}
  writeBtns();
}
function writeMove(e){
  const svg = $('#wsvg'); if (!svg) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [], p = wr.cur.pts;
  for (const ev of evs.length ? evs : [e]){
    const pt = svgPt(svg, ev);
    if (dist(pt, p[p.length-1]) >= 1) p.push(pt);
  }
  wr.cur.el.setAttribute('points', ptsAttr(p));
}
function writeUp(){
  wr.cur = null;
  const gen = ++wr.gen;
  later(() => { if (gen === wr.gen && !q.over && judge().ok) writeOk(); }, W_WAIT);
}
function judge(){
  const raw = wr.ink.map(st => dense(st.pts)), [dx, dy] = bestShift(wr.gd.flat(), raw.flat());
  const ink = raw.flatMap(p => withDir(p.map(([x, y]) => [x + dx, y + dy]), 5)), gd = wr.gd.map(p => withDir(p, 2)), tpl = gd.flat();
  const hit = gd.map(p => p.map(pt => match(pt, ink)));
  const off = rate(ink.map(pt => match(pt, tpl))) < .9 || pathLen(wr.ink.map(st => st.pts)) > wr.len * 2 + 30;
  return { ok: !off && rate(hit.flat()) >= .88 && Math.min(...hit.map(rate)) >= .85, off, hit };
}
function writeClear(){
  wr.gen++; wr.ink = []; wr.cur = null;
  const svg = $('#wsvg');
  svg.querySelector('.inks').innerHTML = svg.querySelector('.gaps').innerHTML = '';
  writeBtns();
}
function writeDone(){
  if (q.over) return;
  wr.gen++;
  const j = judge(), svg = $('#wsvg');
  if (j.ok) return writeOk();
  q.miss++; boop();
  svg.animate([{transform:'translateX(0)'},{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'translateX(0)'}], {duration:350});
  // 2回まちがえたら 手本を こくする
  if (q.miss >= 2) svg.classList.add('help');
  if (j.off){ writeClear(); return tell('writeOff'); }
  // 書けていない所（つづいた点）を 黄色で しめす
  const runs = [];
  wr.gd.forEach((p, i) => { let r = null; p.forEach((pt, k) => {
    if (j.hit[i][k]) r = null;
    else { if (!r) runs.push(r = []); r.push(pt); }
  }); });
  svg.querySelector('.gaps').innerHTML = runs.map(r => `<polyline class="gap" points="${ptsAttr(r.length > 1 ? r : [r[0], [r[0][0] + .1, r[0][1]]])}"/>`).join('');
  tell('writeMore');
}
function writeOk(){
  const n = q.t, svg = $('#wsvg');
  q.over = true; writeBtns();
  svg.querySelector('.gaps').innerHTML = '';
  svg.classList.add('done');
  chime(); burst(svg, 24);
  svg.animate([{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1)'}], {duration:500});
  round.hits.push(n);
  win(n, nextWrite, 1800);
}

/* ---------- ごほうび：なかまに する ---------- */
let rw = null;
function reward(){
  setMode('reward'); reshift();
  const hits = [...new Set(round.hits)];
  const pool2 = hits.length ? hits : pool();
  const fresh2 = pool2.filter(n => !state.caught[n]);
  const n = fresh2.length ? pick(fresh2) : pick(pool2);
  const isNew = !state.caught[n];
  rw = { n, tok: token, evolved: round.evolved.filter(e => state.caught[e.n] && e.n !== n), nn: pendingNew };
  pendingNew = null;
  const pic = pics.length ? pick(pics) : null;
  stage.innerHTML = `
    <div class="prize"><div class="rays"></div><div class="monwrap" id="mon">${monSVG(n, state.evo[n])}</div></div>
    <div class="mon-name" id="monName">${S.mon[n][0]} <span class="st">${stars(state.evo[n])}</span></div>
    ${isNew ? `<button class="capsule" id="capsule" aria-label="カプセルを なげる">${CAPSULE}タップ！</button>` : ''}
    <div class="after" id="after" hidden>
      ${pic ? `<div class="cheer"><img src="${pic.src}" alt=""><span>${pic.name ? esc(pic.name) + 'も ' : ''}よろこんでるよ！</span></div>` : ''}
      ${rw.nn ? `<button class="newnum" data-learn="${rw.nn}" style="--c:${S.color[rw.nn]}"><span>${S.label[rw.nn]}</span>あたらしい ${S.name}！</button>` : ''}
      <div class="row"><button class="pill" data-go="again">もういっかい</button><button class="pill alt" data-go="book">ずかん</button></div>
    </div>`;
  chime();
  if (isNew) tell('monNew', n);
  else { tell('monVisit', n); afterCatch(); }
}
async function throwCapsule(){
  const {n, tok} = rw, cap = $('#capsule'), mon = $('#mon');
  if (!cap || cap.disabled) return;
  cap.disabled = true;
  const a = cap.getBoundingClientRect(), b = mon.getBoundingClientRect();
  const dx = b.left + b.width/2 - (a.left + a.width/2), dy = b.top + b.height/2 - (a.top + a.height/2);
  const at = r => `translate(${dx}px,${dy}px) rotate(${r}deg)`;
  tone(400,0,.4,'sine',.08); tone(800,.1,.3,'sine',.06);
  await cap.animate([{transform:'translate(0,0) rotate(0)'},{transform:at(720)}],{duration:600,easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'}).finished;
  if (tok !== token) return;
  await mon.animate([{transform:'scale(1)',opacity:1},{transform:'scale(.1)',opacity:0}],{duration:350,fill:'forwards'}).finished;
  for (let i=0;i<3;i++){
    if (tok !== token) return;
    tone(520,0,.08,'square',.05);
    await cap.animate([{transform:at(0)},{transform:at(-22)},{transform:at(22)},{transform:at(0)}],{duration:420}).finished;
    await wait(220);
  }
  if (tok !== token) return;
  state.caught[n] = true; save();
  fanfare(); burst(mon, 36);
  cap.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'});
  mon.animate([{transform:'scale(.1)',opacity:0},{transform:'scale(1.12)',opacity:1},{transform:'scale(1)',opacity:1}],{duration:600,fill:'forwards'});
  tell('caught', n);
  await wait(900);
  cap.remove();
  afterCatch();
}
async function afterCatch(){
  const {tok} = rw;
  for (const e of rw.evolved){
    await wait(2400);
    if (tok !== token) return;
    const mon = $('#mon'), name = S.mon[e.n][0];
    mon.getAnimations().forEach(a => a.cancel());
    mon.innerHTML = monSVG(e.n, e.from);
    $('#monName').innerHTML = `${name} <span class="st">${stars(e.from)}</span>`;
    tell('glow', e.n);
    await mon.animate([{filter:'brightness(1)'},{filter:'brightness(4)'},{filter:'brightness(1)'},{filter:'brightness(4)'},{filter:'brightness(1)'},{filter:'brightness(5)'}],{duration:2000}).finished;
    if (tok !== token) return;
    mon.innerHTML = monSVG(e.n, e.to);
    $('#monName').innerHTML = `${name} <span class="st">${stars(e.to)}</span>`;
    mon.animate([{filter:'brightness(5)',transform:'scale(.9)'},{filter:'brightness(1)',transform:'scale(1)'}],{duration:500});
    sparkle(); burst(mon, 40);
    tell('evolved', e.n);
  }
  await wait(rw.evolved.length ? 1600 : 400);
  if (tok !== token) return;
  $('#after').hidden = false;
  if (rw.nn) { await wait(1800); if (tok === token) tell('newOne', rw.nn); }
}

function book(){
  setMode('book');
  const slots = range(1,S.max).map(n => state.caught[n]
    ? `<button class="zslot" data-mon="${n}">${monSVG(n, state.evo[n])}${S.mon[n][0]}<span class="st">${stars(state.evo[n])}</span></button>`
    : `<span class="zslot sil">${monSVG(n, 1)}？？？</span>`).join('');
  stage.innerHTML = `<div class="zhead">${S.name}の なかま ずかん　${caughtCount()} / ${S.max}</div><div class="zukan">${slots}</div>
    ${pics.length ? `<div class="zhead">おうちの なかま</div><div class="homepics">${pics.map(p => `<button data-pic="${p.id}"><img src="${p.src}" alt="">${esc(p.name)}</button>`).join('')}</div>` : ''}
    <div class="row"><button class="pill" data-go="${lastGame}">あそぶ</button></div>`;
  tell('book', caughtCount());
}

/* ---------- ぬりえ ----------
   まず おひめさまを えらぶ（小さな絵には いま ぬってある色が出る）。
   いろを えらんで 絵の部分をタップすると、その部分（おなじ なまえの部分ぜんぶ）が その色になる。
   ぬった色は 絵ごとに保存するので、つぎに開いても つづきから。ぜんぶ ぬれたら おいわいして、一覧に もどる。 */
const NURIEKEY = 'suuji-mori-nurie';
const nu = load(NURIEKEY, v => typeof v === 'object') || {};  // { princess: { hair: '#FFD84D', ... }, hana: {...} }
let pen = 0, pic = 'princess';  // えらんでいる PALETTE の番号 と 絵
const picFill = (id = pic) => nu[id] = nu[id] || {};
const picDone = (id = pic) => PICTURES[id].parts.every(([k]) => picFill(id)[k]);
const picSVG = (id, attrs, parts) => { const P = PICTURES[id], fill = picFill(id);
  return `<svg viewBox="0 0 ${P.w} ${P.h}" ${attrs}>${P.parts.map(([k, tag, a]) => `<${tag} ${parts ? `class="part" data-part="${k}" ` : 'class="pt" '}${a} fill="${fill[k] || '#fff'}"/>`).join('')}
    <g class="deco">${P.deco}</g></svg>`; };
// done：いま ぬりおわった絵（一覧で ぴょんと はねさせる）
function nurie(done){
  setMode('nurie');
  stage.innerHTML = `<div class="gallery">${Object.entries(PICTURES).map(([id, P]) =>
    `<button class="thumb" data-draw="${id}">${picSVG(id, 'class="nurie-mini" aria-hidden="true"')}<span>${picDone(id) ? '⭐ ' : ''}${P.short || P.name}</span></button>`).join('')}</div>`;
  if (done){ const t = stage.querySelector(`[data-draw="${done}"]`); t.scrollIntoView({ block: 'nearest' }); bounce(t, 1.12); sparkle(); }
  else tell('nurieGallery');
}
function openPic(id){
  pic = id; setMode('nurie');
  stage.innerHTML = `
    <div class="nurie-card">${picSVG(id, `class="nurie" id="nsvg" role="img" aria-label="${PICTURES[id].name}の ぬりえ"`, true)}</div>
    <div class="palette" role="group" aria-label="いろ">${PALETTE.map(([c, nm], i) =>
      `<button class="paint" data-paint="${i}" style="--p:${c}" aria-label="${nm}" aria-pressed="${i === pen}"></button>`).join('')}</div>
    <div class="row"><button class="pill alt nreset" data-go="nurie">📚 えらぶ</button><button class="pill alt nreset" id="nreset">🔄 さいしょから</button></div>`;
  tell('nuriePick', id);
}
function choosePen(el){
  pen = +el.dataset.paint;
  stage.querySelectorAll('.paint').forEach(b => b.setAttribute('aria-pressed', b === el));
  tone(660 + pen * 30, 0, .15, 'triangle', .1); bounce(el, 1.2);
  tell('color', PALETTE[pen]);
}
function paint(part){
  const k = part.dataset.part, c = PALETTE[pen][0], was = picDone();
  picFill()[k] = c; store(NURIEKEY, nu);
  $('#nsvg').querySelectorAll(`[data-part="${k}"]`).forEach(p => p.setAttribute('fill', c));
  popSnd();
  if (!was && picDone()){ fanfare(); burst($('#nsvg'), 40); tell('nurieDone'); later(() => nurie(pic), 3000); }
}
function resetNurie(btn){
  if (!btn.dataset.armed){ btn.dataset.armed = '1'; btn.textContent = '🔄 もういちど おすと けすよ'; return tell('nurieReset'); }
  nu[pic] = {}; store(NURIEKEY, nu); boop(); openPic(pic);
}

const GO = { home, learn: () => learn(), balloon, trace, write, book, nurie, again: () => GO[lastGame]() };
QUIZ.forEach(k => GO[k] = () => startQuiz(k));
ADDQ.forEach(k => GO[k] = () => startAdd(k));

stage.addEventListener('click', e => {
  const part = mode === 'nurie' && e.target.closest('.part'); if (part) return paint(part);
  const el = e.target.closest('button'); if (!el || el.disabled || el.classList.contains('balloon')) return;
  if (el.dataset.paint) return choosePen(el);
  if (el.dataset.key) return keyTap(el);
  if (el.dataset.play){ bounce(el, 1.08); return playN(el.dataset.play === 'q' ? q.t : cur); }
  if (el.dataset.draw){ tone(784, 0, .15, 'triangle', .12); return openPic(el.dataset.draw); }
  if (el.id === 'nreset') return resetNurie(el);
  if (el.dataset.subj){ if (el.dataset.subj !== S.id) { useSubj(el.dataset.subj); tone(784,0,.15,'triangle',.12); } return home(); }
  if (el.dataset.go) return GO[el.dataset.go]();
  if (el.dataset.learn) return learn(+el.dataset.learn);
  if (el.dataset.step){ cur = Math.max(1, Math.min(S.max, cur + +el.dataset.step)); return renderLearn(); }
  if (el.dataset.word){ bounce(el, 1.1); return sayLine('word', +el.dataset.word); }
  if (el.dataset.ans) return (ADDQ.includes(mode) ? answerAdd : answer)(+el.dataset.ans, el);
  if (el.dataset.wact) return el.dataset.wact === 'done' ? writeDone() : writeClear();
  if (el.classList.contains('item') || el.classList.contains('tenrow') || el.classList.contains('hole')) return countTap(el);
  if (el.dataset.v){ const v = +el.dataset.v; return tapSay(el, LINE.num(v)[1], v); }
  if (el.id === 'capsule') return throwCapsule();
  if (el.dataset.mon){
    const n = +el.dataset.mon;
    el.animate([{transform:'translateY(0)'},{transform:'translateY(-10px)'},{transform:'translateY(0)'}],{duration:350});
    ding(n);
    return tell('mon', n);
  }
  if (el.dataset.pic){
    const p = pics.find(x => x.id === el.dataset.pic);
    if (p) { bounce(el); if (p.name) guide(p.name); }
    return;
  }
  if (el.dataset.n){ const n = +el.dataset.n; tapSay(el, V(n), n); }
  if (el.id === 'hear') say(lastSpoken);
});
stage.addEventListener('pointerdown', e => {
  const b = e.target.closest('.balloon'); if (b) { e.preventDefault(); popBalloon(b); }
  const t = mode === 'trace' && e.target.closest('#tsvg'); if (t) traceDown(t, e);
  const w = mode === 'write' && e.target.closest('#wsvg'); if (w) writeDown(w, e);
});
stage.addEventListener('pointermove', e => {
  if (mode === 'trace' && tr && tr.on) traceMove(e);
  if (mode === 'write' && wr && wr.cur) writeMove(e);
});
['pointerup','pointercancel'].forEach(t => stage.addEventListener(t, () => {
  if (tr) tr.on = false;
  if (mode === 'write' && wr && wr.cur) writeUp();
}));
homeBtn.addEventListener('click', home);
$('#owl').addEventListener('click', () => say(lastSpoken));

/* ---------- おうちのかたへ（ながおしで ひらく） ---------- */
const gear = $('#gear'), sheet = $('#sheet'), sheetIn = $('#sheetIn');
let holdT, picMsg = '';
const endHold = () => { clearTimeout(holdT); gear.classList.remove('holding'); };
gear.addEventListener('pointerdown', e => { e.preventDefault(); gear.classList.add('holding'); holdT = setTimeout(() => { endHold(); openSheet(); }, 1200); });
['pointerup','pointerleave','pointercancel'].forEach(t => gear.addEventListener(t, endHold));
gear.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(); } });
gear.addEventListener('contextmenu', e => e.preventDefault());

function openSheet(){
  const open = pool().length;
  sheetIn.innerHTML = `
    <h2 id="sheetTitle">おうちのかたへ</h2>
    <p class="legend">ホーム画面の上で「すうじ」「ABC」「たしざん」「けんばん」「おとあて」「わおん」を切りかえられます。記録と仲間はそれぞれ別に残ります。以下は いま選んでいる「${S.name}」についてです。</p>
    <h3>しくみ</h3>
    <ul>${S.notes.map(t => `<li>${t}</li>`).join('')}</ul>
    <h3>いまの ようす（なれ度 0〜3）</h3>
    <div class="meter" style="grid-template-columns:repeat(${S.cols || (S.max % 10 ? Math.min(S.max, 13) : 10)},minmax(0,1fr))">${range(1,S.max).map(n => `<div class="${n>open?'lock':''}" style="--c:${S.color[n]}">
      <span class="bar-v"><i style="height:${state.lv[n]/3*100}%"></i></span>${S.label[n]}</div>`).join('')}</div>
    <div class="legend">出ている${S.unit}：${S.pitch ? range(1, open).map(n => S.label[n]).join('・') : `${S.label[1]}〜${S.label[open]}`}　／　なかま ${caughtCount()}ひき</div>
    <h3>おうちの なかま（すきな画像）</h3>
    <p class="legend">選んだ画像は「かぞえる絵」とごほうび画面に出ます。名前を入れると読み上げます（ひらがながおすすめ）。画像はこの端末のブラウザの中だけに保存され、どこにも送られません。最大${MAXPICS}枚。</p>
    <div class="pics">${pics.map(p => `<div class="pic"><img src="${p.src}" alt="">
      <input id="pn-${p.id}" data-pid="${p.id}" value="${esc(p.name)}" placeholder="なまえ（れい：ぴかちゅう）" maxlength="12" aria-label="なまえ">
      <button class="sbtn danger" data-del="${p.id}">けす</button></div>`).join('')}</div>
    ${pics.length < MAXPICS ? `<label class="sbtn add">＋ 画像をえらぶ<input type="file" id="picFile" accept="image/*" multiple hidden></label>` : ''}
    ${picMsg ? `<div class="legend" role="status">${esc(picMsg)}</div>` : ''}
    <h3>せってい</h3>
    <div class="opts">
      <label><input type="checkbox" id="optVoice" ${opt.voice?'checked':''}> 声と効果音を出す</label>
      <label><input type="checkbox" id="optAll" ${state.allOpen?'checked':''}> はじめから ${S.label[1]}〜${S.label[S.max]} をすべて出す</label>
      ${CLIPS.size ? `<label><input type="checkbox" id="optClips" ${opt.clips!==false?'checked':''}> ずんだもんの声で読む</label>` : ''}
      <label>日本語の声 <select id="optJa">${voiceOpts(voices(/^ja/i), opt.jaName)}</select></label>
      <label>英語の声 <select id="optEn">${voiceOpts(voices(/^en/i), opt.enName)}</select></label>
      <button class="sbtn add" id="tryVoice">🔊 ためしに きく</button>
    </div>
    <p class="legend">名前に「Natural」「拡張」「プレミアム」「Enhanced」とつく声ほど自然です（おまかせ だと自動でえらびます）。どれも無料：パソコンは Microsoft Edge で開くと「Nanami Online (Natural)」が使えます。iPhone・iPad・Mac は 設定 →アクセシビリティ →読み上げコンテンツ →声 →日本語 から「Kyoko（拡張）」などを追加できます。${CLIPS.size ? 'ずんだもんの声で読むときも、英語と おうちの画像の名前は ここで選んだ声で読みます。' : ''}</p>
    ${VOICE.credit ? `<p class="legend">音声：${esc(VOICE.credit)}</p>` : ''}
    <div class="sheet-actions">
      <button class="sbtn danger" id="reset">「${S.name}」の記録をリセット</button>
      <button class="sbtn primary" id="closeSheet">とじる</button>
    </div>`;
  picMsg = '';
  sheet.hidden = false;
}
const voiceOpts = (vs, cur) => `<option value="">おまかせ</option>` + vs
  .sort((a,b) => isNat(b) - isNat(a) || a.name.localeCompare(b.name))
  .map(v => `<option value="${esc(v.name)}" ${v.name === cur ? 'selected' : ''}>${isNat(v) ? '★ ' : ''}${esc(v.name)}</option>`).join('');
const trySay = () => sayLine('tryIt');
function closeSheet(){ sheet.hidden = true; if (mode === 'home') home(); else if (mode === 'book') book(); }
// 画像は正方形に切り抜いて 240px の JPEG に小さくしてから保存
function shrink(file){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const S = 240, c = document.createElement('canvas'); c.width = c.height = S;
      const ctx = c.getContext('2d'), m = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,S,S);
      ctx.drawImage(img, (img.naturalWidth-m)/2, (img.naturalHeight-m)/2, m, m, 0, 0, S, S);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
}
async function addPics(files){
  let added = 0, failed = 0;
  for (const f of files){
    if (pics.length >= MAXPICS) break;
    try {
      const src = await shrink(f);
      const name = f.name.replace(/\.[^.]+$/, '').slice(0, 12);
      pics.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), src, name: /^[぀-ヿ一-鿿]+$/.test(name) ? name : '' });
      if (!savePics()) { pics.pop(); picMsg = '保存できる量をこえました。いらない画像を消してから、もう一度えらんでください。'; break; }
      added++;
    } catch(e) { failed++; }
  }
  if (!picMsg) picMsg = added ? `${added}枚 くわえました。` + (failed ? `（${failed}枚は読みこめませんでした）` : '') : '画像を読みこめませんでした。写真やPNG・JPEGの画像をえらんでください。';
  openSheet();
}
sheet.addEventListener('click', e => {
  if (e.target === sheet || e.target.id === 'closeSheet') return closeSheet();
  if (e.target.dataset.del){ pics = pics.filter(p => p.id !== e.target.dataset.del); savePics(); picMsg = '消しました。'; return openSheet(); }
  if (e.target.id === 'tryVoice') return trySay();
  if (e.target.id === 'reset'){
    if (e.target.dataset.armed){ state = fresh(); save(); sheet.hidden = true; home(); }
    else { e.target.dataset.armed = '1'; e.target.textContent = 'もう一度おすと消えます（画像は残ります）'; }
  }
});
sheet.addEventListener('change', e => {
  if (e.target.id === 'picFile') return addPics([...e.target.files]);
  if (e.target.dataset.pid){ const p = pics.find(x => x.id === e.target.dataset.pid); if (p) { p.name = e.target.value.trim(); savePics(); } return; }
  if (e.target.id === 'optVoice'){ opt.voice = e.target.checked; saveOpt(); if (!opt.voice) stopVoice(); return; }
  if (e.target.id === 'optClips'){ opt.clips = e.target.checked; saveOpt(); return trySay(); }
  if (e.target.id === 'optJa' || e.target.id === 'optEn'){
    opt[e.target.id === 'optJa' ? 'jaName' : 'enName'] = e.target.value; saveOpt(); pickVoice(); return trySay();
  }
  if (e.target.id === 'optAll') state.allOpen = e.target.checked;
  save();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

useSubj(opt.subj);
home();
})();
