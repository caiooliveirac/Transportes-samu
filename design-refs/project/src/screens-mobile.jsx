// Mobile main screen — stacked sections.

function MobileHeader({ light = false }) {
  return (
    <div className={cx("h-12 flex items-center gap-2 px-3 shrink-0 border-b",
      light ? "bg-white border-zinc-200" : "bg-ink-50 border-white/[0.06]")}>
      <button className={cx("w-8 h-8 rounded-md inline-flex items-center justify-center",
        light ? "hover:bg-zinc-100 text-zinc-700" : "hover:bg-white/5 text-zinc-300")}>
        <Icon name="Menu" size={16} />
      </button>
      <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
        <span className={cx("text-[14px] font-semibold tracking-tight",
          light ? "text-zinc-900" : "text-zinc-50")}>Transportes</span>
        <span className={cx("text-[11px] font-mono",
          light ? "text-zinc-500" : "text-zinc-500")}>18 ativos</span>
      </div>
      <span className="relative inline-flex w-2 h-2">
        <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-50" />
        <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
      </span>
      <button className={cx("w-8 h-8 rounded-md inline-flex items-center justify-center",
        light ? "hover:bg-zinc-100 text-zinc-700" : "hover:bg-white/5 text-zinc-300")}>
        <Icon name="Search" size={16} />
      </button>
    </div>
  );
}

function MobileFilterBar({ light }) {
  return (
    <div className={cx("h-10 flex items-center gap-1.5 px-3 overflow-x-auto shrink-0 border-b",
      light ? "bg-white border-zinc-200" : "bg-ink-50 border-white/[0.06]")}>
      {[
        { l: "Tudo", n: 22, active: true },
        { l: "Hoje", n: 18 },
        { l: "Atrasados", n: 3, tone: "rose" },
        { l: "Pendentes", n: 2, tone: "amber" },
      ].map((p) => (
        <button
          key={p.l}
          className={cx(
            "shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium",
            p.active
              ? light ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"
              : light ? "bg-zinc-100 text-zinc-700" : "bg-white/[0.04] text-zinc-300 ring-1 ring-white/10",
          )}
        >
          {p.l}
          <span className={cx("font-mono text-[10.5px]",
            p.tone === "rose" && "text-rose-400",
            p.tone === "amber" && "text-amber-400")}>{p.n}</span>
        </button>
      ))}
    </div>
  );
}

