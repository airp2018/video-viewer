// Popup script for YouTube Assistant
console.log('YouTube Assistant popup loaded');

// ========== 视频缓存管理模块 ==========
const VideoCacheManager = {
  // 缓存键前缀
  CACHE_PREFIX: 'video_cache_',
  METADATA_KEY: 'cache_metadata',

  // 获取缓存键
  getCacheKey(videoId) {
    return `${this.CACHE_PREFIX}${videoId}`;
  },

  // 检查缓存是否存在
  async hasCache(videoId) {
    try {
      const key = this.getCacheKey(videoId);
      const result = await chrome.storage.local.get(key);
      return !!result[key];
    } catch (error) {
      console.error('检查缓存失败:', error);
      return false;
    }
  },

  // 获取缓存
  async getCache(videoId) {
    try {
      const key = this.getCacheKey(videoId);
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      console.error('获取缓存失败:', error);
      return null;
    }
  },

  // 保存缓存
  async saveCache(videoId, data) {
    try {
      const key = this.getCacheKey(videoId);
      const cacheData = {
        videoId: videoId,
        title: data.title,
        timestamp: Date.now(),
        subtitle: data.subtitle,
        aiSummary: data.aiSummary || null,
        timestamps: data.timestamps || null
      };

      await chrome.storage.local.set({ [key]: cacheData });
      await this.updateMetadata();
      console.log('✅ 缓存已保存:', videoId);
      return true;
    } catch (error) {
      console.error('保存缓存失败:', error);
      return false;
    }
  },

  // 更新缓存的AI分析
  async updateAISummary(videoId, summary) {
    try {
      const cache = await this.getCache(videoId);
      if (cache) {
        cache.aiSummary = summary;
        cache.timestamp = Date.now();
        await chrome.storage.local.set({ [this.getCacheKey(videoId)]: cache });
        console.log('✅ AI总结已更新到缓存:', videoId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新AI总结失败:', error);
      return false;
    }
  },

  // 更新缓存的时间戳导航
  async updateTimestamps(videoId, timestamps) {
    try {
      const cache = await this.getCache(videoId);
      if (cache) {
        cache.timestamps = timestamps;
        cache.timestamp = Date.now();
        await chrome.storage.local.set({ [this.getCacheKey(videoId)]: cache });
        console.log('✅ 时间戳导航已更新到缓存:', videoId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新时间戳失败:', error);
      return false;
    }
  },

  // 清空所有缓存
  async clearAllCache() {
    try {
      const allData = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(allData).filter(key => key.startsWith(this.CACHE_PREFIX));

      if (cacheKeys.length > 0) {
        await chrome.storage.local.remove(cacheKeys);
        await chrome.storage.local.remove(this.METADATA_KEY);
        console.log(`✅ 已清空 ${cacheKeys.length} 个视频缓存`);
        return cacheKeys.length;
      }
      return 0;
    } catch (error) {
      console.error('清空缓存失败:', error);
      return 0;
    }
  },

  // 获取缓存统计信息
  async getCacheStats() {
    try {
      const allData = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(allData).filter(key => key.startsWith(this.CACHE_PREFIX));

      let totalSize = 0;
      cacheKeys.forEach(key => {
        const dataStr = JSON.stringify(allData[key]);
        totalSize += new Blob([dataStr]).size;
      });

      return {
        totalVideos: cacheKeys.length,
        totalSize: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
      };
    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return {
        totalVideos: 0,
        totalSize: 0,
        totalSizeMB: '0.00'
      };
    }
  },

  // 更新元数据
  async updateMetadata() {
    try {
      const stats = await this.getCacheStats();
      await chrome.storage.local.set({
        [this.METADATA_KEY]: {
          ...stats,
          lastUpdate: Date.now()
        }
      });
    } catch (error) {
      console.error('更新元数据失败:', error);
    }
  }
};

// 全局变量
let currentVideoInfo = null;
let currentSubtitles = [];
let currentSubtitleContent = '';

// 从URL参数获取tabId（由router传递）
const _urlParams = new URLSearchParams(window.location.search);
const _injectedTabId = _urlParams.has('tabId') ? parseInt(_urlParams.get('tabId'), 10) : null;

// DOM元素
const pageInfo = document.getElementById('page-info');
const videoTitle = document.getElementById('video-title');
const subtitleStatus = document.getElementById('subtitle-status');
const subtitleList = document.getElementById('subtitle-list');
const aiSummaryBtn = document.getElementById('ai-summary-btn');
const subtitleDownloadBtn = document.getElementById('subtitle-download-btn');
const summaryResult = document.getElementById('summary-result');
const summaryContent = document.getElementById('summary-content');
const followUpQuestion = document.getElementById('follow-up-question');
const generateAnswerBtn = document.getElementById('generate-answer-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');



// Tab切换功能
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    
    // 更新tab按钮状态
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // 更新tab内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
  });
});

// 更新缓存统计信息
async function updateCacheStats() {
  try {
    const stats = await VideoCacheManager.getCacheStats();

    const cacheCount = document.getElementById('cache-count');
    const cacheSize = document.getElementById('cache-size');

    if (cacheCount) cacheCount.textContent = stats.totalVideos;
    if (cacheSize) cacheSize.textContent = stats.totalSizeMB;

    console.log('📊 缓存统计:', stats);
  } catch (error) {
    console.error('更新缓存统计失败:', error);
  }
}

// 初始化
async function initialize() {
  await loadSettings();
  await checkCurrentPage();
  await updateCacheStats(); // 加载缓存统计
  const genBtn = document.getElementById('generate-timestamp-btn');
  if (genBtn) genBtn.disabled = false;
}


// 检查当前页面
async function checkCurrentPage() {
  try {
    console.log('🎬 Popup: Checking current page...');

    let tabId = _injectedTabId;
    let tabUrl = '';

    // 优先使用router传入的tabId
    if (tabId != null) {
      try {
        const tab = await chrome.tabs.get(tabId);
        tabUrl = tab.url || '';
        console.log('🎬 Popup: Using injected tabId:', tabId, 'url:', tabUrl);
      } catch (e) {
        console.warn('🎬 Popup: injected tabId invalid, falling back to query');
        tabId = null;
      }
    }

    // 回退：查询当前活动标签
    if (tabId == null) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = tab && tab.id;
      tabUrl = (tab && tab.url) || '';
      console.log('🎬 Popup: Queried active tab:', tabId, 'url:', tabUrl);
    }

    if (!tabUrl || !tabUrl.includes('youtube.com')) {
      pageInfo.textContent = '请在YouTube视频页面使用此扩展';
      console.log('🎬 Popup: Not on YouTube page, url:', tabUrl);
      return;
    }

    pageInfo.textContent = '正在检测视频信息...';

    // 尝试发送消息获取视频信息
    const videoInfo = await getVideoInfoWithRetry(tabId);
    if (videoInfo && videoInfo.videoId) {
      currentVideoInfo = videoInfo;
      pageInfo.textContent = '✅ 视频ID: ' + videoInfo.videoId;
      videoTitle.textContent = videoInfo.title;
      await getSubtitles();
    } else {
      pageInfo.textContent = '❌ 未检测到YouTube视频';
      console.log('🎬 Popup: No video info received');
    }

  } catch (error) {
    console.error('🎬 Popup: Error checking current page:', error);
    pageInfo.textContent = '❌ 页面检测失败';
  }
}

// 带重试的视频信息获取：sendMessage → 注入content.js → 重试sendMessage
async function getVideoInfoWithRetry(tabId) {
  // 第1次：直接发消息
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { action: 'getVideoInfo' });
    if (resp && resp.videoId) return resp;
  } catch (e) {
    console.log('🎬 Popup: sendMessage failed, attempting injection...');
  }

  // 第2次：注入content script后重试
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['youtube/content.js']
    });
    await new Promise(r => setTimeout(r, 300));
    const resp2 = await chrome.tabs.sendMessage(tabId, { action: 'getVideoInfo' });
    if (resp2 && resp2.videoId) return resp2;
  } catch (e) {
    console.warn('🎬 Popup: injection+retry failed:', e.message);
  }

  // 第3次：注入到MAIN world后重试（解决 isolated world通信问题）
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        // 确保content script的监听器在MAIN world可用
      }
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['youtube/content.js']
    });
    await new Promise(r => setTimeout(r, 500));
    const resp3 = await chrome.tabs.sendMessage(tabId, { action: 'getVideoInfo' });
    if (resp3 && resp3.videoId) return resp3;
  } catch (e) {
    console.error('🎬 Popup: All injection attempts failed:', e.message);
  }

  // 全部失败：直接从页面DOM提取视频信息
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const url = window.location.href;
        const m = url.match(/[?&]v=([^&]+)/);
        const videoId = m ? m[1] : null;
        const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                        document.querySelector('h1.title') ||
                        document.querySelector('title');
        return { videoId, title: titleEl?.textContent?.trim() || document.title || 'Unknown' };
      }
    });
    if (results && results[0] && results[0].result && results[0].result.videoId) {
      return results[0].result;
    }
  } catch (e) {
    console.error('🎬 Popup: DOM extraction also failed:', e.message);
  }

  pageInfo.innerHTML =
    '❌ 扩展通信失败<br>' +
    '<small>请刷新页面或重新加载扩展</small><br>' +
    '<button onclick="location.reload()" style="margin-top:5px;padding:5px 10px;background:#007bff;color:white;border:none;border-radius:3px;cursor:pointer;">🔄 刷新页面</button>';
  return null;
}

// 获取字幕 - 优先使用缓存，避免浪费API额度
async function getSubtitles() {
  try {
    subtitleStatus.textContent = '🔄 正在检查缓存...';
    subtitleStatus.style.background = '#fff3cd';

    // 获取视频ID
    if (!currentVideoInfo || !currentVideoInfo.videoId) {
      subtitleStatus.textContent = '❌ 未检测到视频ID';
      subtitleStatus.style.background = '#f8d7da';
      return;
    }

    const videoId = currentVideoInfo.videoId;

    // 🎯 步骤1：检查缓存
    const hasCache = await VideoCacheManager.hasCache(videoId);

    if (hasCache) {
      console.log('✅ 发现缓存，加载中...');
      const cache = await VideoCacheManager.getCache(videoId);

      // 加载缓存的字幕
      currentSubtitleContent = cache.subtitle.content;
      currentSubtitles = [{
        label: `${cache.subtitle.language} (已缓存)`,
        language: cache.subtitle.language,
        url: 'cached',
        extension: 'srt',
        isAutoGenerated: false,
        content: cache.subtitle.content
      }];

      displaySubtitles(currentSubtitles);

      // 显示缓存时间
      const cacheTime = new Date(cache.timestamp).toLocaleString('zh-CN');
      subtitleStatus.innerHTML = `✅ 使用缓存字幕 <small style="color: #666;">(${cacheTime})</small>`;
      subtitleStatus.style.background = '#d4edda';

      aiSummaryBtn.disabled = false;
      const genBtn = document.getElementById('generate-timestamp-btn');
      if (genBtn) genBtn.disabled = false;

      // 🎯 步骤2：如果有AI分析缓存，也显示出来
      if (cache.aiSummary) {
        // 直接使用缓存的HTML内容（已经包含格式化和所有问答）
        summaryContent.innerHTML = cache.aiSummary;
        summaryResult.style.display = 'block';
        console.log('✅ 已加载缓存的AI分析（包含所有问答）');
      }

      // 🎯 步骤3：如果有时间戳导航缓存，也显示出来
      if (cache.timestamps && cache.timestamps.length > 0) {
        displayCachedTimestamps(cache.timestamps);
        console.log('✅ 已加载缓存的时间戳导航');
      }

      return;
    }

    // 🎯 步骤4：没有缓存，调用API获取
    console.log('❌ 无缓存，调用Supadata API...');
    subtitleStatus.textContent = '🔄 正在获取字幕...';

    // 检查是否有Supadata API key
    const settings = await loadSettings();
    if (!settings.supadataApiKey) {
      subtitleStatus.textContent = '⚠️ 请先设置Supadata API密钥';
      subtitleStatus.style.background = '#fff3cd';
      subtitleList.innerHTML = `
        <div style="padding: 15px; text-align: center; color: #856404; background: #fff3cd; border-radius: 6px;">
          <h4 style="margin: 0 0 10px 0;">🔑 需要API密钥</h4>
          <p style="margin: 5px 0;">请在"设置"标签页中配置Supadata API密钥</p>
          <p style="margin: 5px 0; font-size: 12px;">
            获取免费API key: <a href="https://dash.supadata.ai" target="_blank">https://dash.supadata.ai</a>
          </p>
          <p style="margin: 5px 0; font-size: 11px; color: #666;">
            (每月100次免费请求，多人可共用一个key)
          </p>
        </div>
      `;
      return;
    }

    console.log('🎬 Fetching subtitles via Supadata API for video:', videoId);

    // 调用Supadata API
    const response = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}`,
      {
        headers: {
          'x-api-key': settings.supadataApiKey
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supadata API error:', response.status, errorText);

      if (response.status === 401) {
        subtitleStatus.textContent = '❌ API密钥无效';
        subtitleStatus.style.background = '#f8d7da';
        subtitleList.innerHTML = `
          <div style="padding: 15px; text-align: center; color: #721c24; background: #f8d7da; border-radius: 6px;">
            <p>API密钥无效或已过期，请检查设置</p>
          </div>
        `;
      } else if (response.status === 429) {
        subtitleStatus.textContent = '❌ API请求次数超限';
        subtitleStatus.style.background = '#f8d7da';
        subtitleList.innerHTML = `
          <div style="padding: 15px; text-align: center; color: #721c24; background: #f8d7da; border-radius: 6px;">
            <p>已超过免费额度限制</p>
          </div>
        `;
      } else {
        subtitleStatus.textContent = `❌ API请求失败 (${response.status})`;
        subtitleStatus.style.background = '#f8d7da';
      }
      return;
    }

    const data = await response.json();
    console.log('Supadata API response:', data);

    if (data && data.content && data.content.length > 0) {
      // 转换Supadata格式为我们的格式
      currentSubtitleContent = convertSupadataToSRT(data.content);

      // 创建一个虚拟的字幕对象用于显示
      currentSubtitles = [{
        label: `${data.lang} (Supadata API)`,
        language: data.lang,
        url: 'supadata-api',
        extension: 'srt',
        isAutoGenerated: false,
        content: currentSubtitleContent
      }];

      displaySubtitles(currentSubtitles);

      subtitleStatus.textContent = `✅ 成功获取字幕 (${data.content.length}条)`;
      subtitleStatus.style.background = '#d4edda';

      // 🎯 步骤5：保存到缓存
      await VideoCacheManager.saveCache(videoId, {
        title: currentVideoInfo.title,
        subtitle: {
          content: currentSubtitleContent,
          language: data.lang,
          source: 'supadata-api'
        }
      });
      console.log('✅ 字幕已缓存');

      aiSummaryBtn.disabled = false;
      const genBtn = document.getElementById('generate-timestamp-btn');
      if (genBtn) genBtn.disabled = false;
    } else {
      subtitleStatus.textContent = '❌ 此视频没有字幕';
      subtitleStatus.style.background = '#f8d7da';
      subtitleList.innerHTML = `
        <div style="padding: 15px; text-align: center; color: #721c24;">
          <p>未找到可用的字幕</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error getting subtitles:', error);
    subtitleStatus.textContent = '❌ 字幕获取出错';
    subtitleStatus.style.background = '#f8d7da';
    subtitleList.innerHTML = `
      <div style="padding: 15px; text-align: center; color: #721c24; background: #f8d7da; border-radius: 6px;">
        <p>获取字幕时出错: ${error.message}</p>
      </div>
    `;
  }
}

