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
