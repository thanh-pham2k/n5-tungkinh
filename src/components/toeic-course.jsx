'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button, Dialog, Status } from './ui/primitives';
import MarkdownWorkspace from './markdown-workspace';
import LoginView from './auth/login-view';
import useAuth from '../hooks/use-auth';
import { studyRequest } from '../services/study-library-client';
import { formatReviewTime } from '../services/review-time';

const TITLES = [
  'Contracts — Hợp đồng',
  'Marketing — Tiếp thị',
  'Warranties — Bảo hành',
  'Business Planning — Kế hoạch kinh doanh',
  'Conferences — Hội nghị',
  'Computers — Máy tính',
  'Office Technology — Công nghệ văn phòng',
  'Office Procedures — Thủ tục văn phòng',
  'Electronics — Điện tử',
  'Correspondence — Thư tín',
  'Job Advertising and Recruiting — Mô tả công việc và Tuyển dụng',
  'Applying and Interviewing — Ứng tuyển và Phỏng vấn',
  'Hiring and Training — Tuyển dụng và Đào tạo',
  'Salaries and Benefits — Lương và Phúc lợi',
  'Promotions, Pensions and Awards — Thăng tiến, Lương hưu và Giải thưởng',
  'Shopping — Mua sắm',
  'Ordering Supplies — Đặt hàng nhà cung cấp',
  'Shipping — Vận chuyển',
  'Invoices — Hóa đơn',
  'Inventory — Hàng hóa',
  'Banking — Giao dịch ngân hàng',
  'Accounting — Kế toán',
  'Investments — Đầu tư',
  'Financial Statements — Báo cáo tài chính',
  'Taxes — Thuế',
  'Property and Departments — Tài sản và Phòng ban',
  'Board meetings and Committees — Họp Hội đồng và Phòng ban',
  'Product Development — Phát triển sản phẩm',
  'Quality Control — Quản trị chất lượng',
  'Renting and Leasing — Thuê và Cho thuê',
  'Selecting A Restaurant — Chọn nhà hàng',
  'Eating out — Đi ăn ngoài',
  'Ordering Lunch — Đặt bữa trưa',
  'Cooking As A Career — Nấu ăn là sự nghiệp',
  'Events — Sự kiện',
  'General Travel — Du lịch',
  'Airlines — Hàng không',
  'Trains — Xe lửa',
  'Hotels — Khách sạn',
  'Car Rentals — Thuê ô tô',
  'Movies — Phim ảnh',
  'Theater — Rạp phim',
  'Music — Âm nhạc',
  'Museums — Bảo tàng',
  'Media — Truyền thông',
  'Dentist’s Office — Phòng khám nha khoa',
  'Doctor’s Office — Phòng khám bác sĩ',
  'Health Insurance — Bảo hiểm sức khỏe',
  'Hospitals — Bệnh viện',
  'Pharmacy — Hiệu thuốc',
];

