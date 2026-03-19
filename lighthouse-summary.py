import json
from typing import Any, Dict

with open('./lighthouse-report.json', 'r', encoding='utf-8') as f:
    report: Dict[str, Any] = json.load(f)

with open('./lighthouse-summary.txt', 'w', encoding='utf-8') as out:
    for c in ['accessibility', 'performance', 'seo']:
        cat = report.get('categories', {}).get(c, {})
        out.write(f"--- {c.upper()} Issues (Score: {cat.get('score')}) ---\n")
        for ref in cat.get('auditRefs', []):
            audit_id = ref.get('id')
            if not audit_id:
                continue
            audit = report.get('audits', {}).get(audit_id, {})
            score = audit.get('score')
            if score is not None and score < 1:
                out.write(f"- {audit.get('id')}: {score} - {audit.get('title')}\n")
                details = audit.get('details', {})
                if isinstance(details, dict) and 'items' in details:
                    items = details.get('items', [])
                    if isinstance(items, list):
                        for item in items:
                            if isinstance(item, dict):
                                node = item.get('node', {})
                                if isinstance(node, dict) and 'snippet' in node:
                                    out.write(f"    * Node: {node['snippet']}\n")

