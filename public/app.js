// Global state
let currentMediaData = null;
let activeEventSource = null;
let selectedEntryIndex = 0;

// DOM Elements
const urlForm = document.getElementById('url-form');
const urlInput = document.getElementById('url-input');
const historyCard = document.getElementById('history-card');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const pasteBtn = document.getElementById('paste-btn');
const submitBtn = document.getElementById('submit-btn');
const btnText = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');

const alertBox = document.getElementById('alert-box');
const alertMessage = document.getElementById('alert-message');

const skeletonCard = document.getElementById('skeleton-card');
const mediaCard = document.getElementById('media-card');
const mediaThumb = document.getElementById('media-thumb');
const mediaDuration = document.getElementById('media-duration');
const mediaTitle = document.getElementById('media-title');
const mediaUploader = document.getElementById('media-uploader');
const videoFormatsContainer = document.getElementById('video-formats');
const audioFormatsContainer = document.getElementById('audio-formats');

const playlistSection = document.getElementById('playlist-section');
const playlistList = document.getElementById('playlist-list');

const tabVideo = document.getElementById('tab-video');
const tabAudio = document.getElementById('tab-audio');
const panelVideo = document.getElementById('panel-video');
const panelAudio = document.getElementById('panel-audio');

const progressCard = document.getElementById('progress-card');
const progressFileTitle = document.getElementById('progress-file-title');
const progressBarFill = document.getElementById('progress-bar-fill');
const cancelDlBtn = document.getElementById('cancel-dl-btn');
const processingMsg = document.getElementById('processing-msg');
const processingText = document.getElementById('processing-text');
const progressStatsRow = document.getElementById('progress-stats-row');

const statPercent = document.getElementById('stat-percent');
const statSpeed = document.getElementById('stat-speed');
const statSize = document.getElementById('stat-size');
const statEta = document.getElementById('stat-eta');

// Event Listeners
urlForm.addEventListener('submit', handleUrlSubmit);
pasteBtn.addEventListener('click', handlePaste);
cancelDlBtn.addEventListener('click', cancelDownload);
clearHistoryBtn.addEventListener('click', clearHistory);

tabVideo.addEventListener('click', () => switchTab('video'));
tabAudio.addEventListener('click', () => switchTab('audio'));

// Initialize history render
window.addEventListener('DOMContentLoaded', () => {
  renderHistory();
});

/**
 * Load history from LocalStorage
 */
function loadHistory() {
  try {
    const data = localStorage.getItem('download_history');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading from localStorage:', e);
    return [];
  }
}

/**
 * Save new entry to history (Unique by URL, max 10 entries)
 */
function saveToHistory(url, title, creator, thumbnail) {
  try {
    let history = loadHistory();
    // Filter out duplicates
    history = history.filter(item => item.url !== url);
    // Add to top of list
    history.unshift({ url, title, creator, thumbnail, timestamp: Date.now() });
    // Slice to max 10
    history = history.slice(0, 10);
    localStorage.setItem('download_history', JSON.stringify(history));
    renderHistory();
  } catch (e) {
    console.error('Error writing to localStorage:', e);
  }
}

/**
 * Remove a single item from history
 */
function removeFromHistory(url, e) {
  if (e) e.stopPropagation(); // prevent triggering search
  try {
    let history = loadHistory();
    history = history.filter(item => item.url !== url);
    localStorage.setItem('download_history', JSON.stringify(history));
    renderHistory();
  } catch (err) {
    console.error('Error removing from history:', err);
  }
}

/**
 * Clear all history
 */
function clearHistory() {
  try {
    localStorage.removeItem('download_history');
    renderHistory();
  } catch (e) {
    console.error('Error clearing localStorage:', e);
  }
}

/**
 * Render history items in UI
 */
function renderHistory() {
  const history = loadHistory();
  if (history.length === 0) {
    historyCard.classList.add('hidden');
    return;
  }

  historyCard.classList.remove('hidden');
  historyList.innerHTML = '';

  history.forEach(item => {
    const row = document.createElement('div');
    row.className = 'history-item';
    
    // Proxy thumbnail
    const thumbUrl = item.thumbnail 
      ? `/api/proxy?url=${encodeURIComponent(item.thumbnail)}`
      : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="%234b5563" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';

    row.innerHTML = `
      <img class="history-thumb" src="${thumbUrl}" alt="History item thumb">
      <div class="history-details">
        <div class="history-item-title">${item.title}</div>
        <div class="history-item-meta">${item.creator}</div>
      </div>
      <button type="button" class="history-delete-btn" title="Remove from history">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
    `;

    // Click row to reload
    row.addEventListener('click', () => {
      urlInput.value = item.url;
      urlForm.dispatchEvent(new Event('submit'));
    });

    // Click delete button
    const delBtn = row.querySelector('.history-delete-btn');
    delBtn.addEventListener('click', (e) => removeFromHistory(item.url, e));

    historyList.appendChild(row);
  });
}

/**
 * Handle clipboard paste
 */
async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text;
      urlInput.focus();
    }
  } catch (err) {
    console.error('Failed to read clipboard text:', err);
    // Silent fail if permission not granted
  }
}

