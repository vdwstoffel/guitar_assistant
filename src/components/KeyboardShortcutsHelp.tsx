"use client";

import { useEffect } from "react";

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  {
    group: "Playback",
    items: [
      { keys: ["Space"], description: "Play / Pause" },
      { keys: ["\u2190"], description: "Jump to start & play" },
    ],
  },
  {
    group: "Markers",
    items: [
      { keys: ["M"], description: "Add marker at current time" },
      { keys: ["1"], description: "Jump to marker 1" },
      { keys: ["2"], description: "Jump to marker 2" },
      { keys: ["..."], description: "" },
      { keys: ["0"], description: "Jump to marker 10" },
    ],
  },
  {
    group: "Other",
    items: [
      { keys: ["?"], description: "Show this help" },
    ],
  },
];

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((group) => (
            <div key={group.group}>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">
                {group.group}
              </h3>
              <div className="space-y-1.5">
                {group.items.map((item, i) => (
                  item.description ? (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm">{item.description}</span>
                      <div className="flex gap-1">
                        {item.keys.map((key) => (
                          <kbd
                            key={key}
                            className="px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-gray-200 font-mono min-w-7 text-center"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="text-center text-gray-500 text-xs">...</div>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-700 text-center">
          <span className="text-xs text-gray-500">Press <kbd className="px-1.5 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 font-mono">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