// 将Supadata格式转换为SRT格式
function convertSupadataToSRT(content) {
  let srt = '';
  content.forEach((item, index) => {
    const startTime = formatSRTTime(item.offset / 1000);
    const endTime = formatSRTTime((item.offset + item.duration) / 1000);

    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${item.text}\n\n`;
  });
  return srt;
}

// 格式化SRT时间
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// 显示字幕列表
function displaySubtitles(subtitles) {
  if (subtitles.length === 0) {
    subtitleList.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #666;">
        <p>❌ 未找到字幕</p>
        <p style="font-size: 12px; margin-top: 10px;">可能原因：</p>
        <ul style="font-size: 11px; text-align: left; display: inline-block;">
          <li>视频没有字幕</li>
          <li>字幕获取失败</li>
          <li>页面未完全加载</li>
        </ul>
        <p style="font-size: 12px; margin-top: 10px;">
          <button onclick="location.reload()" style="padding: 5px 10px;">刷新重试</button>
        </p>
      </div>
    `;
    return;
  }

  // 添加使用提示
  const instructionHtml = `
    <div style="background: #e3f2fd; padding: 10px; margin-bottom: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
      <p style="margin: 0; font-size: 12px; color: #1976d2;">
        💡 <strong>使用提示：</strong>字幕已通过Supadata API获取，可直接进行AI分析和下载
      </p>
    </div>
  `;

  const html = instructionHtml + subtitles.map((subtitle, index) => {
    const isSupadataAPI = subtitle.url === 'supadata-api';
    const statusIcon = '✅';
    const statusText = isSupadataAPI ? 'Supadata API' : '可用';

    return `
      <div class="subtitle-track selected" data-index="${index}" style="border: 2px solid #28a745; margin: 10px 0; padding: 10px; border-radius: 5px; background: #f8fff9;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h5 style="margin: 0; color: #333;">${statusIcon} ${subtitle.label}</h5>
          <span style="font-size: 10px; color: #28a745; font-weight: bold;">${statusText}</span>
        </div>
        <p style="margin: 5px 0; font-size: 12px; color: #666;">
          语言: ${subtitle.language} | ${subtitle.isAutoGenerated ? '自动生成' : '人工字幕'}
        </p>
        <div style="margin-top: 8px;">
          <button onclick="downloadSingleSubtitle(${index})"
                  style="font-size: 11px; padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">
            📥 下载字幕
          </button>
        </div>
        ${isSupadataAPI ? `
          <p style="font-size: 10px; color: #666; margin-top: 8px;">
            ℹ️ 通过Supadata API获取，已包含完整时间戳
          </p>
        ` : `
          <details style="margin-top: 5px;">
            <summary style="font-size: 10px; color: #999; cursor: pointer;">显示URL</summary>
            <p style="font-size: 10px; color: #999; word-break: break-all; margin: 5px 0;">${subtitle.url}</p>
          </details>
        `}
      </div>
    `;
  }).join('');

  subtitleList.innerHTML = html;

  // 添加点击选择事件
  document.querySelectorAll('.subtitle-track').forEach(track => {
    track.addEventListener('click', (e) => {
      // 避免按钮点击触发选择
      if (e.target.tagName === 'BUTTON') return;

      document.querySelectorAll('.subtitle-track').forEach(t => {
        t.style.borderColor = '#ddd';
        t.style.backgroundColor = 'white';
        t.classList.remove('selected');
      });
      track.style.borderColor = '#28a745';
      track.style.backgroundColor = '#f8fff9';
      track.classList.add('selected');
    });
  });

  // 智能选择最佳字幕并高亮显示
  const bestIndex = getBestSubtitleIndex(subtitles);
  const bestTrack = document.querySelector(`.subtitle-track[data-index="${bestIndex}"]`);
  if (bestTrack) {
    bestTrack.style.borderColor = '#28a745';
    bestTrack.style.backgroundColor = '#f8fff9';
    bestTrack.classList.add('selected');

    // 添加智能选择标识
    const titleElement = bestTrack.querySelector('h5');
    if (titleElement && !titleElement.textContent.includes('🎯')) {
      titleElement.textContent = '🎯 ' + titleElement.textContent;
    }
  }
}

// 智能选择最佳字幕索引
function getBestSubtitleIndex(subtitles) {
  if (!subtitles || subtitles.length === 0) return 0;
  if (subtitles.length === 1) return 0; // 只有一种语言，直接选择

  // 语言优先级：中文简体 > 中文繁体 > 英文 > 其他
  const languagePriority = [
    // 第一优先级：中文简体
    {
      priority: 1,
      keywords: ['zh-Hans', 'zh-CN', 'Chinese (Simplified)', 'Chinese (China)', '中文（简体）', '中文(简体)', '简体中文'],
      type: 'simplified'
    },
    // 第二优先级：中文繁体
    {
      priority: 2,
      keywords: ['zh-Hant', 'zh-TW', 'zh-HK', 'Chinese (Traditional)', 'Chinese (Taiwan)', 'Chinese (Hong Kong)', '中文（繁體）', '中文(繁體)', '繁體中文'],
      type: 'traditional'
    },
    // 第三优先级：英文
    {
      priority: 3,
      keywords: ['en', 'en-US', 'en-GB', 'English', 'English (US)', 'English (UK)', '英语', '英文'],
      type: 'english'
    }
  ];

  // 按优先级顺序查找最佳字幕
  for (const priorityGroup of languagePriority) {
    const index = subtitles.findIndex(subtitle => {
      const label = (subtitle.label || '').toLowerCase();
      const lang = (subtitle.languageCode || '').toLowerCase();

      // 检查是否匹配当前优先级组的任何关键词
      return priorityGroup.keywords.some(keyword => {
        const keywordLower = keyword.toLowerCase();

        // 精确匹配语言代码
        if (lang === keywordLower) return true;

        // 标签包含匹配
        if (label.includes(keywordLower)) return true;

        // 特殊处理：中文简体（更精确的识别）
        if (priorityGroup.type === 'simplified') {
          // 明确标识为简体的
          if (label.includes('simplified') || label.includes('简体') || lang === 'zh-hans' || lang === 'zh-cn') {
            return true;
          }
          // 通用中文但不是繁体的（作为简体的备选）
          if ((label.includes('chinese') || label.includes('中文') || lang === 'zh') &&
              !label.includes('traditional') && !label.includes('繁') &&
              !label.includes('taiwan') && !label.includes('hong kong') &&
              lang !== 'zh-hant' && lang !== 'zh-tw' && lang !== 'zh-hk') {
            return true;
          }
        }

        // 特殊处理：中文繁体（只匹配明确的繁体标识）
        if (priorityGroup.type === 'traditional') {
          return (label.includes('traditional') || label.includes('繁') ||
                  label.includes('taiwan') || label.includes('hong kong') ||
                  lang === 'zh-hant' || lang === 'zh-tw' || lang === 'zh-hk') &&
                 (label.includes('chinese') || label.includes('中文') || lang.startsWith('zh'));
        }

        // 特殊处理：英文
        if (priorityGroup.type === 'english') {
          return label.includes('english') || label.includes('英') || lang.startsWith('en');
        }

        return false;
      });
    });

    if (index !== -1) {
      console.log(`🎯 智能选择字幕: ${subtitles[index].label} (优先级: ${priorityGroup.type}, 第${priorityGroup.priority}优先)`);
      return index;
    }
  }

  // 如果没有找到中文简体、繁体或英文，返回第一个
  console.log(`🎯 未找到优先语言，使用第一个: ${subtitles[0].label}`);
  return 0;
}

// 获取选中的字幕索引
function getSelectedSubtitleIndex() {
  const selectedTrack = document.querySelector('.subtitle-track.selected');
  if (selectedTrack) {
    return parseInt(selectedTrack.dataset.index);
  }

  // 如果没有手动选择，使用智能选择
  return getBestSubtitleIndex(currentSubtitles);
}

// 显示缓存的时间戳导航
function displayCachedTimestamps(timestamps) {
  try {
    const tipsResult = document.getElementById('timestamp-result');
    const tipsContent = document.getElementById('timestamp-list');
    const timestampStatus = document.getElementById('timestamp-status');

    if (!tipsResult || !tipsContent || !timestampStatus) {
      console.warn('时间戳导航元素未找到');
      return;
    }

    if (timestamps && timestamps.length > 0) {
      timestampStatus.textContent = '✅ 已加载缓存的时间戳导航';
      timestampStatus.style.background = '#d4edda';

      // 显示时间戳列表（使用 data-seconds 属性，而不是 onclick）
      tipsContent.innerHTML = timestamps.map((tip, index) => `
        <div class="tip-item" style="cursor: pointer; transition: all 0.3s; margin-bottom: 16px; padding: 12px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" data-seconds="${tip.time}">
          <div style="display: flex; align-items: flex-start; gap: 15px;">
            <div class="tip-timestamp" data-seconds="${tip.time}" style="flex-shrink: 0; font-size: 16px; font-weight: bold; color: #1976d2;">
              ${formatSecondsToTimeShort(tip.time)}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: bold; margin: 5px 0; font-size: 15px; line-height: 1.5; color: #333;">
                ${escapeHtml(tip.title)}
              </div>
              ${tip.description ? `<div style="font-size: 13px; color: #666; margin-top: 5px;">${escapeHtml(tip.description)}</div>` : ''}
            </div>
          </div>
        </div>
      `).join('');

      tipsResult.style.display = 'block';
      console.log('✅ 时间戳导航已显示');
    }
  } catch (error) {
    console.error('显示缓存时间戳失败:', error);
  }
}

// 测试字幕URL
window.testSubtitleUrl = async function(url) {
  console.log('🎬 Testing subtitle URL:', url);
  try {
    const content = await downloadSubtitleContent(url);
    console.log('🎬 Test successful, content length:', content ? content.length : 0);

    // 显示更详细的测试结果
    const preview = content.substring(0, 200);
    const hasValidContent = content.includes('<') || content.includes('WEBVTT') || content.includes('-->');

    alert(`测试结果：
✅ 下载成功
📊 内容长度: ${content.length} 字符
📝 格式检查: ${hasValidContent ? '✅ 有效' : '⚠️ 可能无效'}
📄 内容预览: ${preview}${content.length > 200 ? '...' : ''}`);
  } catch (error) {
    console.error('🎬 Test failed:', error);
    alert(`❌ 测试失败: ${error.message}`);
  }
}

// 下载单个字幕
window.downloadSingleSubtitle = async function(index) {
  if (!currentSubtitles[index]) {
    alert('字幕不存在');
    return;
  }

  const subtitle = currentSubtitles[index];
  console.log('🎬 Downloading single subtitle:', subtitle);

  try {
    let content;

    // 检查是否是Supadata API或缓存的字幕
    if ((subtitle.url === 'supadata-api' || subtitle.url === 'cached') && subtitle.content) {
      // 直接使用已经获取的字幕内容
      content = subtitle.content;
      console.log('使用已有字幕内容 (来源:', subtitle.url, ')');
    } else {
      // 传统方法：下载字幕
      content = await downloadSubtitleContent(subtitle.url);
    }

    if (!content || content.length < 10) {
      throw new Error('字幕内容为空或过短');
    }

    // Supadata API和缓存返回的已经是SRT格式，不需要转换
    const convertedContent = (subtitle.url === 'supadata-api' || subtitle.url === 'cached') ? content : convertToSRT(content);
    const cleanTitle = (currentVideoInfo?.title || 'YouTube_Video').replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
    const filename = `${cleanTitle}_${subtitle.language}.srt`;

    // 创建下载
    const blob = new Blob([convertedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('下载失败:', chrome.runtime.lastError);
        alert('下载失败: ' + chrome.runtime.lastError.message);
      } else {
        console.log('下载开始，ID:', downloadId);
        alert(`✅ 字幕下载成功！\n文件名: ${filename}`);
      }
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

  } catch (error) {
    console.error('🎬 Single download failed:', error);
    alert(`❌ 下载失败: ${error.message}`);
  }
}

// AI总结功能
aiSummaryBtn.addEventListener('click', async () => {
  if (currentSubtitles.length === 0) {
    alert('没有可用的字幕进行总结');
    return;
  }

  try {
    aiSummaryBtn.disabled = true;
    aiSummaryBtn.textContent = '🔄 生成中...';

    // 获取用户选中的字幕，如果没有选中则使用第一个
    const selectedIndex = getSelectedSubtitleIndex();
    const subtitle = currentSubtitles[selectedIndex];
    console.log('使用字幕进行AI分析:', subtitle.label);

    let subtitleContent;

    // 检查是否是Supadata API或缓存的字幕
    if ((subtitle.url === 'supadata-api' || subtitle.url === 'cached') && subtitle.content) {
      // 直接使用已经获取的字幕内容
      subtitleContent = subtitle.content;
      console.log('使用已有字幕内容 (来源:', subtitle.url, ')');
    } else {
      // 传统方法：下载字幕
      subtitleContent = await downloadSubtitleContent(subtitle.url);
    }

    if (!subtitleContent) {
      throw new Error('无法获取字幕内容');
    }

    currentSubtitleContent = subtitleContent;

    console.log('字幕内容长度:', subtitleContent.length);
    console.log('字幕内容前200字符:', subtitleContent.substring(0, 200));

    // 解析字幕文本
    const subtitleText = parseSubtitleText(subtitleContent);

    console.log('解析后文本长度:', subtitleText.length);
    console.log('解析后文本前200字符:', subtitleText.substring(0, 200));

    if (!subtitleText || subtitleText.length < 10) {
      throw new Error('字幕文本解析失败或内容过短');
    }

    // 调用AI API
    const summary = await generateAISummary(subtitleText);

    // 显示结果（转换为HTML格式）
    const summaryHtml = markdownToHtml(summary);
    summaryContent.innerHTML = summaryHtml;
    summaryResult.style.display = 'block';

    // 🎯 保存AI分析到缓存（保存HTML格式，以便与继续提问的格式一致）
    if (currentVideoInfo && currentVideoInfo.videoId) {
      await VideoCacheManager.updateAISummary(currentVideoInfo.videoId, summaryHtml);
      console.log('✅ AI分析已保存到缓存（HTML格式）');
    }

  } catch (error) {
    console.error('AI summary error:', error);
    alert('AI总结生成失败: ' + error.message);
  } finally {
    aiSummaryBtn.disabled = false;
    aiSummaryBtn.textContent = '✨ 生成AI总结';
  }
});

// 下载字幕内容
async function downloadSubtitleContent(url) {
  try {
    console.log('🎬 Popup: Downloading subtitle from URL:', url);

    if (!url || typeof url !== 'string') {
      throw new Error('无效的字幕URL');
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('🎬 Popup: Sending download request to tab:', tab.id);

    // 添加超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('下载超时，请重试')), 30000);
    });

    const downloadPromise = chrome.tabs.sendMessage(tab.id, {
      action: 'downloadSubtitle',
      url: url
    });

    const response = await Promise.race([downloadPromise, timeoutPromise]);
    console.log('🎬 Popup: Download response:', response);

    if (response && response.content) {
      console.log('🎬 Popup: Content length:', response.content.length);

      // 验证内容格式
      const content = response.content;
      if (content.length < 10) {
        throw new Error('字幕内容过短，可能下载失败');
      }

      // 检查是否是有效的字幕格式
      if (!content.includes('<') && !content.includes('WEBVTT') && !content.includes('-->')) {
        console.warn('🎬 Popup: Content may not be valid subtitle format:', content.substring(0, 100));
      }

      return content;
    } else if (response && response.error) {
      console.error('🎬 Popup: Download error from content script:', response.error);

      // 提供更友好的错误信息
      let errorMessage = response.error;
      if (errorMessage.includes('HTTP 403')) {
        errorMessage = '字幕访问被拒绝，可能是权限问题';
      } else if (errorMessage.includes('HTTP 404')) {
        errorMessage = '字幕不存在或已过期';
      } else if (errorMessage.includes('CORS')) {
        errorMessage = '跨域访问限制，请尝试其他字幕';
      } else if (errorMessage.includes('Network')) {
        errorMessage = '网络连接问题，请检查网络';
      }

      throw new Error(errorMessage);
    } else {
      console.error('🎬 Popup: No content in response');
      throw new Error('未能获取字幕内容，请尝试其他字幕或刷新页面重试');
    }

  } catch (error) {
    console.error('🎬 Popup: Error downloading subtitle content:', error);
    throw error;
  }
}

// 解析字幕文本
function parseSubtitleText(content) {
  if (!content) {
    console.error('字幕内容为空');
    return '';
  }

  // 检查是否是SRT格式（Supadata API返回的格式）
  if (content.includes('-->') && /^\d+\s*$/m.test(content)) {
    console.log('检测到SRT格式，解析SRT字幕');
    return parseSRTText(content);
  }

  // 检查是否是VTT格式
  if (content.includes('WEBVTT')) {
    console.log('检测到VTT格式，解析VTT字幕');
    return parseVTTText(content);
  }

  // 默认尝试XML解析
  console.log('尝试XML解析');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, 'text/xml');

  const textElements = xmlDoc.querySelectorAll('text, p');
  let text = '';

  textElements.forEach(element => {
    const elementText = element.textContent.trim();
    if (elementText) {
      text += elementText + ' ';
    }
  });

  return text.trim();
}

