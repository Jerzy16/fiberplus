/**
 * Per-provider session storage. Each provider keeps its own session/cache
 * so logging into "fiberplus" never affects "onedxd" or any future
 * provider that also requires auth.
 */
var AuthService = (function () {
  function sessionKey(providerId) {
    return 'dxdtv_session_' + providerId;
  }

  function channelsKey(providerId) {
    return 'dxdtv_channels_' + providerId;
  }

  function isLoggedIn(providerId) {
    try {
      return !!localStorage.getItem(sessionKey(providerId));
    } catch (e) {
      return false;
    }
  }

  function saveSession(providerId, credentials) {
    var payload = {
      username: credentials.username,
      password: credentials.password,
      provider: providerId
    };
    try {
      localStorage.setItem(sessionKey(providerId), JSON.stringify(payload));
    } catch (e) {
      console.warn('AuthService: no se pudo guardar sesión en localStorage', e);
    }
  }

  function getSession(providerId) {
    try {
      var raw = localStorage.getItem(sessionKey(providerId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearSession(providerId) {
    try {
      localStorage.removeItem(sessionKey(providerId));
      localStorage.removeItem(channelsKey(providerId));
    } catch (e) {}
  }

  function clearAllSessions() {
    Providers.getAll().forEach(function (provider) {
      clearSession(provider.id);
    });
  }

  function saveChannels(providerId, channels) {
    try {
      localStorage.setItem(channelsKey(providerId), JSON.stringify(channels));
    } catch (e) {
      console.warn('AuthService: cuota excedida o error al guardar canales en localStorage', e);
    }
  }

  function getStoredChannels(providerId) {
    try {
      var raw = localStorage.getItem(channelsKey(providerId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  return {
    isLoggedIn: isLoggedIn,
    saveSession: saveSession,
    getSession: getSession,
    clearSession: clearSession,
    clearAllSessions: clearAllSessions,
    saveChannels: saveChannels,
    getStoredChannels: getStoredChannels
  };
})();
