/* すうじのもり：ふきだし と 読み上げ の ことば（DOM を使わない）
   LINE の各文は [ふきだし, 読み上げ] を返す。ふきだしは ひらがな、読み上げは 漢字まじり・空白なし（アクセントが自然になる）。
   ふきだしが null の文は 読み上げだけ。日本語は 1文ずつ VOICEVOX で作った音声（voice/*.m4a）を鳴らし、ないものは ブラウザの声で読む。
   文を足したり変えたりしたら make-voice.py で音声を作りなおす（どの引数で数えるかは line() の each で決める）。 */

// each：allLines() が 音声を作るときに 何を入れて呼ぶか
//   ''  引数なし 1回 / 'n' 番号 1〜max / 'nn' (n, n) / 'c' 0〜max / 'v' 数 1〜30 / 'p' ほめ言葉 × 番号 / null 数えない（英語だけ など）
// when：その教科で使うときだけ数える
const line = (each, f, when) => Object.assign(f, { each, when });
const hasMode = m => s => s.modes.some(x => x[0] === m);
// 読みと字が おなじ（ひらがな）ときは 「あ」とだけ
const nameOf = n => S.label[n] === S.yomi[n] ? `「${S.label[n]}」` : `${S.label[n]}（${S.yomi[n]}）`;
const monName = n => S.mon[n][0];

const LINE = {
  home: line('', () => ['なにして あそぶ？ 5もん クリアで なかまが ふえるよ', '何して遊ぶ？ 5問クリアで、仲間が増えるよ']),
  learn: line('n', n => S.learn(n)),
  // num・total・wrongCount は 番号ではなく 数そのもの（0〜30）
  num: line('v', v => [null, numYomi(v)]),
  total: line('v', v => [`ぜんぶで ${v}！`, `全部で、${numYomi(v)}！`]),
  find: line('n', n => [`「${S.yomi[n]}」は どれ かな？`, `${V(n)}は、どれかな？`]),
  pair: line('n', n => [`「${S.label[n]}」の こもじは どれ かな？`, `大文字の${V(n)}。 小文字は、どれかな？`], hasMode('pair')),
  count: line('', nm => nm ? [`${nm}は いくつ いるかな？`, `${nm}は、いくついるかな？ 触って数えてもいいよ`]
    : ['いくつ あるかな？', 'いくつあるかな？ 触って数えてもいいよ']),
  next: line('n', n => { const v = S.val(n); return [`${v-2}、${v-1}、 つぎは なに？`, `${numYomi(v-2)}、${numYomi(v-1)}、次は何かな？`]; }, hasMode('next')),
  // せいかい：ふきだしは あそびによって ちがう
  right: line('p', ([p, ps], n, how) => [
    how === 'pair' ? `${p} ${S.label[n]} と ${S.lower[n]}` : how === 'balloon' ? `${p} ${nameOf(n)}を みっけ！` : `${p} ${nameOf(n)}`,
    `${ps} ${V(n)}！`]),
  wrongFind: line('nn', (n, t) => [`おしい！ それは ${nameOf(n)}`, `それは${V(n)}。 ${V(t)}は、どれかな？`]),
  wrongPair: line('nn', (n, t) => [`おしい！ それは ${S.lower[n]}（${S.yomi[n]}）`, `それは${V(n)}。 ${V(t)}の小文字を、探そう`], hasMode('pair')),
  wrongNext: line('nn', (n, t) => [`おしい！ それは ${nameOf(n)}`, `それは${V(n)}。 ${numYomi(S.val(t)-1)}の次は、何かな？`], hasMode('next')),
  wrongCount: line('v', v => ['おしい！ もういちど かぞえよう', `それは${numYomi(v)}。 一緒に数えてみよう`]),
  balloon: line('n', n => [`${S.label[n]} の ふうせんを 3つ わってね`, `${V(n)}の風船を、3つ割ってね`]),
  trace: line('n', n => [`「${S.yomi[n]}」を なぞろう。みどりの まるから スタート`, `${V(n)}を、なぞってみよう。 緑の丸から、スタート`], hasMode('trace')),
  traceNext: line('', () => ['つぎの せんも なぞってね', '次の線も、なぞってね']),
  write: line('n', n => [`「${S.yomi[n]}」を かいてみよう。うすい じを みてね`, `${V(n)}を、書いてみよう。 薄い字を、よく見てね`], hasMode('write')),
  writeMore: line('', () => ['おしい！ きいろの ところも かいてね', 'おしい！ 黄色のところも、書いてね'], hasMode('write')),
  writeOff: line('', () => ['はみだしちゃった。もういちど かこう', 'はみ出しちゃったね。 もう一度、書いてみよう'], hasMode('write')),
  is: line('n', n => [`それは ${nameOf(n)}`, `それは${V(n)}`]),
  monNew: line('n', n => [`あっ！ ${monName(n)}が でてきた！ カプセルを なげよう`, `あっ！ ${monName(n)}が出てきた！ どんぐりカプセルを、投げよう`]),
  monVisit: line('n', n => [`${monName(n)}が あそびに きたよ！`, `${monName(n)}が、遊びに来たよ！ ${V(n)}の仲間だね`]),
  caught: line('n', n => [`やったー！ ${monName(n)}が なかまに なった！`, `やったー！ ${monName(n)}が、仲間になった！ ${S.belly(n)}`]),
  glow: line('n', n => [`あれ？ ${monName(n)}が ひかってる…！`, `あれ？ ${monName(n)}が、光ってる！`]),
  evolved: line('n', n => [`${monName(n)}が しんかした！`, `${monName(n)}が、進化した！ ${V(n)}が、得意になったね`]),
  newOne: line('n', n => [`あたらしい ${S.name} ${S.label[n]} が でてきたよ`, `新しい${S.unit}、${V(n)}が出てきたよ`]),
  book: line('c', c => [c ? `なかまが ${c}ひき いるよ。さわってみてね` : 'あそぶと なかまが ふえるよ', c ? `仲間が${c}匹いるよ。 触ってみてね` : '遊ぶと仲間が増えるよ']),
  mon: line('n', n => [`${monName(n)}。${nameOf(n)}の なかま`, `${monName(n)}。 ${V(n)}の仲間だよ`]),
  word: line('n', n => [null, S.word(n)], s => !!s.word),
  tryIt: line('', () => [null, S.tryIt()]),
};

