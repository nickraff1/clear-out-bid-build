import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Use the dashboard-card framed variant. Defaults to true. */
  framed?: boolean;
  /** Smaller padding for compact in-card empties. */
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  framed = true,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'text-center',
        compact ? 'py-8' : 'py-16',
        framed && !compact && 'dashboard-card',
        className,
      )}
    >
      <Icon
        className={cn(
          'mx-auto text-muted-foreground/40 mb-4',
          compact ? 'h-12 w-12 mb-3' : 'h-16 w-16',
        )}
      />
      <h3 className={cn('font-semibold mb-2', compact ? 'text-base' : 'text-lg')}>
        {title}
      </h3>
      {description && (
        <p className="text-muted-foreground mb-4 max-w-sm mx-auto">{description}</p>
      )}
      {action}
    </div>
  );
}