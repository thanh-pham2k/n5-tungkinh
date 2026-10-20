# Markdown & Quiz

Mở **Markdown Preview ↗** từ trang chính hoặc truy cập `markdown-preview.html`. Đây là trang riêng cho desktop: editor bên trái và preview bên phải, cập nhật trực tiếp khi nhập (sau 300 ms). Chọn **Bài mẫu** để thử.

Toolbar có Open (mở file Markdown), Copy (copy Markdown gốc), Export PDF (hộp thoại in của trình duyệt, chọn Save as PDF), Reset, Sync scroll theo tỷ lệ và Dark mode. Mỗi cột cuộn độc lập; bố cục luôn giữ hai cột, không chuyển sang giao diện mobile.

Heading, paragraph, list, table và code block được render như Markdown. Code block có ngôn ngữ `mermaid` được vẽ thành sơ đồ. Nếu sơ đồ lỗi, ứng dụng giữ mã nguồn và báo lỗi ngay tại vị trí đó.

Định dạng gọn được khuyến nghị: một code block `quiz` hoặc `quiz-deck`, mỗi dòng là một câu hỏi. Cả hai tên dùng cùng parser; prompt dạy học với 2–5 câu sau mỗi phần có thể dùng nguyên định dạng `quiz-deck`.

````markdown
```quiz
git-branch-01 | single_choice | Branch là gì? | Bản copy source | Reference trỏ tới commit | 2 | Branch lưu commit hash.
git-branch-02 | single_choice | Tạo branch có nhanh không? | Có | Không | 1 | Chỉ tạo một reference nhỏ.
```
````

Thứ tự trường: `id | type | question | option 1 | option 2 | … | answer | explanation`.

- Tách trường bằng đúng chuỗi ` | `; không dùng chuỗi đó bên trong nội dung trường.
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

Chọn đáp án để xem phản hồi. Dùng nút Trước/Tiếp, nút số câu hoặc vuốt ngang trên điện thoại để chuyển câu. Nút **Xem kết quả** ở câu cuối cho biết điểm và câu chưa làm; có thể quay lại từng câu hoặc **Luyện lại bộ này**.

Nội dung editor và đáp án lưu trong localStorage của trình duyệt, tự khôi phục khi mở lại. Khi chỉnh câu hỏi, lựa chọn hoặc đáp án thì đáp án cũ của câu đã sửa sẽ được xóa. Nội dung được lưu tự động khi preview cập nhật. Nếu trình duyệt chặn lưu trữ, ứng dụng báo lỗi và vẫn cho học trong phiên hiện tại.

Không copy CSS/HTML của sơ đồ đã render trong ChatGPT (`#chatgpt-mermaid...`); hãy copy Markdown gốc. Các thư viện Marked, DOMPurify và Mermaid được tải từ CDN với phiên bản cố định, vì vậy lần tải trang cần kết nối mạng. HTML Markdown được lọc qua DOMPurify và Mermaid dùng chế độ strict.

Kiểm tra parser:

```sh
node --test docs/js/lesson-parser.test.cjs
```