function MobileUnitSection({ unit, transports, light, expanded, onToggle }) {
  const urgents = transports.filter(window.urgent).length;
  return (
    <div className={cx("border-b",
      light ? "border-zinc-200" : "border-white/[0.06]")}>
      <button
        onClick={onToggle}
        className={cx("sticky top-0 z-10 w-full flex items-center gap-2 px-3 h-10 backdrop-blur",
          light ? "bg-white/95" : "bg-ink-50/95")}
      >
        <Icon name={expanded ? "ChevronDown" : "ChevronRight"} size={14}
          className={light ? "text-zinc-500" : "text-zinc-400"} />
        <span className={cx("text-[13px] font-semibold tracking-tight",
          light ? "text-zinc-900" : "text-zinc-50")}>
          {unit.short}
        </span>
        <span className={cx("font-mono text-[11px]", light ? "text-zinc-500" : "text-zinc-400")}>
          {transports.length}
        </span>
        {urgents > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10.5px] font-mono text-rose-400">
            <span className="w-1 h-1 rounded-full bg-rose-500" />
            {urgents}
          </span>
        )}
        <div className="flex-1" />
      </button>
      {expanded && (
        <div className="flex flex-col gap-1.5 px-2 pb-2.5">
          {transports.length === 0 ? (
            <EmptyColumn light={light} />
          ) : (
            transports.map((t) => (
              <div key={t.id} className="min-h-[56px]">
                <TransportCard t={t} light={light} dense={false} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MobileFrame({ children, light = false }) {
  return (
    <div className="flex justify-center items-center min-h-full p-6">
      <div
        className={cx(
          "relative rounded-[44px] p-[10px] shadow-[0_30px_80px_-10px_rgba(0,0,0,0.6)]",
          light ? "bg-zinc-900" : "bg-zinc-950 ring-1 ring-white/10",
        )}
        style={{ width: 392, height: 820 }}
      >
        <div
          className={cx(
            "absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-6 rounded-full",
            "bg-black z-30",
          )}
        />
        <div
          className={cx(
            "rounded-[36px] overflow-hidden h-full w-full relative",
            light ? "theme-light bg-zinc-50" : "bg-ink-0",
          )}
        >
          {/* iOS status bar */}
          <div className={cx("h-10 flex items-center justify-between px-7 text-[12px] font-semibold relative z-20",
            light ? "text-zinc-900" : "text-zinc-100")}>
            <span className="font-mono">9:41</span>
            <span className="opacity-0">·</span>
            <span className="flex items-center gap-1.5">
              <Icon name="Signal" size={12} />
              <Icon name="Wifi" size={12} />
              <Icon name="BatteryFull" size={14} />
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function MobileScreen({ light = false }) {
  const [expanded, setExpanded] = useState({
    upa_pirajá: true,
    upa_cajazeiras: true,
    upa_brotas: false,
  });
  const byUnit = useMemo(() => {
    const m = {};
    TRANSPORTS.forEach((t) => {
      if (!m[t.origem]) m[t.origem] = [];
      m[t.origem].push(t);
    });
    return m;
  }, []);
  const unitIds = ["upa_pirajá", "upa_cajazeiras", "upa_brotas"];

  return (
    <div className={cx("h-full overflow-auto",
      light ? "bg-zinc-100" : "bg-ink-0",
      "grid-bg")}>
      <MobileFrame light={light}>
        <div className="h-full flex flex-col">
          <MobileHeader light={light} />
          <MobileFilterBar light={light} />
          <div className="flex-1 overflow-y-auto">
            {unitIds.map((uid) => (
              <MobileUnitSection
                key={uid}
                unit={UNITS.find((u) => u.id === uid)}
                transports={(byUnit[uid] || []).slice(0, 5)}
                light={light}
                expanded={expanded[uid]}
                onToggle={() => setExpanded((e) => ({ ...e, [uid]: !e[uid] }))}
              />
            ))}
            <div className="h-24" />
          </div>
          {/* FAB */}
          <button
            className={cx(
              "absolute bottom-6 right-5 w-14 h-14 rounded-full inline-flex items-center justify-center",
              "bg-sky-500 text-white shadow-[0_8px_28px_-4px_rgba(14,165,233,0.6)]",
              "ring-4 ring-sky-500/20",
            )}
          >
            <Icon name="Plus" size={22} stroke={2.5} />
          </button>
          {/* Bottom nav */}
          <div className={cx("h-16 shrink-0 border-t flex items-center justify-around px-4",
            light ? "bg-white border-zinc-200" : "bg-ink-50 border-white/[0.06]")}>
            {[
              { i: "LayoutList", l: "Painel", a: true },
              { i: "Inbox", l: "Revisão", b: 2 },
              { i: "Activity", l: "Métricas" },
              { i: "User", l: "Perfil" },
            ].map((it, i) => (
              <button key={i} className="flex flex-col items-center gap-1 relative">
                <Icon name={it.i} size={18}
                  className={it.a ? (light ? "text-zinc-900" : "text-zinc-50")
                                 : (light ? "text-zinc-400" : "text-zinc-500")} />
                <span className={cx("text-[10.5px] font-medium",
                  it.a ? (light ? "text-zinc-900" : "text-zinc-50")
                       : (light ? "text-zinc-400" : "text-zinc-500"))}>
                  {it.l}
                </span>
                {it.b && (
                  <span className="absolute top-0 right-1 -mt-0.5 -mr-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-amber-500 text-[9px] font-bold text-zinc-900 flex items-center justify-center">
                    {it.b}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* iOS home indicator */}
          <div className="h-1.5 flex items-center justify-center pb-2">
            <span className={cx("w-32 h-1 rounded-full",
              light ? "bg-zinc-900" : "bg-zinc-100/60")} />
          </div>
        </div>
      </MobileFrame>
    </div>
  );
}

Object.assign(window, { MobileScreen });
