export default function AppSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#313338]">
      {/* Server rail */}
      <div className="hidden w-[72px] flex-shrink-0 flex-col items-center gap-3 bg-[#1e1f22] py-3 md:flex">
        <div className="h-12 w-12 rounded-[30%] bg-[#5865f2]/40 animate-pulse" />
        <div className="h-px w-8 bg-[#35363c]" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 w-12 rounded-full bg-[#36393f] animate-pulse" />
        ))}
      </div>

      {/* Channel/conversation sidebar */}
      <div className="hidden w-60 flex-shrink-0 flex-col bg-[#2b2d31] md:flex">
        <div className="h-12 border-b border-black/30 px-4 py-3">
          <div className="h-5 w-32 rounded bg-[#1e1f22] animate-pulse" />
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 flex-shrink-0 rounded-full bg-[#3a3c41] animate-pulse" />
              <div className="h-3 flex-1 rounded bg-[#3a3c41] animate-pulse" style={{ maxWidth: `${60 + ((i * 13) % 35)}%` }} />
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center gap-3 border-b border-black/30 px-4">
          <div className="h-5 w-40 rounded bg-[#2b2d31] animate-pulse" />
        </div>
        <div className="flex-1 space-y-5 p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-10 w-10 flex-shrink-0 rounded-full bg-[#2b2d31] animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-[#2b2d31] animate-pulse" />
                <div className="h-3 rounded bg-[#2b2d31] animate-pulse" style={{ maxWidth: `${50 + ((i * 17) % 45)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
