/* Meridian：画面と あそび（data.js・kira-config.js・kira.js・kira-art.js・lines.js・glyphs.js のあとに読む） */
(() => {
const OPTKEY = 'suuji-mori-opt', PICKEY = 'suuji-mori-pics';
// プロフィールの一覧・キラの設定は みんなで 1つ。キラと 教科の記録は プロフィールごと（profileKey）
const PROFKEY = 'suuji-mori-profiles', KIRAKEY = 'suuji-mori-kira', KSETKEY = 'suuji-mori-kira-settings';
const MAXPICS = 12;

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = s => document.querySelector(s);
const stage = $('#stage'), bubble = $('#bubble'), homeBtn = $('#homeBtn'), appEl = $('#app');
const jarEl = $('#jar'), whoChip = $('#whoChip'), kiraArea = $('#kiraArea'), kiraBtn = $('#kira'), kbubble = $('#kbubble'), evolveEl = $('#evolve');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- 保存 ---------- */
// 声の設定とえらんだ教科は共通。なれ度・なかまは プロフィールごと・教科ごとに別々に保存
// load は ok(値) が true のときだけ 値を返す（こわれた・古い形のデータは使わない）
const load = (key, ok) => { try { const v = JSON.parse(localStorage.getItem(key)); return v && ok(v) ? v : null; } catch(e) { return null; } };
const store = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch(e) { return false; } };
let opt = { voice: true, subj: 'num' };
const savedOpt = load(OPTKEY, () => true);
if (savedOpt) Object.assign(opt, savedOpt);
else if (load(SUBJ.num.key, old => old.voice === false)) opt.voice = false;  // むかしは 声の設定を 記録といっしょに保存していた
const saveOpt = () => store(OPTKEY, opt);
let profiles = normalizeProfiles(load(PROFKEY, Array.isArray));
const saveProfiles = () => store(PROFKEY, profiles);
let me = profiles.find(p => p.id === opt.profile) || profiles[0];
const pkey = base => profileKey(base, me.id);
let ksaved = load(KSETKEY, v => typeof v === 'object') || {}, kcfg = kiraSettings(ksaved);
const loadKiraOf = id => normalizeKira(load(profileKey(KIRAKEY, id), v => typeof v === 'object'));
let kira = loadKiraOf(me.id);
const saveKira = () => store(pkey(KIRAKEY), kira);
// mem：たんご れんしゅう で その文字を どこまで 見ないで 書けるか（0 うすい手本 / 1 見て けす / 2 声だけ）
const fresh = () => ({ lv: Array(S.max+1).fill(0), evo: Array(S.max+1).fill(1), mem: Array(S.max+1).fill(0), caught: {}, unlocked: S.start || 3, allOpen: false });
let state;
const save = () => store(pkey(S.key), state);
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
  const saved = load(pkey(S.key), s => Array.isArray(s.lv) && s.lv.length === S.max+1);
  state = Object.assign(fresh(), saved);
  delete state.voice;
  pendingNew = null; lastT = 0;
  if (!S.modes.some(m => m[0] === lastGame)) lastGame = hasMode('find')(S) ? 'find' : S.modes[0][0];
}
function useProfile(id){
  me = profiles.find(p => p.id === id) || profiles[0];
  opt.profile = me.id; saveOpt();
  kira = loadKiraOf(me.id);
  useSubj(opt.subj);
  drawKira(); drawJar();
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
// ブラウザの声も おなじ：日本語が 音声ファイルだと タップの中で いちども話さず、あとの 英語の なまえが 鳴らないので、無音で ひと言 話しておく
if ('speechSynthesis' in window) document.addEventListener('pointerdown', () => {
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch(e) {}
}, { capture: true, once: true });
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

/* ---------- なかまモンスター（え は monsters.js） ---------- */
// おなか：1〜10 は 点の数、ほかは その数字・文字・しき
const monSVG = (n, st) => drawMon(S.mon[n][1], S.color[n], st, S.dots && S.dots(n) ? n : S.label[n], S.mon[n][3]);
const monLabel = n => `${S.mon[n][0]} <small class="en">${S.mon[n][2]}</small>`;
const stars = st => '★'.repeat(st) + '☆'.repeat(3-st);
/* ---------- まなびの しくみ ----------
   lv: 0〜3 の「なれ度」。1回目で正解 → +1、まちがえた → -1。
   出てくる数字は 1〜3 から。いま出ている数字がぜんぶ lv2 以上になったら次の数字が登場。
   にがてな数字ほど出やすく、なれるほど選択肢がふえる（2択→3択→4択）。
   なれ度が上がるとモンスターが進化する（進化は下がらない）。こたえた数字・文字の モンスターは なかまに なる。 */
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
  // なれ度は 問題の えらびかた だけに使う（子どもには 見せない）。キラの星は へらない
  state.lv[n] = Math.max(0, Math.min(3, state.lv[n] + (good ? 1 : -1)));
  const st = state.lv[n] >= 3 ? 3 : state.lv[n] >= 2 ? 2 : 1;
  if (st > state.evo[n]) state.evo[n] = st;
  if (state.unlocked < S.max && range(1, state.unlocked).every(x => state.lv[x] >= (S.need || 2))){
    state.unlocked++; pendingNew = state.unlocked;
  }
  save();
}
const pickItem = () => pics.length && Math.random() < .5 ? pick(pics) : pick(ITEMS);

/* ---------- がめん ---------- */
const QUIZ = ['find','count','pair','next','key','name','ear'], ADDQ = ['awase','fueru','ten'], GAMES = [...QUIZ, ...ADDQ, 'balloon', 'trace', 'write', 'tango'];
let mode = null, lastGame = 'find', timers = [], spawnTimer = null, token = 0, q = null, cur = 1, counted = 0;
let walkRaf = 0, walkers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const wait = ms => new Promise(r => later(r, ms));
function clearTimers(){ timers.forEach(clearTimeout); timers = []; clearInterval(spawnTimer); spawnTimer = null; cancelAnimationFrame(walkRaf); walkRaf = 0; }
function setMode(m){
  clearTimers(); mode = m; token++;
  const game = GAMES.includes(m);
  if (game) lastGame = m;
  appEl.dataset.mode = game ? 'game' : m;
  appEl.classList.toggle('writing', ['trace', 'write', 'tango'].includes(m));
  jarEl.hidden = !game && m !== 'home';
  homeBtn.hidden = ['home', 'who', 'night'].includes(m);
  whoChip.hidden = m !== 'home' || profiles.length < 2;
  whoChip.innerHTML = `<span style="--c:${me.color}">${esc([...me.name][0] || '?')}</span>${esc(me.name)}`;
  // あげていない星は へらさない：画面が かわるときは そのまま キラへ
  gifts.slice().forEach(g => receive(g));
  roundDone = 0;  // とちゅうで やめた 1回は かぞえない（つぎは 1もんめから）
  if (!game){ kiraFace(m === 'night' ? 'sleepy' : 'normal'); kiraSays(''); }
  drawJar();
}
const caughtCount = () => range(1,S.max).filter(n => state.caught[n]).length;

