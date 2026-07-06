// Content script - runs on bilibili.com video pages
console.log('Bilibili Assistant content script loaded');

// 简单的视频信息获取
function getCurrentVideoInfo() {
  const url = window.location.href;
  const match = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  const bvid = match ? match[1] : '';
  
  const titleElement = document.querySelector('h1[title]') || 
                      document.querySelector('.video-title') ||
                      document.querySelector('title');
  
  const title = titleElement?.textContent?.trim() || 'Unknown Title';
  
  return { bvid, title, url };
}

// 获取字幕信息
async function getSubtitleInfo(bvid) {
  try {
    console.log('开始获取字幕信息，BVID:', bvid);

    // 先获取视频基本信息来得到aid和cid
    const videoInfoResponse = await fetch(
      `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
      {
        credentials: 'include',
        headers: {
          'Referer': 'https://www.bilibili.com/',
          'User-Agent': navigator.userAgent,
        },
      }
    );

    const videoInfoData = await videoInfoResponse.json();
    if (videoInfoData.code !== 0 || !videoInfoData.data) {
      throw new Error('获取视频信息失败');
    }

    const aid = videoInfoData.data.aid;
    let cid = videoInfoData.data.cid;

    // 如果是多P视频，根据URL参数获取对应的cid
    if (videoInfoData.data.pages && videoInfoData.data.pages.length > 1) {
      const urlParams = new URLSearchParams(window.location.search);
      const p = urlParams.get('p') || '1';
      const pageIndex = parseInt(p) - 1;
      cid = videoInfoData.data.pages[pageIndex]?.cid || videoInfoData.data.pages[0].cid;
      console.log('多P视频，使用第', p, '页的CID:', cid);
    }

    console.log('获取到AID:', aid, 'CID:', cid);
    console.log('当前页面URL:', window.location.href);
    console.log('当前页面标题:', document.title);

    // 使用正确的API接口获取字幕信息
    const response = await fetch(
      `https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`,
      {
        credentials: 'include',
        headers: {
          'Referer': 'https://www.bilibili.com/',
          'User-Agent': navigator.userAgent,
        },
      }
    );

    const data = await response.json();
    console.log('字幕API响应:', data);

    if (data.code === 0 && data.data.subtitle?.subtitles) {
      console.log('找到字幕:', data.data.subtitle.subtitles.length, '个');
      return data.data.subtitle.subtitles;
    }

    console.log('API返回成功但无字幕数据');
    return [];
  } catch (error) {
    console.error('获取字幕信息失败:', error);
    return [];
  }
}

// 下载字幕内容
async function downloadSubtitleContent(subtitleUrl) {
  try {
    console.log('开始下载字幕内容，URL:', subtitleUrl);

    const response = await fetch(subtitleUrl);
    console.log('字幕内容响应状态:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('字幕内容数据:', data);

    if (data.body && Array.isArray(data.body)) {
      const subtitleItems = data.body.map(item => ({
        from: item.from,
        to: item.to,
        content: item.content,
      }));
      console.log('解析字幕条目数量:', subtitleItems.length);
      return subtitleItems;
    }

    console.log('字幕数据格式不正确');
    return [];
  } catch (error) {
    console.error('下载字幕内容失败:', error);
    return [];
  }
}

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content: 收到消息:', message);

  switch (message.type) {
    case 'GET_VIDEO_INFO':
      console.log('Content: 处理GET_VIDEO_INFO请求');
      const videoInfo = getCurrentVideoInfo();
      sendResponse(videoInfo);
      break;

    case 'GET_SUBTITLE_INFO':
      console.log('Content: 处理GET_SUBTITLE_INFO请求，BVID:', message.bvid);
      getSubtitleInfo(message.bvid).then(subtitles => {
        console.log('Content: 字幕获取完成，发送响应:', subtitles);
        sendResponse({ subtitles });
      }).catch(error => {
        console.error('Content: 字幕获取失败:', error);
        sendResponse({ error: error.message });
      });
      return true; // 保持消息通道开放

    case 'DOWNLOAD_SUBTITLE_CONTENT':
      console.log('Content: 处理DOWNLOAD_SUBTITLE_CONTENT请求，URL:', message.url);
      downloadSubtitleContent(message.url).then(content => {
        console.log('Content: 字幕内容下载完成，条目数:', content.length);
        sendResponse({ content });
      }).catch(error => {
        console.error('Content: 字幕内容下载失败:', error);
        sendResponse({ error: error.message });
      });
      return true; // 保持消息通道开放

    case 'DOWNLOAD_AUDIO':
      console.log('Content: 处理DOWNLOAD_AUDIO请求，质量:', message.quality, '格式:', message.format);
      downloadAudio(message.quality, message.format).then(result => {
        console.log('Content: 音频下载完成');
        sendResponse({ success: true, ...result });
      }).catch(error => {
        console.error('Content: 音频下载失败:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // 保持消息通道开放

    case 'JUMP_TO_TIME':
      console.log('Content: 处理JUMP_TO_TIME请求，时间:', message.seconds, '秒');

      // 超简单的跳转方法
      try {
        const video = document.querySelector('video');
        if (video) {
          console.log('找到视频，当前时间:', video.currentTime, '目标时间:', message.seconds);

          // 直接设置时间
          video.currentTime = message.seconds;

          // 立即返回成功（不等待）
          console.log('视频跳转命令已执行');
          sendResponse({ success: true });
        } else {
          console.log('未找到视频元素');
          sendResponse({ success: false });
        }
      } catch (error) {
        console.error('跳转失败:', error);
        sendResponse({ success: false });
      }
      break;

    default:
      console.log('Content: 未知消息类型:', message.type);
  }
});

// 下载音频
async function downloadAudio(quality = 'best', format = 'mp3') {
  try {
    console.log('开始下载音频，使用最佳可用质量');

    // 获取当前页面的视频信息
    const currentUrl = window.location.href;
    console.log('当前页面URL:', currentUrl);

    // 获取BVID
    const bvidMatch = currentUrl.match(/\/video\/(BV[a-zA-Z0-9]+)/);
    if (!bvidMatch) {
      throw new Error('无法获取视频BVID');
    }
    const bvid = bvidMatch[1];

    // 获取当前页面参数（P参数）
    const urlParams = new URLSearchParams(window.location.search);
    const p = urlParams.get('p') || '1';
    console.log('当前页面P参数:', p);

    // 先获取视频基本信息来得到正确的aid和cid
    const videoInfoResponse = await fetch(
      `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
      {
        credentials: 'include',
        headers: {
          'Referer': 'https://www.bilibili.com/',
          'User-Agent': navigator.userAgent,
        },
      }
    );

    const videoInfoData = await videoInfoResponse.json();
    if (videoInfoData.code !== 0 || !videoInfoData.data) {
      throw new Error('获取视频信息失败');
    }

    const aid = videoInfoData.data.aid;
    const pageIndex = parseInt(p) - 1;
    const currentPage = videoInfoData.data.pages[pageIndex] || videoInfoData.data.pages[0];
    const cid = currentPage.cid;

    console.log('视频信息 - AID:', aid, 'CID:', cid, '页面:', p);
    console.log('当前页面信息:', currentPage);

    // 获取播放信息
    const playInfoResponse = await fetch(
      `https://api.bilibili.com/x/player/playurl?avid=${aid}&cid=${cid}&qn=80&fnval=16&fourk=1`,
      {
        credentials: 'include',
        headers: {
          'Referer': 'https://www.bilibili.com/',
          'User-Agent': navigator.userAgent,
        },
      }
    );

    const playInfo = await playInfoResponse.json();
    console.log('获取到播放信息:', playInfo);

    if (playInfo.code !== 0 || !playInfo.data) {
      throw new Error('获取播放信息失败: ' + (playInfo.message || '未知错误'));
    }

    let audioStreams = [];

    // 检查不同的音频流格式
    if (playInfo.data.dash && playInfo.data.dash.audio) {
      audioStreams = playInfo.data.dash.audio;
      console.log('使用DASH音频流');
    } else if (playInfo.data.durl && playInfo.data.durl.length > 0) {
      // 如果没有DASH，尝试使用durl（可能是老格式或特殊情况）
      console.log('使用DURL格式，可能包含音视频混合流');
      // 对于durl格式，我们需要不同的处理方式
      const videoUrl = playInfo.data.durl[0].url;
      return await downloadMixedAudio(videoUrl, currentPage.part || videoInfoData.data.title, quality, format);
    } else {
      throw new Error('无法获取音频流信息，可能是付费内容或地区限制');
    }

    if (!audioStreams || audioStreams.length === 0) {
      throw new Error('没有可用的音频流');
    }

    console.log('可用音频流:', audioStreams);

    // 打印所有可用音频流信息
    console.log('=== 音频流分析 ===');
    console.log(`总共找到 ${audioStreams.length} 个音频流:`);
    audioStreams.forEach((stream, index) => {
      const bandwidthKbps = Math.round(stream.bandwidth / 1000);
      console.log(`音频流 ${index + 1}:`, {
        id: stream.id,
        bandwidth: `${stream.bandwidth} bps (${bandwidthKbps} kbps)`,
        codecs: stream.codecs,
        quality: stream.quality || 'unknown',
        size: stream.size || 'unknown',
        url: (stream.baseUrl || stream.base_url || '').substring(0, 100) + '...'
      });
    });

    // 选择最佳可用音频流（最高带宽）
    const selectedAudio = audioStreams.reduce((prev, current) => {
      return (current.bandwidth > prev.bandwidth) ? current : prev;
    });

    console.log('✅ 自动选择最佳音频流（最高带宽）');

    const selectedBandwidthKbps = Math.round(selectedAudio.bandwidth / 1000);
    console.log('=== 最终选择 ===');
    console.log('选择的音频流:', {
      id: selectedAudio.id,
      bandwidth: `${selectedAudio.bandwidth} bps (${selectedBandwidthKbps} kbps)`,
      codecs: selectedAudio.codecs,
      quality: `${selectedBandwidthKbps} kbps`
    });

    console.log('选择的音频流:', selectedAudio);

    // 获取视频标题（优先使用API返回的标题）
    let title = videoInfoData.data.title;

    // 如果是多P视频，添加分P标题
    if (videoInfoData.data.pages.length > 1) {
      const partTitle = currentPage.part || `P${p}`;
      title = `${title} - ${partTitle}`;
    }

    console.log('视频标题:', title);

    // 清理文件名
    const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 150);

    // 下载音频文件
    const audioUrl = selectedAudio.baseUrl || selectedAudio.base_url;
    console.log('音频下载地址:', audioUrl);

    const response = await fetch(audioUrl, {
      headers: {
        'Referer': 'https://www.bilibili.com/',
        'User-Agent': navigator.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`);
    }

    const blob = await response.blob();
    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    console.log('音频文件大小:', blob.size, 'bytes (', fileSizeMB, 'MB)');

    // 创建下载链接
    const downloadUrl = URL.createObjectURL(blob);
    const filename = `${cleanTitle}_${selectedBandwidthKbps}kbps.mp3`;

    console.log('准备下载文件:', filename);

    // 触发下载
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 清理URL
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 1000);

    return {
      filename: filename,
      size: blob.size,
      sizeMB: fileSizeMB,
      quality: selectedBandwidthKbps,
      format: 'mp3',
      bandwidth: selectedAudio.bandwidth,
      audioId: selectedAudio.id
    };

  } catch (error) {
    console.error('音频下载失败:', error);
    throw error;
  }
}

// 处理混合音视频流下载（durl格式）
async function downloadMixedAudio(videoUrl, title, quality, format) {
  try {
    console.log('下载混合流音频，URL:', videoUrl);

    // 清理文件名
    const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 150);

    // 下载文件
    const response = await fetch(videoUrl, {
      headers: {
        'Referer': 'https://www.bilibili.com/',
        'User-Agent': navigator.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`);
    }

    const blob = await response.blob();
    console.log('混合流文件大小:', blob.size);

    // 创建下载链接
    const downloadUrl = URL.createObjectURL(blob);
    const filename = `${cleanTitle}_${quality}kbps_mixed.${format === 'mp3' ? 'flv' : 'flv'}`;

    // 触发下载
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 清理URL
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 1000);

    return {
      filename: filename,
      size: blob.size,
      quality: quality,
      format: 'mixed',
      note: '下载的是音视频混合文件，可使用音频提取工具提取音频'
    };

  } catch (error) {
    console.error('混合流下载失败:', error);
    throw error;
  }
}

