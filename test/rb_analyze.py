"""
Blank-frame / flash analysis for the living Regret Burger scene.

For every burst frame: distance-from-empty-background (RMS over the mascot
region). A blank/flash frame = distance collapsing to ~reference level while a
mascot should be on screen. Also prints frame-to-frame deltas: a hard cut is
ONE big delta; flicker = alternating big deltas; a fade would be a ramp.
"""
import glob, os, sys
import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(__file__), "shots", "burst")

def arr(p):
    return np.asarray(Image.open(p).convert("L"), dtype=np.float32)

def rms(a, b):
    return float(np.sqrt(np.mean((a - b) ** 2)))

fail = False
for tag, refname in [("order-burger", "ref-burger"), ("spam-burger", "ref-burger"),
                     ("cross-shake", "ref-shake")]:
    ref = arr(os.path.join(D, refname + ".png"))
    frames = sorted(glob.glob(os.path.join(D, tag + "-*.png")))
    dist = [rms(arr(f), ref) for f in frames]
    base = np.median(dist[:4])          # pre-click idle distance (mascot present)
    # a blank frame would drop toward 0 (== empty background)
    floor = 0.25 * base
    blanks = [i for i, d in enumerate(dist) if d < floor]
    deltas = [abs(dist[i] - dist[i - 1]) for i in range(1, len(dist))]
    big = [i + 1 for i, d in enumerate(deltas) if d > 0.5 * base]
    print(f"{tag}: frames={len(frames)} idle-dist~{base:.1f} "
          f"min-dist={min(dist):.1f} blanks={blanks} bigDeltas@{big}")
    if blanks:
        print(f"  FAIL: frame(s) {blanks} match the empty background (blank/flash)")
        fail = True
    # flicker heuristic: 3+ alternating big deltas in a 4-frame window
    for i in range(len(big) - 2):
        if big[i + 2] - big[i] <= 3:
            print(f"  WARN: dense transition cluster near frame {big[i]} (check visually)")
            break

print("ANALYSIS", "FAIL" if fail else "PASS")
sys.exit(1 if fail else 0)
