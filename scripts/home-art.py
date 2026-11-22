# Draws SuperYou's own home-page artwork (flat illustrations in the brand colours) into public/brand/home/.
# Run: python3 scripts/home-art.py
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "brand", "home")
os.makedirs(OUT, exist_ok=True)
ROSE, BLUSH, INK, CREAM, GOLD, DEEP, WHITE, INDIGO, SKY = "#c0587a", "#f3e3ea", "#141214", "#faf7f8", "#d9a86c", "#8f3557", "#ffffff", "#3730a3", "#e6e8ff"


def svg(w, h, body, bg=None):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{b}{body}</svg>'


def shadow(cx, cy, rx, ry=None):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry or rx*0.12}" fill="{INK}" opacity=".10"/>'


def bottle(x, y, w, h, body, cap=INK, label=WHITE, line=None):
    capw = w * 0.42
    return (shadow(x + w / 2, y + h + 4, w * 0.62)
            + f'<rect x="{x}" y="{y + h*0.2}" width="{w}" height="{h*0.8}" rx="{w*0.16}" fill="{body}"/>'
            + f'<rect x="{x + (w-capw)/2}" y="{y}" width="{capw}" height="{h*0.22}" rx="{capw*0.15}" fill="{cap}"/>'
            + f'<rect x="{x + w*0.14}" y="{y + h*0.45}" width="{w*0.72}" height="{h*0.3}" rx="6" fill="{label}" opacity=".92"/>'
            + (f'<rect x="{x + w*0.24}" y="{y + h*0.55}" width="{w*0.52}" height="{max(4,h*0.03)}" rx="2" fill="{line}"/>' if line else "")
            + f'<rect x="{x + w*0.12}" y="{y + h*0.26}" width="{w*0.08}" height="{h*0.5}" rx="4" fill="{WHITE}" opacity=".25"/>')


def dropper(x, y, w, h, body, bulb=INK):
    return (shadow(x + w / 2, y + h + 4, w * 0.62)
            + f'<rect x="{x}" y="{y + h*0.38}" width="{w}" height="{h*0.62}" rx="{w*0.2}" fill="{body}"/>'
            + f'<rect x="{x + w*0.28}" y="{y + h*0.26}" width="{w*0.44}" height="{h*0.14}" rx="4" fill="{GOLD}"/>'
            + f'<rect x="{x + w*0.33}" y="{y}" width="{w*0.34}" height="{h*0.28}" rx="{w*0.17}" fill="{bulb}"/>'
            + f'<rect x="{x + w*0.18}" y="{y + h*0.6}" width="{w*0.64}" height="{h*0.18}" rx="5" fill="{WHITE}" opacity=".9"/>'
            + f'<rect x="{x + w*0.12}" y="{y + h*0.44}" width="{w*0.08}" height="{h*0.42}" rx="4" fill="{WHITE}" opacity=".25"/>')


def jar(x, y, w, h, body, lid=GOLD):
    return (shadow(x + w / 2, y + h + 4, w * 0.6)
            + f'<rect x="{x}" y="{y + h*0.3}" width="{w}" height="{h*0.7}" rx="{h*0.16}" fill="{body}"/>'
            + f'<rect x="{x - w*0.03}" y="{y}" width="{w*1.06}" height="{h*0.34}" rx="{h*0.1}" fill="{lid}"/>'
            + f'<rect x="{x + w*0.2}" y="{y + h*0.52}" width="{w*0.6}" height="{h*0.22}" rx="6" fill="{WHITE}" opacity=".9"/>')


def lipstick(x, y, w, h, bullet=ROSE, case=INK, angle=0):
    return (f'<g transform="rotate({angle} {x + w/2} {y + h})">' + shadow(x + w / 2, y + h + 3, w * 0.8)
            + f'<rect x="{x}" y="{y + h*0.55}" width="{w}" height="{h*0.45}" rx="4" fill="{case}"/>'
            + f'<rect x="{x + w*0.08}" y="{y + h*0.38}" width="{w*0.84}" height="{h*0.2}" rx="3" fill="{GOLD}"/>'
            + f'<path d="M{x + w*0.16},{y + h*0.4} L{x + w*0.16},{y + h*0.12} L{x + w*0.84},{y} L{x + w*0.84},{y + h*0.4} Z" fill="{bullet}"/></g>')


