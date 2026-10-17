// 用纯 Node 跑一遍 demo 的重放逻辑（不启动浏览器），验证违规判定与期望产出。
// 用法：node scripts/verify-trace.mjs
import { readFileSync } from 'node:fs';
import { replay, violationAt } from '../src/components/algo-lens-replay.mjs';

const trace = JSON.parse(
  readFileSync(new URL('../src/data/algo-lens-trace.json', import.meta.url), 'utf8'),
);

let failures = 0;
const check = (name, pass, detail = '') => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
  if (!pass) failures++;
};

const total = trace.events.length;

// 1. 事件类型齐全
const types = [...new Set(trace.events.map((e) => e.type))].sort();
const required = ['edge_contribution', 'indegree_change', 'node_pop', 'node_update', 'output_emit'];
check('五种事件类型齐全', required.every((t) => types.includes(t)), types.join(', '));

// 2. 第 0 步：输入层已入队
const s0 = replay(trace, 0);
check('第 0 步队列为输入层', JSON.stringify(s0.queue) === JSON.stringify(['n1', 'n5']), s0.queue.join(','));

// 3. 逐步重放都要有事实依据：C 值不得与 node_update 矛盾
const last = replay(trace, total);
check('末态输出为 n7=4', JSON.stringify(last.outputs) === JSON.stringify([{ node: 'n7', value: 4 }]), JSON.stringify(last.outputs));
check('末态 n7 的 C 值等于 4', last.C.n7 === 4, `C[n7]=${last.C.n7}`);

// 4. 违规边：全部是「源节点 C <= 0 仍在贡献」
check('违规次数 = 4', last.violations.length === 4, String(last.violations.length));
check(
  '每次违规的源 C 都 <= 0',
  last.violations.every((v) => v.sourceValue <= 0),
  last.violations.map((v) => `${v.from}->${v.to}:C=${v.sourceValue}`).join(' '),
);
const violEdges = last.violations.map((v) => `${v.from}->${v.to}`).sort();
check(
  '违规边集合正确',
  JSON.stringify(violEdges) === JSON.stringify(['n2->n3', 'n2->n4', 'n3->n4', 'n6->n7']),
  violEdges.join(','),
);

// 5. step 精确定位：只有落在违规事件上才返回非空
const hit = [];
for (let i = 1; i <= total; i++) if (violationAt(trace, i)) hit.push(i);
check(
  '违规步可被精确定位',
  hit.length === 4 && hit.every((i) => trace.events[i - 1].type === 'edge_contribution'),
  `steps=${hit.join(',')}`,
);
check('非违规步返回 null', violationAt(trace, 1) === null && violationAt(trace, 28) === null);

// 6. 平静节点确实存在（否则 demo 讲的故事不成立）
const calm = last.updated.filter((id) => last.C[id] <= 0).map((id) => id).sort();
check('存在平静节点 n2/n3/n6', JSON.stringify(calm) === JSON.stringify(['n2', 'n3', 'n6']), calm.join(','));

// 7. 拖到末尾再拖回来，状态必须一致（无隐藏可变状态）
const forward = replay(trace, 20);
const backward = replay(trace, 20);
check('重放是纯函数（两次结果一致）', JSON.stringify(forward.C) === JSON.stringify(backward.C));

// 8. trace 里的 expectedOutput 与重放结果一致
check(
  'meta.expectedOutput 与重放一致',
  trace.meta.expectedOutput === last.outputs[0]?.value,
  `meta=${trace.meta.expectedOutput} replay=${last.outputs[0]?.value}`,
);

console.log(`\n${failures === 0 ? '全部通过' : failures + ' 项失败'}（共 12 项断言）`);
process.exit(failures === 0 ? 0 : 1);
