/**
 * Parser M3U basico: recorre el archivo linea por linea.
 */
var M3UParser = (function () {
  var attrMap = {
    'tvg-id': 'tvgId',
    'tvg-name': 'tvgName',
    'tvg-language': 'tvgLanguage',
    'tvg-logo': 'tvgLogo',
    'tvg-url': 'tvgUrl',
    'group-title': 'groupTitle',
    'catchup': 'catchup',
    'catchup-days': 'catchupDays',
    'catchup-source': 'catchupSource'
  };

  function parseAttributes(text, target) {
    var re = /([A-Za-z0-9_-]+)="([^"]*)"/g;
    var match;
    while ((match = re.exec(text)) !== null) {
      var key = attrMap[match[1]] || match[1];
      target[key] = match[2];
    }
  }

  // Primera coma que no este dentro de un valor entre comillas: separa los
  // atributos del nombre del canal (que si puede llevar comas).
  function nameCommaIndex(info) {
    var inQuotes = false;
    for (var i = 0; i < info.length; i++) {
      var c = info.charAt(i);
      if (c === '"') inQuotes = !inQuotes;
      else if (c === ',' && !inQuotes) return i;
    }
    return -1;
  }

  function parse(content) {
    var lines = (content || '').split('\n');
    var channels = [];
    var current = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      if (line.indexOf('#EXTINF:') === 0) {
        current = {};
        var info = line.slice(8);
        var commaIdx = nameCommaIndex(info);
        if (commaIdx !== -1) {
          current.name = info.slice(commaIdx + 1).trim();
          parseAttributes(info.slice(0, commaIdx), current);
        } else {
          parseAttributes(info, current);
        }
        continue;
      }

      if (line.charAt(0) === '#') continue;

      if (current) {
        current.url = line;
        channels.push(current);
        current = null;
      }
    }

    return { channels: channels, headers: {} };
  }

  return { parse: parse };
})();
