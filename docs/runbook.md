TL;DR Local và Vercel dùng Next.js server runtime; nội dung tải/lưu Turso. Xem database.md và vercel-deployment.md.

# Local, environment và release

## Local

- Node.js 22.13.1 và npm 10.9.2 đã được kiểm chứng trên Windows.
- `npm ci` cài theo lockfile; `npm run dev` mở localhost:3000.
- `npm test` chạy parser/contract/repository; `npm run build` tạo .next/; browser test dùng DB SQLite fixture riêng, yêu cầu Edge.
- `npm run preview` chạy next start trên localhost:4173 với Turso đã cấu hình. Dừng preview trước khi test cùng cổng.
- Không còn predev/prebuild/pretest sinh nội dung local. Build không đọc Turso, migrate hoặc seed; DB mới cần bước vận hành riêng theo database.md.

## Environment

Turso đã được cấu hình bằng biến môi trường phía server. Credential local nằm trong .env.local; không copy vào source hoặc biến public. Hướng dẫn cấu hình Production/Preview tại [Vercel deployment](vercel-deployment.md).

| Biến | Phạm vi | Mặc định | Ý nghĩa |
| --- | --- | --- | --- |
| TURSO_DATABASE_URL | server / script kiểm tra | không có | URL Turso cho từng môi trường |
| TURSO_AUTH_TOKEN | server / script kiểm tra | không có | Token bí mật, không public hoặc commit |
| VERCEL | hệ thống Vercel | không có khi local | Biến nền tảng; cả local/Vercel đều dùng server build |
| NEXT_PUBLIC_BASE_PATH | build; cũng dùng cho preview | rỗng | Prefix đường dẫn, ví dụ /n5-tungkinh; bắt đầu bằng /, không kết thúc bằng / |

NEXT_PUBLIC_BASE_PATH là cấu hình public, được cố định vào bundle khi build; phải build lại khi thay đổi. Không nhập credential vào biến public.

Preview ở root:

```powershell
npm run build
npm run preview
```

Preview dưới subpath:

```powershell
$env:NEXT_PUBLIC_BASE_PATH = '/n5-tungkinh'
npm run build
npm run preview
```

Sau khi kết thúc phiên thử subpath, `Remove-Item Env:NEXT_PUBLIC_BASE_PATH` rồi build lại cho root nếu cần. Không repurpose HOME/CODEX_HOME.

## Dịch vụ và dữ liệu

- Sound of Text: runtime browser gọi API bên ngoài; lỗi mạng/quota phải hiện trạng thái, không coi bộ mock trong test là bằng chứng dịch vụ production hoạt động.
- Audio Looper đã bỏ; không lập danh mục/copy MP3 hoặc bundle IELTS. Phát âm vẫn dùng Sound of Text.
- docs/ielts/ chỉ là đầu vào import/test; runtime đọc catalog Turso. Không khôi phục module src/data/practice-data.js.
- Multiple Choice: nhập định dạng dấu | theo [hướng dẫn](MULTIPLE_CHOICE.md); nội dung là văn bản, không đọc image_url từ CSV cũ.
- DB đã có schema và catalog; parse hợp lệ lưu record, Bài đã lưu đọc lại qua API. Quyền thư viện chung, phiên tiến độ riêng và migration Liquibase mô tả trong database.md.

## Release

1. Host đã chọn: Vercel. Cả local và production cần Next.js server runtime. Cấu hình Pages cũ main:/docs không chạy API.
2. Chọn base path đúng target, chạy npm ci, npm test, npm run build và browser tests trên artifact.
3. Kiểm tra mobile/desktop, nhập bài, audio, bộ chọn IELTS, Multiple Choice và Markdown. Xác minh dịch vụ TTS ở mạng/thiết bị đích.
4. Vercel tự build từ repo theo vercel.json, dùng .next; không upload out/ như Next.js server build. Không ghi đè docs/ nguồn, không tự push/deploy khi chưa có yêu cầu thực hiện.
5. Smoke test URL đích và đường dẫn con; chỉ ghi nhận deploy thành công khi đã kiểm tra thực tế.

## Khôi phục

Giữ artifact đã release và version/base path. Rollback ứng dụng không rollback DB; giữ dữ liệu/catalog/ledger và ưu tiên sửa tiến. Không chạy DROP TABLE để rollback UI. Backup/restore và migration tiếp theo theo database.md.

Tham chiếu: [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).
