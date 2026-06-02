"""
Build interactive Anki .apkg decks from hiragana/katakana MCQ text files.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sqlite3
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path

import genanki


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "anki"
PARENT_DECK_NAME = "JLPT_NIHONGO_QUIZ"
SOURCES = {
    "hiragana": {
        "path": BASE_DIR / "hiragana.txt",
        "deck_name": "Nihongo Char Hiragana",
        "answer_field": "Hiragana",
        "deck_id": 202606030201,
    },
    "katakana": {
        "path": BASE_DIR / "katakana.txt",
        "deck_name": "Nihongo Char Katakana",
        "answer_field": "Katakana",
        "deck_id": 202606030202,
    },
}

MODEL_ID = 202606030204


@dataclass(frozen=True)
class Question:
    source: str
    block: int
    block_title: str
    number: int
    text: str
    options: dict[str, str]


@dataclass(frozen=True)
class Answer:
    number: int
    letter: str
    kana: str
    romaji: str
    explanation: str


def esc(value: str) -> str:
    return html.escape(value.strip(), quote=True)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def question_part(text: str) -> str:
    marker = re.search(r"^#\s*Bảng đáp án\s*$", text, re.MULTILINE)
    return text[: marker.start()] if marker else text


def parse_questions(path: Path, source: str) -> list[Question]:
    questions: list[Question] = []
    current_block: int | None = None
    current_block_title = ""
    current: dict[str, object] | None = None

    def flush_current() -> None:
        nonlocal current
        if current is None:
            return
        number = current["number"]
        options = current["options"]
        if not isinstance(number, int) or not isinstance(options, dict):
            raise ValueError(f"{path.name}: invalid question state")
        questions.append(
            Question(
                source=source,
                block=int(current["block"]),
                block_title=str(current["block_title"]),
                number=number,
                text=str(current["text"]).strip(),
                options={str(k): str(v).strip() for k, v in options.items()},
            )
        )
        current = None

    for raw_line in question_part(read_text(path)).splitlines():
        line = raw_line.rstrip()
        block_match = re.match(r"^#\s*Block\s+(\d+):\s*(.+?)\s*$", line)
        if block_match:
            flush_current()
            current_block = int(block_match.group(1))
            current_block_title = block_match.group(2).strip()
            continue

        question_match = re.match(r"^\s*(?:###\s*)?(\d+)\.\s+(.+?)\s*$", line)
        if question_match:
            if current_block is None:
                raise ValueError(f"{path.name}: question before block: {line}")
            flush_current()
            current = {
                "block": current_block,
                "block_title": current_block_title,
                "number": int(question_match.group(1)),
                "text": question_match.group(2).strip(),
                "options": {},
            }
            continue

        option_match = re.match(r"^\s*([A-D])\.\s+(.+?)\s*$", line)
        if option_match and current is not None:
            options = current["options"]
            if not isinstance(options, dict):
                raise ValueError(f"{path.name}: invalid options state")
            options[option_match.group(1)] = option_match.group(2).strip()
            continue

        if current is not None and line.strip():
            options = current["options"]
            if isinstance(options, dict) and options:
                last_key = next(reversed(options))
                options[last_key] = f"{options[last_key]} {line.strip()}"
            else:
                current["text"] = f"{current['text']} {line.strip()}"

    flush_current()
    return questions


def split_markdown_row(line: str) -> list[str]:
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    while cells and cells[-1] == "":
        cells.pop()
    return cells


def parse_answers(path: Path) -> dict[int, Answer]:
    answers: dict[int, Answer] = {}
    for line in read_text(path).splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = split_markdown_row(line)
        if not cells or not re.match(r"^\d+$", cells[0]):
            continue
        if len(cells) < 5:
            raise ValueError(f"{path.name}: answer row has {len(cells)} columns: {line}")
        number_raw, letter, kana, romaji, explanation = cells[:5]
        number = int(number_raw)
        letter = letter.strip().upper()
        if letter not in {"A", "B", "C", "D"}:
            raise ValueError(f"{path.name}: invalid answer letter for {number}: {letter}")
        answers[number] = Answer(
            number=number,
            letter=letter,
            kana=kana,
            romaji=romaji,
            explanation=explanation,
        )
    return answers


def validate_source(source: str, questions: list[Question], answers: dict[int, Answer]) -> None:
    if not questions:
        raise ValueError(f"{source}: no questions found")
    question_ids = {q.number for q in questions}
    answer_ids = set(answers)
    missing_answers = sorted(question_ids - answer_ids)
    extra_answers = sorted(answer_ids - question_ids)
    if missing_answers:
        raise ValueError(f"{source}: missing answers: {missing_answers[:10]}")
    if extra_answers:
        raise ValueError(f"{source}: extra answers: {extra_answers[:10]}")
    for question in questions:
        missing_options = [letter for letter in "ABCD" if letter not in question.options]
        if missing_options:
            raise ValueError(
                f"{source} question {question.number}: missing options {', '.join(missing_options)}"
            )
        if answer_letter := answers[question.number].letter:
            if answer_letter not in question.options:
                raise ValueError(f"{source} question {question.number}: answer option missing")


def make_model() -> genanki.Model:
    return genanki.Model(
        MODEL_ID,
        "Nihongo Char Interactive MCQ",
        fields=[
            {"name": "ID"},
            {"name": "Source"},
            {"name": "Block"},
            {"name": "BlockTitle"},
            {"name": "Question"},
            {"name": "OptionA"},
            {"name": "OptionB"},
            {"name": "OptionC"},
            {"name": "OptionD"},
            {"name": "Answer"},
            {"name": "Kana"},
            {"name": "Romaji"},
            {"name": "Explanation"},
            {"name": "ClassA"},
            {"name": "ClassB"},
            {"name": "ClassC"},
            {"name": "ClassD"},
        ],
        templates=[
            {
                "name": "MCQ",
                "qfmt": r"""
