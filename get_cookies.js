const https = require('https');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, 'cookies.txt');

/**
 * Fetch fresh YouTube visitor cookies from the server's own IP.
 * This ensures the cookies are associated with the same IP that yt-dlp will use.
 */
function fetchYouTubeCookies() {
  return new Promise((resolve, reject) => {
    console.log('[CookieRefresh] Fetching fresh YouTube visitor cookies...');
    
    const req = https.get('https://www.youtube.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log('[CookieRefresh] Following redirect to:', res.headers.location);
        https.get(res.headers.location, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        }, (res2) => {
          processCookies([...(res.headers['set-cookie'] || []), ...(res2.headers['set-cookie'] || [])], resolve, reject);
        }).on('error', reject);
        return;
      }
      processCookies(res.headers['set-cookie'] || [], resolve, reject);
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function processCookies(cookies, resolve, reject) {
  if (cookies.length === 0) {
    reject(new Error('No cookies returned from YouTube.'));
    return;
  }

  let cookiesTxt = '# Netscape HTTP Cookie File\n# This file is auto-generated. Do not edit.\n';

  cookies.forEach(cookieStr => {
    const parts = cookieStr.split(';');
    const [nameVal] = parts;
    const eqIdx = nameVal.indexOf('=');
    if (eqIdx === -1) return;
    const name = nameVal.substring(0, eqIdx).trim();
    const val = nameVal.substring(eqIdx + 1).trim();

    let domain = '.youtube.com';
    let cookiePath = '/';
    let secure = 'TRUE';
    let expires = Math.floor(Date.now() / 1000) + 31536000;

    parts.forEach(part => {
      const trimmed = part.trim();
      const lower = trimmed.toLowerCase();
      if (lower.startsWith('domain=')) {
        domain = trimmed.substring(7);
        if (!domain.startsWith('.')) domain = '.' + domain;
      } else if (lower.startsWith('path=')) {
        cookiePath = trimmed.substring(5);
      } else if (lower === 'secure') {
        secure = 'TRUE';
      } else if (lower.startsWith('expires=')) {
        const parsed = Math.floor(Date.parse(trimmed.substring(8)) / 1000);
        if (parsed > 0) expires = parsed;
      }
    });

    cookiesTxt += `${domain}\tTRUE\t${cookiePath}\t${secure}\t${expires}\t${name}\t${val}\n`;
  });

  fs.writeFileSync(COOKIES_PATH, cookiesTxt);
  console.log(`[CookieRefresh] Saved ${cookies.length} cookies to ${COOKIES_PATH}`);
  resolve(cookiesTxt);
}

// If run directly (e.g. from entrypoint.sh or CLI)
if (require.main === module) {
  fetchYouTubeCookies()
    .then(() => { console.log('[CookieRefresh] Done.'); process.exit(0); })
    .catch(err => { console.error('[CookieRefresh] Error:', err.message); process.exit(1); });
}

module.exports = { fetchYouTubeCookies, COOKIES_PATH };
