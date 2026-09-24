import json
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "db.json"
OUT = ROOT / "assets" / "images" / "posters"
OUT.mkdir(parents=True, exist_ok=True)

CTX = ssl.create_default_context()
UA = "ButterflixMovieApp/1.0 (educational catalogue; local student project)"

WIKI_PAGES = {
    "h1": "Inception",
    "h2": "Interstellar_(film)",
    "h3": "The_Dark_Knight",
    "h4": "Avatar:_The_Way_of_Water",
    "b1": "Jawan_(film)",
    "b2": "Pathaan_(film)",
    "b3": "3_Idiots",
    "b4": "Dangal_(film)",
    "t1": "RRR_(film)",
    "t2": "Baahubali_2:_The_Conclusion",
    "t3": "Pushpa:_The_Rise",
    "t4": "Salaar:_Part_1_–_Ceasefire",
}


def request_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, context=CTX, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def clean_image_url(url):
    if not url:
        return ""
    return url.split("?")[0]


def wiki_image(page):
    encoded = urllib.parse.quote(page, safe=":_()")
    data = request_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}")
    image = data.get("originalimage") or data.get("thumbnail") or {}
    return clean_image_url(image.get("source", "")), data.get("title", page)


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, context=CTX, timeout=40) as response:
        dest.write_bytes(response.read())


def main():
    db = json.loads(DB.read_text(encoding="utf-8"))
    for movie in db["movies"]:
        page = WIKI_PAGES.get(movie["id"])
        if not page:
            print("skip", movie["id"])
            continue
        try:
            url, title = wiki_image(page)
            if not url:
                print("NO IMAGE", movie["title"])
                continue
            ext = ".png" if url.lower().endswith(".png") else ".jpg"
            filename = f"{movie['id']}{ext}"
            dest = OUT / filename
            download(url, dest)
            rel = f"../assets/images/posters/{filename}"
            movie["poster"] = rel
            movie["backdrop"] = rel
            print("OK", movie["title"], "<-", title, dest.stat().st_size, "bytes")
        except Exception as error:
            print("FAIL", movie["title"], error)
    DB.write_text(json.dumps(db, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
