"use client";

import { useState } from "react";

interface TrackMetric {
  trackId: string | null;
  jamTrackId: string | null;
  title: string;
  playCount: number;
  totalPracticeTime: number;
  averageSpeed: number;
  lastPracticed: string;
  completionRate: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function speedColor(speed: number): string {
  if (speed >= 100) return "text-green-400";
  if (speed >= 80) return "text-yellow-400";
  return "text-orange-400";
}

type SortField = "playCount" | "totalPracticeTime" | "averageSpeed" | "lastPracticed";

interface Props {
  tracks: TrackMetric[];
  isLoading: boolean;
  onTrackSelect: (trackId: string | null, jamTrackId: string | null) => void;
}

export default function TopTracksTable({ tracks, isLoading, onTrackSelect }: Props) {
  const [sortField, setSortField] = useState<SortField>("playCount");
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const sorted = [...tracks].sort((a, b) => {
    let cmp = 0;
    if (sortField === "lastPracticed") {
      cmp = new Date(a.lastPracticed).getTime() - new Date(b.lastPracticed).getTime();
    } else {
      cmp = a[sortField] - b[sortField];
    }
    return sortDesc ? -cmp : cmp;
  });

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 text-gray-500">
      {sortField === field ? (sortDesc ? "\u25BC" : "\u25B2") : ""}
    </span>
  );

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="h-4 bg-gray-700 rounded w-40 mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-700/50 rounded mb-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Most Played Tracks</h3>
        <div className="py-8 text-center text-gray-500">
          No tracks played yet. Start practicing to see your stats!
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-white font-medium mb-4">Most Played Tracks</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-4">Title</th>
              <th className="text-right py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort("playCount")}>
                Plays<SortIcon field="playCount" />
              </th>
              <th className="text-right py-2 px-2 cursor-pointer hover:text-white hidden sm:table-cell" onClick={() => handleSort("totalPracticeTime")}>
                Time<SortIcon field="totalPracticeTime" />
              </th>
              <th className="text-right py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort("averageSpeed")}>
                Avg Speed<SortIcon field="averageSpeed" />
              </th>
              <th className="text-right py-2 pl-2 cursor-pointer hover:text-white hidden sm:table-cell" onClick={() => handleSort("lastPracticed")}>
                Last<SortIcon field="lastPracticed" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((track) => (
              <tr
                key={track.trackId ?? track.jamTrackId}
                className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer transition-colors"
                onClick={() => onTrackSelect(track.trackId, track.jamTrackId)}
              >
                <td className="py-2 pr-4 text-white max-w-xs truncate">
                  <div className="flex items-center gap-2">
                    {track.jamTrackId && (
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Jam</span>
                    )}
                    {track.title}
                  </div>
                </td>
                <td className="py-2 px-2 text-right text-gray-300">{track.playCount}</td>
                <td className="py-2 px-2 text-right text-gray-300 hidden sm:table-cell">{formatDuration(track.totalPracticeTime)}</td>
                <td className={`py-2 px-2 text-right ${speedColor(track.averageSpeed)}`}>{track.averageSpeed}%</td>
                <td className="py-2 pl-2 text-right text-gray-400 hidden sm:table-cell">{formatRelativeDate(track.lastPracticed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
