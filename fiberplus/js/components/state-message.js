/**
 * Loading / error placeholders shared by any page that fetches data.
 */
var StateMessage = (function () {
  function loading(text) {
    return '<div class="state-message"><div class="spinner"></div>' + Utils.escapeHtml(text) + '</div>';
  }

  function error(message, route, label) {
    var html =
      '<div class="state-message is-error">' + Utils.escapeHtml(message) + '</div>';
    if (route) {
      html +=
        '<div class="state-actions"><button class="btn btn-ghost" onclick="Router.navigate(\'' +
        route +
        '\')">' +
        Utils.escapeHtml(label || 'Volver') +
        '</button></div>';
    }
    return html;
  }

  function fullscreen(innerHtml) {
    return '<div class="fullscreen-state">' + innerHtml + '</div>';
  }

  return { loading: loading, error: error, fullscreen: fullscreen };
})();
