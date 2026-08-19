/* ============================================================
   GX-FLOW — reading rhythm & scroll storytelling.
   1. each step lights up as you read past it
   2. a musical stagger layered on the page's own .reveal pass
   3. a reading bar with a lamp riding its leading edge
   Pairs with gx-flow.css. Decorative only — nothing eats a click.
   ============================================================ */
(function(){
"use strict";
if(!window.GX) return;

/* ============================================================
   1. STEP LIGHTING
   The connecting thread was cut — it added visual noise beside the
   cards for very little meaning. What stays is the payoff: as you
   read past each step it lights up and its number turns gold, so
   the list still has a direction without any drawn chrome.
   One IntersectionObserver per card. No scroll maths, no SVG.
   ============================================================ */
function initSteps(){
  var box = document.querySelector(".steps");
  if(!box) return;
  var steps = [].slice.call(box.querySelectorAll(".step"));
  if(!steps.length) return;

  box.classList.add("gx-flow-steps");

  if(GX.reduced){
    steps.forEach(function(el){ el.classList.add("gx-flow-lit"); });
    return;
  }

  /* fires once per card, when it has cleared the lower third of the screen */
  GX.io(steps, function(vis, e){
    if(!vis) return;
    var el = e.target;
    el.classList.add("gx-flow-lit");
    el.classList.add("gx-flow-ding");
    setTimeout(function(){ el.classList.remove("gx-flow-ding"); }, 700);
  }, {threshold:.55});
}

/* ============================================================
   2. REVEAL RHYTHM
   The page's own observer keeps owning .in — we only retime the
   delay and add a whisper of scale. .reveal.gx-flow-rv.in still
   resolves to "visible", so nothing can ever be stranded blank.
   ============================================================ */
function initReveals(){
  var groups = document.querySelectorAll(".steps, .faqs");
  [].forEach.call(groups, function(g){
    var kids = g.querySelectorAll(".reveal");
    [].forEach.call(kids, function(el, i){
      /* a musical stagger — the beats tighten as the group goes on */
      el.style.setProperty("--gx-flow-d", (i * 0.085 + (i > 2 ? 0.02 : 0)).toFixed(3) + "s");
      el.classList.add("gx-flow-rv");
    });
  });
  /* belt and braces: anything still hidden well after load gets shown */
  setTimeout(function(){
    [].forEach.call(document.querySelectorAll(".reveal.gx-flow-rv"), function(el){
      var r = el.getBoundingClientRect();
      if(r.top < innerHeight && r.bottom > 0) el.classList.add("in");
    });
  }, 3000);
}

/* ============================================================
   3. THE READING LAMP
   ============================================================ */
function initBar(){
  var bar = GX.el("div", "gx-flow-bar", document.body);
  bar.setAttribute("aria-hidden", "true");
  var fill  = GX.el("div", "gx-flow-fill", bar),
      rider = GX.el("div", "gx-flow-rider", bar);

  /* a small comic lamp: ink outline, gold body, a flame that lights at the end */
  rider.innerHTML =
    '<svg viewBox="0 0 30 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path class="gx-flow-flame" d="M15.4 2.2c1.5 1.6 2.2 2.9 2.2 4a2.4 2.4 0 0 1-4.8 0c0-1.1.9-2.5 2.6-4Z" ' +
        'fill="#FBB417" stroke="#141414" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M6.6 12.4c0-2.6 2.9-4.4 7-4.4s7 1.8 7 4.4c0 3.1-3.1 5.2-7 5.2s-7-2.1-7-5.2Z" ' +
        'fill="#FBB417" stroke="#141414" stroke-width="2"/>' +
      '<path d="M20.2 11.4c2.4-.4 4.4.4 4.4 1.7 0 1.2-1.5 2-3.5 2.2" ' +
        'stroke="#141414" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M13.6 8.1 12 5.6" stroke="#141414" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path d="M5.2 17.6h16" stroke="#141414" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';

  var last = -1, done = false;
  GX.scroll(function(y){
    var max = document.documentElement.scrollHeight - innerHeight;
    var p = max > 0 ? GX.clamp(y / max, 0, 1) : 0;
    var q = Math.round(p * 300) / 300;
    if(q === last) return;
    last = q;
    fill.style.transform  = "scaleX(" + q + ")";
    /* keep the lamp glyph (30px wide, drawn from its own centre) fully inside
       the viewport at both ends — otherwise it widens the document at q=1 */
    rider.style.transform = "translateX(" + (16 + q * (innerWidth - 32)) + "px)";
    bar.classList.toggle("on", q > 0.015);
    if(q > 0.985 && !done){ done = true; bar.classList.add("done"); }
    else if(q < 0.94 && done){ done = false; bar.classList.remove("done"); }
  });
}

/* ---------- go ---------- */
GX.ready(function(){
  try{ initSteps();   }catch(e){}
  try{ initReveals(); }catch(e){}
  try{ initBar();     }catch(e){}
});

})();
