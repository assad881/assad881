#!/usr/bin/env python3
"""Bundle كسارة اكسبريس into single self-contained HTML files.

Outputs:
  dist/express-crusher.html   standalone page — open directly in any browser
  dist/artifact.html          same app as body-level content, for hosts that
                              supply their own <html>/<head>/<body> skeleton
"""
import re
import pathlib

ROOT = pathlib.Path(__file__).parent
DIST = ROOT / "dist"


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def build():
    html = read("index.html")

    css = read("assets/css/app.css")
    html = re.sub(
        r'\s*<link rel="stylesheet" href="assets/css/app\.css">',
        "\n  <style>\n" + css + "\n  </style>",
        html,
        count=1,
    )

    def inline_script(match):
        src = match.group(1)
        return "<script>\n/* ===== " + src + " ===== */\n" + read(src) + "\n</script>"

    html, n = re.subn(r'<script src="([^"]+)"></script>', inline_script, html)
    if n == 0:
        raise SystemExit("no scripts were inlined — check index.html")

    DIST.mkdir(exist_ok=True)
    (DIST / "express-crusher.html").write_text(html, encoding="utf-8")

    # body-level variant: keep <title> and the hoisted <style> at the top so
    # hosts that scan the start of the file still find the page name
    body = html.split("<body>", 1)[1].rsplit("</body>", 1)[0]
    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
    style = re.search(r"<style>.*?</style>", html, re.S).group(0)
    body = body.replace(style, "")
    artifact = "<title>" + title + "</title>\n" + style + "\n" + body.strip() + "\n"
    (DIST / "artifact.html").write_text(artifact, encoding="utf-8")

    for f in ("express-crusher.html", "artifact.html"):
        print(f"{f}: {(DIST / f).stat().st_size / 1024:.0f} KB")
    print(f"inlined {n} scripts")


if __name__ == "__main__":
    build()
