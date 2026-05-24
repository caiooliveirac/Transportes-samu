// UI primitives — shadcn/Radix-flavored, hand-rolled to keep the bundle inline.

const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;
const motion = window.Motion || {};
const M = motion.motion || {};
const AnimatePresence = motion.AnimatePresence || (({ children }) => children);

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */
function Button({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...rest
}) {
  const sizes = {
    sm: "h-7 px-2.5 text-[12px] gap-1.5 rounded-md",
    md: "h-8 px-3 text-[13px] gap-2 rounded-md",
    lg: "h-10 px-4 text-[14px] gap-2 rounded-md",
    icon: "h-8 w-8 rounded-md justify-center",
  };
  const variants = {
    default:
      "bg-white text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 shadow-[0_1px_0_0_rgba(0,0,0,0.05),inset_0_-1px_0_0_rgba(0,0,0,0.04)]",
    primary:
      "bg-sky-500 hover:bg-sky-400 text-white shadow-[0_1px_0_0_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.18)]",
    secondary:
      "bg-ink-200 text-zinc-100 hover:bg-ink-300 border border-white/5 dark:bg-ink-200 light:bg-zinc-100",
    ghost:
      "text-zinc-300 hover:bg-white/5 dark:hover:bg-white/5 light:text-zinc-700 light:hover:bg-zinc-200/70",
    outline:
      "border border-white/10 hover:bg-white/5 text-zinc-200 light:border-zinc-200 light:text-zinc-700 light:hover:bg-zinc-100",
    destructive:
      "bg-rose-600 hover:bg-rose-500 text-white",
    danger_outline:
      "border border-rose-500/40 text-rose-300 hover:bg-rose-500/10",
  };
  return (
    <button
      className={cx(
        "inline-flex items-center font-medium select-none transition-colors focus-ring disabled:opacity-50 disabled:pointer-events-none",
        sizes[size],
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Badge / Pill ---------- */
function Badge({ children, className = "", tone = "neutral" }) {
  const tones = {
    neutral:
      "bg-white/5 text-zinc-300 ring-white/10 light:bg-zinc-100 light:text-zinc-700 light:ring-zinc-200",
    amber: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    rose: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    sky: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    violet: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 px-1.5 h-5 rounded text-[11px] font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Kbd ---------- */
function Kbd({ children, className = "" }) {
  return (
    <kbd
      className={cx(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded text-[10.5px] font-mono",
        "bg-white/[0.06] text-zinc-300 ring-1 ring-inset ring-white/10",
        "light:bg-white light:text-zinc-700 light:ring-zinc-200",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/* ---------- Tooltip ---------- */
function Tooltip({ label, children, side = "top", className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <span
        className={cx(
          "absolute z-50 px-2 py-1 rounded-md text-[11px] font-medium pointer-events-none whitespace-nowrap",
          "bg-zinc-900 text-zinc-100 ring-1 ring-white/10 shadow-lg",
          "transition-all duration-100",
          open ? "opacity-100 translate-y-0" : "opacity-0",
          side === "top" && "left-1/2 -translate-x-1/2 -translate-y-2 bottom-full",
          side === "bottom" && "left-1/2 -translate-x-1/2 translate-y-2 top-full",
          side === "right" && "left-full ml-2 top-1/2 -translate-y-1/2",
          !open && "scale-95",
          className,
        )}
        style={{ visibility: open ? "visible" : "hidden" }}
      >
        {label}
      </span>
    </span>
  );
}

/* ---------- Select (custom shadcn-style) ---------- */
function Select({ value, onChange, options, className = "", placeholder = "—" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const selected = options.find((o) => o.value === value);
  return (
    <div ref={ref} className={cx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "inline-flex w-full items-center justify-between gap-2 h-8 px-2.5 rounded-md text-[13px]",
          "bg-ink-200 ring-1 ring-inset ring-white/10 hover:ring-white/20",
          "light:bg-white light:ring-zinc-200 light:hover:ring-zinc-300",
          "focus-ring",
        )}
      >
        <span className="inline-flex items-center gap-2 truncate">
          {selected?.leading}
          <span className="truncate">{selected?.label || placeholder}</span>
        </span>
        <Icon name="ChevronsUpDown" size={14} className="opacity-60" />
      </button>
      <AnimatePresence>
        {open && (
          <M.div
            key="select-popover"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className={cx(
              "absolute z-40 mt-1 w-full min-w-[200px] max-h-72 overflow-auto p-1 rounded-md",
              "bg-ink-100 ring-1 ring-white/10 shadow-2xl",
              "light:bg-white light:ring-zinc-200",
            )}
          >
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange?.(o.value);
                  setOpen(false);
                }}
                className={cx(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-left",
                  "hover:bg-white/5 light:hover:bg-zinc-100",
                  o.value === value && "bg-white/[0.04] light:bg-zinc-100",
                )}
              >
                {o.leading}
                <span className="truncate flex-1">{o.label}</span>
                {o.value === value && (
                  <Icon name="Check" size={14} className="opacity-80" />
                )}
              </button>
            ))}
          </M.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Sheet ---------- */
function Sheet({ open, onClose, children, side = "right", width = 480 }) {
  return (
    <AnimatePresence>
      {open && [
        <M.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-30"
        />,
        <M.div
          key="panel"
          initial={{ x: side === "right" ? width : -width }}
          animate={{ x: 0 }}
          exit={{ x: side === "right" ? width : -width }}
          transition={{ type: "spring", damping: 30, stiffness: 280 }}
          style={{ width }}
          className={cx(
            "absolute top-0 bottom-0 z-40 flex flex-col",
            side === "right" ? "right-0" : "left-0",
            "bg-ink-100 ring-1 ring-white/10 shadow-[-10px_0_30px_rgba(0,0,0,0.4)]",
            "light:bg-white light:ring-zinc-200 light:shadow-[-10px_0_30px_rgba(0,0,0,0.06)]",
          )}
        >
          {children}
        </M.div>,
      ]}
    </AnimatePresence>
  );
}

/* ---------- StatusDot ---------- */
function StatusDot({ status, pulse = false, className = "" }) {
  const s = STATUS[status];
  return (
    <span className={cx("relative inline-flex items-center justify-center", className)}>
      <span className={cx("w-2 h-2 rounded-full", s.dot)} />
      {pulse && (
        <span className={cx("absolute w-2 h-2 rounded-full animate-ping", s.dot, "opacity-60")} />
      )}
    </span>
  );
}

/* ---------- StatusPill ---------- */
function StatusPill({ status, light = false, className = "" }) {
  const s = STATUS[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11.5px] font-medium ring-1 ring-inset",
        light ? s.pillBgLight : s.pillBg,
        className,
      )}
    >
      <span className={cx("w-1.5 h-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

/* ---------- Pill toggle group ---------- */
function PillGroup({ value, onChange, items, light = false }) {
  return (
    <div
      className={cx(
        "inline-flex items-center p-0.5 rounded-md",
        light ? "bg-zinc-100 ring-1 ring-zinc-200" : "bg-white/[0.04] ring-1 ring-white/10",
      )}
    >
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            onClick={() => onChange?.(it.value)}
            className={cx(
              "h-7 px-2.5 inline-flex items-center gap-1.5 rounded text-[12px] font-medium transition-all focus-ring",
              active
                ? light
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                  : "bg-ink-300 text-zinc-50 shadow-sm ring-1 ring-white/10"
                : light
                ? "text-zinc-600 hover:text-zinc-900"
                : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            {it.label}
            {it.count != null && (
              <span
                className={cx(
                  "text-[10.5px] font-mono px-1 rounded",
                  active
                    ? light
                      ? "bg-zinc-100 text-zinc-700"
                      : "bg-white/10 text-zinc-200"
                    : light
                    ? "bg-zinc-200/70 text-zinc-600"
                    : "bg-white/5 text-zinc-400",
                  it.tone === "amber" && (active ? "" : "text-amber-400"),
                  it.tone === "rose" && (active ? "" : "text-rose-400"),
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Section block ---------- */
function Section({ label, children, action, className = "" }) {
  return (
    <section className={cx("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-[10.5px] tracking-[0.14em] font-semibold uppercase text-zinc-500 light:text-zinc-500">
          {label}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

Object.assign(window, {
  cx,
  Button,
  Badge,
  Kbd,
  Tooltip,
  Select,
  Sheet,
  StatusDot,
  StatusPill,
  PillGroup,
  Section,
  M,
  AnimatePresence,
});
