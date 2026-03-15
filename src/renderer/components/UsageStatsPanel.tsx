import { ArrowDownLeft, ArrowUpRight, BarChart2, Database, Loader2, MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getGlobalStats, type GlobalStats } from '../api/statsApi';
import { formatTokens } from '../utils/formatTokens';

type TimeRange = '7d' | '30d' | '60d';

const RANGE_LABELS: Record<TimeRange, string> = {
  '7d': '7天',
  '30d': '30天',
  '60d': '60天',
};

export default function UsageStatsPanel() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>('30d');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const data = await getGlobalStats(range);
        if (cancelled) return;
        if (data) {
          setStats(data);
        } else {
          setError('无法加载统计数据');
        }
      } catch {
        if (!cancelled) setError('加载失败');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [range]);

  const totalTokens = (stats?.summary.totalInputTokens ?? 0) + (stats?.summary.totalOutputTokens ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--ink)]">使用统计</h2>
          <p className="mt-1 text-sm text-[var(--ink-tertiary)]">全局 Token 消耗统计</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
          {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--ink-tertiary)] hover:text-[var(--ink)]'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center gap-2 text-[var(--ink-tertiary)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">加载中...</span>
        </div>
      ) : error ? (
        <div className="flex h-48 items-center justify-center text-[var(--error)]">
          {error}
        </div>
      ) : stats ? (
        <>
          <SummaryCards stats={stats} totalTokens={totalTokens} />
          <DailyTrendChart daily={stats.daily} totalTokens={totalTokens} />
          <ModelTable byModel={stats.byModel} totalTokens={totalTokens} />
        </>
      ) : null}
    </div>
  );
}

// ============= Summary Cards =============

function SummaryCards({ stats, totalTokens }: { stats: GlobalStats; totalTokens: number }) {
  const cards = [
    { label: '总 Token', value: formatTokens(totalTokens), icon: BarChart2 },
    { label: '输入 Token', value: formatTokens(stats.summary.totalInputTokens), icon: ArrowUpRight },
    { label: '输出 Token', value: formatTokens(stats.summary.totalOutputTokens), icon: ArrowDownLeft },
    { label: '输入缓存', value: formatTokens(stats.summary.totalCacheReadTokens + stats.summary.totalCacheCreationTokens), icon: Database },
    { label: '对话轮次', value: String(stats.summary.messageCount), icon: MessageSquare },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2 text-[var(--ink-tertiary)]">
            <card.icon className="h-4 w-4" />
            <span className="text-xs">{card.label}</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{card.value}</div>
        </div>
      ))}
    </div>
  );
}

// ============= Daily Trend Chart =============

interface TooltipState {
  x: number;
  y: number;
  containerWidth: number;
  date: string;
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
}

