function getRootNodeName(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const mindmap = document.querySelector('.mindmap');
        if (!mindmap) return { error: 'No element with class="mindmap" found' };
        // Use the first node-name as root
        const root = mindmap.querySelector('text.node-name');
        return { rootName: root ? root.textContent.trim().replace(/:/g, ' -') : 'unknown' };
      }
    }).then(results => {
      if (!results[0].result || results[0].result.error) {
        callback('unknown');
      } else {
        callback(results[0].result.rootName || 'unknown');
      }
    });
  });
}

function getExportFilename(ext, rootName) {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const timeStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `notebookllm-${rootName}-${timeStr}.${ext}`;
}

const exportMarkdown = () => {
  getRootNodeName(rootName => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ["parser.js"]
      }).then(() => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            return {
              markdown: window.markdown,
              stats: window.exportStats
            };
          }
        }).then(results => {
           if (!results[0].result || results[0].result.error) {
             alert(results[0].result.error || 'Export failed');
             return;
           }
           const blob = new Blob([results[0].result.markdown], { type: 'text/markdown' });
           const filename = getExportFilename('md', rootName);
           
           // Create download link directly in popup
           const url = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = filename;
           document.body.appendChild(a);
           a.click();
           document.body.removeChild(a);
           URL.revokeObjectURL(url);

           // Show details in popup
            const stats = results[0].result.stats;
            if (stats) {
              alert(
                `Export completed!\n` +
                `Total nodes: ${stats.total}\n` +
                `Normal: ${stats.normal}\n` +
                `Missing parents: ${stats.missing}` +
                (stats.missingNames && stats.missingNames.length > 0 ? `\nAdded nodes: ${stats.missingNames.join(', ')}` : '')
              );
           }
        });
      });
    });
  });
};

const exportSVG = () => {
  getRootNodeName(rootName => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const mindmap = document.querySelector('.mindmap');
          if (!mindmap) return { error: 'No element with class="mindmap" found' };
          const svg = mindmap.querySelector('svg');
          if (!svg) return { error: 'No SVG element found' };
          // Clone SVG for modification
          const svgClone = svg.cloneNode(true);
          // Add < or > toggle button to each collapsible node
          svgClone.querySelectorAll('g.node').forEach(node => {
            const children = node.querySelectorAll('g');
            if (children.length > 0) {
              // Add toggle button
              const btn = document.createElementNS('http://www.w3.org/2000/svg', 'text');
              btn.setAttribute('x', 0);
              btn.setAttribute('y', 0);
              btn.setAttribute('class', 'toggle-btn');
              btn.setAttribute('font-size', '14');
              btn.setAttribute('fill', '#4f8cff');
              btn.style.cursor = 'pointer';
              btn.textContent = '<';
              btn.addEventListener('click', function(e) {
                e.stopPropagation();
                // Toggle child node display
                const collapsed = node.getAttribute('data-collapsed') === 'true';
                node.setAttribute('data-collapsed', !collapsed);
                children.forEach(child => {
                  child.style.display = collapsed ? '' : 'none';
                });
                btn.textContent = collapsed ? '<' : '>';
              });
              node.appendChild(btn);
            }
          });
          // Add style
          const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
          style.textContent = `.toggle-btn { user-select: none; cursor: pointer; }`;
          svgClone.insertBefore(style, svgClone.firstChild);
          const serializer = new XMLSerializer();
          const svgContent = serializer.serializeToString(svgClone);
          return { svgContent };
        }
      }).then(results => {
        if (!results[0].result || results[0].result.error) {
          alert(results[0].result.error || 'Export failed');
          return;
        }
        const blob = new Blob([results[0].result.svgContent], { type: 'image/svg+xml' });
        const filename = getExportFilename('svg', rootName);
        
        // Create download link directly in popup
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    });
  });
};

document.getElementById('exportMarkdown').addEventListener('click', exportMarkdown);
document.getElementById('exportSVG').addEventListener('click', exportSVG);