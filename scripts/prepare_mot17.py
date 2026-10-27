"""Extract MOT17 train sequences to browser-ready MP4s and a manifest."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import zipfile
from configparser import ConfigParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ZIP = ROOT / "output" / "MOT17.zip"
# Avoid `output/MOT17` on Windows — it collides case-insensitively with `output/mot17` (train-frames mirror).
DEFAULT_EXTRACT = ROOT / "output" / "motchallenge"
SAMPLES_DIR = ROOT / "frontend" / "public" / "samples"
PREFERRED_VARIANT = "SDP"
FALLBACK_VARIANT = "FRCNN"
TRAIN_SEQ_RE = re.compile(r"^MOT17-(\d+)-(SDP|FRCNN|DPM)$", re.I)


def _relative_or_abs(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def find_train_root(extract_dir: Path) -> Path:
    for candidate in (extract_dir, extract_dir / "MOT17", extract_dir / "mot17"):
        train = candidate / "train"
        if train.is_dir():
            return train
    raise FileNotFoundError(f"No MOT17 train/ folder under {extract_dir}")


def parse_seqinfo(seq_dir: Path) -> tuple[int, int, int]:
    ini = seq_dir / "seqinfo.ini"
    if not ini.is_file():
        raise FileNotFoundError(f"Missing seqinfo.ini in {seq_dir}")
    parser = ConfigParser()
    parser.read(ini, encoding="utf-8")
    sec = parser["Sequence"] if "Sequence" in parser else parser[parser.sections()[0]]
    fps = int(sec.get("frameRate", "30"))
    length = int(sec.get("seqLength", "0"))
    width = int(sec.get("imWidth", "0"))
    return fps, length, width


def ffmpeg_exe() -> str:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as e:
        raise SystemExit("Install imageio-ffmpeg in the venv: pip install imageio-ffmpeg") from e


def encode_sequence(seq_dir: Path, out_mp4: Path, fps: int) -> None:
    img_dir = seq_dir / "img1"
    if not img_dir.is_dir():
        raise FileNotFoundError(f"No img1/ in {seq_dir}")
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = ffmpeg_exe()
    cmd = [
        ffmpeg,
        "-y",
        "-framerate",
        str(fps),
        "-i",
        str(img_dir / "%06d.jpg"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(out_mp4),
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)


def gt_person_count(seq_dir: Path) -> int | None:
    gt = seq_dir / "gt" / "gt.txt"
    if not gt.is_file():
        return None
    ids: set[int] = set()
    for line in gt.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(",")
        if len(parts) < 2:
            continue
        try:
            pid = int(parts[1])
        except ValueError:
            continue
        if pid > 0:
            ids.add(pid)
    return len(ids)


def ensure_extracted(zip_path: Path, extract_dir: Path) -> Path:
    try:
        train = find_train_root(extract_dir)
        if any(pick_train_sequences(train)):
            return train
        print(f"No MOT17 train sequences under {train}; re-extracting from zip...", flush=True)
    except FileNotFoundError:
        pass
    if not zip_path.is_file():
        raise FileNotFoundError(f"MOT17 zip not found: {zip_path}")
    extract_dir.mkdir(parents=True, exist_ok=True)
    print(f"Extracting {zip_path.name} to {extract_dir} (this can take several minutes)...", flush=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(extract_dir)
    return find_train_root(extract_dir)


def pick_train_sequences(train_root: Path) -> list[Path]:
    by_num: dict[str, Path] = {}
    variant_rank = {PREFERRED_VARIANT.upper(): 0, FALLBACK_VARIANT.upper(): 1, "DPM": 2}
    for seq_dir in sorted(train_root.iterdir()):
        if not seq_dir.is_dir():
            continue
        m = TRAIN_SEQ_RE.match(seq_dir.name)
        if not m:
            continue
        seq_num, variant = m.group(1), m.group(2).upper()
        rank = variant_rank.get(variant, 9)
        prev = by_num.get(seq_num)
        if prev is None:
            by_num[seq_num] = (rank, seq_dir)
            continue
        if rank < prev[0]:
            by_num[seq_num] = (rank, seq_dir)
    return [pair[1] for _num, pair in sorted(by_num.items())]


def build_manifest(train_root: Path, samples_dir: Path, *, skip_existing: bool) -> list[dict]:
    entries: list[dict] = []
    for seq_dir in pick_train_sequences(train_root):
        m = TRAIN_SEQ_RE.match(seq_dir.name)
        assert m
        seq_num = m.group(1)
        variant = m.group(2).upper()
        fps, length, width = parse_seqinfo(seq_dir)
        slug = f"MOT17-{seq_num}"
        out_mp4 = samples_dir / f"{slug}.mp4"
        if not skip_existing or not out_mp4.is_file():
            print(f"Encoding {seq_dir.name} to {out_mp4.name}", flush=True)
            encode_sequence(seq_dir, out_mp4, fps)
        persons = gt_person_count(seq_dir)
        entries.append(
            {
                "id": slug,
                "label": f"MOT17-{seq_num} (train, {variant})",
                "file": f"/samples/{slug}.mp4",
                "fps": fps,
                "frames": length,
                "width": width,
                "gtPersons": persons,
                "seqDir": _relative_or_abs(seq_dir),
            }
        )
    return entries


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare MOT17 train videos for the People Tracker UI.")
    parser.add_argument("--zip", type=Path, default=DEFAULT_ZIP)
    parser.add_argument("--extract", type=Path, default=DEFAULT_EXTRACT)
    parser.add_argument("--skip-existing", action="store_true", help="Do not re-encode MP4s that already exist.")
    args = parser.parse_args()

    train_root = ensure_extracted(args.zip, args.extract)
    entries = build_manifest(train_root, SAMPLES_DIR, skip_existing=args.skip_existing)
    manifest_path = SAMPLES_DIR / "mot17-manifest.json"
    manifest_path.write_text(json.dumps({"sequences": entries}, indent=2), encoding="utf-8")
    print(f"Wrote {len(entries)} sequences to {manifest_path}", flush=True)


if __name__ == "__main__":
    main()
