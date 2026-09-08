import Link from "next/link";
import {
  ArrowUpRight,
  Fingerprint,
  Utensils,
  Scale,
  BarChart3,
  ShieldCheck,
  Leaf,
  ArrowRight,
  CalendarCheck,
  Database,
  Smartphone,
} from "lucide-react";
import { Logo } from "../components/ui";
export default function Home() {
  return (
    <>
      <nav className="public-nav">
        <Link href="/" aria-label="MessMate home">
          <Logo />
        </Link>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#impact">Why MessMate</a>
          <Link href="/login" className="btn secondary">
            Sign in <ArrowUpRight size={15} />
          </Link>
        </div>
      </nav>
      <main>
        <section className="hero">
          <div>
            <span className="eyebrow">
              Thoughtful dining. Connected campus.
            </span>
            <h1 className="serif">
              Every meal
              <br />
              counts.
              <br />
              <em>Make it matter.</em>
            </h1>
            <p>
              Smart Attendance. Smarter Cooking. Less Waste. Give your mess team
              the information to prepare with confidence, one meal at a time.
            </p>
            <div className="row" style={{ marginTop: 28 }}>
              <Link href="/login" className="btn">
                Student login <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="btn secondary">
                Administrator login
              </Link>
            </div>
            <div className="row muted" style={{ marginTop: 28, fontSize: 11 }}>
              <ShieldCheck size={15} /> One connected system for your campus
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Meal planning, attendance and food waste are connected"
          >
            <div
              className="eyebrow"
              style={{ marginBottom: 27, position: "relative" }}
            >
              A better meal starts with a plan
            </div>
            {[
              [
                CalendarCheck,
                "01",
                "Plan the meal",
                "Students share their plans.",
              ],
              [
                Fingerprint,
                "02",
                "Know who arrived",
                "Fingerprint check-ins verify attendance.",
              ],
              [
                Scale,
                "03",
                "Measure what remains",
                "The waste station closes the loop.",
              ],
            ].map(([Icon, n, title, body]) => {
              const C = Icon as typeof Scale;
              return (
                <div className="flow-tile" key={String(n)}>
                  <span className="number">{String(n)}</span>
                  <div>
                    <strong>{String(title)}</strong>
                    <small>{String(body)}</small>
                  </div>
                  <C size={23} style={{ marginLeft: "auto", flexShrink: 0 }} />
                </div>
              );
            })}
            <div
              className="row"
              style={{
                position: "relative",
                marginTop: 28,
                fontSize: 11,
                color: "#57704d",
              }}
            >
              <Leaf size={15} /> Better information. More considered cooking.
            </div>
          </div>
        </section>
        <section className="dark-section" id="how-it-works">
          <div className="public-section">
            <span className="eyebrow" style={{ color: "#b9cd9d" }}>
              From intention to insight
            </span>
            <h2 className="serif" style={{ marginTop: 15 }}>
              A single picture of every meal.
            </h2>
            <p className="muted">
              Connect your student portal, dining hall and kitchen with one
              shared backend.
            </p>
            <div className="feature-grid">
              {[
                [
                  Utensils,
                  "Plan with your students",
                  "Students respond before the meal cutoff on the web or mobile app.",
                ],
                [
                  Fingerprint,
                  "Capture actual attendance",
                  "Your ESP32 and fingerprint sensor record one check-in per student, per meal.",
                ],
                [
                  BarChart3,
                  "Turn measurement into action",
                  "Compare expected attendance, actual arrivals and measured food waste.",
                ],
              ].map(([Icon, title, body]) => {
                const C = Icon as typeof Scale;
                return (
                  <article className="feature" key={String(title)}>
                    <C size={26} style={{ color: "#d8e9b8" }} />
                    <h3>{String(title)}</h3>
                    <p style={{ color: "#b7cbb5" }}>{String(body)}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
        <section className="public-section" id="impact">
          <div className="between">
            <div>
              <span className="eyebrow">Built for the whole campus</span>
              <h2 className="serif" style={{ marginTop: 14 }}>
                Less guesswork.
                <br />
                More informed decisions.
              </h2>
            </div>
            <p className="muted" style={{ maxWidth: 410 }}>
              Transparent calculations, measured outcomes and a prediction
              architecture ready for your historical data. Estimates stay
              clearly labelled.
            </p>
          </div>
          <div className="feature-grid">
            {[
              [
                Scale,
                "Waste you can measure",
                "Load-cell readings feed directly into waste trends and meal reports.",
              ],
              [
                Leaf,
                "Impact with context",
                "Configure cost and environmental assumptions to estimate avoided waste and savings.",
              ],
              [
                Database,
                "Ready to learn",
                "Import historical attendance. Start with labelled baseline predictions, then integrate a trained model.",
              ],
              [
                Smartphone,
                "One account, every screen",
                "Student preferences and attendance stay consistent across web and Expo mobile.",
              ],
              [
                ShieldCheck,
                "Clear responsibilities",
                "Student, mess manager and administrator permissions are enforced in the API.",
              ],
              [
                BarChart3,
                "Reports you can use",
                "Explore trends, export CSV files and print a report for your next review.",
              ],
            ].map(([Icon, title, body]) => {
              const C = Icon as typeof Scale;
              return (
                <article className="feature" key={String(title)}>
                  <C size={25} />
                  <h3>{String(title)}</h3>
                  <p>{String(body)}</p>
                </article>
              );
            })}
          </div>
          <div
            className="card between"
            style={{ background: "#e5ecd8", marginTop: 15 }}
          >
            <div>
              <h3 style={{ marginBottom: 5 }}>Designed to work together.</h3>
              <span className="muted">
                Next.js web · Expo mobile · Node.js REST API · PostgreSQL ·
                ESP32
              </span>
            </div>
            <Link href="/login" className="btn">
              Open MessMate <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <span>MessMate · Smart campus dining</span>
        <span>Plan thoughtfully. Waste less.</span>
      </footer>
    </>
  );
}
