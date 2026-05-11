import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'My Reading List',
  description: 'Track your reading journey',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
        {/* Apply theme before paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var s = localStorage.getItem('theme');
            var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', s ? s : (d ? 'dark' : 'light'));
          })();
        `}} />
      </head>
      <body>{children}</body>
    </html>
  )
}
