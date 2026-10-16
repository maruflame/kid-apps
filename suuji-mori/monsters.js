/* Meridian：なかまモンスターの え（SVG を 文字列で つくる。DOM を使わない）
   しゅるい（KINDS）ごとに パーツを かさねて 1ぴきを 組み立てる。色は 教科の 色（S.color）を そのまま使い、
   こい色 d・うすい色 l は そこから つくる。
   かさねる じゅん：back（しっぽ・はね）→ top（みみ・つの。からだの うしろ）→ feet → からだ → pat（もよう。からだの 中だけ）
   → mid（かお まわり）→ おなか → かお（め・ほっぺ・くち）→ front → かざり（たしざん）
   ざひょうは 200×200、じめんは y=186。め は (100±ex, ey)、くち は my、おなか は by が まんなか。 */

const MK = '#1F3D35', GOLD = '#FFD54A', PINK = '#FFB3C1', BEAK = '#F5A623', HORN = '#F3E3C3', WHITE = '#ffffff';
const hexRGB = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hexRGB(a).map((v, i) => Math.round(v + (hexRGB(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const dk = (c, t = .32) => mix(c, MK, t), lt = (c, t = .6) => mix(c, WHITE, t);
const mirror = s => s + `<g transform="translate(200 0) scale(-1 1)">${s}</g>`;
// (cx, cy) を まわる n こ（f に x, y, 角度 を わたす）
const around = (n, cx, cy, rx, ry, f) => range(0, n - 1).map(i => { const a = i / n * Math.PI * 2; return f(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, a); }).join('');
const STAR = (cx, cy, r) => `<path d="M${cx} ${cy-r} L${cx+r*.28} ${cy-r*.28} L${cx+r} ${cy} L${cx+r*.28} ${cy+r*.28} L${cx} ${cy+r} L${cx-r*.28} ${cy+r*.28} L${cx-r} ${cy} L${cx-r*.28} ${cy-r*.28}Z" fill="${GOLD}"/>`;
const stroke = (d, c, w = 5) => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

// よく使う パーツ
const MUZZLE = (f, y = 127) => `<ellipse cx="100" cy="${y}" rx="20" ry="13" fill="${f}"/><ellipse cx="100" cy="${y-7}" rx="6.5" ry="4.5" fill="${MK}"/>`;
const EARS_ROUND = (c, in_, x = 56, y = 68, r = 20) => mirror(`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${r/2}" fill="${in_}"/>`);
const EARS_POINT = (c, in_) => mirror(`<path d="M44 96 L50 34 L92 68Z" fill="${c}"/><path d="M54 84 L57 50 L80 68Z" fill="${in_}"/>`);
const WHISKERS = mirror(stroke('M28 116 L56 121 M30 132 L56 129', MK, 3));
const ORANGE_FEET = mirror(`<ellipse cx="76" cy="180" rx="14" ry="7" fill="${BEAK}"/>`);
const ANTENNAE = c => mirror(stroke('M86 66 Q80 44 70 36', c, 4) + `<circle cx="68" cy="34" r="6" fill="${c}"/>`);
const TAIL_FLUKE = c => `<path d="M100 170 Q78 196 58 190 Q80 182 92 162Z M100 170 Q122 196 142 190 Q120 182 108 162Z" fill="${c}"/>`;
const dots = (f, pts) => `<g fill="${f}">${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;

const BODY = {
  round: ['<ellipse cx="100" cy="120" rx="64" ry="58"/>', 62],
  tall:  ['<ellipse cx="100" cy="116" rx="54" ry="64"/>', 52],
  wide:  ['<ellipse cx="100" cy="128" rx="72" ry="50"/>', 78],
};

/* しゅるい：shape（BODY の名前）か body（[からだの形, あたまの上の y]）。
   back / top / feet / pat / mid / front は (c, d, l) を うけとって SVG を かえす。feet:false で あし なし。
   eye：big（ふつう）/ dot / happy / lash（まつげ）。mouth：smile / small / open / cat / teeth / o / wide / fang / shark / none */
const KINDS = {
  /* ---- ABC：その文字で はじまる どうぶつ ---- */
  alpaca: { shape: 'tall', eye: 'happy', my: 125,
    top: c => mirror(`<ellipse cx="66" cy="48" rx="10" ry="22" transform="rotate(-22 66 48)" fill="${c}"/><ellipse cx="66" cy="50" rx="4.5" ry="13" transform="rotate(-22 66 50)" fill="${PINK}"/>`),
    mid: (c, d, l) => `<ellipse cx="100" cy="124" rx="20" ry="14" fill="${l}"/>`,
    front: (c, d, l) => dots(l, [[82,60,13],[100,52,15],[118,60,13],[91,70,10],[109,70,10]]) },
  bear: { mouth: 'small', my: 129,
    top: (c, d, l) => EARS_ROUND(c, l), mid: (c, d, l) => MUZZLE(l) },
  cat: { mouth: 'cat',
    back: c => stroke('M148 160 Q192 152 182 112 Q176 94 190 84', c, 13),
    top: c => EARS_POINT(c, PINK),
    pat: (c, d) => `<path d="M90 60 L94 80 L98 60Z M102 60 L106 80 L110 60Z" fill="${d}"/>`,
    front: () => WHISKERS },
  dog: { mouth: 'open', my: 127,
    pat: (c, d) => `<ellipse cx="124" cy="100" rx="22" ry="19" fill="${d}" opacity=".45"/>`,
    mid: (c, d, l) => mirror(`<ellipse cx="42" cy="98" rx="15" ry="30" transform="rotate(16 42 98)" fill="${d}"/>`) + MUZZLE(l),
    back: c => stroke('M150 150 Q178 140 174 112', c, 11) },
  elephant: { mouth: 'none', by: 158,
    top: (c, d) => mirror(`<ellipse cx="34" cy="108" rx="32" ry="40" fill="${d}"/><ellipse cx="36" cy="108" rx="20" ry="27" fill="${PINK}"/>`),
    front: (c, d) => stroke('M100 106 Q98 128 106 136 Q114 142 120 134', d, 19) + stroke('M100 106 Q98 128 106 136 Q114 142 120 134', c, 12)
      + stroke('M94 118 H106 M95 126 H107', d, 2.5) },
  fox: { mouth: 'small', my: 129,
    back: (c, d, l) => `<path d="M146 168 Q198 166 190 112 Q186 96 174 88 Q182 124 150 140Z" fill="${c}"/><path d="M190 112 Q186 96 174 88 Q178 104 176 112Z" fill="${WHITE}"/>`,
    top: c => mirror(`<path d="M40 100 L46 24 L94 66Z" fill="${c}"/><path d="M45 46 L46 24 L64 40Z" fill="${MK}"/>`),
    pat: () => `<path d="M30 108 Q66 100 100 128 Q134 100 170 108 V190 H30Z" fill="${WHITE}"/>`,
    mid: () => `<ellipse cx="100" cy="122" rx="6" ry="4.5" fill="${MK}"/>` },
  giraffe: { shape: 'tall', eye: 'lash', mouth: 'small', my: 132,
    top: (c, d) => mirror(stroke('M84 58 L78 30', d, 7) + `<circle cx="78" cy="28" r="7" fill="${d}"/><ellipse cx="44" cy="74" rx="16" ry="8" transform="rotate(24 44 74)" fill="${c}"/>`),
    pat: (c, d) => `<g opacity=".45">${dots(d, [[62,78,8],[140,74,7],[54,128,9],[148,134,10],[70,166,7],[132,170,8]])}</g>`,
    mid: (c, d, l) => `<ellipse cx="100" cy="127" rx="22" ry="14" fill="${l}"/>` + mirror(`<ellipse cx="93" cy="123" rx="3" ry="4" fill="${d}"/>`) },
  hippo: { shape: 'wide', ey: 98, my: 129, by: 158,
    top: (c, d) => mirror(`<ellipse cx="64" cy="82" rx="10" ry="8" fill="${d}"/>`),
    mid: (c, d, l) => `<ellipse cx="100" cy="126" rx="38" ry="15" fill="${l}"/>` + mirror(`<ellipse cx="86" cy="120" rx="3.5" ry="4.5" fill="${d}"/>`) },
  iguana: { shape: 'wide', mouth: 'wide', my: 120,
    back: c => `<path d="M160 150 Q196 150 192 120 Q188 100 172 104 Q184 112 178 126 Q172 138 150 136Z" fill="${c}"/>`,
    top: (c, d) => `<path d="M60 94 L66 70 L76 86 L84 62 L94 82 L100 58 L106 82 L116 62 L124 86 L134 70 L140 94Z" fill="${d}"/>`,
    pat: (c, d, l) => `<g opacity=".6">${dots(l, [[44,122,5],[54,142,4],[156,122,5],[146,142,4],[64,96,4],[136,96,4]])}</g>` },
  jellyfish: { feet: false, hy: 46,
    body: '<path d="M26 172 Q26 46 100 46 Q174 46 174 172 Q156 182 137 172 Q119 182 100 172 Q81 182 63 172 Q44 182 26 172Z"/>',
    back: (c, d) => [48, 74, 100, 126, 152].map(x => stroke(`M${x} 174 q-8 8 0 13 q8 6 0 11`, d, 6)).join(''),
    pat: (c, d, l) => `<g opacity=".5">${dots(l, [[60,80,7],[140,76,6],[48,120,5],[152,124,6]])}</g>` },
  koala: { eye: 'dot', mouth: 'small', my: 136, by: 160,
    top: (c, d, l) => mirror(`<circle cx="44" cy="80" r="28" fill="${c}"/><circle cx="46" cy="82" r="15" fill="${l}"/>`),
    front: () => `<ellipse cx="100" cy="117" rx="12" ry="15" fill="${MK}"/><ellipse cx="96" cy="110" rx="4" ry="3" fill="${WHITE}" opacity=".4"/>` },
  lion: { mouth: 'small', my: 129,
    back: (c, d) => `<g fill="${d}"><ellipse cx="100" cy="114" rx="70" ry="64"/>${around(13, 100, 114, 68, 62, (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="20"/>`)}</g>`,
    top: (c, d, l) => EARS_ROUND(c, l, 60, 70, 14), mid: (c, d, l) => MUZZLE(l) },
  mouse: { eye: 'dot', mouth: 'cat',
    back: (c, d) => stroke('M150 166 Q190 170 186 140 Q182 120 194 108', d, 5),
    top: c => EARS_ROUND(c, PINK, 48, 62, 30), front: () => WHISKERS },
  narwhal: { shape: 'wide', feet: false,
    back: (c, d) => mirror(`<ellipse cx="30" cy="150" rx="22" ry="10" transform="rotate(35 30 150)" fill="${d}"/>`) + TAIL_FLUKE(d),
    top: () => `<path d="M93 90 L100 16 L107 90Z" fill="${GOLD}"/>` + stroke('M95 70 L105 64 M96 56 L104 50 M97 42 L103 37 M98 30 L102 26', '#D99A00', 3),
    pat: (c, d, l) => `<path d="M20 152 Q100 178 180 152 V190 H20Z" fill="${l}"/><g opacity=".35">${dots(d, [[58,94,5],[142,92,5],[44,120,4],[156,118,4]])}</g>` },
  owl: { shape: 'tall', mouth: 'none', cheek: false, feet: () => ORANGE_FEET,
    top: (c, d) => mirror(`<path d="M52 76 L44 32 L86 58Z" fill="${d}"/>`),
    mid: (c, d, l) => mirror(`<circle cx="77" cy="102" r="22" fill="${l}"/><path d="M48 112 Q36 146 58 172 Q64 146 62 118Z" fill="${d}"/>`),
    front: () => `<path d="M93 114 L107 114 L100 127Z" fill="${BEAK}"/>` },
  penguin: { shape: 'tall', mouth: 'none', feet: () => ORANGE_FEET,
    top: (c, d) => mirror(`<path d="M52 102 Q20 130 30 156 Q46 142 58 124Z" fill="${d}"/>`),
    pat: () => `<path d="M100 80 Q78 62 62 80 Q48 100 56 132 Q62 172 100 184 Q138 172 144 132 Q152 100 138 80 Q122 62 100 80Z" fill="${WHITE}"/>`,
    front: () => `<path d="M90 115 Q100 107 110 115 Q100 124 90 115Z" fill="${BEAK}"/>` },
  quokka: { shape: 'tall', eye: 'happy', mouth: 'open', my: 122,
    top: c => EARS_ROUND(c, PINK, 62, 60, 15),
    mid: (c, d, l) => `<ellipse cx="100" cy="124" rx="30" ry="20" fill="${l}"/><ellipse cx="100" cy="114" rx="6" ry="4.5" fill="${MK}"/>`,
    front: (c, d) => mirror(`<ellipse cx="82" cy="142" rx="9" ry="7" fill="${d}"/>`) },
  rabbit: { mouth: 'teeth', my: 122,
    back: () => `<circle cx="160" cy="166" r="13" fill="${WHITE}"/>`,
    top: c => mirror(`<ellipse cx="74" cy="38" rx="14" ry="36" transform="rotate(-10 74 38)" fill="${c}"/><ellipse cx="74" cy="40" rx="6" ry="24" transform="rotate(-10 74 40)" fill="${PINK}"/>`),
    mid: () => `<path d="M95 113 L105 113 L100 119Z" fill="#FF8FA3"/>` },
  sheep: { hy: 58, fill: c => lt(c, .72), feet: (c, d) => mirror(`<ellipse cx="76" cy="180" rx="12" ry="8" fill="${d}"/>`),
    body: [`<ellipse cx="100" cy="122" rx="56" ry="48"/>` + around(14, 100, 122, 54, 46, (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="18"/>`), 58],
    mid: c => mirror(`<ellipse cx="54" cy="96" rx="17" ry="8" transform="rotate(-24 54 96)" fill="${c}"/>`)
      + `<ellipse cx="100" cy="106" rx="36" ry="31" fill="${c}"/>` + dots(lt(c, .72), [[86,78,10],[100,74,11],[114,78,10]]) },
  tiger: { mouth: 'small', my: 129,
    top: (c, d, l) => EARS_ROUND(c, l, 58, 70, 17),
    pat: (c, d) => `<g fill="${d}"><path d="M30 94 L66 103 L30 112Z"/><path d="M32 128 L62 132 L32 140Z"/><path d="M90 60 L100 82 L110 60Z"/></g>`
      + `<g fill="${d}" transform="translate(200 0) scale(-1 1)"><path d="M30 94 L66 103 L30 112Z"/><path d="M32 128 L62 132 L32 140Z"/></g>`,
    mid: () => MUZZLE(WHITE) },
  unicorn: { eye: 'lash',
    back: () => stroke('M150 160 Q194 150 186 110', '#FF8FB8', 12) + stroke('M152 168 Q198 166 196 128', '#A77BF0', 9),
    top: c => mirror(`<path d="M58 84 L60 42 L88 70Z" fill="${c}"/>`) + `<path d="M92 70 L100 16 L108 70Z" fill="${GOLD}"/>` + stroke('M95 56 L105 50 M96 42 L104 36 M97 30 L103 26', '#D99A00', 3),
    mid: () => `<path d="M100 66 Q70 58 54 82 Q70 72 82 76 Q80 84 82 90 Q90 78 106 74Z" fill="#FF8FB8"/><path d="M104 66 Q88 62 82 76 Q94 70 106 74Z" fill="#A77BF0"/>` },
  van: { ey: 96, cheek: false, plate: true, by: 152,
    body: ['<rect x="28" y="62" width="144" height="110" rx="32"/>', 62],
    feet: () => mirror(`<circle cx="62" cy="172" r="17" fill="${MK}"/><circle cx="62" cy="172" r="7" fill="#C9D3CF"/>`),
    mid: () => `<rect x="42" y="74" width="116" height="44" rx="16" fill="#CFEAFB"/>` + stroke('M54 110 L70 82', WHITE, 6) + mirror(`<circle cx="46" cy="138" r="9" fill="${GOLD}"/>`),
    my: 124 },
  whale: { shape: 'wide', feet: false,
    back: c => `<path d="M156 150 Q184 136 188 108 Q178 118 168 116 Q178 104 178 88 Q164 108 150 132Z" fill="${c}"/>`,
    top: () => `<g stroke="#7FD3F0" stroke-width="6" stroke-linecap="round" fill="none"><path d="M100 82 V48"/><path d="M100 64 Q88 50 78 52"/><path d="M100 64 Q112 50 122 52"/></g>` + dots('#7FD3F0', [[74,54,5],[126,54,5],[100,42,6]]),
    pat: (c, d, l) => `<path d="M20 148 Q100 174 180 148 V190 H20Z" fill="${l}"/>`,
    front: (c, d) => mirror(`<ellipse cx="40" cy="166" rx="18" ry="8" transform="rotate(-24 40 166)" fill="${d}"/>`) },
  xrayfish: { shape: 'wide', feet: false, mouth: 'o', fill: c => lt(c, .25),
    back: (c, d) => `<path d="M158 128 L198 98 L198 158Z" fill="${d}"/>`,
    top: (c, d) => `<path d="M70 94 Q96 44 132 92Z" fill="${d}"/>`,
    pat: () => `<g stroke="${WHITE}" stroke-width="5" stroke-linecap="round" opacity=".75" fill="none"><path d="M30 128 H170"/><path d="M48 110 V146"/><path d="M152 110 V146"/><path d="M62 104 V152"/><path d="M138 104 V152"/></g>`,
    front: (c, d) => `<path d="M88 168 Q100 190 112 168Z" fill="${d}"/>` },
  yak: { mouth: 'small', my: 131,
    top: (c, d) => mirror(`<path d="M62 80 Q28 76 24 46 Q40 62 66 64Z" fill="${HORN}"/><ellipse cx="38" cy="100" rx="14" ry="7" transform="rotate(-20 38 100)" fill="${d}"/>`),
    mid: (c, d, l) => `<ellipse cx="100" cy="128" rx="22" ry="14" fill="${l}"/>` + mirror(`<ellipse cx="92" cy="124" rx="3" ry="4" fill="${d}"/>`),
    front: (c, d) => `<path d="M50 90 Q60 58 100 58 Q140 58 150 90 L140 82 L132 96 L122 84 L112 98 L100 86 L88 98 L78 84 L68 96 L60 82Z" fill="${d}"/>` },
  zebra: { shape: 'tall', mouth: 'none',
    top: c => mirror(`<ellipse cx="68" cy="50" rx="9" ry="19" transform="rotate(-16 68 50)" fill="${c}"/><ellipse cx="68" cy="52" rx="4" ry="11" transform="rotate(-16 68 52)" fill="${PINK}"/>`)
      + `<path d="M84 58 L88 34 L95 52 L100 28 L105 52 L112 34 L116 58Z" fill="${MK}"/>`,
    pat: () => `<g fill="${WHITE}" opacity=".85">` + mirror('<path d="M42 88 L72 96 L42 104Z"/><path d="M44 120 L68 125 L44 132Z"/><path d="M50 150 L70 153 L52 160Z"/>') + '</g>',
    mid: (c, d, l) => `<ellipse cx="100" cy="128" rx="22" ry="14" fill="${d}"/>` + mirror(`<ellipse cx="92" cy="125" rx="3.5" ry="4.5" fill="${l}"/>`) },

  /* ---- すうじ：どうぶつ と みぢかな もの ---- */
  chicky: { eye: 'dot', mouth: 'none', feet: () => ORANGE_FEET,
    top: c => `<path d="M100 66 Q88 44 96 36 Q100 52 106 42 Q114 56 100 66Z" fill="${c}"/>`,
    mid: (c, d) => mirror(`<ellipse cx="40" cy="128" rx="11" ry="20" transform="rotate(24 40 128)" fill="${d}"/>`),
    front: () => `<path d="M91 116 L100 109 L109 116 L100 124Z" fill="${BEAK}"/>` },
  froggy: { shape: 'wide', ex: 30, ey: 82, mouth: 'wide', my: 116,
    top: c => mirror(`<circle cx="70" cy="84" r="24" fill="${c}"/>`),
    feet: (c, d) => mirror(`<path d="M56 172 Q40 188 54 188 Q64 190 72 182 Q82 192 92 180 Q86 170 56 172Z" fill="${d}"/>`),
    pat: (c, d, l) => `<ellipse cx="100" cy="170" rx="62" ry="32" fill="${l}"/><g opacity=".4">${dots(d, [[40,118,6],[160,120,6],[50,140,4],[150,142,4]])}</g>` },
  piggy: { mouth: 'none', by: 160,
    back: c => stroke('M158 150 q16 -6 12 -16 q-4 -10 -12 -2 q-6 8 8 10 q12 0 18 -10', c, 5),
    top: (c, d) => mirror(`<path d="M48 82 L54 46 L86 66Z" fill="${d}"/>`),
    mid: (c, d) => `<ellipse cx="100" cy="123" rx="17" ry="12" fill="${lt(c, .4)}" stroke="${d}" stroke-width="3"/>` + mirror(`<ellipse cx="94" cy="123" rx="3" ry="4.5" fill="${d}"/>`)
      + stroke('M94 139 Q100 143 106 139', MK, 3.5) },
  ducky: { eye: 'happy', mouth: 'none', feet: () => mirror(`<path d="M60 182 L76 172 L90 184Z" fill="${BEAK}"/>`),
    top: (c, d) => stroke('M100 66 Q96 48 86 42 M100 66 Q102 46 112 40', d, 5),
    mid: (c, d) => mirror(`<ellipse cx="38" cy="130" rx="12" ry="22" transform="rotate(30 38 130)" fill="${d}"/>`),
    front: () => `<ellipse cx="100" cy="121" rx="22" ry="9" fill="${BEAK}"/>` + stroke('M80 121 Q100 127 120 121', '#D9822B', 2.5) },
  panda: { mouth: 'small', my: 129, feet: () => mirror(`<ellipse cx="74" cy="178" rx="17" ry="10" fill="${MK}"/>`),
    top: () => mirror(`<circle cx="56" cy="70" r="18" fill="${MK}"/>`),
    mid: () => `<ellipse cx="100" cy="108" rx="52" ry="40" fill="${WHITE}"/>` + mirror(`<ellipse cx="76" cy="104" rx="16" ry="19" transform="rotate(24 76 104)" fill="${MK}"/>`)
      + `<ellipse cx="100" cy="122" rx="6" ry="4.5" fill="${MK}"/>` },
  monkey: { mouth: 'open', my: 122, by: 160,
    back: (c, d) => stroke('M152 160 Q194 160 188 126 Q184 110 170 116 Q164 124 176 128', d, 9),
    top: (c, d, l) => EARS_ROUND(c, l, 36, 104, 18),
    mid: (c, d, l) => `<path d="M100 86 Q88 74 74 80 Q58 88 62 110 Q66 134 100 140 Q134 134 138 110 Q142 88 126 80 Q112 74 100 86Z" fill="${l}"/>`,
    front: (c, d) => stroke('M90 66 Q96 52 102 62 Q106 52 112 58', d, 5) },
  ladybug: { eye: 'big',
    top: () => ANTENNAE(MK),
    pat: () => `<path d="M30 84 Q100 52 170 84 V40 H30Z" fill="${MK}"/>` + dots(MK, [[56,100,9],[144,100,9],[44,132,8],[156,132,8],[64,162,7],[136,162,7],[100,78,6]]) },
  octopus: { feet: false, hy: 50, ey: 96, my: 112, mouth: 'o', by: 144,
    body: '<ellipse cx="100" cy="108" rx="62" ry="58"/>',
    back: c => range(0, 7).map(i => { const x = 44 + i * 16, s = i < 4 ? -1 : 1;
      return stroke(`M${x} 146 Q${x} 176 ${x + s*6} 186 Q${x + s*12} 192 ${x + s*14} 184`, c, 12); }).join(''),
    pat: (c, d, l) => `<g opacity=".5">${dots(l, [[64,68,7],[136,66,8],[46,104,5],[154,104,5]])}</g>` },
  turtle: { hy: 52, by: 156,
    body: '<ellipse cx="100" cy="142" rx="78" ry="42"/>',
    feet: (c, d) => mirror(`<ellipse cx="44" cy="176" rx="14" ry="10" fill="${lt(c, .3)}"/><ellipse cx="74" cy="182" rx="12" ry="8" fill="${lt(c, .3)}"/>`),
    pat: (c, d, l) => `<g stroke="${d}" stroke-width="4" fill="none" opacity=".45">` + mirror('<path d="M36 128 Q56 116 68 132 Q78 150 58 166"/><path d="M26 150 L46 146"/>') + '</g>',
    mid: c => `<circle cx="100" cy="98" r="42" fill="${lt(c, .3)}"/>` },
  hamster: { mouth: 'teeth', my: 122,
    top: c => EARS_ROUND(c, PINK, 62, 66, 14),
    mid: (c, d, l) => mirror(`<circle cx="58" cy="124" r="22" fill="${l}"/>`) + `<ellipse cx="100" cy="115" rx="5" ry="4" fill="#FF8FA3"/>` },
  bee: {
    back: () => mirror(`<ellipse cx="40" cy="80" rx="28" ry="18" transform="rotate(-30 40 80)" fill="${WHITE}" opacity=".9" stroke="#9FD8F5" stroke-width="3"/>`),
    top: () => ANTENNAE(MK),
    pat: () => `<g fill="${MK}"><rect x="30" y="132" width="140" height="11"/><rect x="30" y="160" width="140" height="11"/></g>` },
  crab: { shape: 'wide', ex: 26, ey: 68, my: 114, by: 154,
    top: c => mirror(stroke('M74 96 V72', c, 7)),
    feet: (c, d) => mirror(stroke('M44 162 L24 174 M54 170 L38 186', d, 6)),
    front: (c, d) => mirror(stroke('M36 130 Q18 122 22 100', c, 10) + `<path d="M22 102 Q0 88 10 64 Q20 80 32 78 Q34 94 22 102Z" fill="${d}"/>`) },
  snail: {
    back: (c, d) => `<circle cx="100" cy="74" r="50" fill="${lt(c, .45)}" stroke="${d}" stroke-width="5"/>` + stroke('M100 74 a8 8 0 1 1 8 8 a18 18 0 1 1 -18 -18 a30 30 0 1 1 30 30', d, 5),
    top: c => mirror(stroke('M84 66 L72 34', c, 6) + `<circle cx="71" cy="32" r="7" fill="${c}"/>`) },
  hedgehog: { eye: 'dot', mouth: 'small', my: 127,
    back: (c, d) => `<path d="${range(0, 31).map(i => { const a = i / 32 * Math.PI * 2, r = i % 2 ? 1 : 1.32;
      return (i ? 'L' : 'M') + (100 + Math.cos(a) * 64 * r).toFixed(1) + ' ' + (118 + Math.sin(a) * 56 * r).toFixed(1); }).join(' ')}Z" fill="${d}"/>`,
    mid: (c, d, l) => `<ellipse cx="100" cy="114" rx="44" ry="38" fill="${l}"/><circle cx="100" cy="119" r="5.5" fill="${MK}"/>` },
  squirrel: { shape: 'tall', mouth: 'teeth', my: 122,
    back: (c, d, l) => `<path d="M134 172 Q196 176 194 120 Q192 70 152 48 Q140 44 134 54 Q170 76 166 110 Q162 140 134 150Z" fill="${d}"/>` + stroke('M152 70 Q176 92 172 122', l, 6),
    top: (c, d) => mirror(`<path d="M60 74 L58 36 L86 60Z" fill="${c}"/>` + stroke('M58 36 L53 25 M58 36 L63 25', d, 4)),
    mid: (c, d, l) => `<ellipse cx="100" cy="134" rx="32" ry="40" fill="${l}"/><ellipse cx="100" cy="114" rx="6" ry="4.5" fill="${MK}"/>` },
  deer: { eye: 'lash', mouth: 'small', my: 125,
    top: c => mirror(stroke('M80 66 L72 30 M74 42 L58 34 M72 30 L64 16 M72 30 L80 18', '#A9744F', 7)
      + `<ellipse cx="44" cy="78" rx="18" ry="9" transform="rotate(28 44 78)" fill="${c}"/><ellipse cx="46" cy="79" rx="10" ry="4.5" transform="rotate(28 46 79)" fill="${PINK}"/>`),
    pat: () => `<g opacity=".7">${dots(WHITE, [[52,88,5],[148,86,5],[44,118,4],[156,116,4],[54,148,5],[146,148,5]])}</g>`,
    mid: () => `<ellipse cx="100" cy="118" rx="7" ry="5" fill="${MK}"/>` },
  raccoon: { mouth: 'small', my: 130,
    back: (c, d) => stroke('M150 166 Q192 160 190 118', c, 16) + `<path d="M150 166 Q192 160 190 118" stroke="${d}" stroke-width="16" fill="none" stroke-dasharray="8 10"/>`,
    top: (c, d, l) => EARS_POINT(c, l),
    mid: () => `<path d="M40 104 Q66 80 100 98 Q134 80 160 104 Q152 124 128 116 Q100 108 72 116 Q48 124 40 104Z" fill="${MK}"/>` + MUZZLE(WHITE, 128) },
  seal: { shape: 'wide', feet: false, mouth: 'small', my: 129, by: 158,
    top: () => `<circle cx="100" cy="60" r="18" fill="${GOLD}"/>` + stroke('M84 54 Q100 64 116 54', '#E5484D', 5),
    mid: (c, d, l) => MUZZLE(l) + mirror(dots(d, [[88,129,1.8],[84,123,1.8],[90,133,1.8]])),
    front: (c, d) => mirror(`<ellipse cx="34" cy="160" rx="22" ry="10" transform="rotate(-30 34 160)" fill="${d}"/>`) },
  dolphin: { shape: 'tall', feet: false, mouth: 'small', my: 124,
    back: (c, d) => TAIL_FLUKE(d),
    top: (c, d) => `<path d="M86 58 Q100 18 126 36 Q112 42 114 58Z" fill="${d}"/>` + mirror(`<path d="M50 130 Q22 140 26 160 Q42 152 56 146Z" fill="${d}"/>`),
    pat: (c, d, l) => `<ellipse cx="100" cy="180" rx="50" ry="40" fill="${l}"/>`,
    mid: (c, d, l) => `<ellipse cx="100" cy="124" rx="18" ry="11" fill="${l}"/>` },
  shark: { shape: 'tall', feet: false, mouth: 'shark',
    back: (c, d) => TAIL_FLUKE(d),
    top: (c, d) => `<path d="M84 58 L104 14 L120 58Z" fill="${d}"/>` + mirror(`<path d="M50 128 L18 152 L56 150Z" fill="${d}"/>`),
    pat: (c, d) => `<path d="M30 126 Q100 146 170 126 V190 H30Z" fill="${WHITE}"/>` + mirror(stroke('M54 98 q5 6 0 12 M61 96 q5 6 0 12', d, 3)) },
  butterfly: { shape: 'tall', eye: 'lash',
    back: (c, d) => mirror(`<path d="M80 104 Q30 34 14 70 Q2 112 72 122Z" fill="${lt(c, .3)}" stroke="${d}" stroke-width="4"/><path d="M76 128 Q24 132 30 168 Q44 190 82 148Z" fill="${lt(c, .5)}" stroke="${d}" stroke-width="4"/>`
      + dots(WHITE, [[34,80,9],[40,160,6]])),
    top: () => mirror(stroke('M88 56 Q80 30 66 30 Q58 32 62 40', MK, 4)) },
  dragon: { mouth: 'fang', my: 122,
    back: (c, d) => mirror(`<path d="M46 108 Q8 84 12 46 Q26 64 38 60 Q40 76 54 80 Q50 92 60 96Z" fill="${d}"/>`)
      + `<path d="M150 160 Q190 160 186 128 L196 118 L176 116 L182 128 Q182 146 148 146Z" fill="${c}"/>`,
    top: () => mirror(`<path d="M66 72 Q52 46 60 30 Q70 52 84 64Z" fill="${HORN}"/>`),
    mid: (c, d) => mirror(`<ellipse cx="94" cy="117" rx="2.5" ry="3.5" fill="${d}"/>`) },
  dino: { eye: 'happy', mouth: 'open', my: 120,
    back: c => `<path d="M150 170 Q196 168 196 132 Q180 150 152 146Z" fill="${c}"/>`,
    top: (c, d) => `<g fill="${d}"><path d="M56 84 L60 52 L80 70Z"/><path d="M80 68 L90 36 L102 62Z"/><path d="M100 62 L114 34 L122 66Z"/><path d="M122 68 L142 52 L144 84Z"/></g>`,
    pat: (c, d, l) => `<g opacity=".6">${dots(l, [[50,110,7],[150,108,6],[56,140,5],[146,140,6]])}</g>` },
  robot: { eye: 'dot', plate: true, by: 154,
    body: ['<rect x="38" y="62" width="124" height="114" rx="24"/>', 62],
    feet: () => mirror(`<rect x="58" y="170" width="30" height="16" rx="5" fill="#9AA8A3"/>`),
    top: () => stroke('M100 62 V38', '#9AA8A3', 5) + `<circle cx="100" cy="32" r="8" fill="#E5484D"/>` + mirror(`<rect x="26" y="98" width="16" height="28" rx="6" fill="#9AA8A3"/>`),
    mid: c => `<rect x="52" y="80" width="96" height="52" rx="16" fill="${lt(c, .75)}"/>` + mirror(`<circle cx="50" cy="72" r="3" fill="${lt(c, .5)}"/>`) },
  ghost: { feet: false, eye: 'dot', mouth: 'open', fill: c => lt(c, .7), hy: 46,
    body: '<path d="M42 178 V104 Q42 46 100 46 Q158 46 158 104 V178 Q148 166 136 178 Q124 190 112 178 Q100 166 88 178 Q76 190 64 178 Q54 166 42 178Z"/>',
    back: c => mirror(`<path d="M48 120 Q26 112 22 128 Q34 136 48 136Z" fill="${lt(c, .7)}"/>`) },
  apple: { hy: 70,
    body: '<path d="M100 76 Q74 58 50 70 Q26 84 30 122 Q36 166 72 178 Q88 182 100 174 Q112 182 128 178 Q164 166 170 122 Q174 84 150 70 Q126 58 100 76Z"/>',
    top: () => stroke('M100 74 Q98 56 106 44', '#8A5A2B', 6) + `<path d="M104 56 Q124 36 142 48 Q124 66 104 56Z" fill="#5BBF7F"/>` },
  cupcake: { feet: false, ey: 94, my: 108, by: 152, hy: 52,
    body: '<path d="M44 120 Q30 106 44 92 Q44 70 66 70 Q74 52 100 52 Q126 52 134 70 Q156 70 156 92 Q170 106 156 120 L140 178 H60Z"/>',
    pat: () => dots('#FFD54A', [[60,96,3],[140,92,3]]) + dots('#7FD3F0', [[76,72,3],[132,108,3]]) + dots(WHITE, [[118,66,3],[52,112,3]]),
    mid: (c, d, l) => `<path d="M46 120 L60 178 H140 L154 120Z" fill="${l}"/>` + stroke('M70 124 L76 176 M88 124 L90 176 M112 124 L110 176 M130 124 L124 176', d, 3),
    top: () => `<circle cx="100" cy="44" r="11" fill="#E5484D"/>` + stroke('M100 34 Q104 22 112 20', '#2C7352', 3) },
  pudding: { feet: false, by: 150, hy: 62,
    body: '<path d="M58 72 Q100 60 142 72 L164 166 Q100 184 36 166Z"/>',
    back: () => `<ellipse cx="100" cy="176" rx="82" ry="13" fill="${WHITE}" stroke="#CDE7D4" stroke-width="3"/>`,
    pat: (c, d) => `<path d="M30 50 H170 V82 Q142 94 134 82 Q124 98 112 84 Q100 96 88 84 Q76 98 66 82 Q58 94 30 82Z" fill="${d}"/>`,
    front: () => `<ellipse cx="100" cy="64" rx="22" ry="9" fill="${WHITE}"/><circle cx="100" cy="52" r="9" fill="#E5484D"/>` },
  sunny: { eye: 'happy', mouth: 'open', my: 120,
    back: () => `<g fill="${GOLD}">${around(12, 100, 120, 0, 0, (x, y, a) => { const p = (r, da) => `${(100 + Math.cos(a + da) * r).toFixed(1)} ${(120 + Math.sin(a + da) * r * .92).toFixed(1)}`;
      return `<path d="M${p(54, -.2)} L${p(90, 0)} L${p(54, .2)}Z"/>`; })}</g>` },
  rocket: { feet: false, hy: 30, by: 158,
    body: '<path d="M100 30 Q156 66 152 132 L150 168 Q100 180 50 168 L48 132 Q44 66 100 30Z"/>',
    back: (c, d) => `<path d="M74 168 Q100 210 126 168Z" fill="#FFA552"/><path d="M86 168 Q100 194 114 168Z" fill="${GOLD}"/>` + mirror(`<path d="M52 122 L20 172 L54 166Z" fill="${d}"/>`),
    mid: c => `<circle cx="100" cy="106" r="38" fill="${lt(c, .75)}" stroke="#C9D3CF" stroke-width="7"/>` },
};

// たしざんの かざり（t：あたまの上の y、ey：めの y）
const ACC = {
  ribbon: t => `<g fill="#FF5C8A"><path d="M128 ${t+8} L110 ${t-6} L112 ${t+20}Z"/><path d="M128 ${t+8} L146 ${t-6} L144 ${t+20}Z"/><circle cx="128" cy="${t+8}" r="6"/></g>`,
  hat: t => `<g fill="#3A3A4A"><rect x="76" y="${t-34}" width="48" height="38" rx="5"/><rect x="62" y="${t}" width="76" height="10" rx="5"/></g><rect x="76" y="${t-8}" width="48" height="7" fill="#E5484D"/>`,
  sunglasses: (t, ey, ex) => mirror(`<rect x="${100-ex-17}" y="${ey-11}" width="34" height="22" rx="10" fill="#26303A"/><path d="M${100-ex-10} ${ey-5} l8 -3" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`)
    + stroke(`M${100-ex+17} ${ey-4} Q100 ${ey-9} ${100+ex-17} ${ey-4}`, '#26303A', 4),
  flower: t => around(5, 72, t + 6, 8, 8, (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#FF8FB8"/>`) + `<circle cx="72" cy="${t+6}" r="6" fill="${GOLD}"/>`,
  cap: t => `<path d="M64 ${t+12} Q64 ${t-26} 100 ${t-26} Q136 ${t-26} 136 ${t+12}Z" fill="#2E8FD0"/><path d="M100 ${t+8} Q142 ${t+2} 162 ${t+14} Q132 ${t+20} 100 ${t+14}Z" fill="#1F6EA3"/><circle cx="100" cy="${t-24}" r="4" fill="#1F6EA3"/>`,
  cape: t => `<path d="M58 ${t+34} Q28 140 22 188 L178 188 Q172 140 142 ${t+34}Z" fill="#E5484D"/>`,
  balloon: () => stroke('M156 150 Q170 110 176 74', '#7A8A85', 2.5) + `<ellipse cx="178" cy="52" rx="18" ry="22" fill="#FF8FB8"/><ellipse cx="171" cy="44" rx="5" ry="8" fill="#fff" opacity=".45"/>`,
  headphones: t => stroke(`M48 ${t+44} Q48 ${t-16} 100 ${t-16} Q152 ${t-16} 152 ${t+44}`, '#7A5AE0', 8) + mirror(`<rect x="34" y="${t+30}" width="20" height="32" rx="9" fill="#7A5AE0"/>`),
};
const ACC_BACK = { cape: true };  // からだの うしろに かく かざり

// め（ひだりの め を かいて ミラー）
function eyes(kind, ex, ey){
  const x = 100 - ex;
  if (kind === 'dot') return mirror(`<ellipse cx="${x}" cy="${ey}" rx="6.5" ry="8.5" fill="${MK}"/><circle cx="${x+2.5}" cy="${ey-3}" r="2.4" fill="${WHITE}"/>`);
  if (kind === 'happy') return mirror(stroke(`M${x-9} ${ey+3} Q${x} ${ey-9} ${x+9} ${ey+3}`, MK, 4.5));
  const big = `<circle cx="${x}" cy="${ey}" r="12" fill="${WHITE}"/><circle cx="${x+2}" cy="${ey+2}" r="7.5" fill="${MK}"/><circle cx="${x+5}" cy="${ey-2}" r="3" fill="${WHITE}"/>`;
  return mirror(kind === 'lash' ? big + stroke(`M${x-12} ${ey-6} l-6 -5 M${x-8} ${ey-11} l-3 -6`, MK, 3) : big);
}
function mouth(kind, y){
  switch (kind){
    case 'none': return '';
    case 'small': return stroke(`M94 ${y} Q100 ${y+6} 106 ${y}`, MK, 3.5);
    case 'open': return `<path d="M90 ${y} Q100 ${y+16} 110 ${y}Z" fill="${MK}"/><ellipse cx="100" cy="${y+8}" rx="5" ry="3.5" fill="#FF8FA3"/>`;
    case 'cat': return `<path d="M96 ${y-7} L104 ${y-7} L100 ${y-2}Z" fill="#FF8FA3"/>` + stroke(`M90 ${y} Q95 ${y+6} 100 ${y} Q105 ${y+6} 110 ${y}`, MK, 3.5);
    case 'teeth': return `<rect x="95" y="${y+2}" width="10" height="8" rx="2" fill="${WHITE}" stroke="${MK}" stroke-width="2"/>` + stroke(`M90 ${y} Q100 ${y+6} 110 ${y}`, MK, 3.5);
    case 'o': return `<ellipse cx="100" cy="${y+3}" rx="5" ry="6" fill="${MK}"/>`;
    case 'wide': return stroke(`M70 ${y} Q100 ${y+18} 130 ${y}`, MK, 4);
    case 'fang': return `<path d="M103 ${y+3} L108 ${y+2} L106 ${y+8}Z" fill="${WHITE}"/>` + stroke(`M91 ${y} Q100 ${y+9} 109 ${y}`, MK, 4);
    case 'shark': return `<path d="M84 ${y} Q100 ${y+16} 116 ${y}Z" fill="${MK}"/><path d="M87 ${y+1} L91 ${y+6} L95 ${y+1}Z M97 ${y+1} L100 ${y+7} L103 ${y+1}Z M105 ${y+1} L109 ${y+6} L113 ${y+1}Z" fill="${WHITE}"/>`;
    default: return stroke(`M91 ${y} Q100 ${y+9} 109 ${y}`, MK, 4);
  }
}
// おなか：数（点の数）か 文字（その数字・文字・しき・はたの色）。ながい 文字ほど 小さく
function belly(v, c, by, plate){
  const bg = plate ? `<rect x="64" y="${by-17}" width="72" height="34" rx="9" fill="${WHITE}" stroke="${MK}" stroke-opacity=".15" stroke-width="2"/>`
    : `<ellipse cx="100" cy="${by}" rx="34" ry="18" fill="${WHITE}" opacity=".88"/>`;
  if (typeof v !== 'number') return bg + `<text x="100" y="${by+10}" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="${Math.min(28, 72 / String(v).length).toFixed(1)}" fill="${dk(c, .25)}">${v}</text>`;
  const pts = v <= 5 ? range(0, v-1).map(i => [78 + i*11, by]) : range(0, v-1).map(i => [78 + (i%5)*11, i < 5 ? by-6 : by+6]);
  return bg + pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.3" fill="${c}"/>`).join('');
}

let monUid = 0;
// kind：KINDS の名前、c：色、st：しんか 1〜3、v：おなか（数なら 点、文字なら そのまま）、acc：かざり
function drawMon(kind, c, st, v, acc){
  const K = KINDS[kind] || KINDS.bear, d = dk(c), l = lt(c);
  const [shape, top0] = typeof K.body === 'string' ? [K.body, K.hy] : K.body || BODY[K.shape || 'round'];
  const top = K.hy ?? top0, ex = K.ex ?? 22, ey = K.ey ?? 102, my = K.my ?? 120, by = K.by ?? 156;
  const part = p => p ? p(c, d, l) : '', id = 'mb' + (++monUid);
  const feet = K.feet === false ? '' : K.feet ? K.feet(c, d, l) : mirror(`<ellipse cx="74" cy="178" rx="17" ry="10" fill="${dk(c, .12)}"/>`);
  const a = acc && ACC[acc] ? ACC[acc](top, ey, ex) : '';
  const s = [0, .8, .9, 1][st] || 1;
  return `<svg class="mon" viewBox="0 0 200 200" aria-hidden="true">
    ${st >= 3 ? `<circle class="glow" cx="100" cy="112" r="94" fill="${GOLD}" opacity=".35"/>` : ''}
    <g transform="translate(100 186) scale(${s}) translate(-100 -186)">
      ${ACC_BACK[acc] ? a : ''}${part(K.back)}${part(K.top)}${feet}
      <clipPath id="${id}">${shape}</clipPath>
      <g fill="${K.fill ? K.fill(c) : c}">${shape}</g>
      <g clip-path="url(#${id})">${part(K.pat)}<ellipse cx="80" cy="${top+22}" rx="18" ry="9" fill="${WHITE}" opacity=".22"/></g>
      ${part(K.mid)}
      ${belly(v, c, by, K.plate)}
      ${eyes(K.eye || 'big', ex, ey)}
      ${K.cheek === false ? '' : mirror(`<ellipse cx="${100-ex-18}" cy="${ey+20}" rx="9" ry="6" fill="#FF8FA3" opacity=".7"/>`)}
      ${mouth(K.mouth, my)}
      ${part(K.front)}${ACC_BACK[acc] ? '' : a}
    </g>
    ${st === 2 ? STAR(172, 46, 9) + STAR(28, 64, 7) : st >= 3 ? STAR(24, 38, 12) + STAR(178, 50, 9) + STAR(174, 166, 11) : ''}
  </svg>`;
}
