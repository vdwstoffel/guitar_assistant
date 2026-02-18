"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface HistoryDataPoint {
  date: string;
  practiceMinutes: number;
  sessionCount: number;
}

interface Props {
  data: HistoryDataPoint[];
  isLoading: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PracticeHistoryChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="h-4 bg-gray-700 rounded w-40 mb-4" />
        <div className="h-64 bg-gray-700/50 rounded animate-pulse" />
      </div>
    );
  }

  if (data.length === 0 || data.every((d) => d.sessionCount === 0)) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Practice History</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          No practice data yet. Start playing to see your history!
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-white font-medium mb-4">Practice History</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="#9ca3af"
            fontSize={12}
            interval="preserveStartEnd"
          />
          <YAxis stroke="#9ca3af" fontSize={12} label={{ value: "minutes", angle: -90, position: "insideLeft", style: { fill: "#9ca3af" } }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "0.5rem" }}
            labelStyle={{ color: "#fff" }}
            itemStyle={{ color: "#22c55e" }}
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value, name) => {
              if (name === "practiceMinutes") return [`${value} min`, "Practice Time"];
              return [value, String(name)];
            }}
          />
          <Bar dataKey="practiceMinutes" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
