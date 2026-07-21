import { Coins } from "lucide-react";

/**
 * Credits pill for the dashboard nav. Matches the 360Editor theme
 * (indigo #3730a3 on cream). Pass the object from getCredits():
 *   <Credits_badge credits={credits} />
 */
export default function Credits_badge({ credits }) {
    const available = credits?.available_credits ?? 0;
    const total = credits?.total_credits ?? 0;
    const used = credits?.used_credits ?? 0;
    const low = available < 1;

    return (
        <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-medium ${
                low
                    ? "border-red-200 bg-red-50 text-red-600"
                    : "border-[#E2E2DA] bg-white text-[#1a1a18]"
            }`}
            title={`${used} of ${total} credits used`}
        >
            <Coins className={`h-3.5 w-3.5 ${low ? "text-red-500" : "text-[#3730a3]"}`} />
            <span className="font-semibold">
        {available} credit{available === 1 ? "" : "s"}
      </span>
            <span className={low ? "text-red-400" : "text-[#9a9ab2]"}>·</span>
            <span className={low ? "text-red-400" : "text-[#6b6b60]"}>
        {used}/{total} used
      </span>
        </div>
    );
}