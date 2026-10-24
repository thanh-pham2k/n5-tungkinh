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

Vercel cung cấp biến hệ thống VERCEL=1; next.config.mjs dùng chế độ server khi biến này có giá trị 1. Các trang hiện tại vẫn có thể được prerender, còn runtime server sẵn sàng cho tính năng DB được triển khai sau. Local mặc định giữ static export out/.

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

Lệnh db:check chỉ SELECT 1 rồi đóng kết nối; không tạo bảng, migration hoặc thay đổi dữ liệu. UI hiện tại vẫn dùng CSV/bộ bài có sẵn, chưa lưu tiến độ hoặc nội dung học lên Turso. Cấu hình môi trường không đồng nghĩa tính năng DB đã được triển khai.

Sau khi thêm biến môi trường, deploy bằng giao diện Vercel. Khi đổi biến, redeploy để deployment mới nhận giá trị. Kiểm tra trang chính, /markdown/, chọn bài, audio và log runtime phù hợp. Phiên chuẩn bị cấu hình này không tự publish hoặc thay đổi tài khoản Vercel.

Mọi thay đổi schema sau này dùng Liquibase như blueprint, qua bước release riêng; không chạy migration từ next build hoặc request.

Nguồn: [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json), [Turso SQL over HTTP](https://docs.turso.tech/sdk/http/reference).

## Kiểm chứng cấu hình local

- npm run db:check: kết nối Turso thành công bằng SELECT 1; không thay đổi schema hoặc dữ liệu.
- npm test: 17 test pass, có kiểm tra hai chế độ Next.js và việc bỏ qua credential.
- Build với VERCEL=1 thành công; chạy bằng next start và smoke test chọn/nạp IELTS cùng /markdown/ không có pageerror. Đây là kiểm chứng Next.js local, chưa phải deploy Vercel cloud.
- Quét 244 file source và 177 file artifact public tại thời điểm kiểm tra: không có token trong source được Git nhận hoặc bundle public. .env.local không được Git theo dõi.
