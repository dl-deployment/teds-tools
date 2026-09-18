import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "Ted's Hub",
  description: "Personal dashboard for tools, notes and links.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden bg-bg text-text font-sans">
        <Sidebar />
        <main className="flex-1 min-w-0 flex">{children}</main>
      </body>
    </html>
  );
}
