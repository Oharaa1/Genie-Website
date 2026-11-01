// Pure helpers for the one-wish page. No DOM, no network — tested in logic.test.js.
// Works in the browser (window.WishLogic) and in Node (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WishLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Keep in sync with the checks in supabase/migrations/*_wishes.sql
  const LIMITS = { NAME_MAX: 40, WISH_MIN: 10, WISH_MAX: 280, COST_MIN: 1, COST_MAX: 1000000 };
  const PLATFORMS = ['x', 'telegram'];
  const HANDLE_RE = {
    x: /^[A-Za-z0-9_]{1,15}$/,
    telegram: /^[A-Za-z][A-Za-z0-9_]{3,31}$/,
  };

  const len = (s) => [...s].length; // code points, same as Postgres char_length

  // Trim, flatten whitespace, drop control and bidi-override characters.
  function cleanText(s) {
    return String(s == null ? '' : s)
      .replace(/[\t\n\r]+/g, ' ')
      .replace(/[\u0000-\u001F\u007F-\u009F​‪-‮⁦-⁩]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // "$2,400", "2400$", "٢٬٤٠٠ دولار" → 2400. Anything else → NaN.
  function parseCost(raw) {
    let s = String(raw == null ? '' : raw)
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/٫/g, '.')
      .toLowerCase()
      .replace(/usd|dollars?|دولارات|دولار|\$|[,٬\s ]/g, '');
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return Math.round(Number(s));
  }

  // The price box while typing: "2400" → "2,400", "٢٤٠٠" → "2,400". caret = the cursor position;
  // it stays after the same digit. Anything that isn't a plain whole number is left as it is.
  function formatCostInput(raw, caret) {
    const s = String(raw == null ? '' : raw);
    const west = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
    const digits = west.replace(/[,٬\s ]/g, '');
    if (!/^\d+$/.test(digits)) return { value: s, caret };
    const whole = digits.replace(/^0+(?=\d)/, '');
    let before = west.slice(0, caret).replace(/\D/g, '').length - (digits.length - whole.length);
    const value = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    let pos = 0;
    while (before > 0 && pos < value.length) { if (value[pos] !== ',') before--; pos++; }
    return { value, caret: pos };
  }

  // A pasted profile link says which app it is: "t.me/name" → 'telegram', "x.com/name" → 'x', else null.
  function linkPlatform(raw) {
    const s = String(raw == null ? '' : raw).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    if (/^(?:t\.me|telegram\.me)\/[^/?#\s]/i.test(s)) return 'telegram';
    if (/^(?:mobile\.)?(?:x\.com|twitter\.com)\/[^/?#\s]/i.test(s)) return 'x';
    return null;
  }

  // "@name", "https://x.com/name/", "t.me/name" → "name"
  function normalizeHandle(platform, raw) {
    let s = String(raw == null ? '' : raw).trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '');
    const link = s.match(/^(?:mobile\.)?(?:x\.com|twitter\.com|t\.me|telegram\.me)\/([^/?#]+)/i);
    if (link) s = link[1];
    return s.replace(/^@+/, '').replace(/[/?#].*$/, '').trim();
  }

  function validHandle(platform, handle) {
    const re = HANDLE_RE[platform];
    return !!re && re.test(handle);
  }

  // Returns { ok, value, errors } — errors maps field → code (see i18n err_*).
  function validateWish(input) {
    const name = cleanText(input.name);
    const wish = cleanText(input.wish);
    const cost = parseCost(input.cost);
    const platform = String(input.platform || '');
    const handle = normalizeHandle(platform, input.handle);
    const errors = {};

    if (!name) errors.name = 'name_required';
    else if (len(name) > LIMITS.NAME_MAX) errors.name = 'name_long';

    if (len(wish) < LIMITS.WISH_MIN) errors.wish = 'wish_short';
    else if (len(wish) > LIMITS.WISH_MAX) errors.wish = 'wish_long';

    if (Number.isNaN(cost)) errors.cost = 'cost_invalid';
    else if (cost < LIMITS.COST_MIN || cost > LIMITS.COST_MAX) errors.cost = 'cost_range';

    if (!PLATFORMS.includes(platform)) errors.platform = 'platform_invalid';
    else if (!validHandle(platform, handle)) errors.handle = 'handle_invalid';

    return {
      ok: Object.keys(errors).length === 0,
      value: { name, wish, cost, platform, handle },
      errors,
    };
  }

  // Floors so the bar never reads 100% before the Lamp is really full.
  function lampProgress(raised, cost) {
    const c = Number(cost);
    if (!(c > 0)) return { pct: 0, full: false };
    const r = Math.max(0, Number(raised) || 0);
    if (r >= c) return { pct: 100, full: true };
    return { pct: Math.min(99, Math.floor((r / c) * 100)), full: false };
  }

  const usd = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  function formatUSD(n) {
    return '$' + usd.format(Math.round(Number(n) || 0));
  }

  function serverErrorCode(err) {
    const msg = String((err && (err.message || err.code)) || '');
    if (msg.includes('already_wished')) return 'already_wished';
    if (msg.includes('rate_limited')) return 'rate_limited';
    if (msg.includes('invalid_key')) return 'bad_key';   // before invalid_: a wrong secret, not a wrong field
    if (msg.includes('wish_locked')) return 'locked';    // the Genie picked (or hid) it, it can't be deleted now
    if (msg.includes('invalid_')) return 'invalid';
    return 'network';
  }

  // Direction of the first strong letter (so an Arabic wish stays RTL on the English page).
  function textDir(s) {
    for (const ch of String(s || '')) {
      if (/[A-Za-zÀ-ɏ]/.test(ch)) return 'ltr';
      if (/[֐-ࣿיִ-﷿ﹰ-﻿]/.test(ch)) return 'rtl';
    }
    return 'ltr';
  }

  // Word-wrap for the share card canvas. measure(str) → width in px.
  function wrapText(text, maxWidth, measure, maxLines) {
    const lines = [];
    let cur = '';
    for (const word of cleanText(text).split(' ')) {
      if (!word) continue;
      if (measure(word) > maxWidth) {
        if (cur) { lines.push(cur); cur = ''; }
        let chunk = '';
        for (const ch of word) {
          if (chunk && measure(chunk + ch) > maxWidth) { lines.push(chunk); chunk = ''; }
          chunk += ch;
        }
        cur = chunk;
        continue;
      }
      const next = cur ? cur + ' ' + word : word;
      if (measure(next) <= maxWidth) cur = next;
      else { lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    if (lines.length <= maxLines) return lines;

    const kept = lines.slice(0, maxLines);
    let last = [...kept[maxLines - 1]];
    while (last.length && measure(last.join('') + '…') > maxWidth) last.pop();
    kept[maxLines - 1] = last.join('').trimEnd() + '…';
    return kept;
  }

  // A ?lang= link wins, then the visitor's own toggle, then the browser language.
  function pickLang(browserLangs, saved, fromUrl) {
    if (fromUrl === 'ar' || fromUrl === 'en') return fromUrl;
    if (saved === 'ar' || saved === 'en') return saved;
    const first = String((browserLangs && browserLangs[0]) || '').toLowerCase();
    return first.startsWith('ar') ? 'ar' : 'en';
  }

  const enc = encodeURIComponent;
  function xShareUrl(text, url) {
    return 'https://x.com/intent/tweet?text=' + enc(text) + '&url=' + enc(url);
  }
  function telegramShareUrl(text, url) {
    return 'https://t.me/share/url?url=' + enc(url) + '&text=' + enc(text);
  }

  return {
    LIMITS, cleanText, parseCost, formatCostInput, linkPlatform, normalizeHandle, validHandle, validateWish,
    lampProgress, formatUSD, serverErrorCode, textDir, wrapText, pickLang,
    xShareUrl, telegramShareUrl,
  };
});
