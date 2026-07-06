// Popup JavaScript - Clean version for subtitle functionality

// ========== 视频缓存管理模块 ==========
const VideoCacheManager = {
  CACHE_PREFIX: 'bilibili_video_cache_',
  METADATA_KEY: 'bilibili_cache_metadata',

  // 检查是否有缓存
  async hasCache(bvid) {
    try {
      const key = this.CACHE_PREFIX + bvid;
      const result = await chrome.storage.local.get(key);
      return !!result[key];
    } catch (error) {
      console.error('检查缓存失败:', error);
      return false;
    }
  },

  // 获取缓存
  async getCache(bvid) {
    try {
      const key = this.CACHE_PREFIX + bvid;
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      console.error('获取缓存失败:', error);
      return null;
    }
  },

  // 保存完整缓存
  async saveCache(bvid, data) {
    try {
      const key = this.CACHE_PREFIX + bvid;
      const cacheData = {
        bvid: bvid,
        title: data.title || '',
        timestamp: Date.now(),
        subtitle: data.subtitle || null,
        aiSummary: data.aiSummary || null,
        timestamps: data.timestamps || null
      };

      await chrome.storage.local.set({ [key]: cacheData });
      await this.updateMetadata();
      console.log('✅ 缓存已保存:', bvid);
      return true;
    } catch (error) {
      console.error('保存缓存失败:', error);
      return false;
    }
  },

  // 更新AI总结
  async updateAISummary(bvid, summary) {
    try {
      const cache = await this.getCache(bvid);
      if (cache) {
        cache.aiSummary = summary;
        cache.timestamp = Date.now();
        const key = this.CACHE_PREFIX + bvid;
        await chrome.storage.local.set({ [key]: cache });
        console.log('✅ AI总结已更新到缓存');
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新AI总结失败:', error);
      return false;
    }
  },

  // 更新时间戳导航
  async updateTimestamps(bvid, timestamps) {
    try {
      const cache = await this.getCache(bvid);
      if (cache) {
        cache.timestamps = timestamps;
        cache.timestamp = Date.now();
        const key = this.CACHE_PREFIX + bvid;
        await chrome.storage.local.set({ [key]: cache });
        console.log('✅ 时间戳导航已更新到缓存');
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新时间戳导航失败:', error);
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
      }

      await chrome.storage.local.remove(this.METADATA_KEY);
      console.log('✅ 已清空所有缓存，共', cacheKeys.length, '个视频');
      return cacheKeys.length;
    } catch (error) {
      console.error('清空缓存失败:', error);
      return 0;
    }
  },

  // 获取缓存统计
  async getCacheStats() {
    try {
      const allData = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(allData).filter(key => key.startsWith(this.CACHE_PREFIX));

      let totalSize = 0;
      cacheKeys.forEach(key => {
        const dataStr = JSON.stringify(allData[key]);
        totalSize += dataStr.length;
      });

      return {
        totalVideos: cacheKeys.length,
        totalSize: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
      };
    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return { totalVideos: 0, totalSize: 0, totalSizeMB: '0.00' };
    }
  },

  // 更新元数据
  async updateMetadata() {
    try {
      const stats = await this.getCacheStats();
      await chrome.storage.local.set({
        [this.METADATA_KEY]: {
          totalVideos: stats.totalVideos,
          totalSize: stats.totalSize,
          lastUpdate: Date.now()
        }
      });
    } catch (error) {
      console.error('更新元数据失败:', error);
    }
  }
};

// 跳转到指定时间（视频播放控制）- 简化版
function jumpToTime(seconds) {
  console.log('🎯 Popup: jumpToTime被调用，时间:', seconds, '秒');

  // 发送消息给content script来控制视频播放
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const activeTab = tabs && tabs[0];

    // 统一的发送函数
    const sendToTab = (tab) => {
      if (!tab) {
        console.error('未找到B站视频标签页');
        alert(`🎯 跳转到 ${formatSecondsToTime(seconds)}\n\n未找到B站视频页面，请切到含有视频的B站标签页再试`);
        return;
      }
      console.log('发送JUMP_TO_TIME消息到标签页:', tab.id, tab.url);
      chrome.tabs.sendMessage(tab.id, { type: 'JUMP_TO_TIME', seconds }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('视频跳转失败:', chrome.runtime.lastError.message);
          alert(`🎯 跳转到 ${formatSecondsToTime(seconds)}\n\n请手动拖拽进度条到此时间点`);
        } else if (response && response.success) {
          console.log('✅ 视频跳转成功');
        } else {
          console.log('⚠️ 视频跳转可能失败');
          alert(`🎯 跳转到 ${formatSecondsToTime(seconds)}\n\n如果没有自动跳转，请手动拖拽进度条到此时间点`);
        }
      });
    };

    // 优先使用当前窗口的活动标签（sidePanel 场景）
    if (activeTab && activeTab.url && /bilibili\.com\/video\//.test(activeTab.url)) {
      sendToTab(activeTab);
      return;
    }

    // 回退：在所有窗口中查找 B站视频页
    chrome.tabs.query({ url: ["*://*.bilibili.com/*"] }, function(allTabs) {
      const candidate = allTabs.find(t => t.active && /bilibili\.com\/video\//.test(t.url))
        || allTabs.find(t => /bilibili\.com\/video\//.test(t.url));
      sendToTab(candidate || null);
    });
  });
}

// 确保函数在全局作用域可用
window.jumpToTime = jumpToTime;

// 更新缓存统计信息
async function updateCacheStats() {
  try {
    const stats = await VideoCacheManager.getCacheStats();
    const cacheCount = document.getElementById('cache-count');
    const cacheSize = document.getElementById('cache-size');

    if (cacheCount) cacheCount.textContent = stats.totalVideos;
    if (cacheSize) cacheSize.textContent = stats.totalSizeMB;

    console.log('缓存统计已更新:', stats);
  } catch (error) {
    console.error('更新缓存统计失败:', error);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // 加载缓存统计
  updateCacheStats();
  // Tab switching functionality
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all tabs
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      // Add active class to clicked tab
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
    });
  });

  // 右上角齿轮 => 打开设置页
  const settingsGearBtn = document.getElementById('settings-gear-btn');
  if (settingsGearBtn) {
    settingsGearBtn.addEventListener('click', () => {
      // 激活 settings tab
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById('settings-tab').classList.add('active');
    });
  }

  // Get page elements
  const pageInfo = document.getElementById('page-info');
  const videoTitle = document.getElementById('video-title');
  const subtitleDownloadBtn = document.getElementById('subtitle-download-btn');
  const aiSummaryBtn = document.getElementById('ai-summary-btn');
  const subtitleStatus = document.getElementById('subtitle-status');
  
  // Check current page and get video info
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    if (currentTab.url && currentTab.url.includes('bilibili.com/video/')) {
      pageInfo.textContent = '✅ B站视频页面';
      videoTitle.textContent = currentTab.title || '获取标题中...';
      
      // Enable subtitle download button
      if (subtitleDownloadBtn) {
        subtitleDownloadBtn.disabled = false;
      }
      
      // Load subtitle list for subtitle tab
      loadSubtitleList(currentTab.url);

      // Check subtitles for AI summary
      checkSubtitlesForSummary(currentTab.url);

      // Check subtitles for TIPS generation
      checkSubtitlesForTips(currentTab.url);
    } else {
      pageInfo.textContent = '❌ 请访问B站视频页面';
      videoTitle.textContent = '请在B站视频页面使用此扩展';

      // Disable buttons
      if (subtitleDownloadBtn) {
        subtitleDownloadBtn.disabled = true;
      }
      if (aiSummaryBtn) {
        aiSummaryBtn.disabled = true;
      }

      // Update subtitle status
      if (subtitleStatus) {
        subtitleStatus.textContent = '❌ 请访问B站视频页面';
        subtitleStatus.style.background = '#fee';
        subtitleStatus.style.color = '#c53030';
      }
    }
  });
  
  // Subtitle download handler
  if (subtitleDownloadBtn) {
    subtitleDownloadBtn.addEventListener('click', function() {
      downloadSubtitle();
    });
  }

  // AI summary handler
  if (aiSummaryBtn) {
    aiSummaryBtn.addEventListener('click', function() {
      generateAISummary();
    });
  }

  // Generate answer handler
  const generateAnswerBtn = document.getElementById('generate-answer-btn');
  if (generateAnswerBtn) {
    generateAnswerBtn.addEventListener('click', function() {
      generateFollowUpAnswer();
    });
  }

  // Generate TIPS handler
  const generateTipsBtn = document.getElementById('generate-tips-btn');
  if (generateTipsBtn) {
    generateTipsBtn.addEventListener('click', function() {
      generateVideoTips();
    });
  }

  // Save settings handler
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', function() {
      saveSettings();
    });
  }

  // Clear cache handler
  const clearCacheBtn = document.getElementById('clear-cache-btn');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', async function() {
      const confirmMsg = '确定要清空所有视频缓存吗？\n\n这将删除：\n- 所有缓存的字幕\n- 所有AI分析结果\n- 所有时间戳导航\n\n此操作不可撤销！';

      if (!confirm(confirmMsg)) {
        return;
      }

      try {
        const count = await VideoCacheManager.clearAllCache();
        alert(`✅ 已清空 ${count} 个视频的缓存`);
        await updateCacheStats();
      } catch (error) {
        console.error('清空缓存失败:', error);
        alert('❌ 清空缓存失败: ' + error.message);
      }
    });
  }

  // Audio download handler
  const audioDownloadBtn = document.getElementById('audio-download-btn');
  if (audioDownloadBtn) {
    audioDownloadBtn.addEventListener('click', function() {
      downloadAudio();
    });
  }

  // Load settings on startup
  loadSettings();

  // Initialize font size settings
  initializeFontSizeSettings();

  // 全局点击委托：时间戳和调试模式按钮
  document.addEventListener('click', function(event) {
    const t = event.target;
    const baseEl = (t && t.nodeType === 1) ? t : (t && t.parentElement ? t.parentElement : null); // 兼容 Text 节点
    if (!baseEl) return;

    // 1) 调试模式按钮（替代内联 onclick）
    const debugBtn = baseEl.closest('[data-toggle-debug]');
    if (debugBtn) {
      if (typeof toggleDebugMode === 'function') {
        toggleDebugMode();
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // 2) 时间戳点击（基于 data-seconds）
    const hit = baseEl.closest('.tip-timestamp, .tip-item[data-seconds]');
    if (!hit) return;

    // 优先使用带有 data-seconds 的元素；若命中的是 .tip-timestamp（无 data-seconds），则回退到父级 .tip-item[data-seconds]
    let carrier = hit;
    if (!carrier.hasAttribute('data-seconds')) {
      carrier = hit.closest('.tip-item[data-seconds]');
    }
    const secondsAttr = carrier && carrier.getAttribute('data-seconds');
    const seconds = secondsAttr ? parseInt(secondsAttr, 10) : NaN;

    if (Number.isFinite(seconds)) {
      console.log('🎯 事件委托捕获到时间戳点击:', seconds, '秒');
      jumpToTime(seconds);
      event.preventDefault();
      event.stopPropagation();
    }
  });

  // Add event listener for AI provider change
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

  // 确保jumpToTime函数在全局作用域可用
  window.jumpToTime = jumpToTime;
  console.log('✅ Popup: jumpToTime函数已暴露到全局作用域');
});

// Update default values when AI provider changes
function updateDefaultValues(aiProvider) {
  const config = getDefaultConfig(aiProvider);

  const apiBaseUrl = document.getElementById('api-base-url');
  const apiKey = document.getElementById('api-key');
  const modelId = document.getElementById('model-id');

  // 只在字段为空时填入默认值
  if (apiBaseUrl) {
    if (!apiBaseUrl.value) {
      apiBaseUrl.value = config.baseUrl;
    }
    apiBaseUrl.placeholder = config.baseUrl;
  }

  // 更新API Key的提示文本，但不清空已有值
  if (apiKey) {
    if (aiProvider === 'gemini') {
      apiKey.placeholder = '请输入Google Gemini API密钥';
    } else if (aiProvider === 'siliconflow') {
      apiKey.placeholder = '请输入硅基流动API密钥';
    }
  }

  // 只在字段为空时填入默认模型ID
  if (modelId) {
    if (!modelId.value) {
      modelId.value = config.model;
    }
    if (aiProvider === 'gemini') {
      modelId.placeholder = '如: gemini-2.5-flash, gemini-2.5-pro';
    } else if (aiProvider === 'siliconflow') {
      modelId.placeholder = '如: deepseek-ai/DeepSeek-V3, Qwen/Qwen2.5-72B-Instruct-128K';
    }
  }
}

