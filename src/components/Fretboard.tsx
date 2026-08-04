'use client';

import { useState } from 'react';
import {
  NOTES,
  SCALE_FORMULAS,
  getNoteAtFret,
} from '@/lib/musicTheory';
import type { ScaleType } from '@/lib/musicTheory';
import {
  useFretboardEnhancements,
  FretboardToolbar,
  ScaleFormulaDisplay,
  PentatonicPositionSelector,
  DegreeLegend,
  ScaleComparisonLegend,
  FretboardDisplay,
  ScaleReferenceTabs,
  ScaleSongsPanel,
} from '@/components/ScaleExplorer';
import { useNoteTrainer, NoteTrainerControls } from '@/components/NoteTrainer';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Fretboard() {
  const [showNoteNames, setShowNoteNames] = useState(true);
  const [selectedScale, setSelectedScale] = useState<ScaleType>('None');
  const [selectedKey, setSelectedKey] = useState('C');
  const [trainerMode, setTrainerMode] = useState(false);

  const enhancements = useFretboardEnhancements({
    selectedKey,
    selectedScale,
  });

  const trainer = useNoteTrainer();

  return (
    <div
      className="flex-1 flex flex-col items-center justify-start p-6 overflow-auto"
      style={{
        background: 'linear-gradient(to bottom, hsl(23, 64%, 5%), hsl(23, 64%, 18%))',
      }}
    >
      <div className="w-full max-w-450">
        {/* Header */}
        <div className="mb-4 text-center">

          {trainerMode ? (
            /* Note Trainer controls */
            <div className="flex flex-col items-center gap-4">
              <NoteTrainerControls
                config={trainer.config}
                phase={trainer.phase}
                currentNote={trainer.currentNote}
                currentBeat={trainer.currentBeat}
                isRunning={trainer.isRunning}
                micStatus={trainer.micStatus}
                micError={trainer.micError}
                detectedNote={trainer.detectedNote}
                matchHit={trainer.matchHit}
                missedNote={trainer.missedNote}
                correct={trainer.correct}
                total={trainer.total}
                streak={trainer.streak}
                completed={trainer.completed}
                onStart={trainer.start}
                onStop={trainer.stop}
                onUpdateConfig={trainer.updateConfig}
              />
              <button
                onClick={() => { trainer.stop(); setTrainerMode(false); }}
                className="px-4 py-2 rounded bg-amber-900/50 hover:bg-amber-800/50 text-amber-200 text-sm transition-colors"
              >
                Back to Scale Explorer
              </button>
            </div>
          ) : (
            /* Normal scale controls */
            <div className="flex flex-col items-center gap-2">
              {/* Scale/Key selectors and mode buttons on one row */}
              <div className="flex flex-wrap gap-3 items-end justify-center">
                <div className="flex flex-col gap-1">
                  <label className="text-amber-200/70 text-sm font-medium">Scale</label>
                  <select
                    value={selectedScale}
                    onChange={(e) => setSelectedScale(e.target.value as ScaleType)}
                    className="px-3 py-2 rounded bg-amber-900/50 text-amber-100 border border-amber-700/50 focus:outline-none focus:border-amber-500"
                  >
                    {Object.keys(SCALE_FORMULAS).map((scale) => (
                      <option key={scale} value={scale}>
                        {scale}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-amber-200/70 text-sm font-medium">Key</label>
                  <select
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                    disabled={selectedScale === 'None'}
                    className="px-3 py-2 rounded bg-amber-900/50 text-amber-100 border border-amber-700/50 focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {NOTES.map((note) => (
                      <option key={note} value={note}>
                        {note}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setShowNoteNames(!showNoteNames)}
                  className={`px-4 py-2 rounded transition-colors ${
                    showNoteNames
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-amber-900/50 hover:bg-amber-800/50 text-amber-200'
                  }`}
                >
                  {showNoteNames ? 'Hide Note Names' : 'Show Note Names'}
                </button>
                <button
                  onClick={() => setTrainerMode(true)}
                  className="px-4 py-2 rounded bg-green-700 hover:bg-green-600 text-white transition-colors"
                >
                  Note Trainer
                </button>
              </div>

              {/* Scale description, degrees, and genres — one line under the controls */}
              {selectedScale !== 'None' && (
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
                  <span className="text-amber-200/70 text-xs leading-snug">
                    <span className="text-amber-300 font-semibold">{selectedKey} {selectedScale}</span>
                    {' — '}
                    {SCALE_FORMULAS[selectedScale].description}
                  </span>

                  {/* Scale Formula Display */}
                  <ScaleFormulaDisplay formula={enhancements.scaleFormula} />

                  <div className="flex flex-wrap gap-1.5">
                    {SCALE_FORMULAS[selectedScale].genres.map((genre) => (
                      <span
                        key={genre}
                        className="px-2 py-0.5 rounded-full text-xs bg-amber-800/40 text-amber-300/80 border border-amber-700/30"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Enhancement Toolbar */}
              <FretboardToolbar
                selectedScale={selectedScale}
                showDegreeColors={enhancements.showDegreeColors}
                labelMode={enhancements.labelMode}
                compareScale={enhancements.compareScale}
                onToggleDegreeColors={enhancements.toggleDegreeColors}
                onSetLabelMode={enhancements.setLabelMode}
                onSetCompareScale={enhancements.setCompareScale}
              />

              {/* Pentatonic Position Selector */}
              {enhancements.hasPentatonicPositions && (
                <PentatonicPositionSelector
                  positions={enhancements.pentatonicPositions}
                  selectedPosition={enhancements.selectedPosition}
                  onSelectPosition={enhancements.setSelectedPosition}
                />
              )}
            </div>
          )}
        </div>

        {/* Fretboard */}
        <FretboardDisplay
          numFrets={24}
          getNoteDisplayInfo={enhancements.getNoteDisplayInfo}
          showDegreeColors={enhancements.showDegreeColors}
          isComparing={enhancements.isComparing}
          showNoteNames={showNoteNames && !trainer.isRunning}
          renderOverride={(stringIndex, fret) => {
            if (!trainer.isRunning || trainer.phase !== 'revealing') return null;
            const noteAtPosition = getNoteAtFret(stringIndex, fret);
            const isTrainerReveal =
              noteAtPosition === trainer.currentNote &&
              trainer.config.enabledStrings[stringIndex] &&
              fret <= 12;
            return isTrainerReveal ? <TrainerDot note={noteAtPosition} /> : null;
          }}
        />

        {/* Legends (hidden during trainer mode) */}
        {!trainer.isRunning && (
          <div className="mt-6 text-center text-sm text-amber-200/70 space-y-2">
            {/* Degree color legend */}
            <DegreeLegend visible={enhancements.showDegreeColors && selectedScale !== 'None'} />

            {/* Comparison legend */}
            <ScaleComparisonLegend
              primaryScale={selectedScale}
              compareScale={enhancements.compareScale}
              selectedKey={selectedKey}
            />
          </div>
        )}

        {/* Reference tabs (left) + songs panel (right) */}
        {!trainer.isRunning && (
          <div className="mt-6 w-full flex flex-col lg:flex-row gap-4 items-start">
            <div className="flex-1 min-w-0">
              <ScaleReferenceTabs root={selectedKey} scaleType={selectedScale} />
            </div>
            <ScaleSongsPanel root={selectedKey} scaleType={selectedScale} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrainerDot – highlighted note dot used during Note Trainer reveal phase
// ---------------------------------------------------------------------------

function TrainerDot({ note }: { note: string }) {
  return (
    <div
      className="absolute z-10 rounded-full flex items-center justify-center animate-pulse"
      style={{
        width: '32px',
        height: '32px',
        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        border: '2px solid #15803d',
        boxShadow: '0 0 16px rgba(34, 197, 94, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4)',
      }}
    >
      <span className="text-white text-xs font-mono font-bold">{note}</span>
    </div>
  );
}
