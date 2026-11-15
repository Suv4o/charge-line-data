#!/usr/bin/env python3
"""Downloads the catalogue agent's reading before it starts, politely and without AI.

- The Driven's RSS feed, pages 1 to 3, 10 seconds apart as its robots.txt asks.
- BITRE's latest monthly spreadsheet of vehicles entered on the Register of Approved Vehicles, as CSV per sheet.

    python3 scripts/gather_sources.py <output-dir>

Runs in GitHub Actions before the agent, outside the agent's sandbox. Needs openpyxl for the spreadsheet; without
it the spreadsheet is skipped and the agent is told so.
"""

import csv
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

DRIVEN_FEED = "https://thedriven.io/feed/"
BITRE_PAGE = "https://www.bitre.gov.au/resource/roads-vehicles/road-vehicle-entry-and-recall-statistics"


# Both are honest names, never a browser's. The Driven refuses Python's default; BITRE's firewall stalls one with a
# link in it, so BITRE gets Python's own.
NAMED = "ChargeLineData/1.0 (+https://github.com/Suv4o/charge-line-data)"


def get(url: str, named: bool = True) -> bytes:
    headers = {"User-Agent": NAMED} if named else {}
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
        return response.read()


def driven(out: Path, notes: list[str]) -> None:
    for page in (1, 2, 3):
        url = DRIVEN_FEED if page == 1 else f"{DRIVEN_FEED}?paged={page}"
        try:
            (out / f"thedriven-feed-{page}.xml").write_bytes(get(url))
            notes.append(f"thedriven-feed-{page}.xml: The Driven's RSS feed, page {page} ({url})")
        except Exception as error:  # noqa: BLE001: report and carry on
            notes.append(f"The Driven feed page {page} failed: {error}")
        if page < 3:
            time.sleep(10)


def bitre(out: Path, notes: list[str]) -> None:
    try:
        html = get(BITRE_PAGE, named=False).decode("utf-8", "replace")
    except Exception as error:  # noqa: BLE001
        notes.append(f"BITRE page failed: {error}")
        return
    links = [urllib.parse.urljoin(BITRE_PAGE, href) for href in re.findall(r'href="([^"]+\.xlsx)"', html, re.I)]
    if not links:
        notes.append("BITRE: no spreadsheet link found on the page")
        return
    url = links[0]
    try:
        import openpyxl  # noqa: PLC0415: optional
    except ImportError:
        notes.append(f"BITRE spreadsheet not converted (openpyxl missing): {url}")
        return
    path = out / "bitre-rav.xlsx"
    try:
        path.write_bytes(get(url, named=False))
        book = openpyxl.load_workbook(path, read_only=True, data_only=True)
    except Exception as error:  # noqa: BLE001
        notes.append(f"BITRE spreadsheet failed: {error} ({url})")
        return
    for sheet in book.worksheets:
        name = re.sub(r"[^A-Za-z0-9]+", "-", sheet.title).strip("-").lower() or "sheet"
        with (out / f"bitre-{name}.csv").open("w", newline="") as handle:
            writer = csv.writer(handle)
            for row in sheet.iter_rows(values_only=True):
                if any(cell is not None for cell in row):
                    writer.writerow(["" if cell is None else cell for cell in row])
        notes.append(f"bitre-{name}.csv: BITRE sheet \"{sheet.title}\" ({url})")
    path.unlink()


def main() -> None:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    notes: list[str] = []
    driven(out, notes)
    bitre(out, notes)
    (out / "README.txt").write_text("Downloaded before the agent started:\n" + "\n".join(f"- {n}" for n in notes) + "\n")
    print("\n".join(notes))


if __name__ == "__main__":
    main()
