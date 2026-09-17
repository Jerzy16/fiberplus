/** Brand mark shared by the login screen's provider avatar. */
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

  return { logoFor: logoFor };
})();
