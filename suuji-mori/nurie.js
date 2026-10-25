/* Meridian：ぬりえ の 絵（DOM を使わない）
   parts は 下から順に重ねる [ぬる場所のなまえ, タグ, 属性]。おなじ なまえの部分は いっしょに ぬられる（両そで、両くつ など）。
   deco は ぬらない 線や顔（タップを じゃましないよう pointer-events:none で上に重ねる）。 */
const PICTURES = {
  princess: { name: 'おひめさま', w: 300, h: 420,
    parts: [
      ['bg', 'rect', 'x="0" y="0" width="300" height="420"'],
      ['star', 'path', 'd="M42 46 L48 60 L63 61 L51 70 L55 85 L42 77 L29 85 L33 70 L21 61 L36 60Z"'],
      ['star', 'path', 'd="M262 104 L266 114 L277 115 L268 121 L271 132 L262 126 L253 132 L256 121 L247 115 L258 114Z"'],
      ['heart', 'path', 'd="M44 214 C44 204 58 202 60 212 C62 202 76 204 76 214 C76 226 60 234 60 238 C60 234 44 226 44 214Z"'],
      ['heart', 'path', 'd="M232 276 C232 268 243 266 245 274 C247 266 258 268 258 276 C258 286 245 292 245 296 C245 292 232 286 232 276Z"'],
      ['hair', 'path', 'd="M150 42 C96 42 78 86 80 132 C82 178 68 216 90 244 L210 244 C232 216 218 178 220 132 C222 86 204 42 150 42Z"'],
      ['shoes', 'ellipse', 'cx="128" cy="404" rx="16" ry="8"'],
      ['shoes', 'ellipse', 'cx="172" cy="404" rx="16" ry="8"'],
      ['skirt', 'path', 'd="M122 244 C104 296 74 346 60 392 C102 406 198 406 240 392 C226 346 196 296 178 244Z"'],
      ['panel', 'path', 'd="M140 246 C134 296 124 346 118 398 C140 402 160 402 182 398 C176 346 166 296 160 246Z"'],
      ['bow', 'path', 'd="M86 352 C80 340 96 336 100 348 C104 336 120 340 114 352 C120 364 104 368 100 356 C96 368 80 364 86 352Z"'],
      ['bow', 'path', 'd="M186 352 C180 340 196 336 200 348 C204 336 220 340 214 352 C220 364 204 368 200 356 C196 368 180 364 186 352Z"'],
      ['skin', 'path', 'd="M102 210 C96 234 104 254 120 262 C126 262 130 256 126 250 C114 244 110 230 112 214Z"'],
      ['skin', 'path', 'd="M198 210 C204 234 196 254 180 262 C174 262 170 256 174 250 C186 244 190 230 188 214Z"'],
      ['skin', 'path', 'd="M138 158 L162 158 L161 186 L139 186Z"'],
      ['dress', 'path', 'd="M116 184 C128 178 172 178 184 184 L176 238 L124 238Z"'],
      ['belt', 'path', 'd="M123 234 L177 234 L179 248 L121 248Z"'],
      ['sleeve', 'path', 'd="M120 184 C98 178 88 204 100 218 C110 226 120 216 124 204Z"'],
      ['sleeve', 'path', 'd="M180 184 C202 178 212 204 200 218 C190 226 180 216 176 204Z"'],
      ['jewel', 'circle', 'cx="150" cy="196" r="7"'],
      ['skin', 'ellipse', 'cx="150" cy="118" rx="46" ry="48"'],
      ['hair', 'path', 'd="M104 118 C98 76 124 62 150 62 C178 62 204 78 196 118 C186 100 172 92 158 90 C148 104 128 112 104 118Z"'],
      ['crown', 'path', 'd="M116 70 L122 34 L136 54 L150 26 L164 54 L178 34 L184 70 C162 64 138 64 116 70Z"'],
      ['gem', 'circle', 'cx="150" cy="52" r="6"'],
      ['wand', 'path', 'd="M176 256 L222 196 L227 200 L181 260Z"'],
      ['wandstar', 'path', 'd="M226 162 L233 177 L249 178 L237 188 L241 204 L226 195 L211 204 L215 188 L203 178 L219 177Z"'],
    ],
    deco: `<ellipse cx="132" cy="124" rx="6" ry="8" fill="#3B2E3A"/><ellipse cx="168" cy="124" rx="6" ry="8" fill="#3B2E3A"/>
      <circle cx="134" cy="121" r="2.2" fill="#fff"/><circle cx="170" cy="121" r="2.2" fill="#fff"/>
      <ellipse cx="122" cy="140" rx="8" ry="5" fill="#FF8FA3" opacity=".55"/><ellipse cx="178" cy="140" rx="8" ry="5" fill="#FF8FA3" opacity=".55"/>
      <path d="M140 146 Q150 156 160 146" stroke="#3B2E3A" stroke-width="3.5" fill="none" stroke-linecap="round"/>` },
};

/* ---------- おひめさま を 部品から くみたてる ----------
   髪・あたま・ドレス・手にもつ物・背景・顔 を えらんで 1まいの絵にする。
   右手は (180,258) あたり、左手は (120,258) あたり。M = 左右反転（x → 300-x）。 */
const M = 'transform="translate(300 0) scale(-1 1)"';
const flower = (key, cx, cy, r) => [0, 72, 144, 216, 288].map(a => [key, 'circle', `cx="${(cx + Math.cos(a * Math.PI / 180) * r).toFixed(1)}" cy="${(cy + Math.sin(a * Math.PI / 180) * r).toFixed(1)}" r="${(r * .75).toFixed(1)}"`])
  .concat([['flowerC', 'circle', `cx="${cx}" cy="${cy}" r="${(r * .6).toFixed(1)}"`]]);
