const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../src/services/lesson-parser.cjs');
const quiz = (id = 'q1', answer = '2') => `:::quiz
id: ${id}
type: single_choice
question: Chọn đáp án?
options:
  - Một
  - Hai
answer: ${answer}
explanation: Giải thích.
:::`;
test('groups adjacent quizzes across whitespace but separates at lesson content', () => {
  const blocks = parse(`# Lesson\n${quiz()}\n\n${quiz('q2')}\n\nNext\n${quiz('q3')}`);
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['markdown', 'deck', 'markdown', 'deck'],
  );
  assert.equal(blocks[1].quizzes.length, 2);
  assert.equal(blocks[1].quizzes[0].answer, 1);
});
test('preserves fenced quiz examples and Mermaid as Markdown', () => {
  for (const fence of ['```', '~~~~']) {
    const text = `${fence}text\n${quiz()}\n${fence}\n\n\`\`\`mermaid\nflowchart LR\n A --> B\n\`\`\``;
    assert.deepEqual(parse(text), [{ type: 'markdown', content: text }]);
  }
});
test('reports malformed and duplicate quizzes while retaining following content', () => {
  assert.equal(parse(quiz('bad', '0'))[0].type, 'error');
  assert.equal(parse(quiz('bad', '3'))[0].type, 'error');
  assert.equal(parse(quiz() + '\n' + quiz())[1].type, 'error');
  const blocks = parse(quiz('bad', 'no') + '\nFollowing lesson');
  assert.equal(blocks[1].content, 'Following lesson');
  assert.match(parse(quiz().slice(0, -3))[0].content, /thiếu/);
});
test('normalizes Windows newlines and resists object prototype field names', () => {
  assert.equal(parse(quiz('__proto__').replace(/\n/g, '\r\n'))[0].quizzes[0].id, '__proto__');
});
const row = (id = 'row1', answer = '2') =>
  `${id} | single_choice | Khi chạy \`git branch\`? | Copy | Reference | ${answer} | Một reference.`;
