chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'download') {
    chrome.downloads.download({ url: msg.url, filename: msg.filename });
    // 不在 background.js 里调用 URL.revokeObjectURL，避免 TypeError
    // 由 content script 或 popup 负责释放
  }
});