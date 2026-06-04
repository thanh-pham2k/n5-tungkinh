from __future__ import annotations

import html
import json
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


LESSON_NO = 1

BASE_DIR = Path(__file__).resolve().parent
SCRIPT_DIR = BASE_DIR
SEGMENT_DEFINE_DIR = BASE_DIR / "segment_define"
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
class TimelineRow:
    start_ms: int
    end_ms: int
    text: str


@dataclass
class Segment:
    number: int
    start_ms: int
    end_ms: int
    label: str
    text: str
    audio_file: str = ""


@dataclass
class ScriptBlock:
    number: int
    script_text: str
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


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def find_audio_file(lesson_no: int) -> Path:
    prefix = f"#Bài {lesson_no} LUYỆN NGHE JLPT N5"
    candidates = [
        path
        for path in RAW_AUDIO_DIR.iterdir()
        if path.is_file()
        and path.suffix.lower() in SUPPORTED_AUDIO_EXTS
        and path.name.startswith(prefix)
    ]
    if not candidates:
        raise FileNotFoundError(
            f"Không tìm thấy audio gốc trong {RAW_AUDIO_DIR} với prefix: {prefix}"
        )
    candidates.sort(key=lambda item: (item.suffix.lower() != ".mp3", item.name.lower()))
    return candidates[0]


def parse_time_to_ms(value: str) -> int:
    value = value.strip().replace(",", ".")
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
        raise ValueError(f"Format thời gian không hợp lệ: {value}")

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


def normalize_segment_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"^\d+\s*", "", text)
    text = re.sub(r"\s*\d+$", "", text)
    return text.strip()


def parse_timeline_rows(raw_text: str) -> list[TimelineRow]:
    time_pattern = re.compile(r"\d{1,2}:\d{2}(?::\d{2})?(?:[\.,]\d{1,3})?")
    matches = list(time_pattern.finditer(raw_text))
    rows: list[TimelineRow] = []

    if len(matches) < 2:
        warn("Không tìm thấy đủ cặp timestamp trong segment_define.")
        return rows

    for index in range(0, len(matches) - 1, 2):
        start_match = matches[index]
        end_match = matches[index + 1]
        next_start = matches[index + 2].start() if index + 2 < len(matches) else len(raw_text)
        try:
            start_ms = parse_time_to_ms(start_match.group(0))
            end_ms = parse_time_to_ms(end_match.group(0))
        except ValueError as exc:
            warn(str(exc))
            continue

        if end_ms <= start_ms:
            warn(f"Bỏ qua segment có End <= Start: {start_match.group(0)} - {end_match.group(0)}")
            continue

        row_text = normalize_segment_text(raw_text[end_match.end() : next_start])
        if not row_text:
            warn(f"Bỏ qua dòng không có nội dung: {start_match.group(0)} - {end_match.group(0)}")
            continue

        rows.append(TimelineRow(start_ms=start_ms, end_ms=end_ms, text=row_text))

    if len(matches) % 2:
        warn(f"Có timestamp lẻ không ghép được: {matches[-1].group(0)}")

    return rows


def is_short_leading_marker(row: TimelineRow) -> bool:
    text = row.text
    duration_ms = row.end_ms - row.start_ms
    if duration_ms > 3500:
        return False
    if "番" in text or "第" in text:
        return False
    return bool(re.search(r"(Narrator|例|１|２|３|1|2|3)", text))


def group_rows_by_dialogue_marker(rows: list[TimelineRow]) -> list[Segment]:
    marker_pattern = re.compile(r"[\(（]Đoạn hội thoại\s*(\d+)[\)）]", re.IGNORECASE)
    marker_indexes: list[tuple[int, int]] = []
    for index, row in enumerate(rows):
        match = marker_pattern.search(row.text)
        if match:
            marker_indexes.append((index, int(match.group(1))))

    if not marker_indexes:
        return []

    segments: list[Segment] = []
    used_leading_indexes: set[int] = set()
    for position, (row_index, dialogue_no) in enumerate(marker_indexes):
        next_row_index = marker_indexes[position + 1][0] if position + 1 < len(marker_indexes) else len(rows)
        group_start_index = row_index
        if row_index > 0 and row_index - 1 not in used_leading_indexes and is_short_leading_marker(rows[row_index - 1]):
            group_start_index = row_index - 1
            used_leading_indexes.add(row_index - 1)

        group_rows = rows[group_start_index:next_row_index]
        start_ms = min(row.start_ms for row in group_rows)
        end_ms = max(row.end_ms for row in group_rows)
        text = "\n".join(row.text for row in group_rows)
        label = f"Đoạn {dialogue_no}"
        segments.append(Segment(dialogue_no, start_ms, end_ms, label, text))

    segments.sort(key=lambda item: item.number)
    return segments


