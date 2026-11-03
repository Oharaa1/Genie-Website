// Two looks for the site: "elegant" (the default) and "classic" (the earlier design, kept for comparing).
// This runs before the page paints, so the page never flashes the wrong look.
// ?theme=classic or ?theme=elegant picks one for that page.
// Only a local copy remembers the choice and shows the switch in the corner, so visitors never see it.
(function () {
  const THEMES = ['elegant', 'classic'];
  const LAMPS = { elegant: 'img/lamp-foil.webp', classic: 'img/lamp-gold.webp' };
  const BARS = { elegant: '#F8F3E7', classic: '#FBB417' };
  const KEY = 'genie.theme';
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  const framed = window.self !== window.top; // the compare page shows both at once, so its frames remember nothing

  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = (t) => { try { localStorage.setItem(KEY, t); } catch (e) { /* ignore */ } };

  const fromUrl = new URLSearchParams(location.search).get('theme');
  if (THEMES.includes(fromUrl) && isLocal && !framed) save(fromUrl);
  const saved = isLocal ? read() : null;
  let theme = THEMES.includes(fromUrl) ? fromUrl : THEMES.includes(saved) ? saved : THEMES[0];

  function apply() {
    document.documentElement.dataset.theme = theme;
    const bar = document.querySelector('meta[name="theme-color"]');
    if (bar) bar.content = BARS[theme];
    document.querySelectorAll('img[data-lamp]').forEach((img) => {
      if (img.getAttribute('src') !== LAMPS[theme]) img.src = LAMPS[theme];
    });
  }

  function addSwitch() {
    if (framed || !isLocal) return;
    const btn = document.createElement('button');
    const label = () => { btn.textContent = 'Switch to ' + (theme === 'elegant' ? 'Classic' : 'Elegant'); };
    btn.type = 'button';
    btn.dir = 'ltr';
    btn.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:20;min-height:44px;padding:0 14px;' +
      'background:#fff;color:#111;border:1px solid #111;border-radius:8px;font:600 14px system-ui,sans-serif;cursor:pointer;';
    btn.addEventListener('click', () => {
      theme = theme === 'elegant' ? 'classic' : 'elegant';
      save(theme);
      apply();
      label();
      window.dispatchEvent(new Event('resize')); // the wish box refits to the new letters
      const url = new URL(location.href);
      if (url.searchParams.has('theme')) {
        url.searchParams.set('theme', theme);
        history.replaceState(null, '', url);
      }
    });
    label();
    document.body.appendChild(btn);
  }

  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    addSwitch();
  });
})();
