# English Foundation

Mỗi lesson và checkpoint là một file Markdown để biên soạn. Module 1 gồm năm lesson và một mini checkpoint. Nội dung runtime được import và tải từ Turso theo kiến trúc dự án, không đọc trực tiếp các file này làm nguồn dự phòng.

## Cách sử dụng

- Điền các mục trong từng file; thay mọi dòng “Cần bổ sung” bằng nội dung thực tế.
- Mỗi lesson có một mục tiêu chính. Chọn dạng bài và hoạt động áp dụng phù hợp; không bắt buộc đủ mọi mục.
- Ba dạng luyện tập cốt lõi được sắp theo thứ tự Multiple Choice → Word Order → Typing. Typing dùng các từ đã xáo để người học tự gõ câu, không yêu cầu dịch Việt → Anh.
- Ôn kiến thức cũ xuyên suốt. Danh sách câu cần ôn và lịch ôn cách quãng là định hướng sản phẩm, chưa mặc định đã được triển khai.
- Dùng định dạng `quiz-deck` bên dưới cho bài luyện tập. Để thêm nút nghe, viết inline code theo mẫu `audio:en|Câu tiếng Anh.`; app phát qua Sound of Text.
- Tám tuần chỉ là thời gian tham khảo; tiến độ dựa trên mức độ nắm bài.


Phần lý thuyết, hướng dẫn và ôn tập viết ngắn gọn bằng tiếng Việt; giữ câu ví dụ tiếng Anh.

## Hướng dẫn tạo câu hỏi

Dùng prompt sau khi đã có nội dung lesson hoặc checkpoint; thay `[DÁN VÀO ĐÂY]` bằng nội dung thực tế:

> Tạo câu hỏi luyện tập từ nội dung sau, ưu tiên vận dụng thực tế. Xuất một block `quiz-deck`, mỗi câu một dòng, ID duy nhất, các trường không rỗng và phân cách bằng `|`: `id | single_choice | câu hỏi | lựa chọn 1 | lựa chọn 2 | lựa chọn 3 | lựa chọn 4 | số đáp án | giải thích`; `id | word_order | câu hỏi | cụm 1 / cụm 2 / cụm 3 | câu hoàn chỉnh | giải thích`; hoặc `id | typing | câu hỏi | đáp án | giải thích`. Chọn dạng phù hợp với nội dung. Nội dung: [DÁN VÀO ĐÂY].

Bọc các dòng câu hỏi trong code fence mở bằng ` ```quiz-deck ` và đóng bằng ` ``` `, không có khoảng trắng quanh dấu backtick. ID phải duy nhất trong bài; đáp án trắc nghiệm là số thứ tự từ 1. Không đặt `|` trong nội dung một trường; Word Order cần ít nhất hai mảnh, ngăn cách bằng `/` và ghép đúng câu đáp án.

Với Typing của Foundation, ghi **các từ đã xáo ngay trong trường câu hỏi**, để người học gõ câu hoàn chỉnh; không yêu cầu dịch Việt → Anh. Đáp án hiện được so sánh không phân biệt chữ hoa, dấu câu và khoảng trắng thừa, nhưng mỗi câu chỉ có một đáp án mẫu. Đối chiếu định dạng và hành vi hiện tại tại [Markdown & Quiz](../MARKDOWN_QUIZ.md). Hãy kiểm tra tính chính xác, độ tự nhiên và độ phù hợp của từng câu trước khi dùng.

## Roadmap

### Phase 1 — Build Sentences

1. [Basic Sentence Structure](phase-01-build-sentences/module-01-basic-sentence-structure/README.md) — khung đang biên soạn.
2. Nouns & Pronouns — dự kiến.
3. Be — dự kiến.
4. Present Simple — dự kiến.

### Phase 2 — Talk About Life

5. Questions; 6. Present Continuous; 7. Ability & Preference; 8. Past Simple; 9. Future; 10. Modal Basics — dự kiến.

### Phase 3 — Expand Ideas

11. Adjectives & Adverbs; 12. Prepositions; 13. Countable / Uncountable; 14. Comparisons; 15. Linking Ideas; 16. Present Perfect; 17. Basic Complex Sentences — dự kiến.

### Phase 4 — Use English

18. Vocabulary System; 19. Pronunciation; 20. Listening; 21. Reading; 22. Writing; 23. Speaking; 24. Foundation Review — dự kiến.

Vocabulary, listening, reading và speaking được tích hợp từ Phase 1 khi phù hợp; Phase 4 tập trung tổng hợp và nâng cao. Sau Foundation là IELTS Foundation. Các module dự kiến chưa có lesson; chỉ mở rộng sau khi kiểm chứng Module 1.

## Vận hành Module 1

Mục English Foundation mở các lesson trong modal đọc tập trung; nội dung được lấy từ catalog `english-foundation` trên Turso, sau đó lưu thành bài Markdown và tiến độ theo cơ chế hiện có. File Markdown trong repo chỉ là nguồn biên soạn, không được đọc trực tiếp khi ứng dụng chạy.

Sau khi kiểm tra nội dung và cấu hình đúng môi trường Turso, nhập catalog bằng lệnh sau, thay hostname bằng hostname của database đích:

```sh
node --env-file=.env.local scripts/seed-english-foundation.mjs <hostname-Turso-đích>
```

Lệnh chỉ thêm catalog chưa tồn tại và kiểm tra nội dung; nếu catalog đã khác, lệnh yêu cầu snapshot JSON của phiên bản cũ để đối chiếu trước khi cập nhật. Không chạy seed từ build hoặc request. Môi trường browser test dùng SQLite fixture tách biệt, không ghi vào Turso. Dùng `npm run preview:local` sau khi build để xem thử với database local riêng, không bị browser test xóa tiến độ.

### Thứ tự học

Người học chủ động chọn **Đánh dấu hoàn thành** hoặc **Bỏ đánh dấu hoàn thành** trong bài; kết quả quiz không tự thay đổi trạng thái này. Trạng thái được lưu cùng tiến độ bài theo người học. Lesson chưa hoàn thành xuất hiện trước; các lesson đã hoàn thành xếp theo thời gian hoàn thành từ cũ đến mới, nên bài vừa học chuyển xuống cuối. Khi chỉ có một lesson, vị trí không đổi. Nếu lưu tiến độ lỗi, giao diện báo lỗi thay vì xác nhận hoàn thành.

Catalog `english-foundation` chứa mảng các đối tượng `{ "id", "label", "title", "source" }`, mỗi ID duy nhất và source là Markdown hoàn chỉnh. Thứ tự ban đầu của mảng là thứ tự học. Source thay đổi tạo nội dung và tiến độ riêng theo cơ chế hiện tại; cần cân nhắc việc này khi cập nhật một bài đã học. Seed nhập cả Module 1. Với catalog đã tồn tại, cung cấp snapshot JSON đã đối chiếu làm đối số thứ hai; lệnh chỉ cập nhật khi dữ liệu hiện tại khớp snapshot, và kiểm tra lại sau khi ghi.
