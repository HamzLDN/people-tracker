"""Download gait datasets with working public mirrors where possible."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "output" / "gait-datasets"

# Direct downloads (no application) verified Oct 2026
PUBLIC = {
    "casia-b-hf": {
        "label": "CASIA-B silhouettes (Hugging Face mirror of classic benchmark)",
        "kind": "huggingface",
        "repo_id": "liandun110/object_detection",
        "filename": "CASIA-B_dataset.tar",
        "page": "https://huggingface.co/datasets/liandun110/object_detection",
        "notes": "Academic gait benchmark; extract .tar after download. Official CASIA link often times out.",
    },
    "healthgait-samples": {
        "label": "Health&Gait sample pack (Zenodo)",
        "kind": "url",
        "url": "https://zenodo.org/api/records/14039922/files/dataset_samples.zip/content",
        "out_name": "HealthGait-dataset_samples.zip",
        "page": "https://zenodo.org/records/14039922",
        "notes": "62 MB preview; full Health_Gait split archive is ~25 GB on same Zenodo record.",
    },
}

# Application / password required — links kept current for manual requests
GATED = {
    "gait3d": {
        "page": "https://gait3d.github.io/",
        "agreement": "https://gait3d.github.io/resources/AgreementForGait3D.pdf",
        "email": "gait3d.dataset@gmail.com",
    },
    "grew": {
        "page": "http://www.grew-benchmark.org/download.html",
        "repo": "https://github.com/GREW-Benchmark/GREW-Benchmark",
        "email": "zhengzhu@ieee.org, xianda_guo@163.com",
    },
    "oumvlp": {
        "page": "http://www.am.sanken.osaka-u.ac.jp/BiometricDB/GaitMVLP.html",
        "agreement": "http://www.am.sanken.osaka-u.ac.jp/BiometricDB/doc/OUMVLP_ReleaseAgreement.pdf",
        "email": "database administrator (see page)",
    },
    "ccpg": {
        "page": "https://github.com/BNU-IVC/CCPG",
        "email": "BNU-IVC@outlook.com",
    },
    "ccgr-mini": {
        "page": "https://github.com/ShinanZou/CCGR",
        "onedrive": "https://1drv.ms/f/c/8464f220191191b1/Ev18lg3FHJZCoyF_6z91JUUBDgBX7EZN0WHJKJnDEIzbWA?e=xon8em",
    },
    "sustech1k": {
        "page": "https://lidargait.github.io/",
        "email": "shencf2019@mail.sustech.edu.cn",
    },
}


def _download_hf(repo_id: str, filename: str, out_dir: Path) -> Path:
    from huggingface_hub import hf_hub_download

    out_dir.mkdir(parents=True, exist_ok=True)
    return Path(
        hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            repo_type="dataset",
            local_dir=str(out_dir),
        )
    )


def _download_url(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(["curl.exe", "-L", "--fail", "-o", str(dest), url])
    return dest


def main() -> None:
    parser = argparse.ArgumentParser(description="Download public gait dataset mirrors.")
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Download directory (default: output/gait-datasets)",
    )
    parser.add_argument(
        "--only",
        choices=list(PUBLIC.keys()),
        help="Download a single public package",
    )
    parser.add_argument("--list-gated", action="store_true", help="Print gated datasets and how to apply.")
    args = parser.parse_args()

    if args.list_gated:
        print(json.dumps(GATED, indent=2))
        return

    keys = [args.only] if args.only else list(PUBLIC.keys())
    for key in keys:
        spec = PUBLIC[key]
        print(f"Downloading {spec['label']}...", flush=True)
        if spec["kind"] == "huggingface":
            path = _download_hf(spec["repo_id"], spec["filename"], args.out)
        elif spec["kind"] == "url":
            path = _download_url(spec["url"], args.out / spec["out_name"])
        else:
            raise SystemExit(f"Unknown kind for {key}")
        print(f"  -> {path}", flush=True)

    manifest = args.out / "download_manifest.json"
    manifest.write_text(
        json.dumps({"public": PUBLIC, "gated": GATED, "downloaded": keys}, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {manifest}", flush=True)


if __name__ == "__main__":
    main()
