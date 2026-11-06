const ALLOWED_API_HOSTS = new Set([
  'jerrycoder.oggyapi.workers.dev',
  'kiraxmd-api.vercel.app',
  'api.nexray.eu.cc',
  'www.youtube.com',
  'youtube.com',
  'noembed.com',
  'www.noembed.com'
]);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const raw = req.query.url;
    if (typeof raw !== 'string') return res.status(400).json({ error: 'Missing API URL' });
    const target = new URL(raw);
    if (target.protocol !== 'https:' || !ALLOWED_API_HOSTS.has(target.hostname.toLowerCase())) {
      return res.status(403).json({ error: 'This API host is not allowed by RK MEDIA.' });
    }
    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'RK-MEDIA/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(85000)
    });
    const body = await upstream.arrayBuffer();
    if (body.byteLength > 5 * 1024 * 1024) {
      return res.status(502).json({ error: 'API response was unexpectedly large.' });
    }
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.send(Buffer.from(body));
  } catch (error) {
    console.error('RK MEDIA API proxy:', error);
    return res.status(502).json({ error: error.name === 'TimeoutError' ? 'The provider API timed out.' : 'Could not connect to the provider API. The provider may be offline.' });
  }
};