// Load available subtitles
function loadSubtitleList(videoUrl) {
  const subtitleList = document.getElementById('subtitle-list');
  if (!subtitleList) return;
  
  // Extract BVID from URL - 支持多种URL格式
  console.log('字幕列表 - 当前页面URL:', videoUrl);
  let match = videoUrl.match(/\/video\/(BV[a-zA-Z0-9]+)/);

  // 如果标准格式匹配失败，尝试从URL参数中获取
  if (!match) {
    const urlParams = new URLSearchParams(new URL(videoUrl).search);
    const bvidFromParam = urlParams.get('bvid');
    if (bvidFromParam && bvidFromParam.startsWith('BV')) {
      match = [null, bvidFromParam];
    }
  }

  // 如果还是没有匹配，尝试更宽松的匹配
  if (!match) {
    match = videoUrl.match(/(BV[a-zA-Z0-9]+)/);
  }

  if (!match) {
    console.error('字幕列表 - 无法从URL中提取BVID:', videoUrl);
    subtitleList.innerHTML = '<p style="color: #999; text-align: center;">无法获取视频ID</p>';
    return;
  }

  const bvid = match[1];
  console.log('字幕列表 - 提取到的BVID:', bvid);
  
  // Show loading
  subtitleList.innerHTML = '<p style="color: #666; text-align: center;">🔄 正在获取字幕...</p>';
  
  // Send message to content script to get subtitle info
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    console.log('Popup: 发送字幕获取请求，BVID:', bvid, '标签页ID:', tabs[0].id);

    // 定义响应处理函数
    function handleSubtitleResponse(response) {
      console.log('Popup: 收到字幕响应:', response);
      console.log('Popup: Runtime错误:', chrome.runtime.lastError);

      if (chrome.runtime.lastError) {
        console.error('Popup: 消息发送失败:', chrome.runtime.lastError.message);

        // 如果是连接错误，尝试重新注入content script
        if (chrome.runtime.lastError.message.includes('Could not establish connection')) {
          console.log('Popup: 尝试重新注入content script');
          subtitleList.innerHTML = '<p style="color: #666; text-align: center;">🔄 重新连接中...</p>';

          // 重新注入content script
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['bilibili/content.js']
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('Popup: 注入content script失败:', chrome.runtime.lastError.message);
              subtitleList.innerHTML = '<p style="color: #f56565; text-align: center;">❌ 注入脚本失败</p>';
              return;
            }

            // 等待一下再重试
            setTimeout(() => {
              console.log('Popup: 重新发送字幕获取请求');
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'GET_SUBTITLE_INFO',
                bvid: bvid
              }, handleSubtitleResponse);
            }, 1000);
          });
          return;
        }

        subtitleList.innerHTML = '<p style="color: #f56565; text-align: center;">❌ 获取字幕失败: ' + chrome.runtime.lastError.message + '</p>';
        return;
      }
      
      if (response && response.subtitles && response.subtitles.length > 0) {
        let html = '<h5 style="margin: 0 0 10px 0; color: #333;">可用字幕：</h5>';
        response.subtitles.forEach((subtitle, index) => {
          html += `
            <div class="quality-option">
              <input type="radio" name="subtitle-lang" value="${subtitle.subtitle_url}" data-lang="${subtitle.lan}" id="sub-${index}" ${index === 0 ? 'checked' : ''}>
              <label for="sub-${index}">${subtitle.lan_doc}</label>
            </div>
          `;
        });
        subtitleList.innerHTML = html;
      } else {
        subtitleList.innerHTML = '<p style="color: #999; text-align: center;">😔 该视频暂无字幕</p>';
      }
    }

    // 发送消息
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'GET_SUBTITLE_INFO',
      bvid: bvid
    }, handleSubtitleResponse);
  });
}

// Download subtitle function
function downloadSubtitle() {
  const selectedSubtitle = document.querySelector('input[name="subtitle-lang"]:checked');
  if (!selectedSubtitle) {
    alert('请先选择字幕语言');
    return;
  }

  // 获取选择的格式
  const selectedFormat = document.querySelector('input[name="subtitle-format"]:checked');
  if (!selectedFormat) {
    alert('请先选择字幕格式');
    return;
  }

  const subtitleUrl = selectedSubtitle.value;
  const lang = selectedSubtitle.dataset.lang;
  const format = selectedFormat.value;
  
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const title = currentTab.title.replace(/[<>:"/\\|?*]/g, '_');
    
    // Show progress
    const btn = document.getElementById('subtitle-download-btn');
    const originalText = btn.textContent;
    btn.textContent = '🔄 下载中...';
    btn.disabled = true;
    
    // Get subtitle content
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'DOWNLOAD_SUBTITLE_CONTENT',
      url: subtitleUrl
    }, function(response) {
      btn.textContent = originalText;
      btn.disabled = false;
      
      if (chrome.runtime.lastError || !response || response.error) {
        alert('下载失败：' + (response?.error || chrome.runtime.lastError?.message || '未知错误'));
        return;
      }
      
      if (response.content && response.content.length > 0) {
        let content, filename, extension;

        // 根据选择的格式转换字幕
        switch (format) {
          case 'srt':
            content = convertToSRT(response.content);
            extension = 'srt';
            break;
          case 'ass':
            content = convertToASS(response.content, title);
            extension = 'ass';
            break;
          case 'txt':
            content = convertToTXT(response.content);
            extension = 'txt';
            break;
          default:
            content = convertToSRT(response.content);
            extension = 'srt';
        }

        // 生成文件名
        filename = `${title}_${lang}.${extension}`;

        // Download file
        downloadFile(filename, content);

        alert(`字幕下载完成！\n格式：${format.toUpperCase()}\n语言：${lang}\n条目：${response.content.length} 条`);
      } else {
        alert('字幕内容为空');
      }
    });
  });
}

// Convert subtitle data to SRT format
function convertToSRT(subtitleData) {
  let srtContent = '';
  
  subtitleData.forEach((item, index) => {
    const startTime = formatTime(item.from);
    const endTime = formatTime(item.to);
    
    srtContent += `${index + 1}\n`;
    srtContent += `${startTime} --> ${endTime}\n`;
    srtContent += `${item.content}\n\n`;
  });
  
  return srtContent;
}

// Format time for SRT (seconds to HH:MM:SS,mmm)
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// Convert subtitle data to TXT format (演讲稿样式)
function convertToTXT(subtitleData) {
  let txtContent = '';
  let lastContent = '';

  subtitleData.forEach((item) => {
    const content = item.content.trim();

    // 跳过空内容
    if (!content) return;

    // 避免重复内容（有时字幕会有重复）
    if (content === lastContent) return;

    // 添加内容，自动换行
    txtContent += content;

    // 如果内容不以标点符号结尾，添加空格用于连接
    if (!/[。！？；，、：""''）】》〉]$/.test(content)) {
      txtContent += ' ';
    } else {
      // 如果以标点符号结尾，换行
      txtContent += '\n';
    }

    lastContent = content;
  });

  // 清理多余的空格和换行
  txtContent = txtContent
    .replace(/\s+/g, ' ')  // 多个空格合并为一个
    .replace(/\s*\n\s*/g, '\n')  // 清理换行周围的空格
    .replace(/\n+/g, '\n\n')  // 多个换行合并为两个（段落分隔）
    .trim();

  return txtContent;
}

// Convert subtitle data to ASS format
function convertToASS(subtitleData, title) {
  let assContent = `[Script Info]
Title: ${title}
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  subtitleData.forEach((item) => {
    const startTime = formatTimeASS(item.from);
    const endTime = formatTimeASS(item.to);

    assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${item.content}\n`;
  });

  return assContent;
}

// Format time for ASS (seconds to H:MM:SS.cc)
function formatTimeASS(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);

  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

// Download file
function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
}

// Check subtitles for AI summary
async function checkSubtitlesForSummary(videoUrl, retryCount = 0) {
  const subtitleStatus = document.getElementById('subtitle-status');
  const aiSummaryBtn = document.getElementById('ai-summary-btn');
  const summaryResult = document.getElementById('summary-result');
  const summaryContent = document.getElementById('summary-content');

  if (!subtitleStatus || !aiSummaryBtn) return;

  // Extract BVID from URL
  const match = videoUrl.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  if (!match) {
    subtitleStatus.textContent = '❌ 无法获取视频ID';
    subtitleStatus.style.background = '#fee';
    subtitleStatus.style.color = '#c53030';
    return;
  }

  const bvid = match[1];

  // 🎯 重要：保存 BVID 供后续缓存更新使用
  window.currentBVID = bvid;

  // 🎯 检查缓存
  const cache = await VideoCacheManager.getCache(bvid);
  if (cache && cache.subtitle) {
    console.log('✅ 找到缓存的字幕:', bvid);

    // 显示缓存状态
    const cacheDate = new Date(cache.timestamp).toLocaleString('zh-CN');
    subtitleStatus.innerHTML = `✅ 已加载缓存字幕<br><span style="font-size: 11px; color: #666;">缓存时间: ${cacheDate}</span>`;
    subtitleStatus.style.background = '#e3f2fd';
    subtitleStatus.style.color = '#1976d2';
    aiSummaryBtn.disabled = false;

    // 存储字幕供后续使用（同时存储到两个变量，确保两个标签页都能使用）
    const cachedSubtitle = {
      lan: cache.subtitle.language || 'zh-CN',
      lan_doc: cache.subtitle.language || '中文',
      subtitle_url: 'cached',
      cached: true,
      cachedData: cache.subtitle.content
    };
    window.availableSubtitles = [cachedSubtitle];
    window.availableSubtitlesForTips = [cachedSubtitle];

    // 🎯 重要：设置字幕文本供"生成答案"按钮使用
    // 这样即使从缓存恢复，用户也可以直接使用"继续提问"功能
    if (cache.subtitle.content && Array.isArray(cache.subtitle.content)) {
      const subtitleText = cache.subtitle.content.map(item => item.content).join('\n');
      window.currentSubtitleText = subtitleText;
      console.log('✅ 已设置字幕文本供继续提问使用，长度:', subtitleText.length);
    }

    // 🎯 如果有缓存的AI总结，自动显示
    if (cache.aiSummary && summaryResult && summaryContent) {
      // 直接使用缓存的HTML内容（已经包含格式化和所有问答）
      summaryContent.innerHTML = cache.aiSummary;
      summaryResult.style.display = 'block';
      console.log('✅ 已显示缓存的AI总结（包含所有问答）');
    }

    // 🎯 如果有缓存的时间戳导航，也自动显示
    if (cache.timestamps && cache.timestamps.length > 0) {
      const tipsResult = document.getElementById('tips-result');
      const tipsContent = document.getElementById('tips-content');
      if (tipsResult && tipsContent) {
        displayCachedTimestamps(cache.timestamps, tipsContent, tipsResult);
        console.log('✅ 已显示缓存的时间戳导航');
      }
    }

    return;
  }

  // 显示检测中状态
  subtitleStatus.textContent = '🔄 检测字幕中...';
  subtitleStatus.style.background = '#f0f0f0';
  subtitleStatus.style.color = '#666';

  // Check if subtitles are available
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'GET_SUBTITLE_INFO',
      bvid: bvid
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.log('字幕检测失败，错误:', chrome.runtime.lastError.message);

        // 如果是第一次尝试且错误是content script未准备好，则重试
        if (retryCount < 3 && chrome.runtime.lastError.message.includes('Could not establish connection')) {
          console.log(`Content script未准备好，${1000 * (retryCount + 1)}ms后重试...`);
          setTimeout(() => {
            checkSubtitlesForSummary(videoUrl, retryCount + 1);
          }, 1000 * (retryCount + 1));
          return;
        }

        subtitleStatus.textContent = '❌ 字幕检测失败';
        subtitleStatus.style.background = '#fee';
        subtitleStatus.style.color = '#c53030';
        return;
      }

      if (response && response.subtitles && response.subtitles.length > 0) {
        subtitleStatus.textContent = `✅ 检测到 ${response.subtitles.length} 个字幕`;
        subtitleStatus.style.background = '#e8f5e8';
        subtitleStatus.style.color = '#2d5a2d';
        aiSummaryBtn.disabled = false;

        // Store subtitles for later use
        window.availableSubtitles = response.subtitles;
        console.log('字幕检测成功，找到', response.subtitles.length, '个字幕');
      } else {
        subtitleStatus.textContent = '😔 该视频暂无字幕';
        subtitleStatus.style.background = '#fff3cd';
        subtitleStatus.style.color = '#856404';
        aiSummaryBtn.disabled = true;
        console.log('字幕检测完成，但未找到字幕');
      }
    });
  });
}

// Generate AI summary using Gemini
function generateAISummary() {
  const aiSummaryBtn = document.getElementById('ai-summary-btn');
  const summaryResult = document.getElementById('summary-result');
  const summaryContent = document.getElementById('summary-content');

  if (!window.availableSubtitles || window.availableSubtitles.length === 0) {
    alert('没有可用的字幕进行总结');
    return;
  }

  // Show loading state
  aiSummaryBtn.textContent = '🔄 生成中...';
  aiSummaryBtn.disabled = true;

  // 直接使用已有的字幕进行总结（和Gemini一样的逻辑）
  console.log('使用已有字幕进行AI总结，字幕数量:', window.availableSubtitles.length);

  const subtitle = window.availableSubtitles[0];
  console.log('使用字幕:', subtitle);

  // 获取当前页面标题和BVID
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const videoTitle = currentTab.title || '未知视频';
    const bvidMatch = currentTab.url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
    const bvid = bvidMatch ? bvidMatch[1] : null;

    // 🎯 检查是否是缓存的字幕
    if (subtitle.cached && subtitle.cachedData) {
      console.log('使用缓存的字幕内容');
      const subtitleText = subtitle.cachedData.map(item => item.content).join('\n');
      window.currentSubtitleText = subtitleText;
      callAIAPI(subtitleText, videoTitle, bvid);
      return;
    }

    // 下载字幕内容
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'DOWNLOAD_SUBTITLE_CONTENT',
      url: subtitle.subtitle_url
    }, async function(response) {
      if (chrome.runtime.lastError || !response || response.error) {
        aiSummaryBtn.textContent = '✨ 生成AI总结';
        aiSummaryBtn.disabled = false;
        alert('获取字幕内容失败：' + (response?.error || chrome.runtime.lastError?.message || '未知错误'));
        return;
      }

      if (response.content && response.content.length > 0) {
        // Convert subtitle to text
        const subtitleText = response.content.map(item => item.content).join('\n');
        console.log('字幕文本长度:', subtitleText.length);

        if (subtitleText.trim().length === 0) {
          aiSummaryBtn.textContent = '✨ 生成AI总结';
          aiSummaryBtn.disabled = false;
          alert('字幕文本为空');
          return;
        }

        // 保存字幕文本供后续提问使用
        window.currentSubtitleText = subtitleText;

        // 🎯 保存字幕到缓存
        if (bvid) {
          await VideoCacheManager.saveCache(bvid, {
            title: videoTitle,
            subtitle: {
              content: response.content,
              language: subtitle.lan || 'zh-CN',
              source: 'bilibili-api'
            }
          });
          console.log('✅ 字幕已保存到缓存');
        }

        // Call AI API based on selected provider
        callAIAPI(subtitleText, videoTitle, bvid);
      } else {
        aiSummaryBtn.textContent = '✨ 生成AI总结';
        aiSummaryBtn.disabled = false;
        alert('字幕内容为空');
      }
    });
  });
}

