// Content script - runs on YouTube video pages
// Simplified version - uses Supadata API for subtitle fetching
console.log('🎬 YouTube Assistant content script v1.0.5 loaded');

// 获取当前视频信息
function getCurrentVideoInfo() {
  const url = window.location.href;
  const videoId = extractVideoId(url);
  const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                      document.querySelector('h1.title') ||
                      document.querySelector('title');
  const title = titleElement?.textContent?.trim() || document.title || 'Unknown Title';
  return { videoId, title, url };
}

// 提取视频ID
function extractVideoId(url) {
  // 处理普通视频: https://www.youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];

  // 处理Shorts: https://www.youtube.com/shorts/VIDEO_ID
  const shortsMatch = url.match(/\/shorts\/([^?&]+)/);
  if (shortsMatch) return shortsMatch[1];

  // 处理嵌入视频: https://www.youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/\/embed\/([^?&]+)/);
  if (embedMatch) return embedMatch[1];

  return null;
}

// 注意：字幕获取已改为通过Supadata API在popup.js中进行
// 已移除所有直接从浏览器获取字幕的方法（包括poToken技术代码）

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVideoInfo') {
    try {
      const videoInfo = getCurrentVideoInfo();
      sendResponse(videoInfo);
      return false;
    } catch (error) {
      console.error('🎬 Error in getVideoInfo:', error);
      sendResponse({ error: error.message });
      return false;
    }
  }

  // 处理时间戳跳转
  if (request.type === 'JUMP_TO_TIME') {
    try {
      const seconds = request.seconds;
      console.log('Content: 处理JUMP_TO_TIME请求，时间:', seconds, '秒');

      const success = jumpToVideoTime(seconds);
      sendResponse({ success: success });
      return false;
    } catch (error) {
      console.error('YouTube跳转失败:', error);
      sendResponse({ success: false, error: error.message });
      return false;
    }
  }

  // 注意：getSubtitles 和 downloadSubtitle 已移除
  // 字幕获取现在通过popup.js中的Supadata API完成
});

// 页面变化监听 (用于SPA导航)
let currentUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    console.log('YouTube page changed:', currentUrl);

    // 通知popup页面已变化
    try {
      chrome.runtime.sendMessage({
        action: 'pageChanged',
        url: currentUrl
      }, () => {
        // 忽略扩展上下文失效错误（如 service worker 重启）
        void chrome.runtime.lastError;
      });
    } catch (error) {
      // 静默忽略扩展上下文失效错误
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// ========== YouTube视频跳转功能（温和方式，避免风控）==========
function jumpToVideoTime(seconds) {
  try {
    // 方法1：直接设置video.currentTime（最温和）
    const video = document.querySelector('video');
    if (video && !isNaN(seconds) && seconds >= 0) {
      console.log('YouTube: 使用直接currentTime跳转到', seconds, '秒');
      video.currentTime = seconds;

      // 触发必要的事件确保播放器状态同步
      video.dispatchEvent(new Event('seeking'));
      video.dispatchEvent(new Event('seeked'));
      video.dispatchEvent(new Event('timeupdate'));

      return true;
    }

    return false;
  } catch (error) {
    console.error('YouTube跳转异常:', error);
    return false;
  }
}

console.log('YouTube Assistant content script initialized');
console.log('✅ YouTube跳转功能已注入');
