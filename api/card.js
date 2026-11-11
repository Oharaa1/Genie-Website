// /api/card?id=23&lang=en&shape=square&v=1 → that wish's card as a picture, for X and Telegram link previews.
// Built only from the wish number, never from words in the link. Anything not allowed gets the general picture.
'use strict';
const { CARD_VERSION, validId, validLang, getWish, ownPicture } = require('./_lib/wish');
const { renderCard } = require('./_lib/render');

const GENERAL = '/img/og-wish.png';

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const id = q.get('id'), lang = q.get('lang'), shape = q.get('shape');
  // only one exact address per picture, so nobody can make the server draw the same card again and again
  const canonical = validId(id) && validLang(lang) && (shape === 'square' || shape === 'wide') &&
    q.get('v') === CARD_VERSION && [...q.keys()].length === 4;
  if (!canonical) {
    res.statusCode = 404;
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400');
    return res.end('Not found');
  }
  let wish = null;
  try { wish = await getWish(id); } catch (e) { /* database busy: general picture for now */ }
  if (!ownPicture(wish)) {
    res.statusCode = 302;
    res.setHeader('Location', GENERAL);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.end();
  }
  const img = await renderCard(wish, lang, shape);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/jpeg');
  // saved for an hour, so a deleted wish's picture is gone within about an hour
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');
  res.end(img);
};