// 视频跳转控制 - 模拟用户操作版
function jumpToVideoTime(seconds) {
  try {
    console.log('=== 开始视频跳转（模拟用户操作）===');
    console.log('目标时间:', seconds, '秒');
    console.log('格式化时间:', formatSecondsToTime(seconds));

    // 多层次跳转策略
    return attemptVideoJump(seconds);
  } catch (error) {
    console.error('❌ 视频跳转异常:', error);
    return tryAlternativeJumpMethods(seconds);
  }
}

// 尝试视频跳转的多种方法
function attemptVideoJump(seconds) {
  console.log('🎯 尝试跳转方法1: 模拟点击进度条');
  if (simulateProgressBarClick(seconds)) {
    return true;
  }

  console.log('🎯 尝试跳转方法2: 直接设置currentTime + 事件触发');
  if (directVideoJumpWithEvents(seconds)) {
    return true;
  }

  console.log('🎯 尝试跳转方法3: 调用B站播放器API');
  if (callBilibiliPlayerAPI(seconds)) {
    return true;
  }

  console.log('🎯 尝试跳转方法4: 键盘快捷键模拟');
  if (simulateKeyboardSeek(seconds)) {
    return true;
  }

  console.log('❌ 所有跳转方法都失败，使用备用方案');
  return tryAlternativeJumpMethods(seconds);
}

