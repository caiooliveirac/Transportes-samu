// TransportCard — compact horizontal row, the critical visual unit.

function tipoIcon(tipo) {
  if (tipo === "one_way") return "ArrowRight";
  if (tipo === "round_trip") return "RefreshCcw";
  return "HelpCircle";
}
function tipoLabel(tipo) {
  if (tipo === "one_way") return "Ida (one-way)";
  if (tipo === "round_trip") return "Ida e volta";
  return "Tipo desconhecido";
}

function deadlineState(t) {
  const mins = Math.round((t.deadline - NOW) / 60000);
  const terminal = ["chegou_destino", "concluido", "cancelado"].includes(t.status);
  if (terminal) return { tone: "neutral", mins };
  if (mins < 0) return { tone: "overdue", mins };
  if (mins < 30) return { tone: "imminent", mins };
  return { tone: "ok", mins };
}

function firstNameInitial(name) {
  const parts = name.split(" ").filter(Boolean);
  return parts[0] + (parts[1] ? " " + parts[1][0] + "." : "");
}

function TransportCard({ t, onClick, light = false, dense = true, showStatusPill = false }) {
  const s = STATUS[t.status];
  const isCancelled = t.status === "cancelado";
  const isDone = t.status === "concluido";
  const isPendente = t.status === "pendente_revisao";
  const dl = deadlineState(t);

  // Card chrome
  const cardBase = cx(
    "group relative flex items-center gap-2 pl-3 pr-2.5 select-none cursor-pointer",
    "transition-all",
    dense ? "h-12" : "h-14",
    light
      ? "bg-white hover:bg-zinc-50 text-zinc-900 ring-1 ring-zinc-200/80 hover:ring-zinc-300 shadow-[0_1px_0_0_rgba(15,19,24,0.04)]"
      : "bg-ink-150 hover:bg-ink-200 ring-1 ring-white/[0.06] hover:ring-white/[0.12]",
    "rounded-md overflow-hidden",
    isDone && "opacity-60",
    "hover:translate-y-[-0.5px]",
  );

  // Left border (status color) — drawn as a pseudo via absolute span (handles double border too)
  const borderBase = cx(
    "absolute left-0 top-0 bottom-0 w-1",
    s.dot, // uses bg color
  );

  // Urgency override visuals
  let urgentRing = "";
  if (dl.tone === "imminent") {
    urgentRing = light
      ? "ring-1 ring-rose-300 shadow-[inset_3px_0_0_0_rgba(244,63,94,0.6),inset_5px_0_0_0_white,inset_9px_0_0_0_rgba(244,63,94,0.6)]"
      : "ring-1 ring-rose-500/40 shadow-[inset_3px_0_0_0_rgba(244,63,94,0.9),inset_5px_0_0_0_#11151c,inset_9px_0_0_0_rgba(244,63,94,0.9)]";
  } else if (dl.tone === "overdue") {
    urgentRing = light
      ? "ring-1 ring-rose-400 shadow-[inset_4px_0_0_0_#e11d48]"
      : "ring-1 ring-rose-500/40 shadow-[inset_4px_0_0_0_#e11d48]";
  }

  const card = (
    <div className={cx(cardBase, urgentRing)} onClick={onClick} tabIndex={0} role="button">
      {/* default left status border (suppressed when an urgency override is drawing the inset) */}
      {dl.tone !== "imminent" && dl.tone !== "overdue" && <span className={borderBase} />}

      {/* Cancel diagonal stripes overlay */}
      {isCancelled && <span className="absolute inset-0 stripe-bg pointer-events-none" />}

      {/* Tipo icon */}
      <span
        className={cx(
          "shrink-0 inline-flex items-center justify-center w-5 h-5 rounded",
          light ? "text-zinc-500" : "text-zinc-400",
          isCancelled && "line-through",
        )}
      >
        <Tooltip label={tipoLabel(t.tipo)}>
          <Icon name={tipoIcon(t.tipo)} size={14} />
        </Tooltip>
      </span>

      {/* Pendente revisão alert icon */}
      {isPendente && (
        <span className="shrink-0 text-amber-500">
          <Icon name="AlertTriangle" size={14} />
        </span>
      )}

      {/* Destino + time + procedimento */}
      <div className="min-w-0 flex-1 flex items-center gap-1.5">
        <span
          className={cx(
            "truncate font-semibold tracking-tight text-[13.5px] leading-none",
            isCancelled && "line-through",
            light ? "text-zinc-900" : "text-zinc-50",
          )}
          title={t.destino}
        >
          {abbrevDestino(t.destino)}
        </span>
        <span className={cx("text-zinc-500 text-[12px] leading-none", light && "text-zinc-400")}>·</span>
        <span
          className={cx(
            "font-mono text-[12.5px] leading-none tabular-nums",
            dl.tone === "overdue"
              ? "text-rose-400"
              : dl.tone === "imminent"
              ? "text-rose-300"
              : light
              ? "text-zinc-700"
              : "text-zinc-300",
            isCancelled && "line-through",
          )}
        >
          {t.janela ? t.janela : `${dl.tone !== "ok" && dl.mins < 0 ? "" : ""}${fmtHHMM(t.deadline)}`}
        </span>
        <span className={cx("text-zinc-500 text-[12px] leading-none hidden sm:inline", light && "text-zinc-400")}>·</span>
        <span
          className={cx(
            "truncate text-[12px] leading-none hidden sm:inline",
            light ? "text-zinc-500" : "text-zinc-400",
            isCancelled && "line-through",
          )}
        >
          {t.procedimento}
        </span>
      </div>

      {/* Status pill (optional) */}
      {showStatusPill && (
        <StatusPill status={t.status} light={light} className="hidden md:inline-flex" />
      )}

      {/* Overdue clock — pulsing */}
      {dl.tone === "overdue" && (
        <span
          className="shrink-0 text-rose-400 animate-ping-slow"
          aria-label="atrasado"
        >
          <Icon name="Clock" size={14} />
        </span>
      )}

      {/* Hover hint: paciente name (first + initial) */}
      <Tooltip label={`Paciente: ${firstNameInitial(t.paciente)}`}>
        <span
          className={cx(
            "opacity-0 group-hover:opacity-100 transition-opacity",
            light ? "text-zinc-400" : "text-zinc-500",
          )}
        >
          <Icon name="ChevronRight" size={14} />
        </span>
      </Tooltip>
    </div>
  );

  // Pulse wrap if overdue — use CSS animation defined in tailwind config (animate-ping-slow)
  if (dl.tone === "overdue" && !isDone && !isCancelled) {
    return <div className="animate-card-pulse">{card}</div>;
  }
  return card;
}

function abbrevDestino(d) {
  return d
    .replace(/^Hospital /i, "H. ")
    .replace(/^Maternidade /i, "Mat. ")
    .replace(/ — .+$/, "")
    .replace(/ Salvador$/i, "")
    .trim();
}

Object.assign(window, { TransportCard, abbrevDestino, deadlineState });
