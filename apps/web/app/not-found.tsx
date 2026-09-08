import Link from "next/link";
export default function NotFound() {
  return (
    <main className="content">
      <p className="eyebrow">404</p>
      <h1>We couldn’t find that page.</h1>
      <Link className="btn" href="/">
        Back to MessMate
      </Link>
    </main>
  );
}
