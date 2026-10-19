// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// 部署信息集中在这里，避免散落各处。
// 当前线上：GitHub Pages（工作流会注入 SITE_URL + BASE_PATH + GITHUB_PAGES=1）
// 如果以后部署到 Vercel 根路径，设置 SITE_URL 即可，base 会自动为 undefined。
const SITE = process.env.SITE_URL ?? 'https://zxh-350.github.io/my-portfolio';

// GitHub Pages 部署在子路径下，必须配 base；Vercel 不需要。
const onGitHubPages = process.env.GITHUB_PAGES === '1';
const BASE = onGitHubPages ? (process.env.BASE_PATH ?? '/my-portfolio') : undefined;

export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  integrations: [mdx(), react(), sitemap()],

  // LaTeX 数学公式：remark-math 负责识别 $...$ / $$...$$，rehype-katex 负责渲染成 HTML。
  // throwOnError: false —— 写错一个公式只会在页面上显示红色原文，不会让整站构建失败。
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [[rehypeKatex, { throwOnError: false, strict: false }]],
  },

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