// 解析SRT格式字幕文本
function parseSRTText(srtContent) {
  const lines = srtContent.split('\n');
  let text = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 跳过序号行和时间戳行
    if (/^\d+$/.test(line) || line.includes('-->')) {
      continue;
    }

    // 跳过空行
    if (line === '') {
      continue;
    }

    // 这是字幕文本行
    text += line + ' ';
  }

  return text.trim();
}

// 解析VTT格式字幕文本
function parseVTTText(vttContent) {
  const lines = vttContent.split('\n');
  let text = '';
  let inCue = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 跳过WEBVTT头部
    if (line.startsWith('WEBVTT') || line.startsWith('NOTE')) {
      continue;
    }

    // 检测时间戳行
    if (line.includes('-->')) {
      inCue = true;
      continue;
    }

    // 空行表示cue结束
    if (line === '') {
      inCue = false;
      continue;
    }

    // 如果在cue中，这是字幕文本
    if (inCue) {
      text += line + ' ';
    }
  }

  return text.trim();
}

// 生成AI总结
async function generateAISummary(text) {
  const settings = await loadSettings();
  
  if (!settings.apiKey) {
    throw new Error('请先在设置中配置API密钥');
  }

  const prompt = `请对以下YouTube视频字幕内容进行总结，要求：
1. 提取主要观点和关键信息
2. 按逻辑结构组织内容
3. 使用Markdown格式
4. 控制在500字以内

字幕内容：
${text.substring(0, 40000)}`; // 增加到40000字符，支持更长视频

  if (settings.aiProvider === 'gemini') {
    return await callGeminiAPI(prompt, settings);
  } else if (settings.aiProvider === 'siliconflow') {
    return await callSiliconFlowAPI(prompt, settings);
  } else {
    throw new Error('不支持的AI服务商');
  }
}

// 调用Gemini API
async function callGeminiAPI(prompt, settings) {

  const response = await fetch(`${settings.apiBaseUrl}/v1beta/models/${settings.modelId}:generateContent?key=${settings.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'API调用失败');
  }

  return data.candidates[0].content.parts[0].text;
}

// 调用SiliconFlow API
async function callSiliconFlowAPI(prompt, settings) {
  const response = await fetch(`${settings.apiBaseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.modelId,
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'API调用失败');
  }

  return data.choices[0].message.content;
}

// 简单的Markdown转HTML
function markdownToHtml(markdown) {
  return markdown
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>')
    .replace(/\n/gim, '<br>');
}



// 设置相关 (复制自B站扩展)
async function loadSettings() {
  const result = await chrome.storage.sync.get(['settings']);
  const settings = result.settings || {};

  // Load Supadata API key
  const supadataApiKey = document.getElementById('supadata-api-key');
  if (supadataApiKey) {
    supadataApiKey.value = settings.supadataApiKey || '';
  }

  // Load AI provider first
  const aiProvider = document.getElementById('ai-provider');
  const currentProvider = settings.aiProvider || 'gemini';
  if (aiProvider) {
    aiProvider.value = currentProvider;
  }

  // Load provider-specific settings
  loadProviderSettings(currentProvider, settings);

  // Return settings for API calls
  const providerSettings = settings.providers && settings.providers[currentProvider];
  const config = getDefaultConfig(currentProvider);

  return {
    supadataApiKey: settings.supadataApiKey || '',
    aiProvider: currentProvider,
    apiKey: providerSettings?.apiKey || settings.apiKey || '',
    modelId: providerSettings?.modelId || settings.modelId || config.model,
    apiBaseUrl: providerSettings?.apiBaseUrl || settings.apiBaseUrl || config.baseUrl
  };
}

// Load provider-specific settings
function loadProviderSettings(provider, settings) {
  const config = getDefaultConfig(provider);
  const providerSettings = settings.providers && settings.providers[provider];

  // Update form fields
  const apiBaseUrl = document.getElementById('api-base-url');
  const apiKey = document.getElementById('api-key');
  const modelId = document.getElementById('model-id');

  if (apiBaseUrl) {
    apiBaseUrl.value = providerSettings?.apiBaseUrl || config.baseUrl;
  }
  if (apiKey) {
    apiKey.value = providerSettings?.apiKey || '';
  }
  if (modelId) {
    modelId.value = providerSettings?.modelId || config.model;
  }
}

// Get default configuration for each provider
function getDefaultConfig(provider) {
  const configs = {
    gemini: {
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-2.5-flash'
    },
    siliconflow: {
      baseUrl: 'https://api.siliconflow.cn',
      model: 'deepseek-ai/DeepSeek-V2.5'
    }
  };
  return configs[provider] || configs.gemini;
}

saveSettingsBtn.addEventListener('click', async () => {
  const supadataApiKey = document.getElementById('supadata-api-key').value;
  const aiProvider = document.getElementById('ai-provider').value;
  const apiBaseUrl = document.getElementById('api-base-url').value;
  const apiKey = document.getElementById('api-key').value;
  const modelId = document.getElementById('model-id').value;

  // Get existing settings
  const result = await chrome.storage.sync.get(['settings']);
  const settings = result.settings || {};

  // Save Supadata API key
  settings.supadataApiKey = supadataApiKey;

  // Update provider-specific settings
  if (!settings.providers) {
    settings.providers = {};
  }
  if (!settings.providers[aiProvider]) {
    settings.providers[aiProvider] = {};
  }

  settings.providers[aiProvider] = {
    apiBaseUrl: apiBaseUrl,
    apiKey: apiKey,
    modelId: modelId
  };

  // Update current provider
  settings.aiProvider = aiProvider;

  // Also save to root level for backward compatibility
  settings.apiBaseUrl = apiBaseUrl;
  settings.apiKey = apiKey;
  settings.modelId = modelId;

  await chrome.storage.sync.set({ settings });

  // 显示保存成功提示
  const originalText = saveSettingsBtn.textContent;
  saveSettingsBtn.textContent = '✅ 已保存';
  saveSettingsBtn.style.background = '#28a745';

  setTimeout(() => {
    saveSettingsBtn.textContent = originalText;
    saveSettingsBtn.style.background = '';
  }, 2000);
});

// 清空缓存按钮
const clearCacheBtn = document.getElementById('clear-cache-btn');
if (clearCacheBtn) {
  clearCacheBtn.addEventListener('click', async () => {
    if (!confirm('确定要清空所有视频缓存吗？\n\n清空后需要重新下载字幕和生成AI分析。')) {
      return;
    }

    try {
      clearCacheBtn.disabled = true;
      clearCacheBtn.textContent = '🔄 清空中...';

      const count = await VideoCacheManager.clearAllCache();

      alert(`✅ 已清空 ${count} 个视频的缓存`);

      // 更新统计信息
      await updateCacheStats();

    } catch (error) {
      console.error('清空缓存失败:', error);
      alert('清空缓存失败: ' + error.message);
    } finally {
      clearCacheBtn.disabled = false;
      clearCacheBtn.textContent = '🗑️ 清空所有缓存';
    }
  });
}

