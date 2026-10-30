// Draws the 1200×630 share card ("WISH #128" + name + wish) onto a canvas.
(function () {
  'use strict';
  const L = window.WishLogic;
  const W = 1200, H = 630;
  const INK = '#141414', GOLD = '#FBB417', BLUE = '#2BA9E0';
  const BODY = '"Baloo 2", "Baloo Bhaijaan 2", system-ui, sans-serif';
  const AR_HEAD = '"Baloo Bhaijaan 2", "Baloo 2", system-ui, sans-serif';

  let lampPromise;
  function loadLamp() {
    lampPromise = lampPromise || new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = 'img/lamp-gold.webp';
    });
    return lampPromise.catch(() => null);
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function sparkle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
    ctx.stroke();
  }

  // Sets font + direction, then draws text aligned to the block edge that fits its direction.
  function line(ctx, text, font, dir, x0, width, y) {
    ctx.font = font;
    ctx.direction = dir;
    ctx.textAlign = dir === 'rtl' ? 'right' : 'left';
    ctx.fillText(text, dir === 'rtl' ? x0 + width : x0, y);
  }

  // d = { num, name, wish, lang, host, t: strings for d.lang }
  // Optional d.title / d.byline replace "WISH #n" / "— name" (used for the link-preview image).
  async function draw(canvas, d) {
    const ar = d.lang === 'ar';
    const title = d.title || d.t.card_title.replace('{n}', d.num);
    const titleFont = ar ? '800 88px ' + AR_HEAD : '92px "Lilita One", sans-serif';
    const ctaFont = ar ? '800 30px ' + AR_HEAD : '30px "Lilita One", sans-serif';
    try {
      await Promise.all([
        document.fonts.load(titleFont, title),
        document.fonts.load(ctaFont, d.t.card_cta),
        document.fonts.load('700 40px "Baloo 2"'),
        document.fonts.load('700 40px "Baloo Bhaijaan 2"', 'أمنية'),
      ]);
    } catch (e) { /* fall back to system fonts */ }
    const lamp = await loadLamp();
    if (d.isStale && d.isStale()) return canvas; // a newer draw has started

    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';

    // warm paper + halftone dots
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#FFFFFF');
    bg.addColorStop(0.55, '#FFFDF6');
    bg.addColorStop(1, '#FFF6E3');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(20,20,20,.06)';
    for (let y = 13; y < H; y += 26) {
      for (let x = 13; x < W; x += 26) {
        ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // lamp side (left in English, right in Arabic) with a gold sunburst behind it
    const lampX = ar ? W - 70 - 440 : 70;
    const cx = lampX + 220, cy = 320;
    ctx.save();
    ctx.translate(cx, cy);
    const fade = ctx.createRadialGradient(0, 0, 40, 0, 0, 280);
    fade.addColorStop(0, 'rgba(251,180,23,.32)');
    fade.addColorStop(1, 'rgba(251,180,23,0)');
    ctx.fillStyle = fade;
    for (let i = 0; i < 24; i++) {
      ctx.rotate((Math.PI * 2) / 24);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(290, -26); ctx.lineTo(290, 26); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (lamp) {
      const lw = 440, lh = lw * (lamp.naturalHeight / lamp.naturalWidth);
      ctx.drawImage(lamp, lampX, cy - lh / 2 + 10, lw, lh);
    }
    ctx.fillStyle = GOLD;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    [[cx - 150, cy - 170, 18], [cx + 165, cy - 120, 13], [cx + 120, cy + 175, 10], [cx - 185, cy + 120, 12]]
      .forEach(([x, y, r]) => sparkle(ctx, x, y, r));

    // text block
    const tx = ar ? 70 : 560, tw = 570;
    const dir = ar ? 'rtl' : 'ltr';

    ctx.lineJoin = 'round';
    ctx.font = titleFont;
    let size = ar ? 88 : 92;
    while (ctx.measureText(title).width > tw && size > 48) {
      size -= 4;
      ctx.font = titleFont.replace(/\d+px/, size + 'px');
    }
    const fittedTitle = ctx.font;
    ctx.direction = dir;
    ctx.textAlign = ar ? 'right' : 'left';
    ctx.lineWidth = 10;
    ctx.strokeStyle = INK;
    ctx.strokeText(title, ar ? tx + tw : tx, 165);
    ctx.fillStyle = GOLD;
    line(ctx, title, fittedTitle, dir, tx, tw, 165);

    const measure = (s) => ctx.measureText(s).width;
    ctx.font = '700 40px ' + BODY;
    const name = L.wrapText(d.byline || '— ' + d.name, tw, measure, 1)[0] || '';
    ctx.fillStyle = BLUE;
    line(ctx, name, '700 40px ' + BODY, dir, tx, tw, 228);

    const wishDir = L.textDir(d.wish);
    const quoted = wishDir === 'rtl' ? '«' + d.wish + '»' : '“' + d.wish + '”';
    ctx.font = '600 36px ' + BODY;
    const lines = L.wrapText(quoted, tw, measure, 4);
    ctx.fillStyle = INK;
    lines.forEach((ln, i) => line(ctx, ln, '600 36px ' + BODY, wishDir, tx, tw, 295 + i * 46));

    // call-to-action pill
    const cta = d.t.card_cta + ' ' + d.host;
    ctx.font = ctaFont;
    const pw = Math.min(tw, ctx.measureText(cta).width + 56), ph = 62;
    const px = ar ? tx + tw - pw : tx, py = 478;
    ctx.fillStyle = INK;
    rrect(ctx, px + 6, py + 7, pw, ph, 18); ctx.fill();
    ctx.fillStyle = BLUE;
    rrect(ctx, px, py, pw, ph, 18); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.direction = dir;
    ctx.fillText(cta, px + pw / 2, py + 42);

    // comic panel frame
    ctx.lineWidth = 8;
    ctx.strokeStyle = INK;
    rrect(ctx, 22, 22, W - 44, H - 44, 34);
    ctx.stroke();
    return canvas;
  }

  function toBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  window.WishCard = { draw, toBlob };
})();
