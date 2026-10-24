TL;DR Contract code-first Zod, sinh OpenAPI 3.1; thư viện công khai theo lựa chọn chủ dự án.

- src/contracts/study-contract.ts là nguồn runtime schema. scripts/generate-openapi.ts sinh contracts/openapi.yaml; không sửa file sinh bằng tay.
- Dùng chuẩn /api/v1, JSON data/meta và error/meta, X-Request-Id, no-store, cursor pagination. Schema/content DB không được trả thẳng qua API list.
- Ngoại lệ BE-04 có chủ đích: chủ dự án chọn thư viện dùng chung, không đăng nhập. Người truy cập được nhập bài và xóa vĩnh viễn bài khỏi thư viện công khai; DELETE xóa source, records và tiến độ của tất cả phiên trong một transaction. UI phải cảnh báo rõ phạm vi chung và yêu cầu xác nhận. Cookie phiên ẩn danh chỉ chống request thiếu cookie/CSRF, không phải xác thực danh tính hoặc quyền admin.
- Request POST/PUT/DELETE cần cùng origin và phiên cookie hợp lệ; POST cũng cần Content-Type application/json và giới hạn kích thước. Không có CORS mở cho các thao tác ghi.
- Parse lại trên server, transaction lưu nội dung + record; UUID request idempotent, không retry mù thao tác ghi. Progress có version và trả 409 khi stale.
- `parsed` là JSON đã kiểm tra theo tool ở service; nguồn để ôn tập luôn đọc từ DB. Không load nội dung từ file/bundle hoặc storage client khi API lỗi.
