// HOME_V2_UPDATE.md § 5 — warm light + grain, confined to the greeting
// zone. Both layers are decorative only (aria-hidden, pointer-events-none)
// and sit behind the greeting's content, which needs its own `relative`
// stacking context for that to hold. The grain is an inline feTurbulence
// data URI — no image asset, ported verbatim from the reference prototype.
export function AtmosphereBackground() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[130px] -right-[60px] -left-[60px] h-[480px]"
        style={{
          background:
            "radial-gradient(58% 52% at 76% 28%, rgba(240,222,202,0.52) 0%, rgba(247,246,243,0) 72%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[130px] -right-[60px] -left-[60px] h-[760px] opacity-[0.05] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27140%27%20height=%27140%27%3E%3Cfilter%20id=%27n%27%3E%3CfeTurbulence%20type=%27fractalNoise%27%20baseFrequency=%270.85%27%20numOctaves=%273%27/%3E%3C/filter%3E%3Crect%20width=%27140%27%20height=%27140%27%20filter=%27url%28%23n%29%27/%3E%3C/svg%3E)",
        }}
      />
    </>
  );
}
