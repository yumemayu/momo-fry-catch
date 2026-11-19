const momoRoot = new URL('./', document.currentScript.src);

/* Registers the Momo Playz service worker (sw.js at the site root).
   Included by every page; the worker URL is resolved from this
   script's own URL so it works from the top page and game folders. */
(() => {
  if (!('serviceWorker' in navigator)) return;
  const swUrl = new URL('sw.js', momoRoot);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
})();

/* Keep Home available above the game and results. */
(() => {
  if ([momoRoot.pathname, new URL('index.html', momoRoot).pathname].includes(location.pathname)) return;

  const add = () => {
    if (document.querySelector('.momo-home-link')) return;

    const style = document.createElement('style');
    style.textContent = `
      .momo-home-link {
        position: fixed;
        top: max(8px, env(safe-area-inset-top));
        left: max(8px, env(safe-area-inset-left));
        z-index: 100;
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        box-sizing: border-box;
        padding: 0 10px;
        border: 2px solid #f272a7;
        border-radius: 999px;
        background: #fff;
        color: #a52a62;
        font: 800 .85rem/1 system-ui, sans-serif;
        text-decoration: none;
        box-shadow: 0 2px 6px #b0896833;
      }
      body.game-wide #momo-piano-levels .phone.play[data-screen="playing"] header {
        padding-left: max(100px, calc(env(safe-area-inset-left) + 92px));
      }
    `;
    document.head.append(style);

    const link = document.createElement('a');
    link.className = 'momo-home-link';
    link.href = momoRoot.href;
    const label = () => {
      link.textContent = document.documentElement.lang === 'ja' ? '🏠 ホーム' : '🏠 Home';
    };
    label();
    if (typeof momoLanguage !== 'undefined') momoLanguage.subscribe(label);
    document.body.append(link);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add);
  else add();
})();