test('parses quiz fence rows with variable option counts and inline code', () => {
  const blocks = parse('```quiz\n' + row() + '\n\n' + row('row2') + '\n```\nNext');
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['deck', 'markdown'],
  );
  assert.equal(blocks[0].quizzes.length, 2);
  assert.equal(blocks[0].quizzes[0].question, 'Khi chạy `git branch`?');
  assert.equal(blocks[0].quizzes[0].answer, 1);
  assert.equal(
    parse('~~~quiz\nq | single_choice | Q | A | B | C | D | 3 | Why\n~~~')[0].quizzes[0].options
      .length,
    4,
  );
});
test('reports row errors individually and checks duplicate IDs across formats', () => {
  const blocks = parse('```quiz\nbad row\n' + row('good') + '\n' + row('bad', '9') + '\n```');
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['error', 'deck', 'error'],
  );
  assert.match(blocks[0].content, /Dòng 2/);
  assert.equal(parse(quiz('row1') + '\n```quiz\n' + row() + '\n```')[1].type, 'error');
  assert.match(parse('```quiz\n' + row())[0].content, /thiếu/);
});
test('does not parse quiz fences inside a longer example fence', () => {
  const text = '````text\n```quiz\n' + row() + '\n```\n````';
  assert.deepEqual(parse(text), [{ type: 'markdown', content: text }]);
});
test('accepts quiz-deck with the four-option teaching prompt format', () => {
  const text =
    '# Problem Essence\nExplain the mechanism.\n\n```quiz-deck\ncase-01 | single_choice | Why? | A | B | C | D | 3 | Because C.\ncase-02 | single_choice | Which failure? | A | B | C | D | 1 | Because A.\n```\n\n## Validate\nCheck the result.';
  const blocks = parse(text);
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['markdown', 'deck', 'markdown'],
  );
  assert.equal(blocks[1].quizzes.length, 2);
  assert.deepEqual(blocks[1].quizzes[0].options, ['A', 'B', 'C', 'D']);
  assert.equal(blocks[1].quizzes[0].answer, 2);
});
test('parses mixed exercise types and validates malformed rows', () => {
  const blocks = parse(
    '```quiz\na | single_choice | Q | A | B | 1 | Why\nb | word_order | Order | She / goes / home | She goes home. | Why\nc | typing | Translate | She goes home. | Why\n```',
  );
  assert.deepEqual(
    blocks[0].quizzes.map((q) => q.type),
    ['single_choice', 'word_order', 'typing'],
  );
  assert.deepEqual(blocks[0].quizzes[1].tokens, ['She', 'goes', 'home']);
  assert.equal(parse('```quiz\nx | word_order | Q | one | Answer | Why\n```')[0].type, 'error');
  assert.equal(parse('```quiz\nx | typing | Q | | Why\n```')[0].type, 'error');
});
test('work English course has 30 valid lessons and matching order answers', () => {
  const lessons = require('../database/seed/work-english-30.json');
  assert.equal(lessons.length, 30);
  const normalize = (text) =>
    text.normalize('NFKC').toLowerCase().replace(/\p{P}/gu, '').trim().replace(/\s+/g, ' ');
  lessons.forEach((lesson, index) => {
    assert.equal(lesson.day, index + 1);
    assert.deepEqual(
      [...lesson.source.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
      ['Mẫu câu cố định', 'Từ và cụm từ gợi ý', 'Luyện tập'],
    );
    const blocks = parse(lesson.source);
    assert.equal(
      blocks.some((block) => block.type === 'error'),
      false,
      lesson.title,
    );
    const quizzes = blocks
      .filter((block) => block.type === 'deck')
      .flatMap((block) => block.quizzes);
    assert.equal(quizzes.length, 10);
    assert.equal(quizzes.filter((q) => q.type === 'word_order').length, 5);
    assert.equal(quizzes.filter((q) => q.type === 'typing').length, 5);
    for (let i = 1; i < quizzes.length; i += 2) {
      assert.equal(quizzes[i - 1].type, 'word_order', lesson.title);
      assert.equal(quizzes[i].type, 'typing', lesson.title);
      assert.equal(quizzes[i].question, quizzes[i - 1].question, lesson.title);
      assert.equal(quizzes[i].answer, quizzes[i - 1].answer, lesson.title);
    }
    quizzes
      .filter((q) => q.type === 'word_order')
      .forEach((q) =>
        assert.equal(normalize(q.tokens.join(' ')), normalize(q.answer), lesson.title),
      );
  });
});

test('parses flipcards and reports invalid rows without treating ordinary code as cards', () => {
  const blocks = parse(
    '```flipcard\n猫 | Con mèo\n**apple** | quả táo\nthiếu mặt sau\n```\n\n```text\na | b\n```',
  );
  assert.deepEqual(blocks.find((block) => block.type === 'flipcards').cards, [
    { front: '猫', back: 'Con mèo' },
    { front: '**apple**', back: 'quả táo' },
  ]);
  assert.match(blocks.find((block) => block.type === 'error').content, /Dòng 4/);
  assert.match(blocks.at(-1).content, /```text/);
});

test('parses structured flipcard backs and requires explanation and example', () => {
  const blocks = parse(
    '```flipcard\napple | quả táo | An apple. | fruit\nhappy | vui vẻ | She is happy. |\nold | nghĩa cũ\nbad | nghĩa |\n```',
  );
  assert.deepEqual(blocks.find((block) => block.type === 'flipcards').cards, [
    { front: 'apple', back: 'quả táo', example: 'An apple.', synonyms: 'fruit' },
    { front: 'happy', back: 'vui vẻ', example: 'She is happy.', synonyms: '' },
    { front: 'old', back: 'nghĩa cũ' },
  ]);
  assert.match(blocks.find((block) => block.type === 'error').content, /Dòng 5/);
});

test('flipcards use explicit and multiple authored parts of speech', () => {
  const source =
    '- **routine** /ruːˈtiːn/ (N): thói quen.\n- **run** /rʌn/ (V): chạy.\n- **run** /rʌn/ (N): lần chạy.\n\n```flipcard\nroutine | thói quen | A daily routine. | habit\nrun | chạy | I run. |  | V\nunknown | chưa biết | Example. |\n```';
  const cards = parse(source).find((block) => block.type === 'flipcards').cards;
  assert.equal(cards[0].partOfSpeech, 'N');
  assert.equal(cards[1].partOfSpeech, 'V');
  assert.equal(cards[2].partOfSpeech, undefined);
  const ambiguous = parse(
    '- **run** /rʌn/ (V): chạy.\n- **run** /rʌn/ (N): lần chạy.\n\n```flipcard\nrun | chạy | I run.\n```',
  );
  assert.equal(ambiguous.find((block) => block.type === 'flipcards').cards[0].partOfSpeech, 'V, N');
});

test('flipcards accept comma, slash and additional authored word classes', () => {
  const source =
    '- **record** /ˈrekɔːd/ (N, V): ghi hoặc bản ghi.\n- **well** /wel/ (Adv/Adj): tốt.\n- **bread** /bred/ (N-U): bánh mì.\n- **near** /nɪə/ (Prep): gần.\n\n```flipcard\nrecord | ghi | Record it.\nwell | tốt | She is well.\nbread | bánh mì | Bread is good.\nnear | gần | Near me.\nset | đặt | Set it. |  | (N, V)\nempty | rỗng | Empty. |  | ()\n```';
  const cards = parse(source).find((block) => block.type === 'flipcards').cards;
  assert.deepEqual(
    cards.map((card) => card.partOfSpeech),
    ['N, V', 'Adv, Adj', 'N-U', 'Prep', 'N, V', undefined],
  );
});

test('normalizes decomposed Vietnamese Unicode (NFD) to precomposed NFC', () => {
  const nfdQuestion = 'Yêu cầu vẫn cố cần chống lỗi nhất'.normalize('NFD');
  const nfdOptionA = 'Giải pháp tối ưu'.normalize('NFD');
  const source = `\`\`\`quiz\nq1 | single_choice | ${nfdQuestion} | ${nfdOptionA} | Khác | 1 | Giải thích.\n\`\`\``;
  const blocks = parse(source);
  const quiz = blocks[0].quizzes[0];
  assert.equal(quiz.question, 'Yêu cầu vẫn cố cần chống lỗi nhất');
  assert.equal(quiz.options[0], 'Giải pháp tối ưu');
});

test('parses all visual-* DSL blocks with defaults and preserves nested examples', () => {
  const source = [
    '```visual-grid',
    'title: SQS Benefits',
    'columns: 3',
    '',
    'unlink | Decoupling | Giảm phụ thuộc',
    'Buffering | Hấp thụ spike',
    '```',
    '',
    '```visual-flow',
    'direction: vertical',
    'download | Receive | Lấy message',
    'eye-off | Invisible',
    'Delete',
    '```',
    '',
    '```visual-compare',
    'title: Standard vs FIFO',
    '[Standard]',
    'icon: shuffle',
    'description: Throughput cao',
    'send: A, B, C',
    'receive: A, C, B, B',
    '[FIFO]',
    'icon: list-ordered',
    'description: Đúng thứ tự',
    'send: A, B, C',
    'receive: A, B, C',
    '```',
    '',
    '```visual-metrics',
    'clock | Long Polling | 20s | Giảm empty responses',
    'Retention | 14 ngày | Mặc định 4 ngày',
    'Encryption | HTTPS / KMS',
    '```',
    '',
    '```visual-timeline',
    'title: DLQ Recovery',
    'B1 | Investigate | Xem log',
    'B2 | Fix',
    '```',
    '',
    '```visual-simulation',
    'type: sqs-visibility-timeout',
    'visibilityTimeout: 30',
    'processingTime: 60',
    '```',
    '',
    '````markdown',
    '```visual-grid',
    'a | b',
    '```',
    '````',
  ].join('\n');

  const blocks = parse(source);
  assert.deepEqual(
    blocks.map((b) => b.type),
    [
      'visual_grid',
      'visual_flow',
      'visual_compare',
      'visual_metrics',
      'visual_timeline',
      'visual_simulation',
      'markdown',
    ],
  );
  assert.equal(blocks[0].columns, 3);
  assert.equal(blocks[0].items[1].icon, '');
  assert.equal(blocks[1].direction, 'vertical');
  assert.equal(blocks[1].steps[2].label, 'Delete');
  assert.deepEqual(blocks[2].sections[0].receive, ['A', 'C', 'B', 'B']);
  assert.equal(blocks[3].columns, 2);
  assert.equal(blocks[3].items[2].note, '');
  assert.equal(blocks[4].items[1].description, '');
  assert.equal(blocks[5].simulationType, 'sqs-visibility-timeout');
  assert.equal(blocks[5].params.visibilityTimeout, 30);
  assert.match(blocks[6].content, /````markdown/);
});

test('reports errors for malformed or unclosed visual-* blocks', () => {
  assert.equal(parse('```visual-grid\ncolumns: 9\na | b\n```')[0].type, 'error');
  assert.equal(parse('```visual-grid\nonly-one-part\n```')[0].type, 'error');
  assert.equal(parse('```visual-flow\ndirection: diagonal\nA\n```')[0].type, 'error');
  assert.equal(parse('```visual-compare\n[OnlyOne]\ndescription: x\n```')[0].type, 'error');
  assert.equal(parse('```visual-metrics\nonly-one\n```')[0].type, 'error');
  assert.equal(parse('```visual-timeline\nonly-one\n```')[0].type, 'error');
  assert.equal(parse('```visual-simulation\nvisibilityTimeout: 30\n```')[0].type, 'error');
  assert.match(parse('```visual-grid\na | b')[0].content, /thiếu dấu đóng/);
});

test('parses input/sqs-visual-demo.md without errors', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const demo = fs.readFileSync(path.join(__dirname, '../input/sqs-visual-demo.md'), 'utf8');
  const blocks = parse(demo);
  assert.equal(
    blocks.some((b) => b.type === 'error'),
    false,
  );
  const types = new Set(blocks.map((b) => b.type));
  for (const expected of [
    'markdown',
    'visual_flow',
    'visual_grid',
    'visual_compare',
    'visual_simulation',
    'visual_timeline',
    'visual_metrics',
    'deck',
  ]) {
    assert.equal(types.has(expected), true, `Missing block type: ${expected}`);
  }
});

test('database/seed/visual-samples.json config and samples parse cleanly', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const config = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../database/seed/visual-samples.json'), 'utf8'),
  );
  assert.equal(config.enabled, true);
  assert.deepEqual(config.allowedUsers, ['thanhpv']);
  assert.equal(config.tab.id, 'visual-samples');
  assert.equal(config.tab.href, '/visual-samples/');
  assert.equal(config.promptTab.id, 'base-prompt');
  assert.equal(config.promptTab.href, '/base-prompt/');
  assert.equal(Array.isArray(config.basePrompts), true);
  assert.equal(config.basePrompts[0].id, 'aws-saa-mini-textbook');
  assert.match(config.basePrompts[0].content, /Problem-driven Mini Textbook/);
  assert.match(config.basePrompts[0].content, /visual-callout/);
  assert.equal(config.samples.length >= 11, true);
  const seenTypes = new Set();
  for (const sample of config.samples) {
    const blocks = parse(sample.markdown);
    assert.equal(
      blocks.some((b) => b.type === 'error'),
      false,
      `Sample ${sample.id} failed to parse`,
    );
    for (const block of blocks) {
      if (block.type.startsWith('visual_')) seenTypes.add(block.type);
    }
  }
  for (const expected of [
    'visual_grid',
    'visual_flow',
    'visual_compare',
    'visual_metrics',
    'visual_timeline',
    'visual_simulation',
    'visual_callout',
    'visual_checklist',
    'visual_tabs',
    'visual_decision',
  ]) {
    assert.equal(seenTypes.has(expected), true, `Samples missing ${expected}`);
  }
});

