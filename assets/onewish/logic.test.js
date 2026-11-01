// Run: node --test assets/onewish/logic.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

test('parseCost accepts common ways people type money', () => {
  assert.equal(L.parseCost('2400'), 2400);
  assert.equal(L.parseCost('2,400'), 2400);
  assert.equal(L.parseCost('$2,400'), 2400);
  assert.equal(L.parseCost('2400$'), 2400);
  assert.equal(L.parseCost(' 2 400 USD '), 2400);
  assert.equal(L.parseCost('٢٤٠٠'), 2400);          // Arabic-Indic digits
  assert.equal(L.parseCost('٢٬٤٠٠ دولار'), 2400);    // Arabic thousands sep + word
  assert.equal(L.parseCost('۲۴۰۰'), 2400);           // Persian digits
  assert.equal(L.parseCost('99.6'), 100);            // rounds to whole dollars
  assert.ok(Number.isNaN(L.parseCost('')));
  assert.ok(Number.isNaN(L.parseCost('a lot')));
  assert.ok(Number.isNaN(L.parseCost('12abc')));
});

test('formatCostInput adds commas and keeps the cursor after the same digit', () => {
  assert.deepEqual(L.formatCostInput('2400', 4), { value: '2,400', caret: 5 });
  assert.deepEqual(L.formatCostInput('٢٤٠٠', 4), { value: '2,400', caret: 5 });   // Arabic digits → Western
  assert.deepEqual(L.formatCostInput('2,4005', 6), { value: '24,005', caret: 6 });
  assert.deepEqual(L.formatCostInput('12345', 2), { value: '12,345', caret: 2 });  // typing in the middle
  assert.deepEqual(L.formatCostInput('1000000', 7), { value: '1,000,000', caret: 9 });
  assert.deepEqual(L.formatCostInput('007', 3), { value: '7', caret: 1 });
  assert.deepEqual(L.formatCostInput('', 0), { value: '', caret: 0 });
  assert.deepEqual(L.formatCostInput('$2400', 5), { value: '$2400', caret: 5 });   // not a plain number: left alone
  assert.deepEqual(L.formatCostInput('99.5', 4), { value: '99.5', caret: 4 });
});

test('linkPlatform tells X and Telegram links apart', () => {
  assert.equal(L.linkPlatform('https://t.me/sara_wish'), 'telegram');
  assert.equal(L.linkPlatform('telegram.me/sara_wish'), 'telegram');
  assert.equal(L.linkPlatform(' https://www.x.com/Sara_99 '), 'x');
  assert.equal(L.linkPlatform('mobile.twitter.com/Sara_99'), 'x');
  assert.equal(L.linkPlatform('@sara_wish'), null);
  assert.equal(L.linkPlatform('sara_wish'), null);
  assert.equal(L.linkPlatform('x.com/'), null);   // still typing the link: wait for the name
});

test('normalizeHandle strips @, spaces and profile links', () => {
  assert.equal(L.normalizeHandle('x', '@Sara_99'), 'Sara_99');
  assert.equal(L.normalizeHandle('x', ' https://x.com/Sara_99/ '), 'Sara_99');
  assert.equal(L.normalizeHandle('x', 'twitter.com/Sara_99?s=21'), 'Sara_99');
  assert.equal(L.normalizeHandle('telegram', 'https://t.me/sara_wish'), 'sara_wish');
  assert.equal(L.normalizeHandle('telegram', 'telegram.me/sara_wish'), 'sara_wish');
  assert.equal(L.normalizeHandle('telegram', '@sara_wish'), 'sara_wish');
});

test('validHandle follows each platform rules', () => {
  assert.ok(L.validHandle('x', 'Sara_99'));
  assert.ok(L.validHandle('x', 'a'));
  assert.ok(!L.validHandle('x', 'this_is_way_too_long_for_x'));
  assert.ok(!L.validHandle('x', 'bad-dash'));
  assert.ok(L.validHandle('telegram', 'sara_wish'));
  assert.ok(!L.validHandle('telegram', 'abc'));        // too short
  assert.ok(!L.validHandle('telegram', '9starts_digit'));
  assert.ok(!L.validHandle('facebook', 'Sara_99'));
});

