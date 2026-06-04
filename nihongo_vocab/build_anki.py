"""
Build interactive Anki .apkg decks from nihongo_vocab MCQ text files.
"""
from __future__ import annotations

import argparse
import html
import re
from dataclasses import dataclass
from pathlib import Path

import genanki


BASE_DIR = Path(__file__).resolve().parent
ANSWER_DIR = BASE_DIR / "answer"
OUTPUT_DIR = BASE_DIR / "anki"
LESSON_COUNT = 25
PARENT_DECK_NAME = "JLPT_NIHONGO_QUIZ"

MODEL_ID = 2026060305
DECK_ID_BASE = 202606030100


@dataclass(frozen=True)
class Question:
    lesson: int
    block: int
    block_title: str
    number: int
    text: str
    options: dict[str, str]

    @property
    def qid(self) -> str:
        return f"{self.block}.{self.number}"


@dataclass(frozen=True)
class Answer:
    qid: str
    letter: str
    correct_word: str
    hiragana: str
    romaji: str
    meaning: str


def esc(value: str) -> str:
    return html.escape(value.strip(), quote=True)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def parse_questions(path: Path, lesson: int) -> list[Question]:
    questions: list[Question] = []
    current_block: int | None = None
    current_block_title = ""
    current: dict[str, object] | None = None

    def flush_current() -> None:
        nonlocal current
        if current is None:
            return
        number = current["number"]
        text = str(current["text"]).strip()
        options = current["options"]
        if not isinstance(number, int) or not isinstance(options, dict):
            raise ValueError(f"{path.name}: invalid question state")
        questions.append(
            Question(
                lesson=lesson,
                block=int(current["block"]),
                block_title=str(current["block_title"]),
                number=number,
                text=text,
                options={str(k): str(v).strip() for k, v in options.items()},
            )
        )
        current = None

    for raw_line in read_text(path).splitlines():
        line = raw_line.rstrip()
        block_match = re.match(r"^##\s*Block\s+(\d+):\s*(.+?)\s*$", line)
        if block_match:
            flush_current()
            current_block = int(block_match.group(1))
            current_block_title = block_match.group(2).strip()
            continue

        question_match = re.match(r"^\s*(\d+)\.\s+(.+?)\s*$", line)
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


def parse_answers(path: Path) -> dict[str, Answer]:
    answers: dict[str, Answer] = {}
    for line in read_text(path).splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = split_markdown_row(line)
        if not cells or not re.match(r"^\d+\.\d+$", cells[0]):
            continue
        if len(cells) < 6:
            raise ValueError(f"{path.name}: answer row has {len(cells)} columns: {line}")
        qid, letter, correct_word, hiragana, romaji, meaning = cells[:6]
        letter = letter.strip().upper()
        if letter not in {"A", "B", "C", "D"}:
            raise ValueError(f"{path.name}: invalid answer letter for {qid}: {letter}")
        answers[qid] = Answer(
            qid=qid,
            letter=letter,
            correct_word=correct_word,
            hiragana=hiragana,
            romaji=romaji,
            meaning=meaning,
        )
    return answers


def validate_lesson(lesson: int, questions: list[Question], answers: dict[str, Answer]) -> None:
    if not questions:
        raise ValueError(f"Lesson {lesson}: no questions found")
    question_ids = {q.qid for q in questions}
    answer_ids = set(answers)
    missing_answers = sorted(question_ids - answer_ids)
    extra_answers = sorted(answer_ids - question_ids)
    if missing_answers:
        raise ValueError(f"Lesson {lesson}: missing answers: {', '.join(missing_answers[:10])}")
    if extra_answers:
        raise ValueError(f"Lesson {lesson}: extra answers: {', '.join(extra_answers[:10])}")
    for question in questions:
        missing_options = [letter for letter in "ABCD" if letter not in question.options]
        if missing_options:
            raise ValueError(
                f"Lesson {lesson} question {question.qid}: missing options {', '.join(missing_options)}"
            )


