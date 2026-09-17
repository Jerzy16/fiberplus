/**
 * Small shared helpers used by every component/page.
 */
var Utils = (function () {
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;');
  }

  return {
    escapeHtml: escapeHtml,
    escapeAttr: escapeAttr
  };
})();
