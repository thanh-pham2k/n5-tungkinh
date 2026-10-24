TL;DR Ứng dụng học tiếng Nhật, tiếng Anh và IELTS bằng Next.js, giao diện Neobrutalism mobile first.

# Kotoba Lab

Các chế độ: Instant Vocab, Vocab Review, Word Order, Typing Review, Sentence Structures, Speaking Questions, Writing Review, Hot Review, Audio Looper và Markdown & Quiz.

## Chạy local

Yêu cầu Node.js 22 (đã kiểm tra với 22.13.1), npm 10.

```powershell
npm ci
npm run dev
```

Mở http://127.0.0.1:3000. Lệnh predev/prebuild/pretest tự chuẩn bị dữ liệu từ nguồn có sẵn; không gọi TTS hoặc sinh MP3.

```powershell
npm test
npm run build
npm run test:browser
npm run preview
```

Build xuất site tĩnh vào `out/`. Preview mở http://127.0.0.1:4173. Browser test sử dụng Microsoft Edge đã cài trên Windows; có thể đổi channel trong playwright.config.cjs nếu máy khác dùng Chromium.

## Cấu trúc

- `src/app/`: layout, route `/` và `/markdown/`.
- `src/components/ui/`: control, dialog, nhập CSV, progress và trạng thái chung.
- `src/components/study/`: component theo công cụ học.
- `src/services/`, `src/hooks/`: parser, kiểm tra đáp án, tải dữ liệu và audio.
- `src/styles/`: token Neobrutalism, style nền và theo tính năng.
- `docs/ielts/`: tài liệu và dữ liệu được đồng bộ từ road-2-ielts; giữ nguyên nguồn này.
- `input/`, `output/`, `make_vocab_audio.py`: nguồn và công cụ tạo MP3 tiếng Nhật–Việt.
- `public/data/`, `public/audio/`, `src/data/practice-data.js`: artifact sinh khi chuẩn bị build, không sửa tay.
- `tests/`: kiểm tra contract, parser và tương tác trên trình duyệt.

## Nhập bài và audio

Dán CSV hoặc chọn bộ IELTS có sẵn. Tên cột CSV cũ được giữ, kể cả `example_ja` khi học tiếng Anh. Writing Review nhận `context,prompt,input,sample_answer` và hỗ trợ tự so sánh bài mẫu, không chấm AI/band.

Các công cụ từ vựng/luyện câu dùng Sound of Text để tạo audio; cần kết nối mạng và dịch vụ ngoài hoạt động. Audio local được phát trên thiết bị, không upload. `Later` của Hot Review, âm lượng và Markdown giữ khóa lưu cũ; lựa chọn đã học trong bộ chọn IELTS lưu theo phiên. Các bộ bài đang học khác chỉ ở bộ nhớ phiên trang.

Audio public chỉ xuất hiện khi có MP3 thật trong `output/<bài>/`. Checkout hiện không có MP3 public; có thể dùng file local. Tạo MP3 bằng công cụ hiện có:

```powershell
python .\make_vocab_audio.py --dry-run
python .\make_vocab_audio.py --input .\input\18.txt
```

Sau khi có audio, chạy lại dev hoặc build để cập nhật danh mục và copy MP3 vào public/audio. TTS generator có yêu cầu riêng như ffmpeg; xem tùy chọn `python make_vocab_audio.py --help`.

## Hướng dẫn dự án

- [Quyết định stack và ngoại lệ blueprint](docs/project-decisions.md).
- [Định hướng UI](docs/ui-direction.md).
- [Local, environment và release](docs/runbook.md).
- [Kế hoạch và kiểm kê refactor](docs/refactor-plan.md).
- [Báo cáo kiểm chứng và giới hạn](docs/refactor-verification.md).
- [Markdown & Quiz](docs/MARKDOWN_QUIZ.md).
- [Đồng bộ nội dung IELTS](IELTS_UPDATE_NOTES.md).

## Xuất bản trên Vercel

Đã có vercel.json tại root. Vercel dùng Next.js server build (.next); local mặc định vẫn export ra out/ để chạy bộ kiểm tra và preview.

Đặt TURSO_DATABASE_URL và TURSO_AUTH_TOKEN trong Vercel Environment Variables; token chỉ dùng phía server. .env.local trên máy được Git và Vercel upload bỏ qua, không tự chuyển lên cloud. Chạy `npm run db:check` để kiểm tra local bằng SELECT 1.

Xem [hướng dẫn deploy Vercel](docs/vercel-deployment.md). Chưa có tính năng học đọc/ghi DB hoặc schema mới; chưa deploy trong phiên làm việc này.
