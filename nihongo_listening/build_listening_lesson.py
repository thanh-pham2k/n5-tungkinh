from __future__ import annotations

import html
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path


LESSON_NO = 1
LESSON_NOS = [2, 3, 4, 5]

BASE_DIR = Path(r"E:\UTILS\extractor\nihongo_listening")
RAW_AUDIO_DIR = BASE_DIR / "raw_audio"
OUTPUT_ROOT = BASE_DIR / "output"

START_PADDING_MS = 0
END_PADDING_MS = 0
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
        r"^([ABCD])\.\s*(.+?)\s*\nNghĩa:\s*(.+?)(?=\n[ABCD]\.\s|\n\nĐáp án đúng:|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    options: list[dict[str, str]] = []
    for match in option_pattern.finditer(block):
        options.append(
            {
                "key": match.group(1).strip(),
                "text": re.sub(r"\s+", " ", strip_timestamps(match.group(2))).strip(),
                "meaning": re.sub(r"\s+", " ", strip_timestamps(match.group(3))).strip(),
            }
        )
    return options


def parse_quiz(block: str, segment: Segment) -> QuizItem:
    quiz_match = re.search(r"###\s*2\.\s*Câu hỏi trắc nghiệm\s*(.*)", block, flags=re.DOTALL)
    quiz_text = quiz_match.group(1).strip() if quiz_match else ""
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


def summarize_script(script_text: str) -> str:
    for line in script_text.splitlines():
        line = strip_timestamps(line)
        if line.startswith(("Romaji:", "Nghĩa:", "###")) or not line:
            continue
        return re.sub(r"\s+", " ", line).strip()[:120]
    return "Nội dung hội thoại trong đoạn nghe"


def parse_segments_from_script(script_text: str, audio_duration_ms: int) -> tuple[list[Segment], list[QuizItem]]:
    parts = re.split(r"^##\s*Đoạn hội thoại\s*(\d+)\s*$", script_text, flags=re.MULTILINE)
    segments: list[Segment] = []
    blocks: list[str] = []

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

    for index, segment in enumerate(segments):
        if segment.end_ms is None:
            next_start = segments[index + 1].start_ms if index + 1 < len(segments) else audio_duration_ms
            segment.end_ms = next_start
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
    quiz_items = [parse_quiz(block, segment) for segment, block in valid_pairs]
    return valid_segments, quiz_items


def load_script_with_timestamps(script_path: Path, audio_duration_ms: int) -> tuple[list[Segment], list[QuizItem]]:
    text = read_text_flexible(script_path)
    return parse_segments_from_script(text, audio_duration_ms)


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


def build_quiz_items(segments: list[Segment], quiz_items: list[QuizItem]) -> list[QuizItem]:
    built = []
    for index, segment in enumerate(segments):
        if index < len(quiz_items):
            built.append(quiz_items[index])
        else:
            built.append(
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
            )
    return built


