import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '레소라 · RTC 검증실', description: 'Zoom Video SDK / LiveKit Cloud 비교 PoC' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
