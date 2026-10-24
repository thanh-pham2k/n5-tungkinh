export const MULTIPLE_CHOICE_HEADER =
  'question|option_1|option_2|option_3|option_4|correct_answer|explanation|context|example|example_meaning';
export const CHOICE_NUMBERS = Object.freeze(['1', '2', '3', '4']);
const REQUIRED_HEADERS = [
  'question',
  ...CHOICE_NUMBERS.map((n) => `option_${n}`),
  'correct_answer',
];
const ALLOWED_HEADERS = MULTIPLE_CHOICE_HEADER.split('|');

// Keep physical source line numbers, including quoted multiline fields, for import errors.
function readRows(input) {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rows = [];
  let row = [],
    field = '',
    quoted = false,
    closed = false,
    line = 1,
    start = 1;
  const fail = () => {
    throw new Error(`Dòng ${line}: dấu nháy không hợp lệ. Dùng "" để ghi dấu nháy trong ô.`);
  };
  const pushField = () => {
    row.push(field.trim());
    field = '';
    closed = false;
  };
  const pushRow = () => {
    pushField();
    if (row.some(Boolean)) rows.push({ values: row, line: start });
    row = [];
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        field += char;
        if (char === '\n') line++;
      }
    } else if (char === '|') pushField();
    else if (char === '\n') {
      pushRow();
      line++;
      start = line;
    } else if (char === '"') {
      if (closed || field.trim()) fail();
      field = '';
      quoted = true;
    } else {
      if (closed && char.trim()) fail();
      if (!closed) field += char;
    }
  }
  if (quoted) throw new Error(`Dòng ${start}: ô có dấu nháy chưa đóng.`);
  pushRow();
  return rows;
}

export function parseMultipleChoice(text) {
  const rows = readRows(text);
  if (!rows.length) throw new Error('Vui lòng nhập dữ liệu Multiple Choice.');
  const headers = rows[0].values;
  if (new Set(headers).size !== headers.length)
    throw new Error(`Dòng ${rows[0].line}: header bị trùng.`);
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length)
    throw new Error(
      `Dòng ${rows[0].line}: thiếu header ${missing.join(', ')}. Dùng dấu | để phân cách.`,
    );
  const unknown = headers.filter((header) => !ALLOWED_HEADERS.includes(header));
  if (unknown.length)
    throw new Error(
      `Dòng ${rows[0].line}: header không hỗ trợ: ${unknown.join(', ')}. Dùng context, không dùng [context].`,
    );
  const occurrences = new Map();
  const questions = rows.slice(1).map(({ values, line }, index) => {
    if (values.length !== headers.length)
      throw new Error(
        `Dòng ${line}: cần ${headers.length} cột, nhận ${values.length}. Bọc ô chứa | hoặc xuống dòng bằng dấu nháy kép.`,
      );
    const item = Object.fromEntries(headers.map((header, i) => [header, values[i]]));
    for (const header of REQUIRED_HEADERS) {
      if (!item[header]) throw new Error(`Dòng ${line}: ${header} không được để trống.`);
    }
    if (!CHOICE_NUMBERS.includes(item.correct_answer))
      throw new Error(`Dòng ${line}: correct_answer phải là 1, 2, 3 hoặc 4.`);
    const options = CHOICE_NUMBERS.map((n) => item[`option_${n}`]);
    const identity = JSON.stringify([
      item.question,
      options,
      item.correct_answer,
      item.context || '',
    ]);
    const occurrence = occurrences.get(identity) || 0;
    occurrences.set(identity, occurrence + 1);
    return {
      id: `multiple-choice:${identity}:${occurrence}`,
      number: index + 1,
      question: item.question,
      options,
      correctAnswer: item.correct_answer,
      explanation: item.explanation || '',
      context: item.context || '',
      example: item.example || '',
      exampleMeaning: item.example_meaning || '',
    };
  });
  if (!questions.length) throw new Error('Chưa có câu hỏi sau dòng header.');
  return questions;
}
