// 联调验证：用插件自身的 defineTool 声明执行一次 publish_note，
// 直接写到 astro 项目的 src/content/notes，再把新文件在 dist 里找出来。
// 用法：node scripts/verify-content.mjs
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineTool } from '../../dsh-plugin-astro-notes/define-tool.js';
import { apply } from '../../dsh-plugin-astro-notes/index.js';

let failures = 0;
const check = (label, pass, detail = '') => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  → ' + detail : ''}`);
  if (!pass) failures++;
};

const projectRoot = 'D:\\hareness\\my-portfolio';
const contentRoot = join(projectRoot, 'src', 'content');
const notesDir = join(contentRoot, 'notes');
const dist = join(projectRoot, 'dist');
void defineTool; // 说明出处：插件走的就是这个 defineTool

const SLUG_TITLE = '插件写入测试：DSH 落盘的笔记';
const before = new Set(await readdir(notesDir));

const registered = [];
apply({ tools: { register: (tool) => (registered.push(tool), () => {}) } }, { projectRoot });
const publish = registered.find((t) => t.name === 'publish_note');
const listSections = registered.find((t) => t.name === 'list_sections');

check('插件注册出 publish_note', Boolean(publish));
check('插件注册出 list_sections', Boolean(listSections));

// 1. list_sections 先确认栏目
const sectionsResult = await listSections.execute({}, {});
check(
  'list_sections 看到 notes 栏目',
  sectionsResult.sections.some((s) => s.name === 'notes'),
  JSON.stringify(sectionsResult.sections),
);

// 2. 经完整校验链路执行 publish_note
const args = {
  rawText: [
    '## 题目',
    '',
    '这篇是联调测试：由 DSH 插件写进 src/content/notes。',
    '',
    '## 我的错误',
    '',
    '没有把「入队」和「有资格影响下游」区分开。',
  ].join('\n'),
  section: 'notes',
  title: SLUG_TITLE,
  date: '2026-02-20',
};
const value = await publish.execute(args, {});
check('execute 返回路径与栏目', value.path.startsWith('src/content/notes/') && value.section === 'notes', value.path);

// 3. 真的落盘了，且是新的文件
const after = (await readdir(notesDir)).filter((f) => !before.has(f));
check('落盘产生了一个新文件', after.length === 1, after.join(', '));

const written = join(notesDir, after[0]);
const text = await readFile(written, 'utf8');
check('frontmatter 完整', text.startsWith('---\n') && text.includes('title: "插件写入测试：DSH 落盘的笔记"') && text.includes('date: 2026-02-20') && text.includes('draft: false'));
check('正文按原样保留', text.includes('没有把「入队」和「有资格影响下游」区分开。'));

// 4. 渲染出的结果文本是「text 类型」的 canonical 字符串
const rendered = publish.output.render(args, value);
check(
  'output.render 产出 text 类型的中文回执',
  rendered[0]?.type === 'text' && rendered[0].text.includes('已写入'),
  rendered[0]?.text,
);

// 5. astro 构建产物里能找到这篇（等价于页面刷新可见）
if (!existsSync(dist)) {
  check('dist 存在（需要先跑 pnpm build）', false, '请先构建');
} else {
  const slugWithoutExt = after[0].replace(/\.md$/, '');
  const page = join(dist, 'notes', slugWithoutExt, 'index.html');
  check('构建产物里生成了详情页', existsSync(page), page.replace(projectRoot, '.'));

  const list = await readFile(join(dist, 'notes', 'index.html'), 'utf8');
  check('列表页包含这篇的标题', list.includes(SLUG_TITLE));

  if (existsSync(page)) {
    const html = await readFile(page, 'utf8');
    check('详情页渲染出六段式标题', html.includes('<h2') && html.includes('我的错误'));
  }
}

console.log(`\n${failures === 0 ? '全部通过' : failures + ' 项失败'}`);
process.exit(failures === 0 ? 0 : 1);
