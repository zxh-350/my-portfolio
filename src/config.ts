/**
 * 站点级配置：文案、导航、链接集中在这里，改一处即可。
 * 带「占位」注释的字段需要你替换成真实信息。
 */

export const site = {
  name: 'My Portfolio',
  // 占位：换成你的名字或昵称
  author: '你的名字',
  // 首页一句话简介
  tagline: '大二计算机学生，用错误复盘学算法，用 AI 做小工具。',
  description:
    '大二计算机学生的作品集与学习记录：算法学习感悟（错误复盘式）与 AI 小作品（AlgoLens 等）。',
  email: 'you@example.com', // 占位
  github: 'https://github.com/your-name', // 占位
  // 仅作兜底：真实部署时 canonical 用 Astro.site（来自 astro.config 的 site / SITE_URL 环境变量）。
  // 现在是 GitHub Pages 的地址，换域名时优先改这里的环境变量。
  url: 'https://zxh-350.github.io/my-portfolio',
};

export const nav = [
  { href: '/', label: '首页' },
  { href: '/notes', label: '算法笔记' },
  { href: '/projects', label: 'AI 实验室' },
  { href: '/about', label: '关于我' },
];

/**
 * 首页三个入口卡。
 * meta 先写「即将上线」，阶段 2/3/4 落地对应页面后再回来改成真实状态。
 */
export const entries = [
  {
    href: '/notes',
    title: '算法笔记',
    summary: '按「错误复盘」写的算法记录：错在哪、为什么错、下次怎么迁移。',
    meta: '3 篇复盘',
  },
  {
    href: '/projects',
    title: 'AI 实验室',
    summary: '自己做的小作品与实验，含 AlgoLens 对拍反例可视化。',
    meta: 'AlgoLens 可演示',
  },
  {
    href: '/about',
    title: '关于我',
    summary: '学校、方向、技能栈和联系方式。',
    meta: '已上线',
  },
];
