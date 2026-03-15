import { type ReactNode, type MouseEvent } from 'react';
import { openExternal } from '@/utils/openExternal';

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function ExternalLink({ href, children, className, title }: ExternalLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0;

    if (!hasSelection && href) {
      openExternal(href);
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className={className}
      title={title}
      style={{ userSelect: 'text' }}
    >
      {children}
    </a>
  );
}
