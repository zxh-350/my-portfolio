import { useEffect, useMemo, useState } from 'react';

/**
 * 销量回归：点预测 + 置信区间（CI）+ 预测区间（PI）交互演示。
 *
 * 模型是三篇记录里那个已经拟合好的 pooled OLS（40 商品 × 26 周教学面板，n=1040）：
 *   ŷ = 301.4273 − 0.8895·单价 + 335.9269·折扣率 + 0.0583·营销投入 + 41.3464·促销
 * 这里的系数、σ̂、残差自由度、XtX⁻¹ 都是硬编码的常数，组件里不做任何拟合，
 * 也不允许联网或引入依赖 —— 它只负责「代入公式」和「画区间」。
 *
 * 校验基准（level=0.95，单价 126.39、折扣 0.20、营销 1504、促销 1）：
 *   tc=1.9623（df=1035，正态会给出 1.9600，差在第三位小数）
 *   ŷ=385.3、CI≈[379.7, 390.9]（宽 11.3）、PI≈[311.2, 459.4]（宽 148.2）
 * 数值来源与自查见页面注释。
 */

type Vec5 = readonly [number, number, number, number, number];

const BETA: Vec5 = [
  301.42727603941313,
  -0.8895197024653292,
  335.92693184009806,
  0.05832372811559619,
  41.34635031595621,
];

/** 残差标准差 σ̂（sqrt(SSE / df)） */
const SIGMA = 37.66346106433578;
/** 残差自由度 n − k − 1 = 1040 − 4 − 1 */
const DF = 1035;

/**
 * (XᵗX)⁻¹，取自拟合输出的 model.json，直接抄死。
 * 作用只有一个：算新场景的杠杆 h0 = x0ᵗ (XᵗX)⁻¹ x0，
 * 它衡量「这个场景离样本中心有多远」，越大区间越宽。
 */
const XTX_INV: readonly (readonly number[])[] = [
  [
    0.013434940106561705, -5.644345401687374e-05, -0.008616012826445604,
    -4.1663258704787365e-06, -0.001177346179002637,
  ],
  [
    -5.6443454016873794e-05, 4.387769567841884e-07, 5.823846916317703e-06,
    1.7205502145646625e-09, 1.4753623820758824e-08,
  ],
  [
    -0.0086160128264456, 5.823846916317657e-06, 0.09609494308426758,
    -9.012985607501335e-08, -0.00023651690101164765,
  ],
  [
    -4.16632587047873e-06, 1.7205502145646195e-09, -9.012985607501686e-08,
    3.6810094243705314e-09, -7.310705996409519e-08,
  ],
  [
    -0.001177346179002637, 1.475362382075782e-08, -0.00023651690101164803,
    -7.310705996409504e-08, 0.005197506127651442,
  ],
];

/** 样本里周销量的均值，画一条参考虚线用 */
const MEAN_SALES = 293;

const S2 = { price: 126.39, discount: 0.2, marketing: 1504, promo: 1, level: 0.95 };

// ---------------------------------------------------------------------------
// t 分位数：不完全贝塔函数的连分式 + 二分。不用正态近似。
// ---------------------------------------------------------------------------

/** Lanczos 近似的 lnΓ(x) */
function lgamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  const z = x - 1;
  let a = c[0];
  const t = z + g + 0.5;
  for (let i = 1; i < g + 2; i += 1) a += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** 不完全贝塔的连分式（修正 Lentz 法） */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300;
  const EPS = 3e-16;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** 正则化不完全贝塔 I_x(a, b) */
function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** t 分布的 CDF（df 自由度） */
function tCdf(t: number, df: number): number {
  if (t === 0) return 0.5;
  const x = df / (df + t * t);
  const tail = 0.5 * betai(df / 2, 0.5, x);
  return t > 0 ? 1 - tail : tail;
}

/**
 * t 分位数：解 CDF(t) = 1 − (1 − level)/2。
 * 双侧对称，所以只要正整数解，用二分（CDF 单调递增）。
 * 上界 1000 足够：level ≤ 0.999 时 df=1035 的 t 也只有 3.3 左右。
 */
function tQuantile(level: number, df: number): number {
  const p = 1 - (1 - level) / 2;
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// 模型计算
// ---------------------------------------------------------------------------

type Estimate = {
  yhat: number;
  h0: number;
  seMean: number;
  sePred: number;
  tc: number;
  ci: readonly [number, number];
  pi: readonly [number, number];
};

function predict(price: number, discount: number, marketing: number, promo: number, level: number): Estimate {
  const x0: Vec5 = [1, price, discount, marketing, promo];
  const yhat = x0.reduce((sum, v, i) => sum + v * BETA[i], 0);

  let h0 = 0;
  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 5; j += 1) h0 += x0[i] * XTX_INV[i][j] * x0[j];
  }

  const seMean = SIGMA * Math.sqrt(h0);
  const sePred = SIGMA * Math.sqrt(1 + h0);
  const tc = tQuantile(level, DF);

  return {
    yhat,
    h0,
    seMean,
    sePred,
    tc,
    ci: [yhat - tc * seMean, yhat + tc * seMean],
    pi: [yhat - tc * sePred, yhat + tc * sePred],
  };
}

