(() => {
  const soup = new DOMParser().parseFromString(document.documentElement.outerHTML, 'text/html');
  const nodes = []; // Store all node data
  const positions = {};

  // 1. Store node data with edge points and create edge maps
  const leftEdgeMap = new Map();   // Maps "x,y" to node
  const rightEdgeMap = new Map();  // Maps "x,y" to node

  for (const g of soup.querySelectorAll('g.node')) {
    const transform = g.getAttribute('transform') || '';
    const text = g.querySelector('text.node-name');
    const rect = g.querySelector('rect');
    const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(transform);
    
    if (m && text && rect) {
      const x = parseFloat(m[1]);
      const y = parseFloat(m[2]);
      const width = parseFloat(rect.getAttribute('width') || 0);
      const height = parseFloat(rect.getAttribute('height') || 0);
      
      // Calculate edge points
      const centerY = Math.round(y + (height / 2));
      const leftEdge = { x: Math.round(x), y: centerY };         // Center of left edge
      const rightEdge = { x: Math.round(x + width), y: centerY }; // Center of right edge
      
      const name = text.textContent.trim();
      const node = {
        name,
        x, y, width, height,
        leftEdge,
        rightEdge
      };
      
      nodes.push(node);
      positions[name] = { x, y };
      
      // Add to edge maps
      const leftKey = `${leftEdge.x},${leftEdge.y}`;
      const rightKey = `${rightEdge.x},${rightEdge.y}`;
      leftEdgeMap.set(leftKey, node);
      rightEdgeMap.set(rightKey, node);
    }
  }

  const tree = {};
  const children = new Set();
  
  // 2. Collect all link paths with their coordinates
  const links = [];
  document.querySelectorAll('path.link').forEach(path => {
    const d = path.getAttribute('d') || '';
    const coords = Array.from(d.matchAll(/[-]?\d+\.?\d*/g)).map(Number);
    if (coords.length >= 4) {
      const [x1, y1] = coords;
      const [x2, y2] = coords.slice(-2);
      links.push({ 
        x1: Math.round(x1), 
        y1: Math.round(y1), 
        x2: Math.round(x2), 
        y2: Math.round(y2) 
      });
    }
  });

  // 3. Cache for parent-child relationships
  const edgeToParentCache = new Map(); // Maps "x,y" to parent node name
  const edgeToChildCache = new Map();  // Maps "x,y" to child node name

  // 4. Optimized findClosestNode function
  function findClosestNode(x, y, nodeType) {
    const cache = nodeType === 'parent' ? edgeToParentCache : edgeToChildCache;
    const edgeMap = nodeType === 'parent' ? rightEdgeMap : leftEdgeMap;
    const cacheKey = `${x},${y}`;
    
    // Check cache first
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    // Try exact match first
    if (edgeMap.has(cacheKey)) {
      const node = edgeMap.get(cacheKey);
      cache.set(cacheKey, node.name);
      return node.name;
    }

    // Fall back to nearest neighbor if no exact match
    let minDist = Infinity;
    let closestNode = null;
    
    for (const [coords, node] of edgeMap) {
      const [nodeX, nodeY] = coords.split(',').map(Number);
      const dist = Math.hypot(nodeX - x, nodeY - y);
      
      if (dist < minDist) {
        minDist = dist;
        closestNode = node.name;
      }
    }

    // Cache the result
    if (closestNode) {
      cache.set(cacheKey, closestNode);
    }
    
    return closestNode;
  }

  // 5. Process each link to build the tree
  for (const { x1, y1, x2, y2 } of links) {
    const parent = findClosestNode(x1, y1, 'parent');
    const child = findClosestNode(x2, y2, 'child');
    
    if (parent && child && parent !== child) {
      tree[parent] = tree[parent] || [];
      if (!tree[parent].includes(child)) {
        tree[parent].push(child);
        children.add(child);
      }
    }
  }

  // Rest of the code remains the same...
  let root = nodes.find(node => !children.has(node.name))?.name;
  if (!root) {
    const allNodes = new Set(nodes.map(n => n.name));
    const hasIncoming = new Set(Array.from(children));
    root = Array.from(allNodes).find(node => !hasIncoming.has(node)) || nodes[0]?.name;
  }

  const visited = new Set();
  const mdLines = [];
  
  function processNode(node, level = 1) {
    if (visited.has(node)) return;
    visited.add(node);
    
    const headerLevel = Math.min(Math.max(1, level), 6);
    mdLines.push(`${'#'.repeat(headerLevel)} ${node}`);
    
    const children = tree[node] || [];
    children.forEach(child => processNode(child, level + 1));
  }
  
  if (root) {
    processNode(root);
  } else {
    nodes.forEach(node => processNode(node.name));
  }
  
  const missingNames = nodes
    .map(n => n.name)
    .filter(name => !visited.has(name));
  
  missingNames.forEach(name => {
    mdLines.push(`# ${name}`);
  });
  
  window.markdown = mdLines.join('\n');
  window.exportStats = {
    total: nodes.length,
    normal: visited.size,
    missing: missingNames.length,
    missingNames: missingNames
  };
})();