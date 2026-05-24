export default function ServerPage() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3"
      style={{ color: 'var(--dc-text-muted)' }}
    >
      <div style={{ fontSize: 64 }}>💬</div>
      <h2 className="text-xl font-semibold" style={{ color: 'var(--dc-text)' }}>
        Pick a channel
      </h2>
      <p className="text-sm">Select a channel from the list on the left.</p>
    </div>
  );
}
