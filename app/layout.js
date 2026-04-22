import "./globals.css";
import { Toaster } from "sonner";

export const metadata = {
    title: "360Editor",
    description: "Panorama project studio",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
        <head>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum/build/pannellum.css"/>
            <script src="https://cdn.jsdelivr.net/npm/pannellum/build/pannellum.js" defer></script>
        </head>
        <body className="antialiased">
        {children}
        <Toaster position="top-right" richColors />
        </body>
        </html>
    );
}
