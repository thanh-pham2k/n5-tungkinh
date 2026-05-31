"""
Build Anki .apkg from grammar markdown file.
"""
import re
import sys
import genanki

INPUT_PATH = r'E:\UTILS\extractor\nihongo_practices\grammar\1.txt'
OUTPUT_PATH = r'E:\UTILS\extractor\nihongo_practices\grammar\1.apkg'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def strip_markdown_inline(text: str) -> str:
    """Remove **bold**, *italic*, __underline__ markers."""
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'__(.*?)__', r'\1', text)
    return text


def clean_text(text: str) -> str:
    """Strip markdown inline, collapse multiple blank lines."""
    text = strip_markdown_inline(text)
    # collapse 3+ newlines to 2
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()
    return text


def parse_markdown_table(lines):
    """Convert markdown table lines to simple text lines."""
    out = []
    for line in lines:
        if not line.strip().startswith('|'):
            continue
        parts = [p.strip() for p in line.strip().split('|')]
        # remove empty first/last from leading/trailing |
        parts = [p for p in parts if p != '']
        if not parts:
            continue
        # skip separator lines like ---|---|---
        if all(re.match(r'^[-:]+$', p) for p in parts):
            continue
        out.append(' | '.join(parts))
    return out


def convert_tables(text: str) -> str:
    """Find markdown tables and replace with simple text."""
    lines = text.splitlines()
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith('|'):
            # gather table block
            block = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                block.append(lines[i])
                i += 1
            table_lines = parse_markdown_table(block)
            result.extend(table_lines)
            result.append('')  # blank line after table
        else:
            result.append(line)
            i += 1
    return '\n'.join(result)


def prepare_explanation(raw: str) -> str:
    raw = strip_markdown_inline(raw)
    raw = convert_tables(raw)
    # collapse blank lines
    raw = re.sub(r'\n{3,}', '\n\n', raw)
    raw = raw.strip()
    return raw


# ---------------------------------------------------------------------------
# Parse input file
# ---------------------------------------------------------------------------

def parse_input(path: str):
    with open(path, 'r', encoding='utf-8-sig') as f:
        text = f.read()

    # Deck name from first heading
    first_line = text.splitlines()[0].strip()
    deck_name = first_line.lstrip('#').strip()
    # Remove any trailing --- or empty
    # e.g. "## JLPT N5 Actual Test 20107 — Grammar"

    split_marker = "# JLPT N5 Actual Test 20107 — Grammar 解説"
    if split_marker in text:
        question_text, explanation_text = text.split(split_marker, 1)
    else:
        question_text = text
        explanation_text = ""

    # --- Questions ---
    questions = {}
    q_pattern = re.compile(r'^###\s+(\d+)\.\s*\n(.*?)(?=\n^###|\n^---|\n^# |\Z)', re.MULTILINE | re.DOTALL)
    for m in q_pattern.finditer(question_text):
        num = int(m.group(1))
        body = m.group(2).strip()
        opts = {}
        opt_pattern = re.compile(r'^(\d+)\.\s*(.*?)$', re.MULTILINE)
        for om in opt_pattern.finditer(body):
            idx = int(om.group(1))
            val = om.group(2).strip()
            opts[idx] = val
        first_opt = body.find('1. ')
        if first_opt != -1:
            q_str = body[:first_opt].strip()
        else:
            q_str = body
        questions[num] = {
            'question': q_str,
            'options': opts,
        }

    # --- Explanations ---
    explanations = {}
    exp_pattern = re.compile(r'^##\s+(\d+)\.\s*(.*?)\n(.*?)(?=\n^##\s+\d+\.|\n^---|\n^# |\Z)', re.MULTILINE | re.DOTALL)
    for m in exp_pattern.finditer(explanation_text):
        num = int(m.group(1))
        title = m.group(2).strip()
        body = m.group(3).strip()
        explanations[num] = {
            'title': title,
            'body': body,
        }

    # Extract answer from explanation body: **Đáp án: X. text**
    for num, e in explanations.items():
        m = re.search(r'\*\*Đáp án:\s*([\d])\.\s*.*?\*\*', e['body'])
        if m:
            e['answer_num'] = int(m.group(1))
        else:
            e['answer_num'] = None

    return deck_name, questions, explanations


