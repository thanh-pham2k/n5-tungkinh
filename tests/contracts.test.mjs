import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseInstantVocabCsvRows,
  parseInstantVocabCsv,
  parseVocabReviewCsv,
  parseWordOrderCsv,
  parseWritingReviewCsv,
  shuffleTokensGuaranteed,
} from '../src/services/csv-service.js';
import { isOrderCorrect, isTypingCorrect, serializeCsv } from '../src/services/answer-service.js';
import data from '../src/data/practice-data.js';
import { parseHotReviewQuiz, parseAnswerCsv } from '../src/services/hot-review-service.js';
const header = 'vocabulary,hiragana,meaning_vi,example_ja,example_vi';
test('generated module preserves every field from the canonical IELTS source', () => {
  const source = readFileSync(new URL('../docs/ielts/practice-data.js', import.meta.url), 'utf8');
  const canonical = JSON.parse(
    source.replace(/^\s*window\.IELTS_PRACTICE\s*=\s*/, '').replace(/;\s*$/, ''),
  );
  assert.deepEqual(data, canonical);
});
test('CSV supports quoted commas, escaped quotes, multiline fields and BOM', () => {
  assert.deepEqual(parseInstantVocabCsvRows('a,b\r\n"a,b","line 1\nline ""2"""'), [
    ['a', 'b'],
    ['a,b', 'line 1\nline "2"'],
  ]);
  const items = parseInstantVocabCsv(`\uFEFF${header}\r\ncat,,mèo,This is a cat.,Đây là mèo.`);
  assert.equal(items[0].vocabulary, 'cat');
  assert.throws(() => parseInstantVocabCsvRows('"unfinished'), /unclosed/);
});
test('all shipped IELTS CSV decks remain compatible with their existing modes', () => {
  for (const mode of ['instant-vocab', 'topic-vocab', 'word-order', 'writing']) {
    assert.ok(data[mode].length);
    for (const day of data[mode]) {
      const parse =
        mode === 'instant-vocab'
          ? parseInstantVocabCsv
          : mode === 'topic-vocab'
            ? parseVocabReviewCsv
            : parseWordOrderCsv;
      assert.ok(parse(day.csv).length, `${mode}: ${day.date}`);
    }
  }
});
test('Writing contract and reordered flashcard headers are retained', () => {
  assert.equal(
    parseWritingReviewCsv(
      'context,prompt,input,sample_answer\nwork,Reply to email,Hello,Thank you.',
    )[0].sample_answer,
    'Thank you.',
  );
  assert.equal(
    parseVocabReviewCsv('meaning_vi,vocabulary,hiragana,example_ja,example_vi\nmèo,cat,,,')[0]
      .meaning_vi,
    'mèo',
  );
  assert.throws(() => parseVocabReviewCsv('wrong\ncat'));
});
test('order checks every token identity; typing ignores case/punctuation but not missing words', () => {
  const tokens = [
    { id: 0, text: 'I' },
    { id: 1, text: 'am' },
    { id: 2, text: 'I' },
  ];
  assert.equal(isOrderCorrect(tokens.slice(0, 2), tokens), false);
  assert.equal(isOrderCorrect([tokens[2], tokens[1], tokens[0]], tokens), false);
  assert.equal(isOrderCorrect(tokens, tokens), true);
  assert.equal(isTypingCorrect('  HELLO, world! ', 'Hello world.'), true);
  assert.equal(isTypingCorrect('', ''), false);
  assert.equal(isTypingCorrect('Hello', 'Hello world.'), false);
  assert.equal(isTypingCorrect('私は学生です', '私（わたし）は学生（がくせい）です。'), true);
  assert.deepEqual(
    shuffleTokensGuaranteed(tokens)
      .map((t) => t.id)
      .sort(),
    [0, 1, 2],
  );
});
test('all structure exercises have five levels and serialize without breaking commas', () => {
  for (const topic of data.structures)
    for (const item of topic.items) {
      assert.equal(item.exercises.length, 5);
      for (const exercise of item.exercises) {
        const csv = serializeCsv([
          [...header.split(','), 'word_order'],
          [
            exercise.sentence,
            '',
            exercise.meaning,
            exercise.sentence,
            exercise.meaning,
            exercise.chunks.join('|'),
          ],
        ]);
        assert.equal(parseWordOrderCsv(csv)[0].targetSentence, exercise.sentence);
      }
    }
});
test('Hot Review preserves numeric question ordering and positional answer import', () => {
  const source =
    'group_id,group_title,lesson,question_no,question_jp,meaning_vi,option_a,option_b,option_c,option_d\ng,Test,1,10,Q10,,A,B,C,D\ng,Test,1,2,Q2,,A,B,C,D';
  const parsed = parseHotReviewQuiz(source);
  assert.deepEqual(
    parsed.questions.map((q) => q.questionNo),
    ['2', '10'],
  );
  assert.deepEqual(
    parsed.questions.map((q) => q.orderKey),
    ['order-0', 'order-1'],
  );
  assert.throws(() => parseHotReviewQuiz('wrong\nvalues'), /header/);
  const answers = parseAnswerCsv(
    'correct_answer,answer_detail_vi,vocab_kanji,grammar\nA,Correct,本（ほん）= sách,です\nb,Second,,',
  );
  assert.equal(answers[0].correctAnswer, 'A');
  assert.equal(answers[1].correctAnswer, 'B');
});
