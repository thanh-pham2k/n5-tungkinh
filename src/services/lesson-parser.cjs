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
  const VISUAL_TYPES = new Set([
    'visual-grid',
    'visual-flow',
    'visual-compare',
    'visual-metrics',
    'visual-timeline',
    'visual-simulation',
    'visual-callout',
    'visual-checklist',
    'visual-tabs',
    'visual-decision',
  ]);
  function isFenceClose(text, openMarker) {
    const close = text.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
    return Boolean(close && close[1][0] === openMarker[0] && close[1].length >= openMarker.length);
  }
  function parseColumnsHeader(value, line) {
    const cols = Number(value);
    if (!Number.isInteger(cols) || cols < 1 || cols > 4) {
      throw new Error(`Dòng ${line}: columns phải là số nguyên từ 1 đến 4.`);
    }
    return cols;
  }
  function parseKeyValueLine(text) {
    const match = text.match(/^\s*([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    return match ? { key: match[1].toLowerCase(), rawKey: match[1], value: match[2].trim() } : null;
  }
  function parseVisualBlock(kind, body, startLine) {
    if (kind === 'visual-grid') {
      let title = '';
      let columns = 2;
      const items = [];
      for (const row of body) {
        const trimmed = row.text.trim();
        if (!trimmed) continue;
        if (!trimmed.includes('|') && items.length === 0) {
          const kv = parseKeyValueLine(trimmed);
          if (kv?.key === 'title') {
            title = kv.value;
            continue;
          }
          if (kv?.key === 'columns') {
            columns = parseColumnsHeader(kv.value, row.line);
            continue;
          }
        }
        const parts = trimmed.split('|').map((part) => part.trim());
        if (parts.length === 3 && parts[1] && parts[2]) {
          items.push({ icon: parts[0], title: parts[1], description: parts[2] });
        } else if (parts.length === 2 && parts[0] && parts[1]) {
          items.push({ icon: '', title: parts[0], description: parts[1] });
        } else {
          throw new Error(
            `Dòng ${row.line}: visual-grid cần "icon | tiêu đề | mô tả" hoặc "tiêu đề | mô tả".`,
          );
        }
      }
      if (!items.length) {
        throw new Error(`Dòng ${startLine}: visual-grid cần ít nhất một mục.`);
      }
      return { type: 'visual_grid', title, columns, items };
    }
    if (kind === 'visual-flow') {
      let title = '';
      let direction = 'horizontal';
      const steps = [];
      for (const row of body) {
        const trimmed = row.text.trim();
        if (!trimmed) continue;
        if (!trimmed.includes('|') && steps.length === 0) {
          const kv = parseKeyValueLine(trimmed);
          if (kv?.key === 'title') {
            title = kv.value;
            continue;
          }
          if (kv?.key === 'direction') {
            const dir = kv.value.toLowerCase();
            if (dir !== 'horizontal' && dir !== 'vertical') {
              throw new Error(`Dòng ${row.line}: direction chỉ hỗ trợ horizontal hoặc vertical.`);
            }
            direction = dir;
            continue;
          }
        }
        const parts = trimmed.split('|').map((part) => part.trim());
        if (parts.length === 3 && parts[1]) {
          steps.push({ icon: parts[0], label: parts[1], description: parts[2] });
        } else if (parts.length === 2 && parts[1]) {
          steps.push({ icon: parts[0], label: parts[1], description: '' });
        } else if (parts.length === 1 && parts[0]) {
          steps.push({ icon: '', label: parts[0], description: '' });
        } else {
          throw new Error(
            `Dòng ${row.line}: visual-flow cần "icon | nhãn | mô tả", "icon | nhãn" hoặc "nhãn".`,
          );
        }
      }
      if (!steps.length) {
        throw new Error(`Dòng ${startLine}: visual-flow cần ít nhất một bước.`);
      }
      return { type: 'visual_flow', title, direction, steps };
    }
    if (kind === 'visual-compare') {
      let title = '';
      const sections = [];
      let current = null;
      for (const row of body) {
        const trimmed = row.text.trim();
        if (!trimmed) continue;
        const secMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (secMatch) {
          current = {
            name: secMatch[1].trim(),
            icon: '',
            badge: '',
            description: '',
            send: [],
            receive: [],
            note: '',
            useCase: '',
            meta: [],
          };
          sections.push(current);
          continue;
        }
        const kv = parseKeyValueLine(trimmed);
        if (!kv) {
          throw new Error(`Dòng ${row.line}: cú pháp visual-compare không hợp lệ.`);
        }
        if (!current) {
          if (kv.key === 'title') {
            title = kv.value;
            continue;
          }
          throw new Error(`Dòng ${row.line}: cần khai báo [Tên mục] trước thuộc tính.`);
        }
        if (kv.key === 'icon') current.icon = kv.value;
        else if (kv.key === 'badge') current.badge = kv.value;
        else if (kv.key === 'description') current.description = kv.value;
        else if (kv.key === 'note') current.note = kv.value;
        else if (kv.key === 'usecase' || kv.key === 'use-case' || kv.key === 'use_case') {
          current.useCase = kv.value;
        } else if (kv.key === 'send' || kv.key === 'receive') {
          current[kv.key] = kv.value
            .split(',')
            .map((token) => token.trim())
            .filter(Boolean);
        } else {
          current.meta.push({ key: kv.rawKey, value: kv.value });
        }
      }
      if (sections.length < 2) {
        throw new Error(`Dòng ${startLine}: visual-compare cần ít nhất 2 nhóm [Section].`);
      }
      return { type: 'visual_compare', title, sections };
    }
    if (kind === 'visual-metrics') {
      let title = '';
      let columns = 2;
      const items = [];
      for (const row of body) {
        const trimmed = row.text.trim();
        if (!trimmed) continue;
        if (!trimmed.includes('|') && items.length === 0) {
          const kv = parseKeyValueLine(trimmed);
          if (kv?.key === 'title') {
            title = kv.value;
            continue;
          }
          if (kv?.key === 'columns') {
            columns = parseColumnsHeader(kv.value, row.line);
            continue;
          }
        }
        const parts = trimmed.split('|').map((part) => part.trim());
        if (parts.length === 4 && parts[1] && parts[2]) {
          items.push({ icon: parts[0], label: parts[1], value: parts[2], note: parts[3] });
        } else if (parts.length === 3 && parts[0] && parts[1]) {
          items.push({ icon: '', label: parts[0], value: parts[1], note: parts[2] });
        } else if (parts.length === 2 && parts[0] && parts[1]) {
          items.push({ icon: '', label: parts[0], value: parts[1], note: '' });
        } else {
          throw new Error(
            `Dòng ${row.line}: visual-metrics cần "icon | nhãn | giá trị | ghi chú" hoặc "nhãn | giá trị".`,
          );
        }
      }
      if (!items.length) {
        throw new Error(`Dòng ${startLine}: visual-metrics cần ít nhất một chỉ số.`);
      }
      return { type: 'visual_metrics', title, columns, items };
    }
    if (kind === 'visual-timeline') {
      let title = '';
      const items = [];
      for (const row of body) {
        const trimmed = row.text.trim();
        if (!trimmed) continue;
        if (!trimmed.includes('|') && items.length === 0) {
          const kv = parseKeyValueLine(trimmed);
          if (kv?.key === 'title') {
            title = kv.value;
            continue;
          }
        }
        const parts = trimmed.split('|').map((part) => part.trim());
        if (parts.length === 3 && parts[0] && parts[1]) {
          items.push({ marker: parts[0], title: parts[1], description: parts[2] });
        } else if (parts.length === 2 && parts[0] && parts[1]) {
          items.push({ marker: parts[0], title: parts[1], description: '' });
        } else {
          throw new Error(
            `Dòng ${row.line}: visual-timeline cần "mốc | tiêu đề | mô tả" hoặc "mốc | tiêu đề".`,
          );
        }
      }
      if (!items.length) {
        throw new Error(`Dòng ${startLine}: visual-timeline cần ít nhất một mốc.`);
      }
      return { type: 'visual_timeline', title, items };
    }
    if (kind === 'visual-callout') {
      const VALID_TONES = new Set([
        'info',
        'tip',
        'success',
        'warning',
        'pitfall',
        'danger',
        'error',
      ]);
      let tone = 'info';
      let title = '';
      const lines = [];
      for (const row of body) {
        const trimmed = row.text.trim();
        if (!trimmed) continue;
        if (lines.length === 0) {
          const kv = parseKeyValueLine(trimmed);
          if (kv?.key === 'tone') {
            const nextTone = kv.value.toLowerCase();
            if (!VALID_TONES.has(nextTone)) {
              throw new Error(
                `Dòng ${row.line}: tone của visual-callout phải là info, tip, success, warning, pitfall, danger hoặc error.`,
              );
            }
            tone = nextTone;
            continue;
          }
          if (kv?.key === 'title') {
            title = kv.value;
            continue;
          }
        }
        lines.push(trimmed);
      }
      if (!lines.length) {
        throw new Error(`Dòng ${startLine}: visual-callout cần ít nhất một dòng nội dung.`);
      }
      return { type: 'visual_callout', tone, title, lines };
    }
    if (kind === 'visual-checklist') {
      let title = '';
      const items = [];
      for (const row of body) {
        const trimmed = row.text.trim();
        if (!trimmed) continue;
        const boxMatch = trimmed.match(/^(?:-\s+)?\[([ xX])\]\s+(.+)$/);
        if (boxMatch) {
          items.push({
            checked: boxMatch[1].toLowerCase() === 'x',
            text: boxMatch[2].trim(),
          });
          continue;
        }
        if (items.length === 0) {
          const kv = parseKeyValueLine(trimmed);
          if (kv?.key === 'title') {
            title = kv.value;
            continue;
          }
        }
        items.push({ checked: false, text: trimmed });
      }
      if (!items.length) {
        throw new Error(`Dòng ${startLine}: visual-checklist cần ít nhất một mục.`);
      }
      return { type: 'visual_checklist', title, items };
    }
    if (kind === 'visual-tabs') {
      let title = '';
      const tabs = [];
      let currentTab = null;
      for (const row of body) {
        const trimmed = row.text.trim();
        if (!trimmed) continue;
        const tabMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (tabMatch) {
          currentTab = { name: tabMatch[1].trim(), lines: [] };
          tabs.push(currentTab);
          continue;
        }
        if (!currentTab) {
          const kv = parseKeyValueLine(trimmed);
          if (kv?.key === 'title') {
            title = kv.value;
            continue;
          }
          throw new Error(`Dòng ${row.line}: cần khai báo [Tên tab] trước nội dung.`);
        }
        currentTab.lines.push(trimmed);
      }
      if (tabs.length < 2) {
        throw new Error(`Dòng ${startLine}: visual-tabs cần ít nhất 2 tab [Tên tab].`);
      }
      for (const tab of tabs) {
        if (!tab.lines.length) {
          throw new Error(`Dòng ${startLine}: tab "${tab.name}" chưa có nội dung.`);
        }
      }
      return { type: 'visual_tabs', title, tabs };
    }
    if (kind === 'visual-decision') {
      let title = '';
      const rules = [];
      for (const row of body) {
        const trimmed = row.text.trim();
        if (!trimmed) continue;
        if (!trimmed.includes('|') && rules.length === 0) {
          const kv = parseKeyValueLine(trimmed);
          if (kv?.key === 'title') {
            title = kv.value;
            continue;
          }
        }
        const parts = trimmed.split('|').map((part) => part.trim());
        if (parts.length === 3 && parts[0] && parts[1]) {
          rules.push({ condition: parts[0], choice: parts[1], reason: parts[2] });
        } else if (parts.length === 2 && parts[0] && parts[1]) {
          rules.push({ condition: parts[0], choice: parts[1], reason: '' });
        } else {
          throw new Error(
            `Dòng ${row.line}: visual-decision cần "điều kiện | lựa chọn | lý do" hoặc "điều kiện | lựa chọn".`,
          );
        }
      }
      if (!rules.length) {
        throw new Error(`Dòng ${startLine}: visual-decision cần ít nhất một quy tắc.`);
      }
      return { type: 'visual_decision', title, rules };
    }
    let simulationType = '';
    let title = '';
    const params = Object.create(null);
    for (const row of body) {
      const trimmed = row.text.trim();
      if (!trimmed) continue;
      const kv = parseKeyValueLine(trimmed);
      if (!kv) {
        throw new Error(`Dòng ${row.line}: cú pháp visual-simulation không hợp lệ.`);
      }
      if (kv.key === 'type') simulationType = kv.value;
      else if (kv.key === 'title') title = kv.value;
      else {
        const numeric = kv.value !== '' ? Number(kv.value) : NaN;
        params[kv.rawKey] = Number.isFinite(numeric) ? numeric : kv.value;
      }
    }
    if (!simulationType) {
      throw new Error(`Dòng ${startLine}: visual-simulation cần thuộc tính type.`);
    }
    return { type: 'visual_simulation', simulationType, title, params };
  }
  function parse(source) {
    const lines = source.normalize('NFC').replace(/\r\n?/g, '\n').split('\n');
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
      if (marker && VISUAL_TYPES.has(marker[2].trim())) {
        flush();
        const kind = marker[2].trim();
        const start = i + 1;
        const body = [];
        while (++i < lines.length && !isFenceClose(lines[i], marker[1])) {
          body.push({ text: lines[i], line: i + 1 });
        }
        if (i === lines.length) {
          blocks.push({
            type: 'error',
            content: `Dòng ${start}: thiếu dấu đóng code block ${kind}.`,
          });
          continue;
        }
        try {
          blocks.push(parseVisualBlock(kind, body, start));
        } catch (error) {
          blocks.push({ type: 'error', content: error.message });
        }
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
