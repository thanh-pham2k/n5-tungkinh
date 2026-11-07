TL;DR 41 bài EVIU được trích xuất từ [cuộc chat chia sẻ](https://chatgpt.com/share/6aef977a-86a4-83ec-a12e-0ab66730a84c); Markdown là bản vận hành và sao lưu, runtime đọc catalog Turso.

Danh mục theo thứ tự học; `manifest.json` là nguồn thứ tự và ID ổn định. Mỗi bài đã được chuyển từ nội dung câu trả lời tương ứng và kiểm tra bằng parser.

| Bài | Unit và tiêu đề | Markdown | Trạng thái |
| --- | --- | --- | --- |
| 1 | Unit 1 — Learning Vocabulary | [01.md](01.md) | Đã trích xuất, parse và nhập catalog |
| 2 | Unit 2 — Keeping a Vocabulary Notebook | [02.md](02.md) | Đã trích xuất, parse và nhập catalog |
| 3 | Unit 3 — Using a Dictionary | [03.md](03.md) | Đã trích xuất, parse và nhập catalog |
| 4 | Unit 16 — Daily Routines | [16.md](16.md) | Đã trích xuất, parse và nhập catalog |
| 5 | Unit 17 — The Place Where You Live | [17.md](17.md) | Đã trích xuất, parse và nhập catalog |
| 6 | Unit 18 — Around the Home | [18.md](18.md) | Đã trích xuất, parse và nhập catalog |
| 7 | Unit 19 — Money | [19.md](19.md) | Đã trích xuất, parse và nhập catalog |
| 8 | Unit 20 — Health | [20.md](20.md) | Đã trích xuất, parse và nhập catalog |
| 9 | Unit 24 — Food | [24.md](24.md) | Đã trích xuất, parse và nhập catalog |
| 10 | Unit 25 — Cooking | [25.md](25.md) | Đã trích xuất, parse và nhập catalog |
| 11 | Unit 21 — Clothes | [21.md](21.md) | Đã trích xuất, parse và nhập catalog |
| 12 | Unit 23 — Shopping | [23.md](23.md) | Đã trích xuất, parse và nhập catalog |
| 13 | Unit 28 — Transport | [28.md](28.md) | Đã trích xuất, parse và nhập catalog |
| 14 | Unit 29 — On the Road | [29.md](29.md) | Đã trích xuất, parse và nhập catalog |
| 15 | Unit 26 — City Life | [26.md](26.md) | Đã trích xuất, parse và nhập catalog |
| 16 | Unit 65 — Apologies, Excuses and Thanks | [65.md](65.md) | Đã trích xuất, parse và nhập catalog |
| 17 | Unit 66 — Requests, Permission and Suggestions | [66.md](66.md) | Đã trích xuất, parse và nhập catalog |
| 18 | Unit 35 — Jobs | [35.md](35.md) | Đã trích xuất, parse và nhập catalog |
| 19 | Unit 36 — Talking About Your Work | [36.md](36.md) | Đã trích xuất, parse và nhập catalog |
| 20 | Unit 37 — Making a Career | [37.md](37.md) | Đã trích xuất, parse và nhập catalog |
| 21 | Unit 74 — Word Partners (Collocations) | [74.md](74.md) | Đã trích xuất, parse và nhập catalog |
| 22 | Unit 38 — Working in an Office | [38.md](38.md) | Đã trích xuất, parse và nhập catalog |
| 23 | Unit 39 — Running a Company | [39.md](39.md) | Đã trích xuất, parse và nhập catalog |
| 24 | Unit 40 — Business and Finance | [40.md](40.md) | Đã trích xuất, parse và nhập catalog |
| 25 | Unit 75 — Fixed Phrases | [75.md](75.md) | Đã trích xuất, parse và nhập catalog |
| 26 | Unit 76 — Fixed Phrases in Conversation | [76.md](76.md) | Đã trích xuất, parse và nhập catalog |
| 27 | Unit 53 — Phoning and Texting | [53.md](53.md) | Đã trích xuất, parse và nhập catalog |
| 28 | Unit 55 — Email and the Internet | [55.md](55.md) | Đã trích xuất, parse và nhập catalog |
| 29 | Unit 95 — Formal and Informal English | [95.md](95.md) | Đã trích xuất, parse và nhập catalog |
| 30 | Unit 98 — Formal Letters and Emails | [98.md](98.md) | Đã trích xuất, parse và nhập catalog |
| 31 | Unit 81 — Make, Do and Take: Uses and Phrases | [81.md](81.md) | Đã trích xuất, parse và nhập catalog |
| 32 | Unit 82 — Key Verbs: Give, Keep and Miss | [82.md](82.md) | Đã trích xuất, parse và nhập catalog |
| 33 | Unit 83 — Get: Uses, Phrases and Phrasal Verbs | [83.md](83.md) | Đã trích xuất, parse và nhập catalog |
| 34 | Unit 84 — Go: Meanings and Expressions | [84.md](84.md) | Đã trích xuất, parse và nhập catalog |
| 35 | Unit 79 — Phrasal Verbs 1: Form and Meaning | [79.md](79.md) | Đã trích xuất, parse và nhập catalog |
| 36 | Unit 80 — Phrasal Verbs 2: Grammar and Style | [80.md](80.md) | Đã trích xuất, parse và nhập catalog |
| 37 | Unit 86 — Uncountable Nouns | [86.md](86.md) | Đã trích xuất, parse và nhập catalog |
| 38 | Unit 89 — Adjectives | [89.md](89.md) | Đã trích xuất, parse và nhập catalog |
| 39 | Unit 90 — Prepositions: Place and Movement | [90.md](90.md) | Đã trích xuất, parse và nhập catalog |
| 40 | Unit 91 — Adverbs | [91.md](91.md) | Đã trích xuất, parse và nhập catalog |
| 41 | Unit 77 — Verb or Adjective + Preposition | [77.md](77.md) | Đã trích xuất, parse và nhập catalog |

Import chủ động dùng `scripts/publish-eviu.mjs --dry-run <hostname>` rồi `--apply <hostname>` với credentials phía server. Script tạo snapshot catalog EVIU trước khi ghi, kiểm tra 41 bài và từ chối ghi đè nội dung khác; không chạy khi build hoặc request.

## Cấu trúc học

Giữ thứ tự 41 unit đã chọn, chia thành ba phase; mỗi module có tối đa năm unit. Lịch sử và tiến độ vẫn gắn với nội dung bài.

- Phase 1 — Học từ vựng & đời sống: Module 1–3, bài 1–15.
- Phase 2 — Giao tiếp & công việc: Module 4–6, bài 16–30.
- Phase 3 — Động từ & ngữ pháp từ: Module 7–9, bài 31–41; Module 9 gồm Unit 77.
