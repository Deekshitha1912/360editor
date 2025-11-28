import Link from "next/link";
import DashboardNavbar from "@/components/layout/navbar";

export default function Dashboard() {
    return (
        <div className="w-full min-h-screen">
            <DashboardNavbar />

            <div className="w-full flex flex-col items-center py-16 px-4 space-y-16">

                {/* Start 360 Editor button */}
                <Link
                    href="/360editor"
                    className="px-8 py-4 bg-black text-white rounded-lg text-xl font-medium hover:opacity-90 transition"
                >
                    Start 360 Editor
                </Link>

                {/* Placeholder for more dashboard content */}
                <div className="text-gray-500 text-lg">
                    {/* Add pricing, stats, components here */}
                    Coming soon...
                </div>

            </div>
        </div>
    );
}
