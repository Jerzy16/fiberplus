/**
 * Central mutable app state shared across pages/components.
 * Kept intentionally simple (no pub-sub) — pages read/write it directly
 * and re-render themselves after mutating.
 */
var Store = (function () {
  var state = {
    providerId: null,
    channels: [],
    backRoute: '#providers',
    navHandler: null,
    onBack: null
  };

  var channelsCache = {};

  function setChannels(providerId, channels) {
    state.providerId = providerId;
    state.channels = channels;
    channelsCache[providerId] = channels;
  }

  function getCachedChannels(providerId) {
    return channelsCache[providerId] || null;
  }

  function clearCache() {
    channelsCache = {};
  }

  function getChannelAt(index) {
    return state.channels ? state.channels[index] || null : null;
  }

  /* ===== Resume point =====
   * The channel the user was last watching, per provider, so the home stage
   * comes back up on it instead of always restarting at the top of the list.
   * Persisted rather than kept in memory so it survives an app restart, not
   * just a back press. Keyed by stream URL, which is what the player routes
   * on; if the playlist changes and the URL is gone, the lookup simply
   * misses and the stage falls back to the first channel.
   *
   * Every access is guarded: localStorage throws on some webOS profiles and
   * when the quota is full, and losing a resume point is never worth failing
   * a render over. */
  function lastChannelKey(providerId) {
    return 'dxdtv_last_channel_' + providerId;
  }

  function setLastChannel(providerId, url) {
    if (!providerId || !url) return;
    try {
      localStorage.setItem(lastChannelKey(providerId), url);
    } catch (e) {}
  }

  function getLastChannel(providerId) {
    if (!providerId) return null;
    try {
      return localStorage.getItem(lastChannelKey(providerId));
    } catch (e) {
      return null;
    }
  }

  function clearLastChannel(providerId) {
    if (!providerId) return;
    try {
      localStorage.removeItem(lastChannelKey(providerId));
    } catch (e) {}
  }

  function setBackRoute(route) {
    state.backRoute = route;
  }

  function setNavHandler(fn) {
    state.navHandler = fn;
  }

  function setOnBack(fn) {
    state.onBack = fn;
  }

  return {
    get: function () {
      return state;
    },
    setChannels: setChannels,
    getCachedChannels: getCachedChannels,
    getChannelAt: getChannelAt,
    clearCache: clearCache,
    setLastChannel: setLastChannel,
    getLastChannel: getLastChannel,
    clearLastChannel: clearLastChannel,
    setBackRoute: setBackRoute,
    setNavHandler: setNavHandler,
    setOnBack: setOnBack
  };
})();
