from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


API_BASE = "https://api.soundoftext.com"
DEFAULT_INPUT = Path(__file__).resolve().parent / "input" / "17.txt"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "output"


def configure_console() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


@dataclass(frozen=True)
class VocabItem:
    japanese: str
    vietnamese: str


def read_groups(path: Path) -> list[list[VocabItem]]:
    text = path.read_text(encoding="utf-8-sig")
    groups: list[list[VocabItem]] = []
    current: list[VocabItem] = []

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        if line == "---":
            if current:
                groups.append(current)
                current = []
            continue

        if "\t" in line:
            japanese, vietnamese = line.split("\t", 1)
        elif " - " in line:
            japanese, vietnamese = line.split(" - ", 1)
        else:
            raise ValueError(f"Line {line_number} is not tab-separated: {raw_line!r}")

        japanese = japanese.strip()
        vietnamese = vietnamese.strip()
        if japanese and vietnamese:
            current.append(VocabItem(japanese=japanese, vietnamese=vietnamese))

    if current:
        groups.append(current)

    return groups


def lesson_title_from_stem(stem: str) -> str:
    if stem.isdigit():
        return f"Bài {stem}"
    return stem


def lesson_sort_key(path: Path) -> tuple[int, int | str]:
    if path.stem.isdigit():
        return (0, int(path.stem))
    return (1, path.stem)


def build_web_mapper(input_dir: Path, mapper_path: Path) -> None:
    lessons: list[dict] = []

    for input_path in sorted(input_dir.glob("*.txt"), key=lesson_sort_key):
        lesson_slug = clean_filename(input_path.stem)
        groups = read_groups(input_path)
        lesson_tracks: list[dict] = []

        for group_index, group in enumerate(groups, start=1):
            lesson_tracks.append(
                {
                    "label": f"Nhóm {group_index}",
                    "src": f"output/{lesson_slug}/{lesson_slug}_group_{group_index:02d}.mp3",
                    "items": [
                        {
                            "japanese": item.japanese,
                            "vietnamese": item.vietnamese,
                        }
                        for item in group
                    ],
                }
            )

        lessons.append(
            {
                "title": lesson_title_from_stem(input_path.stem),
                "inputSrc": f"input/{input_path.name}",
                "tracks": lesson_tracks,
            }
        )

    mapper_path.parent.mkdir(parents=True, exist_ok=True)
    mapper_path.write_text(
        json.dumps({"lessons": lessons}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def post_json(url: str, payload: dict, timeout: int) -> dict:
    data = json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "vocab-audio-builder/1.0",
        },
        method="POST",
    )
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def get_json(url: str, timeout: int) -> dict:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "vocab-audio-builder/1.0",
        },
        method="GET",
    )
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def download_file(url: str, output_path: Path, timeout: int) -> None:
    request = Request(url, headers={"User-Agent": "vocab-audio-builder/1.0"})
    with urlopen(request, timeout=timeout) as response:
        output_path.write_bytes(response.read())


def sound_cache_path(cache_dir: Path, text: str, voice: str) -> Path:
    digest = hashlib.sha1(f"{voice}\0{text}".encode("utf-8")).hexdigest()
    return cache_dir / f"{voice}_{digest}.mp3"


def create_sound(text: str, voice: str, timeout: int, poll_interval: float, max_polls: int) -> str:
    payload = {"engine": "Google", "data": {"text": text, "voice": voice}}
    created = post_json(f"{API_BASE}/sounds", payload, timeout)
    sound_id = created.get("id")
    if not sound_id:
        raise RuntimeError(f"Sound of Text did not return an id: {created}")

    for _ in range(max_polls):
        status = get_json(f"{API_BASE}/sounds/{sound_id}", timeout)
        if status.get("status") == "Done" and status.get("location"):
            return status["location"]
        if status.get("status") == "Error":
            raise RuntimeError(f"Sound of Text failed for {voice} {text!r}: {status}")
        time.sleep(poll_interval)

    raise TimeoutError(f"Timed out waiting for Sound of Text id {sound_id}")


def ensure_tts_mp3(
    cache_dir: Path,
    text: str,
    voice: str,
    timeout: int,
    poll_interval: float,
    max_polls: int,
) -> Path:
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = sound_cache_path(cache_dir, text, voice)
    if path.exists() and path.stat().st_size > 0:
        return path

    location = create_sound(text, voice, timeout, poll_interval, max_polls)
    if not urlparse(location).scheme:
        location = f"{API_BASE}{location}"
    download_file(location, path, timeout)
    return path


def run_ffmpeg(args: list[str]) -> None:
    process = subprocess.run(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if process.returncode != 0:
        raise RuntimeError(process.stderr.strip() or "ffmpeg failed")


def ensure_silence(path: Path, seconds: float) -> Path:
    if path.exists() and path.stat().st_size > 0:
        return path

    path.parent.mkdir(parents=True, exist_ok=True)
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=24000:cl=mono",
            "-t",
            str(seconds),
            "-q:a",
            "9",
            "-acodec",
            "libmp3lame",
            str(path),
        ]
    )
    return path


