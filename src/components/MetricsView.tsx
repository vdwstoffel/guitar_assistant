"use client";

import { useState, useEffect, useCallback } from "react";
import MetricsSummaryCards from "./metrics/MetricsSummaryCards";
import PracticeHistoryChart from "./metrics/PracticeHistoryChart";
import TopTracksTable from "./metrics/TopTracksTable";
import SpeedProgressionChart from "./metrics/SpeedProgressionChart";

type Period = "30" | "90" | "365";

interface MetricsSummary {
  totalSessions: number;
  totalPracticeTimeSeconds: number;
  uniqueTracksPlayed: number;
  currentStreak: number;
  lastPracticeDate: string | null;
}

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

interface HistoryDataPoint {
  date: string;
  practiceMinutes: number;
  sessionCount: number;
}

interface SpeedData {
  title: string | null;
  sessions: { date: string; speed: number; durationSeconds: number; completed: boolean }[];
}

export default function MetricsView() {
  const [period, setPeriod] = useState<Period>("30");
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [topTracks, setTopTracks] = useState<TrackMetric[]>([]);
  const [history, setHistory] = useState<HistoryDataPoint[]>([]);
  const [speedData, setSpeedData] = useState<SpeedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [summaryRes, tracksRes, historyRes] = await Promise.all([
        fetch("/api/metrics/summary"),
        fetch("/api/metrics/top-tracks?limit=20&sortBy=playCount"),
        fetch(`/api/metrics/history?days=${period}`),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (tracksRes.ok) setTopTracks(await tracksRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());
    } catch {
      // Silently handle fetch errors
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTrackSelect = async (trackId: string | null, jamTrackId: string | null) => {
    const id = trackId ?? jamTrackId;
    if (!id) return;

    // Toggle off if same track selected
    if (speedData && ((trackId && speedData.title === topTracks.find((t) => t.trackId === trackId)?.title) ||
        (jamTrackId && speedData.title === topTracks.find((t) => t.jamTrackId === jamTrackId)?.title))) {
      setSpeedData(null);
      return;
    }

    const type = jamTrackId ? "jamtrack" : "track";
    try {
      const res = await fetch(`/api/metrics/speed-progression/${id}?type=${type}`);
      if (res.ok) {
        setSpeedData(await res.json());
      }
    } catch {
      // Silently handle errors
    }
  };

  const periods: { value: Period; label: string }[] = [
    { value: "30", label: "30 days" },
    { value: "90", label: "90 days" },
    { value: "365", label: "1 year" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h1 className="text-xl font-bold text-white">Practice Metrics</h1>
          </div>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  period === p.value
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <MetricsSummaryCards summary={summary} isLoading={isLoading} />

        {/* Practice History Chart */}
        <PracticeHistoryChart data={history} isLoading={isLoading} />

        {/* Speed Progression (shown when track selected) */}
        {speedData && speedData.sessions.length > 0 && (
          <SpeedProgressionChart
            title={speedData.title}
            sessions={speedData.sessions}
            onClose={() => setSpeedData(null)}
          />
        )}

        {/* Top Tracks Table */}
        <TopTracksTable
          tracks={topTracks}
          isLoading={isLoading}
          onTrackSelect={handleTrackSelect}
        />
      </div>
    </div>
  );
}
