# GX Animation Layer — Build Contract

You are adding an **animation module** to the Genie Coin site (a static, single-file
comic-styled landing page: `index.html`, ~950 lines, all CSS+JS inline).

## HARD RULES (breaking any of these fails the task)

1. **Never edit `index.html`.** Not one character. The integrator wires modules in.
   Your module must create every DOM node it needs at runtime, and may only *query*
   nodes that already exist (list below).
2. **Only two files**, exactly: `assets/anim/gx-<module>.css` and `assets/anim/gx-<module>.js`.
3. **Namespace everything** with your module prefix: classes `.gx-<module>-*`,
   keyframes `gx-<module>-*`, custom props `--gx-<module>-*`, JS in one IIFE with
   `"use strict";` and **no globals** except reading `window.GX`.
4. **Zero dependencies.** No CDN, no npm, no fonts, no images beyond what's in `img/`.
5. **ES5-flavoured JS** (`var`, `function`) to match the existing file. No build step.
6. **Respect `GX.reduced`** — when true, skip all motion (static end-state is fine).
   Also `?motion=1` forces motion on (`GX.forceMotion`).
7. **Performance:** animate only `transform` and `opacity`. Use `GX.tick` / `GX.scroll`
   (never your own `requestAnimationFrame` loop or unthrottled scroll handler).
   Recycle elements with `GX.pool` — never append inside a loop that runs forever.
   Total added JS ≤ ~10KB per module. No layout thrash (batch reads before writes).
8. **Must not break existing behaviour.** The lamp rub, the odometer, the confetti,
   the FAQ, and all links must still work exactly as before.
9. **Fail silently.** If a node you need is missing, `return;` — never throw.
10. **Mobile-safe:** no horizontal overflow, nothing that blocks scroll or taps.
    `pointer-events:none` on every purely decorative layer.

## Shared core — `window.GX` (already loaded before you)

```
GX.reduced            bool   prefers-reduced-motion (false if ?motion=1)
GX.touch              bool   coarse pointer
GX.wide()             bool   viewport >= 900px
GX.ready(fn)                 DOM ready
GX.tick(fn)      -> stop()   per-frame callback on ONE shared rAF loop
GX.scroll(fn)    -> stop()   rAF-throttled scroll+resize, called with scrollY
GX.io(el|list, cb, {threshold, once, rootMargin}) -> IntersectionObserver
GX.el(tag, cls, parent)      create + append
GX.pool(n, cls, parent)      -> {next(), all}  recycling element pool
GX.clamp(v,a,b) GX.lerp(a,b,t) GX.rand(a,b)
GX.progress(el)       0..1   element's travel through the viewport
```

## Design system (must match — this is a comic / cartoon look)

```
--blue:#2BA9E0  --gold:#FBB417  --gold-deep:#E09A00  --ink:#141414
--red:#E5392E   --ai:#7b5cff    --paper:#FFFdf6      --cream:#FFF6E3
```
Fonts: `'Lilita One'` (display) and `'Baloo 2'` (body) — already loaded.
Style language: **thick black outlines (2.5–4px), hard offset shadows
(`4px 5px 0 var(--ink)`), no blur-heavy glassmorphism, no gradients-as-decoration.**
Motion language: bouncy but *tasteful* — `cubic-bezier(.2,1.4,.4,1)` overshoot for
pops, slow `ease-in-out` for ambient float. Elegant > loud. If a beat feels like a
casino, tone it down.

## Existing DOM you may hook into (read-only)

```
header.top  .brand  .brand-logo
main.hero   .burst  h1.wordmark (letters: .wordmark .l)  .hero-claim
            .genie-wrap  img.genie   .cta  .btn .btn-gold  .shield-note
div.tear                     (the torn-paper divider, x2)
section#lamp.sect.wish
  .lamp-stage#lampStage      (has CSS var --rub = 0..1 rub energy, class .popping on wish)
  .lamp-glow  .lamp-hold#lampHold  img.lamp-img#lampImg
  img.poof-genie#poofGenie   .rub-hint#rubHint
  .amount-wrap  .odo#odo (digit reels built by JS)  img.million-genie
  .lamp-goal  .meter-wrap  .meter  .meter-fill#meterFill  .meter-chip  .meter-labels
  .live-pill  .live-dot  .lamp-cap
  .steps  ->  .step.reveal  (x4, each has .ico svg, .txt, .num)
  .wish-cta-line  .wish-cta
section#faq  .faqs  details.faq.reveal > summary > .plus  + .faq-a
footer .foot-inner .foot-brand .foot-nav .foot-disc .foot-copy
.wish-toast#wishToast        (existing toast, add class "show" for 4s)
.twinkle / .twinkle.b        ambient stars already sprinkled in sections
.spark.s1..s4  .dust         existing decorative pools
.reveal                      existing scroll-reveal class -> gets .in when visible
```

Existing keyframe names already taken (do NOT reuse):
`spin dropIn letterPop genieRise bob pulse floaty twinkle dustFade glowPulse
lampPop sparkFly smokeRise genieOut stageShake hintNudge sheen livedot icoPop faqIn`

## Existing JS behaviour you must not fight

- `#lampHold` owns `pointermove/pointerdown/keydown` for the rub physics and sets
  `transform` on itself every frame while springing. **Do not set `transform` on
  `#lampHold`** — wrap it or animate a parent/child instead.
- `#odo` reels are generated and spun once by an IntersectionObserver.
- `.reveal` elements get `.in` added once by an existing IntersectionObserver.
- A global `pointermove` handler already sprinkles `.dust` particles.

## Definition of done

- Both files written, ~self-documenting, comments in English matching the file's tone.
- `node --check assets/anim/gx-<module>.js` passes (run it).
- A short report back: what you built, the exact `<link>`/`<script>` tags to add,
  any DOM node your module *creates*, and anything you deliberately skipped.
