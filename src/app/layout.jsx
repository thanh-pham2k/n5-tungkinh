import './globals.css';
export const metadata = {
  title: 'Kotoba Lab — Học một chút, nhớ thật lâu',
  description: 'Không gian học tiếng Nhật, tiếng Anh và IELTS: từ vựng, luyện câu và ôn tập.',
};
export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
