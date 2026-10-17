import { useEffect, useMemo, useState } from 'react';
import traceJson from '../data/algo-lens-trace.json';
import { replay, violationAt } from './algo-lens-replay.mjs';
import type { TraceData, TraceEvent, ReplayState } from './algo-lens-replay.mjs';

/**
 * AlgoLens 教学演示器。
 * 输入：题面规则 + 预置 trace.json（不是自动判题，也不是自动 AC）。
 * step 是唯一状态，第 N 步的图 / 变量 / 违规边全部由重放事件重算（见 algo-lens-replay.mjs）。
 * 违规判定不读 trace 里的标记，而是查「此刻源神经元 C <= 0 却仍在贡献」。
 */

const trace = traceJson as unknown as TraceData;
const EVENTS = trace.events;
const META = (traceJson as unknown as { meta: Record<string, unknown> }).meta as {
  title: string;
  source: string;
  rules: string;
  bug: string;
  expectedOutput: number;
  buggyOutput: number;
  expectedNote?: string;
};

/** 界面用的节点视觉状态；由重放结果推导，不落进状态里 */
function nodeState(id: string, state: ReplayState, current: TraceEvent | undefined) {
  if (state.activeNode === id) return 'active';
  if (state.updated.includes(id) && (state.C[id] ?? 0) <= 0) return 'calm';
  if (state.updated.includes(id)) return 'excited';
  if (current?.type === 'edge_contribution' && state.activeEdge?.to === id) return 'target';
  return 'idle';
}

const STATE_STYLE: Record<string, { fill: string; stroke: string; text: string }> = {
  idle: { fill: '#1a2230', stroke: '#2a3546', text: '#94a3b8' },
  target: { fill: '#1f2c3f', stroke: '#6ea8fe', text: '#dbeafe' },
  active: { fill: '#243b5e', stroke: '#9ec5ff', text: '#f1f7ff' },
  excited: { fill: '#1b3a2f', stroke: '#4ade80', text: '#dcfce7' },
  calm: { fill: '#3a2a1b', stroke: '#f59e0b', text: '#fde68a' },
};

function stepSummary(event: TraceEvent | undefined, labelOf: (id: string) => string) {
  if (!event) return '第 0 步：初始状态（输入层已入队）。点「下一步」开始。';
  switch (event.type) {
    case 'node_pop':
      return `出队 ${labelOf(event.node!)}：准备传播`;
    case 'edge_contribution':
      return `${labelOf(event.from!)} → ${labelOf(event.to!)}：dp += ${event.w} × C`;
    case 'indegree_change':
      return `${labelOf(event.node!)} 入度减 1 → ${event.indegree}`;
    case 'node_update':
      return `${labelOf(event.node!)} 结算：C = ${event.delta} − U(${event.threshold}) = ${event.value}`;
    case 'output_emit':
      return `输出层 ${labelOf(event.node!)} = ${event.value}`;
    default:
      return '';
  }
}

