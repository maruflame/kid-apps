/* Meridian：ウェブアプリ（ホーム画面に おいて つかう）ための しくみ。app.js とは べつに 動く */
(() => {
// オフラインで あそべるように Service Worker を いれる（https か localhost の ときだけ 動く）
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'))
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

// iPhone：2本ゆびの ピンチで 画面が 大きくなって もどせなく ならないように（viewport の user-scalable は iOS が むしする）
['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));

// ホーム画面から ひらいているか（CSS で ちがいを 出したいとき用）
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
document.documentElement.classList.toggle('standalone', standalone);
})();
