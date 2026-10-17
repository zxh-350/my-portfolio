/**
 * trace 重放逻辑（纯函数，不依赖 React）。
 * 组件用它算第 N 步的状态；测试脚本也用同一份，保证「违规判定」只有一处实现。
 */

/** @typedef {{ id: string, label: string, layer?: string, u: number, initial?: number, x: number, y: number }} TraceNode */
/** @typedef {{ from: string, to: string, w: number }} TraceEdge */
/** @typedef {{ id: string, type: string, node?: string, from?: string, to?: string, w?: number, delta?: number, indegree?: number, threshold?: number, value?: number, calm?: boolean }} TraceEvent */
/** @typedef {{ nodes: TraceNode[], edges: TraceEdge[], events: TraceEvent[] }} TraceData */

export function buildIndex(trace) {
  const byId = new Map(trace.nodes.map((n) => [n.id, n]));
  const indegree = {};
  for (const n of trace.nodes) {
    indegree[n.id] = trace.edges.filter((e) => e.to === n.id).length;
  }
  const labelOf = (id) => byId.get(id)?.label ?? id;
  return { byId, initialIndegree: indegree, labelOf };
}

/**
 * 重放前 step 个事件，返回该步的完整状态。
 * @param {TraceData} trace
 * @param {number} step
 */
export function replay(trace, step) {
  const { byId, initialIndegree, labelOf } = buildIndex(trace);

  /** @type {Record<string, number>} */
  const C = {};
  for (const n of trace.nodes) C[n.id] = n.initial ?? 0;

  const indegree = { ...initialIndegree };
  const queue = trace.nodes.filter((n) => initialIndegree[n.id] === 0).map((n) => n.id);
  const popped = [];
  const updated = [];
  const violations = [];
  const outputs = [];
  const log = [];
  let activeEdge = null;
  let activeNode = null;

  for (let i = 0; i < step && i < trace.events.length; i++) {
    const event = trace.events[i];
    switch (event.type) {
      case 'node_pop': {
        popped.push(event.node);
        activeNode = event.node;
        log.push({ id: event.id, text: `出队 ${labelOf(event.node)}：准备传播`, kind: 'normal' });
        break;
      }
      case 'edge_contribution': {
        const edge =
          trace.edges.find((e) => e.from === event.from && e.to === event.to) ?? {
            from: event.from,
            to: event.to,
            w: event.w ?? 0,
          };
        activeEdge = edge;
        activeNode = event.from;
        // 违规判定：源神经元此刻已平静（C <= 0），却仍产生贡献
        const sourceValue = C[event.from];
        const isViolation = sourceValue <= 0;
        if (isViolation) {
          violations.push({
            eventId: event.id,
            from: event.from,
            to: event.to,
            contribution: (event.w ?? 0) * sourceValue,
            sourceValue,
          });
        }
        log.push({
          id: event.id,
          text: `${labelOf(event.from)} → ${labelOf(event.to)}：dp += ${event.w} × C${
            isViolation ? `  ← 违规：${labelOf(event.from)} 已平静（C = ${sourceValue}）` : ''
          }`,
          kind: isViolation ? 'violation' : 'normal',
        });
        break;
      }
      case 'indegree_change': {
        indegree[event.node] = event.indegree ?? indegree[event.node] - 1;
        log.push({
          id: event.id,
          text: `${labelOf(event.node)} 入度减 1 → ${event.indegree}`,
          kind: 'normal',
        });
        break;
      }
      case 'node_update': {
        C[event.node] = event.value ?? 0;
        updated.push(event.node);
        if (!popped.includes(event.node)) queue.push(event.node);
        log.push({
          id: event.id,
          text: `${labelOf(event.node)} 结算：C = ${event.delta} − U(${event.threshold}) = ${event.value}${
            event.calm ? '（平静）' : '（兴奋）'
          }`,
          kind: 'normal',
        });
        break;
      }
      case 'output_emit': {
        outputs.push({ node: event.node, value: event.value ?? 0 });
        log.push({
          id: event.id,
          text: `输出层 ${labelOf(event.node)} = ${event.value}`,
          kind: 'output',
        });
        break;
      }
      default:
        break;
    }
  }

  return {
    C,
    indegree,
    queue: queue.filter((id) => !popped.includes(id)),
    popped,
    updated,
    activeEdge,
    activeNode,
    violations,
    outputs,
    log,
    labelOf,
    byId,
  };
}

/**
 * 如果第 step 步正好落在一次违规传播上，返回这次违规；否则返回 null。
 * @param {TraceData} trace
 * @param {number} step
 */
export function violationAt(trace, step) {
  if (step <= 0) return null;
  const event = trace.events[step - 1];
  if (event.type !== 'edge_contribution') return null;
  const state = replay(trace, step);
  return state.violations.find((v) => v.eventId === event.id) ?? null;
}
