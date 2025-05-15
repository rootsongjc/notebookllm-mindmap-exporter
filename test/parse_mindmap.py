import sys
from bs4 import BeautifulSoup
import re
from collections import defaultdict

def parse_mindmap(html_path, md_path):
    """
    解析 NotebookLM 导出的 HTML 脑图，基于 SVG 坐标和连线关系，
    构建树状结构并导出为 Markdown 文件。
    """
    # 读取 HTML
    with open(html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    # 提取所有节点及其坐标
    nodes = {}       # (x,y) -> name
    positions = {}   # name -> (x,y)
    for g in soup.find_all('g', class_='node'):
        transform = g.get('transform', '')
        name_tag = g.find('text', class_='node-name')
        if transform and name_tag:
            m = re.search(r'translate\(([-\d.]+),\s*([-\d.]+)\)', transform)
            if m:
                x, y = float(m.group(1)), float(m.group(2))
                name = name_tag.get_text(strip=True)
                nodes[(x, y)] = name
                positions[name] = (x, y)

    # 提取所有连线，建立父子映射
    tree = defaultdict(list)
    children = set()
    for path in soup.find_all('path', class_='link'):
        d = path.get('d') or ''
        coords = re.findall(r'[-]?\d+\.?\d*', d)
        if len(coords) >= 4:
            x1, y1 = float(coords[0]), float(coords[1])
            x2, y2 = float(coords[-2]), float(coords[-1])
            # 匹配最接近的节点坐标
            parent = min(nodes.items(),
                         key=lambda kv: abs(kv[0][0]-x1)+abs(kv[0][1]-y1))[1]
            child  = min(nodes.items(),
                         key=lambda kv: abs(kv[0][0]-x2)+abs(kv[0][1]-y2))[1]
            tree[parent].append(child)
            children.add(child)

    # 寻找根节点
    roots = set(tree.keys()) - children
    root = roots.pop() if roots else next(iter(positions.keys()))

    # 递归生成 Markdown
    def dfs(name, level):
        lines = [f"{'#'*level} {name}"]
        for child in tree.get(name, []):
            lines.extend(dfs(child, level+1))
        return lines

    md_lines = dfs(root, 1)
    # 写入文件
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(md_lines))

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("用法：python parse_mindmap.py 输入.html 输出.md")
    else:
        parse_mindmap(sys.argv[1], sys.argv[2])
        print(f"已生成 Markdown: {sys.argv[2]}")

