/* オフラインでも あそべるように、アプリと 音声を この端末に しまっておく service worker。
   - アプリのファイル：ネットにつながれば 新しいものを取りに行き、だめなら しまってあるものを出す
   - 音声（voice/*.m4a）：インストールのときに ぜんぶ しまい、あとは しまってあるものを出す
   - フォント（Google Fonts）：使ったものを しまっておく */
self.window = self;
importScripts('voice/clips.js');  // window.VOICE（音声の一覧）。中身が変わると この service worker も入れかわる
const VOICE = self.VOICE || { ids: [] };

const hash = s => { let h = 0x811c9dc5; for (const ch of s){ h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
const APP = 'suuji-app';
const SOUND = 'suuji-voice-' + hash(JSON.stringify(VOICE.conf || {}));  // 声の設定が変わると 音声は ぜんぶ作りなおされるので 別の入れものにする
const FONTS = 'suuji-fonts';
const FILES = ['./', 'style.css', 'data.js', 'lines.js', 'glyphs.js', 'app.js', 'voice/clips.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const clipPath = id => `voice/${id}.m4a`;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await (await caches.open(APP)).addAll(FILES.map(f => new Request(f, { cache: 'reload' })));
    await saveClips();
    self.skipWaiting();
  })());
});
// 音声は 数が多いので 6本ずつ。とちゅうで失敗したものは 使うときに取りに行く
async function saveClips(){
  const cache = await caches.open(SOUND), have = new Set((await cache.keys()).map(r => r.url));
  const todo = VOICE.ids.map(clipPath).filter(p => !have.has(new URL(p, self.registration.scope).href));
  const worker = async () => { for (let p; (p = todo.shift()); ) try { await cache.add(p); } catch(e) {} };
  await Promise.all(Array.from({ length: 6 }, worker));
}

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('suuji-voice-') && k !== SOUND) await caches.delete(k);
    // もう使わない音声を消す
    const keep = new Set(VOICE.ids.map(id => new URL(clipPath(id), self.registration.scope).href)), cache = await caches.open(SOUND);
    for (const r of await cache.keys()) if (!keep.has(r.url)) await cache.delete(r);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return e.respondWith(fontFirst(req));
  if (url.origin !== location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (/\/voice\/[0-9a-f]+\.m4a$/.test(url.pathname)) return e.respondWith(clip(req));
  e.respondWith(netFirst(req));
});

// つながっていれば 新しいものを出して しまいなおす。4秒たっても返事がなければ しまってあるものを出す
async function netFirst(req){
  const cache = await caches.open(APP);
  const key = req.mode === 'navigate' ? './' : req;
  const net = fetch(req).then(res => { if (res.ok) cache.put(key, res.clone()); return res; });
  net.catch(() => {});
  const saved = () => cache.match(key, { ignoreSearch: true });
  const slow = new Promise(r => setTimeout(r, 4000)).then(saved).then(res => res || net);
  try { return await Promise.race([net, slow]); }
  catch(e) { return (await saved()) || Response.error(); }
}

async function clip(req){
  const cache = await caches.open(SOUND), url = req.url;
  let res = await cache.match(url);
  if (!res){
    try { res = await fetch(url); } catch(e) { return Response.error(); }  // オフラインで なければ ブラウザの声になる
    if (res.ok) cache.put(url, res.clone());
  }
  return withRange(req, res);
}
// iPhone の Safari は audio を Range（ぶぶんごと）で読みに来るので 206 で こたえる
async function withRange(req, res){
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (!m || res.status !== 200) return res;
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  let start = m[1] ? +m[1] : size - +m[2], end = m[1] && m[2] ? +m[2] : size - 1;
  start = Math.max(0, start); end = Math.min(end, size - 1);
  if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': res.headers.get('Content-Type') || 'audio/mp4',
    'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}

// フォントは しまってあれば それを出し、うらで 新しいものに しまいなおす
async function fontFirst(req){
  const cache = await caches.open(FONTS), saved = await cache.match(req);
  const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; });
  if (saved){ net.catch(() => {}); return saved; }
  try { return await net; } catch(e) { return Response.error(); }
}
