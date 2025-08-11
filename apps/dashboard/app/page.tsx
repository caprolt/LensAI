export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          LensAI Dashboard
        </h1>
        <p className="text-center text-lg text-gray-600">
          Budget control and real-time cost/latency visibility for LLM usage
        </p>
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            API Status: <span className="text-green-500">Connected</span>
          </p>
        </div>
      </div>
    </main>
  );
}
