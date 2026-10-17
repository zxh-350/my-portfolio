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

## 线上地址

**https://zxh-350.github.io/my-portfolio/**（GitHub Pages，Actions 自动部署）

## 部署到 GitHub Pages（当前在用）

Pages 部署在 `https://<user>.github.io/<repo>` 子路径下，**必须启用 base**。
`astro.config.mjs` 已经用环境变量处理好，`.github/workflows/deploy.yml` 会注入：

- `GITHUB_PAGES=1` → 启用 `base`
- `BASE_PATH=/<repo>` → 子路径
- `SITE_URL=https://<user>.github.io` → 站点域名

站内链接不能写死 `href="/notes"`，否则子路径下会 404。
所有内部链接都要过 `withBase()`（见 `src/lib/paths.ts`），`robots.txt` 由
`src/pages/robots.txt.ts` 端点生成，canonical 用 `Astro.site`。

步骤：

1. 仓库 Settings → Pages → Source 选 **GitHub Actions**（只需一次）。
2. 推送到 `main`，工作流自动构建并发布。
3. 若 Pages 未启用，deploy 作业会失败；启用后在 Actions 里 **Re-run all jobs** 即可。

## 部署到 Vercel（可选）

Vercel 部署在根路径，不需要 base：

1. Vercel → Add New Project → 选仓库，框架识别为 Astro，直接 Deploy。
2. 在项目环境变量里设 `SITE_URL=https://<你的域名>`，否则 canonical/OG 会退回默认值。
3. `vercel.json` 已放好最小配置。

> 注意：Vercel 登录只有 GitHub 授权或邮箱验证码，没有手机短信验证。

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
