'use client';

import { useQuery } from '@apollo/client';
import { GET_ORG_USAGE } from '@/graphql/queries';

interface QuotaIndicatorProps {
  orgId: string;
}

export function QuotaIndicator({ orgId }: QuotaIndicatorProps) {
  const { data } = useQuery(GET_ORG_USAGE, {
    variables: { org_id: orgId },
    pollInterval: 30000,
    skip: !orgId,
  });

  const usage = data?.org_usage_this_month?.[0];
  if (!usage) return null;

  const pct = usage.pct_used ?? 0;
  const isHigh = pct >= 80;
  const isMedium = pct >= 50;

  const barColor = isHigh
    ? 'from-red-600 to-red-500'
    : isMedium
    ? 'from-amber-600 to-yellow-500'
    : 'from-violet-600 to-indigo-500';

  return (
    <div id="quota-indicator" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/40">
      <div className="hidden sm:block">
        <p className="text-xs text-slate-500 leading-none mb-1">Quota</p>
        <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
      <span className={`text-xs font-semibold tabular-nums ${
        isHigh ? 'text-red-400' : isMedium ? 'text-amber-400' : 'text-slate-300'
      }`}>
        {usage.calls_used}/{usage.calls_allowed}
      </span>
    </div>
  );
}