def fallback_rows_as_segments(rows: Iterable[TimelineRow]) -> list[Segment]:
    segments = []
    for index, row in enumerate(rows, start=1):
        segments.append(
            Segment(
                number=index,
                start_ms=row.start_ms,
                end_ms=row.end_ms,
                label=f"Segment {index}",
                text=row.text,
            )
        )
    return segments


def parse_segments(segment_define_path: Path) -> list[Segment]:
    raw_text = read_text(segment_define_path)
    rows = parse_timeline_rows(raw_text)
    segments = group_rows_by_dialogue_marker(rows)
    if not segments:
        warn("Không tìm thấy marker '(Đoạn hội thoại N)'; fallback sang từng dòng timeline.")
        segments = fallback_rows_as_segments(rows)

    for segment in segments:
        if segment.end_ms <= segment.start_ms:
            warn(f"Bỏ qua segment {segment.number}: End <= Start")

    return [segment for segment in segments if segment.end_ms > segment.start_ms]


def parse_options(block: str) -> list[dict[str, str]]:
    option_pattern = re.compile(
        r"^([ABCD])\.\s*(.+?)\s*\nNghĩa:\s*(.+?)(?=\n[ABCD]\.\s|\n\nĐáp án đúng:|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    options = []
    for match in option_pattern.finditer(block):
        options.append(
            {
                "key": match.group(1).strip(),
                "text": re.sub(r"\s+", " ", match.group(2)).strip(),
                "meaning": re.sub(r"\s+", " ", match.group(3)).strip(),
            }
        )
    return options


def load_script(script_path: Path) -> dict[int, ScriptBlock]:
    raw_text = read_text(script_path)
    parts = re.split(r"^##\s*Đoạn hội thoại\s*(\d+)\s*$", raw_text, flags=re.MULTILINE)
    blocks: dict[int, ScriptBlock] = {}

    for index in range(1, len(parts), 2):
        number = int(parts[index])
        block = parts[index + 1]
        script_match = re.search(
            r"###\s*1\.\s*Script hội thoại\s*(.*?)(?=###\s*2\.\s*Câu hỏi trắc nghiệm|\Z)",
            block,
            flags=re.DOTALL,
        )
        quiz_text = block[script_match.end() :] if script_match else block
        script_text = script_match.group(1).strip() if script_match else block.strip()

        question = re.search(r"質問:\s*(.+)", quiz_text)
        question_romaji = re.search(r"Romaji:\s*(.+)", quiz_text)
        question_meaning = re.search(r"Nghĩa:\s*(.+)", quiz_text)
        answer = re.search(r"Đáp án đúng:\s*([ABCD])\.\s*(.+)", quiz_text)
        explanation = re.search(r"Giải thích ngắn gọn:\s*(.+)", quiz_text)

        blocks[number] = ScriptBlock(
            number=number,
            script_text=script_text,
            question=question.group(1).strip() if question else "",
            question_romaji=question_romaji.group(1).strip() if question_romaji else "",
            question_meaning=question_meaning.group(1).strip() if question_meaning else "",
            options=parse_options(quiz_text),
            answer=answer.group(1).strip() if answer else "",
            explanation=explanation.group(1).strip() if explanation else "",
        )

    return blocks


def ensure_pydub_available():
    try:
        from pydub import AudioSegment  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "Thiếu thư viện pydub. Cài bằng: python -m pip install pydub"
        ) from exc
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "Không tìm thấy ffmpeg trong PATH. Cài ffmpeg rồi thêm vào PATH. "
            "Windows có thể dùng: winget install Gyan.FFmpeg"
        )
    return AudioSegment


def cut_audio_segments(audio_path: Path, segments: list[Segment], output_audio_dir: Path) -> int:
    AudioSegment = ensure_pydub_available()
    output_audio_dir.mkdir(parents=True, exist_ok=True)
    audio = AudioSegment.from_file(audio_path)
    exported = 0

    for index, segment in enumerate(segments, start=1):
        start_ms = max(0, segment.start_ms - START_PADDING_MS)
        end_ms = min(len(audio), segment.end_ms + END_PADDING_MS)
        if end_ms <= start_ms:
            warn(f"Bỏ qua segment {index}: thời lượng sau padding không hợp lệ.")
            continue

        filename = f"segment_{index:03d}.mp3"
        output_path = output_audio_dir / filename
        audio[start_ms:end_ms].export(output_path, format="mp3")
        segment.audio_file = filename
        exported += 1

    return exported


