# 🎬 Video Viewer

[简体中文](README.md) | [English](README_EN.md)

An intelligent browser side-panel extension built for **YouTube** and **Bilibili** video pages. It supports subtitle extraction and export, click-to-seek timestamps, one-click audio downloads, AI-powered video summaries, and multi-turn Q&A through **Google Gemini** and **SiliconFlow**.

---

## ✨ Key Features

- **🚀 Automatic support for two platforms**
  - Detects the video in the active tab and automatically loads the dedicated YouTube or Bilibili assistant in the side panel.

- **📝 Subtitle extraction, search, and multi-format export**
  - Automatically retrieves and displays the complete transcript in a structured format.
  - Quickly searches large transcripts for specific words or sentences.
  - Exports subtitles as **SRT**, **ASS**, **VTT**, or **TXT** for editing and archiving.

- **🎯 Click-to-seek timestamps**
  - Click any timestamp in the subtitle list to jump the video smoothly to that moment, making long videos much easier to browse and review.

- **🎵 One-click Bilibili audio extraction and download**
  - Optimized for Bilibili. Automatically extracts the best available audio stream and downloads it in MP3/FLV format for offline listening.

- **🤖 AI video summaries and multi-turn conversations**
  - **Structured summaries**: Extracts chapter outlines, key ideas, and concise highlights from long videos, helping you understand hours of content in minutes.
  - **Multi-turn Q&A**: Lets you ask follow-up questions about details in the video. The AI answers based on the subtitle context.
  - **Supported AI providers**:
    - **Google Gemini** (recommended models: `gemini-2.5-flash` or `gemini-1.5-pro`)
    - **SiliconFlow** (compatible with popular large language models)

- **💾 High-capacity local cache management**
  - Parsed subtitles and AI-generated summaries are stored securely in the browser. Reopening the same video avoids repeated subtitle requests and unnecessary API calls. Cached data can also be cleared with one click.

---

## 🛠️ Tech Stack

- **Standard**: Chrome Extension Manifest V3
- **Frontend**: Vanilla HTML, Vanilla CSS, and modern Vanilla JavaScript
- **Core APIs**:
  - `chrome.storage.sync` / `chrome.storage.local`: Synchronized settings and local storage for larger cached content.
  - `chrome.sidePanel`: Native browser side-panel integration.
  - `Supadata API`: Reliable proxy service for retrieving YouTube subtitles.

---

## 📦 Installation

1. **Download the project**
   - Clone this repository, or download and extract its ZIP archive.
2. **Open the extensions page**
   - Visit `chrome://extensions/` in Chrome.
   - Alternatively, open the browser menu and select `Extensions` → `Manage extensions`.
3. **Enable Developer mode**
   - Turn on **Developer mode** in the upper-right corner.
4. **Load the extension**
   - Click **Load unpacked** in the upper-left corner.
   - Select the extracted `video-viewer` directory that contains `manifest.json`.
5. **Open the side panel**
   - Click the `Video Viewer` icon in the browser toolbar, or use the extension from the page context menu to open it in the side panel.

> [!WARNING]
> **Seeing “Manifest file is missing or unreadable” during installation?**
>
> **Cause**: Extracting the ZIP archive often creates an extra outer directory named `video-viewer-main`.
>
> **Solution**: In the folder picker, open the inner directory and select the folder where `manifest.json`, `bilibili`, and `youtube` are directly visible. Then click **Select Folder**.

---

## ⚙️ AI Configuration

This extension contains no hard-coded private keys. You provide your own API keys, which are stored locally in your browser.

1. **YouTube subtitle service**
   - Visit [Supadata](https://dash.supadata.ai) to request a free API key (the free plan includes 100 requests per month).
   - Enter the key in the `Supadata API Key` field in the extension settings.
2. **AI providers**
   - **Google Gemini**: Get a free or paid API key from [Google AI Studio](https://aistudio.google.com/), then enter it in the extension settings. You can use the default Base URL and a model such as `gemini-2.5-flash`.
   - **SiliconFlow**: Get an API key from the [SiliconFlow website](https://siliconflow.cn/), enter your preferred model ID, and save the settings.

---

## 🔒 Privacy and Security

- **No hard-coded sensitive information**: The open-source code contains no private keys, developer credentials, or tokens belonging to the author.
- **Local storage**: API keys entered by the user—including Gemini, SiliconFlow, and Supadata keys—are stored only in the browser sandbox through `chrome.storage`. They are never uploaded to an intermediary server operated by this project.

---

## 🤝 Contributions and Feedback

Pull requests and issues are welcome!

- **GitHub**: [@airp2018](https://github.com/airp2018)
