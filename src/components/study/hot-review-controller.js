import { createSpeechUrl } from '../../services/audio-service';
import {
  OPTION_LABELS,
  REVIEW_PROMPT,
  parseHotReviewQuiz,
  parseAnswerCsv,
} from '../../services/hot-review-service';
// Hot Review retained as a feature controller; Final Review has been removed.
export function initializeHotReview(getSettings) {
  const lifetime = new AbortController();
  const HOT_REVIEW_LATER_STORAGE_KEY = 'quiz_review_later_ids';
  const state = {
    renderedOptions: new Map(),
    hotReviewGroup: null,
    hotReviewAnswers: new Map(),
    hotReviewConfirmed: new Set(),
    hotReviewPage: 1,
    hotReviewPageSize: 1,
    hotReviewMode: 'all',
    hotReviewLaterIds: new Set(),
    answersByQuestionId: new Map(),
    activeAnswerId: '',
    showAllAnswers: true,
    hotReviewControlsHidden: false,
  };
  const hotReviewAnswerAudioCache = new Map();
  let hotReviewAnswerAudio = null;
  let audioRun = 0;
  const syncAudio = () => {
    if (!getSettings().active) {
      audioRun++;
      hotReviewAnswerAudio?.pause();
    }
    if (hotReviewAnswerAudio) {
      hotReviewAnswerAudio.volume = getSettings().volume / 100;
      hotReviewAnswerAudio.playbackRate = getSettings().rate;
    }
  };
  const getGlobalPlaybackRate = () => getSettings().rate;
  const hotReviewRoot = document.getElementById('hot-review-quiz');
  const hotReviewContent = document.getElementById('hot-review-content');
  const hotReviewDialog = document.getElementById('hot-review-dialog');
  const hotReviewInput = document.getElementById('hot-review-input');
  const hotReviewError = document.getElementById('hot-review-error');
  const hotReviewCancel = document.getElementById('hot-review-cancel');
  const hotReviewClear = document.getElementById('hot-review-clear');
  const hotReviewCreate = document.getElementById('hot-review-create');
  const answerImportDialog = document.getElementById('answer-import-dialog');
  const answerImportInput = document.getElementById('answer-import-input');
  const answerImportError = document.getElementById('answer-import-error');
  const answerImportCancel = document.getElementById('answer-import-cancel');
  const answerImportClear = document.getElementById('answer-import-clear');
  const answerImportApply = document.getElementById('answer-import-apply');

  if (!hotReviewRoot || !hotReviewContent) return () => {};
  const assetUrl = (path) =>
    `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/${path.replace(/^\/+/, '')}`;
  const imageFileUrl = (fileName) => assetUrl(`quiz-data/${fileName}`);
  const loadHotReviewLaterIds = () => {
    try {
      const payload = JSON.parse(localStorage.getItem(HOT_REVIEW_LATER_STORAGE_KEY) || '[]');
      return new Set(
        Array.isArray(payload) ? payload.filter((id) => typeof id === 'string' && id) : [],
      );
    } catch (error) {
      console.warn(error);
      return new Set();
    }
  };

  const saveHotReviewLaterIds = () => {
    try {
      localStorage.setItem(
        HOT_REVIEW_LATER_STORAGE_KEY,
        JSON.stringify(
          Array.from(state.hotReviewLaterIds).sort((a, b) => a.localeCompare(b, 'en')),
        ),
      );
    } catch (error) {
      console.warn(error);
    }
  };

  const appendJapaneseText = (element, text) => {
    const rubyPattern = /([おご御]?[一-龯々〆ヶ][一-龯ぁ-んァ-ヶー々〆ヶ]*?)（([ぁ-んァ-ヶー]+)）/g;
    let cursor = 0;
    let match = rubyPattern.exec(text);

    while (match) {
      const rubyBase = match[1];
      const reading = match[2];
      const textBeforeRuby = text.slice(cursor, match.index);

      if (textBeforeRuby) {
        element.appendChild(document.createTextNode(textBeforeRuby));
      }

      const ruby = document.createElement('ruby');
      ruby.appendChild(document.createTextNode(rubyBase));

      const rt = document.createElement('rt');
      rt.textContent = reading;
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
    const sectionLabels = new Set(['本文', '質問']);
    let cursor = 0;
    let match = markerPattern.exec(text);

    while (match) {
      if (match.index > cursor) {
        appendJapaneseText(element, text.slice(cursor, match.index));
      }

      const span = document.createElement('span');
      const isTarget = Boolean(match[1]);
      const isSectionLabel = isTarget && sectionLabels.has(match[1].trim());
      span.className = isSectionLabel
        ? 'quiz-section-label'
        : isTarget
          ? 'quiz-target'
          : 'quiz-blank';
      if (isSectionLabel) {
        span.textContent = match[0];
      } else if (isTarget) {
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

  const copyTextToClipboard = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  };

  const hotAnswerKey = (question) =>
    `hot-review:${question.orderKey || question.questionId || question.questionNo}`;

  const getHotReviewQuestionId = (question) =>
    [
      question.questionId ||
        `${question.groupId || 'hot-review'}:${question.lesson || ''}:${question.questionNo}`,
      question.orderKey || '',
    ].join(':');

  const getHotReviewQuestionsForMode = () => {
    const questions = state.hotReviewGroup?.questions || [];
    if (state.hotReviewMode !== 'later') {
      return questions;
    }

    return questions.filter((question) =>
      state.hotReviewLaterIds.has(getHotReviewQuestionId(question)),
    );
  };

  const getHotReviewPageCount = () => {
    const questionCount = getHotReviewQuestionsForMode().length;
    return Math.max(1, Math.ceil(questionCount / state.hotReviewPageSize));
  };

  const getVisibleHotReviewQuestions = () => {
    const questions = getHotReviewQuestionsForMode();
    const startIndex = (state.hotReviewPage - 1) * state.hotReviewPageSize;
    return questions.slice(startIndex, startIndex + state.hotReviewPageSize);
  };

  const openHotReviewDialog = () => {
    if (!hotReviewDialog || !hotReviewInput || !hotReviewError) {
      return;
    }

    hotReviewError.textContent = '';
    if (typeof hotReviewDialog.showModal === 'function') {
      hotReviewDialog.showModal();
    } else {
      hotReviewDialog.setAttribute('open', '');
    }
    hotReviewInput.focus();
  };

  const closeHotReviewDialog = () => {
    if (!hotReviewDialog) {
      return;
    }

    if (typeof hotReviewDialog.close === 'function') {
      hotReviewDialog.close();
    } else {
      hotReviewDialog.removeAttribute('open');
    }
  };

  const openAnswerImportDialog = () => {
    if (!answerImportDialog || !answerImportInput || !answerImportError) {
      return;
    }

    answerImportError.textContent = '';

    if (typeof answerImportDialog.showModal === 'function') {
      answerImportDialog.showModal();
    } else {
      answerImportDialog.setAttribute('open', '');
    }
    answerImportInput.focus();
  };

  const closeAnswerImportDialog = () => {
    if (!answerImportDialog) {
      return;
    }

    if (typeof answerImportDialog.close === 'function') {
      answerImportDialog.close();
    } else {
      answerImportDialog.removeAttribute('open');
    }
  };

  const getHotReviewAnswerId = (question) => String(question?.orderKey || '').trim();

  const getHotReviewMappedAnswer = (question) => {
    const answerId = getHotReviewAnswerId(question);
    const answer = answerId ? state.answersByQuestionId.get(answerId) : null;
    return answer
      ? {
          ...answer,
          selectedAnswer:
            state.hotReviewAnswers.get(hotAnswerKey(question)) || answer.selectedAnswer,
        }
      : null;
  };

  const isHotReviewAnswerVisible = (question) => {
    const answerId = getHotReviewAnswerId(question);
    return Boolean(
      answerId &&
      state.answersByQuestionId.has(answerId) &&
      (state.showAllAnswers || state.activeAnswerId === answerId),
    );
  };

  const setActiveHotReviewAnswer = (question) => {
    const answerId = getHotReviewAnswerId(question);
    if (!answerId || !state.answersByQuestionId.has(answerId)) {
      return;
    }

    state.activeAnswerId = answerId;
    renderHotReviewQuiz();
  };

  const renderHotReviewEmpty = () => {
    if (!hotReviewContent) {
      return;
    }

    const empty = document.createElement('div');
    empty.className = 'hot-review-empty';

    const title = document.createElement('h3');
    title.textContent = 'Hot Review';

    const description = document.createElement('p');
    description.textContent = 'Dán dữ liệu CSV để tạo bài trắc nghiệm nhanh.';

    const inputButton = document.createElement('button');
    inputButton.type = 'button';
    inputButton.className = 'primary';
    inputButton.textContent = 'Nhập dữ liệu';
    inputButton.addEventListener('click', openHotReviewDialog);

    empty.append(title, description, inputButton);
    hotReviewContent.replaceChildren(empty);
  };

  const clearHotReviewData = () => {
    const hasData =
      Boolean(hotReviewInput?.value.trim()) ||
      Boolean(state.hotReviewGroup) ||
      state.hotReviewAnswers.size > 0;
    if (hasData && !window.confirm('Ban co chac muon xoa du lieu hien tai khong?')) {
      return;
    }

    if (hotReviewInput) {
      hotReviewInput.value = '';
    }
    if (hotReviewError) {
      hotReviewError.textContent = '';
    }

    state.hotReviewGroup = null;
    state.hotReviewAnswers = new Map();
    state.hotReviewConfirmed = new Set();
    state.hotReviewPage = 1;
    state.hotReviewMode = 'all';
    state.renderedOptions = new Map(
      Array.from(state.renderedOptions.entries()).filter(([key]) => !key.startsWith('hot-review:')),
    );
    renderHotReviewEmpty();
  };

  const getAnswerOptionValue = (answer, optionKey) => {
    return (
      {
        A: answer.optionAVi,
        B: answer.optionBVi,
        C: answer.optionCVi,
        D: answer.optionDVi,
      }[optionKey] || ''
    );
  };

  const getCorrectAnswerJapaneseText = (answer) => {
    const detail = (answer?.answerDetailVi || '').trim();
    if (!detail) {
      return '';
    }

    return detail.split('=')[0].trim();
  };

  const createAnswerPanel = (answer, question) => {
    const panel = document.createElement('aside');
    panel.className = 'hot-review-answer-panel';
    if (state.hotReviewPageSize === 1) {
      panel.style.maxWidth = '30rem';
    }
    const correctJapaneseText = getCorrectAnswerJapaneseText(answer);
    if (correctJapaneseText) {
      panel.dataset.correctJp = correctJapaneseText;
    }

    const lines = [`Câu ${question?.questionNo || ''}`, ''];

    if (question?.questionJp) {
      lines.push(question.questionJp);
    }
    if (question?.meaningVi) {
      lines.push(`Nghĩa. ${question.meaningVi}`);
    }

    lines.push(
      '',
      'Chọn/Đúng:',
      `Chọn: ${answer.selectedAnswer || 'chưa chọn'}`,
      `Đúng: ${answer.correctAnswer}. ${answer.answerDetailVi || ''}`.trim(),
      '',
      'Các option khác:',
    );

    OPTION_LABELS.filter((optionKey) => optionKey !== answer.correctAnswer).forEach((optionKey) => {
      lines.push(`${optionKey}. ${getAnswerOptionValue(answer, optionKey)}`);
    });

    lines.push('', 'Từ vựng/Kanji:');
    const vocabItems = answer.vocabKanji
      ? answer.vocabKanji
          .split('|')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
    lines.push(...vocabItems);

    lines.push('', 'Ngữ pháp:', answer.grammar || '');

    const content = document.createElement('div');
    content.className = 'hot-review-answer-content';
    content.textContent = lines.join('\n');
    panel.appendChild(content);
    return panel;
  };

  const createHotReviewOption = (question, optionKey, optionText, answer, answerVisible) => {
    const optionId = `hot-review-${question.orderKey || question.questionNo}-${optionKey}`;
    const label = document.createElement('label');
    label.className = 'quiz-option';
    label.setAttribute('for', optionId);
    label.dataset.optionKey = optionKey;
    label.dataset.optionJp = (optionText || '').trim();

    if (answer && answerVisible) {
      if (answer.correctAnswer === optionKey) {
        label.classList.add('quiz-option-correct');
      }
      if (
        answer.selectedAnswer &&
        answer.selectedAnswer !== answer.correctAnswer &&
        answer.selectedAnswer === optionKey
      ) {
        label.classList.add('quiz-option-wrong');
      }
    }

    const input = document.createElement('input');
    input.type = 'radio';
    input.id = optionId;
    input.name = `hot-review-${question.orderKey || question.questionNo}`;
    input.value = optionKey;
    input.checked = state.hotReviewAnswers.get(hotAnswerKey(question)) === optionKey;
    input.addEventListener('change', () => {
      state.hotReviewAnswers.set(hotAnswerKey(question), optionKey);
      setActiveHotReviewAnswer(question);
    });

    const key = document.createElement('span');
    key.className = 'quiz-option-key';
    key.textContent = optionKey;

    const text = document.createElement('span');
    text.className = 'quiz-option-text';
    appendQuestionText(text, optionText);

    label.append(input, key, text);
    return label;
  };

  const toggleHotReviewLater = (question) => {
    const questionId = getHotReviewQuestionId(question);
    if (state.hotReviewLaterIds.has(questionId)) {
      state.hotReviewLaterIds.delete(questionId);
    } else {
      state.hotReviewLaterIds.add(questionId);
    }
    saveHotReviewLaterIds();
    renderHotReviewQuiz();
  };

  const createHotReviewLaterButton = (question) => {
    const questionId = getHotReviewQuestionId(question);
    const isMarked = state.hotReviewLaterIds.has(questionId);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hot-review-star';
    button.textContent = isMarked ? '\u2605' : '\u2606';
    button.setAttribute(
      'aria-label',
      isMarked ? 'Remove from Review Later' : 'Add to Review Later',
    );
    button.setAttribute('aria-pressed', String(isMarked));
    button.addEventListener('click', () => {
      toggleHotReviewLater(question);
    });
    return button;
  };

  const createHotReviewQuestion = (question) => {
    const row = document.createElement('div');
    row.className = 'hot-review-question-row';
    if (state.hotReviewPageSize === 1) {
      row.classList.add('hot-review-question-row-single');
    }

    const article = document.createElement('article');
    article.className = 'quiz-question hot-review-question';
    if (state.hotReviewPageSize === 1) {
    }
    const answer = getHotReviewMappedAnswer(question);
    const answerVisible = isHotReviewAnswerVisible(question);

    const headingRow = document.createElement('div');
    headingRow.className = 'hot-review-question-heading';

    const heading = document.createElement('h3');
    heading.textContent = `Câu ${question.questionNo}`;
    const headingActions = document.createElement('div');
    headingActions.className = 'hot-review-question-actions';
    headingActions.appendChild(createHotReviewLaterButton(question));
    headingRow.append(heading, headingActions);

    const jp = document.createElement('p');
    jp.className = 'quiz-jp';
    appendQuestionText(jp, question.questionJp);

    const prompt = document.createElement('div');
    prompt.className = 'quiz-question-prompt';
    prompt.appendChild(jp);
    if (question.meaningVi) {
      const meaning = document.createElement('p');
      meaning.className = 'quiz-question-meaning';
      meaning.textContent = question.meaningVi;
      prompt.append(meaning);
    }
    if (
      question.imageUrl &&
      !question.imageUrl.split('/').includes('..') &&
      !question.imageUrl.includes(':')
    ) {
      const image = document.createElement('img');
      image.className = 'quiz-question-image';
      image.src = imageFileUrl(question.imageUrl);
      image.alt = `Hình minh họa câu ${question.questionNo}`;
      prompt.append(image);
    }

    const options = document.createElement('div');
    options.className = 'quiz-options';
    state.renderedOptions.set(hotAnswerKey(question), question.options);
    OPTION_LABELS.forEach((optionKey) => {
      options.appendChild(
        createHotReviewOption(
          question,
          optionKey,
          question.options[optionKey] || '',
          answer,
          answerVisible,
        ),
      );
    });

    const questionMain = document.createElement('div');
    questionMain.className = 'hot-review-question-main';
    questionMain.append(headingRow, prompt, options);

    article.appendChild(questionMain);
    row.appendChild(article);
    if (answer && answerVisible) {
      row.appendChild(createAnswerPanel(answer, question));
    }

    return row;
  };

  const getHotSelectedAnswerLabel = (question) => {
    const selected = state.hotReviewAnswers.get(hotAnswerKey(question));
    if (!selected) {
      return 'chưa chọn';
    }

    return `${selected}. ${question.options[selected] || ''}`.trim();
  };

  const buildHotReviewCopyText = (group, questions) => {
    const lines = [
      REVIEW_PROMPT,
      '',
      `Nhóm: ${group.groupTitle}`,
      `Bài: ${group.lesson || 'Không rõ'}`,
      '',
      'Danh sách câu hỏi + đáp án đã chọn:',
    ];

    questions.forEach((question) => {
      lines.push(
        '',
        `Câu ${question.questionNo}:`,
        `Tiếng Nhật: ${question.questionJp}`,
        `Nghĩa tiếng Việt: ${question.meaningVi || ''}`,
        `A. ${question.options.A || ''}`,
        `B. ${question.options.B || ''}`,
        `C. ${question.options.C || ''}`,
        `D. ${question.options.D || ''}`,
        `Tôi chọn: ${getHotSelectedAnswerLabel(question)}`,
      );
    });

    return lines.join('\n');
  };

  const renderHotReviewSelectedAnswers = (group, questions) => {
    const result = document.getElementById('hot-review-result');
    if (!result) {
      return;
    }

    const title = document.createElement('h3');
    title.textContent = 'Đáp án đã chọn';

    const list = document.createElement('ol');
    list.className = 'quiz-result-list';

    questions.forEach((question) => {
      const item = document.createElement('li');
      const selected = state.hotReviewAnswers.get(hotAnswerKey(question));
      item.textContent = `Câu ${question.questionNo}: ${selected ? `đã chọn ${selected}` : 'chưa chọn'}`;
      list.appendChild(item);
    });

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'quiz-copy-button';
    copyButton.textContent = 'Copy prompt + bài làm';

    const copyStatus = document.createElement('p');
    copyStatus.className = 'quiz-copy-status';
    copyStatus.setAttribute('aria-live', 'polite');

    copyButton.addEventListener('click', async () => {
      copyButton.disabled = true;
      copyStatus.textContent = 'Đang copy...';

      try {
        await copyTextToClipboard(buildHotReviewCopyText(group, questions));
        copyStatus.textContent = 'Đã copy prompt + câu hỏi + đáp án đã chọn.';
      } catch (error) {
        console.error(error);
        copyStatus.textContent = 'Không copy được. Hãy thử lại trên trình duyệt.';
      } finally {
        copyButton.disabled = false;
      }
    });

    result.replaceChildren(title, list, copyButton, copyStatus);
    result.hidden = false;
  };

  const syncHotReviewAnswerPanelHeights = () => {
    const isStackedLayout = window.matchMedia('(max-width: 1099px)').matches;
    const isSingleQuestionPage = state.hotReviewPageSize === 1;
    document.querySelectorAll('.hot-review-question-row').forEach((row) => {
      const card = row.querySelector('.hot-review-question');
      const panel = row.querySelector('.hot-review-answer-panel');
      if (!card || !panel) {
        row.style.minHeight = '';
        return;
      }

      if (isStackedLayout) {
        panel.style.height = '';
        panel.style.maxHeight = '';
        row.style.minHeight = '';
        return;
      }

      if (isSingleQuestionPage) {
        panel.style.height = '';
        panel.style.maxHeight = '';
        const cardHeight = card.getBoundingClientRect().height;
        const panelHeight = panel.getBoundingClientRect().height;
        row.style.minHeight = `${Math.max(cardHeight, panelHeight)}px`;
        return;
      }

      const cardHeight = card.getBoundingClientRect().height;
      panel.style.height = `${cardHeight}px`;
      panel.style.maxHeight = `${cardHeight}px`;
      row.style.minHeight = `${cardHeight}px`;
    });
  };

  const createHotReviewSoundOfTextUrl = (text) => createSpeechUrl(text, 'ja');
  const getHotReviewAnswerAudioUrl = (text) => {
    if (hotReviewAnswerAudioCache.has(text)) {
      return hotReviewAnswerAudioCache.get(text);
    }

    const urlPromise = createHotReviewSoundOfTextUrl(text).catch((error) => {
      hotReviewAnswerAudioCache.delete(text);
      throw error;
    });
    hotReviewAnswerAudioCache.set(text, urlPromise);
    return urlPromise;
  };

  const playHotReviewAudioText = async (text) => {
    const run = ++audioRun;
    const normalizedText = (text || '').trim();
    if (!normalizedText) {
      return;
    }

    try {
      const audioUrl = await getHotReviewAnswerAudioUrl(normalizedText);
      if (!getSettings().active || run !== audioRun) return;
      if (hotReviewAnswerAudio) {
        hotReviewAnswerAudio.pause();
        hotReviewAnswerAudio.currentTime = 0;
      }

      hotReviewAnswerAudio = new Audio(audioUrl);
      hotReviewAnswerAudio.playbackRate = getGlobalPlaybackRate();
      hotReviewAnswerAudio.volume = getSettings().volume / 100;
      await hotReviewAnswerAudio.play();
    } catch (error) {
      console.error(error);
    }
  };

  const getVisibleHotReviewElement = (selector) => {
    const elements = Array.from(document.querySelectorAll(selector));
    return elements.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    });
  };

  const playHotReviewCorrectAnswer = () => {
    const visiblePanel = getVisibleHotReviewElement('.hot-review-answer-panel');
    playHotReviewAudioText(visiblePanel?.dataset.correctJp);
  };

  const getHotReviewOptionIndexFromKey = (event) => {
    if (event.key >= '1' && event.key <= '4') {
      return Number.parseInt(event.key, 10) - 1;
    }

    if (/^Numpad[1-4]$/.test(event.code)) {
      return Number.parseInt(event.code.replace('Numpad', ''), 10) - 1;
    }

    return -1;
  };

  const playHotReviewOptionAnswer = (optionIndex) => {
    const row = getVisibleHotReviewElement('.hot-review-question-row');
    const option = row?.querySelectorAll('.quiz-option')[optionIndex];
    playHotReviewAudioText(option?.dataset.optionJp);
  };

  const handleHotReviewKeydown = (event) => {
    const hotReviewPanel = hotReviewRoot?.closest('.tab-panel');
    if (!state.hotReviewGroup || !hotReviewPanel?.classList.contains('active')) {
      return;
    }

    const target = event.target;
    const isEditing =
      target instanceof Element &&
      target.closest("input, textarea, select, [contenteditable='true']");
    if (isEditing || document.querySelector('dialog[open]')) {
      return;
    }

    const isCorrectAnswerAudioKey =
      event.key === 'Control' || event.key === '0' || event.code === 'Numpad0';
    if (isCorrectAnswerAudioKey && !event.repeat) {
      event.preventDefault();
      playHotReviewCorrectAnswer();
      return;
    }

    const optionIndex = getHotReviewOptionIndexFromKey(event);
    if (optionIndex !== -1 && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      playHotReviewOptionAnswer(optionIndex);
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    const pageCount = getHotReviewPageCount();
    if (event.key === 'ArrowLeft' && state.hotReviewPage > 1) {
      event.preventDefault();
      state.hotReviewPage -= 1;
      renderHotReviewQuiz();
      return;
    }

    if (event.key === 'ArrowRight' && state.hotReviewPage < pageCount) {
      event.preventDefault();
      state.hotReviewPage += 1;
      renderHotReviewQuiz();
    }
  };

  const clearAnswerData = () => {
    if (answerImportInput) {
      answerImportInput.value = '';
    }
    if (answerImportError) {
      answerImportError.textContent = '';
    }
    state.answersByQuestionId = new Map();
    state.activeAnswerId = '';
    state.showAllAnswers = true;
    if (state.hotReviewGroup) {
      renderHotReviewQuiz();
    }
  };

  const applyAnswerImport = () => {
    if (!answerImportInput || !answerImportError) {
      return;
    }

    try {
      const parsedAnswers = parseAnswerCsv(answerImportInput.value);
      const answersByQuestionId = new Map();
      const questions = state.hotReviewGroup?.questions || [];

      questions.forEach((question, index) => {
        const answer = parsedAnswers[index];
        if (!answer) {
          return;
        }

        const answerId = getHotReviewAnswerId(question);
        answersByQuestionId.set(answerId, {
          ...answer,
          id: answerId,
        });
      });

      if (!answersByQuestionId.size) {
        throw new Error('Answer CSV khong co dong nao khop voi cau hoi hien tai.');
      }

      state.answersByQuestionId = answersByQuestionId;
      state.activeAnswerId = answersByQuestionId.keys().next().value || '';
      closeAnswerImportDialog();
      if (state.hotReviewGroup) {
        renderHotReviewQuiz();
      }
    } catch (error) {
      answerImportError.textContent = error.message || 'Khong doc duoc answer CSV.';
    }
  };

  const renderHotReviewQuiz = () => {
    const group = state.hotReviewGroup;
    if (!hotReviewContent || !group) {
      return;
    }

    const pageCount = getHotReviewPageCount();
    state.hotReviewPage = Math.min(Math.max(state.hotReviewPage, 1), pageCount);
    const visibleQuestions = getVisibleHotReviewQuestions();

    const inputAgain = document.createElement('button');
    inputAgain.type = 'button';
    inputAgain.className = '';
    inputAgain.textContent = 'Nhập';
    inputAgain.addEventListener('click', openHotReviewDialog);

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', clearHotReviewData);

    const answerImportButton = document.createElement('button');
    answerImportButton.type = 'button';
    answerImportButton.textContent = 'Nhập answer';
    answerImportButton.addEventListener('click', openAnswerImportDialog);

    const showAllAnswersLabel = document.createElement('label');
    showAllAnswersLabel.className = 'hot-review-show-all';

    const showAllAnswersInput = document.createElement('input');
    showAllAnswersInput.type = 'checkbox';
    showAllAnswersInput.checked = state.showAllAnswers;
    showAllAnswersInput.addEventListener('change', () => {
      state.showAllAnswers = showAllAnswersInput.checked;
      if (!state.showAllAnswers) {
        state.activeAnswerId = '';
      }
      renderHotReviewQuiz();
    });

    const showAllAnswersText = document.createElement('span');
    showAllAnswersText.textContent = 'Show all answers';
    showAllAnswersLabel.append(showAllAnswersInput, showAllAnswersText);

    const reviewLaterButton = document.createElement('button');
    reviewLaterButton.type = 'button';
    reviewLaterButton.textContent =
      state.hotReviewMode === 'later' ? 'All Questions' : 'Review Later';
    reviewLaterButton.addEventListener('click', () => {
      state.hotReviewMode = state.hotReviewMode === 'later' ? 'all' : 'later';
      state.hotReviewPage = 1;
      renderHotReviewQuiz();
    });

    const hideControlsButton = document.createElement('button');
    hideControlsButton.type = 'button';
    hideControlsButton.textContent = 'Ẩn điều khiển';
    hideControlsButton.addEventListener('click', () => {
      state.hotReviewControlsHidden = true;
      renderHotReviewQuiz();
    });

    const hotReviewTools = document.createElement('details');
    const toolsSummary = document.createElement('summary');
    toolsSummary.textContent = 'Dữ liệu & tùy chọn ôn tập';
    hotReviewTools.append(toolsSummary);
    hotReviewTools.className = 'hot-review-tools more-actions';
    hotReviewTools.append(
      inputAgain,
      clearButton,
      answerImportButton,
      reviewLaterButton,
      showAllAnswersLabel,
      hideControlsButton,
    );

    const showControlsButton = document.createElement('button');
    showControlsButton.type = 'button';
    showControlsButton.textContent = 'Hiện điều khiển';
    showControlsButton.addEventListener('click', () => {
      state.hotReviewControlsHidden = false;
      renderHotReviewQuiz();
    });

    const hiddenControlsBar = document.createElement('div');
    hiddenControlsBar.className = 'hot-review-controls-toggle';
    hiddenControlsBar.appendChild(showControlsButton);

    const header = document.createElement('div');
    header.className = 'quiz-header';

    const title = document.createElement('h3');
    title.textContent = group.groupTitle;

    const meta = document.createElement('p');
    meta.className = 'quiz-meta';
    meta.textContent = `${group.lesson || 'Không rõ'} - ${group.questions.length} câu`;

    header.append(title, meta);

    const pagination = document.createElement('div');
    pagination.className = 'hot-review-pagination';

    const pageSizeField = document.createElement('label');
    pageSizeField.className = 'hot-review-page-size';
    pageSizeField.textContent = 'Số câu mỗi trang';

    const pageSizeInput = document.createElement('input');
    pageSizeInput.type = 'number';
    pageSizeInput.min = '1';
    pageSizeInput.step = '1';
    pageSizeInput.value = String(state.hotReviewPageSize);
    pageSizeInput.setAttribute('aria-label', 'Số câu Hot Review mỗi trang');
    const applyPageSize = () => {
      const pageSize = Number.parseInt(pageSizeInput.value, 10);
      const nextPageSize = Number.isFinite(pageSize) && pageSize >= 1 ? pageSize : 1;
      if (nextPageSize === state.hotReviewPageSize) {
        pageSizeInput.value = String(state.hotReviewPageSize);
        return;
      }

      state.hotReviewPageSize = nextPageSize;
      pageSizeInput.value = String(state.hotReviewPageSize);
      state.hotReviewPage = 1;
      renderHotReviewQuiz();
    };
    pageSizeInput.addEventListener('change', applyPageSize);
    pageSizeInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      applyPageSize();
    });
    pageSizeField.appendChild(pageSizeInput);

    const pageNav = document.createElement('div');
    pageNav.className = 'hot-review-page-nav';

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.textContent = 'Previous';
    previous.disabled = state.hotReviewPage <= 1;
    previous.addEventListener('click', () => {
      state.hotReviewPage -= 1;
      renderHotReviewQuiz();
    });

    const pageStatus = document.createElement('span');
    pageStatus.className = 'hot-review-page-status';
    pageStatus.textContent = `Page ${state.hotReviewPage} / ${pageCount}`;
    pageStatus.setAttribute('aria-live', 'polite');

    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = 'Next';
    next.disabled = state.hotReviewPage >= pageCount;
    next.addEventListener('click', () => {
      state.hotReviewPage += 1;
      renderHotReviewQuiz();
    });

    pageNav.append(previous, pageStatus, next);
    pagination.append(pageSizeField, pageNav);

    const questions = document.createElement('div');
    questions.className = 'quiz-questions';
    if (!visibleQuestions.length && state.hotReviewMode === 'later') {
      const emptyLater = document.createElement('div');
      emptyLater.className = 'hot-review-later-empty';
      emptyLater.textContent = 'Chưa có câu nào trong Review Later.';
      questions.appendChild(emptyLater);
    } else {
      visibleQuestions.forEach((question) => {
        questions.appendChild(createHotReviewQuestion(question));
      });
    }

    let touchStartX = null;
    let touchStartY = null;
    questions.addEventListener(
      'touchstart',
      (event) => {
        const target = event.target;
        const isInteractive =
          target instanceof Element &&
          target.closest('button, select, input, textarea, .quiz-option');
        if (
          !window.matchMedia('(max-width: 768px)').matches ||
          event.touches.length !== 1 ||
          isInteractive
        ) {
          touchStartX = null;
          touchStartY = null;
          return;
        }

        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
      },
      { passive: true },
    );
    questions.addEventListener(
      'touchend',
      (event) => {
        if (touchStartX === null || touchStartY === null || event.changedTouches.length !== 1) {
          return;
        }

        const deltaX = event.changedTouches[0].clientX - touchStartX;
        const deltaY = event.changedTouches[0].clientY - touchStartY;
        touchStartX = null;
        touchStartY = null;
        if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) {
          return;
        }

        if (deltaX < 0 && state.hotReviewPage < getHotReviewPageCount()) {
          state.hotReviewPage += 1;
          renderHotReviewQuiz();
        } else if (deltaX > 0 && state.hotReviewPage > 1) {
          state.hotReviewPage -= 1;
          renderHotReviewQuiz();
        }
      },
      { passive: true },
    );

    const actions = document.createElement('div');
    actions.className = 'quiz-actions';

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'primary';
    submit.textContent = 'Xác nhận';
    submit.disabled = visibleQuestions.length === 0;
    submit.addEventListener('click', () => {
      visibleQuestions.forEach((question) => {
        state.hotReviewConfirmed.add(hotAnswerKey(question));
      });
      renderHotReviewSelectedAnswers(group, visibleQuestions);
    });

    const result = document.createElement('div');
    result.id = 'hot-review-result';
    result.className = 'quiz-result';
    result.hidden = true;

    actions.append(submit);
    if (state.hotReviewControlsHidden) {
      hotReviewContent.replaceChildren(hiddenControlsBar, questions, actions, result);
    } else {
      hotReviewContent.replaceChildren(
        hotReviewTools,
        header,
        pagination,
        questions,
        actions,
        result,
      );
    }
    window.requestAnimationFrame(syncHotReviewAnswerPanelHeights);
    if (
      visibleQuestions.length &&
      visibleQuestions.every((question) => state.hotReviewConfirmed.has(hotAnswerKey(question)))
    ) {
      renderHotReviewSelectedAnswers(group, visibleQuestions);
    }
  };

  const createHotReviewFromInput = () => {
    if (!hotReviewInput || !hotReviewError) {
      return;
    }

    try {
      const group = parseHotReviewQuiz(hotReviewInput.value);
      state.hotReviewGroup = group;
      state.hotReviewAnswers = new Map();
      state.hotReviewConfirmed = new Set();
      state.answersByQuestionId = new Map();
      state.activeAnswerId = '';
      state.showAllAnswers = true;
      state.hotReviewPage = 1;
      state.hotReviewMode = 'all';
      state.renderedOptions = new Map(
        Array.from(state.renderedOptions.entries()).filter(
          ([key]) => !key.startsWith('hot-review:'),
        ),
      );
      closeHotReviewDialog();
      renderHotReviewQuiz();
      document.dispatchEvent(new Event('exercise-ready'));
    } catch (error) {
      hotReviewError.textContent = error.message || 'Không đọc được CSV.';
    }
  };

  const initHotReview = () => {
    if (!hotReviewRoot || !hotReviewContent) {
      return;
    }

    state.hotReviewLaterIds = loadHotReviewLaterIds();
    renderHotReviewEmpty();

    hotReviewCancel?.addEventListener(
      'click',
      () => {
        closeHotReviewDialog();
      },
      { signal: lifetime.signal },
    );
    hotReviewClear?.addEventListener('click', clearHotReviewData, { signal: lifetime.signal });
    hotReviewCreate?.addEventListener('click', createHotReviewFromInput, {
      signal: lifetime.signal,
    });
    answerImportCancel?.addEventListener('click', closeAnswerImportDialog, {
      signal: lifetime.signal,
    });
    answerImportClear?.addEventListener('click', clearAnswerData, { signal: lifetime.signal });
    answerImportApply?.addEventListener('click', applyAnswerImport, { signal: lifetime.signal });
    document.addEventListener('keydown', handleHotReviewKeydown);
  };

  initHotReview();
  document.addEventListener('study-audio-settings', syncAudio);
  return () => {
    lifetime.abort();
    audioRun++;
    document.removeEventListener('study-audio-settings', syncAudio);
    document.removeEventListener('keydown', handleHotReviewKeydown);
    hotReviewAnswerAudio?.pause();
  };
}
