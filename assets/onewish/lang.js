// Picks the page language before the page paints, so an Arabic visitor never sees English first.
// Order: a ?lang= link, then the visitor's own choice, then their phone (any Arabic language, or a clock set to an Arab country).
// The clock matters: Safari tells a site only one language, so an iPhone set to English in Baghdad still says "en".
// Works in the browser (window.WishLang, run from <head>) and in Node (require) — tested in logic.test.js.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.WishLang = api; api.start(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KEY = 'genie.lang'; // app.js and wall.js save the visitor's choice here (as JSON)

  // the time zones of the countries where people read Arabic every day
  const ARAB_ZONES = [
    'Asia/Baghdad', 'Asia/Riyadh', 'Asia/Kuwait', 'Asia/Bahrain', 'Asia/Qatar', 'Asia/Dubai', 'Asia/Muscat', 'Asia/Aden',
    'Asia/Amman', 'Asia/Damascus', 'Asia/Beirut', 'Asia/Gaza', 'Asia/Hebron',
    'Africa/Cairo', 'Africa/Khartoum', 'Africa/Tripoli', 'Africa/Tunis', 'Africa/Algiers',
    'Africa/Casablanca', 'Africa/El_Aaiun', 'Africa/Nouakchott',
  ];

  function pickLang(browserLangs, saved, fromUrl, timeZone) {
    if (fromUrl === 'ar' || fromUrl === 'en') return fromUrl;
    if (saved === 'ar' || saved === 'en') return saved;
    const langs = (browserLangs || []).map((l) => String(l || '').toLowerCase());
    if (langs.some((l) => l === 'ar' || l.startsWith('ar-'))) return 'ar';
    if (ARAB_ZONES.includes(timeZone)) return 'ar';
    return 'en';
  }

  const api = { ARAB_ZONES, pickLang, start, lang: 'en' };

  function start() {
    let saved = null, zone = '';
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* private mode: the page works without it */ }
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* old browser */ }
    const fromUrl = new URLSearchParams(location.search).get('lang');
    api.lang = pickLang(navigator.languages || [navigator.language], saved, fromUrl, zone);

    // someone new who came from an Arabic link stays in Arabic on the next page; a choice they made before stays theirs
    if ((fromUrl === 'ar' || fromUrl === 'en') && saved !== 'ar' && saved !== 'en') {
      try { localStorage.setItem(KEY, JSON.stringify(fromUrl)); } catch (e) { /* ignore */ }
    }

    const html = document.documentElement;
    html.lang = api.lang;
    html.dir = api.lang === 'ar' ? 'rtl' : 'ltr';
    // the HTML is written in English: its words wait hidden until app.js puts the Arabic ones in (style.css)
    if (api.lang === 'ar') html.classList.add('i18n-wait');
  }

  return api;
});
