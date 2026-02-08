'use client';

interface ScaleFormulaDisplayProps {
  formula: string[];
}

export default function ScaleFormulaDisplay({ formula }: ScaleFormulaDisplayProps) {
  if (formula.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
      {formula.map((interval, idx) => (
        <span key={idx} className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-700/30 text-amber-200 border border-amber-600/30">
            {interval}
          </span>
          {idx < formula.length - 1 && (
            <span className="text-amber-500/50 text-xs">-</span>
          )}
        </span>
      ))}
    </div>
  );
}
