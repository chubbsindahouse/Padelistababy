import { BottomNav } from "@/components/nav/bottom-nav";
import { ChatBot } from "@/components/chat/chat-bot";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#05050A] relative">
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-radial-glow-cyan opacity-60" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-radial-glow-blue opacity-40" />
      </div>

      <main className="relative z-10 pb-28 max-w-lg mx-auto">
        {children}
      </main>

      <BottomNav />
      <ChatBot />
    </div>
  );
}
