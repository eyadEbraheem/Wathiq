import { Icon } from "@/components/ui/Icon";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-20 w-20 text-2xl",
} as const;

/** The profile photo with a teal ring, or initials on the navy gradient when there is none. */
export function Avatar({
  name,
  src,
  verified = false,
  size = "md",
}: {
  name: string;
  /** The account's `avatarUrl`; empty means no photo. */
  src?: string | null;
  verified?: boolean;
  size?: keyof typeof SIZES;
}) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("");
  return (
    <span className="relative inline-flex shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={`rounded-full bg-canvas object-cover ring-2 ring-primary-light ${SIZES[size]}`}
        />
      ) : (
        <span
          className={`inline-flex items-center justify-center rounded-full bg-navy-grad font-display font-black text-white ring-2 ring-primary-light ${SIZES[size]}`}
        >
          {initials}
        </span>
      )}
      {verified ? (
        <span
          className="absolute -bottom-0.5 -end-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white ring-2 ring-surface"
          title="حساب موثّق"
        >
          <Icon name="check" className="h-2.5 w-2.5" strokeWidth={3.5} />
        </span>
      ) : null}
    </span>
  );
}