function matchesTitle(header, title, index) {
  const english = title.split(' — ')[0].toLowerCase();
  const clean = header
    .replace(/^#\s*/, '')
    .replace(/^Nhóm\s+\d+:\s*/i, '')
    .trim()
    .toLowerCase();
  const names = index === 9 ? [english, 'correspondences'] : [english];
  return names.some(
    (name) => clean === name || clean.startsWith(`${name} —`) || clean.startsWith(`${name} (`),
  );
}

export default function ToeicCourse({ onLogout }) {
  const { user, loading, setUser, logout } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(0);
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      let cursor;
      const matches = [];
      do {
        const query = new URLSearchParams({
          tool: 'markdown',
          limit: '100',
          ...(cursor ? { cursor } : {}),
        });
        const listing = await studyRequest(`/study-contents?${query}`);
        matches.push(
          ...listing.data.filter((item) =>
            TITLES.some((title, index) => matchesTitle(item.title, title, index)),
          ),
        );
        cursor = listing.meta.page.nextCursor;
      } while (cursor);
      const records = await Promise.all(
        matches.map(async (item) => (await studyRequest(`/study-contents/${item.id}`)).data),
      );
      setLessons(
        TITLES.map((title, index) => {
          const record = records.find(
            (item) =>
              matchesTitle(item.source.split('\n')[0], title, index) &&
              !item.source.includes('**Các lỗi quan trọng đã chỉnh:**'),
          );
          return {
            ...record,
            title,
            label: `Nhóm ${index + 1}`,
            number: index + 1,
            completedAt: record?.progress?.foundationCompletedAt || null,
          };
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (user?.username === 'yentr') load();
  }, [user, load]);
  useEffect(() => {
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  if (loading) return <Status>Đang kiểm tra phiên đăng nhập…</Status>;
  if (!user) return <LoginView onLoginSuccess={setUser} />;
  if (user.username !== 'yentr')
    return (
      <main className="foundation-page">
        <Status error>Bạn không có quyền xem mục này.</Status>
        <a className="button" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`}>
          ← Công cụ học
        </a>
      </main>
    );
  return (
    <main className="foundation-page">
      <Button variant="secondary" onClick={onLogout || logout}>
        Đăng xuất
      </Button>
      <p className="eyebrow">TOEIC</p>
      <h1>600 từ vựng TOEIC</h1>
      {busy && <Status>Đang tải bài học…</Status>}
      {error && (
        <>
          <Status error>{error}</Status>
          <button className="button" onClick={load}>
            Thử lại
          </button>
        </>
      )}
      {!busy &&
        !error &&
        Array.from({ length: 10 }, (_, part) => {
          const ordered = lessons
            .slice(part * 5, part * 5 + 5)
            .sort((a, b) =>
              !a.completedAt
                ? b.completedAt
                  ? -1
                  : 0
                : !b.completedAt
                  ? 1
                  : a.completedAt.localeCompare(b.completedAt),
            );
          return (
            <details className="foundation-phase" key={part} open={part === 0 ? true : undefined}>
              <summary className="foundation-phase-toggle">
                <span>
                  Part {part + 1} · Nhóm {part * 5 + 1}–{part * 5 + 5}
                </span>
                <span className="foundation-phase-icon" aria-hidden="true" />
              </summary>
              {ordered.map((item) => (
                <button
                  key={item.number}
                  className="foundation-lesson"
                  type="button"
                  disabled={!item.id}
                  onClick={() => setSelected(item)}
                >
                  <span className="foundation-lesson-main">
                    <span
                      className={`foundation-status ${item.completedAt ? 'is-complete' : ''}`}
                      role="img"
                      aria-label={
                        !item.id
                          ? 'Chưa có nội dung'
                          : item.completedAt
                            ? 'Đã hoàn thành'
                            : 'Chưa hoàn thành'
                      }
                    >
                      {item.completedAt && <span aria-hidden="true">✓</span>}
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <br />
                      {item.title}
                      {!item.id && (
                        <>
                          <br />
                          <small>Chưa có nội dung</small>
                        </>
                      )}
                      {item.completedAt && (
                        <time className="foundation-completed-time" dateTime={item.completedAt}>
                          {formatReviewTime(item.completedAt, clock)}
                        </time>
                      )}
                    </span>
                  </span>
                  {item.id && (
                    <span className="foundation-lesson-arrow" aria-hidden="true">
                      ↗
                    </span>
                  )}
                </button>
              ))}
            </details>
          );
        })}
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || 'Bài học'}
        wide
      >
        {selected && (
          <MarkdownWorkspace
            foundation={{ ...selected, vocabularyAudio: true }}
            onFoundationComplete={(completedAt) => {
              setClock(Date.now());
              setLessons((current) =>
                current.map((item) => (item.id === selected.id ? { ...item, completedAt } : item)),
              );
            }}
          />
        )}
      </Dialog>
    </main>
  );
}
