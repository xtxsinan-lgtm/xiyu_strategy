#!/usr/bin/env python3
"""Check that no two displayed roads cross except at a shared node.

Every visual crossing must be modelled as a real junction node (type "junction"),
so what the player sees always matches where armies can switch roads.
Curves are rebuilt exactly like `ui/map_view.gd::route_curve` (cubic Bézier through
waypoints, tangent = (next - prev) * 0.15).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLES_PER_SEGMENT = 24


def _bezier(a, b, c, d, n):
    out = []
    for k in range(n + 1):
        t = k / n
        u = 1 - t
        out.append(tuple(u ** 3 * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t ** 3 * d[i] for i in (0, 1)))
    return out


def route_polyline(route, pos, waypoints):
    pts = [pos[route['a']]] + waypoints.get(f"{route['a']}|{route['b']}", []) + [pos[route['b']]]
    tan = [(0.0, 0.0)] * len(pts)
    for i in range(1, len(pts) - 1):
        tan[i] = ((pts[i + 1][0] - pts[i - 1][0]) * 0.15, (pts[i + 1][1] - pts[i - 1][1]) * 0.15)
    out = []
    for i in range(len(pts) - 1):
        a, d = pts[i], pts[i + 1]
        b = (a[0] + tan[i][0], a[1] + tan[i][1])
        c = (d[0] - tan[i + 1][0], d[1] - tan[i + 1][1])
        seg = _bezier(a, b, c, d, SAMPLES_PER_SEGMENT)
        out += seg if i == 0 else seg[1:]
    return out


def _intersect(p1, p2, p3, p4):
    den = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(den) < 1e-9:
        return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / den
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / den
    if 0 < t < 1 and 0 < u < 1:
        return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))
    return None


def find_crossings():
    sc = json.loads((ROOT / 'data/scenario_mvp.json').read_text())
    pres = json.loads((ROOT / 'data/map_presentation.json').read_text())
    pos = {n['id']: pres['positions'].get(n['id'], n['pos']) for n in sc['nodes']}
    routes = sc['routes']
    lines = [route_polyline(r, pos, pres['waypoints']) for r in routes]
    found = []
    for i in range(len(routes)):
        for j in range(i + 1, len(routes)):
            if {routes[i]['a'], routes[i]['b']} & {routes[j]['a'], routes[j]['b']}:
                continue
            for k in range(len(lines[i]) - 1):
                hit = None
                for m in range(len(lines[j]) - 1):
                    hit = _intersect(lines[i][k], lines[i][k + 1], lines[j][m], lines[j][m + 1])
                    if hit:
                        break
                if hit:
                    found.append((routes[i], routes[j], hit))
                    break
    return found


def check():
    pres = json.loads((ROOT / 'data/map_presentation.json').read_text())
    sc = json.loads((ROOT / 'data/scenario_mvp.json').read_text())
    keys = {f"{r['a']}|{r['b']}" for r in sc['routes']}
    stale = sorted(k for k in pres['waypoints'] if k not in keys)
    assert not stale, f'Waypoint keys must match route a|b direction: {stale}'
    crossings = find_crossings()
    for a, b, p in crossings:
        print(f"Roads cross without a junction: {a['a']}—{a['b']} × {b['a']}—{b['b']} at ({p[0]:.0f}, {p[1]:.0f})")
    assert not crossings, 'Every road crossing must be a junction node'
    print(f"No unmodelled crossings among {len(sc['routes'])} displayed roads.")


if __name__ == '__main__':
    check()