/**
 * Switch tabs between Video and Audio
 */
function switchTab(type) {
  if (type === 'video') {
    tabVideo.classList.add('active');
    tabAudio.classList.remove('active');
    panelVideo.classList.add('active');
    panelAudio.classList.remove('active');
  } else {
    tabVideo.classList.remove('active');
    tabAudio.classList.add('active');
    panelVideo.classList.remove('active');
    panelAudio.classList.add('active');
  }
}

/**
 * Show error message alert
 */
function showError(message) {
  alertMessage.textContent = message;
  alertBox.classList.remove('hidden');
  alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Hide error message alert
 */
function hideError() {
  alertBox.classList.add('hidden');
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (val) => String(val).padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Handle search URL form submission
 */
async function handleUrlSubmit(e) {
  e.preventDefault();
  hideError();
  
  const url = urlInput.value.trim();
  if (!url) return;

  // Set loading state
  urlInput.disabled = true;
  pasteBtn.disabled = true;
  submitBtn.disabled = true;
  btnText.classList.add('hidden');
  btnSpinner.classList.remove('hidden');

  mediaCard.classList.add('hidden');
  progressCard.classList.add('hidden');
  skeletonCard.classList.remove('hidden');

  try {
    const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to retrieve media details.');
    }

    currentMediaData = data;
    selectedEntryIndex = 0;
    renderMediaDetails();
  } catch (err) {
    console.error('Error fetching info:', err);
    showError(err.message || 'An error occurred while connecting to the downloader server.');
    skeletonCard.classList.add('hidden');
  } finally {
    // Reset loading state
    urlInput.disabled = false;
    pasteBtn.disabled = false;
    submitBtn.disabled = false;
    btnText.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
  }
}

/**
 * Render the extracted media information
 */
function renderMediaDetails() {
  skeletonCard.classList.add('hidden');
  
  if (!currentMediaData || !currentMediaData.entries || currentMediaData.entries.length === 0) {
    showError('No media items to display.');
    return;
  }

  const entries = currentMediaData.entries;
  
  // Set up playlist/carousel selector if there are multiple items
  if (entries.length > 1) {
    playlistSection.classList.remove('hidden');
    playlistList.innerHTML = '';
    
    entries.forEach((entry, idx) => {
      const item = document.createElement('div');
      item.className = `playlist-item ${idx === selectedEntryIndex ? 'active' : ''}`;
      
      // Use proxy for playlist item thumbnail if it exists
      const itemThumbUrl = entry.thumbnail 
        ? `/api/proxy?url=${encodeURIComponent(entry.thumbnail)}`
        : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%234b5563" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
        
      item.innerHTML = `
        <img class="playlist-thumb" src="${itemThumbUrl}" alt="Slide ${idx + 1}">
        <div class="playlist-item-title">${entry.title || `Item ${idx + 1}`}</div>
      `;
      
      item.addEventListener('click', () => {
        // Switch active index
        document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        selectedEntryIndex = idx;
        renderActiveEntry();
      });
      
      playlistList.appendChild(item);
    });
  } else {
    playlistSection.classList.add('hidden');
  }

  // Save the analyzed entry into localStorage history database
  const activeEntry = entries[selectedEntryIndex];
  saveToHistory(urlInput.value.trim(), activeEntry.title, activeEntry.uploader, activeEntry.thumbnail);

  renderActiveEntry();
  mediaCard.classList.remove('hidden');
  mediaCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Render the selected media entry (from playlist/carousel or single video)
 */
function renderActiveEntry() {
  const entry = currentMediaData.entries[selectedEntryIndex];
  
  // Toggle layout mode class for styling if it's Instagram
  const isInstagram = entry.extractor && entry.extractor.toLowerCase().includes('instagram');
  const previewContainer = document.getElementById('media-preview-container');
  if (isInstagram) {
    previewContainer.classList.add('instagram');
  } else {
    previewContainer.classList.remove('instagram');
  }

  // Cover image with proxy
  if (entry.thumbnail) {
    mediaThumb.src = `/api/proxy?url=${encodeURIComponent(entry.thumbnail)}`;
  } else {
    mediaThumb.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 24 24" fill="none" stroke="%234b5563" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-image"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
  }

  // Duration
  if (entry.duration && entry.duration > 0) {
    mediaDuration.textContent = formatDuration(entry.duration);
    mediaDuration.classList.remove('hidden');
  } else {
    mediaDuration.classList.add('hidden');
  }

  // Title & Creator
  mediaTitle.textContent = entry.title || 'Untitled Media';
  mediaUploader.textContent = entry.uploader || 'Creator';

  // Render formats
  videoFormatsContainer.innerHTML = '';
  audioFormatsContainer.innerHTML = '';

  // Render Video Formats
  if (entry.videoFormats && entry.videoFormats.length > 0) {
    entry.videoFormats.forEach(fmt => {
      const row = createFormatRow(fmt, 'video', entry);
      videoFormatsContainer.appendChild(row);
    });
  } else {
    videoFormatsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; padding: 10px;">No video options available.</div>';
  }

  // Render Audio Formats
  if (entry.audioFormats && entry.audioFormats.length > 0) {
    entry.audioFormats.forEach(fmt => {
      const row = createFormatRow(fmt, 'audio', entry);
      audioFormatsContainer.appendChild(row);
    });
  } else {
    audioFormatsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; padding: 10px;">No audio options available.</div>';
  }

  // Auto-switch to audio-only if there are no video formats (e.g. sound-only link)
  if (entry.videoFormats.length === 0 && entry.audioFormats.length > 0) {
    switchTab('audio');
  } else {
    switchTab('video');
  }
}

/**
 * Helper to build format download row element
 */
function createFormatRow(fmt, type, entry) {
  const row = document.createElement('div');
  row.className = 'option-row';

  const badgeText = type === 'audio' ? fmt.ext.toUpperCase() : fmt.id;
  let labelText = fmt.label || `${fmt.ext.toUpperCase()} Download`;

  // Render file size if available in the API metadata payload
  if (fmt.filesize && !isNaN(fmt.filesize)) {
    const sizeMB = (fmt.filesize / (1024 * 1024)).toFixed(1);
    labelText += ` — ${sizeMB} MB`;
  }

  row.innerHTML = `
    <div class="option-info">
      <span class="option-badge">${badgeText}</span>
      <span class="option-label">${labelText}</span>
    </div>
    <button class="dl-btn-small">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      Download
    </button>
  `;

  const btn = row.querySelector('.dl-btn-small');
  btn.addEventListener('click', () => {
    startDownload(entry.url, fmt.id, type, fmt.ext, entry.title, fmt.needMerge);
  });

  return row;
}

/**
 * Initiate download progress flow via Server-Sent Events (SSE)
 */
function startDownload(url, format, type, ext, title, needMerge) {
  // Cancel previous download if any
  if (activeEventSource) {
    activeEventSource.close();
  }

  // Hide alert and show progress box
  hideError();
  progressCard.classList.remove('hidden');
  progressCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Update initial states
  progressFileTitle.textContent = `Downloading: ${title}`;
  progressBarFill.style.width = '0%';
  statPercent.textContent = '0%';
  statSpeed.textContent = '--';
  statSize.textContent = '--';
  statEta.textContent = '--';
  
  processingMsg.classList.add('hidden');
  progressStatsRow.classList.remove('hidden');

  // Disable download buttons to prevent multiple simultaneous downloads
  toggleButtons(true);

  // Construct EventSource URL
  const query = `url=${encodeURIComponent(url)}&format=${encodeURIComponent(format)}&type=${type}&ext=${ext}`;
  activeEventSource = new EventSource(`/api/download-stream?${query}`);

  activeEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.status === 'starting') {
        processingText.textContent = data.message;
        processingMsg.classList.remove('hidden');
        progressStatsRow.classList.add('hidden');
      } else if (data.status === 'downloading') {
        processingMsg.classList.add('hidden');
        progressStatsRow.classList.remove('hidden');

        progressBarFill.style.width = `${data.percent}%`;
        statPercent.textContent = `${data.percent}%`;
        statSpeed.textContent = data.speed;
        statSize.textContent = data.size;
        statEta.textContent = data.eta;
      } else if (data.status === 'processing') {
        progressBarFill.style.width = '100%';
        processingText.textContent = data.message;
        processingMsg.classList.remove('hidden');
        progressStatsRow.classList.add('hidden');
      } else if (data.status === 'completed') {
        // Complete download! Reset UI
        progressBarFill.style.width = '100%';
        progressCard.classList.add('hidden');
        toggleButtons(false);
        activeEventSource.close();
        activeEventSource = null;

        // Trigger file download retrieval from server
        const retrieveUrl = `/api/retrieve?id=${data.downloadId}&filename=${encodeURIComponent(title)}`;
        const downloadFrame = document.createElement('iframe');
        downloadFrame.style.display = 'none';
        downloadFrame.src = retrieveUrl;
        document.body.appendChild(downloadFrame);
        setTimeout(() => downloadFrame.remove(), 10000);
      } else if (data.status === 'error') {
        showError(data.error || 'An error occurred during download.');
        progressCard.classList.add('hidden');
        toggleButtons(false);
        activeEventSource.close();
        activeEventSource = null;
      }
    } catch (e) {
      console.error('Error parsing SSE event data:', e);
    }
  };

  activeEventSource.onerror = (err) => {
    console.error('EventSource connection error:', err);
    showError('Lost connection to downloader server.');
    progressCard.classList.add('hidden');
    toggleButtons(false);
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }
  };
}

/**
 * Cancel the current download stream
 */
function cancelDownload() {
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }
  progressCard.classList.add('hidden');
  toggleButtons(false);
  showError('Download was cancelled.');
}

/**
 * Toggle enable/disable status for all format buttons on screen
 */
function toggleButtons(disabled) {
  const buttons = document.querySelectorAll('.dl-btn-small');
  buttons.forEach(btn => {
    btn.disabled = disabled;
    if (disabled) {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
    } else {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    }
  });
}
