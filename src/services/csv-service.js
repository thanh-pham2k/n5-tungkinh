// Existing CSV contracts retained during the Next.js migration.
const getSelectedSpeechText = (item) => item.hiragana || item.vocabulary;
const parseInstantVocabCsvRows = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  if (inQuotes) {
    throw new Error('CSV has an unclosed quoted field.');
  }

  return rows.filter((candidate) => candidate.some((value) => value.trim()));
};

const parseInstantVocabCsv = (text) => {
  const rows = parseInstantVocabCsvRows(text.trim());
  const expectedHeader = ['vocabulary', 'hiragana', 'meaning_vi', 'example_ja', 'example_vi'];

  if (!rows.length) {
    throw new Error('CSV is empty.');
  }

  rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  const header = rows[0].map((value) => value.trim());
  const matchesBaseHeader = expectedHeader.every((value, index) => header[index] === value);
  if (!matchesBaseHeader) {
    throw new Error(`CSV header must start with: ${expectedHeader.join(',')}`);
  }

  return rows.slice(1).map((row, index) => {
    if (row.length < expectedHeader.length) {
      throw new Error(`Line ${index + 2} must have at least ${expectedHeader.length} columns.`);
    }

    const [vocabulary, hiragana, meaningVi, exampleJa, exampleVi] = row.map((value) =>
      value.trim(),
    );
    return {
      vocabulary,
      hiragana,
      meaningVi,
      exampleJa,
      exampleVi,
      jaAudioUrl: '',
      enAudioUrl: '',
      vietnameseAudioUrl: '',
      status: getSelectedSpeechText({ vocabulary, hiragana }) ? 'idle' : 'error',
      statusText: getSelectedSpeechText({ vocabulary, hiragana })
        ? 'Ready.'
        : 'Missing text to read.',
    };
  });
};

const vocabReviewRequiredHeaders = [
  'vocabulary',
  'hiragana',
  'meaning_vi',
  'example_ja',
  'example_vi',
];

const parseVocabReviewCsv = (text) => {
  const rows = parseInstantVocabCsvRows(text.trim());
  if (!rows.length) {
    throw new Error('File cần có header: vocabulary,hiragana,meaning_vi,example_ja,example_vi');
  }

  rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  const headers = rows[0].map((value) => value.trim());
  const missingHeaders = vocabReviewRequiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error('File cần có header: vocabulary,hiragana,meaning_vi,example_ja,example_vi');
  }

  const headerIndexes = new Map(headers.map((header, index) => [header, index]));
  const lastRequiredColumnIndex = Math.max(
    ...vocabReviewRequiredHeaders.map((header) => headerIndexes.get(header)),
  );
  return rows
    .slice(1)
    .map((row, index) => {
      const card = {};
      vocabReviewRequiredHeaders.forEach((header) => {
        const columnIndex = headerIndexes.get(header);
        card[header] = columnIndex < row.length ? row[columnIndex].trim() : '';
      });

      if (
        !card.vocabulary &&
        !card.hiragana &&
        !card.meaning_vi &&
        !card.example_ja &&
        !card.example_vi
      ) {
        return null;
      }

      if (row.length <= lastRequiredColumnIndex) {
        throw new Error(`Dòng ${index + 2} thiếu cột dữ liệu.`);
      }

      return card;
    })
    .filter(Boolean);
};

const shuffleVocabReviewCards = (cards) => {
  const queue = [...cards];
  for (let index = queue.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
  }
  return queue;
};

const parseWritingReviewCsv = (text) => {
  const rows = parseInstantVocabCsvRows(text.trim());
  const expectedHeader = ['context', 'prompt', 'input', 'sample_answer'];

  if (!rows.length) {
    throw new Error('CSV is empty.');
  }

  rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  const header = rows[0].map((value) => value.trim());
  const isValid = expectedHeader.every((col, index) => header[index] === col);
  if (!isValid || header.length < expectedHeader.length) {
    throw new Error('File can co header: context,prompt,input,sample_answer');
  }

  const requiredHeaderMap = new Map(header.map((col, index) => [col, index]));
  return rows
    .slice(1)
    .map((row, index) => {
      const item = {};
      expectedHeader.forEach((col) => {
        const columnIndex = requiredHeaderMap.get(col);
        item[col] = columnIndex < row.length ? row[columnIndex].trim() : '';
      });

      if (!item.context && !item.prompt && !item.input && !item.sample_answer) {
        return null;
      }

      return item;
    })
    .filter(Boolean);
};

