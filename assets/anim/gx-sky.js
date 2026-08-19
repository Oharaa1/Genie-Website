/* ============================================================
   GX-SKY — the living background and the seams between sections.
   Builds: one fixed .gx-sky layer (the breathing wash lives in CSS
   on its pseudo-elements), one <canvas> starfield inside it, and a
   pair of drifting sand bands inside each existing div.tear.
   Everything is decorative, pointer-events:none, and behind content.
   ============================================================ */
(function(){
"use strict";

var GX = window.GX;
if(!GX) return;                       /* core missing -> stay silent */

/* the two moods of the lamp, as raw rgb triplets for the sprites */
var GOLD = "251,180,23";
var BLUE = "43,169,224";

GX.ready(function(){
  var root = GX.el("div", GX.reduced ? "gx-sky gx-sky-still" : "gx-sky", document.body);
  root.setAttribute("aria-hidden", "true");
  if(GX.reduced) return;              /* wash only, frozen. no canvas, no drift. */
  buildStars(root);
  buildSeams();
});


/* ============================================================
   1. THE STARFIELD
   Soft, slow, far away — the CSS .twinkle stars and the .dust
   cursor trail already own "sparkle up close", so these motes are
   deliberately blurrier, dimmer and an order of magnitude slower.
   ============================================================ */
function buildStars(root){
  var cv  = GX.el("canvas", "gx-sky-stars", root);
  var ctx = cv.getContext && cv.getContext("2d");
  if(!ctx){ root.removeChild(cv); return; }

  var sprGold = sprite(GOLD), sprBlue = sprite(BLUE);
  var stars = [], W = 0, H = 0, dpr = 1, count = 0;
  var mx = -9999, my = -9999, pointerOn = false;
  var R = 150, R2 = R * R;            /* cursor influence radius */
  var scrolled = 0, last = 0;
  var stop = null, tabVisible = !document.hidden, onScreen = true;

  size();

  /* ---- sizing: DPR-aware, re-seeded only when the budget changes ---- */
  function targetCount(){
    var n = Math.round((innerWidth * innerHeight) / 26000);
    if(GX.touch || innerWidth < 700) n = Math.round(n * .38);
    return GX.clamp(n, 10, 54);       /* tens, never thousands */
  }

  function size(){
    W = innerWidth; H = innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width  = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var want = targetCount();
    if(want !== count){ count = want; seed(); }
    else clampStars();
  }

  function seed(){
    stars.length = 0;
    for(var i = 0; i < count; i++) stars.push(makeStar());
  }

  function makeStar(){
    /* depth 0..1 — far motes are smaller, dimmer, slower, and barely
       react to the cursor. that gradient is what sells the distance. */
    var d = GX.rand(.18, 1);
    return {
      x:  GX.rand(0, W),
      y:  GX.rand(0, H),
      d:  d,
      r:  GX.lerp(3.5, 13, d * d),          /* drawn radius, px */
      a:  GX.lerp(.07, .2, d),              /* peak alpha        */
      vx: GX.rand(-.09, .09) * (.35 + d),
      vy: GX.rand(-.07, .03) * (.35 + d),   /* a faint upward bias */
      ph: GX.rand(0, 6.28),
      tw: GX.rand(.004, .013),              /* ~8-26s breath cycle */
      ox: 0, oy: 0,
      img: Math.random() < .74 ? sprGold : sprBlue
    };
  }

  function clampStars(){
    for(var i = 0; i < stars.length; i++){
      stars[i].x = GX.clamp(stars[i].x, -40, W + 40);
      stars[i].y = GX.clamp(stars[i].y, -40, H + 40);
    }
  }

  /* one 64px soft dot per colour, drawn once — per-frame radial
     gradients would be the expensive way to do exactly this */
  function sprite(rgb){
    var s = document.createElement("canvas"), r = 32;
    s.width = s.height = r * 2;
    var c = s.getContext("2d");
    var g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0,   "rgba(" + rgb + ",1)");
    g.addColorStop(.26, "rgba(" + rgb + ",.5)");
    g.addColorStop(.6,  "rgba(" + rgb + ",.12)");
    g.addColorStop(1,   "rgba(" + rgb + ",0)");
    c.fillStyle = g;
    c.fillRect(0, 0, r * 2, r * 2);
    return s;
  }

  /* ---- the frame ---- */
  function frame(t){
    var dt = last ? GX.clamp((t - last) / 16.667, 0, 3) : 1;
    last = t;
    ctx.clearRect(0, 0, W, H);

    var span = H + 80;
    for(var i = 0; i < stars.length; i++){
      var p = stars[i];

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if(p.x < -40)     p.x = W + 40;
      else if(p.x > W + 40) p.x = -40;
      if(p.y < -40)     p.y = H + 40;
      else if(p.y > H + 40) p.y = -40;

      /* the cursor parts the motes — near ones swing wide, far ones
         barely notice, and everything eases back when you leave */
      var px = 0, py = 0;
      if(pointerOn){
        var dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
        if(d2 < R2){
          var dist = Math.sqrt(d2) || .001;
          var f = 1 - dist / R;
          f = f * f * 30 * p.d;
          px = dx / dist * f; py = dy / dist * f;
        }
      }
      p.ox += (px - p.ox) * .055 * dt;
      p.oy += (py - p.oy) * .055 * dt;

      /* parallax: the layer slides against the page, depth-scaled */
      var sy = (p.y + p.oy - scrolled * p.d * .05) % span;
      if(sy < 0) sy += span;
      sy -= 40;

      p.ph += p.tw * dt;
      var alpha = p.a * (.6 + .4 * Math.sin(p.ph));
      if(alpha < .012) continue;

      ctx.globalAlpha = alpha;
      ctx.drawImage(p.img, p.x + p.ox - p.r, sy - p.r, p.r * 2, p.r * 2);
    }
    ctx.globalAlpha = 1;
  }

  /* ---- run / pause: hidden tab or off-screen canvas costs nothing ---- */
  function sync(){
    var should = tabVisible && onScreen;
    if(should && !stop){ last = 0; stop = GX.tick(frame); }
    else if(!should && stop){ stop(); stop = null; ctx.clearRect(0, 0, W, H); }
  }

  document.addEventListener("visibilitychange", function(){
    tabVisible = !document.hidden; sync();
  });
  GX.io(cv, function(vis){ onScreen = vis; sync(); }, {threshold:0, once:false});

  /* scroll + resize come pre-throttled from the core */
  GX.scroll(function(y){
    scrolled = y;
    if(innerWidth !== W || innerHeight !== H) size();
  });

  /* desktop only — a finger has no hover, and touch already gets .dust */
  if(!GX.touch){
    addEventListener("pointermove", function(e){
      if(e.pointerType === "touch") return;
      mx = e.clientX; my = e.clientY; pointerOn = true;
    }, {passive:true});
    document.addEventListener("pointerleave", function(){ pointerOn = false; });
    addEventListener("blur", function(){ pointerOn = false; });
  }

  sync();
}


/* ============================================================
   2. THE SEAMS
   div.tear already carries the zigzag clip-path, so anything we
   drop inside is cut to the torn silhouette automatically. Two
   bands cross each other as the tear travels the viewport —
   driven by GX.progress, so it answers to scroll, not to a clock.
   ============================================================ */
function buildSeams(){
  var tears = document.querySelectorAll(".tear");
  if(!tears.length) return;

  var items = [], i;
  for(i = 0; i < tears.length; i++){
    var a = GX.el("span", "gx-sky-seam", tears[i]);
    var b = GX.el("span", "gx-sky-seam gx-sky-seam-b", tears[i]);
    a.setAttribute("aria-hidden", "true");
    b.setAttribute("aria-hidden", "true");
    items.push({ tear: tears[i], a: a, b: b });
  }

  var prog = [];
  GX.scroll(function(){
    /* read every rect first, then write — no layout thrash */
    for(var k = 0; k < items.length; k++) prog[k] = GX.progress(items[k].tear);

    for(k = 0; k < items.length; k++){
      var it = items[k], t = prog[k];
      /* bell curve: nothing at the edges of travel, fullest mid-screen */
      var e = Math.sin(Math.PI * t); e = e * e;
      it.a.style.opacity   = (e * .85).toFixed(3);
      it.a.style.transform = "translate3d(" + (t * 170 - 85).toFixed(2) + "%,0,0)";
      it.b.style.opacity   = (e * .5).toFixed(3);
      it.b.style.transform = "translate3d(" + (70 - t * 150).toFixed(2) + "%,0,0)";
    }
  });
}

})();
