TL;DR: Reading Practice gồm 50 bài và 10 bài ôn tập theo tuần, dành cho tài khoản `thanhpv`.

Nguồn: [cuộc hội thoại Reading được chia sẻ](https://chatgpt.com/share/6af1f18e-b4a4-83ec-b2f0-0eda93fe60f9). Mỗi bài và mỗi Weekly Review có file Markdown riêng. Mỗi review đặt bộ 5 câu ngay sau passage tương ứng; các bảng dữ liệu và giải thích được giữ cùng bài.

`manifest.json` xác định thứ tự, `scripts/reading-practice-catalog.mjs` đọc và kiểm tra nguồn để nhập vận hành. Runtime đọc catalog từ Turso, không đọc các file này. Sau khi review thay đổi, công cụ `scripts/publish-reading-practice.mjs` chỉ tạo catalog mới hoặc xác minh catalog trùng khớp; nếu nội dung đã tồn tại khác đi, công cụ từ chối ghi đè. Khi cần cập nhật nội dung đã xuất bản phải lập và kiểm tra quy trình riêng bảo toàn tiến độ.

Kiểm chứng nội dung: `node --test tests/reading-practice.test.mjs` kiểm tra 60 bài, 550 ID câu hỏi duy nhất, các khối quiz hợp lệ và thứ tự câu hỏi theo passage.
