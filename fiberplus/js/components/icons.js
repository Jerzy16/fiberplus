/**
 * Shared inline SVG icons used across the overlay controls. `size` is a px
 * value measured against a 16px baseline, then expressed in `em` (not px) so
 * every icon scales automatically with the TV-scale root font-size set in
 * base.css, without every call site needing to know about that scale.
 */
var Icons = (function () {
  function wrap(size, path) {
    size = size || 24;
    var em = size / 16 + 'em';
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      em +
      '" height="' +
      em +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      path +
      '</svg>'
    );
  }

  /* The One DxD mark, inlined from assets/logo-onedxd.svg with its fills
   * rewritten to `currentColor`. The <img> version of the same file is used
   * on the splash, where it is always white; here it has to flip to navy the
   * moment the cursor lands on the provider tile (see .focused in
   * components.css), and only an inline SVG can be recoloured by CSS on the
   * older webOS engines (no `mask-image` support to rely on). */
  function brandOneDxd() {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 304 337" fill="currentColor" aria-hidden="true">' +
      '<path fill="currentColor" d="M194.959 85.2787C205.04 82.5713 215.717 83.0875 225.49 86.7542L239.309 91.9378L277.208 105.353C293.183 111.007 303.862 126.114 303.862 143.06V306.051C303.862 322.619 290.431 336.051 273.862 336.051H20C8.95439 336.051 0.000138764 327.097 0 316.051V160.641C0 147.069 9.11218 135.187 22.2197 131.667L194.959 85.2787ZM218.884 122.349C218.884 114.507 211.485 108.773 203.891 110.729L46.3398 151.312C35.7369 154.043 28.3262 163.604 28.3262 174.553V294.815C28.3264 303.31 36.3423 309.523 44.5693 307.404L203.872 266.369C212.708 264.093 218.884 256.125 218.884 247.001V122.349Z"/>' +
      '<path fill="currentColor" d="M66.9526 195.459C66.9526 194.233 67.698 193.131 68.8353 192.674L92.4489 183.197C94.42 182.406 96.5663 183.858 96.5663 185.982V249.304C96.5663 250.69 95.6164 251.896 94.2686 252.22L70.655 257.907C68.7679 258.361 66.9526 256.931 66.9526 254.99V195.459Z"/>' +
      '<path fill="currentColor" d="M150.643 170.141C150.643 168.897 151.411 167.782 152.574 167.338L178.763 157.346C180.726 156.597 182.832 158.047 182.832 160.149V225.862C182.832 227.261 181.865 228.475 180.502 228.787L154.313 234.782C152.434 235.212 150.643 233.785 150.643 231.858V170.141Z"/>' +
      '<path fill="currentColor" d="M110.729 72.103H136.481V102.215L110.729 109.442V72.103Z"/>' +
      '<ellipse fill="currentColor" cx="122.317" cy="38.6266" rx="38.6265" ry="38.6266"/>' +
      '</svg>'
    );
  }

  /* The "no logo" mark, inlined from assets/imagen-tv-not-found.svg with its
   * hard-coded white stroke/fill rewritten to `currentColor`. It has to be
   * inline rather than an <img>: the tile under the cursor is filled solid
   * white, and a white-on-white placeholder would simply disappear. As an
   * inline SVG it inherits `color` and flips to navy with the rest of the
   * tile's content (see .focused in components.css). */
  function channelPlaceholder() {
    return (
      // Heavier than the source file's stroke-width of 5. The mark renders at
      // roughly a fifth of its 273x199 artboard inside a rail tile, which
      // thinned a 5-unit stroke to about one physical pixel — nearly invisible
      // from across a room. The glyph is a filled path, so it takes a matching
      // stroke of its own to gain weight at the same rate as the frame.
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 273 199" fill="none" aria-hidden="true">' +
      '<rect x="2.5" y="2.5" width="268" height="173" rx="17.5" stroke="currentColor" stroke-width="10"/>' +
      '<line x1="68" y1="196.5" x2="205" y2="196.5" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>' +
      '<path fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round" d="M123.525 106V72.075H127.625V106H123.525ZM113.1 74.1V70.2H138.025V74.1H113.1ZM146.819 106L136.419 80.3H140.794L148.394 99.825L148.819 100.95H148.919L149.394 99.8L156.994 80.3H161.219L150.794 106H146.819Z"/>' +
      '</svg>'
    );
  }

  return {
    brandOneDxd: brandOneDxd,
    channelPlaceholder: channelPlaceholder,
    home: function (size) {
      return wrap(
        size,
        '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'
      );
    },
    back: function (size) {
      return wrap(size, '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>');
    },
    logout: function (size) {
      return wrap(
        size,
        '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>'
      );
    },
    play: function (size) {
      return wrap(size, '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>');
    },
    pause: function (size) {
      return wrap(
        size,
        '<rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>'
      );
    }
  };
})();