// 方法1: 模拟点击进度条
function simulateProgressBarClick(seconds) {
  try {
    // B站进度条的可能选择器
    const progressSelectors = [
      '.bpx-player-progress-wrap',           // 新版播放器进度条容器
      '.bilibili-player-video-progress',     // 旧版播放器进度条
      '.bpx-player-progress',                // 进度条
      '.bilibili-player-video-progress-bar', // 进度条
      '.bpx-player-progress-schedule',       // 进度条轨道
      '[data-text="进度条"]',                // 通过data属性查找
      '.progress-bar',                       // 通用进度条
      '.video-progress'                      // 视频进度条
    ];

    let progressBar = null;
    let usedSelector = '';

    // 查找进度条元素
    for (const selector of progressSelectors) {
      progressBar = document.querySelector(selector);
      if (progressBar) {
        usedSelector = selector;
        console.log('✅ 找到进度条元素:', selector);
        break;
      }
    }

    if (!progressBar) {
      console.log('❌ 未找到进度条元素');
      return false;
    }

    // 获取视频元素以获取时长
    const video = document.querySelector('video');
    if (!video || !video.duration) {
      console.log('❌ 无法获取视频时长');
      return false;
    }

    // 计算点击位置
    const duration = video.duration;
    const percentage = Math.min(Math.max(seconds / duration, 0), 1);
    const rect = progressBar.getBoundingClientRect();
    const clickX = rect.left + (rect.width * percentage);
    const clickY = rect.top + (rect.height / 2);

    console.log('进度条信息:');
    console.log('- 视频时长:', duration, '秒');
    console.log('- 目标百分比:', (percentage * 100).toFixed(2), '%');
    console.log('- 点击坐标:', clickX.toFixed(2), clickY.toFixed(2));
    console.log('- 进度条尺寸:', rect.width, 'x', rect.height);

    // 创建鼠标事件序列（更真实的用户行为）
    const events = [
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: clickX,
        clientY: clickY,
        button: 0
      }),
      new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: clickX,
        clientY: clickY,
        button: 0
      }),
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: clickX,
        clientY: clickY,
        button: 0
      }),
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: clickX,
        clientY: clickY,
        button: 0
      })
    ];

    // 依次触发事件
    events.forEach((event, index) => {
      setTimeout(() => {
        progressBar.dispatchEvent(event);
        console.log(`触发事件 ${index + 1}/${events.length}:`, event.type);
      }, index * 50); // 50ms间隔，模拟真实操作
    });

    // 验证跳转是否成功
    setTimeout(() => {
      const currentTime = video.currentTime;
      const timeDiff = Math.abs(currentTime - seconds);
      console.log('跳转验证:');
      console.log('- 当前时间:', currentTime.toFixed(2), '秒');
      console.log('- 目标时间:', seconds, '秒');
      console.log('- 时间差:', timeDiff.toFixed(2), '秒');

      if (timeDiff < 2) { // 允许2秒误差
        console.log('✅ 进度条点击跳转成功');
      } else {
        console.log('⚠️ 进度条点击跳转可能不准确');
      }
    }, 500);

    return true;
  } catch (error) {
    console.error('进度条点击跳转失败:', error);
    return false;
  }
}

