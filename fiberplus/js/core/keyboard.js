/**
 * Global remote/keyboard handling. Individual pages plug in behaviour via
 * Store.setNavHandler(fn) instead of adding their own document listeners.
 * The back button (webOS remote or Escape for desktop testing) is handled
 * here globally using Store's backRoute.
 */
var Keyboard = (function () {
  function isBackKey(e) {
    return e.keyCode === 461 || e.key === 'GoBack' || e.key === 'Escape';
  }

  function handleKeydown(e) {
    if (isBackKey(e)) {
      e.preventDefault();
      var state = Store.get();
      if (state.onBack) {
        state.onBack();
      } else {
        Router.navigate(state.backRoute || '#providers');
      }
      return;
    }

    var handler = Store.get().navHandler;
    if (handler) {
      handler(e);
    }
  }

  function init() {
    document.addEventListener('keydown', handleKeydown);
  }

  return { init: init };
})();
