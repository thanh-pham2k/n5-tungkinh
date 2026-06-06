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
    "romaji",
    "meaning_vi",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
  ];

  const config = {
    ...DEFAULT_CONFIG,
    ...(window.FINAL_REVIEW_MCQ_CONFIG || {}),
  };

  const state = {
    groups: [],
    selectedParentKey: "",
    selectedGroupIndex: 0,
    selectedAnswers: new Map(),
  };

  const root = document.getElementById("final-review-quiz");
  const status = document.getElementById("final-review-status");
  const groupList = document.getElementById("final-review-groups");
  const content = document.getElementById("final-review-content");

  if (!root || !status || !groupList || !content) {
    return;
  }

  const assetBasePath = window.location.hostname.endsWith("github.io") ? `/${config.GITHUB_REPO}/` : "";
  const assetUrl = (path) => `${assetBasePath}${path.replace(/^\/+/, "")}`;
  const csvFileUrl = (fileName) => assetUrl(`${config.QUIZ_DATA_FOLDER}/${fileName}`);

  const setStatus = (message, type = "info") => {
    status.textContent = message;
    status.dataset.type = type;
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

  const parseQuizGroup = (fileName, csvText) => {
    const rows = rowsToObjects(parseCsv(csvText), fileName);
    const questions = rows
      .filter((row) => row.question_no)
      .map((row) => ({
        groupId: row.group_id,
        groupTitle: row.group_title,
        lesson: row.lesson,
        questionNo: Number(row.question_no),
        questionJp: row.question_jp,
        romaji: row.romaji,
        meaningVi: row.meaning_vi,
        options: {
          A: row.option_a,
          B: row.option_b,
          C: row.option_c,
          D: row.option_d,
        },
      }))
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

  const REVIEW_PROMPT = `Bạn là gia sư JLPT N5.

Hãy review bài làm của tôi cực kỳ ngắn gọn dưới dạng table.

Cột gồm:
Câu | Tôi chọn | Đáp án đúng | Đúng/Sai | Giải thích ngắn | Romaji | Từ vựng N5 cần nhớ | Kanji N5 có thể gặp

Yêu cầu:
- Giải thích bằng tiếng Việt, ngắn gọn.
- Nếu sai, nói rõ đáp án đúng và lý do sai.
- Nếu từ có Kanji thường gặp trong JLPT N5, hãy ghi thêm Kanji + Hiragana + nghĩa.
- Cuối bài: tổng kết số câu đúng/sai và danh sách từ cần ôn.

Dữ liệu bài làm:`;

  const getSelectedAnswerLabel = (group, question) => {
    const selected = state.selectedAnswers.get(answerKey(group, question));
    if (!selected) {
      return "chưa chọn";
    }

    return `${selected}. ${question.options[selected] || ""}`.trim();
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
      lines.push(
        "",
        `Câu ${index + 1}:`,
        `Tiếng Nhật: ${question.questionJp}`,
        `Romaji: ${question.romaji || ""}`,
        `Nghĩa tiếng Việt: ${question.meaningVi || ""}`,
        `A. ${question.options.A || ""}`,
        `B. ${question.options.B || ""}`,
        `C. ${question.options.C || ""}`,
        `D. ${question.options.D || ""}`,
        `Tôi chọn: ${getSelectedAnswerLabel(group, question)}`
      );
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

    const goukakuMatch = fileName.match(/^(goukaku_.+)__/);
    if (goukakuMatch) {
      const labels = {
        goukaku_jlpt_n5_grammar_trac_nghiem: "Goukaku Grammar N5",
        goukaku_jlpt_n5_trac_nghiem_tu_vung_ngu_phap: "Goukaku Từ vựng & Ngữ pháp",
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
        goukaku: 5,
        kana: 6,
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
      option.textContent = group.groupTitle;
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

  const createQuestion = (group, question, index) => {
    const article = document.createElement("article");
    article.className = "quiz-question";

    const heading = document.createElement("h3");
    heading.textContent = `Câu ${index + 1}`;

    const jp = document.createElement("p");
    jp.className = "quiz-jp";
    jp.textContent = question.questionJp;

    const romaji = document.createElement("p");
    romaji.className = "quiz-romaji";
    romaji.textContent = question.romaji;

    const meaning = document.createElement("p");
    meaning.className = "quiz-meaning";
    meaning.textContent = question.meaningVi;

    const options = document.createElement("div");
    options.className = "quiz-options";
    Object.entries(question.options).forEach(([optionKey, optionText]) => {
      options.appendChild(createOption(group, question, optionKey, optionText));
    });

    article.append(heading, jp, romaji, meaning, options);
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

    header.append(title, meta);

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
      renderSelectedAnswers(group);
    });

    const result = document.createElement("div");
    result.id = "final-review-result";
    result.className = "quiz-result";
    result.hidden = true;

    actions.appendChild(submit);
    content.append(header, questions, actions, result);
  };

  const init = async () => {
    setStatus("Đang tải dữ liệu trắc nghiệm...");

    try {
      const fileNames = await readCsvFileNames();
      if (!fileNames.length) {
        throw new Error(`Không tìm thấy file CSV trong ${config.QUIZ_DATA_FOLDER}.`);
      }

      state.groups = await Promise.all(fileNames.map(readCsvGroup));
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
})();
