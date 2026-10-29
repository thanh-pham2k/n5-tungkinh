# Markdown & Quiz

Mở **Markdown & Quiz** từ điều hướng hoặc truy cập route `/markdown/` (cộng base path nếu có). Trên desktop, trang riêng có editor bên trái và preview bên phải, cập nhật trực tiếp khi nhập (sau 300 ms). Chọn **Bài mẫu** để thử.

Toolbar có Open (mở file Markdown), Copy (copy Markdown gốc), Export PDF (hộp thoại in của trình duyệt, chọn Save as PDF), Reset, Sync scroll theo tỷ lệ và Dark mode. Trên desktop, mỗi cột cuộn độc lập và thanh giữa kéo được để đổi độ rộng.

Trên điện thoại (chiều rộng tối đa 760px), chỉ hiển thị preview toàn chiều rộng. Bấm **Nhập Markdown** để mở dialog, dán nội dung rồi chọn **Xem preview**. **Hủy** hoặc Escape giữ nguyên bài cũ. Editor và thanh kéo hai cột được ẩn, Sync scroll tắt theo bố cục mobile; toolbar xuống dòng để trang không phải cuộn ngang. Code/ASCII dài vẫn có thể cuộn ngang trong riêng khối code.

Heading, paragraph, list, table và code block được render như Markdown. Code block có ngôn ngữ `mermaid` được vẽ thành sơ đồ. Nếu sơ đồ lỗi, ứng dụng giữ mã nguồn và báo lỗi ngay tại vị trí đó.

Định dạng gọn được khuyến nghị: một code block `quiz` hoặc `quiz-deck`, mỗi dòng là một câu hỏi. Cả hai tên dùng cùng parser; prompt dạy học với 2–5 câu sau mỗi phần có thể dùng nguyên định dạng `quiz-deck`.

````markdown
```quiz
git-branch-01 | single_choice | Branch là gì? | Bản copy source | Reference trỏ tới commit | 2 | Branch lưu commit hash.
git-branch-02 | single_choice | Tạo branch có nhanh không? | Có | Không | 1 | Chỉ tạo một reference nhỏ.
```
````

Thứ tự trường: `id | type | question | option 1 | option 2 | … | answer | explanation`.

- Tách trường bằng đúng chuỗi `|`; không dùng chuỗi đó bên trong nội dung trường.
- Mỗi câu nằm trên một dòng; bỏ qua dòng trống.
- Ít nhất hai lựa chọn; đáp án đánh số từ 1. ID duy nhất trong bài.
- Chỉ hỗ trợ `single_choice`. Câu hỏi, lựa chọn và giải thích hỗ trợ inline code, chữ đậm/nghiêng.
- Dòng sai có thông báo riêng; các dòng đúng vẫn tạo quiz.
- Khi viết ví dụ về code block quiz, bọc ngoài bằng fence bốn backtick để nó chỉ hiển thị như code.

Định dạng `:::quiz` nhiều dòng cũ vẫn được hỗ trợ:

Mỗi quiz dùng định dạng nhiều dòng sau (đáp án đánh số từ **1**):

```text
:::quiz
id: git-branch-01
type: single_choice
question: Branch là gì?
options:
  - Một bản copy source code
  - Một reference trỏ tới commit
answer: 2
explanation: Branch lưu commit hash mà nó đang trỏ tới.
:::
```

ID phải duy nhất trong bài. MVP hỗ trợ `single_choice`; không hỗ trợ YAML đầy đủ, quiz viết gộp một dòng hoặc `quiz-group`. Mỗi lựa chọn bắt đầu bằng `- `. Nội dung quiz hỗ trợ Markdown inline cơ bản.

Các quiz liên tiếp (cho phép dòng trống giữa chúng) tạo thành một deck. Paragraph, heading, code block hoặc quiz lỗi kết thúc deck hiện tại. Quiz nằm trong fenced code block chỉ là ví dụ, không tạo câu hỏi tương tác.

