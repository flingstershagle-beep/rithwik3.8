const BASE = 'https://api.interapi.dev';
const ROUTES = {
  youtube: '/api/v1/youtube',
  instagram: '/api/v1/instagram',
  facebook: '/api/v1/facebook',
  tiktok: '/api/v1/tiktok'
};
const ALLOWED = new Set(Object.keys(ROUTES));
const isHttp = value => typeof value === 'string' && /^https:\/\//i.test(value);

function fileLink(platform, originalUrl, formatId, kind) {
  const q = new URLSearchParams({ platform, url: originalUrl });
  if (formatId) q.set('format_id', formatId);
  if (kind) q.set('kind', kind);
  return '/api/file?' + q.toString();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({error:'Method not allowed'}); }
  const platform = String(req.query.platform || '').toLowerCase();
  const raw = req.query.url;
  if (!ALLOWED.has(platform) || typeof raw !== 'string') return res.status(400).json({error:'Unsupported platform or missing URL.'});
  let input;
  try {
    input = new URL(raw);
    const hosts = {
      youtube: ['youtube.com','www.youtube.com','m.youtube.com','youtu.be','music.youtube.com'],
      instagram: ['instagram.com','www.instagram.com'],
      facebook: ['facebook.com','www.facebook.com','m.facebook.com','fb.watch','fb.com'],
      tiktok: ['tiktok.com','www.tiktok.com','vm.tiktok.com','vt.tiktok.com']
    }[platform];
    if (input.protocol !== 'https:' || !hosts.some(h => input.hostname === h || input.hostname.endsWith('.'+h))) throw new Error('The link does not match the selected platform.');
  } catch (e) { return res.status(400).json({error:e.message || 'Invalid link.'}); }

  try {
    const endpoint = new URL(ROUTES[platform], BASE);
    endpoint.searchParams.set('url', input.toString());
    const headers = {Accept:'application/json'};
    if (process.env.INTERAPI_API_KEY) headers['X-API-Key'] = process.env.INTERAPI_API_KEY;
    const upstream = await fetch(endpoint, {headers, signal:AbortSignal.timeout(65000)});
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const messages = {401:'API key missing or invalid. Add INTERAPI_API_KEY in Vercel.',402:'API credits are exhausted. Add credits to your provider account.',403:'This content is private or restricted.',404:'The post or video was not found.',429:'Provider rate limit reached. Try again later.'};
      return res.status(upstream.status).json({error:messages[upstream.status] || payload.message || payload.error || 'The media provider failed.'});
    }
    if (payload.status === 'error' || payload.success === false) return res.status(502).json({error:payload.message || payload.error || 'Provider could not process this link.'});

    const sourceMedia = Array.isArray(payload.media) ? payload.media : [];
    const media = sourceMedia.map(item => {
      const rawUrl = item.url || item.download_url || item.downloadUrl;
      if (!isHttp(rawUrl)) return null;
      const kind = String(item.type || '').toLowerCase();
      const type = kind.includes('audio') || /m4a|mp3|audio/i.test((item.ext||'')+' '+(item.quality||'')) ? 'audio' : 'video';
      return {...item, type, url:fileLink(platform, input.toString(), item.format_id, type === 'audio' ? 'audio' : 'video')};
    }).filter(Boolean);

    // Some providers expose only top-level URLs instead of a media array.
    for (const [field, type] of [['video_hd_url','video'],['video_url','video'],['music_url','audio']]) {
      if (isHttp(payload[field]) && !media.some(x => x.type === type)) {
        media.push({type, quality:field === 'video_hd_url' ? 'HD' : field === 'music_url' ? 'Audio' : 'SD', url:fileLink(platform,input.toString(), '', type)});
      }
    }
    return res.status(200).json({...payload, media});
  } catch (e) {
    console.error('RK MEDIA provider error:', e);
    return res.status(502).json({error:e.name === 'TimeoutError' ? 'Provider timed out. Try again.' : 'Could not connect to the media provider.'});
  }
};
