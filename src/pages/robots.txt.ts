import type { APIRoute } from 'astro';

/**
 * robots.txt 用端点生成，而不是放 public/ 里写死域名。
 * 这样 Vercel 与 GitHub Pages 两个部署目标都能产出正确的 Sitemap 地址
 * （`site` 会随 SITE_URL 环境变量变化）。
 */
export const GET: APIRoute = ({ site }) => {
  // BASE_URL 在根部署时是 '/'，子路径部署时可能是 '/my-portfolio'（不带尾斜杠），统一归一化
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  const sitemap = site ? new URL(`${base}/sitemap-index.xml`, site).href : `${base}/sitemap-index.xml`;
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemap}`, ''].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