def make_model() -> genanki.Model:
    return genanki.Model(
        MODEL_ID,
        "Nihongo Vocab Interactive MCQ",
        fields=[
            {"name": "ID"},
            {"name": "Lesson"},
            {"name": "Block"},
            {"name": "BlockTitle"},
            {"name": "Question"},
            {"name": "OptionA"},
            {"name": "OptionB"},
            {"name": "OptionC"},
            {"name": "OptionD"},
            {"name": "Answer"},
            {"name": "CorrectWord"},
            {"name": "Hiragana"},
            {"name": "Romaji"},
            {"name": "Meaning"},
            {"name": "ClassA"},
            {"name": "ClassB"},
            {"name": "ClassC"},
            {"name": "ClassD"},
        ],
        templates=[
            {
                "name": "MCQ",
                "qfmt": r"""
<div class="meta">Bài {{Lesson}} - Block {{Block}}: {{BlockTitle}}</div>
<div class="question">{{Question}}</div>
<div class="options" data-answer="{{Answer}}">
  <label class="choice-row">
    <input type="radio" name="answer-{{ID}}" value="A" data-correct="{{ClassA}}" onclick="selectAnswer(this)">
    <span class="choice-text">A. {{OptionA}}</span>
  </label>
  <label class="choice-row">
    <input type="radio" name="answer-{{ID}}" value="B" data-correct="{{ClassB}}" onclick="selectAnswer(this)">
    <span class="choice-text">B. {{OptionB}}</span>
  </label>
  <label class="choice-row">
    <input type="radio" name="answer-{{ID}}" value="C" data-correct="{{ClassC}}" onclick="selectAnswer(this)">
    <span class="choice-text">C. {{OptionC}}</span>
  </label>
  <label class="choice-row">
    <input type="radio" name="answer-{{ID}}" value="D" data-correct="{{ClassD}}" onclick="selectAnswer(this)">
    <span class="choice-text">D. {{OptionD}}</span>
  </label>
</div>
<div class="result" aria-live="polite"></div>
<script>
function answerText(root, text) {
  var result = root.querySelector(".result");
  if (result) {
    result.textContent = text;
  }
}
function selectAnswer(input) {
  var root = input.closest(".card") || document;
  var rows = root.querySelectorAll(".choice-row");
  for (var i = 0; i < rows.length; i++) {
    rows[i].classList.remove("selected-correct", "selected-wrong");
  }
  var row = input.closest(".choice-row");
  if (input.dataset.correct === "correct") {
    if (row) {
      row.classList.add("selected-correct");
    }
    answerText(root, "Đúng");
  } else {
    if (row) {
      row.classList.add("selected-wrong");
    }
    answerText(root, "Sai");
  }
}
</script>
""",
                "afmt": r"""
{{FrontSide}}
<hr id="answer">
<div class="back">
  <div><span class="label">Đáp án đúng:</span> {{Answer}}</div>
  <div><span class="label">Từ đúng:</span> {{CorrectWord}}</div>
  <div><span class="label">Hiragana:</span> {{Hiragana}}</div>
  <div><span class="label">Romaji:</span> {{Romaji}}</div>
  <div><span class="label">Nghĩa / giải thích ngắn:</span> {{Meaning}}</div>
</div>
""",
            }
        ],
        css=r"""
.card {
  background: #ffffff;
  color: #172033;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 22px;
  line-height: 1.45;
  text-align: left;
  user-select: text;
}
.meta {
  color: #5c667a;
  font-size: 14px;
  margin-bottom: 10px;
}
.question {
  font-size: inherit;
  margin-bottom: 10px;
  user-select: text;
}
.options {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}
.choice-row {
  align-items: baseline;
  cursor: pointer;
  display: grid;
  gap: 8px;
  grid-template-columns: 18px minmax(0, 1fr);
  margin: 0;
  padding: 1px 0;
}
.choice-row input[type="radio"] {
  margin: 0;
}
.choice-text {
  font-size: inherit;
  line-height: inherit;
  user-select: text;
}
.choice-row.selected-correct .choice-text {
  background: #dff5e7;
  color: #12662f;
}
.choice-row.selected-wrong .choice-text {
  background: #fde2e2;
  color: #9b1c1c;
}
.result {
  margin-top: 8px;
}
hr {
  border: none;
  border-top: 1px solid #d8deea;
  margin: 18px 0;
}
.back {
  display: grid;
  gap: 6px;
  font-size: inherit;
  user-select: text;
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
            esc(f"{question.lesson}.{question.qid}"),
            esc(f"{question.lesson:02d}"),
            esc(str(question.block)),
            esc(question.block_title),
            esc(question.text),
            esc(question.options["A"]),
            esc(question.options["B"]),
            esc(question.options["C"]),
            esc(question.options["D"]),
            esc(answer.letter),
            esc(answer.correct_word),
            esc(answer.hiragana),
            esc(answer.romaji),
            esc(answer.meaning),
            classes["A"],
            classes["B"],
            classes["C"],
            classes["D"],
        ],
        tags=[f"nihongo_vocab", f"lesson_{question.lesson:02d}", f"block_{question.block:02d}"],
    )


def load_all_lessons() -> dict[int, tuple[list[Question], dict[str, Answer]]]:
    lessons: dict[int, tuple[list[Question], dict[str, Answer]]] = {}
    for lesson in range(1, LESSON_COUNT + 1):
        question_path = BASE_DIR / f"{lesson}.txt"
        answer_path = ANSWER_DIR / f"{lesson}_a.txt"
        if not question_path.exists():
            raise FileNotFoundError(question_path)
        if not answer_path.exists():
            raise FileNotFoundError(answer_path)
        questions = parse_questions(question_path, lesson)
        answers = parse_answers(answer_path)
        validate_lesson(lesson, questions, answers)
        lessons[lesson] = (questions, answers)
    return lessons


def build_packages(lessons: dict[int, tuple[list[Question], dict[str, Answer]]]) -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    model = make_model()
    for lesson, (questions, answers) in lessons.items():
        deck_name = f"{PARENT_DECK_NAME}::Nihongo Vocab {lesson:02d}"
        deck = genanki.Deck(DECK_ID_BASE + lesson, deck_name)
        for question in questions:
            deck.add_note(note_for_question(model, question, answers[question.qid]))
        output_path = OUTPUT_DIR / f"{lesson}.apkg"
        genanki.Package(deck).write_to_file(str(output_path))
        print(f"Created {output_path} ({len(questions)} notes)")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build interactive Anki decks for nihongo_vocab.")
    parser.add_argument("--dry-run", action="store_true", help="Validate input without writing .apkg files.")
    args = parser.parse_args()

    lessons = load_all_lessons()
    total_notes = sum(len(questions) for questions, _ in lessons.values())
    print(f"Validated {len(lessons)} lessons, {total_notes} notes")
    if args.dry_run:
        return 0
    build_packages(lessons)
    print(f"Done. Output directory: {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
