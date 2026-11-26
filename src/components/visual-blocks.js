const SVG_NS = 'http://www.w3.org/2000/svg';

const ICON_PATHS = {
  unlink: [
    'M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71',
    'M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71',
    'M8 2v3',
    'M2 8h3',
    'M16 19v3',
    'M19 16h3',
  ],
  layers: ['M12 2L2 7l10 5 10-5-10-5', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  'shield-check': ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10', 'M9 12l2 2 4-4'],
  'refresh-cw': [
    'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
    'M21 3v5h-5',
    'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
    'M8 16H3v5',
  ],
  'trending-up': ['M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  'eye-off': [
    'M9.88 9.88a3 3 0 1 0 4.24 4.24',
    'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68',
    'M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61',
    'M2 2l20 20',
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  'trash-2': [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  ],
  shuffle: ['M16 3h5v5', 'M4 20L21 3', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5'],
  'list-ordered': [
    'M10 6h11',
    'M10 12h11',
    'M10 18h11',
    'M4 6h1v4',
    'M4 10h2',
    'M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
  ],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M12 6v6l4 2'],
  database: [
    'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3',
    'M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5',
    'M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3',
  ],
  timer: ['M10 2h4', 'M12 14l3-3', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16'],
  lock: ['M5 11h14v10H5z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8'],
  server: ['M2 4h20v6H2z', 'M2 14h20v6H2z', 'M6 7h.01', 'M6 17h.01'],
  cpu: [
    'M6 6h12v12H6z',
    'M9 2v4',
    'M15 2v4',
    'M9 18v4',
    'M15 18v4',
    'M2 9h4',
    'M2 15h4',
    'M18 9h4',
    'M18 15h4',
  ],
  'alert-triangle': [
    'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  'check-circle': ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M9 11l3 3L22 4'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16', 'M21 21l-4.35-4.35'],
  wrench: [
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  ],
  play: ['M6 4l14 8-14 8V4z'],
  mail: [
    'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z',
    'M22 6l-10 7L2 6',
  ],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'M23 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  globe: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20',
    'M2 12h20',
    'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  ],
  code: ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6'],
  book: [
    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
    'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  ],
  star: [
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  ],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
  cloud: ['M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z'],
  'file-text': [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8',
    'M16 17H8',
    'M10 9H8',
  ],
};

export const VISUAL_ICON_NAMES = Object.freeze(Object.keys(ICON_PATHS).sort());

const FALLBACK_ICON = ['M12 2l3 7h7l-5.5 4.2 2 6.8L12 16l-6.5 4 2-6.8L2 9h7l3-7z'];

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function createVisualIcon(name) {
  const key = (name || '').trim().toLowerCase();
  const paths = ICON_PATHS[key] || FALLBACK_ICON;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('visual-icon');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

const createIcon = createVisualIcon;

function makeSimSlider(labelText, { min, max, step, value, unit = '' }) {
  const field = el('label', undefined, 'visual-sim-field');
  const top = el('span', undefined, 'visual-sim-field-top');
  const valSpan = el('strong', `${value}${unit}`, 'visual-sim-val');
  top.append(el('span', labelText), valSpan);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.setAttribute('aria-label', labelText);
  field.append(top, input);
  return { field, input, valSpan, unit };
}

function createHeader(title, badgeText) {
  const header = el('div', undefined, 'visual-block-header');
  if (title) header.append(el('h3', title, 'visual-block-title'));
  else header.append(el('span', '', 'visual-block-spacer'));
  header.append(el('span', badgeText, 'visual-block-badge'));
  return header;
}

function renderVisualGrid(block, inline) {
  const section = el('section', undefined, 'visual-block visual-grid-block');
  section.setAttribute('aria-label', block.title || 'Visual Grid');
  if (block.title) section.append(createHeader(block.title, 'visual-grid'));

  const grid = el('div', undefined, 'visual-grid-list');
  grid.style.setProperty('--visual-cols', String(block.columns || 2));

  for (const item of block.items) {
    const card = el('div', undefined, 'visual-grid-card');
    if (item.icon) {
      const iconWrap = el('span', undefined, 'visual-icon-box');
      iconWrap.append(createIcon(item.icon));
      card.append(iconWrap);
    }
    const body = el('div', undefined, 'visual-grid-body');
    const titleEl = el('div', undefined, 'visual-card-title');
    titleEl.append(inline(item.title));
    const descEl = el('div', undefined, 'visual-card-desc');
    descEl.append(inline(item.description));
    body.append(titleEl, descEl);
    card.append(body);
    grid.append(card);
  }
  section.append(grid);
  return section;
}

function renderVisualFlow(block, inline) {
  const isVertical = block.direction === 'vertical';
  const section = el('section', undefined, 'visual-block visual-flow-block');
  section.setAttribute('aria-label', block.title || 'Visual Flow');
  if (block.title) section.append(createHeader(block.title, 'visual-flow'));

  const track = el(
    'ol',
    undefined,
    `visual-flow-track ${isVertical ? 'is-vertical' : 'is-horizontal'}`,
  );

  block.steps.forEach((step, index) => {
    const li = el('li', undefined, 'visual-flow-step');
    const card = el('div', undefined, 'visual-flow-card');
    if (step.icon) {
      const iconWrap = el('span', undefined, 'visual-icon-box');
      iconWrap.append(createIcon(step.icon));
      card.append(iconWrap);
    }
    const textWrap = el('div', undefined, 'visual-flow-text');
    const labelEl = el('div', undefined, 'visual-card-title');
    labelEl.append(inline(step.label));
    textWrap.append(labelEl);
    if (step.description) {
      const descEl = el('div', undefined, 'visual-card-desc');
      descEl.append(inline(step.description));
      textWrap.append(descEl);
    }
    card.append(textWrap);
    li.append(card);

    if (index < block.steps.length - 1) {
      const arrow = el('span', isVertical ? '↓' : '→', 'visual-flow-arrow');
      arrow.setAttribute('aria-hidden', 'true');
      li.append(arrow);
    }
    track.append(li);
  });

  section.append(track);
  return section;
}

function analyzeReceiveTokens(send, receive) {
  const seen = new Set();
  let sendIdx = 0;
  return receive.map((token) => {
    const isDuplicate = seen.has(token);
    seen.add(token);
    let isReordered = false;
    if (!isDuplicate) {
      if (sendIdx < send.length && send[sendIdx] === token) {
        sendIdx++;
      } else {
        isReordered = true;
      }
    }
    return { token, isDuplicate, isReordered };
  });
}

function renderVisualCompare(block, inline) {
  const section = el('section', undefined, 'visual-block visual-compare-block');
  section.setAttribute('aria-label', block.title || 'Visual Compare');

  const header = el('div', undefined, 'visual-block-header');
  header.append(el('h3', block.title || 'So sánh', 'visual-block-title'));

  const hasSequences = block.sections.some((sec) => sec.send.length || sec.receive.length);
  const animatedTokens = [];
  if (hasSequences) {
    const replayBtn = el('button', '↻ Chạy lại', 'button visual-replay-btn');
    replayBtn.type = 'button';
    replayBtn.addEventListener('click', () => {
      animatedTokens.forEach((chip) => {
        chip.classList.remove('is-popping');
        chip.style.opacity = '0.2';
      });
      animatedTokens.forEach((chip, idx) => {
        setTimeout(
          () => {
            chip.style.opacity = '';
            chip.classList.add('is-popping');
          },
          160 * (idx + 1),
        );
      });
    });
    header.append(replayBtn);
  } else {
    header.append(el('span', 'visual-compare', 'visual-block-badge'));
  }
  section.append(header);

  const grid = el('div', undefined, 'visual-compare-grid');
  for (const item of block.sections) {
    const card = el('article', undefined, 'visual-compare-card');
    const cardHead = el('div', undefined, 'visual-compare-card-head');
    const titleGroup = el('div', undefined, 'visual-compare-title-group');
    if (item.icon) {
      const iconWrap = el('span', undefined, 'visual-icon-box');
      iconWrap.append(createIcon(item.icon));
      titleGroup.append(iconWrap);
    }
    titleGroup.append(el('h4', item.name, 'visual-compare-name'));
    cardHead.append(titleGroup);
    if (item.badge) {
      cardHead.append(el('span', item.badge, 'visual-block-badge'));
    }
    card.append(cardHead);

    if (item.description) {
      const desc = el('p', undefined, 'visual-card-desc');
      desc.append(inline(item.description));
      card.append(desc);
    }

    if (item.send.length || item.receive.length) {
      const seqBox = el('div', undefined, 'visual-compare-seq');
      if (item.send.length) {
        const sendRow = el('div', undefined, 'visual-seq-row');
        sendRow.append(el('span', 'Send', 'visual-seq-label'));
        const chips = el('div', undefined, 'visual-seq-chips');
        for (const tok of item.send) {
          chips.append(el('span', tok, 'visual-token'));
        }
        sendRow.append(chips);
        seqBox.append(sendRow);
      }
      if (item.receive.length) {
        const recvRow = el('div', undefined, 'visual-seq-row');
        recvRow.append(el('span', 'Receive', 'visual-seq-label'));
        const chips = el('div', undefined, 'visual-seq-chips');
        const analyzed = analyzeReceiveTokens(item.send, item.receive);
        for (const entry of analyzed) {
          const chip = el('span', entry.token, 'visual-token');
          if (entry.isDuplicate) {
            chip.classList.add('is-duplicate');
            chip.title = 'Trùng lặp';
          } else if (entry.isReordered) {
            chip.classList.add('is-reordered');
            chip.title = 'Sai thứ tự';
          } else if (item.send.length) {
            chip.classList.add('is-ordered');
          }
          animatedTokens.push(chip);
          chips.append(chip);
        }
        recvRow.append(chips);
        seqBox.append(recvRow);
      }
      card.append(seqBox);
    }

    if (item.meta.length) {
      const metaList = el('dl', undefined, 'visual-compare-meta');
      for (const pair of item.meta) {
        metaList.append(el('dt', pair.key), el('dd', pair.value));
      }
      card.append(metaList);
    }
    if (item.note) {
      const note = el('p', undefined, 'visual-compare-note');
      note.append(inline(item.note));
      card.append(note);
    }
    if (item.useCase) {
      const uc = el('p', undefined, 'visual-compare-usecase');
      uc.append(el('strong', 'Use case: '), inline(item.useCase));
      card.append(uc);
    }
    grid.append(card);
  }
  section.append(grid);
  return section;
}

function renderVisualMetrics(block, inline) {
  const section = el('section', undefined, 'visual-block visual-metrics-block');
  section.setAttribute('aria-label', block.title || 'Visual Metrics');
  if (block.title) section.append(createHeader(block.title, 'visual-metrics'));

  const grid = el('div', undefined, 'visual-metrics-grid');
  grid.style.setProperty('--visual-cols', String(block.columns || 2));

  for (const item of block.items) {
    const card = el('div', undefined, 'visual-metric-card');
    const top = el('div', undefined, 'visual-metric-top');
    const label = el('span', undefined, 'visual-metric-label');
    label.append(inline(item.label));
    top.append(label);
    if (item.icon) top.append(createIcon(item.icon));
    const value = el('div', item.value, 'visual-metric-value');
    card.append(top, value);
    if (item.note) {
      const note = el('div', undefined, 'visual-metric-note');
      note.append(inline(item.note));
      card.append(note);
    }
    grid.append(card);
  }
  section.append(grid);
  return section;
}

function renderVisualTimeline(block, inline) {
  const section = el('section', undefined, 'visual-block visual-timeline-block');
  section.setAttribute('aria-label', block.title || 'Visual Timeline');
  if (block.title) section.append(createHeader(block.title, 'visual-timeline'));

  const list = el('ol', undefined, 'visual-timeline-list');
  for (const item of block.items) {
    const li = el('li', undefined, 'visual-timeline-item');
    li.append(el('span', item.marker, 'visual-timeline-marker'));
    const body = el('div', undefined, 'visual-timeline-body');
    const titleEl = el('div', undefined, 'visual-card-title');
    titleEl.append(inline(item.title));
    body.append(titleEl);
    if (item.description) {
      const descEl = el('div', undefined, 'visual-card-desc');
      descEl.append(inline(item.description));
      body.append(descEl);
    }
    li.append(body);
    list.append(li);
  }
  section.append(list);
  return section;
}

function clampSeconds(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(120, Math.max(5, Math.round(n / 5) * 5));
}

function renderSqsVisibilitySimulation(block) {
  const section = el('section', undefined, 'visual-block visual-sim-block');
  section.setAttribute('aria-label', block.title || 'Visibility Timeout Simulator');

  const header = el('div', undefined, 'visual-block-header');
  header.append(el('h3', block.title || 'Visibility Timeout Simulator', 'visual-block-title'));

  const presets = el('div', undefined, 'visual-sim-presets');
  const failBtn = el('button', 'Failure (30s / 60s)', 'button visual-preset-fail');
  failBtn.type = 'button';
  const safeBtn = el('button', 'Safe (90s / 60s)', 'button visual-preset-safe');
  safeBtn.type = 'button';
  presets.append(failBtn, safeBtn);
  header.append(presets);
  section.append(header);

  const initialVt = clampSeconds(block.params.visibilityTimeout, 30);
  const initialPt = clampSeconds(block.params.processingTime, 60);

  const controls = el('div', undefined, 'visual-sim-controls');
  const vtCtrl = makeSimSlider('Visibility Timeout', {
    min: 5,
    max: 120,
    step: 5,
    value: initialVt,
    unit: 's',
  });
  const ptCtrl = makeSimSlider('Processing Time', {
    min: 5,
    max: 120,
    step: 5,
    value: initialPt,
    unit: 's',
  });
  controls.append(vtCtrl.field, ptCtrl.field);
  section.append(controls);

  const timeline = el('div', undefined, 'visual-sim-timeline');
  const scale = el('div', undefined, 'visual-sim-scale');
  for (const tick of ['0s', '30s', '60s', '90s', '120s']) {
    scale.append(el('span', tick));
  }
  timeline.append(scale);

  const makeTrack = (labelText) => {
    const wrap = el('div', undefined, 'visual-sim-track');
    const head = el('div', undefined, 'visual-sim-track-head');
    const readout = el('span', '', 'visual-sim-readout');
    head.append(el('span', labelText), readout);
    const barBg = el('div', undefined, 'visual-sim-bar-bg');
    wrap.append(head, barBg);
    return { wrap, head, readout, barBg };
  };

  const vtTrack = makeTrack('SQS Visibility Window (Message ẩn)');
  const vtBar = el('div', 'Invisible', 'visual-sim-bar is-visibility');
  vtTrack.barBg.append(vtBar);

  const ptTrack = makeTrack('Worker A Processing');
  const ptSafe = el('div', 'OK', 'visual-sim-bar is-safe');
  const ptOver = el('div', 'Overlap!', 'visual-sim-bar is-danger');
  ptTrack.barBg.append(ptSafe, ptOver);

  const wbTrack = makeTrack('Worker B (Nhận lại message cùng lúc)');
  wbTrack.wrap.classList.add('is-danger-track');
  const wbSpacer = el('div', '', 'visual-sim-spacer');
  const wbBar = el('div', 'Worker B xử lý trùng', 'visual-sim-bar is-danger');
  wbTrack.barBg.append(wbSpacer, wbBar);

  timeline.append(vtTrack.wrap, ptTrack.wrap, wbTrack.wrap);
  section.append(timeline);

  const statusBanner = el('div', undefined, 'visual-sim-status');
  statusBanner.setAttribute('role', 'status');
  statusBanner.setAttribute('aria-live', 'polite');
  const statusTitle = el('strong', '', 'visual-sim-status-title');
  const statusDesc = el('span', '', 'visual-sim-status-desc');
  statusBanner.append(statusTitle, statusDesc);
  section.append(statusBanner);

  function update() {
    const vt = Number(vtCtrl.input.value);
    const pt = Number(ptCtrl.input.value);
    const max = 120;

    vtCtrl.valSpan.textContent = `${vt}s`;
    ptCtrl.valSpan.textContent = `${pt}s`;
    vtTrack.readout.textContent = `0s → ${vt}s`;
    ptTrack.readout.textContent = `0s → ${pt}s`;

    vtBar.style.width = `${(vt / max) * 100}%`;
    const safeSec = Math.min(vt, pt);
    const overSec = Math.max(0, pt - vt);
    ptSafe.style.width = `${(safeSec / max) * 100}%`;
    ptOver.style.width = `${(overSec / max) * 100}%`;
    ptOver.hidden = overSec === 0;

    if (pt > vt) {
      wbTrack.wrap.hidden = false;
      wbTrack.readout.textContent = `Xuất hiện lại tại ${vt}s`;
      const leftPct = (vt / max) * 100;
      const widthPct = Math.min(100 - leftPct, Math.max(14, ((pt - vt + 15) / max) * 100));
      wbSpacer.style.width = `${leftPct}%`;
      wbBar.style.width = `${widthPct}%`;

      statusBanner.className = 'visual-sim-status is-danger';
      statusTitle.textContent = 'Duplicate processing risk';
      statusDesc.textContent = `Message có thể xuất hiện lại trước khi được xóa (${pt}s > ${vt}s).`;
    } else {
      wbTrack.wrap.hidden = true;
      statusBanner.className = 'visual-sim-status is-safe';
      statusTitle.textContent = 'Safe';
      statusDesc.textContent = `Message được xử lý và xóa trước khi hết Visibility Timeout (${pt}s ≤ ${vt}s).`;
    }
  }

  vtCtrl.input.addEventListener('input', update);
  ptCtrl.input.addEventListener('input', update);
  failBtn.addEventListener('click', () => {
    vtCtrl.input.value = '30';
    ptCtrl.input.value = '60';
    update();
  });
  safeBtn.addEventListener('click', () => {
    vtCtrl.input.value = '90';
    ptCtrl.input.value = '60';
    update();
  });

  update();
  return section;
}

function clampRange(raw, fallback, min, max, step = 1) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n / step) * step));
}

function renderQueueBufferSimulation(block) {
  const section = el('section', undefined, 'visual-block visual-sim-block');
  const title = block.title || 'Queue Buffer & Worker Scaling Simulator';
  section.setAttribute('aria-label', title);

  const header = el('div', undefined, 'visual-block-header');
  header.append(el('h3', title, 'visual-block-title'));

  const presets = el('div', undefined, 'visual-sim-presets');
  const spikeBtn = el('button', 'Traffic spike (200 / 40 × 3)', 'button visual-preset-fail');
  spikeBtn.type = 'button';
  const scaledBtn = el('button', 'Auto-scaled (200 / 40 × 6)', 'button visual-preset-safe');
  scaledBtn.type = 'button';
  presets.append(spikeBtn, scaledBtn);
  header.append(presets);
  section.append(header);

  const controls = el('div', undefined, 'visual-sim-controls');
  const rpsCtrl = makeSimSlider('Incoming RPS', {
    min: 10,
    max: 500,
    step: 10,
    value: clampRange(block.params.incomingRps, 200, 10, 500, 10),
    unit: ' msg/s',
  });
  const capCtrl = makeSimSlider('Worker Capacity', {
    min: 10,
    max: 100,
    step: 5,
    value: clampRange(block.params.workerCapacity, 40, 10, 100, 5),
    unit: ' msg/s',
  });
  const workersCtrl = makeSimSlider('Workers', {
    min: 1,
    max: 10,
    step: 1,
    value: clampRange(block.params.workers, 3, 1, 10, 1),
    unit: '',
  });
  controls.append(rpsCtrl.field, capCtrl.field, workersCtrl.field);
  section.append(controls);

  const timeline = el('div', undefined, 'visual-sim-timeline');
  const inWrap = el('div', undefined, 'visual-sim-track');
  const inHead = el('div', undefined, 'visual-sim-track-head');
  const inReadout = el('span', '', 'visual-sim-readout');
  inHead.append(el('span', 'Incoming Traffic'), inReadout);
  const inBg = el('div', undefined, 'visual-sim-bar-bg');
  const inBar = el('div', 'Ingress', 'visual-sim-bar is-visibility');
  inBg.append(inBar);
  inWrap.append(inHead, inBg);

  const capWrap = el('div', undefined, 'visual-sim-track');
  const capHead = el('div', undefined, 'visual-sim-track-head');
  const capReadout = el('span', '', 'visual-sim-readout');
  capHead.append(el('span', 'Total Worker Throughput'), capReadout);
  const capBg = el('div', undefined, 'visual-sim-bar-bg');
  const capBar = el('div', 'Capacity', 'visual-sim-bar is-safe');
  capBg.append(capBar);
  capWrap.append(capHead, capBg);

  timeline.append(inWrap, capWrap);
  section.append(timeline);

  const statusBanner = el('div', undefined, 'visual-sim-status');
  statusBanner.setAttribute('role', 'status');
  statusBanner.setAttribute('aria-live', 'polite');
  const statusTitle = el('strong', '', 'visual-sim-status-title');
  const statusDesc = el('span', '', 'visual-sim-status-desc');
  statusBanner.append(statusTitle, statusDesc);
  section.append(statusBanner);

  function update() {
    const rps = Number(rpsCtrl.input.value);
    const cap = Number(capCtrl.input.value);
    const workers = Number(workersCtrl.input.value);
    const totalCap = cap * workers;
    const scaleMax = Math.max(500, rps, totalCap);

    rpsCtrl.valSpan.textContent = `${rps} msg/s`;
    capCtrl.valSpan.textContent = `${cap} msg/s`;
    workersCtrl.valSpan.textContent = String(workers);

    inReadout.textContent = `${rps} msg/s`;
    capReadout.textContent = `${cap} × ${workers} = ${totalCap} msg/s`;

    inBar.style.width = `${(rps / scaleMax) * 100}%`;
    capBar.style.width = `${(totalCap / scaleMax) * 100}%`;

    if (rps > totalCap) {
      statusBanner.className = 'visual-sim-status is-danger';
      statusTitle.textContent = 'Queue đang tích tụ (cần scale worker)';
      statusDesc.textContent = `Queue Depth tăng +${rps - totalCap} msg/s vì tải vào (${rps}) vượt năng lực xử lý (${totalCap}).`;
    } else {
      statusBanner.className = 'visual-sim-status is-safe';
      statusTitle.textContent = 'Hệ thống ổn định';
      statusDesc.textContent = `Worker xử lý kịp tải (${totalCap} ≥ ${rps} msg/s), dư ${totalCap - rps} msg/s.`;
    }
  }

  for (const ctrl of [rpsCtrl, capCtrl, workersCtrl]) {
    ctrl.input.addEventListener('input', update);
  }
  spikeBtn.addEventListener('click', () => {
    rpsCtrl.input.value = '200';
    capCtrl.input.value = '40';
    workersCtrl.input.value = '3';
    update();
  });
  scaledBtn.addEventListener('click', () => {
    rpsCtrl.input.value = '200';
    capCtrl.input.value = '40';
    workersCtrl.input.value = '6';
    update();
  });

  update();
  return section;
}

function renderVisualSimulation(block) {
  if (block.simulationType === 'sqs-visibility-timeout') {
    return renderSqsVisibilitySimulation(block);
  }
  if (block.simulationType === 'queue-buffer') {
    return renderQueueBufferSimulation(block);
  }
  const section = el('section', undefined, 'visual-block visual-sim-block');
  section.setAttribute('aria-label', block.title || block.simulationType);
  section.append(createHeader(block.title || block.simulationType, 'visual-simulation'));
  const list = el('dl', undefined, 'visual-compare-meta');
  list.append(el('dt', 'type'), el('dd', block.simulationType));
  for (const [key, value] of Object.entries(block.params || {})) {
    list.append(el('dt', key), el('dd', String(value)));
  }
  section.append(list);
  return section;
}

const CALLOUT_META = {
  info: { variant: 'is-info', icon: 'book', defaultTitle: 'Ghi chú' },
  tip: { variant: 'is-success', icon: 'zap', defaultTitle: 'Mẹo thực chiến' },
  success: { variant: 'is-success', icon: 'check-circle', defaultTitle: 'Giải pháp' },
  warning: { variant: 'is-warning', icon: 'alert-triangle', defaultTitle: 'Lưu ý' },
  pitfall: { variant: 'is-warning', icon: 'alert-triangle', defaultTitle: 'Cạm bẫy thường gặp' },
  danger: { variant: 'is-danger', icon: 'alert-triangle', defaultTitle: 'Cảnh báo' },
  error: { variant: 'is-danger', icon: 'alert-triangle', defaultTitle: 'Lỗi thường gặp' },
};

function renderVisualCallout(block, inline) {
  const meta = CALLOUT_META[block.tone] || CALLOUT_META.info;
  const title = block.title || meta.defaultTitle;
  const section = el('section', undefined, `visual-block visual-callout-block ${meta.variant}`);
  section.setAttribute('aria-label', title);

  const head = el('div', undefined, 'visual-callout-head');
  const iconWrap = el('span', undefined, 'visual-icon-box');
  iconWrap.append(createIcon(meta.icon));
  head.append(iconWrap, el('strong', title, 'visual-callout-title'));
  section.append(head);

  const body = el('div', undefined, 'visual-callout-body');
  for (const line of block.lines) {
    const p = el('p');
    p.append(inline(line));
    body.append(p);
  }
  section.append(body);
  return section;
}

function renderVisualChecklist(block, inline) {
  const section = el('section', undefined, 'visual-block visual-checklist-block');
  section.setAttribute('aria-label', block.title || 'Visual Checklist');

  const header = el('div', undefined, 'visual-block-header');
  header.append(el('h3', block.title || 'Checklist', 'visual-block-title'));

  const right = el('div', undefined, 'visual-checklist-actions');
  const counter = el('span', '', 'visual-block-badge');
  counter.setAttribute('role', 'status');
  counter.setAttribute('aria-live', 'polite');
  const resetBtn = el('button', 'Đặt lại', 'button visual-checklist-reset');
  resetBtn.type = 'button';
  right.append(counter, resetBtn);
  header.append(right);
  section.append(header);

  const list = el('div', undefined, 'visual-checklist-list');
  const inputs = [];

  function syncCounter() {
    const done = inputs.filter((input) => input.checked).length;
    counter.textContent = `${done}/${inputs.length} đã hoàn thành`;
    inputs.forEach((input) => {
      input.closest('.visual-checklist-item')?.classList.toggle('is-checked', input.checked);
    });
  }

  for (const item of block.items) {
    const label = el('label', undefined, 'visual-checklist-item');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(item.checked);
    checkbox.addEventListener('change', syncCounter);
    const text = el('span', undefined, 'visual-checklist-text');
    text.append(inline(item.text));
    label.append(checkbox, text);
    inputs.push(checkbox);
    list.append(label);
  }

  resetBtn.addEventListener('click', () => {
    inputs.forEach((input, idx) => {
      input.checked = Boolean(block.items[idx].checked);
    });
    syncCounter();
  });

  syncCounter();
  section.append(list);
  return section;
}

let tabCounter = 0;

function renderVisualTabs(block, inline) {
  const instanceId = ++tabCounter;
  const section = el('section', undefined, 'visual-block visual-tabs-block');
  section.setAttribute('aria-label', block.title || 'Visual Tabs');
  if (block.title) section.append(createHeader(block.title, 'visual-tabs'));

  const tablist = el('div', undefined, 'visual-tabs-list');
  tablist.setAttribute('role', 'tablist');

  const panelsWrap = el('div', undefined, 'visual-tabs-panels');
  const tabButtons = [];
  const tabPanels = [];
  let activeIndex = 0;

  function selectTab(nextIndex, moveFocus = false) {
    activeIndex = (nextIndex + block.tabs.length) % block.tabs.length;
    tabButtons.forEach((btn, idx) => {
      const selected = idx === activeIndex;
      btn.setAttribute('aria-selected', String(selected));
      btn.tabIndex = selected ? 0 : -1;
      btn.classList.toggle('is-active', selected);
    });
    tabPanels.forEach((panel, idx) => {
      panel.hidden = idx !== activeIndex;
    });
    if (moveFocus) tabButtons[activeIndex]?.focus();
  }

  block.tabs.forEach((tab, idx) => {
    const tabId = `visual-tab-${instanceId}-${idx}`;
    const panelId = `visual-panel-${instanceId}-${idx}`;
    const btn = el('button', tab.name, 'button visual-tab-btn');
    btn.type = 'button';
    btn.id = tabId;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', panelId);
    btn.addEventListener('click', () => selectTab(idx));
    btn.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        selectTab(idx + 1, true);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        selectTab(idx - 1, true);
      }
    });

    const panel = el('div', undefined, 'visual-tab-panel');
    panel.id = panelId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabId);
    for (const line of tab.lines) {
      const p = el('p');
      p.append(inline(line));
      panel.append(p);
    }

    tabButtons.push(btn);
    tabPanels.push(panel);
    tablist.append(btn);
    panelsWrap.append(panel);
  });

  selectTab(0);
  section.append(tablist, panelsWrap);
  return section;
}