Các lựa chọn trắc nghiệm và mảnh Word Order được xáo ngẫu nhiên khi mở câu hoặc luyện lại; thứ tự có thể trùng lần trước. Chọn đáp án để xem phản hồi. Dùng nút Trước/Tiếp, nút số câu hoặc vuốt ngang trên điện thoại để chuyển câu. Nút **Xem kết quả** ở câu cuối cho biết điểm và câu chưa làm; có thể quay lại từng câu hoặc **Luyện lại bộ này**.

Nội dung editor được lưu Turso sau khi parse hợp lệ và mở lại từ Lịch sử nhập; lần mở workspace tải log chung gần nhất rồi parse lại. Đáp án quiz lưu DB theo cookie phiên riêng. Khi chỉnh định nghĩa câu hỏi, đáp án cũ của câu đã sửa bị xóa. Nội dung Markdown local legacy được chuyển một lần lên DB rồi mới xóa; không dùng localStorage/sessionStorage làm fallback. Nếu lưu lỗi, UI báo chưa lưu để thử lại; không tuyên bố đã ghi nhận thành công.

Không copy CSS/HTML của sơ đồ đã render trong ChatGPT (`#chatgpt-mermaid...`); hãy copy Markdown gốc. Marked, DOMPurify và Mermaid được pin trong package-lock.json và tải theo chunk của ứng dụng khi mở workspace. HTML Markdown được lọc qua DOMPurify và Mermaid dùng chế độ strict.

Kiểm tra parser:

```sh
npm test
```

## Word Order và Typing

Có thể đặt các loại câu cạnh `single_choice` trong cùng block `quiz` hoặc `quiz-deck`:

````markdown
```quiz
q1 | word_order | Sắp xếp thành câu | She / goes / to school | She goes to school. | Chủ ngữ số ít dùng goes.
q2 | typing | Dịch: Cô ấy đi học. | She goes to school. | Chủ ngữ số ít dùng goes.
```
````

Word Order dùng `id | word_order | câu hỏi | từ hoặc cụm từ | đáp án | giải thích`; phân cách các mảnh bằng `/`, tối thiểu hai mảnh. Typing dùng `id | typing | câu hỏi | đáp án | giải thích`. Các trường đều bắt buộc và không chứa chuỗi phân cách `|`. Nhấn các mảnh để xếp hoặc bỏ chọn, rồi chọn **Kiểm tra**; Typing có thể kiểm tra bằng Enter. Đáp án được so sánh không phân biệt hoa thường, dấu câu và khoảng trắng thừa. Mỗi câu hiện có một đáp án mẫu; cách diễn đạt khác có thể bị tính sai. Hai loại mới chỉ hỗ trợ định dạng block, không dùng `:::quiz`.

## Tiếng Anh công việc trong 30 ngày

Chọn **Tiếng Anh công việc · 30 ngày** trong menu để mở bài đầu ở tab mới; chọn ngày học trên thanh công cụ để chuyển bài. Mỗi bài gồm mẫu câu, giải thích, từ gợi ý, 10 câu tương tác (5 Word Order, 5 Typing) và bài tự viết. Bài được nạp từ catalog Turso và lưu vào Lịch sử nhập; bài tự viết và luyện nói tự thực hành ngoài ô chấm đáp án. Đáp án Typing có một câu mẫu, nên cách diễn đạt khác có thể bị tính sai.

Dữ liệu nguồn vận hành là `database/seed/work-english-30.json`. Sau khi cấu hình Turso cho môi trường đích, chạy `node --env-file=.env.local scripts/seed-work-english.mjs <hostname-Turso-đích>` để thêm catalog; lệnh xác minh nội dung và từ chối ghi đè nếu catalog đã khác. Khi cập nhật một catalog đã tồn tại, truyền thêm đường dẫn JSON của phiên bản đã đối chiếu làm đối số thứ hai; lệnh chỉ cập nhật nếu nội dung hiện tại khớp chính xác phiên bản đó. Không seed từ build hoặc request. Nội dung bài thay đổi tạo bản học mới; lịch sử và tiến độ của bản cũ vẫn được giữ riêng.
