import { AssistantMark } from "@/components/dashboard/assistant-mark";

// HOME_V2_UPDATE.md § 5 — "Assistant insight" card. Background gradient,
// border and the decorative composition are ported from the reference
// prototype (one-off illustration values, not tokens — see sky-scene.tsx's
// same reasoning); only the body copy is data — computed by the caller via
// home-view.ts's buildInsightBody, never hardcoded (the title itself is
// static in the reference prototype too, so it stays static here).
export function AssistantInsight({ body }: { body: string }) {
  return (
    <div
      className="relative flex flex-col gap-[9px] overflow-hidden rounded-[20px] border p-[22px] pb-6"
      style={{
        background:
          "linear-gradient(152deg, #E9F1F3 0%, #EEF0EC 54%, #F5EFE8 100%)",
        borderColor: "var(--home-insight-border)",
      }}
    >
      <svg
        aria-hidden
        width="270"
        height="160"
        viewBox="0 0 270 160"
        fill="none"
        className="pointer-events-none absolute -right-7 -bottom-[62px]"
      >
        <circle cx="156" cy="100" r="58" fill="#E3EDEF" />
        <path d="M2 100 H 268" stroke="#CFDFE3" />
        <circle
          cx="156"
          cy="100"
          r="84"
          stroke="#DCE7E9"
          strokeDasharray="2 9"
          style={{
            transformOrigin: "156px 100px",
            animation: "orbitSpin 240s linear infinite",
          }}
        />
        <circle cx="48" cy="36" r="1.8" fill="#C3D7DC" />
        <circle cx="80" cy="18" r="1.2" fill="#C3D7DC" />
        <path d="M48 36 L80 18" stroke="#D3E1E4" />
      </svg>

      <div className="relative flex items-center gap-2">
        <AssistantMark tone="insight" size={14} />
        <span
          className="text-eyebrow tracking-eyebrow font-semibold uppercase"
          style={{ color: "var(--home-insight-eyebrow)" }}
        >
          From your assistant
        </span>
      </div>
      <p className="font-display text-blue-ink-title relative text-[30px] leading-[1.1] font-light">
        A calmer day ahead
      </p>
      <p className="text-blue-ink-body relative max-w-[270px] text-[14px] leading-[1.6] text-pretty">
        {body}
      </p>
    </div>
  );
}