test('validateWish returns clean values when everything is fine', () => {
  const r = L.validateWish({
    name: '  Sara  ', wish: '  Pay for my   mother\'s surgery  ',
    cost: '$2,400', platform: 'x', handle: '@Sara_99',
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.value, {
    name: 'Sara', wish: 'Pay for my mother\'s surgery',
    cost: 2400, platform: 'x', handle: 'Sara_99',
  });
});

test('validateWish flags each bad field with a code', () => {
  const r = L.validateWish({ name: '', wish: 'short', cost: '0', platform: 'x', handle: 'bad-dash' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, {
    name: 'name_required', wish: 'wish_short', cost: 'cost_range', handle: 'handle_invalid',
  });
  const r2 = L.validateWish({
    name: 'x'.repeat(41), wish: 'w'.repeat(281), cost: 'lots', platform: 'telegram', handle: 'sara_wish',
  });
  assert.deepEqual(r2.errors, { name: 'name_long', wish: 'wish_long', cost: 'cost_invalid' });
  const r3 = L.validateWish({ name: 'Sara', wish: 'A real wish here', cost: '2000000', platform: 'x', handle: 'Sara' });
  assert.deepEqual(r3.errors, { cost: 'cost_range' });
});

test('validateWish strips control characters and counts emoji as one', () => {
  const r = L.validateWish({ name: 'Sa\u0000ra', wish: '🧞'.repeat(280), cost: '5', platform: 'x', handle: 'Sara' });
  assert.equal(r.value.name, 'Sara');
  assert.equal(r.errors.wish, undefined);
});

test('lampProgress never shows full before it is full', () => {
  assert.deepEqual(L.lampProgress(0, 2400), { pct: 0, full: false });
  assert.deepEqual(L.lampProgress(1512, 2400), { pct: 63, full: false });
  assert.deepEqual(L.lampProgress(2399, 2400), { pct: 99, full: false });
  assert.deepEqual(L.lampProgress(2400, 2400), { pct: 100, full: true });
  assert.deepEqual(L.lampProgress(5000, 2400), { pct: 100, full: true });
  assert.deepEqual(L.lampProgress(10, 0), { pct: 0, full: false });
  assert.deepEqual(L.lampProgress(-5, 100), { pct: 0, full: false });
});

test('formatUSD uses plain digits and no cents', () => {
  assert.equal(L.formatUSD(2400), '$2,400');
  assert.equal(L.formatUSD(1512.6), '$1,513');
  assert.equal(L.formatUSD(0), '$0');
});

test('serverErrorCode maps database errors to friendly codes', () => {
  assert.equal(L.serverErrorCode({ message: 'already_wished' }), 'already_wished');
  assert.equal(L.serverErrorCode({ message: 'rate_limited' }), 'rate_limited');
  assert.equal(L.serverErrorCode({ message: 'invalid_wish' }), 'invalid');
  assert.equal(L.serverErrorCode({ message: 'invalid_key' }), 'bad_key');
  assert.equal(L.serverErrorCode({ message: 'wish_locked' }), 'locked');
  assert.equal(L.serverErrorCode({ message: 'Failed to fetch' }), 'network');
  assert.equal(L.serverErrorCode(null), 'network');
});

test('textDir follows the first strong letter', () => {
  assert.equal(L.textDir('أريد بيتاً'), 'rtl');
  assert.equal(L.textDir('123 أريد'), 'rtl');
  assert.equal(L.textDir('I want a house'), 'ltr');
  assert.equal(L.textDir('🧞 house بيت'), 'ltr');
  assert.equal(L.textDir('2400'), 'ltr');
});

test('wrapText fits lines and adds an ellipsis when cut', () => {
  const measure = (s) => s.length * 10; // 10px per character
  assert.deepEqual(L.wrapText('one two three', 1000, measure, 3), ['one two three']);
  assert.deepEqual(L.wrapText('one two three four', 90, measure, 3), ['one two', 'three', 'four']);
  assert.deepEqual(L.wrapText('one two three four five six', 90, measure, 2), ['one two', 'three…']);
  // a single word longer than the line is hard-cut
  assert.deepEqual(L.wrapText('abcdefghijkl', 50, measure, 2), ['abcde', 'fghi…']);
});

test('pickLang prefers saved choice, then browser language', () => {
  assert.equal(L.pickLang(['ar-IQ', 'en'], null), 'ar');
  assert.equal(L.pickLang(['en-US'], null), 'en');
  assert.equal(L.pickLang(['en-US'], 'ar'), 'ar');
  assert.equal(L.pickLang(['ar'], 'en'), 'en');
  assert.equal(L.pickLang([], 'xx'), 'en');
});

test('pickLang lets a ?lang= link win over everything', () => {
  assert.equal(L.pickLang(['en-US'], 'en', 'ar'), 'ar');
  assert.equal(L.pickLang(['ar'], 'ar', 'en'), 'en');
  assert.equal(L.pickLang(['ar'], null, 'fr'), 'ar');
});

test('share links carry text and url, encoded', () => {
  const x = L.xShareUrl('Wish #7 🧞', 'https://genie-coin.com/');
  assert.equal(x, 'https://x.com/intent/tweet?text=Wish%20%237%20%F0%9F%A7%9E&url=https%3A%2F%2Fgenie-coin.com%2F');
  const t = L.telegramShareUrl('Wish #7', 'https://genie-coin.com/');
  assert.equal(t, 'https://t.me/share/url?url=https%3A%2F%2Fgenie-coin.com%2F&text=Wish%20%237');
});
