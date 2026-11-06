const BASE = 'https://api.interapi.dev';
const HOSTS = new Set(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','music.youtube.com','instagram.com','www.instagram.com','facebook.com','www.facebook.com','m.facebook.com','fb.watch','fb.com','tiktok.com','www.tiktok.com','vm.tiktok.com','vt.tiktok.com']);
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow','GET, HEAD'); return res.status(405).send('Method not allowed'); }
  const platform = String(req.query.platform || '').toLowerCase();
  const raw = req.query.url;
  if (!['youtube','instagram','facebook','tiktok'].includes(platform) || typeof raw !== 'string') return res.status(400).send('Invalid download request.');
  let media;
  try { media = new URL(raw); if (media.protocol !== 'https:' || !HOSTS.has(media.hostname.toLowerCase())) throw new Error(); }
  catch (_) { return res.status(400).send('Invalid media URL.'); }
  const key = process.env.INTERAPI_API_KEY;
  if (!key) return res.status(503).send('Set INTERAPI_API_KEY in Vercel project settings.');
  const target = new URL(platform === 'youtube' ? '/api/v1/youtube/file' : '/api/v1/media/file', BASE);
  if (platform === 'youtube') {
    target.searchParams.set('url', raw);
    target.searchParams.set('kind', req.query.kind === 'audio' ? 'audio' : 'video');
    target.searchParams.set('format_id', String(req.query.format_id || 'best'));
  } else {
    target.searchParams.set('source', platform);
    target.searchParams.set('url', raw);
  }
  target.searchParams.set('api', key);
  return res.redirect(302, target.toString());
};