# ---------------------------------------------------------------------------
# Build Anki package
# ---------------------------------------------------------------------------

def build_apkg(deck_name: str, questions: dict, explanations: dict, output: str):
    # Build model
    model_id = 2025060101
    model = genanki.Model(
        model_id,
        'JLPT Grammar MCQ Simple',
        fields=[
            {'name': 'ID'},
            {'name': 'Question'},
            {'name': 'A'},
            {'name': 'B'},
            {'name': 'C'},
            {'name': 'D'},
            {'name': 'Answer'},
            {'name': 'Explanation'},
            {'name': 'ClassA'},
            {'name': 'ClassB'},
            {'name': 'ClassC'},
            {'name': 'ClassD'},
        ],
        templates=[
            {
                'name': 'MCQ',
                'qfmt': '''
<div class="question">{{Question}}</div>
<div class="options">
  <label class="opt"><input type="radio" name="q{{ID}}" class="{{ClassA}}"><span>1. {{A}}</span></label>
  <label class="opt"><input type="radio" name="q{{ID}}" class="{{ClassB}}"><span>2. {{B}}</span></label>
  <label class="opt"><input type="radio" name="q{{ID}}" class="{{ClassC}}"><span>3. {{C}}</span></label>
  <label class="opt"><input type="radio" name="q{{ID}}" class="{{ClassD}}"><span>4. {{D}}</span></label>
</div>
''',
                'afmt': '''
{{FrontSide}}
<hr id="answer">
<div>
  <p>dap an dung: {{Answer}}</p>
  <div class="explanation">{{Explanation}}</div>
</div>
''',
            },
        ],
        css='''
.card {
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 18px;
  text-align: left;
  color: #1a1a1a;
  background: #ffffff;
}
.question {
  margin-bottom: 14px;
  white-space: pre-wrap;
}
.options {
  line-height: 1.8;
}
.opt {
  display: block;
  cursor: pointer;
}
.opt input {
  margin-right: 8px;
}
/* Show correct/wrong immediately on selection */
input.correct:checked + span {
  color: green;
}
input.wrong:checked + span {
  color: red;
}
.explanation {
  margin-top: 10px;
  white-space: pre-wrap;
}
''',
    )

    parent_deck_name = "JLPT_GRAMMAR_N5"
    full_deck_name = f"{parent_deck_name}::{deck_name}"
    deck_id = 2025060100
    deck = genanki.Deck(deck_id, full_deck_name)

    for i in range(1, 27):
        q = questions.get(i)
        e = explanations.get(i)
        if not q or not e:
            print(f"Skipping missing Q{i}", file=sys.stderr)
            continue

        question_text = clean_text(q['question'])
        if not question_text and e['title']:
            question_text = clean_text(e['title'])

        opts = q['options']
        a = clean_text(opts.get(1, ''))
        b = clean_text(opts.get(2, ''))
        c = clean_text(opts.get(3, ''))
        d = clean_text(opts.get(4, ''))

        ans_num = e.get('answer_num')
        if ans_num is None:
            print(f"Warning: missing answer for Q{i}, defaulting to 1", file=sys.stderr)
            ans_num = 1
        ans_letter = str(ans_num)
        ans_text = clean_text(opts.get(ans_num, ''))
        answer_field = f"{ans_letter}. {ans_text}"

        # Classes for immediate correct/wrong feedback
        classes = {1: 'wrong', 2: 'wrong', 3: 'wrong', 4: 'wrong'}
        classes[ans_num] = 'correct'

        explanation_raw = e['body']
        # User wants ALL provided content in show answer. Keep it.
        explanation_field = prepare_explanation(explanation_raw)

        note = genanki.Note(
            model=model,
            fields=[
                str(i),
                question_text,
                a, b, c, d,
                answer_field,
                explanation_field,
                classes[1], classes[2], classes[3], classes[4],
            ],
        )
        deck.add_note(note)

    genanki.Package(deck).write_to_file(output)
    print(f"Written: {output}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    deck_name, questions, explanations = parse_input(INPUT_PATH)
    print(f"Deck name: {deck_name}")
    print(f"Questions: {len(questions)}, Explanations: {len(explanations)}")
    build_apkg(deck_name, questions, explanations, OUTPUT_PATH)