def generate_index_html(
    lesson_no: int,
    segments: list[Segment],
    quiz_items: list[QuizItem],
    output_path: Path,
) -> None:
    cards = []
    for index, (segment, quiz) in enumerate(zip(segments, quiz_items)):
        options_html = []
        for option in quiz.options:
            key = html.escape(option["key"])
            text = html.escape(option["text"])
            meaning = html.escape(option.get("meaning", ""))
            options_html.append(
                f"""
                <label class="option">
                  <input type="radio" name="answer-{index}" value="{key}">
                  <span class="option-key">{key}</span>
                  <span class="option-text">{text}</span>
                  <span class="option-meaning">{meaning}</span>
                </label>
                """
            )

        cards.append(
            f"""
            <article class="segment-card" data-segment="{index}" data-answer="{html.escape(quiz.answer)}">
              <div class="segment-head">
                <div>
                  <p class="eyebrow">Segment {index + 1:03d}</p>
                  <h2>{html.escape(segment.label)}</h2>
                </div>
                <div class="time">{html.escape(format_ms(segment.start_ms))} - {html.escape(format_ms(segment.end_ms or 0))}</div>
              </div>
              <audio controls preload="metadata" src="audio/{html.escape(segment.audio_file)}"></audio>
              <button class="toggle-script" type="button">Show script</button>
              <pre class="script-text" hidden>{html.escape(segment.script_text)}</pre>
              <section class="quiz">
                <h3>Câu hỏi trắc nghiệm</h3>
                <p class="question">{html.escape(quiz.question)}</p>
                <p class="subline">{html.escape(quiz.question_romaji)}</p>
                <p class="subline">{html.escape(quiz.question_meaning)}</p>
                <div class="options">{''.join(options_html)}</div>
                <button class="check-answer" type="button">Kiểm tra đáp án</button>
                <div class="feedback" aria-live="polite"></div>
                <p class="explanation" hidden>{html.escape(quiz.explanation)}</p>
              </section>
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
      --bg: #f6f8fb; --panel: #fff; --text: #162033; --muted: #64748b;
      --line: #dbe3ef; --primary: #0f766e; --primary-soft: #e1f4f1;
      --ok: #147a3d; --bad: #b42318; --shadow: 0 12px 28px rgba(15,23,42,.08);
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: var(--bg); color: var(--text); font-family: Arial, sans-serif; line-height: 1.5; }}
    header {{ position: sticky; top: 0; z-index: 5; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.96); padding: 14px 16px; }}
    .header-inner {{ max-width: 960px; margin: 0 auto; display: flex; justify-content: space-between; gap: 12px; align-items: center; }}
    h1, h2, h3, p {{ margin-top: 0; }}
    h1 {{ margin-bottom: 2px; font-size: clamp(20px, 4vw, 30px); }}
    .hint {{ margin: 0; color: var(--muted); }}
    .score {{ min-width: max-content; border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 8px 10px; font-weight: 700; color: var(--muted); }}
    main {{ width: min(960px, 100%); margin: 0 auto; padding: 16px; display: grid; gap: 14px; }}
    .segment-card {{ border: 1px solid var(--line); border-radius: 8px; background: var(--panel); box-shadow: var(--shadow); padding: 16px; }}
    .segment-head {{ display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }}
    .eyebrow {{ margin: 0 0 4px; color: var(--primary); font-size: 13px; font-weight: 800; text-transform: uppercase; }}
    h2 {{ margin-bottom: 0; font-size: clamp(18px, 3vw, 24px); }}
    .time {{ color: var(--muted); font-weight: 700; }}
    audio {{ width: 100%; display: block; margin: 12px 0; }}
    button {{ min-height: 42px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--text); padding: 8px 12px; font-weight: 700; cursor: pointer; }}
    button:hover {{ border-color: var(--primary); color: var(--primary); }}
    .toggle-script {{ margin-bottom: 12px; }}
    .script-text {{ width: 100%; margin: 0 0 14px; border: 1px solid var(--line); border-radius: 8px; background: #fbfdff; padding: 12px; white-space: pre-wrap; overflow-wrap: anywhere; font-family: Arial, sans-serif; font-size: 15px; }}
    .quiz {{ border-top: 1px solid var(--line); padding-top: 14px; }}
    .question {{ margin-bottom: 4px; font-weight: 800; font-size: 17px; }}
    .subline {{ margin: 0 0 6px; color: var(--muted); }}
    .options {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 12px 0; }}
    .option {{ min-height: 68px; border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 10px; display: grid; grid-template-columns: 26px minmax(0, 1fr); column-gap: 8px; align-items: start; cursor: pointer; }}
    .option:has(input:checked) {{ border-color: var(--primary); background: var(--primary-soft); }}
    .option input {{ margin-top: 5px; }}
    .option-key {{ font-weight: 800; }}
    .option-text {{ font-weight: 800; overflow-wrap: anywhere; }}
    .option-meaning {{ grid-column: 2; color: var(--muted); font-size: 14px; overflow-wrap: anywhere; }}
    .check-answer {{ background: var(--primary); border-color: var(--primary); color: #fff; }}
    .feedback {{ min-height: 24px; margin-top: 10px; font-weight: 800; }}
    .feedback.ok {{ color: var(--ok); }}
    .feedback.bad {{ color: var(--bad); }}
    .explanation {{ margin: 4px 0 0; color: var(--muted); }}
    @media (max-width: 640px) {{
      header {{ position: static; }} .header-inner {{ align-items: flex-start; flex-direction: column; }}
      .score, button {{ width: 100%; }} main {{ padding: 10px; }} .segment-card {{ padding: 12px; }}
      .segment-head {{ flex-direction: column; }} .time {{ width: 100%; }} .options {{ grid-template-columns: 1fr; }}
      button {{ font-size: 16px; }}
    }}
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <div>
        <h1>JLPT N5 Listening - Bài {lesson_no}</h1>
        <p class="hint">Nghe từng đoạn, tự trả lời, rồi mới mở script để kiểm tra.</p>
      </div>
      <div class="score" id="score">0 / {len(segments)} câu đúng</div>
    </div>
  </header>
  <main>{''.join(cards)}</main>
  <script>
    const totalSegments = {len(segments)};
    const state = {{}};
    function updateScore() {{
      const correct = Object.values(state).filter(Boolean).length;
      document.getElementById("score").textContent = `${{correct}} / ${{totalSegments}} câu đúng`;
    }}
    document.querySelectorAll(".toggle-script").forEach((button) => {{
      button.addEventListener("click", () => {{
        const script = button.nextElementSibling;
        const isHidden = script.hasAttribute("hidden");
        if (isHidden) {{ script.removeAttribute("hidden"); button.textContent = "Hide script"; }}
        else {{ script.setAttribute("hidden", ""); button.textContent = "Show script"; }}
      }});
    }});
    document.querySelectorAll(".check-answer").forEach((button) => {{
      button.addEventListener("click", () => {{
        const card = button.closest(".segment-card");
        const selected = card.querySelector("input[type='radio']:checked");
        const feedback = card.querySelector(".feedback");
        const explanation = card.querySelector(".explanation");
        const segmentIndex = card.dataset.segment;
        feedback.className = "feedback";
        explanation.hidden = true;
        if (!selected) {{
          feedback.textContent = "Hãy chọn một đáp án trước.";
          feedback.classList.add("bad");
          state[segmentIndex] = false;
          updateScore();
          return;
        }}
        if (selected.value === card.dataset.answer) {{
          feedback.textContent = "Đúng.";
          feedback.classList.add("ok");
          state[segmentIndex] = true;
        }} else {{
          feedback.textContent = "Chưa đúng.";
          feedback.classList.add("bad");
          state[segmentIndex] = false;
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
