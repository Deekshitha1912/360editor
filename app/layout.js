import "./globals.css";

export const metadata = {
  title: "360Editor",
  description: "Build and export interactive 360 degree virtual tours.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
