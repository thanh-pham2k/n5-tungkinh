TL;DR Next.js + Neobrutalism là nền UI đã được chủ dự án chọn ngày 2026-10-24.

# Quyết định dự án

## UI-01: Next.js với Neobrutalism, thay Ant Design

- Người quyết định/chịu trách nhiệm sản phẩm: chủ dự án, xác nhận trong chat: “Chuyển sang sử dụng nextjs và neobrutalism”.
- Phạm vi: toàn bộ frontend trong đợt refactor này và các thay đổi tiếp theo.
- Lý do: giao diện mobile first theo neobrutalism.com và sample được cung cấp; giữ luồng học hiện có.
- Giải pháp: Next.js App Router 16.4.3 + React 19.3.1; component React và CSS token của dự án. Không sử dụng Ant Design hoặc tự thêm thư viện UI khác.
- Ảnh hưởng: không áp dụng phần Ant Design của UI-01; UI-04 về SSR Ant Design không áp dụng. Các rule accessibility, tách trách nhiệm và contract vẫn áp dụng.
- Điều kiện xem lại: thay đổi định hướng UI hoặc có nhu cầu component mà lớp hiện tại không đáp ứng.

## Build, hosting và Turso — cập nhật theo yêu cầu chủ dự án

- Ngày 2026-10-24, chủ dự án cung cấp kết nối Turso và yêu cầu cấu hình để tự deploy Vercel. Đây là lựa chọn hạ tầng mới, thay phần “chưa chọn host” của đợt refactor ban đầu.
- vercel.json khai báo Next.js, npm ci, npm run build và output .next. Khi VERCEL=1 (biến hệ thống Vercel), không bật static export để có runtime server cho các tính năng DB sau này. Build local mặc định vẫn output: 'export' và tạo out/.
- Database URL/token nằm trong TURSO_DATABASE_URL và TURSO_AUTH_TOKEN; local lưu .env.local được Git và Vercel upload bỏ qua. Chỉ cấp credential qua Vercel Environment Variables theo từng môi trường; không đưa token vào source hoặc client.
- Mới cấu hình kết nối và script kiểm tra SELECT 1. Chưa tạo schema, migration, API hoặc chuyển bộ bài sang Turso. Khi có yêu cầu schema, dùng Liquibase và chốt naming/prefix trước migration đầu tiên.
- Chưa deploy, chưa cấu hình tài khoản Vercel từ phiên làm việc này. Chủ dự án thực hiện publish theo [hướng dẫn Vercel](vercel-deployment.md).
- UI-06/IMG: chưa thay hệ thống ảnh/CSV đang có bằng BLOB database; không tự thêm schema ảnh khi chưa có yêu cầu tính năng.

## Dữ liệu và nội dung

- `docs/ielts/practice-data.js` tiếp tục là output đồng bộ chuẩn từ road-2-ielts; build chuyển JSON sang module trong `src/data/`, không sửa nội dung học.
- CSV cũ được giữ, kể cả tên `example_ja` khi chứa tiếng Anh.
- Audio public chỉ được lập danh mục khi MP3 tồn tại thực tế trong output/. Không tạo mục audio giả. File local vẫn dùng được khi checkout thiếu MP3 public.
- Writing là nhập bài và tự đối chiếu mẫu, không chấm AI/band.
- Bỏ Kana, thư viện Kanji riêng và Final Review MCQ; giữ Furigana/Kanji trong nội dung các màn còn lại.
- Cập nhật theo yêu cầu dọn repo ngày 2026-10-24: xóa các resource cũ nihongo_char, nihongo_kanji, nihongo_mcqs, nihongo_practices, nihongo_vocab, summary_checklist, temp_anki và docs/input. Build hiện dùng docs/ielts/ và input/ ở root; giữ công cụ audio, node_modules local và cấu hình deploy.

## Mapping kiến trúc

- `src/app/`: route/layout và điểm vào CSS.
- `src/components/ui/`: button, dialog, CSV import, progress và trạng thái dùng chung.
- `src/components/study/`: component theo tính năng; controller Hot Review quản lý DOM tương tác riêng bên trong host React.
- `src/components/markdown-controller.js`: tương tác editor/quiz/Mermaid; chỉ khởi tạo sau khi DOM và thư viện sẵn sàng.
- `src/services/`: parser/contract, kiểm tra đáp án và tạo/phát audio; không truy cập DB.
- `src/hooks/`: state vòng đời audio và tải bộ dữ liệu.
- `src/styles/`: token là nguồn chính; styles nền và theo tính năng dùng token chung.

Controller của Hot Review và Markdown được giữ trong ranh giới feature để bảo toàn hành vi phức tạp; không chèn toàn trang HTML sample, iframe hoặc script nội tuyến vào Next.js.
