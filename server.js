const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const sanitizeFilename = require('sanitize-filename');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Detect if global FFmpeg is available (e.g. in Docker/Linux hosting), otherwise fallback to bundled
let ffmpegPath = 'ffmpeg';
try {
  const { execSync } = require('child_process');
  execSync('ffmpeg -version', { stdio: 'ignore' });
  console.log('✔ Using global FFmpeg binary');
} catch (e) {
  ffmpegPath = ffmpeg.path;
  console.log(`✔ Using bundled Windows FFmpeg at: ${ffmpegPath}`);
}

// Detect the Python command available on the host machine
let pythonCmd = 'python';
try {
  const { execSync } = require('child_process');
  execSync('python --version', { stdio: 'ignore' });
  console.log('✔ Using "python" command for yt-dlp');
} catch (e) {
  try {
    const { execSync } = require('child_process');
    execSync('python3 --version', { stdio: 'ignore' });
    pythonCmd = 'python3';
    console.log('✔ Using "python3" command fallback for yt-dlp');
  } catch (err) {
    console.warn('⚠ Neither "python" nor "python3" was found in PATH. Downloader subprocesses may fail.');
  }
}
const tempDir = path.join(__dirname, 'temp');

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
} else {
  // Clear any existing temp files on startup
  fs.readdir(tempDir, (err, files) => {
    if (!err && files) {
      for (const file of files) {
        fs.unlink(path.join(tempDir, file), () => {});
      }
    }
  });
}

// Memory cache for active download progress status
const activeDownloads = {};

// Metadata Cache setup
const metadataCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes TTL

/**
 * Execute yt-dlp to get video/post metadata
 */
