export default function Home() {
  return (
    <section className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
      <div className="max-w-2xl">
        <h1 className="font-bold text-5xl">Pg Bossman Dashboard Only</h1>
        <p className="mt-4 text-lg">
          Check out the dashboard at{" "}
          <a className="text-blue-500" href="/admin/dashboard">
            /admin/dashboard
          </a>
          . This repo contains only the dashboard, assuming you have your own
          existing pg-boss setup.
        </p>
      </div>
    </section>
  );
}
