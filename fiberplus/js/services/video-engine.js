  /**
 * Reproductor basico: <video> + hls.js.
 */
var VideoEngine = (function () {
  var hlsInstance = null;
  var videoElement = null;
  var stateListener = null;
  var errorListener = null;
  var loadGeneration = 0;
  var serverRetryTimer = null;

  function isWebOS() {
    var ua = (navigator.userAgent || '').toLowerCase();
    return (
      ua.indexOf('web0s') !== -1 ||
      ua.indexOf('webos') !== -1 ||
      typeof window.PalmSystem !== 'undefined'
    );
  }

  function emitState() {
    if (stateListener) stateListener(getState());
  }

  function emitError(message) {
    if (errorListener) errorListener(message);
  }

  function onStateChange(fn) {
    stateListener = fn;
  }

  function onError(fn) {
    errorListener = fn;
  }

  function getBackendOrigin() {
    if (typeof window === 'undefined') return '';
    return window.__IPTV_BACKEND_ORIGIN__ || window.location.origin;
  }

  function isBackendUrl(url) {
    return /^https?:\/\//i.test(url) && url.indexOf(getBackendOrigin() + '/') === 0;
  }

  function init(videoEl) {
    videoElement = videoEl;
    if (!videoElement) return;
    videoElement.addEventListener('play', emitState);
    videoElement.addEventListener('pause', emitState);
    videoElement.addEventListener('volumechange', emitState);
    videoElement.addEventListener('loadedmetadata', emitState);
  }

  function getRequestUrl(url) {
    if (
      typeof window !== 'undefined' &&
      window.location &&
      window.__IPTV_PROXY_URL__ &&
      /^https?:\/\//i.test(url) &&
      !isBackendUrl(url)
    ) {
      return window.__IPTV_PROXY_URL__ + encodeURIComponent(url);
    }
    return url;
  }

  function isHlsUrl(url) {
    return /\.m3u8(?:$|[?#])/i.test(String(url || ''));
  }

  function isRemoteMediaUrl(url) {
    return /^https?:\/\//i.test(String(url || ''));
  }

  function requestTranscodedSource(url, done) {
    if (
      typeof window === 'undefined' ||
      !window.__IPTV_TRANSCODER_URL__ ||
      !/^https?:\/\//i.test(url)
    ) {
      done(null);
      return;
    }

    fetch(window.__IPTV_TRANSCODER_URL__ + encodeURIComponent(url))
      .then(function (response) {
        if (!response.ok) throw new Error('Transcoder HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        var transcodedUrl = data && data.url ? data.url : null;
        if (transcodedUrl && transcodedUrl.charAt(0) === '/') {
          transcodedUrl = getBackendOrigin() + transcodedUrl;
        }
        done(transcodedUrl);
      })
      .catch(function (error) {
        console.warn('[VideoEngine] No se pudo iniciar la transcodificacion:', error);
        done(null);
      });
  }

  function load(url, fallbackUrl, options) {
    if (!videoElement) {
      console.error('VideoEngine not initialized');
      return;
    }

    destroy(true);
    options = options || {};
    var generation = loadGeneration;
    var fallbackTried = false;
    var serverRetryCount = 0;
    var mediaRecoveryCount = 0;
    var hlsRecreated = !!options.recreated;
    var transcodeTried = !!options.transcoded;

    function tryTranscodedSource(reason) {
      if (transcodeTried || generation !== loadGeneration) return false;
      transcodeTried = true;
      console.warn('[VideoEngine] Solicitando video H.264/AAC compatible:', reason);
      requestTranscodedSource(url, function (transcodedUrl) {
        if (generation !== loadGeneration) return;
        if (!transcodedUrl) {
          emitError('El navegador no pudo obtener una salida de video compatible del servidor.');
          return;
        }
        load(transcodedUrl, null, { transcoded: true });
      });
      return true;
    }

    function tryFallback(reason) {
      if (
        fallbackTried ||
        !fallbackUrl ||
        fallbackUrl === url ||
        generation !== loadGeneration
      ) {
        return false;
      }
      fallbackTried = true;
      console.warn('[VideoEngine] Probando formato alternativo:', reason);
      load(fallbackUrl, null);
      return true;
    }

    // Desktop browsers do not share the codec support of the TV player.
    // Normalize every live channel once, before HLS.js sees it, so a source
    // with HEVC/MPEG-2/AC-3 cannot partially decode as audio-only or video-only.
    if (
      !isWebOS() &&
      isRemoteMediaUrl(url) &&
      window.__IPTV_TRANSCODER_URL__ &&
      !options.transcoded
    ) {
      if (tryTranscodedSource('compatibilidad de navegador')) return;
    }

    videoElement.onerror = function () {
      if (!tryFallback('fallo del reproductor nativo') && !tryTranscodedSource('fallo del reproductor nativo')) {
        emitError('Este canal no se puede reproducir en este dispositivo.');
      }
    };

    var finalUrl = getRequestUrl(url);
    var isHls = isHlsUrl(url);
    // Chromium can use HLS.js for HLS, but it cannot decode every audio
    // codec commonly emitted by XtreamUI (notably MP2 and AC-3). MPEG-TS is
    // not a browser fallback there, so do not switch formats and hide the
    // actual codec problem behind a generic playback error.
    var canUseNativeFallback = isWebOS() || !window.Hls || !Hls.isSupported();

    if (isHls && !isWebOS() && window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 24,
        maxMaxBufferLength: 40,
        maxBufferSize: 40 * 1000 * 1000,
        maxBufferHole: 0.2,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.2,
        nudgeMaxRetry: 5,
        liveSyncDurationCount: 4,
        liveMaxLatencyDurationCount: 8,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 3,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 4
      });

      var networkRetryCount = 0;

      hlsInstance.loadSource(finalUrl);
      hlsInstance.attachMedia(videoElement);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, function () {
        if (generation !== loadGeneration) return;
        videoElement.play().catch(function () {});
      });

      hlsInstance.on(Hls.Events.FRAG_PARSING_INIT_SEGMENT, function (event, data) {
        if (generation !== loadGeneration || !data || !data.tracks) return;
        var tracks = data.tracks;
        var audio = tracks.audio && String(tracks.audio.codec || '').toLowerCase();
        var video = tracks.video && String(tracks.video.codec || '').toLowerCase();
        var unsupportedAudio =
          audio && audio.indexOf('mp4a') !== 0 && audio.indexOf('aac') !== 0;
        var unsupportedVideo =
          video && video.indexOf('avc') !== 0 && video.indexOf('h264') !== 0;
        console.log('[VideoEngine] Códecs detectados por HLS.js:', {
          video: video,
          audio: audio,
          videoCompatible: !unsupportedVideo,
          audioCompatible: !unsupportedAudio
        });
        if (unsupportedVideo || unsupportedAudio) {
          tryTranscodedSource('codec no compatible (' + (video || 'video') + '/' + (audio || 'audio') + ')');
        }
      });

      hlsInstance.on(Hls.Events.ERROR, function (event, data) {
        if (!data.fatal || generation !== loadGeneration) return;

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            networkRetryCount++;
            if (data.response && data.response.code === 403) {
              if (canUseNativeFallback && tryFallback('el servidor rechazo la salida HLS (403)')) {
                break;
              } else if (tryTranscodedSource('el navegador recibio 403 en un segmento HLS')) {
                break;
              } else if (serverRetryCount < 1) {
                serverRetryCount++;
                console.warn('[VideoEngine] 403 temporal; liberando y reintentando una vez...');
                if (serverRetryTimer) clearTimeout(serverRetryTimer);
                serverRetryTimer = setTimeout(function () {
                  serverRetryTimer = null;
                  if (generation !== loadGeneration || !hlsInstance) return;
                  hlsInstance.stopLoad();
                  hlsInstance.startLoad(-1);
                }, 1800);
              } else {
                emitError(
                  'El servidor rechazo este canal (403). Libera conexiones activas en XtreamUI o intenta nuevamente.'
                );
              }
            } else if (data.response && data.response.code === 404) {
              if (!tryTranscodedSource('segmento HLS no disponible')) {
                emitError('El canal no pudo entregar uno de sus segmentos de video.');
              }
            } else if (networkRetryCount <= 1) {
              console.warn('[VideoEngine] Reintentando carga de red (' + networkRetryCount + '/2)...');
              hlsInstance.startLoad();
            } else if (!tryTranscodedSource('fallos repetidos de red HLS')) {
              var msg = 'Canal no disponible temporalmente en el servidor.';
              emitError(msg);
            }
            break;

          case Hls.ErrorTypes.MEDIA_ERROR:
            mediaRecoveryCount++;
            if (mediaRecoveryCount <= 2) {
              console.warn(
                '[VideoEngine] Recuperando buffer de medios (' +
                mediaRecoveryCount + '/2)...'
              );
              hlsInstance.recoverMediaError();
            } else if (!hlsRecreated) {
              hlsRecreated = true;
              console.warn('[VideoEngine] Reiniciando HLS.js para recuperar el canal.');
              if (serverRetryTimer) clearTimeout(serverRetryTimer);
              serverRetryTimer = setTimeout(function () {
                serverRetryTimer = null;
                if (generation !== loadGeneration) return;
                load(url, fallbackUrl, {
                  transcoded: transcodeTried,
                  recreated: true
                });
              }, 700);
            } else if (!tryTranscodedSource('error de decodificacion de medios')) {
              emitError(
                'No se pudo reconstruir el buffer HLS de este canal. ' +
                'El servidor puede estar entregando un codec no compatible o segmentos dañados.'
              );
            }
            break;

          default:
            console.error('[VideoEngine] Error no recuperable:', data);
            if (canUseNativeFallback && tryFallback('error HLS no recuperable')) {
              break;
            } else if (!hlsRecreated) {
              hlsRecreated = true;
              console.warn(
                '[VideoEngine] Reiniciando HLS.js después de un error ' +
                (data.details || data.type || 'desconocido') + '.'
              );
              if (serverRetryTimer) clearTimeout(serverRetryTimer);
              serverRetryTimer = setTimeout(function () {
                serverRetryTimer = null;
                if (generation !== loadGeneration) return;
                load(url, fallbackUrl, {
                  transcoded: transcodeTried,
                  recreated: true
                });
              }, 700);
            } else if (!tryTranscodedSource('error HLS no recuperable')) {
              destroy(true);
              emitError(
                'El canal no pudo iniciar. El navegador necesita H.264/AAC y el servidor no pudo generar una salida compatible.'
              );
            }
            break;
        }
      });
    } else {
      videoElement.src = finalUrl;
      videoElement.load();
      videoElement.play().catch(function () {});
    }
  }

  function destroy(keepElement) {
    loadGeneration++;
    if (serverRetryTimer) {
      clearTimeout(serverRetryTimer);
      serverRetryTimer = null;
    }
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }

    if (videoElement) {
      videoElement.onerror = null;
      videoElement.pause();
      videoElement.src = '';
      videoElement.removeAttribute('src');
      videoElement.load();
    }

    if (keepElement) return;

    if (videoElement) {
      videoElement.removeEventListener('play', emitState);
      videoElement.removeEventListener('pause', emitState);
      videoElement.removeEventListener('volumechange', emitState);
      videoElement.removeEventListener('loadedmetadata', emitState);
      videoElement = null;
    }
    stateListener = null;
    errorListener = null;
  }

  function togglePlay() {
    if (!videoElement) return;
    if (videoElement.paused) {
      videoElement.play().catch(function () {});
    } else {
      videoElement.pause();
    }
  }

  function toggleMute() {
    if (!videoElement) return;
    videoElement.muted = !videoElement.muted;
  }

  function setVolume(vol) {
    if (videoElement) videoElement.volume = Math.max(0, Math.min(1, vol));
  }

  function seek(time) {
    if (videoElement) videoElement.currentTime = time;
  }

  function getCurrentTime() {
    return videoElement ? videoElement.currentTime : 0;
  }

  function getDuration() {
    return videoElement ? videoElement.duration || 0 : 0;
  }

  function isPlaying() {
    return videoElement ? !videoElement.paused : false;
  }

  function isMuted() {
    return videoElement ? videoElement.muted : false;
  }

  function getVolume() {
    return videoElement ? videoElement.volume : 0.5;
  }

  function getState() {
    return {
      playing: isPlaying(),
      muted: isMuted(),
      volume: getVolume(),
      currentTime: getCurrentTime(),
      duration: getDuration()
    };
  }

  return {
    init: init,
    load: load,
    destroy: destroy,
    togglePlay: togglePlay,
    toggleMute: toggleMute,
    setVolume: setVolume,
    getVolume: getVolume,
    seek: seek,
    getCurrentTime: getCurrentTime,
    getDuration: getDuration,
    isPlaying: isPlaying,
    isMuted: isMuted,
    getState: getState,
    onStateChange: onStateChange,
    onError: onError,
    isWebOS: isWebOS
  };
})();
