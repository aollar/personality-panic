# Builds assets/cards/casey_chip_wide.png — the horizontal building-HUD card —
# from the tall Casey card art (portrait + coins), matching Austin's layout.
# The live overlays in ui.js are aligned to THESE exact coordinates.
from PIL import Image, ImageDraw, ImageFont

W, H = 720, 402
tall = Image.open("assets/cards/casey_turncard_tall.jpg")  # 292 x 915
tw, th = tall.size

img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# parchment card + ink border
d.rounded_rectangle([2, 2, W - 3, H - 3], radius=26, fill=(242, 228, 189, 255),
                    outline=(19, 12, 6, 255), width=7)
d.rounded_rectangle([9, 9, W - 10, H - 10], radius=20, outline=(214, 192, 140, 255), width=2)

# portrait (from the tall card art)
por = tall.crop((int(.04 * tw), int(.235 * th), int(.96 * tw), int(.615 * th)))
ph = 312; pw = int(por.width * ph / por.height)
por = por.resize((pw, ph))
mask = Image.new("L", por.size, 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, ph - 1], radius=18, fill=255)
img.paste(por, (14, 76), mask)
d.rounded_rectangle([14, 76, 14 + pw - 1, 76 + ph - 1], radius=18, outline=(19, 12, 6, 255), width=4)

def font(sz, bold=True):
    try: return ImageFont.truetype("arialbd.ttf" if bold else "arial.ttf", sz)
    except Exception: return ImageFont.load_default()

# name block
d.text((272, 20), "CASEY", font=font(42), fill=(23, 16, 8, 255))
d.text((274, 68), "ENFP · THE CAMPAIGNER", font=font(17), fill=(43, 94, 41, 255))

# money chip (live overlay text sits on top)
d.rounded_rectangle([470, 18, 702, 72], radius=12, fill=(21, 39, 15, 255),
                    outline=(19, 12, 6, 255), width=4)

# 2x2 stat bars with labels; tracks are empty (live fills overlay)
BARS = [("CONNECTION", 268, 104), ("HEALTH", 480, 104), ("CAREER", 268, 158), ("HAPPINESS", 480, 158)]
for label, x, y in BARS:
    d.text((x + 2, y), label, font=font(15), fill=(23, 16, 8, 255))
    d.rounded_rectangle([x, y + 19, x + 184, y + 41], radius=7, fill=(43, 36, 22, 255),
                        outline=(19, 12, 6, 255), width=3)

# three upkeep coins cropped from the tall card
coins = tall.crop((int(.03 * tw), int(.825 * th), int(.97 * tw), int(.915 * th)))
cw3 = coins.width // 3
labels = ["COOLNESS", "CRITICAL TH.", "ENLIGHTEN."]
for i in range(3):
    c = coins.crop((i * cw3 + 6, 0, (i + 1) * cw3 - 6, coins.height))
    c = c.resize((80, int(c.height * 80 / c.width)))
    cm = Image.new("L", c.size, 0)
    ImageDraw.Draw(cm).ellipse([2, 2, c.size[0] - 3, c.size[1] - 3], fill=255)
    img.paste(c, (272 + i * 96, 216), cm)
    d.text((268 + i * 96, 302), labels[i], font=font(12), fill=(23, 16, 8, 255))

# TU / clock pill bottom-left (live text overlays)
d.rounded_rectangle([14, 352, 190, 392], radius=18, fill=(15, 10, 6, 225),
                    outline=(255, 200, 61, 255), width=3)

img.save("assets/cards/casey_chip_wide.png")
print("wide chip written", img.size)
