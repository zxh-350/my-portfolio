# My Portfolio

大二计算机学生的作品集与学习记录：**算法错误复盘** + **AI 小作品**。
纯静态站，无后端，无前端 API key。

## 技术栈

- Astro 5（`output: 'static'`）+ Tailwind CSS 4（走 Vite 插件）
- MDX / Markdown 内容集合（`src/content`）
- React 岛：只有 AlgoLens 交互演示用到
- 图可视化手写 SVG，没有引入任何图库

## 本地运行

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # 产物在 dist/
pnpm preview    # 本地预览产物
```

## 目录

```
src/
  config.ts                    站点文案、导航、首页入口卡
  styles/global.css            暗色主题 + 正文排版
  components/Layout.astro      全局壳（head/SEO/导航/页脚）
  components/NoteCard.astro    笔记卡片
  components/AlgoLensDemo.tsx  AlgoLens 交互岛
  components/algo-lens-replay.mjs  trace 重放逻辑（纯函数，测试共用）
  data/algo-lens-trace.json    预置 trace（五类事件）
  content.config.ts            notes / projects 两个集合
  content/notes/*.md           算法复盘
  content/projects/*           项目条目
  pages/                       首页 / 关于 / 笔记 / 项目
scripts/verify-trace.mjs       重放逻辑断言（node scripts/verify-trace.mjs）
```

## 写作约定

笔记按六段式写：**题目 → 我的错误 → 为什么错 → 正确逻辑 → 可迁移模式 → AI 如何帮我**。
frontmatter：

```yaml
---
title: 标题
date: 2026-01-12
summary: 一句话摘要
source: 洛谷 P1038        # 可选
problem: 题面要点          # 可选，会在详情页顶部显示
tags: [图论, 拓扑排序]
draft: false              # true 则不显示
---
```

## 部署到 Vercel（推荐）

1. 把仓库推到 GitHub。
2. Vercel → Add New Project → 选这个仓库。框架会被识别为 Astro，直接 Deploy：
   - Build Command: `pnpm build`
   - Output Directory: `dist`
3. 部署成功后到 Settings → Domains 看正式域名，把它填进两处：
   - `src/config.ts` 的 `site.url`
   - `public/robots.txt` 的 `Sitemap:` 行
   - 或设置环境变量 `SITE_URL`（`astro.config.mjs` 会读）
4. 重新部署一次即可。

`vercel.json` 已经放好最小配置，不需要额外改动。

## 部署到 GitHub Pages（备选）

因为 Pages 部署在 `https://<user>.github.io/<repo>` 子路径下，**必须启用 base**，
`astro.config.mjs` 已经用环境变量处理好了：

- `GITHUB_PAGES=1` → 启用 `base`
- `BASE_PATH` → 子路径，默认 `/my-portfolio`
- `SITE_URL` → 站点域名

步骤：

1. 仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。
2. 推送到 `main` 分支，`.github/workflows/deploy.yml` 会自动构建并发布。
3. 如果仓库名不是 `my-portfolio`，改 `astro.config.mjs` 里 `BASE_PATH` 的默认值，
   或在工作流里传 `BASE_PATH: /<你的仓库名>`（工作流已自动用仓库名传参）。

本地验证子路径构建：

```bash
GITHUB_PAGES=1 BASE_PATH=/my-portfolio pnpm build
```

## AlgoLens

教学演示器：输入题面规则 + 预置 `trace.json`，步进显示图、变量、违规边。
事件类型五种：`node_pop`、`edge_contribution`、`indegree_change`、`node_update`、`output_emit`。

违规判定是**算出来**的：任何 `edge_contribution` 发生时，若源节点 `C <= 0`，
这条边就标红（"平静节点仍传播"）。

明确局限：只支持拓扑 / 传播类题目，规则抽取靠人工确认，不自动 AC。

改数据后跑一次断言：

```bash
node scripts/verify-trace.mjs
```