// Generate follow-up answer
function generateFollowUpAnswer() {
  const generateAnswerBtn = document.getElementById('generate-answer-btn');
  const followUpQuestion = document.getElementById('follow-up-question');
  const summaryContent = document.getElementById('summary-content');

  const question = followUpQuestion.value.trim();
  if (!question) {
    alert('请输入您的问题');
    return;
  }

  if (!window.currentSubtitleText) {
    alert('没有可用的字幕内容，请先生成总结');
    return;
  }

  // Show loading state
  const originalText = generateAnswerBtn.textContent;
  generateAnswerBtn.textContent = '🔄 生成中...';
  generateAnswerBtn.disabled = true;

  // 获取当前页面标题
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const videoTitle = currentTab.title || '未知视频';

    // 构建包含问题的prompt
    const prompt = `基于以下视频字幕内容回答问题：

视频标题：${videoTitle}

字幕内容：
${window.currentSubtitleText}

用户问题：${question}

请基于字幕内容回答用户的问题，如果字幕中没有相关信息，请说明无法从字幕中找到相关内容。回答要简洁明了，控制在200字以内。`;

    // Call AI API
    callAIAPIForAnswer(prompt, generateAnswerBtn, summaryContent, originalText);
  });
}

// Call AI API for follow-up answer
function callAIAPIForAnswer(prompt, generateAnswerBtn, summaryContent, originalText) {
  // Get settings from storage
  chrome.storage.sync.get(['settings'], function(result) {
    const settings = result.settings || {};
    const aiProvider = settings.aiProvider || 'gemini';

    // 获取当前服务商的配置
    const providerSettings = settings.providers && settings.providers[aiProvider];
    const apiKey = providerSettings?.apiKey || settings.apiKey || settings.geminiApiKey;
    const config = getDefaultConfig(aiProvider);
    const modelId = providerSettings?.modelId || settings.modelId || config.model;
    const apiBaseUrl = providerSettings?.apiBaseUrl || settings.apiBaseUrl || config.baseUrl;

    if (!apiKey) {
      generateAnswerBtn.textContent = originalText;
      generateAnswerBtn.disabled = false;
      alert('请先在设置中配置API密钥');
      return;
    }

    // Call different APIs based on provider
    if (aiProvider === 'gemini') {
      callGeminiAPIForAnswer(prompt, apiKey, modelId, apiBaseUrl, generateAnswerBtn, summaryContent, originalText);
    } else if (aiProvider === 'siliconflow') {
      callSiliconFlowAPIForAnswer(prompt, apiKey, modelId, apiBaseUrl, generateAnswerBtn, summaryContent, originalText);
    } else {
      generateAnswerBtn.textContent = originalText;
      generateAnswerBtn.disabled = false;
      alert('不支持的AI服务商：' + aiProvider);
    }
  });
}

// Call AI API for summary
function callAIAPI(subtitleText, videoTitle, bvid = null) {
  const aiSummaryBtn = document.getElementById('ai-summary-btn');
  const summaryResult = document.getElementById('summary-result');
  const summaryContent = document.getElementById('summary-content');

  // 保存 bvid 供后续使用
  window.currentBVID = bvid;

  // Get settings from storage
  chrome.storage.sync.get(['settings'], function(result) {
    const settings = result.settings || {};
    const aiProvider = settings.aiProvider || 'gemini';

    // 获取当前服务商的配置
    const providerSettings = settings.providers && settings.providers[aiProvider];
    const apiKey = providerSettings?.apiKey || settings.apiKey || settings.geminiApiKey; // 优先使用服务商专用配置
    const config = getDefaultConfig(aiProvider);
    const modelId = providerSettings?.modelId || settings.modelId || config.model;
    const apiBaseUrl = providerSettings?.apiBaseUrl || settings.apiBaseUrl || config.baseUrl;

    console.log('AI总结 - 当前服务商:', aiProvider);
    console.log('AI总结 - API密钥来源:', providerSettings?.apiKey ? '服务商专用' : '通用设置');

    if (!apiKey) {
      aiSummaryBtn.textContent = '✨ 生成AI总结';
      aiSummaryBtn.disabled = false;
      alert('请先在设置中配置API密钥');
      return;
    }

    if (!modelId) {
      aiSummaryBtn.textContent = '✨ 生成AI总结';
      aiSummaryBtn.disabled = false;
      alert('请先在设置中配置模型ID');
      return;
    }

    if (!apiBaseUrl) {
      aiSummaryBtn.textContent = '✨ 生成AI总结';
      aiSummaryBtn.disabled = false;
      alert('请先在设置中配置API Base URL');
      return;
    }

    // Prepare prompt
    const prompt = `请对以下视频字幕内容进行总结：

视频标题：${videoTitle}

字幕内容：
${subtitleText}

请生成一个简洁明了的中文总结，包含：
1. 视频主要内容概述
2. 关键要点（3-5个）
3. 主要结论或观点

总结长度控制在300-500字以内。`;

    console.log('AI Provider:', aiProvider);
    console.log('Model ID:', modelId);
    console.log('Prompt长度:', prompt.length);
    console.log('字幕文本长度:', subtitleText.length);
    console.log('实际字幕文本内容（前1000字符）:', subtitleText.substring(0, 1000));
    console.log('Prompt中的字幕部分:', prompt.substring(prompt.indexOf('字幕内容：') + 5, prompt.indexOf('字幕内容：') + 1005));

    // Call different APIs based on provider
    if (aiProvider === 'gemini') {
      callGeminiAPI(prompt, apiKey, modelId, apiBaseUrl, aiSummaryBtn, summaryContent, summaryResult);
    } else if (aiProvider === 'siliconflow') {
      callSiliconFlowAPI(prompt, apiKey, modelId, apiBaseUrl, aiSummaryBtn, summaryContent, summaryResult);
    } else {
      aiSummaryBtn.textContent = '✨ 生成AI总结';
      aiSummaryBtn.disabled = false;
      alert('不支持的AI服务商：' + aiProvider);
    }
  });
}

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(['settings'], function(result) {
    const settings = result.settings || {};

    // Load AI provider first
    const aiProvider = document.getElementById('ai-provider');
    const currentProvider = settings.aiProvider || 'gemini';
    if (aiProvider) {
      aiProvider.value = currentProvider;
    }

    // Load font size setting
    const fontSizeSelect = document.getElementById('font-size-setting');
    if (fontSizeSelect) {
      fontSizeSelect.value = settings.fontSize || 'medium';
      applyFontSize(settings.fontSize || 'medium');
    }

    // Load provider-specific settings
    loadProviderSettings(currentProvider, settings);
  });
}

// Load settings for specific provider
function loadProviderSettings(provider, settings) {
  console.log('切换到服务商:', provider);

  const config = getDefaultConfig(provider);
  const providerSettings = settings.providers && settings.providers[provider];

  const apiBaseUrl = document.getElementById('api-base-url');
  const apiKey = document.getElementById('api-key');
  const modelId = document.getElementById('model-id');

  // 强制更新Base URL为对应服务商的地址
  if (apiBaseUrl) {
    apiBaseUrl.value = providerSettings?.apiBaseUrl || config.baseUrl;
    apiBaseUrl.placeholder = config.baseUrl;
    console.log('设置Base URL:', apiBaseUrl.value);
  }

  // 加载对应服务商的API Key（如果有保存的话）
  if (apiKey) {
    apiKey.value = providerSettings?.apiKey || '';
    if (provider === 'gemini') {
      apiKey.placeholder = '请输入Google Gemini API密钥';
    } else if (provider === 'siliconflow') {
      apiKey.placeholder = '请输入硅基流动API密钥';
    }
    console.log('设置API Key:', apiKey.value ? '已加载保存的密钥' : '等待输入新密钥');
  }

  // 加载对应服务商的模型ID
  if (modelId) {
    modelId.value = providerSettings?.modelId || config.model;
    if (provider === 'gemini') {
      modelId.placeholder = '如: gemini-2.5-flash, gemini-2.5-pro';
    } else if (provider === 'siliconflow') {
      modelId.placeholder = '如: deepseek-ai/DeepSeek-V3, Qwen/Qwen2.5-72B-Instruct-128K';
    }
    console.log('设置模型ID:', modelId.value);
  }
}

// Save settings to storage
function saveSettings() {
  const aiProvider = document.getElementById('ai-provider').value;
  const apiBaseUrl = document.getElementById('api-base-url').value;
  const apiKey = document.getElementById('api-key').value;
  const modelId = document.getElementById('model-id').value;
  const fontSize = document.getElementById('font-size-setting').value;

  // 获取现有设置
  chrome.storage.sync.get(['settings'], function(result) {
    const settings = result.settings || {};

    // 为每个服务商单独保存配置
    if (!settings.providers) {
      settings.providers = {};
    }

    settings.providers[aiProvider] = {
      apiBaseUrl: apiBaseUrl,
      apiKey: apiKey,
      modelId: modelId
    };

    // 保存当前选择的服务商
    settings.aiProvider = aiProvider;

    // 保存字体大小设置
    settings.fontSize = fontSize;

    // Keep backward compatibility for Gemini
    settings.geminiApiKey = aiProvider === 'gemini' ? apiKey : settings.geminiApiKey;

    chrome.storage.sync.set({ settings: settings }, function() {
      const saveBtn = document.getElementById('save-settings-btn');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = '✅ 已保存';

      setTimeout(() => {
        saveBtn.textContent = originalText;
      }, 2000);
    });
  });
}

// Get default model and base URL for AI provider
function getDefaultConfig(aiProvider) {
  const defaultConfigs = {
    'gemini': {
      model: 'gemini-2.5-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models'
    },
    'siliconflow': {
      model: 'Qwen/Qwen2.5-72B-Instruct-128K',
      baseUrl: 'https://api.siliconflow.cn/v1'
    }
  };
  return defaultConfigs[aiProvider] || { model: '', baseUrl: '' };
}

function normalizeGeminiApiBaseUrl(apiBaseUrl) {
  const trimmedBaseUrl = (apiBaseUrl || '').replace(/\/+$/, '');
  if (trimmedBaseUrl === 'https://generativelanguage.googleapis.com') {
    return `${trimmedBaseUrl}/v1beta/models`;
  }
  return trimmedBaseUrl;
}

// Call Gemini API
function callGeminiAPI(prompt, apiKey, modelId, apiBaseUrl, aiSummaryBtn, summaryContent, summaryResult) {
  console.log('=== Gemini API 调用开始 ===');
  console.log('API Key:', apiKey ? '已配置' : '未配置');
  console.log('Model ID:', modelId);
  console.log('Base URL:', apiBaseUrl);
  console.log('Prompt完整内容:', prompt);

  const apiUrl = `${normalizeGeminiApiBaseUrl(apiBaseUrl)}/${modelId}:generateContent?key=${apiKey}`;
  console.log('API URL:', `${normalizeGeminiApiBaseUrl(apiBaseUrl)}/${modelId}:generateContent?key=[redacted]`);

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  console.log('请求体:', JSON.stringify(requestBody, null, 2));

  fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  })
  .then(response => {
    console.log('Gemini API响应状态:', response.status);
    console.log('Gemini API响应头:', response.headers);
    return response.json();
  })
  .then(data => {
    console.log('Gemini API完整响应:', JSON.stringify(data, null, 2));

    aiSummaryBtn.textContent = '✨ 生成AI总结';
    aiSummaryBtn.disabled = false;

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const summary = data.candidates[0].content.parts[0].text;
      console.log('生成的总结内容:', summary);
      window.originalSummaryText = summary; // 保存原始文本用于复制

      // 转换为 HTML 格式
      const summaryHtml = convertMarkdownToHTML(summary);
      summaryContent.innerHTML = summaryHtml;
      summaryResult.style.display = 'block';

      // 🎯 保存AI总结到缓存（保存HTML格式，以便与继续提问的格式一致）
      if (window.currentBVID) {
        VideoCacheManager.updateAISummary(window.currentBVID, summaryHtml)
          .then(() => {
            console.log('✅ AI总结已保存到缓存（HTML格式）');
          })
          .catch(error => {
            console.error('保存AI总结失败:', error);
          });
      }
    } else {
      console.error('Gemini API响应格式错误:', data);
      alert('AI总结生成失败：' + (data.error?.message || JSON.stringify(data)));
    }
  })
  .catch(error => {
    console.error('Gemini API调用异常:', error);
    aiSummaryBtn.textContent = '✨ 生成AI总结';
    aiSummaryBtn.disabled = false;
    alert('Gemini API调用失败：' + error.message);
  });
}

