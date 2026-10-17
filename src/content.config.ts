import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 算法笔记：按「错误复盘」写。
 * 六段式结构（题目 / 我的错误 / 为什么错 / 正确逻辑 / 可迁移模式 / AI 如何帮我）
 * 直接写在正文里用 h2 分段，这里只声明卡片和详情页需要的元数据。
 */
const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    // 题目出处，如「洛谷 P1038」
    source: z.string().optional(),
    // 复盘的题目标题
    problem: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

/** AI 实验室：项目列表用。阶段 3/4 填充。 */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    // 项目详情页路径（可选）
    href: z.string().optional(),
    status: z.string().default('实验'),
    draft: z.boolean().default(false),
  }),
});

export const collections = { notes, projects };
