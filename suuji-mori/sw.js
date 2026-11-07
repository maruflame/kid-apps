/* Meridian：オフラインで あそべるようにする Service Worker
   ・アプリ本体（html / js / css / 絵）：ネットを先に見て、つながらない・おそいときは 保存しておいた ものを使う
     （なおした アプリが すぐ とどくように。ばんごうを 手で上げなくてよい）
   ・読み上げ音声（voice/*.m4a）と フォント：保存してあれば それを使い、なければ とってきて 保存する
   ・iPhone の Safari は <audio> を「Range（とちゅうから）」で とりにくるので、保存した音声から 206 を つくって かえす */
const SHELL = 'meridian-shell-v1', VOICE_CACHE = 'meridian-voice', FONT_CACHE = 'meridian-font-v1';
const KEEP = [SHELL, VOICE_CACHE, FONT_CACHE];
const NET_WAIT = 3000;  // これより おそければ 保存しておいた 本体を使う
const SHELL_FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'voice/clips.js', 'data.js', 'kira-config.js', 'kira.js', 'kira-art.js', 'lines.js', 'glyphs.js', 'nurie.js', 'monsters.js', 'app.js', 'pwa.js',
  'img/kira-unicorn.jpg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('meridian-') && !KEEP.includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin){
    if (/\/voice\/[^/]+\.m4a$/.test(url.pathname)) return e.respondWith(voice(req));
    return e.respondWith(shell(e));
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return e.respondWith(font(req));
});

// 本体：ネット優先（NET_WAIT まで まつ）→ だめなら 保存分
async function shell(e){
  const req = e.request, cache = await caches.open(SHELL);
  const net = fetch(req).then(res => {
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  const saved = () => cache.match(req, { ignoreSearch: true })
    .then(r => r || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
  const first = await Promise.race([net.catch(() => null), new Promise(ok => setTimeout(() => ok(null), NET_WAIT))]);
  if (first) return first;
  const r = await saved();
  return r || net;  // 保存分も ないときは ネットを まつ
}

// 音声：保存分 優先。Range が ついていたら そのぶんだけ 切り出す
async function voice(req){
  const cache = await caches.open(VOICE_CACHE), key = req.url;
  let res = await cache.match(key);
  if (!res){
    // Range つきの 206 は 保存できないので、まるごと とってくる
    res = await fetch(key, { credentials: 'same-origin' });
    if (!res.ok) return res;
    await cache.put(key, res.clone());
  }
  return ranged(req, res);
}
async function ranged(req, res){
  const range = req.headers.get('range');
  if (!range) return res;
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] !== '' ? +m[1] : NaN, end = m && m[2] !== '' ? +m[2] : NaN;
  if (isNaN(start)) { start = Math.max(0, size - (isNaN(end) ? size : end)); end = size - 1; }  // bytes=-500（さいごの 500）
  if (isNaN(end) || end >= size) end = size - 1;
  if (!m || start >= size || start > end)
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': res.headers.get('Content-Type') || 'audio/mp4',
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': String(end - start + 1),
    'Accept-Ranges': 'bytes',
  }});
}

// フォント：保存分 優先（CSS は ときどき かわるので うらで 新しくする）
async function font(req){
  const cache = await caches.open(FONT_CACHE), saved = await cache.match(req);
  const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; });
  if (saved){ net.catch(() => {}); return saved; }
  return net;
}