def polish(x, y, w, h, color):
    return (shadow(x + w / 2, y + h + 3, w * 0.6)
            + f'<rect x="{x + w*0.3}" y="{y}" width="{w*0.4}" height="{h*0.42}" rx="5" fill="{INK}"/>'
            + f'<rect x="{x}" y="{y + h*0.38}" width="{w}" height="{h*0.62}" rx="{w*0.22}" fill="{color}"/>'
            + f'<rect x="{x + w*0.14}" y="{y + h*0.46}" width="{w*0.1}" height="{h*0.42}" rx="4" fill="{WHITE}" opacity=".35"/>')


def perfume(x, y, w, h, body, cap=GOLD):
    return (shadow(x + w / 2, y + h + 4, w * 0.6)
            + f'<rect x="{x + w*0.36}" y="{y}" width="{w*0.28}" height="{h*0.2}" rx="4" fill="{cap}"/>'
            + f'<rect x="{x + w*0.42}" y="{y + h*0.18}" width="{w*0.16}" height="{h*0.08}" fill="{GOLD}"/>'
            + f'<path d="M{x + w*0.12},{y + h*0.26} H{x + w*0.88} L{x + w},{y + h*0.4} V{y + h} H{x} V{y + h*0.4} Z" fill="{body}"/>'
            + f'<path d="M{x + w*0.12},{y + h*0.26} H{x + w*0.88} L{x + w},{y + h*0.4} H{x} Z" fill="{WHITE}" opacity=".25"/>'
            + f'<rect x="{x + w*0.25}" y="{y + h*0.55}" width="{w*0.5}" height="{h*0.2}" rx="4" fill="{WHITE}" opacity=".85"/>')


