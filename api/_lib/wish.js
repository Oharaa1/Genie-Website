// Shared by api/w.js (the page) and api/card.js (the picture): read one public wish, and decide if it may get its own picture.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CARD_VERSION = '1'; // change this when the card design changes, so X and Telegram fetch the new picture

// The same Supabase project and publishable key the page uses (assets/onewish/config.js), kept in one place.
const config = (() => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'onewish', 'config.js'), 'utf8');
  const pick = (k) => (src.match(new RegExp(k + ":\\s*'([^']+)'")) || [])[1];
  return { url: pick('url'), key: pick('key') };
})();

const validId = (v) => typeof v === 'string' && /^[1-9]\d{0,8}$/.test(v);
const validLang = (v) => v === 'en' || v === 'ar';

// Only public wishes come back (wish_wall hides private, hidden and deleted ones). null = no such wish.
async function getWish(id) {
  const res = await fetch(config.url + '/rest/v1/rpc/wish_wall', {
    method: 'POST',
    headers: { apikey: config.key, Authorization: 'Bearer ' + config.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_sort: 'new', p_offset: 0, p_id: Number(id) }),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error('wish_wall ' + res.status);
  const data = await res.json();
  const w = data && Array.isArray(data.items) && data.items[0];
  return w && String(w.id) === id ? { num: Number(w.id), name: String(w.name || ''), wish: String(w.wish || '') } : null;
}

// A wish with a link or a wallet address gets the general picture: on our domain it could pose as an official airdrop.
const LINKISH = [
  /https?:|www\.|t\.me\b|wa\.me\b/i,
  /[a-z0-9-]\.(com|net|org|io|xyz|app|gg|me|co|link|site|online|finance|exchange|top|info|biz|ru|cn|ly|to|fun|pro|vip|club|live|cc|us|uk|de|fr)\b/i,
  /\b0x[0-9a-f]{16,}/i,                     // Ethereum-style address
  /\bbc1[0-9a-z]{20,}/i,                    // Bitcoin
  /\b[13][1-9A-HJ-NP-Za-km-z]{25,34}\b/,    // old Bitcoin
  /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/,        // Solana and other base58
];
const hasLink = (s) => LINKISH.some((re) => re.test(s));

// Letters our fonts can draw (api/_lib/fonts/coverage.json). Anything else would show as empty boxes.
const COVER = JSON.parse(fs.readFileSync(path.join(__dirname, 'fonts', 'coverage.json'), 'utf8'));
function drawable(s) {
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x20) continue;
    let lo = 0, hi = COVER.length - 1, ok = false;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (c < COVER[m][0]) hi = m - 1; else if (c > COVER[m][1]) lo = m + 1; else { ok = true; break; }
    }
    if (!ok) return false;
  }
  return true;
}

const ownPicture = (w) => !!w && !hasLink(w.wish + ' ' + w.name) && drawable(w.wish + w.name);

// The site's own address, so a test link points at its own pictures.
function origin(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'genie-coin.com').split(',')[0].trim();
  const safe = /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? host : 'genie-coin.com';
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(safe);
  return (local ? 'http://' : 'https://') + safe;
}

module.exports = { ROOT, CARD_VERSION, validId, validLang, getWish, hasLink, drawable, ownPicture, origin };
