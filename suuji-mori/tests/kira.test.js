/* キラの しくみの テスト（kira-config.js・kira.js のあとに読む）
   ターミナル：sh suuji-mori/tests/run.sh（macOS の JavaScriptCore）
   ブラウザ：suuji-mori/tests/index.html を ひらく */
const results = [];
function test(name, fn){
  try { fn(); results.push({ name, ok: true }); }
  catch(e) { results.push({ name, ok: false, msg: e && e.message || String(e) }); }
}
function eq(a, b, msg){
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg || ''} ${sa} !== ${sb}`.trim());
}
function ok(v, msg){ if (!v) throw new Error(msg || 'not ok'); }

const cfg = kiraSettings(null);
const DAY = 86400000;
const T0 = new Date(2026, 9, 12, 9, 0).getTime();  // 2026-10-12（月）9:00
const give = (k, n, now = T0) => giveStars(k, n, cfg, now);
// 段階 st の はじめ
const atStage = st => Object.assign(newKira(), { stage: st, maneColors: st === KIRA_FINAL ? [cfg.maneOrder[0]] : [] });

/* ---------- 設定 ---------- */
test('初期値は 仕様どおり（10 / 30 / 100 / 200 / 350、10分、星1こ）', () => {
  eq(cfg.starsToNextStage, { 1: 10, 2: 30, 3: 100, 4: 200, 5: 350 });
  eq(cfg.sessionMinutes, 10);
  eq([cfg.questionsPerRound, cfg.starPerRound], [5, 1]);
});
test('おうちのかたの設定で 必要数・時間を かえられる', () => {
  const c = kiraSettings({ starsToNextStage: { 1: 3 }, sessionMinutes: 20 });
  eq(c.starsToNextStage[1], 3); eq(c.starsToNextStage[2], 30); eq(c.sessionMinutes, 20);
  const r = giveStars(newKira(), 3, c, T0);
  eq(r.kira.stage, 2);
});
test('こわれた設定は はじめの値に もどる', () => {
  const c = kiraSettings({ starsToNextStage: { 1: 'x', 2: -5 }, sessionMinutes: NaN });
  eq(c.starsToNextStage[1], 10); eq(c.starsToNextStage[2], 1); eq(c.sessionMinutes, 10);
});

/* ---------- 星と 成長 ---------- */
test('星は ふえるだけ（0・マイナス・へんな値では へらない）', () => {
  let k = give(newKira(), 5).kira;
  for (const n of [0, -3, NaN, undefined, 'a']) {
    const k2 = give(k, n).kira;
    eq([k2.stage, k2.starsInStage, k2.totalStars], [k.stage, k.starsInStage, k.totalStars]);
  }
});
test('星を もらうたびに 合計が ふえ、へらない', () => {
  let k = newKira(), last = 0;
  for (let i = 0; i < 2000; i++) {
    k = give(k, cfg.starPerRound).kira;
    ok(k.totalStars > last, 'totalStars が ふえていない'); last = k.totalStars;
  }
  eq(k.totalStars, 2000);
});
test('必要数の 1こ手前では 変身しない', () => {
  const r = give(newKira(), 9);
  eq(r.evolved, null); eq([r.kira.stage, r.kira.starsInStage], [1, 9]);
});
test('必要数に とどいたときだけ 段階が 1つ上がり、新しい段階は 0 から', () => {
  const r = give(give(newKira(), 9).kira, 1);
  eq(r.evolved, { from: 1, to: 2 }); eq([r.kira.stage, r.kira.starsInStage], [2, 0]);
});
test('端数は 持ちこさない（9こ → 3こ あげても 新段階は 0）', () => {
  const r = give(give(newKira(), 9).kira, 3);
  eq([r.kira.stage, r.kira.starsInStage, r.kira.totalStars], [2, 0, 12]);
});
test('1回で 上がるのは 1段階まで', () => {
  const r = give(newKira(), 1000);
  eq(r.evolved, { from: 1, to: 2 }); eq(r.kira.stage, 2);
});
test('1こずつ あげると 10 / 30 / 100 / 200 / 350 で 順に 変身して ユニコーンになる', () => {
  let k = newKira(), at = [];
  for (let i = 1; i <= 690; i++) { const r = give(k, 1); k = r.kira; if (r.evolved) at.push([i, r.evolved.to]); }
  eq(at, [[10, 2], [40, 3], [140, 4], [340, 5], [690, 6]]);
  eq(k.maneColors, [cfg.maneOrder[0]]);
});
test('最終形のあとは 段階が 上がらない', () => {
  let k = atStage(KIRA_FINAL);
  for (let i = 0; i < 50; i++) { const r = give(k, 100); ok(!r.evolved); k = r.kira; }
  eq(k.stage, KIRA_FINAL);
});

/* ---------- 教科クリアと たてがみ ---------- */
test('最終形では 教科クリアで たてがみの色が 1本ふえる（ピンク→パープル→ブルー）', () => {
  let k = atStage(KIRA_FINAL);
  let r = clearTopic(k, 'num', cfg); eq(r.mane, cfg.maneOrder[1]); k = r.kira;
  r = clearTopic(k, 'abc', cfg); eq(r.mane, cfg.maneOrder[2]); k = r.kira;
  eq(k.maneColors, cfg.maneOrder.slice(0, 3));
});
test('おなじ教科の クリアは 1回だけ', () => {
  const k = clearTopic(atStage(KIRA_FINAL), 'num', cfg).kira;
  const r = clearTopic(k, 'num', cfg);
  eq(r.mane, null); eq(r.kira.maneColors.length, 2);
});
test('最終形より前の クリアは 記録だけで、たてがみは かわらない', () => {
  const r = clearTopic(atStage(3), 'num', cfg);
  eq(r.mane, null); eq(r.kira.clearedTopics, ['num']); eq(r.kira.maneColors, []);
});
test('教科クリアの 判定：ぜんぶの なれ度が 2 以上', () => {
  eq(topicCleared([0, 2, 3, 2], 3, 2), true);
  eq(topicCleared([0, 2, 1, 3], 3, 2), false);
  eq(topicCleared([0, 2, 2], 3, 2), false);  // まだ 出ていない（記録がない）ものが ある
});

/* ---------- ビン ---------- */
test('ビンの 丸は たまった わりあいで ぬられる（数字は 出さない）', () => {
  eq(jarDots(Object.assign(newKira(), { starsInStage: 0 }), cfg), [0, 0, 0, 0, 0]);
  eq(jarDots(Object.assign(newKira(), { starsInStage: 5 }), cfg), [1, 1, .5, 0, 0]);
  eq(jarDots(atStage(KIRA_FINAL), cfg), [1, 1, 1, 1, 1]);
});

/* ---------- 時間 ---------- */
test('その日の あそんだ時間が 設定をこえたら おわり', () => {
  let k = addPlayTime(newKira(), 9 * 60000, T0);
  eq(timeUp(k, cfg, T0), false);
  k = addPlayTime(k, 60000, T0 + 1000);
  eq(timeUp(k, cfg, T0 + 1000), true);
});
test('つぎの日は また あそべる', () => {
  const k = addPlayTime(newKira(), 30 * 60000, T0);
  eq(timeUp(k, cfg, T0 + DAY), false);
  eq(playedToday(addPlayTime(k, 1000, T0 + DAY), T0 + DAY), 1000);
});

/* ---------- 休んだ日 ---------- */
test('何日 あけても 何も へらず「おかえり！」', () => {
  const k = give(give(newKira(), 9).kira, 0).kira;
  const later = T0 + 9 * DAY, back = normalizeKira(JSON.parse(JSON.stringify(k)));
  eq([back.stage, back.starsInStage, back.totalStars], [k.stage, k.starsInStage, k.totalStars]);
  eq(greeting(back, later), 'okaeri');
  eq(greeting(back, T0 + 3600000), 'again');
  eq(greeting(newKira(), T0), 'first');
});
test('今週の星：週が かわったら 0 から（記録の 星は へらない）', () => {
  let k = give(newKira(), 4, T0).kira;
  eq(weekStars(k, T0), 4);
  eq(weekStars(k, T0 + 7 * DAY), 0);
  k = give(k, 2, T0 + 7 * DAY).kira;
  eq([weekStars(k, T0 + 7 * DAY), k.totalStars], [2, 6]);
});

/* ---------- プロフィール ---------- */
test('はじめは ニナ と セナ', () => {
  eq(normalizeProfiles(null).map(p => p.name), ['ニナ', 'セナ']);
});
test('プロフィールごとに 保存の キーが ちがう（1人めは むかしの キーを 引きつぐ）', () => {
  const ps = normalizeProfiles(null);
  const keys = ps.map(p => profileKey('suuji-mori-kira', p.id));
  eq(keys, ['suuji-mori-kira', 'suuji-mori-kira@p2']);
});
test('2人の キラは べつべつに そだつ', () => {
  const mem = {}, ps = normalizeProfiles(null), key = id => profileKey('suuji-mori-kira', id);
  const load = id => normalizeKira(mem[key(id)] && JSON.parse(mem[key(id)]));
  const save = (id, k) => { mem[key(id)] = JSON.stringify(k); };
  save(ps[0].id, give(load(ps[0].id), 10).kira);
  save(ps[1].id, give(load(ps[1].id), 3).kira);
  eq([load(ps[0].id).stage, load(ps[0].id).starsInStage], [2, 0]);
  eq([load(ps[1].id).stage, load(ps[1].id).starsInStage], [1, 3]);
});
test('プロフィールの 追加・名前の変更・削除（さいごの 1人は けさない）', () => {
  let ps = addProfile(normalizeProfiles(null), 'ミオ');
  eq(ps.map(p => [p.id, p.name]), [['p1', 'ニナ'], ['p2', 'セナ'], ['p3', 'ミオ']]);
  ps = renameProfile(ps, 'p3', ' ミオちゃん ');
  eq(ps[2].name, 'ミオちゃん');
  ps = removeProfile(removeProfile(ps, 'p1'), 'p2');
  eq(ps.map(p => p.id), ['p3']);
  eq(removeProfile(ps, 'p3').map(p => p.id), ['p3']);
  eq(addProfile(ps, '').map(p => p.id), ['p3', 'p4']);
});

/* ---------- けっか ---------- */
const failed = results.filter(r => !r.ok);
const report = results.map(r => `${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : '\n    ' + r.msg}`).join('\n')
  + `\n\n${results.length - failed.length} / ${results.length} ok`;
if (typeof window === 'undefined') { print(report); if (failed.length) throw new Error(`${failed.length} failed`); }
else window.KIRA_TEST = { report, failed: failed.length };
