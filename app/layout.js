import "./globals.css";

export const metadata = {
  title: "Aura Skincare | AI Voice Support",
  description:
    "Talk to Aria, your personal AI skincare assistant from Aura Skincare. Get help with orders, products, and more.",
  keywords: "Aura Skincare, AI voice agent, customer support, skincare",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