// Call SiliconFlow API
function callSiliconFlowAPI(prompt, apiKey, modelId, apiBaseUrl, aiSummaryBtn, summaryContent, summaryResult) {
  console.log('=== 硅基流动 API 调用开始 ===');
  console.log('API Key:', apiKey ? '已配置' : '未配置');
  console.log('API Key是否以sk-开头:', apiKey.startsWith('sk-'));
  console.log('Model ID:', modelId);
  console.log('Base URL:', apiBaseUrl);
  console.log('Prompt长度:', prompt.length);

  // 验证API密钥格式
  console.log('API Key类型:', typeof apiKey);

  if (!apiKey || apiKey.trim() === '') {
    alert('请输入硅基流动API密钥');
    aiSummaryBtn.textContent = '✨ 生成AI总结';
    aiSummaryBtn.disabled = false;
    return;
  }

  // 清理API密钥（去除可能的空格）
  const cleanApiKey = apiKey.trim();
  console.log('清理后的API Key是否以sk-开头:', cleanApiKey.startsWith('sk-'));

  if (!cleanApiKey.startsWith('sk-')) {
    console.error('API密钥格式验证失败');
    alert('硅基流动API密钥格式不正确，应该以"sk-"开头');
    aiSummaryBtn.textContent = '✨ 生成AI总结';
    aiSummaryBtn.disabled = false;
    return;
  }

  // 按照BRO项目的实现，直接使用固定URL
  const url = "https://api.siliconflow.cn/v1/chat/completions";
  console.log('API URL:', url);

  const requestBody = {
    model: modelId,
    messages: [{
      role: 'user',
      content: prompt
    }],
    stream: false,
    max_tokens: 1024,
    temperature: 0.7,
    top_p: 0.7
  };

  console.log('请求体:', JSON.stringify(requestBody, null, 2));

  // 添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cleanApiKey}`,
      'User-Agent': 'Bilibili Assistant/1.0.0'
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  })
  .then(response => {
    clearTimeout(timeoutId);
    console.log('硅基流动 API响应状态:', response.status);

    if (!response.ok) {
      return response.text().then(errorText => {
        console.error('硅基流动 API响应错误:', response.status, errorText);
        console.error('请求的模型ID:', modelId);
        console.error('API密钥:', apiKey ? '已配置' : '未配置');

        let errorMessage = `硅基流动 API请求失败: ${response.status} ${response.statusText}`;

        // 尝试解析错误详情
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.message) {
            errorMessage += `\n详细错误: ${errorData.error.message}`;
          }
        } catch (e) {
          // 如果不是JSON格式，直接显示原始错误文本
          if (errorText) {
            errorMessage += `\n详细错误: ${errorText}`;
          }
        }

        throw new Error(errorMessage);
      });
    }

    return response.json();
  })
  .then(data => {
    console.log('硅基流动 API完整响应:', JSON.stringify(data, null, 2));

    aiSummaryBtn.textContent = '✨ 生成AI总结';
    aiSummaryBtn.disabled = false;

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const summary = data.choices[0].message.content;
      console.log('生成的总结内容:', summary);
      window.originalSummaryText = summary; // 保存原始文本用于复制

      // 转换为 HTML 格式
      const summaryHtml = convertMarkdownToHTML(summary);
      summaryContent.innerHTML = summaryHtml;
      summaryResult.style.display = 'block';

      // 🎯 保存AI总结到缓存（保存HTML格式，以便与继续提问的格式一致）
      if (window.currentBVID) {
        VideoCacheManager.updateAISummary(window.currentBVID, summaryHtml)
          .then(() => {
            console.log('✅ AI总结已保存到缓存（HTML格式）');
          })
          .catch(error => {
            console.error('保存AI总结失败:', error);
          });
      }
    } else {
      console.error('硅基流动 API响应格式错误:', data);
      alert('AI总结生成失败：' + (data.error?.message || JSON.stringify(data)));
    }
  })
  .catch(error => {
    clearTimeout(timeoutId);
    console.error('硅基流动 API调用异常:', error);
    aiSummaryBtn.textContent = '✨ 生成AI总结';
    aiSummaryBtn.disabled = false;

    if (error.name === 'AbortError') {
      alert('硅基流动 API调用超时，请稍后重试');
    } else if (error.message.includes('Failed to fetch')) {
      alert('硅基流动 API请求失败，请检查网络连接或API服务是否可用');
    } else {
      alert('硅基流动 API调用失败：' + error.message);
    }
  });
}



// 将Markdown文本转换为HTML
function convertMarkdownToHTML(markdown) {
  let html = markdown;

  // 转换标题 (### -> <h3>, ## -> <h2>, # -> <h1>)
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // 转换粗体 (**text** -> <strong>text</strong>)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 转换斜体 (*text* -> <em>text</em>)
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 转换行内代码 (`code` -> <code>code</code>)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 转换无序列表
  html = html.replace(/^[\*\-\+] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // 转换有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // 处理连续的<li>标签，包装在<ul>或<ol>中
  html = html.replace(/(<li>.*?<\/li>)(\s*<li>.*?<\/li>)*/gs, function(match) {
    // 如果前面有数字，使用<ol>，否则使用<ul>
    return '<ul>' + match + '</ul>';
  });

  // 转换段落（双换行分隔的文本块）
  const paragraphs = html.split(/\n\s*\n/);
  html = paragraphs.map(p => {
    p = p.trim();
    if (p && !p.startsWith('<') && !p.includes('<li>')) {
      return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }
    return p;
  }).join('\n\n');

  // 清理多余的换行
  html = html.replace(/\n+/g, '\n');

  return html;
}

// Download audio
function downloadAudio() {
  const audioDownloadBtn = document.getElementById('audio-download-btn');

  // 使用默认设置（最佳可用质量，MP3格式）
  const selectedQuality = 'best';
  const selectedFormat = 'mp3';

  console.log('开始下载音频，使用最佳可用质量');

  // Show loading state
  const originalText = audioDownloadBtn.textContent;
  audioDownloadBtn.textContent = '🔄 下载中...';
  audioDownloadBtn.disabled = true;

  // Send message to content script
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'DOWNLOAD_AUDIO',
      quality: selectedQuality,
      format: selectedFormat
    }, function(response) {
      // Reset button state
      audioDownloadBtn.textContent = originalText;
      audioDownloadBtn.disabled = false;

      if (chrome.runtime.lastError) {
        console.error('音频下载消息发送失败:', chrome.runtime.lastError);
        alert('音频下载失败：无法与页面通信');
        return;
      }

      if (response && response.success) {
        console.log('音频下载成功:', response);
        const sizeInfo = response.sizeMB ? ` (${response.sizeMB}MB)` : '';
        const actualKbps = response.bandwidth ? Math.round(response.bandwidth/1000) : 'unknown';
        audioDownloadBtn.textContent = `✅ 已下载 ${actualKbps}kbps${sizeInfo}`;

        // 显示详细信息
        console.log(`=== 下载完成 ===`);
        console.log(`文件名: ${response.filename}`);
        console.log(`文件大小: ${response.sizeMB}MB`);
        console.log(`请求质量: ${response.quality}kbps`);
        console.log(`实际质量: ${actualKbps}kbps`);
        console.log(`音频ID: ${response.audioId}`);

        // 检查质量匹配
        if (response.quality !== actualKbps.toString()) {
          console.log(`⚠️ 注意：请求的${response.quality}kbps与实际${actualKbps}kbps不匹配`);
        }

        setTimeout(() => {
          audioDownloadBtn.textContent = originalText;
        }, 4000);
      } else {
        console.error('音频下载失败:', response?.error);
        alert('音频下载失败：' + (response?.error || '未知错误'));
      }
    });
  });
}

// Call Gemini API for follow-up answer
function callGeminiAPIForAnswer(prompt, apiKey, modelId, apiBaseUrl, generateAnswerBtn, summaryContent, originalText) {
  const apiUrl = `${normalizeGeminiApiBaseUrl(apiBaseUrl)}/${modelId}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })
  .then(response => response.json())
  .then(data => {
    generateAnswerBtn.textContent = originalText;
    generateAnswerBtn.disabled = false;

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const answer = data.candidates[0].content.parts[0].text;

      // 在现有总结下方添加问答内容
      const answerHtml = `
        <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #ddd;">
          <h4 style="color: #fb7299; margin-bottom: 10px;">💬 问答</h4>
          <div style="background: #e8f4fd; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
            <strong>问：</strong>${document.getElementById('follow-up-question').value}
          </div>
          <div style="background: #f0f9ff; padding: 10px; border-radius: 4px;">
            <strong>答：</strong>${convertMarkdownToHTML(answer)}
          </div>
        </div>
      `;

      summaryContent.innerHTML += answerHtml;

      // 清空输入框
      document.getElementById('follow-up-question').value = '';

      // 滚动到底部
      summaryContent.scrollTop = summaryContent.scrollHeight;

      // 🎯 保存完整的AI分析内容（包括原始总结 + 所有问答）到缓存
      if (window.currentBVID) {
        const fullContent = summaryContent.innerHTML;
        VideoCacheManager.updateAISummary(window.currentBVID, fullContent)
          .then(() => {
            console.log('✅ AI分析（包含问答）已保存到缓存');
          })
          .catch(error => {
            console.error('保存AI分析失败:', error);
          });
      }
    } else {
      alert('AI回答生成失败：' + JSON.stringify(data));
    }
  })
  .catch(error => {
    generateAnswerBtn.textContent = originalText;
    generateAnswerBtn.disabled = false;
    alert('AI回答生成失败：' + error.message);
  });
}

// Call SiliconFlow API for follow-up answer
function callSiliconFlowAPIForAnswer(prompt, apiKey, modelId, apiBaseUrl, generateAnswerBtn, summaryContent, originalText) {
  // 验证API密钥格式
  if (!apiKey || apiKey.trim() === '') {
    alert('请输入硅基流动API密钥');
    generateAnswerBtn.textContent = originalText;
    generateAnswerBtn.disabled = false;
    return;
  }

  const cleanApiKey = apiKey.trim();
  if (!cleanApiKey.startsWith('sk-')) {
    alert('硅基流动API密钥格式不正确，应该以"sk-"开头');
    generateAnswerBtn.textContent = originalText;
    generateAnswerBtn.disabled = false;
    return;
  }

  const url = "https://api.siliconflow.cn/v1/chat/completions";
  const requestBody = {
    model: modelId,
    messages: [{
      role: 'user',
      content: prompt
    }],
    stream: false,
    max_tokens: 512,
    temperature: 0.7,
    top_p: 0.7
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cleanApiKey}`,
      'User-Agent': 'Bilibili Assistant/1.0.0'
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  })
  .then(response => {
    clearTimeout(timeoutId);
    if (!response.ok) {
      return response.text().then(errorText => {
        throw new Error(`硅基流动 API请求失败: ${response.status} ${response.statusText}`);
      });
    }
    return response.json();
  })
  .then(data => {
    generateAnswerBtn.textContent = originalText;
    generateAnswerBtn.disabled = false;

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const answer = data.choices[0].message.content;

      // 在现有总结下方添加问答内容
      const answerHtml = `
        <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #ddd;">
          <h4 style="color: #fb7299; margin-bottom: 10px;">💬 问答</h4>
          <div style="background: #e8f4fd; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
            <strong>问：</strong>${document.getElementById('follow-up-question').value}
          </div>
          <div style="background: #f0f9ff; padding: 10px; border-radius: 4px;">
            <strong>答：</strong>${convertMarkdownToHTML(answer)}
          </div>
        </div>
      `;

      summaryContent.innerHTML += answerHtml;

      // 清空输入框
      document.getElementById('follow-up-question').value = '';

      // 滚动到底部
      summaryContent.scrollTop = summaryContent.scrollHeight;

      // 🎯 保存完整的AI分析内容（包括原始总结 + 所有问答）到缓存
      if (window.currentBVID) {
        const fullContent = summaryContent.innerHTML;
        VideoCacheManager.updateAISummary(window.currentBVID, fullContent)
          .then(() => {
            console.log('✅ AI分析（包含问答）已保存到缓存');
          })
          .catch(error => {
            console.error('保存AI分析失败:', error);
          });
      }
    } else {
      alert('AI回答生成失败：' + JSON.stringify(data));
    }
  })
  .catch(error => {
    clearTimeout(timeoutId);
    generateAnswerBtn.textContent = originalText;
    generateAnswerBtn.disabled = false;

    if (error.name === 'AbortError') {
      alert('硅基流动 API调用超时，请稍后重试');
    } else if (error.message.includes('Failed to fetch')) {
      alert('硅基流动 API请求失败，请检查网络连接或API服务是否可用');
    } else {
      alert('硅基流动 API调用失败：' + error.message);
    }
  });
}

// 应用字体大小设置
function applyFontSize(fontSize) {
  const summaryContent = document.getElementById('summary-content');
  if (!summaryContent) return;

  // 移除之前的字体大小类
  summaryContent.classList.remove('font-small', 'font-medium', 'font-large');

  // 添加新的字体大小类
  summaryContent.classList.add(`font-${fontSize}`);
}

// 初始化字体大小设置
function initializeFontSizeSettings() {
  const fontSizeSelect = document.getElementById('font-size-setting');
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', function() {
      const fontSize = this.value;
      applyFontSize(fontSize);
      saveSettings(); // 保存设置
    });
  }
}

