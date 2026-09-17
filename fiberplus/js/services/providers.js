/**
 * Provider registry. Add new IPTV providers here — everything else
 * (login gating, channel fetching, home grid) reads from this list,
 * so a new provider needs no changes outside this file plus, if it
 * needs auth, a matching entry in AuthService/IptvService source types.
 */
var Providers = (function () {
  var registry = [
    {
      id: 'fiberplus',
      name: 'Fiberplus',
      logo: 'assets/fiberplus.svg',
      requiresAuth: true,
      free: false,
      // Xtream Codes backend: the credentials are validated through
      // player_api.php and the live channels are loaded from the same API.
      source: {
        type: 'xtream',
        host: 'http://192.168.200.6:25461',
        // m3u8 produces HLS URLs compatible with the browser and TV player.
        output: 'm3u8'
      }
    }
  ];

  function getAll() {
    return registry;
  }

  function getById(id) {
    for (var i = 0; i < registry.length; i++) {
      if (registry[i].id === id) return registry[i];
    }
    return null;
  }

  return {
    getAll: getAll,
    getById: getById
  };
})();
