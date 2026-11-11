// genie-coin.com/w/23 (and /w/23/ar) → a tiny page that gives X and Telegram that wish's own card.
// People who open it are sent straight on to the same wish on the Wish Wall.
'use strict';
const { CARD_VERSION, validId, getWish, ownPicture, origin } = require('./_lib/wish');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const id = (req.query && req.query.id) || q.get('id');
  const lang = ((req.query && req.query.lang) || q.get('lang')) === 'ar' ? 'ar' : 'en';
  if (!validId(id)) {
    res.statusCode = 302;
    res.setHeader('Location', '/wishes.html');
    return res.end();
  }
  const site = origin(req);
  const wall = '/wishes.html' + (lang === 'ar' ? '?lang=ar' : '') + '#w' + id;

  let wish = null;
  try { wish = await getWish(id); } catch (e) { /* database busy: general picture for now */ }
  const own = ownPicture(wish);
  const pic = (shape) => site + '/api/card?id=' + id + '&lang=' + lang + '&shape=' + shape + '&v=' + CARD_VERSION;
  // Telegram shows the square card, like the site. X crops pictures to 2:1, so it gets the wide one.
  const og = own ? pic('square') : site + '/img/og-wish.png';
  const tw = own ? pic('wide') : site + '/img/og-wish.png';
  const ogSize = own ? [1200, 1200] : [1200, 630];
  // as few words as possible: the picture says the rest
  const title = lang === 'ar' ? 'الأمنية رقم ' + id : 'Wish No. ' + id;

  const html = `<!doctype html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(site + '/w/' + id + (lang === 'ar' ? '/ar' : ''))}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(site + '/w/' + id + (lang === 'ar' ? '/ar' : ''))}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:width" content="${ogSize[0]}">
<meta property="og:image:height" content="${ogSize[1]}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@MoonEmpirE0">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:image" content="${esc(tw)}">
<script>location.replace(${JSON.stringify(wall)});</script>
</head>
<body><p><a href="${esc(wall)}">${esc(title)}</a></p></body>
</html>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=600');
  res.end(html);
};
