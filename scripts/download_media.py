#!/usr/bin/env python3
"""Download Drupal public files listed by the sanitized migration export."""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "content" / "migrated" / "tanitani" / "media.json"
PUBLIC_DIR = ROOT / "public"
SOURCE_ORIGIN = "https://www.tani-tani.info"
USER_AGENT = "Taní-tani migration/1.0"


def source_url(public_path: str) -> str:
    encoded_path = urllib.parse.quote(public_path, safe="/%:@?=&+,%")
    return SOURCE_ORIGIN + encoded_path


def safe_destination(public_path: str) -> Path:
    relative = public_path.lstrip("/")
    destination = (PUBLIC_DIR / relative).resolve()
    public_root = PUBLIC_DIR.resolve()
    if public_root not in destination.parents:
        raise ValueError(f"Unsafe media path: {public_path}")
    return destination


def download(item: dict[str, Any], force: bool, retries: int) -> tuple[str, str]:
    public_path = item["publicPath"]
    if not public_path.startswith("/"):
        return "skipped", public_path

    destination = safe_destination(public_path)
    expected_size = int(item.get("byteSize") or 0)
    if destination.exists() and not force:
        actual_size = destination.stat().st_size
        if expected_size == 0 or actual_size == expected_size:
            return "existing", public_path

    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_name(destination.name + ".part")
    request = urllib.request.Request(
        source_url(public_path), headers={"User-Agent": USER_AGENT},
    )
    data: bytes | None = None
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read()
            break
        except urllib.error.HTTPError as error:
            return "failed", f"{public_path}\t{error}"
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last_error = error
            if attempt < retries:
                time.sleep(min(60, 5 * (2 ** attempt)))
    if data is None:
        return "failed", f"{public_path}\t{last_error}"

    partial.write_bytes(data)
    os.replace(partial, destination)
    if expected_size and len(data) != expected_size:
        return "changed", f"{public_path}\tsize {len(data)} != {expected_size}"
    return "downloaded", public_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--retries", type=int, default=5)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    media = json.loads(MANIFEST.read_text(encoding="utf-8"))
    counts = {"downloaded": 0, "changed": 0, "existing": 0, "skipped": 0, "failed": 0}
    failures: list[str] = []
    changed: list[str] = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = [
            executor.submit(download, item, args.force, max(0, args.retries))
            for item in media
        ]
        for future in as_completed(futures):
            status, detail = future.result()
            counts[status] += 1
            if status == "failed":
                failures.append(detail)
            elif status == "changed":
                changed.append(detail)
            completed = sum(counts.values())
            if completed % 250 == 0:
                print(f"{completed}/{len(media)}", flush=True)

    print(json.dumps(counts, ensure_ascii=False, indent=2))
    if failures:
        failure_path = ROOT / "data" / "media-download-failures.txt"
        failure_path.parent.mkdir(parents=True, exist_ok=True)
        failure_path.write_text("\n".join(failures) + "\n", encoding="utf-8")
        print(f"Failures: {failure_path}")
    if changed:
        changed_path = ROOT / "data" / "media-download-changed.txt"
        changed_path.parent.mkdir(parents=True, exist_ok=True)
        changed_path.write_text("\n".join(changed) + "\n", encoding="utf-8")
        print(f"Changed since dump: {changed_path}")


if __name__ == "__main__":
    main()