// Check subtitles for TIPS generation
async function checkSubtitlesForTips(videoUrl, retryCount = 0) {
  const timestampSubtitleStatus = document.getElementById('timestamp-subtitle-status');
  const generateTipsBtn = document.getElementById('generate-tips-btn');
  const tipsResult = document.getElementById('tips-result');
  const tipsContent = document.getElementById('tips-content');

  if (!timestampSubtitleStatus || !generateTipsBtn) return;

  // Extract BVID from URL
  const match = videoUrl.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  if (!match) {
    timestampSubtitleStatus.textContent = '❌ 无法获取视频ID';
    timestampSubtitleStatus.style.background = '#fee';
    timestampSubtitleStatus.style.color = '#c53030';
    return;
  }

  const bvid = match[1];

  // 🎯 重要：保存 BVID 供后续缓存更新使用
  window.currentBVID = bvid;

  // 🎯 检查缓存
  const cache = await VideoCacheManager.getCache(bvid);
  if (cache) {
    console.log('✅ 找到缓存:', bvid);

    // 显示缓存状态
    const cacheDate = new Date(cache.timestamp).toLocaleString('zh-CN');

    // 如果有字幕缓存
    if (cache.subtitle) {
      timestampSubtitleStatus.innerHTML = `✅ 已加载缓存字幕<br><span style="font-size: 11px; color: #666;">缓存时间: ${cacheDate}</span>`;
      timestampSubtitleStatus.style.background = '#e3f2fd';
      timestampSubtitleStatus.style.color = '#1976d2';
      generateTipsBtn.disabled = false;

      // 存储字幕供后续使用（同时存储到两个变量，确保两个标签页都能使用）
      const cachedSubtitle = {
        lan: cache.subtitle.language || 'zh-CN',
        lan_doc: cache.subtitle.language || '中文',
        subtitle_url: 'cached',
        cached: true,
        cachedData: cache.subtitle.content
      };
      window.availableSubtitles = [cachedSubtitle];
      window.availableSubtitlesForTips = [cachedSubtitle];

      // 🎯 重要：设置字幕文本供"生成答案"按钮使用
      // 这样即使从缓存恢复，用户也可以直接使用"继续提问"功能
      if (cache.subtitle.content && Array.isArray(cache.subtitle.content)) {
        const subtitleText = cache.subtitle.content.map(item => item.content).join('\n');
        window.currentSubtitleText = subtitleText;
        console.log('✅ 已设置字幕文本供继续提问使用，长度:', subtitleText.length);
      }
    }

    // 🎯 如果有缓存的AI总结，自动显示
    const summaryResult = document.getElementById('summary-result');
    const summaryContent = document.getElementById('summary-content');
    if (cache.aiSummary && summaryResult && summaryContent) {
      // 直接使用缓存的HTML内容（已经包含格式化和所有问答）
      summaryContent.innerHTML = cache.aiSummary;
      summaryResult.style.display = 'block';
      console.log('✅ 已显示缓存的AI总结（包含所有问答）');
    }

    // 🎯 如果有缓存的时间戳导航，自动显示
    if (cache.timestamps && cache.timestamps.length > 0) {
      if (tipsResult && tipsContent) {
        displayCachedTimestamps(cache.timestamps, tipsContent, tipsResult);
        console.log('✅ 已显示缓存的时间戳导航');
      }
    }

    return;
  }

  // 显示检测中状态
  timestampSubtitleStatus.textContent = '🔄 检测字幕中...';
  timestampSubtitleStatus.style.background = '#f0f0f0';
  timestampSubtitleStatus.style.color = '#666';

  // Check if subtitles are available
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'GET_SUBTITLE_INFO',
      bvid: bvid
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.log('TIPS字幕检测失败，错误:', chrome.runtime.lastError.message);

        // 如果是第一次尝试且错误是content script未准备好，则重试
        if (retryCount < 3 && chrome.runtime.lastError.message.includes('Could not establish connection')) {
          console.log(`Content script未准备好，${1000 * (retryCount + 1)}ms后重试...`);
          setTimeout(() => {
            checkSubtitlesForTips(videoUrl, retryCount + 1);
          }, 1000 * (retryCount + 1));
          return;
        }

        timestampSubtitleStatus.textContent = '❌ 字幕检测失败';
        timestampSubtitleStatus.style.background = '#fee';
        timestampSubtitleStatus.style.color = '#c53030';
        return;
      }

      if (response && response.subtitles && response.subtitles.length > 0) {
        timestampSubtitleStatus.textContent = `✅ 检测到 ${response.subtitles.length} 个字幕`;
        timestampSubtitleStatus.style.background = '#e8f5e8';
        timestampSubtitleStatus.style.color = '#2d5a2d';
        generateTipsBtn.disabled = false;

        // Store subtitles for later use
        window.availableSubtitlesForTips = response.subtitles;
        console.log('TIPS字幕检测成功，找到', response.subtitles.length, '个字幕');
      } else {
        timestampSubtitleStatus.textContent = '😔 该视频暂无字幕';
        timestampSubtitleStatus.style.background = '#fff3cd';
        timestampSubtitleStatus.style.color = '#856404';
        generateTipsBtn.disabled = true;
        console.log('TIPS字幕检测完成，但未找到字幕');
      }
    });
  });
}

// 显示缓存的时间戳导航
function displayCachedTimestamps(timestamps, tipsContent, tipsResult) {
  try {
    if (!tipsContent || !tipsResult) {
      console.warn('时间戳导航元素未找到');
      return;
    }

    if (!timestamps || timestamps.length === 0) {
      console.warn('没有时间戳数据');
      return;
    }

    console.log('显示缓存的时间戳导航，共', timestamps.length, '个');

    // 生成HTML
    let html = `
      <div style="margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0; color: #1976d2;">🎯 视频智能导航 (${timestamps.length}个要点)</h4>
        <p style="margin: 5px 0; color: #666; font-size: 14px;">
          点击时间戳可直接跳转到对应视频位置
        </p>
        <p style="margin: 5px 0; color: #666; font-size: 13px;">✅ 已从缓存加载</p>
      </div>
    `;

    timestamps.forEach((item, index) => {
      const timeStr = formatSecondsToTime(item.time);
      html += `
        <div class="tip-item" style="cursor: pointer; transition: all 0.3s; margin-bottom: 16px; padding: 12px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" data-seconds="${item.time}">
          <div style="display: flex; align-items: flex-start; gap: 15px;">
            <div class="tip-timestamp" data-seconds="${item.time}" style="flex-shrink: 0; font-size: 16px; font-weight: bold; color: #1976d2;">
              ${timeStr}
            </div>
            <div style="flex: 1;">
              <div style="font-size: 15px; line-height: 1.5; color: #333;">
                ${escapeHtml(item.title || item.description)}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    tipsContent.innerHTML = html;
    tipsResult.style.display = 'block';

    console.log('✅ 时间戳导航已显示');
  } catch (error) {
    console.error('显示缓存时间戳失败:', error);
  }
}

// Generate video TIPS
function generateVideoTips() {
  const generateTipsBtn = document.getElementById('generate-tips-btn');
  const tipsResult = document.getElementById('tips-result');
  const tipsContent = document.getElementById('tips-content');
  const videoAnalysisInfo = document.getElementById('video-analysis-info');

  if (!window.availableSubtitlesForTips || window.availableSubtitlesForTips.length === 0) {
    alert('没有可用的字幕进行TIPS生成');
    return;
  }

  // Show loading state
  generateTipsBtn.textContent = '🔄 生成中...';
  generateTipsBtn.disabled = true;

  console.log('开始生成TIPS，字幕数量:', window.availableSubtitlesForTips.length);

  const subtitle = window.availableSubtitlesForTips[0];
  console.log('使用字幕:', subtitle);

  // 获取当前页面标题和视频时长
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const videoTitle = currentTab.title || '未知视频';

    // 🎯 检查是否是缓存字幕
    if (subtitle.cached && subtitle.cachedData) {
      console.log('✅ 使用缓存字幕生成TIPS');
      const response = { content: subtitle.cachedData };

      if (response.content && response.content.length > 0) {
        // 计算视频时长
        const lastSubtitle = response.content[response.content.length - 1];
        const videoDurationMinutes = Math.ceil(lastSubtitle.to / 60);

        // 计算建议TIPS数量
        const suggestedTipsCount = calculateOptimalTipsCount(videoDurationMinutes);

        // 继续处理...
        processSubtitleForTips(response.content, videoTitle, videoDurationMinutes, suggestedTipsCount, generateTipsBtn, tipsResult, tipsContent, videoAnalysisInfo);
      } else {
        generateTipsBtn.textContent = '✨ 生成智能导航';
        generateTipsBtn.disabled = false;
        alert('缓存字幕内容为空');
      }
      return;
    }

    // 下载字幕内容
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'DOWNLOAD_SUBTITLE_CONTENT',
      url: subtitle.subtitle_url
    }, function(response) {
      if (chrome.runtime.lastError || !response || response.error) {
        generateTipsBtn.textContent = '✨ 生成智能导航';
        generateTipsBtn.disabled = false;
        alert('获取字幕内容失败：' + (response?.error || chrome.runtime.lastError?.message || '未知错误'));
        return;
      }

      if (response.content && response.content.length > 0) {
        // 计算视频时长
        const lastSubtitle = response.content[response.content.length - 1];
        const videoDurationMinutes = Math.ceil(lastSubtitle.to / 60);

        // 计算建议TIPS数量
        const suggestedTipsCount = calculateOptimalTipsCount(videoDurationMinutes);

        // 使用公共函数处理字幕
        processSubtitleForTips(response.content, videoTitle, videoDurationMinutes, suggestedTipsCount, generateTipsBtn, tipsResult, tipsContent, videoAnalysisInfo);
      } else {
        generateTipsBtn.textContent = '✨ 生成智能导航';
        generateTipsBtn.disabled = false;
        alert('字幕内容为空');
      }
    });
  });
}

// 处理字幕生成TIPS（提取公共逻辑）
function processSubtitleForTips(subtitleContent, videoTitle, videoDurationMinutes, suggestedTipsCount, generateTipsBtn, tipsResult, tipsContent, videoAnalysisInfo) {
  // Convert subtitle to text
  const subtitleText = subtitleContent.map(item => item.content).join('\n');
  console.log('字幕文本长度:', subtitleText.length);
  console.log('视频时长:', videoDurationMinutes, '分钟');
  console.log('建议TIPS数量:', suggestedTipsCount);

  if (subtitleText.trim().length === 0) {
    generateTipsBtn.textContent = '✨ 生成智能导航';
    generateTipsBtn.disabled = false;
    alert('字幕文本为空');
    return;
  }

  // 保存字幕数据供后续使用
  window.currentSubtitleData = subtitleContent;
  window.currentVideoTitle = videoTitle;
  window.currentVideoDuration = videoDurationMinutes;

  // 显示视频分析信息
  videoAnalysisInfo.innerHTML = `
    <div class="analysis-info">
      <div class="analysis-item">
        <div class="analysis-value">${videoDurationMinutes}分钟</div>
        <div class="analysis-label">视频时长</div>
      </div>
      <div class="analysis-item">
        <div class="analysis-value">${suggestedTipsCount}个</div>
        <div class="analysis-label">建议TIPS数量</div>
      </div>
      <div class="analysis-item">
        <div class="analysis-value">${subtitleContent.length}</div>
        <div class="analysis-label">字幕条目</div>
      </div>
    </div>
    <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">
      根据视频长度动态调整TIPS数量，并考虑时间分布均匀性
    </p>
  `;

  // Call AI API to generate TIPS (复用现有API逻辑)
  callAIAPIForTips(subtitleText, videoTitle, videoDurationMinutes, suggestedTipsCount);
}

// Call AI API for TIPS generation (复用现有API逻辑)
function callAIAPIForTips(subtitleText, videoTitle, videoDurationMinutes, suggestedTipsCount) {
  const generateTipsBtn = document.getElementById('generate-tips-btn');
  const tipsResult = document.getElementById('tips-result');
  const tipsContent = document.getElementById('tips-content');

  // 构建TIPS生成的prompt（应用YouTube助手的优化）
  // 智能采样字幕文本，确保覆盖整个视频时长
  const sampledText = sampleSubtitleTextForBilibili(window.currentSubtitleData, videoDurationMinutes, 25000);

  const prompt = `分析${videoDurationMinutes}分钟的视频字幕，提取${suggestedTipsCount}个最重要且有代表性的核心TIPS。

🚨 CRITICAL: 必须严格按照时间分布要求，绝对不能所有TIPS都集中在前半段！

字幕内容：
${sampledText}

📍 强制时间分布要求（必须严格遵守）：
- 前1/3时段(0-${Math.floor(videoDurationMinutes/3)}分钟)：必须提取${Math.ceil(suggestedTipsCount*0.35)}个TIPS
- 中1/3时段(${Math.floor(videoDurationMinutes/3)}-${Math.floor(videoDurationMinutes*2/3)}分钟)：必须提取${Math.ceil(suggestedTipsCount*0.35)}个TIPS
- 后1/3时段(${Math.floor(videoDurationMinutes*2/3)}-${videoDurationMinutes}分钟)：必须提取${Math.floor(suggestedTipsCount*0.3)}个TIPS

🎯 具体时间段要求：
- 第1段：0-${Math.floor(videoDurationMinutes/3)}分钟 → ${Math.ceil(suggestedTipsCount*0.35)}个TIPS
- 第2段：${Math.floor(videoDurationMinutes/3)}-${Math.floor(videoDurationMinutes*2/3)}分钟 → ${Math.ceil(suggestedTipsCount*0.35)}个TIPS
- 第3段：${Math.floor(videoDurationMinutes*2/3)}-${videoDurationMinutes}分钟 → ${Math.floor(suggestedTipsCount*0.3)}个TIPS

⚠️ 重要提醒：
1. 必须从每个时间段都提取TIPS，不能跳过任何时间段
2. 即使后半段内容看似不重要，也必须提取相应数量的TIPS
3. 优先提取重要观点，但时间分布是硬性要求
4. 原文段落必须是连续时间的3-4句话，时间跨度不超过30秒
5. 每个TIPS必须包含具体信息（数字、概念、方法等）

请严格按照以下格式返回：

TIP1: [具体要点]
原文段落: "[时间戳] 内容1 [时间戳] 内容2 [时间戳] 内容3"

TIP2: [具体要点]
原文段落: "[时间戳] 内容1 [时间戳] 内容2 [时间戳] 内容3"

...（共${suggestedTipsCount}个TIPS）

🔥 最后检查：确保${Math.floor(suggestedTipsCount*0.3)}个TIPS来自${Math.floor(videoDurationMinutes*2/3)}-${videoDurationMinutes}分钟时段！`;

  // 复用现有的AI API调用逻辑
  chrome.storage.sync.get(['settings'], function(result) {
    const settings = result.settings || {};
    const aiProvider = settings.aiProvider || 'gemini';

    // 获取当前服务商的配置
    const providerSettings = settings.providers && settings.providers[aiProvider];
    const apiKey = providerSettings?.apiKey || settings.apiKey || settings.geminiApiKey;
    const config = getDefaultConfig(aiProvider);
    const modelId = providerSettings?.modelId || settings.modelId || config.model;
    const apiBaseUrl = providerSettings?.apiBaseUrl || settings.apiBaseUrl || config.baseUrl;

    if (!apiKey || !modelId || !apiBaseUrl) {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('请先在设置中配置AI服务');
      return;
    }

    // Call different APIs based on provider (复用现有逻辑)
    if (aiProvider === 'gemini') {
      callGeminiAPIForTips(prompt, apiKey, modelId, apiBaseUrl, generateTipsBtn, tipsContent, tipsResult);
    } else if (aiProvider === 'siliconflow') {
      callSiliconFlowAPIForTips(prompt, apiKey, modelId, apiBaseUrl, generateTipsBtn, tipsContent, tipsResult);
    } else {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('不支持的AI服务商：' + aiProvider);
    }
  });
}

// Call Gemini API for TIPS generation (基于现有的callGeminiAPI)
function callGeminiAPIForTips(prompt, apiKey, modelId, apiBaseUrl, generateTipsBtn, tipsContent, tipsResult) {
  console.log('=== Gemini API TIPS调用开始 ===');

  const apiUrl = `${normalizeGeminiApiBaseUrl(apiBaseUrl)}/${modelId}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  })
  .then(response => response.json())
  .then(data => {
    console.log('Gemini API TIPS响应:', data);

    generateTipsBtn.textContent = '✨ 生成智能导航';
    generateTipsBtn.disabled = false;

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const tipsText = data.candidates[0].content.parts[0].text;
      console.log('=== Gemini API TIPS响应详情 ===');
      console.log('完整响应数据:', JSON.stringify(data, null, 2));
      console.log('提取的文本内容:', tipsText);
      console.log('文本长度:', tipsText ? tipsText.length : 'null');
      console.log('文本前500字符:', tipsText ? tipsText.substring(0, 500) : 'null');

      // 解析TIPS并进行时间戳定位
      processTipsResponse(tipsText, tipsContent, tipsResult);
    } else {
      console.error('Gemini API TIPS响应格式错误:', data);
      console.error('完整响应:', JSON.stringify(data, null, 2));
      alert('TIPS生成失败：' + (data.error?.message || JSON.stringify(data)));
    }
  })
  .catch(error => {
    console.error('Gemini API TIPS调用异常:', error);
    generateTipsBtn.textContent = '✨ 生成智能导航';
    generateTipsBtn.disabled = false;
    alert('Gemini API调用失败：' + error.message);
  });
}

