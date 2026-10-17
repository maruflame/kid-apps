/* キラ：そだつ しくみ と プロフィール（DOM を使わない。kira-config.js のあとに読む）
   ここの関数は どれも 受けとった値を かえずに 新しい値を かえす（テストしやすく、こわれた保存データにも つよく）。
   ・星は ふえるだけ。へる しくみは ない
   ・必要数に とどいたら 段階が 1つ上がり、その段階の星は 0 から（端数は 持ちこさない）
   ・休んだ日が あっても 何も へらない。ひさしぶりなら「おかえり！」と よろこぶだけ */

const KIRA_STAGES = [null,
  { name: 'タマゴ', become: '' },
  { name: 'ヒビ', become: 'タマゴに ヒビが はいったよ', becomeSay: '卵に、ひびが入ったよ' },
  { name: 'うまれた', become: 'うまれたよ', becomeSay: '生まれたよ' },
  { name: 'はねがはえた', become: 'はねが はえたよ', becomeSay: '羽が生えたよ' },
  { name: 'ひかるキラ', become: 'ひかる キラに なったよ', becomeSay: '光るキラに、なったよ' },
  { name: 'ユニコーン', become: 'ユニコーンに なったよ', becomeSay: 'ユニコーンに、なったよ' },
];
const KIRA_FINAL = KIRA_STAGES.length - 1;

