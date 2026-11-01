# English Foundation

Mỗi lesson và checkpoint là một file Markdown để biên soạn. Phase 1 gồm bốn module và Phase 2 gồm sáu module; mỗi module có hai hoặc ba lesson và một mini checkpoint. Tổng cộng có 22 lesson và 10 checkpoint. Nội dung runtime được import và tải từ Turso theo kiến trúc dự án, không đọc trực tiếp các file này làm nguồn dự phòng.

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

1. [Basic Sentence Structure](phase-01-build-sentences/module-01-basic-sentence-structure/README.md) — hai lesson và checkpoint.
2. [Nouns & Pronouns](phase-01-build-sentences/module-02-nouns-pronouns/README.md) — ba lesson và checkpoint.
3. [Be](phase-01-build-sentences/module-03-be/README.md) — hai lesson và checkpoint.
4. [Present Simple](phase-01-build-sentences/module-04-present-simple/README.md) — hai lesson và checkpoint.

### Phase 2 — Talk About Life

Học sau Phase 1; bài runtime được lấy từ catalog Turso.

5. [Questions](phase-02-talk-about-life/module-01-questions/README.md) — hai lesson và checkpoint.
6. [Present Continuous](phase-02-talk-about-life/module-02-present-continuous/README.md) — hai lesson và checkpoint.
7. [Ability & Preference](phase-02-talk-about-life/module-03-ability-preference/README.md) — hai lesson và checkpoint.
8. [Past Simple](phase-02-talk-about-life/module-04-past-simple/README.md) — ba lesson và checkpoint.
9. [Future](phase-02-talk-about-life/module-05-future/README.md) — hai lesson và checkpoint.
10. [Modal Basics](phase-02-talk-about-life/module-06-modal-basics/README.md) — hai lesson và checkpoint.

### Phase 3 — Expand Ideas

[Bộ khung Phase 3 — Expand Ideas](phase-03-expand-ideas/README.md): Module 11–17, mỗi module có hai lesson và một checkpoint mẫu để bổ sung nội dung.

### Phase 4 — Use English

[Bộ khung Phase 4 — Use English](phase-04-use-english/README.md): Module 18–24, mỗi module có hai lesson và một checkpoint mẫu để bổ sung nội dung.

Vocabulary, listening, reading và speaking được tích hợp từ Phase 1 khi phù hợp; Phase 4 tập trung tổng hợp và nâng cao. Sau Foundation là IELTS Foundation. Các file Phase 3–4 là đề cương, chưa có nội dung hoàn chỉnh và chưa được nhập vào catalog runtime.

## Vận hành Phase 1 và 2

Mục English Foundation mở các lesson trong modal đọc tập trung; nội dung được lấy từ catalog `english-foundation` trên Turso, sau đó lưu thành bài Markdown và tiến độ theo cơ chế hiện có. File Markdown trong repo chỉ là nguồn biên soạn, không được đọc trực tiếp khi ứng dụng chạy.

Sau khi kiểm tra nội dung và cấu hình đúng môi trường Turso, nhập catalog bằng lệnh sau, thay hostname bằng hostname của database đích:

```sh
node --env-file=.env.local scripts/seed-english-foundation.mjs <hostname-Turso-đích>
```

Lệnh seed thông thường từ chối xóa bài cũ. Việc chuyển từ danh mục trước khi gộp sang danh mục mới cần quy trình chuyển đổi riêng với snapshot và kiểm tra tiến độ; không chạy seed thông thường để ép ghi đè. Trong cùng transaction, lệnh từ chối xóa bài cũ hoặc thay nội dung nếu có tiến độ gắn với phiên bản cũ; cần xử lý riêng trước khi cập nhật. Không chạy seed từ build hoặc request. Để chuyển danh mục cũ sang bản gộp, trước tiên lưu và đối chiếu snapshot các bảng `study_catalog`, `study_contents`, `study_records`, `study_progress`; diễn tập với bản sao trên SQLite. Sau đó chạy `node --env-file=.env.local scripts/seed-english-foundation-compact.mjs <hostname-Turso-đích> <snapshot-json>` với snapshot đã duyệt. Lệnh kiểm tra chính xác catalog cũ và ánh xạ đầy đủ trước khi cập nhật trong transaction. Bài gộp chỉ có trạng thái hoàn thành nếu tất cả bài thành phần đã hoàn thành; trường hợp hoàn thành một phần được giữ trong tiến độ và các bài cũ vẫn còn trong lịch sử. Nếu đang mở bài cũ khi cập nhật, hãy đóng và mở lại bài gộp. Môi trường browser test dùng SQLite fixture tách biệt, không ghi vào Turso. Dùng `npm run preview:local` sau khi build để xem thử với database local riêng, không bị browser test xóa tiến độ.

### Thứ tự học

Người học chủ động chọn **Đánh dấu hoàn thành** hoặc **Bỏ đánh dấu hoàn thành** trong bài; kết quả quiz không tự thay đổi trạng thái này. Trạng thái được lưu cùng tiến độ bài theo người học. Đáp án quiz chỉ tồn tại khi bài đang mở và bắt đầu trống mỗi lần mở lại; không lưu vào localStorage hoặc Turso. Lesson chưa hoàn thành xuất hiện trước; các lesson đã hoàn thành xếp theo thời gian hoàn thành từ cũ đến mới, nên bài vừa học chuyển xuống cuối. Khi chỉ có một lesson, vị trí không đổi. Nếu lưu tiến độ lỗi, giao diện báo lỗi thay vì xác nhận hoàn thành.

Catalog `english-foundation` chứa mảng các đối tượng `{ "id", "label", "title", "source", "module", "phase" }` (các bài Phase 1 cũ có thể không có `phase`), mỗi ID duy nhất và source là Markdown hoàn chỉnh. Thứ tự ban đầu của mảng là thứ tự học. Khi gộp bài, trạng thái hoàn thành của bài gộp chỉ được kế thừa nếu tất cả bài thành phần đã hoàn thành; lịch sử và tiến độ bài cũ vẫn được giữ. Seed nhập catalog của cả Phase 1 và Phase 2. Với catalog đã tồn tại, cung cấp snapshot JSON đã đối chiếu làm đối số thứ hai; lệnh chỉ cập nhật khi dữ liệu hiện tại khớp snapshot, và kiểm tra lại sau khi ghi.

### Đầu ra và cách tự kiểm tra

Sau Phase 1, người học hướng tới nhận biết chủ ngữ và động từ, tạo câu đơn với động từ thường hoặc `be`, mô tả bản thân và thói quen cơ bản. Sau Phase 2, người học hướng tới đặt câu hỏi, nói hoặc viết ngắn về hiện tại, quá khứ, dự định, sở thích và khả năng. Mỗi phase có một hoạt động tổng hợp đọc, nghe, nói, viết và tiêu chí tự đối chiếu ở checkpoint cuối.

Quiz kiểm tra kiến thức và luyện xây câu; điểm quiz không tự chứng minh khả năng giao tiếp. Audio mẫu là giọng tổng hợp, không thay thế việc nghe nhiều giọng nói thực tế. Bài nói và viết được tự đối chiếu, không được ứng dụng chấm tự động. Cần thử với người học thực tế và điều chỉnh nội dung trước khi khẳng định mức độ đạt đầu ra.

Hướng dẫn thử với người học và ghi nhận kết quả: [Kiểm tra đầu ra Phase 1 và Phase 2](learner-validation.md).

Bản nội dung trước khi gộp được lưu trong [file đối chiếu](archive/lessons-before-consolidation.md); không dùng làm nguồn runtime.
