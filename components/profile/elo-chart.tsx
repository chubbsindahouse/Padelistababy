"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

export interface EloDataPoint {
  session: number;
  elo: number;
  delta: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; payload: EloDataPoint }[];
  label?: string | number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const { elo, delta } = payload[0].payload;
  const sign = delta >= 0 ? "+" : "";
  const colour = delta >= 0 ? "#34d399" : "#f87171";
  return (
    <div className="bg-[#0f172a] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">Match {label}</p>
      <p className="text-white font-bold">{elo} <span className="text-slate-500 font-normal">ELO</span></p>
      <p style={{ color: colour }} className="font-semibold">{sign}{delta}</p>
    </div>
  );
}

export function EloChart({ data, startElo }: { data: EloDataPoint[]; startElo: number }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-28 text-slate-600 text-xs text-center px-4">
        Play at least 2 matches to see your ELO trend
      </div>
    );
  }

  const values = data.map((d) => d.elo);
  const min = Math.min(...values) - 30;
  const max = Math.max(...values) + 30;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
        <XAxis
          dataKey="session"
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[min, max]}
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={startElo}
          stroke="rgba(100,116,139,0.25)"
          strokeDasharray="4 3"
        />
        <Line
          type="monotone"
          dataKey="elo"
          stroke="#22d3ee"
          strokeWidth={2.5}
          dot={{ fill: "#22d3ee", r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#22d3ee", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
