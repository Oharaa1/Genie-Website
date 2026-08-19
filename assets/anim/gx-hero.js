/* ============================================================
   GX-HERO — the first three seconds of the page.

   1. Entrance   a lamp pops in, gold smoke pours out and the genie
                 condenses out of the plume (~1.6s, once per session),
                 then the page's own `bob` float takes over.
   2. Parallax   the genie leans toward the cursor, the sunburst
                 drifts the other way for depth.
   3. Sheen      gold light rides the wordmark letters every ~6.6s.
   4. Startle    flick-scroll fast and a shocked genie whips into the
                 corner for a second. Once per 20s, never more.

   Zero globals, reads window.GX only, creates every node it needs.
   ============================================================ */
(function(){
"use strict";

var GX = window.GX;
if(!GX) return;

var ROOT      = document.documentElement;
var INTRO_KEY = "gx-hero-intro";
/* the page's own resting float — we re-apply it by name because
   simply clearing the inline style would replay `genieRise` too. */
var BOB       = "bob 4.5s ease-in-out infinite";

var genie    = null;   /* img.genie, once we find it        */
var stage    = null;   /* the lamp + smoke layer we build   */
var disarmed = false;

/* ------------------------------------------------------------------
   Decide — synchronously, before the first paint — whether the
   entrance runs. Arming adds a class to <html> that silences the
   page's own genieRise/bob, so this must happen early or not at all.
   ------------------------------------------------------------------ */
var playIntro = false;
if(!GX.reduced){
  var fresh = true;
  try{
    fresh = !sessionStorage.getItem(INTRO_KEY);
    if(fresh) sessionStorage.setItem(INTRO_KEY, "1");
  }catch(e){ /* private mode — treat every visit as fresh */ }
  /* if we booted late the old entrance is already on screen; hijacking
     it now would look like a stutter, so we just let it be. */
  playIntro = fresh && performance.now() < 700;
}

if(GX.forceMotion) ROOT.className += " gx-hero-force";
if(playIntro){
  ROOT.className += " gx-hero-armed";
  /* safety net: whatever happens, the genie is never left hidden */
  setTimeout(disarm, 4000);
}

/* hand the hero back to the page's own CSS */
function disarm(){
  if(disarmed) return;
  disarmed = true;
  ROOT.className = ROOT.className.replace(/\s*gx-hero-armed\b/g, "");
  if(genie){
    genie.classList.remove("gx-hero-genie-in");
    genie.style.animation = BOB;
  }
  if(stage && stage.parentNode) stage.parentNode.removeChild(stage);
  stage = null;
}

/* ==================================================================
   BEAT 1 — the lamp, the smoke, the genie condensing out of it
   ================================================================== */
function runIntro(wrap){
  /* one read up front, then only writes — no layout thrash */
  var k = GX.clamp((wrap.offsetWidth || 260) / 300, .6, 1.3);

  stage = GX.el("div", "gx-hero-stage", wrap);
  stage.setAttribute("aria-hidden", "true");

  GX.el("div", "gx-hero-plume", stage);

  /* delay(s), x drift, rise, diameter — hand-tuned, not random, so the
     plume always pours in the same pleasing shape. */
  var puffs = [
    [ .18, -46, -166, 78],
    [ .25,  42, -196, 64],
    [ .32, -16, -212, 90],
    [ .40,  32, -150, 56],
    [ .47, -38, -186, 62],
    [ .55,  16, -226, 72]
  ];
  var i, p, n;
  for(i = 0; i < puffs.length; i++){
    p = puffs[i];
    n = GX.el("span", "gx-hero-puff", stage);
    n.style.setProperty("--gx-hero-pd", p[0] + "s");
    n.style.setProperty("--gx-hero-px", (p[1] * k).toFixed(1) + "px");
    n.style.setProperty("--gx-hero-py", (p[2] * k).toFixed(1) + "px");
    n.style.setProperty("--gx-hero-pw", (p[3] * k).toFixed(1) + "px");
    n.style.setProperty("--gx-hero-pr", (p[1] > 0 ? 22 : -22) + "deg");
  }

  /* three comic stars so the magic stays hand-drawn, not vapour */
  var sparks = [[.42, -70, -128, 22], [.52, 64, -152, 16], [.62, -22, -178, 19]];
  for(i = 0; i < sparks.length; i++){
    p = sparks[i];
    n = GX.el("span", "gx-hero-spark", stage);
    n.style.setProperty("--gx-hero-pd", p[0] + "s");
    n.style.setProperty("--gx-hero-px", (p[1] * k).toFixed(1) + "px");
    n.style.setProperty("--gx-hero-py", (p[2] * k).toFixed(1) + "px");
    n.style.setProperty("--gx-hero-sw", (p[3] * k).toFixed(1) + "px");
  }

  var lamp = document.createElement("img");
  lamp.className = "gx-hero-lamp";
  lamp.src = "img/lamp.webp";
  lamp.alt = "";
  lamp.decoding = "async";
  lamp.setAttribute("aria-hidden", "true");
  stage.appendChild(lamp);

  /* one forced style flush so every keyframe starts on the same frame */
  void stage.offsetWidth;
  stage.classList.add("gx-hero-go");
  genie.classList.add("gx-hero-genie-in");   /* its own .52s delay in CSS */

  setTimeout(disarm, 1660);
}

/* ==================================================================
   BEAT 2 — spring-damped parallax
   The transform goes on .genie-wrap (free) and on a wrapper we slip
   around .burst — never on .genie, whose transform belongs to `bob`.
   ================================================================== */
function runParallax(hero, wrap, burst){
  var depth = null;
  if(burst && burst.parentNode === hero){
    /* inset:0 of .hero is exactly .burst's old containing block, so the
       sunburst does not move a pixel — it just gains a parent to push. */
    depth = GX.el("div", "gx-hero-depth");
    hero.insertBefore(depth, burst);
    depth.appendChild(burst);
  }
  wrap.classList.add("gx-hero-tilt");

  var tx = 0, ty = 0,     /* target, -1..1                */
      cx = 0, cy = 0,     /* current                      */
      vx = 0, vy = 0,     /* velocity                     */
      K  = .085, D = .8,  /* stiffness / damping          */
      resting = false;

  var stop = GX.tick(function(){
    vx = (vx + (tx - cx) * K) * D;
    vy = (vy + (ty - cy) * K) * D;
    cx += vx; cy += vy;

    var still = Math.abs(vx) < 2e-4 && Math.abs(vy) < 2e-4 &&
                Math.abs(tx - cx) < 2e-3 && Math.abs(ty - cy) < 2e-3;
    if(still){
      if(resting) return;          /* settled — stop touching the DOM */
      resting = true; cx = tx; cy = ty;
    }else{
      resting = false;
    }

    wrap.style.transform =
      "translate3d(" + (cx * 9).toFixed(2) + "px," + (cy * 7).toFixed(2) + "px,0)" +
      " perspective(900px)" +
      " rotateY(" + (cx * 1.9).toFixed(2) + "deg)" +
      " rotateX(" + (-cy * 1.3).toFixed(2) + "deg)";

    if(depth){
      depth.style.transform =
        "translate3d(" + (-cx * 5).toFixed(2) + "px," + (-cy * 4).toFixed(2) + "px,0)";
    }
  });

  function park(){
    stop();
    wrap.classList.remove("gx-hero-tilt");
    wrap.style.transform = "";
    if(depth) depth.style.transform = "";
  }

  if(GX.touch){
    /* Android hands out deviceorientation without a prompt; iOS needs an
       explicit gesture-bound request, which is not worth a hero tilt. */
    if(window.DeviceOrientationEvent &&
       typeof window.DeviceOrientationEvent.requestPermission !== "function"){
      var seen = false;
      var onTilt = function(e){
        if(e.gamma == null && e.beta == null) return;
        seen = true;
        tx = GX.clamp((e.gamma || 0) / 26, -1, 1);
        ty = GX.clamp(((e.beta == null ? 45 : e.beta) - 45) / 30, -1, 1);
      };
      addEventListener("deviceorientation", onTilt, {passive:true});
      setTimeout(function(){
        if(seen) return;
        removeEventListener("deviceorientation", onTilt);
        park();
      }, 2200);
    }else{
      park();
    }
  }else{
    addEventListener("pointermove", function(e){
      if(e.pointerType === "touch") return;
      var w = innerWidth / 2, h = innerHeight / 2;
      tx = GX.clamp((e.clientX - w) / w, -1, 1);
      ty = GX.clamp((e.clientY - h) / h, -1, 1);
    }, {passive:true});
  }
}

/* ==================================================================
   BEAT 3 — gold sheen riding the wordmark
   A transparent twin of the letters sits on top of the real ones and
   is background-clipped to the glyphs, so the light band follows the
   letterforms. The original letterPop entrance is never touched.
   ================================================================== */
function runSheen(wordmark){
  if(!wordmark) return;
  var inner = wordmark.querySelector("span");
  if(!inner) return;
  var layer = GX.el("span", "gx-hero-sheen");
  layer.setAttribute("aria-hidden", "true");
  layer.appendChild(inner.cloneNode(true));
  wordmark.appendChild(layer);
}

/* ==================================================================
   BEAT 4 — the startled genie on a fast flick-scroll
   ================================================================== */
function runShock(){
  var TRIP = 2800,      /* px/s — a flick, never a reading scroll */
      COOL = 20000;     /* at most once every 20s                 */

  var frame = GX.el("div", "gx-hero-shock", document.body);
  frame.setAttribute("aria-hidden", "true");
  var img = document.createElement("img");
  img.alt = "";
  img.decoding = "async";
  frame.appendChild(img);
  /* fetch the sprite late so it never competes with the hero images */
  setTimeout(function(){ if(!img.src) img.src = "img/shocked.webp"; }, 5000);

  var lastY = -1, lastT = 0, vel = 0, lastPop = -1e9, busy = 0;

  GX.scroll(function(y){
    var t = performance.now();
    if(lastY < 0){ lastY = y; lastT = t; return; }

    var dt = t - lastT;
    if(dt < 6) return;
    var v = (y - lastY) / dt * 1000;
    lastY = y; lastT = t;
    if(dt > 240){ vel = 0; return; }     /* woke up from idle, no reading */

    vel = vel * .45 + v * .55;           /* smoothed, so one spike is not enough */
    if(vel < TRIP || y < 420) return;
    if(busy || t - lastPop < COOL) return;

    lastPop = t; vel = 0;
    if(!img.src) img.src = "img/shocked.webp";
    frame.classList.add("gx-hero-shock-go");
    busy = setTimeout(function(){
      frame.classList.remove("gx-hero-shock-go");
      busy = 0;
    }, 1200);
  });
}

/* ================================================================== */
GX.ready(function(){
  var hero = document.querySelector("main.hero");
  if(!hero){ disarm(); return; }

  genie = hero.querySelector("img.genie");
  var wrap = hero.querySelector(".genie-wrap");
  if(!genie || !wrap){ disarm(); return; }

  if(playIntro) runIntro(wrap);
  if(GX.reduced) return;

  runParallax(hero, wrap, hero.querySelector(".burst"));
  runSheen(hero.querySelector("h1.wordmark"));
  runShock();
});

})();
