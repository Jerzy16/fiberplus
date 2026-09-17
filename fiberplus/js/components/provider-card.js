/** Provider mark shared by the login screen's avatar. */
var ProviderCard = (function () {
  function logoFor(provider) {
    return provider.logo
      ? '<img src="' +
          Utils.escapeAttr(provider.logo) +
          '" alt="' +
          Utils.escapeAttr(provider.name) +
          '" />'
      : '';
  }

  return { logoFor: logoFor };
})();
