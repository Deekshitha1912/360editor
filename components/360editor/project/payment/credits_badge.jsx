import { Coins } from "lucide-react";

/**
 * Presentational. Pass the credits object from getCredits():
 *   <Credits_badge credits={credits} />
 *
 * Render it in your dashboard header/topbar.
 */
export default function Credits_badge({ credits }) {
  const available = credits?.available_credits ?? 0;
  const total = credits?.total_credits ?? 0;
  const used = credits?.used_credits ?? 0;

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm shadow-sm">
      <Coins className="h-4 w-4 text-indigo-600" />
      <span className="font-semibold text-gray-900">
        {available} credit{available === 1 ? "" : "s"} left
      </span>
      <span className="text-gray-400">·</span>
      <span className="text-gray-500">
        {used}/{total} used
      </span>
    </div>
  );
}
