/**
 * A provider's home stage. The first channel of the playlist plays full
 * bleed behind the whole screen (muted, looping); a gradient scrim carries
 * the channel's name, its category and the "Ver ahora" call to action, and
 * the provider's full channel list runs along the bottom edge as a rail.
 *
 * There is no grid, no search and no category filter any more: the rail is
 * the only way through the list, so it renders a moving window of it (see
 * ChannelRail) instead of thousands of tiles.
 *
 * Remote/keyboard nav over the home button, the play button and the rail is
 * delegated to SpatialNav, scoped to #home-page-body.
 */
var HomePage = (function () {
  var previewHls = null;
  var previewUrl = null;
  var previewGeneration = 0;

  async function render(providerId) {
    var provider = Providers.getById(providerId);
    if (!provider) {
      Router.navigate('#login/fiberplus');
      return;
    }
    if (provider.requiresAuth && !AuthService.isLoggedIn(provider.id)) {
      Router.navigate('#login/' + provider.id);
      return;
    }

    if (typeof VideoEngine !== 'undefined') VideoEngine.destroy();
    destroyPreview();
    Store.setBackRoute('#login/fiberplus');
    Store.setNavHandler(null);
    SpatialNav.clear();

    document.getElementById('app').innerHTML = StateMessage.fullscreen(
      StateMessage.loading('Obteniendo canales de ' + provider.name + '...')
    );

    var channels =
      Store.getCachedChannels(provider.id) ||
      (provider.requiresAuth ? AuthService.getStoredChannels(provider.id) : null);

    if (!channels) {
      try {
        var credentials = provider.requiresAuth ? AuthService.getSession(provider.id) : {};
        channels = await IptvService.fetchForProvider(provider, credentials || {});
        if (provider.requiresAuth) AuthService.saveChannels(provider.id, channels);
      } catch (err) {
        document.getElementById('app').innerHTML = StateMessage.fullscreen(
          StateMessage.error('Error al cargar canales: ' + err.message, '#login/fiberplus', 'Volver')
        );
        return;
      }
    }

    if (!channels.length) {
      document.getElementById('app').innerHTML = StateMessage.fullscreen(
        StateMessage.error('No hay canales disponibles para este proveedor.', '#login/fiberplus', 'Volver')
      );
      return;
    }

    Store.setChannels(provider.id, channels);

    // Come back up on whatever the user was last watching. A stale resume
    // point (playlist changed, channel gone, first ever visit) simply misses
    // the lookup and the stage opens on the top of the list as before.
    var startIndex = ChannelRail.indexOfUrl(channels, Store.getLastChannel(provider.id));
    if (startIndex === -1) startIndex = 0;

    renderShell(provider, channels[startIndex], startIndex);
    ChannelRail.mount(railEl(), channels, startIndex);
    loadPreview(channels[startIndex]);

    Store.setNavHandler(handleKeyNav);
    // The cursor opens on the call to action rather than on a corner control.
    SpatialNav.focusSelector('#stage-play', root());
  }

  function renderShell(provider, featured, featuredIndex) {
    document.getElementById('app').innerHTML =
      '<div class="stage-page" id="home-page-body">' +
      '<video class="stage-video" id="stage-video" muted autoplay loop playsinline></video>' +
      '<div class="stage-scrim"></div>' +
      // Only authenticated providers have a session to end.
      (provider.requiresAuth
        ? '<button class="icon-btn corner-btn corner-btn-right" onclick="App.logout(\'' +
          Utils.escapeAttr(provider.id) +
          '\')" title="Cerrar sesión">' +
          Icons.logout(20) +
          '</button>'
        : '') +
      '<div class="stage-body">' +
      '<div class="stage-hero">' +
      '<h1>' +
      Utils.escapeHtml(featured.name || 'Sin nombre') +
      '</h1>' +
      '<div class="stage-hero-group">' +
      Utils.escapeHtml(featured.groupTitle || 'Sin categoria') +
      '</div>' +
      '<button class="btn btn-primary" id="stage-play" onclick="App.playChannelAt(' +
      featuredIndex +
      ')">' +
      Icons.play(18) +
      ' Ver ahora</button>' +
      '</div>' +
      '<div class="stage-rail">' +
      '<h2>Descubrir mas contenido</h2>' +
      '<div class="channels-row" id="stage-rail"></div>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  function root() {
    return document.getElementById('home-page-body');
  }

  function railEl() {
    return document.getElementById('stage-rail');
  }

  function handleKeyNav(e) {
    SpatialNav.handleKey(e, root());
    ChannelRail.extend(railEl(), Store.get().channels);
  }

  /* Background preview of the featured channel. Muted and looping — it is
   * scenery, not playback; picking a channel hands the real stream to
   * VideoEngine on the player page. */
  function loadPreview(channel) {
    if (!channel || !channel.url) return;
    if (channel.url === previewUrl) return;
    destroyPreview();

    var video = document.getElementById('stage-video');
    if (!video) return;

    previewUrl = channel.url;
    var url = channel.url;
    var generation = ++previewGeneration;

    if (
      !VideoEngine.isWebOS() &&
      window.__IPTV_TRANSCODER_URL__ &&
      /^https?:\/\//i.test(url)
    ) {
      fetch(window.__IPTV_TRANSCODER_URL__ + encodeURIComponent(url))
        .then(function (response) {
          if (!response.ok) throw new Error('Transcoder HTTP ' + response.status);
          return response.json();
        })
        .then(function (data) {
          if (generation !== previewGeneration || !data || !data.url) return;
          attachPreview(data.url, video, generation);
        })
        .catch(function () {
          if (generation === previewGeneration) destroyPreview();
        });
      return;
    }

    attachPreview(url, video, generation);
  }

  function attachPreview(url, video, generation) {
    if (generation !== previewGeneration || !video) return;

    // Same native-vs-hls.js decision as VideoEngine: on LG webOS (and Safari)
    // the native player decodes the full codec set, so the preview must not be
    // forced through hls.js/MSE either — otherwise HEVC channels show a black
    // background on the TV. hls.js stays the desktop-browser fallback.
    var preferNative =
      VideoEngine.isWebOS() ||
      (!window.Hls || !Hls.isSupported()) &&
      (video.canPlayType && video.canPlayType('application/vnd.apple.mpegurl'));

    if (!preferNative && !/^https?:\/\//i.test(url) && url.indexOf('/') !== 0) {
      destroyPreview();
      return;
    }

    var finalUrl = (
      typeof window !== 'undefined' &&
      window.__IPTV_PROXY_URL__ &&
      /^https?:\/\//i.test(url)
    ) ? (window.__IPTV_PROXY_URL__ + encodeURIComponent(url)) : url;

    if (/\.m3u8(?:$|[?#])/i.test(url) && !preferNative && window.Hls && Hls.isSupported()) {
      previewHls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30
      });
      previewHls.loadSource(finalUrl);
      previewHls.attachMedia(video);
      previewHls.on(Hls.Events.MANIFEST_PARSED, function () {
        video.play().catch(function () {});
      });
      previewHls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) destroyPreview();
      });
    } else {
      video.src = finalUrl;
      video.play().catch(function () {});
    }
  }

  function destroyPreview() {
    previewGeneration++;
    if (previewHls) {
      previewHls.destroy();
      previewHls = null;
    }
    var video = document.getElementById('stage-video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    previewUrl = null;
  }

  return { render: render, teardown: destroyPreview };
})();
