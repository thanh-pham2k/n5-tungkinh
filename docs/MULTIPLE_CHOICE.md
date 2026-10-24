TL;DR Multiple Choice thay Hot Review; nhập câu hỏi và đáp án trong cùng một bộ dữ liệu phân cách bằng dấu |.

# Nhập câu hỏi

```text
question|option_1|option_2|option_3|option_4|correct_answer|explanation|context|example|example_meaning
「学生」の読み方は？|がくせい|がっこう|せんせい|かいしゃ|1|学生 đọc là がくせい。||私は学生です。|Tôi là học sinh.
```

- Bắt buộc: question, option_1–option_4 và correct_answer. Đáp án đúng dùng số 1–4, không dùng A–D hoặc nội dung đáp án.
- explanation, context, example, example_meaning có thể trống hoặc bỏ khỏi header. Dùng context, không có dấu ngoặc vuông. Nếu giữ cột trong header, mỗi dòng phải có đủ số cột, kể cả ô trống ở cuối.
- Cho phép đổi thứ tự cột theo header. Header trùng, cột lạ, thiếu dữ liệu bắt buộc, số cột sai và dấu nháy lỗi sẽ chặn nạp cả bộ, báo dòng nguồn; bộ đang học vẫn giữ nguyên.
- Ô chứa dấu |, dấu nháy hoặc xuống dòng cần bọc trong dấu nháy kép. Dấu nháy bên trong ô viết thành hai dấu nháy liên tiếp. Không thêm dòng phân cách của bảng Markdown.
- Nội dung hiển thị dạng văn bản; không chạy HTML, script hoặc đọc image_url. Cú pháp Furigana dạng 漢字（かんじ）được hỗ trợ ở câu hỏi, lựa chọn và ví dụ.

Ví dụ ô chứa dấu phân cách và dấu nháy:

```text
question|option_1|option_2|option_3|option_4|correct_answer
"Chọn cách đọc của ""A | B"""|Một|Hai|Ba|Bốn|1
```

# Làm bài

Mặc định một câu mỗi trang. Context xuất hiện trước câu hỏi, bốn đáp án xếp dọc. Chọn một đáp án rồi bấm Kiểm tra; lúc này mới hiện đúng/sai, đáp án đúng, giải thích và ví dụ. Câu đã kiểm tra khóa lựa chọn.

Tùy chọn ôn tập gồm tất cả câu hỏi, ôn sau, làm lại câu sai, làm lại từ đầu, số câu mỗi trang (1–50), sao chép kết quả đã kiểm tra và xóa bộ đang học. Luyện lại câu sai chỉ xóa kết quả của các câu sai, giữ các câu đã đúng. Nghe câu hỏi dùng cài đặt audio chung.

Bộ bài và record nhập hợp lệ lưu trên Turso. Mở Bài đã lưu để ôn lại sau khi reload, không phải nhập lại. Có thể xóa bài khỏi danh sách bằng nút Xóa rồi xác nhận; việc này xóa vĩnh viễn khỏi thư viện chung và gỡ tiến độ của mọi phiên. Đáp án/ôn sau lưu DB theo cookie phiên riêng, không dùng localStorage. ID dựa trên câu hỏi, lựa chọn, đáp án và context; không tự ghép ID Hot Review legacy. Xóa bộ đang học chỉ dọn màn hiện tại, không xóa nội dung khỏi thư viện chung.

CSV Hot Review cũ và CSV đáp án riêng không còn được nhập trực tiếp. Chuyển question_jp thành question, option_a–option_d thành option_1–option_4; ghép đáp án A/B/C/D thành 1/2/3/4 và đưa answer_detail_vi vào explanation trước khi nhập. Không tự suy đoán đáp án còn thiếu.