def build_fallback_quiz(segment: Segment) -> dict[str, object]:
    return {
        "question": f"Ý chính của {segment.label} là gì?",
        "question_romaji": "",
        "question_meaning": "Chọn nội dung phù hợp nhất với đoạn vừa nghe.",
        "options": [
            {"key": "A", "text": "Thông tin tự giới thiệu hoặc trao đổi chính trong đoạn", "meaning": ""},
            {"key": "B", "text": "Hỏi đường đến nhà ga", "meaning": ""},
            {"key": "C", "text": "Mua đồ ở cửa hàng", "meaning": ""},
            {"key": "D", "text": "Đặt món ăn trong nhà hàng", "meaning": ""},
        ],
        "answer": "A",
        "explanation": "Đáp án fallback dựa trên nội dung luyện nghe N5 của đoạn.",
    }


def build_quiz_items(segments: list[Segment], script_blocks: dict[int, ScriptBlock]) -> list[dict[str, object]]:
    quiz_items = []
    for segment in segments:
        block = script_blocks.get(segment.number)
        if not block or not block.question or len(block.options) < 4 or not block.answer:
            quiz_items.append(build_fallback_quiz(segment))
            continue

        quiz_items.append(
            {
                "question": block.question,
                "question_romaji": block.question_romaji,
                "question_meaning": block.question_meaning,
                "options": block.options[:4],
                "answer": block.answer,
                "explanation": block.explanation,
            }
        )
    return quiz_items


def js_json(data: object) -> str:
    return json.dumps(data, ensure_ascii=False)


