// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// 部署信息集中在这里，避免散落各处。
// - Vercel：把 SITE 换成你的正式域名（或直接用 *.vercel.app）
// - GitHub Pages：设置环境变量 GITHUB_PAGES=1，并让 SITE 指向 https://<user>.github.io/<repo>
const SITE = process.env.SITE_URL ?? 'https://example.vercel.app';

// GitHub Pages 部署在子路径下，必须配 base；Vercel 不需要。
const onGitHubPages = process.env.GITHUB_PAGES === '1';
const BASE = onGitHubPages ? (process.env.BASE_PATH ?? '/my-portfolio') : undefined;

export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  integrations: [mdx(), react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        // DSH 的 write/edit 工具走原子写：先在内容目录里建
        // `.文件名.<pid>.<uuid>.tmpdir/xxx.md.tmp`，再 rename 成目标文件。
        // Windows 上 Vite 去 watch 这个临时文件会抛 EBUSY（Astro 弹 UnhandledRejection 错误页）。
        // 内容目录只关心最终的 .md / .mdx，临时路径直接忽略。
        ignored: ['**/.*.tmpdir/**', '**/*.tmpdir/**', '**/*.tmp'],
      },
    },
  },
});
