// Draws one Wish Wall card, and runs its ❤ and link buttons. Shared by the home page (the latest wishes)
// and wishes.html (the whole Wall). Each page calls setup({ t }) with its own translator.
(function () {
  'use strict';
  const L = window.WishLogic, API = window.WishAPI;
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';

  // localStorage can throw (private mode, blocked storage) — the cards work without it.
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  let t = (k) => k;
  const lang = () => (document.documentElement.lang === 'ar' ? 'ar' : 'en');
  const fmtInt = (n) => new Intl.NumberFormat('en-US').format(n);
  const usd = (n) => '⁦' + L.formatUSD(n) + '⁩'; // isolated, or Arabic lines turn "$2,400" into "2,400$"
  const wishUrl = (id) => (isLocal ? 'https://genie-coin.com' : location.origin) + '/wishes.html#w' + id;

  // wishes this browser already ❤'d (the server also allows one per wish per connection).
  // Demo hearts stay in memory, so they never mark a real wish with the same number.
  const heartKey = API.source() ? 'genie.hearts' : null;
  const hearted = new Set(((heartKey && store.get(heartKey)) || []).filter((n) => Number.isInteger(n)));
  const counts = new Map(); // id → ❤ count after this visitor's tap, so a re-render keeps it

  // "3 hours ago" in the page language, with Western digits like the rest of the site
  function ago(iso) {
    const s = (new Date(iso).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(lang() === 'ar' ? 'ar-u-nu-latn' : 'en', { numeric: 'auto' });
    const steps = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, sec] of steps) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), unit);
    return rtf.format(0, 'minute');
  }

  const ICON = {
    x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.6-4.6-9.5-9.4C1.2 7.8 3.3 4.5 6.7 4.5c2 0 3.5 1.1 4.4 2.5l.9 1.3.9-1.3c.9-1.4 2.4-2.5 4.4-2.5 3.4 0 5.5 3.3 4.2 6.6-1.9 4.8-9.5 9.4-9.5 9.4z"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>',
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text; // people's words always go in as text, never as HTML
    return e;
  }

  // ── one wish card: the wish first and biggest, then who wished it ─────
  function card(w, big) {
    const a = el('article', 'wcard' + (big ? ' big' : '') + (w.status === 'granted' ? ' granted' : '') + (w.status === 'picked' ? ' picked' : ''));
    if (!big) a.id = 'w' + w.id;

    const top = el('div', 'wcard-top');
    top.append(el('span', 'wnum', t('wall_num', { n: w.id })));
    const time = el('time', null, ago(w.created_at));
    time.dateTime = w.created_at;
    top.append(time);
    a.append(top);

    const dir = L.textDir(w.wish);
    const text = el('p', 'wtext', dir === 'rtl' ? '«' + w.wish + '»' : '“' + w.wish + '”');
    text.dir = dir;
    a.append(text);

    if (w.status === 'picked' && w.cost) {
      const p = L.lampProgress(w.raised, w.cost);
      const bar = el('div', 'wbar');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', String(p.pct));
      bar.setAttribute('aria-label', t('lamp_aria'));
      const fill = el('i');
      fill.style.width = (p.full ? 100 : p.pct) + '%';
      bar.append(fill);
      a.append(bar, el('p', 'wof', t('lamp_of', { raised: usd(w.raised), cost: usd(w.cost) })));
    }
    if (w.status === 'granted') {
      const ok = el('p', 'wtrue', t('wall_came_true', { amount: usd(w.cost) }));
      if (/^https:\/\//.test(w.tx_url || '')) {
        const tx = el('a', null, t('lamp_tx'));
        tx.href = w.tx_url;
        tx.target = '_blank';
        tx.rel = 'noopener noreferrer';
        ok.append(' · ', tx);
      }
      a.append(ok);
    }

    const foot = el('div', 'wcard-foot');
    // the first letter of the name in a soft circle: a face for the wish without a photo
    const face = el('span', 'wface', [...w.name][0] || '');
    face.dataset.tone = String(w.id % 4);
    face.setAttribute('aria-hidden', 'true');
    const by = el('span', 'wby');
    const name = el('b');
    name.append(el('bdi', null, w.name));
    const handle = el('span', 'whandle');
    handle.innerHTML = ICON[w.platform] || '';
    const h = el('bdi', null, '@' + w.handle);
    h.dir = 'ltr';
    handle.append(h);
    by.append(name, handle);
    foot.append(face, by);

    const n = Math.max(w.hearts, counts.get(w.id) || 0);
    if (w.status === 'granted') {
      // already came true: the ❤ count stays as applause, there is nothing left to hope for
      const s = el('span', 'wheart done');
      s.innerHTML = ICON.heart;
      s.append(el('span', null, fmtInt(n)));
      foot.append(s);
    } else {
      const b = el('button', 'wheart');
      b.type = 'button';
      b.dataset.heart = w.id;
      b.dataset.n = n;
      b.setAttribute('aria-pressed', hearted.has(w.id) ? 'true' : 'false');
      b.setAttribute('aria-label', t('wall_heart'));
      b.title = t('wall_heart');
      b.innerHTML = ICON.heart;
      b.append(el('span', 'wheart-n', fmtInt(n)));
      foot.append(b);
    }

    const ln = el('button', 'wlink');
    ln.type = 'button';
    ln.dataset.link = w.id;
    ln.setAttribute('aria-label', t('wall_copy'));
    ln.title = t('wall_copy');
    ln.innerHTML = ICON.link;
    foot.append(ln);

    a.append(foot);
    return a;
  }

  function warnStrip() {
    const s = el('aside', 'wwarn');
    s.setAttribute('role', 'note');
    s.append(el('span', null, '🛡️'), el('b', null, t('wall_warn_title')), el('span', null, t('wall_warn')));
    return s;
  }

  // ── ❤ and the link button ─────────────────────────────────────────────
  function setHeartCount(id, n) {
    counts.set(id, n);
    document.querySelectorAll('[data-heart="' + id + '"]').forEach((b) => {
      b.setAttribute('aria-pressed', 'true');
      b.dataset.n = n;
      b.querySelector('.wheart-n').textContent = fmtInt(n);
    });
  }

  let toastTimer = 0;
  function toast(msg) {
    const e = document.getElementById('toast');
    if (!e) return;
    e.textContent = msg;
    e.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { e.hidden = true; }, 1800);
  }

  document.addEventListener('click', async (e) => {
    const heart = e.target.closest('[data-heart]');
    if (heart) {
      const id = Number(heart.dataset.heart);
      if (hearted.has(id)) return; // one ❤ per wish
      hearted.add(id);
      if (heartKey) store.set(heartKey, [...hearted].slice(-1000));
      const was = Number(heart.dataset.n) || 0;
      setHeartCount(id, was + 1); // show it at once; the server's number replaces it
      try { setHeartCount(id, Math.max(Number(await API.heart(id)) || 0, was)); } catch (err) { /* keep the local ❤ */ }
      return;
    }
    const link = e.target.closest('[data-link]');
    if (link) {
      const id = link.dataset.link;
      try { await navigator.clipboard.writeText(wishUrl(id)); toast(t('wall_copied')); }
      catch (err) { if (/wishes\.html$/.test(location.pathname)) history.replaceState(null, '', '#w' + id); } // at least the address bar holds it
    }
  });

  window.WishWallCards = {
    setup(o) { t = o.t; },
    card,
    warnStrip,
    toast,
  };
})();
