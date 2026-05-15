/* Tally — Mark / logo SVG components, plain JS module
   All marks share a 64x64 base viewBox, designed on a 4px grid.
   ============================================================== */

window.TallyMarks = {
  // PRIMARY: Stacked-T — the wordmark glyph.
  // The T's stem is built from 5 stacked horizontal bars (parcelas) —
  // the cap is one solid bar (the closed fatura / total).
  primary(opts = {}) {
    const fill = opts.fill || "currentColor";
    const bg = opts.bg || "none";
    const r = opts.radius != null ? opts.radius : 14;
    return `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${bg !== "none" ? `<rect width="64" height="64" rx="${r}" fill="${bg}"/>` : ""}
  <g fill="${fill}">
    <!-- Top bar / cap (closed fatura) -->
    <rect x="12" y="14" width="40" height="6" rx="1"/>
    <!-- Stem: 5 stacked bars (parcelas) descending -->
    <rect x="28" y="24" width="8" height="4" rx="1"/>
    <rect x="28" y="30" width="8" height="4" rx="1"/>
    <rect x="28" y="36" width="8" height="4" rx="1"/>
    <rect x="28" y="42" width="8" height="4" rx="1"/>
    <rect x="28" y="48" width="8" height="4" rx="1"/>
  </g>
</svg>`;
  },

  // TALLY-MARK variant: classic four-strokes-and-a-slash, the literal etymology.
  tally(opts = {}) {
    const fill = opts.fill || "currentColor";
    const bg = opts.bg || "none";
    const r = opts.radius != null ? opts.radius : 14;
    return `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${bg !== "none" ? `<rect width="64" height="64" rx="${r}" fill="${bg}"/>` : ""}
  <g stroke="${fill}" stroke-width="4" stroke-linecap="square" fill="none">
    <line x1="16" y1="16" x2="16" y2="48"/>
    <line x1="24" y1="16" x2="24" y2="48"/>
    <line x1="32" y1="16" x2="32" y2="48"/>
    <line x1="40" y1="16" x2="40" y2="48"/>
    <line x1="12" y1="44" x2="46" y2="20"/>
  </g>
</svg>`;
  },

  // STACK variant: ascending stacks (compras parceladas acumulando).
  stack(opts = {}) {
    const fill = opts.fill || "currentColor";
    const bg = opts.bg || "none";
    const r = opts.radius != null ? opts.radius : 14;
    return `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${bg !== "none" ? `<rect width="64" height="64" rx="${r}" fill="${bg}"/>` : ""}
  <g fill="${fill}">
    <rect x="12" y="44" width="10" height="8" rx="1"/>
    <rect x="12" y="34" width="10" height="8" rx="1" opacity="0.78"/>
    <rect x="27" y="34" width="10" height="18" rx="1"/>
    <rect x="27" y="24" width="10" height="8" rx="1" opacity="0.78"/>
    <rect x="27" y="14" width="10" height="8" rx="1" opacity="0.56"/>
    <rect x="42" y="24" width="10" height="28" rx="1"/>
    <rect x="42" y="14" width="10" height="8" rx="1" opacity="0.78"/>
  </g>
</svg>`;
  },

  // MONOGRAM: just the T, for favicons and micro contexts.
  monogram(opts = {}) {
    const fill = opts.fill || "currentColor";
    const bg = opts.bg || "none";
    const r = opts.radius != null ? opts.radius : 14;
    return `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${bg !== "none" ? `<rect width="64" height="64" rx="${r}" fill="${bg}"/>` : ""}
  <g fill="${fill}">
    <rect x="14" y="18" width="36" height="6" rx="1"/>
    <rect x="29" y="24" width="6" height="26" rx="1"/>
  </g>
</svg>`;
  },

  // WORDMARK: "Tally" set in Geist with the primary T-glyph substituted in.
  // We render the wordmark in HTML/CSS rather than SVG so it's editable.
  wordmark(opts = {}) {
    const size = opts.size || 48;
    const color = opts.color || "var(--ink)";
    return `<span class="tally-wordmark" style="font-size:${size}px;color:${color}">Tally</span>`;
  },
};

// Helper to inject a mark into any element by selector
window.injectMark = function (selector, variant, opts) {
  document.querySelectorAll(selector).forEach((el) => {
    el.innerHTML = window.TallyMarks[variant](opts || {});
  });
};
