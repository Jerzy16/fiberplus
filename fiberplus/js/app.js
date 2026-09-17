/**
 * App bootstrap: wires routes to pages and exposes the small set of
 * cross-page actions (`App.*`) that component markup calls via inline
 * onclick handlers.
 *
 * The flow is four screens deep:
 *   splash -> #providers -> [#login/:id] -> #home/:id -> #player/:id/:url
 */
var App = (function () {
  function init() {
    Keyboard.init();
    initWebOS();
    registerRoutes();
    bootWithSplash();
  }

  function initWebOS() {
    if (typeof webOS === 'undefined') return;
    try {
      var info = webOS.deviceInfo;
      console.log('webOS TV:', info.modelName || info.platformVersion || '');
    } catch (e) {}
  }

  function registerRoutes() {
    Router.register('providers', function () {
      ProvidersPage.render();
    });
    Router.register('login/:providerId', function (params) {
      LoginPage.render(params.providerId);
    });
    Router.register('home/:providerId', function (params) {
      HomePage.render(params.providerId);
    });
    Router.register('player/:providerId/:url', function (params) {
      PlayerPage.render(params.providerId, params.url);
    });
  }

  function bootWithSplash() {
    SplashPage.render();
    setTimeout(function () {
      Router.start();
    }, 1600);
  }

  function openProvider(providerId) {
    var provider = Providers.getById(providerId);
    if (!provider) return;
    if (provider.requiresAuth && !AuthService.isLoggedIn(providerId)) {
      Router.navigate('#login/' + providerId);
    } else {
      Router.navigate('#home/' + providerId);
    }
  }

  /* `index` is a position in the provider's full channel list — both rails
   * write the absolute index onto each tile, so it stays valid however far
   * the rail's rendered window has moved. */
  function playChannelAt(index) {
    var ch = Store.getChannelAt(index);
    if (!ch || !ch.url) return;
    Router.navigate('#player/' + Store.get().providerId + '/' + encodeURIComponent(ch.url));
  }

  function exitPlayer() {
    Router.navigate(Store.get().backRoute || '#providers');
  }

  /* Ends one provider's session (the stage's logout button passes its id) or,
   * with no argument, every session at once. Per-provider is the meaningful
   * case: sessions are stored separately so signing out of fiberplus must
   * not touch any other provider. The resume point goes with it — it belongs
   * to the account that was just signed out. */
  function logout(providerId) {
    if (providerId) {
      AuthService.clearSession(providerId);
      Store.clearLastChannel(providerId);
    } else {
      AuthService.clearAllSessions();
      Providers.getAll().forEach(function (provider) {
        Store.clearLastChannel(provider.id);
      });
    }
    Store.clearCache();
    Router.navigate('#providers');
  }

  return {
    init: init,
    openProvider: openProvider,
    playChannelAt: playChannelAt,
    exitPlayer: exitPlayer,
    logout: logout
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
