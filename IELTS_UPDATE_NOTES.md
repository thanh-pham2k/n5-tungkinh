# IELTS Speaking — ghi chú tích hợp

Bổ sung ngày 2026-10-11 theo yêu cầu của người dùng. Nội dung nguồn thuộc repo `thanh-pham2k/road-2-ielts`.

Mapping:

- `speaking/Instant_Vocab_Practice.md` → Instant Vocab.
- `speaking/Word_Order_Practice.md` → Word Order Review.

Hai chế độ có nút **Chọn câu IELTS…** mở dialog. Người dùng lọc theo ngày, tick từng câu rồi bấm **Nạp các câu đã chọn**. Mặc định không tick câu nào; lựa chọn được giữ qua các bộ lọc ngày trong lần mở dialog, có chọn tất cả đang hiển thị và bỏ chọn tất cả. Mỗi lần mở lại bắt đầu lựa chọn mới; Hủy không thay dữ liệu đang học. Khi nạp, app dùng English cho audio. Tên cột CSV vẫn theo schema hiện có của app; không đổi `example_ja` thành tên cột khác.

## Cập nhật đúng lần sau

1. Sửa Markdown nguồn trong `E:/road-2-ielts/speaking/` (không sửa bản copy ở repo này).
2. Pull repo này trước khi đồng bộ.
3. Từ `E:/road-2-ielts`, chạy `node scripts/sync-n5.mjs E:/n5-tungkinh`.
4. Script copy 4 file Markdown vào `docs/ielts/speaking/` và sinh `docs/ielts/practice-data.js`. Không sửa tay file JS được sinh.
5. Kiểm tra số ngày, chọn ngày và nạp bài trong cả hai chế độ, rồi add + commit + push ở cả hai repo.

Các ngày được đọc từ heading `### YYYY-MM-DD`. Mỗi ngày gom các block CSV thành một bài, chỉ giữ một header. Instant Vocab có 5 cột; Word Order có 6 cột với `word_order`, ngăn cụm bằng `|`. Script kiểm tra số cột và câu ghép từ các cụm. Hiện parser đồng bộ không hỗ trợ dấu phẩy bên trong ô.

`docs/ielts/speaking/IELTS_Speaking_Practice_Checklist.md` và `PRACTICE_LOG.md` là bản copy tham chiếu; các câu chưa có đáp án không tự sinh vào bộ bài.

Giữ cấu hình GitHub Pages hiện tại: branch `main`, thư mục `/docs`. Không chuyển sang workflow Actions riêng cho bộ bài này. Sau push, xác minh deployment; lỗi billing tài khoản vẫn có thể chặn publish.
