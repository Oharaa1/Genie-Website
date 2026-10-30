// Wires the Wish Wall: every public wish as a card, with ❤ "I hope it comes true" and a link per wish.
(function () {
  'use strict';
  const L = window.WishLogic, I18N = window.WishI18n, API = window.WishAPI;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';

  // localStorage can throw (private mode, blocked storage) — the page works without it.
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  let lang = L.pickLang(navigator.languages || [navigator.language], store.get('genie.lang'),
    new URLSearchParams(location.search).get('lang'));
  let sort = 'new';
  let page = null;        // the last answer from the server: { made, granted, current, more }
  let items = [];         // every card loaded so far, in order
  let shared = null;      // the wish a shared link (#w37) points at
  let flashId = null;     // that wish glows for a moment so the eye finds it
  let loading = false;
  let loadSeq = 0;
  // wishes this browser already ❤'d (the server also allows one per wish per connection).
  // Demo hearts stay in memory, so they never mark a real wish with the same number.
  const heartKey = API.source() ? 'genie.hearts' : null;
  const hearted = new Set(((heartKey && store.get(heartKey)) || []).filter((n) => Number.isInteger(n)));

  function t(key, vars) {
    let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  const fmtInt = (n) => new Intl.NumberFormat('en-US').format(n);
  const usd = (n) => '⁦' + L.formatUSD(n) + '⁩'; // isolated, or Arabic lines turn "$2,400" into "2,400$"
  const wishUrl = (id) => (isLocal ? 'https://genie-coin.com/wishes.html' : location.origin + location.pathname) + '#w' + id;

  // "3 hours ago" in the page language, with Western digits like the rest of the site
  function ago(iso) {
    const s = (new Date(iso).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en', { numeric: 'auto' });
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

  // ── one wish card ─────────────────────────────────────────────────────
  function card(w, big) {
    const a = el('article', 'wcard' + (big ? ' big' : '') + (w.status === 'granted' ? ' granted' : '') + (w.status === 'picked' ? ' picked' : ''));
    if (!big) a.id = 'w' + w.id;
    a.style.setProperty('--tilt', big ? '0deg' : (((w.id * 37) % 5) - 2) * 0.45 + 'deg'); // pinned-note look, same tilt every visit

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
    const by = el('span', 'wby');
    const name = el('b');
    name.append(el('bdi', null, w.name));
    const handle = el('span', 'whandle');
    handle.innerHTML = ICON[w.platform] || '';
    const h = el('bdi', null, '@' + w.handle);
    h.dir = 'ltr';
    handle.append(h);
    by.append(name, handle);
    foot.append(by);

    if (w.status === 'granted') {
      // already came true: the ❤ count stays as applause, there is nothing left to hope for
      const n = el('span', 'wheart done');
      n.innerHTML = ICON.heart;
      n.append(el('span', null, fmtInt(w.hearts)));
      foot.append(n);
    } else {
      const b = el('button', 'wheart');
      b.type = 'button';
      b.dataset.heart = w.id;
      b.setAttribute('aria-pressed', hearted.has(w.id) ? 'true' : 'false');
      b.setAttribute('aria-label', t('wall_heart'));
      b.title = t('wall_heart');
      b.innerHTML = ICON.heart;
      b.append(el('span', 'wheart-n', fmtInt(w.hearts)));
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

  // ── render ────────────────────────────────────────────────────────────
  function renderTop() {
    const sub = $('#wallSub');
    const ok = !!(page && page.made >= 10); // a tiny number reads as "nobody's here"
    sub.hidden = !ok;
    if (ok) sub.textContent = t('wall_sub', { n: fmtInt(page.made) }) + (page.granted > 0 ? t('made_granted', { g: fmtInt(page.granted) }) : '');

    const f = $('#featured');
    f.replaceChildren();
    const cur = page && page.current;
    f.hidden = !cur;
    if (cur) f.append(el('p', 'featured-label', t('wall_now')), card(cur, true));

    const sh = $('#shared');
    sh.replaceChildren();
    const showShared = !!(shared && !(cur && cur.id === shared.id));
    sh.hidden = !showShared;
    if (showShared) sh.append(el('p', 'featured-label', t('wall_shared')), card(shared, true));
    if (flashId) {
      const target = showShared ? sh : (cur && cur.id === flashId ? f : null);
      const c = target && target.querySelector('.wcard');
      if (c) c.classList.add('flash');
    }
  }

  function renderGrid() {
    const g = $('#grid');
    g.replaceChildren();
    items.forEach((w, i) => {
      g.append(card(w, false));
      // the warning comes back inside the list too: after the 6th card, then every 12 (whole rows at 1, 2 or 3 columns)
      if ((i + 1 - 6) % 12 === 0 && i + 1 < items.length) g.append(warnStrip());
    });
    const msg = $('#wallMsg');
    msg.textContent = page && !items.length ? t(sort === 'true' ? 'wall_empty_true' : 'wall_empty') : '';
    $('#moreBtn').hidden = !(page && page.more);
  }

  function renderAll() { renderTop(); renderGrid(); }

  async function load(reset) {
    if (loading && !reset) return;
    loading = true;
    const seq = ++loadSeq;
    const more = $('#moreBtn');
    more.disabled = true;
    $('#grid').setAttribute('aria-busy', 'true');
    try {
      if (!API.configured()) throw new Error('setup');
      const r = await API.wall({ sort, offset: reset ? 0 : items.length });
      if (seq !== loadSeq) return; // a newer tab click took over
      page = r;
      items = reset ? r.items : items.concat(r.items);
      renderAll();
    } catch (e) {
      if (seq !== loadSeq) return;
      $('#wallMsg').textContent = t('wall_error');
    } finally {
      if (seq === loadSeq) {
        loading = false;
        more.disabled = false;
        $('#grid').removeAttribute('aria-busy');
      }
    }
  }

  // a shared link (wishes.html#w37) puts that wish on top, so a friend lands on it first
  async function loadShared() {
    const m = /^#w(\d{1,9})$/.exec(location.hash);
    if (!m || !API.configured()) return;
    try {
      const r = await API.wall({ id: Number(m[1]) });
      shared = (r.items && r.items[0]) || null;
      if (!shared) return;
      if (!page) page = Object.assign({}, r, { items: [], more: false });
      flashId = shared.id;
      setTimeout(() => { flashId = null; }, 3500);
      renderTop();
      // stop at the scam warning, so it is on screen together with the shared wish and its @
      $('.warn-box').scrollIntoView({ block: 'start' });
    } catch (e) { /* the wall still loads */ }
  }

  // ── language ──────────────────────────────────────────────────────────
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('wall_doc_title');
    $$('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
    $$('[data-i18n-aria]').forEach((e) => e.setAttribute('aria-label', t(e.dataset.i18nAria)));
    $('#langBtn').title = t('lang_aria');
    if (page) renderAll();
  }

  $('#langBtn').addEventListener('click', () => {
    lang = lang === 'ar' ? 'en' : 'ar';
    store.set('genie.lang', lang);
    const u = new URL(location.href);
    if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); history.replaceState(null, '', u); }
    applyLang();
  });

  // ── actions ───────────────────────────────────────────────────────────
  $$('.tab').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.sort === sort) return;
    sort = b.dataset.sort;
    $$('.tab').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    load(true);
  }));
  $('#moreBtn').addEventListener('click', () => load(false));

  function setHeartCount(id, n) {
    [items, [page && page.current, shared]].flat().forEach((w) => { if (w && w.id === id) w.hearts = n; });
    $$('[data-heart="' + id + '"]').forEach((b) => {
      b.setAttribute('aria-pressed', 'true');
      b.querySelector('.wheart-n').textContent = fmtInt(n);
    });
  }

  let toastTimer = 0;
  function toast(msg) {
    const e = $('#toast');
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
      const before = [items, [page && page.current, shared]].flat().find((w) => w && w.id === id);
      const was = before ? before.hearts : 0;
      setHeartCount(id, was + 1); // show it at once; the server's number replaces it
      try { setHeartCount(id, Math.max(Number(await API.heart(id)) || 0, was)); } catch (err) { /* keep the local ❤ */ }
      return;
    }
    const link = e.target.closest('[data-link]');
    if (link) {
      const url = wishUrl(Number(link.dataset.link));
      try { await navigator.clipboard.writeText(url); toast(t('wall_copied')); }
      catch (err) { history.replaceState(null, '', '#w' + link.dataset.link); } // at least the address bar holds it
    }
  });

  // ── start ─────────────────────────────────────────────────────────────
  applyLang();
  loadShared();
  load(true);
})();
