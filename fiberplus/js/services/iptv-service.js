/**
 * Descarga y parsea las listas M3U de cada proveedor.
 * Fetch normal: se pide la lista completa de una sola vez.
 */
var IptvService = (function () {
  function getRequestUrl(url) {
    if (
      typeof window !== 'undefined' &&
      window.location &&
      window.__IPTV_PROXY_URL__
    ) {
      return window.__IPTV_PROXY_URL__ + encodeURIComponent(url);
    }
    return url;
  }

  function normalizeHost(host) {
    return String(host || '').replace(/\/+$/, '');
  }

  function browserMediaProfile(stream) {
    var video = String(
      stream.video_codec || stream.video_codec_name || stream.codec_video || ''
    ).toLowerCase();
    var audio = String(
      stream.audio_codec || stream.audio_codec_name || stream.codec_audio || ''
    ).toLowerCase();
    var videoCompatible = !video || video === 'h264' || video === 'avc' || video.indexOf('avc1') === 0;
    var audioCompatible = !audio || audio === 'aac' || audio.indexOf('mp4a') === 0;
    return {
      video: video,
      audio: audio,
      browserCompatible: videoCompatible && audioCompatible
    };
  }

  async function fetchM3U(url) {
    var response = await fetch(getRequestUrl(url));
    if (!response.ok) {
      throw new Error('Error al conectar con el servidor IPTV: ' + response.statusText);
    }
    var text = await response.text();
    return M3UParser.parse(text).channels || [];
  }

  async function fetchXtream(host, username, password, m3uType, output) {
    if (!host || !username || !password) {
      throw new Error('Faltan datos de conexión al servidor IPTV');
    }

    host = normalizeHost(host);
    output = output || 'm3u8';
    var credentialsQuery =
      '?username=' + encodeURIComponent(username) +
      '&password=' + encodeURIComponent(password);
    var apiUrl = host + '/player_api.php' + credentialsQuery;
    var authResponse = await fetch(getRequestUrl(apiUrl));
    if (!authResponse.ok) {
      throw new Error(
        'El servidor IPTV respondio con ' + authResponse.status + ' (' + authResponse.statusText + ')'
      );
    }

    var account = await authResponse.json();
    var userInfo = account && account.user_info;
    if (!userInfo || (userInfo.auth !== 1 && userInfo.auth !== '1' && userInfo.auth !== true)) {
      throw new Error('Usuario o contraseña IPTV no validos');
    }

    var streamsUrl =
      host +
      '/player_api.php' + credentialsQuery +
      '&action=get_live_streams';
    var response = await fetch(getRequestUrl(streamsUrl));
    if (!response.ok) {
      throw new Error(
        'No se pudieron obtener los canales (' + response.status + ' ' + response.statusText + ')'
      );
    }

    var streams = await response.json();
    if (!Array.isArray(streams)) {
      throw new Error('El servidor IPTV no devolvio una lista de canales valida');
    }

    var channels = streams
      .filter(function (stream) {
        return stream && stream.stream_id !== undefined;
      })
      .map(function (stream) {
        var streamId = encodeURIComponent(String(stream.stream_id));
        var generatedUrl =
          host +
          '/live/' + encodeURIComponent(username) +
          '/' + encodeURIComponent(password) +
          '/' + streamId + '.' + output;
        var streamUrl = /^https?:\/\//i.test(stream.direct_source || '')
          ? stream.direct_source
          : generatedUrl;

        var media = browserMediaProfile(stream);
        return {
          name: stream.name || 'Canal sin nombre',
          tvgId: stream.epg_channel_id || '',
          tvgLogo: stream.stream_icon || '',
          groupTitle: stream.category_name || stream.category_id || 'TV',
          media: media,
          url: streamUrl,
          fallbackUrl: streamUrl === generatedUrl
            ? host + '/live/' + encodeURIComponent(username) + '/' +
              encodeURIComponent(password) + '/' + streamId + '.ts'
            : ''
        };
      });

    if (!channels.length) {
      throw new Error('El usuario IPTV no tiene canales en vivo disponibles');
    }
    return channels;
  }

  function fetchForProvider(provider, credentials) {
    if (provider.source.type === 'xtream') {
      return fetchXtream(
        provider.source.host,
        credentials.username,
        credentials.password,
        provider.source.m3uType,
        provider.source.output
      );
    }
    return fetchM3U(provider.source.url);
  }

  return {
    fetchM3U: fetchM3U,
    fetchXtream: fetchXtream,
    fetchForProvider: fetchForProvider
  };
})();
