(() => {
  const DEFAULT_CONFIG = {
    QUIZ_DATA_FOLDER: "quiz-data",
    GITHUB_OWNER: "thanh-pham2k",
    GITHUB_REPO: "n5-tungkinh",
    GITHUB_BRANCH: "main",
    GITHUB_CONTENTS_PATH: "docs/quiz-data",
  };

  const REQUIRED_HEADERS = [
    "group_id",
    "group_title",
    "lesson",
    "question_no",
    "question_jp",
    "meaning_vi",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
  ];
  const PROGRESS_STORAGE_KEY = "finalReviewMcqProgress:v1";
  const PROGRESS_EXPORT_VERSION = 1;
  const REVIEW_TARGET_COUNT = 3;
  const REVIEW_STALE_DAYS = 7;

  const config = {
    ...DEFAULT_CONFIG,
    ...(window.FINAL_REVIEW_MCQ_CONFIG || {}),
  };

  const state = {
    groups: [],
    selectedParentKey: "",
    selectedGroupIndex: 0,
    selectedAnswers: new Map(),
    renderedOptions: new Map(),
    progress: new Map(),
    hotReviewGroup: null,
    hotReviewAnswers: new Map(),
  };

  const root = document.getElementById("final-review-quiz");
  const status = document.getElementById("final-review-status");
  const groupList = document.getElementById("final-review-groups");
  const content = document.getElementById("final-review-content");
  const hotReviewRoot = document.getElementById("hot-review-quiz");
  const hotReviewContent = document.getElementById("hot-review-content");
  const hotReviewDialog = document.getElementById("hot-review-dialog");
  const hotReviewInput = document.getElementById("hot-review-input");
  const hotReviewError = document.getElementById("hot-review-error");
  const hotReviewCancel = document.getElementById("hot-review-cancel");
  const hotReviewCreate = document.getElementById("hot-review-create");

  if (!root || !status || !groupList || !content) {
    return;
  }

  const assetBasePath = window.location.hostname.endsWith("github.io") ? `/${config.GITHUB_REPO}/` : "";
  const assetUrl = (path) => `${assetBasePath}${path.replace(/^\/+/, "")}`;
  const csvFileUrl = (fileName) => assetUrl(`${config.QUIZ_DATA_FOLDER}/${fileName}`);
  const imageFileUrl = (fileName) => assetUrl(`${config.QUIZ_DATA_FOLDER}/${fileName}`);

  const setStatus = (message, type = "info") => {
    status.textContent = message;
    status.dataset.type = type;
  };

  const loadProgress = () => {
    try {
      const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (!raw) {
        return new Map();
      }

      const payload = JSON.parse(raw);
      if (!Array.isArray(payload.items)) {
        return new Map();
      }

      return new Map(
        payload.items
          .filter((item) => item && typeof item.fileName === "string")
          .map((item) => [item.fileName, item])
      );
    } catch (error) {
      console.warn(error);
      return new Map();
    }
  };

  const saveProgress = () => {
    try {
      const payload = {
        version: PROGRESS_EXPORT_VERSION,
        updatedAt: new Date().toISOString(),
        items: Array.from(state.progress.values()).sort((a, b) => a.fileName.localeCompare(b.fileName, "en")),
      };
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn(error);
    }
  };

  const getDefaultProgress = (group) => ({
    fileName: group.fileName,
    groupTitle: group.groupTitle,
    lesson: group.lesson,
    parentGroup: group.parentGroup.label,
    questionCount: group.questions.length,
    selectedCount: 0,
    reviewCount: 0,
    firstReviewedAt: "",
    lastReviewedAt: "",
  });

  const getGroupProgress = (group) => ({
    ...getDefaultProgress(group),
    ...(state.progress.get(group.fileName) || {}),
    groupTitle: group.groupTitle,
    lesson: group.lesson,
    parentGroup: group.parentGroup.label,
    questionCount: group.questions.length,
  });

  const countSelectedAnswers = (group) => {
    return group.questions.filter((question) => state.selectedAnswers.has(answerKey(group, question))).length;
  };

  const getReviewStatus = (progress) => {
    if (!progress.reviewCount) {
      return { label: "Chưa ôn", tone: "new" };
    }

    if (progress.reviewCount < REVIEW_TARGET_COUNT) {
      return { label: "Nên ôn thêm", tone: "more" };
    }

    const lastReviewedAt = Date.parse(progress.lastReviewedAt || "");
    const staleMs = REVIEW_STALE_DAYS * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(lastReviewedAt) || Date.now() - lastReviewedAt > staleMs) {
      return { label: "Ôn lại", tone: "stale" };
    }

    return { label: "Ổn", tone: "ok" };
  };

  const formatShortDate = (isoString) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return "chưa có";
    }

    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    }).format(date);
  };

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return "chưa có";
    }

    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getChildOptionLabel = (group) => {
    const progress = getGroupProgress(group);
    if (!progress.reviewCount) {
      return `${group.groupTitle} - Chưa ôn`;
    }

    const statusInfo = getReviewStatus(progress);
    const statusLabel = statusInfo.tone === "ok" ? "" : ` - ${statusInfo.label}`;
    return `${group.groupTitle}${statusLabel} - ${progress.reviewCount} lần - ${formatShortDate(progress.lastReviewedAt)}`;
  };

  const recordGroupReview = (group) => {
    const existing = getGroupProgress(group);
    const now = new Date().toISOString();
    const progress = {
      ...existing,
      selectedCount: countSelectedAnswers(group),
      reviewCount: Number(existing.reviewCount || 0) + 1,
      firstReviewedAt: existing.firstReviewedAt || now,
      lastReviewedAt: now,
    };

    state.progress.set(group.fileName, progress);
    saveProgress();
    return progress;
  };

  const buildProgressExportText = () => {
    const itemsByFileName = new Map(state.progress);
    state.groups.forEach((group) => {
      itemsByFileName.set(group.fileName, getGroupProgress(group));
    });

    return JSON.stringify(
      {
        version: PROGRESS_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        items: Array.from(itemsByFileName.values()).sort((a, b) => a.fileName.localeCompare(b.fileName, "en")),
      },
      null,
      2
    );
  };

  const downloadTextFile = (fileName, text) => {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const getGithubContentsUrl = () => {
    const path = encodeURIComponent(config.GITHUB_CONTENTS_PATH).replace(/%2F/g, "/");
    const ref = encodeURIComponent(config.GITHUB_BRANCH);
    return `https://api.github.com/repos/${config.GITHUB_OWNER}/${config.GITHUB_REPO}/contents/${path}?ref=${ref}`;
  };

  const readCsvFileNamesFromGithub = async () => {
    if (!window.location.hostname.endsWith("github.io")) {
      return [];
    }

    const response = await fetch(getGithubContentsUrl(), { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Không đọc được danh sách CSV từ GitHub API (${response.status}).`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      throw new Error("GitHub API không trả về danh sách file hợp lệ.");
    }

    return payload
      .filter((item) => item.type === "file" && item.name.toLowerCase().endsWith(".csv"))
      .map((item) => item.name)
      .sort((a, b) => a.localeCompare(b, "en"));
  };

  const readCsvFileNamesFromManifest = async () => {
    const response = await fetch(assetUrl(`${config.QUIZ_DATA_FOLDER}/manifest.json`), { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Không đọc được manifest CSV (${response.status}).`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload.files)) {
      throw new Error("Manifest CSV phải có field files dạng array.");
    }

    return payload.files
      .filter((fileName) => String(fileName).toLowerCase().endsWith(".csv"))
      .sort((a, b) => a.localeCompare(b, "en"));
  };

  const readCsvFileNames = async () => {
    try {
      const githubFiles = await readCsvFileNamesFromGithub();
      if (githubFiles.length) {
        return githubFiles;
      }
    } catch (error) {
      console.warn(error);
    }

    return readCsvFileNamesFromManifest();
  };

  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const nextChar = text[index + 1];

      if (char === "\"") {
        if (inQuotes && nextChar === "\"") {
          field += "\"";
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === "," && !inQuotes) {
        row.push(field);
        field = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") {
          index += 1;
        }
        row.push(field);
        if (row.some((value) => value.trim() !== "")) {
          rows.push(row);
        }
        row = [];
        field = "";
        continue;
      }

      field += char;
    }

    row.push(field);
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }

    return rows;
  };

  const validateHeaders = (headers, fileName) => {
    const normalizedHeaders = headers.map((header) => header.trim().replace(/^\uFEFF/, ""));
    const missingHeaders = REQUIRED_HEADERS.filter((header) => !normalizedHeaders.includes(header));

    if (missingHeaders.length) {
      throw new Error(`${fileName} thiếu header: ${missingHeaders.join(", ")}`);
    }

    return normalizedHeaders;
  };

  const validateExactHeaders = (headers, fileName) => {
    const normalizedHeaders = headers.map((header) => header.trim().replace(/^\uFEFF/, ""));
    const expectedHeaders = REQUIRED_HEADERS.join(",");

    if (normalizedHeaders.join(",") !== expectedHeaders) {
      throw new Error(`${fileName} phải có header đúng: ${expectedHeaders}`);
    }

    return normalizedHeaders;
  };

  const rowsToObjects = (rows, fileName) => {
    if (!rows.length) {
      throw new Error(`${fileName} không có dữ liệu CSV.`);
    }

    const headers = validateHeaders(rows[0], fileName);
    return rows.slice(1).map((row) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = (row[index] || "").trim();
      });
      return item;
    });
  };

  const extractQuestionMedia = (text) => {
    const rawText = text || "";
    const imageMatch = rawText.match(/\s*image_url=([^\s,]+)\s*/i);
    const imageUrl = imageMatch ? imageMatch[1].replace(/\\/g, "/").replace(/^\/+/, "") : "";

    return {
      questionText: rawText.replace(/\s*image_url=([^\s,]+)\s*/i, " ").trim(),
      imageUrl,
    };
  };

  const parseHotReviewQuiz = (inputText) => {
    if (!inputText.trim()) {
      throw new Error("Vui lòng dán dữ liệu CSV.");
    }

    const rows = parseCsv(inputText);
    if (!rows.length) {
      throw new Error("CSV không có dữ liệu.");
    }

    const headers = validateExactHeaders(rows[0], "Hot Review CSV");
    const questions = rows
      .slice(1)
      .map((row) => {
        const item = {};
        headers.forEach((header, index) => {
          item[header] = (row[index] || "").trim();
        });
        return item;
      })
      .filter((row) => row.question_no)
      .map((row) => {
        const questionMedia = extractQuestionMedia(row.question_jp);

        return {
          groupId: row.group_id,
          groupTitle: row.group_title,
          lesson: row.lesson,
          questionNo: Number(row.question_no),
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
      .sort((a, b) => a.questionNo - b.questionNo);

    if (!questions.length) {
      throw new Error("CSV không có câu hỏi hợp lệ.");
    }

    return {
      fileName: "hot-review.csv",
      groupId: questions[0].groupId || "hot-review",
      groupTitle: questions[0].groupTitle || "Hot Review",
      lesson: questions[0].lesson || "",
      questions,
    };
  };

  const parseQuizGroup = (fileName, csvText) => {
    const rows = rowsToObjects(parseCsv(csvText), fileName);
    const questions = rows
      .filter((row) => row.question_no)
      .map((row) => {
        const questionMedia = extractQuestionMedia(row.question_jp);

        return {
          groupId: row.group_id,
          groupTitle: row.group_title,
          lesson: row.lesson,
          questionNo: Number(row.question_no),
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
      .sort((a, b) => a.questionNo - b.questionNo);

    if (!questions.length) {
      throw new Error(`${fileName} không có câu hỏi hợp lệ.`);
    }

    return {
      fileName,
      parentGroup: getParentGroup(fileName),
      groupId: questions[0].groupId,
      groupTitle: questions[0].groupTitle || fileName,
      lesson: questions[0].lesson || "",
      questions,
    };
  };

  const readCsvGroup = async (fileName) => {
    const response = await fetch(csvFileUrl(fileName), { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Không tải được ${fileName} (${response.status}).`);
    }

    return parseQuizGroup(fileName, await response.text());
  };

  const answerKey = (group, question) => `${group.fileName}:${question.questionNo}`;
  const OPTION_LABELS = ["A", "B", "C", "D"];

  const REVIEW_PROMPT = `Bạn là gia sư JLPT N5.

  Hãy review bài làm của tôi thật ngắn gọn bằng tiếng Việt dưới dạng table.

  Cột:
  Câu | Câu sau khi điền | Chọn/Đúng | Kết quả | Giải thích | Từ vựng/Kanji | Ngữ pháp

  Yêu cầu:

  * "Câu": ghi số thứ tự câu.
  * "Câu sau khi điền": ghi lại nguyên câu hoàn chỉnh sau khi điền đáp án đã chọn của tôi.

    * Nếu tôi chọn sai, ghi thêm câu đúng ngay bên dưới trong cùng ô, dạng:
      Tôi chọn: ...
      Câu đúng: ...
    * Nếu câu hỏi không phải dạng điền vào chỗ trống, ghi nguyên câu hỏi gốc.
  * "Chọn/Đúng": ghi đáp án tôi chọn / đáp án đúng.
  * Nếu sai, giải thích lý do sai thật ngắn.
  * Nếu có Kanji, ghi furigana: 漢字（ふりがな）.
  * Từ vựng ghi dạng: 先生（せんせい）= giáo viên.
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


  const getSelectedAnswerLabel = (group, question) => {
    const selected = state.selectedAnswers.get(answerKey(group, question));
    if (!selected) {
      return "chưa chọn";
    }

    const renderedOptions = state.renderedOptions.get(answerKey(group, question)) || question.options;
    return `${selected}. ${renderedOptions[selected] || ""}`.trim();
  };

  const getRenderedOptions = (group, question) => {
    return state.renderedOptions.get(answerKey(group, question)) || question.options;
  };

  const shuffleOptions = (question) => {
    const entries = OPTION_LABELS.map((label) => [label, question.options[label] || ""]);

    for (let index = entries.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [entries[index], entries[randomIndex]] = [entries[randomIndex], entries[index]];
    }

    return OPTION_LABELS.reduce((options, label, index) => {
      options[label] = entries[index][1];
      return options;
    }, {});
  };

  const appendJapaneseText = (element, text) => {
    const rubyPattern = /([ぁ-んァ-ヶー]*[一-龯々〆ヶ][一-龯ぁ-んァ-ヶー々〆ヶ]*?)（([ぁ-んァ-ヶー]+)）/g;
    let cursor = 0;
    let match = rubyPattern.exec(text);

    while (match) {
      if (match.index > cursor) {
        element.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      }

      const ruby = document.createElement("ruby");
      ruby.appendChild(document.createTextNode(match[1]));

      const rt = document.createElement("rt");
      rt.textContent = match[2];
      ruby.appendChild(rt);

      element.appendChild(ruby);
      cursor = rubyPattern.lastIndex;
      match = rubyPattern.exec(text);
    }

    if (cursor < text.length) {
      element.appendChild(document.createTextNode(text.slice(cursor)));
    }
  };

  const appendQuestionText = (element, text) => {
    const markerPattern = /【([^】]+)】|（\s*）|\(\s*\)|[＿_]{2,}/g;
    let cursor = 0;
    let match = markerPattern.exec(text);

    while (match) {
      if (match.index > cursor) {
        appendJapaneseText(element, text.slice(cursor, match.index));
      }

      const span = document.createElement("span");
      const isTarget = Boolean(match[1]);
      span.className = isTarget ? "quiz-target" : "quiz-blank";
      if (isTarget) {
        appendJapaneseText(span, match[1]);
      } else {
        span.textContent = match[0];
      }
      element.appendChild(span);

      cursor = markerPattern.lastIndex;
      match = markerPattern.exec(text);
    }

    if (cursor < text.length) {
      appendJapaneseText(element, text.slice(cursor));
    }
  };

  const buildReviewCopyText = (group) => {
    const lines = [
      REVIEW_PROMPT,
      "",
      `Nhóm: ${group.groupTitle}`,
      `Bài: ${group.lesson || "Không rõ"}`,
      `File CSV: ${group.fileName}`,
      "",
      "Danh sách câu hỏi + đáp án đã chọn:",
    ];

    group.questions.forEach((question, index) => {
      const renderedOptions = getRenderedOptions(group, question);
      const questionLines = [
        "",
        `Câu ${index + 1}:`,
        `Tiếng Nhật: ${question.questionJp}`,
        `Nghĩa tiếng Việt: ${question.meaningVi || ""}`,
        `A. ${renderedOptions.A || ""}`,
        `B. ${renderedOptions.B || ""}`,
        `C. ${renderedOptions.C || ""}`,
        `D. ${renderedOptions.D || ""}`,
        `Tôi chọn: ${getSelectedAnswerLabel(group, question)}`
      ];

      if (question.imageUrl) {
        questionLines.splice(3, 0, `Ảnh: ${question.imageUrl}`);
      }

      lines.push(...questionLines);
    });

    return lines.join("\n");
  };

  const copyTextToClipboard = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  };

  const getParentGroup = (fileName) => {
    const minaMatch = fileName.match(/^voc_mina_(\d+)__/);
    if (minaMatch) {
      return {
        key: `voc_mina_${minaMatch[1]}`,
        label: `Mina bài ${minaMatch[1]}`,
        type: "mina",
        order: Number(minaMatch[1]),
      };
    }

    const kanjiMatch = fileName.match(/^kanji_(\d+)__/);
    if (kanjiMatch) {
      return {
        key: `kanji_${kanjiMatch[1]}`,
        label: `Kanji bài ${kanjiMatch[1]}`,
        type: "kanji",
        order: Number(kanjiMatch[1]),
      };
    }

    const jlptVocMatch = fileName.match(/^jlpt_n5_voc_([^_]+)__/);
    if (jlptVocMatch) {
      return {
        key: `jlpt_n5_voc_${jlptVocMatch[1]}`,
        label: `JLPT N5 Voc ${jlptVocMatch[1]}`,
        type: "jlpt_voc",
        order: Number(jlptVocMatch[1]) || 0,
      };
    }

    const jlptGrammarMatch = fileName.match(/^jlpt_n5_(\d+)_grammar(?:_v2)?__/);
    if (jlptGrammarMatch) {
      return {
        key: fileName.match(/^(jlpt_n5_\d+_grammar(?:_v2)?)__/)?.[1] || `jlpt_n5_${jlptGrammarMatch[1]}_grammar`,
        label: `JLPT N5 Grammar ${jlptGrammarMatch[1]}`,
        type: "jlpt_grammar",
        order: Number(jlptGrammarMatch[1]) || 0,
      };
    }

    const jlptN5T72025Match = fileName.match(/^jlpt_n5_t7_2025__/);
    if (jlptN5T72025Match) {
      return {
        key: "jlpt_n5_t7_2025",
        label: "JLPT N5 T7/2025",
        type: "jlpt_exam",
        order: 202507,
      };
    }

    const zettaiGoukakuDe3Match = fileName.match(/^jlpt_n5_zettai_goukaku_de3__/);
    if (zettaiGoukakuDe3Match) {
      return {
        key: "jlpt_n5_zettai_goukaku_de3",
        label: "Zettai Goukaku đề 3",
        type: "jlpt_exam",
        order: 300003,
      };
    }

    const goukakuMatch = fileName.match(/^(goukaku_.+)__/);
    if (goukakuMatch) {
      const labels = {
        goukaku_jlpt_n5_grammar_trac_nghiem: "Goukaku Grammar N5",
        goukaku_jlpt_n5_trac_nghiem_tu_vung_ngu_phap: "Goukaku Từ vựng & Ngữ pháp",
        goukaku_jlpt_n5_trac_nghiem_tu_vung_ngu_phap_review: "Goukaku Review Từ vựng & Ngữ pháp",
        goukaku_tu_vung_co_ban_cach_doc_kanji: "Goukaku Từ vựng cơ bản - Cách đọc Kanji",
        goukaku_tu_vung_co_ban_kanji_ngu_phap: "Goukaku Từ vựng cơ bản - Kanji & Ngữ pháp",
      };
      const order = Object.keys(labels).indexOf(goukakuMatch[1]);

      return {
        key: goukakuMatch[1],
        label: labels[goukakuMatch[1]] || goukakuMatch[1].replace(/_/g, " "),
        type: "goukaku",
        order: order >= 0 ? order : 99,
      };
    }

    const kanaMatch = fileName.match(/^(hiragana|katakana)_trac_nghiem__/);
    if (kanaMatch) {
      const isHiragana = kanaMatch[1] === "hiragana";
      return {
        key: `${kanaMatch[1]}_trac_nghiem`,
        label: isHiragana ? "Hiragana" : "Katakana",
        type: "kana",
        order: isHiragana ? 1 : 2,
      };
    }

    return {
      key: "final_review",
      label: "Ôn tập tổng hợp",
      type: "final_review",
      order: 0,
    };
  };

  const getParentGroups = () => {
    const parents = new Map();
    state.groups.forEach((group) => {
      parents.set(group.parentGroup.key, group.parentGroup);
    });
    return Array.from(parents.values()).sort((a, b) => {
      if (a.key === "final_review") {
        return -1;
      }
      if (b.key === "final_review") {
        return 1;
      }

      const typeOrder = {
        mina: 1,
        kanji: 2,
        jlpt_voc: 3,
        jlpt_grammar: 4,
        jlpt_exam: 5,
        goukaku: 6,
        kana: 7,
      };

      if (a.type !== b.type) {
        return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
      }

      return a.order - b.order;
    });
  };

  const getGroupsInSelectedParent = () => {
    return state.groups
      .map((group, index) => ({ group, index }))
      .filter((item) => item.group.parentGroup.key === state.selectedParentKey);
  };

  const selectFirstGroupInParent = () => {
    const firstGroup = getGroupsInSelectedParent()[0];
    if (firstGroup) {
      state.selectedGroupIndex = firstGroup.index;
    }
  };

  const renderGroupButtons = () => {
    const parents = getParentGroups();
    if (!state.selectedParentKey && parents.length) {
      state.selectedParentKey = parents[0].key;
      selectFirstGroupInParent();
    }

    const parentField = document.createElement("label");
    parentField.className = "quiz-select-field";
    parentField.textContent = "Nhóm cha";

    const parentSelect = document.createElement("select");
    parentSelect.className = "quiz-select";
    parentSelect.setAttribute("aria-label", "Chọn nhóm cha ôn tập");

    parents.forEach((parent) => {
      const option = document.createElement("option");
      option.value = parent.key;
      option.textContent = parent.label;
      option.selected = parent.key === state.selectedParentKey;
      parentSelect.appendChild(option);
    });

    parentSelect.addEventListener("change", () => {
      state.selectedParentKey = parentSelect.value;
      selectFirstGroupInParent();
      renderQuiz();
    });

    parentField.appendChild(parentSelect);

    const childField = document.createElement("label");
    childField.className = "quiz-select-field";
    childField.textContent = "Nhóm bài";

    const childSelect = document.createElement("select");
    childSelect.className = "quiz-select";
    childSelect.setAttribute("aria-label", "Chọn nhóm bài ôn tập");

    getGroupsInSelectedParent().forEach(({ group, index }) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = getChildOptionLabel(group);
      option.selected = index === state.selectedGroupIndex;
      childSelect.appendChild(option);
    });

    childSelect.addEventListener("change", () => {
      state.selectedGroupIndex = Number(childSelect.value);
      renderQuiz();
    });

    childField.appendChild(childSelect);
    groupList.replaceChildren(parentField, childField);
  };

  const createOption = (group, question, optionKey, optionText) => {
    const optionId = `quiz-${group.groupId}-${question.questionNo}-${optionKey}`;
    const label = document.createElement("label");
    label.className = "quiz-option";
    label.setAttribute("for", optionId);

    const input = document.createElement("input");
    input.type = "radio";
    input.id = optionId;
    input.name = `quiz-${group.fileName}-${question.questionNo}`;
    input.value = optionKey;
    input.checked = state.selectedAnswers.get(answerKey(group, question)) === optionKey;
    input.addEventListener("change", () => {
      state.selectedAnswers.set(answerKey(group, question), optionKey);
      updateCurrentProgressSummary(group);
    });

    const key = document.createElement("span");
    key.className = "quiz-option-key";
    key.textContent = optionKey;

    const text = document.createElement("span");
    text.className = "quiz-option-text";
    appendJapaneseText(text, optionText);

    label.append(input, key, text);
    return label;
  };

  const createQuestion = (group, question, index) => {
    const article = document.createElement("article");
    article.className = "quiz-question";

    const heading = document.createElement("h3");
    heading.textContent = `Câu ${index + 1}`;

    const jp = document.createElement("p");
    jp.className = "quiz-jp";
    appendQuestionText(jp, question.questionJp);

    const mediaElements = [];
    if (question.imageUrl) {
      const image = document.createElement("img");
      image.className = "quiz-question-image";
      image.alt = `Hình minh họa câu ${index + 1}`;
      image.loading = "lazy";
      image.src = imageFileUrl(question.imageUrl);
      mediaElements.push(image);
    }

    const prompt = document.createElement("div");
    prompt.className = "quiz-question-prompt";
    prompt.appendChild(jp);

    const options = document.createElement("div");
    options.className = "quiz-options";
    const renderedOptions = shuffleOptions(question);
    state.renderedOptions.set(answerKey(group, question), renderedOptions);
    Object.entries(renderedOptions).forEach(([optionKey, optionText]) => {
      options.appendChild(createOption(group, question, optionKey, optionText));
    });

    article.append(heading, prompt, ...mediaElements);
    article.appendChild(options);
    return article;
  };

  const renderSelectedAnswers = (group) => {
    const result = document.getElementById("final-review-result");
    const title = document.createElement("h3");
    title.textContent = "Đáp án đã chọn";

    const list = document.createElement("ol");
    list.className = "quiz-result-list";

    group.questions.forEach((question, index) => {
      const item = document.createElement("li");
      const selected = state.selectedAnswers.get(answerKey(group, question));
      item.textContent = `Câu ${index + 1}: ${selected ? `đã chọn ${selected}` : "chưa chọn"}`;
      list.appendChild(item);
    });

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "quiz-copy-button";
    copyButton.textContent = "Copy prompt + bài làm";

    const copyStatus = document.createElement("p");
    copyStatus.className = "quiz-copy-status";
    copyStatus.setAttribute("aria-live", "polite");

    copyButton.addEventListener("click", async () => {
      copyButton.disabled = true;
      copyStatus.textContent = "Đang copy...";

      try {
        await copyTextToClipboard(buildReviewCopyText(group));
        copyStatus.textContent = "Đã copy prompt + câu hỏi + đáp án đã chọn.";
      } catch (error) {
        console.error(error);
        copyStatus.textContent = "Không copy được. Hãy thử lại trên trình duyệt.";
      } finally {
        copyButton.disabled = false;
      }
    });

    result.replaceChildren(title, list, copyButton, copyStatus);
    result.hidden = false;
  };

  const createProgressSummary = (group) => {
    const progress = getGroupProgress(group);
    const statusInfo = getReviewStatus(progress);
    const summary = document.createElement("div");
    summary.className = "quiz-progress-summary";

    const badge = document.createElement("span");
    badge.className = "quiz-progress-badge";
    badge.dataset.tone = statusInfo.tone;
    badge.textContent = statusInfo.label;

    const count = document.createElement("span");
    count.textContent = `Đã ôn ${progress.reviewCount || 0} lần`;

    const latest = document.createElement("span");
    latest.textContent = `Gần nhất: ${formatDateTime(progress.lastReviewedAt)}`;

    const selected = document.createElement("span");
    selected.textContent = `Đã chọn: ${countSelectedAnswers(group)}/${group.questions.length}`;

    summary.append(badge, count, latest, selected);
    return summary;
  };

  const updateCurrentProgressSummary = (group) => {
    const header = document.querySelector(".quiz-header");
    if (!header) {
      return;
    }

    const summary = createProgressSummary(group);
    const currentSummary = header.querySelector(".quiz-progress-summary");
    if (currentSummary) {
      currentSummary.replaceWith(summary);
    } else {
      header.appendChild(summary);
    }
  };

  const createExportProgressButton = () => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-export-button";
    button.textContent = "Export thống kê";
    button.addEventListener("click", () => {
      downloadTextFile("final-review-progress.json", buildProgressExportText());
    });
    return button;
  };

  const renderQuiz = () => {
    const group = state.groups[state.selectedGroupIndex];
    renderGroupButtons();
    content.replaceChildren();

    if (!group) {
      return;
    }

    const header = document.createElement("div");
    header.className = "quiz-header";

    const title = document.createElement("h3");
    title.textContent = group.groupTitle;

    const meta = document.createElement("p");
    meta.className = "quiz-meta";
    meta.textContent = `${group.lesson} - ${group.questions.length} câu`;

    header.append(title, meta, createProgressSummary(group));

    const questions = document.createElement("div");
    questions.className = "quiz-questions";
    group.questions.forEach((question, index) => {
      questions.appendChild(createQuestion(group, question, index));
    });

    const actions = document.createElement("div");
    actions.className = "quiz-actions";

    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "primary";
    submit.textContent = "Xác nhận";
    submit.addEventListener("click", () => {
      recordGroupReview(group);
      renderGroupButtons();
      updateCurrentProgressSummary(group);
      renderSelectedAnswers(group);
    });

    const result = document.createElement("div");
    result.id = "final-review-result";
    result.className = "quiz-result";
    result.hidden = true;

    actions.append(submit, createExportProgressButton());
    content.append(header, questions, actions, result);
  };

  const hotAnswerKey = (question) => `hot-review:${question.questionNo}`;

  const openHotReviewDialog = () => {
    if (!hotReviewDialog || !hotReviewInput || !hotReviewError) {
      return;
    }

    hotReviewError.textContent = "";
    if (typeof hotReviewDialog.showModal === "function") {
      hotReviewDialog.showModal();
    } else {
      hotReviewDialog.setAttribute("open", "");
    }
    hotReviewInput.focus();
  };

  const closeHotReviewDialog = () => {
    if (!hotReviewDialog) {
      return;
    }

    if (typeof hotReviewDialog.close === "function") {
      hotReviewDialog.close();
    } else {
      hotReviewDialog.removeAttribute("open");
    }
  };

  const renderHotReviewEmpty = () => {
    if (!hotReviewContent) {
      return;
    }

    const empty = document.createElement("div");
    empty.className = "hot-review-empty";

    const title = document.createElement("h3");
    title.textContent = "Hot Review";

    const description = document.createElement("p");
    description.textContent = "Dán dữ liệu CSV để tạo bài trắc nghiệm nhanh.";

    const inputButton = document.createElement("button");
    inputButton.type = "button";
    inputButton.className = "primary";
    inputButton.textContent = "Nhập dữ liệu";
    inputButton.addEventListener("click", openHotReviewDialog);

    empty.append(title, description, inputButton);
    hotReviewContent.replaceChildren(empty);
  };

  const createHotReviewOption = (question, optionKey, optionText) => {
    const optionId = `hot-review-${question.questionNo}-${optionKey}`;
    const label = document.createElement("label");
    label.className = "quiz-option";
    label.setAttribute("for", optionId);

    const input = document.createElement("input");
    input.type = "radio";
    input.id = optionId;
    input.name = `hot-review-${question.questionNo}`;
    input.value = optionKey;
    input.checked = state.hotReviewAnswers.get(hotAnswerKey(question)) === optionKey;
    input.addEventListener("change", () => {
      state.hotReviewAnswers.set(hotAnswerKey(question), optionKey);
    });

    const key = document.createElement("span");
    key.className = "quiz-option-key";
    key.textContent = optionKey;

    const text = document.createElement("span");
    text.className = "quiz-option-text";
    text.textContent = optionText;

    label.append(input, key, text);
    return label;
  };

  const createHotReviewQuestion = (question) => {
    const article = document.createElement("article");
    article.className = "quiz-question";

    const heading = document.createElement("h3");
    heading.textContent = `Câu ${question.questionNo}`;

    const jp = document.createElement("p");
    jp.className = "quiz-jp";
    appendQuestionText(jp, question.questionJp);

    const prompt = document.createElement("div");
    prompt.className = "quiz-question-prompt";
    prompt.appendChild(jp);

    const options = document.createElement("div");
    options.className = "quiz-options";
    state.renderedOptions.set(hotAnswerKey(question), question.options);
    OPTION_LABELS.forEach((optionKey) => {
      options.appendChild(createHotReviewOption(question, optionKey, question.options[optionKey] || ""));
    });

    article.append(heading, prompt);
    article.appendChild(options);
    return article;
  };

  const getHotSelectedAnswerLabel = (question) => {
    const selected = state.hotReviewAnswers.get(hotAnswerKey(question));
    if (!selected) {
      return "chưa chọn";
    }

    return `${selected}. ${question.options[selected] || ""}`.trim();
  };

  const buildHotReviewCopyText = (group) => {
    const lines = [
      REVIEW_PROMPT,
      "",
      `Nhóm: ${group.groupTitle}`,
      `Bài: ${group.lesson || "Không rõ"}`,
      "",
      "Danh sách câu hỏi + đáp án đã chọn:",
    ];

    group.questions.forEach((question) => {
      lines.push(
        "",
        `Câu ${question.questionNo}:`,
        `Tiếng Nhật: ${question.questionJp}`,
        `Nghĩa tiếng Việt: ${question.meaningVi || ""}`,
        `A. ${question.options.A || ""}`,
        `B. ${question.options.B || ""}`,
        `C. ${question.options.C || ""}`,
        `D. ${question.options.D || ""}`,
        `Tôi chọn: ${getHotSelectedAnswerLabel(question)}`
      );
    });

    return lines.join("\n");
  };

  const renderHotReviewSelectedAnswers = (group) => {
    const result = document.getElementById("hot-review-result");
    if (!result) {
      return;
    }

    const title = document.createElement("h3");
    title.textContent = "Đáp án đã chọn";

    const list = document.createElement("ol");
    list.className = "quiz-result-list";

    group.questions.forEach((question) => {
      const item = document.createElement("li");
      const selected = state.hotReviewAnswers.get(hotAnswerKey(question));
      item.textContent = `Câu ${question.questionNo}: ${selected ? `đã chọn ${selected}` : "chưa chọn"}`;
      list.appendChild(item);
    });

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "quiz-copy-button";
    copyButton.textContent = "Copy prompt + bài làm";

    const copyStatus = document.createElement("p");
    copyStatus.className = "quiz-copy-status";
    copyStatus.setAttribute("aria-live", "polite");

    copyButton.addEventListener("click", async () => {
      copyButton.disabled = true;
      copyStatus.textContent = "Đang copy...";

      try {
        await copyTextToClipboard(buildHotReviewCopyText(group));
        copyStatus.textContent = "Đã copy prompt + câu hỏi + đáp án đã chọn.";
      } catch (error) {
        console.error(error);
        copyStatus.textContent = "Không copy được. Hãy thử lại trên trình duyệt.";
      } finally {
        copyButton.disabled = false;
      }
    });

    result.replaceChildren(title, list, copyButton, copyStatus);
    result.hidden = false;
  };

  const renderHotReviewQuiz = () => {
    const group = state.hotReviewGroup;
    if (!hotReviewContent || !group) {
      return;
    }

    const inputAgain = document.createElement("button");
    inputAgain.type = "button";
    inputAgain.className = "primary";
    inputAgain.textContent = "Nhập lại dữ liệu";
    inputAgain.addEventListener("click", openHotReviewDialog);

    const header = document.createElement("div");
    header.className = "quiz-header";

    const title = document.createElement("h3");
    title.textContent = group.groupTitle;

    const meta = document.createElement("p");
    meta.className = "quiz-meta";
    meta.textContent = `${group.lesson || "Không rõ"} - ${group.questions.length} câu`;

    header.append(title, meta);

    const questions = document.createElement("div");
    questions.className = "quiz-questions";
    group.questions.forEach((question) => {
      questions.appendChild(createHotReviewQuestion(question));
    });

    const actions = document.createElement("div");
    actions.className = "quiz-actions";

    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "primary";
    submit.textContent = "Xác nhận";
    submit.addEventListener("click", () => {
      renderHotReviewSelectedAnswers(group);
    });

    const result = document.createElement("div");
    result.id = "hot-review-result";
    result.className = "quiz-result";
    result.hidden = true;

    actions.append(submit);
    hotReviewContent.replaceChildren(inputAgain, header, questions, actions, result);
  };

  const createHotReviewFromInput = () => {
    if (!hotReviewInput || !hotReviewError) {
      return;
    }

    try {
      const group = parseHotReviewQuiz(hotReviewInput.value);
      state.hotReviewGroup = group;
      state.hotReviewAnswers = new Map();
      state.renderedOptions = new Map(
        Array.from(state.renderedOptions.entries()).filter(([key]) => !key.startsWith("hot-review:"))
      );
      closeHotReviewDialog();
      renderHotReviewQuiz();
    } catch (error) {
      hotReviewError.textContent = error.message || "Không đọc được CSV.";
    }
  };

  const initHotReview = () => {
    if (!hotReviewRoot || !hotReviewContent) {
      return;
    }

    renderHotReviewEmpty();

    hotReviewCancel?.addEventListener("click", () => {
      closeHotReviewDialog();
    });
    hotReviewCreate?.addEventListener("click", createHotReviewFromInput);
  };

  const init = async () => {
    setStatus("Đang tải dữ liệu trắc nghiệm...");

    try {
      const fileNames = await readCsvFileNames();
      if (!fileNames.length) {
        throw new Error(`Không tìm thấy file CSV trong ${config.QUIZ_DATA_FOLDER}.`);
      }

      state.groups = await Promise.all(fileNames.map(readCsvGroup));
      state.progress = loadProgress();
      state.selectedParentKey = state.groups[0]?.parentGroup.key || "";
      selectFirstGroupInParent();
      renderQuiz();
      setStatus(`Đã tải ${state.groups.length} nhóm bài.`, "success");
    } catch (error) {
      console.error(error);
      groupList.replaceChildren();
      content.replaceChildren();
      setStatus(error.message || "Không tải được dữ liệu trắc nghiệm.", "error");
    }
  };

  window.FinalReviewMcq = {
    config,
    REQUIRED_HEADERS,
    reload: init,
  };

  init();
  initHotReview();
})();
