import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Smallholding",
  description: "A small farm against four seasons and a fickle market.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: "#1a1a2e",
          color: "#eee",
          fontFamily: "system-ui, -apple-system, sans-serif",
          overflow: "hidden",
          height: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
