import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSpeechText } from '../src/services/audio-service.js';

test('splits long speech into bounded chunks without losing words', () => {
  const text = 'Anna lives in a small city. She works at a school. '.repeat(12).trim();
  const chunks = splitSpeechText(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => Array.from(chunk).length <= 180));
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), text);
});

test('splits an unbroken string without cutting Unicode characters', () => {
  const text = '😀'.repeat(400);
  const chunks = splitSpeechText(text);
  assert.deepEqual(
    chunks.map((chunk) => Array.from(chunk).length),
    [180, 180, 40],
  );
  assert.equal(chunks.join(''), text);
});
