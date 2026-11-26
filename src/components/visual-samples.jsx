'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import LessonParser from '../services/lesson-parser.cjs';
import { VISUAL_ICON_NAMES, createVisualIcon, renderVisualBlock } from './visual-blocks';
import { readCatalog } from '../services/study-library-client';
import { Button, Status } from './ui/primitives';

const FILTERS = [
  ['all', 'Tất cả'],
  ['visual-grid', 'visual-grid'],
  ['visual-flow', 'visual-flow'],
  ['visual-compare', 'visual-compare'],
  ['visual-metrics', 'visual-metrics'],
  ['visual-timeline', 'visual-timeline'],
  ['visual-simulation', 'visual-simulation'],
  ['visual-callout', 'visual-callout'],
  ['visual-checklist', 'visual-checklist'],
  ['visual-tabs', 'visual-tabs'],
  ['visual-decision', 'visual-decision'],
  ['full-lesson', 'Bài đầy đủ'],
];

function createInlineHelper() {
  return (text) => {
    const span = document.createElement('span');
    span.innerHTML = DOMPurify.sanitize(marked.parseInline(text), {
      ALLOWED_TAGS: ['code', 'strong', 'em', 'del', 'br'],
      ALLOWED_ATTR: [],
    });
    return span;
  };
}

function SamplePreview({ markdown }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    root.replaceChildren();
    const inline = createInlineHelper();
    const blocks = LessonParser.parse(markdown);
    for (const block of blocks) {
      if (block.type.startsWith('visual_')) {
        root.append(renderVisualBlock(block, { inline }));
      } else if (block.type === 'deck') {
        const note = document.createElement('p');
        note.className = 'visual-sample-deck-note';
        note.textContent = `Mini Quiz (${block.quizzes.length} câu) — mở trong /markdown để luyện tập tương tác.`;
        root.append(note);
      } else if (block.type === 'error') {
        const err = document.createElement('p');
        err.className = 'lesson-error';
        err.textContent = block.content;
        root.append(err);
      } else {
        const section = document.createElement('section');
        section.innerHTML = DOMPurify.sanitize(marked.parse(block.content), {
          USE_PROFILES: { html: true },
          SANITIZE_NAMED_PROPS: true,
        });
        root.append(section);
      }
    }
  }, [markdown]);

  return <div ref={containerRef} className="visual-sample-preview" />;
}

function IconCatalog() {
  const gridRef = useRef(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.replaceChildren();
    for (const name of VISUAL_ICON_NAMES) {
      const chip = document.createElement('div');
      chip.className = 'visual-icon-chip';
      const box = document.createElement('span');
      box.className = 'visual-icon-box';
      box.append(createVisualIcon(name));
      const label = document.createElement('code');
      label.textContent = name;
      chip.append(box, label);
      grid.append(chip);
    }
  }, []);

  return <div ref={gridRef} className="visual-icon-catalog" />;
}

export default function VisualSamples() {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [copiedId, setCopiedId] = useState('');
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    let active = true;
    readCatalog('visual-samples')
      .then((data) => {
        if (!active) return;
        setSamples(Array.isArray(data?.samples) ? data.samples : []);
        setLoadError('');
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error?.message || 'Không tải được danh sách mẫu từ Turso.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(
    () => (filter === 'all' ? samples : samples.filter((s) => s.blockType === filter)),
    [filter, samples],
  );
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  async function handleCopy(sample) {
    try {
      await navigator.clipboard.writeText(sample.markdown);
      setCopyError('');
      setCopiedId(sample.id);
      setTimeout(() => {
        setCopiedId((current) => (current === sample.id ? '' : current));
      }, 2500);
    } catch {
      setCopyError('Không copy được tự động. Hãy bôi đen khung mã bên dưới và nhấn Ctrl+C.');
    }
  }

  return (
    <div className="visual-samples-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Visual DSL / Mẫu tham khảo</p>
          <h1>
            Visual Samples
            <span className="heading-dot" aria-hidden="true">
              .
            </span>
          </h1>
          <p className="intro">
            Xem trước tất cả block visual được hỗ trợ, copy cú pháp Markdown chuẩn hoặc mở thử trực
            tiếp trong Markdown &amp; Quiz.
          </p>
        </div>
        <span className="page-stamp" aria-hidden="true">
          ❖
        </span>
      </div>

      <div className="visual-samples-filters" role="group" aria-label="Lọc loại visual block">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`button ${filter === id ? 'button-primary' : 'button-secondary'}`}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <Status error>{loadError || copyError}</Status>
      {loading && <Status>Đang tải mẫu từ Turso…</Status>}

      <div className="visual-samples-list">
        {items.map((sample) => (
          <article
            key={sample.id}
            className="visual-sample-card"
            aria-labelledby={`title-${sample.id}`}
          >
            <header className="visual-sample-card-head">
              <div>
                <div className="visual-sample-meta-row">
                  <span className="visual-block-badge">{sample.blockType}</span>
                </div>
                <h2 id={`title-${sample.id}`}>{sample.title}</h2>
                <p className="visual-sample-summary">{sample.summary}</p>
                <p className="visual-sample-hint">
                  <strong>Cú pháp:</strong> {sample.syntaxHint}
                </p>
              </div>
              <div className="visual-sample-actions">
                <Button onClick={() => handleCopy(sample)}>
                  {copiedId === sample.id ? '✓ Đã copy' : 'Copy Markdown'}
                </Button>
                <a
                  className="button button-primary"
                  href={`${basePath}/markdown/#psa-content=${encodeURIComponent(sample.markdown)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mở trong /markdown ↗
                </a>
              </div>
            </header>

            <SamplePreview markdown={sample.markdown} />

            <details className="visual-sample-source">
              <summary>Xem mã Markdown gốc</summary>
              <pre>
                <code>{sample.markdown}</code>
              </pre>
            </details>
          </article>
        ))}
      </div>

      <details className="visual-icons-panel">
        <summary>Danh sách icon dựng sẵn ({VISUAL_ICON_NAMES.length} icon)</summary>
        <p className="visual-sample-summary">
          Dùng tên icon ở cột đầu tiên trong <code>visual-grid</code>, <code>visual-flow</code>,{' '}
          <code>visual-metrics</code> hoặc trường <code>icon:</code> trong{' '}
          <code>visual-compare</code>.
        </p>
        <IconCatalog />
      </details>
    </div>
  );
}
