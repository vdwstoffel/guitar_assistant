'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PitchDetector } from 'pitchy';
import { TUNING_PRESETS, freqToNote, nearestString, type TuningString } from '@/lib/tuner/presets';

type Mode = 'chromatic' | 'preset';
type Status = 'idle' | 'requesting' | 'listening' | 'denied' | 'error';

type Detection = {
  freq: number;
  note: string;
  octave: number;
  cents: number;
};

interface TunerProps {
  show: boolean;
}

const FFT_SIZE = 2048;
const CLARITY_THRESHOLD = 0.92;
const MIN_FREQ = 60;
const MAX_FREQ = 1500;

export default function Tuner({ show }: TunerProps) {
  const [mode, setMode] = useState<Mode>('preset');
  const [presetId, setPresetId] = useState(TUNING_PRESETS[0].id);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detection, setDetection] = useState<Detection | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<PitchDetector<Float32Array<ArrayBuffer>> | null>(null);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch {}
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    detectorRef.current = null;
    bufferRef.current = null;
    setDetection(null);
    setStatus('idle');
  }, []);

  const tick = useCallback(() => {
    const ctx = audioContextRef.current;
    const analyser = analyserRef.current;
    const detector = detectorRef.current;
    const buf = bufferRef.current;
    if (!ctx || !analyser || !detector || !buf) return;

    analyser.getFloatTimeDomainData(buf);
    const [pitch, clarity] = detector.findPitch(buf, ctx.sampleRate);

    if (clarity >= CLARITY_THRESHOLD && pitch >= MIN_FREQ && pitch <= MAX_FREQ) {
      const { name, octave, cents } = freqToNote(pitch);
      setDetection({ freq: pitch, note: name, octave, cents });
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    setStatus('requesting');
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize);
      bufferRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));

      setStatus('listening');
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setStatus('denied');
        setErrorMessage('Microphone access denied');
      } else {
        setStatus('error');
        setErrorMessage(e.message || 'Failed to start tuner');
      }
      stop();
    }
  }, [tick, stop]);

  useEffect(() => {
    if (show && status === 'idle') {
      void start();
    } else if (!show && status !== 'idle') {
      stop();
    }
  }, [show, status, start, stop]);

  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  if (!show) return null;

  const preset = TUNING_PRESETS.find((p) => p.id === presetId) ?? TUNING_PRESETS[0];
  const presetMatch = mode === 'preset' && detection
    ? nearestString(detection.freq, preset.strings)
    : null;

  const displayCents = mode === 'preset' && presetMatch ? presetMatch.cents : detection?.cents ?? 0;
  const inTune = detection !== null && Math.abs(displayCents) <= 5;

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-3 sm:px-4 py-3">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
        {/* Mode toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode('chromatic')}
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              mode === 'chromatic' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Chromatic
          </button>
          <button
            onClick={() => setMode('preset')}
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              mode === 'preset' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Preset
          </button>
        </div>

        {/* Preset selector */}
        {mode === 'preset' && (
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
          >
            {TUNING_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        )}

        {/* Per-string targets */}
        {mode === 'preset' && (
          <div className="flex gap-1.5">
            {preset.strings.map((str: TuningString, i: number) => {
              const isActive = presetMatch?.index === i;
              const isInTune = isActive && Math.abs(presetMatch!.cents) <= 5;
              return (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    isInTune
                      ? 'bg-green-500 text-white scale-110'
                      : isActive
                      ? 'bg-blue-500 text-white scale-110'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                  title={`${str.name}${str.octave} — ${str.freq.toFixed(2)} Hz`}
                >
                  {str.name}
                </div>
              );
            })}
          </div>
        )}

        {/* Note display + cents meter */}
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold w-16 text-center ${inTune ? 'text-green-400' : 'text-white'}`}>
            {detection ? `${detection.note}${detection.octave}` : '—'}
          </div>
          <div className="relative w-40 h-6 bg-gray-700 rounded">
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-500" />
            <div
              className={`absolute top-0 bottom-0 w-1 rounded ${inTune ? 'bg-green-400' : 'bg-yellow-400'}`}
              style={{
                left: detection
                  ? `${Math.max(0, Math.min(100, 50 + displayCents))}%`
                  : '50%',
                transform: 'translateX(-50%)',
                transition: 'left 80ms linear',
              }}
            />
          </div>
          <div className="text-xs text-gray-400 w-20">
            {detection ? `${displayCents > 0 ? '+' : ''}${displayCents}¢` : ''}
            <div>{detection ? `${detection.freq.toFixed(1)} Hz` : ''}</div>
          </div>
        </div>

        {/* Mic status */}
        <div className="flex items-center gap-2 text-xs">
          {status === 'listening' && (
            <>
              <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              <span className="text-gray-400">Listening</span>
            </>
          )}
          {status === 'requesting' && <span className="text-gray-400">Requesting mic…</span>}
          {(status === 'denied' || status === 'error' || status === 'idle') && (
            <button
              onClick={() => void start()}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs"
            >
              Enable mic
            </button>
          )}
          {errorMessage && status !== 'listening' && (
            <span className="text-red-400">{errorMessage}</span>
          )}
        </div>
      </div>
    </div>
  );
}
