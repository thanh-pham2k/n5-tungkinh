export function initializeMarkdown({
  marked,
  DOMPurify,
  mermaid,
  LessonParser,
  saveSource,
  loadExample,
  saveProgress,
}) {
  const lifetime = new AbortController();
  const listen = (target, event, handler, options = {}) =>
    target.addEventListener(event, handler, { ...options, signal: lifetime.signal });
  const source = document.getElementById('lesson-source');
  const output = document.getElementById('lesson-output');
  const status = document.getElementById('lesson-status');
  let answers = Object.create(null),
    revision = 0,
    statusTimer;

  function setStatus(text, autoClear = false) {
    clearTimeout(statusTimer);
    if (status) {
      status.textContent = text;
      if (autoClear && text) {
        statusTimer = setTimeout(() => {
          if (status.textContent === text) {
            status.textContent = '';
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
  function deck(quizzes, number) {
    const container = el('section', undefined, 'lesson-deck');
    container.setAttribute('aria-label', `Mini Quiz ${number}`);
    let current = 0,
      review = false;
    function draw(focus = false) {
      container.replaceChildren();
      const title = el(
        'h3',
        review ? 'Kết quả' : `Mini Quiz ${number} — ${current + 1} / ${quizzes.length}`,
      );
      title.tabIndex = -1;
      container.append(title);
      if (review) {
        const correct = quizzes.filter((q) => answers[q.id] === q.answer).length;
        const unanswered = quizzes.filter((q) => answers[q.id] === undefined).length;
        container.append(el('p', `Đúng ${correct}/${quizzes.length} · Chưa trả lời ${unanswered}`));
        quizzes.forEach((q, i) => {
          container.append(
            button(
              `${i + 1}. ${answers[q.id] === undefined ? 'Chưa trả lời' : answers[q.id] === q.answer ? 'Đúng' : 'Sai'} — ${q.question}`,
              () => {
                current = i;
                review = false;
                draw(true);
              },
            ),
          );
        });
        container.append(
          button('Luyện lại bộ này', () => {
            quizzes.forEach((q) => delete answers[q.id]);
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
        const field = el('fieldset');
        const legend = el('legend');
        legend.append(inline(q.question));
        field.append(legend);
        q.options.forEach((option, index) => {
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
            draw();
            container.querySelectorAll('input')[index].focus();
          });
          label.append(radio, inline(option));
          if (correct || incorrect)
            label.append(el('span', correct ? '✓ Đúng' : '✕ Sai', 'lesson-option-result'));
          field.append(label);
        });
        container.append(field);
        if (answers[q.id] !== undefined) {
          const feedback = el('p', undefined, 'lesson-feedback');
          feedback.append(
            inline(
              `${answers[q.id] === q.answer ? 'Chính xác!' : 'Chưa chính xác.'} Đáp án: ${q.options[q.answer]}${q.explanation ? '\n' + q.explanation : ''}`,
            ),
          );
          container.append(feedback);
        }
        const dots = el('div', undefined, 'lesson-dots');
        quizzes.forEach((item, index) => {
          const dot = button(`${index + 1}${answers[item.id] !== undefined ? ' ✓' : ''}`, () => {
            current = index;
            draw(true);
          });
          dot.setAttribute(
            'aria-label',
            `Câu ${index + 1}${answers[item.id] !== undefined ? ', đã trả lời' : ''}`,
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
            if (current === quizzes.length - 1) review = true;
            else current++;
            draw(true);
          }),
        );
        container.append(dots, nav);
      }
      if (focus) title.focus();
    }
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
  async function render(persist = true) {
    const run = ++revision;
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
          Number.isInteger(answers[q.id]) &&
          answers[q.id] >= 0 &&
          answers[q.id] < q.options.length
        )
          valid[q.id] = answers[q.id];
        definitions[q.id] = definition;
      });
    answers = valid;
    let count = 0;
    for (const block of blocks) {
      if (block.type === 'deck') output.append(deck(block.quizzes, ++count));
      else if (block.type === 'error') output.append(el('p', block.content, 'lesson-error'));
      else {
        const section = el('section');
        section.innerHTML = DOMPurify.sanitize(marked.parse(block.content), {
          USE_PROFILES: { html: true },
          SANITIZE_NAMED_PROPS: true,
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
    if (mermaid)
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
        theme: document.body.classList.contains('dark') ? 'dark' : 'default',
        htmlLabels: false,
        flowchart: { htmlLabels: false },
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
        const diagram = el('div');
        diagram.innerHTML = DOMPurify.sanitize(result.svg);
        pre.replaceWith(diagram);
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
  listen(document.getElementById('lesson-open'), 'click', () => file.click());
  listen(file, 'change', async () => {
    if (!file.files[0]) return;
    source.value = await file.files[0].text();
    file.value = '';
    render();
  });
  listen(document.getElementById('lesson-copy'), 'click', async () => {
    try {
      await navigator.clipboard.writeText(source.value);
      setStatus('Đã copy Markdown.', true);
    } catch {
      setStatus('Không copy được. Chọn nội dung trong editor và nhấn Ctrl+C.');
    }
  });
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
    lifetime.abort();
    ++revision;
    clearTimeout(timer);
    clearTimeout(statusTimer);
    cancelAnimationFrame(scrollFrame);
  };
}
