import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MULTIPLE_CHOICE_HEADER,
  parseMultipleChoice,
} from '../src/services/multiple-choice-service.js';
const required = MULTIPLE_CHOICE_HEADER.split('|').slice(0, 6).join('|');
test('Multiple Choice parses all fields, numeric answers, BOM and blank optional fields', () => {
  const [q] = parseMultipleChoice(
    `\uFEFF${MULTIPLE_CHOICE_HEADER}\r\n\r\n Q? | A | B | C | D | 2 | Why | Context | Example | Nghĩa \r\n`,
  );
  assert.equal(q.question, 'Q?');
  assert.deepEqual(q.options, ['A', 'B', 'C', 'D']);
  assert.equal(q.correctAnswer, '2');
  assert.equal(q.explanation, 'Why');
  assert.equal(q.context, 'Context');
  assert.equal(q.example, 'Example');
  assert.equal(q.exampleMeaning, 'Nghĩa');
  assert.equal(parseMultipleChoice(`${required}\nQ|A|B|C|D|4`)[0].example, '');
});
test('quoted pipes, multiline text and escaped quotes preserve source content and line errors', () => {
  const [q] = parseMultipleChoice(
    `${MULTIPLE_CHOICE_HEADER}\n"Q | test\nline 2"|"A ""quoted"""|B|C|D|1|"first\nsecond"|||`,
  );
  assert.equal(q.question, 'Q | test\nline 2');
  assert.equal(q.options[0], 'A "quoted"');
  assert.equal(q.explanation, 'first\nsecond');
  assert.throws(
    () => parseMultipleChoice(`${required}\n"Q\nline"|A|B|C|D|1\nQ|A|B|C|D|0`),
    /Dòng 4.*correct_answer/,
  );
  assert.throws(() => parseMultipleChoice(`${required}\n"Q|A`), /Dòng 2.*chưa đóng/);
  assert.throws(() => parseMultipleChoice(`${required}\n"Q"tail|A|B|C|D|1`), /Dòng 2.*nháy/);
});
test('rejects invalid answer keys, missing values, malformed columns and headers atomically', () => {
  for (const answer of ['0', '5', 'A', '1.0', '01', '']) {
    assert.throws(
      () => parseMultipleChoice(`${required}\nQ|A|B|C|D|${answer}`),
      /Dòng 2.*correct_answer/,
    );
  }
  assert.throws(() => parseMultipleChoice(`${required}\nQ|A||C|D|1`), /Dòng 2.*option_2/);
  assert.throws(() => parseMultipleChoice(`${required}\n|A|B|C|D|1`), /Dòng 2.*question/);
  assert.throws(() => parseMultipleChoice(`${required}\nQ|A|B|C|D|1\nBad|A|B`), /Dòng 3.*6 cột/);
  assert.throws(
    () => parseMultipleChoice(`${required}|[context]\nQ|A|B|C|D|1|x`),
    /header không hỗ trợ/,
  );
  assert.throws(() => parseMultipleChoice(`${required}|question`), /header bị trùng/);
  assert.throws(() => parseMultipleChoice('question|option_1'), /thiếu header/);
  assert.throws(() => parseMultipleChoice(''), /Vui lòng/);
  assert.throws(() => parseMultipleChoice(required), /Chưa có câu hỏi/);
});
test('IDs survive reordering and explanation changes without mixing distinct or duplicate questions', () => {
  const original = parseMultipleChoice(
    `${required}|explanation\nQ|A|B|C|D|1|old\nR|A|B|C|D|2|why\nQ|A|B|C|D|1|duplicate`,
  );
  const reordered = parseMultipleChoice(
    `${required}|explanation\nR|A|B|C|D|2|why\nQ|A|B|C|D|1|updated`,
  );
  assert.equal(original[0].id, reordered[1].id);
  assert.equal(original[1].id, reordered[0].id);
  assert.notEqual(original[0].id, original[2].id);
  assert.deepEqual(
    reordered.map((q) => q.number),
    [1, 2],
  );
});
