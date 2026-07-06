# 🎬 Video Viewer (视频智能助手)

一个专为 **YouTube** 和 **Bilibili (B站)** 视频页面打造的智能侧边栏浏览器插件。支持字幕提取与导出、时间戳点击跳转、视频音频一键下载，并接入 **Google Gemini** 与 **硅基流动 (SiliconFlow)** 实现 AI 视频摘要和多轮智能问答。

---

## ✨ 核心特性

- **🚀 双平台自动适配**
  - 智能识别当前活动标签页的视频，自动在侧边栏中加载 YouTube 或 Bilibili 对应的专用助手面板。

- **📝 字幕提取、搜索与多格式导出**
  - 自动获取并结构化呈现视频的全部字幕。
  - 支持快捷检索，在庞大的字幕文本中一键搜出关键句。
  - 支持一键导出为 **SRT (通用格式)**、**ASS (高级字幕)**、**VTT (Web格式)** 或 **TXT (纯文本)**，方便二次剪辑或归档。

- **🎯 时间戳点击跳转 (Click-to-Seek)**
  - 在侧边栏的字幕列表中，点击任意一行字幕对应的时间戳，视频播放器将立即、平滑地跳转到该画面，让“阅读视频”比看书更高效。

- **🎵 Bilibili 音频一键提取与下载**
  - 专为 B站 优化。自动提取当前视频流的最佳音质音频，并下载为标准 MP3/FLV 格式，随时随地离线收听。

- **🤖 AI 视频摘要与深度多轮对话**
  - **结构化总结**：自动提取长视频的章节大纲、核心观点与精简看点，让您在几十秒内速读数小时视频。
  - **多轮问答 (Q&A)**：支持基于视频内容的交互式聊天。针对视频中的细节继续提问，AI 将根据字幕上下文给出准确回答。
  - **支持的 AI 引擎**：
    - **Google Gemini** (推荐使用 `gemini-2.5-flash` 或 `gemini-1.5-pro`)
    - **硅基流动 (SiliconFlow)** (兼容主流大语言模型)

- **💾 本地大容量缓存管理**
  - 所有解析过的字幕、AI 总结内容均安全缓存于浏览器本地。二次打开同一视频时免去重复抓取和 API 调用限制，享受极致丝滑体验。支持一键清空管理。

---

## 🛠️ 技术栈

- **规范**：Chrome Extension Manifest V3 (最新版浏览器插件标准)
- **前端**：Vanilla HTML / Vanilla CSS / Modern Vanilla JavaScript (原生轻量，拒绝臃肿)
- **底层 API**：
  - `chrome.storage.sync` / `chrome.storage.local`：同步配置与本地大数据量内容缓存。
  - `chrome.sidePanel`：侧边栏原生无缝嵌入。
  - `Supadata API`：YouTube 字幕精准代理获取服务。

---

## 📦 安装方法

1. **下载本项目**
   - 克隆或下载本项目压缩包至本地并解压。
2. **打开扩展程序管理页面**
   - 在 Chrome 浏览器中访问 `chrome://extensions/`。
   - 或者点击浏览器右上角菜单 `扩展程序` -> `管理扩展程序`。
3. **开启“开发者模式”**
   - 勾选右上角的 **开发者模式** 开关。
4. **加载插件**
   - 点击左上角的 **加载已解压的扩展程序**。
   - 选择解压后的插件根目录（包含 `manifest.json` 的文件夹 `video-viewer`）。
5. **开启侧边栏**
   - 点击浏览器右上角工具栏的 `Video Viewer` 图标，或者在页面右键选择该插件，即可在侧边栏快速唤起。

> [!WARNING]
> **⚠️ 常见安装报错提示：“未找到清单文件（manifest.json）”？**
>
> **原因**：解压 zip 包时，解压软件通常会多嵌套一层名为 `video-viewer-main` 的外层文件夹。
>
> **解决方法**：点击“加载已解压的扩展程序”后，在弹出的文件选择框中，**双击点进内层文件夹**，选中那个可以直接看到 `manifest.json` 文件和 `bilibili`、`youtube` 文件夹的目录，然后点击右下角的“选择文件夹”即可！

---

## ⚙️ AI 配置指南

本插件不包含任何硬编码的私钥，所有 API Key 均由您自行配置并安全保存在本地。

1. **YouTube 字幕服务**：
   - 访问 [Supadata](https://dash.supadata.ai) 申请免费 API Key（每月 100 次免费额度）。
   - 将 Key 填入插件侧边栏设置中的 `Supadata API密钥`。
2. **AI 服务商**：
   - **Google Gemini**：前往 [Google AI Studio](https://aistudio.google.com/) 申请免费/付费 API Key，并在设置中填入对应的 API Key。可以使用默认的 Base URL 和模型（如 `gemini-2.5-flash`）。
   - **SiliconFlow**：前往 [硅基流动官网](https://siliconflow.cn/) 获取 API 密钥，选择您喜爱的模型填入 `模型ID` 并保存。

---

## 🔒 隐私与安全性

- **零敏感信息硬编码**：本项目开源代码中**绝对不包含**任何作者本人的私钥、开发凭证或 Token。
- **本地化存储**：用户输入的 API 密钥（Gemini API Key、SiliconFlow Key、Supadata Key）仅存储于浏览器沙盒内的 `chrome.storage`，绝不上传至任何第三方中间服务器。

---

## 🤝 贡献与反馈

欢迎提交 PR 或 Issue 来丰富此插件的功能！

- **GitHub 主页**: [@airp2018](https://github.com/airp2018)
