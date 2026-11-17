"""Summarize recorded DevTools navigations; no browser launch or production writes.

python3 scripts/redesign-performance.py /tmp/ujverse-redesign
The blocking column is observed excess over 50 ms from FCP to trace end,
not Lighthouse TBT (which requires a Lighthouse TTI computation).
"""
import gzip
import json
import pathlib
import statistics
import sys

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/ujverse-redesign')
rows = []
for path in sorted(root.glob('*.json.gz')):
    if path.name == 'before-trace.json.gz':
        continue
    events = json.load(gzip.open(path, 'rt'))['traceEvents']
    nav = next(e for e in events if e['name'] == 'navigationStart' and e.get('args', {}).get('data', {}).get('documentLoaderURL', '').startswith('http://127.0.0.1:417'))
    nav_id = nav['args']['data']['navigationId']
    same_navigation = [e for e in events if e.get('args', {}).get('data', {}).get('navigationId') == nav_id]
    lcp = [e for e in same_navigation if e['name'] == 'largestContentfulPaint::Candidate'][-1]
    fcp = next(e for e in same_navigation if e['name'] == 'firstContentfulPaint')
    tasks = [e for e in events if e['name'] == 'RunTask' and e.get('ph') == 'X' and e['pid'] == nav['pid'] and e['tid'] == nav['tid'] and e['ts'] >= fcp['ts']]
    shifts = [e['args']['data'].get('weighted_score_delta', 0) for e in events if e['name'] == 'LayoutShift' and e['pid'] == nav['pid'] and not e.get('args', {}).get('data', {}).get('had_recent_input')]
    rows.append({'trace': path.name, 'lcp_ms': round((lcp['ts'] - nav['ts']) / 1000, 1), 'fcp_ms': round((fcp['ts'] - nav['ts']) / 1000, 1), 'cls_sum': round(sum(shifts), 5), 'observed_blocking_ms': round(sum(max(0, e.get('dur', 0) / 1000 - 50) for e in tasks), 1), 'lcp_element': lcp['args']['data'].get('nodeName'), 'observation_ms': round((max(e['ts'] for e in events) - nav['ts']) / 1000)})
result = {'method': 'DevTools Slow 4G, CPU x4, DPR 1, cold HTTP cache, reduced motion, dark theme; mobile 390x844, desktop 1920x1080', 'runs': rows}
for phase in ['before', 'after']:
    result[phase + '_mobile_median'] = {key: statistics.median(r[key] for r in rows if r['trace'].startswith(phase + '-mobile')) for key in ['lcp_ms', 'fcp_ms', 'cls_sum', 'observed_blocking_ms']}
print(json.dumps(result, indent=2, ensure_ascii=False))
