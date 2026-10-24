# IELTS Speaking — ghi chú tích hợp

Bổ sung ngày 2026-10-11 theo yêu cầu của người dùng. Nội dung nguồn thuộc repo `thanh-pham2k/road-2-ielts`.

Mapping:

- `speaking/Instant_Vocab_Practice.md` → Instant Vocab.
- `speaking/Word_Order_Practice.md` → Word Order Review.
- `writing/Writing_Practice.md` → Word Order Review: 246 câu thuộc 16 chủ đề, nạp theo mức 1 → 2 → 3.
- `writing/Topic_Vocabulary.md` → Vocab Review: 242 thẻ theo 16 chủ đề có nghĩa và ví dụ song ngữ. Dialog lọc ngày + chủ đề.
- `writing/Sentence_Structures.md` → Sentence Structures: 216 mẫu/ví dụ tái sử dụng theo 16 chủ đề.

Hai chế độ có nút **Chọn câu IELTS…** mở dialog. Người dùng lọc theo ngày, tick từng câu rồi bấm **Nạp các câu đã chọn**. Mặc định không tick câu nào; lựa chọn được giữ qua các bộ lọc ngày trong lần mở dialog, có chọn tất cả đang hiển thị và bỏ chọn tất cả. Mỗi lần mở lại bắt đầu lựa chọn mới; Hủy không thay dữ liệu đang học. Khi nạp, app dùng English cho audio. Tên cột CSV vẫn theo schema hiện có của app; không đổi `example_ja` thành tên cột khác.

## Cập nhật đúng lần sau

Speaking Questions có bộ 208 mục luyện Parts 1–3 theo 26 chủ đề; lọc chủ đề/ngày gợi ý và phần thi. Nguồn ở `road-2-ielts/speaking/Question_Topics.json`; bản đọc Markdown do sync sinh. Không đổi checklist 100 câu cũ. Đây là câu hỏi tự biên soạn, không phải đề thi thật hay dự đoán. Cập nhật JSON nguồn rồi sync và verify.

Nút **Luyện Word Order · 5 bài** trên mỗi card Sentence Structures nạp đúng bộ 5 bài từ `road-2-ielts/writing/Structure_Practice.json`. Có 216 bộ (1080 câu); thứ tự ngắn → mở rộng → thêm mệnh đề. UI chuyển tab Word Order, ẩn câu gốc và hiển thị Mức 1/5 → 5/5. Bộ luyện card tách riêng lịch 48 ngày. Khi sửa/thêm card, cập nhật JSON nguồn theo khóa topic + pattern + example, rồi sync và verify; không sửa JS được sinh.

Writing và Vocab được chia thành 48 ngày học gợi ý từ 11/10–27/11/2026, mỗi ngày 5–6 câu + 4–6 thẻ cùng chủ đề. `docs/ielts/writing/DAILY_PLAN.md` là bản lịch đồng bộ từ nguồn. Dialog mở sẵn ngày đầu, vẫn có Tất cả ngày để ôn tổng hợp. Giữ cách chia này khi bổ sung, không gom lại một ngày.

Đã mở rộng theo mục tiêu mới: luyện từng câu cho Work English + IELTS, ưu tiên mẫu tái sử dụng. 16 chủ đề gồm 6 Work và 10 IELTS; 246 câu Word Order; 242 thẻ collocation/từ vựng; 216 mẫu/ví dụ trong mục Sentence Structures. `writing/Sentence_Structures.md` ở repo nguồn là nguồn cho mục mới. Script đồng bộ gộp các block cùng ngày/chủ đề và sắp xếp câu theo mức dễ đến khó. Kiểm tra bằng `node scripts/verify-materials.mjs E:/n5-tungkinh` từ repo nguồn. Không quay lại bộ Writing bài dài hoặc tạo app riêng.

1. Sửa Markdown nguồn trong `E:/road-2-ielts/speaking/` (không sửa bản copy ở repo này).
2. Pull repo này trước khi đồng bộ.
3. Từ `E:/road-2-ielts`, chạy `node scripts/sync-n5.mjs E:/n5-tungkinh`.
4. Script copy tài liệu Speaking/Writing vào `docs/ielts/` và sinh `docs/ielts/practice-data.js`. Không sửa tay file JS được sinh.
5. Kiểm tra bộ lọc ngày/chủ đề, nạp câu vào Word Order, nạp collocation vào Vocab Review và xem mẫu trong Sentence Structures; add + commit + push cả hai repo.

Các ngày được đọc từ heading `### YYYY-MM-DD`. Mỗi ngày gom các block CSV thành một bài, chỉ giữ một header. Instant Vocab có 5 cột; Word Order có 6 cột với `word_order`, ngăn cụm bằng `|`. Script kiểm tra số cột và câu ghép từ các cụm. Hiện parser đồng bộ không hỗ trợ dấu phẩy bên trong ô.

`docs/ielts/speaking/IELTS_Speaking_Practice_Checklist.md` và `PRACTICE_LOG.md` là bản copy tham chiếu; các câu chưa có đáp án không tự sinh vào bộ bài.

Sau refactor Next.js ngày 2026-10-24: nguồn đồng bộ vẫn ở `docs/ielts/practice-data.js`. Chạy `npm test` và `npm run build` để chuyển dữ liệu sang module và tạo artifact `out/`. Thiết lập Pages cũ `main:/docs` không tự build Next.js; quy trình publish cần được chọn riêng theo `docs/runbook.md`. Không ghi output đè lên tài liệu nguồn.
