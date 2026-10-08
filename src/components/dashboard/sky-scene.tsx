// HOME_V2_UPDATE.md § 5 — decorative celestial composition, top-right of
// the greeting. Two states: morning/afternoon show a warm sun, evening/
// night show a pale moon + stars. Ported from the reference prototype's
// SVG; colours are the --sky-* tokens (light and dark, sprint-23-tasks.md
// S23-04). Still: the orbit's slow spin and the drifting dust went in
// Sprint 23 (решение 7 — no decorative loops). Purely decorative.
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
          <circle cx="158" cy="90" r="43" fill="var(--sky-sun)" />
          <circle cx="158" cy="90" r="43" stroke="var(--sky-sun-rim)" />
          <g>
            <circle
              cx="158"
              cy="90"
              r="64"
              stroke="var(--sky-orbit)"
              strokeDasharray="1.5 8"
            />
            <circle cx="158" cy="26" r="2.4" fill="var(--sky-orbit-dot)" />
          </g>
          <circle cx="158" cy="90" r="86" stroke="var(--sky-halo)" />
          <path
            d="M12 160 C 64 134, 130 148, 222 116"
            stroke="var(--sky-horizon)"
          />
          <circle cx="42" cy="58" r="1.7" fill="var(--sky-dust)" />
          <circle cx="68" cy="32" r="1.1" fill="var(--sky-dust-faint)" />
        </>
      ) : (
        <>
          <circle cx="158" cy="90" r="38" fill="var(--sky-moon)" />
          <circle cx="140" cy="80" r="34" fill="var(--background)" />
          <g>
            <circle
              cx="158"
              cy="90"
              r="66"
              stroke="var(--sky-night-orbit)"
              strokeDasharray="1.5 9"
            />
            <circle
              cx="158"
              cy="24"
              r="2.2"
              fill="var(--sky-night-orbit-dot)"
            />
          </g>
          <circle cx="158" cy="90" r="88" stroke="var(--sky-night-halo)" />
          <circle cx="46" cy="48" r="1.6" fill="var(--sky-star)" />
          <circle cx="76" cy="28" r="1.1" fill="var(--sky-star-faint)" />
          <circle cx="30" cy="106" r="1.2" fill="var(--sky-star-faint)" />
        </>
      )}
    </svg>
  );
}
