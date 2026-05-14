"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface DataPoint {
  month: string;
  count: number;
  mwp: number;
}

export function KpiTrendChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
            stroke="#64748b"
            allowDecimals={false}
            label={{
              value: "Teklif",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "#64748b" },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            stroke="#64748b"
            label={{
              value: "MWp",
              angle: 90,
              position: "insideRight",
              style: { fontSize: 11, fill: "#64748b" },
            }}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="left" dataKey="count" name="Teklif Sayısı" fill="#059669" radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="mwp"
            name="Toplam MWp"
            stroke="#d97706"
            strokeWidth={2}
            dot={{ r: 3, fill: "#d97706" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
