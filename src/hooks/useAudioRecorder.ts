"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "requesting" | "recording" | "stopping" | "error";

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

interface UseAudioRecorderResult {
  status: RecorderStatus;
  error: string | null;
  devices: AudioInputDevice[];
  selectedDeviceId: string | null;
  setSelectedDeviceId: (id: string) => void;
  refreshDevices: () => Promise<void>;
  requestPermission: () => Promise<void>;
  permissionGranted: boolean;
  durationMs: number;
  level: number;
  start: () => Promise<void>;
  stop: () => Promise<{ blob: Blob; mimeType: string; duration: number } | null>;
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
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
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
  const resolveStopRef = useRef<((value: { blob: Blob; mimeType: string; duration: number } | null) => void) | null>(null);

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setError("This browser does not support media devices. A secure (HTTPS) origin is required.");
      return;
    }
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
        }));
      setDevices(inputs);
      const hasRealLabels = inputs.some((d) => d.label && !d.label.startsWith("Microphone "));
      if (hasRealLabels) setPermissionGranted(true);
      setSelectedDeviceId((current) => {
        if (current && inputs.some((d) => d.deviceId === current)) return current;
        return inputs[0]?.deviceId ?? null;
      });
    } catch (err) {
      console.error("enumerateDevices failed:", err);
      setError(err instanceof Error ? err.message : "Could not list audio devices");
    }
  }, []);

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
      await refreshDevices();
    } catch (err) {
      console.error("Microphone permission denied:", err);
      setError(err instanceof Error ? err.message : "Microphone permission denied");
    }
  }, [refreshDevices]);

  useEffect(() => {
    refreshDevices();
    const handler = () => {
      refreshDevices();
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
    };
  }, [refreshDevices]);

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
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  const start = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined") {
      setError("MediaRecorder is not supported in this browser.");
      setStatus("error");
      return;
    }
    setStatus("requesting");
    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        sampleRate: 48000,
        sampleSize: 16,
      };
      if (selectedDeviceId) audioConstraints.deviceId = { exact: selectedDeviceId };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = stream;

      // After first permission grant, labels become available; refresh list.
      refreshDevices();

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
        cleanupStream();
        setStatus("idle");
        setDurationMs(0);
        resolveStopRef.current?.({ blob, mimeType: finalType, duration });
        resolveStopRef.current = null;
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
      console.error("Failed to start recording:", err);
      const msg = err instanceof Error ? err.message : "Could not start recording";
      setError(msg);
      setStatus("error");
      cleanupStream();
    }
  }, [selectedDeviceId, refreshDevices, cleanupStream]);

  const stop = useCallback(() => {
    return new Promise<{ blob: Blob; mimeType: string; duration: number } | null>((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
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
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    refreshDevices,
    requestPermission,
    permissionGranted,
    durationMs,
    level,
    start,
    stop,
  };
}
