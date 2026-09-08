"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="content">
      <h1>Something went wrong.</h1>
      <p>Please retry. If the problem continues, contact your administrator.</p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