app.get('/api/info', (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  // Check cache
  const cached = metadataCache.get(videoUrl);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[Cache Hit] Serving cached metadata for: ${videoUrl}`);
    return res.json(cached.data);
  }

  // Spawn yt-dlp to dump json
  // We use --flat-playlist to load metadata quickly
  const args = [
    '-m', 'yt_dlp',
    '--dump-json',
    '--no-warnings',
    '--flat-playlist',
    videoUrl
  ];

  const ytDlp = spawn(pythonCmd, args);

  ytDlp.on('error', (err) => {
    console.error('Failed to start yt-dlp process:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Downloader engine error (Python/yt-dlp is not available).' });
    }
  });

  let stdout = '';
  let stderr = '';

  ytDlp.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  ytDlp.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  ytDlp.on('close', (code) => {
    if (code !== 0) {
      console.error(`yt-dlp info failed with code ${code}. Stderr: ${stderr}`);
      return res.status(500).json({ error: 'Failed to retrieve video details. Make sure the URL is valid.' });
    }

    try {
      const lines = stdout.trim().split('\n');
      const entries = lines.map(line => JSON.parse(line));
      
      if (entries.length === 0) {
        return res.status(404).json({ error: 'No media entries found for this URL.' });
      }

      // Map details to a simplified format for the frontend
      const mappedEntries = entries.map(entry => {
        let videoFormats = [];
        let audioFormats = [];
        const formats = entry.formats || [];

        // Check if extractor is youtube or instagram or other
        const isYoutube = entry.extractor && entry.extractor.toLowerCase().includes('youtube');

        if (isYoutube) {
          // 1. Get best audio stream size to combine with video-only streams
          const audioStreams = formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
          const bestAudio = audioStreams.sort((a, b) => (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0))[0];
          const audioSize = bestAudio ? (bestAudio.filesize || bestAudio.filesize_approx || 0) : 0;

          // 2. Extract and group unique heights
          const videoHeights = [...new Set(formats.filter(f => f.vcodec !== 'none' && f.height).map(f => f.height))];
          videoHeights.sort((a, b) => b - a);

          const standardHeights = [1080, 720, 480, 360];
          const availableHeights = standardHeights.filter(h => videoHeights.includes(h));

          availableHeights.forEach(h => {
            const videoStreamsForHeight = formats.filter(f => f.vcodec !== 'none' && f.height === h);
            const bestVideo = videoStreamsForHeight.sort((a, b) => (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0))[0];
            
            if (bestVideo) {
              const videoSize = bestVideo.filesize || bestVideo.filesize_approx || 0;
              const combinedSize = videoSize ? (videoSize + audioSize) : null;
              
              videoFormats.push({
                id: `${h}p`,
                label: `${h}p (${h === 1080 ? 'Full HD' : h === 720 ? 'HD' : 'SD'})`,
                ext: 'mp4',
                resolution: `${h}p`,
                needMerge: true,
                filesize: combinedSize
              });
            }
          });
          
          // Audio sizes
          const bestM4a = formats.find(f => f.vcodec === 'none' && f.ext === 'm4a');
          const m4aSize = bestM4a ? (bestM4a.filesize || bestM4a.filesize_approx) : audioSize;

          audioFormats = [
            { id: 'mp3', label: 'Audio MP3 (High Quality)', ext: 'mp3', needMerge: true, filesize: m4aSize },
            { id: 'm4a', label: 'Audio M4A (Original Stream)', ext: 'm4a', needMerge: false, filesize: m4aSize }
          ];
        } else {
          // For general sites (Instagram, Twitter, TikTok, etc.)
          // Grab best combined stream
          const bestCombined = formats.filter(f => f.vcodec !== 'none' && f.acodec !== 'none')
            .sort((a, b) => (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0))[0] || entry;

          videoFormats.push({
            id: 'best',
            label: 'Download Video (Best Quality)',
            ext: bestCombined.ext || 'mp4',
            needMerge: false,
            filesize: bestCombined.filesize || bestCombined.filesize_approx || null
          });

          // Grab best audio
          const bestAudio = formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none')
            .sort((a, b) => (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0))[0];
          const audioSize = bestAudio ? (bestAudio.filesize || bestAudio.filesize_approx) : null;

          audioFormats.push({
            id: 'bestaudio',
            label: 'Download Audio Only',
            ext: 'mp3',
            needMerge: true,
            filesize: audioSize
          });
        }

        return {
          id: entry.id,
          title: entry.title || 'Untitled Media',
          duration: entry.duration || 0,
          uploader: entry.uploader || entry.channel || 'Unknown Creator',
          thumbnail: entry.thumbnail || (entry.thumbnails && entry.thumbnails.length ? entry.thumbnails[0].url : ''),
          url: entry.webpage_url || videoUrl,
          extractor: entry.extractor_key || entry.extractor || 'generic',
          videoFormats,
          audioFormats,
          isPlaylist: entry._type === 'playlist',
          originalEntry: {
            ext: entry.ext,
            url: entry.url
          }
        };
      });

      const responseData = {
        success: true,
        extractor: mappedEntries[0].extractor,
        entries: mappedEntries
      };

      // Set Cache
      metadataCache.set(videoUrl, {
        timestamp: Date.now(),
        data: responseData
      });

      res.json(responseData);
    } catch (e) {
      console.error('Error parsing yt-dlp metadata JSON:', e);
      res.status(500).json({ error: 'Error processing media metadata.' });
    }
  });
});

/**
 * Image Proxy to bypass Instagram / YouTube referer restrictions
 */
app.get('/api/proxy', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send('URL is required');
  }

  try {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    // Let's implement dynamic fetching or standard https request to avoid external node-fetch
    const urlObj = new URL(imageUrl);
    const https = require('https');
    const http = require('http');
    const client = urlObj.protocol === 'https:' ? https : http;

    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': urlObj.origin
      }
    };

    client.get(imageUrl, requestOptions, (proxyRes) => {
      // Copy status code and headers
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400'
      });
      proxyRes.pipe(res);
    }).on('error', (err) => {
      console.error('Image proxy request failed:', err);
      res.status(500).send('Failed to fetch image');
    });
  } catch (error) {
    console.error('Image proxy failed:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Start SSE stream to report progress
 */
app.get('/api/download-stream', (req, res) => {
  const { url, format, type, ext } = req.query;

  if (!url || !format) {
    return res.status(400).json({ error: 'URL and format are required' });
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendSSE = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const downloadId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const fileExt = ext || (type === 'audio' ? 'mp3' : 'mp4');
  const tempPath = path.join(tempDir, `${downloadId}.${fileExt}`);

  sendSSE({ status: 'starting', message: 'Initializing download...' });

  // Construct yt-dlp arguments
  const args = [
    '-m', 'yt_dlp',
    '--ffmpeg-location', ffmpegPath,
    '--newline',
    '--concurrent-fragments', '5',
    '--buffer-size', '1024K',
    '--postprocessor-args', 'Merger:-strict -2'
  ];

  // Format selection
  if (format === '1080p') {
    args.push('-f', 'bestvideo[height<=1080]+bestaudio/best', '--merge-output-format', 'mp4');
  } else if (format === '720p') {
    args.push('-f', 'bestvideo[height<=720]+bestaudio/best', '--merge-output-format', 'mp4');
  } else if (format === '480p') {
    args.push('-f', 'bestvideo[height<=480]+bestaudio/best', '--merge-output-format', 'mp4');
  } else if (format === '360p') {
    args.push('-f', 'bestvideo[height<=360]+bestaudio/best', '--merge-output-format', 'mp4');
  } else if (format === 'mp3') {
    args.push('-f', 'bestaudio', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else if (format === 'm4a') {
    args.push('-f', 'bestaudio[ext=m4a]');
  } else {
    // Custom formats or "best"
    args.push('-f', format);
  }

  // Output file path
  args.push('-o', tempPath);
  // Add target URL
  args.push(url);

  console.log(`Running: ${pythonCmd} ${args.join(' ')}`);

  const ytDlp = spawn(pythonCmd, args);
  activeDownloads[downloadId] = { process: ytDlp, path: tempPath };

  ytDlp.on('error', (err) => {
    console.error('Download spawn process error:', err);
    delete activeDownloads[downloadId];
    sendSSE({ status: 'error', error: 'Downloader engine error: ' + err.message });
    res.end();
  });

  let isPostProcessing = false;

  ytDlp.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      console.log(`[yt-dlp stdout]: ${trimmed}`);

      if (trimmed.startsWith('[download]')) {
        const percentMatch = trimmed.match(/(\d+(?:\.\d+)?)%/);
        if (percentMatch) {
          const percent = parseFloat(percentMatch[1]);
          
          const speedMatch = trimmed.match(/at\s+([\d\.]+\w+\/s)/);
          const speed = speedMatch ? speedMatch[1] : 'N/A';
          
          const etaMatch = trimmed.match(/ETA\s+([\d:]+)/);
          const eta = etaMatch ? etaMatch[1] : 'N/A';

          const sizeMatch = trimmed.match(/of\s+~\s*([\d\.]+\w+)/) || trimmed.match(/of\s+([\d\.]+\w+)/);
          const size = sizeMatch ? sizeMatch[1] : 'N/A';

          sendSSE({
            status: 'downloading',
            percent,
            speed,
            eta,
            size
          });
        } else if (trimmed.includes('has already been downloaded')) {
          sendSSE({ status: 'downloading', percent: 100, speed: 'Max', eta: '00:00' });
        }
      } else if (trimmed.startsWith('[ExtractAudio]') || trimmed.includes('Extracting audio')) {
        isPostProcessing = true;
        sendSSE({ status: 'processing', message: 'Converting audio to MP3...' });
      } else if (trimmed.startsWith('[Merger]') || trimmed.includes('Merging formats')) {
        isPostProcessing = true;
        sendSSE({ status: 'processing', message: 'Merging video and audio streams...' });
      }
    }
  });

  ytDlp.stderr.on('data', (data) => {
    console.error(`[yt-dlp stderr]: ${data.toString()}`);
  });

  ytDlp.on('close', (code) => {
    delete activeDownloads[downloadId];

    if (code !== 0) {
      sendSSE({ status: 'error', error: 'Download failed. Please try another quality or check the link.' });
      res.end();
      // Clean up failed file if it exists
      if (fs.existsSync(tempPath)) {
        fs.unlink(tempPath, () => {});
      }
      return;
    }

    // Sometimes yt-dlp outputs a slightly different filename due to extension changing in post-processing
    // Let's scan the directory to find the actual completed file matching the downloadId
    fs.readdir(tempDir, (err, files) => {
      if (err) {
        sendSSE({ status: 'error', error: 'Temp storage read error.' });
        return res.end();
      }

      const completedFile = files.find(file => file.startsWith(downloadId));
      if (!completedFile) {
        sendSSE({ status: 'error', error: 'Downloaded file not found.' });
        return res.end();
      }

      const finalPath = path.join(tempDir, completedFile);
      const finalExt = path.extname(completedFile).substring(1);

      // We need to fetch original title for saving the file nicely
      // We will send completed status with the download details
      sendSSE({
        status: 'completed',
        downloadId,
        file: completedFile,
        ext: finalExt
      });
      res.end();
    });
  });

  // Client aborted request (e.g. closed browser, stopped download)
  req.on('close', () => {
    if (activeDownloads[downloadId]) {
      console.log(`Client disconnected. Terminating download: ${downloadId}`);
      try {
        activeDownloads[downloadId].process.kill('SIGINT');
      } catch (err) {
        console.error('Failed to kill yt-dlp process:', err);
      }
      setTimeout(() => {
        if (fs.existsSync(tempPath)) {
          fs.unlink(tempPath, () => {});
        }
      }, 1000);
      delete activeDownloads[downloadId];
    }
  });
});

/**
 * Retrieve the finished file and stream it for download
 */
app.get('/api/retrieve', (req, res) => {
  const { id, filename } = req.query;

  if (!id) {
    return res.status(400).send('Download ID is required');
  }

  fs.readdir(tempDir, (err, files) => {
    if (err) {
      return res.status(500).send('Internal Storage Error');
    }

    const targetFile = files.find(file => file.startsWith(id));
    if (!targetFile) {
      return res.status(404).send('Download session expired or file not found.');
    }

    const filePath = path.join(tempDir, targetFile);
    const fileExt = path.extname(targetFile);
    
    // Sanitize and set filename
    let downloadName = filename ? sanitizeFilename(filename) : 'download';
    if (!downloadName.endsWith(fileExt)) {
      downloadName += fileExt;
    }

    res.download(filePath, downloadName, (downloadErr) => {
      // Clean up file after download finishes (whether successful or failed)
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error(`Error deleting temp file ${filePath}:`, unlinkErr);
      });
    });
  });
});

/**
 * Direct Download Stream fallback (runs yt-dlp and pipes direct to client)
 * Excellent for formats that do not need ffmpeg post-processing.
 */
app.get('/api/download', (req, res) => {
  const { url, format, ext, filename } = req.query;

  if (!url || !format) {
    return res.status(400).send('URL and format parameters are required.');
  }

  const safeExt = ext || 'mp4';
  let safeTitle = filename ? sanitizeFilename(filename) : 'media';
  if (!safeTitle.endsWith(`.${safeExt}`)) {
    safeTitle += `.${safeExt}`;
  }

  res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}"`);
  res.setHeader('Content-Type', 'application/octet-stream');

  const args = [
    '-m', 'yt_dlp',
    '-f', format,
    '-o', '-',
    url
  ];

  const ytDlp = spawn(pythonCmd, args);

  ytDlp.on('error', (err) => {
    console.error('Direct download spawn process error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Direct download process error: ' + err.message });
    }
  });

  ytDlp.stdout.pipe(res);

  ytDlp.stderr.on('data', (data) => {
    console.error(`[Direct Download Error]: ${data.toString()}`);
  });

  ytDlp.on('close', (code) => {
    if (code !== 0) {
      console.error(`Direct download finished with error code: ${code}`);
    }
  });

  req.on('close', () => {
    ytDlp.kill('SIGINT');
  });
});

/**
 * Receive contact form submissions
 */
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'Name, email, and message are required fields.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
  }

  console.log(`==================================================`);
  console.log(`✉️  New Contact Message Received:`);
  console.log(`Name: ${name}`);
  console.log(`Email: ${email}`);
  console.log(`Subject: ${subject || 'N/A'}`);
  console.log(`Message: ${message}`);
  console.log(`==================================================`);

  res.json({ success: true, message: 'Thank you for your message. We will get back to you shortly!' });
});

// Wildcard route to serve custom 404 page
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`💻 Local environment: ffmpeg bundled, yt-dlp enabled`);
  console.log(`==================================================`);
});
