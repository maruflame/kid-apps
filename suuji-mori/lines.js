/* Meridian：ふきだし と 読み上げ の ことば（DOM を使わない）
   LINE の各文は [ふきだし, 読み上げ] を返す。ふきだしは ひらがな、読み上げは 漢字まじり・空白なし（アクセントが自然になる）。
   ふきだしが null の文は 読み上げだけ。日本語は 1文ずつ VOICEVOX で作った音声（voice/*.m4a）を鳴らし、ないものは ブラウザの声で読む。
   文を足したり変えたりしたら make-voice.py で音声を作りなおす（どの引数で数えるかは line() の each で決める）。 */

// each：allLines() が 音声を作るときに 何を入れて呼ぶか
//   ''  引数なし 1回 / 'st' キラの 段階 2〜6 / 'n' 番号 1〜max / 'nn' (n, n) / 'n3' 3 から（つぎは なに？） / 'g' 字形のある番号（なぞりがき・かいてみよう） / 'c' 0〜max / 'v' 数 1〜30 / 'k' ドレミ 1〜7 / 'p' ほめ言葉 × 番号 / 'color' ぬりえの色 / 'pic' ぬりえの絵 / null 数えない（英語だけ など）
// when：その教科で使うときだけ数える
const line = (each, f, when) => Object.assign(f, { each, when });
const hasMode = m => s => s.modes.some(x => x[0] === m);
const notAdd = s => s.id !== 'add', isAdd = s => s.id === 'add';
const isPitch = s => !!s.pitch;
// ドレミは 読みと 字が おなじなので（ド）だけ
const nameOf = n => S.label[n] === S.yomi[n] ? S.label[n] : `${S.label[n]}（${S.yomi[n]}）`;
const monName = n => S.mon[n][0];
// 読み上げでは なまえを 英語の声で（英語の声がなければ カタカナを 日本語の声で）
const monSay = n => `«${S.mon[n][2]}|${S.mon[n][0]}»`;

