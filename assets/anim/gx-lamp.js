/* ============================================================
   GX-LAMP — makes the lamp section feel like a working machine.

   1. #meterFill tracks how far you've read the section
   2. gold coins dropping into the spout on a slow rhythm
   3. a faint breath + last-digit glint on the $1,000,000 odometer
   (ambient smoke and the scrollytelling pin were both dropped —
    the section stays calm until the lamp is actually rubbed.)

   Creates only decorative nodes inside #lampStage. Never writes
   transform to #lampHold (the rub spring owns that node).
   ============================================================ */
(function(){
"use strict";

var GX = window.GX;
if(!GX) return;                                   /* fail silently */

GX.ready(function(){

  var stage = document.getElementById("lampStage"),
      lamp  = document.getElementById("lampImg"),
      sect  = document.getElementById("lamp"),
      meter = document.getElementById("meterFill"),
      odo   = document.getElementById("odo");

  if(!stage || !sect) return;

  /* ==========================================================
     2 — THE LAMP FILLS AS YOU READ
     Nothing in index.html ever writes --fill: the markup ships a
     CSS-only default (width:var(--fill,1.2%)) and a 1.2s ease.
     So there is no second writer to fight — we simply become the
     owner of --fill, and swap the slow ease for a short linear
     one so the bar can follow the scroll without lagging.
     The "Fills at launch" chip and the progressbar's aria-valuenow
     stay untouched: this is a metaphor, not a live balance.
     ========================================================== */
  if(meter && !GX.reduced){
    var IN = .12, OUT = .74,            /* the slice of the section that fills it */
        LO = 3,   HI = 94,              /* never reads as a *full* lamp */
        lastFill = -1, first = true;

    meter.classList.add("gx-lamp-meter","gx-lamp-snap");

    GX.scroll(function(){
      var t = GX.clamp((GX.progress(sect) - IN) / (OUT - IN), 0, 1);
      t = t*t*(3 - 2*t);                                  /* smoothstep, no crawl */
      var v = Math.round((LO + t*(HI-LO)) * 2) / 2;       /* .5% steps = few layout writes */
      if(v === lastFill) return;
      lastFill = v;
      meter.style.setProperty("--fill", v + "%");
      if(first){                                          /* let the first value land hard */
        first = false;
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){ meter.classList.remove("gx-lamp-snap"); });
        });
      }
    });
  }

  /* ==========================================================
     4 — THE MILLION BREATHES
     Armed a beat after the reels have finished spinning so the
     two motions never overlap.
     ========================================================== */
  if(odo && !GX.reduced){
    GX.io(odo, function(vis){
      if(!vis) return;
      setTimeout(function(){
        odo.classList.add("gx-lamp-odo");
        var reels = odo.querySelectorAll(".odo-reel");
        if(reels.length) reels[reels.length-1].classList.add("gx-lamp-digit");
      }, 3300);
    }, {threshold:.6});
  }

  /* ==========================================================
     1 + 3 — WISPS AND COINS
     ========================================================== */
  if(GX.reduced || !lamp) return;

  var layer = GX.el("div","gx-lamp-layer",stage);
  layer.setAttribute("aria-hidden","true");

  /* no ambient smoke here on purpose — the lamp only smokes when it is
     actually rubbed, which the page's own .smoke system already owns. */
  var coins = GX.pool(5, "gx-lamp-coin", layer),
      gulp  = GX.el("span","gx-lamp-gulp",layer);

  /* --- where the spout is, in #lampStage coordinates ---
     same 13% / 30% anchor the existing rub-smoke uses. */
  var spoutX = 0, spoutY = 0, measured = false;
  function measure(){
    var lr = lamp.getBoundingClientRect();
    if(!lr.width){ measured = false; return; }         /* image not laid out yet */
    var sr = stage.getBoundingClientRect();
    spoutX = (lr.left - sr.left) + lr.width  * .13;
    spoutY = (lr.top  - sr.top ) + lr.height * .30;
    measured = true;
  }
  function stale(){ measured = false; }
  addEventListener("resize", stale, {passive:true});
  if(!lamp.complete) lamp.addEventListener("load", stale);

  var COIN_MS = 1550, gulpT = null;
  function swallow(){
    gulp.classList.remove("go");
    gulp.style.left = spoutX.toFixed(1) + "px";
    gulp.style.top  = spoutY.toFixed(1) + "px";
    void gulp.offsetWidth;
    gulp.classList.add("go");
  }
  function dropCoin(){
    if(stage.classList.contains("popping")) return;     /* stay out of the wish payoff */
    var el = coins.next();
    el.classList.remove("go");
    el.style.left = (spoutX + GX.rand(-14,14)).toFixed(1) + "px";
    el.style.top  = spoutY.toFixed(1) + "px";
    el.style.setProperty("--gx-lamp-drop", GX.rand(110,150).toFixed(0) + "px");
    void el.offsetWidth;
    el.classList.add("go");
    clearTimeout(gulpT);
    gulpT = setTimeout(swallow, COIN_MS * .82);
  }

  /* --- one shared tick, idle whenever the stage is off screen --- */
  var onScreen = false, nextCoin = 0, primed = false;

  GX.io(stage, function(vis){ onScreen = vis; }, {threshold:.05, once:false});

  GX.tick(function(t){
    if(!onScreen){ primed = false; return; }
    if(!measured){ measure(); if(!measured) return; }
    if(!primed){ primed = true; nextCoin = t + 1500; }

    if(t >= nextCoin){
      nextCoin = t + GX.rand(2400,3800);                /* a trickle, never a slot machine */
      dropCoin();
    }
  });

  /* ==========================================================
     5 — SCROLLYTELLING PIN: SKIPPED ON PURPOSE.
     Pinning needs #lampStage reparented into a sticky wrapper.
     Two things make that unsafe from JS alone:
       - grantWish() puts a transform on section#lamp (.wish.shake),
         which re-roots the containing block under a sticky child
         and makes the pinned stage jump at the exact climax;
       - the pin needs ~70vh of extra scroll track, which reflows
         the steps/CTA below and turns GX.progress(#lamp) — the
         input the meter above reads — into a frozen value.
     A broken pin is worse than none, so the section keeps its
     existing wish/grantWish payoff untouched.
     ========================================================== */
});
})();
