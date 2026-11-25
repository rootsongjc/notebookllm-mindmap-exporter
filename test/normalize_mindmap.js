const assert = require('node:assert/strict');
const { adaptNotebookLmPayload } = require('../mindmap-contract.js');

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function toMindmap(raw) {
  return toPlain(adaptNotebookLmPayload(raw));
}

assert.deepEqual(
  toMindmap({ name: 'Root', children: [{ name: 'Child' }] }),
  {
    name: 'Root',
    children: [
      { name: 'Child', children: [] }
    ]
  }
);

assert.deepEqual(
  toMindmap({ name: 'Root' }),
  {
    name: 'Root',
    children: []
  }
);

assert.throws(
  () => adaptNotebookLmPayload({ children: [] }),
  /missing a valid name/
);

assert.throws(
  () => adaptNotebookLmPayload({ name: 'Root', children: {} }),
  /children must be an array/
);

console.log('NotebookLM payload contract: ok');
