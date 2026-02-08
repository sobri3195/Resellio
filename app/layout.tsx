import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Resellio - Dashboard Importir UMKM',
  description: 'Tool importir/reseller untuk grab produk marketplace, hitung pricing, generate caption AI, schedule Instagram, dan kelola content calendar.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
