TL;DR Nội dung học chạy từ Turso qua API Next.js; hệ thống quản lý dữ liệu theo từng tài khoản (`thanhpv`, `yentr`). Toàn bộ dữ liệu trước đây thuộc về tài khoản `thanhpv`. Không lưu nội dung vào localStorage/sessionStorage hoặc bundle.

# Dữ liệu và quyền truy cập

Hệ thống hỗ trợ 2 tài khoản đăng nhập: `thanhpv` (dữ liệu chính) và `yentr` (dữ liệu cá nhân riêng). Khi mở app, người dùng được yêu cầu đăng nhập. Toàn bộ dữ liệu học tập cá nhân (bài học, lịch sử nhập log, tiến độ học) được phân lập theo từng tài khoản thông qua trường `library_id` (`thanhpv` hoặc `yentr`). Danh mục `study_catalog` (IELTS, mẫu câu, Markdown ví dụ) là tài nguyên chung.

Cookie HttpOnly/SameSite Strict (`kotoba-auth-token`) chứa token phiên có chữ ký HMAC bảo mật để xác thực tài khoản. Tiến độ, đáp án và nội dung học tập nằm trên Turso DB, tách biệt tuyệt đối theo tài khoản để không ghi đè kết quả của nhau. Cookie Secure trên HTTPS; mất cookie cần đăng nhập lại. Âm lượng là tùy chọn giao diện, có thể giữ localStorage; nội dung học không dùng storage local.

Nguồn contract runtime: src/contracts/study-contract.ts (Zod). `npm run contracts:generate` sinh contracts/openapi.yaml (JSON hợp lệ YAML, OpenAPI 3.1.0). Backend Node.js 22 + TypeScript chạy Next.js Route Handlers trên Vercel. API → service → repository; token chỉ ở server. API dùng JSON data/meta hoặc error/meta, request ID, cursor 20/mặc định, tối đa 100.

# Schema

DB được kiểm tra rỗng trước migration đầu tiên. Dự án dùng DB riêng, **không prefix bảng**. ID UUID, thời gian UTC RFC3339, source và parsed JSON đều NOT NULL. Không dùng FK bắt buộc; service chịu trách nhiệm tồn tại, transaction và quan hệ record/progress. Xóa log chỉ DELETE hàng study_records tương ứng; không xóa content/progress.

| Bảng           | Vai trò                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| study_catalog  | Bộ IELTS và ví dụ Markdown/Word Order; runtime chỉ SELECT từ Turso             |
| study_contents | Source, kết quả parse, công cụ, ngôn ngữ, tiêu đề, số mục, số lượt và ngày học |
| study_records  | Một record cho mỗi lần nhập/parse thành công, request UUID chống gửi lặp       |
| study_progress | Tiến độ theo content_id + ID phiên, optimistic version chống ghi đè            |

Cùng source + công cụ + ngôn ngữ dùng chung một nội dung; lần nhập mới tạo record log và tăng study_count. Gửi lại cùng requestId và payload không tăng lượt. Cùng requestId nhưng payload khác trả 409. Parse lỗi hoặc lỗi transaction không lưu nội dung/record một phần. Mở từ log sẽ parse lại source mà không tạo record mới. Xóa log chỉ xóa hàng study_records; nội dung hiện tại và tiến độ cá nhân vẫn còn. Log đang dùng chung trong thư viện, còn tiến độ gắn với cookie phiên. Phiên ẩn danh chỉ chống request thiếu cookie/CSRF, không phải xác thực danh tính hoặc quyền sở hữu.

Mỗi công cụ có Lịch sử nhập. IELTS, Speaking và Structures lấy từ catalog Turso. Chọn chủ đề tham khảo lưu record; luyện 5 câu tạo bài Word Order có log. Markdown lưu sau parse hợp lệ, debounce editor 300ms. Bản Markdown local cũ chỉ được xóa sau khi upload Turso thành công; lỗi upload giữ bản cũ để thử lại, không dùng làm fallback runtime.

docs/ielts/ và database/seed/ là đầu vào vận hành/kiểm thử để tái nhập dữ liệu, không phải nguồn đọc của ứng dụng. Không import vào client hoặc dùng readFile trong request handlers. Đã bỏ module src/data/practice-data.js và prebuild sinh dữ liệu local. Đổi catalog cần quy trình cập nhật rõ, seed hiện tại chỉ thêm nếu chưa có và đối chiếu hash, không tự ghi đè dữ liệu hiện hữu.

# Migration

Changelog chính: database/changelog/db.changelog-master.xml. Đã dùng Liquibase Community **4.33.0**, Java 17 và SQLite JDBC đi kèm để rehearsal lần đầu và reapply không đổi. Không coi SQLite JDBC là driver kết nối trực tiếp libsql://. Quy trình đang dùng theo phương án SQL sinh bởi Liquibase:

1. Kiểm tra đúng database host và snapshot/schema/ledger mới nhất. Bản đầu đã xác nhận target rỗng; baseline được lưu trong .migration-artifacts/ (Git/Vercel ignore).
2. Chạy Liquibase update-sql trên SQLite tương đương để sinh DDL **cùng ledger/checksum**. Rehearsal update và chạy lại để kiểm tra không đổi.
3. Review SQL; chạy db:migrate với đường dẫn SQL và hostname rõ. Runner hiện chỉ hỗ trợ baseline rỗng này hoặc reapply cùng checksum; từ chối DB không rỗng/changelog khác. Dùng transaction write (BEGIN IMMEDIATE) trên remote để serialize runner và áp dụng DDL + ledger nguyên tử.
4. Chạy db:seed để nhập catalog; đối chiếu hash từ DB. Kiểm tra API thật trước release.

Ví dụ khi đã cài Liquibase 4.33.0:

```powershell
liquibase --changelog-file=database/changelog/db.changelog-master.xml --url=jdbc:sqlite:.migration-artifacts/rehearsal.db --output-file=.migration-artifacts/migration.sql update-sql
liquibase --changelog-file=database/changelog/db.changelog-master.xml --url=jdbc:sqlite:.migration-artifacts/rehearsal.db update
npm run db:migrate -- .migration-artifacts/migration.sql <hostname-Turso-đích>
npm run db:seed -- <hostname-Turso-đích>
```

Migration/seed không chạy từ build, startup hoặc request. Thay đổi tiếp theo phải thêm changeset mới, snapshot/ledger và rehearsal mới; không sửa changeset 001 hoặc ép runner baseline áp dụng phiên bản khác. Khi lỗi trước commit, toàn transaction rollback. Sau commit, giữ schema và sửa tiến; rollback app không rollback DB. Thay đổi mất dữ liệu sau này cần backup/restore rehearsal riêng. Không chạy các dòng rollback DROP TABLE chỉ để rollback giao diện.

# Kiểm thử

Unit repository dùng SQLite/libSQL tương thích, kiểm tra transaction rollback, idempotency, cursor, cô lập tiến độ và conflict. Browser dùng SQLite fixture riêng trong .migration-artifacts/browser-test.db, chạy một worker và reset dữ liệu fixture giữa test; không ghi test vào Turso đã cấp. Chế độ KOTOBA_TEST_MODE chỉ bật trong helper kiểm thử, bị chặn khi VERCEL tồn tại; không cấu hình biến này trên deploy. Production chỉ dùng URL libsql và token Turso, không có fallback file DB.

Tài liệu nền: [Turso TypeScript SDK](https://docs.turso.tech/sdk/ts/reference), [Liquibase SQLite](https://contribute.liquibase.com/extensions-integrations/directory/database-tutorials/sqlite/).