// 方法2: 直接设置currentTime + 事件触发
function directVideoJumpWithEvents(seconds) {
  try {
    const video = document.querySelector('video');
    if (!video) {
      console.log('❌ 未找到视频元素');
      return false;
    }

    console.log('尝试直接设置currentTime并触发事件');

    // 触发seeking事件
    video.dispatchEvent(new Event('seeking', { bubbles: true }));

    // 设置时间
    video.currentTime = seconds;

    // 触发timeupdate和seeked事件
    setTimeout(() => {
      video.dispatchEvent(new Event('timeupdate', { bubbles: true }));
      video.dispatchEvent(new Event('seeked', { bubbles: true }));
    }, 100);

    // 验证跳转
    setTimeout(() => {
      const timeDiff = Math.abs(video.currentTime - seconds);
      if (timeDiff < 1) {
        console.log('✅ 直接设置currentTime成功');
        return true;
      } else {
        console.log('❌ 直接设置currentTime失败');
        return false;
      }
    }, 300);

    return true;
  } catch (error) {
    console.error('直接设置currentTime失败:', error);
    return false;
  }
}

// 方法3: 调用B站播放器API
function callBilibiliPlayerAPI(seconds) {
  try {
    console.log('尝试调用B站播放器内部API');

    // 查找B站播放器对象
    const playerSelectors = [
      'window.player',
      'window.bilibiliPlayer',
      'window.__INITIAL_STATE__',
      'unsafeWindow.player'
    ];

    // 尝试通过全局对象访问播放器
    if (typeof window.player !== 'undefined' && window.player.seek) {
      console.log('找到window.player，调用seek方法');
      window.player.seek(seconds);
      return true;
    }

    // 尝试通过DOM查找播放器实例
    const playerElement = document.querySelector('.bilibili-player, .bpx-player');
    if (playerElement && playerElement._player && playerElement._player.seek) {
      console.log('找到播放器DOM实例，调用seek方法');
      playerElement._player.seek(seconds);
      return true;
    }

    // 尝试调用可能的播放器方法
    const possibleMethods = [
      'seekTo',
      'seek',
      'setCurrentTime',
      'jumpTo',
      'goTo'
    ];

    for (const method of possibleMethods) {
      if (typeof window[method] === 'function') {
        console.log(`找到全局方法 ${method}，尝试调用`);
        window[method](seconds);
        return true;
      }
    }

    console.log('❌ 未找到B站播放器API');
    return false;
  } catch (error) {
    console.error('调用B站播放器API失败:', error);
    return false;
  }
}

