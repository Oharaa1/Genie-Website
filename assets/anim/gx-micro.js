/* ============================================================
   GX-MICRO — the details you feel with your hands.
     1. buttons fill with gold (hover, keyboard focus, touch press)
     2. the FAQ "+" morphs into a lamp, the answer unrolls
     3. "Make a wish" — a wish typed here turns to golden smoke
   Reads window.GX only. Creates nodes, never edits index.html.
   Every step is wrapped so a missing node just means "skip this beat".
   ============================================================ */
(function(){
"use strict";

var GX = window.GX;
if(!GX) return;

/* one shared, click-through particle layer. It is overflow:hidden and its
   children are absolute, so no spark can ever widen the page on a phone. */
var _layer = null, _sparks = null, _smokes = null;
function layer(){
  if(!_layer) _layer = GX.el("div", "gx-micro-layer", document.body);
  return _layer;
}
function sparks(){ if(!_sparks) _sparks = GX.pool(10, "gx-micro-spark", layer()); return _sparks; }
function smokes(){ if(!_smokes) _smokes = GX.pool(8,  "gx-micro-smoke", layer()); return _smokes; }

/* restart a CSS animation on a recycled node */
function replay(el){ el.classList.remove("go"); void el.offsetWidth; el.classList.add("go"); }


/* ===================================================================
   1. BUTTONS — gold wave + a couple of sparks off the edge
   =================================================================== */
function initButtons(){
  var btns = document.querySelectorAll(".btn");
  if(!btns.length) return;

  [].forEach.call(btns, function(b){
    /* this class retires the old `pulse` heartbeat: gx-micro.css carries
       `.btn.gx-micro-btn{animation:none}` — higher specificity than
       `.btn-gold`, and JS-gated, so without this file nothing changes. */
    b.classList.add("gx-micro-btn");

    if(GX.touch){
      /* coarse pointer: no hover — the gold lands on press instead */
      var on  = function(){ b.classList.add("gx-micro-on"); };
      var off = function(){ setTimeout(function(){ b.classList.remove("gx-micro-on"); }, 240); };
      b.addEventListener("pointerdown", on, {passive:true});
      b.addEventListener("pointerup", off, {passive:true});
      b.addEventListener("pointercancel", off, {passive:true});
      b.addEventListener("pointerleave", off, {passive:true});
      return;
    }

    /* fine pointer: the wave is pure CSS :hover — JS only adds the sparks */
    b.addEventListener("pointerenter", function(){ sparkOff(b); }, {passive:true});
    b.addEventListener("focus", function(){
      var kb = true;
      try{ kb = b.matches(":focus-visible"); }catch(e){}
      if(kb) sparkOff(b);
    });
  });
}

/* two sparks flicked off the trailing edge, timed to land with the wave */
function sparkOff(btn){
  if(GX.reduced || GX.touch) return;
  var r = btn.getBoundingClientRect(), p = sparks(), i;
  for(i=0;i<2;i++){
    (function(k){
      setTimeout(function(){
        var s = p.next(), sz = Math.round(GX.rand(7,12));
        s.style.left = Math.round(r.right - GX.rand(4,14)) + "px";
        s.style.top  = Math.round(r.top + GX.rand(3, Math.max(4, r.height-3))) + "px";
        s.style.width = sz + "px"; s.style.height = sz + "px";
        s.style.setProperty("--dx", Math.round(GX.rand(12,32)) + "px");
        s.style.setProperty("--dy", Math.round(GX.rand(-42,-18)) + "px");
        replay(s);
      }, 200 + k*110);
    })(i);
  }
}


/* ===================================================================
   2. FAQ — "+" becomes a lamp, and the answer unrolls
   =================================================================== */

/* comic lamp + plus, drawn once per FAQ row. Both glyphs live in the same
   SVG and cross-fade, so nothing reflows when the item opens. */
var GLYPH =
  '<svg class="gx-micro-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ' +
       'fill="none" stroke="#141414" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    '<g class="gx-micro-g gx-micro-g-plus">' +
      '<path d="M12 5.4v13.2M5.4 12h13.2" stroke-width="3.1"/>' +
    '</g>' +
    '<g class="gx-micro-g gx-micro-g-lamp">' +
      '<path d="M6 14.3h11.2c0 3-2.5 4.9-5.6 4.9S6 17.3 6 14.3z" fill="#FBB417"/>' +
      '<path d="M6 14.3c0-2 2.5-3.5 5.6-3.5s5.6 1.5 5.6 3.5" fill="#FFD45E"/>' +
      '<path d="M6.4 13.2 2.1 10.9l4.5-.5" fill="#FBB417"/>' +
      '<path d="M17.2 12.9c2.7.3 4.3 1.4 4.3 2.7 0 1.2-1.3 2.1-3.1 2.4"/>' +
      '<path d="M11.6 10.6V8.9"/>' +
      '<circle cx="11.6" cy="7.7" r="1.4" fill="#FBB417"/>' +
      '<path d="M3.6 4.4v2.3M2.5 5.5h2.3" stroke="#2BA9E0" stroke-width="1.7"/>' +
    '</g>' +
  '</svg>';

function initFaq(){
  var items = document.querySelectorAll("details.faq");
  if(!items.length) return;
  /* WAAPI is what makes the unroll safe; without it we leave the native
     <details> alone rather than risk an item that will not open. */
  var canRoll = typeof document.createElement("div").animate === "function" && !GX.reduced;

  [].forEach.call(items, function(d){
    var sum  = d.querySelector("summary"),
        ans  = d.querySelector(".faq-a"),
        plus = d.querySelector(".plus");
    if(!sum || !ans) return;

    /* the glyph: swap the "+" text for the SVG and hide the box from AT —
       <summary> already exposes the expanded state on its own. */
    if(plus){
      plus.innerHTML = GLYPH;
      plus.classList.add("gx-micro-plus");
      plus.setAttribute("aria-hidden", "true");
    }
    if(!canRoll) return;

    /* a plain wrapper we can give a height to. .faq-a keeps its own class,
       padding and text, so screen readers and find-in-page see no change. */
    var roll = document.createElement("div");
    roll.className = "gx-micro-roll";
    ans.parentNode.insertBefore(roll, ans);
    roll.appendChild(ans);

    var anim = null;

    function reset(){ roll.style.height = ""; roll.style.overflow = ""; }
    function stop(){
      if(anim){ var a = anim; anim = null; try{ a.cancel(); }catch(e){} reset(); }
    }
    function run(from, to, ms, ease, onEnd){
      roll.style.overflow = "hidden";
      var a = roll.animate([{height:from+"px"},{height:to+"px"}],
                           {duration:ms, easing:ease, fill:"both"});
      anim = a;
      a.onfinish = function(){
        anim = null;
        if(onEnd) onEnd();       /* close the <details> BEFORE dropping the fill */
        try{ a.cancel(); }catch(e){}
        reset();
      };
      a.oncancel = function(){ if(anim === a){ anim = null; reset(); } };
    }

    function expand(){
      var from = d.open ? roll.getBoundingClientRect().height : 0;
      stop();
      d.open = true;                       /* content is live immediately */
      var to = roll.scrollHeight;
      run(from, to, 300, "cubic-bezier(.2,1.06,.35,1)", null);
    }
    function collapse(){
      var from = roll.getBoundingClientRect().height || roll.scrollHeight;
      stop();
      run(from, 0, 210, "cubic-bezier(.4,0,.7,1)", function(){ d.open = false; });
    }

    /* <summary> fires a click for mouse, Enter and Space alike, so this one
       handler covers keyboard too. Everything else stays native. */
    sum.addEventListener("click", function(e){
      if(e.defaultPrevented) return;
      e.preventDefault();
      if(d.open) collapse(); else expand();
    });
  });
}


/* ===================================================================
   3. "MAKE A WISH" — client-side only, and it says so out loud
   =================================================================== */
function initWish(){
  var sect = document.getElementById("lamp");
  if(!sect) return;
  var anchor = sect.querySelector(".wish-cta-line");   /* the lamp section's own CTA line */
  if(!anchor || !anchor.parentNode) return;

  var toast   = document.getElementById("wishToast"),
      lampImg = document.getElementById("lampImg");

  var form = document.createElement("form");
  form.className = "gx-micro-wish";
  form.setAttribute("novalidate", "novalidate");
  form.innerHTML =
    '<label class="gx-micro-wish-lab" for="gxMicroWishIn">Make a wish <em>(just for fun)</em></label>' +
    '<div class="gx-micro-wish-row">' +
      '<input class="gx-micro-wish-in" id="gxMicroWishIn" type="text" maxlength="80" ' +
             'autocomplete="off" spellcheck="false" enterkeyhint="send" ' +
             'placeholder="I wish for&#8230;" aria-describedby="gxMicroWishNote">' +
      '<button class="gx-micro-wish-go" type="submit">Send it &#10024;</button>' +
    '</div>' +
    '<p class="gx-micro-wish-note" id="gxMicroWishNote">Nothing is sent anywhere and nothing is stored &#8212; ' +
      'the Genie is a story, not a server. Your wish turns to smoke right here in your browser.</p>';

  anchor.parentNode.insertBefore(form, anchor);

  var input = form.querySelector(".gx-micro-wish-in"),
      go    = form.querySelector(".gx-micro-wish-go"),
      busy  = false, toastT = null;

  /* its own little reveal — the site's .reveal observer ran before we existed */
  if(GX.reduced) form.classList.add("gx-micro-in");
  else GX.io(form, function(vis){ if(vis) form.classList.add("gx-micro-in"); }, {threshold:.25});

  form.addEventListener("submit", function(e){
    e.preventDefault();
    var txt = (input.value || "").replace(/\s+/g, " ").trim();

    if(!txt){                                   /* empty: a comic wobble, no error shouting */
      input.classList.remove("gx-micro-empty");
      void input.offsetWidth;
      input.classList.add("gx-micro-empty");
      input.focus();
      return;
    }
    if(busy) return;
    busy = true; go.disabled = true;

    if(!GX.reduced) dissolve(txt);
    input.value = "";                            /* the only place the text ever lived */

    if(toast){
      toast.classList.add("show");
      clearTimeout(toastT);
      toastT = setTimeout(function(){ toast.classList.remove("show"); }, 4200);
    }
    setTimeout(function(){ busy = false; go.disabled = false; }, 800);
  });

  /* the typed wish lifts off the field, breaks into letters and drifts
     into the lamp's spout as golden smoke */
  function dissolve(txt){
    /* --- all reads first, then all writes --- */
    var r  = input.getBoundingClientRect(),
        cs = getComputedStyle(input),
        lr = lampImg ? lampImg.getBoundingClientRect() : null;

    var fs = parseFloat(cs.fontSize) || 16,
        cx = r.left + r.width / 2,
        cy = r.top + r.height / 2,
        tx = lr ? lr.left + lr.width * .16 : innerWidth / 2,   /* the spout */
        ty = lr ? lr.top + lr.height * .30 : -80,
        dx = tx - cx,
        dy = ty - cy;

    /* only take as many letters as actually fit in the field, so nothing
       ever hangs outside it before the animation starts */
    var fit = Math.max(4, Math.floor((r.width - 26) / (fs * .52)));
    var chars = txt.slice(0, Math.min(fit, 48)).split("");

    var fly = document.createElement("div");
    fly.className = "gx-micro-fly";
    fly.setAttribute("aria-hidden", "true");
    fly.style.left = r.left + "px";
    fly.style.top = r.top + "px";
    fly.style.width = r.width + "px";
    fly.style.height = r.height + "px";
    fly.style.paddingLeft = cs.paddingLeft;
    fly.style.paddingRight = cs.paddingRight;
    fly.style.fontFamily = cs.fontFamily;
    fly.style.fontSize = cs.fontSize;
    fly.style.fontWeight = cs.fontWeight;

    for(var i=0;i<chars.length;i++){
      var c = document.createElement("i");
      c.textContent = chars[i];
      c.style.setProperty("--i", i);
      c.style.setProperty("--dx", Math.round(dx + GX.rand(-26,26)) + "px");
      c.style.setProperty("--dy", Math.round(dy + GX.rand(-24,12)) + "px");
      fly.appendChild(c);
    }
    layer().appendChild(fly);
    setTimeout(function(){ if(fly.parentNode) fly.parentNode.removeChild(fly); },
               1050 + chars.length * 26);

    /* six puffs following the same path, a beat behind the letters */
    var p = smokes();
    for(var k=0;k<6;k++){
      (function(n){
        setTimeout(function(){
          var s = p.next();
          s.style.left = Math.round(cx + GX.rand(-r.width*.3, r.width*.3)) + "px";
          s.style.top  = Math.round(cy + GX.rand(-6, 6)) + "px";
          s.style.setProperty("--dx", Math.round(dx * GX.rand(.55,.95) + GX.rand(-20,20)) + "px");
          s.style.setProperty("--dy", Math.round(dy * GX.rand(.55,.95) - GX.rand(0,30)) + "px");
          replay(s);
        }, 140 + n * 85);
      })(k);
    }
  }
}


/* ---------- go ---------- */
GX.ready(function(){
  try{ initButtons(); }catch(e){}
  try{ initFaq(); }catch(e){}
  try{ initWish(); }catch(e){}
});

})();
