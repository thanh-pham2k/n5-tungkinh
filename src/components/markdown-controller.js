import { isTypingCorrect } from '../services/answer-service';
import { renderVisualBlock } from './visual-blocks';

export function initializeMarkdown({
  marked,
  DOMPurify,
  mermaid,
  LessonParser,
  saveSource,
  loadExample,
  saveProgress,
  onDeckComplete,
  playSpeech,
  vocabularyAudio = false,
}) {
  const lifetime = new AbortController();
  const listen = (target, event, handler, options = {}) =>
    target.addEventListener(event, handler, { ...options, signal: lifetime.signal });
  const source = document.getElementById('lesson-source');
  const output = document.getElementById('lesson-output');
  const status = document.getElementById('lesson-status');
  const focusCopyStatus = document.getElementById('lesson-focus-copy-status');
  let answers = Object.create(null),
    revision = 0,
    statusTimer,
    closeExpanded;

  function setStatus(text, autoClear = false, target = status) {
    clearTimeout(statusTimer);
    if (status && target !== status) status.textContent = '';
    if (focusCopyStatus && target !== focusCopyStatus) focusCopyStatus.textContent = '';
    if (target) {
      target.textContent = text;
      if (autoClear && text) {
        statusTimer = setTimeout(() => {
          if (target.textContent === text) {
            target.textContent = '';
          }
        }, 4000);
      }
    }
  }

  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function button(label, action, disabled = false) {
    const node = el('button', label);
    node.type = 'button';
    node.disabled = disabled;
    node.addEventListener('click', action);
    return node;
  }
  function inline(text) {
    const span = el('span');
    span.innerHTML = DOMPurify.sanitize(marked.parseInline(text), {
      ALLOWED_TAGS: ['code', 'strong', 'em', 'del', 'br'],
      ALLOWED_ATTR: [],
    });
    return span;
  }
  function authoredTypingHints(question) {
    const normalized = question.replace(/&#x0*a0;|&#0*160;/gi, ' ');
    const match = normalized.match(
      /^(?:Use all the shuffled words to write one sentence|Gõ câu từ các từ đã xáo):\s*(.+)$/i,
    );
    if (!match) return null;
    const tokens = match[1].split(/\s+\/\s+/).map((part) => part.trim());
    return tokens.length >= 2 && tokens.every(Boolean) ? tokens : null;
  }
  function deck(quizzes, number) {
    const container = el('section', undefined, 'lesson-deck');
    container.setAttribute('aria-label', `Mini Quiz ${number}`);
    let current = 0,
      review = false;
    const selections = Object.create(null);
    let displayedQuestion = null,
      shuffledIndices = [];
    const correctAnswer = (q) =>
      q.type === 'single_choice'
        ? answers[q.id] === q.answer
        : isTypingCorrect(answers[q.id] || '', q.answer);
    const saveAnswer = (q, value) => {
      answers[q.id] = value;
      saveProgress({ markdownAnswers: { ...answers } }).catch((error) => {
        status.textContent = error.message;
      });
    };
    function draw(focus = false) {
      container.replaceChildren();
      const header = el('div', undefined, 'lesson-deck-header');
      const title = el(
        'h3',
        review ? 'Kết quả' : `Mini Quiz ${number} — ${current + 1} / ${quizzes.length}`,
      );
      title.tabIndex = -1;
      const expand = button('⛶', () => {
        if (closeExpanded) return;
        const placeholder = document.createComment('quiz position');
        container.before(placeholder);
        const dialog = el('dialog', undefined, 'lesson-deck-dialog');
        dialog.setAttribute('aria-label', `Luyện tập Mini Quiz ${number}`);
        const close = button('×', () => dialog.close());
        close.className = 'lesson-deck-dialog-close';
        close.setAttribute('aria-label', 'Đóng luyện tập');
        const bar = el('div', undefined, 'lesson-deck-dialog-bar');
        bar.append(el('strong', `Mini Quiz ${number}`), close);
        placeholder.after(dialog);
        dialog.append(bar, container);
        const restore = (restoreFocus = true) => {
          if (!dialog.isConnected) return;
          placeholder.replaceWith(container);
          dialog.remove();
          closeExpanded = null;
          if (restoreFocus)
            container.querySelector('.lesson-deck-expand')?.focus({ preventScroll: true });
        };
        closeExpanded = () => restore(false);
        dialog.addEventListener('close', () => restore());
        dialog.addEventListener('cancel', (event) => event.stopPropagation());
        dialog.showModal();
        container.querySelector('h3')?.focus({ preventScroll: true });
      });
      expand.className = 'lesson-deck-expand';
      expand.setAttribute('aria-label', 'Mở rộng luyện tập');
      header.append(title, expand);
      container.append(header);
      if (review) {
        displayedQuestion = null;
        const correct = quizzes.filter((q) => correctAnswer(q)).length;
        const unanswered = quizzes.filter((q) => answers[q.id] === undefined).length;
        container.append(el('p', `Đúng ${correct}/${quizzes.length} · Chưa trả lời ${unanswered}`));
        quizzes.forEach((q, i) => {
          const itemBtn = button(
            `${i + 1}. ${answers[q.id] === undefined ? 'Chưa trả lời' : correctAnswer(q) ? 'Đúng' : 'Sai'} — ${q.type === 'typing' && authoredTypingHints(q.question) ? 'Gõ câu' : q.question}`,
            () => {
              current = i;
              review = false;
              draw(true);
            },
          );
          if (answers[q.id] !== undefined) {
            itemBtn.classList.add(correctAnswer(q) ? 'is-correct' : 'is-incorrect');
          }
          container.append(itemBtn);
        });
        container.append(
          button('Luyện lại bộ này', () => {
            quizzes.forEach((q) => {
              delete answers[q.id];
              delete selections[q.id];
            });
            current = 0;
            review = false;
            saveProgress({ markdownAnswers: { ...answers } }).catch((error) => {
              status.textContent = error.message;
            });
            draw(true);
          }),
        );
      } else {
        const q = quizzes[current];
        const previous = quizzes[current - 1];
        const explicitHints = q.type === 'typing' ? authoredTypingHints(q.question) : null;
        const typingHints =
          explicitHints ||
          (q.type === 'typing' &&
          previous?.type === 'word_order' &&
          previous.question === q.question &&
          previous.answer === q.answer
            ? previous.tokens
            : null);
        if (
          displayedQuestion !== current &&
          (q.type === 'single_choice' || q.type === 'word_order' || typingHints)
        ) {
          const items = q.type === 'single_choice' ? q.options : typingHints || q.tokens;
          shuffledIndices = items.map((_, index) => index);
          for (let i = shuffledIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
          }
        }
        const field = el('fieldset');
        const legend = el('legend');
        if (explicitHints) {
          legend.className = 'lesson-visually-hidden';
          legend.textContent = 'Gõ câu từ các từ gợi ý';
        } else legend.append(inline(q.question));
        field.append(legend);
        if (q.type === 'single_choice')
          shuffledIndices.forEach((index) => {
            const option = q.options[index];
            const label = el('label', undefined, 'lesson-option');
            const answered = answers[q.id] !== undefined;
            const correct = answered && index === q.answer;
            const incorrect = answered && answers[q.id] === index && index !== q.answer;
            if (correct) label.classList.add('is-correct');
            if (incorrect) label.classList.add('is-incorrect');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `lesson-${number}-${current}`;
            radio.checked = answers[q.id] === index;
            radio.addEventListener('change', () => {
              answers[q.id] = index;
              saveProgress({ markdownAnswers: { ...answers } }).catch((error) => {
                status.textContent = error.message;
              });
              field.querySelectorAll('.lesson-option').forEach((option, position) => {
                const optionIndex = shuffledIndices[position];
                const isCorrect = optionIndex === q.answer;
                const isIncorrect = optionIndex === index && !isCorrect;
                option.classList.toggle('is-correct', isCorrect);
                option.classList.toggle('is-incorrect', isIncorrect);
                option.querySelector('.lesson-option-result')?.remove();
                if (isCorrect || isIncorrect)
                  option.append(el('span', isCorrect ? '✓ Đúng' : '✕ Sai', 'lesson-option-result'));
              });
              const isAnswerCorrect = correctAnswer(q);
              feedback.hidden = false;
              feedback.classList.toggle('is-correct', isAnswerCorrect);
              feedback.classList.toggle('is-incorrect', !isAnswerCorrect);
              feedback.replaceChildren(
                inline(
                  `${isAnswerCorrect ? 'Chính xác!' : 'Chưa chính xác.'} Đáp án: ${q.options[q.answer]}${q.explanation ? '\n' + q.explanation : ''}`,
                ),
              );
              const dot = dots.children[current];
              dot.textContent = `${current + 1} ${isAnswerCorrect ? '✓' : '✕'}`;
              dot.classList.toggle('is-correct', isAnswerCorrect);
              dot.classList.toggle('is-incorrect', !isAnswerCorrect);
              dot.setAttribute(
                'aria-label',
                `Câu ${current + 1}, ${isAnswerCorrect ? 'đúng' : 'sai'}`,
              );
            });
            label.append(radio, inline(option));
            if (correct || incorrect)
              label.append(el('span', correct ? '✓ Đúng' : '✕ Sai', 'lesson-option-result'));
            field.append(label);
          });
        if (q.type === 'typing') {
          if (typingHints) {
            const hintLabel = el('p', 'Cụm từ gợi ý', 'lesson-hint-label');
            const hints = el('div', undefined, 'lesson-order-tokens lesson-typing-hints');
            hints.setAttribute('aria-label', 'Cụm từ gợi ý');
            shuffledIndices.forEach((index) => hints.append(el('span', typingHints[index])));
            if (!explicitHints) field.append(hintLabel);
            field.append(hints);
          }
          const input = el('input');
          input.type = 'text';
          input.value = answers[q.id] || '';
          input.setAttribute('aria-label', 'Câu trả lời');
          const submit = button('Kiểm tra', () => {
            if (!input.value.trim()) {
              input.focus();
              return;
            }
            saveAnswer(q, input.value.trim());
            draw(true);
          });
          input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit.click();
            }
          });
          field.append(input, submit);
        }
        if (q.type === 'word_order') {
          const selected = selections[q.id] || [];
          const slots = el('div', undefined, 'lesson-order-tokens');
          slots.setAttribute('aria-label', 'Thứ tự đã chọn');
          selected.forEach((index, position) =>
            slots.append(
              button(q.tokens[index], () => {
                selected.splice(position, 1);
                draw(true);
              }),
            ),
          );
          const choices = el('div', undefined, 'lesson-order-tokens');
          shuffledIndices.forEach((index) => {
            if (!selected.includes(index))
              choices.append(
                button(q.tokens[index], () => {
                  selected.push(index);
                  selections[q.id] = selected;
                  draw(true);
                }),
              );
          });
          field.append(
            slots,
            choices,
            button(
              'Kiểm tra',
              () => {
                saveAnswer(q, selected.map((index) => q.tokens[index]).join(' '));
                draw(true);
              },
              selected.length !== q.tokens.length,
            ),
          );
        }
        displayedQuestion = current;
        container.append(field);
        const feedback = el('p', undefined, 'lesson-feedback');
        feedback.setAttribute('aria-live', 'polite');
        feedback.hidden = answers[q.id] === undefined;
        if (!feedback.hidden) {
          const isAnswerCorrect = correctAnswer(q);
          feedback.classList.add(isAnswerCorrect ? 'is-correct' : 'is-incorrect');
          feedback.append(
            inline(
              `${isAnswerCorrect ? 'Chính xác!' : 'Chưa chính xác.'} Đáp án: ${q.type === 'single_choice' ? q.options[q.answer] : q.answer}${q.explanation ? '\n' + q.explanation : ''}`,
            ),
          );
        }
        container.append(feedback);
        const dots = el('div', undefined, 'lesson-dots');
        quizzes.forEach((item, index) => {
          const isAnswered = answers[item.id] !== undefined;
          const isItemCorrect = isAnswered && correctAnswer(item);
          const dot = button(
            `${index + 1}${isAnswered ? (isItemCorrect ? ' ✓' : ' ✕') : ''}`,
            () => {
              current = index;
              draw(true);
            },
          );
          if (isAnswered) dot.classList.add(isItemCorrect ? 'is-correct' : 'is-incorrect');
          dot.setAttribute(
            'aria-label',
            `Câu ${index + 1}${isAnswered ? (isItemCorrect ? ', đúng' : ', sai') : ''}`,
          );
          if (index === current) dot.setAttribute('aria-current', 'step');
          dots.append(dot);
        });
        const nav = el('div', undefined, 'lesson-deck-nav');
        nav.append(
          button(
            '← Trước',
            () => {
              current--;
              draw(true);
            },
            current === 0,
          ),
          button(current === quizzes.length - 1 ? 'Xem kết quả' : 'Tiếp →', () => {
            if (current === quizzes.length - 1) {
              review = true;
              if (quizzes.every((quiz) => answers[quiz.id] !== undefined)) onDeckComplete?.();
            } else current++;
            draw(true);
          }),
        );
        container.append(dots, nav);
      }
      if (focus) title.focus({ preventScroll: true });
    }
    container.addEventListener('click', (event) => {
      if (event.target.closest('button, input, textarea, select, a, summary, [contenteditable]'))
        return;
      container.querySelector('h3')?.focus({ preventScroll: true });
    });
    container.addEventListener('keydown', (event) => {
      if (
        review ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat ||
        event.target.isContentEditable ||
        event.target.closest('textarea, select, input:not([type="radio"]):not([type="checkbox"])')
      )
        return;
      const key = event.key.toLowerCase();
      if (key === 'a' && current > 0) {
        event.preventDefault();
        current--;
        draw(true);
      } else if (key === 'd' && current < quizzes.length - 1) {
        event.preventDefault();
        current++;
        draw(true);
      }
    });
    let touch;
    container.addEventListener(
      'touchstart',
      (event) => {
        touch = event.touches[0];
      },
      { passive: true },
    );
    container.addEventListener(
      'touchend',
      (event) => {
        if (!touch || review) return;
        const end = event.changedTouches[0],
          dx = end.clientX - touch.clientX,
          dy = end.clientY - touch.clientY;
        touch = null;
        if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if (dx < 0 && current < quizzes.length - 1) {
          current++;
          draw(true);
        } else if (dx > 0 && current > 0) {
          current--;
          draw(true);
        }
      },
      { passive: true },
    );
    draw();
    return container;
  }
  function flipcards(cards) {
    const container = el('section', undefined, 'lesson-flipcards');
    container.setAttribute('aria-label', 'Bộ flipcard');
    let current = 0,
      flipped = false;
    const count = el('p', undefined, 'flipcard-count');
    count.setAttribute('aria-live', 'polite');
    const expand = button('⛶', () => {
      if (closeExpanded) return;
      const placeholder = document.createComment('flipcard position');
      container.before(placeholder);
      const dialog = el('dialog', undefined, 'lesson-deck-dialog flipcard-dialog');
      dialog.setAttribute('aria-label', 'Luyện tập flipcard');
      const close = button('×', () => dialog.close());
      close.className = 'lesson-deck-dialog-close';
      close.setAttribute('aria-label', 'Đóng flipcard');
      const bar = el('div', undefined, 'lesson-deck-dialog-bar');
      bar.append(el('strong', 'Flipcard'), close);
      placeholder.after(dialog);
      dialog.append(bar, container);
      const restore = (restoreFocus = true) => {
        if (!dialog.isConnected) return;
        placeholder.replaceWith(container);
        dialog.remove();
        closeExpanded = null;
        if (restoreFocus) expand.focus({ preventScroll: true });
      };
      closeExpanded = () => restore(false);
      dialog.addEventListener('close', () => restore());
      dialog.addEventListener('cancel', (event) => event.stopPropagation());
      dialog.showModal();
      card.focus({ preventScroll: true });
    });
    expand.className = 'lesson-deck-expand flipcard-expand';
    expand.setAttribute('aria-label', 'Mở rộng flipcard');
    const header = el('div', undefined, 'flipcard-header');
    header.append(count, expand);
    const card = button('', () => {
      flipped = !flipped;
      update();
    });
    card.className = 'flipcard-face';
    function move(delta) {
      if ((delta < 0 && current === 0) || (delta > 0 && current === cards.length - 1)) return;
      current += delta;
      flipped = false;
      update();
      card.focus({ preventScroll: true });
    }
    const previous = button('← Trước', () => move(-1));
    const next = button('Tiếp →', () => move(1));
    const navigation = el('div', undefined, 'flipcard-navigation');
    navigation.append(previous, next);
    container.append(header, card, navigation);
    function update() {
      count.textContent = `Thẻ ${current + 1} / ${cards.length} · ${flipped ? 'Mặt sau' : 'Mặt trước'}`;
      card.dataset.side = flipped ? 'back' : 'front';
      const item = cards[current];
      const content = el('span', undefined, 'flipcard-content');
      if (flipped) {
        for (const [label, value] of [
          ['Từ loại', item.partOfSpeech],
          ['Giải thích / ngữ cảnh', item.back],
          ['Ví dụ', item.example],
          ['Từ đồng nghĩa', item.synonyms],
        ]) {
          if (!value) continue;
          const row = el('span', undefined, 'flipcard-row');
          const detail = el('span');
          detail.append(inline(value));
          row.append(el('strong', `${label}: `), detail);
          content.append(row);
        }
      } else content.append(inline(item.front));
      card.replaceChildren(content);
      card.setAttribute(
        'aria-label',
        `${flipped ? 'Mặt sau' : 'Mặt trước'}: ${content.textContent}. Nhấn để lật thẻ`,
      );
      previous.disabled = current === 0;
      next.disabled = current === cards.length - 1;
    }
    container.addEventListener('keydown', (event) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat ||
        event.target.isContentEditable ||
        event.target.closest('input, textarea, select, [contenteditable]')
      )
        return;
      const key = event.key.toLowerCase();
      if (key === 'a' || key === 'd') {
        event.preventDefault();
        move(key === 'a' ? -1 : 1);
      }
    });
    update();
    return container;
  }
  async function render(persist = true) {
    const run = ++revision;
    closeExpanded?.();
    output.replaceChildren();
    status.textContent = '';
    if (!marked || !DOMPurify) {
      status.textContent =
        'Không tải được thư viện Markdown. Kiểm tra kết nối mạng rồi mở lại trang.';
      return;
    }
    if (/#chatgpt-mermaid/.test(source.value)) {
      status.textContent =
        'Nội dung có CSS Mermaid từ giao diện ChatGPT. Hãy copy Markdown gốc (Copy code), không copy sơ đồ đã render.';
    }
    if (!source.value.trim()) {
      const empty = el('section', undefined, 'lesson-drop-empty');
      empty.setAttribute('aria-label', 'Đưa file Markdown để render');
      empty.append(
        el('h2', 'Đưa file Markdown (.md) để tự render'),
        el(
          'p',
          'Kéo thả file .md / .markdown / .txt vào đây, hoặc chọn file từ máy để render ngay visual-*, mermaid, quiz và flipcard.',
        ),
      );
      const pickBtn = button('Chọn file .md', () =>
        document.getElementById('lesson-file')?.click(),
      );
      pickBtn.className = 'button button-primary';
      empty.append(pickBtn);
      output.append(empty);
      return;
    }
    const blocks = LessonParser.parse(source.value);
    // Keep responses only when the complete question definition is unchanged.
    const valid = Object.create(null);
    blocks
      .filter((b) => b.type === 'deck')
      .flatMap((b) => b.quizzes)
      .forEach((q) => {
        const definition = JSON.stringify(q);
        if (
          definitions[q.id] === definition &&
          (q.type === 'single_choice'
            ? Number.isInteger(answers[q.id]) &&
              answers[q.id] >= 0 &&
              answers[q.id] < q.options.length
            : typeof answers[q.id] === 'string' && answers[q.id].trim())
        )
          valid[q.id] = answers[q.id];
        definitions[q.id] = definition;
      });
    answers = valid;
    let count = 0;
    for (const block of blocks) {
      if (block.type === 'deck') output.append(deck(block.quizzes, ++count));
      else if (block.type === 'flipcards') output.append(flipcards(block.cards));
      else if (block.type.startsWith('visual_'))
        output.append(renderVisualBlock(block, { inline }));
      else if (block.type === 'error') output.append(el('p', block.content, 'lesson-error'));
      else {
        const cleaned = block.content.replace(
          /^[^\n]*#chatgpt-mermaid-[^\n]*$/gm,
          '> ⚠️ Sơ đồ Mermaid trong file gốc bị dính CSS do copy từ giao diện ChatGPT. Hãy copy lại bằng nút **Copy code** để hiển thị sơ đồ.',
        );
        const section = el('section');
        section.innerHTML = DOMPurify.sanitize(marked.parse(cleaned), {
          USE_PROFILES: { html: true },
          SANITIZE_NAMED_PROPS: true,
        });
        if (vocabularyAudio && playSpeech) {
          section.querySelectorAll('h3').forEach((heading) => {
            const match = /^\d+\.\s+(.+)$/.exec(heading.textContent.trim());
            if (!match) return;
            const text = match[1].trim();
            const audioButton = button('🔊', () => playSpeech(text, 'en'));
            audioButton.className = 'button vocabulary-audio-button';
            audioButton.setAttribute('aria-label', `Nghe: ${text}`);
            heading.append(' ', audioButton);
          });
        }
        section.querySelectorAll('code').forEach((code) => {
          if (code.closest('pre')) return;
          const match = /^audio:(en|ja|vi)\|(.+)$/.exec(code.textContent.trim());
          if (!match || !playSpeech) return;
          const [, language, text] = match;
          const audioButton = button('♫ Nghe', () => playSpeech(text, language));
          audioButton.className = 'button lesson-audio-button';
          audioButton.setAttribute('aria-label', `Nghe: ${text}`);
          code.replaceWith(audioButton);
        });
        output.append(section);
      }
    }
    if (persist && source.value.trim() && !blocks.some((block) => block.type === 'error')) {
      try {
        await saveSource(source.value);
        if (run === revision) setStatus('Đã lưu nội dung trên Turso.', true);
      } catch (error) {
        if (run === revision) setStatus(error.message);
      }
    }
    const palette = getComputedStyle(output);
    const color = (name) => palette.getPropertyValue(name).trim();
    const isDark = document.body.classList.contains('dark');
    if (mermaid)
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
        theme: isDark ? 'dark' : 'base',
        themeVariables: {
          fontFamily: color('--font-body'),
          fontSize: '14px',
          primaryColor: color('--paper'),
          primaryTextColor: color('--ink'),
          primaryBorderColor: color('--line'),
          lineColor: color('--muted'),
          edgeLabelBackground: color('--paper'),
          clusterBkg: color('--canvas'),
          clusterBorder: color('--line'),
          actorBkg: color('--paper'),
          actorBorder: color('--line'),
          actorTextColor: color('--ink'),
          actorLineColor: color('--muted'),
          signalColor: color('--ink'),
          signalTextColor: color('--ink'),
          noteBkgColor: color('--subtle'),
          noteBorderColor: color('--line'),
          noteTextColor: color('--ink'),
        },
        htmlLabels: false,
        flowchart: {
          htmlLabels: false,
          curve: 'rounded',
          padding: 12,
          nodeSpacing: 32,
          rankSpacing: 38,
          useMaxWidth: false,
        },
        sequence: {
          useMaxWidth: false,
          actorMargin: 50,
          messageMargin: 38,
          boxMargin: 12,
          mirrorActors: false,
        },
        state: {
          useMaxWidth: false,
        },
      });
    for (const code of output.querySelectorAll('pre > code.language-mermaid')) {
      if (run !== revision) return;
      const pre = code.parentElement;
      try {
        if (!mermaid) throw new Error('Thư viện Mermaid chưa tải được.');
        const result = await mermaid.render(
          `lesson-diagram-${run}-${++diagramId}`,
          code.textContent,
        );
        if (run !== revision) return;
        const card = el('figure', undefined, 'mermaid-card');
        const scroll = el('div', undefined, 'mermaid-scroll');
        scroll.innerHTML = DOMPurify.sanitize(result.svg);
        const svg = scroll.querySelector('svg');
        if (svg) enhanceMermaidSvg(svg, color);
        card.append(scroll);
        pre.replaceWith(card);
      } catch {
        if (run !== revision) return;
        pre.before(
          el(
            'p',
            'Không vẽ được Mermaid. Kiểm tra cú pháp hoặc kết nối mạng; mã gốc được giữ bên dưới.',
            'lesson-error',
          ),
        );
      }
    }
  }

  function enhanceMermaidSvg(svg, color) {
    const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/\s+/);
    const vbWidth = viewBox.length === 4 ? Number(viewBox[2]) : NaN;
    const vbHeight = viewBox.length === 4 ? Number(viewBox[3]) : NaN;
    const rawWidth =
      Number.isFinite(vbWidth) && vbWidth > 0
        ? vbWidth
        : parseFloat(svg.getAttribute('width')) || 640;
    const rawHeight = Number.isFinite(vbHeight) && vbHeight > 0 ? vbHeight : 0;
    let baseWidth = Math.max(180, rawWidth);
    if (rawHeight > 380) {
      const fitScale = Math.max(0.72, 380 / rawHeight);
      baseWidth = Math.round(baseWidth * fitScale);
    }
    svg.style.maxWidth = 'none';
    svg.style.width = `${Math.round(baseWidth)}px`;
    svg.style.height = 'auto';

    const TONE = {
      fill: color('--paper'),
      stroke: color('--line'),
      text: color('--ink'),
      edge: color('--muted'),
      pill: color('--paper'),
    };
    const semanticTones = LessonParser.VISUAL_TONES;
    const nodeTone = (node) => {
      const tone = semanticTones.find((name) => node.classList.contains(name));
      const accent = tone && color(`--visual-tone-${tone}`);
      return accent
        ? {
            ...TONE,
            fill: color(`--v-${tone}-bg`) || `color-mix(in srgb, ${accent} 32%, ${TONE.fill})`,
            text: color(`--v-${tone}-text`) || TONE.text,
            stroke: accent,
          }
        : TONE;
    };
    const BUILTIN_NODE_CLASSES = new Set([
      'node',
      'default',
      'clickable',
      'icon-shape',
      'image-shape',
    ]);
    const hasAuthorStyle = (node) => {
      if (
        [...node.classList].some(
          (name) => !BUILTIN_NODE_CLASSES.has(name) && !semanticTones.includes(name),
        )
      )
        return true;
      return [...node.querySelectorAll('rect, polygon, circle, ellipse, path')].some((shape) =>
        /(fill|stroke)\s*:[^;]*!important/.test(shape.getAttribute('style') || ''),
      );
    };
    const paint = (shape, tone, dashed) => {
      shape.style.setProperty('fill', tone.fill, 'important');
      if (/stroke\s*:\s*none/.test(shape.getAttribute('style') || '')) return;
      shape.style.setProperty('stroke', tone.stroke, 'important');
      shape.style.setProperty('stroke-width', '1.5px', 'important');
      if (dashed) shape.style.setProperty('stroke-dasharray', '4 3', 'important');
      if (shape.tagName.toLowerCase() === 'rect') {
        shape.setAttribute('rx', color('--radius'));
        shape.setAttribute('ry', color('--radius'));
      }
    };

    svg.querySelectorAll('g.node').forEach((node) => {
      if (hasAuthorStyle(node)) return;
      const isChoice = Boolean(node.querySelector('polygon'));
      const tone = nodeTone(node);
      node.querySelectorAll('rect, polygon, circle, ellipse, path.basic').forEach((shape) => {
        paint(shape, tone, isChoice);
      });
      node.querySelectorAll('text, tspan').forEach((txt) => {
        txt.style.setProperty('fill', tone.text, 'important');
        txt.style.setProperty('font-weight', '600');
      });
    });

    svg.querySelectorAll('rect.actor').forEach((rect) => {
      paint(rect, TONE, false);
    });
    svg.querySelectorAll('text.actor > tspan, text.actor').forEach((txt) => {
      txt.style.setProperty('fill', TONE.text, 'important');
      txt.style.setProperty('font-weight', '600');
    });

    svg
      .querySelectorAll('.edgePath .path, .flowchart-link, .messageLine0, .messageLine1')
      .forEach((line) => {
        line.style.setProperty('stroke', TONE.edge, 'important');
        line.style.setProperty('stroke-width', '1.3px', 'important');
      });
    svg.querySelectorAll('.edgeLabel').forEach((label) => {
      label.querySelectorAll('rect').forEach((rect) => {
        const height = Number(rect.getAttribute('height')) || 24;
        rect.style.setProperty('fill', TONE.pill, 'important');
        rect.style.setProperty('stroke', TONE.stroke, 'important');
        rect.style.setProperty('stroke-width', '1.2px', 'important');
        rect.style.setProperty('opacity', '1', 'important');
        rect.setAttribute('rx', String(height / 2));
        rect.setAttribute('ry', String(height / 2));
      });
      label.querySelectorAll('text, tspan').forEach((txt) => {
        txt.style.setProperty('fill', TONE.text, 'important');
        txt.style.setProperty('font-weight', '600');
      });
    });
  }
  let definitions = Object.create(null),
    diagramId = 0;
  const divider = document.getElementById('preview-divider');
  const workspace = document.querySelector('.preview-workspace');
  let editorPercent = 50;
  function resizeEditor(value) {
    editorPercent = Math.min(85, Math.max(15, value));
    workspace.style.gridTemplateColumns = `minmax(0, ${editorPercent}fr) 8px minmax(0, ${100 - editorPercent}fr)`;
    divider.setAttribute('aria-valuenow', String(Math.round(editorPercent)));
  }
  listen(divider, 'pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    divider.focus();
    divider.setPointerCapture(event.pointerId);
    document.body.classList.add('resizing');
  });
  listen(divider, 'pointermove', (event) => {
    if (!divider.hasPointerCapture(event.pointerId)) return;
    const bounds = workspace.getBoundingClientRect();
    resizeEditor(((event.clientX - bounds.left - 4) / (bounds.width - 8)) * 100);
  });
  const stopResize = () => document.body.classList.remove('resizing');
  listen(divider, 'pointerup', stopResize);
  listen(divider, 'pointercancel', stopResize);
  listen(divider, 'lostpointercapture', stopResize);
  listen(divider, 'dblclick', () => resizeEditor(50));
  listen(divider, 'keydown', (event) => {
    const values = {
      ArrowLeft: editorPercent - 2,
      ArrowRight: editorPercent + 2,
      Home: 15,
      End: 85,
    };
    if (!Object.hasOwn(values, event.key)) return;
    event.preventDefault();
    resizeEditor(values[event.key]);
  });
  let timer;
  const mobileLayout = window.matchMedia('(max-width: 760px)');
  const menuToggle = document.getElementById('lesson-menu-toggle');
  const toolbarActions = document.getElementById('lesson-toolbar-actions');
  function closeMenu() {
    toolbarActions.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }
  listen(menuToggle, 'click', () => {
    const open = toolbarActions.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  listen(toolbarActions, 'click', (event) => {
    if (mobileLayout.matches && event.target.closest('button')) closeMenu();
  });
  listen(toolbarActions, 'change', () => {
    if (mobileLayout.matches) {
      closeMenu();
      menuToggle.focus();
    }
  });
  listen(document, 'pointerdown', (event) => {
    if (!toolbarActions.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
  });
  listen(document, 'keydown', (event) => {
    if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      closeMenu();
      menuToggle.focus();
    }
  });
  listen(mobileLayout, 'change', closeMenu);
  const editorDialog = document.getElementById('lesson-editor-dialog');
  const mobileSource = document.getElementById('lesson-mobile-source');
  listen(document.getElementById('lesson-editor-clear'), 'click', () => {
    mobileSource.value = '';
    mobileSource.focus();
  });
  listen(document.getElementById('lesson-edit'), 'click', () => {
    mobileSource.value = source.value;
    editorDialog.returnValue = '';
    editorDialog.showModal();
    mobileSource.focus();
  });
  listen(editorDialog, 'close', () => {
    if (editorDialog.returnValue !== 'apply') return;
    clearTimeout(timer);
    source.value = mobileSource.value;
    render();
  });
  listen(source, 'input', () => {
    ++revision;
    clearTimeout(timer);
    timer = setTimeout(render, 300);
  });
  listen(document.getElementById('lesson-example'), 'click', async () => {
    try {
      source.value = await loadExample();
      render();
    } catch (error) {
      status.textContent = error.message;
    }
  });
  const file = document.getElementById('lesson-file');
  async function openMarkdownFile(fileObj) {
    if (!fileObj) return;
    const isSupported =
      /\.(md|markdown|txt)$/i.test(fileObj.name || '') ||
      !fileObj.type ||
      fileObj.type.startsWith('text/');
    if (!isSupported) {
      setStatus('Chỉ hỗ trợ file Markdown (.md, .markdown) hoặc .txt.');
      return;
    }
    source.value = await fileObj.text();
    await render();
    setStatus(`Đã mở file ${fileObj.name}.`, true);
  }
  listen(document.getElementById('lesson-open'), 'click', () => file.click());
  listen(file, 'change', async () => {
    const selected = file.files[0];
    file.value = '';
    await openMarkdownFile(selected);
  });
  let dragDepth = 0;
  listen(workspace, 'dragenter', (event) => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    dragDepth++;
    workspace.classList.add('is-drag-over');
  });
  listen(workspace, 'dragover', (event) => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  listen(workspace, 'dragleave', (event) => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) workspace.classList.remove('is-drag-over');
  });
  listen(workspace, 'drop', async (event) => {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    dragDepth = 0;
    workspace.classList.remove('is-drag-over');
    await openMarkdownFile(event.dataTransfer.files[0]);
  });
  const focusCopy = document.getElementById('lesson-focus-copy');
  async function copyMarkdown(event) {
    const target = event.currentTarget === focusCopy ? focusCopyStatus : status;
    try {
      await navigator.clipboard.writeText(source.value);
      setStatus('Đã copy Markdown.', true, target);
    } catch {
      setStatus('Không copy được. Chọn nội dung trong editor và nhấn Ctrl+C.', false, target);
    }
  }
  listen(document.getElementById('lesson-copy'), 'click', copyMarkdown);
  if (focusCopy) listen(focusCopy, 'click', copyMarkdown);
  listen(document.getElementById('lesson-pdf'), 'click', () => window.print());
  listen(document.getElementById('lesson-reset'), 'click', () => {
    source.value = '';
    answers = Object.create(null);
    definitions = Object.create(null);
    render();
  });
  listen(document.getElementById('lesson-dark'), 'change', (event) => {
    document.body.classList.toggle('dark', event.target.checked);
    render();
  });
  const preview = document.getElementById('lesson-preview-scroll');
  const syncToggle = document.getElementById('lesson-sync');
  // Scroll events from assignments can arrive after the next animation frame.
  // Track the assigned position instead of releasing a shared lock on that frame.
  const assignedScroll = new WeakMap();
  let scrollFrame = 0,
    pendingScroll = null;
  function sync(from, to) {
    const assigned = assignedScroll.get(from);
    if (assigned !== undefined && Math.abs(from.scrollTop - assigned) < 1) return;
    assignedScroll.delete(from);
    if (!syncToggle.checked || mobileLayout.matches) return;
    pendingScroll = { from, to };
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const { from, to } = pendingScroll;
      pendingScroll = null;
      if (!syncToggle.checked || mobileLayout.matches) return;
      const range = from.scrollHeight - from.clientHeight;
      if (range <= 0) return;
      const targetRange = Math.max(0, to.scrollHeight - to.clientHeight);
      const position = Math.min(1, Math.max(0, from.scrollTop / range)) * targetRange;
      if (Math.abs(to.scrollTop - position) < 1) return;
      assignedScroll.set(to, position);
      to.scrollTop = position;
      assignedScroll.set(to, to.scrollTop);
    });
  }
  listen(source, 'scroll', () => sync(source, preview), { passive: true });
  listen(preview, 'scroll', () => sync(preview, source), { passive: true });
  listen(syncToggle, 'change', () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    pendingScroll = null;
    assignedScroll.delete(source);
    assignedScroll.delete(preview);
  });
  listen(document, 'study-markdown-load', (event) => {
    source.value = event.detail.source;
    answers = event.detail.progress?.markdownAnswers || Object.create(null);
    definitions = Object.create(null);
    LessonParser.parse(source.value)
      .filter((block) => block.type === 'deck')
      .flatMap((block) => block.quizzes)
      .forEach((quiz) => {
        definitions[quiz.id] = JSON.stringify(quiz);
      });
    render(false);
  });
  render(false);
  return () => {
    closeExpanded?.();
    lifetime.abort();
    ++revision;
    clearTimeout(timer);
    clearTimeout(statusTimer);
    cancelAnimationFrame(scrollFrame);
  };
}
