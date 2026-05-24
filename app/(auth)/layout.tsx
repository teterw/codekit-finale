export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: '#313338',
        backgroundImage:
          'radial-gradient(ellipse at 60% 0%, rgba(88,101,242,0.15) 0%, transparent 60%), ' +
          'radial-gradient(ellipse at 10% 80%, rgba(235,69,158,0.08) 0%, transparent 50%)',
      }}
    >
      {children}
    </div>
  );
}