test('parses visual-callout, visual-checklist, visual-tabs, and visual-decision with validation', () => {
  const source = [
    '```visual-callout',
    'tone: pitfall',
    'title: Lưu ý',
    'Dòng một **quan trọng**.',
    'Dòng hai.',
    '```',
    '',
    '```visual-checklist',
    'title: Kiểm tra',
    '[x] Đã làm',
    '- [ ] Chưa làm',
    'Mục thường',
    '```',
    '',
    '```visual-tabs',
    'title: Góc nhìn',
    '[Tab A]',
    'Nội dung A',
    '[Tab B]',
    'Nội dung B',
    '```',
    '',
    '```visual-decision',
    'title: Chọn nhanh',
    'Cần nhanh | Standard | Throughput cao',
    'Cần thứ tự | FIFO',
    '```',
  ].join('\n');

  const blocks = parse(source);
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['visual_callout', 'visual_checklist', 'visual_tabs', 'visual_decision'],
  );
  assert.equal(blocks[0].tone, 'pitfall');
  assert.equal(blocks[0].lines.length, 2);
  assert.deepEqual(blocks[1].items, [
    { checked: true, text: 'Đã làm' },
    { checked: false, text: 'Chưa làm' },
    { checked: false, text: 'Mục thường' },
  ]);
  assert.equal(blocks[2].tabs.length, 2);
  assert.equal(blocks[3].rules[1].reason, '');

  assert.equal(parse('```visual-callout\ntone: neon\nHello\n```')[0].type, 'error');
  assert.equal(parse('```visual-callout\ntone: info\n```')[0].type, 'error');
  assert.equal(parse('```visual-checklist\ntitle: Trống\n```')[0].type, 'error');
  assert.equal(parse('```visual-tabs\n[OnlyOne]\nText\n```')[0].type, 'error');
  assert.equal(parse('```visual-decision\nonly-one-part\n```')[0].type, 'error');
});

