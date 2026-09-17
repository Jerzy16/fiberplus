const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const ALLOWED_HOSTS = (process.env.IPTV_ALLOWED_HOSTS || '192.168.200.6')
	.split(',')
	.map((host) => host.trim().toLowerCase())
	.filter(Boolean);
const HLS_ROOT = path.join(os.tmpdir(), 'fiberplus-hls');
const sessions = new Map();
const sessionsBySource = new Map();
const MAX_TRANSCODERS = 2;
const SESSION_IDLE_MS = 90 * 1000;

fs.mkdirSync(HLS_ROOT, { recursive: true });
for (const entry of fs.readdirSync(HLS_ROOT, { withFileTypes: true })) {
	if (entry.isDirectory()) fs.rmSync(path.join(HLS_ROOT, entry.name), { recursive: true, force: true });
}

function cors(response) {
	response.setHeader('Access-Control-Allow-Origin', '*');
	response.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
}

function sendJson(response, status, body) {
	cors(response);
	response.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'no-store'
	});
	response.end(JSON.stringify(body));
}

function getTarget(requestUrl) {
	const value = requestUrl.searchParams.get('url');
	if (!value || !/^https?:\/\//i.test(value)) return null;
	try {
		const target = new URL(value);
		if (!ALLOWED_HOSTS.includes(target.hostname.toLowerCase())) return null;
		return target;
	} catch (error) {
		return null;
	}
}

function forward(request, response, target, attempt) {
	attempt = attempt || 0;
	const transport = target.protocol === 'https:' ? https : http;
	const upstream = transport.request(target, {
		method: request.method,
		headers: {
			'user-agent': 'FiberPlus/1.0',
			range: request.headers.range || ''
		}
	}, (upstreamResponse) => {
		cors(response);
		if ((upstreamResponse.statusCode === 403 || upstreamResponse.statusCode >= 500) && attempt < 3) {
			upstreamResponse.resume();
			setTimeout(() => forward(request, response, target, attempt + 1), 350 * (attempt + 1));
			return;
		}
		const contentType = upstreamResponse.headers['content-type'] || '';
		const isManifest = /\.m3u8(?:$|[?#])/i.test(target.pathname) || /mpegurl|apple\.m3u/i.test(contentType);
		if (!isManifest) {
			const headers = {
				'Content-Type': contentType || 'application/octet-stream',
				'Cache-Control': 'no-store'
			};
			if (upstreamResponse.headers['content-length']) {
				headers['Content-Length'] = upstreamResponse.headers['content-length'];
			}
			if (upstreamResponse.headers['accept-ranges']) {
				headers['Accept-Ranges'] = upstreamResponse.headers['accept-ranges'];
			}
			if (upstreamResponse.headers['content-range']) {
				headers['Content-Range'] = upstreamResponse.headers['content-range'];
			}
			response.writeHead(upstreamResponse.statusCode || 502, headers);
			upstreamResponse.pipe(response);
			return;
		}

		const chunks = [];
		upstreamResponse.on('data', (chunk) => chunks.push(chunk));
		upstreamResponse.on('end', () => {
			const manifest = Buffer.concat(chunks).toString('utf8');
			const rewritten = rewriteManifest(manifest, target);
			response.writeHead(upstreamResponse.statusCode || 502, {
				'Content-Type': 'application/vnd.apple.mpegurl',
				'Cache-Control': 'no-store'
			});
			response.end(rewritten);
		});
	});
	upstream.on('error', (error) => {
		if (!response.headersSent) sendJson(response, 502, { error: error.message });
		else response.destroy();
	});
	response.on('close', () => {
		if (!response.writableFinished) upstream.destroy();
	});
	upstream.end();
}

function proxyUrl(url) {
	return '/api/proxy?url=' + encodeURIComponent(url);
}

function rewriteManifest(manifest, baseUrl) {
	return manifest.split(/\r?\n/).map((line) => {
		if (!line || line.charAt(0) === '#') {
			return line.replace(/URI="([^"]+)"/gi, (match, value) => {
				if (!/^https?:\/\//i.test(value)) value = new URL(value, baseUrl.href).href;
				return 'URI="' + proxyUrl(value) + '"';
			});
		}
		return proxyUrl(new URL(line.trim(), baseUrl.href).href);
	}).join('\n');
}

function startTranscode(source) {
	const existingId = sessionsBySource.get(source);
	const existing = existingId && sessions.get(existingId);
	if (existing && existing.child.exitCode === null && !existing.child.killed) return existingId;
	if (existingId) {
		sessionsBySource.delete(source);
		sessions.delete(existingId);
	}

	const id = crypto.randomBytes(12).toString('hex');
	const directory = path.join(HLS_ROOT, id);
	fs.mkdirSync(directory, { recursive: true });

	const playlist = path.join(directory, 'index.m3u8');
	const segmentPattern = path.join(directory, 'segment-%05d.ts');
	const args = [
		'-hide_banner', '-loglevel', 'error',
		'-user_agent', 'FiberPlus/1.0',
		'-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '4',
		'-i', source,
		'-map', '0:v:0', '-map', '0:a:0?',
		'-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
		'-threads', '2',
		'-profile:v', 'main', '-pix_fmt', 'yuv420p', '-b:v', '3500k',
		'-maxrate', '4000k', '-bufsize', '8000k', '-r', '30', '-g', '60',
		'-keyint_min', '60', '-sc_threshold', '0',
		'-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '2',
		'-af', 'aresample=async=1:first_pts=0',
		'-fflags', '+genpts', '-avoid_negative_ts', 'make_zero',
		'-f', 'hls', '-hls_segment_type', 'mpegts',
		'-hls_time', '2', '-hls_list_size', '12', '-hls_delete_threshold', '3',
		'-hls_flags', 'delete_segments+independent_segments',
		'-hls_segment_filename', segmentPattern, playlist
	];
	const child = spawn(FFMPEG, args, {
		cwd: directory,
		stdio: ['ignore', 'ignore', 'pipe']
	});
	const session = {
		child,
		directory,
		source,
		createdAt: Date.now(),
		lastAccessAt: Date.now()
	};
	sessions.set(id, session);
	sessionsBySource.set(source, id);
	while (sessions.size > MAX_TRANSCODERS) {
		const oldest = Array.from(sessions.entries()).sort((a, b) => a[1].lastAccessAt - b[1].lastAccessAt)[0];
		if (!oldest || oldest[0] === id) break;
		stopSession(oldest[0], oldest[1]);
	}
	child.stderr.on('data', (chunk) => console.warn('[ffmpeg]', chunk.toString().trim()));
	child.on('close', () => {
		sessions.delete(id);
		if (sessionsBySource.get(source) === id) sessionsBySource.delete(source);
		fs.rm(directory, { recursive: true, force: true }, () => {});
	});
	return id;
}

function stopSession(id, session) {
	if (!session) return;
	if (sessions.get(id) === session) sessions.delete(id);
	if (sessionsBySource.get(session.source) === id) sessionsBySource.delete(session.source);
	if (session.child.exitCode === null) session.child.kill('SIGTERM');
	fs.rm(session.directory, { recursive: true, force: true }, () => {});
}

function serveHls(response, id, file) {
	const session = sessions.get(id);
	if (!session || !/^[a-z0-9]+$/i.test(id) || !/^[a-z0-9_.-]+$/i.test(file)) {
		response.writeHead(404);
		response.end('Not found');
		return;
	}
	const filePath = path.join(session.directory, file);
	session.lastAccessAt = Date.now();
	function waitForFile(attempt) {
		fs.stat(filePath, (error, stat) => {
			if (error && sessions.has(id) && attempt < 100) {
				setTimeout(() => waitForFile(attempt + 1), 100);
				return;
			}
		if (error || !stat.isFile()) {
			response.writeHead(404, { 'Cache-Control': 'no-store' });
			response.end('Not found');
			return;
		}
		if (file.endsWith('.m3u8')) {
			fs.readFile(filePath, (readError, content) => {
				if (readError) {
					response.writeHead(404, { 'Cache-Control': 'no-store' });
					response.end('Not found');
					return;
				}
				response.writeHead(200, {
					'Content-Type': 'application/vnd.apple.mpegurl',
					'Cache-Control': 'no-store',
					'Access-Control-Allow-Origin': '*'
				});
				response.end(content);
			});
			return;
		}
		response.writeHead(200, {
			'Content-Type': file.endsWith('.m3u8')
				? 'application/vnd.apple.mpegurl'
				: (file.endsWith('.mp4') || file.endsWith('.m4s') ? 'video/mp4' : 'video/mp2t'),
			'Cache-Control': 'no-store',
			'Access-Control-Allow-Origin': '*'
		});
		fs.createReadStream(filePath).pipe(response);
		});
	}
	waitForFile(0);
}

function serveStatic(response, pathname) {
	const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
	const filePath = path.resolve(ROOT, relative);
	if (!filePath.startsWith(ROOT + path.sep)) {
		response.writeHead(403);
		response.end('Forbidden');
		return;
	}
	fs.stat(filePath, (error, stat) => {
		if (error || !stat.isFile()) {
			response.writeHead(404);
			response.end('Not found');
			return;
		}
		const contentTypes = {
			'.html': 'text/html; charset=utf-8',
			'.js': 'text/javascript; charset=utf-8',
			'.css': 'text/css; charset=utf-8',
			'.png': 'image/png',
			'.mp4': 'video/mp4'
		};
		response.writeHead(200, {
			'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
		});
		fs.createReadStream(filePath).pipe(response);
	});
}

const server = http.createServer((request, response) => {
	const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
	if (request.method === 'OPTIONS') {
		cors(response);
		response.writeHead(204);
		response.end();
		return;
	}
	if (requestUrl.pathname === '/api/proxy') {
		const target = getTarget(requestUrl);
		return target ? forward(request, response, target) : sendJson(response, 400, { error: 'URL IPTV no permitida' });
	}
	if (requestUrl.pathname === '/api/transcode') {
		const target = getTarget(requestUrl);
		if (!target) return sendJson(response, 400, { error: 'URL IPTV no permitida' });
		return sendJson(response, 202, { url: `/api/hls/${startTranscode(target.href)}/index.m3u8` });
	}
	const match = requestUrl.pathname.match(/^\/api\/hls\/([a-z0-9]+)\/(.+)$/i);
	if (match) return serveHls(response, match[1], match[2]);
	serveStatic(response, requestUrl.pathname);
});

server.on('clientError', (error, socket) => {
	console.warn('[HTTP] Conexion del cliente cerrada:', error.message);
	if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

setInterval(() => {
	const cutoff = Date.now() - SESSION_IDLE_MS;
	for (const [id, session] of sessions) {
		if (session.lastAccessAt < cutoff) stopSession(id, session);
	}
}, 15 * 1000).unref();

process.on('exit', () => {
	for (const session of sessions.values()) {
		if (session.child.exitCode === null) session.child.kill('SIGTERM');
	}
});

server.listen(PORT, () => {
	console.log(`FiberPlus disponible en http://localhost:${PORT}`);
	console.log(`Hosts IPTV permitidos: ${ALLOWED_HOSTS.join(', ')}`);
});
