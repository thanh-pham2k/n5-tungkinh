TL;DR UI riêng của dự án theo phong cách Neobrutalism, tham chiếu https://neobrutalism.com/.

# Định hướng UI cho đợt refactor

## Quyết định dự án

- Ngày ghi nhận: 2026-10-24.
- Người quyết định: chủ dự án, theo yêu cầu trong chat.
- Phạm vi: giao diện dự án trong đợt refactor lớn sắp tới và các thay đổi UI tiếp theo.
- Nguồn tham chiếu chính: [NeoBrutalism](https://neobrutalism.com/).
- Đây là lựa chọn phong cách riêng của dự án; áp dụng cùng các quy tắc kỹ thuật trong blueprint. Khi hướng dẫn hình thức chung khác lựa chọn này, ưu tiên phong cách đã chốt ở đây.

## Hướng triển khai hình thức

Các điểm dưới đây là cách diễn giải định hướng Neobrutalism để triển khai; chưa phải bộ design token được duyệt:

- Viền đậm, khối rõ, bóng cứng lệch hướng; màu phẳng và điểm nhấn tương phản.
- Typography có phân cấp mạnh; nội dung học tiếng Nhật và tiếng Việt phải dễ đọc, có font fallback phù hợp.
- Button, card, input và các trạng thái tương tác dùng cùng hệ token về màu, viền, bóng, khoảng cách và bo góc.
- Giữ bố cục dễ sử dụng trên mobile; có focus rõ, thao tác bằng bàn phím và trạng thái loading, empty, error phù hợp.
- Khi refactor, đối chiếu component với trang tham chiếu; tránh pha trộn tùy ý nhiều phong cách.

## Triển khai đã chọn

Chủ dự án chọn Next.js + Neobrutalism ngày 2026-10-24. Xem [quyết định stack](project-decisions.md).

Token chính nằm tại [src/styles/tokens.css](../src/styles/tokens.css): nền kem, giấy sáng, mực tối, nhấn vàng; xanh mint cho phản hồi tích cực, đỏ nhạt cho lỗi. Viền 2px, bóng cứng 3px, control tối thiểu 44px. Dùng font hệ thống hỗ trợ Việt/Anh/Nhật, không tải font ngoài để bắt đầu học.

Nền UI dùng component chung trong src/components/ui; các feature có component riêng. Trên mobile, thiết lập phụ mở theo nhu cầu; Focus thu gọn điều hướng và ưu tiên bài đang học. Giữ zoom, keyboard focus, giảm chuyển động và nội dung thật.

Không dùng avatar, XP, band, AI chấm bài hoặc dữ liệu mẫu như tính năng đã có. Bỏ Kana, thư viện Kanji riêng và Final Review; giữ Furigana trong nội dung học.
