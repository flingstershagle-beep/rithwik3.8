RK MEDIA DOWNLOADER — CROSS-DEVICE PROJECT

DESIGN
- The existing page layout, visual styling, colours, animations and branding are retained.
- JavaScript now uses one server-side provider adapter for YouTube, Instagram, Facebook and TikTok.

PROVIDER
This project is wired to InterAPI (an independent third-party provider). It supports public Instagram, TikTok, Facebook and YouTube links. The provider's docs describe YouTube MP4/WebM/M4A formats (availability varies by video), separate audio, Facebook HD/SD, and Instagram/TikTok media.

IMPORTANT: 1080p is not guaranteed for every YouTube video. The page selects the highest returned MP4 format at or below the selected resolution. If the provider only returns 720p, it will use 720p. The UI must not claim 320 kbps MP3; the provider supplies the available audio format (often M4A).

SETUP
1. Extract the ZIP and open the rk-media-cross-device folder in VS Code.
2. Create an account at https://interapi.dev/ and obtain an API key. The service advertises a limited free tier and credit-based requests; check its current pricing before using it.
3. In Vercel: Project -> Settings -> Environment Variables, add:
   Name: INTERAPI_API_KEY
   Value: your private InterAPI key
   Apply to Production (and Preview if desired), then Save.
4. Redeploy the entire folder to Vercel. Do not deploy only index.html; the api folder is required.
5. Test with public links on Windows/macOS/Android/iPhone. Private, deleted, age-restricted, region-restricted or otherwise unavailable content may fail.

FILES
- index.html: original design, updated download logic.
- api/provider.js: calls provider from server; API key is never placed in browser code.
- api/file.js: sends downloads through provider's file endpoint.
- api/download.js: legacy safe streaming helper.
- api/proxy.js: legacy allow-listed proxy helper.
- vercel.json: function configuration.

LIMITATIONS
- This code is not a guarantee that any third-party provider will always be available. The provider can change its API, limit requests, require credits, or reject links.
- 1080p depends on whether the source video and provider return a 1080p format. Separate audio may be M4A rather than MP3; no re-encoding to 320 kbps is claimed.
- Use only content you own or are authorized to download, and follow each platform's terms and copyright rules.
