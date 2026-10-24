const REQUIRED_HEADERS = [
  'group_id',
  'group_title',
  'lesson',
  'question_no',
  'question_jp',
  'meaning_vi',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
];
const ANSWER_REQUIRED_HEADERS = ['correct_answer'];
const ANSWER_OPTIONAL_HEADERS = [
  'id',
  'selected_answer',
  'answer_detail_vi',
  'option_a_vi',
  'option_b_vi',
  'option_c_vi',
  'option_d_vi',
  'vocab_kanji',
  'grammar',
  'show_answer',
];
const parseCsv = (text) => {
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
      if (row.some((value) => value.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim() !== '')) {
    rows.push(row);
  }

  return rows;
};

const validateExactHeaders = (headers, fileName) => {
  const normalizedHeaders = headers.map((header) => header.trim().replace(/^\uFEFF/, ''));
  const expectedHeaders = REQUIRED_HEADERS.join(',');

  if (normalizedHeaders.join(',') !== expectedHeaders) {
    throw new Error(`${fileName} phải có header đúng: ${expectedHeaders}`);
  }

  return normalizedHeaders;
};

const extractQuestionMedia = (text) => {
  const rawText = text || '';
  const imageMatch = rawText.match(/\s*image_url=([^\s,]+)\s*/i);
  const imageUrl = imageMatch ? imageMatch[1].replace(/\\/g, '/').replace(/^\/+/, '') : '';

  return {
    questionText: rawText.replace(/\s*image_url=([^\s,]+)\s*/i, ' ').trim(),
    imageUrl,
  };
};

const buildQuestionId = (row) =>
  [row.group_id || 'hot-review', row.lesson || '', row.question_no || ''].join(':');

const normalizeQuestionNo = (value) => String(value || '').trim();

const compareQuestionNo = (a, b) => {
  return a.questionNo.localeCompare(b.questionNo, 'en', {
    numeric: true,
    sensitivity: 'base',
  });
};

const withDisplayOrder = (questions) =>
  questions.map((question, index) => ({
    ...question,
    orderIndex: index,
    orderKey: `order-${index}`,
  }));

const parseHotReviewQuiz = (inputText) => {
  if (!inputText.trim()) {
    throw new Error('Vui lòng dán dữ liệu CSV.');
  }

  const rows = parseCsv(inputText);
  if (!rows.length) {
    throw new Error('CSV không có dữ liệu.');
  }

  const headers = validateExactHeaders(rows[0], 'Hot Review CSV');
  const questions = withDisplayOrder(
    rows
      .slice(1)
      .map((row) => {
        const item = {};
        headers.forEach((header, index) => {
          item[header] = (row[index] || '').trim();
        });
        return item;
      })
      .filter((row) => row.question_no)
      .map((row) => {
        const questionMedia = extractQuestionMedia(row.question_jp);

        return {
          questionId: buildQuestionId(row),
          groupId: row.group_id,
          groupTitle: row.group_title,
          lesson: row.lesson,
          questionNo: normalizeQuestionNo(row.question_no),
          questionJp: questionMedia.questionText,
          imageUrl: questionMedia.imageUrl,
          meaningVi: row.meaning_vi,
          options: {
            A: row.option_a,
            B: row.option_b,
            C: row.option_c,
            D: row.option_d,
          },
        };
      })
      .sort(compareQuestionNo),
  );

  if (!questions.length) {
    throw new Error('CSV không có câu hỏi hợp lệ.');
  }

  return {
    fileName: 'hot-review.csv',
    groupId: questions[0].groupId || 'hot-review',
    groupTitle: questions[0].groupTitle || 'Hot Review',
    lesson: questions[0].lesson || '',
    questions,
  };
};

const normalizeAnswerLetter = (value) => (value || '').trim().toUpperCase();

const parseShowAnswer = (value) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return null;
};

const normalizeAnswerRow = (row) => {
  const correctAnswer = normalizeAnswerLetter(row.correct_answer);

  if (!correctAnswer) {
    return null;
  }

  return {
    selectedAnswer: normalizeAnswerLetter(row.selected_answer),
    correctAnswer,
    answerDetailVi: (row.answer_detail_vi || '').trim(),
    optionAVi: (row.option_a_vi || '').trim(),
    optionBVi: (row.option_b_vi || '').trim(),
    optionCVi: (row.option_c_vi || '').trim(),
    optionDVi: (row.option_d_vi || '').trim(),
    vocabKanji: (row.vocab_kanji || '').trim(),
    grammar: (row.grammar || '').trim(),
    showAnswer: parseShowAnswer(row.show_answer),
  };
};

