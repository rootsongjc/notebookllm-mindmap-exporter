chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'download') {
    chrome.downloads.download({ url: msg.url, filename: msg.filename }, () => {
      URL.revokeObjectURL(msg.url);
    });
  }
});