// ---------------------------------------------------------------------------
// 小组件
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

type NumFieldProps = {
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
};

/**
 * 数字输入框：允许中间态（比如先删空、再打 126），
 * 实时把合法数字交给父组件，失焦时再对齐到规范值。
 * 这样输入框不会在每敲一个字符时被外部值改写。
 */
function NumField({ id, value, min, max, step, onChange }: NumFieldProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft((prev) => (prev === String(value) ? prev : String(value)));
  }, [value]);

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        const n = Number(next);
        if (next !== '' && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => {
        const n = Number(draft);
        const snapped = Number.isFinite(n) ? clamp(n, min, max) : value;
        onChange(snapped);
        setDraft(String(clamp(snapped, min, max)));
      }}
      className="w-24 rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-right font-mono text-sm text-slate-100 outline-none focus:border-accent/70"
    />
  );
}

type ControlRowProps = {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
};

function ControlRow({ id, label, hint, value, min, max, step, onChange, suffix }: ControlRowProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-slate-300">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <NumField id={id} value={value} min={min} max={max} step={step} onChange={onChange} />
          {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
        </div>
      </div>
      <input
        id={`${id}-range`}
        type="range"
        aria-label={`${label}（滑杆）`}
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#6ea8fe]"
      />
      <p className="mt-0.5 text-xs text-slate-500">
        {hint} · 范围 {min}–{max}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 纯 SVG 区间图（无图表库）
// ---------------------------------------------------------------------------

type ChartProps = {
  estimate: Estimate;
};

const W = 720;
const H = 168;
const PAD_X = 18;
const AXIS_Y = 122;
const BAND_TOP = 46;
const PI_H = 30;
const CI_H = 12;

function niceTicks(lo: number, hi: number, target = 5): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const first = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= hi + step * 1e-9; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return ticks;
}

function IntervalChart({ estimate }: ChartProps) {
  const { yhat, ci, pi } = estimate;
  const lo0 = Math.min(ci[0], pi[0], MEAN_SALES);
  const hi0 = Math.max(ci[1], pi[1], MEAN_SALES);
  const pad = Math.max((hi0 - lo0) * 0.08, 4);
  const lo = lo0 - pad;
  const hi = hi0 + pad;

  const x = (v: number) => PAD_X + ((v - lo) / (hi - lo)) * (W - PAD_X * 2);
  const midY = BAND_TOP + PI_H / 2;
  const ticks = niceTicks(lo, hi, 5);
  const yhatX = x(yhat);
  const labelX = clamp(yhatX, 70, W - 70);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`销量区间图：点预测 ${yhat.toFixed(1)} 件，置信区间 ${ci[0].toFixed(
        1,
      )} 到 ${ci[1].toFixed(1)} 件，预测区间 ${pi[0].toFixed(1)} 到 ${pi[1].toFixed(1)} 件`}
    >
      <text x={PAD_X} y={18} className="fill-slate-500" fontSize={12}>
        销量（件）
      </text>

      {/* 均值参考线 */}
      <line
        x1={x(MEAN_SALES)}
        x2={x(MEAN_SALES)}
        y1={30}
        y2={AXIS_Y}
        stroke="#64748b"
        strokeWidth={1.5}
        strokeDasharray="5 5"
        opacity={0.85}
      />
      <text
        x={clamp(x(MEAN_SALES) + 6, PAD_X, W - PAD_X - 88)}
        y={36}
        className="fill-slate-500"
        fontSize={11}
      >
        历史均值 293
      </text>

      {/* PI：粗带 */}
      <rect
        x={x(pi[0])}
        y={BAND_TOP}
        width={Math.max(x(pi[1]) - x(pi[0]), 2)}
        height={PI_H}
        rx={4}
        fill="#6ea8fe"
        fillOpacity={0.16}
        stroke="#6ea8fe"
        strokeOpacity={0.45}
        strokeWidth={1.5}
      />
      {/* CI：细带，落在 PI 里面 */}
      <rect
        x={x(ci[0])}
        y={midY - CI_H / 2}
        width={Math.max(x(ci[1]) - x(ci[0]), 2)}
        height={CI_H}
        rx={2}
        fill="#9ec5ff"
        fillOpacity={0.85}
        stroke="#dbeafe"
        strokeOpacity={0.7}
        strokeWidth={1}
      />

      {/* 点预测：竖线 */}
      <line
        x1={yhatX}
        x2={yhatX}
        y1={BAND_TOP - 14}
        y2={BAND_TOP + PI_H + 12}
        stroke="#f59e0b"
        strokeWidth={2}
      />
      <circle cx={yhatX} cy={BAND_TOP - 14} r={3} fill="#f59e0b" />
      <text x={labelX} y={BAND_TOP + PI_H + 28} textAnchor="middle" className="fill-amber-300" fontSize={12}>
        ŷ {yhat.toFixed(1)}
      </text>

      {/* 轴 */}
      <line x1={PAD_X} x2={W - PAD_X} y1={AXIS_Y} y2={AXIS_Y} stroke="#2a3546" strokeWidth={1} />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={AXIS_Y} y2={AXIS_Y + 5} stroke="#2a3546" strokeWidth={1} />
          <text x={x(v)} y={AXIS_Y + 20} textAnchor="middle" className="fill-slate-500" fontSize={11}>
            {Math.round(v)}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

type StatProps = {
  label: string;
  value: string;
  note?: string;
  tone?: 'plain' | 'ci' | 'pi' | 'warn';
};

const TONE: Record<NonNullable<StatProps['tone']>, string> = {
  plain: 'border-ink-800 bg-ink-950/60',
  ci: 'border-accent/30 bg-accent/5',
  pi: 'border-accent/40 bg-accent/10',
  warn: 'border-amber-500/30 bg-amber-500/5',
};

function Stat({ label, value, note, tone = 'plain' }: StatProps) {
  return (
    <div className={`rounded-lg border p-3 ${TONE[tone]}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm text-slate-100">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

export default function CiPiExplorer() {
  const [price, setPrice] = useState(S2.price);
  const [discount, setDiscount] = useState(S2.discount);
  const [marketing, setMarketing] = useState(S2.marketing);
  const [promo, setPromo] = useState(S2.promo);
  const [level, setLevel] = useState(S2.level);

  const p = clamp(price, 40, 210);
  const d = clamp(discount, 0, 0.3);
  const m = clamp(marketing, 200, 2000);
  const y = promo === 1 ? 1 : 0;
  const lv = clamp(level, 0.5, 0.999);

  const estimate = useMemo(() => predict(p, d, m, y, lv), [p, d, m, y, lv]);

  const ciWidth = estimate.ci[1] - estimate.ci[0];
  const piWidth = estimate.pi[1] - estimate.pi[0];
  const ratio = piWidth / ciWidth;
  const stock = Math.ceil(estimate.pi[1]);
  const levelPct = `${(lv * 100).toFixed(1)}%`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* 输入 */}
      <section className="rounded-xl border border-ink-800 bg-ink-900/50 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-100">情景输入</h3>
          <button
            type="button"
            onClick={() => {
              setPrice(S2.price);
              setDiscount(S2.discount);
              setMarketing(S2.marketing);
              setPromo(S2.promo);
              setLevel(S2.level);
            }}
            className="rounded-md border border-ink-700 px-2 py-1 text-xs text-slate-400 transition-colors hover:border-accent/50 hover:text-accent-soft"
          >
            复位到基准
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <ControlRow
            id="price"
            label="平均单价"
            hint="元 / 件"
            suffix="元"
            value={price}
            min={40}
            max={210}
            step={1}
            onChange={setPrice}
          />
          <ControlRow
            id="discount"
            label="折扣率"
            hint={`${(d * 100).toFixed(0)}% 折扣`}
            value={discount}
            min={0}
            max={0.3}
            step={0.01}
            onChange={setDiscount}
          />
          <ControlRow
            id="marketing"
            label="营销投入"
            hint="元 / 周"
            suffix="元"
            value={marketing}
            min={200}
            max={2000}
            step={50}
            onChange={setMarketing}
          />

          <div>
            <div className="flex items-center justify-between gap-3">
              <span id="promo-label" className="text-sm text-slate-300">
                是否促销
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={y === 1}
                aria-labelledby="promo-label"
                onClick={() => setPromo(y === 1 ? 0 : 1)}
                className={`relative h-6 w-11 rounded-full border transition-colors ${
                  y === 1 ? 'border-accent/60 bg-accent/40' : 'border-ink-700 bg-ink-800'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
                    y === 1 ? 'left-[22px] bg-accent-soft' : 'left-0.5 bg-slate-500'
                  }`}
                />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              当前：{y === 1 ? '促销周（+41.3 件）' : '非促销周'}
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="level" className="text-sm text-slate-300">
                置信水平
              </label>
              <span className="font-mono text-sm text-slate-100">{levelPct}</span>
            </div>
            <input
              id="level"
              type="range"
              min={0.5}
              max={0.999}
              step={0.005}
              value={lv}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="mt-2 w-full accent-[#6ea8fe]"
            />
            <p className="mt-0.5 text-xs text-slate-500">
              t 分位数 t₁₋(1−level)/2, df=1035 · 当前 {estimate.tc.toFixed(4)}
            </p>
          </div>
        </div>

        <p className="mt-4 rounded-lg border border-ink-800 bg-ink-950/60 p-3 text-xs leading-relaxed text-slate-400">
          模型：ŷ = 301.43 − 0.8895·单价 + 335.93·折扣率 + 0.0583·营销 + 41.35·促销，
          σ̂ = 37.66，df = 1035。系数是事先拟合好的常数，页面只代入、不重算。
        </p>
      </section>

      {/* 输出 */}
      <section className="rounded-xl border border-ink-800 bg-ink-900/50 p-4">
        <h3 className="text-sm font-semibold text-slate-100">
          {levelPct} 区间（单位：件）
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Stat label="点预测 ŷ" value={estimate.yhat.toFixed(1)} tone="plain" />
          <Stat
            label={`建议备货（PI 上界取整）`}
            value={`${stock}`}
            note="= Math.ceil(PI 上限)"
            tone="warn"
          />
          <Stat
            label={`${levelPct} CI 下限 / 上限`}
            value={`${estimate.ci[0].toFixed(1)} / ${estimate.ci[1].toFixed(1)}`}
            note={`宽度 ${ciWidth.toFixed(1)}（均值）`}
            tone="ci"
          />
          <Stat
            label={`${levelPct} PI 下限 / 上限`}
            value={`${estimate.pi[0].toFixed(1)} / ${estimate.pi[1].toFixed(1)}`}
            note={`宽度 ${piWidth.toFixed(1)}（单周实销）`}
            tone="pi"
          />
          <Stat
            label="宽度比 PI / CI"
            value={`${ratio.toFixed(1)}×`}
            note="单周波动 ≫ 均值的标准误"
          />
          <Stat
            label="杠杆 h₀ = x₀ᵗ(XᵗX)⁻¹x₀"
            value={estimate.h0.toFixed(4)}
            note={`seMean ${estimate.seMean.toFixed(2)} · sePred ${estimate.sePred.toFixed(2)}`}
          />
        </div>

        <div className="mt-4 rounded-lg border border-ink-800 bg-ink-950/60 p-3">
          <IntervalChart estimate={estimate} />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-5 rounded-sm border border-accent/50 bg-accent/20" />
              PI 粗带（下一周实销）
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-5 rounded-sm bg-accent-soft" />
              CI 细带（平均销量）
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-0.5 bg-amber-500" />ŷ 点预测
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 border-t border-dashed border-slate-500" />
              均值 293
            </span>
          </div>
        </div>
      </section>

      {/* 人话解释 */}
      <section className="rounded-xl border border-ink-800 bg-ink-900/50 p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold text-slate-100">两个区间回答的不是同一个问题</h3>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
          <li>
            <span className="text-slate-200">CI 回答「这一批场景的</span>
            <span className="text-accent-soft">平均销量</span>
            <span className="text-slate-200">在哪」</span>
            ：同样的价格、折扣、营销反复做很多周，长期平均会落在 CI 里。
            它只有 seMean = σ̂·√h₀ 这么宽，因为「平均」被平均掉了噪声。
          </li>
          <li>
            <span className="text-slate-200">PI 回答「</span>
            <span className="text-accent-soft">下一周实际卖多少</span>
            <span className="text-slate-200">」</span>
            ：单周实销还要再加上残差 σ̂，所以是 σ̂·√(1+h₀)，比 CI 宽一个 σ̂ 的量级。
          </li>
          <li>
            <span className="text-slate-200">所以</span>
            <span className="text-amber-200">备货要用 PI 上界</span>
            。用 CI 上界等于只覆盖「均值」，等于假设下周不会偏离平均：
            现在这个情景 CI 上界 {estimate.ci[1].toFixed(1)} 件、PI 上界{' '}
            {estimate.pi[1].toFixed(1)} 件，按 CI 备货，缺货从名义 5% 跳到 50% 量级。
          </li>
          <li>
            <span className="text-slate-200">杠杆 h₀ 是「这个场景有多不像样本」</span>
            ：越靠近样本中心 h₀ 越小、区间越窄；把单价推到 210、促销开着，
            h₀ 变大，PI 也会跟着变宽 —— 但变宽的速度很慢，
            因为线性模型没有「组合罕见就自动加宽」的机制。
          </li>
        </ul>
      </section>
    </div>
  );
}