function home(){
  if (timeUp(kira, kcfg, Date.now())) return goodnight();
  setMode('home');
  // 教科は 4こずつ 2だんの タイル（えの下に なまえ）：ホームを スクロールなしで 1画面に おさめる
  const tab = (t, attr) => { const [ic, ...w] = t.split(' '); return `<button ${attr}><span class="ic">${ic}</span>${w.join(' ')}</button>`; };
  const tabs = Object.values(SUBJ).map(s => tab(s.tab, `data-subj="${s.id}" aria-pressed="${s === S}"`)).join('')
    + tab('🎨 ぬりえ', 'data-go="nurie" aria-pressed="false"');
  const stones = range(1,S.max).map(n => n <= pool().length
    ? `<button class="stone" data-learn="${n}" style="--c:${S.color[n]}" aria-label="${S.yomi[n]}">${state.lv[n]>=3?'<span class="crown">👑</span>':''}${S.flags ? '' : S.label[n]}</button>`
    : `<span class="stone locked" aria-hidden="true">🌱</span>`).join('');
  stage.innerHTML = `
    <div class="subj" role="group" aria-label="なにを まなぶ？">${tabs}</div>
    <div class="path-label">${S.name}の みち</div>
    <div class="path${S.max > 13 ? ' many' : ''}${S.cols ? ' facts' : ''}${S.pitch ? ' notes' : ''}"${S.cols ? ` style="grid-template-columns:repeat(${S.cols},minmax(0,1fr))"` : ''}>${stones}</div>
    <div class="modes">${S.modes.map(([go, c, ic, t, sm], i, all) =>
      `<button class="mode${all.length <= 3 || (all.length % 2 && i === all.length-1) ? ' wide' : ''}" data-go="${go}" style="--c:${c}"><span class="ic">${ic}</span>${t}<small>${sm}</small></button>`).join('')}</div>
    <div class="row"><button class="book-btn" data-go="book">📖 ずかん <b>${caughtCount()} / ${S.max}</b></button>
      <button class="book-btn" data-go="hiroba">🌳 なかまの ひろば</button></div>`;
  if (!greetNext) return tell('home');
  // えらんだ あとの はじめの ホーム：ひさしぶりでも「おかえり！」と よろこぶだけ
  greetNext = false;
  const g = greeting(kira, Date.now());
  kira.lastPlayedAt = Date.now(); saveKira();
  kiraFace('happy'); kiraSays(g === 'okaeri' ? 'おかえり！' : 'あそぼう！');
  later(() => kiraFace('normal'), 2500);
  guide(LINE.home()[0], LINE[g === 'okaeri' ? 'okaeri' : 'hello']()[1] + ' ' + LINE.home()[1]);
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
  hira: n => `<button class="bignum" data-n="${n}" aria-label="${S.yomi[n]}">${S.label[n]}</button>
       <button class="word" data-word="${n}" aria-label="${esc(HWORD[n][1])}"><span class="em">${HWORD[n][0]}</span><span>${markWord(HWORD[n][1], S.label[n])}</span></button>`,
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
// せいかい：ほめて、大きな星を だす。キラに あげたら つぎへ（ms：ほめ言葉が おわるまでは つぎに いかない）
function win(n, next, ms){
  const key = mode === 'ten' ? 'rightTen' : ADDQ.includes(mode) ? 'rightAdd' : 'right';
  const praise = () => guide(...LINE[key](pick(PRAISE), n, mode), () => { if (giftsShown < 3 && gifts.some(g => g.big)) sayKira(LINE.giveStar()[1]); });
  // おとあて：さきに その音を きかせてから ほめる
  mode === 'ear' ? later(praise, 900) : praise();
  // なかまは こたえると しぜんに ふえる（ずかん・ひろば）
  if (!state.caught[n]){ state.caught[n] = true; save(); }
  kiraFace('happy');
  starTime(next, Date.now() + ms);
}
function startQuiz(kind){ setMode(kind); nextQ(); }
function nextQ(){
  ask();
  const t = pickTarget(mode === 'next' ? n => S.val(n) >= 3 : undefined); q = {t, miss:0, over:false};
  reshift();
  const lab = mode === 'pair' ? S.lower : S.label;
  const btns = makeChoices(t).map(n => `<button class="choice" data-ans="${n}" style="--c:${S.color[n]}" aria-label="${S.yomi[n]}">${S.flags ? flagSVG(S.color[n]) + `<span>${lab[n]}</span>` : lab[n]}</button>`).join('');
  if (mode === 'key'){
    stage.innerHTML = `<div class="card count-card">${keyboard({ ans: true })}</div>`;
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
    stage.innerHTML = `<div class="choices">${btns}</div>`;
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
    q.miss++; boop(); tried();
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
function startAdd(kind){ setMode(kind); nextAdd(); }
function nextAdd(){
  ask();
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
    q.miss++; boop(); tried();
    el.classList.add('wrong'); el.disabled = true;
    tell(mode === 'ten' ? 'wrongTen' : 'wrongAdd', v);
    if (q.miss >= 2) stage.querySelector(`[data-ans="${q.ans}"]`).classList.add('glow');
  }
}

function balloon(){ setMode('balloon'); nextBalloon(); }
function nextBalloon(){
  clearTimers(); ask();
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
    q.miss++; boop(); tried();
    b.animate([{transform:'rotate(0)'},{transform:'rotate(-18deg)'},{transform:'rotate(18deg)'},{transform:'rotate(0)'}],{duration:400});
    tell('is', n);
  }
}

/* ---------- なぞりがき ----------
   いまの画の 緑の丸から なぞる。手本の線から はずれすぎなければ 進み、指をはなしても 進みは のこる。
   なぞった分だけ 手本の線に色がつく（指の線そのものではないので ガタガタでも きれいに見える）。
   ガイドつきで かならず できるので なれ度は 上げ下げしない。 */
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
function trace(){ setMode('trace'); traceDeck = []; nextTrace(); }
function nextTrace(){
  ask();
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
// 指の いちを 手本の 座標に。iPhone の Safari は getScreenCTM が viewBox の よはく（よこ長の わくに たて長の 字を 入れたときの ずれ）を
// 入れずに かえすことが あり、書いた線が 指から ずれるので、わくの 大きさと viewBox から じぶんで 計算する（preserveAspectRatio は きほんの まんなか あわせ）
const svgPt = (svg, e) => {
  const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, k = Math.min(r.width / vb.width, r.height / vb.height);
  return [vb.x + (e.clientX - r.left - (r.width - vb.width * k) / 2) / k, vb.y + (e.clientY - r.top - (r.height - vb.height * k) / 2) / k];
};
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
  // なぞりがきは なれ度を変えない
  win(n, nextTrace, 1800);
}

/* ---------- かいてみよう ----------
   うすい手本の上に 自由に書く。書いた線と 手本を くらべて 判定する（書き順と 書いた向きは見ない）。
   点には 線の向き（0〜180°）もつけて、近くても 向きが ちがう線は 合っていないとみなす（O と D、H と M などを見分ける）。
   ・手本の点のうち 同じ向きの書いた線が W_HIT 以内にある わりあい：全体で 88% 以上、どの画も 85% 以上（点のような みじかい画は 60%）
   ・ひらがな（S.tail）は どの画も おわりの S.tail 点の 60% 以上（め と ぬ のように おわりの まるだけ ちがう字を 見分ける）
   ・書いた点のうち 同じ向きの手本が W_HIT 以内にある わりあい：90% 以上、長さも 手本の2倍まで（ぐちゃぐちゃ塗りは ×）
   ぜんたいが すこし ずれて書いていても いいように、書いた線を 手本に いちばん合う所まで（W_SHIFT まで）ずらしてから くらべる。
   指をはなして すこし待ち、書けていれば 自動で せいかい。「できた！」で その場で判定し、だめなら どこが だめかを 見せる。
   なぞりがきと同じく なれ度は 上げ下げしない。 */
const WRITES = ['write', 'tango'];
const W_HIT = 11, W_ANG = Math.PI / 6, W_SHIFT = 5, W_WAIT = 900, W_DOT = 10;
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
function write(){ setMode('write'); nextWrite(); }
function nextWrite(){
  ask();
  const t = pickTarget(n => !!S.glyph(n));
  q = {t, miss:0, over:false};
  writeBox(S.glyph(t), S.color[t], S.yomi[t], 0);
  tell('write', t);
}
// 書く マス。sup：手本の出かた（0 うすい手本 / 1 見せてから けす / 2 はじめから かくす）。top：マスの上に だすもの
function writeBox(g, c, label, sup, top = ''){
  const w = g.w || 100, gd = (g.s || g).map(strokePts);
  wr = { gd, ink: [], cur: null, gen: 0, len: pathLen(gd), sup, hidden: sup === 2, hint: false, onOk: null };
  stage.innerHTML = `${top}<div class="card count-card" style="--c:${c}">
    <svg class="trace write${wr.hidden ? ' hide' : ''}" id="wsvg" viewBox="0 0 ${w} 100" role="img" aria-label="${label}">
      ${S.masu ? `<g class="masu"><rect x="2" y="2" width="${w-4}" height="96" rx="6"/><path d="M${w/2} 6V94M6 50H${w-6}"/></g>` : ''}
      ${gd.map(p => `<polyline class="wg" points="${ptsAttr(p)}"/>`).join('')}<g class="gaps"></g><g class="inks"></g></svg>
    <div class="row">${sup ? '<button class="pill alt" data-wact="hint">💡 ヒント</button>' : ''}<button class="pill alt" data-wact="clear" disabled>けす</button><button class="pill" data-wact="done" disabled>できた！</button></div></div>`;
}
const writeBtns = () => stage.querySelectorAll('[data-wact]').forEach(b => b.disabled = q.over || (b.dataset.wact !== 'hint' && !wr.ink.length));
// 見せていた 手本を けす（書きはじめたら すぐ けす：写さないように）。うすい手本（sup 0）は けさない
function hideModel(talk){
  if (!wr || !wr.sup || wr.hidden) return;
  wr.hidden = true; $('#wsvg').classList.add('hide');
  if (talk) tell('hidden');
}
// ヒント：かくした 手本を すこしだけ 見せる。その文字は 1つ前の 段階に もどる
function showHint(){
  if (!wr || !wr.hidden || q.over) return;
  wr.hint = true;
  const svg = $('#wsvg'), w0 = wr;
  svg.classList.add('peek'); tell('hint');
  later(() => { if (wr === w0) svg.classList.remove('peek'); }, 2500);
}
function writeDown(svg, e){
  e.preventDefault();
  if (q.over) return;
  hideModel(false);
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
// 手本を かくして 書いたときは 大きさと 位置が ずれやすいので、書いた線の 外わくを 手本の 外わくに あわせる（たて・よこの のびは 1.4倍まで ちがって いい）
function fitBox(ink, gd){
  const box = ps => { const xs = ps.map(p => p[0]), ys = ps.map(p => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  const [a0, b0, a1, b1] = box(ink.flat()), [c0, d0, c1, d1] = box(gd.flat());
  let sx = (c1 - c0) / Math.max(a1 - a0, 4), sy = (d1 - d0) / Math.max(b1 - b0, 4);
  // し・く のように 細い字は 細い向きの のびを 使わない
  if (a1 - a0 < 15 || c1 - c0 < 15) sx = sy; if (b1 - b0 < 15 || d1 - d0 < 15) sy = sx;
  const m = Math.sqrt(sx * sy), cl = v => Math.max(m / 1.2, Math.min(m * 1.2, v));
  sx = Math.max(.4, Math.min(2.5, cl(sx))); sy = Math.max(.4, Math.min(2.5, cl(sy)));
  const ix = (a0 + a1) / 2, iy = (b0 + b1) / 2, gx = (c0 + c1) / 2, gy = (d0 + d1) / 2;
  return ink.map(p => p.map(([x, y]) => [gx + (x - ix) * sx, gy + (y - iy) * sy]));
}
function judge(){
  const raw0 = wr.ink.map(st => dense(st.pts)), raw = wr.sup ? fitBox(raw0, wr.gd) : raw0, [dx, dy] = bestShift(wr.gd.flat(), raw.flat());
  const inks = raw.map(p => withDir(p.map(([x, y]) => [x + dx, y + dy]), 5)), ink = inks.flat(), gd = wr.gd.map(p => withDir(p, 2)), tpl = gd.flat();
  const hit = gd.map(p => p.map(pt => match(pt, ink)));
  // 手本を かくした ときは 書いた 画も 1つずつ 見る：手本に ない 画（う の 点を つ に たす など）が あれば はみだし
  const off = rate(ink.map(pt => match(pt, tpl))) < .9 || wr.sup && inks.some(p => p.length > 6 && rate(p.map(pt => match(pt, tpl))) < .7)
    || pathLen(raw) > wr.len * 2 + 30;
  // ひらがな：画の おわり（ぬ・ね の 小さな まる など）を 書いていないと ×（め と ぬ、わ と ね を 見分ける）
  const tail = !S.tail || hit.every(h => h.length < S.tail * 2 || rate(h.slice(-S.tail)) >= .6);
  // 点のような みじかい画（W_DOT 点まで）は 指では ずれやすいので 60% で いい
  const each = hit.every(h => rate(h) >= (h.length <= W_DOT ? .6 : .85));
  return { ok: !off && tail && each && rate(hit.flat()) >= .88, off, hit };
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
  q.miss++; boop(); tried();
  svg.animate([{transform:'translateX(0)'},{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'translateX(0)'}], {duration:350});
  // 2回まちがえたら 手本を こくする
  if (q.miss >= 2) wr.sup ? later(showHint, 1800) : svg.classList.add('help');
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
  svg.classList.remove('hide', 'peek'); svg.classList.add('done');
  chime(); burst(svg, 24);
  svg.animate([{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1)'}], {duration:500});
  if (wr.onOk) return wr.onOk();
  win(n, nextWrite, 1800);
}

/* ---------- たんご れんしゅう（ひらがな） ----------
   なまえ や ことばを 1文字ずつ 書く。写すだけでは 覚えにくいので、その文字を どこまで 見ないで 書けるか（state.mem）で 手本を へらす：
   0 うすい手本 → 1 3秒 見せて けす → 2 声だけ。ヒントなしで 書けたら 1つ進み、2 で 書けたら なれ度が 上がる。ヒントを 使ったら 1つ もどる。
   上の マスには 書けた 文字だけ 出す（さきの 文字を 見て 写さないように）。 */
const LOOK_MS = 3000;
let tw = null;
const toHira = s => [...s].map(c => { const k = c.codePointAt(0); return k >= 0x30A1 && k <= 0x30F6 ? String.fromCodePoint(k - 0x60) : c; }).join('');
const baseOf = c => HIRA.indexOf([...c.normalize('NFD')][0]);
// なまえ（書ける 字だけで できていれば）と HWORD の ことば
function tangoList(){
  const ok = w => w.length > 0 && [...w].every(c => hiraGlyph(c) && baseOf(c) > 0);
  const nm = toHira(me.name.replace(/\s/g, ''));
  return [...(ok(nm) ? [['📛', nm]] : []), ...HWORD.slice(1).map(([em, w]) => [em, w.replace(/\s/g, '')]).filter(([, w]) => ok(w))];
}
function tango(){
  setMode('tango'); tw = null;
  stage.innerHTML = `<div class="tango-list">${tangoList().map(([em, w], i) =>
    `<button class="tpick${i === 0 && em === '📛' ? ' me' : ''}" data-tango="${i}"><span class="em">${em}</span>${esc(w)}</button>`).join('')}</div>`;
  tell('tangoPick');
}
function startTango(i){
  const [em, w] = tangoList()[i];
  tw = { em, w: [...w], i: 0 };
  guide(...LINE.tango(w), () => { if (tw && tw.i === 0 && mode === 'tango') cueChar(); });
  nextChar(true);
}
function nextChar(quiet){
  ask();
  const c = tw.w[tw.i], n = baseOf(c), sup = state.mem[n] || 0;
  q = {t:n, miss:0, over:false};
  const boxes = tw.w.map((ch, j) => `<span class="tbox${j < tw.i ? ' done' : j === tw.i ? ' now' : ''}">${j < tw.i ? ch : ''}</span>`).join('');
  writeBox(hiraGlyph(c), S.color[n], c, sup, `<div class="tango-word"><span class="em">${tw.em}</span>${boxes}</div>`);
  wr.onOk = () => charOk(n, sup);
  if (!quiet) cueChar();
}
// その文字の 手本の出かたに あわせて 声を かける（見せる ときは LOOK_MS で けす）
function cueChar(){
  const c = tw.w[tw.i], w0 = wr;
  if (w0.sup === 1 && !w0.hidden){ tell('look', c); later(() => { if (wr === w0 && !q.over) hideModel(true); }, LOOK_MS); }
  else tell(w0.sup === 2 || w0.hidden ? 'hear' : 'copy', c);
}
function charOk(n, sup){
  if (wr.hint) state.mem[n] = Math.max(0, sup - 1);
  else if (sup < 2) state.mem[n] = sup + 1;
  else record(n, true);
  if (!state.caught[n]) state.caught[n] = true;
  save();
  if (++tw.i < tw.w.length){ const [p, ps] = pick(PRAISE); guide(p, ps); return later(() => nextChar(), 1300); }
  const w = tw.w.join('');
  later(() => { chime(); burst($('.tango-word'), 30); }, 300);
  stage.querySelectorAll('.tbox').forEach((b, j) => { b.textContent = tw.w[j]; b.classList.add('done'); b.classList.remove('now'); });
  guide(...LINE.tangoDone(w));
  kiraFace('happy');
  starTime(tango, Date.now() + 2400);
}

/* ---------- キラ（え は kira-art.js、そだつ しくみ は kira.js） ----------
   1回の 学習（5もん）が おわるごとに 大きな星を 1こ だす。問題の とちゅうでは 出さない（集中を きらさない）。
   星は キラまで ドラッグ か タップで とんでいく。
   星が ビンに たまって 必要数に とどいたら へんしん。1日の 時間を こえたら 問題の 区切りで ねむくなって おやすみ。 */
let kface = 'normal', gifts = [], giftsShown = 0, greetNext = false, saidNew = null;
let roundDone = 0;  // いまの 1回で おわった 問題の数
const drawKira = () => { kiraBtn.innerHTML = kiraArt(kira.stage, kface, kira.maneColors); };
function kiraFace(f){ if (f !== kface){ kface = f; drawKira(); } }
function kiraSays(t){ kbubble.textContent = t; kbubble.hidden = !t; }
// キラの ひとこと：「もういちど きく」で くりかえすのは 問題文の まま
const sayKira = t => { const keep = lastSpoken; say(t); lastSpoken = keep; };
// アニメーションの おわりを まつ（画面が うしろに あって 止まっていても ms で さきへ すすむ）
const animDone = (a, ms) => Promise.race([a.finished.catch(() => {}), new Promise(r => setTimeout(r, ms))]);
const kiraHop = () => !reduce && kiraBtn.animate([{transform:'translateY(0)'},{transform:'translateY(-14px) scale(1.05)'},{transform:'translateY(0)'}], {duration:420, easing:'ease-out'});
// 問題を だすとき
function ask(){ kiraFace('thinking'); kiraSays(''); }

const JAR = r => `<svg viewBox="0 0 40 48" aria-hidden="true"><rect x="12" y="2" width="16" height="7" rx="3" fill="#C9A8F5"/>
  <path d="M10 10 H30 Q36 14 36 22 V40 Q36 46 30 46 H10 Q4 46 4 40 V22 Q4 14 10 10Z" fill="#fff" stroke="#C9A8F5" stroke-width="3"/>
  <clipPath id="jarIn"><path d="M10 12 H30 Q34 15 34 22 V40 Q34 44 30 44 H10 Q6 44 6 40 V22 Q6 15 10 12Z"/></clipPath>
  <rect x="4" y="${(44 - 32 * r).toFixed(1)}" width="32" height="${(32 * r).toFixed(1)}" fill="#FFD15C" clip-path="url(#jarIn)"/>
  ${kStar(20, 30, 7, '#fff')}</svg>`;
// ビン と 丸5つ（数字は 出さない。たまった わりあいを 丸の ぬりで）
function drawJar(bump){
  const fr = jarDots(kira, kcfg);
  jarEl.innerHTML = `<span class="jar-ic">${JAR(fr.reduce((a, b) => a + b, 0) / fr.length)}</span>`
    + fr.map(f => `<i style="--f:${(f * 100).toFixed(0)}%"></i>`).join('');
  if (bump && !reduce) jarEl.animate([{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}], {duration:400});
}

// 星を だす。キラに とどいたら resolve（かえす値：へんしん { from, to } | null）
function makeGift(){
  const el = document.createElement('button');
  el.className = 'gift big';
  el.setAttribute('aria-label', 'ほし。キラに あげる');
  el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${kStar(50, 53, 46)}</svg>`;
  kiraArea.appendChild(el);
  const g = { el, big: true };
  const p = new Promise(r => g.resolve = r);
  gifts.push(g);
  giftsShown++;
  if (!reduce) el.animate([{transform:'scale(0) rotate(-120deg)'},{transform:'scale(1.15) rotate(0)'},{transform:'scale(1)'}], {duration:500, easing:'ease-out'});
  tone(1047, 0, .2, 'triangle', .12);
  drawGuide();
  el.addEventListener('pointerdown', e => dragGift(g, e));
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fly(g); } });
  return p;
}
const center = r => [r.left + r.width / 2, r.top + r.height / 2];
// 大きな星から キラへの 点線
function drawGuide(){
  const svg = $('#guideLine'), g = gifts.find(x => x.big && !x.flying);
  svg.hidden = !g;
  if (!g) return;
  const base = kiraArea.getBoundingClientRect(), [x1, y1] = center(g.el.getBoundingClientRect()), [x2, y2] = center(kiraBtn.getBoundingClientRect());
  const ln = svg.querySelector('line'), k = .78;
  ln.setAttribute('x1', x1 - base.left); ln.setAttribute('y1', y1 - base.top);
  ln.setAttribute('x2', x1 + (x2 - x1) * k - base.left); ln.setAttribute('y2', y1 + (y2 - y1) * k - base.top);
}
// ゆびで ひっぱる。ちょっとしか うごかなければ タップ（そのまま とんでいく）
function dragGift(g, e){
  if (g.flying) return;
  e.preventDefault();
  const el = g.el, [sx, sy] = [e.clientX, e.clientY];
  let dx = 0, dy = 0, moved = false;
  try { el.setPointerCapture(e.pointerId); } catch(err) {}
  el.classList.add('held');
  const move = ev => { dx = ev.clientX - sx; dy = ev.clientY - sy; if (Math.hypot(dx, dy) > 10) moved = true; el.style.translate = `${dx}px ${dy}px`; };
  const up = () => {
    el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
    el.classList.remove('held');
    const k = kiraBtn.getBoundingClientRect(), [cx, cy] = center(el.getBoundingClientRect()), pad = 40;
    const onKira = cx > k.left - pad && cx < k.right + pad && cy > k.top - pad && cy < k.bottom + pad;
    if (!moved || onKira) return fly(g);
    // とどかなかったら もとの ばしょへ（なんども ためせる）
    el.animate([{translate: `${dx}px ${dy}px`}, {translate: '0 0'}], {duration: 300, easing: 'ease-out'});
    el.style.translate = '';
  };
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
async function fly(g){
  if (g.flying) return;
  g.flying = true; drawGuide();
  const el = g.el, [x1, y1] = center(el.getBoundingClientRect()), [x2, y2] = center(kiraBtn.getBoundingClientRect());
  const t0 = el.style.translate || '0px 0px', [ox, oy] = t0.split(' ').map(v => parseFloat(v) || 0);
  tone(1319, 0, .12, 'sine', .08); tone(1760, .1, .15, 'sine', .07);
  if (!reduce) await animDone(el.animate([{translate: `${ox}px ${oy}px`, scale: 1}, {translate: `${ox + x2 - x1}px ${oy + y2 - y1}px`, scale: .3}],
    {duration: 520, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards'}), 700);
  receive(g);
}
// 星が キラに とどいた（画面が かわるときは とばさずに ここへ）
function receive(g){
  if (!gifts.includes(g)) return;
  gifts = gifts.filter(x => x !== g);
  g.el.remove(); drawGuide();
  const r = giveStars(kira, kcfg.starPerRound, kcfg, Date.now());
  kira = r.kira; saveKira();
  drawJar(true);
  kiraFace('happy'); kiraHop();
  kiraBtn.classList.remove('glow'); void kiraBtn.offsetWidth; kiraBtn.classList.add('glow');
  sparkle();
  // せいかいの 星の へんしんは starTime が みせる。それ以外（画面が かわった）は ここで
  if (r.evolved && !GAMES.includes(mode)) showEvolve(r.evolved);
  g.resolve(r.evolved);
}

// まちがえた：こまり顔は すこしだけ（星は 出さない）
function tried(){
  if (!q || q.tried) return;
  q.tried = true;
  kiraFace('oshii');
  later(() => { if (q && !q.over) kiraFace('thinking'); }, 1600);
}

// せいかいの あと：(1回の さいごなら 大きな星を キラへ → ありがとう) → (教科クリア) → (へんしん) → つぎ か おやすみ
async function starTime(next, until){
  const tok = token;
  let evolved = null;
  if (++roundDone >= kcfg.questionsPerRound){
    roundDone = 0;
    kiraSays('ほしを ちょうだい！');
    const nag = k => later(() => {  // なかなか あげないときは やさしく さそう（3回まで）
      if (tok !== token || !gifts.some(g => g.big)) return;
      kiraSays('ほしを ちょうだい！'); kiraHop(); sayKira(LINE.giveStar()[1]);
      gifts.filter(g => g.big).forEach(g => !reduce && g.el.animate([{rotate:'0deg'},{rotate:'-14deg'},{rotate:'14deg'},{rotate:'0deg'}], {duration:500}));
      if (k < 3) nag(k + 1);
    }, 8000);
    nag(1);
    evolved = await makeGift();
    if (tok !== token) return;
    kiraSays('ありがとう！');  // ほめ言葉を さえぎらないよう 声は 出さない
  }
  await wait(Math.max(900, until - Date.now()));
  if (topicCleared(state.lv, S.max, kcfg.topicClearLevel)){
    const r = clearTopic(kira, S.id, kcfg);
    kira = r.kira; saveKira();
    if (r.mane){ drawKira(); kiraHop(); sparkle(); kiraSays('あたらしい いろ！'); tell('mane'); await wait(2800); if (tok !== token) return; }
  }
  if (evolved) return showEvolve(evolved, () => tok === token && afterQ(next));
  afterQ(next);
}
function afterQ(next){
  if (timeUp(kira, kcfg, Date.now())) return goodnight();
  if (pendingNew && pendingNew !== saidNew){ saidNew = pendingNew; tell('newOne', pendingNew); return later(next, 2600); }
  next();
}

// へんしん：まえの すがた → ひかり → あたらしい すがた（2〜3秒）。「やったね！」で もどる
let evGen = 0;
async function showEvolve({ from, to }, done){
  const gen = ++evGen;
  evolveEl.innerHTML = `<div class="ev-rays" aria-hidden="true"></div>
    <div class="ev-stars" aria-hidden="true">${range(1, 14).map(i => `<span style="--x:${(i * 37) % 100}%;--y:${(i * 61) % 100}%;--c:${['#F7B6D2','#C9A8F5','#9ECFF5','#FFD15C'][i % 4]};--d:${(i % 5) * .4}s">★</span>`).join('')}</div>
    <h2 class="ev-title">へんしん！</h2>
    <div class="ev-frame" id="evFrame">${kiraArt(from, 'normal', [])}</div>
    <div class="ev-card" id="evCard"><span class="ev-jar">${JAR(1)}</span><p>ほしの ビンが いっぱい！<br>キラが ${KIRA_STAGES[to].become}</p></div>
    <button class="ev-btn" id="evBtn">やったね！</button>`;
  evolveEl.hidden = false;
  const frame = $('#evFrame'), card = $('#evCard'), btn = $('#evBtn');
  card.style.visibility = btn.style.visibility = 'hidden';
  btn.onclick = () => { evolveEl.hidden = true; evolveEl.innerHTML = ''; drawKira(); kiraFace('happy'); done && done(); };
  stopVoice(); fanfare();
  if (!reduce) await animDone(frame.animate([{filter:'brightness(1)'},{filter:'brightness(3)'},{filter:'brightness(1.2)'},{filter:'brightness(4)'},{filter:'brightness(1.5)'},{filter:'brightness(6)', transform:'scale(1.1)'}],
    {duration: 1700, easing: 'ease-in'}), 1900);
  if (gen !== evGen) return;
  frame.innerHTML = kiraArt(to, 'happy', kira.maneColors);
  if (!reduce) frame.animate([{filter:'brightness(6)', transform:'scale(.8)'},{filter:'brightness(1)', transform:'scale(1.06)'},{transform:'scale(1)'}], {duration: 700, easing: 'ease-out'});
  sparkle(); burst(frame, 40);
  await new Promise(r => setTimeout(r, 700));
  if (gen !== evGen) return;
  card.style.visibility = btn.style.visibility = '';
  say(LINE.evolve(to)[1]);
  btn.focus({ preventScroll: true });
}

// じかんが おわった：ねむい… → おやすみ（またあした。かなしい演出は しない）
function goodnight(){
  setMode('night');
  kiraSays('ねむい…');
  stage.innerHTML = `<div class="night"><div class="moon" aria-hidden="true"></div>
    <div class="zz" aria-hidden="true">${range(1, 7).map(i => `<span style="--x:${(i * 29) % 100}%;--y:${(i * 47) % 100}%;--d:${i * .3}s">✦</span>`).join('')}</div>
    ${profiles.length > 1 ? `<button class="pill alt" data-go="who">👤 ほかの こ</button>` : ''}</div>`;
  appEl.classList.remove('sleeping'); void appEl.offsetWidth;
  tellThen(() => { if (mode !== 'night') return; appEl.classList.add('sleeping'); kiraSays('Zz…'); tell('night'); }, 'sleepy');
}
// だれが あそぶ？（ほかの子の 進みぐあいは 出さない）
function who(){
  setMode('who');
  stage.innerHTML = `<div class="who">${profiles.map(p =>
    `<button class="who-btn" data-who="${p.id}" style="--c:${p.color}"><span class="who-ic">${esc([...p.name][0] || '?')}</span>${esc(p.name)}</button>`).join('')}</div>`;
  tell('who');
}
kiraBtn.addEventListener('click', () => {
  kiraHop(); tone(988, 0, .15, 'triangle', .1);
  gifts.forEach(fly);  // キラを さわっても 星は とんでくる
});
window.addEventListener('resize', drawGuide);

// あそんだ 時間（画面が 見えている あいだ。おやすみ・だれが あそぶ？・おうちのかたの画面は かぞえない）
let tickAt = Date.now();
setInterval(() => {
  const now = Date.now(), dt = Math.min(now - tickAt, 15000);
  tickAt = now;
  if (document.hidden || !sheet.hidden || mode === 'night' || mode === 'who') return;
  kira = addPlayTime(kira, dt, now); saveKira();
}, 5000);
document.addEventListener('visibilitychange', () => { tickAt = Date.now(); });

function book(){
  setMode('book');
  const slots = range(1,S.max).map(n => state.caught[n]
    ? `<button class="zslot" data-mon="${n}">${monSVG(n, state.evo[n])}${S.mon[n][0]}<span class="st">${stars(state.evo[n])}</span></button>`
    : `<span class="zslot sil">${monSVG(n, 1)}？？？</span>`).join('');
  stage.innerHTML = `<div class="zhead">${S.name}の なかま ずかん　${caughtCount()} / ${S.max}</div><div class="zukan">${slots}</div>
    ${pics.length ? `<div class="zhead">おうちの なかま</div><div class="homepics">${pics.map(p => `<button data-pic="${p.id}"><img src="${p.src}" alt="">${esc(p.name)}</button>`).join('')}</div>` : ''}
    <div class="row"><button class="pill" data-go="${lastGame}">あそぶ</button><button class="pill alt" data-go="hiroba">🌳 ひろば</button></div>`;
  tell('book', caughtCount());
}

/* ---------- なかまの ひろば ----------
   なかまに なった モンスターが 森の ひろばを あるきまわる。さわると ぴょんと はねて 名前を いう。
   いちは ひろばの 地面の なかの わりあい（0〜1）。奥（上）ほど 小さく、手前ほど 前に かさなる。 */
function hiroba(){
  setMode('hiroba');
  const ns = range(1, S.max).filter(n => state.caught[n]);
  stage.innerHTML = `<div class="park" style="--size:${ns.length > 24 ? 70 : ns.length > 10 ? 88 : 104}px">
      <div class="park-sky" aria-hidden="true"><span class="sun"></span><span class="cloud c1"></span><span class="cloud c2"></span></div>
      <div class="park-trees" aria-hidden="true">${['🌳','🌲','🌳','🌲','🌳','🌲','🌳'].map(t => `<span>${t}</span>`).join('')}</div>
      <div class="park-ground" id="ground">
        ${['🌼','🌷','🍄','🌸','🌼','🌱'].map((f, i) => `<span class="flower" style="left:${8 + i * 16}%;top:${[20,70,40,85,55,10][i]}%" aria-hidden="true">${f}</span>`).join('')}
        ${ns.map(n => `<button class="walker" data-hi="${n}" aria-label="${esc(S.mon[n][0])}"><span class="wflip"><span class="wbody">${monSVG(n, state.evo[n])}</span></span></button>`).join('')}
      </div>
    </div>
    ${ns.length ? '' : `<div class="row"><button class="pill" data-go="${lastGame}">あそぶ</button></div>`}`;
  tell('hiroba', ns.length);
  startWalk();
}
function startWalk(){
  const ground = $('#ground'), rnd = () => .05 + Math.random() * .9;
  walkers = [...ground.querySelectorAll('.walker')].map(el => ({ el, size: el.offsetWidth, x: rnd(), y: rnd(), tx: 0, ty: 0, wait: Math.random() * 2, dir: 1, busy: 0 }));
  walkers.forEach(w => { w.tx = w.x; w.ty = w.y; place(w, ground.clientWidth, ground.clientHeight); });
  if (reduce) return;
  let last = performance.now();
  const step = now => {
    const dt = Math.min(.05, (now - last) / 1000), W = ground.clientWidth, H = ground.clientHeight;
    last = now;
    for (const w of walkers){
      if (w.busy > 0){ w.busy -= dt; continue; }
      const dx = (w.tx - w.x) * W, dy = (w.ty - w.y) * H, dist = Math.hypot(dx, dy);
      if (w.wait > 0){ w.wait -= dt; continue; }
      if (dist < 2){
        // ついたら ひとやすみ。ときどき その場で ぴょん
        w.el.classList.remove('walking'); w.wait = 1 + Math.random() * 3;
        w.tx = Math.max(.03, Math.min(.97, w.x + (Math.random() - .5) * .6)); w.ty = Math.max(.03, Math.min(.97, w.y + (Math.random() - .5) * .5));
        if (Math.random() < .25) hop(w, .6);
        continue;
      }
      const v = Math.min(dist, 46 * dt);
      w.x += dx / dist * v / W; w.y += dy / dist * v / H;
      if (Math.abs(dx) > 4) w.dir = dx < 0 ? -1 : 1;
      w.el.classList.add('walking');
      place(w, W, H);
    }
    walkRaf = requestAnimationFrame(step);
  };
  walkRaf = requestAnimationFrame(step);
}
// 奥（y=0）は 0.75倍、手前（y=1）は 1.05倍
function place(w, W, H){
  const k = .75 + w.y * .3;
  w.el.style.transform = `translate(${(w.x * (W - w.size)).toFixed(1)}px,${(w.y * (H - w.size)).toFixed(1)}px) scale(${k.toFixed(3)})`;
  w.el.style.zIndex = 10 + Math.round(w.y * 100);
  w.el.firstElementChild.style.transform = `scaleX(${w.dir})`;
}
function hop(w, big = 1){
  w.busy = .7;
  w.el.classList.remove('walking');
  w.el.querySelector('.wbody').animate([{transform:'translateY(0) scale(1,1)'},{transform:'translateY(4%) scale(1.08,.9)', offset:.15},
    {transform:`translateY(${-42 * big}%) scale(.94,1.08)`, offset:.5},{transform:'translateY(0) scale(1.08,.92)', offset:.85},{transform:'translateY(0) scale(1,1)'}],
    {duration: 650, easing:'ease-out'});
}
function tapWalker(el){
  const n = +el.dataset.hi, w = walkers.find(x => x.el === el);
  if (w) hop(w); else bounce(el);
  tone(note(n), 0, .3, 'triangle', .14); tone(note(n) * 1.5, .12, .25, 'triangle', .1);
  burst(el, 10);
  tell('mon', n);
}

/* ---------- ぬりえ ----------
   まず 絵（おひめさま・どうぶつ）を えらぶ（小さな絵には いま ぬってある色が出る）。
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
  if (!was && picDone()){ fanfare(); burst($('#nsvg'), 40); tell('nurieDone', pic); later(() => nurie(pic), 3000); }
}
function resetNurie(btn){
  if (!btn.dataset.armed){ btn.dataset.armed = '1'; btn.textContent = '🔄 もういちど おすと けすよ'; return tell('nurieReset'); }
  nu[pic] = {}; store(NURIEKEY, nu); boop(); openPic(pic);
}

const GO = { home, who, learn: () => learn(), balloon, trace, write, tango, book, hiroba, nurie };
QUIZ.forEach(k => GO[k] = () => startQuiz(k));
ADDQ.forEach(k => GO[k] = () => startAdd(k));
// じかんが おわっていたら あそびは はじめず おやすみ
GAMES.forEach(k => { const f = GO[k]; GO[k] = () => timeUp(kira, kcfg, Date.now()) ? goodnight() : f(); });

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
  if (el.dataset.word){ bounce(el, 1.1); return sayLine(S.id === 'hira' ? 'hword' : 'word', +el.dataset.word); }
  if (el.dataset.ans) return (ADDQ.includes(mode) ? answerAdd : answer)(+el.dataset.ans, el);
  if (el.dataset.wact) return el.dataset.wact === 'done' ? writeDone() : el.dataset.wact === 'hint' ? showHint() : writeClear();
  if (el.dataset.tango) return startTango(+el.dataset.tango);
  if (el.classList.contains('item') || el.classList.contains('tenrow') || el.classList.contains('hole')) return countTap(el);
  if (el.dataset.v){ const v = +el.dataset.v; return tapSay(el, LINE.num(v)[1], v); }
  if (el.dataset.who){ useProfile(el.dataset.who); tone(784,0,.15,'triangle',.12); greetNext = true; return home(); }
  if (el.dataset.hi) return tapWalker(el);
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
});
stage.addEventListener('pointerdown', e => {
  const b = e.target.closest('.balloon'); if (b) { e.preventDefault(); popBalloon(b); }
  const t = mode === 'trace' && e.target.closest('#tsvg'); if (t) traceDown(t, e);
  const w = WRITES.includes(mode) && e.target.closest('#wsvg'); if (w) writeDown(w, e);
});
stage.addEventListener('pointermove', e => {
  if (mode === 'trace' && tr && tr.on) traceMove(e);
  if (WRITES.includes(mode) && wr && wr.cur) writeMove(e);
});
['pointerup','pointercancel'].forEach(t => stage.addEventListener(t, () => {
  if (tr) tr.on = false;
  if (WRITES.includes(mode) && wr && wr.cur) writeUp();
}));
homeBtn.addEventListener('click', home);
whoChip.addEventListener('click', who);
$('#hearBtn').addEventListener('click', e => { bounce(e.currentTarget, 1.1); say(lastSpoken); });

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
    ${kiraSheet()}
    <p class="legend">ホーム画面の上で「すうじ」「ABC」「ひらがな」「たしざん」「けんばん」「おとあて」「わおん」を切りかえられます。記録と仲間はプロフィールごと・教科ごとに別に残ります。以下は いま あそんでいる「${esc(me.name)}」の「${S.name}」についてです。</p>
    <h3>しくみ</h3>
    <ul>${S.notes.map(t => `<li>${t}</li>`).join('')}</ul>
    <h3>いまの ようす（なれ度 0〜3）</h3>
    <div class="meter" style="grid-template-columns:repeat(${S.cols || (S.max % 10 ? Math.min(S.max, 13) : 10)},minmax(0,1fr))">${range(1,S.max).map(n => `<div class="${n>open?'lock':''}" style="--c:${S.color[n]}">
      <span class="bar-v"><i style="height:${state.lv[n]/3*100}%"></i></span>${S.label[n]}</div>`).join('')}</div>
    <div class="legend">出ている${S.unit}：${S.pitch ? range(1, open).map(n => S.label[n]).join('・') : `${S.label[1]}〜${S.label[open]}`}　／　なかま ${caughtCount()}ひき</div>
    <h3>おうちの なかま（すきな画像）</h3>
    <p class="legend">選んだ画像は「かぞえる絵」と ずかんに出ます（みんなで共通）。名前を入れると読み上げます（ひらがながおすすめ）。画像はこの端末のブラウザの中だけに保存され、どこにも送られません。最大${MAXPICS}枚。</p>
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
      <button class="sbtn danger" id="reset">${esc(me.name)}の「${S.name}」の記録をリセット</button>
      <button class="sbtn primary" id="closeSheet">とじる</button>
    </div>`;
  picMsg = '';
  sheet.hidden = false;
}
const voiceOpts = (vs, cur) => `<option value="">おまかせ</option>` + vs
  .sort((a,b) => isNat(b) - isNat(a) || a.name.localeCompare(b.name))
  .map(v => `<option value="${esc(v.name)}" ${v.name === cur ? 'selected' : ''}>${isNat(v) ? '★ ' : ''}${esc(v.name)}</option>`).join('');
const trySay = () => sayLine('tryIt');
function closeSheet(){
  sheet.hidden = true;
  drawKira(); drawJar();
  // 時間を のばしたら おやすみから もどれる／ちぢめたら ホームで おやすみ
  if (mode === 'home' || mode === 'night') home(); else if (mode === 'book') book(); else if (mode === 'who') who();
}
/* キラ と プロフィール：キラの段階・星の数は ここでだけ 見せる（子どもの画面には 出さない・くらべない） */
function kiraSheet(){
  const now = Date.now(), L = KIRA_CONFIG.limits;
  const rows = profiles.map(p => {
    const k = p.id === me.id ? kira : loadKiraOf(p.id);
    return `<div class="prof"><span class="pdot" style="background:${p.color}"></span>
      <input data-pname="${p.id}" value="${esc(p.name)}" maxlength="12" aria-label="なまえ">
      <span class="pstat">${KIRA_STAGES[k.stage].name}（${k.stage}/${KIRA_FINAL}）・今週 ${weekStars(k, now)}こ・ぜんぶ ${k.totalStars}こ・きょう ${Math.floor(playedToday(k, now) / 60000)}分${k.stage === KIRA_FINAL ? `・たてがみ ${k.maneColors.length}色` : ''}</span>
      ${profiles.length > 1 ? `<button class="sbtn danger" data-pdel="${p.id}">けす</button>` : ''}</div>`;
  }).join('');
  return `<h3>キラ と プロフィール</h3>
    <p class="legend">こたえると（まちがえても）星がもらえ、キラに あげると そだちます。星や段階が へることは ありません。休んだ日が あっても 何も へりません。キラの ようすと 星の数は この画面でだけ 見られます。</p>
    <div class="profs">${rows}</div>
    <button class="sbtn add" id="addProf">＋ プロフィールを ふやす</button>
    <div class="opts">
      <label>1日の プレイ時間（ひとりずつ） <input type="number" class="num" id="kMin" min="${L.minutes[0]}" max="${L.minutes[1]}" value="${kcfg.sessionMinutes}"> 分</label>
      <span class="legend">こえると、その問題が おわったところで キラが ねむくなって おわります（つぎの日に また あそべます）。</span>
      <div class="needs">${range(1, KIRA_FINAL - 1).map(st => `<label>${KIRA_STAGES[st].name} → ${KIRA_STAGES[st + 1].name}
        <span><input type="number" class="num" data-need="${st}" min="${L.stars[0]}" max="${L.stars[1]}" value="${kcfg.starsToNextStage[st]}"> こ</span></label>`).join('')}</div>
      <button class="sbtn" id="kDefault">時間と 星の数を はじめの値に もどす</button>
    </div>`;
}
// はばの外の値は はばの中に なおしてから 保存
const saveKset = () => { kcfg = kiraSettings(ksaved); if (ksaved.sessionMinutes != null) ksaved.sessionMinutes = kcfg.sessionMinutes;
  if (ksaved.starsToNextStage) for (const st in ksaved.starsToNextStage) ksaved.starsToNextStage[st] = kcfg.starsToNextStage[st];
  store(KSETKEY, ksaved); };
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
  if (e.target.id === 'addProf'){ profiles = addProfile(profiles, ''); saveProfiles(); return openSheet(); }
  if (e.target.id === 'kDefault'){ ksaved = {}; saveKset(); return openSheet(); }
  if (e.target.dataset.pdel){
    const id = e.target.dataset.pdel;
    if (!e.target.dataset.armed){ e.target.dataset.armed = '1'; e.target.textContent = 'もう一度おすと 記録ごと 消えます'; return; }
    // その子の 記録（キラ・教科）も けす
    [KIRAKEY, ...Object.values(SUBJ).map(s => s.key)].forEach(k => { try { localStorage.removeItem(profileKey(k, id)); } catch(err) {} });
    profiles = removeProfile(profiles, id); saveProfiles();
    if (me.id === id) useProfile(profiles[0].id);
    return openSheet();
  }
  if (e.target.dataset.del){ pics = pics.filter(p => p.id !== e.target.dataset.del); savePics(); picMsg = '消しました。'; return openSheet(); }
  if (e.target.id === 'tryVoice') return trySay();
  if (e.target.id === 'reset'){
    if (e.target.dataset.armed){ state = fresh(); save(); sheet.hidden = true; home(); }
    else { e.target.dataset.armed = '1'; e.target.textContent = 'もう一度おすと消えます（画像は残ります）'; }
  }
});
sheet.addEventListener('change', e => {
  if (e.target.id === 'picFile') return addPics([...e.target.files]);
  if (e.target.dataset.pname){ profiles = renameProfile(profiles, e.target.dataset.pname, e.target.value); saveProfiles(); me = profiles.find(p => p.id === me.id); e.target.value = profiles.find(p => p.id === e.target.dataset.pname).name; return; }
  if (e.target.id === 'kMin'){ ksaved.sessionMinutes = +e.target.value; saveKset(); e.target.value = kcfg.sessionMinutes; return; }
  if (e.target.dataset.need){ const st = e.target.dataset.need;
    ksaved.starsToNextStage = Object.assign({}, ksaved.starsToNextStage, { [st]: +e.target.value }); saveKset(); e.target.value = kcfg.starsToNextStage[st]; return; }
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
drawKira(); drawJar();
greetNext = true;
profiles.length > 1 ? who() : home();
})();