def generate_index_html(
    lesson_no: int,
    segments: list[Segment],
    script_blocks: dict[int, ScriptBlock],
    quiz_items: list[dict[str, object]],
    output_path: Path,
) -> None:
    cards = []
    for index, segment in enumerate(segments):
        block = script_blocks.get(segment.number)
        script_text = block.script_text if block and block.script_text else segment.text
        quiz = quiz_items[index]
        options_html = []
        for option in quiz["options"]:  # type: ignore[index]
            option_dict = option  # type: ignore[assignment]
            key = html.escape(str(option_dict["key"]))
            text = html.escape(str(option_dict["text"]))
            meaning = html.escape(str(option_dict.get("meaning", "")))
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
            <article class="segment-card" data-segment="{index}" data-answer="{html.escape(str(quiz["answer"]))}">
              <div class="segment-head">
                <div>
                  <p class="eyebrow">Segment {index + 1:03d}</p>
                  <h2>{html.escape(segment.label)}</h2>
                </div>
                <div class="time">{html.escape(format_ms(segment.start_ms))} - {html.escape(format_ms(segment.end_ms))}</div>
              </div>
              <audio controls preload="metadata" src="audio/{html.escape(segment.audio_file)}"></audio>
              <button class="toggle-script" type="button">Show script</button>
              <pre class="script-text" hidden>{html.escape(script_text)}</pre>
              <section class="quiz">
                <h3>Câu hỏi trắc nghiệm</h3>
                <p class="question">{html.escape(str(quiz["question"]))}</p>
                <p class="subline">{html.escape(str(quiz.get("question_romaji", "")))}</p>
                <p class="subline">{html.escape(str(quiz.get("question_meaning", "")))}</p>
                <div class="options">
                  {''.join(options_html)}
                </div>
                <button class="check-answer" type="button">Kiểm tra đáp án</button>
                <div class="feedback" aria-live="polite"></div>
                <p class="explanation" hidden>{html.escape(str(quiz.get("explanation", "")))}</p>
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
      --bg: #f6f8fb;
      --panel: #ffffff;
      --text: #162033;
      --muted: #64748b;
      --line: #dbe3ef;
      --primary: #0f766e;
      --primary-soft: #e1f4f1;
      --ok: #147a3d;
      --bad: #b42318;
      --shadow: 0 12px 28px rgba(15, 23, 42, .08);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, sans-serif;
      line-height: 1.5;
    }}
    header {{
      position: sticky;
      top: 0;
      z-index: 5;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, .96);
      padding: 14px 16px;
    }}
    .header-inner {{
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }}
    h1, h2, h3, p {{ margin-top: 0; }}
    h1 {{ margin-bottom: 2px; font-size: clamp(20px, 4vw, 30px); }}
    .hint {{ margin: 0; color: var(--muted); }}
    .score {{
      min-width: max-content;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      padding: 8px 10px;
      font-weight: 700;
      color: var(--muted);
    }}
    main {{
      width: min(960px, 100%);
      margin: 0 auto;
      padding: 16px;
      display: grid;
      gap: 14px;
    }}
    .segment-card {{
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
      padding: 16px;
    }}
    .segment-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 12px;
    }}
    .eyebrow {{
      margin: 0 0 4px;
      color: var(--primary);
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
    }}
    h2 {{ margin-bottom: 0; font-size: clamp(18px, 3vw, 24px); }}
    .time {{ color: var(--muted); font-weight: 700; }}
    audio {{ width: 100%; display: block; margin: 12px 0; }}
    button {{
      min-height: 42px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      color: var(--text);
      padding: 8px 12px;
      font-weight: 700;
      cursor: pointer;
    }}
    button:hover {{ border-color: var(--primary); color: var(--primary); }}
    .toggle-script {{ margin-bottom: 12px; }}
    .script-text {{
      width: 100%;
      margin: 0 0 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfdff;
      padding: 12px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: Arial, sans-serif;
      font-size: 15px;
    }}
    .quiz {{
      border-top: 1px solid var(--line);
      padding-top: 14px;
    }}
    .question {{ margin-bottom: 4px; font-weight: 800; font-size: 17px; }}
    .subline {{ margin: 0 0 6px; color: var(--muted); }}
    .options {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin: 12px 0;
    }}
    .option {{
      min-height: 68px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      padding: 10px;
      display: grid;
      grid-template-columns: 26px minmax(0, 1fr);
      column-gap: 8px;
      align-items: start;
      cursor: pointer;
    }}
    .option:has(input:checked) {{
      border-color: var(--primary);
      background: var(--primary-soft);
    }}
    .option input {{ margin-top: 5px; }}
    .option-key {{ font-weight: 800; }}
    .option-text {{ font-weight: 800; overflow-wrap: anywhere; }}
    .option-meaning {{
      grid-column: 2;
      color: var(--muted);
      font-size: 14px;
      overflow-wrap: anywhere;
    }}
    .check-answer {{
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
    }}
    .feedback {{ min-height: 24px; margin-top: 10px; font-weight: 800; }}
    .feedback.ok {{ color: var(--ok); }}
    .feedback.bad {{ color: var(--bad); }}
    .explanation {{ margin: 4px 0 0; color: var(--muted); }}
    @media (max-width: 640px) {{
      header {{ position: static; }}
      .header-inner {{ align-items: flex-start; flex-direction: column; }}
      .score {{ width: 100%; }}
      main {{ padding: 10px; }}
      .segment-card {{ padding: 12px; }}
      .segment-head {{ flex-direction: column; }}
      .time {{ width: 100%; }}
      .options {{ grid-template-columns: 1fr; }}
      button {{ width: 100%; font-size: 16px; }}
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
  <main>
    {''.join(cards)}
  </main>
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
        if (isHidden) {{
          script.removeAttribute("hidden");
          button.textContent = "Hide script";
        }} else {{
          script.setAttribute("hidden", "");
          button.textContent = "Show script";
        }}
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


def main() -> int:
    script_path = SCRIPT_DIR / f"{LESSON_NO}.txt"
    segment_define_path = SEGMENT_DEFINE_DIR / f"{LESSON_NO}.txt"
    output_dir = OUTPUT_ROOT / f"lesson_{LESSON_NO}"
    output_audio_dir = output_dir / "audio"
    output_index_path = output_dir / "index.html"

    if not script_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file script: {script_path}")
    log(f"Đã tìm thấy file script: {script_path}")

    if not segment_define_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file segment_define: {segment_define_path}")
    log(f"Đã tìm thấy file segment_define: {segment_define_path}")

    audio_path = find_audio_file(LESSON_NO)
    log(f"Đã tìm thấy file audio gốc: {audio_path}")

    segments = parse_segments(segment_define_path)
    log(f"Số segment parse được: {len(segments)}")
    if not segments:
        raise RuntimeError("Không parse được segment nào từ segment_define.")

    script_blocks = load_script(script_path)
    log(f"Số block script parse được: {len(script_blocks)}")

    output_dir.mkdir(parents=True, exist_ok=True)
    exported_count = cut_audio_segments(audio_path, segments, output_audio_dir)
    log(f"Số file audio đã export: {exported_count}")

    quiz_items = build_quiz_items(segments, script_blocks)
    generate_index_html(LESSON_NO, segments, script_blocks, quiz_items, output_index_path)
    log(f"Đường dẫn index.html đã tạo: {output_index_path}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
