(() => {
  const soup = new DOMParser().parseFromString(document.documentElement.outerHTML, 'text/html');
  const nodes = {};
  const positions = {};

  for (const g of soup.querySelectorAll('g.node')) {
    const transform = g.getAttribute('transform') || '';
    const text = g.querySelector('text.node-name');
    const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(transform);
    if (m && text) {
      const x = parseFloat(m[1]), y = parseFloat(m[2]);
      const name = text.textContent.trim();
      nodes[[x, y]] = name;
      positions[name] = [x, y];
    }
  }

  const tree = {};
  const children = new Set();
  for (const path of soup.querySelectorAll('path.link')) {
    const d = path.getAttribute('d') || '';
    const coords = Array.from(d.matchAll(/[-]?\d+\.?\d*/g)).map(Number);
    if (coords.length >= 4) {
      const [x1, y1] = coords;
      const [x2, y2] = coords.slice(-2);
      const parent = Object.entries(nodes).reduce((a, b) => {
        const [ax, ay] = a[0].split(',').map(Number);
        const [bx, by] = b[0].split(',').map(Number);
        return Math.abs(bx-x1)+Math.abs(by-y1) < Math.abs(ax-x1)+Math.abs(ay-y1) ? b : a;
      })[1];
      const child = Object.entries(nodes).reduce((a, b) => {
        const [ax, ay] = a[0].split(',').map(Number);
        const [bx, by] = b[0].split(',').map(Number);
        return Math.abs(bx-x2)+Math.abs(by-y2) < Math.abs(ax-x2)+Math.abs(ay-y2) ? b : a;
      })[1];
      tree[parent] = tree[parent] || [];
      tree[parent].push(child);
      children.add(child);
    }
  }

  const root = Object.keys(tree).find(k => !children.has(k)) || Object.keys(positions)[0];

  const dfs = (node, level = 1) => {
    const lines = [`${'#'.repeat(level)} ${node}`];
    for (const child of tree[node] || []) lines.push(...dfs(child, level+1));
    return lines;
  };

  window.markdown = dfs(root).join('\n');
})();