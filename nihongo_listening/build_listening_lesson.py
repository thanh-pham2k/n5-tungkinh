from __future__ import annotations

import html
import csv
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path


LESSON_NO = 1
LESSON_NOS = list(range(1, 26))

BASE_DIR = Path(r"E:\UTILS\extractor\nihongo_listening")
RAW_AUDIO_DIR = BASE_DIR / "raw_audio"
OUTPUT_ROOT = BASE_DIR / "output"

START_PADDING_MS = 0
END_PADDING_MS = 0
LAST_SEGMENT_TAIL_MS = 8000
SUPPORTED_AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


@dataclass
class Segment:
    number: int
    start_ms: int
    end_ms: int | None
    label: str
    script_text: str
    audio_file: str = ""


@dataclass
class QuizItem:
    question: str
    question_romaji: str
    question_meaning: str
    options: list[dict[str, str]]
    answer: str
    explanation: str


def log(message: str) -> None:
    print(message)


def warn(message: str) -> None:
    print(f"WARNING: {message}", file=sys.stderr)


def read_text_flexible(path: Path) -> str:
    last_error: Exception | None = None
    for encoding in ("utf-8-sig", "utf-8", "cp932", "shift_jis"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError as exc:
            last_error = exc
    raise UnicodeDecodeError(
        "unknown",
        b"",
        0,
        1,
        f"Không đọc được {path} bằng utf-8-sig/utf-8/cp932/shift_jis: {last_error}",
    )


def find_audio_file(lesson_no: int) -> Path:
    name_marker = f"#Bài {lesson_no} LUYỆN NGHE JLPT N5"
    candidates = [
        path
        for path in RAW_AUDIO_DIR.iterdir()
        if path.is_file()
        and path.suffix.lower() in SUPPORTED_AUDIO_EXTS
        and name_marker in path.name
    ]
    if not candidates:
        raise FileNotFoundError(
            f"Không tìm thấy audio gốc trong {RAW_AUDIO_DIR} với marker: {name_marker}"
        )
    candidates.sort(key=lambda item: (item.suffix.lower() != ".mp3", item.name.lower()))
    return candidates[0]


def parse_timestamp_to_ms(value: str) -> int:
    value = value.strip().strip("[]()").replace(",", ".")
    parts = value.split(":")
    if len(parts) == 2:
        hours = 0
        minutes = int(parts[0])
        seconds_text = parts[1]
    elif len(parts) == 3:
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds_text = parts[2]
    else:
        raise ValueError(f"Timestamp không hợp lệ: {value}")

    if "." in seconds_text:
        seconds_raw, fraction_raw = seconds_text.split(".", 1)
        fraction_ms = int((fraction_raw + "000")[:3])
    else:
        seconds_raw = seconds_text
        fraction_ms = 0

    seconds = int(seconds_raw)
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + fraction_ms


def format_ms(value: int) -> str:
    value = max(0, value)
    total_seconds, ms = divmod(value, 1000)
    minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{ms:03d}"
    return f"{minutes:02d}:{seconds:02d}.{ms:03d}"


def strip_timestamps(text: str) -> str:
    return re.sub(
        r"\[?\d{1,2}:\d{2}(?::\d{2})?(?:[\.,]\d{1,3})?\]?\s*(?:-->|-|〜|~)?\s*",
        "",
        text,
    ).strip()


def first_timestamp_ms(text: str) -> int | None:
    match = re.search(r"\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[\.,]\d{1,3})?)\]?", text)
    if not match:
        return None
    try:
        return parse_timestamp_to_ms(match.group(1))
    except ValueError as exc:
        warn(str(exc))
        return None


def all_timestamps_ms(text: str) -> list[int]:
    values: list[int] = []
    for match in re.finditer(r"\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[\.,]\d{1,3})?)\]?", text):
        try:
            values.append(parse_timestamp_to_ms(match.group(1)))
        except ValueError as exc:
            warn(str(exc))
    return values


def last_timestamp_ms(text: str) -> int | None:
    values = all_timestamps_ms(text)
    return values[-1] if values else None


def explicit_range_ms(text: str) -> tuple[int, int] | None:
    pattern = re.compile(
        r"\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[\.,]\d{1,3})?)\]?\s*(?:-->|-|〜|~)\s*"
        r"\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[\.,]\d{1,3})?)\]?"
    )
    match = pattern.search(text)
    if not match:
        return None
    try:
        return parse_timestamp_to_ms(match.group(1)), parse_timestamp_to_ms(match.group(2))
    except ValueError as exc:
        warn(str(exc))
        return None


def parse_options(block: str) -> list[dict[str, str]]:
    option_pattern = re.compile(
        r"^([ABCD])\.\s*(.*?)(?=^\s*[ABCD]\.\s|^Đáp án đúng:|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    options: list[dict[str, str]] = []
    for match in option_pattern.finditer(block):
        body = match.group(2).strip()
        meaning = ""
        text = body
        meaning_match = re.search(r"\nNghĩa:\s*(.+)", body, flags=re.DOTALL)
        if meaning_match:
            text = body[: meaning_match.start()].strip()
            meaning = meaning_match.group(1).strip()
        options.append(
            {
                "key": match.group(1).strip(),
                "text": re.sub(r"\s+", " ", strip_timestamps(text)).strip(),
                "meaning": re.sub(r"\s+", " ", strip_timestamps(meaning)).strip(),
            }
        )
    return options


def parse_quiz_text(quiz_text: str, segment: Segment) -> QuizItem:
    question_match = re.search(r"質問:\s*(.+)", quiz_text)
    romaji_match = re.search(r"Romaji:\s*(.+)", quiz_text)
    meaning_match = re.search(r"Nghĩa:\s*(.+)", quiz_text)
    answer_match = re.search(r"Đáp án đúng:\s*([ABCD])(?:\.\s*(.+))?", quiz_text)
    explanation_match = re.search(r"Giải thích ngắn gọn:\s*(.+)", quiz_text)
    options = parse_options(quiz_text)

    if question_match and len(options) >= 4 and answer_match:
        return QuizItem(
            question=strip_timestamps(question_match.group(1)),
            question_romaji=strip_timestamps(romaji_match.group(1)) if romaji_match else "",
            question_meaning=strip_timestamps(meaning_match.group(1)) if meaning_match else "",
            options=options[:4],
            answer=answer_match.group(1),
            explanation=strip_timestamps(explanation_match.group(1)) if explanation_match else "",
        )

    summary = summarize_script(segment.script_text)
    return QuizItem(
        question=f"Nội dung chính của {segment.label} là gì?",
        question_romaji="",
        question_meaning="Chọn nội dung phù hợp nhất với đoạn vừa nghe.",
        options=[
            {"key": "A", "text": summary, "meaning": ""},
            {"key": "B", "text": "Hỏi đường đến nhà ga", "meaning": ""},
            {"key": "C", "text": "Mua vé xem phim", "meaning": ""},
            {"key": "D", "text": "Đặt phòng khách sạn", "meaning": ""},
        ],
        answer="A",
        explanation="Câu hỏi fallback được tạo từ nội dung script của đoạn.",
    )


def split_quiz_text(quiz_text: str) -> list[str]:
    parts = re.split(r"(?=^Câu\s+\d+\s*:)", quiz_text, flags=re.MULTILINE)
    chunks = [part.strip() for part in parts if part.strip()]
    return chunks if chunks else [quiz_text.strip()]


def parse_quiz_items(block: str, segment: Segment) -> list[QuizItem]:
    quiz_match = re.search(r"###\s*2\.\s*Câu hỏi trắc nghiệm\s*(.*)", block, flags=re.DOTALL)
    quiz_text = quiz_match.group(1).strip() if quiz_match else ""
    return [parse_quiz_text(chunk, segment) for chunk in split_quiz_text(quiz_text)]


def parse_quiz(block: str, segment: Segment) -> QuizItem:
    return parse_quiz_items(block, segment)[0]


def summarize_script(script_text: str) -> str:
    for line in script_text.splitlines():
        line = strip_timestamps(line)
        if line.startswith(("Romaji:", "Nghĩa:", "###")) or not line:
            continue
        return re.sub(r"\s+", " ", line).strip()[:120]
    return "Nội dung hội thoại trong đoạn nghe"


def parse_segments_from_script(script_text: str, audio_duration_ms: int) -> tuple[list[Segment], list[list[QuizItem]]]:
    parts = re.split(r"^##\s*Đoạn hội thoại\s*(\d+)\s*$", script_text, flags=re.MULTILINE)
    segments: list[Segment] = []
    blocks: list[str] = []
    fallback_end_ms: list[int | None] = []

    for index in range(1, len(parts), 2):
        number = int(parts[index])
        block = parts[index + 1]
        script_match = re.search(
            r"###\s*1\.\s*Script hội thoại\s*(.*?)(?=###\s*2\.\s*Câu hỏi trắc nghiệm|\Z)",
            block,
            flags=re.DOTALL,
        )
        dialogue_text = script_match.group(1).strip() if script_match else block.strip()
        range_ms = explicit_range_ms(dialogue_text)
        start_ms = range_ms[0] if range_ms else first_timestamp_ms(dialogue_text)
        if start_ms is None:
            warn(f"Bỏ qua Đoạn hội thoại {number}: không tìm thấy timestamp trong script.")
            continue
        end_ms = range_ms[1] if range_ms else None
        block_last_ms = last_timestamp_ms(block)
        block_end_ms = block_last_ms + LAST_SEGMENT_TAIL_MS if block_last_ms is not None else None
        cleaned_script = "\n".join(
            strip_timestamps(line) for line in dialogue_text.splitlines()
        ).strip()
        segments.append(
            Segment(
                number=number,
                start_ms=start_ms,
                end_ms=end_ms,
                label=f"Đoạn {number}",
                script_text=cleaned_script,
            )
        )
        blocks.append(block)
        fallback_end_ms.append(block_end_ms)

    for index, segment in enumerate(segments):
        if segment.end_ms is None:
            next_start = segments[index + 1].start_ms if index + 1 < len(segments) else None
            block_end = fallback_end_ms[index]
            if next_start is not None:
                segment.end_ms = next_start
            elif block_end is not None and block_end > segment.start_ms:
                segment.end_ms = block_end
            else:
                segment.end_ms = audio_duration_ms
        if segment.end_ms > audio_duration_ms:
            warn(
                f"{segment.label}: end {format_ms(segment.end_ms)} vượt thời lượng audio; clamp về "
                f"{format_ms(audio_duration_ms)}."
            )
            segment.end_ms = audio_duration_ms
        if segment.start_ms >= audio_duration_ms:
            warn(f"{segment.label}: start vượt thời lượng audio, sẽ bị bỏ qua.")

    valid_pairs = [
        (segment, block)
        for segment, block in zip(segments, blocks)
        if segment.end_ms is not None and segment.end_ms > segment.start_ms and segment.start_ms < audio_duration_ms
    ]
    valid_segments = [segment for segment, _ in valid_pairs]
    quiz_items = [parse_quiz_items(block, segment) for segment, block in valid_pairs]
    return valid_segments, quiz_items


def iter_script_blocks(script_text: str) -> list[tuple[int, str, str]]:
    parts = re.split(r"^##\s*.*?(\d+)\s*$", script_text, flags=re.MULTILINE)
    blocks: list[tuple[int, str, str]] = []
    for index in range(1, len(parts), 2):
        number = int(parts[index])
        block = parts[index + 1]
        script_match = re.search(
            r"###\s*1\.\s*Script.*?(.*?)(?=###\s*2\.|\Z)",
            block,
            flags=re.DOTALL,
        )
        dialogue_text = script_match.group(1).strip() if script_match else block.strip()
        blocks.append((number, block, dialogue_text))
    return blocks


def parse_segment_define_timing(segment_define_path: Path) -> dict[int, tuple[int, int]]:
    text = read_text_flexible(segment_define_path)
    timing: dict[int, list[int]] = {}
    for row in csv.DictReader(text.splitlines()):
        if row.get("repeat_round", "").strip() != "1":
            continue
        if row.get("segment_type", "").strip().lower() != "dialogue":
            continue
        match = re.match(r"D(\d{2})", row.get("segment_id", "").strip())
        if not match:
            continue
        try:
            start_ms = int(float(row.get("start_sec", "")) * 1000)
            end_ms = int(float(row.get("end_sec", "")) * 1000)
        except ValueError:
            start_time = row.get("start_time", "").strip()
            end_time = row.get("end_time", "").strip()
            if not start_time or not end_time:
                continue
            start_ms = parse_timestamp_to_ms(start_time)
            end_ms = parse_timestamp_to_ms(end_time)
        number = int(match.group(1))
        if number not in timing:
            timing[number] = [start_ms, end_ms]
        else:
            timing[number][0] = min(timing[number][0], start_ms)
            timing[number][1] = max(timing[number][1], end_ms)
    return {number: (bounds[0], bounds[1]) for number, bounds in timing.items()}


def parse_segments_from_segment_define(
    script_text: str,
    segment_define_path: Path,
    audio_duration_ms: int,
) -> tuple[list[Segment], list[list[QuizItem]]]:
    timing = parse_segment_define_timing(segment_define_path)
    segments: list[Segment] = []
    quiz_items: list[list[QuizItem]] = []
    for number, block, dialogue_text in iter_script_blocks(script_text):
        if number not in timing:
            warn(f"Bỏ qua Đoạn hội thoại {number}: không có timing trong {segment_define_path.name}.")
            continue
        start_ms, end_ms = timing[number]
        if end_ms > audio_duration_ms:
            warn(f"Đoạn {number}: end vượt thời lượng audio; clamp về {format_ms(audio_duration_ms)}.")
            end_ms = audio_duration_ms
        if end_ms <= start_ms or start_ms >= audio_duration_ms:
            warn(f"Bỏ qua Đoạn hội thoại {number}: timing không hợp lệ.")
            continue
        cleaned_script = "\n".join(strip_timestamps(line) for line in dialogue_text.splitlines()).strip()
        segment = Segment(
            number=number,
            start_ms=start_ms,
            end_ms=end_ms,
            label=f"Đoạn {number}",
            script_text=cleaned_script,
        )
        segments.append(segment)
        quiz_items.append(parse_quiz_items(block, segment))
    return segments, quiz_items

def load_script_with_timestamps(script_path: Path, audio_duration_ms: int) -> tuple[list[Segment], list[list[QuizItem]]]:
    text = read_text_flexible(script_path)
    block_count = len(iter_script_blocks(text))
    segment_define_path = script_path.parent / "segment_define" / script_path.name
    segments, quiz_items = parse_segments_from_script(text, audio_duration_ms)
    if segments and len(segments) >= block_count:
        return segments, quiz_items

    if segment_define_path.exists():
        if segments:
            warn(
                f"{script_path.name}: parse được {len(segments)}/{block_count} segment; "
                f"dùng fallback timing từ {segment_define_path}."
            )
        else:
            warn(f"{script_path.name}: dùng fallback timing từ {segment_define_path}.")
        return parse_segments_from_segment_define(text, segment_define_path, audio_duration_ms)

    return segments, quiz_items


def ensure_audio_segment():
    try:
        from pydub import AudioSegment  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Thiếu thư viện pydub. Cài bằng: pip install pydub") from exc
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "Không tìm thấy ffmpeg trong PATH. Cài ffmpeg, thêm ffmpeg vào PATH, "
            "rồi kiểm tra bằng: ffmpeg -version"
        )
    return AudioSegment


def cut_audio_segments(audio, segments: list[Segment], output_audio_dir: Path) -> int:
    output_audio_dir.mkdir(parents=True, exist_ok=True)
    for old_file in output_audio_dir.glob("segment_*.mp3"):
        old_file.unlink()

    exported = 0
    for index, segment in enumerate(segments, start=1):
        if segment.end_ms is None or segment.end_ms <= segment.start_ms:
            warn(f"Bỏ qua {segment.label}: end time <= start time.")
            continue
        start_ms = max(0, segment.start_ms - START_PADDING_MS)
        end_ms = min(len(audio), segment.end_ms + END_PADDING_MS)
        if end_ms <= start_ms:
            warn(f"Bỏ qua {segment.label}: thời lượng không hợp lệ sau khi clamp.")
            continue
        filename = f"segment_{index:03d}.mp3"
        audio[start_ms:end_ms].export(output_audio_dir / filename, format="mp3")
        segment.audio_file = filename
        exported += 1
    return exported


def build_quiz_items(segments: list[Segment], quiz_items: list[list[QuizItem]]) -> list[list[QuizItem]]:
    built = []
    for index, segment in enumerate(segments):
        if index < len(quiz_items):
            built.append(quiz_items[index])
        else:
            built.append([
                QuizItem(
                    question=f"Nội dung chính của {segment.label} là gì?",
                    question_romaji="",
                    question_meaning="Chọn nội dung phù hợp nhất với đoạn vừa nghe.",
                    options=[
                        {"key": "A", "text": summarize_script(segment.script_text), "meaning": ""},
                        {"key": "B", "text": "Hỏi đường đến nhà ga", "meaning": ""},
                        {"key": "C", "text": "Mua vé xem phim", "meaning": ""},
                        {"key": "D", "text": "Đặt phòng khách sạn", "meaning": ""},
                    ],
                    answer="A",
                    explanation="Câu hỏi fallback được tạo từ nội dung script của đoạn.",
                )
            ])
    return built


def generate_index_html(
    lesson_no: int,
    segments: list[Segment],
    quiz_items: list[list[QuizItem]],
    output_path: Path,
) -> None:
    cards = []
    nav_items = []
    total_questions = sum(len(group) for group in quiz_items)
    question_counter = 0
    for index, (segment, quiz_group) in enumerate(zip(segments, quiz_items)):
        quiz_sections = []
        for quiz_index, quiz in enumerate(quiz_group, start=1):
            question_counter += 1
            options_html = []
            for option in quiz.options:
                key = html.escape(option["key"])
                text = html.escape(option["text"])
                meaning = html.escape(option.get("meaning", ""))
                options_html.append(
                    f"""
                    <label class="option">
                      <input type="radio" name="answer-{question_counter}" value="{key}">
                      <span class="option-letter">{key}</span>
                      <span class="option-body">
                        <span class="option-text">{text}</span>
                        <span class="option-meaning">{meaning}</span>
                      </span>
                    </label>
                    """
                )
            quiz_sections.append(
                f"""
                <section class="quiz" data-question="{question_counter}" data-answer="{html.escape(quiz.answer)}">
                  <h3>Câu hỏi {quiz_index}</h3>
                  <p class="question">{html.escape(quiz.question)}</p>
                  <p class="subline">{html.escape(quiz.question_romaji)}</p>
                  <p class="subline">{html.escape(quiz.question_meaning)}</p>
                  <div class="options">{''.join(options_html)}</div>
                  <button class="check-answer" type="button">Kiểm tra đáp án</button>
                  <div class="feedback" aria-live="polite"></div>
                  <p class="explanation" hidden>{html.escape(quiz.explanation)}</p>
                </section>
                """
            )

        nav_items.append(
            f"""
            <a class="segment-pill" href="#segment-{index + 1}" data-nav-segment="{index}">
              <span>{index + 1:02d}</span>
              <small>Chưa làm</small>
            </a>
            """
        )

        cards.append(
            f"""
            <article class="segment-card" id="segment-{index + 1}" data-segment="{index}">
              <div class="segment-head">
                <p class="eyebrow">Segment {index + 1:03d}</p>
                <h2>{html.escape(segment.label)}</h2>
                <p class="time">{html.escape(format_ms(segment.start_ms))} - {html.escape(format_ms(segment.end_ms or 0))}</p>
              </div>
              <div class="audio-shell">
                <div class="audio-topline">
                  <span>Audio đoạn {index + 1}</span>
                  <button class="script-open" type="button" data-dialog="script-dialog-{index + 1}">Xem script</button>
                </div>
                <div class="audio-player">
                  <button class="play-audio" type="button" aria-label="Phát đoạn">▶</button>
                  <span class="audio-time">0:00</span>
                  <input class="audio-progress" type="range" min="0" max="100" value="0" step="0.1" aria-label="Tiến độ audio">
                  <audio preload="metadata" src="audio/{html.escape(segment.audio_file)}"></audio>
                </div>
              </div>
              <dialog class="script-dialog" id="script-dialog-{index + 1}">
                <div class="dialog-head">
                  <div>
                    <p class="eyebrow">Segment {index + 1:03d}</p>
                    <h3>Script - {html.escape(segment.label)}</h3>
                  </div>
                  <button class="script-close" type="button" aria-label="Đóng script">Đóng</button>
                </div>
                <pre class="script-text">{html.escape(segment.script_text)}</pre>
              </dialog>
              {''.join(quiz_sections)}
            </article>
            """
        )

    output_path.write_text(
        f"""<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>JLPT N5 Listening - Bài {lesson_no}</title>
  <style>
    :root {{
      --bg: #f6f8fb;
      --panel: #fff;
      --text: #162033;
      --muted: #64748b;
      --line: #dbe3ef;
      --primary: #0f766e;
      --primary-soft: #e1f4f1;
      --ok: #147a3d;
      --bad: #b42318;
      --shadow: 0 8px 22px rgba(15,23,42,.07);
    }}
    * {{ box-sizing: border-box; }}
    html {{ scroll-behavior: smooth; }}
    body {{ margin: 0; overflow-x: hidden; background: var(--bg); color: var(--text); font-family: Arial, sans-serif; font-size: 15px; line-height: 1.45; }}
    h1, h2, h3, p {{ margin-top: 0; }}
    .app-header {{ position: sticky; top: 0; z-index: 20; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.97); backdrop-filter: blur(10px); }}
    .header-inner {{ max-width: 900px; margin: 0 auto; padding: 10px 12px; display: grid; gap: 8px; }}
    .header-row {{ display: flex; align-items: center; justify-content: space-between; gap: 10px; }}
    h1 {{ margin: 0; font-size: 18px; line-height: 1.2; }}
    .score {{ flex: 0 0 auto; border: 1px solid var(--line); border-radius: 999px; background: #fff; padding: 5px 9px; font-size: 13px; font-weight: 800; color: var(--primary); }}
    .current-segment {{ margin: 0; color: var(--muted); font-size: 13px; font-weight: 700; }}
    main {{ width: min(900px, 100%); min-width: 0; margin: 0 auto; padding: 12px; display: grid; gap: 12px; }}
    .segment-nav {{ min-width: 0; display: flex; gap: 8px; overflow-x: auto; overscroll-behavior-x: contain; padding-bottom: 2px; scrollbar-width: thin; }}
    .segment-pill {{ flex: 0 0 86px; min-height: 46px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--text); padding: 7px 9px; display: grid; align-content: center; gap: 2px; text-decoration: none; }}
    .segment-pill span {{ font-weight: 900; color: var(--primary); }}
    .segment-pill small {{ color: var(--muted); font-size: 12px; white-space: nowrap; }}
    .segment-pill.done {{ border-color: rgba(20,122,61,.35); background: #eefbf3; }}
    .segment-pill.wrong {{ border-color: rgba(180,35,24,.35); background: #fff1f0; }}
    .segment-card {{ min-width: 0; overflow: hidden; scroll-margin-top: 88px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); box-shadow: var(--shadow); padding: 12px; }}
    .segment-head {{ margin-bottom: 8px; }}
    .eyebrow {{ margin: 0 0 2px; color: var(--primary); font-size: 11px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; }}
    h2 {{ margin: 0; font-size: 19px; line-height: 1.2; }}
    .time {{ margin: 4px 0 0; color: var(--muted); font-size: 12px; font-weight: 800; }}
    .audio-shell {{ min-width: 0; max-width: 100%; overflow: hidden; margin: 8px 0 10px; border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; padding: 6px; }}
    .audio-topline {{ min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; color: var(--muted); font-size: 12px; font-weight: 900; }}
    .script-open {{ flex: 0 0 auto; min-height: 32px; border-color: rgba(15,118,110,.25); background: #fff; color: var(--primary); padding: 5px 9px; font-size: 12px; }}
    .audio-player {{ min-width: 0; display: grid; grid-template-columns: 38px 78px minmax(0, 1fr); gap: 8px; align-items: center; }}
    .play-audio {{ width: 36px; min-height: 34px; border-radius: 999px; padding: 0; }}
    .audio-time {{ color: var(--text); font-size: 13px; font-weight: 800; text-align: center; }}
    .audio-progress {{ width: 100%; min-width: 0; accent-color: var(--primary); }}
    audio {{ display: none; }}
    .quiz {{ padding-top: 2px; }}
    .quiz + .quiz {{ margin-top: 12px; border-top: 1px solid var(--line); padding-top: 12px; }}
    .quiz h3 {{ margin-bottom: 8px; font-size: 15px; }}
    .question {{ margin-bottom: 3px; font-weight: 900; font-size: 16px; line-height: 1.35; }}
    .subline {{ margin: 0 0 3px; color: var(--muted); font-size: 13px; }}
    .options {{ display: grid; grid-template-columns: 1fr; gap: 8px; margin: 10px 0; }}
    .option {{ min-height: 52px; border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 9px 10px; display: grid; grid-template-columns: 18px 28px minmax(0, 1fr); column-gap: 8px; align-items: start; cursor: pointer; }}
    .option:has(input:checked) {{ border-color: var(--primary); background: var(--primary-soft); }}
    .option input {{ margin: 3px 0 0; }}
    .option-letter {{ width: 26px; height: 26px; border-radius: 999px; background: #eef2f7; display: inline-grid; place-items: center; font-size: 13px; font-weight: 900; }}
    .option-body {{ min-width: 0; display: grid; gap: 2px; }}
    .option-text {{ min-width: 0; font-size: 15px; font-weight: 800; white-space: normal; word-break: normal; overflow-wrap: anywhere; line-break: strict; }}
    .option-meaning {{ color: var(--muted); font-size: 12px; white-space: normal; word-break: normal; overflow-wrap: anywhere; }}
    button {{ min-height: 40px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--text); padding: 8px 12px; font-weight: 800; cursor: pointer; }}
    button:hover {{ border-color: var(--primary); color: var(--primary); }}
    .check-answer {{ width: 100%; background: var(--primary); border-color: var(--primary); color: #fff; }}
    .check-answer:hover {{ color: #fff; }}
    .feedback {{ min-height: 20px; margin-top: 8px; font-weight: 900; }}
    .feedback.ok {{ color: var(--ok); }}
    .feedback.bad {{ color: var(--bad); }}
    .explanation {{ margin: 4px 0 0; color: var(--muted); font-size: 13px; }}
    .script-dialog {{ width: min(640px, calc(100vw - 24px)); max-height: min(78vh, 720px); border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: #fff; color: var(--text); box-shadow: 0 24px 70px rgba(15,23,42,.28); }}
    .script-dialog::backdrop {{ background: rgba(15,23,42,.45); }}
    .dialog-head {{ display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--line); padding-bottom: 10px; margin-bottom: 10px; }}
    .dialog-head h3 {{ margin: 0; font-size: 17px; line-height: 1.25; }}
    .script-close {{ flex: 0 0 auto; min-height: 34px; padding: 6px 10px; }}
    .script-text {{ width: 100%; max-height: calc(78vh - 112px); overflow: auto; margin: 0; border: 1px solid var(--line); border-radius: 8px; background: #fbfdff; padding: 10px; white-space: pre-wrap; overflow-wrap: anywhere; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; }}
    @media (min-width: 640px) {{
      body {{ font-size: 16px; }}
      .header-inner {{ padding: 12px 16px; }}
      h1 {{ font-size: 22px; }}
      main {{ padding: 16px; gap: 14px; }}
      .segment-nav {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); overflow: visible; padding-bottom: 0; }}
      .segment-pill {{ min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 6px; }}
      .segment-card {{ padding: 16px; scroll-margin-top: 96px; }}
      .options {{ grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }}
      .check-answer {{ width: auto; }}
    }}
    @media (min-width: 1024px) {{
      .header-inner, main {{ max-width: 900px; }}
    }}
  </style>
</head>
<body>
  <header class="app-header">
    <div class="header-inner">
      <div class="header-row">
        <h1>JLPT N5 Listening - Bài {lesson_no}</h1>
        <div class="score" id="score">0/{total_questions}</div>
      </div>
      <p class="current-segment" id="current-segment">Đang ở đoạn 1/{len(segments)}</p>
    </div>
  </header>
  <main>
    <nav class="segment-nav" aria-label="Danh sách đoạn hội thoại">{''.join(nav_items)}</nav>
    {''.join(cards)}
  </main>
  <script>
    const totalSegments = {len(segments)};
    const totalQuestions = {total_questions};
    const state = {{}};
    const currentSegment = document.getElementById("current-segment");
    function formatTime(seconds) {{
      if (!Number.isFinite(seconds)) return "0:00";
      const total = Math.max(0, Math.floor(seconds));
      const mins = Math.floor(total / 60);
      const secs = String(total % 60).padStart(2, "0");
      return `${{mins}}:${{secs}}`;
    }}
    function updateScore() {{
      const correct = Object.values(state).filter(Boolean).length;
      document.getElementById("score").textContent = `${{correct}}/${{totalQuestions}}`;
    }}
    function closeDialog(dialog) {{
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }}
    const observer = new IntersectionObserver((entries) => {{
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = Number(visible.target.dataset.segment) + 1;
      currentSegment.textContent = `Đang ở đoạn ${{index}}/${{totalSegments}}`;
    }}, {{ rootMargin: "-90px 0px -55% 0px", threshold: [0.2, 0.45, 0.7] }});
    document.querySelectorAll(".segment-card").forEach((card) => observer.observe(card));
    document.querySelectorAll(".audio-player").forEach((player) => {{
      const audio = player.querySelector("audio");
      const playButton = player.querySelector(".play-audio");
      const progress = player.querySelector(".audio-progress");
      const time = player.querySelector(".audio-time");
      playButton.addEventListener("click", () => {{
        document.querySelectorAll("audio").forEach((other) => {{
          if (other !== audio) other.pause();
        }});
        if (audio.paused) audio.play();
        else audio.pause();
      }});
      audio.addEventListener("play", () => {{ playButton.textContent = "❚❚"; }});
      audio.addEventListener("pause", () => {{ playButton.textContent = "▶"; }});
      audio.addEventListener("loadedmetadata", () => {{
        time.textContent = `0:00 / ${{formatTime(audio.duration)}}`;
      }});
      audio.addEventListener("timeupdate", () => {{
        if (audio.duration) progress.value = String((audio.currentTime / audio.duration) * 100);
        time.textContent = `${{formatTime(audio.currentTime)}} / ${{formatTime(audio.duration)}}`;
      }});
      audio.addEventListener("ended", () => {{
        playButton.textContent = "▶";
        progress.value = "0";
      }});
      progress.addEventListener("input", () => {{
        if (!audio.duration) return;
        audio.currentTime = (Number(progress.value) / 100) * audio.duration;
      }});
    }});
    document.querySelectorAll(".script-open").forEach((button) => {{
      button.addEventListener("click", () => {{
        const dialog = document.getElementById(button.dataset.dialog);
        if (!dialog) return;
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }});
    }});
    document.querySelectorAll(".script-dialog").forEach((dialog) => {{
      dialog.querySelector(".script-close").addEventListener("click", () => closeDialog(dialog));
      dialog.addEventListener("click", (event) => {{
        const rect = dialog.getBoundingClientRect();
        const inDialog =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;
        if (!inDialog) closeDialog(dialog);
      }});
    }});
    document.querySelectorAll(".check-answer").forEach((button) => {{
      button.addEventListener("click", () => {{
        const card = button.closest(".segment-card");
        const quiz = button.closest(".quiz");
        const selected = quiz.querySelector("input[type='radio']:checked");
        const feedback = quiz.querySelector(".feedback");
        const explanation = quiz.querySelector(".explanation");
        const segmentIndex = card.dataset.segment;
        const questionIndex = quiz.dataset.question;
        const nav = document.querySelector(`[data-nav-segment="${{segmentIndex}}"]`);
        feedback.className = "feedback";
        explanation.hidden = true;
        if (!selected) {{
          feedback.textContent = "Hãy chọn một đáp án trước.";
          feedback.classList.add("bad");
          state[questionIndex] = false;
          updateScore();
          return;
        }}
        nav.classList.remove("done", "wrong");
        if (selected.value === quiz.dataset.answer) {{
          feedback.textContent = "Đúng.";
          feedback.classList.add("ok");
          state[questionIndex] = true;
        }} else {{
          feedback.textContent = "Chưa đúng.";
          feedback.classList.add("bad");
          state[questionIndex] = false;
        }}
        const quizFeedbacks = Array.from(card.querySelectorAll(".feedback"));
        const answered = quizFeedbacks.filter((item) => item.classList.contains("ok") || item.classList.contains("bad"));
        const hasWrong = quizFeedbacks.some((item) => item.classList.contains("bad"));
        const allDone = answered.length === quizFeedbacks.length;
        if (hasWrong) {{
          nav.classList.add("wrong");
          nav.querySelector("small").textContent = "Có sai";
        }} else if (allDone) {{
          nav.classList.add("done");
          nav.querySelector("small").textContent = "Xong";
        }} else {{
          nav.querySelector("small").textContent = `${{answered.length}}/${{quizFeedbacks.length}}`;
        }}
        explanation.hidden = false;
        updateScore();
      }});
    }});
  </script>
</body>
</html>
""",
        encoding="utf-8",
    )

def build_lesson(lesson_no: int) -> bool:
    script_path = BASE_DIR / f"{lesson_no}.txt"
    output_dir = OUTPUT_ROOT / f"lesson_{lesson_no}"
    output_audio_dir = output_dir / "audio"
    output_index_path = output_dir / "index.html"

    if not script_path.exists():
        warn(f"Bài {lesson_no}: không tìm thấy file script/timestamp: {script_path}")
        return False
    log(f"Đã tìm thấy file script/timestamp: {script_path}")
    log("Không dùng segment_define")

    audio_path = find_audio_file(lesson_no)
    log(f"Đã tìm thấy file audio gốc: {audio_path}")

    AudioSegment = ensure_audio_segment()
    try:
        audio = AudioSegment.from_file(audio_path)
    except Exception as exc:
        raise RuntimeError(
            "pydub không đọc được audio. Hãy cài ffmpeg, thêm vào PATH, "
            "rồi kiểm tra bằng: ffmpeg -version"
        ) from exc
    log(f"Thời lượng audio gốc: {format_ms(len(audio))}")

    segments, parsed_quiz_items = load_script_with_timestamps(script_path, len(audio))
    log(f"Số segment parse được: {len(segments)}")
    if not segments:
        warn(f"Bài {lesson_no}: không có segment hợp lệ, bỏ qua export.")
        return False

    output_dir.mkdir(parents=True, exist_ok=True)
    exported_count = cut_audio_segments(audio, segments, output_audio_dir)
    log(f"Số file audio đã export: {exported_count}")
    quiz_items = build_quiz_items(segments, parsed_quiz_items)
    generate_index_html(lesson_no, segments, quiz_items, output_index_path)
    log(f"Đường dẫn index.html đã tạo: {output_index_path}")
    return True


def main() -> int:
    lesson_nos = LESSON_NOS if LESSON_NOS else [LESSON_NO]
    success = 0
    for lesson_no in lesson_nos:
        log(f"\n=== Build lesson {lesson_no} ===")
        try:
            if build_lesson(lesson_no):
                success += 1
        except Exception as exc:
            warn(f"Bài {lesson_no}: lỗi build: {exc}")
    if success == 0:
        return 1
    log(f"\nHoàn tất: build thành công {success}/{len(lesson_nos)} bài.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
