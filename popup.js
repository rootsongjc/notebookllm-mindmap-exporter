function getExportFilename(ext, rootName) {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `notebookllm-${rootName}-${timeStr}.${ext}`;
}

function sanitizeRootName(name) {
  const cleaned = (name || 'unknown')
    .trim()
    .replace(/:/g, ' -')
    .replace(/[\\/<>:"|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim();
  return cleaned || 'unknown';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getHeadingDepthLimit() {
  const input = document.getElementById('headingDepthLimit');
  const value = Number.parseInt(input?.value || '2', 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 6) : 2;
}

/**
 * Provider-agnostic tree consumed by the Markdown and SVG exporters.
 *
 * @typedef {Object} MindmapNode
 * @property {string} name
 * @property {MindmapNode[]} children
 */

/**
 * @typedef {{ mindmap: MindmapNode } | { error: string }} MindmapLoadResult
 */

const { adaptNotebookLmPayload: adaptMindmapPayload } = globalThis.MindmapContract || {};

if (typeof adaptMindmapPayload !== 'function') {
  throw new Error('MindmapContract.adaptNotebookLmPayload is not available');
}

/**
 * @param {MindmapNode} tree
 * @param {number} headingDepthLimit
 */
function buildMarkdown(tree, headingDepthLimit) {
  const lines = [];
  let total = 0;

  // Markdown structure:
  // - nodes up to headingDepthLimit -> headings
  // - deeper nodes -> nested bullet points
  function visit(node, depth = 0) {
    if (!node || !node.name) {
      return;
    }

    total += 1;

    if (depth < headingDepthLimit) {
      if (depth > 0 && lines.length > 0) {
        lines.push('');
      }
      lines.push(`${'#'.repeat(depth + 1)} ${node.name}`);
    } else {
      const indent = '  '.repeat(depth - headingDepthLimit);
      lines.push(`${indent}- ${node.name}`);
    }

    for (const child of node.children || []) {
      visit(child, depth + 1);
    }
  }

  visit(tree);

  return {
    markdown: lines.join('\n'),
    stats: {
      total,
      normal: total,
      missing: 0,
      missingNames: []
    }
  };
}

/**
 * @param {MindmapNode} tree
 */
function buildMindmapSvg(tree) {
  // Build a simple static SVG from the tree so we do not depend on
  // NotebookLM's cross-origin mindmap iframe internals.
  const fontSize = 16;
  const nodeHeight = 36;
  const nodeRadius = 10;
  const horizontalGap = 84;
  const verticalGap = 18;
  const marginX = 28;
  const marginY = 28;
  const charWidth = 7.2;

  const nodes = [];
  const links = [];
  let maxX = 0;

  function measureLabel(label) {
    return Math.max(140, Math.ceil(label.length * charWidth) + 28);
  }

  function layout(node, x, top) {
    const name = (node && node.name) || '';
    const width = measureLabel(name);
    const children = node.children || [];
    const childLayouts = [];
    let childrenHeight = 0;
    let cursor = top;

    for (const child of children) {
      // Each generation starts to the right of the parent's right edge.
      const childLayout = layout(child, x + width + horizontalGap, cursor);
      childLayouts.push(childLayout);
      cursor += childLayout.height + verticalGap;
      childrenHeight += childLayout.height;
    }

    if (childLayouts.length > 1) {
      childrenHeight += verticalGap * (childLayouts.length - 1);
    }

    const subtreeHeight = Math.max(nodeHeight, childrenHeight);
    const centerY = top + (subtreeHeight / 2);
    const y = centerY - (nodeHeight / 2);
    const current = { name: node.name, x, y, width, height: nodeHeight };

    nodes.push(current);
    maxX = Math.max(maxX, x + width);

    for (const childLayout of childLayouts) {
      links.push({
        x1: x + width,
        y1: centerY,
        x2: childLayout.node.x,
        y2: childLayout.node.y + (childLayout.node.height / 2)
      });
    }

    return {
      node: current,
      height: subtreeHeight
    };
  }

  const rootLayout = layout(tree, marginX, marginY);
  const totalHeight = rootLayout.height + marginY * 2;
  const totalWidth = maxX + marginX;

  const linkMarkup = links.map(link => {
    const dx = Math.max(24, (link.x2 - link.x1) / 2);
    return `<path class="link" d="M ${link.x1} ${link.y1} C ${link.x1 + dx} ${link.y1}, ${link.x2 - dx} ${link.y2}, ${link.x2} ${link.y2}" />`;
  }).join('');

  const nodeMarkup = nodes.map(node => {
    const textX = node.x + 14;
    const textY = node.y + (node.height / 2);
    return `<g class="node"><rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${nodeRadius}" ry="${nodeRadius}" /><text x="${textX}" y="${textY}" class="node-name">${escapeXml(node.name)}</text></g>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" role="img" aria-label="Mindmap export">
  <style>
    .link { fill: none; stroke: #7c8aa5; stroke-width: 2; }
    .node rect { fill: #ffffff; stroke: #4f8cff; stroke-width: 1.5; }
    .node-name { fill: #18212f; font: ${fontSize}px Arial, sans-serif; dominant-baseline: middle; }
  </style>
  ${linkMarkup}
  ${nodeMarkup}
</svg>`;
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Fetch the current raw NotebookLM payload for the active mindmap artifact.
 * This is the only function that should know about NotebookLM's private data.
 *
 * @param {number} tabId
 */
function fetchNotebookLmMindmapPayload(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async () => {
      // Reverse-engineered NotebookLM contract. Keep the volatile pieces
      // together here so protocol/UI changes stay local to this function.
      //
      // High-level flow:
      // 1. Read artifact metadata from NotebookLM's Studio viewer buttons.
      // 2. Extract notebook/artifact IDs from the decoded jslog payload.
      // 3. Reuse request tokens exposed on window.WIZ_global_data.
      // 4. Call NotebookLM's private batchexecute RPC to fetch the tree.
      // 5. Unescape the embedded JSON payload and parse the first object.
      const NOTEBOOKLM_JSLOG_BASE64_MARKER = '0:';
      const NOTEBOOKLM_ARTIFACT_BUTTON_SELECTOR = 'artifact-viewer button[jslog]';
      const NOTEBOOKLM_UUID_RE = /^[0-9a-f-]{36}$/i;
      const NOTEBOOKLM_WIZ_GLOBAL_DATA_KEY = 'WIZ_global_data';
      const NOTEBOOKLM_WIZ_BUILD_LABEL_PRIMARY_KEY = 'KjTSIf';
      const NOTEBOOKLM_WIZ_BUILD_LABEL_FALLBACK_KEY = 'cfb2h';
      const NOTEBOOKLM_WIZ_SESSION_ID_KEY = 'FdrFJe';
      const NOTEBOOKLM_WIZ_AUTH_TOKEN_KEY = 'SNlM0e';
      const NOTEBOOKLM_BATCH_EXECUTE_PATH = '/_/LabsTailwindUi/data/batchexecute';
      const NOTEBOOKLM_MINDMAP_RPC_ID = 'v9rmvd';
      const NOTEBOOKLM_RESPONSE_DATA_MARKER = 'data-app-data';
      const NOTEBOOKLM_MINDMAP_RPC_OPTIONS = [
        2,
        null,
        null,
        [1, null, null, null, null, null, null, null, null, null, [1]],
        [[1, 4, 8, 10, 2, 3, 6, 7]]
      ];

      // NotebookLM keeps the artifact identifiers in a base64 payload inside
      // the Studio viewer buttons. We reuse that instead of guessing IDs.
      function decodeJslogValue(value) {
        const marker = NOTEBOOKLM_JSLOG_BASE64_MARKER;
        const start = value.indexOf(marker);
        if (start === -1) {
          return null;
        }

        const encoded = value.slice(start + marker.length).trim();
        try {
          return atob(encoded);
        } catch (error) {
          return null;
        }
      }

      // The RPC response contains the mindmap tree as an escaped JSON string
      // embedded in HTML. We isolate only the first full JSON object.
      function extractJsonObjectPrefix(text) {
        let depth = 0;
        let inString = false;
        let escaped = false;
        let started = false;
        let startIndex = -1;

        for (let i = 0; i < text.length; i += 1) {
          const ch = text[i];

          if (!started) {
            if (ch === '{') {
              started = true;
              startIndex = i;
              depth = 1;
            }
            continue;
          }

          if (escaped) {
            escaped = false;
            continue;
          }

          if (ch === '\\') {
            escaped = true;
            continue;
          }

          if (ch === '"') {
            inString = !inString;
            continue;
          }

          if (inString) {
            continue;
          }

          if (ch === '{') {
            depth += 1;
          } else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
              return text.slice(startIndex, i + 1);
            }
          }
        }

        return null;
      }

      // NotebookLM does not expose stable public artifact IDs in the visible
      // UI. The current Studio viewer embeds them in jslog attributes, so we
      // search those buttons instead of coupling export to iframe internals.
      const candidates = Array.from(
        document.querySelectorAll(NOTEBOOKLM_ARTIFACT_BUTTON_SELECTOR)
      );
      const shareButton = candidates.find(button => {
        const decoded = decodeJslogValue(button.getAttribute('jslog') || '');
        if (!decoded) {
          return false;
        }
        try {
          return JSON.parse(decoded)
            .flat(Infinity)
            .filter(v => typeof v === 'string' && NOTEBOOKLM_UUID_RE.test(v))
            .length >= 2;
        } catch (error) {
          return false;
        }
      });

      if (!shareButton) {
        return { error: 'Mindmap artifact not found in the current notebook view' };
      }

      const decoded = decodeJslogValue(shareButton.getAttribute('jslog') || '');
      if (!decoded) {
        return { error: 'Mindmap artifact metadata is missing' };
      }

      let notebookId;
      let artifactId;
      try {
        // Current reverse-engineered contract: the decoded jslog payload
        // contains the notebook ID and the artifact ID as UUID strings.
        const ids = JSON.parse(decoded)
          .flat(Infinity)
          .filter(value => typeof value === 'string' && NOTEBOOKLM_UUID_RE.test(value));
        [notebookId, artifactId] = ids;
      } catch (error) {
        return { error: 'Failed to decode mindmap artifact metadata' };
      }

      if (!notebookId || !artifactId) {
        return { error: 'Mindmap identifiers were not found' };
      }

      // The batchexecute request depends on NotebookLM tokens stored on the
      // page's global object, which is why this script runs in the MAIN world.
      const wiz = window[NOTEBOOKLM_WIZ_GLOBAL_DATA_KEY] || {};
      const bl = wiz[NOTEBOOKLM_WIZ_BUILD_LABEL_PRIMARY_KEY]
        || wiz[NOTEBOOKLM_WIZ_BUILD_LABEL_FALLBACK_KEY];
      const fSid = wiz[NOTEBOOKLM_WIZ_SESSION_ID_KEY];
      const at = wiz[NOTEBOOKLM_WIZ_AUTH_TOKEN_KEY];
      if (!bl || !fSid || !at) {
        return { error: 'NotebookLM request tokens are unavailable' };
      }

      // NOTEBOOKLM_MINDMAP_RPC_ID is a private RPC identifier discovered by
      // reverse-engineering NotebookLM network traffic. If Google changes this
      // RPC or its payload shape, export will fail even if the UI still loads.
      const params = new URLSearchParams({
        rpcids: NOTEBOOKLM_MINDMAP_RPC_ID,
        'source-path': `/notebook/${notebookId}`,
        bl,
        'f.sid': fSid,
        hl: document.documentElement.lang || 'en',
        _reqid: String(Date.now() % 1000000),
        rt: 'c'
      });

      const payload = [[[NOTEBOOKLM_MINDMAP_RPC_ID, JSON.stringify([
        artifactId,
        NOTEBOOKLM_MINDMAP_RPC_OPTIONS
      ]), null, 'generic']]];

      const body = new URLSearchParams({
        'f.req': JSON.stringify(payload),
        at
      });

      let text;
      try {
        const response = await fetch(`${NOTEBOOKLM_BATCH_EXECUTE_PATH}?${params.toString()}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'x-same-domain': '1'
          },
          body: body.toString()
        });

        if (!response.ok) {
          return { error: `Mindmap request failed (${response.status})` };
        }

        text = await response.text();
      } catch (error) {
        return { error: 'Failed to fetch current mindmap data' };
      }

      // The RPC response wraps the tree inside escaped HTML content rather
      // than returning a plain JSON document. We first locate the relevant
      // region, then reduce escaping, then parse the first full JSON object.
      const dataIndex = text.indexOf(NOTEBOOKLM_RESPONSE_DATA_MARKER);
      if (dataIndex === -1) {
        return { error: 'Mindmap payload not found in NotebookLM response' };
      }

      const rawJsonStart = text.indexOf('{', dataIndex);
      if (rawJsonStart === -1) {
        return { error: 'Mindmap JSON start not found' };
      }

      const rawPayload = text.slice(rawJsonStart);
      // The response is escaped twice: once as RPC text and once inside the
      // HTML attribute. Reduce it to plain JSON text before parsing.
      const singleEscaped = rawPayload.replace(/\\\\/g, '\\');
      const entityDecoded = singleEscaped
        .replace(/\\u0026quot;/g, '"')
        .replace(/\\u0026#39;/g, "'")
        .replace(/\\u0026gt;/g, '>')
        .replace(/\\u0026lt;/g, '<')
        .replace(/\\u0026amp;/g, '&')
        .replace(/\\n/g, '\n');

      const jsonText = extractJsonObjectPrefix(entityDecoded);
      if (!jsonText) {
        return { error: 'Mindmap JSON payload could not be isolated' };
      }

      try {
        return {
          payload: JSON.parse(jsonText)
        };
      } catch (error) {
        return { error: 'Mindmap JSON payload is invalid' };
      }
    }
  }).then(results => results[0]?.result || null);
}

/**
 * Load the current mindmap as the provider-agnostic domain model consumed by
 * the Markdown and SVG exporters.
 *
 * @param {number} tabId
 * @returns {Promise<MindmapLoadResult | null>}
 */
function loadCurrentMindmap(tabId) {
  return fetchNotebookLmMindmapPayload(tabId).then(result => {
    if (!result || result.error || !('payload' in result)) {
      return result;
    }

    try {
      return {
        mindmap: adaptMindmapPayload(result.payload)
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Mindmap tree shape is invalid'
      };
    }
  });
}

const exportMarkdown = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    loadCurrentMindmap(tabs[0].id).then(result => {
      if (!result || result.error || !result.mindmap) {
        alert((result && result.error) || 'Mindmap frame not found');
        return;
      }

      const { markdown, stats } = buildMarkdown(result.mindmap, getHeadingDepthLimit());
      const filename = getExportFilename('md', sanitizeRootName(result.mindmap.name));
      downloadBlob(new Blob([markdown], { type: 'text/markdown' }), filename);
      alert(`Export completed!\nTotal nodes: ${stats.total}`);
    }).catch(() => {
      alert('Mindmap export failed');
    });
  });
};

const exportSVG = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    loadCurrentMindmap(tabs[0].id).then(result => {
      if (!result || result.error || !result.mindmap) {
        alert((result && result.error) || 'Mindmap frame not found');
        return;
      }

      const svg = buildMindmapSvg(result.mindmap);
      const filename = getExportFilename('svg', sanitizeRootName(result.mindmap.name));
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), filename);
    }).catch(() => {
      alert('Mindmap export failed');
    });
  });
};

document.getElementById('exportMarkdown').addEventListener('click', exportMarkdown);
document.getElementById('exportSVG').addEventListener('click', exportSVG);
