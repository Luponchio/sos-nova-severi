export default function Background() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Deep night gradient base */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,#0F2040_0%,#071022_45%,#040A18_100%)]" />

      {/* Azure glow, upper right */}
      <div className="absolute -top-32 -right-24 h-[36rem] w-[36rem] rounded-full bg-azure-500/20 blur-[120px] animate-drift" />

      {/* Faint gold glow, lower left, echoing the logo's star */}
      <div className="absolute bottom-[-10rem] left-[-6rem] h-[28rem] w-[28rem] rounded-full bg-gold-500/10 blur-[110px] animate-drift" style={{ animationDelay: "-8s" }} />

      {/* Subtle grain-like vignette to keep depth without noise */}
      <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_20%,transparent_0%,rgba(4,10,24,0.6)_100%)]" />
    </div>
  );
}
