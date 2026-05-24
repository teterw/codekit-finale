export default function ChannelsPage() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3"
      style={{ color: 'var(--dc-text-muted)' }}
    >
      <div style={{ fontSize: 64 }}>👾</div>
      <h2 className="text-xl font-semibold" style={{ color: 'var(--dc-text)' }}>
        No channel selected
      </h2>
      <p className="text-sm">Select a server and channel from the left to start chatting.</p>
    </div>
  );
}
