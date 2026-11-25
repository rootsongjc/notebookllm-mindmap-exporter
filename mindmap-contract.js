// @ts-check

/**
 * Provider-agnostic tree consumed by the Markdown and SVG exporters.
 *
 * @typedef {Object} MindmapNode
 * @property {string} name
 * @property {MindmapNode[]} children
 */

/**
 * Validated NotebookLM payload node before mapping into the exporter domain.
 *
 * @typedef {Object} NotebookLmPayloadNode
 * @property {string} name
 * @property {NotebookLmPayloadNode[]} children
 */

/**
 * Parse and validate a raw NotebookLM node before it crosses into the
 * provider-agnostic exporter domain.
 *
 * @param {unknown} raw
 * @param {string} [path]
 * @returns {NotebookLmPayloadNode}
 */
function parseNotebookLmPayloadNode(raw, path = 'root') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`NotebookLM payload node at ${path} must be an object`);
  }

  const node = /** @type {{ name?: unknown, children?: unknown }} */ (raw);
  if (typeof node.name !== 'string' || node.name.trim() === '') {
    throw new Error(`NotebookLM payload node at ${path} is missing a valid name`);
  }

  const children = node.children == null ? [] : node.children;
  if (!Array.isArray(children)) {
    throw new Error(`NotebookLM payload node at ${path}.children must be an array`);
  }

  return {
    name: node.name,
    children: children.map((child, index) =>
      parseNotebookLmPayloadNode(child, `${path}.children[${index}]`)
    )
  };
}

/**
 * Map a validated NotebookLM payload node into the provider-agnostic exporter
 * domain. This is intentionally explicit even though the shapes currently
 * match, so future provider changes stay local to this adapter.
 *
 * @param {NotebookLmPayloadNode} payloadNode
 * @returns {MindmapNode}
 */
function mapNotebookLmPayloadToMindmap(payloadNode) {
  return {
    name: payloadNode.name,
    children: payloadNode.children.map(mapNotebookLmPayloadToMindmap)
  };
}

/**
 * Single provider-to-domain entrypoint used outside this module.
 *
 * @param {unknown} raw
 * @returns {MindmapNode}
 */
function adaptNotebookLmPayload(raw) {
  return mapNotebookLmPayloadToMindmap(parseNotebookLmPayloadNode(raw));
}

/**
 * @typedef {{ adaptNotebookLmPayload: (raw: unknown) => MindmapNode }} MindmapContractApi
 */

/** @type {MindmapContractApi} */
const MindmapContract = {
  adaptNotebookLmPayload
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MindmapContract;
}

if (typeof globalThis !== 'undefined') {
  /** @type {{ MindmapContract?: MindmapContractApi }} */ (globalThis).MindmapContract = MindmapContract;
}
