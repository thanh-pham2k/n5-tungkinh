import re
import json
import genanki
from pathlib import Path

# Paths
INPUT = Path(r'E:\UTILS\extractor\nihongo_kanji\20.txt')
SAMPLE_JSON = Path(r'E:\UTILS\extractor\nihongo_kanji\_sample_info.json')
HTML_OUT = Path(r'E:\UTILS\extractor\docs\kanji\lesson-20.html')
APKG_OUT = Path(r'E:\UTILS\extractor\nihongo_kanji\kanji_bai_20.apkg')

def clean_plain(s):
    """Remove markdown bold/italic and HTML bold/italic tags."""
    s = re.sub(r'\*\*(.+?)\*\*', r'\1', s)
    s = re.sub(r'\*(.+?)\*', r'\1', s)
    s = re.sub(r'</?b>', '', s, flags=re.I)
    s = re.sub(r'</?i>', '', s, flags=re.I)
    s = re.sub(r'</?strong>', '', s, flags=re.I)
    s = re.sub(r'</?em>', '', s, flags=re.I)
    return s.strip()

# ------------------------------------------------------------------
# 1. Read sample Anki structure
# ------------------------------------------------------------------
sample = json.loads(SAMPLE_JSON.read_text(encoding='utf-8'))
model_info = sample['models']['1607392319']
css_raw = model_info['css']
qfmt_raw = model_info['tmpls'][0]['qfmt']
afmt_raw = model_info['tmpls'][0]['afmt']

# Remove bold/italic from CSS and template
# Replace font-weight: 700 with 400 to avoid bold display
css_clean = css_raw.replace('font-weight: 700', 'font-weight: 400')
# In back template, remove <b> tags
afmt_clean = afmt_raw.replace('<b>', '').replace('</b>', '')

# Update model name and meta line in qfmt
qfmt_clean = qfmt_raw.replace('Bai 1', 'Bai 20')

# ------------------------------------------------------------------
# 2. Parse input text
# ------------------------------------------------------------------
text = INPUT.read_text(encoding='utf-8')
lines = text.splitlines()

# --- Parse markdown tables ---
def parse_md_tables(text):
    pattern = re.compile(r'((?:\|.*?\|[ \t]*\n)+)', re.MULTILINE)
    tables = []
    for match in pattern.finditer(text):
        block = match.group(1)
        rows = []
        for line in block.strip().splitlines():
            cells = [c.strip() for c in line.split('|')[1:-1]]
            # skip separator rows
            if all(re.match(r'^-+', c) for c in cells):
                continue
            if cells:
                rows.append(cells)
        if len(rows) >= 2:
            tables.append(rows)
    return tables

tables = parse_md_tables(text)

# --- Parse questions ---
questions = []
i = 0
while i < len(lines):
    line = lines[i].strip()
    m = re.match(r'##\s*Câu\s+(\d+)', line)
    if m:
        num = int(m.group(1))
        i += 1
        while i < len(lines) and lines[i].strip() == '':
            i += 1
        q_parts = []
        while i < len(lines) and lines[i].strip() != '':
            q_parts.append(lines[i].strip())
            i += 1
        question = ' '.join(q_parts)
        opts = {}
        while i < len(lines):
            stripped = lines[i].strip()
            if stripped == '':
                i += 1
                continue
            om = re.match(r'([A-D])\.\s+(.*)', stripped)
            if om:
                opts[om.group(1)] = om.group(2).strip()
                i += 1
            else:
                break
        questions.append({'num': num, 'question': question, 'opts': opts})
    else:
        i += 1

# --- Parse answer table (should be tables[3]) ---
answers = {}
explanations = {}
for row in tables[3][1:]:
    if len(row) >= 3:
        try:
            num = int(row[0])
            ans = row[1]
            exp = clean_plain(row[2])
            answers[num] = ans
            explanations[num] = exp
        except ValueError:
            pass

# ------------------------------------------------------------------
# 3. Generate lesson-06.html (summary only, no quizzes)
# ------------------------------------------------------------------
def rows_to_html(rows):
    html = ['<table class="grammar-table">', '<thead><tr>']
    for h in rows[0]:
        html.append(f'<th>{clean_plain(h)}</th>')
    html.append('</tr></thead><tbody>')
    for r in rows[1:]:
        html.append('<tr>')
        for c in r:
            html.append(f'<td>{clean_plain(c)}</td>')
        html.append('</tr>')
    html.append('</tbody></table>')
    return '\n'.join(html)

