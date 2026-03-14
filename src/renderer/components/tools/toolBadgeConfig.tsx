import {
  BookOpen,
  ClipboardList,
  FileEdit,
  FilePen,
  FileText,
  Globe,
  HelpCircle,
  ListTodo,
  Search,
  SearchCode,
  Sparkles,
  Terminal,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';

export interface ToolBadgeConfig {
  icon: ReactNode;
  iconColor: string;
  textColor: string;
}

export function getToolBadgeConfig(toolName: string): ToolBadgeConfig {
  switch (toolName) {
    // File operations - Green/Emerald
    case 'Read':
      return {
        icon: <FileText className="size-3.5" />,
        iconColor: 'text-emerald-500',
        textColor: 'text-emerald-600',
      };
    case 'Write':
      return {
        icon: <FilePen className="size-3.5" />,
        iconColor: 'text-emerald-500',
        textColor: 'text-emerald-600',
      };
    case 'Edit':
      return {
        icon: <FileEdit className="size-3.5" />,
        iconColor: 'text-emerald-500',
        textColor: 'text-emerald-600',
      };
    // Terminal/Shell - Orange/Amber
    case 'Bash':
    case 'BashOutput':
      return {
        icon: <Terminal className="size-3.5" />,
        iconColor: 'text-amber-500',
        textColor: 'text-amber-600',
      };
    case 'KillShell':
      return {
        icon: <XCircle className="size-3.5" />,
        iconColor: 'text-amber-500',
        textColor: 'text-amber-600',
      };
    // Search - Purple/Violet
    case 'Grep':
      return {
        icon: <SearchCode className="size-3.5" />,
        iconColor: 'text-violet-500',
        textColor: 'text-violet-600',
      };
    case 'Glob':
    case 'WebSearch':
      return {
        icon: <Search className="size-3.5" />,
        iconColor: 'text-violet-500',
        textColor: 'text-violet-600',
      };
    // Web - Blue/Cyan
    case 'WebFetch':
      return {
        icon: <Globe className="size-3.5" />,
        iconColor: 'text-cyan-500',
        textColor: 'text-cyan-600',
      };
    // Task/Agent - Indigo
    case 'Agent':
    case 'Task':
      return {
        icon: <Zap className="size-3.5" />,
        iconColor: 'text-indigo-500',
        textColor: 'text-indigo-600',
      };
    case 'TodoWrite':
      return {
        icon: <ListTodo className="size-3.5" />,
        iconColor: 'text-indigo-500',
        textColor: 'text-indigo-600',
      };
    // Skill - Sky
    case 'Skill':
      return {
        icon: <Sparkles className="size-3.5" />,
        iconColor: 'text-sky-500',
        textColor: 'text-sky-600',
      };
    // Notebook - Teal
    case 'NotebookEdit':
      return {
        icon: <BookOpen className="size-3.5" />,
        iconColor: 'text-teal-500',
        textColor: 'text-teal-600',
      };
    // Plan Mode - Slate
    case 'EnterPlanMode':
    case 'ExitPlanMode':
      return {
        icon: <ClipboardList className="size-3.5" />,
        iconColor: 'text-slate-500',
        textColor: 'text-slate-600',
      };
    // Ask User - Orange
    case 'AskUserQuestion':
      return {
        icon: <HelpCircle className="size-3.5" />,
        iconColor: 'text-orange-500',
        textColor: 'text-orange-600',
      };
    // Default - Blue
    default:
      return {
        icon: <Wrench className="size-3.5" />,
        iconColor: 'text-blue-500',
        textColor: 'text-blue-600',
      };
  }
}
