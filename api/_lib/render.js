// Runs the site's own card drawing code (assets/onewish/card.js) on the server, so the preview is the same card.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createCanvas, GlobalFonts, Path2D } = require('@napi-rs/canvas');
const { ROOT } = require('./wish');

const FONTS = path.join(__dirname, 'fonts');
[
  ['Baskerville-Regular.ttf', 'Libre Baskerville'],
  ['Baskerville-Italic.ttf', 'Libre Baskerville'],
  ['Naskh-Regular.ttf', 'Noto Naskh Arabic'],
  ['Naskh-SemiBold.ttf', 'Noto Naskh Arabic'],
  ['Emoji-Regular.ttf', 'Noto Emoji'],
].forEach(([file, family]) => GlobalFonts.registerFromPath(path.join(FONTS, file), family));

// The few browser things card.js uses.
const sandbox = {
  Path2D,
  document: { createElement: () => createCanvas(1, 1), fonts: { load: async () => [] } },
  WishCardFontTail: ', "Noto Emoji"', // emoji in one ink colour; the server has no colour emoji font
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const run = (file) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'onewish', file), 'utf8'), sandbox, { filename: file });
sandbox.WishLogic = require(path.join(ROOT, 'assets', 'onewish', 'logic.js'));
run('i18n.js');
run('card.js');

// shape: 'square' = the card people see on the site (Telegram), 'wide' = 1200×630 (X crops to that)
async function renderCard(w, lang, shape) {
  const canvas = createCanvas(1200, 1200);
  await sandbox.WishCard.draw(canvas, {
    num: w.num, name: w.name, wish: w.wish, lang, host: 'genie-coin.com',
    t: sandbox.WishI18n[lang], wide: shape === 'wide',
  });
  return canvas.encode('jpeg', 90);
}

module.exports = { renderCard };
