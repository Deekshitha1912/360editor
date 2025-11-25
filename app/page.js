"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function LandingPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex flex-col">
            {/* Navbar */}
            <nav className="w-full flex items-center justify-between px-6 py-4 border-b">
                <h1 className="text-2xl font-bold">MyLogo</h1>

                <Button onClick={() => router.push("/login")}>Login</Button>
            </nav>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <h2 className="text-4xl md:text-5xl font-bold mb-4">
                    Welcome to Our Platform
                </h2>

                <p className="max-w-xl text-lg text-gray-600 mb-8">
                    This is a small summary about what your product or service does.
                    You can expand this later — for now this is just placeholder text.
                </p>

                <Button size="lg" onClick={() => router.push("/login")}>
                    Get Started
                </Button>
            </main>

            {/* Footer (optional) */}
            <footer className="py-4 text-center text-sm text-gray-500">
                © {new Date().getFullYear()} MyCompany. All rights reserved.
            </footer>
        </div>
    );
}
