"""
Build Anki .apkg from vocabulary markdown file (4.txt).
"""
import re
import sys
import genanki

INPUT_PATH = r'E:\UTILS\extractor\nihongo_practices\vocabulary\4.txt'
OUTPUT_PATH = r'E:\UTILS\extractor\nihongo_practices\vocabulary\4.apkg'

sys.stdout.reconfigure(encoding='utf-8')

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def strip_markdown_inline(text: str) -> str:
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'__(.*?)__', r'\1', text)
    text = re.sub(r'<u>(.*?)</u>', r'\1', text, flags=re.IGNORECASE)
    return text


def collapse_blank_lines(text: str) -> str:
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()
    return text


def extract_image_urls(text: str) -> str:
    def repl(m):
        url = m.group(2).strip()
        if any(url.lower().endswith(ext) for ext in ('.jpg', '.jpeg', '.png', '.gif', '.webp')) or 'picture_' in url:
            return f'<img src="{url}" width="220">'
        return url
    text = re.sub(r'\[([^\]]+)\]\((https?://[^\)]+)\)', repl, text)
    return text


def highlight_kanji_in_question(text: str) -> str:
    text = re.sub(r'<u>(.*?)</u>', r'<span style="color:#b30000;">\1</span>', text, flags=re.IGNORECASE)
    return text


def clean_explanation(text: str) -> str:
    text = strip_markdown_inline(text)
    lines = []
    for line in text.splitlines():
        if line.strip().startswith('* ') and not line.strip().startswith('**'):
            line = '- ' + line.strip()[2:]
        lines.append(line)
    text = '\n'.join(lines)
    text = collapse_blank_lines(text)
    return text


# ---------------------------------------------------------------------------
# Parse input file
# ---------------------------------------------------------------------------

def parse_input(path: str):
    with open(path, 'r', encoding='utf-8-sig') as f:
        text = f.read()

    # Find first heading line (starts with ## or #) that looks like a deck title
    deck_name = ""
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith('## '):
            deck_name = stripped.lstrip('#').strip()
            break
        elif stripped.startswith('# ') and not stripped.startswith('# 問題'):
            deck_name = stripped.lstrip('#').strip()
            break
    if not deck_name:
        deck_name = text.splitlines()[0].strip().lstrip('#').strip()

    split_match = re.search(r'^# 問題1\s*—.*$', text, re.MULTILINE)
    if split_match:
        question_text = text[:split_match.start()]
        explanation_text = text[split_match.start():]
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
        q_str = extract_image_urls(q_str)
        q_str = highlight_kanji_in_question(q_str)
        q_str = strip_markdown_inline(q_str)
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

    for num, e in explanations.items():
        m = re.search(r'\*\*Đáp án(?:\s*đúng)?:\s*(\d)\.', e['body'])
        if m:
            e['answer_num'] = int(m.group(1))
        else:
            e['answer_num'] = None

    return deck_name, questions, explanations


# ---------------------------------------------------------------------------
# Build Anki package
# ---------------------------------------------------------------------------

def build_apkg(deck_name: str, questions: dict, explanations: dict, output: str):
    model_id = 2025060401
    model = genanki.Model(
        model_id,
        'JLPT Vocabulary MCQ Simple',
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

    parent_deck_name = "JLPT_VOC_N5"
    full_deck_name = f"{parent_deck_name}::{deck_name}"
    deck_id = 2025060400
    deck = genanki.Deck(deck_id, full_deck_name)

    max_q = max(questions.keys()) if questions else 0
    for i in range(1, max_q + 1):
        q = questions.get(i)
        e = explanations.get(i)
        if not q or not e:
            print(f"Skipping missing Q{i}", file=sys.stderr)
            continue

        question_text = collapse_blank_lines(q['question'])
        if not question_text and e['title']:
            question_text = collapse_blank_lines(e['title'])

        opts = q['options']
        a = strip_markdown_inline(opts.get(1, ''))
        b = strip_markdown_inline(opts.get(2, ''))
        c = strip_markdown_inline(opts.get(3, ''))
        d = strip_markdown_inline(opts.get(4, ''))

        ans_num = e.get('answer_num')
        if ans_num is None:
            print(f"Warning: missing answer for Q{i}, defaulting to 1", file=sys.stderr)
            ans_num = 1
        ans_text = strip_markdown_inline(opts.get(ans_num, ''))
        answer_field = f"{ans_num}. {ans_text}"

        classes = {1: 'wrong', 2: 'wrong', 3: 'wrong', 4: 'wrong'}
        classes[ans_num] = 'correct'

        explanation_field = clean_explanation(e['body'])

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
