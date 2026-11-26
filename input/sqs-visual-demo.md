# M08.1: Messaging Fundamentals — Amazon SQS & DLQ

## 1. Tại sao cần Message Queue?

Giả sử hệ thống E-commerce cần gửi email và cập nhật tồn kho sau khi khách hàng đặt hàng.

### Synchronous — Phụ thuộc trực tiếp

Các service phụ thuộc trực tiếp vào thời gian phản hồi của nhau.

```visual-flow
direction: horizontal

server | Order Service | Chờ phản hồi tuần tự
cpu | Email Service | Nếu chậm → nghẽn
database | Inventory | Dễ lỗi dây chuyền
```

### Asynchronous — Sử dụng SQS

```visual-flow
direction: horizontal

server | Order Service | Gửi message rồi trả về ngay
layers | Amazon SQS | Lưu và điều phối message
cpu | Workers | Email & Inventory xử lý độc lập
```

### SQS giải quyết những vấn đề gì?

```visual-grid
title: SQS Benefits
columns: 2

unlink | Decoupling | Giảm phụ thuộc giữa services
layers | Buffering | Hấp thụ traffic spike
shield-check | Reliability | Lưu trữ message trong queue
refresh-cw | Retry | Xử lý lại message thất bại
trending-up | Scaling | Tăng worker theo queue depth
```

## 2. SQS Standard vs FIFO

Hệ thống gửi email không cần đúng thứ tự. Tuy nhiên, cập nhật trạng thái đơn hàng cần xử lý tuần tự.

```visual-compare
title: Standard vs FIFO

[Standard]
icon: shuffle
badge: Best effort
description: Ưu tiên throughput
send: A, B, C
receive: A, C, B, B
note: Có thể sai thứ tự và trùng message.
useCase: Email, image processing.

[FIFO]
icon: list-ordered
badge: Strict order
description: Ưu tiên ordering
send: A, B, C
receive: A, B, C
note: Đúng thứ tự trong cùng Message Group ID.
useCase: Order, inventory.
```

| Tiêu chí | Standard | FIFO |
| --- | --- | --- |
| Throughput | Rất cao | Giới hạn hơn |
| Ordering | Best effort | Strict trong group |
| Delivery | At least once | Hỗ trợ deduplication |
| Consumer | Idempotent | Vẫn cần idempotent |

> **Pitfall:** FIFO không đảm bảo business logic chỉ thực thi đúng một lần trong mọi tình huống.

## 3. Visibility Timeout

Khi Worker A nhận message, SQS tạm ẩn message để hạn chế worker khác nhận cùng message trong lúc xử lý.

```visual-flow
direction: horizontal

download | Receive
eye-off | Invisible
settings | Process
trash-2 | Delete
```

### Failure scenario — Duplicate Processing

```visual-simulation
title: Visibility Timeout Simulator
type: sqs-visibility-timeout
visibilityTimeout: 30
processingTime: 60
```

Mặc định 30 giây, tối đa 12 giờ. Có thể gia hạn bằng `ChangeMessageVisibility`.

> **Solution:** Visibility Timeout phù hợp + gia hạn khi cần + idempotent consumer.

## 4. Dead Letter Queue (DLQ)

Một message chứa payload không hợp lệ liên tục gây lỗi. Retry mãi không giải quyết được nguyên nhân. DLQ giúp tách message lỗi khỏi main queue.

```visual-timeline
title: Quy trình xử lý Poison Message với DLQ

Bước 1 | Tách khỏi Main Queue | Sau khi retry vượt ngưỡng maxReceiveCount, SQS chuyển sang DLQ
Bước 2 | Investigate | Kiểm tra log và payload gây lỗi trong môi trường an toàn
Bước 3 | Fix | Sửa lỗi code consumer hoặc chuẩn hóa dữ liệu đầu vào
Bước 4 | Redrive | Đẩy message từ DLQ về lại Main Queue để xử lý hoàn tất
```

```visual-flow
direction: horizontal

search | Investigate
wrench | Fix
play | Redrive
```

## 5. SQS Cheatsheet

```visual-metrics
columns: 2

clock | Long Polling | 20s | Giảm empty responses
database | Message Retention | 14 ngày | Mặc định 4 ngày
timer | Delay Queue | 15 phút | Trì hoãn message tối đa
eye-off | Visibility Timeout | 12 giờ | Mặc định 30 giây
lock | Encryption | HTTPS / KMS | Bảo vệ dữ liệu
trending-up | Auto Scaling | Queue Depth | Điều chỉnh số lượng worker
```

Với payload lớn hơn giới hạn message, lưu dữ liệu trong S3 và gửi object reference qua SQS.

## 6. Active Recall — Quiz

```quiz-deck
sqs-q1 | single_choice | Câu 1. Hệ thống nhận 10.000 image processing requests. Worker không xử lý kịp. | Tăng API timeout | SQS làm buffer | ACM | Route 53 | 2 | SQS hấp thụ traffic spike để worker xử lý dần theo năng lực.
sqs-q2 | single_choice | Câu 2. Cần xử lý tuần tự các event trạng thái của cùng một đơn hàng. | SQS Standard | SQS FIFO với Message Group ID | Delay Queue 15 phút | Long Polling 20s | 2 | FIFO Queue đảm bảo strict ordering trong cùng Message Group ID.
sqs-q3 | single_choice | Câu 3. Worker xử lý mất 60s trong khi Visibility Timeout là 30s. Rủi ro là gì? | Message bị xóa ở giây 30 | Duplicate processing bởi worker khác | Message vào thẳng DLQ ngay | Queue tự chuyển sang FIFO | 2 | Sau 30s hết Visibility Timeout, message xuất hiện lại nếu chưa bị xóa.
sqs-q4 | single_choice | Câu 4. Tách message lỗi lặp vô hạn khỏi main queue bằng cơ chế nào? | Dead Letter Queue (DLQ) | Long Polling | KMS Encryption | Auto Scaling | 1 | DLQ cô lập poison message để Investigate, Fix và Redrive.
sqs-q5 | single_choice | Câu 5. Giảm empty responses khi worker polling queue rỗng bằng cách nào? | Delay Queue | Long Polling (tối đa 20s) | Message Retention 14 ngày | ChangeMessageVisibility | 2 | Long Polling giữ kết nối tối đa 20s chờ message mới.
sqs-q6 | single_choice | Câu 6. Xử lý payload lớn hơn giới hạn message của SQS như thế nào? | Lưu dữ liệu trên S3 và gửi object reference qua SQS | Chia nhỏ sang nhiều Standard Queue | Dùng Route 53 | Giảm Retention xuống 4 ngày | 1 | Lưu payload lớn trong S3 và gửi tham chiếu qua SQS.
```
