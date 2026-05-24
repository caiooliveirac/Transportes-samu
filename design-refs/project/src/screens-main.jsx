// Header + main columnar screen.

function Header({ light = false, onOpenReview, onOpenNew, filter, setFilter }) {
  const totals = useMemo(() => {
    const active = TRANSPORTS.filter(
      (t) => !["concluido", "cancelado"].includes(t.status),
    );
    const urgent = active.filter(window.urgent).length;
    const pendentes = TRANSPORTS.filter((t) => t.status === "pendente_revisao").length;
    const atrasados = TRANSPORTS.filter(window.overdue).length;
    const hoje = active.length; // mock: all "today"
    return { active: active.length, urgent, pendentes, atrasados, hoje };
  }, []);

  return (
    <header
      className={cx(
        "h-12 flex items-center gap-3 px-4 shrink-0 border-b",
        light ? "bg-white border-zinc-200" : "bg-ink-50 border-white/[0.06]",
      )}
    >
      {/* Title */}
      <div className="flex items-center gap-2 pr-3">
        <span className={cx("inline-flex items-center justify-center w-6 h-6 rounded",
          light ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200" : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30")}>
          <Icon name="Activity" size={14} stroke={2.25} />
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className={cx("text-[13px] font-semibold tracking-tight", light ? "text-zinc-900" : "text-zinc-50")}>
            SAMU/CRU
          </span>
          <span className={cx("text-[12px]", light ? "text-zinc-400" : "text-zinc-500")}>·</span>
          <span className={cx("text-[13px] font-medium", light ? "text-zinc-600" : "text-zinc-300")}>
            Transportes
          </span>
        </div>
      </div>

      {/* Live counts */}
      <div className="flex items-center gap-2 text-[12px] font-medium">
        <span className={cx("inline-flex items-center gap-1.5 px-2 h-7 rounded-md",
          light ? "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200" : "bg-white/[0.04] ring-1 ring-white/10 text-zinc-200")}>
          <span className={cx("w-1.5 h-1.5 rounded-full bg-sky-500")} />
          <span className="font-mono tabular-nums">{totals.active}</span>
          <span className={cx("text-[11px]", light ? "text-zinc-500" : "text-zinc-400")}>ativos</span>
        </span>
        <span className={cx("inline-flex items-center gap-1.5 px-2 h-7 rounded-md",
          light ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-rose-500/10 ring-1 ring-rose-500/30 text-rose-300")}>
          <Icon name="AlarmClock" size={12} />
          <span className="font-mono tabular-nums">{totals.urgent}</span>
          <span className="text-[11px] opacity-80">urgentes</span>
        </span>
      </div>

      {/* Pill filters */}
      <PillGroup
        value={filter}
        onChange={setFilter}
        light={light}
        items={[
          { value: "tudo", label: "Tudo", count: TRANSPORTS.length },
          { value: "hoje", label: "Hoje", count: totals.hoje },
          { value: "atrasados", label: "Atrasados", count: totals.atrasados, tone: "rose" },
          { value: "pendentes", label: "Pendentes", count: totals.pendentes, tone: "amber" },
        ]}
      />

      <div className="flex-1" />

      {/* Search */}
      <label
        className={cx(
          "inline-flex items-center gap-2 h-8 px-2.5 rounded-md min-w-[260px]",
          light ? "bg-white ring-1 ring-zinc-200 focus-within:ring-zinc-300" : "bg-ink-200 ring-1 ring-white/10 focus-within:ring-white/20",
        )}
      >
        <Icon name="Search" size={14} className={light ? "text-zinc-500" : "text-zinc-400"} />
        <input
          placeholder="Buscar paciente, destino, unidade…"
          className={cx(
            "bg-transparent outline-none text-[13px] w-full",
            light ? "text-zinc-900 placeholder:text-zinc-400" : "text-zinc-100 placeholder:text-zinc-500",
          )}
        />
        <Kbd>/</Kbd>
      </label>

      {/* Worker status */}
      <Tooltip label="WhatsApp worker online · última msg há 12s">
        <span
          className={cx(
            "inline-flex items-center gap-1.5 h-8 px-2 rounded-md",
            light ? "bg-zinc-100 ring-1 ring-zinc-200" : "bg-white/[0.04] ring-1 ring-white/10",
          )}
        >
          <span className="relative inline-flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-50" />
            <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
          </span>
          <span className={cx("text-[11px] font-mono", light ? "text-zinc-600" : "text-zinc-400")}>12s</span>
        </span>
      </Tooltip>

      {/* + Novo */}
      <Button variant="primary" size="md" onClick={onOpenNew}>
        <Icon name="Plus" size={14} />
        Novo
      </Button>

      {/* Avatar */}
      <button
        className={cx(
          "inline-flex items-center gap-2 h-8 pl-1 pr-2 rounded-md",
          light ? "hover:bg-zinc-100" : "hover:bg-white/5",
        )}
      >
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-sky-500 to-violet-500 text-white text-[10px] font-bold">
          AS
        </span>
        <span className={cx("text-[12px] font-medium", light ? "text-zinc-700" : "text-zinc-300")}>
          Dr. A. Silva
        </span>
        <Icon name="ChevronDown" size={12} className={light ? "text-zinc-400" : "text-zinc-500"} />
      </button>
    </header>
  );
}

function ColumnHeader({ unit, transports, light = false }) {
  const total = transports.length;
  const urgents = transports.filter(window.urgent).length;
  const pendentes = transports.filter((t) => t.status === "pendente_revisao").length;
  // Load (visual) — capacity 8
  const load = Math.min(1, total / 8);
  return (
    <div
      className={cx(
        "sticky top-0 z-10 backdrop-blur",
        light ? "bg-white/95" : "bg-ink-50/95",
      )}
    >
      <div className="flex items-center gap-2 px-2.5 h-9">
        <Tooltip label={unit.full}>
          <h2
            className={cx(
              "truncate text-[12.5px] font-semibold tracking-tight",
              light ? "text-zinc-900" : "text-zinc-50",
            )}
          >
            {unit.short}
          </h2>
        </Tooltip>
        <span className={cx("font-mono text-[11px] tabular-nums",
          light ? "text-zinc-500" : "text-zinc-400")}>
          {total}
        </span>
        {urgents > 0 && (
          <Tooltip label={`${urgents} urgentes nesta unidade`}>
            <span className="inline-flex items-center gap-0.5 text-[10.5px] font-mono text-rose-400">
              <span className="w-1 h-1 rounded-full bg-rose-500" />
              {urgents}
            </span>
          </Tooltip>
        )}
        {pendentes > 0 && (
          <Tooltip label={`${pendentes} mensagens aguardando revisão`}>
            <span className="inline-flex items-center gap-0.5 text-[10.5px] font-mono text-amber-400">
              <span className="w-1 h-1 rounded-full bg-amber-500" />
              {pendentes}
            </span>
          </Tooltip>
        )}
        <div className="flex-1" />
        <button className={cx(
          "h-6 w-6 rounded inline-flex items-center justify-center",
          light ? "text-zinc-500 hover:bg-zinc-100" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
        )}>
          <Icon name="MoreHorizontal" size={14} />
        </button>
      </div>
      {/* Load bar */}
      <div className={cx("h-[2px]", light ? "bg-zinc-100" : "bg-white/[0.04]")}>
        <div
          className={cx(
            "h-full",
            urgents > 0 ? "bg-rose-400/70" : light ? "bg-zinc-300" : "bg-white/15",
          )}
          style={{ width: `${load * 100}%` }}
        />
      </div>
    </div>
  );
}

function EmptyColumn({ light = false }) {
  return (
    <div
      className={cx(
        "mt-3 mx-1 rounded-md py-6 px-3 flex flex-col items-center gap-1.5 text-center",
        light
          ? "bg-zinc-50 ring-1 ring-dashed ring-zinc-200 text-zinc-500"
          : "bg-white/[0.015] ring-1 ring-dashed ring-white/10 text-zinc-500",
      )}
    >
      <Icon name="Wind" size={18} className="opacity-60" />
      <p className="text-[12px] font-medium">Sem transportes</p>
      <p className="text-[11px] opacity-70 leading-relaxed">
        Quando chegar uma mensagem<br />desta unidade aparece aqui.
      </p>
    </div>
  );
}

function Column({ unit, transports, light, onSelect }) {
  // Sort: pendente_revisao first, urgent next, then by deadline; concluido last
  const sorted = [...transports].sort((a, b) => {
    const w = (t) => {
      if (t.status === "pendente_revisao") return 0;
      if (t.status === "cancelado") return 90;
      if (t.status === "concluido") return 80;
      if (window.overdue(t)) return 1;
      if (window.urgent(t)) return 2;
      return 10;
    };
    const dw = w(a) - w(b);
    if (dw !== 0) return dw;
    return a.deadline - b.deadline;
  });

  return (
    <div
      className={cx(
        "shrink-0 w-[300px] flex flex-col rounded-md overflow-hidden",
        light ? "bg-white ring-1 ring-zinc-200" : "bg-ink-100 ring-1 ring-white/[0.05]",
      )}
    >
      <ColumnHeader unit={unit} transports={transports} light={light} />
      <div className="flex flex-col gap-1.5 p-2 overflow-y-auto">
        {sorted.length === 0 && <EmptyColumn light={light} />}
        {sorted.map((t) => (
          <TransportCard key={t.id} t={t} light={light} onClick={() => onSelect?.(t)} />
        ))}
      </div>
    </div>
  );
}

function DesktopMainScreen({ light = false, onSelectTransport }) {
  const [filter, setFilter] = useState("tudo");
  const filtered = useMemo(() => {
    return TRANSPORTS.filter((t) => {
      if (filter === "atrasados") return window.overdue(t);
      if (filter === "pendentes") return t.status === "pendente_revisao";
      if (filter === "hoje") return !["concluido", "cancelado"].includes(t.status);
      return true;
    });
  }, [filter]);

  // Group by origem
  const byUnit = useMemo(() => {
    const m = {};
    UNITS.forEach((u) => (m[u.id] = []));
    filtered.forEach((t) => {
      if (!m[t.origem]) m[t.origem] = [];
      m[t.origem].push(t);
    });
    return m;
  }, [filtered]);

  // pick units to display in column order; show pirajá, barreiras, san_martin (empty), cajazeiras, brotas
  const colOrder = [
    "upa_pirajá",
    "upa_brotas",
    "upa_cajazeiras",
    "upa_liberdade",
    "upa_barreiras",
    "upa_san_martin",
    "pa_paripe",
    "pa_periperi",
    "pa_mussurunga",
    "hmum",
  ];

  return (
    <div
      className={cx(
        "h-full flex flex-col",
        light ? "theme-light bg-zinc-50 text-zinc-900" : "bg-ink-0 text-zinc-200",
      )}
    >
      <Header light={light} filter={filter} setFilter={setFilter} />
      <div className="flex-1 overflow-auto p-3">
        <div className="flex gap-3 h-full">
          {colOrder.map((uid) => {
            const u = UNITS.find((x) => x.id === uid);
            return (
              <Column
                key={uid}
                unit={u}
                transports={byUnit[uid] || []}
                light={light}
                onSelect={onSelectTransport}
              />
            );
          })}
        </div>
      </div>
      <StatusBar light={light} />
    </div>
  );
}

function StatusBar({ light = false }) {
  return (
    <div
      className={cx(
        "h-7 flex items-center gap-4 px-3 text-[11px] font-mono shrink-0 border-t",
        light ? "bg-white border-zinc-200 text-zinc-500" : "bg-ink-50 border-white/[0.06] text-zinc-500",
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Conectado · CRU-Salvador
      </span>
      <span>v2.4.1</span>
      <div className="flex-1" />
      <span>↑↓ navegar</span>
      <span>↵ abrir</span>
      <span>R revisão</span>
      <span>N novo</span>
      <span>{NOW.toLocaleString("pt-BR")}</span>
    </div>
  );
}

Object.assign(window, { DesktopMainScreen, Header, Column, ColumnHeader, EmptyColumn, StatusBar });
