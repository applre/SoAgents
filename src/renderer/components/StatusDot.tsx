import { memo } from 'react';
import type { SessionStatus } from '../../shared/types/session';

interface StatusDotProps {
  status: SessionStatus;
  /** 当前激活的 tab/session 不显示 approval 点（在看着就不算未读） */
  suppressApproval?: boolean;
  /** 尺寸，默认 1.5 (6px)；任务中心卡片用 2 (8px) */
  size?: 1.5 | 2;
  className?: string;
}

/**
 * 统一的 session 状态圆点组件。
 *
 * 视觉规则：
 * - active: 绿色 `--running` 实心 + 脉冲动画（AI 正在回复）
 * - approval: 暖棕 `--accent-warm` 实心（等用户查看）
 * - inactive / archived: 不渲染（返回 null）
 *
 * 使用场景：左侧栏 session 项 / tab 栏 / 任务中心卡片。
 */
export const StatusDot = memo(function StatusDot({
  status,
  suppressApproval = false,
  size = 1.5,
  className = '',
}: StatusDotProps) {
  const sizeClass = size === 2 ? 'h-2 w-2' : 'h-1.5 w-1.5';

  if (status === 'active') {
    return (
      <span
        className={`relative flex shrink-0 ${sizeClass} ${className}`}
        aria-label="AI 正在回复"
      >
        <span className="absolute inset-0 rounded-full bg-[var(--running-light)] opacity-75 animate-ping" />
        <span className={`relative inline-flex rounded-full bg-[var(--running)] ${sizeClass}`} />
      </span>
    );
  }

  if (status === 'approval' && !suppressApproval) {
    return (
      <span
        className={`shrink-0 rounded-full bg-[var(--accent-warm)] ${sizeClass} ${className}`}
        aria-label="有未读回复"
      />
    );
  }

  return null;
});