function renderVisualDecision(block, inline) {
  const section = el('section', undefined, 'visual-block visual-decision-block');
  section.setAttribute('aria-label', block.title || 'Visual Decision');
  if (block.title) section.append(createHeader(block.title, 'visual-decision'));

  const list = el('div', undefined, 'visual-decision-list');
  for (const rule of block.rules) {
    const card = el('div', undefined, 'visual-decision-card');
    const row = el('div', undefined, 'visual-decision-row');

    const condWrap = el('div', undefined, 'visual-decision-cond');
    condWrap.append(el('span', 'Khi', 'visual-decision-tag'));
    const condText = el('span');
    condText.append(inline(rule.condition));
    condWrap.append(condText);

    const arrow = el('span', '→', 'visual-decision-arrow');
    arrow.setAttribute('aria-hidden', 'true');

    const choiceWrap = el('div', undefined, 'visual-decision-choice');
    choiceWrap.append(el('span', 'Chọn', 'visual-decision-tag is-choice'));
    const choiceText = el('strong');
    choiceText.append(inline(rule.choice));
    choiceWrap.append(choiceText);

    row.append(condWrap, arrow, choiceWrap);
    card.append(row);

    if (rule.reason) {
      const reasonEl = el('p', undefined, 'visual-card-desc');
      reasonEl.append(inline(rule.reason));
      card.append(reasonEl);
    }
    list.append(card);
  }
  section.append(list);
  return section;
}

export function renderVisualBlock(block, { inline }) {
  switch (block.type) {
    case 'visual_grid':
      return renderVisualGrid(block, inline);
    case 'visual_flow':
      return renderVisualFlow(block, inline);
    case 'visual_compare':
      return renderVisualCompare(block, inline);
    case 'visual_metrics':
      return renderVisualMetrics(block, inline);
    case 'visual_timeline':
      return renderVisualTimeline(block, inline);
    case 'visual_simulation':
      return renderVisualSimulation(block);
    case 'visual_callout':
      return renderVisualCallout(block, inline);
    case 'visual_checklist':
      return renderVisualChecklist(block, inline);
    case 'visual_tabs':
      return renderVisualTabs(block, inline);
    case 'visual_decision':
      return renderVisualDecision(block, inline);
    default:
      return el('p', `Không hỗ trợ visual block: ${block.type}`, 'lesson-error');
  }
}