// 字幕下载
subtitleDownloadBtn.addEventListener('click', async () => {
  if (currentSubtitles.length === 0) {
    alert('没有可用的字幕');
    return;
  }

  // 获取选中的字幕格式
  const format = document.querySelector('input[name="subtitle-format"]:checked').value;

  try {
    subtitleDownloadBtn.disabled = true;
    subtitleDownloadBtn.textContent = '📥 下载中...';

    // 获取用户选中的字幕，如果没有选中则使用第一个
    const selectedIndex = getSelectedSubtitleIndex();
    const subtitle = currentSubtitles[selectedIndex];
    console.log('开始下载字幕:', subtitle.label, subtitle.url);

    let content;

    // 检查是否是Supadata API或缓存的字幕
    if ((subtitle.url === 'supadata-api' || subtitle.url === 'cached') && subtitle.content) {
      console.log('使用已有字幕内容 (来源:', subtitle.url, ')');
      content = subtitle.content;
    } else {
      console.log('下载字幕内容');
      content = await downloadSubtitleContent(subtitle.url);
    }

    if (!content) {
      throw new Error('无法下载字幕内容');
    }

    console.log('字幕内容长度:', content.length);
    console.log('字幕内容预览:', content.substring(0, 200));

    // 转换格式并下载
    let convertedContent = content;
    let mimeType = 'text/plain;charset=utf-8';

    // 清理文件名
    const cleanTitle = currentVideoInfo.title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
    let filename = `${cleanTitle}_${subtitle.language}.${format}`;

    console.log('选择的格式:', format);
    console.log('生成的文件名:', filename);
    console.log('原始内容预览:', content.substring(0, 200));

    // 检查是否是Supadata API或缓存的SRT格式
    const isSupadataSRT = (subtitle.url === 'supadata-api' || subtitle.url === 'cached');

    if (format === 'srt') {
      if (isSupadataSRT) {
        // Supadata API已经返回SRT格式，直接使用
        convertedContent = content;
        console.log('使用Supadata API的SRT内容（无需转换）');
      } else {
        // 传统方法需要转换
        convertedContent = convertToSRT(content);
        console.log('SRT转换完成，内容预览:', convertedContent.substring(0, 200));
      }
      mimeType = 'application/octet-stream'; // 使用二进制流强制下载
    } else if (format === 'vtt') {
      if (isSupadataSRT) {
        // 从SRT转换为VTT
        convertedContent = convertSRTToVTT(content);
        console.log('从SRT转换为VTT');
      } else {
        convertedContent = convertToVTT(content);
        console.log('VTT转换完成，内容预览:', convertedContent.substring(0, 200));
      }
      mimeType = 'text/vtt;charset=utf-8';
    } else if (format === 'txt') {
      convertedContent = parseSubtitleText(content);
      mimeType = 'text/plain;charset=utf-8';
      console.log('TXT转换完成，内容预览:', convertedContent.substring(0, 200));
    }

    console.log('转换后内容长度:', convertedContent.length);
    console.log('使用MIME类型:', mimeType);
    console.log('文件名:', filename);

    // 创建下载
    const blob = new Blob([convertedContent], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // 使用Chrome下载API，强制指定文件扩展名
    const downloadOptions = {
      url: url,
      filename: filename,
      saveAs: true
    };

    // 对于SRT格式，确保文件名正确
    if (format === 'srt' && !filename.endsWith('.srt')) {
      downloadOptions.filename = filename.replace(/\.[^.]+$/, '.srt');
    }

    console.log('下载选项:', downloadOptions);

    chrome.downloads.download(downloadOptions, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('下载失败:', chrome.runtime.lastError);
        alert('下载失败: ' + chrome.runtime.lastError.message);
      } else {
        console.log('下载开始，ID:', downloadId);
        alert(`字幕下载成功！格式：${format.toUpperCase()}`);
      }
      // 清理URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

  } catch (error) {
    console.error('下载错误:', error);
    alert('下载失败: ' + error.message);
  } finally {
    subtitleDownloadBtn.disabled = false;
    subtitleDownloadBtn.textContent = '📝 下载字幕';
  }
});

// 转换为SRT格式
function convertToSRT(xmlContent) {
  try {
    console.log('开始转换SRT，内容长度:', xmlContent.length);
    console.log('原始内容预览:', xmlContent.substring(0, 500));

    // 检查是否已经是SRT格式
    if (xmlContent.includes('-->') && /^\d+\s*$/m.test(xmlContent)) {
      console.log('内容已经是SRT格式');
      return xmlContent;
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    // 尝试不同的元素选择器
    let textElements = xmlDoc.querySelectorAll('text, p');
    console.log('找到文本元素数量:', textElements.length);

    if (textElements.length === 0) {
      // 如果没找到，尝试直接解析文本内容
      console.log('未找到XML元素，尝试文本解析');
      const entries = parseSubtitleEntries(xmlContent);
      if (entries && entries.length > 0) {
        return convertEntriesToSRT(entries);
      }
      return parseSubtitleText(xmlContent);
    }

    let srtContent = '';
    let index = 1;

    textElements.forEach(element => {
      const start = element.getAttribute('start') || element.getAttribute('t');
      const dur = element.getAttribute('dur') || element.getAttribute('d');
      let text = element.textContent.trim();

      if (start && text) {
        let startMs = parseFloat(start);
        let durMs = parseFloat(dur) || 3000;

        // YouTube字幕时间通常是毫秒，需要转换
        if (startMs > 10000) {
          startMs = startMs / 1000;
          durMs = durMs / 1000;
        }

        let startSeconds = startMs;
        let endSeconds = startMs + durMs;

        const startTime = formatTime(startSeconds);
        const endTime = formatTime(endSeconds);

        srtContent += `${index}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `${text}\n\n`;
        index++;
      }
    });

    console.log('SRT转换完成，条目数:', index - 1);
    return srtContent || '转换失败：未找到有效内容';
  } catch (error) {
    console.error('SRT转换错误:', error);
    return `转换错误: ${error.message}`;
  }
}

// 将解析的条目转换为SRT格式
function convertEntriesToSRT(entries) {
  let srtContent = '';
  entries.forEach((entry, index) => {
    const startTime = formatTime(entry.from);
    const endTime = formatTime(entry.to);

    srtContent += `${index + 1}\n`;
    srtContent += `${startTime} --> ${endTime}\n`;
    srtContent += `${entry.text}\n\n`;
  });
  return srtContent;
}

// 从SRT转换为VTT格式
function convertSRTToVTT(srtContent) {
  try {
    console.log('开始从SRT转换为VTT');

    let vttContent = 'WEBVTT\n\n';
    const lines = srtContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 跳过序号行
      if (/^\d+$/.test(line)) {
        continue;
      }

      // 转换时间戳格式：SRT使用逗号，VTT使用点
      if (line.includes('-->')) {
        const vttTimestamp = line.replace(/,/g, '.');
        vttContent += vttTimestamp + '\n';
        continue;
      }

      // 其他行直接添加
      vttContent += line + '\n';
    }

    console.log('SRT到VTT转换完成');
    return vttContent;
  } catch (error) {
    console.error('SRT到VTT转换错误:', error);
    return `WEBVTT\n\n转换错误: ${error.message}`;
  }
}

// 转换为VTT格式
function convertToVTT(xmlContent) {
  try {
    console.log('开始转换VTT，内容长度:', xmlContent.length);

    // 检查是否已经是VTT格式
    if (xmlContent.startsWith('WEBVTT')) {
      console.log('内容已经是VTT格式');
      return xmlContent;
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    let textElements = xmlDoc.querySelectorAll('text, p');
    if (textElements.length === 0) {
      // 尝试使用解析的条目
      const entries = parseSubtitleEntries(xmlContent);
      if (entries && entries.length > 0) {
        return convertEntriesToVTT(entries);
      }
      textElements = xmlDoc.querySelectorAll('body > *');
    }

    let vttContent = 'WEBVTT\n\n';

    textElements.forEach(element => {
      const start = element.getAttribute('start') ||
                   element.getAttribute('t') ||
                   element.getAttribute('begin');
      const dur = element.getAttribute('dur') ||
                 element.getAttribute('d') ||
                 element.getAttribute('duration');

      let text = element.textContent.trim().replace(/\s+/g, ' ');

      if (start && text) {
        let startSeconds = parseFloat(start);
        let endSeconds = startSeconds + (dur ? parseFloat(dur) : 3);

        // YouTube字幕时间通常是毫秒，需要转换
        if (startSeconds > 10000) {
          startSeconds = startSeconds / 1000;
          endSeconds = endSeconds / 1000;
        }

        const startTime = formatTimeVTT(startSeconds);
        const endTime = formatTimeVTT(endSeconds);

        vttContent += `${startTime} --> ${endTime}\n`;
        vttContent += `${text}\n\n`;
      }
    });

    console.log('VTT转换完成');
    return vttContent;
  } catch (error) {
    console.error('VTT conversion error:', error);
    return `WEBVTT\n\n转换错误: ${error.message}`;
  }
}

// 将解析的条目转换为VTT格式
function convertEntriesToVTT(entries) {
  let vttContent = 'WEBVTT\n\n';
  entries.forEach(entry => {
    const startTime = formatTimeVTT(entry.from);
    const endTime = formatTimeVTT(entry.to);

    vttContent += `${startTime} --> ${endTime}\n`;
    vttContent += `${entry.text}\n\n`;
  });
  return vttContent;
}

// 格式化时间为SRT格式
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

// 格式化时间为VTT格式
function formatTimeVTT(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// 继续提问功能
generateAnswerBtn.addEventListener('click', async () => {
  const question = followUpQuestion.value.trim();
  if (!question) {
    alert('请输入问题');
    return;
  }

  try {
    generateAnswerBtn.disabled = true;
    generateAnswerBtn.textContent = '🔄 生成中...';

    const context = parseSubtitleText(currentSubtitleContent);
    const prompt = `基于以下视频内容回答问题：

视频内容：
${context.substring(0, 6000)}

问题：${question}

请提供详细的回答：`;

    const settings = await loadSettings();
    let answer;

    if (settings.aiProvider === 'gemini') {
      answer = await callGeminiAPI(prompt, settings);
    } else if (settings.aiProvider === 'siliconflow') {
      answer = await callSiliconFlowAPI(prompt, settings);
    }

    // 在总结内容后添加问答
    summaryContent.innerHTML += `
      <hr style="margin: 20px 0;">
      <h4>❓ ${question}</h4>
      <div style="background: #e3f2fd; padding: 10px; border-radius: 4px;">
        ${markdownToHtml(answer)}
      </div>
    `;

    followUpQuestion.value = '';

    // 🎯 保存完整的AI分析内容（包括原始总结 + 所有问答）到缓存
    if (currentVideoInfo && currentVideoInfo.videoId) {
      // 获取当前显示的完整内容（HTML格式）
      const fullContent = summaryContent.innerHTML;
      await VideoCacheManager.updateAISummary(currentVideoInfo.videoId, fullContent);
      console.log('✅ AI分析（包含问答）已保存到缓存');
    }

  } catch (error) {
    console.error('Generate answer error:', error);
    alert('回答生成失败: ' + error.message);
  } finally {
    generateAnswerBtn.disabled = false;
    generateAnswerBtn.textContent = '✨ 生成答案';
  }
});

// Add event listener for AI provider change
document.addEventListener('DOMContentLoaded', function() {
  const aiProviderSelect = document.getElementById('ai-provider');
  if (aiProviderSelect) {
    aiProviderSelect.addEventListener('change', function() {
      // Load settings for the new provider
      chrome.storage.sync.get(['settings'], function(result) {
        const settings = result.settings || {};
        loadProviderSettings(aiProviderSelect.value, settings);
      });
    });
  }
});

// ========== 完整移植B站时间戳功能 ==========
const generateTimestampBtn = document.getElementById('generate-timestamp-btn');
if (generateTimestampBtn) {
  generateTimestampBtn.addEventListener('click', function() {
    generateVideoTips();
  });
}

// Generate video TIPS（完全移植B站逻辑）
function generateVideoTips() {
  const generateTipsBtn = document.getElementById('generate-timestamp-btn');
  const tipsResult = document.getElementById('timestamp-result');
  const tipsContent = document.getElementById('timestamp-list');
  const videoAnalysisInfo = document.getElementById('video-analysis-info');

  if (!currentSubtitles || currentSubtitles.length === 0) {
    alert('没有可用的字幕进行TIPS生成');
    return;
  }

  // Show loading state
  generateTipsBtn.textContent = '🔄 生成中...';
  generateTipsBtn.disabled = true;

  console.log('开始生成TIPS，字幕数量:', currentSubtitles.length);

  const subtitle = currentSubtitles[getSelectedSubtitleIndex()];
  console.log('使用字幕:', subtitle);

  // 获取当前页面标题
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const videoTitle = currentTab.title || 'YouTube视频';

    // 获取字幕内容
    let contentPromise;

    // 检查是否是Supadata API或缓存的字幕
    if ((subtitle.url === 'supadata-api' || subtitle.url === 'cached') && subtitle.content) {
      console.log('使用已有字幕内容 (来源:', subtitle.url, ')');
      contentPromise = Promise.resolve(subtitle.content);
    } else {
      console.log('下载字幕内容');
      contentPromise = downloadSubtitleContent(subtitle.url);
    }

    contentPromise.then(content => {
      if (!content || content.length < 10) {
        generateTipsBtn.textContent = '✨ 生成智能导航';
        generateTipsBtn.disabled = false;
        alert('获取字幕内容失败');
        return;
      }

      console.log('开始解析字幕条目');
      const entries = parseSubtitleEntries(content);
      console.log('解析结果:', entries.length, '条');

      if (!entries || entries.length === 0) {
        generateTipsBtn.textContent = '✨ 生成智能导航';
        generateTipsBtn.disabled = false;
        alert('字幕内容为空');
        return;
      }

      // 计算视频时长
      const videoDurationMinutes = Math.ceil(entries[entries.length - 1].to / 60);

      // 计算建议TIPS数量
      const suggestedTipsCount = calculateOptimalTipsCount(videoDurationMinutes);

      // Convert subtitle to text
      const subtitleText = entries.map(item => `[${formatTime(item.from)}] ${item.text}`).join('\n');
      console.log('字幕文本长度:', subtitleText.length);
      console.log('视频时长:', videoDurationMinutes, '分钟');
      console.log('建议TIPS数量:', suggestedTipsCount);

      // 保存字幕数据供后续使用
      window.currentSubtitleData = entries;

      // 显示视频分析信息
      videoAnalysisInfo.innerHTML = `
        <div class="analysis-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 10px 0;">
          <div class="analysis-item" style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
            <div class="analysis-value" style="font-size: 18px; font-weight: bold; color: #1976d2;">${videoDurationMinutes}分钟</div>
            <div class="analysis-label" style="font-size: 12px; color: #666;">视频时长</div>
          </div>
          <div class="analysis-item" style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
            <div class="analysis-value" style="font-size: 18px; font-weight: bold; color: #1976d2;">${suggestedTipsCount}个</div>
            <div class="analysis-label" style="font-size: 12px; color: #666;">建议TIPS数量</div>
          </div>
          <div class="analysis-item" style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
            <div class="analysis-value" style="font-size: 18px; font-weight: bold; color: #1976d2;">${entries.length}</div>
            <div class="analysis-label" style="font-size: 12px; color: #666;">字幕条目</div>
          </div>
        </div>
        <p style="font-size: 12px; color: #666; margin: 5px 0 0 0; text-align: center;">
          根据视频长度动态调整TIPS数量，并考虑时间分布均匀性
        </p>
      `;

      // Call AI API to generate TIPS (复用现有API逻辑)
      callAIAPIForTips(subtitleText, videoTitle, videoDurationMinutes, suggestedTipsCount);
    }).catch(error => {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('获取字幕内容失败：' + error.message);
    });
  });
}

function parseSubtitleEntries(content) {
  try {
    console.log('parseSubtitleEntries: 开始解析字幕');
    console.log('内容长度:', content.length);
    console.log('内容前200字符:', content.substring(0, 200));

    const entries = [];

    // 检测SRT格式（Supadata API返回的格式）
    if (content.includes('-->') && /^\d+\s*$/m.test(content)) {
      console.log('检测到SRT格式');
      const lines = content.split(/\r?\n/);
      let i = 0;

      while (i < lines.length) {
        const line = lines[i].trim();

        // 跳过序号行
        if (/^\d+$/.test(line)) {
          i++;
          continue;
        }

        // 匹配SRT时间戳格式：HH:MM:SS,mmm --> HH:MM:SS,mmm
        const srtMatch = line.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
        if (srtMatch) {
          const from = srtToSeconds(srtMatch[1]);
          const to = srtToSeconds(srtMatch[2]);
          let text = '';
          i++;

          // 读取字幕文本（直到空行）
          while (i < lines.length && lines[i].trim() && !/^\d+$/.test(lines[i].trim()) && !lines[i].includes('-->')) {
            text += (lines[i].trim() + ' ');
            i++;
          }

          text = text.trim();
          if (text) {
            entries.push({ from, to, text });
          }
          continue;
        }

        i++;
      }

      console.log('SRT解析完成，条目数:', entries.length);
      if (entries.length > 0) {
        return entries;
      }
    }

    // 尝试XML解析
    console.log('尝试XML解析');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    let nodes = xmlDoc.querySelectorAll('text, p, body > *');

    nodes.forEach(el => {
      const start = el.getAttribute('start') || el.getAttribute('t') || el.getAttribute('begin');
      const dur = el.getAttribute('dur') || el.getAttribute('d') || el.getAttribute('duration');
      let text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (!start || !text) return;

      let startSec = parseFloat(start);
      let endSec = startSec + (dur ? parseFloat(dur) : 3);
      if (startSec > 10000) { startSec = startSec / 1000; endSec = endSec / 1000; }
      entries.push({ from: startSec, to: endSec, text });
    });

    // 尝试VTT格式
    if (entries.length === 0 && /WEBVTT/.test(content)) {
      console.log('尝试VTT解析');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // VTT时间戳格式：HH:MM:SS.mmm --> HH:MM:SS.mmm
        const m = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
        if (m) {
          const from = vttToSeconds(m[1]);
          const to = vttToSeconds(m[2]);
          let text = '';
          i++;
          while (i < lines.length && lines[i].trim() && !/-->/.test(lines[i])) {
            text += (lines[i].trim() + ' ');
            i++;
          }
          text = text.trim();
          if (text) entries.push({ from, to, text });
        }
      }
    }

    console.log('最终解析结果，条目数:', entries.length);
    return entries;
  } catch (e) {
    console.error('parseSubtitleEntries error:', e);
    return [];
  }
}

// SRT时间戳转秒数（HH:MM:SS,mmm）
function srtToSeconds(ts) {
  const [time, ms] = ts.split(',');
  const [h, m, s] = time.split(':');
  return (+h) * 3600 + (+m) * 60 + (+s) + (+ms) / 1000;
}

// VTT时间戳转秒数（HH:MM:SS.mmm）
function vttToSeconds(ts) {
  const [h, m, sms] = ts.split(':');
  const [s, ms] = sms.split('.');
  return (+h) * 3600 + (+m) * 60 + (+s) + (+ms) / 1000;
}

function calculateOptimalTipsCount(videoDurationMinutes) {
  if (videoDurationMinutes <= 15) return 3;
  if (videoDurationMinutes <= 30) return 4;
  if (videoDurationMinutes <= 45) return 5;
  if (videoDurationMinutes <= 60) return 6;
  if (videoDurationMinutes <= 90) return 8;
  if (videoDurationMinutes <= 120) return 10;
  return Math.min(12, Math.ceil(videoDurationMinutes / 12));
}

function formatSecondsToTimeShort(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// 智能采样字幕文本，确保覆盖整个视频时长
function sampleSubtitleText(subtitleData, videoDurationMinutes, maxLength) {
  if (!subtitleData || subtitleData.length === 0) return '';

  const totalDuration = subtitleData[subtitleData.length - 1].to;
  const fullText = subtitleData.map(s => `[${formatSecondsToTime(s.from)}] ${s.text}`).join('\n');

  // 如果全文长度在限制内，直接返回
  if (fullText.length <= maxLength) {
    return fullText;
  }

  // 🆕 分段采样：确保前、中、后都有内容，并且均匀分配字符配额
  const segments = [];
  const segmentCount = 6; // 分成6段，确保覆盖均匀
  const maxLengthPerSegment = Math.floor(maxLength / segmentCount); // 🆕 每段的字符配额

  console.log(`📊 字幕采样: 视频${videoDurationMinutes}分钟, 分${segmentCount}段, 每段最多${maxLengthPerSegment}字符`);

  for (let i = 0; i < segmentCount; i++) {
    const startTime = (totalDuration / segmentCount) * i;
    const endTime = (totalDuration / segmentCount) * (i + 1);

    // 找到这个时间段的字幕
    const segmentSubtitles = subtitleData.filter(s => s.from >= startTime && s.to <= endTime);

    if (segmentSubtitles.length > 0) {
      // 🆕 从这个时间段采样字幕，但不超过配额
      const sampleSize = Math.max(3, Math.floor(segmentSubtitles.length / 3));
      const sampledItems = [];

      for (let j = 0; j < sampleSize && j < segmentSubtitles.length; j++) {
        const index = Math.floor((j / sampleSize) * segmentSubtitles.length);
        sampledItems.push(segmentSubtitles[index]);
      }

      let segmentText = sampledItems.map(s => `[${formatSecondsToTime(s.from)}] ${s.text}`).join('\n');

      // 🆕 如果这段超过配额，截断这段（而不是截断整个结果）
      if (segmentText.length > maxLengthPerSegment) {
        segmentText = segmentText.substring(0, maxLengthPerSegment) + '...';
        console.log(`⚠️ 第${i+1}段字幕超过配额，已截断`);
      }

      const header = `\n=== ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2,'0')}-${Math.floor(endTime/60)}:${String(Math.floor(endTime%60)).padStart(2,'0')} 时段 ===\n`;
      segments.push(header + segmentText);

      console.log(`✅ 第${i+1}段: ${Math.floor(startTime/60)}-${Math.floor(endTime/60)}分钟, ${segmentText.length}字符`);
    }
  }

  const result = segments.join('\n');
  console.log(`📊 采样完成: 总共${result.length}字符 (限制${maxLength})`);

  return result;
}

// Call AI API for TIPS generation (完全移植B站逻辑)
function callAIAPIForTips(subtitleText, videoTitle, videoDurationMinutes, suggestedTipsCount) {
  const generateTipsBtn = document.getElementById('generate-timestamp-btn');
  const tipsResult = document.getElementById('timestamp-result');
  const tipsContent = document.getElementById('timestamp-list');

  // 首先将字幕转换为带时间戳的格式，并确保覆盖整个视频
  const fullText = window.currentSubtitleData.map(s => `[${formatSecondsToTime(s.from)}] ${s.text}`).join('\n');

  // 智能采样：确保字幕内容覆盖整个视频时长
  const sampledText = sampleSubtitleText(window.currentSubtitleData, videoDurationMinutes, 25000);

  const prompt = `分析${videoDurationMinutes}分钟的视频字幕，提取${suggestedTipsCount}个最重要且有代表性的核心TIPS。

⚠️ 重要要求：必须确保TIPS在整个视频时长内均匀分布，不能只集中在前半段！

字幕内容：
${sampledText}

要求：
1. 优先提取重要观点和关键信息，包含具体信息（产品名、数字、性能数据、关键概念等）
2. 适当考虑信息完整性，最好让每个时间段都有所兼顾
3. 对重要观点分布较多的时段，可以增加更多权重，提取更多TIPS
4. 如果某个时段确实缺乏重要内容可以跳过，但尽量避免所有TIPS都集中在前半段
5. 原文段落必须是连续时间的3-4句话，时间跨度不超过30秒

视频总时长：${videoDurationMinutes}分钟

⚠️ 🔴 最小间隔要求（最高优先级）：
- **相邻TIPS的时间戳必须至少间隔3分钟**
- 例如：如果第1个TIP在00:34，第2个TIP必须在03:34之后（不能是00:55）
- 例如：如果第2个TIP在04:00，第3个TIP必须在07:00之后
- 这是强制要求，必须严格遵守，避免TIPS过度集中在视频开头

⚠️ 时间分布建议：
- 尽量让TIPS覆盖整个视频时长
- 前1/3、中1/3、后1/3时段都应该有TIPS
- 但优先保证最小间隔要求（3分钟）

请严格按照上述最小间隔要求，确保相邻TIPS至少间隔3分钟！

请严格按照以下格式返回：

TIP1: [具体要点]
原文段落: "[时间戳] 内容1 [时间戳] 内容2 [时间戳] 内容3"

TIP2: [具体要点]
原文段落: "[时间戳] 内容1 [时间戳] 内容2 [时间戳] 内容3"

...（共${suggestedTipsCount}个TIPS）

重要：请确保严格按照上述格式输出，不要使用JSON或其他格式。`;

  // 复用现有的AI API调用逻辑
  loadSettings().then(settings => {
    if (!settings.apiKey) {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('请先在设置中配置AI服务');
      return;
    }

    // Call different APIs based on provider (复用现有逻辑)
    if (settings.aiProvider === 'gemini') {
      callGeminiAPIForTips(prompt, settings, generateTipsBtn, tipsContent, tipsResult);
    } else if (settings.aiProvider === 'siliconflow') {
      callSiliconFlowAPIForTips(prompt, settings, generateTipsBtn, tipsContent, tipsResult);
    } else {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('不支持的AI服务商：' + settings.aiProvider);
    }
  });
}

function truncateText(t, max=120) { return t ? (t.length > max ? t.slice(0, max) + '…' : t) : ''; }

function renderTimestampList(tips) {
  const tsList = document.getElementById('timestamp-list');
  if (!tsList) return;
  if (!tips || tips.length === 0) { tsList.innerHTML = '<p style="color:#999">无可展示内容</p>'; return; }

  let html = `
    <div style="margin-bottom: 16px; padding: 12px; background: #e3f2fd; border-radius: 8px;">
      <h4 style="margin: 0 0 6px 0; color: #1976d2;">🎯 视频智能导航 (${tips.length}个要点)</h4>
      <p style="margin: 0; color: #666; font-size: 13px;">点击时间戳或摘要将在下一步支持跳转</p>
    </div>
  `;

  tips.forEach(item => {
    html += `
      <div class="tip-item" style="cursor: default; transition: all 0.2s; border:1px solid #e0e0e0; border-radius:10px; margin-bottom:10px; padding:12px; background:#fff;" data-seconds="${item.startSeconds}">
        <div style="display:flex; align-items:flex-start; gap:14px;">
          <div class="tip-timestamp" data-seconds="${item.startSeconds}" style="flex-shrink:0; font-size:15px; font-weight:bold; color:#1976d2;">${item.startTime}</div>
          <div style="flex:1;">
            <div style="font-size:15px; line-height:1.5; color:#333;">${escapeHtml(item.tip)}</div>
            ${item.original ? `<div style=\"font-size:12px; color:#888; margin-top:6px;\">${escapeHtml(item.original)}</div>` : ''}
          </div>
        </div>
      </div>`;
  });
  tsList.innerHTML = html;
}

function escapeHtml(str='') { return str.replace(/[&<>\"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }

// Call Gemini API for TIPS generation (基于现有的callGeminiAPI)
function callGeminiAPIForTips(prompt, settings, generateTipsBtn, tipsContent, tipsResult) {
  console.log('=== Gemini API TIPS调用开始 ===');

  callGeminiAPI(prompt, settings).then(tipsText => {
    console.log('Gemini API TIPS响应:', tipsText);

    generateTipsBtn.textContent = '✨ 生成智能导航';
    generateTipsBtn.disabled = false;

    // 解析TIPS并进行时间戳定位
    processTipsResponse(tipsText, tipsContent, tipsResult);
  }).catch(error => {
    console.error('Gemini API TIPS调用异常:', error);
    generateTipsBtn.textContent = '✨ 生成智能导航';
    generateTipsBtn.disabled = false;
    alert('Gemini API调用失败：' + error.message);
  });
}

// Call SiliconFlow API for TIPS generation (基于现有的callSiliconFlowAPI)
function callSiliconFlowAPIForTips(prompt, settings, generateTipsBtn, tipsContent, tipsResult) {
  console.log('=== 硅基流动 API TIPS调用开始 ===');

  callSiliconFlowAPI(prompt, settings).then(tipsText => {
    console.log('硅基流动 API TIPS响应:', tipsText);

    generateTipsBtn.textContent = '✨ 生成智能导航';
    generateTipsBtn.disabled = false;

    // 解析TIPS并进行时间戳定位
    processTipsResponse(tipsText, tipsContent, tipsResult);
  }).catch(error => {
    console.error('硅基流动 API TIPS调用异常:', error);
    generateTipsBtn.textContent = '✨ 生成智能导航';
    generateTipsBtn.disabled = false;
    alert('硅基流动 API调用失败：' + error.message);
  });
}

// ========== B站移植：TIPS处理与相似度匹配 ==========
// 处理TIPS响应并进行时间戳定位（完全移植B站逻辑）
function processTipsResponse(tipsText, tipsContent, tipsResult) {
  console.log('开始处理TIPS响应...');
  console.log('AI响应原始内容:', tipsText);

  // 检查响应是否有效
  if (!tipsText || typeof tipsText !== 'string' || tipsText.trim().length === 0) {
    console.error('AI响应为空或无效:', tipsText);
    alert('AI响应为空，请检查API配置或重试');
    return;
  }

  // 解析AI返回的TIPS
  const tipsData = parseTipsResponse(tipsText);
  if (tipsData.length === 0) {
    console.error('TIPS解析失败，AI响应内容:', tipsText.substring(0, 500));
    alert(`TIPS解析失败，AI返回内容：\n${tipsText.substring(0, 200)}...\n\n请检查AI服务配置或重试`);
    return;
  }

  console.log('解析出', tipsData.length, '个TIPS');

  // 进行时间戳定位
  const results = searchAndLocateTips(tipsData, window.currentSubtitleData);

  // 保存结果供模式切换使用
  window.lastTipsResults = results;

  // 显示结果
  displayTipsResults(results, tipsContent, tipsResult);
}

function parseTipsResponse(response) {
  console.log('解析TIPS响应，原始内容:', response);

  if (!response || typeof response !== 'string') {
    console.error('无效的AI响应:', response);
    return [];
  }

  // 检查是否包含预期的文本TIPS格式
  if (!response.includes('TIP') && !response.includes('原文段落')) {
    console.error('AI响应不包含TIPS格式:', response.substring(0, 200));
    return [];
  }

  const results = [];
  const lines = response.split('\n');
  let currentTip = '';
  let currentOriginal = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.match(/^TIP\d+:/)) {
      // 保存上一个TIP
      if (currentTip && currentOriginal) {
        results.push({
          tip: currentTip.replace(/^TIP\d+:\s*/, '').trim(),
          originalText: currentOriginal.replace(/^原文段落:\s*/, '').trim(),
          tipNumber: results.length + 1
        });
      }
      currentTip = line;
      currentOriginal = '';
    } else if (line.startsWith('原文段落:')) {
      currentOriginal = line;
    }
  }

  // 保存最后一个TIP
  if (currentTip && currentOriginal) {
    results.push({
      tip: currentTip.replace(/^TIP\d+:\s*/, '').trim(),
      originalText: currentOriginal.replace(/^原文段落:\s*/, '').trim(),
      tipNumber: results.length + 1
    });
  }

  console.log(`成功解析出${results.length}个TIPS`);
  return results;
}

// ========== B站移植：相似度匹配与定位 ==========
function searchAndLocateTips(tipsData, subtitleData) {
  console.log('开始搜索定位TIPS...');
  const results = [];

  tipsData.forEach((item, index) => {
    console.log(`处理TIP ${index + 1}: ${item.tip.substring(0, 50)}...`);
    const location = findTipLocation(item.originalText, subtitleData);
    results.push({
      tip: item.tip,
      originalText: item.originalText,
      location: location,
      index: index + 1
    });
  });

  console.log(`搜索定位完成，共处理${results.length}个TIPS`);
  return results;
}

function findTipLocation(originalText, subtitleData) {
  if (!originalText || !subtitleData || subtitleData.length === 0) {
    return { found: false };
  }

  console.log('查找原文段落:', originalText.substring(0, 100));

  // 清理原文段落，提取纯文本内容
  const cleanOriginal = originalText
    .replace(/\[[\d:]+\]/g, '') // 移除时间戳
    .replace(/\s+/g, ' ')       // 合并空格
    .trim();

  if (cleanOriginal.length < 5) {
    return { found: false };
  }

  let bestMatch = { similarity: 0, found: false };

  // 滑动窗口搜索，窗口大小为3-5句
  for (let windowSize = 3; windowSize <= 5; windowSize++) {
    for (let i = 0; i <= subtitleData.length - windowSize; i++) {
      const window = subtitleData.slice(i, i + windowSize);
      const windowText = window.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();

      const similarity = calculateTextSimilarity(cleanOriginal, windowText);

      if (similarity > bestMatch.similarity && similarity > 0.3) {
        bestMatch = {
          found: true,
          similarity: similarity,
          startIndex: i,
          endIndex: i + windowSize - 1,
          startSeconds: Math.floor(window[0].from),
          endSeconds: Math.ceil(window[window.length - 1].to),
          startTime: formatTime(window[0].from),
          endTime: formatTime(window[window.length - 1].to),
          sentences: window.map(s => ({
            from: s.from,
            to: s.to,
            content: s.text
          })),
          method: 'sliding_window'
        };
      }
    }
  }

  if (bestMatch.found) {
    console.log(`找到匹配，相似度: ${(bestMatch.similarity * 100).toFixed(1)}%`);

    // 关键词过滤：避免从"说了一半的句子"开始
    const adjustedMatch = avoidMidSentenceStart(bestMatch, subtitleData);
    return adjustedMatch;
  }

  return { found: false };
}

function calculateTextSimilarity(text1, text2) {
  // 对中文文本进行字符级别的比较
  const chars1 = text1.replace(/\s+/g, '').split('');
  const chars2 = text2.replace(/\s+/g, '').split('');

  // 计算字符级别的相似度
  const set1 = new Set(chars1);
  const set2 = new Set(chars2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  const charSimilarity = union.size > 0 ? intersection.size / union.size : 0;

  // 计算子串匹配度
  let substringMatches = 0;
  for (let i = 0; i < text1.length - 2; i++) {
    const substring = text1.substring(i, i + 3);
    if (text2.includes(substring)) {
      substringMatches++;
    }
  }

  const substringSimilarity = text1.length > 2 ? substringMatches / (text1.length - 2) : 0;

  // 综合相似度（字符相似度 + 子串相似度）
  return (charSimilarity * 0.6 + substringSimilarity * 0.4);
}

// 显示TIPS结果（完全移植B站逻辑）
function displayTipsResults(results, tipsContent, tipsResult) {
  console.log('显示TIPS结果，共', results.length, '个');

  // 按时间戳排序（修复顺序问题）
  const sortedResults = results.slice().sort((a, b) => {
    const timeA = (a.location && a.location.found) ? a.location.startSeconds : 999999;
    const timeB = (b.location && b.location.found) ? b.location.startSeconds : 999999;
    return timeA - timeB;
  });

  const successCount = sortedResults.filter(r => r.location && r.location.found).length;
  const successRate = ((successCount / sortedResults.length) * 100).toFixed(1);

  // 检查是否为调试模式（可以通过URL参数或设置控制）
  const isDebugMode = window.location.href.includes('debug=true') || localStorage.getItem('tips-debug') === 'true';

  if (isDebugMode) {
    // 调试模式：显示详细信息（包含缓存保存）
    displayDebugTipsResults(sortedResults, successCount, successRate, tipsContent, tipsResult);
  } else {
    // 产品模式：简洁的时间戳+摘要界面（包含缓存保存）
    displayProductTipsResults(sortedResults, successCount, successRate, tipsContent, tipsResult);
  }
}

// 调试模式：显示详细信息（新增函数）
function displayDebugTipsResults(results, successCount, successRate, tipsContent, tipsResult) {
  let html = `
    <div style="margin-bottom: 20px; padding: 15px; background: #fff3cd; border-radius: 8px;">
      <h4 style="margin: 0 0 10px 0; color: #856404;">🔧 调试模式 - 视频智能导航 (${results.length}个要点)</h4>
      <p style="margin: 5px 0; color: #666; font-size: 14px;">
        显示详细的匹配信息和相似度数据
      </p>
      <p style="margin: 5px 0; color: #666; font-size: 13px;">定位成功率: ${successCount}/${results.length} (${successRate}%)</p>
    </div>
  `;

  results.forEach((item, index) => {
    const isFound = item.location && item.location.found;

    if (isFound) {
      // 成功定位的TIPS：显示详细调试信息
      html += `
        <div class="tip-item" style="cursor: pointer; transition: all 0.3s; margin-bottom: 16px; padding: 12px; background: #fff; border: 2px solid #28a745; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" data-seconds="${item.location.startSeconds}">
          <div style="display: flex; align-items: flex-start; gap: 15px;">
            <div class="tip-timestamp" data-seconds="${item.location.startSeconds}" style="flex-shrink: 0; font-size: 16px; font-weight: bold; color: #28a745;">
              ${item.location.startTime}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: bold; margin-bottom: 8px; font-size: 15px; color: #333;">
                ${escapeHtml(item.tip)}
              </div>
              <div style="font-size: 12px; color: #666; background: #f8f9fa; padding: 8px; border-radius: 4px; margin-top: 8px;">
                <strong>🔍 调试信息:</strong><br>
                相似度: ${(item.location.similarity * 100).toFixed(1)}%<br>
                匹配方法: ${item.location.method}<br>
                原文段落: ${escapeHtml(item.originalText.substring(0, 100))}...
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      // 未定位成功的TIPS：显示失败原因
      html += `
        <div class="tip-item" style="opacity: 0.7; margin-bottom: 16px; padding: 12px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px;">
          <div style="display: flex; align-items: flex-start; gap: 15px;">
            <div style="flex-shrink: 0; font-size: 16px; font-weight: bold; color: #721c24;">
              --:--
            </div>
            <div style="flex: 1;">
              <div style="font-size: 15px; line-height: 1.5; color: #721c24;">
                ${escapeHtml(item.tip)}
              </div>
              <div style="font-size: 12px; color: #721c24; margin-top: 5px;">
                ⚠️ 时间戳定位失败<br>
                原文段落: ${escapeHtml(item.originalText.substring(0, 100))}...
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });

  // 添加切换到产品模式的按钮
  html += `
    <div style="margin-top: 20px; text-align: center;">
      <button onclick="localStorage.setItem('tips-debug', 'false'); location.reload();" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 12px; cursor: pointer;">
        切换到产品模式
      </button>
    </div>
  `;

  tipsContent.innerHTML = html;
  tipsResult.style.display = 'block';

  // 添加hover效果
  const tipItems = tipsContent.querySelectorAll('.tip-item[data-seconds]');
  tipItems.forEach(item => {
    item.addEventListener('mouseenter', function() {
      this.style.boxShadow = '0 4px 12px rgba(40,167,69,0.3)';
      this.style.transform = 'translateY(-1px)';
    });

    item.addEventListener('mouseleave', function() {
      this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      this.style.transform = 'translateY(0)';
    });
  });

  // 🎯 保存时间戳导航到缓存（与产品模式相同的逻辑）
  if (currentVideoInfo && currentVideoInfo.videoId) {
    const timestampsData = results
      .filter(item => item.location && item.location.found)
      .map(item => ({
        time: item.location.startSeconds,
        title: item.tip.substring(0, 100), // 限制长度
        description: item.tip
      }));

    if (timestampsData.length > 0) {
      VideoCacheManager.updateTimestamps(currentVideoInfo.videoId, timestampsData)
        .then(() => {
          console.log('✅ 时间戳导航已保存到缓存（调试模式）');
        })
        .catch(error => {
          console.error('保存时间戳导航失败:', error);
        });
    }
  }
}

// 产品模式：简洁界面（完全移植B站逻辑）
function displayProductTipsResults(results, successCount, successRate, tipsContent, tipsResult) {
  let html = `
    <div style="margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
      <h4 style="margin: 0 0 10px 0; color: #1976d2;">🎯 视频智能导航 (${results.length}个要点)</h4>
      <p style="margin: 5px 0; color: #666; font-size: 14px;">
        点击时间戳可直接跳转到对应视频位置
      </p>
      <p style="margin: 5px 0; color: #666; font-size: 13px;">定位成功率: ${successCount}/${results.length} (${successRate}%)</p>
    </div>
  `;

  results.forEach((item, index) => {
    const isFound = item.location && item.location.found;

    if (isFound) {
      // 成功定位的TIPS：显示为可点击的时间戳+摘要
      html += `
        <div class="tip-item" style="cursor: pointer; transition: all 0.3s; margin-bottom: 16px; padding: 12px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" data-seconds="${item.location.startSeconds}">
          <div style="display: flex; align-items: flex-start; gap: 15px;">
            <div class="tip-timestamp" data-seconds="${item.location.startSeconds}" style="flex-shrink: 0; font-size: 16px; font-weight: bold; color: #1976d2;">
              ${item.location.startTime}
            </div>
            <div style="flex: 1;">
              <div style="font-size: 15px; line-height: 1.5; color: #333;">
                ${escapeHtml(item.tip)}
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      // 未定位成功的TIPS：显示为普通摘要
      html += `
        <div class="tip-item" style="opacity: 0.7; margin-bottom: 16px; padding: 12px; background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px;">
          <div style="display: flex; align-items: flex-start; gap: 15px;">
            <div style="flex-shrink: 0; font-size: 16px; font-weight: bold; color: #999;">
              --:--
            </div>
            <div style="flex: 1;">
              <div style="font-size: 15px; line-height: 1.5; color: #666;">
                ${escapeHtml(item.tip)}
              </div>
              <div style="font-size: 12px; color: #999; margin-top: 5px;">
                ⚠️ 时间戳定位失败
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });

  // 添加调试模式切换按钮
  html += `
    <div style="margin-top: 20px; text-align: center;">
      <button data-toggle-debug="true" style="background: #fb7299; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 12px; cursor: pointer;">
        🔧 调试模式 (${successRate}% 成功率)
      </button>
    </div>
  `;

  tipsContent.innerHTML = html;
  tipsResult.style.display = 'block';

  // 添加hover效果
  const tipItems = tipsContent.querySelectorAll('.tip-item[data-seconds]');
  tipItems.forEach(item => {
    item.addEventListener('mouseenter', function() {
      this.style.boxShadow = '0 4px 12px rgba(25,118,210,0.15)';
      this.style.borderColor = '#1976d2';
      this.style.transform = 'translateY(-1px)';
    });

    item.addEventListener('mouseleave', function() {
      this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      this.style.borderColor = '#e0e0e0';
      this.style.transform = 'translateY(0)';
    });
  });

  // 🎯 保存时间戳导航到缓存
  if (currentVideoInfo && currentVideoInfo.videoId) {
    const timestampsData = results
      .filter(item => item.location && item.location.found)
      .map(item => ({
        time: item.location.startSeconds,
        title: item.tip.substring(0, 100), // 限制长度
        description: item.tip
      }));

    if (timestampsData.length > 0) {
      VideoCacheManager.updateTimestamps(currentVideoInfo.videoId, timestampsData)
        .then(() => {
          console.log('✅ 时间戳导航已保存到缓存');
        })
        .catch(error => {
          console.error('保存时间戳导航失败:', error);
        });
    }
  }
}

// 解析AI返回的TIPS文本（完全移植B站逻辑）
function parseTipsResponse(response) {
  console.log('解析TIPS响应，原始内容:', response);
  console.log('响应类型:', typeof response);
  console.log('响应长度:', response ? response.length : 'null');

  // 检查响应是否有效
  if (!response || typeof response !== 'string') {
    console.error('无效的AI响应:', response);
    return [];
  }

  // 首先尝试解析JSON格式
  if (response.includes('"tips"') || response.includes('"tip"')) {
    console.log('检测到JSON格式响应，尝试JSON解析...');
    const jsonResult = parseJSONTipsResponse(response);
    if (jsonResult.length > 0) {
      return jsonResult;
    }
  }

  // 检查是否包含预期的文本TIPS格式
  if (!response.includes('TIP') && !response.includes('原文段落')) {
    console.error('AI响应不包含TIPS格式，可能是错误响应:', response.substring(0, 200));
    return [];
  }

  const results = [];
  const lines = response.split('\n');
  let currentTip = '';
  let currentOriginal = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.match(/^TIP\d+:/)) {
      // 保存上一个TIP
      if (currentTip && currentOriginal) {
        results.push({
          tip: currentTip.replace(/^TIP\d+:\s*/, '').trim(),
          originalText: currentOriginal.replace(/^原文段落:\s*/, '').trim(),
          tipNumber: results.length + 1
        });
      }
      currentTip = line;
      currentOriginal = '';
    } else if (line.startsWith('原文段落:')) {
      currentOriginal = line;
    }
  }

  // 保存最后一个TIP
  if (currentTip && currentOriginal) {
    results.push({
      tip: currentTip.replace(/^TIP\d+:\s*/, '').trim(),
      originalText: currentOriginal.replace(/^原文段落:\s*/, '').trim(),
      tipNumber: results.length + 1
    });
  }

  console.log(`成功解析出${results.length}个TIPS`);
  return results;
}

// 解析JSON格式的TIPS响应（完全移植B站逻辑）
function parseJSONTipsResponse(response) {
  console.log('尝试JSON格式解析...');

  try {
    // 尝试直接解析JSON
    let jsonData;
    try {
      jsonData = JSON.parse(response);
    } catch (e) {
      // 尝试提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonData = JSON.parse(jsonMatch[0]);
      } else {
        throw e;
      }
    }

    console.log('JSON解析成功:', jsonData);

    const results = [];

    // 处理不同的JSON结构
    let tipsArray = [];
    if (jsonData.tips && Array.isArray(jsonData.tips)) {
      tipsArray = jsonData.tips;
    } else if (Array.isArray(jsonData)) {
      tipsArray = jsonData;
    } else {
      console.error('JSON格式不符合预期:', jsonData);
      return [];
    }

    tipsArray.forEach((item, index) => {
      if (item.tip && item.original_text) {
        results.push({
          tip: item.tip,
          originalText: item.original_text,
          tipNumber: index + 1
        });
      }
    });

    console.log(`JSON格式解析出${results.length}个TIPS`);
    return results;

  } catch (error) {
    console.error('JSON解析失败:', error);
    console.log('尝试备用解析方法...');
    return parseBackupTipsFormat(response);
  }
}

// 备用解析方法（完全移植B站逻辑）
function parseBackupTipsFormat(response) {
  console.log('使用备用解析方法...');

  const results = [];
  const tipMatches = response.match(/TIP\d*[：:]\s*([^\n]+)/g);
  const originalMatches = response.match(/原文段落[：:]\s*([^\n]+)/g);

  if (tipMatches && originalMatches && tipMatches.length === originalMatches.length) {
    for (let i = 0; i < tipMatches.length; i++) {
      const tip = tipMatches[i].replace(/TIP\d*[：:]\s*/, '').trim();
      const originalText = originalMatches[i].replace(/原文段落[：:]\s*/, '').trim();

      if (tip && originalText) {
        results.push({
          tip: tip,
          originalText: originalText,
          tipNumber: results.length + 1
        });
      }
    }
  }

  // 如果还是没有结果，尝试更宽松的匹配
  if (results.length === 0) {
    const lines = response.split('\n');
    let currentTip = '';
    let currentOriginal = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('TIP') || trimmed.includes('要点')) {
        if (currentTip && currentOriginal) {
          results.push({
            tip: currentTip,
            originalText: currentOriginal,
            tipNumber: results.length + 1
          });
        }
        currentTip = trimmed;
        currentOriginal = '';
      } else if (trimmed.includes('原文') || trimmed.includes('段落') || trimmed.startsWith('[')) {
        currentOriginal = trimmed;
      }
    }

    // 添加最后一个
    if (currentTip && currentOriginal) {
      results.push({
        tip: currentTip,
        originalText: currentOriginal,
        tipNumber: results.length + 1
      });
    }
  }

  console.log(`备用格式解析出${results.length}个TIPS`);
  return results;
}

// 搜索和定位TIPS在字幕中的位置（完全移植B站逻辑）
function searchAndLocateTips(tipsData, subtitleData) {
  console.log('开始搜索定位TIPS...');
  const results = [];

  tipsData.forEach((item, index) => {
    console.log(`处理TIP ${index + 1}: ${item.tip.substring(0, 50)}...`);

    const location = findTipLocation(item.originalText, subtitleData);

    results.push({
      tip: item.tip,
      originalText: item.originalText,
      location: location,
      index: index + 1
    });
  });

  console.log(`搜索定位完成，共处理${results.length}个TIPS`);
  return results;
}

// 在字幕中查找TIP的位置（优化匹配算法 + 短视频优化）
function findTipLocation(originalText, subtitleData) {
  if (!originalText || !subtitleData || subtitleData.length === 0) {
    return { found: false };
  }

  console.log('查找原文段落:', originalText.substring(0, 100));
  console.log(`字幕总数: ${subtitleData.length}句`);

  // 清理原文段落，提取纯文本内容
  const cleanOriginal = originalText
    .replace(/\[[\d:]+\]/g, '') // 移除时间戳
    .replace(/\s+/g, ' ')       // 合并空格
    .trim();

  if (cleanOriginal.length < 5) {
    return { found: false };
  }

  // 🎯 短视频检测：字幕少于30句视为短视频
  const isShortVideo = subtitleData.length < 30;
  if (isShortVideo) {
    console.log('⚠️ 检测到短视频，启用短视频优化策略');
  }

  let bestMatch = { similarity: 0, found: false };

  // 🎯 短视频优化：动态调整窗口大小
  const maxWindowSize = isShortVideo ? Math.min(6, Math.floor(subtitleData.length / 3)) : 8;
  const minThreshold = isShortVideo ? 0.20 : 0.15;
  console.log(`  滑动窗口范围: 1-${maxWindowSize}句，阈值: ${(minThreshold * 100).toFixed(0)}%`);

  // 方法1：滑动窗口搜索
  for (let windowSize = 1; windowSize <= maxWindowSize; windowSize++) {
    for (let i = 0; i <= subtitleData.length - windowSize; i++) {
      const window = subtitleData.slice(i, i + windowSize);
      const windowText = window.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();

      const similarity = calculateTextSimilarity(cleanOriginal, windowText);

      // 🎯 短视频优化：提高阈值
      if (similarity > bestMatch.similarity && similarity > minThreshold) {
        const matchResult = {
          found: true,
          similarity: similarity,
          startIndex: i,
          endIndex: i + windowSize - 1,
          startSeconds: Math.floor(window[0].from),
          endSeconds: Math.ceil(window[window.length - 1].to),
          startTime: formatSecondsToTime(window[0].from),
          endTime: formatSecondsToTime(window[window.length - 1].to),
          sentences: window.map(s => ({
            from: s.from,
            to: s.to,
            content: s.text
          })),
          method: 'sliding_window'
        };

        // 🎯 短视频优化：应用位置惩罚
        const adjustedSimilarity = applyPositionPenalty(matchResult, subtitleData, isShortVideo);
        if (adjustedSimilarity > bestMatch.similarity) {
          bestMatch = { ...matchResult, similarity: adjustedSimilarity };
        }
      }
    }
  }

  // 方法2：关键词匹配（降低阈值）
  if (!bestMatch.found || bestMatch.similarity < 0.3) {
    const keywordMatch = findByKeywords(cleanOriginal, subtitleData);
    if (keywordMatch.found) {
      const adjustedSimilarity = applyPositionPenalty(keywordMatch, subtitleData, isShortVideo);
      if (adjustedSimilarity > bestMatch.similarity) {
        bestMatch = { ...keywordMatch, similarity: adjustedSimilarity };
      }
    }
  }

  // 方法3：部分匹配
  if (!bestMatch.found || bestMatch.similarity < 0.25) {
    const partialMatch = findByPartialMatch(cleanOriginal, subtitleData);
    if (partialMatch.found) {
      const adjustedSimilarity = applyPositionPenalty(partialMatch, subtitleData, isShortVideo);
      if (adjustedSimilarity > bestMatch.similarity) {
        bestMatch = { ...partialMatch, similarity: adjustedSimilarity };
      }
    }
  }

  // 方法4：智能分段匹配（新增，专门处理长文本）
  if (!bestMatch.found || bestMatch.similarity < 0.2) {
    const segmentMatch = findBySegmentMatch(cleanOriginal, subtitleData);
    if (segmentMatch.found) {
      const adjustedSimilarity = applyPositionPenalty(segmentMatch, subtitleData, isShortVideo);
      if (adjustedSimilarity > bestMatch.similarity) {
        bestMatch = { ...segmentMatch, similarity: adjustedSimilarity };
      }
    }
  }

  if (bestMatch.found) {
    console.log(`找到匹配，相似度: ${(bestMatch.similarity * 100).toFixed(1)}%, 方法: ${bestMatch.method}`);

    // 关键词过滤：避免从"说了一半的句子"开始
    const adjustedMatch = avoidMidSentenceStart(bestMatch, subtitleData);
    return adjustedMatch;
  }

  console.log('未找到匹配，原文:', cleanOriginal.substring(0, 50));
  return { found: false };
}

// 🎯 新增：位置惩罚机制（短视频优化）
function applyPositionPenalty(matchResult, subtitleData, isShortVideo) {
  if (!isShortVideo) {
    return matchResult.similarity; // 长视频不需要惩罚
  }

  const totalSentences = subtitleData.length;
  const matchPosition = matchResult.startIndex;
  const positionRatio = matchPosition / totalSentences;

  // 🎯 对视频前30%的位置进行惩罚
  if (positionRatio < 0.3) {
    const penalty = (0.3 - positionRatio) * 0.5; // 最多惩罚15%
    const adjustedSimilarity = matchResult.similarity * (1 - penalty);
    console.log(`  位置惩罚: 位于前${(positionRatio * 100).toFixed(0)}%，惩罚${(penalty * 100).toFixed(1)}%`);
    return adjustedSimilarity;
  }

  return matchResult.similarity;
}

// 关键词过滤：避免从"说了一半的句子"开始
function avoidMidSentenceStart(matchResult, subtitleData) {
  const badStarters = [
    '但是', '可是', '然而', '不过', '只是',
    '所以', '因此', '因为', '由于', '既然',
    '而且', '另外', '此外', '同时',
    '虽然', '尽管', '即使',
    '这个', '那个', '这种', '那种', '这样'
  ];

  let currentIndex = matchResult.startIndex;
  let attempts = 0;

  // 最多向前找3句
  while (attempts < 3 && currentIndex >= 0) {
    const sentence = subtitleData[currentIndex].text.trim();

    // 检查是否以违规词开头
    const hasBadStart = badStarters.some(word =>
      sentence.startsWith(word) || sentence.startsWith(word + '，')
    );

    if (!hasBadStart) {
      // 找到好的起点
      if (currentIndex !== matchResult.startIndex) {
        console.log(`🎯 时间戳调整: 避免中间插话感`);
        console.log(`   原句: "${subtitleData[matchResult.startIndex].text.substring(0, 30)}..."`);
        console.log(`   调整: "${sentence.substring(0, 30)}..."`);

        return {
          ...matchResult,
          startIndex: currentIndex,
          startTime: formatSecondsToTime(subtitleData[currentIndex].from),
          startSeconds: Math.floor(subtitleData[currentIndex].from),
          adjusted: true
        };
      }
      return matchResult; // 原来就是好的起点
    }

    currentIndex--;
    attempts++;
  }

  // 找不到更好的，用原来的
  return matchResult;
}

// 关键词匹配方法（优化版）
function findByKeywords(originalText, subtitleData) {
  // 提取关键词（长度>=2的中文词，>=3的英文词）
  const keywords = originalText.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g) || [];
  if (keywords.length === 0) {
    return { found: false };
  }

  let bestMatch = { similarity: 0, found: false };

  // 在字幕中搜索包含最多关键词的连续片段
  for (let windowSize = 1; windowSize <= 6; windowSize++) {
    for (let i = 0; i <= subtitleData.length - windowSize; i++) {
      const window = subtitleData.slice(i, i + windowSize);
      const windowText = window.map(s => s.text).join(' ');

      let matchCount = 0;
      keywords.forEach(keyword => {
        if (windowText.includes(keyword)) {
          matchCount++;
        }
      });

      const similarity = matchCount / keywords.length;

      // 降低阈值到0.2
      if (similarity > bestMatch.similarity && similarity > 0.2) {
        bestMatch = {
          found: true,
          similarity: similarity,
          startIndex: i,
          endIndex: i + windowSize - 1,
          startSeconds: Math.floor(window[0].from),
          endSeconds: Math.ceil(window[window.length - 1].to),
          startTime: formatSecondsToTime(window[0].from),
          endTime: formatSecondsToTime(window[window.length - 1].to),
          sentences: window.map(s => ({
            from: s.from,
            to: s.to,
            content: s.text
          })),
          method: 'keyword_match'
        };
      }
    }
  }
  return bestMatch;
}

// 部分匹配方法（新增）
function findByPartialMatch(originalText, subtitleData) {
  // 将原文分割成短句，尝试匹配任意一句
  const sentences = originalText.split(/[，。！？；,!?;]/).filter(s => s.trim().length > 3);

  let bestMatch = { similarity: 0, found: false };

  sentences.forEach(sentence => {
    const cleanSentence = sentence.trim();
    if (cleanSentence.length < 4) return;

    // 在字幕中搜索包含这个句子的片段
    for (let windowSize = 1; windowSize <= 4; windowSize++) {
      for (let i = 0; i <= subtitleData.length - windowSize; i++) {
        const window = subtitleData.slice(i, i + windowSize);
        const windowText = window.map(s => s.text).join(' ');

        // 计算包含度
        const similarity = windowText.includes(cleanSentence) ? 0.8 :
                          calculateTextSimilarity(cleanSentence, windowText);

        if (similarity > bestMatch.similarity && similarity > 0.15) {
          bestMatch = {
            found: true,
            similarity: similarity,
            startIndex: i,
            endIndex: i + windowSize - 1,
            startSeconds: Math.floor(window[0].from),
            endSeconds: Math.ceil(window[window.length - 1].to),
            startTime: formatSecondsToTime(window[0].from),
            endTime: formatSecondsToTime(window[window.length - 1].to),
            sentences: window.map(s => ({
              from: s.from,
              to: s.to,
              content: s.text
            })),
            method: 'partial_match'
          };
        }
      }
    }
  });

  return bestMatch;
}

// 智能分段匹配方法（新增，专门处理长文本和多主题内容）
function findBySegmentMatch(originalText, subtitleData) {
  // 提取原文中的核心概念和关键短语
  const coreTerms = extractCoreTerms(originalText);
  if (coreTerms.length === 0) {
    return { found: false };
  }

  let bestMatch = { similarity: 0, found: false };
  const matchResults = [];

  // 为每个核心概念在字幕中找到最佳匹配位置
  coreTerms.forEach(term => {
    for (let windowSize = 1; windowSize <= 5; windowSize++) {
      for (let i = 0; i <= subtitleData.length - windowSize; i++) {
        const window = subtitleData.slice(i, i + windowSize);
        const windowText = window.map(s => s.text).join(' ');

        // 检查是否包含核心概念
        if (windowText.includes(term) || calculateTextSimilarity(term, windowText) > 0.3) {
          matchResults.push({
            term: term,
            position: i,
            windowSize: windowSize,
            window: window,
            score: windowText.includes(term) ? 1.0 : calculateTextSimilarity(term, windowText)
          });
        }
      }
    }
  });

  // 如果找到匹配，选择得分最高的位置
  if (matchResults.length > 0) {
    const bestResult = matchResults.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    bestMatch = {
      found: true,
      similarity: bestResult.score * 0.8, // 稍微降低权重，因为这是备用方法
      startIndex: bestResult.position,
      endIndex: bestResult.position + bestResult.windowSize - 1,
      startSeconds: Math.floor(bestResult.window[0].from),
      endSeconds: Math.ceil(bestResult.window[bestResult.window.length - 1].to),
      startTime: formatSecondsToTime(bestResult.window[0].from),
      endTime: formatSecondsToTime(bestResult.window[bestResult.window.length - 1].to),
      sentences: bestResult.window.map(s => ({
        from: s.from,
        to: s.to,
        content: s.text
      })),
      method: 'segment_match',
      matchedTerm: bestResult.term
    };
  }

  return bestMatch;
}

// 提取核心概念和关键短语
function extractCoreTerms(text) {
  const terms = [];

  // 提取专业术语和重要概念（3-8字的中文词组）
  const chineseTerms = text.match(/[\u4e00-\u9fa5]{3,8}/g) || [];
  terms.push(...chineseTerms);

  // 提取英文术语
  const englishTerms = text.match(/[A-Z][a-zA-Z]{2,}/g) || [];
  terms.push(...englishTerms);

  // 提取数字相关的表述
  const numberTerms = text.match(/\d+[^\s]*[\u4e00-\u9fa5]+/g) || [];
  terms.push(...numberTerms);

  // 去重并按长度排序（优先匹配长词组）
  const uniqueTerms = [...new Set(terms)];
  return uniqueTerms.sort((a, b) => b.length - a.length).slice(0, 10); // 最多取10个核心概念
}

// 计算文本相似度（增强版）
function calculateTextSimilarity(text1, text2) {
  // 对中文文本进行字符级别的比较
  const chars1 = text1.replace(/\s+/g, '').split('');
  const chars2 = text2.replace(/\s+/g, '').split('');

  // 计算字符级别的相似度
  const set1 = new Set(chars1);
  const set2 = new Set(chars2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  const charSimilarity = union.size > 0 ? intersection.size / union.size : 0;

  // 计算子串匹配度（2-4字符）
  let substringMatches = 0;
  let totalSubstrings = 0;
  for (let len = 2; len <= 4; len++) {
    for (let i = 0; i <= text1.length - len; i++) {
      const substring = text1.substring(i, i + len);
      totalSubstrings++;
      if (text2.includes(substring)) {
        substringMatches++;
      }
    }
  }

  const substringSimilarity = totalSubstrings > 0 ? substringMatches / totalSubstrings : 0;

  // 计算关键词匹配度
  const keywords1 = text1.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g) || [];
  const keywords2 = text2.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g) || [];

  let keywordMatches = 0;
  keywords1.forEach(keyword => {
    if (keywords2.some(k => k.includes(keyword) || keyword.includes(k))) {
      keywordMatches++;
    }
  });

  const keywordSimilarity = keywords1.length > 0 ? keywordMatches / keywords1.length : 0;

  // 综合相似度（字符30% + 子串40% + 关键词30%）
  return (charSimilarity * 0.3 + substringSimilarity * 0.4 + keywordSimilarity * 0.3);
}

// 格式化秒数为时间戳（完全移植B站逻辑）
function formatSecondsToTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// ========== YouTube跳转功能 ==========
// 全局点击委托：时间戳跳转
document.addEventListener('click', function(event) {
  const t = event.target;
  const baseEl = (t && t.nodeType === 1) ? t : (t && t.parentElement ? t.parentElement : null);
  if (!baseEl) return;

  // 时间戳点击跳转（基于 data-seconds）
  const hit = baseEl.closest('.tip-timestamp, .tip-item[data-seconds]');
  if (!hit) return;

  let carrier = hit;
  if (!carrier.hasAttribute('data-seconds')) {
    carrier = hit.closest('.tip-item[data-seconds]');
  }
  const secondsAttr = carrier && carrier.getAttribute('data-seconds');
  const seconds = secondsAttr ? parseInt(secondsAttr, 10) : NaN;

  if (Number.isFinite(seconds)) {
    console.log('🎯 YouTube时间戳点击:', seconds, '秒');
    jumpToYouTubeTime(seconds);
    event.preventDefault();
    event.stopPropagation();
  }
});

// YouTube跳转函数（温和方式，避免触发风控）
function jumpToYouTubeTime(seconds) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const activeTab = tabs && tabs[0];

    const sendToTab = (tab) => {
      if (!tab) {
        console.error('未找到YouTube视频标签页');
        alert(`🎯 跳转到 ${formatTime(seconds)}\n\n未找到YouTube视频页面，请切到含有视频的YouTube标签页再试`);
        return;
      }
      console.log('发送JUMP_TO_TIME消息到YouTube标签页:', tab.id, tab.url);
      chrome.tabs.sendMessage(tab.id, { type: 'JUMP_TO_TIME', seconds }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('YouTube视频跳转失败:', chrome.runtime.lastError.message);
          alert(`🎯 跳转到 ${formatTime(seconds)}\n\n请手动拖拽进度条到此时间点`);
        } else if (response && response.success) {
          console.log('✅ YouTube视频跳转成功');
        } else {
          console.log('⚠️ YouTube视频跳转可能失败');
          alert(`🎯 跳转到 ${formatTime(seconds)}\n\n如果没有自动跳转，请手动拖拽进度条到此时间点`);
        }
      });
    };

    // 优先使用当前窗口的活动标签（如果是YouTube视频页）
    if (activeTab && activeTab.url && /youtube\.com\/watch/.test(activeTab.url)) {
      sendToTab(activeTab);
      return;
    }

    // 回退：在所有窗口中查找YouTube视频页
    chrome.tabs.query({ url: ["*://*.youtube.com/*"] }, function(allTabs) {
      const candidate = allTabs.find(t => t.active && /youtube\.com\/watch/.test(t.url))
        || allTabs.find(t => /youtube\.com\/watch/.test(t.url));
      sendToTab(candidate || null);
    });
  });
}

// 初始化
initialize();
