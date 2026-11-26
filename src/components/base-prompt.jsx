'use client';
import { useEffect, useState } from 'react';
import { readCatalog, saveBasePrompts } from '../services/study-library-client';
import { Button, Status } from './ui/primitives';

const EMPTY_DRAFT = { badge: '', title: '', summary: '', content: '' };

function makePromptId(title) {
  const slug = String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = crypto.randomUUID().slice(0, 8);
  return slug ? `${slug}-${suffix}` : `prompt-${suffix}`;
}

export default function BasePrompt() {
  const [prompts, setPrompts] = useState([]);
  const [openId, setOpenId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [confirmDeleteId, setConfirmDeleteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    readCatalog('visual-samples')
      .then((data) => {
        if (!active) return;
        setPrompts(Array.isArray(data?.basePrompts) ? data.basePrompts : []);
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || 'Không tải được danh mục Base Prompt từ Turso.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function showNotice(text) {
    setNotice(text);
    setTimeout(() => {
      setNotice((current) => (current === text ? '' : current));
    }, 3000);
  }

  async function copyPrompt(prompt) {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setError('');
      setCopiedId(prompt.id);
      showNotice(`✓ Đã copy ${prompt.title}.`);
      setTimeout(() => {
        setCopiedId((current) => (current === prompt.id ? '' : current));
      }, 3000);
    } catch {
      setNotice('');
      setError('Không copy được tự động. Hãy mở mục rồi bôi đen khung mã và nhấn Ctrl+C.');
    }
  }

  async function persistPrompts(nextList, successMessage) {
    setSaving(true);
    setError('');
    try {
      const saved = await saveBasePrompts(nextList);
      setPrompts(Array.isArray(saved?.basePrompts) ? saved.basePrompts : nextList);
      showNotice(successMessage);
      return true;
    } catch (err) {
      setError(err?.message || 'Không lưu được lên Turso. Hãy thử lại.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function startCreate() {
    setCreating(true);
    setEditingId('');
    setConfirmDeleteId('');
    setDraft(EMPTY_DRAFT);
    setError('');
  }

  function startEdit(prompt) {
    setCreating(false);
    setEditingId(prompt.id);
    setOpenId(prompt.id);
    setConfirmDeleteId('');
    setDraft({
      badge: prompt.badge || '',
      title: prompt.title || '',
      summary: prompt.summary || '',
      content: prompt.content || '',
    });
    setError('');
  }

  async function handleCreateSubmit(event) {
    event.preventDefault();
    if (!draft.badge.trim() || !draft.title.trim() || !draft.content.trim()) {
      setError('Cần nhập đủ Danh mục, Tiêu đề và Nội dung prompt.');
      return;
    }
    const newItem = {
      id: makePromptId(draft.title),
      badge: draft.badge.trim(),
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      content: draft.content.trim(),
    };
    const ok = await persistPrompts([newItem, ...prompts], '✓ Đã thêm prompt mới lên Turso.');
    if (ok) {
      setCreating(false);
      setDraft(EMPTY_DRAFT);
      setOpenId(newItem.id);
    }
  }

  async function handleUpdateSubmit(event, targetId) {
    event.preventDefault();
    if (!draft.badge.trim() || !draft.title.trim() || !draft.content.trim()) {
      setError('Cần nhập đủ Danh mục, Tiêu đề và Nội dung prompt.');
      return;
    }
    const nextList = prompts.map((item) =>
      item.id === targetId
        ? {
            ...item,
            badge: draft.badge.trim(),
            title: draft.title.trim(),
            summary: draft.summary.trim(),
            content: draft.content.trim(),
          }
        : item,
    );
    const ok = await persistPrompts(nextList, '✓ Đã cập nhật lên Turso.');
    if (ok) setEditingId('');
  }

  async function handleDelete(targetId) {
    const nextList = prompts.filter((item) => item.id !== targetId);
    const ok = await persistPrompts(nextList, '✓ Đã xóa prompt trên Turso.');
    if (ok) {
      setConfirmDeleteId('');
      if (openId === targetId) setOpenId('');
      if (editingId === targetId) setEditingId('');
    }
  }

  function renderFormFields() {
    return (
      <div className="visual-prompt-form-grid">
        <label className="field">
          Danh mục / Badge
          <input
            type="text"
            value={draft.badge}
            onChange={(e) => setDraft((prev) => ({ ...prev, badge: e.target.value }))}
            placeholder="Ví dụ: AWS SAA"
            required
          />
        </label>
        <label className="field">
          Tiêu đề
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Ví dụ: AWS SAA — Problem-driven Mini Textbook"
            required
          />
        </label>
        <label className="field visual-prompt-field-full">
          Mô tả ngắn
          <input
            type="text"
            value={draft.summary}
            onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))}
            placeholder="Mô tả mục đích của base prompt"
          />
        </label>
        <label className="field visual-prompt-field-full">
          Nội dung prompt
          <textarea
            rows={10}
            value={draft.content}
            spellCheck={false}
            onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
            placeholder="Dán nội dung base prompt tại đây…"
            required
          />
        </label>
      </div>
    );
  }

  return (
    <div className="visual-samples-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Visual DSL / Danh mục Prompt</p>
          <h1>
            Base Prompt
            <span className="heading-dot" aria-hidden="true">
              .
            </span>
          </h1>
          <p className="intro">
            Quản lý danh mục prompt trực tiếp trên Turso — click để mở xem, chỉnh sửa hoặc copy
            nhanh.
          </p>
        </div>
        <span className="page-stamp" aria-hidden="true">
          ✦
        </span>
      </div>

      <div className="visual-prompt-toolbar">
        <Button variant="primary" disabled={saving || loading} onClick={startCreate}>
          ＋ Thêm prompt
        </Button>
      </div>

      <Status error>{error}</Status>
      <Status>{notice}</Status>
      {loading && <Status>Đang tải danh mục Base Prompt từ Turso…</Status>}

      {creating && (
        <form className="visual-prompt-form" onSubmit={handleCreateSubmit}>
          <h2>Thêm Base Prompt mới</h2>
          {renderFormFields()}
          <div className="visual-prompt-body-actions">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Đang lưu Turso…' : 'Lưu lên Turso'}
            </Button>
            <Button disabled={saving} onClick={() => setCreating(false)}>
              Hủy
            </Button>
          </div>
        </form>
      )}

      <div className="visual-prompts-list">
        {prompts.map((prompt) => {
          const isOpen = openId === prompt.id;
          const isEditing = editingId === prompt.id;
          const isConfirmingDelete = confirmDeleteId === prompt.id;
          const panelId = `prompt-panel-${prompt.id}`;
          return (
            <article key={prompt.id} className="visual-prompt-item">
              <div className="visual-prompt-row">
                <button
                  type="button"
                  className="visual-prompt-trigger"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenId(isOpen ? '' : prompt.id)}
                >
                  <span className="visual-prompt-trigger-main">
                    <span className="visual-block-badge">{prompt.badge || 'Base Prompt'}</span>
                    <strong className="visual-prompt-title">{prompt.title}</strong>
                    <span className="visual-prompt-summary">{prompt.summary}</span>
                  </span>
                  <span className="visual-prompt-chevron" aria-hidden="true">
                    {isOpen ? '▴' : '▾'}
                  </span>
                </button>
                <div className="visual-prompt-copy-wrap">
                  <Button variant="primary" onClick={() => copyPrompt(prompt)}>
                    {copiedId === prompt.id ? '✓ Đã copy' : 'Copy'}
                  </Button>
                </div>
              </div>
              <div id={panelId} className="visual-prompt-body" hidden={!isOpen}>
                {isEditing ? (
                  <form
                    className="visual-prompt-form"
                    onSubmit={(event) => handleUpdateSubmit(event, prompt.id)}
                  >
                    {renderFormFields()}
                    <div className="visual-prompt-body-actions">
                      <Button type="submit" variant="primary" disabled={saving}>
                        {saving ? 'Đang lưu Turso…' : 'Cập nhật lên Turso'}
                      </Button>
                      <Button disabled={saving} onClick={() => setEditingId('')}>
                        Hủy
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <pre
                      className="visual-prompt-pre"
                      onClick={() => copyPrompt(prompt)}
                      title="Nhấn để copy Base Prompt"
                    >
                      <code>{prompt.content}</code>
                    </pre>
                    <div className="visual-prompt-body-actions">
                      <Button onClick={() => startEdit(prompt)}>Chỉnh sửa</Button>
                      {!isConfirmingDelete ? (
                        <Button onClick={() => setConfirmDeleteId(prompt.id)}>Xóa</Button>
                      ) : (
                        <div className="visual-prompt-confirm">
                          <Button
                            variant="primary"
                            disabled={saving}
                            onClick={() => handleDelete(prompt.id)}
                          >
                            {saving ? 'Đang xóa…' : 'Xác nhận xóa'}
                          </Button>
                          <Button disabled={saving} onClick={() => setConfirmDeleteId('')}>
                            Hủy
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
