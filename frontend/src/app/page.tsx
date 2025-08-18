export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-center text-4xl font-bold lg:text-left">Meme Coin Analyzer</h1>
      </div>

      <div className="before:bg-gradient-radial after:bg-gradient-conic relative z-[-1] flex place-items-center before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:translate-y-1/4 before:rounded-full before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40 before:lg:h-[360px]">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-semibold">Comprehensive Web3 Meme Coin Analysis</h2>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Real-time price tracking, risk assessment, social sentiment analysis, and portfolio
            management for meme coins across multiple blockchain networks.
          </p>
        </div>
      </div>

      <div className="mb-32 mt-16 grid text-center lg:mb-0 lg:w-full lg:max-w-5xl lg:grid-cols-4 lg:text-left">
        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h3 className="mb-3 text-2xl font-semibold">
            Real-time Data{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              →
            </span>
          </h3>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Live price updates, market metrics, and trading volume across multiple DEXs.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h3 className="mb-3 text-2xl font-semibold">
            Risk Analysis{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              →
            </span>
          </h3>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Advanced risk scoring based on liquidity, holder distribution, and contract security.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h3 className="mb-3 text-2xl font-semibold">
            Social Sentiment{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              →
            </span>
          </h3>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Track community sentiment across Twitter, Reddit, and Telegram.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h3 className="mb-3 text-2xl font-semibold">
            Portfolio Tracking{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              →
            </span>
          </h3>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Automated portfolio detection and performance analytics with Web3 integration.
          </p>
        </div>
      </div>
    </main>
  );
}