// 方法4: 键盘快捷键模拟
function simulateKeyboardSeek(seconds) {
  try {
    console.log('尝试键盘快捷键跳转');

    const video = document.querySelector('video');
    if (!video) {
      console.log('❌ 未找到视频元素');
      return false;
    }

    const currentTime = video.currentTime;
    const targetTime = seconds;
    const timeDiff = targetTime - currentTime;

    console.log(`当前时间: ${currentTime.toFixed(2)}秒，目标时间: ${targetTime}秒，差值: ${timeDiff.toFixed(2)}秒`);

    // 如果时间差太大，键盘跳转不实用
    if (Math.abs(timeDiff) > 60) {
      console.log('时间差太大，键盘跳转不适用');
      return false;
    }

    // 确保视频元素有焦点
    video.focus();

    // 使用左右箭头键跳转（每次5秒）
    const direction = timeDiff > 0 ? 'ArrowRight' : 'ArrowLeft';
    const steps = Math.abs(Math.round(timeDiff / 5));

    console.log(`使用${direction}键，跳转${steps}次`);

    for (let i = 0; i < steps; i++) {
      setTimeout(() => {
        const keyEvent = new KeyboardEvent('keydown', {
          key: direction,
          code: direction,
          bubbles: true,
          cancelable: true
        });
        video.dispatchEvent(keyEvent);

        const keyUpEvent = new KeyboardEvent('keyup', {
          key: direction,
          code: direction,
          bubbles: true,
          cancelable: true
        });
        video.dispatchEvent(keyUpEvent);
      }, i * 100);
    }

    return true;
  } catch (error) {
    console.error('键盘快捷键跳转失败:', error);
    return false;
  }
}

