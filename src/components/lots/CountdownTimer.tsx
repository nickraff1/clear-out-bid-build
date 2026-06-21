import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

function parts(endsAt: string | null | undefined) {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return { ended: true as const, d: 0, h: 0, m: 0, s: 0, ms: 0 };
  const s = Math.floor(ms / 1000);
  return {
    ended: false as const,
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
    ms,
  };
}

export function CountdownTimer({
  endsAt,
  className,
}: {
  endsAt: string | null | undefined;
  className?: string;
}) {
  const [p, setP] = useState(() => parts(endsAt));
  useEffect(() => {
    setP(parts(endsAt));
    const t = setInterval(() => setP(parts(endsAt)), 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  if (!p) return null;
  if (p.ended) return <span className={cn('text-muted-foreground', className)}>Ended</span>;

  const urgent = p.d === 0 && p.h === 0 && p.m < 5;
  return (
    <span className={cn('tabular-nums font-medium', urgent && 'text-primary', className)}>
      {p.d > 0 && `${p.d}d `}
      {String(p.h).padStart(2, '0')}:
      {String(p.m).padStart(2, '0')}:
      {String(p.s).padStart(2, '0')}
    </span>
  );
}