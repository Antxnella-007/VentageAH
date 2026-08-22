"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { formatUsd } from "@/lib/format";

export function BranchChart({
  data,
}: {
  data: {
    branch: string;
    currentSpend: number;
    historicalAverage: number;
    anomalous: boolean;
  }[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={6}>
          <CartesianGrid stroke="#e6ebf1" vertical={false} />
          <XAxis dataKey="branch" tick={{ fill: "#5c6776", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
            tick={{ fill: "#5c6776", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value, name) => [
              formatUsd(Number(value)),
              name === "currentSpend" ? "Current" : "Baseline",
            ]}
            contentStyle={{ borderRadius: 8, borderColor: "#d9e0e8" }}
          />
          <Bar dataKey="historicalAverage" fill="#c5d0dc" radius={[4, 4, 0, 0]} name="historicalAverage" />
          <Bar dataKey="currentSpend" radius={[4, 4, 0, 0]} name="currentSpend">
            {data.map((entry) => (
              <Cell key={entry.branch} fill={entry.anomalous ? "#b42318" : "#0b1f3a"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
