import genanki
import os

# Deck IDs: use deterministic hash-like large ints
# deck_id for child deck
child_deck_name = 'JLPT_QUIZ_KANJI::Kanji N5 Bài 6'
deck_id = 1600060000

# Model ID
model_id = 1600060001

# Create model (Note type) without bold/italic usage
model = genanki.Model(
    model_id,
    'Kanji N5 Basic Model',
    fields=[
        {'name': 'Kanji'},
        {'name': 'Meaning'},
        {'name': 'Reading'},
        {'name': 'Romaji'},
        {'name': 'Example'},
        {'name': 'Memory'},
    ],
    templates=[
        {
            'name': 'Kanji -> Meaning',
            'qfmt': '''<div class="card">
  <div style="font-size: 64px; text-align: center; margin: 20px 0;">{{Kanji}}</div>
</div>''',
            'afmt': '''<div class="card">
  <div style="font-size: 64px; text-align: center; margin: 20px 0;">{{Kanji}}</div>
  <hr>
  <div style="margin-top: 12px; line-height: 1.6;">
    <div>Nghia: {{Meaning}}</div>
    <div>Doc: {{Reading}}</div>
    <div>Romaji: {{Romaji}}</div>
    <div style="margin-top: 10px;">Vi du: {{Example}}</div>
    <div style="margin-top: 10px; color: #5d6a7e;">Ghi nho: {{Memory}}</div>
  </div>
</div>''',
        },
        {
            'name': 'Meaning -> Kanji',
            'qfmt': '''<div class="card">
  <div style="font-size: 24px; text-align: center; margin: 20px 0;">
    <div>{{Meaning}}</div>
    <div style="font-size: 32px; margin-top: 10px;">{{Reading}}</div>
  </div>
</div>''',
            'afmt': '''<div class="card">
  <div style="font-size: 24px; text-align: center; margin: 20px 0;">
    <div>{{Meaning}}</div>
    <div style="font-size: 32px; margin-top: 10px;">{{Reading}}</div>
  </div>
  <hr>
  <div style="font-size: 64px; text-align: center; margin: 20px 0;">{{Kanji}}</div>
  <div style="margin-top: 12px; line-height: 1.6;">
    <div>Romaji: {{Romaji}}</div>
    <div>Vi du: {{Example}}</div>
    <div style="margin-top: 10px; color: #5d6a7e;">Ghi nho: {{Memory}}</div>
  </div>
</div>''',
        },
    ],
    css='''
.card {
  font-family: Arial, sans-serif;
  font-size: 20px;
  text-align: left;
  color: #172033;
  background: #f5f7fb;
  margin: 0;
  padding: 20px;
}
hr {
  border: none;
  border-top: 1px solid #dbe2ee;
  margin: 14px 0;
}
''',
    sort_field_index=0,
)

deck = genanki.Deck(deck_id, child_deck_name)

# Data from 6.txt
kanji_data = [
    {
        'Kanji': '後',
        'Meaning': 'sau / phia sau',
        'Reading': 'うしろ / ご',
        'Romaji': 'ushiro / go',
        'Example': '後ろ = うしろ = phia sau',
        'Memory': 'Nguoi quay lai nhin phia sau',
    },
    {
        'Kanji': '午',
        'Meaning': 'buoi trua / 12 gio',
        'Reading': 'ご',
        'Romaji': 'go',
        'Example': '午前 = ごぜん = buoi sang / AM',
        'Memory': 'Moc 12 gio trua -> 午前 / 午後',
    },
    {
        'Kanji': '門',
        'Meaning': 'cong',
        'Reading': 'もん',
        'Romaji': 'mon',
        'Example': '門 = もん = cai cong',
        'Memory': 'Hinh cai cong',
    },
    {
        'Kanji': '間',
        'Meaning': 'khoang / giua / thoi gian',
        'Reading': 'あいだ / かん',
        'Romaji': 'aida / kan',
        'Example': '時間 = じかん = thoi gian',
        'Memory': 'Mon + Nhat -> anh sang lot qua cong -> khoang giua',
    },
    {
        'Kanji': '東',
        'Meaning': 'phia Dong',
        'Reading': 'ひがし',
        'Romaji': 'higashi',
        'Example': '東 = ひがし = Dong',
        'Memory': 'Mat troi sau cai cay -> huong Dong',
    },
    {
        'Kanji': '北',
        'Meaning': 'phia Bac',
        'Reading': 'きた',
        'Romaji': 'kita',
        'Example': '北 = きた = Bac',
        'Memory': 'Hai nguoi quay lung lai -> phuong Bac lanh',
    },
    {
        'Kanji': '西',
        'Meaning': 'phia Tay',
        'Reading': 'にし',
        'Romaji': 'nishi',
        'Example': '西 = にし = Tay',
        'Memory': 'Hinh cai gio / huong Tay',
    },
    {
        'Kanji': '南',
        'Meaning': 'phia Nam',
        'Reading': 'みなみ',
        'Romaji': 'minami',
        'Example': '南 = みなみ = Nam',
        'Memory': 'Phia Nam, vung am hon, nhieu cay trai',
    },
]

for item in kanji_data:
    note = genanki.Note(
        model=model,
        fields=[
            item['Kanji'],
            item['Meaning'],
            item['Reading'],
            item['Romaji'],
            item['Example'],
            item['Memory'],
        ],
    )
    deck.add_note(note)

output_path = r'E:\UTILS\extractor\nihongo_kanji\kanji_n5_bai_6.apkg'
package = genanki.Package(deck)
package.write_to_file(output_path)
print('Created', output_path)
