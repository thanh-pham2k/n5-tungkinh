# Hướng dẫn dự án

## Quy tắc chung

- Dự án tuân theo bộ hướng dẫn tại [.agents/blueprint](.agents/blueprint/README.md), được liên kết tới `E:\fullstack-blueprint` bằng junction trên máy local.
- Áp dụng [quy ước chung](.agents/blueprint/docs/rules.md), giữ đúng mức MUST, SHOULD, MAY. Mọi phản hồi bắt đầu bằng `TL;DR`; viết ngắn, rõ, chủ động và đặt kết quả trước.
- Khi viết hoặc review code, API, schema, đọc [naming và enum](.agents/blueprint/docs/naming.md).
- Chỉ đọc skill liên quan đến công việc theo định tuyến bên dưới; giữ yêu cầu người dùng và quyết định đã ghi của dự án. Không tự thay stack hiện có.
- Các giới hạn chỉ dành cho việc duy trì repo blueprint không áp dụng cho code dự án này.
- Chạy kiểm chứng phù hợp khi triển khai code và báo kết quả thực tế.

## Định tuyến skill

- UI: [skillkit-ui](.agents/skills/skillkit-ui/SKILL.md).
- Backend: [skillkit-backend](.agents/skills/skillkit-backend/SKILL.md).
- API mới: [chuẩn API mặc định](.agents/skills/skillkit-backend/references/api-standard.md), trừ phần dự án đã ghi đè rõ ràng.
- Database: [skillkit-database](.agents/skills/skillkit-database/SKILL.md).
- Ảnh: [skillkit-images](.agents/skills/skillkit-images/SKILL.md).
- Deploy: [skillkit-deploy](.agents/skills/skillkit-deploy/SKILL.md).

## Liên kết local

Hai junction `.agents/skills` và `.agents/blueprint` được bỏ qua bởi Git. Máy khác cần tạo lại từ bản blueprint tương ứng. Dự án dùng bản nguồn trực tiếp theo yêu cầu người dùng ngày 2026-10-24; thay đổi tại nguồn có hiệu lực ngay, không pin commit (khác khuyến nghị GEN-07 để thuận tiện dùng chung local).

## Phong cách UI riêng của dự án

- UI theo phong cách **Neobrutalism**, tham chiếu https://neobrutalism.com/, theo quyết định của chủ dự án ngày 2026-10-24.
- Trước khi thiết kế, sửa hoặc review UI, đọc [định hướng UI dự án](docs/ui-direction.md) cùng skill UI. Định hướng này đã được triển khai và tiếp tục áp dụng cho các lần cập nhật sau.
- Chủ dự án đã chọn Next.js + Neobrutalism ngày 2026-10-24, thay phần Ant Design của UI-01. Đọc [quyết định dự án](docs/project-decisions.md); các rule còn lại giữ nguyên phạm vi áp dụng.

## Điểm riêng phải giữ khi cập nhật dự án

