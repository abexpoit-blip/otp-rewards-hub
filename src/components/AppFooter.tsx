export function AppFooter() {
  return (
    <footer className="mt-8 pt-4 pb-2 text-center">
      <p className="text-xs text-muted-foreground tracking-wide">
        Developed by{" "}
        <span
          className="font-display font-bold text-base align-middle"
          style={{
            background: "linear-gradient(135deg, var(--color-primary, #6366f1), #a855f7, #ec4899)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "0 0 18px rgba(168,85,247,0.55)",
            filter: "drop-shadow(0 0 10px rgba(99,102,241,0.55))",
          }}
        >
          Sam
        </span>
        {" — "}
        <span className="font-semibold text-foreground/80">Nexus X</span>
        , Part of{" "}
        <span className="font-semibold text-foreground/80">Basictrick Community</span>
      </p>
    </footer>
  );
}
