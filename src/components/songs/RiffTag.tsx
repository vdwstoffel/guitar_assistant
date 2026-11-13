/** The badge on a riff: has it been tabbed out yet? */
export default function RiffTag({ tabbed }: { tabbed: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${tabbed ? "bg-emerald-900 text-emerald-300" : "bg-gray-700 text-gray-300"}`}
    >
      {tabbed ? "tabbed" : "recording only"}
    </span>
  );
}
