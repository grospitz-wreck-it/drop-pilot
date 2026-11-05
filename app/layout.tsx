import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'DropPilot', description:'Dein persönlicher Ticket- und Drop-Assistent.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang='de'><body>{children}</body></html>; }