// Call SiliconFlow API for TIPS generation (基于现有的callSiliconFlowAPI)
function callSiliconFlowAPIForTips(prompt, apiKey, modelId, apiBaseUrl, generateTipsBtn, tipsContent, tipsResult) {
  console.log('=== 硅基流动 API TIPS调用开始 ===');

  const cleanApiKey = apiKey.trim();
  if (!cleanApiKey.startsWith('sk-')) {
    alert('硅基流动API密钥格式不正确，应该以"sk-"开头');
    generateTipsBtn.textContent = '✨ 生成智能导航';
    generateTipsBtn.disabled = false;
    return;
  }

  const url = "https://api.siliconflow.cn/v1/chat/completions";
  const requestBody = {
    model: modelId,
    messages: [{
      role: 'user',
      content: prompt
    }],
    stream: false,
    max_tokens: 2048,
    temperature: 0.3,
    top_p: 0.8,
    top_k: 20
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cleanApiKey}`,
      'User-Agent': 'Bilibili Assistant/1.0.0'
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  })
  .then(response => {
    clearTimeout(timeoutId);
    if (!response.ok) {
      return response.text().then(errorText => {
        throw new Error(`硅基流动 API请求失败: ${response.status} ${response.statusText}`);
      });
    }
    return response.json();
  })
  .then(data => {
    console.log('硅基流动 API TIPS响应:', data);

    generateTipsBtn.textContent = '✨ 生成智能导航';
    generateTipsBtn.disabled = false;

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const tipsText = data.choices[0].message.content;
      console.log('=== SiliconFlow API TIPS响应详情 ===');
      console.log('完整响应数据:', JSON.stringify(data, null, 2));
      console.log('提取的文本内容:', tipsText);
      console.log('文本长度:', tipsText ? tipsText.length : 'null');
      console.log('文本前500字符:', tipsText ? tipsText.substring(0, 500) : 'null');

      // 解析TIPS并进行时间戳定位
      processTipsResponse(tipsText, tipsContent, tipsResult);
    } else {
      console.error('硅基流动 API TIPS响应格式错误:', data);
      console.error('完整响应:', JSON.stringify(data, null, 2));
      alert('TIPS生成失败：' + (data.error?.message || JSON.stringify(data)));
    }
  })
  .catch(error => {
    clearTimeout(timeoutId);
    console.error('硅基流动 API TIPS调用异常:', error);
    generateTipsBtn.textContent = '✨ 生成智能导航';
    generateTipsBtn.disabled = false;
    alert('硅基流动 API调用失败：' + error.message);
  });
}

// 处理TIPS响应并进行时间戳定位
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

// 解析AI返回的TIPS文本
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

  // 更灵活的解析模式
  const tipPattern = /TIP(\d+)[:：]\s*(.+?)(?=原文段落[:：]|TIP\d+[:：]|$)/gs;
  const originalPattern = /原文段落[:：]\s*(.+?)(?=TIP\d+[:：]|$)/gs;

  const tipMatches = [...response.matchAll(tipPattern)];
  const originalMatches = [...response.matchAll(originalPattern)];

  console.log(`找到${tipMatches.length}个TIP匹配，${originalMatches.length}个原文段落匹配`);

  // 如果标准格式解析失败，尝试其他格式
  if (tipMatches.length === 0) {
    console.log('标准格式解析失败，尝试其他格式...');
    return parseAlternativeFormat(response);
  }

  for (let i = 0; i < Math.min(tipMatches.length, originalMatches.length); i++) {
    const tip = tipMatches[i][2].trim();
    let originalText = originalMatches[i][1].trim();

    // 清理原文段落
    originalText = originalText.replace(/^[""]|[""]$/g, ''); // 移除引号
    originalText = originalText.replace(/\n+/g, ' '); // 合并换行

    if (tip && originalText) {
      results.push({
        tip: tip,
        originalText: originalText,
        tipNumber: i + 1
      });
    }
  }

  console.log(`成功解析出${results.length}个TIPS`);
  return results;
}

// 解析JSON格式的TIPS响应
function parseJSONTipsResponse(response) {
  console.log('尝试JSON格式解析...');

  try {
    // 尝试直接解析JSON
    let jsonData;
    try {
      jsonData = JSON.parse(response);
    } catch (e) {
      // 如果直接解析失败，尝试提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法找到JSON内容');
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
    return [];
  }
}

// 备用解析格式
function parseAlternativeFormat(response) {
  console.log('尝试备用解析格式...');

  const results = [];

  // 尝试解析数字列表格式
  const lines = response.split('\n').filter(line => line.trim());
  let currentTip = null;
  let currentOriginal = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 检查是否是TIP行
    if (/^\d+[\.、]\s*/.test(line) || /^TIP\s*\d+/i.test(line)) {
      if (currentTip && currentOriginal) {
        results.push({
          tip: currentTip,
          originalText: currentOriginal,
          tipNumber: results.length + 1
        });
      }
      currentTip = line.replace(/^\d+[\.、]\s*/, '').replace(/^TIP\s*\d+[:：]\s*/i, '');
      currentOriginal = null;
    }
    // 检查是否包含时间戳（可能是原文段落）
    else if (/\[\d{1,2}:\d{2}/.test(line)) {
      currentOriginal = line;
    }
  }

  // 添加最后一个TIP
  if (currentTip && currentOriginal) {
    results.push({
      tip: currentTip,
      originalText: currentOriginal,
      tipNumber: results.length + 1
    });
  }

  console.log(`备用格式解析出${results.length}个TIPS`);
  return results;
}

// 搜索和定位TIPS在字幕中的位置
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

// 在字幕中查找TIP的位置（短视频优化版）
function findTipLocation(originalText, subtitleData) {
  console.log(`开始搜索TIP位置，原文长度: ${originalText.length}`);
  console.log(`字幕总数: ${subtitleData.length}句`);
  console.log(`原文前100字符: ${originalText.substring(0, 100)}`);

  // 提取原文中的关键句子（去除时间戳）
  const cleanText = originalText.replace(/\[\d{1,2}:\d{2}(:\d{2})?(,\d{3})?\]/g, '').trim();

  // 提取关键词进行搜索
  const keywords = extractKeywords(cleanText);
  console.log(`提取的关键词:`, keywords.slice(0, 5));

  // 🎯 短视频检测：字幕少于30句视为短视频
  const isShortVideo = subtitleData.length < 30;
  if (isShortVideo) {
    console.log('⚠️ 检测到短视频，启用短视频优化策略');
  }

  // 🎯 改进：寻找最佳匹配，而非第一个匹配
  let bestMatch = { found: false, similarity: 0 };

  // 方法1: 关键词匹配搜索
  const keywordResult = searchByKeywords(keywords, subtitleData, isShortVideo);
  if (keywordResult.found) {
    // 🎯 短视频优化：对视频开头位置进行惩罚
    const adjustedSimilarity = applyPositionPenalty(keywordResult, subtitleData, isShortVideo);
    if (adjustedSimilarity > bestMatch.similarity) {
      console.log(`关键词匹配成功: 第${keywordResult.startIndex + 1}句，原始相似度: ${(keywordResult.similarity * 100).toFixed(1)}%，调整后: ${(adjustedSimilarity * 100).toFixed(1)}%`);
      bestMatch = { ...keywordResult, similarity: adjustedSimilarity };
    }
  }

  // 方法2: 文本片段匹配
  const fragmentResult = searchByTextFragments(cleanText, subtitleData, isShortVideo);
  if (fragmentResult.found) {
    const adjustedSimilarity = applyPositionPenalty(fragmentResult, subtitleData, isShortVideo);
    if (adjustedSimilarity > bestMatch.similarity) {
      console.log(`文本片段匹配成功: 第${fragmentResult.startIndex + 1}句，原始相似度: ${(fragmentResult.similarity * 100).toFixed(1)}%，调整后: ${(adjustedSimilarity * 100).toFixed(1)}%`);
      bestMatch = { ...fragmentResult, similarity: adjustedSimilarity };
    }
  }

  // 方法3: 模糊匹配
  const fuzzyResult = searchByFuzzyMatch(cleanText, subtitleData, isShortVideo);
  if (fuzzyResult.found) {
    const adjustedSimilarity = applyPositionPenalty(fuzzyResult, subtitleData, isShortVideo);
    if (adjustedSimilarity > bestMatch.similarity) {
      console.log(`模糊匹配成功: 第${fuzzyResult.startIndex + 1}句，原始相似度: ${(fuzzyResult.similarity * 100).toFixed(1)}%，调整后: ${(adjustedSimilarity * 100).toFixed(1)}%`);
      bestMatch = { ...fuzzyResult, similarity: adjustedSimilarity };
    }
  }

  // 🎯 改进：如果找到匹配，应用时间戳调整机制（避免从句子中间开始）
  if (bestMatch.found) {
    console.log(`找到最佳匹配，相似度: ${(bestMatch.similarity * 100).toFixed(1)}%`);
    const adjustedMatch = avoidMidSentenceStart(bestMatch, subtitleData);
    return adjustedMatch;
  }

  console.log('所有搜索方法都未找到匹配位置');
  return {
    found: false,
    similarity: 0
  };
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

// 🎯 新增：时间戳调整机制（避免从句子中间开始）
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

  // 最多向前找3句，寻找更好的起点
  while (attempts < 3 && currentIndex >= 0) {
    const sentence = subtitleData[currentIndex].content.trim();
    const hasBadStart = badStarters.some(word =>
      sentence.startsWith(word) || sentence.startsWith(word + '，')
    );

    if (!hasBadStart) {
      // 找到好的起点，调整时间戳
      if (currentIndex !== matchResult.startIndex) {
        console.log(`🎯 时间戳调整: 避免中间插话感`);
        console.log(`   原句: "${subtitleData[matchResult.startIndex].content.substring(0, 20)}..."`);
        console.log(`   调整: "${sentence.substring(0, 20)}..."`);
      }
      return {
        ...matchResult,
        startIndex: currentIndex,
        startTime: formatSecondsToTime(subtitleData[currentIndex].from),
        startSeconds: Math.floor(subtitleData[currentIndex].from),
        adjusted: true
      };
    }
    currentIndex--;
    attempts++;
  }

  return matchResult;
}

// 提取关键词
function extractKeywords(text) {
  // 移除标点符号和停用词
  const stopWords = ['的', '了', '是', '在', '有', '和', '就', '都', '而', '及', '与', '或', '但', '然后', '这个', '那个', '一个', '可以', '我们', '你们', '他们'];
  const words = text.replace(/[，。！？；：""''（）【】\s]/g, ' ')
                   .split(/\s+/)
                   .filter(word => word.length >= 2 && !stopWords.includes(word))
                   .slice(0, 10); // 取前10个关键词
  return words;
}

// 关键词匹配搜索（短视频优化版）
function searchByKeywords(keywords, subtitleData, isShortVideo = false) {
  let bestMatch = { found: false, similarity: 0 };

  // 🎯 短视频优化：动态调整窗口大小
  const maxWindowSize = isShortVideo ? Math.min(4, Math.floor(subtitleData.length / 3)) : 6;
  console.log(`  关键词匹配窗口范围: 1-${maxWindowSize}句`);

  // 🎯 使用滑动窗口（1-6句或更小）
  for (let windowSize = 1; windowSize <= maxWindowSize; windowSize++) {
    for (let i = 0; i <= subtitleData.length - windowSize; i++) {
      const candidate = subtitleData.slice(i, i + windowSize);
      const candidateText = candidate.map(s => s.content).join('');

      let matchCount = 0;
      keywords.forEach(keyword => {
        if (candidateText.includes(keyword)) {
          matchCount++;
        }
      });

      const matchRate = matchCount / keywords.length;
      // 🎯 短视频优化：提高阈值到25%
      const threshold = isShortVideo ? 0.25 : 0.2;
      if (matchRate > threshold && matchRate > bestMatch.similarity) {
        bestMatch = {
          startIndex: i,
          sentences: candidate.slice(0, Math.min(5, candidate.length)),
          startTime: formatSecondsToTime(candidate[0].from),
          startSeconds: Math.floor(candidate[0].from),
          similarity: matchRate,
          found: true,
          method: 'keyword'
        };
      }
    }
  }
  return bestMatch;
}

// 文本片段匹配（短视频优化版）
function searchByTextFragments(cleanText, subtitleData, isShortVideo = false) {
  // 将原文分成小片段
  const fragments = cleanText.substring(0, 200).split(/[，。！？；：]/).filter(f => f.trim().length > 5);
  let bestMatch = { found: false, similarity: 0 };

  // 🎯 短视频优化：减小窗口大小
  const windowSize = isShortVideo ? Math.min(10, Math.floor(subtitleData.length / 2)) : 15;
  console.log(`  文本片段匹配窗口大小: ${windowSize}句`);

  for (let i = 0; i < subtitleData.length - 3; i++) {
    const candidate = subtitleData.slice(i, i + windowSize);
    const candidateText = candidate.map(s => s.content).join('');

    let matchCount = 0;
    fragments.forEach(fragment => {
      if (candidateText.includes(fragment.trim())) {
        matchCount++;
      }
    });

    const matchRate = matchCount / fragments.length;
    // 🎯 短视频优化：提高阈值到45%
    const threshold = isShortVideo ? 0.45 : 0.4;
    if (matchRate >= threshold && matchRate > bestMatch.similarity) {
      bestMatch = {
        startIndex: i,
        sentences: candidate.slice(0, Math.min(5, candidate.length)),
        startTime: formatSecondsToTime(candidate[0].from),
        startSeconds: Math.floor(candidate[0].from),
        similarity: matchRate,
        found: true,
        method: 'fragment'
      };
    }
  }
  return bestMatch;
}

// 模糊匹配（短视频优化版）
function searchByFuzzyMatch(cleanText, subtitleData, isShortVideo = false) {
  const searchText = cleanText.substring(0, 100); // 只用前100字符
  let bestMatch = { found: false, similarity: 0 };

  // 🎯 短视频优化：动态调整窗口大小
  const minWindowSize = isShortVideo ? 2 : 3;
  const maxWindowSize = isShortVideo ? Math.min(5, Math.floor(subtitleData.length / 3)) : 8;
  console.log(`  模糊匹配窗口范围: ${minWindowSize}-${maxWindowSize}句`);

  // 🎯 使用滑动窗口
  for (let windowSize = minWindowSize; windowSize <= maxWindowSize; windowSize++) {
    for (let i = 0; i <= subtitleData.length - windowSize; i++) {
      const candidate = subtitleData.slice(i, i + windowSize);
      const candidateText = candidate.map(s => s.content).join('');

      const similarity = calculateTextSimilarity(searchText, candidateText);
      // 🎯 短视频优化：提高阈值到25%
      const threshold = isShortVideo ? 0.25 : 0.2;
      if (similarity > threshold && similarity > bestMatch.similarity) {
        bestMatch = {
          startIndex: i,
          sentences: candidate.slice(0, Math.min(5, candidate.length)),
          startTime: formatSecondsToTime(candidate[0].from),
          startSeconds: Math.floor(candidate[0].from),
          similarity: similarity,
          found: true,
          method: 'fuzzy'
        };
      }
    }
  }
  return bestMatch;
}

// 计算文本相似度（优化中文版）
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

  // 计算连续子串匹配度
  let substringMatches = 0;
  const minLength = Math.min(text1.length, text2.length);

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

// 格式化秒数为时间戳
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

// HTML转义函数（防止XSS攻击）
function escapeHtml(str='') {
  return str.replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}

// 显示TIPS结果
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
    // 调试模式：显示详细信息
    displayDebugTipsResults(sortedResults, successCount, successRate, tipsContent, tipsResult);
  } else {
    // 产品模式：简洁的时间戳+摘要界面
    displayProductTipsResults(sortedResults, successCount, successRate, tipsContent, tipsResult);
  }
}

// 产品模式：简洁界面
function displayProductTipsResults(results, successCount, successRate, tipsContent, tipsResult) {
  let html = `
    <div style="margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
      <h4 style="margin: 0 0 10px 0; color: #1976d2;">🎯 视频智能导航 (${results.length}个要点)</h4>
      <p style="margin: 5px 0; color: #666; font-size: 14px;">
        点击时间戳可直接跳转到对应视频位置
      </p>
    </div>
  `;

  results.forEach((item, index) => {
    const isFound = item.location && item.location.found;

    if (isFound) {
      // 成功定位的TIPS：显示为可点击的时间戳+摘要
      html += `
        <div class="tip-item" style="cursor: pointer; transition: all 0.3s;" data-seconds="${item.location.startSeconds}">
          <div style="display: flex; align-items: flex-start; gap: 15px;">
            <div class="tip-timestamp" data-seconds="${item.location.startSeconds}" style="flex-shrink: 0; font-size: 16px; font-weight: bold;">
              ${item.location.startTime}
            </div>
            <div style="flex: 1;">
              <div style="font-size: 15px; line-height: 1.5; color: #333;">
                ${item.tip}
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      // 未定位成功的TIPS：显示为普通摘要
      html += `
        <div class="tip-item" style="opacity: 0.7;">
          <div style="display: flex; align-items: flex-start; gap: 15px;">
            <div style="flex-shrink: 0; font-size: 16px; font-weight: bold; color: #999;">
              --:--
            </div>
            <div style="flex: 1;">
              <div style="font-size: 15px; line-height: 1.5; color: #666;">
                ${item.tip}
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
      <button data-toggle-debug="true" style="background: #f0f0f0; border: 1px solid #ddd; padding: 8px 16px; border-radius: 4px; font-size: 12px; cursor: pointer;">
        🔧 调试模式 (${successRate}% 成功率)
      </button>
    </div>
  `;

  tipsContent.innerHTML = html;
  tipsResult.style.display = 'block';

  // 🎯 保存时间戳导航到缓存
  chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
    const currentTab = tabs[0];
    const bvidMatch = currentTab.url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
    const bvid = bvidMatch ? bvidMatch[1] : null;

    if (bvid) {
      const timestampsData = results
        .filter(item => item.location && item.location.found)
        .map(item => ({
          time: item.location.startSeconds,
          title: item.tip.substring(0, 100), // 限制长度
          description: item.tip
        }));

      if (timestampsData.length > 0) {
        try {
          await VideoCacheManager.updateTimestamps(bvid, timestampsData);
          console.log('✅ 时间戳导航已保存到缓存');
        } catch (error) {
          console.error('保存时间戳导航失败:', error);
        }
      }
    }
  });
}

