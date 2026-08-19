/* ============================================================
   GX CORE — shared helpers for the Genie animation layer.
   Loaded FIRST, before every gx-*.js module. Zero dependencies.
   ============================================================ */
(function(){
"use strict";
var forceMotion = new URLSearchParams(location.search).get("motion") === "1";
var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches && !forceMotion;

/* one shared rAF loop for the whole site — never start your own */
var fns = [], running = false;
function loop(t){
  running = fns.length > 0;
  for(var i=fns.length-1;i>=0;i--){ try{ fns[i](t); }catch(e){} }
  if(running) requestAnimationFrame(loop);
}

var GX = {
  reduced: reduced,
  forceMotion: forceMotion,
  /* coarse pointer (phone / tablet) */
  touch: matchMedia("(pointer: coarse)").matches,
  /* desktop-ish viewport */
  wide: function(){ return innerWidth >= 900; },

  ready: function(fn){
    if(document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  },

  /* add a per-frame callback; returns a stop() function */
  tick: function(fn){
    fns.push(fn);
    if(!running){ running = true; requestAnimationFrame(loop); }
    return function(){ var i = fns.indexOf(fn); if(i>-1) fns.splice(i,1); };
  },

  /* rAF-throttled scroll listener; returns a stop() function */
  scroll: function(fn){
    var q = false;
    function h(){
      if(q) return; q = true;
      requestAnimationFrame(function(){ q = false; fn(scrollY); });
    }
    addEventListener("scroll", h, {passive:true});
    addEventListener("resize", h, {passive:true});
    fn(scrollY);
    return function(){ removeEventListener("scroll", h); removeEventListener("resize", h); };
  },

  /* IntersectionObserver sugar. opts: {threshold, once, rootMargin} */
  io: function(el, cb, opts){
    opts = opts || {};
    var o = new IntersectionObserver(function(es){
      es.forEach(function(e){
        cb(e.isIntersecting, e);
        if(e.isIntersecting && opts.once !== false) o.unobserve(e.target);
      });
    },{threshold: opts.threshold != null ? opts.threshold : .2, rootMargin: opts.rootMargin || "0px"});
    (el.length ? [].slice.call(el) : [el]).forEach(function(n){ if(n) o.observe(n); });
    return o;
  },

  /* create + append an element in one line */
  el: function(tag, cls, parent){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    if(parent) parent.appendChild(n);
    return n;
  },

  /* recycling pool of identical elements — never grow the DOM in a loop */
  pool: function(n, cls, parent){
    var a = [], i = 0;
    for(var k=0;k<n;k++) a.push(GX.el("span", cls, parent || document.body));
    return { next: function(){ return a[i = (i+1)%n]; }, all: a };
  },

  clamp: function(v,a,b){ return v<a?a:(v>b?b:v); },
  lerp:  function(a,b,t){ return a + (b-a)*t; },
  rand:  function(a,b){ return a + Math.random()*(b-a); },
  /* 0..1 progress of el through the viewport (0 = entering bottom, 1 = left top) */
  progress: function(el){
    var r = el.getBoundingClientRect(), h = innerHeight;
    return GX.clamp((h - r.top) / (h + r.height), 0, 1);
  }
};
window.GX = GX;
})();
