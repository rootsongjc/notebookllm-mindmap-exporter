# NotebooLLM Notebook Mindmap Exporter

Export mindmaps from NotebookLLM as Markdown or interactive SVG with collapsible nodes.

## Features
- One-click export to Markdown for easy editing and sharing
- Export to interactive SVG with collapsible/expandable nodes
- Modern, user-friendly popup UI
- File names include root node and timestamp for easy management

## Note
This extension is only intended for use with mindmaps on the Notebook LM website, such as [notebooklm.google.com](https://notebooklm.google.com/notebook/ba86347e-d24c-4387-915f-18e20a2f51fe). To export, simply open a mindmap in a notebook, click the extension, and choose your export format.

**Important:** Only the currently expanded parts of the mindmap will be exported. To export the entire mindmap, you must manually expand all nodes before exporting.

## Usage
1. Open a web page with a mindmap (element with class `mindmap`).
2. Click the Mindmap Exporter extension icon.
3. Choose your export format in the popup.

## File Naming
Exported files are named as `notebookllm-{root-node-name}-{timestamp}.md/svg`.

## License
MIT