// 调试模式：详细界面（保持原有的详细显示）
function displayDebugTipsResults(results, successCount, successRate, tipsContent, tipsResult) {
  let html = `
    <div style="margin-bottom: 20px; padding: 15px; background: #fff3cd; border-radius: 8px;">
      <h4 style="margin: 0 0 10px 0; color: #856404;">🔧 调试模式 - TIPS提取和定位结果 (${results.length}个)</h4>
      <p style="margin: 5px 0; color: #666; font-size: 14px;">
        <strong>说明：</strong>AI已根据视频时长和内容重要性，智能提取核心TIPS并定位时间戳
      </p>
      <p style="margin: 5px 0; color: #666; font-size: 13px;">
        定位成功率: ${successCount}/${results.length} (${successRate}%)
      </p>
      <button data-toggle-debug="true" style="background: #fb7299; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; margin-top: 8px;">
        切换到产品模式
      </button>
    </div>
  `;

  results.forEach((item, index) => {
    const isFound = item.location && item.location.found;
    html += `
      <div class="tip-item">
        <div class="tip-header">
          <div class="tip-number">${item.index}</div>
          <div style="flex: 1;">
            ${isFound ? '✅' : '❌'} TIP ${item.index}
            ${isFound ? `<span class="tip-timestamp" data-seconds="${item.location.startSeconds}">${item.location.startTime}</span>` : ''}
          </div>
        </div>

        <div class="tip-content">
          <strong>🎯 AI提取的TIP：</strong><br>
          ${item.tip}
        </div>

        <div class="tip-original">
          <strong>📝 AI给出的原文段落：</strong><br>
          ${item.originalText}
        </div>

        ${isFound ? `
          <div style="margin-top: 10px; padding: 10px; background: #e8f5e8; border-radius: 6px;">
            <strong>📍 定位结果：</strong><br>
            <div style="margin: 5px 0;">
              ${item.location.sentences.map(s => `<div style="margin: 2px 0; color: #2e7d32; font-size: 13px;"><strong>[${formatSecondsToTime(s.from)}]</strong> ${s.content}</div>`).join('')}
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 8px;">
              相似度: ${(item.location.similarity * 100).toFixed(1)}% |
              匹配方法: ${item.location.method || 'text'} |
              位置: 第${item.location.startIndex + 1}句开始
            </div>
          </div>
        ` : `
          <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 6px; color: #856404;">
            <strong>⚠️ 未找到匹配位置</strong><br>
            可能原因：AI给出的原文段落与实际字幕内容差异较大
          </div>
        `}
      </div>
    `;
  });

  tipsContent.innerHTML = html;
  tipsResult.style.display = 'block';
}

// 切换调试模式
function toggleDebugMode() {
  const currentMode = localStorage.getItem('tips-debug') === 'true';
  localStorage.setItem('tips-debug', (!currentMode).toString());

  // 重新显示结果
  if (window.lastTipsResults) {
    const tipsContent = document.getElementById('tips-content');
    const tipsResult = document.getElementById('tips-result');
    displayTipsResults(window.lastTipsResults, tipsContent, tipsResult);
  }
}



// 处理跳转响应
function handleJumpResponse(response, seconds) {
  if (response && response.success) {
    console.log('✅ 视频跳转成功');
    showJumpToast(`✅ 已跳转到 ${formatSecondsToTime(seconds)}`, 'success');
  } else {
    console.log('⚠️ 视频跳转可能失败，显示备用提示');
    showJumpToast(`⚠️ 跳转可能失败\n请手动拖拽进度条到 ${formatSecondsToTime(seconds)}`, 'warning');
  }
}