const parseAnswerCsv = (csvText) => {
  if (!csvText.trim()) {
    throw new Error('Vui long dan du lieu answer CSV.');
  }

  const rows = parseCsv(csvText);
  if (!rows.length) {
    throw new Error('Answer CSV khong co du lieu.');
  }

  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ''));
  const missingHeaders = ANSWER_REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error(`Answer CSV thieu header: ${missingHeaders.join(', ')}`);
  }

  const allowedHeaders = new Set([...ANSWER_REQUIRED_HEADERS, ...ANSWER_OPTIONAL_HEADERS]);
  const knownHeaders = headers.filter((header) => allowedHeaders.has(header));
  const answers = [];

  rows.slice(1).forEach((row) => {
    const item = {};
    knownHeaders.forEach((header) => {
      const index = headers.indexOf(header);
      item[header] = (row[index] || '').trim();
    });

    const answer = normalizeAnswerRow(item);
    if (!answer) {
      return;
    }

    answers.push(answer);
  });

  if (!answers.length) {
    throw new Error('Answer CSV khong co dong hop le.');
  }

  return answers;
};

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const REVIEW_PROMPT = `Bạn là gia sư JLPT N5.

  Hãy review bài làm của tôi thật ngắn gọn bằng tiếng Việt dưới dạng table.
  
  Cột:
  Câu | Câu sau khi điền | Chọn/Đúng | Từ vựng/Kanji | Ngữ pháp
  
  Yêu cầu:
  
  * "Câu": ghi số thứ tự câu.
  
  * "Câu sau khi điền": ghi 3 dòng:
  
    * Câu đầy đủ sau khi điền đáp án tôi chọn, không ghi furigana trong phần này.
    * Romaji.
    * Dịch nghĩa tiếng Việt.
  
    Nếu tôi chọn sai, ghi thêm câu đúng ngay bên dưới trong cùng ô, dạng:
    Tôi chọn:
    ...
    Romaji:
    ...
    Nghĩa:
    ...
  
    Câu đúng:
    ...
    Romaji:
    ...
    Nghĩa:
    ...
  
    Nếu câu hỏi không phải dạng điền vào chỗ trống, ghi nguyên câu hỏi gốc + romaji + nghĩa.
  
  * "Chọn/Đúng": ghi:
    * Đáp án tôi chọn / đáp án đúng.
    * Dịch nghĩa tiếng Việt của đáp án tôi chọn.
    * Dịch nghĩa tiếng Việt của đáp án đúng.
    * Dịch nghĩa tiếng Việt của tất cả option còn lại.
  
    Format:
    Chọn: A. ... = nghĩa tiếng Việt
    Đúng: B. ... = nghĩa tiếng Việt
    Các option khác:
    C. ... = nghĩa tiếng Việt
    D. ... = nghĩa tiếng Việt
  
    Nếu đáp án tôi chọn trùng đáp án đúng, vẫn ghi:
    Chọn/Đúng: A. ... = nghĩa tiếng Việt
    Các option khác:
    B. ... = nghĩa tiếng Việt
    C. ... = nghĩa tiếng Việt
    D. ... = nghĩa tiếng Việt
  
  * Nếu có Kanji, ghi furigana: 漢字（ふりがな）.
  
  * Từ vựng ghi dạng:
    先生（せんせい）= giáo viên.
  
  * Ngữ pháp/trợ từ ghi điểm cần nhớ ngắn gọn.
  
  * Nếu không có nội dung quan trọng, ghi “-”.
  
  Cuối bài bắt buộc có:
  
  1. Tổng kết:
  
  * Đúng: x/y
  * Sai: x/y
  
  2. Cần ôn:
  
  * Từ vựng:
  * Kanji:
  * Ngữ pháp/trợ từ:
  
  3. Hán tự N5 cần nhớ:
  
  * Chỉ liệt kê Kanji JLPT N5 xuất hiện hoặc liên quan trực tiếp trong bài.
  * Ghi dạng:
    Kanji（ふりがな）= nghĩa → mẹo nhớ bằng hình ảnh thật ngắn.
  * Ví dụ:
    本（ほん）= sách → 木 là cây, thêm gạch ở gốc = “gốc của sách”.
    山（やま）= núi → giống 3 đỉnh núi.
    川（かわ）= sông → giống 3 dòng nước chảy.
  * Không giải thích Kanji ngoài JLPT N5.
  * Nếu không có Kanji N5 quan trọng, ghi “-”.
  
  Dữ liệu bài làm:
  [Paste danh sách câu hỏi + đáp án đã chọn vào đây]`;

export { REQUIRED_HEADERS, OPTION_LABELS, REVIEW_PROMPT, parseHotReviewQuiz, parseAnswerCsv };
