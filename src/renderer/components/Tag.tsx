/**
 * Tag — 设置页 / 列表项的统一标签组件
 *
 * 三种 variant，视觉权重递增：
 *  - scope：归属（全局 / 项目 / 工作区）— 小圆角、灰底、无边框，权重最低
 *  - attribute：属性（预设 / 免费 / 需 API Key）— 胶囊 + 边框 + 语义色，权重中
 *  - state：状态（已启用 / 未启用 / 错误 / 连接中）— 胶囊 + 圆点 + 语义底，权重最高
 *
 * 色 tone 直接映射到 CSS 语义 token：
 *  - neutral → ink 灰阶
 *  - info → 蓝（中性信息，如「预设」）
 *  - success → 绿（已启用 / 免费）
 *  - warning → 琥珀（连接中 / 等待中）
 *  - accent → 暖棕（强调）
 *  - error → 红（错误）
 */

import type { ReactNode } from 'react';

export type TagVariant = 'scope' | 'attribute' | 'state';
export type TagTone = 'neutral' | 'info' | 'success' | 'warning' | 'accent' | 'error';

interface TagProps {
  variant: TagVariant;
  tone?: TagTone;
  children: ReactNode;
  /** 仅 attribute variant 生效：是否保留边框（默认 true） */
  bordered?: boolean;
  /** 仅 state variant 生效：是否显示圆点（默认 true） */
  dot?: boolean;
  className?: string;
  title?: string;
}

// 各 variant 基础样式
const VARIANT_BASE: Record<TagVariant, string> = {
  scope: 'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium',
  attribute: 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
  state: 'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium',
};

// scope 的 tone 统一用灰底 + 不同文字色，视觉权重低
const SCOPE_COLORS: Record<TagTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--hover)',   fg: 'var(--ink-tertiary)' },
  info:    { bg: 'var(--info-bg)', fg: 'var(--info)' },
  success: { bg: 'var(--hover)',   fg: 'var(--success)' },
  warning: { bg: 'var(--hover)',   fg: 'var(--warning)' },
  accent:  { bg: 'var(--hover)',   fg: 'var(--accent)' },
  error:   { bg: 'var(--hover)',   fg: 'var(--error)' },
};

// attribute 的 tone 用语义底 + 同色边框 + 语义字，对齐 MyAgents 的视觉
const ATTRIBUTE_COLORS: Record<TagTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: 'var(--surface)',    fg: 'var(--ink-secondary)', border: 'var(--border)' },
  info:    { bg: 'var(--info-bg)',    fg: 'var(--info)',          border: 'var(--info)' },
  success: { bg: 'var(--success-bg)', fg: 'var(--success)',       border: 'var(--success)' },
  warning: { bg: 'var(--warning-bg)', fg: 'var(--warning)',       border: 'var(--warning)' },
  accent:  { bg: 'var(--hover)',      fg: 'var(--accent)',        border: 'var(--accent)' },
  error:   { bg: 'var(--error-bg)',   fg: 'var(--error)',         border: 'var(--error)' },
};

// state 的 tone：语义底（10%）+ 语义字 + 圆点
const STATE_COLORS: Record<TagTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--surface)',    fg: 'var(--ink-tertiary)' },
  info:    { bg: 'var(--info-bg)',    fg: 'var(--info)' },
  success: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  warning: { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
  accent:  { bg: 'var(--hover)',      fg: 'var(--accent)' },
  error:   { bg: 'var(--error-bg)',   fg: 'var(--error)' },
};

export function Tag({
  variant,
  tone = 'neutral',
  children,
  bordered = true,
  dot = true,
  className,
  title,
}: TagProps) {
  const base = VARIANT_BASE[variant];

  if (variant === 'scope') {
    const c = SCOPE_COLORS[tone];
    return (
      <span
        className={`${base} ${className ?? ''}`}
        style={{ background: c.bg, color: c.fg }}
        title={title}
      >
        {children}
      </span>
    );
  }

  if (variant === 'attribute') {
    const c = ATTRIBUTE_COLORS[tone];
    const style: React.CSSProperties = {
      background: c.bg,
      color: c.fg,
    };
    if (bordered) {
      style.border = `1px solid color-mix(in srgb, ${c.border} 25%, transparent)`;
    }
    return (
      <span className={`${base} ${className ?? ''}`} style={style} title={title}>
        {children}
      </span>
    );
  }

  // state
  const c = STATE_COLORS[tone];
  return (
    <span
      className={`${base} ${className ?? ''}`}
      style={{ background: c.bg, color: c.fg }}
      title={title}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: c.fg }}
        />
      )}
      {children}
    </span>
  );
}

export default Tag;
