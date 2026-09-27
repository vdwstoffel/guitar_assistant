"use client";

import { Fragment } from "react";

export interface TabPickerEntry {
  id: string;
  name: string;
  trackId: string;
  trackTitle: string;
}

export interface TabPickerProps {
  entries: TabPickerEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Entries arrive pre-sorted by track title then sortOrder (see GET /api/tabs),
// so grouping is a single linear pass rather than a sort/group-by.
function groupByTrack(entries: TabPickerEntry[]): { trackTitle: string; items: TabPickerEntry[] }[] {
  const groups: { trackTitle: string; items: TabPickerEntry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.trackTitle === entry.trackTitle) {
      last.items.push(entry);
    } else {
      groups.push({ trackTitle: entry.trackTitle, items: [entry] });
    }
  }
  return groups;
}

export default function TabPicker({ entries, selectedId, onSelect }: TabPickerProps) {
  const groups = groupByTrack(entries);

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-gray-400 uppercase tracking-wider">Tabs</h2>
      </div>

      {/* Tab list */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="text-gray-500 text-center p-6 text-sm">
            <p>No tabs found.</p>
          </div>
        ) : (
          <ul className="py-2">
            {groups.map((group) => (
              <Fragment key={group.trackTitle}>
                <li className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
                  {group.trackTitle}
                </li>
                {group.items.map((entry) => (
                  <li key={entry.id}>
                    <button
                      onClick={() => onSelect(entry.id)}
                      className={`w-full px-4 py-2 text-left transition-colors ${
                        selectedId === entry.id
                          ? "bg-gray-800 text-green-400 border-l-2 border-green-500"
                          : "hover:bg-gray-800 text-gray-300 border-l-2 border-transparent"
                      }`}
                    >
                      <span className="font-medium block truncate">{entry.name}</span>
                    </button>
                  </li>
                ))}
              </Fragment>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
