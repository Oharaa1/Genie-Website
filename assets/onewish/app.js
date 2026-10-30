// Wires the one-wish page, top to bottom: 1 the Lamp filling · 2 the wish form and sharing · 3 the latest wishes.
(function () {
  'use strict';
  const L = window.WishLogic, I18N = window.WishI18n, API = window.WishAPI, Card = window.WishCard;
  const Cards = window.WishWallCards;
  const WALL_PREVIEW = 6; // two rows of three on a wide screen; the rest are on wishes.html
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  // ?motion=1 (on this computer only) plays the animations even when the system asks for reduced motion
  const forceMotion = isLocal && new URLSearchParams(location.search).has('motion');
  if (forceMotion) document.documentElement.classList.add('motion-ok');
  const reduceMotion = !forceMotion && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const startedAt = performance.now();

  // localStorage can throw (private mode, blocked storage) — the page works without it.
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  let lang = L.pickLang(navigator.languages || [navigator.language], store.get('genie.lang'),
    new URLSearchParams(location.search).get('lang'));
  let stats = null;                    // { made, granted, current } from wish_stats()
  let statsLoaded = false;             // the scene waits for the server, so it never flashes the wrong caption
  let wall = null;                     // { current, items } from wish_wall(): the latest public wishes
  // { num, name, wish, src } once this browser made a wish. src = the database it went to,
  // so demo tries and wiped test data never lock a visitor out of the real form.
  let myWish = store.get('genie.wish');
  if (!myWish || !(Number(myWish.num) > 0) || !API.source() || myWish.src !== API.source()) myWish = null;
  let drawSeq = 0;
  let sceneSeq = 0;

  function t(key, vars) {
    let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  Cards.setup({ t });

  // Arabic wishers share an Arabic link, so their friends land on the Arabic page.
  const siteUrl = () => (isLocal ? 'https://genie-coin.com/' : location.origin + '/') + (lang === 'ar' ? '?lang=ar' : '');
  const siteHost = () => (isLocal ? 'genie-coin.com' : location.host);
  const fmtInt = (n) => new Intl.NumberFormat('en-US').format(n);

  // ── language ──────────────────────────────────────────────────────────
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('doc_title');
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    $$('[data-code]').forEach((el) => { el.textContent = el.dataset.code ? t(el.dataset.code) : ''; });
    $('#langBtn').title = t('lang_aria'); // the globe has no words, so hovering tells what it does
    updateCount();
    renderMade();
    if (statsLoaded) renderScene(false);
    if (myWish && !$('#done').hidden) renderDone(false);
    if (wall) renderWall();
  }

  $('#langBtn').addEventListener('click', () => {
    lang = lang === 'ar' ? 'en' : 'ar';
    store.set('genie.lang', lang);
    // drop ?lang= so a reload keeps the visitor's own choice
    const u = new URL(location.href);
    if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); history.replaceState(null, '', u); }
    applyLang();
  });

  // ── 1 · the hook: the Lamp ────────────────────────────────────────────
  // With a picked wish: the Lamp fills to its price, and the caption says whose wish it is
  // (the wish itself is the first card of the Wall, part 3). Before the Genie picks one: a full, glowing Lamp.
  function renderScene(animate) {
    const c = stats && stats.current;
    const scene = $('#scene'), lamp = $('#lamp'), cap = $('#lampCaption');
    let fill;
    if (c) {
      const p = L.lampProgress(c.raised, c.cost);
      const done = p.full || !!c.granted;
      if (c.private || !c.wish) {
        // its owner kept it private: the Lamp still fills, but only the number is shown
        cap.textContent = t(c.granted ? 'lamp_came_true_anon' : 'lamp_filling_anon', { n: c.id });
      } else {
        const name = '⁨' + c.name + '⁩'; // isolated, so a Latin name in an Arabic line can't drag the punctuation around
        cap.textContent = t(c.granted ? 'lamp_came_true' : 'lamp_filling', { name });
      }
      fill = done ? 108 : p.pct; // past 100 so the soft top edge of the gold clears the finial
      lamp.classList.toggle('glow', done);
      lamp.setAttribute('aria-valuenow', String(p.pct));
      lamp.setAttribute('aria-valuetext', t('lamp_of', { raised: L.formatUSD(c.raised), cost: L.formatUSD(c.cost) }));
    } else {
      cap.textContent = t('lamp_waiting');
      fill = 108;
      lamp.classList.add('glow');
      lamp.setAttribute('aria-valuenow', '0');
      lamp.removeAttribute('aria-valuetext');
    }
    cap.classList.toggle('came-true', !!(c && c.granted));
    const tx = $('#lampTx');
    const txOk = !!(c && c.granted && /^https:\/\//.test(c.tx_url || ''));
    tx.hidden = !txOk;
    if (txOk) tx.href = c.tx_url;

    const seq = ++sceneSeq;
    if (animate && !reduceMotion) {
      // let the headline land first, then the gold rises, then the caption says what it is for
      const wait = Math.max(0, 900 - (performance.now() - startedAt));
      setTimeout(() => {
        if (seq !== sceneSeq) return;
        lamp.style.setProperty('--fill', fill + '%');
        setTimeout(() => { if (seq === sceneSeq) scene.classList.add('told'); }, 1300);
      }, wait);
    } else {
      lamp.style.setProperty('--fill', fill + '%');
      scene.classList.add('told');
    }
  }

  // one quiet line instead of counters; a tiny number reads as "nobody's here", so it waits until it means something
  function renderMade() {
    const el = $('#madeLine');
    const ok = !!(stats && stats.made >= 10);
    el.hidden = !ok;
    if (ok) {
      el.textContent = t('made_line', { n: fmtInt(stats.made) })
        + (stats.granted > 0 ? t('made_granted', { g: fmtInt(stats.granted) }) : '');
    }
  }

  async function loadStats() {
    if (API.configured()) {
      try { stats = await API.stats(); } catch (e) { stats = null; }
    }
    statsLoaded = true;
    renderMade();
    renderScene(true);
  }

  // ── 3 · the Wish Wall: the wish the Lamp is filling for, then the latest ones ──
  function renderWall() {
    const f = $('#featured');
    f.replaceChildren();
    const cur = wall && wall.current;
    f.hidden = !cur;
    if (cur) {
      const label = document.createElement('p');
      label.className = 'featured-label';
      label.textContent = t('wall_now');
      f.append(label, Cards.card(cur, true));
    }
    const items = ((wall && wall.items) || []).filter((w) => !cur || w.id !== cur.id).slice(0, WALL_PREVIEW);
    $('#grid').replaceChildren(...items.map((w) => Cards.card(w, false)));
    $('#wallMsg').textContent = wall ? (wall.error ? t('wall_error') : (!items.length && !cur ? t('wall_empty') : '')) : '';
    $('#wallAll').hidden = !(wall && !wall.error && (items.length || cur));
  }

  async function loadWall() {
    if (!API.configured()) return;
    try { wall = await API.wall({ sort: 'new' }); } catch (e) { wall = { error: true }; }
    renderWall();
  }

  // ── the form: the wish first, the rest opens once they start writing ──
  const form = $('#wishForm');
  const FIELDS = ['wish', 'cost', 'name', 'handle']; // page order, so focus lands on the first error seen
  const input = { name: $('#fName'), wish: $('#fWish'), cost: $('#fCost'), handle: $('#fHandle') };
  const platform = () => (form.querySelector('input[name=platform]:checked') || {}).value || 'x';
  const more = $('#more');

  function openMore() {
    if (more.classList.contains('open')) return;
    more.classList.add('open');
    more.inert = false;
  }
  more.addEventListener('focusin', openMore); // browsers without `inert` can still tab in

  function setFieldErr(field, key) {
    const el = $('#err-' + field);
    el.dataset.code = key || '';
    el.textContent = key ? t(key) : '';
    if (key) input[field].setAttribute('aria-invalid', 'true');
    else input[field].removeAttribute('aria-invalid');
  }
  function setFormErr(key) {
    const el = $('#formErr');
    el.dataset.code = key || '';
    el.textContent = key ? t(key) : '';
  }
  const errKey = (code) => 'err_' + (code === 'handle_invalid' ? 'handle_invalid_' + platform() : code);

  function updateCount() {
    const n = [...input.wish.value].length;
    const el = $('#wishCount');
    el.textContent = t('chars', { n });
    el.classList.toggle('over', n > L.LIMITS.WISH_MAX);
  }

  FIELDS.forEach((f) => input[f].addEventListener('input', () => {
    if ($('#err-' + f).dataset.code) setFieldErr(f, '');
    if ($('#formErr').dataset.code) setFormErr('');
    if (f === 'wish') {
      updateCount();
      openMore();
      store.set('genie.draft', input.wish.value); // a half-written wish waits for them if they leave
    }
  }));
  $$('input[name=platform]').forEach((r) => r.addEventListener('change', () => {
    if ($('#err-handle').dataset.code) setFieldErr('handle', '');
    input.handle.focus();
  }));

  let busy = false;
  function setBusy(on) {
    busy = on;
    const btn = $('#submitBtn');
    btn.disabled = on;
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
    const label = btn.querySelector('[data-i18n]');
    label.dataset.i18n = on ? 'btn_sending' : 'btn_submit';
    label.textContent = t(label.dataset.i18n);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    if ($('#fWebsite').value) return; // honeypot: only bots fill the hidden field
    setFormErr('');

    const r = L.validateWish({
      name: input.name.value, wish: input.wish.value, cost: input.cost.value,
      platform: platform(), handle: input.handle.value,
    });
    if (!more.classList.contains('open')) {
      // pressed before writing anything: judge only the wish, don't flash errors on questions they haven't seen
      openMore();
      setFieldErr('wish', r.errors.wish ? errKey(r.errors.wish) : '');
      (r.errors.wish ? input.wish : input.cost).focus();
      return;
    }
    FIELDS.forEach((f) => setFieldErr(f, r.errors[f] ? errKey(r.errors[f]) : ''));
    if (!r.ok) {
      const first = FIELDS.find((f) => r.errors[f]);
      if (first) input[first].focus();
      return;
    }
    if (!API.configured()) { setFormErr('err_setup'); return; }

    setBusy(true);
    try {
      const isPublic = !$('#fPrivate').checked;
      const num = Number(await API.makeWish(r.value, lang, isPublic));
      myWish = { num, name: r.value.name, wish: r.value.wish, src: API.source(), pub: isPublic };
      if (myWish.src) store.set('genie.wish', myWish);
      store.del('genie.draft');
      if (stats) { stats.made += 1; renderMade(); }
      await renderDone(true);
      celebrate();
      if (isPublic) loadWall(); // their wish joins the Wall below straight away
    } catch (err) {
      const code = L.serverErrorCode(err);
      if (code === 'already_wished') { setFieldErr('handle', 'err_already_wished'); input.handle.focus(); }
      else setFormErr('err_' + code);
    } finally {
      setBusy(false);
    }
  });

  // ── after the wish: share card ────────────────────────────────────────
  function canShareFiles() {
    try {
      return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.png', { type: 'image/png' })] }));
    } catch (e) { return false; }
  }

  async function renderDone(scroll) {
    form.hidden = true;
    $('#askHead').hidden = true; // the question is answered; the card below says "Wish #n"
    const done = $('#done');
    done.hidden = false;
    const n = myWish.num;
    $('#doneNum').textContent = t('done_num', { n });
    const text = t('share_text', { n });
    $('#shareX').href = L.xShareUrl(text, siteUrl());
    $('#shareTg').href = L.telegramShareUrl(text, siteUrl());
    $('#shareNative').hidden = !canShareFiles();
    // a public wish has its own place on the Wall; a private one says so plainly
    const pub = myWish.pub !== false;
    $('#doneWall').hidden = !pub;
    $('#doneWall').href = 'wishes.html#w' + n;
    $('#donePrivate').hidden = pub;
    const canvas = $('#cardCanvas');
    canvas.setAttribute('aria-label', t('card_alt', { n }));
    if (scroll) {
      done.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      $('#doneNum').focus({ preventScroll: true });
    }
    const seq = ++drawSeq; // a quick EN→AR→EN switch must not end on the Arabic card
    await Card.draw(canvas, {
      num: n, name: myWish.name, wish: myWish.wish, lang, host: siteHost(), t: I18N[lang],
      isStale: () => seq !== drawSeq,
    });
  }

  async function cardFile() {
    const blob = await Card.toBlob($('#cardCanvas'));
    return new File([blob], 'genie-wish-' + myWish.num + '.png', { type: 'image/png' });
  }

  $('#shareSave').addEventListener('click', async () => {
    const file = await cardFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });

  $('#shareNative').addEventListener('click', async () => {
    try {
      await navigator.share({
        files: [await cardFile()],
        text: t('share_text', { n: myWish.num }) + ' ' + siteUrl(),
      });
    } catch (e) { /* closed the share sheet */ }
  });

  function celebrate() {
    if (reduceMotion) return;
    const host = $('#done');
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      const a = (Math.PI * 2 * i) / 16 + Math.random() * 0.3;
      const d = 90 + Math.random() * 90;
      s.style.setProperty('--dx', Math.cos(a) * d + 'px');
      s.style.setProperty('--dy', Math.sin(a) * d + 'px');
      host.appendChild(s);
      setTimeout(() => s.remove(), 1300);
    }
  }

  // ── start ─────────────────────────────────────────────────────────────
  const draft = store.get('genie.draft');
  if (!myWish && typeof draft === 'string' && draft.trim()) { input.wish.value = draft; openMore(); }
  applyLang();
  if (myWish) renderDone(false);
  loadStats();
  loadWall();
})();