const isNum = v => typeof v === 'number' && isFinite(v);
const clampInt = (v, [lo, hi], dflt) => isNum(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : dflt;

/* ---------- せってい ---------- */
// saved：おうちのかたが かえた値（こわれていても 使える所だけ使う）
function kiraSettings(saved, base = KIRA_CONFIG){
  const s = saved && typeof saved === 'object' ? saved : {};
  const need = {};
  for (let st = 1; st < KIRA_FINAL; st++)
    need[st] = clampInt(s.starsToNextStage && s.starsToNextStage[st], base.limits.stars, base.starsToNextStage[st]);
  return Object.assign({}, base, {
    starsToNextStage: need,
    sessionMinutes: clampInt(s.sessionMinutes, base.limits.minutes, base.sessionMinutes),
  });
}
const starsNeeded = (cfg, stage) => stage >= KIRA_FINAL ? Infinity : cfg.starsToNextStage[stage];

/* ---------- 日づけ（端末の その日・その週） ---------- */
const pad2 = n => String(n).padStart(2, '0');
const dayKey = now => { const d = new Date(now); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
// 週は 月曜はじまり
const weekKey = now => { const d = new Date(now); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dayKey(d.getTime()); };

/* ---------- キラ ---------- */
const newKira = () => ({ stage: 1, starsInStage: 0, totalStars: 0, maneColors: [], clearedTopics: [], lastPlayedAt: null,
  week: { key: '', stars: 0 }, day: { key: '', ms: 0 } });
// 保存データを 正しい形に（足りない所は はじめの値）
function normalizeKira(v){
  const k = newKira();
  if (!v || typeof v !== 'object') return k;
  if (isNum(v.stage)) k.stage = Math.max(1, Math.min(KIRA_FINAL, Math.floor(v.stage)));
  if (isNum(v.starsInStage)) k.starsInStage = Math.max(0, Math.floor(v.starsInStage));
  if (isNum(v.totalStars)) k.totalStars = Math.max(0, Math.floor(v.totalStars));
  if (Array.isArray(v.maneColors)) k.maneColors = v.maneColors.filter(c => typeof c === 'string');
  if (Array.isArray(v.clearedTopics)) k.clearedTopics = v.clearedTopics.filter(t => typeof t === 'string');
  if (isNum(v.lastPlayedAt)) k.lastPlayedAt = v.lastPlayedAt;
  if (v.week && typeof v.week.key === 'string' && isNum(v.week.stars)) k.week = { key: v.week.key, stars: Math.max(0, v.week.stars) };
  if (v.day && typeof v.day.key === 'string' && isNum(v.day.ms)) k.day = { key: v.day.key, ms: Math.max(0, v.day.ms) };
  if (k.stage === KIRA_FINAL && !k.maneColors.length) k.maneColors = [KIRA_CONFIG.maneOrder[0]];
  return k;
}

// 星を あげる。かえす値：{ kira, evolved: { from, to } | null }
// 1回で 上がるのは 1段階まで。とどいたら 新しい段階は 0 から
function giveStars(kira, n, cfg, now){
  const k = normalizeKira(kira);
  n = isNum(n) ? Math.max(0, Math.floor(n)) : 0;
  const wk = weekKey(now);
  k.week = { key: wk, stars: (k.week.key === wk ? k.week.stars : 0) + n };
  k.totalStars += n;
  k.lastPlayedAt = now;
  if (k.stage >= KIRA_FINAL){ k.starsInStage += n; return { kira: k, evolved: null }; }
  k.starsInStage += n;
  if (k.starsInStage < starsNeeded(cfg, k.stage)) return { kira: k, evolved: null };
  const from = k.stage;
  k.stage++; k.starsInStage = 0;
  if (k.stage === KIRA_FINAL) k.maneColors = [cfg.maneOrder[0]];
  return { kira: k, evolved: { from, to: k.stage } };
}

// 教科を クリアした。かえす値：{ kira, mane: ふえた色 | null }
// クリアは 教科ごとに 1回だけ。たてがみが ふえるのは 最終形の あと
function clearTopic(kira, topic, cfg){
  const k = normalizeKira(kira);
  if (k.clearedTopics.includes(topic)) return { kira: k, mane: null };
  k.clearedTopics.push(topic);
  if (k.stage < KIRA_FINAL) return { kira: k, mane: null };
  const next = cfg.maneOrder[k.maneColors.length];
  if (!next) return { kira: k, mane: null };
  k.maneColors.push(next);
  return { kira: k, mane: next };
}
// lv：その教科の なれ度（1〜max）
const topicCleared = (lv, max, level) => max > 0 && Array.from({ length: max }, (_, i) => lv[i + 1] || 0).every(v => v >= level);

// ビンの 丸（dots こ）の ぬりの わりあい 0〜1。最終形は いつも いっぱい
function jarDots(kira, cfg, dots = 5){
  const need = starsNeeded(cfg, kira.stage);
  const r = need === Infinity ? 1 : Math.min(1, kira.starsInStage / need);
  return Array.from({ length: dots }, (_, i) => Math.max(0, Math.min(1, r * dots - i)));
}

/* ---------- あそぶ時間（1日・ひとりずつ） ---------- */
function addPlayTime(kira, ms, now){
  const k = normalizeKira(kira), d = dayKey(now);
  k.day = { key: d, ms: (k.day.key === d ? k.day.ms : 0) + Math.max(0, ms) };
  return k;
}
const playedToday = (kira, now) => kira.day && kira.day.key === dayKey(now) ? kira.day.ms : 0;
const timeUp = (kira, cfg, now) => playedToday(kira, now) >= cfg.sessionMinutes * 60000;
const weekStars = (kira, now) => kira.week && kira.week.key === weekKey(now) ? kira.week.stars : 0;

// あいさつ：'first' はじめて／'okaeri' べつの日から ひさしぶり／'again' きょう また。どれも よろこぶだけ
function greeting(kira, now){
  if (!isNum(kira.lastPlayedAt)) return 'first';
  return dayKey(kira.lastPlayedAt) === dayKey(now) ? 'again' : 'okaeri';
}

/* ---------- プロフィール ---------- */
function normalizeProfiles(v, base = KIRA_CONFIG){
  const ok = Array.isArray(v) ? v.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string') : [];
  return ok.length ? ok.map(p => ({ id: p.id, name: p.name, color: typeof p.color === 'string' ? p.color : base.profileColors[0] }))
    : base.profiles.map(p => Object.assign({}, p));
}
// 保存の キー：1つめ（p1）は むかしの キーを そのまま使う（いままでの 記録を 引きつぐ）
const profileKey = (base, id) => id === 'p1' ? base : `${base}@${id}`;
function addProfile(list, name, base = KIRA_CONFIG){
  const n = Math.max(0, ...list.map(p => +p.id.slice(1) || 0)) + 1;
  return [...list, { id: 'p' + n, name: String(name || '').trim() || `${n}ばんめ`, color: base.profileColors[(n - 1) % base.profileColors.length] }];
}
// さいごの 1人は けさない
const removeProfile = (list, id) => list.length > 1 ? list.filter(p => p.id !== id) : list;
const renameProfile = (list, id, name) => list.map(p => p.id === id && String(name).trim() ? Object.assign({}, p, { name: String(name).trim().slice(0, 12) }) : p);
