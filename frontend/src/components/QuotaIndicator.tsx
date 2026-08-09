import React from 'react';
import { BarChart2 } from 'lucide-react';

interface Props {
  used: number;
  allowed: number;
}

export const QuotaIndicator = ({ used, allowed }: Props) => {
  const pct = allowed > 0 ? Math.min((used / allowed) * 100, 100) : 0;
  const isWarning = pct >= 80;
  const isCritical = pct >= 95;

  return (
    <div className="quota-indicator" title={`${used} of ${allowed} API calls used`}>
      <BarChart2 size={14} />
      <div className="quota-bar-wrap">
        <div
          className={`quota-bar-fill ${isCritical ? 'quota-critical' : isWarning ? 'quota-warning' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="quota-text">
        {used}/{allowed}
      </span>
    </div>
  );
};
