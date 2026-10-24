TL;DR Đã chuyển UI sang Next.js + Neobrutalism mobile first; các kiểm chứng local được liệt kê dưới đây.

# Báo cáo kiểm chứng refactor — 2026-10-24

## Cập nhật thư viện Turso dùng chung

- Nội dung runtime chuyển hoàn toàn sang Turso; không import src/data/practice-data.js, không lưu nội dung vào localStorage/sessionStorage. Có migration một lần cho Markdown legacy, chỉ xóa bản local sau DB acknowledgement.
- Đã áp dụng schema + ledger/checksum Liquibase 4.33.0 trên DB được cấp, xác nhận reapply không đổi. Đã nhập và đối chiếu hash catalog gồm 6 nhóm IELTS cùng ví dụ Markdown/Word Order.
- Đã smoke test qua Next.js API nối **Turso thật**: lưu bài IELTS đầu tiên (10 mục), retry cùng request không tăng lượt, phiên khác mở lại đúng source. Bài IELTS thật được giữ trong thư viện; bộ test khác chỉ dùng SQLite fixture riêng.
- 24 unit/contract/repository test pass; strict TypeScript, format và production build pass. Kiểm chứng transaction rollback, record khi parse hợp lệ, không nhân bản nội dung, cursor, progress conflict và cô lập phiên. Browser kiểm tra lưu/mở lại trên từng công cụ, thư viện chung, lỗi lưu không đóng dialog, migration legacy và responsive.
- Local và Vercel đều cần Next.js server runtime. Các ghi chú static export, Hot Review hoặc Audio Looper bên dưới là mốc lịch sử, không còn mô tả runtime hiện tại. Chưa deploy thay đổi này lên Vercel hoặc kiểm thử thiết bị thật.

## Cập nhật Multiple Choice

- Cập nhật tiếp theo: Audio Looper đã được bỏ theo yêu cầu; mô tả và test Looper ở mốc lịch sử bên dưới không còn áp dụng. Build không lập danh mục/copy MP3. Test phát âm của các công cụ học vẫn giữ.

- Multiple Choice thay Hot Review theo yêu cầu mới; định dạng dấu | chứa đáp án 1–4 trong cùng bộ bài. Các mô tả Hot Review bên dưới là mốc lịch sử của đợt refactor ban đầu, đã được thay bằng [contract mới](MULTIPLE_CHOICE.md).
- Unit/contract hiện có 20 test pass, bao gồm parser dấu |, multiline/escaped quotes, báo lỗi theo dòng, đáp án sai định dạng và ID ôn sau khi đổi thứ tự câu.
- Browser đã kiểm chứng chấm đúng/sai, khóa đáp án, context/giải thích/ví dụ, luyện lại câu sai, ôn sau sau reload, giữ ID legacy, copy, số câu/trang, nhập lỗi không làm mất tiến độ, nội dung HTML không chạy và reset/xóa bộ. Hai test mới kiểm tra accessibility và nội dung dài tại 360/430/1280px.
- Build production local và format pass. Viền focus của ô nhập dùng tím đậm theo yêu cầu; giữ focus cho bàn phím và forced colors. Chưa deploy hoặc kiểm thử trên thiết bị thật cho thay đổi này.

## Kết quả tổng thể

- `npm test`: **15/15 pass**. Bao gồm parser Markdown/quiz cũ đã chuyển vị trí, CSV, chuẩn hóa đáp án, toàn bộ bộ IELTS và các bộ 5 bài Structures.
- `npm run build`: pass, tạo artifact tĩnh cho `/` và `/markdown/` trong out/.
- `npm run format:check`: pass.
- `npx playwright test`: **23/23 pass**, Microsoft Edge headless trên Windows.
- `npm run dev`: khởi động thành công; smoke test Hot Review và workspace Markdown không có pageerror.
- Kiểm tra liên kết Markdown local trong 8 tài liệu được sửa/thêm: không có link hỏng. `git diff --check`: pass.

## Đối chiếu yêu cầu

