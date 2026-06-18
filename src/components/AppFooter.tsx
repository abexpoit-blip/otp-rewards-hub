export function AppFooter() {
  return (
    <footer className="mt-8 pt-4 pb-2 text-center">
      <p className="text-xs text-muted-foreground tracking-wide">
        Developed by{" "}
        <span
          className="sam-glow font-display font-bold text-base align-middle"
          style={{
            background: "linear-gradient(135deg, #6366f1, #a855f7, #ec4899)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
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
