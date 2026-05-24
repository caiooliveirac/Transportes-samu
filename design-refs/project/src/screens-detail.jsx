// Detail Sheet (slides from right) — patient details, vitals, timeline, original message.

function maskedCNS(cns) {
  // "704 0030 8924 0528" -> "••• •••• •••• 0528"
  const clean = (cns || "").replace(/\s/g, "");
  const last = clean.slice(-4);
  return "••• •••• •••• " + last;
}

function VitalCell({ label, value, alt = false, mono = true, light = false }) {
  return (
    <div
      className={cx(
        "flex flex-col gap-0.5 p-2 rounded-md min-w-0",
        light ? "bg-zinc-50 ring-1 ring-zinc-200" : "bg-white/[0.03] ring-1 ring-white/[0.06]",
        alt && (light ? "bg-amber-50 ring-amber-200" : "bg-amber-500/10 ring-amber-500/30"),
      )}
    >
      <span className={cx("text-[10px] tracking-wider uppercase font-medium",
        alt ? (light ? "text-amber-700" : "text-amber-300") : (light ? "text-zinc-500" : "text-zinc-500"))}>
        {label}
      </span>
      <span
        className={cx(
          mono && "font-mono tabular-nums",
          "text-[14px] font-semibold leading-none",
          alt
            ? light
              ? "text-amber-800"
              : "text-amber-200"
            : light
            ? "text-zinc-900"
            : "text-zinc-50",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TimelineRow({ ev, last = false, light = false }) {
  return (
    <li className="relative flex gap-3 pb-3">
      {!last && (
        <span
          className={cx("absolute left-[10px] top-5 bottom-0 w-px",
            light ? "bg-zinc-200" : "bg-white/10")}
        />
      )}
      <span
        className={cx(
          "shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full mt-0.5",
          light ? "bg-white ring-1 ring-zinc-200 text-zinc-600" : "bg-ink-200 ring-1 ring-white/10 text-zinc-300",
        )}
      >
        <Icon name={ev.icon || "Dot"} size={11} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx("text-[12.5px] leading-snug", light ? "text-zinc-800" : "text-zinc-200")}>
          {ev.what}
        </p>
        <p className={cx("text-[11px] font-mono", light ? "text-zinc-500" : "text-zinc-500")}>
          {fmtRel(ev.t)} · {ev.who}
        </p>
      </div>
    </li>
  );
}

function DetailSheet({ open, transport, onClose, light = false }) {
  const [revealed, setRevealed] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  useEffect(() => {
    if (!open) {
      setRevealed(false);
      setMsgOpen(false);
    }
  }, [open]);

  if (!transport) return null;
  const t = transport;
  const origem = UNITS.find((u) => u.id === t.origem)?.full || t.origem;
  const dl = deadlineState(t);

  // Vital alterations
  const v = t.sinais;
  const alt = {
    fc: v.fc > 120 || v.fc < 50,
    spo2: v.spo2 < 94,
    gcs: v.gcs < 15,
    temp: v.temp > 37.8 || v.temp < 35.5,
    pa: false,
    fr: v.fr > 24 || v.fr < 10,
  };

  return (
    <Sheet open={open} onClose={onClose} width={520}>
      {/* Header */}
      <div className={cx("flex items-start gap-3 px-5 pt-5 pb-4 border-b",
        light ? "border-zinc-200" : "border-white/[0.06]")}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={cx("font-mono text-[11px]", light ? "text-zinc-500" : "text-zinc-500")}>
              {t.id}
            </span>
            <StatusPill status={t.status} light={light} />
          </div>
          <h2 className={cx("text-[20px] font-semibold tracking-tight leading-tight",
            light ? "text-zinc-900" : "text-zinc-50")}>
            {t.paciente}
          </h2>
          <p className={cx("text-[12.5px] mt-1", light ? "text-zinc-500" : "text-zinc-400")}>
            {t.idade} anos ·{" "}
            <span className="font-mono">
              CNS {revealed ? t.cns : maskedCNS(t.cns)}
            </span>
            <button
              onClick={() => setRevealed((r) => !r)}
              className={cx("ml-1.5 inline-flex items-center gap-1 text-[11px] font-medium px-1.5 h-5 rounded",
                light ? "text-zinc-700 hover:bg-zinc-100 ring-1 ring-zinc-200" : "text-zinc-300 hover:bg-white/5 ring-1 ring-white/10")}
            >
              <Icon name={revealed ? "EyeOff" : "Eye"} size={11} />
              {revealed ? "ocultar" : "revelar"}
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(t.cns)}
              className={cx("ml-1 inline-flex items-center gap-1 text-[11px] font-medium px-1.5 h-5 rounded",
                light ? "text-zinc-700 hover:bg-zinc-100 ring-1 ring-zinc-200" : "text-zinc-300 hover:bg-white/5 ring-1 ring-white/10")}
            >
              <Icon name="Copy" size={11} />
              copiar
            </button>
          </p>
        </div>
        <button
          onClick={onClose}
          className={cx("shrink-0 w-8 h-8 rounded-md inline-flex items-center justify-center",
            light ? "hover:bg-zinc-100 text-zinc-600" : "hover:bg-white/5 text-zinc-400")}
        >
          <Icon name="X" size={16} />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">
        {/* Status + Deadline */}
        <div className="flex items-center gap-2">
          <Select
            value={t.status}
            onChange={() => {}}
            className="flex-1"
            options={STATUS_ORDER.map((k) => ({
              value: k,
              label: STATUS[k].label,
              leading: <span className={cx("w-1.5 h-1.5 rounded-full", STATUS[k].dot)} />,
            }))}
          />
          <div
            className={cx(
              "inline-flex items-center gap-2 h-8 px-2.5 rounded-md font-mono text-[12.5px] tabular-nums",
              dl.tone === "overdue"
                ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30"
                : dl.tone === "imminent"
                ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
                : light
                ? "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
                : "bg-white/[0.04] text-zinc-300 ring-1 ring-white/10",
            )}
          >
            <Icon name="Clock" size={13} />
            {fmtHHMM(t.deadline)} · {fmtRel(t.deadline)}
          </div>
        </div>

        {/* ROTA */}
        <Section label="Rota">
          <div
            className={cx(
              "rounded-md p-3",
              light ? "bg-zinc-50 ring-1 ring-zinc-200" : "bg-white/[0.03] ring-1 ring-white/[0.06]",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className={cx("inline-flex items-center justify-center w-6 h-6 rounded-full",
                  light ? "bg-white ring-1 ring-zinc-300 text-zinc-600" : "bg-ink-200 ring-1 ring-white/15 text-zinc-300")}>
                  <Icon name="MapPin" size={12} />
                </span>
                <span className={cx("w-px h-5", light ? "bg-zinc-300" : "bg-white/20")} />
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/40 text-emerald-300">
                  <Icon name="Building2" size={12} />
                </span>
              </div>
              <div className="min-w-0 flex-1 flex flex-col gap-3">
                <div className="min-w-0">
                  <p className={cx("text-[10px] uppercase tracking-wider font-medium",
                    light ? "text-zinc-500" : "text-zinc-500")}>Origem</p>
                  <p className={cx("text-[13.5px] font-medium truncate",
                    light ? "text-zinc-900" : "text-zinc-50")}>{origem}</p>
                </div>
                <div className="flex items-center gap-1.5 -my-1">
                  <Icon name={tipoIcon(t.tipo)} size={12} className={light ? "text-zinc-500" : "text-zinc-500"} />
                  <span className={cx("text-[11px] font-medium",
                    light ? "text-zinc-600" : "text-zinc-400")}>
                    {tipoLabel(t.tipo)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className={cx("text-[10px] uppercase tracking-wider font-medium",
                    light ? "text-zinc-500" : "text-zinc-500")}>Destino</p>
                  <p className={cx("text-[13.5px] font-medium truncate",
                    light ? "text-zinc-900" : "text-zinc-50")}>{t.destino}</p>
                </div>
              </div>
            </div>
            <div className={cx("mt-3 pt-3 border-t flex items-center gap-2",
              light ? "border-zinc-200" : "border-white/[0.06]")}>
              <Icon name="ClipboardList" size={13} className={light ? "text-zinc-500" : "text-zinc-500"} />
              <span className={cx("text-[12.5px]", light ? "text-zinc-700" : "text-zinc-300")}>
                {t.procedimentoLong || t.procedimento}
              </span>
            </div>
          </div>
        </Section>

        {/* CLÍNICA */}
        <Section label="Clínica · sinais vitais">
          <div className="grid grid-cols-6 gap-1.5">
            <VitalCell label="PA" value={v.pa} light={light} alt={alt.pa} />
            <VitalCell label="FC" value={v.fc} light={light} alt={alt.fc} />
            <VitalCell label="FR" value={v.fr} light={light} alt={alt.fr} />
            <VitalCell label="SpO₂" value={`${v.spo2}%`} light={light} alt={alt.spo2} />
            <VitalCell label="GCS" value={v.gcs} light={light} alt={alt.gcs} />
            <VitalCell label="T°" value={`${v.temp.toFixed(1)}`} light={light} alt={alt.temp} />
          </div>
        </Section>

        {/* HIPÓTESES */}
        <Section label="Hipóteses diagnósticas">
          <div className="flex flex-wrap gap-1.5">
            {(t.hipoteses.length ? t.hipoteses : ["—"]).map((h, i) => (
              <span
                key={i}
                className={cx(
                  "inline-flex items-center gap-1.5 h-6 px-2 rounded text-[12px] font-medium ring-1 ring-inset",
                  light ? "bg-zinc-100 text-zinc-700 ring-zinc-200" : "bg-white/[0.04] text-zinc-200 ring-white/10",
                )}
              >
                <span className={cx("w-1 h-1 rounded-full", light ? "bg-zinc-400" : "bg-zinc-500")} />
                {h}
              </span>
            ))}
          </div>
        </Section>

        {/* TIMELINE */}
        {t.timeline.length > 0 && (
          <Section label="Timeline">
            <ul className="flex flex-col">
              {t.timeline.map((ev, i) => (
                <TimelineRow
                  key={i}
                  ev={ev}
                  last={i === t.timeline.length - 1}
                  light={light}
                />
              ))}
            </ul>
          </Section>
        )}

        {/* MENSAGEM ORIGINAL */}
        {t.mensagem && (
          <Section label="Mensagem original (WhatsApp)">
            <button
              onClick={() => setMsgOpen((o) => !o)}
              className={cx(
                "w-full inline-flex items-center justify-between h-8 px-2.5 rounded-md text-[12px]",
                light ? "bg-zinc-50 hover:bg-zinc-100 ring-1 ring-zinc-200 text-zinc-700" : "bg-white/[0.03] hover:bg-white/[0.05] ring-1 ring-white/[0.06] text-zinc-300",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon name="MessageSquare" size={13} />
                {t.mensagem.split("\n").length} linhas · auditável
              </span>
              <Icon name={msgOpen ? "ChevronUp" : "ChevronDown"} size={13} />
            </button>
            <AnimatePresence>
              {msgOpen && (
                <M.div
                  key="msg-collapse"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <pre className={cx(
                    "mt-2 p-3 rounded-md font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-words",
                    light ? "bg-emerald-50 text-zinc-800 ring-1 ring-emerald-200" : "bg-emerald-500/[0.06] text-zinc-200 ring-1 ring-emerald-500/15",
                  )}>{t.mensagem}</pre>
                </M.div>
              )}
            </AnimatePresence>
          </Section>
        )}

        <div className="h-2" />
      </div>

      {/* Footer */}
      <div
        className={cx(
          "shrink-0 px-5 py-3 border-t flex items-center gap-2",
          light ? "border-zinc-200 bg-white" : "border-white/[0.06] bg-ink-100",
        )}
      >
        <Button variant={light ? "default" : "secondary"}>
          <Icon name="Pencil" size={13} />
          Editar campos
        </Button>
        <div className="flex-1" />
        <Button variant="danger_outline">
          <Icon name="Ban" size={13} />
          Cancelar transporte
        </Button>
      </div>
    </Sheet>
  );
}

Object.assign(window, { DetailSheet, maskedCNS });
