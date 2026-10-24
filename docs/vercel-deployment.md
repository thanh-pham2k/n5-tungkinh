TL;DR Import repo vào Vercel, chọn Next.js và thêm hai biến Turso phía server trước khi deploy.

# Deploy Vercel + cấu hình Turso

## Cấu hình dự án

- Root Directory: root của repo (nơi chứa package.json và vercel.json).
- Framework Preset: Next.js.
- Node.js: 22.x, phù hợp engines trong package.json.
- Install Command: npm ci.
- Build Command: npm run build.
- Output Directory: .next (đã khai báo trong vercel.json).
- Không dùng Vite preset hoặc output dist cho repo này.

Cả Vercel và local đều dùng Next.js server runtime cho API Turso; không bật static export out/. Schema/catalog của DB đã cấp đã được migration/seed riêng theo [database.md](database.md). Không chạy migration hoặc seed trong build. Các trang vỏ vẫn có thể prerender; nội dung học tải từ Turso ở runtime.

## Biến môi trường

Trong Project → Settings → Environment Variables, thêm:

| Tên | Giá trị | Phạm vi |
| --- | --- | --- |
| TURSO_DATABASE_URL | URL database đã cung cấp, lấy từ .env.local trên máy | Production |
| TURSO_AUTH_TOKEN | Token database, lấy từ .env.local trên máy | Production; đánh dấu Sensitive nếu có |

Preview/Development dùng database và credential riêng. Không chọn tất cả môi trường với token production mặc định. Không đặt token trong NEXT_PUBLIC_*, vercel.json, Git hoặc frontend.

NEXT_PUBLIC_BASE_PATH để trống/không khai báo khi app chạy ở root domain Vercel. Không đặt /n5-tungkinh trừ khi chủ động triển khai dưới subpath đó.

.env.example chỉ mô tả tên biến. .env.local chứa giá trị thật, đã bị .gitignore và .vercelignore loại trừ. Các giá trị local không tự xuất hiện trên Vercel; cần thêm bằng dashboard hoặc CLI environment của Vercel.

## Kiểm tra trước khi publish

```powershell
npm ci
npm run db:check
npm test
npm run build
npm run format:check
npm run test:browser
```

Kiểm tra đúng chế độ build của Vercel ở local:

```powershell
$env:VERCEL = '1'
npm run build
Remove-Item Env:VERCEL
```

Lệnh db:check chỉ SELECT 1. Tính năng học hiện đã dùng API đọc/ghi Turso: catalog, bài nhập hợp lệ, record học và tiến độ theo phiên. DB đã cấp đã được migration/seed riêng; không cần đưa file nội dung vào Vercel để runtime đọc.

Sau khi thêm biến môi trường, deploy bằng giao diện Vercel. Khi đổi biến, redeploy để deployment mới nhận giá trị. Kiểm tra trang chính, /markdown/, chọn bài, audio và log runtime phù hợp. Phiên chuẩn bị cấu hình này không tự publish hoặc thay đổi tài khoản Vercel.

Mọi thay đổi schema sau này dùng Liquibase như blueprint, qua bước release riêng; không chạy migration từ next build hoặc request.

Nguồn: [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json), [Turso SQL over HTTP](https://docs.turso.tech/sdk/http/reference).

## Kiểm chứng cấu hình local

- npm run db:check: kết nối Turso thành công bằng SELECT 1; không thay đổi schema hoặc dữ liệu.
- npm test gồm parser/contract và transaction repository; kiểm tra rollback, idempotency, phân trang và cô lập tiến độ. Số test hiện tại xem refactor-verification.md.
- Build với VERCEL=1 thành công; chạy bằng next start và smoke test chọn/nạp IELTS cùng /markdown/ không có pageerror. Đây là kiểm chứng Next.js local, chưa phải deploy Vercel cloud.
- Đã quét lại source được Git nhận và client bundle: không có token Turso. .env.local không được Git theo dõi.
