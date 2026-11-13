"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withInputDevice } from "@/lib/audioSink";

export type RecorderStatus = "idle" | "requesting" | "recording" | "stopping" | "error";

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  duration: number;
}

interface UseAudioRecorderResult {
  status: RecorderStatus;
  error: string | null;
  requestPermission: () => Promise<void>;
  permissionGranted: boolean;
  durationMs: number;
  level: number;
  start: () => Promise<void>;
  /**
   * Stop and hand back what was recorded. When the recorder stopped by itself
   * (the input went away), nobody asked for its result, so it is kept: the
   * next `stop()` hands it back (a new `start()` drops it).
   */
  stop: () => Promise<RecordingResult | null>;
}

function pickSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
  ];
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return "";
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [level, setLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animRef = useRef<number | null>(null);
  const resolveStopRef = useRef<((value: RecordingResult | null) => void) | null>(null);
  /** What the recorder made when it stopped with nobody asking (stop() hands it back). */
  const keptRef = useRef<RecordingResult | null>(null);
  // A start only takes the mic if it is still the newest one and the owner is
  // still mounted when getUserMedia answers; otherwise it closes it again.
  const mountedRef = useRef(true);
  const startGenRef = useRef(0);

  const requestPermission = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access requires a secure (HTTPS) origin.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissionGranted(true);
    } catch (err) {
      console.error("Microphone permission denied:", err);
      setError(err instanceof Error ? err.message : "Microphone permission denied");
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (animRef.current !== null) {
      window.cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {}
      sourceNodeRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {}
      analyserRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setLevel(0);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // A start still waiting for the mic closes it when it comes.
      startGenRef.current += 1;
      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== "inactive") {
          try {
            recorder.stop();
          } catch {}
        }
      }
      resolveStopRef.current?.(null);
      resolveStopRef.current = null;
      keptRef.current = null;
      cleanupStream();
    };
  }, [cleanupStream]);

  const start = useCallback(async () => {
    const gen = ++startGenRef.current;
    /** Unmounted, or a newer start began: this one must not take the mic. */
    const abandoned = () => !mountedRef.current || gen !== startGenRef.current;
    setError(null);
    keptRef.current = null;
    if (typeof MediaRecorder === "undefined") {
      setError("MediaRecorder is not supported in this browser.");
      setStatus("error");
      return;
    }
    setStatus("requesting");
    let stream: MediaStream | null = null;
    try {
      const audioConstraints = await withInputDevice({
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        sampleRate: 48000,
        sampleSize: 16,
      });
      if (abandoned()) return;
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      if (abandoned()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      // A recorder still running (never expected: Record is busy until it
      // stops) is let go first, with its stream, so no mic stays open unowned.
      const previous = mediaRecorderRef.current;
      if (previous && previous.state !== "inactive") {
        previous.ondataavailable = null;
        previous.onstop = null;
        previous.onerror = null;
        try {
          previous.stop();
        } catch {}
        resolveStopRef.current?.(null);
        resolveStopRef.current = null;
        cleanupStream();
      }
      streamRef.current = stream;

      const mimeType = pickSupportedMimeType();
      const recorderOptions: MediaRecorderOptions = { audioBitsPerSecond: 256000 };
      if (mimeType) recorderOptions.mimeType = mimeType;
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalType });
        const duration = (Date.now() - startTimeRef.current) / 1000;
        const result = { blob, mimeType: finalType, duration };
        cleanupStream();
        setStatus("idle");
        setDurationMs(0);
        const resolve = resolveStopRef.current;
        resolveStopRef.current = null;
        // Stopped by itself (the input unplugged, say): keep it for the next stop().
        if (resolve) resolve(result);
        else keptRef.current = result;
      };
      recorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        setError("Recorder error");
        setStatus("error");
        cleanupStream();
        resolveStopRef.current?.(null);
        resolveStopRef.current = null;
      };

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const norm = (data[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        setLevel(Math.min(1, rms * 2));
        animRef.current = window.requestAnimationFrame(tick);
      };
      animRef.current = window.requestAnimationFrame(tick);

      startTimeRef.current = Date.now();
      recorder.start(250);
      tickRef.current = window.setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 200);
      setStatus("recording");
    } catch (err) {
      if (abandoned()) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      console.error("Failed to start recording:", err);
      const msg = err instanceof Error ? err.message : "Could not start recording";
      setError(msg);
      setStatus("error");
      cleanupStream();
    }
  }, [cleanupStream]);

  const stop = useCallback(() => {
    return new Promise<RecordingResult | null>((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        // It stopped by itself: what it recorded is waiting.
        resolve(keptRef.current);
        keptRef.current = null;
        return;
      }
      resolveStopRef.current = resolve;
      setStatus("stopping");
      recorder.stop();
    });
  }, []);

  return {
    status,
    error,
    requestPermission,
    permissionGranted,
    durationMs,
    level,
    start,
    stop,
  };
}