test('auto-detects bare fences, normalizes ChatGPT single-backtick blocks, and parses arrow sequences', () => {
  const bare = [
    '```',
    'title: Flow',
    'direction: horizontal',
    '📥 | Receive | Nhận',
    '⚙️ | Process | Xử lý',
    '```',
    '',
    '```',
    'Q1 | single_choice | 1+1? | 1 | 2 | 3 | 4 | 2 | Hai.',
    '```',
    '',
    'visual-compare',
    '',
    '`title: Std vs FIFO',
    '[Standard]',
    'send: A → B → C',
    'receive: A → C → B → B',
    '[FIFO]',
    'send: A → B → C',
    'receive: A → B → C`',
  ].join('\n');

  const blocks = parse(bare);
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['visual_flow', 'deck', 'visual_compare'],
  );
  assert.deepEqual(blocks[2].sections[0].receive, ['A', 'C', 'B', 'B']);
});

test('all 7 files in inbox/ parse with zero errors', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '../inbox');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort();
  assert.equal(files.length, 7);
  for (const name of files) {
    const blocks = parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    assert.equal(
      blocks.some((b) => b.type === 'error'),
      false,
      `${name} had parse errors`,
    );
    assert.equal(
      blocks.some((b) => b.type === 'deck'),
      true,
      `${name} missing quizzes`,
    );
    assert.equal(
      blocks.some((b) => b.type === 'flipcards'),
      true,
      `${name} missing flipcards`,
    );
  }
});