- Đây là lựa chọn riêng của dự án đích, ưu tiên hơn phần blueprint tương ứng: **Next.js App Router + React + Neobrutalism**. Không tự đưa Ant Design trở lại hoặc thêm thư viện UI khác theo stack mặc định của blueprint. Phiên bản thực tế lấy từ package.json và package-lock.json.
- Thiết kế **mobile first**, ưu tiên 360–430px: hạn chế khung lồng nhau, badge và điều khiển cùng xuất hiện; mỗi bước học có một hành động chính. Giữ zoom, focus bàn phím, vùng bấm tối thiểu 44px và bố cục không bị thanh cố định che khi nhập liệu.
- Dùng token tại src/styles/tokens.css và component chung tại src/components/ui/. Tái sử dụng phần có nhu cầu chung thực tế; giữ component theo tính năng, tránh một generic component có quá nhiều cờ.
- Phạm vi giữ lại: Instant Vocab, Vocab Review, Word Order, Typing Review, Sentence Structures, Speaking Questions, Writing Review, Multiple Choice và Markdown & Quiz. **Không khôi phục Kana, thư viện Kanji riêng, Final Review MCQ hoặc Audio Looper** nếu chưa có yêu cầu mới. Giữ Furigana/Kanji trong nội dung học.
- Theo yêu cầu dọn repo ngày 2026-10-24, đã loại các thư mục nihongo_char, nihongo_kanji, nihongo_mcqs, nihongo_practices, nihongo_vocab, summary_checklist, temp_anki và docs/input. Không khôi phục hoặc đưa các resource cũ này vào build. Giữ docs/ielts/, input/, output/, công cụ tạo audio và cấu hình deploy; node_modules cùng các artifact build/test được Git bỏ qua.
- Multiple Choice thay Hot Review: dùng parser src/services/multiple-choice-service.js và định dạng dấu | tại docs/MULTIPLE_CHOICE.md. Đáp án 1–4 cùng một bộ; không thêm lại bước nhập đáp án riêng. Tiến độ/ôn sau hiện lưu Turso theo phiên, không dùng quiz_review_later_ids ở localStorage hoặc tự ghép ID legacy.
- Bảo toàn CSV của các công cụ còn lại, kể cả example_ja khi học tiếng Anh. Theo yêu cầu mới ngày 2026-10-24, **toàn bộ nội dung runtime phải lưu/load từ Turso**, không bundle bài hoặc dùng localStorage/sessionStorage làm nguồn nội dung/fallback. docs/ielts/ và database/seed/ chỉ dùng vận hành import/test. Đã bỏ src/data/practice-data.js và bước prebuild sinh dữ liệu local. Markdown local legacy chỉ xóa sau khi chuyển lên Turso thành công; âm lượng UI có thể giữ local.
- Chủ dự án chọn **thư viện dùng chung, không đăng nhập**. Nội dung đã lưu công khai cho mọi người; đáp án/tiến độ tách theo cookie phiên HttpOnly. Mỗi lần parse thành công phải tạo study_records nguyên tử với nội dung; cùng nội dung không nhân bản bài, gửi lại cùng request UUID không tăng lượt. Mỗi công cụ có Bài đã lưu để ôn lại. Đọc docs/database.md và docs/decisions/api-contract.md trước khi đổi persistence/API.
- Audio Looper đã bỏ theo yêu cầu ngày 2026-10-24; không khôi phục menu, player, upload audio local hoặc build thư viện MP3. Giữ phát âm trong các công cụ học và cài đặt audio chung. Writing Review là tự đối chiếu bài mẫu; không tự thêm AI chấm bài, band, XP hoặc tài khoản.
- Vercel + Turso: vercel.json giữ Next.js, npm run build, output .next. Cả local và Vercel dùng server runtime cho API; không bật static export out/ hoặc quay về GitHub Pages. npm run preview dùng next start. NEXT_PUBLIC_BASE_PATH để trống ở root domain. Không ghi output đè docs/ nguồn.
- Turso dùng TURSO_DATABASE_URL và TURSO_AUTH_TOKEN phía server; local đặt trong .env.local được Git/Vercel upload bỏ qua. Không ghi token vào AGENTS, mã nguồn, vercel.json, log hoặc biến NEXT_PUBLIC_*. Preview phải có DB/credential riêng, không tự kế thừa production. Hướng dẫn ở [deploy Vercel](docs/vercel-deployment.md).
- Schema study_contents/study_records/study_progress/study_catalog đã áp dụng trên Turso qua SQL + ledger/checksum sinh bởi Liquibase 4.33.0, rehearsal và reapply đã kiểm chứng. Không prefix bảng vì DB riêng. Không sửa changeset đã áp dụng; mọi schema mới dùng changeset mới. Không migration/seed từ build, startup hoặc request. npm run db:migrate chỉ hỗ trợ baseline đã review; xem docs/database.md trước thay đổi tiếp theo.
- Khi thay đổi code, chạy kiểm chứng phù hợp: npm test, npm run build, npm run format:check; chạy npm run test:browser khi sửa tương tác/UI. Bộ browser test hiện dùng Edge; kiểm tra cả mobile và desktop, báo rõ giới hạn thiết bị thật hoặc dịch vụ ngoài. Xem [báo cáo refactor](docs/refactor-verification.md) làm mốc, không coi số test hoặc phiên bản trong báo cáo là cố định mãi.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
