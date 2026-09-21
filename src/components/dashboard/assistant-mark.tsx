// HOME_V2_UPDATE.md § 6 — replaces the "✦" glyph everywhere on Home (only
// on Home; Login/TaskForm's rose-tint "✦" is unchanged, out of this
// screen's scope). Ring + filled core + one small satellite dot, one of
// three colourways per context. `animated` mirrors the reference
// prototype exactly: only the greeting's "personal" mark pulses the
// satellite dot (via the existing global sparkleBreathe keyframe); the
// insight-card and suggestion-card instances are static.
const TONE_STYLES = {
  personal: {
    ring: "var(--home-mark-personal-ring)",
    core: "var(--burgundy)",
    satellite: "var(--rose-gold)",
  },
  insight: {
    ring: "var(--home-mark-insight-ring)",
    core: "var(--home-mark-insight-core)",
    satellite: "var(--home-mark-insight-ring)",
  },
  suggestion: {
    ring: "var(--home-mark-suggestion-ring)",
    core: "var(--home-mark-suggestion-core)",
    satellite: "var(--home-mark-suggestion-ring)",
  },
} as const;

export function AssistantMark({
  tone,
  size = 16,
  animated = false,
  className,
}: {
  tone: "personal" | "insight" | "suggestion";
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  const { ring, core, satellite } = TONE_STYLES[tone];
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <circle cx="8" cy="8.4" r="5.1" stroke={ring} />
      <circle cx="8" cy="8.4" r="1.9" fill={core} />
      <circle
        cx="14.2"
        cy="3.2"
        r="1.3"
        fill={satellite}
        style={
          animated
            ? {
                animation: "sparkleBreathe 6s ease-in-out infinite",
                transformOrigin: "14.2px 3.2px",
              }
            : undefined
        }
      />
    </svg>
  );
}
