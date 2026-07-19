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

    # "@park", "@park2", "@park3"... = multiple doorsteps for one open zone;
    # the trailing digits only distinguish the dots
    def base(k): return re.sub(r"\d+$", "", k[1:])
    dot_names = sorted([k for k in nodes if k.startswith("@")],
                       key=lambda k: (base(k), len(k), k))
    doorsteps = {}          # building -> [pos, pos...] in dot order
    dot_doors = {}          # dot name -> [road nodes]
    for k in dot_names:
        doorsteps.setdefault(base(k), []).append(k)
        dot_doors[k] = []
    road_nodes = {k: v for k, v in nodes.items() if not k.startswith("@")}
    road_edges = []
    for a, b in edges:
        if a.startswith("@") and b.startswith("@"):
            print(f"SKIP door-to-door edge {a}-{b}"); continue
        if a.startswith("@"): dot_doors[a].append(b); continue
        if b.startswith("@"): dot_doors[b].append(a); continue
        road_edges.append([a, b])
    missing = [k for k, d in dot_doors.items() if not d]
    if missing:
        sys.exit("FATAL: doorstep(s) with no line to a road: " + ", ".join(missing))
    dangling = [e for e in road_edges if e[0] not in road_nodes or e[1] not in road_nodes]
    if dangling:
        sys.exit("FATAL: edges referencing deleted nodes: " + str(dangling[:5]))

    s = io.open(BUILD, encoding="utf-8").read()

    # entrances + doors inside the buildings dict. One dot = classic entrance;
    # several dots = an open zone with "entrances"/"entranceDoors" lists.
    for b, dots in doorsteps.items():
        pat = re.compile(
            r'("%s": \{.*?"entrance": )\[[0-9., ]+\](, "doors": )\[[^\]]*\]'
            r'(,\s*(?:#[^\n]*\n\s*)?"entrances": \[\[.*?\]\],\s*"entranceDoors": \[\[.*?\]\])?' % b, re.S)
        if not pat.search(s):
            sys.exit("FATAL: could not find building block for " + b)
        first_pos = nodes[dots[0]]
        first_doors = sorted(set(dot_doors[dots[0]]))
        extra = ""
        if len(dots) > 1:
            entrances = [nodes[k] for k in dots]
            edoors = [sorted(set(dot_doors[k])) for k in dots]
            extra = (',\n                 "entrances": ' + json.dumps(entrances) +
                     ',\n                 "entranceDoors": ' + json.dumps(edoors))
        s = pat.sub(lambda m: m.group(1) + json.dumps(first_pos) + m.group(2) +
                    json.dumps(first_doors) + extra, s, count=1)

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
