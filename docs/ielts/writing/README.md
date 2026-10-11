# Writing — Work English và IELTS

Chỉ luyện viết từng câu bằng Word Order, chưa luyện đoạn văn hoặc essay.

## Bộ tài liệu

- Writing_Practice.md → Word Order: 246 câu theo 16 chủ đề, sắp xếp cụm từ thành câu hoàn chỉnh.
- Topic_Vocabulary.md → Vocab Review: 242 thẻ, ưu tiên collocation và cụm từ tái sử dụng; mỗi nhóm Work có 12 thẻ, mỗi chủ đề IELTS có 17 thẻ.
- Sentence_Structures.md → Sentence Structures: 216 mẫu và ví dụ theo cùng 16 chủ đề.
- Structure_Practice.json → 5 bài Word Order cho mỗi card Sentence Structures, tổng 1080 câu. Mỗi bộ có câu ngắn trước, rồi câu mở rộng và câu có mệnh đề; mức độ tương đối trong từng mẫu. Bấm **Luyện Word Order · 5 bài** trên card để chuyển tab và nạp đúng bộ, hiển thị Mức 1/5 → 5/5. Bộ này tách khỏi lịch 48 ngày, không tự thay lịch học.

Work English gồm email, meetings, reports, collaboration, explaining problems và proposing solutions. Các mẫu bao phủ yêu cầu lịch sự, xác nhận, báo cáo trạng thái, nguyên nhân lỗi, tác động và đề xuất/đánh đổi.

IELTS gồm Education, Technology, Environment, Health, Work, Cities and Transport, Media, Government, Culture and Tourism và Task 1 Data. Các mẫu bao phủ nêu ý kiến, lý do, ví dụ, so sánh, nguyên nhân–kết quả, ưu/nhược điểm và mô tả số liệu.

## Cách học

Bộ bài được chia thành **48 ngày**, từ 11/10/2026 đến 27/11/2026: mỗi ngày 5–6 câu + 4–6 thẻ từ/cụm cùng chủ đề. Mỗi chủ đề học trong 3 ngày, từ câu dễ đến câu khó. Xem [DAILY_PLAN.md](DAILY_PLAN.md). Đây là lịch gợi ý, không phải nhật ký đã hoàn thành. Dialog mở sẵn ngày đầu; bạn có thể đổi sang ngày khác hoặc Tất cả ngày.

1. Chọn chủ đề trong Vocab Review và ôn collocation cùng ví dụ.
2. Đọc Sentence Structures cùng chủ đề; thay thành phần trong mẫu bằng ý của bạn.
3. Trong Word Order, bấm Chọn câu Writing theo chủ đề, lọc ngày/chủ đề và tick câu cần học.
4. Sắp xếp các cụm; kiểm tra; xem đáp án sau khi tự làm. Sau đó viết một câu mới dùng cùng cấu trúc.

Bộ bài được nạp theo thứ tự mức 1 (câu ngắn), mức 2 (mở rộng), mức 3 (mẫu có quan hệ mệnh đề/điều kiện/so sánh). Nhãn chỉ hướng dẫn luyện tập, không tương đương band IELTS. Các cụm bị đảo; câu gốc được ẩn khi làm bài. Không tick mặc định. Thay đổi bộ lọc giữ mục đã chọn.

## Cập nhật lần sau

Markdown ở repo road-2-ielts là nguồn duy nhất. Heading bài: ### YYYY-MM-DD · Topic — Chủ đề. Có thể bổ sung nhiều block cho cùng ngày/chủ đề; script gom thành một nhóm.

Writing: 6 cột vocabulary,hiragana,meaning_vi,example_ja,example_vi,word_order. Vocab: 5 cột tương tự nhưng không có word_order. Giữ hiragana trống cho tiếng Anh. Ngăn cụm bằng |; ghép phải khớp câu gốc. Không dùng dấu phẩy trong ô với parser hiện tại.

Sentence Structures: heading ## Topic — Chủ đề; bảng 4 cột Chức năng | Mẫu | Ví dụ | Nghĩa. Giữ tên chủ đề khớp các bộ bài.

Khi thêm hoặc sửa card Sentence Structures, cập nhật mục tương ứng trong Structure_Practice.json theo khóa topic + pattern + example. Mỗi mục cần đúng 5 exercises với level 1–5, sentence, meaning, chunks; các cụm ghép bằng một khoảng trắng phải khớp câu. Không dùng dấu phẩy trong câu/đáp án với loader CSV hiện tại. Các ví dụ Task 1 là số liệu giả định. Cập nhật trực tiếp JSON nguồn, không sửa bản copy hoặc JS được sinh.

Chạy node scripts/sync-n5.mjs E:/n5-tungkinh rồi node scripts/verify-materials.mjs E:/n5-tungkinh. Kiểm tra ba mục trên web và commit/push cả hai repo. Không sửa tay docs/ielts/practice-data.js. Không chạy generator để ghi đè Markdown; bộ tài liệu này được cập nhật trực tiếp.

Số liệu Task 1 là ví dụ giả định để học câu. Không chấm band hoặc sửa câu tự động. Khi tự viết hãy kiểm tra động từ, giới từ, thì và nội dung phù hợp ngữ cảnh.
