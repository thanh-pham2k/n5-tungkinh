const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
if (basePath && (!basePath.startsWith('/') || basePath.endsWith('/'))) {
  throw new Error('NEXT_PUBLIC_BASE_PATH must start with / and have no trailing slash.');
}
export default {
  ...(process.env.VERCEL === '1' ? {} : { output: 'export' }),
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};