const parseWordOrderCsv = (text) => {
  const rows = parseInstantVocabCsvRows(text.trim());
  if (!rows.length) {
    throw new Error('CSV rỗng.');
  }

  rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  const headers = rows[0].map((value) => value.trim());
  const headerMap = new Map(headers.map((h, i) => [h.toLowerCase(), i]));

  const hasSource =
    headerMap.has('word_order') || headerMap.has('example_ja') || headerMap.has('vocabulary');
  if (!hasSource) {
    throw new Error('CSV cần có ít nhất một trong các cột: word_order, example_ja, vocabulary');
  }

  const items = rows
    .slice(1)
    .map((row, index) => {
      let vocabulary = '';
      let hiragana = '';
      let meaningVi = '';
      let exampleJa = '';
      let exampleVi = '';
      let wordOrderRaw = '';

      if (row.length === headerMap.size) {
        const getVal = (col) => {
          const idx = headerMap.get(col);
          return idx !== undefined && idx < row.length ? row[idx].trim() : '';
        };
        vocabulary = getVal('vocabulary');
        hiragana = getVal('hiragana');
        meaningVi = getVal('meaning_vi');
        exampleJa = getVal('example_ja');
        exampleVi = getVal('example_vi');
        wordOrderRaw = getVal('word_order');
      } else {
        let pipeIdx = -1;
        for (let i = 0; i < row.length; i++) {
          if (row[i].includes('|')) {
            pipeIdx = i;
            break;
          }
        }

        let remainingCols = row;
        if (pipeIdx !== -1) {
          wordOrderRaw = row.slice(pipeIdx).join(',').trim();
          remainingCols = row.slice(0, pipeIdx);
        } else {
          wordOrderRaw = row[row.length - 1].trim();
          remainingCols = row.slice(0, row.length - 1);
        }

        exampleVi = remainingCols.length > 0 ? remainingCols[remainingCols.length - 1].trim() : '';
        const emptyIdx = remainingCols.findIndex((val, i) => i > 0 && val === '');
        if (emptyIdx !== -1) {
          vocabulary = remainingCols.slice(0, emptyIdx).join(',').trim();
          hiragana = remainingCols[emptyIdx].trim();
          const afterEmpty = remainingCols.slice(emptyIdx + 1);
          meaningVi = afterEmpty[0]?.trim() || '';
          exampleJa = afterEmpty
            .slice(1, afterEmpty.length - 1)
            .join(',')
            .trim();
        } else {
          vocabulary = remainingCols[0]?.trim() || '';
          hiragana = remainingCols[1]?.trim() || '';
          meaningVi = remainingCols[2]?.trim() || '';
          exampleJa = remainingCols
            .slice(3, remainingCols.length - 1)
            .join(',')
            .trim();
        }
      }

      if (!vocabulary && !hiragana && !meaningVi && !exampleJa && !exampleVi && !wordOrderRaw) {
        return null;
      }

      let tokens = [];
      if (wordOrderRaw) {
        if (wordOrderRaw.includes('|')) {
          tokens = wordOrderRaw
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (wordOrderRaw.includes('/')) {
          tokens = wordOrderRaw
            .split('/')
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          tokens = [wordOrderRaw.trim()];
        }
      } else if (exampleJa) {
        const cleanedJa = exampleJa.replace(/（[^）]+）/g, '');
        if (cleanedJa.includes('|')) {
          tokens = cleanedJa
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (cleanedJa.includes('/')) {
          tokens = cleanedJa
            .split('/')
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (cleanedJa.includes(' ')) {
          tokens = cleanedJa
            .split(/\s+/)
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          const matches = cleanedJa.match(
            /[\u4e00-\u9faf]+|[ぁ-ん]+|[ァ-ヶ]+|[a-zA-Z0-9]+|[^\s\u4e00-\u9fafぁ-んァ-ヶa-zA-Z0-9]+/g,
          );
          tokens = matches && matches.length > 1 ? matches : [cleanedJa];
        }
      } else if (vocabulary) {
        tokens = [vocabulary];
      }

      if (!tokens.length) {
        return null;
      }

      const targetSentence =
        exampleJa ||
        (tokens.every((t) => /^[a-zA-Z0-9\s,.'?!]+$/.test(t)) ? tokens.join(' ') : tokens.join(''));
      const prompt = exampleVi || meaningVi || 'Sắp xếp các khối/từ thành câu đúng';

      return {
        vocabulary,
        hiragana,
        meaningVi,
        exampleJa,
        exampleVi,
        wordOrderRaw,
        tokens,
        targetSentence,
        prompt,
      };
    })
    .filter(Boolean);

  return items;
};

const shuffleTokensGuaranteed = (tokens) => {
  if (!tokens || tokens.length <= 1) return [...tokens];
  let shuffled = shuffleVocabReviewCards([...tokens]);
  const isSameOrder = (arr1, arr2) => arr1.every((t, i) => t.id === arr2[i].id);
  let attempts = 0;
  while (isSameOrder(shuffled, tokens) && attempts < 10) {
    shuffled = shuffleVocabReviewCards([...tokens]);
    attempts += 1;
  }
  if (isSameOrder(shuffled, tokens) && shuffled.length >= 2) {
    [shuffled[0], shuffled[shuffled.length - 1]] = [shuffled[shuffled.length - 1], shuffled[0]];
  }
  return shuffled;
};
export {
  parseInstantVocabCsvRows,
  parseInstantVocabCsv,
  parseVocabReviewCsv,
  parseWritingReviewCsv,
  parseWordOrderCsv,
  shuffleVocabReviewCards,
  shuffleTokensGuaranteed,
};
