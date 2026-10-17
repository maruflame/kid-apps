/* キラの え（DOM を使わない。文字列で つくる）
   kiraArt(段階, 表情, たてがみの色) が 1つの入口。画像を 読みこむのは ここ（KIRA_IMAGES）だけ。
   段階 1〜5 の 正式イラストが できたら KIRA_IMAGES に 足すだけで さしかわる（表情ごとに ちがう画像なら { normal:'…', happy:'…' }）。
   画像がない段階は SVG の プレースホルダ。ざひょうは 200×200、じめんは y=188。
   表情：normal ふつう／happy よろこぶ／oshii こまり顔＋あせ（せめない）／thinking かんがえる／sleepy ねむい */

const KIRA_IMAGES = {
  6: 'img/kira-unicorn.jpg',  // 背景つき。背景を 透過した素材が できたら さしかえる
};
const KIRA_FACES = ['normal', 'happy', 'oshii', 'thinking', 'sleepy'];
const K_INK = '#3A2E6E', K_LINE = '#DCD0FA', K_GOLD = '#FFD15C', K_GOLD_D = '#E8B53A', K_PINK = '#F7B6D2', K_EGG = '#C9A8F5', K_EGG_D = '#A98AE6';

const kStar = (cx, cy, r, fill = K_GOLD, extra = '') => {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
    return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`; }).join(' ');
  return `<polygon points="${pts}" fill="${fill}" stroke="${K_GOLD_D}" stroke-width="2" stroke-linejoin="round" ${extra}/>`;
};

// かお：目の まんなか (cx, cy)、目と目の はば w
function kFace(face, cx, cy, w = 22){
  const L = cx - w, R = cx + w, my = cy + 20;
  const cheeks = `<ellipse cx="${L - 12}" cy="${cy + 14}" rx="10" ry="6.5" fill="${K_PINK}" opacity=".85"/><ellipse cx="${R + 12}" cy="${cy + 14}" rx="10" ry="6.5" fill="${K_PINK}" opacity=".85"/>`;
  const eye = (x, dx = 0, dy = 0) => `<ellipse cx="${x}" cy="${cy}" rx="9.5" ry="12" fill="${K_INK}"/>
    <circle cx="${x + 3 + dx}" cy="${cy - 5 + dy}" r="4" fill="#fff"/><circle cx="${x - 3 + dx}" cy="${cy + 4 + dy}" r="1.8" fill="#fff"/>`;
  const shut = (x, up) => `<path d="M${x - 9} ${cy + (up ? 3 : -1)} Q${x} ${cy + (up ? -8 : 7)} ${x + 9} ${cy + (up ? 3 : -1)}" stroke="${K_INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  const smile = `<path d="M${cx - 8} ${my - 2} Q${cx} ${my + 6} ${cx + 8} ${my - 2}" stroke="${K_INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  if (face === 'happy') return cheeks + shut(L, true) + shut(R, true)
    + `<path d="M${cx - 11} ${my - 4} Q${cx} ${my - 4} ${cx + 11} ${my - 4} Q${cx + 9} ${my + 11} ${cx} ${my + 11} Q${cx - 9} ${my + 11} ${cx - 11} ${my - 4}Z" fill="#E86A8E"/>
       <ellipse cx="${cx}" cy="${my + 6}" rx="5" ry="3" fill="#FFB3C6"/>`;
  // こまり顔：まゆの 内がわが 上がる（おこった顔に しない）
  if (face === 'oshii') return cheeks + eye(L, 0, 1) + eye(R, 0, 1)
    + `<path d="M${L - 9} ${cy - 15} Q${L - 1} ${cy - 17} ${L + 6} ${cy - 22} M${R + 9} ${cy - 15} Q${R + 1} ${cy - 17} ${R - 6} ${cy - 22}" stroke="${K_INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
       <path d="M${cx - 9} ${my + 2} Q${cx - 4.5} ${my - 3} ${cx} ${my + 2} Q${cx + 4.5} ${my + 7} ${cx + 9} ${my + 2}" stroke="${K_INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
       <path d="M${R + 30} ${cy - 22} Q${R + 22} ${cy - 8} ${R + 30} ${cy - 4} Q${R + 38} ${cy - 8} ${R + 30} ${cy - 22}Z" fill="#9ECFF5" stroke="#6FAFE0" stroke-width="1.5"/>`;
  if (face === 'thinking') return cheeks + eye(L, 3, -3) + eye(R, 3, -3)
    + `<ellipse cx="${cx + 4}" cy="${my + 1}" rx="4" ry="3.5" fill="${K_INK}"/>
       <text x="${R + 26}" y="${cy - 16}" font-size="28" font-weight="900" fill="#7B5BD6" font-family="sans-serif">?</text>`;
  if (face === 'sleepy') return cheeks + shut(L, false) + shut(R, false)
    + `<ellipse cx="${cx}" cy="${my + 1}" rx="4.5" ry="3" fill="${K_INK}" opacity=".8"/>
       <text x="${R + 18}" y="${cy - 14}" font-size="20" font-weight="900" fill="#7B5BD6" font-family="sans-serif">z<tspan dx="2" dy="-10" font-size="26">Z</tspan></text>`;
  return cheeks + eye(L) + eye(R) + smile;
}

const kEgg = (crack, face) => `
  ${crack ? `<g opacity=".9"><path d="M100 18 L104 2 M70 30 L58 16 M130 30 L142 16" stroke="${K_GOLD}" stroke-width="5" stroke-linecap="round"/></g>` : ''}
  <ellipse cx="100" cy="112" rx="64" ry="78" fill="${K_EGG}" stroke="${K_EGG_D}" stroke-width="4"/>
  <ellipse cx="78" cy="70" rx="14" ry="22" fill="#fff" opacity=".35" transform="rotate(-20 78 70)"/>
  ${kStar(60, 150, 9, '#FFF2C2')}${kStar(146, 132, 7, '#FFF2C2')}${kStar(132, 64, 6, '#FFF2C2')}${kStar(70, 112, 5, '#FFF2C2')}
  ${crack ? `<path d="M42 78 L62 92 L76 74 L94 94 L110 72 L126 92 L142 74 L158 84" fill="none" stroke="${K_GOLD}" stroke-width="9" stroke-linejoin="round" opacity=".8"/>
    <path d="M42 78 L62 92 L76 74 L94 94 L110 72 L126 92 L142 74 L158 84" fill="none" stroke="#7B5BD6" stroke-width="3.5" stroke-linejoin="round"/>` : ''}
  ${kFace(face, 100, 120, 20)}`;

// うまれてからの からだ：s は 大きさ、wings はね、crown 星の かんむり、aura ひかり
function kBody(face, { s = 1, wings = false, crown = false, aura = false } = {}){
  const g = (x, y) => `translate(${100 - 100 * s} ${188 - 188 * s}) scale(${s})`;
  const wing = x => `<g transform="translate(${x} 112) rotate(${x < 100 ? -18 : 18})">${kStar(0, 0, 30, '#FFF0B8')}</g>`;
  return `
  ${aura ? `<circle cx="100" cy="116" r="92" fill="url(#kAura)"/>` : ''}
  <g transform="${g()}">
    ${wings ? wing(38) + wing(162) : ''}
    <path d="M100 74 L100 44" stroke="${K_LINE}" stroke-width="5" stroke-linecap="round"/>
    ${crown ? `<path d="M70 66 L76 40 L88 56 L100 32 L112 56 L124 40 L130 66Z" fill="${K_GOLD}" stroke="${K_GOLD_D}" stroke-width="3" stroke-linejoin="round"/>
       ${kStar(100, 24, 10)}<circle cx="76" cy="40" r="4" fill="#fff"/><circle cx="124" cy="40" r="4" fill="#fff"/>` : kStar(100, 36, 14)}
    <ellipse cx="74" cy="182" rx="16" ry="8" fill="#fff" stroke="${K_LINE}" stroke-width="4"/>
    <ellipse cx="126" cy="182" rx="16" ry="8" fill="#fff" stroke="${K_LINE}" stroke-width="4"/>
    <ellipse cx="100" cy="124" rx="64" ry="58" fill="#fff" stroke="${K_LINE}" stroke-width="5"/>
    <ellipse cx="80" cy="96" rx="16" ry="9" fill="#F6F2FF" transform="rotate(-24 80 96)"/>
    ${kFace(face, 100, 118, 22)}
  </g>`;
}

const KIRA_DEFS = `<defs><radialGradient id="kAura"><stop offset="40%" stop-color="#FFF2C2" stop-opacity=".95"/><stop offset="100%" stop-color="#FFF2C2" stop-opacity="0"/></radialGradient></defs>`;
const KIRA_SVG = {
  1: f => kEgg(false, f),
  2: f => kEgg(true, f),
  3: f => kBody(f),
  4: f => kBody(f, { s: 1.08, wings: true }),
  5: f => kBody(f, { s: 1.1, wings: true, crown: true, aura: true }),
  // 画像が 読めないときの 最終形
  6: f => kBody(f, { s: 1.1, crown: true, aura: true }),
};

// キラの え ぜんたい（.kira-fig）。画像のときは 表情を まわりの しるし（.fx：あせ・？・Zz・きらきら）で しめす
// mane：最終形の たてがみの色。画像の まわりの にじの わで 本数を みせる
function kiraArt(stage, face = 'normal', mane = []){
  if (!KIRA_FACES.includes(face)) face = 'normal';
  const img = KIRA_IMAGES[stage], src = img && (typeof img === 'string' ? img : img[face] || img.normal);
  const ring = stage === KIRA_FINAL && mane.length
    ? ` style="--mane:conic-gradient(${mane.map((c, i) => `${c} ${(i / mane.length * 360).toFixed(1)}deg ${((i + 1) / mane.length * 360).toFixed(1)}deg`).join(',')})"` : '';
  const body = src
    ? `<span class="kira-photo"><img src="${src}" alt="" draggable="false"></span>`
    : `<svg class="kira-svg" viewBox="0 0 200 200" aria-hidden="true">${KIRA_DEFS}${KIRA_SVG[stage](face)}</svg>`;
  return `<span class="kira-fig${src ? ' is-img' : ''}${ring ? ' has-mane' : ''}" data-stage="${stage}" data-face="${face}"${ring}>${body}<span class="fx" aria-hidden="true"></span></span>`;
}
