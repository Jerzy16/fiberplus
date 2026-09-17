/**
 * Generic geometry-based remote/keyboard navigation, native (no external
 * libraries). Any element matching FOCUSABLE_SELECTOR that is visible
 * becomes a stop; arrow keys move to the closest candidate in that
 * direction based on bounding-box position, Enter/OK activates whatever is
 * currently focused. Pages just call SpatialNav.handleKey(e[, root]) from
 * their Store.setNavHandler callback and SpatialNav.focusFirst()/
 * ensureFocus() after (re)rendering their markup.
 *
 * The visually focused element always gets the `.focused` class (styled in
 * components.css as solid white background / black text) — that class is
 * the single source of truth for "where the user is", independent of
 * whichever element also happens to hold native DOM focus.
 *
 * Two behaviours matter a lot on a TV and are handled explicitly here:
 *
 * 1. Where focus starts. focusFirst() picks the element that is visually
 *    topmost (and leftmost within that row), not the first one in DOM
 *    order, and resets the page scroll — so every screen always opens with
 *    the cursor at the top and the user walks down/right from there.
 *
 * 2. How the view follows focus. scrollIntoView() is useless here: the
 *    options object (`block:'nearest'`) is ignored by the older Chromium
 *    builds LG ships, which coerce it to `true` and slam the element to the
 *    very top of the page, and `behavior:'smooth'` is ignored too. That is
 *    what made the cursor land "sometimes way down, sometimes way up".
 *    reveal() replaces it with an explicit, uniform rule applied to every
 *    scrollable ancestor and then to the document: scroll the minimum
 *    amount needed so the focused element sits fully inside its scroll area
 *    with a constant margin from the edge, animated by hand with rAF.
 */
