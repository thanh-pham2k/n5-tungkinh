TL;DR Contract code-first Zod, sinh OpenAPI 3.1; quản lý dữ liệu theo tài khoản (`thanhpv`, `yentr`).

- src/contracts/study-contract.ts là nguồn runtime schema. scripts/generate-openapi.ts sinh contracts/openapi.yaml; không sửa file sinh bằng tay.
- Dùng chuẩn /api/v1, JSON data/meta và error/meta, X-Request-Id, no-store, cursor pagination. Schema/content DB không được trả thẳng qua API list.
- Đăng nhập xác thực với 2 tài khoản: `thanhpv` (password: `1`) và `yentr` (password: `1`). Dữ liệu bài học, log nhập và tiến độ gắn liền với tài khoản đăng nhập (`library_id = username`). DELETE `/study-logs/{logId}` chỉ xóa record log của tài khoản đó. GET `/study-logs/{logId}` nạp source và parse lại. Không thể truy cập hoặc sửa dữ liệu của tài khoản khác.
- Request POST/PUT/DELETE cần cùng origin và phiên auth cookie hợp lệ; POST cũng cần Content-Type application/json và giới hạn kích thước. Không có CORS mở cho các thao tác ghi.
- Parse lại trên server, transaction lưu nội dung + record; UUID request idempotent, không retry mù thao tác ghi. Progress có version và trả 409 khi stale.
- `parsed` là JSON đã kiểm tra theo tool ở service; nguồn để ôn tập luôn đọc từ DB. Không load nội dung từ file/bundle hoặc storage client khi API lỗi.