export default function AlgoLensDemo() {
  const total = EVENTS.length;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const state = useMemo(() => replay(trace, step), [step]);
  const current = step > 0 ? EVENTS[step - 1] : undefined;
  const activeViolation = violationAt(trace, step);
  const labelOf = state.labelOf;

  useEffect(() => {
    if (!playing) return;
    if (step >= total) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setStep((s) => s + 1), 750);
    return () => window.clearTimeout(timer);
  }, [playing, step, total]);

  const visibleLog = state.log.slice(-8).reverse();

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-4 sm:p-5">
      {/* 控制条 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-ink-800 disabled:opacity-40"
        >
          上一步
        </button>
        <button
          type="button"
          onClick={() => setStep((s) => Math.min(total, s + 1))}
          disabled={step >= total}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-ink-800 disabled:opacity-40"
        >
          下一步
        </button>
        <button
          type="button"
          onClick={() => {
            if (step >= total) setStep(0);
            setPlaying((p) => !p);
          }}
          className="rounded-md border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs text-accent-soft transition-colors hover:bg-accent/20"
        >
          {playing ? '暂停' : step >= total ? '重播' : '播放'}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setStep(0);
          }}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-ink-800"
        >
          复位
        </button>
        <span className="ml-auto font-mono text-xs text-slate-500">
          {step} / {total}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={total}
        value={step}
        onChange={(e) => {
          setPlaying(false);
          setStep(Number(e.target.value));
        }}
        className="mt-3 w-full accent-accent"
        aria-label="步骤"
      />

      {/* 违规提示：本 demo 的重点 */}
      <div className="mt-3 min-h-[3.25rem]">
        {activeViolation ? (
          <div className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
            <strong className="font-semibold">
              平静节点仍传播：{labelOf(activeViolation.from)} → {labelOf(activeViolation.to)}
            </strong>
            <br />
            此刻 C[{labelOf(activeViolation.from)}] = {activeViolation.sourceValue} ≤ 0，
            本不该产生任何贡献，却仍执行了{' '}
            <code className="font-mono">dp[{labelOf(activeViolation.to)}] += w × C</code>
            ，加了 {activeViolation.contribution}
            （这一步不改变数值，但语义上是错的：平静神经元不该再影响任何人）。
          </div>
        ) : (
          <div className="rounded-lg border border-ink-800 px-3 py-2 text-xs text-slate-500">
            {stepSummary(current, labelOf)}
          </div>
        )}
      </div>

      {/* 图 */}
      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox="0 0 680 240"
          className="h-auto w-full min-w-[560px]"
          role="img"
          aria-label="神经网络传播图"
        >
          <defs>
            <marker id="al-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3a4759" />
            </marker>
            <marker id="al-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ec5ff" />
            </marker>
            <marker id="al-arrow-bad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>

          {trace.edges.map((edge) => {
            const a = state.byId.get(edge.from)!;
            const b = state.byId.get(edge.to)!;
            const isActive = state.activeEdge?.from === edge.from && state.activeEdge?.to === edge.to;
            const wasViolated = state.violations.some((v) => v.from === edge.from && v.to === edge.to);
            const stroke = isActive ? '#9ec5ff' : wasViolated ? '#f59e0b' : '#3a4759';
            const marker = isActive ? 'al-arrow-active' : wasViolated ? 'al-arrow-bad' : 'al-arrow';
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <line
                  x1={a.x + 22}
                  y1={a.y}
                  x2={b.x - 24}
                  y2={b.y}
                  stroke={stroke}
                  strokeWidth={isActive || wasViolated ? 2.2 : 1.2}
                  markerEnd={`url(#${marker})`}
                />
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#7c8b9e"
                >
                  w={edge.w}
                </text>
              </g>
            );
          })}

          {trace.nodes.map((node) => {
            const kind = nodeState(node.id, state, current);
            const style = STATE_STYLE[kind];
            const violated = activeViolation?.from === node.id;
            const inQueue = state.queue.includes(node.id);
            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={22}
                  fill={style.fill}
                  stroke={violated ? '#f59e0b' : style.stroke}
                  strokeWidth={violated ? 2.6 : 1.4}
                />
                <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="13" fill={style.text}>
                  {node.label}
                </text>
                <text x={node.x} y={node.y - 30} textAnchor="middle" fontSize="10" fill="#8b9aad">
                  C={state.C[node.id]}
                </text>
                <text x={node.x} y={node.y + 36} textAnchor="middle" fontSize="9" fill="#5f6d7e">
                  U={node.u}
                  {node.initial !== undefined ? ' · 输入' : ''}
                </text>
                {inQueue && (
                  <text x={node.x + 26} y={node.y - 18} fontSize="9" fill="#6ea8fe">
                    队
                  </text>
                )}
                {violated && (
                  <text x={node.x} y={node.y + 50} textAnchor="middle" fontSize="9" fill="#f59e0b">
                    平静却仍在传播
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 变量表 + 日志 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold tracking-wide text-slate-400">变量表</h4>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">神经元</th>
                  <th className="px-2 py-1 text-right font-medium">C</th>
                  <th className="px-2 py-1 text-right font-medium">U</th>
                  <th className="px-2 py-1 text-right font-medium">入度</th>
                  <th className="px-2 py-1 text-left font-medium">状态</th>
                </tr>
              </thead>
              <tbody className="font-mono text-slate-300">
                {trace.nodes.map((node) => {
                  const kind = nodeState(node.id, state, current);
                  return (
                    <tr key={node.id} className="border-t border-ink-800/70">
                      <td className="px-2 py-1">{node.label}</td>
                      <td className="px-2 py-1 text-right">{state.C[node.id]}</td>
                      <td className="px-2 py-1 text-right text-slate-500">{node.u}</td>
                      <td className="px-2 py-1 text-right text-slate-500">{state.indegree[node.id]}</td>
                      <td className="px-2 py-1">
                        {kind === 'calm' ? (
                          <span className="text-amber-400">平静</span>
                        ) : kind === 'excited' ? (
                          <span className="text-emerald-400">兴奋</span>
                        ) : kind === 'active' ? (
                          <span className="text-accent-soft">处理中</span>
                        ) : (
                          <span className="text-slate-500">未结算</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            队列：{state.queue.length ? state.queue.map(labelOf).join(' → ') : '（空）'}
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold tracking-wide text-slate-400">事件日志</h4>
          <ol className="mt-2 space-y-1 text-xs">
            {visibleLog.length === 0 && <li className="text-slate-500">还没有事件。</li>}
            {visibleLog.map((item) => (
              <li
                key={item.id}
                className={
                  item.kind === 'violation'
                    ? 'rounded border border-amber-500/40 bg-amber-500/5 px-2 py-1 font-mono text-amber-200'
                    : item.kind === 'output'
                      ? 'rounded border border-emerald-500/40 bg-emerald-500/5 px-2 py-1 font-mono text-emerald-200'
                      : 'px-2 py-1 font-mono text-slate-400'
                }
              >
                {item.text}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* 违规汇总：实际产出 vs 题面语义应有的产出 */}
      <div className="mt-4 rounded-lg border border-ink-800 p-3 text-xs leading-relaxed text-slate-400">
        <p>
          本次 trace 共 <strong className="text-amber-300">{state.violations.length}</strong> 次违规传播（C ≤
          0 仍贡献），涉及边：
          {state.violations.length
            ? state.violations.map((v) => `${labelOf(v.from)}→${labelOf(v.to)}(+${v.contribution})`).join('、')
            : '（暂无）'}
        </p>
        <p className="mt-2">
          按 trace 实际事件重放，输出层 ={' '}
          <strong className="text-slate-200">
            {state.outputs.length
              ? state.outputs.map((o) => `${labelOf(o.node)}=${o.value}`).join(', ')
              : '未产出'}
          </strong>
          ；若按题面语义（平静神经元不产生任何贡献）应为{' '}
          <strong className="text-emerald-300">{META.expectedOutput}</strong>。
          {META.expectedNote && <span className="text-slate-500"> {META.expectedNote}</span>}
        </p>
      </div>
    </div>
  );
}
