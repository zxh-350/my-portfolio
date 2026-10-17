/** algo-lens-replay.mjs 的类型声明（逻辑是 JS，组件用 TS 消费） */

export interface TraceNode {
  id: string;
  label: string;
  layer?: string;
  u: number;
  initial?: number;
  x: number;
  y: number;
}

export interface TraceEdge {
  from: string;
  to: string;
  w: number;
}

export interface TraceEvent {
  id: string;
  type: string;
  node?: string;
  from?: string;
  to?: string;
  w?: number;
  delta?: number;
  indegree?: number;
  threshold?: number;
  value?: number;
  calm?: boolean;
}

export interface TraceData {
  nodes: TraceNode[];
  edges: TraceEdge[];
  events: TraceEvent[];
}

export interface Violation {
  eventId: string;
  from: string;
  to: string;
  contribution: number;
  sourceValue: number;
}

export interface ReplayState {
  C: Record<string, number>;
  indegree: Record<string, number>;
  queue: string[];
  popped: string[];
  updated: string[];
  activeEdge: TraceEdge | null;
  activeNode: string | null;
  violations: Violation[];
  outputs: { node: string; value: number }[];
  log: { id: string; text: string; kind: 'violation' | 'output' | 'normal' }[];
  labelOf: (id: string) => string;
  byId: Map<string, TraceNode>;
}

export function buildIndex(trace: TraceData): {
  byId: Map<string, TraceNode>;
  initialIndegree: Record<string, number>;
  labelOf: (id: string) => string;
};

export function replay(trace: TraceData, step: number): ReplayState;

export function violationAt(trace: TraceData, step: number): Violation | null;
