"""
Apply a hotspot layout exported from the Scene Button Editor artifact.

Usage:  python scripts/import_scene_hotspots.py path/to/layout.json

Rewrites:
  - assets/data/scene_pages.js  : the whole PP_SCENE_PAGES object (paged scenes)
  - assets/data/scene_hotspots.js: the per-building PP_HOTSPOTS arrays that the
    layout touches (legacy scenes), leaving PP_MAP_BOXES and everything else alone.

The editor exports explicit boxes (grid helpers are already resolved), so the
generated data is plain and self-contained.
"""
import io, json, re, sys

PAGES_JS = "assets/data/scene_pages.js"
HOT_JS = "assets/data/scene_hotspots.js"

def box(b):
    return "[" + ", ".join(str(round(float(x), 1)) for x in b) + "]"

def hotspot(h):
    parts = ['a: "%s"' % h["a"]]
    if h.get("choice"):
        c = h["choice"]
        inner = ", ".join('%s: "%s"' % (k, v) for k, v in c.items())
        parts.append("choice: { %s }" % inner)
    if h.get("work"):
        parts.append("work: true")
    parts.append("box: " + box(h["box"]))
    return "{ " + ", ".join(parts) + " }"

def serialize_paged(paged):
    out = ["var PP_SCENE_PAGES = {"]
    bkeys = list(paged.keys())
    for bi, b in enumerate(bkeys):
        cfg = paged[b]
        out.append("  %s: {" % b)
        # tabBar
        tb = ", ".join('{ tab: "%s", box: %s }' % (t["tab"], box(t["box"])) for t in cfg.get("tabBar", []))
        out.append("    tabBar: [" + tb + "],")
        if cfg.get("arrows"):
            a = cfg["arrows"]
            out.append("    arrows: { prev: %s, next: %s }," % (box(a["prev"]), box(a["next"])))
        if cfg.get("work"):
            out.append('    work: { a: "%s", box: %s },' % (cfg["work"]["a"], box(cfg["work"]["box"])))
        out.append("    tabs: [")
        for ti, t in enumerate(cfg["tabs"]):
            out.append('      { id: "%s", label: "%s", pages: [' % (t["id"], t["label"]))
            for pi, pg in enumerate(t["pages"]):
                head = '        { img: "%s", ' % pg["img"]
                if pg.get("arrows"):
                    a = pg["arrows"]
                    head += "arrows: { prev: %s, next: %s }, " % (box(a["prev"]), box(a["next"]))
                head += "hotspots: ["
                out.append(head)
                for hi, h in enumerate(pg["hotspots"]):
                    comma = "," if hi < len(pg["hotspots"]) - 1 else ""
                    out.append("          " + hotspot(h) + comma)
                tail = "        ]}" + ("," if pi < len(t["pages"]) - 1 else "")
                out.append(tail)
            out.append("      ]}" + ("," if ti < len(cfg["tabs"]) - 1 else ""))
        out.append("    ]")
        out.append("  }" + ("," if bi < len(bkeys) - 1 else ""))
    out.append("};")
    return "\n".join(out)

def main():
    lay = json.loads(io.open(sys.argv[1], encoding="utf-8").read())

    # ---- scene_pages.js: replace the whole PP_SCENE_PAGES literal ----
    s = io.open(PAGES_JS, encoding="utf-8").read()
    new_block = serialize_paged(lay["paged"])
    s2 = re.sub(r"var PP_SCENE_PAGES = \{.*?\n\};", new_block, s, count=1, flags=re.S)
    if s2 == s:
        sys.exit("FATAL: could not find the PP_SCENE_PAGES block in " + PAGES_JS)
    io.open(PAGES_JS, "w", encoding="utf-8").write(s2)

    # ---- scene_hotspots.js: replace each touched legacy building's array ----
    h = io.open(HOT_JS, encoding="utf-8").read()
    for b, arr in lay.get("legacy", {}).items():
        rows = ",\n".join("    " + hotspot(x) for x in arr)
        repl = "  %s: [\n%s\n  ]" % (b, rows)
        pat = re.compile(r"  %s: \[.*?\n  \]" % re.escape(b), re.S)
        if not pat.search(h):
            print("WARN: legacy scene %s not found, skipped" % b); continue
        h = pat.sub(lambda _: repl, h, count=1)
    io.open(HOT_JS, "w", encoding="utf-8").write(h)

    print("imported %d paged scenes, %d legacy scenes" % (len(lay["paged"]), len(lay.get("legacy", {}))))
    print("now run:  node test/hotspot_sanity.js")

if __name__ == "__main__":
    main()
