"use client";

interface HistoryDataPoint {
  date: string;
  practiceMinutes: number;
  sessionCount: number;
  uniqueTracks?: number;
}

interface Props {
  data: HistoryDataPoint[];
  isLoading: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function dayOfWeekMonFirst(dateStr: string): number {
  // 0 = Monday, 6 = Sunday
  const d = new Date(dateStr + "T00:00:00");
  const js = d.getDay(); // 0 = Sun
  return (js + 6) % 7;
}

type WeekColumn = (HistoryDataPoint | null)[];

function buildWeeks(data: HistoryDataPoint[]): WeekColumn[] {
  if (data.length === 0) return [];
  const weeks: WeekColumn[] = [];
  let currentWeek: WeekColumn = Array(7).fill(null);

  const firstDow = dayOfWeekMonFirst(data[0].date);
  for (let i = 0; i < firstDow; i++) {
    currentWeek[i] = null;
  }

  for (const day of data) {
    const dow = dayOfWeekMonFirst(day.date);
    if (dow === 0 && currentWeek.some((c) => c !== null)) {
      weeks.push(currentWeek);
      currentWeek = Array(7).fill(null);
    }
    currentWeek[dow] = day;
  }
  weeks.push(currentWeek);

  return weeks;
}

function cellSizeClass(days: number): string {
  if (days <= 35) return "w-12 h-12";
  if (days <= 100) return "w-6 h-6";
  return "w-3 h-3";
}

export default function PracticeHistoryChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="h-4 bg-gray-700 rounded w-40 mb-4" />
        <div className="h-48 bg-gray-700/50 rounded animate-pulse" />
      </div>
    );
  }

  if (data.length === 0 || data.every((d) => d.sessionCount === 0)) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-white font-medium mb-4">Practice History</h3>
        <div className="h-48 flex items-center justify-center text-gray-500">
          No practice data yet. Start playing to see your history!
        </div>
      </div>
    );
  }

  const weeks = buildWeeks(data);
  const cellClass = cellSizeClass(data.length);
  const dayLabels = ["Mon", "", "Wed", "", "Fri", "", ""];

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-white font-medium mb-4">Practice History</h3>
      <div className="overflow-x-auto flex justify-center">
        <div className="flex gap-2">
          <div className="flex flex-col gap-1 pt-0.5 text-[10px] text-gray-500 select-none">
            {dayLabels.map((label, i) => (
              <div key={i} className={`${cellClass} flex items-center`}>{label}</div>
            ))}
          </div>
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => {
                  if (!day) {
                    return <div key={di} className={`${cellClass} bg-transparent`} />;
                  }
                  const practiced = day.sessionCount > 0;
                  const tooltip = `${formatDate(day.date)}\n${practiced ? "Practiced" : "No practice"}`;
                  return (
                    <div
                      key={di}
                      title={tooltip}
                      className={`${cellClass} ${practiced ? "bg-green-500" : "bg-gray-700"} rounded`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 mt-3 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-gray-700 rounded-sm" />
          <span>No practice</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-green-500 rounded-sm" />
          <span>Practiced</span>
        </div>
      </div>
    </div>
  );
}
