/**
 * Minimal hash router. Pages register themselves with `register`,
 * app.js calls `start` once everything is loaded.
 */
var Router = (function () {
  var routes = [];

  function register(pattern, handler) {
    var paramNames = [];
    var regex = new RegExp(
      '^' +
        pattern.replace(/:([^/]+)/g, function (_, name) {
          paramNames.push(name);
          return '([^/]+)';
        }) +
        '$'
    );
    routes.push({ regex: regex, paramNames: paramNames, handler: handler });
  }

  function resolve() {
    var hash = (window.location.hash || '#providers').slice(1);

    if (hash.indexOf('player') !== 0 && typeof PlayerPage !== 'undefined' && PlayerPage.teardown) {
      PlayerPage.teardown();
    }

    if (hash.indexOf('home') !== 0 && typeof HomePage !== 'undefined' && HomePage.teardown) {
      HomePage.teardown();
    }

    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];
      var match = hash.match(route.regex);
      if (match) {
        var params = {};
        route.paramNames.forEach(function (name, idx) {
          params[name] = decodeURIComponent(match[idx + 1]);
        });
        route.handler(params);
        return;
      }
    }

    navigate('#providers');
  }

  function navigate(hash) {
    if (window.location.hash === hash) {
      resolve();
    } else {
      window.location.hash = hash;
    }
  }

  function start() {
    window.addEventListener('hashchange', resolve);
    resolve();
  }

  return {
    register: register,
    start: start,
    navigate: navigate
  };
})();