var SpatialNav = (function () {
  var FOCUSABLE_SELECTOR = '[data-nav], button:not(:disabled), a[href], input, .provider-card, .channel-card';

  // Vertical slop (px) under which two elements count as the same visual row.
  var ROW_TOLERANCE = 14;
  // How much of the perpendicular axis misalignment weighs against distance.
  var CROSS_WEIGHT = 4;
  var SCROLL_DURATION = 220;

  var current = null;

  /* ===== basics ===== */

  function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function getFocusable(root) {
    root = root || document;
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE_SELECTOR), isVisible);
  }

  function isTextInput(el) {
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  function rectOf(el) {
    return el.getBoundingClientRect();
  }

  /* ===== scrolling ===== */

  var raf =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    function (fn) {
      return setTimeout(fn, 16);
    };

  function nowMs() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  function rootFontSize() {
    var size = parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    return size > 0 ? size : 16;
  }

  /* The constant breathing room kept between the focused element and the
   * edge of its scroll area. Expressed in rem so it scales with the TV-size
   * root font, capped so it can never eat a small container. */
  function edgeMargin(containerSize) {
    return Math.min(rootFontSize() * 1.5, containerSize * 0.25);
  }

  /* Minimum scroll delta that puts [start,end] inside [cStart,cEnd] while
   * keeping `margin` of clearance. 0 when it already fits. */
  function deltaFor(start, end, cStart, cEnd, margin) {
    var visible = cEnd - cStart - margin * 2;
    if (end - start >= visible) {
      // Taller/wider than the visible area: align its leading edge.
      return start - (cStart + margin);
    }
    if (start < cStart + margin) return start - (cStart + margin);
    if (end > cEnd - margin) return end - (cEnd - margin);
    return 0;
  }

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  /* Hand-rolled smooth scroll: `scroll-behavior`/`behavior:'smooth'` are not
   * supported on the webOS browser, so an animation here is the only way to
   * get a non-jarring move. A token per target+property supersedes any
   * animation still running when a new key press arrives. */
  function animateScroll(target, prop, to) {
    var key = '__navAnim_' + prop;
    var from = target[prop];
    var delta = to - from;

    var token = (target[key] || 0) + 1;
    target[key] = token;

    if (Math.abs(delta) < 1) {
      target[prop] = to;
      return;
    }

    var start = nowMs();

    function step() {
      if (target[key] !== token) return; // superseded by a newer move
      var t = (nowMs() - start) / SCROLL_DURATION;
      if (t >= 1) {
        target[prop] = to;
        return;
      }
      // easeInOutQuad
      var eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      target[prop] = from + delta * eased;
      raf(step);
    }

    raf(step);
  }

  function scrollableAncestors(el) {
    var list = [];
    var node = el.parentNode;

    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      var style = window.getComputedStyle(node);
      var canY =
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        node.scrollHeight - node.clientHeight > 1;
      var canX =
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        node.scrollWidth - node.clientWidth > 1;
      if (canY || canX) list.push({ el: node, y: canY, x: canX });
      node = node.parentNode;
    }

    return list;
  }

  /* Walks from the innermost scroll container outwards, tracking how far the
   * element has already been moved by each scroll so the next container up
   * works from the corrected position (rects would still be stale while the
   * animation runs). */
  function reveal(el) {
    var r = rectOf(el);
    var top = r.top;
    var bottom = r.bottom;
    var left = r.left;
    var right = r.right;

    var chain = scrollableAncestors(el);

    for (var i = 0; i < chain.length; i++) {
      var entry = chain[i];
      var node = entry.el;
      var cr = rectOf(node);

      if (entry.y) {
        var dy = deltaFor(top, bottom, cr.top, cr.bottom, edgeMargin(cr.height));
        dy = clamp(dy, -node.scrollTop, node.scrollHeight - node.clientHeight - node.scrollTop);
        if (dy) {
          animateScroll(node, 'scrollTop', node.scrollTop + dy);
          top -= dy;
          bottom -= dy;
        }
      }

      if (entry.x) {
        var dx = deltaFor(left, right, cr.left, cr.right, edgeMargin(cr.width));
        dx = clamp(dx, -node.scrollLeft, node.scrollWidth - node.clientWidth - node.scrollLeft);
        if (dx) {
          animateScroll(node, 'scrollLeft', node.scrollLeft + dx);
          left -= dx;
          right -= dx;
        }
      }
    }

    // Finally the document itself (pages that are not built on a fixed shell).
    var doc = document.scrollingElement || document.documentElement || document.body;
    if (!doc) return;

    var maxY = doc.scrollHeight - doc.clientHeight;
    if (maxY > 1) {
      var viewportH = window.innerHeight || doc.clientHeight;
      var docDy = deltaFor(top, bottom, 0, viewportH, edgeMargin(viewportH));
      docDy = clamp(docDy, -doc.scrollTop, maxY - doc.scrollTop);
      if (docDy) animateScroll(doc, 'scrollTop', doc.scrollTop + docDy);
    }
  }

  /* Cancels any in-flight animation and rewinds every scrolled container
   * back to the start, so "focus the first stop" really does show the top of
   * the screen instead of leaving the grid parked halfway down from whatever
   * the user was doing before the re-render. Only containers that are
   * actually scrolled are touched, so this stays a cheap property read. */
  function resetScroll(root) {
    var doc = document.scrollingElement || document.documentElement || document.body;
    if (doc) rewind(doc);

    var scope = root && root.querySelectorAll ? root : document.body;
    if (!scope) return;

    var all = scope.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].scrollTop || all[i].scrollLeft) rewind(all[i]);
    }
  }

  function rewind(el) {
    el['__navAnim_scrollTop'] = (el['__navAnim_scrollTop'] || 0) + 1;
    el['__navAnim_scrollLeft'] = (el['__navAnim_scrollLeft'] || 0) + 1;
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }

  /* ===== focus ===== */

  function clear() {
    if (current) current.classList.remove('focused');
    current = null;
  }

  function focus(el) {
    if (current) current.classList.remove('focused');
    current = el || null;
    if (!current) return;
    current.classList.add('focused');
    reveal(current);
  }

  /* Visual order (top row first, left to right inside a row) rather than DOM
   * order, so "the first stop" is always the one the user sees at the top. */
  function visualOrder(list) {
    return list.slice().sort(function (a, b) {
      var ra = rectOf(a);
      var rb = rectOf(b);
      if (Math.abs(ra.top - rb.top) > ROW_TOLERANCE) return ra.top - rb.top;
      return ra.left - rb.left;
    });
  }

  function focusFirst(root) {
    resetScroll(root);

    var list = getFocusable(root);
    if (!list.length) {
      clear();
      return;
    }

    var ordered = visualOrder(list);
    var nonInput = ordered.filter(function (el) {
      return !isTextInput(el);
    });

    focus(nonInput[0] || ordered[0]);
  }

  function ensureFocus(root) {
    if (!current || !document.body.contains(current)) {
      focusFirst(root);
    }
  }

  /* Re-focuses a specific element after a partial re-render (e.g. the tab
   * that was just activated), so a filter change does not throw the cursor
   * back up to the header. Falls back to focusFirst when it is gone. */
  function focusSelector(selector, root) {
    var scope = root || document;
    var el = null;
    try {
      el = scope.querySelector ? scope.querySelector(selector) : null;
    } catch (e) {
      // Channel group names come from the playlist, so a selector built from
      // one can be invalid — fall back to the normal rule rather than throw.
      el = null;
    }
    if (el && isVisible(el)) {
      focus(el);
      return true;
    }
    ensureFocus(root);
    return false;
  }

  /* ===== direction ===== */

  function centerOf(r) {
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* Pass 1 — strict: only elements that start past the current element's
   * trailing edge, scored by edge gap plus how badly their center misses the
   * current one on the other axis. This is what makes a grid behave like a
   * grid: "down" lands on the tile directly below instead of drifting
   * diagonally, and "right" on the last column does not wrap to the next
   * row (nothing qualifies, so focus simply stays put). */
  function strictCandidate(from, dir, list) {
    var fr = rectOf(from);
    var fc = centerOf(fr);
    var best = null;
    var bestScore = Infinity;

    list.forEach(function (el) {
      if (el === from) return;
      var r = rectOf(el);
      var c = centerOf(r);
      var gap;
      var cross;

      if (dir === 'right') {
        if (r.left < fr.right - 2) return;
        gap = r.left - fr.right;
        cross = Math.abs(c.y - fc.y);
      } else if (dir === 'left') {
        if (r.right > fr.left + 2) return;
        gap = fr.left - r.right;
        cross = Math.abs(c.y - fc.y);
      } else if (dir === 'down') {
        if (r.top < fr.bottom - 2) return;
        gap = r.top - fr.bottom;
        cross = Math.abs(c.x - fc.x);
      } else {
        if (r.bottom > fr.top + 2) return;
        gap = fr.top - r.bottom;
        cross = Math.abs(c.x - fc.x);
      }

      var score = gap + cross * CROSS_WEIGHT;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    });

    return best;
  }

  /* Pass 2 — loose: center-based fallback for layouts where boxes overlap on
   * the movement axis (an overlay control sitting on top of a tall banner,
   * a tall card next to short ones), so no stop is ever unreachable. */
  function looseCandidate(from, dir, list) {
    var fc = centerOf(rectOf(from));
    var best = null;
    var bestScore = Infinity;

    list.forEach(function (el) {
      if (el === from) return;
      var c = centerOf(rectOf(el));
      var dx = c.x - fc.x;
      var dy = c.y - fc.y;
      var primary;
      var cross;

      if (dir === 'right') {
        if (dx <= 1) return;
        primary = dx;
        cross = dy;
      } else if (dir === 'left') {
        if (dx >= -1) return;
        primary = -dx;
        cross = dy;
      } else if (dir === 'down') {
        if (dy <= 1) return;
        primary = dy;
        cross = dx;
      } else {
        if (dy >= -1) return;
        primary = -dy;
        cross = dx;
      }

      var score = primary + Math.abs(cross) * 2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    });

    return best;
  }

  function move(dir, root) {
    var list = getFocusable(root);
    if (!list.length) return;

    if (!current || list.indexOf(current) === -1) {
      focusFirst(root);
      return;
    }

    var next = strictCandidate(current, dir, list) || looseCandidate(current, dir, list);
    if (next) focus(next);
  }

  function activate() {
    if (!current) return;
    if (isTextInput(current)) {
      current.focus();
      if (current.select) current.select();
    } else {
      current.click();
    }
  }

  function handleKey(e, root) {
    var typing = current && document.activeElement === current && isTextInput(current);

    var isRight = e.keyCode === 39 || e.key === 'ArrowRight';
    var isLeft = e.keyCode === 37 || e.key === 'ArrowLeft';
    var isDown = e.keyCode === 40 || e.key === 'ArrowDown';
    var isUp = e.keyCode === 38 || e.key === 'ArrowUp';
    var isEnter = e.keyCode === 13 || e.key === 'Enter';

    if (typing) {
      // Let the browser handle typing/cursor movement natively; only
      // vertical arrows "escape" a single-line field back into navigation.
      if (isDown || isUp) {
        e.preventDefault();
        current.blur();
        move(isDown ? 'down' : 'up', root);
      }
      return;
    }

    if (isRight) {
      e.preventDefault();
      move('right', root);
    } else if (isLeft) {
      e.preventDefault();
      move('left', root);
    } else if (isDown) {
      e.preventDefault();
      move('down', root);
    } else if (isUp) {
      e.preventDefault();
      move('up', root);
    } else if (isEnter) {
      e.preventDefault();
      activate();
    }
  }

  return {
    getFocusable: getFocusable,
    focus: focus,
    focusFirst: focusFirst,
    ensureFocus: ensureFocus,
    focusSelector: focusSelector,
    move: move,
    activate: activate,
    handleKey: handleKey,
    clear: clear,
    getCurrent: function () {
      return current;
    }
  };
})();
