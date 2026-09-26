"use client";

import { useEffect, useState } from "react";

export default function SupportPage() {
  const [count, setCount] = useState<number | string>("—");
  const [sub, setSub] = useState("loading live count…");

  useEffect(() => {
    async function loadCounter() {
      try {
        const res = await fetch("/api/public-count");
        if (!res.ok) throw new Error("bad response");
        const data = await res.json();
        const c = data.count ?? 0;
        setCount(c);
        const milestones = [10, 25, 50, 100, 250, 500, 1000, 5000, 10000];
        const next = milestones.find((m) => m > c) || c + 1000;
        setSub(`next milestone: ${next}`);
      } catch {
        setCount("🚀");
        setSub("growing every day");
      }
    }
    loadCounter();
  }, []);

  const PAYSTACK_LINK = "https://paystack.shop/pay/support-kinnect";

  return (
    <main style={styles.body}>
      <div style={styles.wrap}>
        <div style={styles.logo}>
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="22" cy="28" r="16" fill="#FF6F59" />
            <circle cx="34" cy="28" r="16" fill="#2A9D8F" opacity={0.85} />
          </svg>
        </div>

        <div style={styles.wordmark}>Kinnect</div>
        <div style={styles.tagline}>
          A social network being built from one room — friends, communities, and real progress, not just feeds.
        </div>

        <div style={styles.counterCard}>
          <div style={styles.counterLabel}>People Connected</div>
          <div style={styles.counterValue}>{count}</div>
          <div style={styles.counterSub}>{sub}</div>
        </div>

        <div style={styles.foundersNote}>
          The first <strong style={{ color: "var(--coral)" }}>100</strong> people to join become permanent Founding Members — a badge that never goes away.
        </div>

        <a href="/signup" style={{ ...styles.btn, ...styles.btnPrimary }}>
          Join Kinnect →
        </a>
        <a href="/login" style={{ ...styles.btn, ...styles.btnSecondary }}>
          Already have an account? Log in
        </a>

        <div style={styles.storyLine}>
          Built solo, one late night at a time. Watching it grow from zero.
        </div>

        <div style={styles.divider}>Support the project</div>

        <div style={styles.supportCard}>
          <div style={styles.supportTitle}>🚀 Support Kinnect</div>
          <div style={styles.supportBody}>
            Kinnect is an independent platform being built from the ground up. If you believe in what we're building, your support helps fund infrastructure, development, and everything it takes to keep it running — and growing. Every contribution helps. ❤️
          </div>

          <div style={styles.intlNote}>
            🌍 Works with cards from anywhere — you'll pay in your own local currency at checkout.
          </div>

          <a href={PAYSTACK_LINK} target="_blank" rel="noopener noreferrer" style={{ ...styles.btn, ...styles.btnPrimary, marginBottom: 0 }}>
            Support Kinnect
          </a>
        </div>

        <div style={styles.footer}>
          Built independently. Not affiliated with any bank or payment provider.
          <br />
          <a href="mailto:kinnect13@gmail.com" style={styles.footerLink}>kinnect13@gmail.com</a>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    padding: "32px 16px 60px",
    background: "var(--background)",
  },
  wrap: { width: "100%", maxWidth: 420 },
  logo: { display: "flex", justifyContent: "center", marginBottom: 18 },
  wordmark: {
    textAlign: "center",
    fontSize: 26,
    fontWeight: 800,
    background: "linear-gradient(135deg, #FF6F59, #E85D8A)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    marginBottom: 6,
  },
  tagline: {
    textAlign: "center",
    fontSize: 14,
    color: "var(--text-secondary)",
    marginBottom: 28,
    lineHeight: 1.5,
    padding: "0 12px",
  },
  counterCard: {
    background: "linear-gradient(135deg, #FF6F59, #E85D8A)",
    borderRadius: 20,
    padding: "22px 20px",
    textAlign: "center",
    color: "white",
    boxShadow: "var(--shadow-md)",
    marginBottom: 24,
  },
  counterLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.85, marginBottom: 6 },
  counterValue: { fontSize: 40, fontWeight: 800, lineHeight: 1, marginBottom: 6 },
  counterSub: { fontSize: 12, opacity: 0.9 },
  foundersNote: { textAlign: "center", fontSize: 12, color: "var(--text-secondary)", margin: "-12px 0 24px", padding: "0 20px", lineHeight: 1.5 },
  btn: {
    display: "block",
    width: "100%",
    textAlign: "center",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 15,
    padding: 16,
    borderRadius: 999,
    boxShadow: "var(--shadow-sm)",
    marginBottom: 14,
    boxSizing: "border-box",
  },
  btnPrimary: { background: "linear-gradient(135deg, #FF6F59, #F5A742)", color: "white" },
  btnSecondary: { background: "var(--surface)", color: "var(--text-primary)", border: "1.5px solid #FF6F59" },
  storyLine: { textAlign: "center", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7, margin: "22px 0 6px", padding: "0 8px" },
  divider: {
    display: "flex", alignItems: "center", gap: 10, margin: "26px 0 18px",
    color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em",
  },
  supportCard: { background: "var(--surface)", borderRadius: 20, padding: 20, boxShadow: "var(--shadow-sm)", marginBottom: 10 },
  supportTitle: { fontSize: 15, fontWeight: 700, marginBottom: 8 },
  supportBody: { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 },
  intlNote: { fontSize: 11.5, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.5, marginBottom: 14, padding: "0 6px" },
  footer: { textAlign: "center", marginTop: 30, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.8 },
  footerLink: { color: "#FF6F59", textDecoration: "none", fontWeight: 600 },
};