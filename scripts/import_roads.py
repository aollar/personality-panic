"""
Import a road layout exported from the Heelton Road Editor artifact.

Usage:  python scripts/import_roads.py path/to/layout.json
        (or pipe:  python scripts/import_roads.py - < layout.json)

Editor model: every dot is a node; "@buildingId" nodes are doorsteps (the red
dots). On import: @node position -> that building's entrance; edges touching an
@node -> that building's doors; everything else -> roadNodes/roadEdges.
Rewrites the geometry block in scripts/build_data.py, then re-run build_data.
"""
import io, json, re, sys

BUILD = "scripts/build_data.py"

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "-"
    raw = sys.stdin.read() if src == "-" else io.open(src, encoding="utf-8").read()
    lay = json.loads(raw)
    nodes, edges = lay["nodes"], lay["edges"]

    doorsteps = {k[1:]: v for k, v in nodes.items() if k.startswith("@")}
    road_nodes = {k: v for k, v in nodes.items() if not k.startswith("@")}
    doors = {b: [] for b in doorsteps}
    road_edges = []
    for a, b in edges:
        if a.startswith("@") and b.startswith("@"):
            print(f"SKIP door-to-door edge {a}-{b}"); continue
        if a.startswith("@"): doors[a[1:]].append(b); continue
        if b.startswith("@"): doors[b[1:]].append(a); continue
        road_edges.append([a, b])
    missing = [b for b, d in doors.items() if not d]
    if missing:
        sys.exit("FATAL: doorstep(s) with no line to a road: " + ", ".join(missing))
    dangling = [e for e in road_edges if e[0] not in road_nodes or e[1] not in road_nodes]
    if dangling:
        sys.exit("FATAL: edges referencing deleted nodes: " + str(dangling[:5]))

    s = io.open(BUILD, encoding="utf-8").read()

    # entrances + doors inside the buildings dict
    for b, pos in doorsteps.items():
        pat = re.compile(r'("%s":[^}]*?"entrance": )\[[0-9., ]+\](, "doors": )\[[^\]]*\]' % b, re.S)
        if not pat.search(s):
            sys.exit("FATAL: could not find building block for " + b)
        s = pat.sub(lambda m: m.group(1) + json.dumps(pos) + m.group(2) +
                    json.dumps(sorted(set(doors[b]))), s, count=1)

    # roadNodes dict
    lines = ["    roadNodes = {"]
    for k in road_nodes:
        lines.append(f'        "{k}": {json.dumps(road_nodes[k])},')
    lines.append("    }")
    s = re.sub(r"    roadNodes = \{.*?\n    \}", "\n".join(lines), s, count=1, flags=re.S)

    # roadEdges: replace the whole assembly (ring list + extras) with a flat list
    edge_lines = ["    roadEdges = ["]
    for a, b in road_edges:
        edge_lines.append(f'        ["{a}", "{b}"],')
    edge_lines.append("    ]")
    s = re.sub(r"    roadEdges = \[.*?\n    \]", "\n".join(edge_lines), s, count=1, flags=re.S)
    s = re.sub(r"    _ring = \[[^\]]*\]\n", "", s, count=1)

    io.open(BUILD, "w", encoding="utf-8").write(s)
    print(f"imported {len(road_nodes)} nodes, {len(road_edges)} edges, "
          f"{len(doorsteps)} doorsteps -> {BUILD}")
    print("now run:  python scripts/build_data.py  &&  node test/walk_roads.js")

if __name__ == "__main__":
    main()
