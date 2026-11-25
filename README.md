# NotebookLM Notebook Mindmap Exporter

Export mindmaps from NotebookLLM as Markdown or standalone SVG.

## Features

- One-click export to Markdown for easy editing and sharing
- Export to standalone SVG
- Choose how many levels are exported as Markdown headings before switching to bullet lists
- Modern, user-friendly popup UI
- File names include root node and timestamp for easy management

## Installation

### Loading the Extension in Chrome

1. **Download or Clone the Repository**
   ```bash
   git clone https://github.com/rootsongjc/notebookllm-mindmap-exporter.git
   cd notebookllm-mindmap-exporter
   ```

2. **Open Chrome Extensions Page**
   - Open Chrome browser
   - Navigate to `chrome://extensions/`
   - Or go to Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked" button
   - Select the `notebookllm-mindmap-exporter` folder
   - The extension should now appear in your extensions list

5. **Verify Installation**
   - You should see the extension icon in your Chrome toolbar
   - If not visible, click the puzzle piece icon to pin it to the toolbar

## Note

This extension is only intended for use with mindmaps on NotebookLM, such as [notebooklm.google.com](https://notebooklm.google.com/notebook/ba86347e-d24c-4387-915f-18e20a2f51fe). To export, simply open a mindmap in a notebook, click the extension, and choose your export format.

**How it works:** The extension exports the current NotebookLM mindmap as Markdown or standalone SVG.

## Usage

1. Open a NotebookLM notebook and display the mindmap artifact you want to export.
2. Click the Mindmap Exporter extension icon.
3. Choose your export format in the popup to download the file.

For Markdown exports, the `Use headings through depth` setting controls how many tree levels are rendered as headings before deeper levels switch to bullet lists.

## File Naming

Exported files are named as `notebookllm-{root-node-name}-{timestamp}.md/svg`.
