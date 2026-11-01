// Wires the Wish Wall page: tabs, paging and the wish a shared link points at. The cards come from wallcards.js.
(function () {
  'use strict';
  const L = window.WishLogic, I18N = window.WishI18n, API = window.WishAPI, Cards = window.WishWallCards;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

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

  function t(key, vars) {
    let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  Cards.setup({ t });
  const el = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; e.textContent = text; return e; };

  // ── render ────────────────────────────────────────────────────────────
  function renderTop() {
    const f = $('#featured');
    f.replaceChildren();
    const cur = page && page.current;
    f.hidden = !cur;
    if (cur) f.append(Cards.card(cur, true));

    const sh = $('#shared');
    sh.replaceChildren();
    const showShared = !!(shared && !(cur && cur.id === shared.id));
    sh.hidden = !showShared;
    if (showShared) sh.append(el('p', 'featured-label', t('wall_shared')), Cards.card(shared, true));
    if (flashId) {
      const target = showShared ? sh : (cur && cur.id === flashId ? f : null);
      const c = target && target.querySelector('.wcard');
      if (c) c.classList.add('flash');
    }
  }

  function renderGrid() {
    const g = $('#grid');
    g.replaceChildren();
    g.append(...items.map((w) => Cards.card(w, false)));
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
      $('#wallScam').scrollIntoView({ block: 'start' });
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

  // ── tabs and paging ───────────────────────────────────────────────────
  $$('.tab').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.sort === sort) return;
    sort = b.dataset.sort;
    $$('.tab').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    load(true);
  }));
  $('#moreBtn').addEventListener('click', () => load(false));

  // ── start ─────────────────────────────────────────────────────────────
  applyLang();
  loadShared();
  load(true);
})();
