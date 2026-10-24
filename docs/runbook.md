TL;DR Vercel dùng Next.js server build; local mặc định vẫn có static export. Xem vercel-deployment.md để publish.

# Local, environment và release

## Local

- Node.js 22.13.1 và npm 10.9.2 đã được kiểm chứng trên Windows.
- `npm ci` cài theo lockfile; `npm run dev` mở localhost:3000.
- `npm test` chạy parser/contract; `npm run build` tạo out/; `npm run test:browser` tự khởi động preview nếu cần, yêu cầu Edge.
- `npm run preview` phục vụ artifact trên localhost:4173, có hỗ trợ byte range cho audio.
- Các lệnh predev/prebuild/pretest chuyển JSON từ docs/ielts/practice-data.js thành module Next.js và lập danh mục MP3 có thật. Không tạo audio hoặc ghi vào dịch vụ ngoài trong build.

## Environment

Turso đã được cấu hình bằng biến môi trường phía server. Credential local nằm trong .env.local; không copy vào source hoặc biến public. Hướng dẫn cấu hình Production/Preview tại [Vercel deployment](vercel-deployment.md).

| Biến | Phạm vi | Mặc định | Ý nghĩa |
| --- | --- | --- | --- |
| TURSO_DATABASE_URL | server / script kiểm tra | không có | URL Turso cho từng môi trường |
| TURSO_AUTH_TOKEN | server / script kiểm tra | không có | Token bí mật, không public hoặc commit |
| VERCEL | hệ thống Vercel | không có khi local | Giá trị 1 chọn server build thay static export |
| NEXT_PUBLIC_BASE_PATH | build; cũng dùng cho preview | rỗng | Prefix đường dẫn, ví dụ /n5-tungkinh; bắt đầu bằng /, không kết thúc bằng / |
| PORT | preview local | 4173 | Cổng HTTP của scripts/serve-static.mjs |

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
- Audio public: build chỉ copy file đã có trong output/; không tạo link tới MP3 không tồn tại.
- Nguồn IELTS: tiếp tục đồng bộ vào docs/ielts/ bằng quy trình hiện có; không sửa src/data/practice-data.js sinh tự động.
- Ảnh Hot Review: CSV giữ trường image_url theo định dạng cũ; đặt file ảnh tương ứng trong public/quiz-data/ nếu bộ câu hỏi cần ảnh. Không có thư viện ảnh hoặc DB mới được tạo.
- DB mới chỉ cấu hình kết nối; npm run db:check chạy SELECT 1. Chưa có schema hoặc luồng học ghi DB; không migration trong build. Schema tương lai dùng Liquibase.

## Release

1. Host đã chọn: Vercel. Làm theo vercel-deployment.md; local static export vẫn dùng cho preview. Cấu hình Pages cũ main:/docs không build ứng dụng.
2. Chọn base path đúng target, chạy npm ci, npm test, npm run build và browser tests trên artifact.
3. Kiểm tra mobile/desktop, nhập bài, audio, bộ chọn IELTS, Hot Review và Markdown. Xác minh dịch vụ TTS ở mạng/thiết bị đích.
4. Vercel tự build từ repo theo vercel.json, dùng .next; không upload out/ như Next.js server build. Không ghi đè docs/ nguồn, không tự push/deploy khi chưa có yêu cầu thực hiện.
5. Smoke test URL đích và đường dẫn con; chỉ ghi nhận deploy thành công khi đã kiểm tra thực tế.

## Khôi phục

Giữ artifact đã release trước đó và thông tin version/base path. Khi cần rollback, xuất bản lại artifact trước; lần này không có migration DB cần hoàn tác. Nội dung localStorage thuộc thiết bị người học, không xóa khi rollback ứng dụng.

Tham chiếu: [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports).
