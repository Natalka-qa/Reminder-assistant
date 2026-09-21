import styles from "./CloudClearing.module.css";

const TASK_CLOUD =
  "M13,38 C5,38 1,30 7,25 C2,17 9,10 17,12 C20,4 32,2 36,9 C44,4 55,10 53,18 " +
  "C61,21 60,33 51,34 C50,41 39,43 34,38 C28,43 17,42 13,38 Z";

const TASKS = [
  { x: 146, y: 166, cls: styles.wc1 },
  { x: 252, y: 150, cls: styles.wc2 },
  { x: 106, y: 252, cls: styles.wc3 },
  { x: 200, y: 268, cls: styles.wc4 },
  { x: 296, y: 240, cls: styles.wc5 },
];

const ROWS = [
  { y: 202, len: 742, row: styles.ring1, check: styles.cm1 },
  { y: 256, len: 718, row: styles.ring2, check: styles.cm2 },
  { y: 310, len: 748, row: styles.ring3, check: styles.cm3 },
  { y: 364, len: 726, row: styles.ring4, check: styles.cm4 },
  { y: 418, len: 734, row: styles.ring5, check: styles.cm5 },
];

const FACE = [
  "M196,248 C204,241 216,241 224,248",
  "M264,248 C272,241 284,241 292,248",
  "M220,280 C232,295 254,295 266,280",
];

type CloudClearingProps = {
  /** Seconds for one full loop. Default 18. */
  loopSeconds?: number;
  /** Accent used for checkmarks and the face. Default --color-plum (#743447). */
  accentColor?: string;
  /** Draw the white card frame around the animation. Default false — sits on the page background. */
  framed?: boolean;
  className?: string;
};

/**
 * Login hero animation. Task clouds fill the head, then fly one by one into the
 * list and become checkmarks; when the head empties, a calm face appears.
 * Decorative only — hidden from assistive tech.
 */
export default function CloudClearing({
  loopSeconds = 18,
  accentColor = "#743447",
  framed = false,
  className,
}: CloudClearingProps) {
  return (
    <div
      aria-hidden="true"
      className={[styles.root, framed ? styles.framed : "", className]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          "--cc-loop": `${loopSeconds}s`,
          "--cc-accent": accentColor,
        } as React.CSSProperties
      }
    >
      <svg
        viewBox="0 0 800 560"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
      >
        <g className={styles.scene}>
          <g className={styles.drift}>
            <path
              d="M118,332 C70,332 52,286 84,262 C62,222 96,180 138,190 C150,144 208,128 240,158 C272,120 338,134 344,180 C388,182 400,226 374,250 C404,278 386,328 344,328 C332,354 292,362 270,344 C244,372 180,368 166,342 C148,346 128,344 118,332 Z"
              stroke="#2C2B2F"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle
              cx="104"
              cy="382"
              r="8.5"
              stroke="#2C2B2F"
              strokeWidth="1.4"
            />
            <circle
              cx="84"
              cy="404"
              r="5.5"
              stroke="#2C2B2F"
              strokeWidth="1.3"
            />
            <circle
              cx="69"
              cy="420"
              r="3.4"
              stroke="#2C2B2F"
              strokeWidth="1.2"
            />

            <g
              stroke="var(--cc-accent)"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            >
              {FACE.map((d) => (
                <path
                  key={d}
                  className={styles.face}
                  d={d}
                  strokeDasharray="56"
                  strokeDashoffset="56"
                />
              ))}
            </g>

            {TASKS.map((t) => (
              <g key={t.cls} transform={`translate(${t.x},${t.y})`}>
                <g className={`${styles.task} ${t.cls}`}>
                  <path
                    d={TASK_CLOUD}
                    fill="#E8F0F4"
                    stroke="#315766"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                </g>
              </g>
            ))}
          </g>

          <g className={styles.list}>
            <path d="M580,166 L580,454" stroke="#E4E1DC" strokeWidth="1.2" />

            {ROWS.map((r) => (
              <g key={r.y}>
                <g className={`${styles.row} ${r.row}`}>
                  <circle
                    cx="612"
                    cy={r.y}
                    r="9"
                    stroke="#C9C6C1"
                    strokeWidth="1.3"
                  />
                  <path
                    d={`M640,${r.y} L${r.len},${r.y}`}
                    stroke="#DAD6D0"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </g>
                <path
                  className={`${styles.check} ${r.check}`}
                  d={`M607.5,${r.y} L611,${r.y + 4} L617,${r.y - 5.5}`}
                  stroke="var(--cc-accent)"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray="30"
                  strokeDashoffset="30"
                />
              </g>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