const starPath = (cx, cy, r) => { const p = []; for (let i = 0; i < 10; i++){ const a = -Math.PI/2 + i * Math.PI/5, rr = i % 2 ? r * .45 : r; p.push(`${(cx + Math.cos(a)*rr).toFixed(1)} ${(cy + Math.sin(a)*rr).toFixed(1)}`); } return `d="M${p.join(' L')}Z"`; };
const heartPath = (cx, cy, s) => `d="M${cx} ${cy + s*.9} C${cx - s*1.2} ${cy + s*.1} ${cx - s} ${cy - s*.9} ${cx} ${cy - s*.3} C${cx + s} ${cy - s*.9} ${cx + s*1.2} ${cy + s*.1} ${cx} ${cy + s*.9}Z"`;
const bowShape = (key, cx, cy, s) => [[key, 'path', `d="M${cx} ${cy} C${cx - s*1.4} ${cy - s} ${cx - s*1.4} ${cy + s} ${cx} ${cy}Z"`],
  [key, 'path', `d="M${cx} ${cy} C${cx + s*1.4} ${cy - s} ${cx + s*1.4} ${cy + s} ${cx} ${cy}Z"`], [key, 'circle', `cx="${cx}" cy="${cy}" r="${s*.32}"`]];

const SKIN = [
  ['skin', 'path', 'd="M102 210 C96 234 104 254 120 262 C126 262 130 256 126 250 C114 244 110 230 112 214Z"'],
  ['skin', 'path', 'd="M198 210 C204 234 196 254 180 262 C174 262 170 256 174 250 C186 244 190 230 188 214Z"'],
  ['skin', 'path', 'd="M138 158 L162 158 L161 186 L139 186Z"'],
];
const FACE_SKIN = [['skin', 'ellipse', 'cx="150" cy="118" rx="46" ry="48"']];
const CHEEK = '<ellipse cx="122" cy="140" rx="8" ry="5" fill="#FF8FA3" opacity=".55"/><ellipse cx="178" cy="140" rx="8" ry="5" fill="#FF8FA3" opacity=".55"/>';
const DOT_EYE = (x) => `<ellipse cx="${x}" cy="124" rx="6" ry="8" fill="#3B2E3A"/><circle cx="${x + 2}" cy="121" r="2.2" fill="#fff"/>`;
const ARC_EYE = (x) => `<path d="M${x - 8} 126 Q${x} 116 ${x + 8} 126" stroke="#3B2E3A" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
const FACES = {
  smile: DOT_EYE(132) + DOT_EYE(168) + CHEEK + '<path d="M140 146 Q150 156 160 146" stroke="#3B2E3A" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
  happy: ARC_EYE(132) + ARC_EYE(168) + CHEEK + '<path d="M138 143 Q150 160 162 143Z" fill="#E86A7E" stroke="#3B2E3A" stroke-width="3" stroke-linejoin="round"/>',
  wink: DOT_EYE(132) + ARC_EYE(168) + CHEEK + '<path d="M140 146 Q150 156 160 146" stroke="#3B2E3A" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
};
const BANGS = {
  straight: ['hair', 'path', 'd="M104 118 C98 76 124 62 150 62 C178 62 204 78 196 118 C186 100 172 92 158 90 C148 104 128 112 104 118Z"'],
  side: ['hair', 'path', 'd="M104 118 C96 74 128 60 156 62 C186 64 206 84 196 118 C190 96 168 82 136 86 C122 96 112 106 104 118Z"'],
  part: ['hair', 'path', 'd="M104 118 C100 74 126 62 150 66 C174 62 200 74 196 118 C186 92 168 80 150 82 C132 80 114 92 104 118Z"'],
};
const BOB = ['hair', 'path', 'd="M150 46 C100 46 82 86 86 130 C88 158 96 172 110 174 L190 174 C204 172 212 158 214 130 C218 86 200 46 150 46Z"'];
// 髪：back は 体の後ろ、over は 肩より前（三つ編み など）
const HAIRS = {
  long: { back: [['hair', 'path', 'd="M150 42 C96 42 78 86 80 132 C82 178 68 216 90 244 L210 244 C232 216 218 178 220 132 C222 86 204 42 150 42Z"']] },
  wavy: { back: [['hair', 'path', 'd="M150 42 C96 42 78 86 80 132 C82 178 66 216 84 250 Q96 238 106 252 Q118 240 128 250 L172 250 Q182 240 194 252 Q204 238 216 250 C234 216 218 178 220 132 C222 86 204 42 150 42Z"']] },
  bob: { back: [BOB] },
  buns: { back: [['hair', 'circle', 'cx="104" cy="70" r="24"'], ['hair', 'circle', 'cx="196" cy="70" r="24"'], BOB] },
  // ポニーテールは 左がわ（右手に もつ物と かさならないように）
  ponytail: { back: [['hair', 'path', `d="M190 70 C232 62 248 112 238 162 C232 192 216 214 208 236 C202 202 214 172 210 142 C206 114 198 98 186 90Z" ${M}`], BOB],
    over: bowShape('ribbon', 108, 78, 14) },
  twintails: { back: [['hair', 'path', 'd="M106 82 C70 84 58 132 62 182 C64 212 72 232 82 248 C86 220 84 190 92 160 C98 130 106 112 114 98Z"'],
      ['hair', 'path', `d="M106 82 C70 84 58 132 62 182 C64 212 72 232 82 248 C86 220 84 190 92 160 C98 130 106 112 114 98Z" ${M}`], BOB],
    over: [['ribbon', 'circle', 'cx="108" cy="90" r="9"'], ['ribbon', 'circle', 'cx="192" cy="90" r="9"']] },
  braid: { back: [BOB],
    over: [['hair', 'ellipse', 'cx="110" cy="182" rx="13" ry="14"'], ['hair', 'ellipse', 'cx="106" cy="206" rx="13" ry="14"'], ['hair', 'ellipse', 'cx="104" cy="230" rx="12" ry="14"'],
      ['hair', 'path', 'd="M104 244 C96 258 98 270 104 276 C110 270 112 258 104 244Z"'], ...bowShape('ribbon', 104, 246, 10)] },
};
const TIARA = ['crown', 'path', 'd="M116 78 C126 54 174 54 184 78 C170 70 130 70 116 78Z"'];
const HEADS = {
  crown: [['crown', 'path', 'd="M116 70 L122 34 L136 54 L150 26 L164 54 L178 34 L184 70 C162 64 138 64 116 70Z"'], ['gem', 'circle', 'cx="150" cy="52" r="6"']],
  tiara: [TIARA, ['gem', 'circle', 'cx="132" cy="66" r="4"'], ['gem', 'circle', 'cx="168" cy="66" r="4"'], ['gem', 'circle', 'cx="150" cy="58" r="6"']],
  startiara: [TIARA, ['gem', 'path', starPath(150, 52, 13)]],
  snowtiara: [TIARA, ['gem', 'path', starPath(132, 64, 7)], ['gem', 'path', starPath(168, 64, 7)], ['gem', 'path', starPath(150, 54, 11)]],
  shell: [['shell', 'path', 'd="M128 76 C126 46 174 46 172 76 C160 70 140 70 128 76Z"'], ['pearl', 'circle', 'cx="150" cy="76" r="5"']],
  flowers: [...flower('petal', 112, 86, 8), ...flower('petal', 128, 68, 8), ...flower('petal', 150, 60, 9), ...flower('petal', 172, 68, 8), ...flower('petal', 188, 86, 8)],
  bow: [...bowShape('bow', 182, 66, 18), ['crown', 'path', 'd="M122 74 L128 52 L138 64 L146 48 L154 64 Z"']],
  hennin: [['veil', 'path', 'd="M152 6 C204 30 236 96 240 176 C216 130 192 96 168 66Z"'], ['hat', 'path', 'd="M120 74 L152 2 L182 74Z"'], ['band', 'path', 'd="M118 64 L184 64 L186 76 L116 76Z"']],
};
const SHOES = [['shoes', 'ellipse', 'cx="128" cy="404" rx="16" ry="8"'], ['shoes', 'ellipse', 'cx="172" cy="404" rx="16" ry="8"']];
const GOWN = ['skirt', 'path', 'd="M122 244 C104 296 74 346 60 392 C102 406 198 406 240 392 C226 346 196 296 178 244Z"'];
const TOP = [['dress', 'path', 'd="M116 184 C128 178 172 178 184 184 L176 238 L124 238Z"'], ['belt', 'path', 'd="M123 234 L177 234 L179 248 L121 248Z"']];
const SLEEVES = [['sleeve', 'path', 'd="M120 184 C98 178 88 204 100 218 C110 226 120 216 124 204Z"'], ['sleeve', 'path', 'd="M180 184 C202 178 212 204 200 218 C190 226 180 216 176 204Z"']];
// ドレス：under は 腕より後ろ（スカート など）、top は 胴とそで
const DRESSES = {
  gown: { under: [...SHOES, GOWN, ['panel', 'path', 'd="M140 246 C134 296 124 346 118 398 C140 402 160 402 182 398 C176 346 166 296 160 246Z"'],
    ...bowShape('bow2', 100, 352, 13), ...bowShape('bow2', 200, 352, 13)] },
  dots: { under: [...SHOES, GOWN, ...[[110, 330], [150, 300], [190, 330], [96, 376], [138, 362], [168, 382], [208, 372]].map(([x, y]) => ['dots', 'circle', `cx="${x}" cy="${y}" r="9"`])] },
  tiers: { under: [...SHOES,
    ['tier3', 'path', 'd="M74 352 C68 372 62 386 58 396 C110 408 190 408 242 396 C238 386 232 372 226 352 C180 366 120 366 74 352Z"'],
    ['tier2', 'path', 'd="M96 298 C88 322 80 342 72 356 C120 370 180 370 228 356 C220 342 212 322 204 298 C170 310 130 310 96 298Z"'],
    ['tier1', 'path', 'd="M122 244 C114 268 104 288 94 302 C130 314 170 314 206 302 C196 288 186 268 178 244Z"']] },
  mermaid: { under: [['fin', 'path', 'd="M134 350 C112 370 92 390 76 404 C118 412 182 412 224 404 C208 390 188 370 166 350Z"'],
    ['skirt', 'path', 'd="M122 244 C114 290 118 330 134 358 L166 358 C182 330 186 290 178 244Z"']],
    deco: '<path d="M134 286 Q142 296 150 286 Q158 296 166 286 M130 312 Q140 322 150 312 Q160 322 170 312 M134 338 Q142 348 150 338 Q158 348 166 338" stroke="#4A3B47" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>' },
  tutu: { under: [['skin', 'path', 'd="M130 290 L143 290 L143 384 L130 384Z"'], ['skin', 'path', 'd="M157 290 L170 290 L170 384 L157 384Z"'],
    ['shoes', 'ellipse', 'cx="134" cy="390" rx="17" ry="9"'], ['shoes', 'ellipse', 'cx="166" cy="390" rx="17" ry="9"'],
    ['skirt', 'path', 'd="M120 244 C98 258 82 278 76 294 C90 304 100 296 110 304 C120 296 130 308 140 300 C150 308 160 296 170 304 C180 296 190 306 200 298 C210 304 216 300 224 294 C218 278 202 258 180 244Z"'],
    ...[[112, 278], [150, 270], [188, 278], [130, 292], [170, 292]].map(([x, y]) => ['dots', 'circle', `cx="${x}" cy="${y}" r="6"`])] },
  cape: { under: [['cape', 'path', 'd="M116 186 C96 262 72 340 52 404 L248 404 C228 340 204 262 184 186Z"'], ...SHOES, GOWN,
    ['panel', 'path', 'd="M140 246 C134 296 124 346 118 398 C140 402 160 402 182 398 C176 346 166 296 160 246Z"']] },
};
// 右手に もつ物（腕の上に重ねる）
const HANDS = {
  wand: [['wand', 'path', 'd="M176 256 L222 196 L227 200 L181 260Z"'], ['wandstar', 'path', starPath(226, 186, 22)]],
  bouquet: [...flower('petal2', 196, 222, 9), ...flower('petal2', 216, 236, 8), ...flower('petal2', 210, 210, 7),
    ['wrap', 'path', 'd="M170 266 L188 230 L214 248Z"']],
  balloon: [['balloon', 'path', heartPath(226, 138, 30)]],
  fan: [['fan', 'path', 'd="M180 258 L162 214 C176 196 206 196 222 214Z"']],
  parasol: [['handle', 'path', 'd="M214 150 L219 151 L184 260 L179 258Z"'],
    ['parasol', 'path', 'd="M168 152 C182 112 250 112 266 152 C256 144 246 144 238 152 C230 144 218 144 212 152 C204 144 192 144 184 152 C178 146 172 146 168 152Z"']],
  lollipop: [['stick', 'path', 'd="M180 258 L208 200 L213 202 L185 260Z"'], ['candy', 'circle', 'cx="212" cy="190" r="22"']],
  none: [],
};
const HANDS_DECO = {
  balloon: '<path d="M226 168 C218 200 196 230 182 256" stroke="#4A3B47" stroke-width="2.5" fill="none"/>',
  fan: '<path d="M180 258 L172 206 M180 258 L190 200 M180 258 L208 204" stroke="#4A3B47" stroke-width="2" fill="none" opacity=".6"/>',
  lollipop: '<path d="M212 172 C228 176 230 196 214 200 C202 202 198 188 210 186" stroke="#4A3B47" stroke-width="2.5" fill="none" opacity=".6"/>',
};
// 背景：back は いちばん後ろ、front は いちばん前（足もとの ねこ など）
const BGS = {
  stars: { back: [['star', 'path', starPath(42, 64, 22)], ['star', 'path', starPath(262, 118, 16)], ['heart', 'path', heartPath(60, 218, 18)], ['heart', 'path', heartPath(245, 282, 14)]] },
  night: { back: [['moon', 'path', 'd="M70 26 A34 34 0 1 0 70 94 A27 27 0 1 1 70 26Z"'], ['star', 'path', starPath(250, 52, 16)], ['star', 'path', starPath(270, 160, 11)],
    ['star', 'path', starPath(34, 200, 12)], ['star', 'path', starPath(256, 252, 13)], ['star', 'path', starPath(40, 300, 10)]] },
  sea: { back: [['wave', 'path', 'd="M0 360 Q25 348 50 360 T100 360 T150 360 T200 360 T250 360 T300 360 L300 420 L0 420Z"'],
    ...[[40, 60, 12], [262, 90, 9], [30, 180, 8], [270, 220, 13], [52, 260, 7]].map(([x, y, r]) => ['bubble', 'circle', `cx="${x}" cy="${y}" r="${r}"`]),
    ['fish', 'path', 'd="M232 300 C244 288 266 288 274 300 C266 312 244 312 232 300Z M274 300 L288 290 L288 310Z"'],
    ['fish', 'path', 'd="M24 120 C36 108 58 108 66 120 C58 132 36 132 24 120Z M24 120 L10 110 L10 130Z"']] },
  snow: { back: [...[[40, 50, 16], [262, 70, 12], [30, 170, 11], [272, 190, 15], [44, 290, 13], [258, 300, 10]].map(([x, y, r]) => ['snow', 'path', starPath(x, y, r)])] },
  castle: { back: [['castle', 'path', 'd="M10 180 L58 180 L58 250 L242 250 L242 180 L290 180 L290 320 L10 320Z"'],
    ['roof', 'path', 'd="M4 182 L34 120 L64 182Z"'], ['roof', 'path', 'd="M236 182 L266 120 L296 182Z"'],
    ['flag', 'path', 'd="M34 120 L34 92 L56 100 L34 108"'], ['flag', 'path', 'd="M266 120 L266 92 L288 100 L266 108"']],
    deco: '<path d="M22 210 L22 230 M46 210 L46 230 M254 210 L254 230 M278 210 L278 230" stroke="#4A3B47" stroke-width="5" stroke-linecap="round"/>' },
  hearts: { back: [['heart', 'path', heartPath(44, 60, 20)], ['heart', 'path', heartPath(262, 82, 14)], ['heart', 'path', heartPath(36, 200, 14)],
    ['heart', 'path', heartPath(266, 236, 18)], ['heart', 'path', heartPath(48, 320, 16)], ['heart', 'path', heartPath(258, 340, 12)]] },
  rainbow: { back: [['rb1', 'path', 'd="M8 236 A142 142 0 0 1 292 236 L274 236 A124 124 0 0 0 26 236Z"'], ['rb2', 'path', 'd="M26 236 A124 124 0 0 1 274 236 L256 236 A106 106 0 0 0 44 236Z"'],
    ['rb3', 'path', 'd="M44 236 A106 106 0 0 1 256 236 L238 236 A88 88 0 0 0 62 236Z"'],
    ['cloud', 'path', 'd="M4 246 C0 226 22 218 32 228 C40 214 64 220 62 238 C76 238 76 256 62 258 L10 258 C0 258 -2 248 4 246Z"'],
    ['cloud', 'path', `d="M4 246 C0 226 22 218 32 228 C40 214 64 220 62 238 C76 238 76 256 62 258 L10 258 C0 258 -2 248 4 246Z" ${M}`]] },
  garden: { back: [['grass', 'path', 'd="M0 372 C60 352 110 366 150 374 C192 364 248 352 300 370 L300 420 L0 420Z"'],
    ...flower('petal3', 36, 360, 10), ...flower('petal3', 266, 354, 10), ...flower('petal3', 24, 300, 7), ...flower('petal3', 278, 296, 7)] },
  butterfly: { back: [['grass', 'path', 'd="M0 372 C60 352 110 366 150 374 C192 364 248 352 300 370 L300 420 L0 420Z"'],
    ['butterfly', 'path', 'd="M46 70 C26 50 18 82 44 80 C20 92 34 110 48 84 C52 110 70 92 52 80 C78 82 68 50 50 70Z"'],
    ['butterfly', 'path', 'd="M256 150 C238 132 230 160 254 158 C232 170 246 186 258 162 C262 186 278 170 262 158 C284 160 276 132 260 150Z"']] },
  sweets: { back: [...[[44, 66, 0], [262, 112, 1], [36, 236, 1], [264, 290, 0]].map(([x, y, k]) => k
      ? ['candy2', 'path', `d="M${x - 14} ${y} C${x - 14} ${y - 12} ${x + 14} ${y - 12} ${x + 14} ${y} C${x + 14} ${y + 12} ${x - 14} ${y + 12} ${x - 14} ${y}Z M${x - 14} ${y} L${x - 26} ${y - 9} L${x - 26} ${y + 9}Z M${x + 14} ${y} L${x + 26} ${y - 9} L${x + 26} ${y + 9}Z"`]
      : ['donut', 'path', `d="M${x - 18} ${y} A18 18 0 1 0 ${x + 18} ${y} A18 18 0 1 0 ${x - 18} ${y}Z M${x - 6} ${y} A6 6 0 1 1 ${x + 6} ${y} A6 6 0 1 1 ${x - 6} ${y}Z" fill-rule="evenodd"`])] },
};
// 足もと・前に くるもの
const PETS = {
  cat: { parts: [['cat', 'path', 'd="M40 404 C30 370 38 344 60 340 C82 344 92 370 84 404Z"'], ['cat', 'path', 'd="M84 396 C104 398 110 380 100 368"'],
    ['cat', 'circle', 'cx="62" cy="328" r="22"'], ['cat', 'path', 'd="M44 318 L46 296 L60 310Z"'], ['cat', 'path', 'd="M80 318 L78 296 L64 310Z"']],
    deco: '<circle cx="55" cy="326" r="3" fill="#3B2E3A"/><circle cx="69" cy="326" r="3" fill="#3B2E3A"/><path d="M58 334 Q62 338 66 334" stroke="#3B2E3A" stroke-width="2" fill="none" stroke-linecap="round"/>' },
  wings: { parts: [['wings', 'path', 'd="M120 196 C70 140 26 180 56 226 C26 262 70 300 122 252Z"'], ['wings', 'path', `d="M120 196 C70 140 26 180 56 226 C26 262 70 300 122 252Z" ${M}`]] },
};

// 1まいの絵：{ name, short（一覧に出す みじかい なまえ）, say, hair, bangs, head, dress, hand, bg, face, pet }
function princess({ name, short, say, hair, bangs = 'straight', head, dress, hand = 'none', bg, face = 'smile', pet }){
  const H = HAIRS[hair], D = DRESSES[dress], B = BGS[bg], P = pet && PETS[pet];
  const wings = P && pet === 'wings' ? P.parts : [], front = P && pet !== 'wings' ? P.parts : [];
  return { name, short, say, w: 300, h: 420,
    parts: [['bg', 'rect', 'x="0" y="0" width="300" height="420"'], ...B.back, ...wings, ...H.back, ...D.under, ...SKIN, ...TOP, ...SLEEVES,
      ['jewel', 'circle', 'cx="150" cy="196" r="7"'], ...(H.over || []), ...HANDS[hand], ...FACE_SKIN, BANGS[bangs], ...HEADS[head], ...front],
    deco: (B.deco || '') + (D.deco || '') + (HANDS_DECO[hand] || '') + FACES[face] + (P && P.deco || '') };
}
Object.assign(PICTURES, {
  hana:    princess({ name: 'はなの おひめさま', short: 'はな', say: '花のお姫様', hair: 'braid', bangs: 'side', head: 'flowers', dress: 'tiers', hand: 'bouquet', bg: 'garden', face: 'happy' }),
  hoshi:   princess({ name: 'ほしの おひめさま', short: 'ほし', say: '星のお姫様', hair: 'buns', head: 'startiara', dress: 'dots', hand: 'wand', bg: 'night' }),
  umi:     princess({ name: 'うみの おひめさま', short: 'うみ', say: '海のお姫様', hair: 'wavy', bangs: 'part', head: 'shell', dress: 'mermaid', bg: 'sea', face: 'wink' }),
  yuki:    princess({ name: 'ゆきの おひめさま', short: 'ゆき', say: '雪のお姫様', hair: 'long', bangs: 'side', head: 'snowtiara', dress: 'cape', hand: 'wand', bg: 'snow' }),
  oshiro:  princess({ name: 'おしろの おひめさま', short: 'おしろ', say: 'お城のお姫様', hair: 'bob', head: 'hennin', dress: 'gown', hand: 'fan', bg: 'castle', face: 'happy' }),
  heart:   princess({ name: 'ハートの おひめさま', short: 'ハート', say: 'ハートのお姫様', hair: 'ponytail', head: 'tiara', dress: 'tutu', hand: 'balloon', bg: 'hearts' }),
  niji:    princess({ name: 'にじの おひめさま', short: 'にじ', say: '虹のお姫様', hair: 'twintails', head: 'crown', dress: 'tiers', hand: 'wand', bg: 'rainbow', face: 'happy' }),
  neko:    princess({ name: 'ねこと おひめさま', short: 'ねこ', say: '猫とお姫様', hair: 'bob', bangs: 'part', head: 'crown', dress: 'dots', hand: 'parasol', bg: 'stars', pet: 'cat' }),
  okashi:  princess({ name: 'おかしの おひめさま', short: 'おかし', say: 'お菓子のお姫様', hair: 'buns', bangs: 'side', head: 'bow', dress: 'tutu', hand: 'lollipop', bg: 'sweets', face: 'wink' }),
  chou:    princess({ name: 'ちょうちょの おひめさま', short: 'ちょうちょ', say: '蝶々のお姫様', hair: 'long', bangs: 'part', head: 'flowers', dress: 'gown', hand: 'wand', bg: 'butterfly', face: 'happy', pet: 'wings' }),
});
PICTURES.princess.say = 'お姫様';

/* ---------- かわいい どうぶつ ----------
   背景は おひめさまと おなじ BGS から えらぶ。parts は 背景の上に 下から順に重ねる。 */
const EYE = (x, y, r = 8) => `<ellipse cx="${x}" cy="${y}" rx="${r * .85}" ry="${r}" fill="#3B2E3A"/><circle cx="${x + r * .3}" cy="${y - r * .35}" r="${r * .32}" fill="#fff"/>`;
const BLUSH = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="5.5" fill="#FF8FA3" opacity=".55"/>`;
const INK = (d, w = 3) => `<path d="${d}" stroke="#3B2E3A" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const leg = (x) => [['body', 'path', `d="M${x} 296 L${x + 22} 296 L${x + 22} 366 L${x} 366Z"`],
  ['hoof', 'path', `d="M${x - 2} 364 L${x + 24} 364 L${x + 24} 380 C${x + 24} 386 ${x - 2} 386 ${x - 2} 380Z"`]];
// 1まいの絵：{ name, say, done（できた！ すてきな ○○！ の [ふきだし, 読み上げ]）, bg, parts, deco, dy（どうぶつを 下に ずらす）}
function animal({ name, say, done, bg, parts, deco, dy = 0 }){
  const B = BGS[bg], down = dy ? ` transform="translate(0 ${dy})"` : '';
  return { name, say, done, w: 300, h: 420,
    parts: [['bg', 'rect', 'x="0" y="0" width="300" height="420"'], ...B.back, ...parts.map(([k, tag, a]) => [k, tag, a + down])],
    deco: (B.deco || '') + `<g${down}>${deco}</g>` };
}
Object.assign(PICTURES, {
  unicorn: animal({ name: 'ユニコーン', say: 'ユニコーン', done: ['ユニコーン', 'ユニコーン'], bg: 'rainbow', dy: 26,
    parts: [['tail', 'path', 'd="M226 268 C262 246 290 278 272 312 C290 330 278 370 248 364 C262 342 244 324 254 306 C240 298 234 286 226 282Z"'],
      ...leg(186), ...leg(210), ...leg(104), ...leg(130),
      ['body', 'ellipse', 'cx="166" cy="286" rx="72" ry="46"'],
      ['body', 'path', 'd="M92 214 C96 248 110 280 136 298 L176 264 C154 246 136 222 130 196Z"'],
      ['body', 'path', 'd="M112 166 L130 128 L136 172Z"'],
      ['body', 'ellipse', 'cx="98" cy="196" rx="46" ry="42"'],
      ['muzzle', 'ellipse', 'cx="66" cy="216" rx="30" ry="24"'],
      ['mane', 'path', 'd="M108 154 C140 146 160 170 156 190 C176 204 180 226 170 238 C190 248 194 266 182 278 L172 268 C158 250 140 226 130 204 C126 184 120 170 108 166Z"'],
      ['mane', 'path', 'd="M106 160 C86 148 70 160 70 178 C82 168 94 168 104 174Z"'],
      ['horn', 'path', 'd="M86 162 L94 88 L112 158Z"']],
    deco: INK('M91 140 L107 136 M89 122 L104 116 M92 104 L101 100', 2.5)
      + INK('M80 190 Q90 200 100 190') + INK('M82 190 L76 184 M90 194 L88 186 M98 190 L102 184', 2.5)
      + '<ellipse cx="52" cy="212" rx="3.5" ry="4.5" fill="#3B2E3A"/>' + INK('M54 230 Q64 236 74 230') + BLUSH(104, 214) }),
  nekochan: animal({ name: 'ねこちゃん', say: '猫ちゃん', done: ['ねこちゃん', '猫ちゃん'], bg: 'hearts',
    parts: [['body', 'path', 'd="M200 372 C252 368 266 320 250 290 C242 274 254 262 264 270 C280 284 276 340 248 364 C234 378 212 384 196 384Z"'],
      ['body', 'path', 'd="M110 258 C88 300 84 360 96 392 L204 392 C216 360 212 300 190 258Z"'],
      ['belly', 'ellipse', 'cx="150" cy="340" rx="34" ry="44"'],
      ['body', 'ellipse', 'cx="126" cy="390" rx="20" ry="12"'], ['body', 'ellipse', 'cx="174" cy="390" rx="20" ry="12"'],
      ['body', 'path', 'd="M82 150 L86 72 L140 114Z"'], ['body', 'path', `d="M82 150 L86 72 L140 114Z" ${M}`],
      ['earin', 'path', 'd="M93 134 L95 92 L124 115Z"'], ['earin', 'path', `d="M93 134 L95 92 L124 115Z" ${M}`],
      ['body', 'ellipse', 'cx="150" cy="180" rx="78" ry="66"'],
      ['collar', 'path', 'd="M106 236 C134 252 166 252 194 236 L196 252 C166 268 134 268 104 252Z"'],
      ['bell', 'circle', 'cx="150" cy="266" r="11"'],
      ['yarn', 'circle', 'cx="246" cy="384" r="24"']],
    deco: INK('M150 120 L150 136 M134 124 L137 138 M166 124 L163 138', 3.5) + EYE(120, 180, 10) + EYE(180, 180, 10)
      + '<path d="M144 198 L156 198 L150 205Z" fill="#E86A7E"/>' + INK('M150 205 L150 210 M138 210 Q144 218 150 210 Q156 218 162 210')
      + INK('M84 196 L112 200 M86 212 L112 208 M216 196 L188 200 M214 212 L188 208', 2.5) + BLUSH(110, 216) + BLUSH(190, 216)
      + INK('M226 376 Q246 360 266 380 M228 392 Q248 376 264 396 M236 364 Q250 384 240 404', 2.5) + INK('M146 268 L154 268', 2.5) }),
  usagi: animal({ name: 'うさぎ', say: 'うさぎ', done: ['うさぎさん', 'うさぎさん'], bg: 'garden',
    parts: [['fur', 'path', 'd="M110 150 C88 110 92 38 114 28 C138 24 144 100 138 150Z"'], ['fur', 'path', `d="M110 150 C88 110 92 38 114 28 C138 24 144 100 138 150Z" ${M}`],
      ['earin', 'path', 'd="M114 138 C102 108 104 56 116 44 C130 46 132 104 130 138Z"'], ['earin', 'path', `d="M114 138 C102 108 104 56 116 44 C130 46 132 104 130 138Z" ${M}`],
      ['fur', 'ellipse', 'cx="150" cy="318" rx="72" ry="66"'],
      ['belly', 'ellipse', 'cx="150" cy="328" rx="42" ry="46"'],
      ['fur', 'ellipse', 'cx="110" cy="382" rx="30" ry="15"'], ['fur', 'ellipse', 'cx="190" cy="382" rx="30" ry="15"'],
      ['fur', 'ellipse', 'cx="150" cy="190" rx="72" ry="60"'],
      ['leaf', 'path', 'd="M146 258 C134 238 138 226 147 230 C151 240 151 250 150 258Z"'], ['leaf', 'path', 'd="M152 258 C158 238 170 232 174 240 C166 248 160 254 156 260Z"'],
      ['carrot', 'path', 'd="M136 264 C136 252 164 252 164 264 L154 334 C153 340 147 340 146 334Z"'],
      ['fur', 'ellipse', 'cx="132" cy="284" rx="15" ry="13"'], ['fur', 'ellipse', 'cx="168" cy="284" rx="15" ry="13"']],
    deco: EYE(124, 190, 10) + EYE(176, 190, 10) + '<ellipse cx="150" cy="208" rx="6" ry="4.5" fill="#E86A7E"/>'
      + INK('M150 212 L150 218 M140 222 Q146 228 150 218 Q154 228 160 222') + BLUSH(106, 214) + BLUSH(194, 214)
      + INK('M144 290 L150 292 M148 308 L154 306', 2.5) }),
  wanko: animal({ name: 'わんちゃん', say: 'ワンちゃん', done: ['わんちゃん', 'ワンちゃん'], bg: 'butterfly',
    parts: [['fur', 'path', 'd="M196 330 C232 318 244 286 236 270 C252 280 250 330 206 352Z"'],
      ['fur', 'path', 'd="M108 262 C88 300 86 360 96 392 L204 392 C214 360 212 300 192 262Z"'],
      ['belly', 'ellipse', 'cx="150" cy="340" rx="34" ry="44"'],
      ['fur', 'ellipse', 'cx="126" cy="390" rx="20" ry="12"'], ['fur', 'ellipse', 'cx="174" cy="390" rx="20" ry="12"'],
      ['fur', 'ellipse', 'cx="150" cy="180" rx="72" ry="62"'],
      ['spot', 'ellipse', 'cx="176" cy="164" rx="24" ry="22"'],
      ['muzzle', 'ellipse', 'cx="150" cy="210" rx="36" ry="26"'],
      ['ear', 'path', 'd="M90 132 C60 130 46 184 58 222 C66 244 90 238 98 214 C104 188 106 148 90 132Z"'], ['ear', 'path', `d="M90 132 C60 130 46 184 58 222 C66 244 90 238 98 214 C104 188 106 148 90 132Z" ${M}`],
      ['collar', 'path', 'd="M108 238 C134 252 166 252 192 238 L194 254 C166 268 134 268 106 254Z"'],
      ['tag', 'path', heartPath(150, 270, 11)]],
    deco: EYE(124, 168, 10) + EYE(176, 168, 10) + '<ellipse cx="150" cy="200" rx="11" ry="8" fill="#3B2E3A"/><ellipse cx="147" cy="197" rx="3.5" ry="2" fill="#fff"/>'
      + '<path d="M144 218 Q150 236 156 218Z" fill="#FF8FA3" stroke="#3B2E3A" stroke-width="2.5" stroke-linejoin="round"/>'
      + INK('M150 208 L150 216 M136 214 Q143 222 150 216 Q157 222 164 214') + BLUSH(112, 200) + BLUSH(188, 200) }),
  kuma: animal({ name: 'くまさん', say: 'くまさん', done: ['くまさん', 'くまさん'], bg: 'stars',
    parts: [['balloon', 'path', heartPath(244, 76, 30)],
      ['fur', 'circle', 'cx="90" cy="120" r="28"'], ['fur', 'circle', 'cx="210" cy="120" r="28"'],
      ['earin', 'circle', 'cx="90" cy="120" r="15"'], ['earin', 'circle', 'cx="210" cy="120" r="15"'],
      ['fur', 'ellipse', 'cx="150" cy="318" rx="74" ry="70"'],
      ['belly', 'ellipse', 'cx="150" cy="330" rx="44" ry="48"'],
      ['fur', 'ellipse', 'cx="106" cy="382" rx="28" ry="20"'], ['fur', 'ellipse', 'cx="194" cy="382" rx="28" ry="20"'],
      ['pad', 'ellipse', 'cx="106" cy="384" rx="15" ry="11"'], ['pad', 'ellipse', 'cx="194" cy="384" rx="15" ry="11"'],
      ['fur', 'ellipse', 'cx="88" cy="300" rx="18" ry="30"'], ['fur', 'ellipse', 'cx="214" cy="282" rx="18" ry="28"'],
      ['fur', 'ellipse', 'cx="150" cy="182" rx="76" ry="66"'],
      ['muzzle', 'ellipse', 'cx="150" cy="210" rx="32" ry="24"'],
      ...bowShape('ribbon', 150, 254, 16)],
    deco: INK('M244 103 C254 160 244 220 220 262', 2.5) + EYE(122, 174, 9) + EYE(178, 174, 9)
      + '<ellipse cx="150" cy="200" rx="11" ry="8" fill="#3B2E3A"/><ellipse cx="147" cy="197" rx="3.5" ry="2" fill="#fff"/>'
      + INK('M150 208 L150 216 M140 218 Q150 226 160 218') + BLUSH(104, 198) + BLUSH(196, 198) }),
  hamu: animal({ name: 'ハムスター', say: 'ハムスター', done: ['ハムスター', 'ハムスター'], bg: 'sweets',
    parts: [['fur', 'circle', 'cx="94" cy="142" r="22"'], ['fur', 'circle', 'cx="206" cy="142" r="22"'],
      ['earin', 'circle', 'cx="94" cy="142" r="12"'], ['earin', 'circle', 'cx="206" cy="142" r="12"'],
      ['feet', 'ellipse', 'cx="116" cy="372" rx="22" ry="11"'], ['feet', 'ellipse', 'cx="184" cy="372" rx="22" ry="11"'],
      ['fur', 'path', 'd="M150 122 C86 122 60 182 62 250 C64 320 94 368 150 368 C206 368 236 320 238 250 C240 182 214 122 150 122Z"'],
      ['belly', 'path', 'd="M150 214 C110 214 96 260 100 300 C104 338 124 358 150 358 C176 358 196 338 200 300 C204 260 190 214 150 214Z"'],
      ['puff', 'ellipse', 'cx="98" cy="218" rx="24" ry="18"'], ['puff', 'ellipse', 'cx="202" cy="218" rx="24" ry="18"'],
      ['berry', 'path', 'd="M128 268 C128 254 172 254 172 268 C172 294 158 312 150 314 C142 312 128 294 128 268Z"'],
      ['leaf', 'path', 'd="M134 262 L142 248 L150 258 L158 248 L166 262Z"'],
      ['fur', 'ellipse', 'cx="126" cy="282" rx="13" ry="11"'], ['fur', 'ellipse', 'cx="174" cy="282" rx="13" ry="11"']],
    deco: EYE(124, 184, 9) + EYE(176, 184, 9) + '<ellipse cx="150" cy="202" rx="6" ry="4.5" fill="#E86A7E"/>'
      + INK('M150 206 L150 211 M141 214 Q146 220 150 211 Q154 220 159 214') + BLUSH(98, 218) + BLUSH(202, 218)
      + [[142, 276], [158, 276], [150, 290], [142, 302], [158, 302]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.8" ry="2.6" fill="#4A3B47"/>`).join('') }),
  pengin: animal({ name: 'ペンギン', say: 'ペンギン', done: ['ペンギン', 'ペンギン'], bg: 'snow',
    parts: [['body', 'path', 'd="M70 208 C32 234 16 290 28 322 C46 316 64 292 76 262Z"'], ['body', 'path', `d="M70 208 C32 234 16 290 28 322 C46 316 64 292 76 262Z" ${M}`],
      ['body', 'ellipse', 'cx="150" cy="250" rx="90" ry="130"'],
      ['belly', 'path', 'd="M150 132 C112 132 92 162 100 196 C82 230 80 300 98 340 C116 372 184 372 202 340 C220 300 218 230 200 196 C208 162 188 132 150 132Z"'],
      ['feet', 'ellipse', 'cx="118" cy="384" rx="26" ry="12"'], ['feet', 'ellipse', 'cx="182" cy="384" rx="26" ry="12"'],
      ['scarf', 'path', 'd="M178 252 L198 318 L176 324 L162 260Z"'],
      ['scarf', 'path', 'd="M94 234 C128 252 172 252 206 234 L210 254 C172 274 128 274 90 254Z"'],
      ['beak', 'path', 'd="M136 204 L164 204 L150 222Z"'],
      ['hat', 'path', 'd="M100 104 C108 52 192 52 200 104Z"'], ['pompom', 'circle', 'cx="150" cy="54" r="15"'],
      ['band', 'path', 'd="M94 98 C130 90 170 90 206 98 L206 116 C170 108 130 108 94 116Z"']],
    deco: EYE(126, 184, 10) + EYE(174, 184, 10) + BLUSH(110, 210) + BLUSH(190, 210) + INK('M180 312 L184 324 M188 310 L192 322', 2.5) }),
});