// 読み上げ文を かたまりに わける：{ja:'日本語の1文'} か {en:'英語', kana:'カタカナ'}（«英語|カタカナ»）
function chunks(t){
  const out = [];
  String(t).split(/«([^»]*)»/).forEach((seg, i) => {
    if (i % 2){ const [en, kana] = seg.split('|'); out.push({ en, kana: kana || en }); return; }
    // 日本語どうしの間の空白は へんな間になるので つめてから、。！？ で1文ずつに
    (seg.replace(/([^\x00-\x7F])\s+(?=[^\x00-\x7F])/g, '$1').match(/[^。！？]+[。！？]*/g) || []).forEach(j => {
      j = j.trim(); if (/[^\s、。！？]/.test(j)) out.push({ ja: j });
    });
  });
  return out;
}
// 音声ファイルの名前（1文の FNV-1a ハッシュ）
const clipId = t => { let h = 0x811c9dc5; for (const ch of t){ h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
// 音声を作る 日本語の1文を ぜんぶ（おうちの画像の名前など あとから決まるものは ブラウザの声）
function allLines(){
  const set = new Set(), keep = S;
  for (const s of Object.values(SUBJ)){
    S = s;
    const ns = range(1, s.max);
    const args = { '': [[]], n: ns.map(n => [n]), nn: ns.map(n => [n, n]), c: range(0, s.max).map(c => [c]),
      v: range(1, 30).map(v => [v]), p: PRAISE.flatMap(p => ns.map(n => [p, n])) };
    for (const f of Object.values(LINE)){
      if (f.each == null || (f.when && !f.when(s))) continue;
      for (const a of args[f.each]) chunks(f(...a)[1]).forEach(c => c.ja && set.add(c.ja));
    }
  }
  S = keep;
  return [...set].map(text => ({ id: clipId(text), text }));
}
