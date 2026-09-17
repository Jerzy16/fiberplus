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
