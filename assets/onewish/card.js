// Draws the 1200×1200 share card onto a canvas: the wish first, then the name, "No. n", the Lamp and the site.
// With d.title it draws the 1200×630 link-preview image instead (tools/og-card.html).
// With d.wide it draws one wish as a 1200×630 picture for X (api/card.js runs this file on the server).
(function () {
  'use strict';
  const L = window.WishLogic;
  const W = 1200, H = 1200, PREVIEW_H = 630;
  const INK = '#0B1A48', PAPER = '#F8F3E7';
  const FOIL = ['#7F5D14', '#B98F34', '#7A5912', '#BE9639', '#765510']; // the only gold on the card
  const WISH_W = 972, NAME_W = 900, MARGIN = 92;

  const TAIL = window.WishCardFontTail || ''; // the server adds its emoji font here
  const arabic = (z) => '600 ' + z + 'px "Noto Naskh Arabic"' + TAIL + ', serif';
  const roman = (z) => '400 ' + z + 'px "Libre Baskerville", "Noto Naskh Arabic"' + TAIL + ', serif';
  const italic = (z) => 'italic ' + roman(z);
  const fontFor = (text, arabicScale) => (z) => (L.textDir(text) === 'rtl' ? arabic(Math.round(z * arabicScale)) : roman(z));

  // The silhouette is traced from img/lamp-gold.webp, so it stays the same Lamp. axis = x of the finial and foot.
  const LAMP = {
    w: 900, h: 542, axis: 476,
    shape: 'M477 14Q481 10 482 10Q483 10 485 11Q486 13 495 32Q505 51 504 54Q504 56 497 68Q491 80 494 85Q498 90 497 97Q497 104 502 109Q507 114 512 120Q516 126 519 135Q522 144 523 152Q525 159 528 162Q532 164 533 168Q535 172 540 175Q545 179 551 186Q557 192 579 197Q602 202 606 196Q610 190 614 188Q617 185 621 185Q625 184 629 186Q634 187 638 192Q642 197 644 197Q645 197 657 190Q670 183 699 164Q728 144 739 138Q750 132 756 130Q762 128 770 126Q779 124 786 124Q794 124 799 125Q803 126 814 129Q824 133 832 139Q840 145 847 151Q853 158 860 166Q866 175 872 186Q878 197 882 209Q886 222 888 231Q890 241 890 250Q890 258 888 265Q886 273 882 278Q879 284 871 289Q864 294 859 296Q853 298 838 302Q823 306 778 313Q734 320 708 326Q683 333 666 339Q649 345 642 350Q634 354 630 357Q627 360 623 367Q620 375 616 378Q613 382 609 383Q605 384 603 383Q600 383 598 381Q595 380 594 377Q592 375 593 370Q593 366 584 371Q575 377 565 382Q556 387 546 391Q536 394 526 398Q516 401 510 412Q504 423 505 425Q505 426 508 428Q510 430 512 434Q513 438 524 443Q535 448 548 456Q560 465 568 467Q577 468 582 471Q587 473 590 475Q592 478 594 481Q595 484 596 486Q596 489 595 493Q594 497 591 501Q588 505 585 507Q582 509 577 512Q572 515 562 519Q551 522 528 527Q505 531 494 532Q482 533 470 533Q457 533 432 530Q408 527 393 523Q379 519 370 516Q361 512 356 508Q352 505 348 502Q345 498 344 495Q343 492 342 490Q342 487 343 484Q344 480 349 476Q353 472 357 470Q362 469 370 467Q378 465 392 456Q406 447 417 443Q428 438 429 434Q431 430 434 428Q437 426 437 424Q437 423 433 413Q429 403 428 402Q427 401 413 397Q400 393 390 390Q380 386 368 379Q355 373 340 363Q324 353 293 329Q261 305 244 292Q226 279 204 266Q183 253 170 247Q157 240 141 234Q125 229 107 225Q89 221 74 220Q59 220 38 222Q17 225 14 224Q11 222 10 220Q9 218 10 216Q10 214 12 211Q15 208 21 203Q27 198 33 195Q38 191 45 188Q52 185 61 184Q69 182 77 182Q85 182 105 184Q124 187 137 190Q150 193 184 202Q219 212 237 216Q256 219 263 220Q270 220 287 220Q304 219 321 216Q338 213 356 209Q373 204 388 200Q402 195 406 190Q411 184 419 178Q427 172 429 168Q431 165 434 162Q438 160 440 150Q442 141 444 135Q446 129 450 122Q455 116 460 110Q466 105 466 98Q466 91 466 89Q467 87 470 84Q472 81 472 80Q473 79 466 68Q459 56 459 54Q458 51 466 35Q474 18 477 14ZM786 177Q776 177 758 182Q741 187 728 192Q715 197 705 203Q694 208 676 219Q657 229 657 231Q657 232 659 239Q661 246 661 253Q661 260 660 267Q658 273 654 286Q650 299 640 314Q631 330 647 323Q662 315 678 309Q695 303 716 296Q737 290 780 280Q823 270 829 268Q835 266 841 262Q847 258 850 252Q853 245 853 236Q853 226 850 217Q846 209 841 203Q836 197 829 191Q822 186 815 183Q807 180 801 178Q795 177 786 177Z',
    cuts: [
      'M394 219C430 250 530 250 564 215',
      'M262 244C340 272 440 292 500 288C560 284 615 270 645 250',
      'M438 444Q472 458 506 444',
    ],
  };

  function drawLamp(ctx, centerX, bottom, width) {
    const s = width / LAMP.w, h = LAMP.h * s;
    const o = document.createElement('canvas');
    o.width = Math.ceil(width);
    o.height = Math.ceil(h);
    const c = o.getContext('2d');
    c.scale(s, s);
    const foil = c.createLinearGradient(0, 0, LAMP.w, LAMP.h * 0.6);
    FOIL.forEach((col, i) => foil.addColorStop(i / (FOIL.length - 1), col));
    c.fillStyle = foil;
    c.fill(new Path2D(LAMP.shape), 'evenodd');
    // the cut lines and the spout's opening let the paper show through
    c.globalCompositeOperation = 'destination-out';
    c.lineCap = 'round';
    c.lineWidth = 3 / s;
    LAMP.cuts.forEach((d) => c.stroke(new Path2D(d)));
    c.beginPath();
    c.ellipse(44, 204, 19, 6.5, -0.2, 0, Math.PI * 2);
    c.fill();
    ctx.drawImage(o, centerX - LAMP.axis * s, bottom - h);
  }

  // Warm paper with a faint, soft mottle. No per-pixel grain: it keeps edges crisp after JPEG and draws fast.
  function drawPaper(ctx, height) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, height);
    const tile = document.createElement('canvas');
    tile.width = tile.height = 150;
    const c = tile.getContext('2d');
    const im = c.createImageData(150, 150);
    let seed = 7; // same card, same pixels
    for (let i = 0; i < im.data.length; i += 4) {
      seed = (seed + 0x6D2B79F5) | 0;
      let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      im.data[i] = 108;
      im.data[i + 1] = 88;
      im.data[i + 2] = 52;
      im.data[i + 3] = (((x ^ (x >>> 14)) >>> 0) / 4294967296) * 3;
    }
    c.putImageData(im, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tile, 0, 0, W, W);
  }

  function setType(ctx, font, dir) {
    ctx.font = font;
    ctx.direction = dir;
    ctx.fontKerning = 'normal';
  }

  // Greedy wrap, then a narrower measure while the line count holds, so the lines come out even.
  function wrapEven(text, maxW, measure) {
    const lines = L.wrapText(text, maxW, measure, 999);
    const widest = Math.max(...text.split(' ').map(measure));
    if (lines.length < 2 || widest > maxW) return lines; // a word too long for a line stays split as wrapText did it
    let lo = Math.max(maxW * 0.45, widest), hi = maxW;
    for (let i = 0; i < 12; i++) {
      const m = (lo + hi) / 2;
      if (L.wrapText(text, m, measure, 999).length === lines.length) hi = m; else lo = m;
    }
    return L.wrapText(text, hi, measure, 999);
  }

  const aloneAtEnd = (lines) => lines.length > 1 && !lines[lines.length - 1].includes(' ');

  // Pulls the word before a lone last word down to join it, if the two fit on one line.
  function settleLastWord(lines, maxW, measure) {
    const prev = lines[lines.length - 2];
    if (!aloneAtEnd(lines) || !prev.includes(' ')) return lines;
    const cut = prev.lastIndexOf(' ');
    const pulled = prev.slice(cut + 1) + ' ' + lines[lines.length - 1];
    return measure(pulled) > maxW ? lines : [...lines.slice(0, -2), prev.slice(0, cut), pulled];
  }

  // Largest size whose block fits, with more air around a shorter wish. Nothing is cut: it shrinks until it fits.
  function fitWish(ctx, wish, boxH) {
    const dir = L.textDir(wish), ar = dir === 'rtl';
    const font = ar ? arabic : /[\u0600-\u06FF]/.test(wish) ? roman : italic; // Arabic has no italic: a mixed wish stands upright
    const n = [...wish].length;
    const longness = Math.max(0, Math.min(1, (n - 100) / 180));
    const fill = ar ? 0.6 + 0.35 * longness : 0.72 + 0.28 * longness;
    const leading = (z) => (ar ? 1.6 : Math.min(1.36, Math.max(1.18, 1.36 - (z - 66) * 0.0053)));
    const measure = (s) => ctx.measureText(s).width;
    const maxW = WISH_W + (W - 2 * MARGIN - WISH_W) * longness; // a long wish may use the full width
    const layout = (z) => {
      setType(ctx, font(z), dir);
      const lines = settleLastWord(wrapEven(wish, maxW, measure), maxW, measure);
      return { size: z, dir, lines, lh: z * leading(z), font: font(z), height: z * 1.05 + (lines.length - 1) * z * leading(z) };
    };
    let size = Math.floor(Math.min(124, Math.sqrt((maxW * boxH * fill) / (n * 0.54))) / 2) * 2;
    for (; ; size -= 2) {
      const fit = layout(size);
      if (fit.height <= boxH * (0.72 + 0.28 * longness) || size <= 16) {
        // a little smaller is better than one word alone on the last line
        for (let z = size; z >= size * 0.85; z -= 2) {
          const smaller = layout(z);
          if (!aloneAtEnd(smaller.lines)) return smaller;
        }
        return layout(size);
      }
    }
  }

  // Real quotation marks hang outside the text edge, so the words themselves stay centred.
  function drawWish(ctx, fit, top) {
    const rtl = fit.dir === 'rtl';
    const open = rtl ? '«' : '“', close = rtl ? '»' : '”';
    const kern = rtl ? 0 : -0.07 * fit.size;
    setType(ctx, fit.font, fit.dir);
    ctx.textAlign = 'left';
    fit.lines.forEach((ln, i) => {
      const y = top + fit.size * 0.86 + i * fit.lh;
      const w = ctx.measureText(ln).width;
      const left = (W - w) / 2;
      ctx.fillText(ln, left, y);
      if (i === 0) ctx.fillText(open, rtl ? left + w : left - ctx.measureText(open).width, y);
      if (i === fit.lines.length - 1) ctx.fillText(close, rtl ? left - ctx.measureText(close).width - kern : left + w + kern, y);
    });
  }

  // One line that shrinks to fit. Its direction comes from the text itself, not the page language.
  function drawLine(ctx, text, fontAt, size, x, y, align, maxW) {
    const dir = L.textDir(text);
    let z = size;
    setType(ctx, fontAt(z), dir);
    while (ctx.measureText(text).width > maxW && z > 14) {
      z -= 1;
      setType(ctx, fontAt(z), dir);
    }
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  // The Lamp as a maker's mark in the middle, with a quiet line on each side of it.
  function drawFoot(ctx, start, end, rtl, baseline, size, lampW) {
    drawLamp(ctx, W / 2, baseline + 8, lampW);
    ctx.fillStyle = INK;
    // one regular weight for both lines: digits and Latin in Libre Baskerville, Arabic letters falling back to Noto Naskh Arabic
    drawLine(ctx, start, roman, size, rtl ? W - MARGIN : MARGIN, baseline, rtl ? 'right' : 'left', 360);
    drawLine(ctx, end, roman, size, rtl ? MARGIN : W - MARGIN, baseline, rtl ? 'left' : 'right', 360);
  }

  function drawCard(ctx, d, host) {
    const wish = L.cleanText(d.wish), name = L.cleanText(d.name);
    const areaTop = 90, areaBottom = 936;
    const fit = fitWish(ctx, wish, areaBottom - areaTop - 130);
    // the name grows with the wish, but the wish stays the largest thing
    const nameSize = Math.round(Math.min(fit.size * 0.9, Math.max(60, Math.min(76, fit.size * 0.6))));
    const arabicScale = Math.min(1.35, (fit.size * 0.85) / nameSize);
    const gap = nameSize + 46 + (hasArabic(wish) ? fit.size * 0.35 : 0); // Arabic letters reach far below the line
    const top = areaTop + (areaBottom - areaTop - gap - fit.height) * 0.46;
    ctx.fillStyle = INK;
    drawWish(ctx, fit, top);
    drawLine(ctx, name, fontFor(name, arabicScale), nameSize, W / 2, top + fit.height + gap - 10, 'center', NAME_W);
    drawFoot(ctx, d.t.card_title.replace('{n}', d.num), host, d.lang === 'ar', H - 100, 40, 204);
  }

  const hasArabic = (s) => /[؀-ۿ]/.test(s);

  // The same card laid out wide: the wish and the name, then "No. n", the Lamp and the site on one line.
  function drawWide(ctx, d, host) {
    const wish = L.cleanText(d.wish), name = L.cleanText(d.name);
    const footY = PREVIEW_H - 40, top0 = 30, bottom0 = footY - 78;
    const fit = fitWish(ctx, wish, bottom0 - top0 - 64);
    const nameSize = Math.round(Math.max(32, Math.min(44, fit.size * 0.5)));
    const gap = nameSize + 20 + (hasArabic(wish) ? fit.size * 0.3 : 0);
    const top = top0 + (bottom0 - top0 - gap - fit.height) * 0.5;
    ctx.fillStyle = INK;
    drawWish(ctx, fit, top);
    drawLine(ctx, name, fontFor(name, 1.2), nameSize, W / 2, top + fit.height + gap - 6, 'center', NAME_W);
    const rtl = d.lang === 'ar', side = 76;
    drawLamp(ctx, W / 2, footY + 6, 118);
    ctx.fillStyle = INK;
    const label = d.t.card_title.replace('{n}', d.num);
    drawLine(ctx, rtl ? host : label, roman, 28, W / 2 - side, footY, 'right', 340);
    drawLine(ctx, rtl ? label : host, roman, 28, W / 2 + side, footY, 'left', 340);
  }

  function drawPreview(ctx, d, host) {
    const rtl = L.textDir(d.title) === 'rtl';
    const measure = (s) => ctx.measureText(s).width;
    ctx.fillStyle = INK;
    drawLine(ctx, d.title, rtl ? arabic : italic, 104, W / 2, 196, 'center', WISH_W);
    const font = rtl ? arabic(44) : roman(36);
    setType(ctx, font, rtl ? 'rtl' : 'ltr');
    ctx.textAlign = 'center';
    wrapEven(L.cleanText(d.wish), WISH_W, measure).forEach((ln, i) => ctx.fillText(ln, W / 2, 288 + i * 56));
    drawFoot(ctx, d.byline, host, rtl, PREVIEW_H - 54, 34, 172);
  }

  // d = { num, name, wish, lang, host, t: strings for d.lang }
  // Optional d.title / d.byline (with d.wish as one sentence) make it the link-preview image.
  async function draw(canvas, d) {
    const preview = !!d.title || !!d.wide;
    const host = String(d.host || '').replace(/^www\./i, '');
    const label = d.title ? '' : d.t.card_title.replace('{n}', d.num);
    const text = [d.title, d.byline, d.name, d.wish, label, host, '“”«»'].filter(Boolean).join(' ');
    try {
      await Promise.all([roman(40), italic(40), arabic(40)].map((f) => document.fonts.load(f, text)));
    } catch (e) { /* fall back to system fonts */ }
    if (d.isStale && d.isStale()) return canvas; // a newer draw has started

    canvas.width = W;
    canvas.height = preview ? PREVIEW_H : H;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';
    drawPaper(ctx, canvas.height);
    if (d.wide) drawWide(ctx, d, host);
    else if (preview) drawPreview(ctx, d, host);
    else drawCard(ctx, d, host);
    return canvas;
  }

  function toBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  window.WishCard = { draw, toBlob };
})();
