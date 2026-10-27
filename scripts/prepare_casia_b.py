"""Extract CASIA-B silhouettes and encode browser-ready clips + manifest."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tarfile
import tempfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TAR = ROOT / "output" / "gait-datasets" / "CASIA-B_dataset.tar"
EXTRACT_DIR = ROOT / "output" / "gait-datasets" / "CASIA-B"
SAMPLES_DIR = ROOT / "frontend" / "public" / "samples" / "casia-b"
EXTRACT_MARKER = EXTRACT_DIR / ".extract-complete"
DEFAULT_FPS = 25
DEFAULT_CONDITION = "nm-01"
DEFAULT_ANGLE = "090"
FRAME_TAIL_RE = re.compile(r"-(\d+)\.png$", re.I)


def parse_casia_png_path(name: str) -> tuple[str, str, str, int] | None:
    parts = name.split("/")
    if len(parts) != 5 or parts[0] != "CASIA-B" or not parts[4].lower().endswith(".png"):
        return None
    subj, cond, ang, fname = parts[1], parts[2], parts[3], parts[4]
    if not (subj.isdigit() and ang.isdigit()):
        return None
    m = FRAME_TAIL_RE.search(fname)
    if not m:
        return None
    return subj, cond, ang, int(m.group(1))


def _relative_or_abs(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def ffmpeg_exe() -> str:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as e:
        raise SystemExit("Install imageio-ffmpeg in the venv: pip install imageio-ffmpeg") from e


def ensure_full_extract(tar_path: Path, extract_dir: Path) -> Path:
    data_root = extract_dir / "CASIA-B"
    if EXTRACT_MARKER.is_file() and data_root.is_dir():
        return data_root
    if not tar_path.is_file():
        raise FileNotFoundError(
            f"CASIA-B tar not found: {tar_path}\n"
            "Run: .venv\\Scripts\\python.exe scripts\\download_gait_datasets.py --only casia-b-hf"
        )
    extract_dir.mkdir(parents=True, exist_ok=True)
    print(f"Extracting {tar_path.name} to {extract_dir} (1M+ files; can take 30–60 min)...", flush=True)
    with tarfile.open(tar_path, "r") as tf:
        tf.extractall(extract_dir)
    EXTRACT_MARKER.write_text("ok\n", encoding="utf-8")
    if not data_root.is_dir():
        raise FileNotFoundError(f"Expected CASIA-B/ folder under {extract_dir}")
    return data_root


def index_tar(tar_path: Path, *, condition: str, angle: str) -> dict[str, list[tuple[int, tarfile.TarInfo]]]:
    """Map subject id -> sorted (frame_index, TarInfo) for one condition/angle."""
    by_subj: dict[str, list[tuple[int, tarfile.TarInfo]]] = defaultdict(list)
    with tarfile.open(tar_path, "r") as tf:
        for info in tf.getmembers():
            if not info.isfile():
                continue
            parsed = parse_casia_png_path(info.name)
            if not parsed:
                continue
            subj, cond, ang, frame_i = parsed
            if cond != condition or ang != angle:
                continue
            by_subj[subj].append((frame_i, info))
    for subj in by_subj:
        by_subj[subj].sort(key=lambda row: row[0])
    return dict(by_subj)


def encode_from_png_list(pngs: list[Path], out_mp4: Path, fps: int) -> None:
    if not pngs:
        raise FileNotFoundError("No PNG frames to encode")
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = ffmpeg_exe()
    with tempfile.TemporaryDirectory(prefix="casia-b-") as tmp:
        tmp_path = Path(tmp)
        for i, png in enumerate(pngs, start=1):
            shutil.copy2(png, tmp_path / f"{i:06d}.png")
        cmd = [
            ffmpeg,
            "-y",
            "-framerate",
            str(fps),
            "-i",
            str(tmp_path / "%06d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(out_mp4),
        ]
        subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)


def encode_from_tar_members(
    tar_path: Path, members: list[tuple[int, tarfile.TarInfo]], out_mp4: Path, fps: int
) -> None:
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = ffmpeg_exe()
    with tarfile.open(tar_path, "r") as tf, tempfile.TemporaryDirectory(prefix="casia-b-") as tmp:
        tmp_path = Path(tmp)
        for i, (_frame_i, info) in enumerate(members, start=1):
            raw = tf.extractfile(info)
            if raw is None:
                continue
            (tmp_path / f"{i:06d}.png").write_bytes(raw.read())
        cmd = [
            ffmpeg,
            "-y",
            "-framerate",
            str(fps),
            "-i",
            str(tmp_path / "%06d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(out_mp4),
        ]
        subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)


def sorted_frames(frame_dir: Path) -> list[Path]:
    pngs = [p for p in frame_dir.iterdir() if p.suffix.lower() == ".png"]

    def frame_key(p: Path) -> int:
        m = re.search(r"-(\d+)\.png$", p.name, re.I)
        return int(m.group(1)) if m else 0

    pngs.sort(key=frame_key)
    return pngs


def build_from_disk(
    data_root: Path,
    samples_dir: Path,
    *,
    condition: str,
    angle: str,
    subjects: list[str] | None,
    fps: int,
    skip_existing: bool,
) -> list[dict]:
    entries: list[dict] = []
    for subj_dir in sorted(data_root.iterdir()):
        if not subj_dir.is_dir() or not subj_dir.name.isdigit():
            continue
        subj = subj_dir.name
        if subjects is not None and subj not in subjects:
            continue
        frame_dir = subj_dir / condition / angle
        if not frame_dir.is_dir():
            continue
        pngs = sorted_frames(frame_dir)
        if not pngs:
            continue
        slug = f"CASIA-{subj}"
        out_mp4 = samples_dir / f"{slug}-{condition}-{angle}.mp4"
        if not skip_existing or not out_mp4.is_file():
            print(f"Encoding subject {subj} ({len(pngs)} frames) -> {out_mp4.name}", flush=True)
            encode_from_png_list(pngs, out_mp4, fps)
        entries.append(_entry(subj, condition, angle, len(pngs), fps, out_mp4, frame_dir))
    return entries


def build_from_tar(
    tar_path: Path,
    samples_dir: Path,
    *,
    condition: str,
    angle: str,
    subjects: list[str] | None,
    fps: int,
    skip_existing: bool,
) -> list[dict]:
    print("Indexing tar (one pass)...", flush=True)
    by_subj = index_tar(tar_path, condition=condition, angle=angle)
    entries: list[dict] = []
    for subj in sorted(by_subj.keys()):
        if subjects is not None and subj not in subjects:
            continue
        members = by_subj[subj]
        if not members:
            continue
        slug = f"CASIA-{subj}"
        out_mp4 = samples_dir / f"{slug}-{condition}-{angle}.mp4"
        if not skip_existing or not out_mp4.is_file():
            print(f"Encoding subject {subj} ({len(members)} frames) -> {out_mp4.name}", flush=True)
            encode_from_tar_members(tar_path, members, out_mp4, fps)
        rel_dir = EXTRACT_DIR / "CASIA-B" / subj / condition / angle
        entries.append(_entry(subj, condition, angle, len(members), fps, out_mp4, rel_dir))
    return entries


def _entry(
    subj: str, condition: str, angle: str, frames: int, fps: int, out_mp4: Path, seq_dir: Path
) -> dict:
    slug = f"CASIA-{subj}"
    return {
        "id": slug,
        "label": f"CASIA-B subject {subj} ({condition}, {angle}°)",
        "file": f"/samples/casia-b/{out_mp4.name}",
        "subjectId": subj,
        "condition": condition,
        "angle": angle,
        "frames": frames,
        "fps": fps,
        "seqDir": _relative_or_abs(seq_dir),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare CASIA-B silhouette clips for People Tracker.")
    parser.add_argument("--tar", type=Path, default=DEFAULT_TAR)
    parser.add_argument("--extract", type=Path, default=EXTRACT_DIR)
    parser.add_argument("--condition", default=DEFAULT_CONDITION, help="e.g. nm-01, bg-01, cl-01")
    parser.add_argument("--angle", default=DEFAULT_ANGLE, help="View angle folder, e.g. 090")
    parser.add_argument(
        "--subjects",
        default="",
        help="Comma-separated subject ids (default: all under data root)",
    )
    parser.add_argument("--fps", type=int, default=DEFAULT_FPS)
    parser.add_argument("--skip-existing", action="store_true", help="Skip MP4s that already exist.")
    parser.add_argument(
        "--full-extract",
        action="store_true",
        help="Also extract the full tar to output/gait-datasets/CASIA-B (slow; optional).",
    )
    args = parser.parse_args()

    if args.full_extract:
        ensure_full_extract(args.tar, args.extract)

    subject_list = [s.strip() for s in args.subjects.split(",") if s.strip()] or None
    data_root = args.extract / "CASIA-B"
    if EXTRACT_MARKER.is_file() and data_root.is_dir():
        entries = build_from_disk(
            data_root,
            SAMPLES_DIR,
            condition=args.condition,
            angle=args.angle,
            subjects=subject_list,
            fps=args.fps,
            skip_existing=args.skip_existing,
        )
    else:
        entries = build_from_tar(
            args.tar,
            SAMPLES_DIR,
            condition=args.condition,
            angle=args.angle,
            subjects=subject_list,
            fps=args.fps,
            skip_existing=args.skip_existing,
        )

    manifest_path = ROOT / "frontend" / "public" / "samples" / "casia-b-manifest.json"
    manifest_path.write_text(json.dumps({"sequences": entries}, indent=2), encoding="utf-8")
    print(f"Wrote {len(entries)} sequences to {manifest_path}", flush=True)


if __name__ == "__main__":
    main()
