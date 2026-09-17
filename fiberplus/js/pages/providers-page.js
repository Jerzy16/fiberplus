/**
 * Provider picker — the app's landing screen. One tile per entry in the
 * Providers registry; picking one either opens its home stage directly
 * (one DxD, free) or goes through the login gate first (fiberplus).
 */
var ProvidersPage = (function () {
  function render() {
    if (typeof VideoEngine !== 'undefined') VideoEngine.destroy();
    Store.setBackRoute('#providers');
    Store.setNavHandler(handleKeyNav);
    SpatialNav.clear();

    document.getElementById('app').innerHTML =
      '<div class="providers-page" id="providers-page-body">' +
      '<div class="providers-inner">' +
      '<h1 class="providers-title">Elige tu espacio de Entretenimiento</h1>' +
      '<div class="providers-row">' +
      ProviderCard.renderList(Providers.getAll()) +
      '</div>' +
      '</div>' +
      '</div>';

    SpatialNav.focusFirst(root());
  }

  function root() {
    return document.getElementById('providers-page-body');
  }

  function handleKeyNav(e) {
    SpatialNav.handleKey(e, root());
  }

  return { render: render };
})();