// 备用跳转方案
function tryAlternativeJumpMethods(seconds) {
  console.log('=== 尝试最后的备用跳转方案 ===');

  try {
    // 方案1：URL hash跳转
    const currentUrl = window.location.href;
    const baseUrl = currentUrl.split('#')[0].split('?')[0];
    const urlParams = new URLSearchParams(window.location.search);

    // 添加时间参数
    urlParams.set('t', Math.floor(seconds));
    const newUrl = baseUrl + '?' + urlParams.toString();

    console.log('尝试URL参数跳转:', newUrl);
    window.history.replaceState(null, '', newUrl);

    // 方案2：hash跳转
    window.location.hash = '#t=' + Math.floor(seconds);
    console.log('设置URL hash:', window.location.hash);

    // 方案3：延迟重试
    setTimeout(() => {
      const video = document.querySelector('video');
      if (video) {
        console.log('延迟重试直接设置currentTime');
        video.currentTime = seconds;

        // 强制触发事件
        video.dispatchEvent(new Event('seeking'));
        video.dispatchEvent(new Event('seeked'));
        video.dispatchEvent(new Event('timeupdate'));
      }
    }, 1000);

    console.log('⚠️ 使用备用方案，可能需要手动操作');
    return false;
  } catch (error) {
    console.error('备用方案也失败:', error);
    return false;
  }
}

// 格式化秒数为时间字符串
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

// 将jumpToVideoTime函数暴露到全局作用域，方便调试和测试
window.jumpToVideoTime = jumpToVideoTime;
window.simulateProgressBarClick = simulateProgressBarClick;
window.directVideoJumpWithEvents = directVideoJumpWithEvents;

console.log('✅ Content script 初始化完成');
console.log('🎯 视频跳转函数已注入到全局作用域');
console.log('可用的调试函数:');
console.log('- jumpToVideoTime(seconds)');
console.log('- simulateProgressBarClick(seconds)');
console.log('- directVideoJumpWithEvents(seconds)');

// 添加一个简单的测试函数
window.testVideoJump = function(seconds = 60) {
  console.log(`🧪 测试视频跳转到 ${seconds} 秒`);
  return jumpToVideoTime(seconds);
};
