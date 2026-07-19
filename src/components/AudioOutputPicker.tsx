"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface AudioOutputPickerProps {
  deviceId: string;
  onChange: (deviceId: string) => void;
}

const DEFAULT_DEVICE_ID = "default";
const COMMUNICATIONS_DEVICE_ID = "communications";
const AUTO_SPARK_ID = "auto-spark";
const SPARK_LABEL_RE = /spark\s*2/i;

function detectSupport(): boolean {
  if (typeof document === "undefined") return true;
  if (!navigator.mediaDevices?.enumerateDevices) return false;
  const probe = document.createElement("audio");
  return typeof probe.setSinkId === "function";
}

export default function AudioOutputPicker({ deviceId, onChange }: AudioOutputPickerProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [labelsHidden, setLabelsHidden] = useState(false);
  const [supported] = useState(detectSupport);
  const [refreshTick, setRefreshTick] = useState(0);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => {
        if (cancelled) return;
        const outputs = all.filter((d) => d.kind === "audiooutput");
        setDevices(outputs);
        setLabelsHidden(outputs.some((d) => !d.label) || outputs.length < 2);
      })
      .catch((err) => console.warn("enumerateDevices failed", err));
    const onChangeEvent = () => setRefreshTick((n) => n + 1);
    navigator.mediaDevices.addEventListener("devicechange", onChangeEvent);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener("devicechange", onChangeEvent);
    };
  }, [supported, refreshTick]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (buttonRef.current) setButtonRect(buttonRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setRefreshTick((n) => n + 1);
    } catch (err) {
      console.error("Microphone permission denied — device labels stay hidden", err);
    }
  };

  if (!supported) return null;

  const sparkDevice = devices.find(
    (d) => SPARK_LABEL_RE.test(d.label) && d.deviceId !== COMMUNICATIONS_DEVICE_ID,
  );

  let selectedLabel: string;
  if (deviceId === AUTO_SPARK_ID) {
    selectedLabel = sparkDevice
      ? `Auto → ${sparkDevice.label}`
      : "Auto (Spark 2 not detected — using system default)";
  } else if (deviceId === DEFAULT_DEVICE_ID) {
    selectedLabel = "System default";
  } else {
    selectedLabel = devices.find((d) => d.deviceId === deviceId)?.label || "Default";
  }

  const visibleDevices = devices.filter(
    (d) =>
      d.deviceId &&
      d.deviceId !== DEFAULT_DEVICE_ID &&
      d.deviceId !== COMMUNICATIONS_DEVICE_ID,
  );

  const dropdown =
    open && buttonRect && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            style={{
              position: "fixed",
              bottom: window.innerHeight - buttonRect.top + 8,
              right: Math.max(8, window.innerWidth - buttonRect.right),
              zIndex: 100,
            }}
            className="min-w-55 max-w-80 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 text-sm max-h-[70vh] overflow-y-auto"
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-700">
              Audio output
            </div>

            <button
              role="option"
              aria-selected={deviceId === AUTO_SPARK_ID}
              onClick={() => {
                onChange(AUTO_SPARK_ID);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-700 ${
                deviceId === AUTO_SPARK_ID ? "text-green-400" : "text-gray-200"
              }`}
              title={
                sparkDevice
                  ? `Currently routing to: ${sparkDevice.label}`
                  : "Spark 2 not detected — falls back to system default"
              }
            >
              <span className="w-3 inline-block">{deviceId === AUTO_SPARK_ID ? "✓" : ""}</span>
              <span className="flex-1 truncate">
                Auto{sparkDevice ? " → Spark 2" : " (Spark 2 not detected)"}
              </span>
            </button>

            <button
              role="option"
              aria-selected={deviceId === DEFAULT_DEVICE_ID}
              onClick={() => {
                onChange(DEFAULT_DEVICE_ID);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-700 ${
                deviceId === DEFAULT_DEVICE_ID ? "text-green-400" : "text-gray-200"
              }`}
            >
              <span className="w-3 inline-block">{deviceId === DEFAULT_DEVICE_ID ? "✓" : ""}</span>
              System default
            </button>

            {visibleDevices.map((d) => (
              <button
                key={d.deviceId}
                role="option"
                aria-selected={d.deviceId === deviceId}
                onClick={() => {
                  onChange(d.deviceId);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-700 ${
                  d.deviceId === deviceId ? "text-green-400" : "text-gray-200"
                }`}
              >
                <span className="w-3 inline-block">{d.deviceId === deviceId ? "✓" : ""}</span>
                <span className="truncate">{d.label || "Unnamed device"}</span>
              </button>
            ))}

            <div className="border-t border-gray-700 mt-1 pt-1 px-3 pb-2">
              <p className="text-[11px] text-gray-400 mb-1.5">
                {labelsHidden
                  ? "Devices may be hidden. Grant microphone permission once to reveal the full list."
                  : "Missing a device? Grant mic permission to force Chrome to expose all outputs."}
              </p>
              <button
                onClick={requestPermission}
                className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
              >
                Enable full device list
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => {
          setOpen((v) => !v);
          setRefreshTick((n) => n + 1);
        }}
        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        title={`Audio output: ${selectedLabel}`}
        aria-label="Choose audio output device"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 10-14 0v3a2 2 0 002 2h1v-5H5m14 0v3a2 2 0 01-2 2h-1v-5h3z"
          />
        </svg>
      </button>
      {dropdown}
    </>
  );
}