def concat_mp3(parts: list[Path], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    concat_file = output_path.with_suffix(".concat.txt")
    concat_lines = []
    for part in parts:
        escaped = str(part.resolve()).replace("\\", "/").replace("'", "'\\''")
        concat_lines.append(f"file '{escaped}'")
    concat_file.write_text("\n".join(concat_lines) + "\n", encoding="utf-8")

    try:
        run_ffmpeg(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_file),
                "-vn",
                "-ar",
                "24000",
                "-ac",
                "1",
                "-b:a",
                "64k",
                "-c:a",
                "libmp3lame",
                str(output_path),
            ]
        )
    finally:
        concat_file.unlink(missing_ok=True)


def clean_filename(value: str) -> str:
    value = re.sub(r'[<>:"/\\|?*]+', "-", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value[:80] or "audio"


def punctuate_for_tts(text: str) -> str:
    text = text.strip()
    if not text:
        return text
    if text[-1] in ".!?。！？":
        return text
    return f"{text}."


def build_group_audio(
    group: list[VocabItem],
    group_index: int,
    cache_dir: Path,
    output_dir: Path,
    output_prefix: str,
    repeat: int,
    japanese_voice: str,
    vietnamese_voice: str,
    short_pause: Path,
    long_pause: Path,
    timeout: int,
    poll_interval: float,
    max_polls: int,
) -> Path:
    parts: list[Path] = []
    for item_index, item in enumerate(group, start=1):
        print(f"  - {item_index:02d}. {item.japanese} = {item.vietnamese}")
        japanese_mp3 = ensure_tts_mp3(
            cache_dir, item.japanese, japanese_voice, timeout, poll_interval, max_polls
        )
        vietnamese_text = punctuate_for_tts(item.vietnamese)
        vietnamese_mp3 = ensure_tts_mp3(
            cache_dir, vietnamese_text, vietnamese_voice, timeout, poll_interval, max_polls
        )

        for _ in range(repeat):
            parts.extend([japanese_mp3, short_pause, vietnamese_mp3, long_pause])

    output_path = output_dir / f"{output_prefix}_group_{group_index:02d}.mp3"
    concat_mp3(parts, output_path)
    return output_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create repeated Japanese-Vietnamese vocabulary audio files."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--lesson-name",
        help="Folder and file prefix for generated audio. Defaults to the input file name.",
    )
    parser.add_argument("--repeat", type=int, default=5)
    parser.add_argument("--japanese-voice", default="ja-JP")
    parser.add_argument("--vietnamese-voice", default="vi-VN")
    parser.add_argument("--pause-between", type=float, default=0.45)
    parser.add_argument("--pause-after-pair", type=float, default=0.9)
    parser.add_argument("--only-group", type=int, help="Build only this 1-based group index.")
    parser.add_argument("--max-items", type=int, help="Limit items per group, useful for testing.")
    parser.add_argument("--dry-run", action="store_true", help="Parse and print groups without API calls.")
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--poll-interval", type=float, default=1.0)
    parser.add_argument("--max-polls", type=int, default=30)
    return parser.parse_args()


def main() -> int:
    configure_console()
    args = parse_args()
    groups = list(enumerate(read_groups(args.input), start=1))
    if args.only_group is not None:
        if args.only_group < 1 or args.only_group > len(groups):
            print(f"--only-group must be between 1 and {len(groups)}", file=sys.stderr)
            return 2
        groups = [groups[args.only_group - 1]]

    if args.max_items is not None:
        groups = [(group_index, group[: args.max_items]) for group_index, group in groups]

    print(f"Input: {args.input}")
    print(f"Groups: {len(groups)}")
    for group_index, group in groups:
        print(f"Group {group_index}: {len(group)} items")
        if args.dry_run:
            for item in group:
                print(f"  - {item.japanese} = {item.vietnamese}")

    if args.dry_run:
        return 0

    lesson_name = clean_filename(args.lesson_name or args.input.stem)
    lesson_output_dir = args.output / lesson_name
    cache_dir = args.output / "_cache"
    silence_dir = args.output / "_silence"
    short_pause = ensure_silence(
        silence_dir / f"pause_{args.pause_between:.2f}s_24000hz.mp3", args.pause_between
    )
    long_pause = ensure_silence(
        silence_dir / f"pause_{args.pause_after_pair:.2f}s_24000hz.mp3", args.pause_after_pair
    )

    for group_index, group in groups:
        print(f"Building group {group_index}")
        try:
            output_path = build_group_audio(
                group=group,
                group_index=group_index,
                cache_dir=cache_dir,
                output_dir=lesson_output_dir,
                output_prefix=lesson_name,
                repeat=args.repeat,
                japanese_voice=args.japanese_voice,
                vietnamese_voice=args.vietnamese_voice,
                short_pause=short_pause,
                long_pause=long_pause,
                timeout=args.timeout,
                poll_interval=args.poll_interval,
                max_polls=args.max_polls,
            )
        except (HTTPError, URLError, TimeoutError, RuntimeError) as exc:
            print(f"Failed group {group_index}: {exc}", file=sys.stderr)
            return 1
        print(f"Created: {output_path}")

    mapper_path = Path(__file__).resolve().parent / "docs" / "data" / "lesson-mapper.json"
    build_web_mapper(args.input.parent, mapper_path)
    print(f"Mapper updated: {mapper_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
