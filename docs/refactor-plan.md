TL;DR Refactor toàn bộ UI học tập sang Neobrutalism mobile first; giữ dữ liệu và hành vi, xác minh từng luồng.

# Kế hoạch refactor UI — 2026-10-24

## Kiểm kê ban đầu

- Stack: HTML/CSS/JavaScript thuần; GitHub Pages phục vụ docs/. Chưa có package.json hoặc bước build ứng dụng.
- docs/index.html chứa CSS và logic cho audio, từ vựng, flashcard, ghép/gõ câu, Writing, bộ chọn IELTS, Speaking và Structures.
- docs/js/final-review-mcq.js chứa cả Hot Review cần giữ và Final Review cần bỏ; phải tách phụ thuộc trước khi xóa.
- Markdown nằm ở docs/markdown-preview.html, css/markdown-lesson.css, js/markdown-lesson.js và js/lesson-parser.js; có parser test.
- Dữ liệu IELTS nằm ở docs/ielts/practice-data.js và Markdown nguồn. Không thay định dạng CSV đang có.
- Audio Looper và Writing Review còn giao diện/logic nhưng chưa có trong menu. Cần đưa vào điều hướng.
- Audio public trỏ tới docs/data/lesson-mapper.json nhưng file chưa tồn tại trong checkout; output chỉ có .gitkeep. Phải xử lý nguồn/empty state thật, không giả dữ liệu audio.
- Writing Review chỉ ghi nhận câu trả lời để tự so sánh bài mẫu; không phải chấm band hoặc AI.
- Loại bỏ Kana, thư viện Kanji riêng và Final Review MCQ; giữ ruby/Furigana và Kanji trong câu hỏi.

## Quyết định đã chốt

Chủ dự án đã chọn Next.js + Neobrutalism, thay phần Ant Design của UI-01. Xem [quyết định dự án](project-decisions.md). Build xuất artifact tĩnh; chưa thay hosting hoặc deploy.

## Các bước

1. Chốt stack; ghi quyết định và mapping kiến trúc theo UI-02.
2. Tạo token, control, app shell, dialog và thanh hành động dùng chung; kiểm chứng luồng đại diện Instant Vocab ở 390px trước khi mở rộng; kiểm tra toàn ứng dụng ở 360/390/430px và desktop trong vòng nghiệm thu.
3. Refactor các màn còn lại, giữ nhập CSV/IELTS, audio, Later, Focus, phím tắt và trạng thái lưu.
4. Tách logic dữ liệu/audio khỏi phần hiển thị; không tạo generic study card nhiều cờ.
5. Loại module bị bỏ và các liên kết/phụ thuộc chỉ phục vụ chúng.
6. Kiểm chứng desktop/mobile, keyboard, overflow, bàn phím mobile, quiz, file input, audio và parser. Ghi rõ giới hạn của dịch vụ ngoài/thiết bị mô phỏng.
7. Cập nhật README, định hướng UI và báo cáo kiểm chứng; không commit/push/deploy.

## Ma trận nghiệm thu

- Instant: CSV, IELTS, từng mục, play all/stop, thứ tự phát, trạng thái tạo/lỗi audio.
- Flashcard: trước/sau, mặt trước/sau, Later, shuffle/reset, Hiragana, audio, zoom.
- Word Order/Typing: token/nhập câu, đúng/sai, mẫu, nghe, trước/sau, retry/repractice, phím tắt.
- Structures: lọc chủ đề, đọc mẫu, mở 5 bài tương ứng với ngôn ngữ EN và Focus.
- Speaking: chủ đề/ngày, Part 1/2/3 và cue card.
- Writing: CSV, đề, nhập câu, ghi nhận, mẫu, copy, chuyển câu.
- Hot Review: CSV, chọn đáp án, nhập answer, giải thích, Later, phân trang, copy và phím tắt nghe.
- Looper: local audio và public khi có tài nguyên; vòng lặp/tốc độ/chuyển nhóm và danh sách từ.
- Markdown: editor/preview, Mermaid, quiz/kết quả/retry, lưu nội dung, file, copy, print/PDF, dark, resize/sync scroll.
- Chung: navigation đúng tên, dialog/focus/keyboard, 44px target, zoom, reduced motion, không overflow và không có dữ liệu/thành tích giả.

## Kết quả thực hiện

Các bước đã triển khai. Bằng chứng, ma trận nghiệm thu và giới hạn nằm trong [báo cáo kiểm chứng](refactor-verification.md). Chưa commit/push/deploy; bước chọn hosting và publish artifact là công việc release riêng.
