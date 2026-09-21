// HOME_V2_UPDATE.md § 5 — decorative celestial composition, top-right of
// the greeting. Two states: morning/afternoon show a warm sun, evening/
// night show a pale moon + stars. Ported closely from the reference
// prototype's own SVG (Reminder Assistant v2 Atmosphere.dc.html) — these
// are one-off illustration fills/strokes, not design tokens, same
// treatment CloudClearing's line art gets (see its own commit for the
// same reasoning). Purely decorative: aria-hidden, pointer-events-none,
// and its own orbit/drift animations are covered by the app-wide
// `prefers-reduced-motion` rule in globals.css.
export function SkyScene({
  timeOfDay,
}: {
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
}) {
  const isDay = timeOfDay === "morning" || timeOfDay === "afternoon";

  return (
    <svg
      aria-hidden
      width="232"
      height="212"
      viewBox="0 0 232 212"
      fill="none"
      className="pointer-events-none absolute -top-[58px] -right-[42px]"
    >
      {isDay ? (
        <>
          <circle cx="158" cy="90" r="43" fill="#F4E7D9" />
          <circle cx="158" cy="90" r="43" stroke="#ECDACA" />
          <g
            style={{
              transformOrigin: "158px 90px",
              animation: "orbitSpin 180s linear infinite",
            }}
          >
            <circle
              cx="158"
              cy="90"
              r="64"
              stroke="#E4DAD2"
              strokeDasharray="1.5 8"
            />
            <circle cx="158" cy="26" r="2.4" fill="#D9C3B3" />
          </g>
          <circle cx="158" cy="90" r="86" stroke="#EBE5DE" />
          <path d="M12 160 C 64 134, 130 148, 222 116" stroke="#E7DFD7" />
          <circle
            cx="42"
            cy="58"
            r="1.7"
            fill="#DCCCC2"
            style={{ animation: "driftY 11s ease-in-out infinite" }}
          />
          <circle
            cx="68"
            cy="32"
            r="1.1"
            fill="#E3D4CB"
            style={{ animation: "driftY 14s ease-in-out infinite" }}
          />
        </>
      ) : (
        <>
          <circle cx="158" cy="90" r="38" fill="#E9E7EE" />
          <circle cx="140" cy="80" r="34" fill="var(--background)" />
          <g
            style={{
              transformOrigin: "158px 90px",
              animation: "orbitSpin 200s linear infinite",
            }}
          >
            <circle
              cx="158"
              cy="90"
              r="66"
              stroke="#DEDCE4"
              strokeDasharray="1.5 9"
            />
            <circle cx="158" cy="24" r="2.2" fill="#C8C4D2" />
          </g>
          <circle cx="158" cy="90" r="88" stroke="#E7E5EA" />
          <circle
            cx="46"
            cy="48"
            r="1.6"
            fill="#CFCBD8"
            style={{ animation: "driftY 12s ease-in-out infinite" }}
          />
          <circle cx="76" cy="28" r="1.1" fill="#D8D5E0" />
          <circle
            cx="30"
            cy="106"
            r="1.2"
            fill="#D8D5E0"
            style={{ animation: "driftY 16s ease-in-out infinite" }}
          />
        </>
      )}
    </svg>
  );
}
