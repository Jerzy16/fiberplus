/**
 * A single channel tile: logo band over the channel name. Used by both
 * rails — the one along the bottom of the home stage and the one the player
 * reveals when the user presses Down.
 *
 * `index` is the channel's position in the provider's full channel list
 * (Store.get().channels), which is what App.playChannelAt resolves against.
 * The rails render a moving window of that list, so the index is written out
 * explicitly rather than inferred from the tile's position in the DOM.
 */
var ChannelCard = (function () {
  function render(ch, index, isActive) {
    var name = ch.name || 'Sin nombre';
    var logo = ch.tvgLogo || '';

    // The tile starts in placeholder mode: the "no signal" mark fills the
    // media box, so a channel whose playlist entry has no logo — a good tenth
    // of this list carries `tvg-logo=""` — or whose logo never arrives still
    // reads as a proper tile instead of an empty gap. It replaced an initial
    // letter, which was useless here: these channel names are numbered
    // ("6.3 TNT Novelas", "6.4 TCM"), so every tile in a group showed the
    // same digit.
    //
    // The URL is parked in `data-logo` with no `src`, so nothing is requested
    // until LogoLoader decides to. Letting the browser fetch all of them at
    // once is what tripped imgur's rate limiter and left whole rails showing
    // only letters. LogoLoader swaps the letter out for the image (by adding
    // `has-logo`) once it has actually loaded. The letter cannot simply sit
    // *behind* the image either: a logo with a transparent background would
    // let it show through.
    var media =
      '<div class="channel-card-media">' +
      '<div class="channel-card-fallback">' +
      Icons.channelPlaceholder() +
      '</div>' +
      (logo
        ? '<img class="channel-card-logo" data-logo="' + Utils.escapeAttr(logo) + '" alt="" />'
        : '') +
      '</div>';

    return (
      '<div class="channel-card' +
      (isActive ? ' active' : '') +
      '" data-index="' +
      index +
      '" onclick="App.playChannelAt(' +
      index +
      ')">' +
      media +
      '<div class="channel-card-name">' +
      Utils.escapeHtml(name) +
      '</div>' +
      '</div>'
    );
  }

  return { render: render };
})();
