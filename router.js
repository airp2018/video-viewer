(function () {
  function detectPlatform(url) {
    if (!url) return null;

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') {
        return 'youtube';
      }

      if (host === 'bilibili.com' || host.endsWith('.bilibili.com')) {
        return 'bilibili';
      }
    } catch (error) {
      console.warn('Video Viewer could not parse tab URL:', error);
    }

    return null;
  }

  function routeTo(platform, tabId) {
    const target = platform === 'youtube' ? 'youtube/popup.html' : 'bilibili/popup.html';
    const url = new URL(chrome.runtime.getURL(target));
    if (tabId != null) url.searchParams.set('tabId', tabId);
    window.location.replace(url.toString());
  }

  function setStatus(message) {
    const messageEl = document.getElementById('message');
    const statusEl = document.getElementById('status');

    if (messageEl) messageEl.textContent = message;
    if (statusEl) statusEl.textContent = '';
  }

  document.getElementById('open-youtube').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.youtube.com', active: true });
  });

  document.getElementById('open-bilibili').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.bilibili.com', active: true });
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    const platform = detectPlatform(tab && tab.url);

    if (platform) {
      routeTo(platform, tab && tab.id);
      return;
    }

    setStatus('当前标签页不是 YouTube 或 Bilibili 视频页。');
  });
})();
