"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface SpeedDataPoint {
  date: string;
  speed: number;
  durationSeconds: number;
  completed: boolean;
}

interface Props {
  title: string | null;
  sessions: SpeedDataPoint[];
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function SpeedProgressionChart({ title, sessions, onClose }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Speed Progression</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="h-48 flex items-center justify-center text-gray-500">No data</div>
      </div>
    );
  }

  const latestSpeed = sessions[sessions.length - 1].speed;
  const startSpeed = sessions[0].speed;
  const speedChange = latestSpeed - startSpeed;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-medium">Speed Progression{title ? `: ${title}` : ""}</h3>
          <div className="text-sm text-gray-400 mt-1">
            {startSpeed}% → {latestSpeed}%
            {speedChange !== 0 && (
              <span className={speedChange > 0 ? "text-green-400 ml-2" : "text-red-400 ml-2"}>
                ({speedChange > 0 ? "+" : ""}{speedChange}%)
              </span>
            )}
            <span className="text-gray-500 ml-2">over {sessions.length} sessions</span>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={sessions}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="#9ca3af" fontSize={12} />
          <YAxis stroke="#9ca3af" fontSize={12} domain={["dataMin - 5", "dataMax + 5"]} label={{ value: "speed %", angle: -90, position: "insideLeft", style: { fill: "#9ca3af" } }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "0.5rem" }}
            labelStyle={{ color: "#fff" }}
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value) => [`${value}%`, "Speed"]}
          />
          <Line type="monotone" dataKey="speed" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