function DailyTrendChart({ daily, totalTokens }: { daily: GlobalStats['daily']; totalTokens: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHoveredIndex(null);
  }, []);

  const handleBarHover = useCallback((e: React.MouseEvent<SVGRectElement>, index: number, day: GlobalStats['daily'][number]) => {
    const containerEl = containerRef.current;
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 10,
      containerWidth: containerEl.clientWidth,
      date: day.date,
      inputTokens: day.inputTokens,
      outputTokens: day.outputTokens,
      messageCount: day.messageCount,
    });
    setHoveredIndex(index);
  }, []);

  if (daily.length === 0) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--ink)]">每日用量趋势</h3>
        </div>
        <div className="flex h-48 items-center justify-center rounded-lg border border-[var(--border)] text-sm text-[var(--ink-tertiary)]">
          暂无数据
        </div>
      </div>
    );
  }

  const maxTotal = Math.max(...daily.map(d => d.inputTokens + d.outputTokens), 1);
  const chartHeight = 200;
  const chartPaddingTop = 16;
  const chartPaddingBottom = 28;
  const chartPaddingX = 12;
  const barAreaHeight = chartHeight - chartPaddingTop - chartPaddingBottom;
  const svgWidth = 800;
  const dayCount = daily.length;
  const barGap = Math.max(2, Math.min(8, (svgWidth - chartPaddingX * 2) / dayCount * 0.15));
  const barWidth = Math.max(4, ((svgWidth - chartPaddingX * 2) - (dayCount - 1) * barGap) / dayCount);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--ink)]">每日用量趋势</h3>
        <span className="text-xs text-[var(--ink-tertiary)]">
          总消耗: {formatTokens(totalTokens)} tokens
        </span>
      </div>
      <div
        ref={containerRef}
        className="relative rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
        onMouseLeave={handleMouseLeave}
      >
        <svg
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${svgWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMax meet"
          className="w-full"
        >
          {daily.map((day, i) => {
            const x = chartPaddingX + i * (barWidth + barGap);
            const total = day.inputTokens + day.outputTokens;
            const totalH = Math.max((total / maxTotal) * barAreaHeight, 2);
            const inputH = total > 0 ? (day.inputTokens / total) * totalH : totalH / 2;
            const outputH = totalH - inputH;
            const barY = chartPaddingTop + barAreaHeight - totalH;
            const isHovered = hoveredIndex === i;
            const dateLabel = day.date.slice(5);

            return (
              <g key={day.date}>
                <rect
                  x={x} y={chartPaddingTop} width={barWidth} height={barAreaHeight}
                  fill="transparent"
                  onMouseMove={(e) => handleBarHover(e, i, day)}
                  style={{ cursor: 'pointer' }}
                />
                {/* Input (bottom) */}
                <rect
                  x={x} y={barY + outputH} width={barWidth} height={inputH} rx={0}
                  fill="var(--accent)"
                  opacity={isHovered ? 0.8 : 0.35}
                  pointerEvents="none"
                  style={{ transition: 'opacity 0.15s' }}
                />
                {/* Output (top) */}
                <rect
                  x={x} y={barY} width={barWidth} height={outputH}
                  rx={barWidth > 4 ? 3 : 1}
                  fill="var(--accent)"
                  opacity={isHovered ? 0.7 : 0.4}
                  pointerEvents="none"
                  style={{ transition: 'opacity 0.15s' }}
                />
                <text
                  x={x + barWidth / 2} y={chartHeight - 6}
                  textAnchor="middle" fill="var(--ink-tertiary)" fontSize="9" fontFamily="inherit" pointerEvents="none"
                >
                  {dateLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 shadow-lg"
            style={{
              left: Math.min(tooltip.x, (tooltip.containerWidth || 300) - 180),
              top: Math.max(tooltip.y - 70, 4),
            }}
          >
            <div className="text-xs font-medium text-[var(--ink)]">{tooltip.date}</div>
            <div className="mt-1 space-y-0.5 text-xs text-[var(--ink-tertiary)]">
              <div>输入: {formatTokens(tooltip.inputTokens)}</div>
              <div>输出: {formatTokens(tooltip.outputTokens)}</div>
              <div>对话: {tooltip.messageCount} 轮</div>
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-[var(--ink-tertiary)]">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-[var(--accent)] opacity-35" />
            <span>输入</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-[var(--accent)] opacity-40" />
            <span>输出</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= Model Distribution Table =============

function ModelTable({ byModel, totalTokens }: { byModel: GlobalStats['byModel']; totalTokens: number }) {
  const models = Object.entries(byModel);
  if (models.length === 0) return null;

  models.sort((a, b) => {
    const totalA = a[1].inputTokens + a[1].outputTokens;
    const totalB = b[1].inputTokens + b[1].outputTokens;
    return totalB - totalA;
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--ink)]">模型用量分布</h3>
        <span className="text-xs text-[var(--ink-tertiary)]">
          总消耗: {formatTokens(totalTokens)} tokens
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface)]">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ink-tertiary)]">模型</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">总 Token</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">输入</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">输出</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">输入缓存</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-[var(--ink-tertiary)]">次数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {models.map(([model, data]) => (
              <tr key={model}>
                <td className="px-4 py-2 text-[var(--ink)]">{model}</td>
                <td className="px-4 py-2 text-right font-medium text-[var(--ink)]">
                  {formatTokens(data.inputTokens + data.outputTokens)}
                </td>
                <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">{formatTokens(data.inputTokens)}</td>
                <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">{formatTokens(data.outputTokens)}</td>
                <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">
                  {formatTokens(data.cacheReadTokens + data.cacheCreationTokens)}
                </td>
                <td className="px-4 py-2 text-right text-[var(--ink-tertiary)]">{data.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