<div class="meta">{{Source}} - Block {{Block}}: {{BlockTitle}}</div>
<div class="question">{{Question}}</div>
<div class="options">
  <button type="button" class="choice {{ClassA}}" onclick="selectAnswer(this)">A. {{OptionA}}</button>
  <button type="button" class="choice {{ClassB}}" onclick="selectAnswer(this)">B. {{OptionB}}</button>
  <button type="button" class="choice {{ClassC}}" onclick="selectAnswer(this)">C. {{OptionC}}</button>
  <button type="button" class="choice {{ClassD}}" onclick="selectAnswer(this)">D. {{OptionD}}</button>
</div>
<script>
function selectAnswer(button) {
  var container = button.parentElement;
  var buttons = container.querySelectorAll(".choice");
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove("selected-correct", "selected-wrong");
  }
  if (button.classList.contains("correct")) {
    button.classList.add("selected-correct");
  } else {
    button.classList.add("selected-wrong");
  }
}
</script>
""",
                "afmt": r"""
{{FrontSide}}
<hr id="answer">
<div class="back">
  <div><span class="label">Đáp án đúng:</span> {{Answer}}</div>
  <div><span class="label">Kana:</span> {{Kana}}</div>
  <div><span class="label">Romaji:</span> {{Romaji}}</div>
  <div><span class="label">Giải thích ngắn:</span> {{Explanation}}</div>
</div>
""",
            }
        ],
        css=r"""
