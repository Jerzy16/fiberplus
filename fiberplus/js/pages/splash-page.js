/**
 * Boot screen shown briefly before the router takes over: the brand mark on
 * the ambient backdrop, nothing else.
 */
var SplashPage = (function () {
  function render() {
    document.getElementById('app').innerHTML =
      '<div class="splash-page">' +
      '<img class="splash-logo" src="assets/Fiberplus.svg" alt="Fiberplus" />' +
      '<div class="splash-footer">Fiberplus</div>' +
      '</div>';
  }

  return { render: render };
})();
