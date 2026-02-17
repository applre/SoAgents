export default function App() {
  return (
    <div className="flex h-screen flex-col bg-[var(--paper)]">
      {/* Phase 1: Hello World 验证 */}
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[var(--ink)]">
            SoAgents
          </h1>
          <p className="mt-3 text-lg text-[var(--ink-secondary)]">
            Desktop Claude Agent Client
          </p>
          <div className="mt-6 inline-block rounded-lg bg-[var(--accent-warm)] px-6 py-2 text-white">
            Phase 1 Complete
          </div>
        </div>
      </div>
    </div>
  );
}
