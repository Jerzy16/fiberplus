/**
 * Portrait provider tile shown on the picker screen: brand mark over the
 * provider's name. `logoFor` is shared with the login screen's avatar.
 *
 * one DxD renders as an inline SVG so the mark can flip to navy when the
 * cursor lands on the tile; providers shipped as a raster asset (fiberplus)
 * are already full-colour and read correctly on both fills.
 */
var ProviderCard = (function () {
  function logoFor(provider) {
    if (provider.logo) {
      return (
        '<img src="' +
        Utils.escapeAttr(provider.logo) +
        '" alt="' +
        Utils.escapeAttr(provider.name) +
        '" />'
      );
    }
    return Icons.brandOneDxd();
  }

  function render(provider) {
    return (
      '<div class="provider-card-wrap">' +
      '<div class="provider-card" data-provider="' +
      Utils.escapeAttr(provider.id) +
      '" onclick="App.openProvider(\'' +
      Utils.escapeAttr(provider.id) +
      '\')">' +
      // The card itself is a padding-ratio box (see .provider-card in
      // components.css), so its content lives in an absolutely positioned
      // inner layer that does the centring.
      '<div class="provider-card-inner">' +
      '<div class="provider-card-art">' +
      logoFor(provider) +
      '</div>' +
      '</div>' +
      '</div>' +
      // Outside the circle on purpose: it is a caption, not part of the
      // button, so it keeps its white colour when the cursor fills the
      // circle white.
      '<div class="provider-card-label">' +
      Utils.escapeHtml(provider.name) +
      '</div>' +
      '</div>'
    );
  }

  function renderList(providers) {
    return providers.map(render).join('');
  }

  return { render: render, renderList: renderList, logoFor: logoFor };
})();
