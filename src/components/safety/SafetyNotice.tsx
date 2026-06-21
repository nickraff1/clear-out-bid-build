import { ShieldAlert, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ReactNode } from 'react';

interface Props {
  variant?: 'info' | 'warning';
  title?: string;
  children: ReactNode;
}

export function SafetyNotice({ variant = 'info', title, children }: Props) {
  const Icon = variant === 'warning' ? ShieldAlert : Info;
  const tone =
    variant === 'warning'
      ? 'border-destructive/40 bg-destructive/5 [&_svg]:text-destructive'
      : 'border-border bg-muted/40 [&_svg]:text-primary';
  return (
    <div className={`rounded-lg border p-4 text-sm ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          {title && <p className="font-semibold">{title}</p>}
          <div className="text-muted-foreground space-y-1 [&_a]:text-primary [&_a]:hover:underline">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ListingSafetyNotice() {
  return (
    <SafetyNotice title="Buy safely on Offcutt">
      <ul className="list-disc pl-4 space-y-0.5">
        <li>Inspect the material in person before confirming collection.</li>
        <li>Bring an appropriate vehicle and help for loading.</li>
        <li>Only confirm pickup once you have received the item.</li>
        <li>
          Hazardous, contaminated, stolen, or asbestos-containing materials are{' '}
          <Link to="/prohibited-materials">not permitted</Link>. Use Report if you suspect a
          problem.
        </li>
      </ul>
    </SafetyNotice>
  );
}

export function PickupSafetyReminder() {
  return (
    <SafetyNotice title="Pickup safety">
      <p>
        Only confirm collection once you have inspected and physically received the item. See our{' '}
        <Link to="/pickup-safety">pickup safety guide</Link> for details.
      </p>
    </SafetyNotice>
  );
}