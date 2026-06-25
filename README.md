# OmniDownloader - High Performance Local Media Archival Utility

OmniDownloader is a local, lightweight, and privacy-focused media archival wrapper served in a premium, glassmorphic Single-Page Application (SPA). Powered by **Node.js (Express)**, **Python 3 (`yt-dlp`)**, and **FFmpeg**, the application connects directly to content servers on behalf of the user to fetch and compile media streams locally.

---

## Key Features

- ⚡ **Parallel Stream Acceleration**: Splits video/audio downloads into 5 concurrent chunk fragments in parallel, bypassing CDN bandwidth throttling for up to **5x faster download speeds**.
- 📊 **Dynamic Format Size Calculations**: Automatically queries target CDN servers, groups available streams by height (1080p, 720p, etc.), calculates combined sizes for YouTube adaptive video+audio feeds, and displays estimates in the client.
- 💾 **In-Memory Metadata Caching**: Caches `yt-dlp` JSON metadata queries for 10 minutes, making resolution changes, page loads, and re-submissions completely instant (< 10ms).
- ✉️ **Working Contact Form**: Integrates a contact form validated on the frontend and submitted to a custom `/api/contact` Express backend controller.
- 📜 **Recent Downloads Dashboard**: Saves analyzed videos locally in the browser's `localStorage`. Persistent across browser refreshes, allow users to re-run queries in 1-click. Wiped easily via the "Clear History" button.
- 🔗 **Media Image Proxy**: Proxies Instagram CDN files and YouTube thumbnails through our Node server, bypassing referrer constraints and preventing `403 Forbidden` errors.
- 🤖 **Google AdSense & SEO Ready**: 
  - Standardized Open Graph (OG), Twitter Card metadata, and `sitemap.xml`/`robots.txt` index files.
  - JSON-LD Structured Schema (`WebApplication`, `FAQPage`, `AboutPage`, and `ContactPage`) to maximize indexing ranking.
  - Built-in placeholder script tags for AdSense Auto-Ads.
  - Stylized custom `404.html` caught by Express wildcard routing middleware.

---

## Directory Structure

```
├── temp/                   # Temporary directory for video/audio merges (auto-cleans on start/finish)
├── public/                 # Static web client directory
│   ├── favicon.png         # Custom generated logo icon
│   ├── style.css           # Premium glassmorphic stylesheets & keyframe animations
│   ├── app.js              # Client event listeners, SSE processors, and LocalStorage db
│   ├── index.html          # Web Downloader home page
│   ├── about.html          # Mission & values article (800+ words)
│   ├── faq.html            # Help & troubleshooting guide (1000+ words, JSON-LD Schema)
│   ├── contact.html        # Feedback & Support contact form
│   ├── privacy.html        # AdSense-compliant privacy disclosures (1000+ words)
│   ├── terms.html          # TOS legal policy (800+ words)
│   ├── disclaimer.html     # Affiliation & copyright policy
│   ├── cookie-policy.html  # Session & advertising cookie policy
│   ├── 404.html            # Customized Page Not Found card
│   ├── sitemap.xml         # XML Sitemap definitions
│   └── robots.txt          # Search engine crawl rules
├── server.js               # Node.js Express server backend
├── package.json            # Node project configuration & dependencies
├── Dockerfile              # Docker container deployment rules
└── README.md               # User & developer documentation
```

---

## Local Setup Instructions

### Prerequisites
Ensure your local host machine has the following tools installed:
- **Node.js** (v20 or higher)
- **Python** (v3.10 or higher) with `pip`

### Step 1: Install Python Scraper
Install the `yt-dlp` library globally in your Python environment:
```bash
python -m pip install -U yt-dlp
```

### Step 2: Install Node.js Dependencies
Clone or download the project files, open a terminal inside the project root directory, and install the package dependencies:
```bash
npm install
```
*Note: This automatically downloads a platform-specific bundled `ffmpeg` executable under `node_modules` for Windows local execution.*

### Step 3: Launch the Server
Start the local Express server:
```bash
npm start
```

### Step 4: Run in the Browser
Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## Cloud Deployment (Docker)

To deploy the downloader utility to container-based clouds (like **Render.com** or **Railway.app**), use the provided `Dockerfile`. 

The Docker builder automatically:
1. Provisions a slim Debian-based Node runtime.
2. Installs `python3`, native Linux `ffmpeg`, and `yt-dlp` inside the container.
3. Builds the Node server.
4. Dynamically runs the global system-wide Linux `ffmpeg` binary instead of falling back to the local Windows wrapper.

### Steps to Deploy (Render):
1. Push this repository to GitHub.
2. Log into Render, select **New > Web Service**.
3. Link your repository.
4. Select **Docker** as the environment runtime.
5. Deploy (Render will read the `Dockerfile` and setup everything).

---

## Legal & Compliance Warnings
- **Personal Fair Use**: This software is intended strictly for personal archiving, educational research, and backup of your own uploads or open-licensed (Public Domain / Creative Commons) media.
- **Non-Affiliation**: OmniDownloader is not affiliated with Google, YouTube, Meta, or Instagram. All trademarks remain properties of their respective owners.
