export function formatReviewTime(value, now = Date.now()) {
  if (typeof value !== 'string') return 'Chưa có thời gian ôn';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Chưa có thời gian ôn';
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60000);
  if (minutes < 1) return 'Vừa ôn xong';
  if (minutes < 60) return `Ôn ${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Ôn ${hours} giờ trước`;
  return `Ôn ${Math.floor(hours / 24)} ngày trước`;
}