table1 = rows_to_html(tables[0])  # Tổng hợp chữ Hán
table2 = rows_to_html(tables[1])  # Ghi nhớ nhanh
table3 = rows_to_html(tables[2])  # Từ vựng ví dụ
table_last = rows_to_html(tables[-1])  # Ghi nhớ nhanh 8 chữ Hán

# Extract summary from TL;DR block
summary = "Bài này dạy 8 chữ Hán/Kanji N5 bài cuối cùng về trời, các màu sắc (đỏ, xanh, trắng, đen), màu sắc chung, cá và chó. Nội dung gồm âm Hán Việt, cách đọc Hiragana, nghĩa tiếng Việt và cách nhớ nhanh."

html_content = f'''<!-- Generated from 20.txt -->
<div class="grammar-list">
  <article class="grammar-topic">
    <h3>Kanji N5 – Bài 20 — 8 chữ Hán: 天、赤、青、白、黒、色、魚、犬</h3>
    <p class="grammar-note">{summary}</p>
    {table1}
  </article>

  <article class="grammar-topic">
    <h3>Cách nhớ nhanh</h3>
    {table2}
  </article>

  <article class="grammar-topic">
    <h3>Từ vựng ví dụ</h3>
    {table3}
    <p class="grammar-note">Ghi nhớ thêm: 天気 = thời tiết, 赤い花 = hoa đỏ, 青い空 = bầu trời xanh, 白い犬 = chó trắng, 黒い車 = xe đen, 魚を食べます = ăn cá, 犬がいます = có chó.</p>
  </article>

  <article class="grammar-topic">
    <h3>Ghi nhớ nhanh 8 chữ Hán</h3>
    {table_last}
  </article>
</div>
'''

HTML_OUT.write_text(html_content, encoding='utf-8')
print(f'Written HTML: {HTML_OUT}')

# ------------------------------------------------------------------
# 4. Generate Anki package
# ------------------------------------------------------------------
MODEL_ID = 1607392334  # close to sample but different
DECK_ID = 2059400125   # close to sample but different

model = genanki.Model(
    MODEL_ID,
    'Kanji MCQ Radio A-D No JS Bai 20',
    fields=[
        {'name': 'Number'},
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
        {'name': 'FeedbackA'},
        {'name': 'FeedbackB'},
        {'name': 'FeedbackC'},
        {'name': 'FeedbackD'},
    ],
    templates=[{
        'name': 'MCQ',
        'qfmt': qfmt_clean,
        'afmt': afmt_clean,
    }],
    css=css_clean,
)

deck = genanki.Deck(DECK_ID, 'JLPT_QUIZ_KANJI::Bai 20 - 8 chu Han troi do xanh trang den mau ca cho N5')

for q in questions:
    num = q['num']
    ans = answers.get(num, 'A')
    exp = explanations.get(num, '')
    qtext = clean_plain(q['question'])
    a_text = clean_plain(q['opts'].get('A', ''))
    b_text = clean_plain(q['opts'].get('B', ''))
    c_text = clean_plain(q['opts'].get('C', ''))
    d_text = clean_plain(q['opts'].get('D', ''))

    class_a = 'correct' if ans == 'A' else 'wrong'
    class_b = 'correct' if ans == 'B' else 'wrong'
    class_c = 'correct' if ans == 'C' else 'wrong'
    class_d = 'correct' if ans == 'D' else 'wrong'

    fb_a = 'Chinh xac!' if ans == 'A' else 'Khong dung.'
    fb_b = 'Chinh xac!' if ans == 'B' else 'Khong dung.'
    fb_c = 'Chinh xac!' if ans == 'C' else 'Khong dung.'
    fb_d = 'Chinh xac!' if ans == 'D' else 'Khong dung.'

    note = genanki.Note(
        model=model,
        fields=[
            str(num), qtext, a_text, b_text, c_text, d_text,
            ans, exp,
            class_a, class_b, class_c, class_d,
            fb_a, fb_b, fb_c, fb_d
        ]
    )
    deck.add_note(note)

genanki.Package(deck).write_to_file(str(APKG_OUT))
print(f'Written Anki package: {APKG_OUT}')
print(f'Total notes: {len(deck.notes)}')
