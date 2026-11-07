(function (root) {
  'use strict';
  function parseQuiz(source, line) {
    const fields = Object.create(null);
    const options = [];
    let key;
    for (const text of source) {
      const field = text.match(/^\s*(id|type|question|options|answer|explanation):\s*(.*)$/);
      if (field) {
        key = field[1];
        if (Object.hasOwn(fields, key)) throw new Error(`Dòng ${line}: trường ${key} bị lặp.`);
        fields[key] = field[2].trim();
      } else if (key === 'options' && /^\s*-\s+/.test(text)) {
        options.push(text.replace(/^\s*-\s+/, '').trim());
      } else if (text.trim() && (key === 'question' || key === 'explanation')) {
        fields[key] += '\n' + text.trim();
      } else if (text.trim()) throw new Error(`Dòng ${line}: cú pháp quiz không hợp lệ.`);
    }
    const answer = Number(fields.answer);
    if (
      !fields.id ||
      fields.type !== 'single_choice' ||
      !fields.question ||
      options.length < 2 ||
      options.some((option) => !option) ||
      !Number.isInteger(answer) ||
      answer < 1 ||
      answer > options.length
    ) {
      throw new Error(
        `Dòng ${line}: quiz cần id, type: single_choice, question, ít nhất 2 options và answer từ 1 đến số lựa chọn.`,
      );
    }
    return { ...fields, options, answer: answer - 1 };
  }
  function parse(source) {
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    const blocks = [],
      ids = new Set();
    let markdown = [],
      fence = null;
    const flush = () => {
      if (markdown.join('\n').trim())
        blocks.push({ type: 'markdown', content: markdown.join('\n') });
      markdown = [];
    };
    const appendQuiz = (quiz, line) => {
      if (ids.has(quiz.id)) throw new Error(`Dòng ${line}: id quiz bị trùng: ${quiz.id}.`);
      ids.add(quiz.id);
      const last = blocks[blocks.length - 1];
      if (last?.type === 'deck') last.quizzes.push(quiz);
      else blocks.push({ type: 'deck', quizzes: [quiz] });
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fence) {
        markdown.push(line);
        if (
          marker &&
          marker[1][0] === fence[0] &&
          marker[1].length >= fence.length &&
          !marker[2].trim()
        )
          fence = null;
        continue;
      }
      if (marker && marker[2].trim() === 'flipcard') {
        flush();
        const start = i + 1,
          cards = [];
        const isClose = (text) => {
          const close = text.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
          return close && close[1][0] === marker[1][0] && close[1].length >= marker[1].length;
        };
        while (++i < lines.length && !isClose(lines[i])) {
          if (!lines[i].trim()) continue;
          const parts = lines[i]
            .trimEnd()
            .split(/\s+\| ?/)
            .map((part) => part.trim());
          if (
            ![2, 3, 4, 5].includes(parts.length) ||
            !parts[0] ||
            !parts[1] ||
            (parts.length >= 3 && !parts[2])
          ) {
            blocks.push({
              type: 'error',
              content: `Dòng ${i + 1}: flipcard cần mặt trước | mặt sau hoặc mặt trước | giải thích | ví dụ | từ đồng nghĩa | từ loại (hai trường cuối có thể bỏ trống).`,
            });
          } else if (parts.length === 2) cards.push({ front: parts[0], back: parts[1] });
          else
            cards.push({
              front: parts[0],
              back: parts[1],
              example: parts[2],
              synonyms: parts[3] || '',
              ...(parts[4]?.replace(/^\(\s*|\s*\)$/g, '').trim()
                ? { partOfSpeech: parts[4].replace(/^\(\s*|\s*\)$/g, '').trim() }
                : {}),
            });
        }
        if (i === lines.length)
          blocks.push({
            type: 'error',
            content: `Dòng ${start}: thiếu dấu đóng code block flipcard.`,
          });
        else if (cards.length) blocks.push({ type: 'flipcards', cards });
        else
          blocks.push({ type: 'error', content: `Dòng ${start}: flipcard cần ít nhất một thẻ.` });
        continue;
      }
      if (marker && ['quiz', 'quiz-deck'].includes(marker[2].trim())) {
        flush();
        const start = i + 1,
          body = [];
        const isClose = (text) => {
          const close = text.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
          return close && close[1][0] === marker[1][0] && close[1].length >= marker[1].length;
        };
        while (++i < lines.length && !isClose(lines[i])) body.push({ text: lines[i], line: i + 1 });
        if (i === lines.length) {
          blocks.push({ type: 'error', content: `Dòng ${start}: thiếu dấu đóng code block quiz.` });
          continue;
        }
        for (const row of body) {
          if (!row.text.trim()) continue;
          try {
            const parts = row.text
              .trim()
              .split(' | ')
              .map((field) => field.trim());
            const [id, type, question] = parts;
            if (type === 'word_order' || type === 'typing') {
              const expected = type === 'word_order' ? 6 : 5;
              if (parts.length !== expected || parts.some((part) => !part))
                throw new Error(`Dòng ${row.line}: định dạng ${type} không hợp lệ.`);
              if (type === 'word_order') {
                const tokens = parts[3].split(' / ').map((token) => token.trim());
                if (tokens.length < 2 || tokens.some((token) => !token))
                  throw new Error(
                    `Dòng ${row.line}: word_order cần ít nhất 2 từ hoặc cụm từ, ngăn cách bằng ' / '.`,
                  );
                appendQuiz(
                  { id, type, question, tokens, answer: parts[4], explanation: parts[5] },
                  row.line,
                );
              } else
                appendQuiz(
                  { id, type, question, answer: parts[3], explanation: parts[4] },
                  row.line,
                );
              continue;
            }
            if (parts.length < 7)
              throw new Error(
                `Dòng ${row.line}: cần id | single_choice | question | option 1 | option 2 | answer | explanation.`,
              );
            const options = parts.slice(3, -2),
              answer = parts.at(-2),
              explanation = parts.at(-1);
            // Reuse the same field validation for both input formats.
            appendQuiz(
              parseQuiz(
                [
                  `id: ${id}`,
                  `type: ${type}`,
                  `question: ${question}`,
                  'options:',
                  ...options.map((option) => `- ${option}`),
                  `answer: ${answer}`,
                  `explanation: ${explanation}`,
                ],
                row.line,
              ),
              row.line,
            );
          } catch (error) {
            blocks.push({ type: 'error', content: error.message });
          }
        }
        continue;
      }
      if (marker) {
        fence = marker[1];
        markdown.push(line);
        continue;
      }
      if (/^ {0,3}:::quiz\s*$/.test(line)) {
        flush();
        const start = i + 1,
          body = [];
        while (++i < lines.length && !/^ {0,3}:::\s*$/.test(lines[i])) body.push(lines[i]);
        try {
          if (i === lines.length) throw new Error(`Dòng ${start}: thiếu dấu đóng :::.`);
          const quiz = parseQuiz(body, start);
          appendQuiz(quiz, start);
        } catch (error) {
          blocks.push({ type: 'error', content: error.message });
        }
      } else markdown.push(line);
    }
    flush();
    // Collect only labels explicitly authored in the lesson, including multiple word classes.
    const vocabulary = new Map();
    const label = '(?:Phr V|V Phr|Modal V|N-C|N-U|N|V|Adj|Adv|Prep|Prefix|Phrase)(?:\\s+phrase)?';
    const definition = new RegExp(
      '^\\s*[-*]\\s+\\*\\*([^*]+)\\*\\*\\s+\\/[^\\n]+?\\/\\s*\\((' +
        label +
        '(?:\\s*[,/]\\s*' +
        label +
        ')*)\\)\\s*:',
      'i',
    );
    for (const block of blocks) {
      if (block.type !== 'markdown') continue;
      for (const line of block.content.split('\n')) {
        const match = line.match(definition);
        if (!match) continue;
        const key = match[1].trim().toLocaleLowerCase();
        const values = vocabulary.get(key) || [];
        for (const value of match[2].split(/\s*[,/]\s*/)) {
          if (!values.some((item) => item.toLowerCase() === value.toLowerCase()))
            values.push(value);
        }
        vocabulary.set(key, values);
      }
    }
    for (const block of blocks) {
      if (block.type !== 'flipcards') continue;
      for (const card of block.cards) {
        const key = card.front.trim().toLocaleLowerCase();
        if (!card.partOfSpeech && vocabulary.has(key))
          card.partOfSpeech = vocabulary.get(key).join(', ');
      }
    }
    return blocks;
  }
  root.LessonParser = { parse };
  if (typeof module !== 'undefined') module.exports = { parse };
})(typeof window === 'undefined' ? globalThis : window);