.card {
  background: #ffffff;
  color: #172033;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 18px;
  line-height: 1.5;
  text-align: left;
}
.meta {
  color: #5c667a;
  font-size: 14px;
  margin-bottom: 10px;
}
.question {
  font-size: 24px;
  margin-bottom: 10px;
}
.options {
  display: grid;
  gap: 4px;
}
.choice {
  appearance: none;
  background: #f7f8fb;
  border: 1px solid #cfd6e4;
  border-radius: 6px;
  color: #172033;
  cursor: pointer;
  display: block;
  font: inherit;
  font-size: 24px;
  line-height: 1.35;
  margin: 0;
  min-height: 36px;
  padding: 7px 10px;
  text-align: left;
  width: 100%;
}
.choice.selected-correct {
  background: #e8f6ed;
  border-color: #16833a;
  color: #11602d;
}
.choice.selected-wrong {
  background: #fdecec;
  border-color: #c92a2a;
  color: #9f1c1c;
}
hr {
  border: none;
  border-top: 1px solid #d8deea;
  margin: 18px 0;
}
.back {
  display: grid;
  gap: 6px;
}
.label {
  color: #4d5b72;
  font-weight: 600;
}
""",
        sort_field_index=0,
    )


def note_for_question(model: genanki.Model, question: Question, answer: Answer) -> genanki.Note:
    classes = {letter: "correct" if letter == answer.letter else "wrong" for letter in "ABCD"}
    return genanki.Note(
        model=model,
        fields=[
            esc(f"{question.source}.{question.number}"),
            esc(question.source.title()),
            esc(str(question.block)),
            esc(question.block_title),
            esc(question.text),
            esc(question.options["A"]),
            esc(question.options["B"]),
            esc(question.options["C"]),
            esc(question.options["D"]),
            esc(answer.letter),
            esc(answer.kana),
            esc(answer.romaji),
            esc(answer.explanation),
            classes["A"],
            classes["B"],
            classes["C"],
            classes["D"],
        ],
        tags=["nihongo_char", question.source, f"block_{question.block:02d}"],
    )


def load_all_sources() -> dict[str, tuple[list[Question], dict[int, Answer]]]:
    loaded: dict[str, tuple[list[Question], dict[int, Answer]]] = {}
    for source, config in SOURCES.items():
        path = config["path"]
        questions = parse_questions(path, source)
        answers = parse_answers(path)
        validate_source(source, questions, answers)
        loaded[source] = (questions, answers)
    return loaded


def build_packages(loaded: dict[str, tuple[list[Question], dict[int, Answer]]]) -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    model = make_model()
    for source, (questions, answers) in loaded.items():
        config = SOURCES[source]
        deck_name = f"{PARENT_DECK_NAME}::{config['deck_name']}"
        deck = genanki.Deck(int(config["deck_id"]), deck_name)
        for question in questions:
            deck.add_note(note_for_question(model, question, answers[question.number]))
        output_path = OUTPUT_DIR / f"{source}.apkg"
        genanki.Package(deck).write_to_file(str(output_path))
        print(f"Created {output_path} ({len(questions)} notes)")


def inspect_package(path: Path) -> tuple[int, int, bool, bool, bool]:
    with tempfile.TemporaryDirectory() as td:
        db_path = Path(td) / "collection.anki2"
        with zipfile.ZipFile(path) as archive:
            archive.extract("collection.anki2", td)
        con = sqlite3.connect(db_path)
        try:
            notes = con.execute("select count(*) from notes").fetchone()[0]
            cards = con.execute("select count(*) from cards").fetchone()[0]
            models = json.loads(con.execute("select models from col").fetchone()[0])
            model = next(iter(models.values()))
            qfmt = model["tmpls"][0]["qfmt"]
            afmt = model["tmpls"][0]["afmt"]
            css = model["css"]
            front_hides_explanation = not any(
                field in qfmt for field in ("Kana", "Romaji", "Explanation")
            )
            back_has_explanation = all(field in afmt for field in ("Kana", "Romaji", "Explanation"))
            has_interaction = "selectAnswer" in qfmt and "selected-correct" in css and "selected-wrong" in css
            return notes, cards, front_hides_explanation, back_has_explanation, has_interaction
        finally:
            con.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Build interactive Anki decks for nihongo_char.")
    parser.add_argument("--dry-run", action="store_true", help="Validate input without writing .apkg files.")
    parser.add_argument("--verify", action="store_true", help="Inspect generated .apkg files.")
    args = parser.parse_args()

    loaded = load_all_sources()
    total = sum(len(questions) for questions, _ in loaded.values())
    for source, (questions, answers) in loaded.items():
        print(f"Validated {source}: {len(questions)} questions, {len(answers)} answers")
    print(f"Validated {len(loaded)} sources, {total} notes")

    if args.dry_run:
        return 0

    build_packages(loaded)

    if args.verify:
        all_ok = True
        for source, (questions, _) in loaded.items():
            output_path = OUTPUT_DIR / f"{source}.apkg"
            notes, cards, front_ok, back_ok, interaction_ok = inspect_package(output_path)
            ok = (
                output_path.exists()
                and output_path.stat().st_size > 0
                and notes == len(questions)
                and cards == len(questions)
                and front_ok
                and back_ok
                and interaction_ok
            )
            all_ok = all_ok and ok
            print(
                f"Verified {source}: notes={notes}, cards={cards}, "
                f"front_ok={front_ok}, back_ok={back_ok}, interaction_ok={interaction_ok}, ok={ok}"
            )
        if not all_ok:
            return 1

    print(f"Done. Output directory: {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
