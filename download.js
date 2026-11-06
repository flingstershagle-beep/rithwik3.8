const dns = require('node:dns/promises');
const net = require('node:net');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || p[0] >= 224;
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80:');
  }
  return true;
}

async function assertPublicHttps(raw) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Only public HTTPS media URLs are supported.');
  const host = u.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || net.isIP(host)) throw new Error('Invalid media host.');
  const records = await dns.lookup(host, { all: true, verbatim: true });
  if (!records.length || records.some(r => isPrivateAddress(r.address))) throw new Error('Media host is not publicly routable.');
  return u;
}

function safeFilename(value) {
  const name = String(value || 'rkefx-download').replace(/[\\/:*?"<>|\r\n]+/g, '-').replace(/\.+$/g, '').slice(0, 120);
  return name || 'rkefx-download';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }
  let target;
  try {
    target = await assertPublicHttps(req.query.url);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid media URL.' });
  }

  try {
    let upstream;
    // Validate every redirect destination rather than allowing redirects to private hosts.
    for (let hop = 0; hop < 6; hop++) {
      upstream = await fetch(target.toString(), {
        method: req.method,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RK-MEDIA/1.0)',
          ...(req.headers.range ? { Range: req.headers.range } : {})
        },
        signal: AbortSignal.timeout(85000)
      });
      if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
      const location = upstream.headers.get('location');
      if (!location) break;
      target = await assertPublicHttps(new URL(location, target).toString());
    }

    if (!upstream || upstream.status >= 400) {
      return res.status(upstream ? upstream.status : 502).json({ error: 'The media host could not provide this file. The link may have expired.' });
    }

    const filename = safeFilename(req.query.filename);
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const extMatch = target.pathname.match(/\.(mp4|mp3|m4a|webm|mov|jpg|jpeg|png|webp)(?:$|\?)/i);
    const ext = extMatch ? '.' + extMatch[1].toLowerCase() : '';
    const finalName = /\.[a-z0-9]{2,5}$/i.test(filename) ? filename : filename + ext;

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${finalName}"; filename*=UTF-8''${encodeURIComponent(finalName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    for (const header of ['content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    if (req.method === 'HEAD' || !upstream.body) return res.end();
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    console.error('RK MEDIA download proxy:', error);
    if (!res.headersSent) res.status(502).json({ error: 'Download stream failed. Please try again or use another quality.' });
    else res.destroy(error);
  }
};
