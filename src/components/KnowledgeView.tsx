"use client";

import { useState } from "react";
import notes from "./theory";

export default function KnowledgeView() {
  const [selectedSlug, setSelectedSlug] = useState<string>(notes[0]?.slug ?? "");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  // Group by category
  const grouped = notes.reduce<Record<string, typeof notes>>((acc, note) => {
    if (!acc[note.category]) acc[note.category] = [];
    acc[note.category].push(note);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();

  const selected = notes.find((n) => n.slug === selectedSlug) ?? null;
  const NoteComponent = selected?.component ?? null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-64 shrink-0 border-r border-gray-700 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-white font-semibold text-sm tracking-wide">Theory Notes</h2>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {notes.length === 0 && (
            <div className="px-4 py-6 text-gray-500 text-sm">No notes yet.</div>
          )}

          {categories.map((category) => (
            <div key={category} className="mb-1">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-200 transition-colors"
              >
                <span>{category}</span>
                <svg
                  className={`w-3 h-3 transition-transform ${collapsedCategories.has(category) ? "-rotate-90" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {!collapsedCategories.has(category) && (
                <div>
                  {grouped[category].map((note) => (
                    <button
                      key={note.slug}
                      onClick={() => setSelectedSlug(note.slug)}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        selectedSlug === note.slug
                          ? "bg-blue-600/20 text-blue-300 border-r-2 border-blue-500"
                          : "text-gray-300 hover:bg-gray-700/50 hover:text-white"
                      }`}
                    >
                      {note.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto">
        {selected && NoteComponent ? (
          <div className="max-w-3xl mx-auto px-8 py-8">
            <div className="mb-6 pb-4 border-b border-gray-700">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                {selected.category}
              </span>
              <h1 className="text-2xl font-bold text-white mt-1">{selected.title}</h1>
            </div>
            <NoteComponent />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Select a note to read.
          </div>
        )}
      </div>
    </div>
  );
}
