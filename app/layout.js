import "./globals.css";

export const metadata = {
  title: "Legions.dev Replica",
  description: "Next.js 16 + Three.js mirror of legions.dev"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
