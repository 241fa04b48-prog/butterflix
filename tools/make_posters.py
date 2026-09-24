# One-shot: make every Butterflix poster match its title.
# Real titles -> real posters downloaded from Wikipedia into assets/images/posters/real/
# Fictional titles -> generated SVG title posters into assets/images/posters/gen/
import json, os, time, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "db.json")
REAL_DIR = os.path.join(ROOT, "assets", "images", "posters", "real")
GEN_DIR = os.path.join(ROOT, "assets", "images", "posters", "gen")
os.makedirs(REAL_DIR, exist_ok=True)
os.makedirs(GEN_DIR, exist_ok=True)

WIKI = "https://en.wikipedia.org/w/api.php"
HEADERS = {"User-Agent": "ButterflixDemo/1.0 (local demo project)"}

def api(params):
    url = WIKI + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS)
    return json.load(urllib.request.urlopen(req, timeout=15))

def wiki_thumb(title):
    r = api({"action": "query", "titles": title, "prop": "pageimages",
             "pilicense": "any", "pithumbsize": "600", "redirects": "1", "format": "json"})
    page = next(iter(r["query"]["pages"].values()))
    return (page.get("thumbnail") or {}).get("source")

def download(url, dest):
    req = urllib.request.Request(url.split("?")[0], headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp, open(dest, "wb") as out:
        out.write(resp.read())
    return os.path.getsize(dest) > 2000

PALETTE = ["#c43b4a", "#3d6f94", "#c48a3a", "#6b5ca8", "#3f8a68", "#8a3d6a", "#4a7a9a", "#c45d38"]

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

def gen_poster(title):
    slug = "".join(c if c.isalnum() else "-" for c in title.lower()).strip("-")[:40] or "poster"
    rel = "assets/images/posters/gen/" + slug + ".svg"
    dest = os.path.join(ROOT, rel)
    if os.path.exists(dest):
        return rel
    lines, cur = [], ""
    for w in title.split():
        if cur and len(cur) + len(w) + 1 > 14:
            lines.append(cur); cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur: lines.append(cur)
    lines = lines[:5]
    n = sum(ord(c) for c in title)
    bg, ac = PALETTE[n % len(PALETTE)], PALETTE[(n // 3) % len(PALETTE)]
    tspans = "".join(
        '<tspan x="300" dy="%d">%s</tspan>' % (0 if i == 0 else 46, esc(l))
        for i, l in enumerate(lines))
    y0 = 330 - (len(lines) - 1) * 23
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">'
           '<defs>'
           '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
           '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="#0b0c12"/>'
           '</linearGradient>'
           '<radialGradient id="glow" cx="0.5" cy="0.32" r="0.6">'
           '<stop offset="0" stop-color="%s" stop-opacity="0.5"/><stop offset="1" stop-color="%s" stop-opacity="0"/>'
           '</radialGradient>'
           '</defs>'
           '<rect width="600" height="900" fill="url(#bg)"/>'
           '<rect width="600" height="900" fill="url(#glow)"/>'
           '<circle cx="300" cy="240" r="95" fill="none" stroke="%s" stroke-opacity="0.75" stroke-width="3"/>'
           '<circle cx="300" cy="240" r="122" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/>'
           '<text x="300" y="238" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="52" font-weight="bold" fill="#f3ead6">%s</text>'
           '<text x="300" y="%d" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="40" font-weight="800" fill="#ffffff">%s</text>'
           '<rect x="60" y="760" width="480" height="2" fill="#ffffff" opacity="0.25"/>'
           '<text x="300" y="800" text-anchor="middle" font-family="Georgia, serif" font-size="30" letter-spacing="10" fill="%s">BUTTERFLIX</text>'
           '<text x="300" y="838" text-anchor="middle" font-family="Georgia, serif" font-size="18" letter-spacing="5" fill="#d9d5c8">CINEMA COLLECTION</text>'
           '</svg>') % (bg, ac, ac, ac, esc(title.strip()[:1] or "B"), y0, tspans, ac)
    with open(dest, "w", encoding="utf-8") as f:
        f.write(svg)
    return rel

REAL_TITLES = {
    "h1": "Inception (2010 film)",
    "h2": "Interstellar (film)",
    "h3": "The Dark Knight",
    "h4": "Avatar: The Way of Water",
    "b1": "Jawan (film)",
    "b2": "Pathaan (film)",
    "b3": "3 Idiots",
    "b4": "Dangal (film)",
    "t1": "RRR (film)",
    "t2": "Baahubali 2: The Conclusion",
    "t3": "Pushpa: The Rise",
    "t4": "Salaar: Part 1 – Ceasefire",
    "u1": "NTR: Neel",
    "u2": "Avengers: Doomsday",
    "tv1": "Stranger Things",
    "tv2": "Money Heist",
    "tv3": "Baahubali: Before the Beginning",
    "tv5": "Scam 1992 (TV series)",
    "c1": "Spider-Man: Across the Spider-Verse",
    "c2": "Chhota Bheem (TV series)",
    "c3": "Kalki 2898 AD",
    "m17": "Kalki 2898 AD",
}

FALLBACKS = {
    "t1": ["RRR", "RRR (film)"],
    "u1": ["NTRNeel", "NTR Neel", "NTR 31"],
    "u2": ["Avengers: Doomsday", "Avengers: The Kang Dynasty"],
    "tv3": ["Baahubali: Before the Beginning", "Baahubali (franchise)"],
    "tv5": ["Scam 1992 (TV series)", "Scam 1992"],
    "c2": ["Chhota Bheem (TV series)", "Chhota Bheem"],
    "c3": ["Kalki 2898 AD"],
    "m17": ["Kalki 2898 AD"],
}

def main():
    db = json.load(open(DB, encoding="utf-8"))
    changed = 0
    for m in db["movies"]:
        mid = m["id"]
        rel = None
        if mid in REAL_TITLES:
            fn = "r_" + mid + ".jpg"
            dest = os.path.join(REAL_DIR, fn)
            if os.path.exists(dest) and os.path.getsize(dest) > 2000:
                rel = "assets/images/posters/real/" + fn
            else:
                for attempt in [REAL_TITLES[mid]] + FALLBACKS.get(mid, []):
                    try:
                        url = wiki_thumb(attempt)
                    except Exception:
                        url = None
                    if url:
                        try:
                            if download(url, dest):
                                rel = "assets/images/posters/real/" + fn
                                break
                        except Exception:
                            pass
                    time.sleep(0.7)
        if not rel:
            rel = gen_poster(m["title"])
        if m.get("poster") != rel:
            m["poster"] = rel
            m["backdrop"] = rel
            changed += 1
        time.sleep(0.35)
    json.dump(db, open(DB, "w", encoding="utf-8"), indent=2)
    print("updated %d movies; total %d" % (changed, len(db["movies"])))

main()