def palette(x, y, w, h, pans):
    s = shadow(x + w / 2, y + h + 4, w * 0.55) + f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{INK}"/>'
    cols = 3; rows = (len(pans) + cols - 1) // cols; pw = (w - 40) / cols; ph = (h - 30) / rows
    for i, c in enumerate(pans):
        cx = x + 20 + (i % cols) * pw + pw / 2; cy = y + 15 + (i // cols) * ph + ph / 2
        s += f'<circle cx="{cx}" cy="{cy}" r="{min(pw, ph)*0.36}" fill="{c}"/>'
    return s


def sparkle(x, y, r, c=GOLD):
    return f'<path d="M{x},{y-r} Q{x+r*0.18},{y-r*0.18} {x+r},{y} Q{x+r*0.18},{y+r*0.18} {x},{y+r} Q{x-r*0.18},{y+r*0.18} {x-r},{y} Q{x-r*0.18},{y-r*0.18} {x},{y-r} Z" fill="{c}"/>'


def arch(cx, top, w, h, c):
    return f'<path d="M{cx-w/2},{top+h} V{top+w/2} A{w/2},{w/2} 0 0 1 {cx+w/2},{top+w/2} V{top+h} Z" fill="{c}"/>'


# ── Heroes (right-hand picture of a split slide, 1200×900) ──────────────────────────────
def hero_originals():
    b = arch(600, 120, 640, 780, BLUSH) + f'<circle cx="330" cy="230" r="70" fill="{ROSE}" opacity=".18"/>'
    b += f'<rect x="250" y="700" width="700" height="26" rx="13" fill="{WHITE}"/>'
    b += dropper(330, 380, 130, 320, ROSE) + bottle(480, 300, 170, 400, INK, cap=GOLD, line=ROSE) + jar(670, 560, 190, 140, CREAM)
    b += lipstick(860, 560, 54, 140, angle=8)
    b += sparkle(300, 330, 26) + sparkle(900, 250, 34) + sparkle(820, 470, 16, ROSE)
    # "100% original" seal
    b += f'<g transform="translate(860 170) rotate(-10)"><circle r="92" fill="{INK}"/><circle r="78" fill="none" stroke="{GOLD}" stroke-width="3" stroke-dasharray="4 6"/>'
    b += f'<text y="-8" text-anchor="middle" font-family="Montserrat,Arial,sans-serif" font-weight="800" font-size="40" fill="{WHITE}">100%</text>'
    b += f'<text y="30" text-anchor="middle" font-family="Montserrat,Arial,sans-serif" font-weight="700" font-size="20" letter-spacing="3" fill="{GOLD}">ORIGINAL</text></g>'
    return svg(1200, 900, b, CREAM)


def hero_imported():
    b = arch(600, 120, 640, 780, SKY)
    # flight path
    b += f'<path d="M140,300 C320,120 620,140 820,260" fill="none" stroke="{INDIGO}" stroke-width="5" stroke-dasharray="14 12" opacity=".6"/>'
    b += f'<g transform="translate(840 268) rotate(28)"><path d="M-40,0 L40,0 M10,-6 L-16,-36 L-4,-36 L26,-6 M10,6 L-16,36 L-4,36 L26,6 M-34,-4 L-46,-20 L-40,-20 L-26,-4 M-34,4 L-46,20 L-40,20 L-26,4" stroke="{INDIGO}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>'
    # parcel
    b += shadow(600, 742, 230) + f'<rect x="390" y="470" width="420" height="270" rx="14" fill="{GOLD}"/><rect x="390" y="470" width="420" height="70" rx="14" fill="#c99556"/>'
    b += f'<rect x="580" y="470" width="40" height="270" fill="#b9864a"/><rect x="430" y="600" width="130" height="80" rx="8" fill="{WHITE}"/>'
    b += f'<text x="495" y="634" text-anchor="middle" font-family="Montserrat,Arial,sans-serif" font-weight="800" font-size="22" fill="{INDIGO}">USA</text>'
    b += f'<text x="495" y="662" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="16" fill="{INK}">→ LEBANON</text>'
    # products popping out
    b += lipstick(450, 330, 50, 150, angle=-14) + polish(530, 350, 80, 130, ROSE) + palette(630, 340, 170, 120, [ROSE, GOLD, "#e7b3c4", DEEP, "#a77b5a", "#f1d1bd"])
    b += sparkle(360, 420, 26, INDIGO) + sparkle(870, 420, 22) + sparkle(820, 560, 14, INDIGO)
    b += f'<g transform="translate(300 200) rotate(-8)"><rect x="-120" y="-38" width="240" height="76" rx="38" fill="{INDIGO}"/><text y="10" text-anchor="middle" font-family="Montserrat,Arial,sans-serif" font-weight="800" font-size="26" fill="{WHITE}">ALL-IN PRICE</text></g>'
    return svg(1200, 900, b, CREAM)


def hero_pharmacist():
    b = arch(600, 120, 640, 780, BLUSH)
    # phone with chat
    b += shadow(560, 812, 170) + f'<rect x="400" y="200" width="320" height="600" rx="44" fill="{INK}"/><rect x="418" y="250" width="284" height="510" rx="18" fill="{CREAM}"/>'
    b += f'<rect x="520" y="222" width="80" height="10" rx="5" fill="#333"/>'
    b += f'<rect x="440" y="290" width="200" height="64" rx="18" fill="{WHITE}"/><rect x="456" y="308" width="150" height="10" rx="5" fill="#cfc6cb"/><rect x="456" y="328" width="110" height="10" rx="5" fill="#cfc6cb"/>'
    b += f'<rect x="500" y="380" width="186" height="96" rx="18" fill="{ROSE}"/><rect x="516" y="400" width="150" height="10" rx="5" fill="{WHITE}" opacity=".9"/><rect x="516" y="420" width="130" height="10" rx="5" fill="{WHITE}" opacity=".9"/><rect x="516" y="440" width="90" height="10" rx="5" fill="{WHITE}" opacity=".9"/>'
    b += f'<rect x="440" y="500" width="170" height="64" rx="18" fill="{WHITE}"/><rect x="456" y="518" width="120" height="10" rx="5" fill="#cfc6cb"/><rect x="456" y="538" width="80" height="10" rx="5" fill="#cfc6cb"/>'
    b += f'<rect x="530" y="590" width="156" height="64" rx="18" fill="{ROSE}"/><rect x="546" y="610" width="110" height="10" rx="5" fill="{WHITE}" opacity=".9"/><rect x="546" y="630" width="70" height="10" rx="5" fill="{WHITE}" opacity=".9"/>'
    # pharmacy cross badge + products
    b += f'<g transform="translate(830 250)"><circle r="78" fill="{INK}"/><rect x="-14" y="-44" width="28" height="88" rx="6" fill="{GOLD}"/><rect x="-44" y="-14" width="88" height="28" rx="6" fill="{GOLD}"/></g>'
    b += dropper(780, 470, 110, 260, ROSE) + jar(250, 600, 170, 130, WHITE, lid=ROSE)
    b += sparkle(300, 360, 26) + sparkle(930, 600, 20, ROSE)
    return svg(1200, 900, b, CREAM)


# ── Category tiles (600×600) ───────────────────────────────────────────────────────────
def tile(bg, body):
    return svg(600, 600, f'<circle cx="300" cy="320" r="220" fill="{WHITE}" opacity=".55"/>' + body, bg)


TILES = {
    "face": tile(BLUSH, bottle(190, 170, 120, 300, CREAM, cap=GOLD, line=ROSE) + palette(320, 300, 160, 120, ["#f1d1bd", "#e3b49a", "#c98e6c", "#e7b3c4", ROSE, "#a77b5a"]) + sparkle(470, 170, 24)),
    "eyes": tile("#efe6f6", palette(150, 250, 300, 190, ["#e7b3c4", ROSE, DEEP, GOLD, "#a77b5a", "#5b4a63"]) + f'<g transform="rotate(-30 430 190)"><rect x="420" y="90" width="22" height="200" rx="11" fill="{INK}"/><rect x="414" y="70" width="34" height="40" rx="10" fill="{GOLD}"/></g>' + sparkle(150, 170, 22)),
    "lips": tile("#fbe3e3", lipstick(190, 190, 70, 260, angle=-10) + lipstick(290, 210, 70, 240, bullet=DEEP) + lipstick(390, 230, 70, 220, bullet="#e48aa9", angle=10) + sparkle(470, 160, 22)),
    "nails": tile("#fde9ef", polish(170, 210, 110, 220, ROSE) + polish(310, 240, 100, 190, DEEP) + polish(250, 300, 90, 160, "#e7b3c4") + sparkle(460, 190, 22)),
    "skincare": tile("#f6efe8", dropper(160, 170, 120, 300, ROSE) + jar(300, 330, 170, 130, WHITE, lid=GOLD) + sparkle(460, 200, 26) + sparkle(200, 140, 14, ROSE)),
    "hair": tile("#eaf1ee", bottle(170, 150, 130, 330, "#3d6b5c", cap=INK, line=GOLD) + bottle(320, 210, 110, 270, "#b9d3c8", cap=INK, line="#3d6b5c") + f'<rect x="440" y="180" width="26" height="260" rx="13" fill="{INK}"/><rect x="430" y="150" width="46" height="120" rx="20" fill="{GOLD}"/>'),
    "fragrance": tile("#f4ece4", perfume(180, 160, 170, 300, "#e7b3c4") + perfume(360, 260, 110, 200, GOLD, cap=INK) + sparkle(470, 180, 24, ROSE)),
    "baby": tile("#e9f1fb", bottle(200, 200, 110, 260, WHITE, cap="#8fb3e0", line="#8fb3e0") + jar(330, 330, 150, 130, "#cfe0f5", lid=WHITE) + f'<circle cx="440" cy="190" r="40" fill="#f7d26b"/><circle cx="440" cy="190" r="56" fill="none" stroke="#f7d26b" stroke-width="6" stroke-dasharray="6 10"/>'),
    "supplements": tile("#fff4e0", bottle(180, 170, 150, 290, "#f2b84b", cap=INK, line=INK) + ''.join(f'<g transform="translate({x} {y}) rotate({a})"><rect x="-34" y="-14" width="68" height="28" rx="14" fill="{c}"/><rect x="0" y="-14" width="34" height="28" rx="0" fill="{WHITE}" opacity=".6"/></g>' for x, y, a, c in [(400, 330, 20, ROSE), (450, 400, -15, "#f2b84b"), (380, 420, 40, INDIGO)]) + sparkle(460, 220, 22)),
    "gifts": tile("#fbe9ee", shadow(300, 470, 170) + f'<rect x="150" y="270" width="300" height="200" rx="12" fill="{ROSE}"/><rect x="135" y="230" width="330" height="60" rx="12" fill="{DEEP}"/><rect x="285" y="230" width="30" height="240" fill="{GOLD}"/><path d="M300,230 C250,150 190,180 230,225 Z M300,230 C350,150 410,180 370,225 Z" fill="{GOLD}"/>' + sparkle(470, 190, 24) + sparkle(140, 200, 16)),
}

for name, s in [("hero-originals", hero_originals()), ("hero-imported", hero_imported()), ("hero-pharmacist", hero_pharmacist())] + [(f"cat-{k}", v) for k, v in TILES.items()]:
    open(os.path.join(OUT, f"{name}.svg"), "w").write(s)
print("wrote", len(TILES) + 3, "files to", OUT)
