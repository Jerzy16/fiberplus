/**
 * Horizontal channel rail, shared by the home stage and the player overlay.
 *
 * A provider playlist can carry several thousand entries, and building that
 * many tiles up front costs the TV both the DOM work and one image request
 * per tile (`loading="lazy"` is ignored by the webOS browser, so every logo
 * would be fetched immediately) — which is what made moving the cursor feel
 * sluggish. The rail therefore renders a moving window of the list and grows
 * it in both directions as the cursor approaches either end, so the whole
 * playlist stays reachable without ever existing in the DOM at once.
 *
 * The window bounds live on the container element itself rather than in
 * module state, so the two rails (stage and player) can be open at once
 * without sharing a cursor.
 */
var ChannelRail = (function () {
  var CHUNK_SIZE = 40;
  // How close to an edge of the rendered window the cursor has to get before
  // the next chunk is built.
  var EDGE = 8;

  function tiles(channels, from, to, activeIndex) {
    var html = '';
    for (var i = from; i < to; i++) {
      html += ChannelCard.render(channels[i], i, i === activeIndex);
    }
    return html;
  }

  /* Opens the window on `activeIndex` with a little room to its left, so the
   * channel currently on screen is visible without the user having to scroll
   * back to the start of a several-thousand entry list. */
  function mount(el, channels, activeIndex) {
    if (!el || !channels || !channels.length) return;
    var active = activeIndex >= 0 ? activeIndex : 0;
    var start = Math.max(0, active - Math.floor(CHUNK_SIZE / 4));
    var end = Math.min(channels.length, start + CHUNK_SIZE);

    // Drop queued work from the previous rail; resolved logos are reused by
    // LogoLoader, so this does not cause already loaded logos to download.
    LogoLoader.reset();
    el.railStart = start;
    el.railEnd = end;
    el.innerHTML = tiles(channels, start, end, activeIndex);
    scrollActiveIntoView(el);
    LogoLoader.enqueue(el);
  }

  /* Brings the active tile to the left edge of the rail. Without this a
   * resumed channel sitting a few hundred entries into the playlist opens
   * off-screen: the window is rendered around it, but the rail itself is
   * still scrolled to the start. Measured from live rects rather than
   * offsetLeft, which is relative to whichever ancestor happens to be
   * positioned. */
  function scrollActiveIntoView(el) {
    var active = el.querySelector('.channel-card.active');
    if (!active) return;
    el.scrollLeft += active.getBoundingClientRect().left - el.getBoundingClientRect().left;
  }

  function focusedIndex(el) {
    var cur = SpatialNav.getCurrent();
    if (!cur || cur.parentNode !== el) return -1;
    var index = parseInt(cur.getAttribute('data-index'), 10);
    return isNaN(index) ? -1 : index;
  }

  function appendTiles(el, html, atStart) {
    // Built in a detached buffer and moved node by node rather than through
    // innerHTML +=, so the tiles already on screen are not rebuilt — that
    // would drop the cursor and reset the scroll position mid-navigation.
    var buffer = document.createElement('div');
    buffer.innerHTML = html;

    var frag = document.createDocumentFragment();
    while (buffer.firstChild) {
      frag.appendChild(buffer.firstChild);
    }

    if (atStart) {
      el.insertBefore(frag, el.firstChild);
    } else {
      el.appendChild(frag);
    }
  }

  /* Called after every remote key press on a page owning a rail. Cheap when
   * there is nothing to do: two integer comparisons unless the cursor is
   * actually sitting near an edge of the window. */
  function extend(el, channels) {
    if (!el || !channels) return;
    var index = focusedIndex(el);
    if (index === -1) return;

    if (index >= el.railEnd - EDGE && el.railEnd < channels.length) {
      var end = Math.min(channels.length, el.railEnd + CHUNK_SIZE);
      appendTiles(el, tiles(channels, el.railEnd, end, -1), false);
      el.railEnd = end;
    }

    if (index <= el.railStart + EDGE && el.railStart > 0) {
      var start = Math.max(0, el.railStart - CHUNK_SIZE);
      // Prepending pushes every existing tile to the right, which would slide
      // the focused tile out from under the cursor — add the same amount back
      // to the scroll offset so the view does not move at all.
      var widthBefore = el.scrollWidth;
      appendTiles(el, tiles(channels, start, el.railStart, -1), true);
      el.scrollLeft += el.scrollWidth - widthBefore;
      el.railStart = start;
    }

    // Cheap when nothing was added: already-queued tiles are skipped.
    LogoLoader.enqueue(el);
  }

  /* Index of a channel inside the provider's full list, by stream URL — how
   * both pages work out which tile to mark as the one currently playing. */
  function indexOfUrl(channels, url) {
    if (!channels) return -1;
    for (var i = 0; i < channels.length; i++) {
      if (channels[i].url === url) return i;
    }
    return -1;
  }

  return { mount: mount, extend: extend, indexOfUrl: indexOfUrl };
})();
