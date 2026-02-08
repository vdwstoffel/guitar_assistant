'use client';

interface DegreeLegendProps {
  visible: boolean;
}

const DEGREE_COLORS = [
  { label: 'Root (1st)', color: 'bg-red-600', border: 'border-red-500' },
  { label: '3rd', color: 'bg-blue-600', border: 'border-blue-500' },
  { label: '5th', color: 'bg-green-600', border: 'border-green-500' },
  { label: '7th', color: 'bg-purple-600', border: 'border-purple-500' },
  { label: 'Other', color: 'bg-gray-500', border: 'border-gray-400' },
];

export default function DegreeLegend({ visible }: DegreeLegendProps) {
  if (!visible) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
      {DEGREE_COLORS.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div
            className={`w-4 h-4 rounded-full ${item.color} border ${item.border}`}
          />
          <span className="text-amber-200/70 text-xs">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
