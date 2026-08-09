"use client";
import { useRef, useState } from "react";
import PdfViewer from "./PdfViewer";
import type { JamTrackPdf } from "@/types";

export interface JamTrackPdfPanelProps {
  jamTrackId: string;
  pdfs: JamTrackPdf[];
  activePdfId: string | null;
  onActivePdfChange: (pdfId: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  onUploaded: () => void;          // refetch jam track after upload
  onRenamed: () => void;
  onDeleted: () => void;
}

export default function JamTrackPdfPanel({
  jamTrackId, pdfs, activePdfId, onActivePdfChange,
  currentPage, onPageChange, onUploaded, onRenamed, onDeleted,
}: JamTrackPdfPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const pdfList = pdfs ?? [];
  const active = pdfList.find((p) => p.id === activePdfId) ?? pdfList[0] ?? null;

  async function upload() {
    if (!pendingFile) return;
    const fd = new FormData();
    fd.append("file", pendingFile);
    fd.append("name", name.trim() || pendingFile.name.replace(/\.pdf$/i, ""));
    await fetch(`/api/jamtracks/${jamTrackId}/pdf`, { method: "POST", body: fd });
    setPendingFile(null); setName("");
    onUploaded();
  }
  async function rename(pdf: JamTrackPdf, newName: string) {
    await fetch(`/api/jamtracks/${jamTrackId}/pdf/${pdf.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    onRenamed();
  }
  async function remove(pdf: JamTrackPdf) {
    await fetch(`/api/jamtracks/${jamTrackId}/pdf/${pdf.id}`, { method: "DELETE" });
    onDeleted();
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 border-b border-gray-700 px-2 py-1 overflow-x-auto">
        {pdfList.map((p) => (
          <button key={p.id}
            onClick={() => onActivePdfChange(p.id)}
            onDoubleClick={() => { const n = prompt("Rename PDF", p.name); if (n) rename(p, n); }}
            className={`px-3 py-1 rounded text-sm whitespace-nowrap ${p.id === active?.id ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300"}`}>
            {p.name}
          </button>
        ))}
        <button onClick={() => fileRef.current?.click()} className="px-3 py-1 rounded text-sm bg-gray-800 text-gray-300 border border-gray-600">＋ Add PDF</button>
        {active && <button onClick={() => { if (confirm(`Delete "${active.name}"?`)) remove(active); }} className="ml-auto px-2 py-1 text-xs text-red-400">Delete</button>}
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); setName(f.name.replace(/\.pdf$/i, "")); } e.target.value = ""; }} />
      </div>

      {pendingFile && (
        <div className="flex items-center gap-2 px-2 py-2 border-b border-gray-700 bg-gray-800">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="PDF name…"
            className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white" autoFocus />
          <button onClick={upload} className="px-3 py-1 bg-green-600 rounded text-sm text-white">Upload</button>
          <button onClick={() => setPendingFile(null)} className="px-3 py-1 bg-gray-700 rounded text-sm text-gray-300">Cancel</button>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {active ? (
          <PdfViewer pdfPath={active.filePath} currentPage={currentPage} onPageChange={onPageChange} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">No PDF attached — add one with ＋ Add PDF.</div>
        )}
      </div>
    </div>
  );
}
