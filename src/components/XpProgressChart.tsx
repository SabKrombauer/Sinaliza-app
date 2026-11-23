import React, { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildCumulativeXpSeries,
  formatLocalDate,
  type XpChartPoint,
} from '../utils/gamification';

interface XpProgressChartProps {
  xpByDate: Record<string, number>;
  totalXp: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: XpChartPoint }>;
}

const XpTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-md text-xs">
      <p className="font-semibold text-slate-900">
        {pt.dayShort} · {pt.label}
      </p>
      <p className="mt-1 font-mono font-bold tabular-nums text-blue-700">
        {pt.cumulativeXp} XP acumulados
      </p>
      <p className="mt-0.5 font-mono tabular-nums text-slate-600">
        {pt.dailyXp > 0 ? `+${pt.dailyXp} XP ganhos no dia` : 'Sem ganho de XP neste dia'}
      </p>
    </div>
  );
};

export const XpProgressChart: React.FC<XpProgressChartProps> = ({
  xpByDate,
  totalXp,
}) => {
  const [windowDays, setWindowDays] = useState<7 | 14>(7);
  const todayStr = formatLocalDate(new Date());

  const chartData = useMemo(
    () => buildCumulativeXpSeries(xpByDate, totalXp, windowDays, todayStr),
    [xpByDate, totalXp, windowDays, todayStr]
  );

  const todayXp = chartData[chartData.length - 1]?.dailyXp ?? 0;

  return (
    <div
      data-testid="xp-progress-chart"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-blue-700 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Evolução de Aprendizado
          </p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-3">
            <h2 className="text-lg font-bold text-slate-900">
              XP diário acumulado
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-600">
              {totalXp} XP totais · {todayXp > 0 ? `+${todayXp} XP hoje` : '0 XP hoje'}
            </span>
          </div>
        </div>

        <div
          className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start sm:self-auto"
          role="group"
          aria-label="Período do gráfico de XP"
        >
          {([7, 14] as const).map((days) => {
            const active = windowDays === days;
            return (
              <button
                key={days}
                type="button"
                onClick={() => setWindowDays(days)}
                className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {days} dias
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 h-60 w-full min-w-0">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
          >
            <defs>
              <linearGradient id="xpAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748B', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval={windowDays === 14 ? 1 : 0}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: '#64748B', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<XpTooltip />} />
            <Area
              type="monotone"
              dataKey="cumulativeXp"
              name="XP acumulado"
              stroke="#1D4ED8"
              strokeWidth={2.5}
              fill="url(#xpAreaGradient)"
              dot={{ r: 3.5, fill: '#1D4ED8', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#1D4ED8', stroke: '#FFFFFF', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
