export default function Home() {
  return (
    <section className="flex flex-col items-center justify-center text-center gap-8 py-16">
      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">
        Welcome to <span className="text-blue-600">KillReport</span>
      </h1>
      <p className="text-lg text-gray-600 max-w-2xl mb-6">
        KillReport is your modern platform for tracking, reporting, and
        analyzing key metrics with ease. Start by exploring our features and see
        how we can help you get insights faster.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <a
          href="#"
          className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold shadow hover:bg-blue-700 transition"
        >
          Get Started
        </a>
        <a
          href="#"
          className="inline-block rounded-lg border border-blue-600 px-6 py-3 text-blue-600 font-semibold hover:bg-blue-50 transition"
        >
          Learn More
        </a>
      </div>
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 w-full max-w-4xl">
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="mb-2 text-blue-600 text-3xl">📊</span>
          <h2 className="font-semibold text-lg mb-1">Analytics</h2>
          <p className="text-gray-500 text-sm">
            Powerful analytics to help you make data-driven decisions.
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="mb-2 text-blue-600 text-3xl">⚡</span>
          <h2 className="font-semibold text-lg mb-1">Fast Reporting</h2>
          <p className="text-gray-500 text-sm">
            Generate and share reports in seconds with our intuitive tools.
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="mb-2 text-blue-600 text-3xl">🔒</span>
          <h2 className="font-semibold text-lg mb-1">Secure</h2>
          <p className="text-gray-500 text-sm">
            Your data is protected with industry-leading security practices.
          </p>
        </div>
      </div>
    </section>
  );
}