// 显示跳转提示Toast
function showJumpToast(message, type = 'info') {
  // 移除现有的toast
  const existingToast = document.getElementById('jump-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // 创建新的toast
  const toast = document.createElement('div');
  toast.id = 'jump-toast';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    font-weight: bold;
    z-index: 10000;
    max-width: 300px;
    word-wrap: break-word;
    white-space: pre-line;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: all 0.3s ease;
    transform: translateX(100%);
  `;

  // 根据类型设置颜色
  switch (type) {
    case 'success':
      toast.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
      break;
    case 'error':
      toast.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
      break;
    case 'warning':
      toast.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
      break;
    default:
      toast.style.background = 'linear-gradient(135deg, #2196F3, #1976D2)';
  }

  toast.textContent = message;
  document.body.appendChild(toast);

  // 动画显示
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 10);

  // 自动隐藏
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, type === 'error' ? 5000 : 3000);
}

// Calculate optimal TIPS count based on video duration
function calculateOptimalTipsCount(videoDurationMinutes) {
  if (videoDurationMinutes <= 15) return 3;
  if (videoDurationMinutes <= 30) return 4;
  if (videoDurationMinutes <= 45) return 5;
  if (videoDurationMinutes <= 60) return 6;
  if (videoDurationMinutes <= 90) return 8;
  if (videoDurationMinutes <= 120) return 10;
  return Math.min(12, Math.ceil(videoDurationMinutes / 12));
}

// Call AI API for TIPS generation (复用现有的API调用逻辑)
function callAIAPIForTips(subtitleText, videoTitle, videoDurationMinutes, suggestedTipsCount) {
  const generateTipsBtn = document.getElementById('generate-tips-btn');
  const tipsResult = document.getElementById('tips-result');
  const tipsContent = document.getElementById('tips-content');

  // Get settings from storage
  chrome.storage.sync.get(['settings'], function(result) {
    const settings = result.settings || {};
    const aiProvider = settings.aiProvider || 'gemini';

    // 获取当前服务商的配置
    const providerSettings = settings.providers && settings.providers[aiProvider];
    const apiKey = providerSettings?.apiKey || settings.apiKey || settings.geminiApiKey;
    const config = getDefaultConfig(aiProvider);
    const modelId = providerSettings?.modelId || settings.modelId || config.model;
    const apiBaseUrl = providerSettings?.apiBaseUrl || settings.apiBaseUrl || config.baseUrl;

    if (!apiKey || !modelId || !apiBaseUrl) {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('请先在设置中配置AI服务');
      return;
    }

    // Prepare TIPS generation prompt
    const prompt = `分析${videoDurationMinutes}分钟的视频字幕，提取${suggestedTipsCount}个最重要且有代表性的核心TIPS。

视频标题：${videoTitle}
字幕内容：
${subtitleText.substring(0, 15000)}

要求：
1. 优先提取重要观点和关键信息，包含具体信息（产品名、数字、性能数据、关键概念等）
2. 适当考虑信息完整性，最好让每个时间段都有所兼顾
3. 对重要观点分布较多的时段，可以增加更多权重，提取更多TIPS
4. 如果某个时段确实缺乏重要内容可以跳过，但尽量避免所有TIPS都集中在前半段
5. 原文段落必须是连续时间的3-4句话，时间跨度不超过30秒

视频总时长：${videoDurationMinutes}分钟
建议时间分布参考（可灵活调整）：
- 前1/3时段：可提取${Math.ceil(suggestedTipsCount*0.4)}个TIPS
- 中1/3时段：可提取${Math.ceil(suggestedTipsCount*0.4)}个TIPS
- 后1/3时段：可提取${Math.floor(suggestedTipsCount*0.2)}个TIPS

格式：
TIP1: [具体要点]
原文段落: "[时间戳] 内容1 [时间戳] 内容2 [时间戳] 内容3"

TIP2: [具体要点]
原文段落: "[时间戳] 内容1 [时间戳] 内容2 [时间戳] 内容3"

...（共${suggestedTipsCount}个TIPS）`;

    // Call different APIs based on provider (复用现有逻辑)
    if (aiProvider === 'gemini') {
      callGeminiAPIForTips(prompt, apiKey, modelId, apiBaseUrl, generateTipsBtn, tipsContent, tipsResult);
    } else if (aiProvider === 'siliconflow') {
      callSiliconFlowAPIForTips(prompt, apiKey, modelId, apiBaseUrl, generateTipsBtn, tipsContent, tipsResult);
    } else {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('不支持的AI服务商：' + aiProvider);
    }
  });
}

// Call AI API for TIPS generation (复用现有的API调用逻辑)
function callAIAPIForTips(subtitleText, videoTitle, videoDurationMinutes, suggestedTipsCount) {
  const generateTipsBtn = document.getElementById('generate-tips-btn');
  const tipsResult = document.getElementById('tips-result');
  const tipsContent = document.getElementById('tips-content');

  // Get settings from storage
  chrome.storage.sync.get(['settings'], function(result) {
    const settings = result.settings || {};
    const aiProvider = settings.aiProvider || 'gemini';

    // 获取当前服务商的配置
    const providerSettings = settings.providers && settings.providers[aiProvider];
    const apiKey = providerSettings?.apiKey || settings.apiKey || settings.geminiApiKey;
    const config = getDefaultConfig(aiProvider);
    const modelId = providerSettings?.modelId || settings.modelId || config.model;
    const apiBaseUrl = providerSettings?.apiBaseUrl || settings.apiBaseUrl || config.baseUrl;

    if (!apiKey || !modelId || !apiBaseUrl) {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('请先在设置中配置AI服务');
      return;
    }

    // 智能采样字幕文本，确保覆盖整个视频时长
    const sampledText = sampleSubtitleTextForBilibili(window.currentSubtitleData, videoDurationMinutes, 25000);

    // Prepare TIPS generation prompt（应用YouTube助手的优化）
    const prompt = `分析${videoDurationMinutes}分钟的视频字幕，提取${suggestedTipsCount}个最重要且有代表性的核心TIPS。

🚨 CRITICAL: 必须严格按照时间分布要求，绝对不能所有TIPS都集中在前半段！

视频标题：${videoTitle}

字幕内容：
${sampledText}

📍 强制时间分布要求（必须严格遵守）：
- 前1/3时段(0-${Math.floor(videoDurationMinutes/3)}分钟)：必须提取${Math.ceil(suggestedTipsCount*0.35)}个TIPS
- 中1/3时段(${Math.floor(videoDurationMinutes/3)}-${Math.floor(videoDurationMinutes*2/3)}分钟)：必须提取${Math.ceil(suggestedTipsCount*0.35)}个TIPS
- 后1/3时段(${Math.floor(videoDurationMinutes*2/3)}-${videoDurationMinutes}分钟)：必须提取${Math.floor(suggestedTipsCount*0.3)}个TIPS

🎯 具体时间段要求：
- 第1段：0-${Math.floor(videoDurationMinutes/3)}分钟 → ${Math.ceil(suggestedTipsCount*0.35)}个TIPS
- 第2段：${Math.floor(videoDurationMinutes/3)}-${Math.floor(videoDurationMinutes*2/3)}分钟 → ${Math.ceil(suggestedTipsCount*0.35)}个TIPS
- 第3段：${Math.floor(videoDurationMinutes*2/3)}-${videoDurationMinutes}分钟 → ${Math.floor(suggestedTipsCount*0.3)}个TIPS

⚠️ 重要提醒：
1. 必须从每个时间段都提取TIPS，不能跳过任何时间段
2. 即使后半段内容看似不重要，也必须提取相应数量的TIPS
3. 优先提取重要观点，但时间分布是硬性要求
4. 原文段落必须是连续时间的3-4句话，时间跨度不超过30秒
5. 每个TIPS必须包含具体信息（数字、概念、方法等）

请按以下JSON格式返回：
{
  "tips": [
    {
      "tip": "TIP的核心内容描述",
      "original_text": "对应的原文段落（用于时间戳定位）"
    }
  ]
}

🔥 最后检查：确保${Math.floor(suggestedTipsCount*0.3)}个TIPS来自${Math.floor(videoDurationMinutes*2/3)}-${videoDurationMinutes}分钟时段！`;

    // Call different APIs based on provider (复用现有逻辑)
    if (aiProvider === 'gemini') {
      callGeminiAPIForTips(prompt, apiKey, modelId, apiBaseUrl, generateTipsBtn, tipsContent, tipsResult);
    } else if (aiProvider === 'siliconflow') {
      callSiliconFlowAPIForTips(prompt, apiKey, modelId, apiBaseUrl, generateTipsBtn, tipsContent, tipsResult);
    } else {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('不支持的AI服务商：' + aiProvider);
    }
  });
}

// Calculate optimal TIPS count based on video duration
function calculateOptimalTipsCount(videoDurationMinutes) {
  if (videoDurationMinutes <= 15) return 3;
  if (videoDurationMinutes <= 30) return 4;
  if (videoDurationMinutes <= 45) return 5;
  if (videoDurationMinutes <= 60) return 6;
  if (videoDurationMinutes <= 90) return 8;
  if (videoDurationMinutes <= 120) return 10;
  return Math.min(12, Math.ceil(videoDurationMinutes / 12));
}

// 智能采样字幕文本，确保覆盖整个视频时长（移植自YouTube助手）
function sampleSubtitleTextForBilibili(subtitleData, videoDurationMinutes, maxLength) {
  if (!subtitleData || subtitleData.length === 0) return '';

  const totalDuration = subtitleData[subtitleData.length - 1].to;
  const fullText = subtitleData.map(s => `[${formatSecondsToTime(s.from)}] ${s.content}`).join('\n');

  // 如果全文长度在限制内，直接返回
  if (fullText.length <= maxLength) {
    return fullText;
  }

  // 分段采样：确保前、中、后三段都有内容
  const segments = [];
  const segmentCount = 6; // 分成6段，确保覆盖均匀

  for (let i = 0; i < segmentCount; i++) {
    const startTime = (totalDuration / segmentCount) * i;
    const endTime = (totalDuration / segmentCount) * (i + 1);

    // 找到这个时间段的字幕
    const segmentSubtitles = subtitleData.filter(s => s.from >= startTime && s.to <= endTime);

    if (segmentSubtitles.length > 0) {
      // 从这个时间段采样一些字幕
      const sampleSize = Math.max(3, Math.floor(segmentSubtitles.length / 3));
      const sampledItems = [];

      for (let j = 0; j < sampleSize && j < segmentSubtitles.length; j++) {
        const index = Math.floor((j / sampleSize) * segmentSubtitles.length);
        sampledItems.push(segmentSubtitles[index]);
      }

      const segmentText = sampledItems.map(s => `[${formatSecondsToTime(s.from)}] ${s.content}`).join('\n');
      segments.push(`\n=== ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2,'0')}-${Math.floor(endTime/60)}:${String(Math.floor(endTime%60)).padStart(2,'0')} 时段 ===\n${segmentText}`);
    }
  }

  let result = segments.join('\n');

  // 如果还是太长，进一步压缩
  if (result.length > maxLength) {
    result = result.substring(0, maxLength) + '\n...(字幕内容已截断，但已覆盖整个视频时长)';
  }

  return result;
}

// Call AI API for TIPS generation
function callAIAPIForTips(subtitleText, videoTitle, videoDurationMinutes, suggestedTipsCount) {
  const generateTipsBtn = document.getElementById('generate-tips-btn');
  const tipsResult = document.getElementById('tips-result');
  const tipsContent = document.getElementById('tips-content');

  // Get settings from storage
  chrome.storage.sync.get(['settings'], function(result) {
    const settings = result.settings || {};
    const aiProvider = settings.aiProvider || 'gemini';

    // 获取当前服务商的配置
    const providerSettings = settings.providers && settings.providers[aiProvider];
    const apiKey = providerSettings?.apiKey || settings.apiKey || settings.geminiApiKey;
    const config = getDefaultConfig(aiProvider);
    const modelId = providerSettings?.modelId || settings.modelId || config.model;
    const apiBaseUrl = providerSettings?.apiBaseUrl || settings.apiBaseUrl || config.baseUrl;

    console.log('TIPS生成 - 当前服务商:', aiProvider);

    if (!apiKey) {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('请先在设置中配置API密钥');
      return;
    }

    if (!modelId) {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('请先在设置中配置模型ID');
      return;
    }

    if (!apiBaseUrl) {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('请先在设置中配置API Base URL');
      return;
    }

    // 智能采样字幕文本，确保覆盖整个视频时长
    const sampledText = sampleSubtitleTextForBilibili(window.currentSubtitleData, videoDurationMinutes, 25000);

    // Prepare TIPS generation prompt（应用YouTube助手的优化）
    const prompt = `分析${videoDurationMinutes}分钟的视频字幕，提取${suggestedTipsCount}个最重要且有代表性的核心TIPS。

🚨 CRITICAL: 必须严格按照时间分布要求，绝对不能所有TIPS都集中在前半段！

字幕内容：
${sampledText}

📍 强制时间分布要求（必须严格遵守）：
- 前1/3时段(0-${Math.floor(videoDurationMinutes/3)}分钟)：必须提取${Math.ceil(suggestedTipsCount*0.35)}个TIPS
- 中1/3时段(${Math.floor(videoDurationMinutes/3)}-${Math.floor(videoDurationMinutes*2/3)}分钟)：必须提取${Math.ceil(suggestedTipsCount*0.35)}个TIPS
- 后1/3时段(${Math.floor(videoDurationMinutes*2/3)}-${videoDurationMinutes}分钟)：必须提取${Math.floor(suggestedTipsCount*0.3)}个TIPS

🎯 具体时间段要求：
- 第1段：0-${Math.floor(videoDurationMinutes/3)}分钟 → ${Math.ceil(suggestedTipsCount*0.35)}个TIPS
- 第2段：${Math.floor(videoDurationMinutes/3)}-${Math.floor(videoDurationMinutes*2/3)}分钟 → ${Math.ceil(suggestedTipsCount*0.35)}个TIPS
- 第3段：${Math.floor(videoDurationMinutes*2/3)}-${videoDurationMinutes}分钟 → ${Math.floor(suggestedTipsCount*0.3)}个TIPS

⚠️ 重要提醒：
1. 必须从每个时间段都提取TIPS，不能跳过任何时间段
2. 即使后半段内容看似不重要，也必须提取相应数量的TIPS
3. 优先提取重要观点，但时间分布是硬性要求
4. 原文段落必须是连续时间的3-4句话，时间跨度不超过30秒
5. 每个TIPS必须包含具体信息（数字、概念、方法等）

请按以下JSON格式返回：
{
  "tips": [
    {
      "tip": "TIP的核心内容描述",
      "original_text": "对应的原文段落（用于时间戳定位）"
    }
  ]
}

🔥 最后检查：确保${Math.floor(suggestedTipsCount*0.3)}个TIPS来自${Math.floor(videoDurationMinutes*2/3)}-${videoDurationMinutes}分钟时段！
注意：original_text必须是字幕中的真实原文，用于后续算法精确定位时间戳。`;

    console.log('TIPS生成Prompt长度:', prompt.length);

    // Call different APIs based on provider
    if (aiProvider === 'gemini') {
      callGeminiAPIForTips(prompt, apiKey, modelId, apiBaseUrl, generateTipsBtn, tipsContent, tipsResult);
    } else if (aiProvider === 'siliconflow') {
      callSiliconFlowAPIForTips(prompt, apiKey, modelId, apiBaseUrl, generateTipsBtn, tipsContent, tipsResult);
    } else {
      generateTipsBtn.textContent = '✨ 生成智能导航';
      generateTipsBtn.disabled = false;
      alert('不支持的AI服务商：' + aiProvider);
    }
  });
}

// 确保jumpToTime函数可用的备用方案
window.addEventListener('load', function() {
  console.log('🔧 Popup页面加载完成，检查jumpToTime函数');
  console.log('jumpToTime函数状态:', typeof jumpToTime);

  // 如果jumpToTime不存在，创建一个简单版本
  if (typeof jumpToTime === 'undefined') {
    console.log('⚠️ jumpToTime函数未定义，创建备用版本');
    window.jumpToTime = function(seconds) {
      console.log('🎯 备用jumpToTime被调用，时间:', seconds, '秒');

      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) {
          console.error('未找到当前标签页');
          return;
        }

        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'JUMP_TO_TIME',
          seconds: seconds
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('视频跳转失败:', chrome.runtime.lastError.message);
            alert(`🎯 跳转到 ${Math.floor(seconds/60)}:${(seconds%60).toString().padStart(2,'0')}\n\n请手动拖拽进度条到此时间点`);
          } else if (response && response.success) {
            console.log('✅ 视频跳转成功');
          } else {
            console.log('⚠️ 视频跳转可能失败');
            alert(`🎯 跳转到 ${Math.floor(seconds/60)}:${(seconds%60).toString().padStart(2,'0')}\n\n如果没有自动跳转，请手动拖拽进度条到此时间点`);
          }
        });
      });
    };
    console.log('✅ 备用jumpToTime函数已创建');
  } else {
    console.log('✅ jumpToTime函数正常可用');
  }
});
