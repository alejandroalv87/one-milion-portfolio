import "./globals.css";

export const metadata = {
  title: "Portfolio Terminal",
  description: "Private portfolio terminal with email 2FA and live market data.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
