TL;DR Ứng dụng học tiếng Nhật, tiếng Anh và IELTS bằng Next.js, giao diện Neobrutalism mobile first.

# Kotoba Lab

Các chế độ: Instant Vocab, Vocab Review, Word Order, Typing Review, Sentence Structures, Speaking Questions, Writing Review, Multiple Choice và Markdown & Quiz.

## Chạy local

Yêu cầu Node.js 22 (đã kiểm tra với 22.13.1), npm 10.

```powershell
npm ci
npm run dev
```

Đặt TURSO_DATABASE_URL và TURSO_AUTH_TOKEN trong .env.local; DB cần schema/catalog theo [database.md](docs/database.md). Mở http://127.0.0.1:3000. Nội dung runtime chỉ tải từ Turso qua API server; build không import/migrate/seed DB.

```powershell
npm test
npm run build
npm run test:browser
npm run preview
```

Build tạo ứng dụng server trong `.next/`. Preview chạy Next.js tại http://127.0.0.1:4173. Browser test dùng Edge và DB SQLite fixture riêng; không ghi test vào Turso thật. Không chạy preview cùng cổng trong khi test.

## Cấu trúc

- `src/app/`: layout, route `/` và `/markdown/`.
- `src/components/ui/`: control, dialog, nhập CSV, progress và trạng thái chung.
- `src/components/study/`: component theo công cụ học.
- `src/services/`, `src/hooks/`: parser, kiểm tra đáp án, tải dữ liệu và audio.
- `src/styles/`: token Neobrutalism, style nền và theo tính năng.
- `docs/ielts/`: tài liệu và dữ liệu được đồng bộ từ road-2-ielts; giữ nguyên nguồn này.
- `input/`, `output/`, `make_vocab_audio.py`: nguồn và công cụ tạo MP3 độc lập, không còn tích hợp trong ứng dụng.
- `src/modules/study/`: API/service/repository Turso; `src/contracts/` là schema runtime sinh OpenAPI.
- `database/`: Liquibase changelog và đầu vào seed catalog; không đọc các file này từ request hoặc bundle client.
- `tests/`: kiểm tra contract, parser và tương tác trên trình duyệt.

## Nhập bài và audio

Dán CSV hoặc chọn bộ IELTS có sẵn. Tên cột CSV cũ được giữ, kể cả `example_ja` khi học tiếng Anh. Writing Review nhận `context,prompt,input,sample_answer` và hỗ trợ tự so sánh bài mẫu, không chấm AI/band.

Mỗi lần parse hợp lệ lưu nội dung và một record học trên Turso. Nhấn **Bài đã lưu** trong từng công cụ để mở lại; thư viện dùng chung cho mọi người, không cần đăng nhập. Ôn sau/đáp án Multiple Choice, bài viết và đáp án quiz Markdown lưu DB theo cookie phiên riêng. Không lưu bài vào localStorage/sessionStorage; chỉ âm lượng UI còn là tùy chọn local. Các công cụ từ vựng/luyện câu dùng Sound of Text để phát âm và cần kết nối mạng.

Audio Looper đã được bỏ theo yêu cầu chủ dự án; build không lập danh mục hoặc copy thư viện MP3. Phát âm trong các công cụ học vẫn dùng Sound of Text và cài đặt audio chung.

## Hướng dẫn dự án

- [Quyết định stack và ngoại lệ blueprint](docs/project-decisions.md).
- [Định hướng UI](docs/ui-direction.md).
- [Local, environment và release](docs/runbook.md).
- [Kế hoạch và kiểm kê refactor](docs/refactor-plan.md).
- [Báo cáo kiểm chứng và giới hạn](docs/refactor-verification.md).
- [Markdown & Quiz](docs/MARKDOWN_QUIZ.md).
- [Định dạng và luồng Multiple Choice](docs/MULTIPLE_CHOICE.md).
- [Schema, migration, thư viện Turso và quyền dữ liệu](docs/database.md).
- [Đồng bộ nội dung IELTS](IELTS_UPDATE_NOTES.md).

## Xuất bản trên Vercel

Đã có vercel.json tại root. Vercel dùng Next.js server build (.next); local mặc định vẫn export ra out/ để chạy bộ kiểm tra và preview.

Đặt TURSO_DATABASE_URL và TURSO_AUTH_TOKEN trong Vercel Environment Variables; token chỉ dùng phía server. .env.local bị Git/Vercel upload bỏ qua. Schema và catalog đã được đưa vào Turso đã cấp; môi trường DB mới cần migration/seed riêng, không chạy chúng từ build.

Xem [hướng dẫn deploy Vercel](docs/vercel-deployment.md). API đọc/ghi DB đã triển khai; code mới chưa được deploy từ phiên làm việc này.
