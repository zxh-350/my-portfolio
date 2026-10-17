/**
 * 站内链接统一走这里，支持子路径部署。
 *
 * Vercel 部署在根路径，`BASE_URL` 是 `/`；
 * GitHub Pages 项目页部署在 `/<repo>/` 下，`BASE_URL` 是 `/my-portfolio`。
 * 模板里写死 `href="/notes"` 在 Pages 上会 404，所以所有内部链接都要过 withBase。
 */

const RAW_BASE = import.meta.env.BASE_URL ?? '/';
/** 去掉结尾斜杠；根路径时为空字符串 */
export const BASE = RAW_BASE === '/' ? '' : RAW_BASE.replace(/\/+$/, '');

/** 把站内绝对路径加上部署前缀；外链、锚点、mailto 原样返回 */
export function withBase(path: string): string {
  if (!path.startsWith('/')) return path;
  if (path === '/') return `${BASE}/`;
  return `${BASE}${path}`;
}

/** 把浏览器地址栏的 pathname 还原成不带前缀的站内路径，用于导航高亮 */
export function currentPath(pathname: string): string {
  if (BASE === '') return pathname;
  if (pathname === BASE) return '/';
  if (pathname.startsWith(`${BASE}/`)) return pathname.slice(BASE.length);
  return pathname;
}