const LINE = {
  home: line('', () => ['なにして あそぶ？', '何して遊ぶ？ 答えて、キラに星をあげよう']),
  // キラ（だれが あそぶ？・あいさつ・星・へんしん・おやすみ）。どれも せめない、かなしまない
  who: line('', () => ['だれが あそぶ？', '誰が遊ぶ？']),
  hello: line('', () => ['キラと いっしょに あそぼう！', 'キラと一緒に、遊ぼう！']),
  okaeri: line('', () => ['おかえり！ キラ まってたよ', 'おかえり！ キラ、待ってたよ！']),
  giveStar: line('', () => [null, '星を、キラにあげてね']),
  evolve: line('st', st => [`ほしの ビンが いっぱい！ キラが ${KIRA_STAGES[st].become}`, `星の瓶が、いっぱい！ キラが、${KIRA_STAGES[st].becomeSay}`]),
  mane: line('', () => ['たてがみに あたらしい いろが ふえたよ！', 'たてがみに、新しい色が増えたよ！']),
  sleepy: line('', () => ['キラ ねむく なってきた…', 'キラ、眠くなってきた。']),
  night: line('', () => ['おやすみ キラ。また あした あそぼうね', 'おやすみ、キラ。 また明日、遊ぼうね']),
  learn: line('n', n => S.learn(n)),
  // num・total・wrongCount は 番号ではなく 数そのもの（0〜30）
  num: line('v', v => [null, numYomi(v)]),
  total: line('v', v => [`ぜんぶで ${v}！`, `全部で、${numYomi(v)}！`]),
  find: line('n', n => [`「${S.yomi[n]}」は どれ かな？`, `${V(n)}は、どれかな？`], hasMode('find')),
  pair: line('n', n => [`「${S.label[n]}」の こもじは どれ かな？`, `大文字の${V(n)}。 小文字は、どれかな？`], hasMode('pair')),
  count: line('', nm => nm ? [`${nm}は いくつ いるかな？`, `${nm}は、いくついるかな？ 触って数えてもいいよ`]
    : ['いくつ あるかな？', 'いくつあるかな？ 触って数えてもいいよ']),
  next: line('n3', n => { const v = S.val(n); return [`${v-2}、${v-1}、 つぎは なに？`, `${numYomi(v-2)}、${numYomi(v-1)}、次は何かな？`]; }, hasMode('next')),
  // せいかい：ふきだしは あそびによって ちがう
  right: line('p', ([p, ps], n, how) => [
    how === 'pair' ? `${p} ${S.label[n]} と ${S.lower[n]}` : how === 'balloon' ? `${p} ${nameOf(n)}を みっけ！` : `${p} ${nameOf(n)}`,
    `${ps} ${V(n)}！`], notAdd),
  wrongFind: line('nn', (n, t) => [`おしい！ それは ${nameOf(n)}`, `それは${V(n)}。 ${V(t)}は、どれかな？`], hasMode('find')),
  wrongPair: line('nn', (n, t) => [`おしい！ それは ${S.lower[n]}（${S.yomi[n]}）`, `それは${V(n)}。 ${V(t)}の小文字を、探そう`], hasMode('pair')),
  wrongNext: line('n3', (n, t = n) => [`おしい！ それは ${nameOf(n)}`, `それは${V(n)}。 ${numYomi(S.val(t)-1)}の次は、何かな？`], hasMode('next')),
  wrongCount: line('v', v => ['おしい！ もういちど かぞえよう', `それは${numYomi(v)}。 一緒に数えてみよう`]),
  balloon: line('n', n => [`${S.label[n]} の ふうせんを 3つ わってね`, `${V(n)}の風船を、3つ割ってね`], hasMode('balloon')),
  trace: line('g', n => [`「${S.yomi[n]}」を なぞろう。みどりの まるから スタート`, `${V(n)}を、なぞってみよう。 緑の丸から、スタート`], hasMode('trace')),
  traceNext: line('', () => ['つぎの せんも なぞってね', '次の線も、なぞってね']),
  write: line('g', n => [`「${S.yomi[n]}」を かいてみよう。うすい じを みてね`, `${V(n)}を、書いてみよう。 薄い字を、よく見てね`], hasMode('write')),
  writeMore: line('', () => ['おしい！ きいろの ところも かいてね', 'おしい！ 黄色のところも、書いてね'], hasMode('write')),
  writeOff: line('', () => ['はみだしちゃった。もういちど かこう', 'はみ出しちゃったね。 もう一度、書いてみよう'], hasMode('write')),
  // たしざん（a・b は しきの 2つの数）
  awase: line('n', n => { const [a, b] = S.fact[n];
    return [`${a} と ${b}、あわせて いくつ？`, `${YOMI[a]}と${YOMI[b]}、合わせて、いくつかな？ 触って数えてもいいよ`]; }, isAdd),
  fueru: line('n', n => [`バスに ${S.fact[n][0]}ひき のってるよ`, `バスに、${S.fact[n][0]}匹乗ってるよ`], isAdd),
  fueruAsk: line('n', n => { const [a, b] = S.fact[n];
    return [`${b}ひき のってきた！ ぜんぶで なんびき？`, `${b}匹、乗ってきたよ！ 全部で、何匹かな？ ${YOMI[a]}の次から、数えてみよう`]; }, isAdd),
  ten: line('n', n => { const a = S.fact[n][0];
    return [`${a} と あと いくつで 10？`, `${YOMI[a]}と、あといくつで、じゅうになるかな？`]; }, isAdd),
  rightAdd: line('p', ([p, ps], n) => [`${p} ${S.label[n]}=${S.val(n)}`, `${ps} ${V(n)}は、${numYomi(S.val(n))}！`], isAdd),
  // 10を つくろう は 10 になる しきだけ（a と 10-a）
  rightTen: line('p', ([p, ps], n) => { const a = S.fact[n][0];
    return [`${p} ${a} と ${10-a} で 10`, `${ps} ${YOMI[a]}と${YOMI[10-a]}で、じゅう！`]; }, isAdd),
  wrongAdd: line('v', v => [`おしい！ それは ${v}。もういちど かぞえよう`, `それは${numYomi(v)}。 もう一度、数えてみよう`], isAdd),
  wrongTen: line('v', v => [`おしい！ あいてる ところを かぞえよう`, `それは${numYomi(v)}。 空いているところを、数えてみよう`], isAdd),
  // けんばん・おとあて（k は NOTE の音 1〜7）
  noteName: line('k', k => [null, NOTE[k][0]], isPitch),
  keyFind: line('n', n => [`「${S.label[n]}」は どこ かな？`, `${V(n)}は、どこかな？ 鍵盤を、タッチしてね`], hasMode('key')),
  wrongKey: line('nn', (n, t) => [`おしい！ それは ${S.label[n]}`, `それは${V(n)}。 ${V(t)}は、どこかな？`], hasMode('key')),
  keyBlack: line('', () => ['しろい けんばんを さがしてね', '白い鍵盤を、探してね'], hasMode('key')),
  keyName: line('', () => ['★の けんばんは なに かな？', '星の鍵盤は、何かな？'], hasMode('name')),
  wrongName: line('n', n => [`おしい！ ${S.label[n]} は ${NOTE[S.nt(n)][4]}`, `${V(n)}は、${NOTE[S.nt(n)][5]}だよ。 星の鍵盤は、何かな？`], hasMode('name')),
  ear: line('', () => S.flags ? ['この わおんは なにいろ？', 'この和音は、何色かな？'] : ['この おとは なに かな？', 'この音は、何かな？'], hasMode('ear')),
  wrongEar: line('n', n => [`${S.label[n]} じゃないよ。もういちど きいてね`, `${V(n)}じゃないよ。 もう一度、聞いてね`], hasMode('ear')),
  is: line('n', n => [`それは ${nameOf(n)}`, `それは${V(n)}`], hasMode('balloon')),
  newOne: line('n', n => [`あたらしい ${S.name} ${S.label[n]} が でてきたよ`, `新しい${S.unit}、${V(n)}が出てきたよ`]),
  book: line('c', c => [c ? `なかまが ${c}ひき いるよ。さわってみてね` : 'あそぶと なかまが ふえるよ', c ? `仲間が${c}匹いるよ。 触ってみてね` : '遊ぶと仲間が増えるよ']),
  hiroba: line('c', c => [c ? `なかまが ${c}ひき あそんでるよ。さわってみてね` : 'まだ なかまが いないよ。あそぶと なかまが ふえるよ',
    c ? `仲間が${c}匹、遊んでるよ。 触ってみてね` : 'まだ仲間がいないよ。 遊ぶと、仲間が増えるよ']),
  mon: line('n', n => [`${monName(n)}。${nameOf(n)}の なかま`, `${monSay(n)}。 ${V(n)}の仲間だよ`]),
  word: line(null, n => [null, `«${WORD[n][1]}|${WORD[n][2]}»`]),
  hword: line('n', n => [null, HWORD[n][2]], s => s.id === 'hira'),
  tryIt: line('', () => [null, S.tryIt()]),
  // ぬりえ
  nurieGallery: line('', () => ['どの おひめさまを ぬる？', 'どのお姫様を、塗る？']),
  nuriePick: line('pic', id => [`${PICTURES[id].name}！ すきな いろを えらんで、タップしてね`, `${PICTURES[id].say}！ 好きな色を選んで、塗りたいところを、タップしてね`]),
  color: line('color', ([, show, sp]) => [`${show}で ぬろう`, `${sp}で、塗ろう`]),
  nurieDone: line('', () => ['できた！ すてきな おひめさま！', 'できた！ 素敵な、お姫様！']),
  nurieReset: line('', () => ['もういちど おすと ぜんぶ けすよ', 'もう一度押すと、全部消すよ']),
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
    const args = { '': [[]], st: range(2, KIRA_FINAL).map(st => [st]), n: ns.map(n => [n]), nn: ns.map(n => [n, n]),
      n3: ns.filter(n => s.val && s.val(n) >= 3).map(n => [n]), g: ns.filter(n => s.glyph && s.glyph(n)).map(n => [n]), c: range(0, s.max).map(c => [c]),
      v: range(1, 30).map(v => [v]), k: range(1, 7).map(k => [k]), p: PRAISE.flatMap(p => ns.map(n => [p, n])), color: PALETTE.map(p => [p]), pic: Object.keys(PICTURES).map(k => [k]) };
    for (const f of Object.values(LINE)){
      if (f.each == null || (f.when && !f.when(s))) continue;
      for (const a of args[f.each]) chunks(f(...a)[1]).forEach(c => c.ja && set.add(c.ja));
    }
  }
  S = keep;
  return [...set].map(text => ({ id: clipId(text), text }));
}