| Yêu cầu | Bằng chứng hiện tại |
| --- | --- |
| Chốt Next.js + Neobrutalism | Quyết định UI-01 trong project-decisions.md; dependency pin trong package.json/lockfile; source route/layout ở src/app |
| Token và component chung | src/styles/tokens.css; src/components/ui/primitives.jsx; dialog/CSV/progress/status/button dùng ở nhiều feature |
| Component riêng theo hành vi | Instant, flashcard, Word Order/Typing, reference panels, Writing, Hot Review và Looper nằm trong src/components/study; không dùng generic study card đa cờ |
| Tách dữ liệu/audio/nghiệp vụ | CSV và Hot parser trong services; kiểm tra đáp án thuần ở answer-service; Sound of Text và media ở audio-service/use-speech; controller UI Hot/Markdown có lifecycle teardown |
| Instant Vocab | CSV và IELTS thật; phát từng mục; lỗi dịch vụ; Play all/Stop; thứ tự phát và lặp do service/hook điều khiển. Browser audio fixture xác nhận rate/volume và Stop; live TTS thực tế xác nhận phát được |
| Vocab Review | Test mặt trước/sau, Hiragana, auto audio toggle, Later, shuffle, previous, restart và zoom |
| Word Order và Typing | Test sai/đúng theo bài làm thực; hoàn tác token, đổi nút chính, Enter, dùng chung bộ bài, normalize typing; source giữ phím trái/phải, J/L, Enter/Space ngoài vùng nhập; reset/sample/skip/repractice được kiểm tra đối chiếu handler |
| Sentence Structures | Test mở đúng 5 bài; unit test toàn bộ exercise và mức. Callback chuyển EN + Focus |
| Speaking Questions | Bộ câu hỏi nguồn giữ nguyên; lọc Part 2 và cue card được kiểm tra; selector chủ đề/ngày dùng cùng nguồn dữ liệu |
| Writing Review | Test schema context/prompt/input/sample_answer, nhập bài, ghi nhận và xem mẫu. Copy CSV, clear và trước/sau được đối chiếu handler; không chấm AI/band |
| Hot Review | Test nhập câu hỏi/answer, giải thích, Later, persistence sau reload, phân trang, số câu/trang, xác nhận và copy đúng lựa chọn. Parser giữ sắp số câu và mapping answer theo thứ tự cũ |
| Audio Looper | Test phát/tạm dừng file WAV local bằng media thật; bộ public fixture xác nhận chuyển nhóm sau số vòng lặp; source có random, restart, speed, danh sách từ và dialog đầy đủ |
| Markdown & Quiz | Test Mermaid, quiz đúng/sai/kết quả, nguồn lưu sau reload nhưng đáp án không lưu; Cancel, mở file, editor live, divider bằng keyboard, sync scroll, copy, nút gọi print/PDF, print CSS, dark và lọc HTML nguy hiểm |
| IELTS picker | Test chọn ngẫu nhiên và nạp nội dung thật; bộ lọc/checkbox và nút bắt đầu được axe kiểm tra. Source giữ chọn tất cả đang hiện/bỏ chọn, các khóa random-count và done theo phiên |
| Mobile và desktop | 390px là viewport mặc định; tất cả shell ở 360, 430 và 1280px không tràn ngang. Có test focus textarea với viewport 390×420, action bar không đè ô nhập |
| Accessibility | Axe kiểm tra shell, picker, cài đặt và Markdown; control chung tối thiểu 44px; dialog native/label/focus; source cho phép zoom, reduced motion và có chữ/icon phản hồi |
| Loại module cũ | Xóa giao diện/code và 20 trang Kanji riêng; không còn route/selector Kana, Kanji hoặc Final Review trong source chạy. Hot Review đã tách khỏi file Final Review |
| Giữ dữ liệu | Unit test deepEqual module sinh với toàn bộ JSON nguồn; giữ input/ ở root và docs/ielts/. Sau refactor, chủ dự án yêu cầu xóa resource Anki cũ và docs/input; xem project-decisions.md |
| Không tự publish | Không commit, push, tạo workflow hoặc deploy. Hướng dẫn artifact/hosting trong runbook.md |

## Kiểm tra bổ sung ngoài bộ test

- Build với NEXT_PUBLIC_BASE_PATH=/n5-tungkinh: mở được trang học, chọn/nạp IELTS và mở Markdown; không có pageerror hoặc HTTP asset thất bại trong luồng smoke này. Sau đó build lại ở root cho preview hiện tại.
- Sound of Text thật: tạo được URL từ files.soundoftext.com; browser tạo và phát được audio tiếng Anh (Hello). Đây là smoke test tại thời điểm kiểm tra, không phải đảm bảo availability/quota dài hạn.
- Trên preview local không nén, trang đầu tải 8 file JS với tổng decodedBodySize **533.118 byte**. Khi mở bộ chọn IELTS mới tải thêm chunk dữ liệu **604.128 byte**. Số đo từ Resource Timing; không suy ra tốc độ trên mạng/thiết bị production.
- Đã xem ảnh render các màn đại diện mobile và desktop. Có thể tạo lại bằng `node scripts/capture-preview.mjs` khi preview đang chạy; ảnh trong test-results/preview/ là artifact local, không commit.

## Giới hạn đã xác minh và việc release riêng

- Checkout không có MP3 public. Build tạo danh mục rỗng và UI báo đúng trạng thái; file local vẫn phát được. Nhánh public audio được kiểm chứng với manifest/media fixture, không tuyên bố đã có thư viện MP3 production.
- Kiểm tra mobile dùng viewport mô phỏng; chưa kiểm tra trên điện thoại vật lý, bàn phím hệ điều hành hoặc Safari/iOS thật. Test chiều cao giảm chứng minh bố cục thích ứng trong môi trường mô phỏng.
- PDF được kiểm tra handler gọi print và CSS in; chưa xác nhận thao tác Save as PDF bằng hộp thoại hệ điều hành của người dùng.
- TTS ngoài có thể lỗi theo mạng/quota. Đã kiểm tra cả smoke thật và các nhánh thành công/thất bại bằng fixture có thể lặp lại.
- Chưa smoke test URL production hoặc đổi host. Cấu hình GitHub Pages cũ main:/docs không build Next.js; cần chọn cách publish out/ trước release. Không xuất output đè lên docs/ nguồn.
- Việc đưa toàn bộ Hot/Markdown sang state React thuần có thể thực hiện sau khi có nhu cầu; hiện controller được cô lập theo feature, dùng dịch vụ/parser riêng và cleanup listener, không inject cả trang sample.
