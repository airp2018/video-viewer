console.log('Video Viewer background loaded');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';
const BAD_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function getDefaultSettings() {
  return {
    aiProvider: 'gemini',
    providers: {
      gemini: {
        apiBaseUrl: GEMINI_BASE_URL,
        apiKey: '',
        modelId: 'gemini-2.5-flash'
      }
    },
    apiBaseUrl: GEMINI_BASE_URL,
    apiKey: '',
    modelId: 'gemini-2.5-flash',
    supadataApiKey: ''
  };
}

function normalizeSettings(settings) {
  if (!settings) {
    return getDefaultSettings();
  }

  const nextSettings = {
    ...settings,
    providers: {
      ...(settings.providers || {})
    }
  };

  let changed = false;

  if (nextSettings.apiBaseUrl === BAD_GEMINI_BASE_URL) {
    nextSettings.apiBaseUrl = GEMINI_BASE_URL;
    changed = true;
  }

  if (nextSettings.providers.gemini) {
    const geminiSettings = {
      ...nextSettings.providers.gemini
    };

    if (geminiSettings.apiBaseUrl === BAD_GEMINI_BASE_URL) {
      geminiSettings.apiBaseUrl = GEMINI_BASE_URL;
      changed = true;
    }

    nextSettings.providers.gemini = geminiSettings;
  }

  return changed ? nextSettings : settings;
}

function ensureSettings() {
  chrome.storage.sync.get(['settings'], (result) => {
    const normalizedSettings = normalizeSettings(result.settings);

    if (normalizedSettings !== result.settings) {
      chrome.storage.sync.set({ settings: normalizedSettings });
    }
  });
}

ensureSettings();

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Video Viewer installed/updated:', details.reason);
  ensureSettings();
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId: tab.id });
      return;
    }
  } catch (error) {
    console.error('Video Viewer side panel failed:', error);
  }

  chrome.windows.create({
    url: chrome.runtime.getURL('router.html'),
    type: 'popup',
    width: 430,
    height: 720,
    focused: true
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'background_ok', timestamp: Date.now() });
    return false;
  }

  if (request.action === 'pageChanged') {
    console.log('Video Viewer page changed:', request.url);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  console.log('Video Viewer download created:', downloadItem.filename);
});

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    console.log('Video Viewer download completed:', delta.id);
  }
});
