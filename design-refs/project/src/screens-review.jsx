// Review queue — left WhatsApp message + right form with extracted fields.

function ConfidenceHint({ level, light = false }) {
  if (!level || level === "ok") return null;
  if (level === "low")
    return (
      <span className={cx(
        "inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 h-4 rounded",
        "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
        light && "bg-amber-50 text-amber-800 ring-amber-200",
      )}>
        <Icon name="AlertTriangle" size={10} />
        baixa confiança
      </span>
    );
  if (level === "med")
    return (
      <span className={cx(
        "inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 h-4 rounded",
        "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
      )}>
        <Icon name="HelpCircle" size={10} />
        confirmar
      </span>
    );
}

function Field({ label, value, confidence, empty, light = false, mono = false, hint }) {
  const lowConf = confidence === "low";
  const medConf = confidence === "med";
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1.5">
        <span className={cx("text-[11px] font-medium uppercase tracking-wider",
          light ? "text-zinc-500" : "text-zinc-400")}>
          {label}
        </span>
        <ConfidenceHint level={confidence} light={light} />
        {empty && (
          <span className={cx(
            "inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 h-4 rounded",
            "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
            light && "bg-rose-50 text-rose-700 ring-rose-200",
          )}>
            <Icon name="CircleAlert" size={10} />
            vazio
          </span>
        )}
      </label>
      <input
        defaultValue={value}
        placeholder={empty ? "—" : ""}
        className={cx(
          "h-9 px-2.5 rounded-md text-[13px] outline-none",
          mono && "font-mono",
          light ? "bg-white text-zinc-900 placeholder:text-zinc-400" : "bg-ink-200 text-zinc-100 placeholder:text-zinc-500",
          // base ring
          light ? "ring-1 ring-zinc-200 focus:ring-zinc-400" : "ring-1 ring-white/10 focus:ring-white/30",
          // override ring on conditions
          lowConf && "!ring-amber-500/50 focus:!ring-amber-400",
          medConf && "!ring-sky-500/40 focus:!ring-sky-400",
          empty && "!ring-rose-500/40 focus:!ring-rose-400",
        )}
      />
      {hint && (
        <span className={cx("text-[10.5px]", light ? "text-zinc-500" : "text-zinc-500")}>{hint}</span>
      )}
    </div>
  );
}

// Renders a WhatsApp-flavored message preserving asterisks as bold.
function RichMessage({ text, light = false }) {
  const lines = (text || "").split("\n");
  return (
    <div className={cx(
      "font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap",
      light ? "text-zinc-800" : "text-zinc-200",
    )}>
      {lines.map((line, i) => {
        // tokenize *bold* runs
        const parts = [];
        let rest = line;
        let m;
        const rx = /\*([^*]+)\*/g;
        let lastIdx = 0;
        while ((m = rx.exec(rest)) !== null) {
          if (m.index > lastIdx) parts.push(rest.slice(lastIdx, m.index));
          parts.push(<strong key={`${i}-${m.index}`} className={cx("font-semibold", light ? "text-zinc-900" : "text-zinc-50")}>{m[1]}</strong>);
          lastIdx = m.index + m[0].length;
        }
        if (lastIdx < rest.length) parts.push(rest.slice(lastIdx));
        return (
          <div key={i} className={line.trim() === "" ? "h-2" : ""}>
            {parts.length ? parts : line}
          </div>
        );
      })}
    </div>
  );
}

function ReviewScreen({ light = false }) {
  const sample = TRANSPORTS.find((t) => t.status === "pendente_revisao");
  const queue = TRANSPORTS.filter((t) => t.status === "pendente_revisao");

  return (
    <div
      className={cx(
        "h-full flex flex-col",
        light ? "theme-light bg-zinc-50 text-zinc-900" : "bg-ink-0 text-zinc-200",
      )}
    >
      <Header light={light} filter="pendentes" setFilter={() => {}} />
      {/* Subnav */}
      <div className={cx("h-10 flex items-center gap-2 px-4 border-b shrink-0",
        light ? "bg-white border-zinc-200" : "bg-ink-50 border-white/[0.06]")}>
        <span className={cx("inline-flex items-center gap-2 text-[13px] font-medium",
          light ? "text-zinc-900" : "text-zinc-100")}>
          <Icon name="Inbox" size={14} />
          Fila de revisão
        </span>
        <Badge tone="amber">{queue.length} mensagens</Badge>
        <span className={cx("text-[12px] ml-3", light ? "text-zinc-500" : "text-zinc-500")}>
          Confiança média do parser nas últimas 24h: <span className="font-mono text-emerald-400">82%</span>
        </span>
        <div className="flex-1" />
        <Button variant={light ? "default" : "secondary"} size="sm">
          <Icon name="Filter" size={12} />
          Filtrar
        </Button>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-[40%_60%]">
        {/* Left: queue + message */}
        <div className={cx("flex flex-col border-r overflow-hidden",
          light ? "bg-zinc-100/50 border-zinc-200" : "bg-ink-50 border-white/[0.06]")}>
          {/* Mini queue */}
          <div className={cx("px-3 py-2 border-b flex flex-col gap-1",
            light ? "border-zinc-200" : "border-white/[0.06]")}>
            {queue.map((q, i) => (
              <button
                key={q.id}
                className={cx(
                  "flex items-center gap-2 px-2 h-9 rounded-md text-left",
                  i === 0
                    ? light
                      ? "bg-white ring-1 ring-zinc-300"
                      : "bg-ink-200 ring-1 ring-white/15"
                    : light
                    ? "hover:bg-white"
                    : "hover:bg-white/5",
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className={cx("font-mono text-[11px]", light ? "text-zinc-500" : "text-zinc-500")}>
                  {q.id}
                </span>
                <span className={cx("text-[12.5px] font-medium truncate flex-1",
                  light ? "text-zinc-900" : "text-zinc-100")}>
                  {UNITS.find((u) => u.id === q.origem)?.short}
                </span>
                <span className={cx("text-[11px] font-mono", light ? "text-zinc-500" : "text-zinc-500")}>
                  há 2min
                </span>
              </button>
            ))}
            {queue.length < 2 && (
              <div className={cx("px-2 py-3 rounded-md text-[12px] text-center",
                light ? "text-zinc-500 bg-white/50 ring-1 ring-dashed ring-zinc-200"
                      : "text-zinc-500 ring-1 ring-dashed ring-white/10")}>
                Nada mais aguardando. <span className="text-emerald-400">✓</span>
              </div>
            )}
          </div>

          {/* Message preview */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={cx("inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30")}>
                <Icon name="MessageCircle" size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cx("text-[13px] font-medium", light ? "text-zinc-900" : "text-zinc-100")}>
                  Enfª Maria · UPA Brotas
                </p>
                <p className={cx("text-[11px] font-mono", light ? "text-zinc-500" : "text-zinc-500")}>
                  +55 71 9••••-2841 · há 2min
                </p>
              </div>
              <Button variant="ghost" size="icon">
                <Icon name="Copy" size={13} />
              </Button>
            </div>
            <div className={cx("rounded-md p-3",
              light ? "bg-white ring-1 ring-zinc-200" : "bg-emerald-500/[0.04] ring-1 ring-emerald-500/15")}>
              <RichMessage text={sample.mensagem} light={light} />
            </div>
            <p className={cx("text-[11px] mt-2 font-mono", light ? "text-zinc-500" : "text-zinc-500")}>
              Hash SHA-256 · 9a3f…b127 · arquivada permanentemente
            </p>
          </div>
        </div>

        {/* Right: form */}
        <div className="flex flex-col overflow-hidden">
          <div className={cx("flex items-center gap-3 px-5 py-3 border-b",
            light ? "border-zinc-200 bg-white" : "border-white/[0.06] bg-ink-50")}>
            <span className={cx("inline-flex items-center justify-center w-6 h-6 rounded-md",
              light ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200" : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30")}>
              <Icon name="Sparkles" size={13} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cx("text-[13px] font-medium", light ? "text-zinc-900" : "text-zinc-100")}>
                Campos extraídos — revisar e aprovar
              </p>
              <p className={cx("text-[11.5px]", light ? "text-zinc-500" : "text-zinc-500")}>
                3 campos com baixa confiança · 0 vazios
              </p>
            </div>
            <Badge tone="emerald">conf. 76%</Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Paciente" value={sample.paciente} light={light} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Idade" value={sample.idade} light={light} mono />
              <Field label="CNS" value="•••• •••• •••• 0528" light={light} mono />
            </div>

            <Field
              label="Origem"
              value={UNITS.find((u) => u.id === sample.origem)?.full}
              light={light}
            />
            <Field
              label="Destino"
              value={sample.destino}
              confidence="low"
              light={light}
              hint="parser encontrou 2 hospitais possíveis"
            />

            <Field
              label="Procedimento / motivo"
              value={sample.procedimentoLong}
              confidence="med"
              light={light}
            />
            <Field
              label="Deadline"
              value="hoje, à tarde"
              confidence="low"
              light={light}
              mono
              hint="texto não-estruturado — confirme horário"
            />

            <div className="col-span-2">
              <label className={cx("text-[11px] font-medium uppercase tracking-wider block mb-1",
                light ? "text-zinc-500" : "text-zinc-400")}>
                Tipo de viagem
              </label>
              <div className={cx("inline-flex rounded-md p-0.5",
                light ? "bg-zinc-100 ring-1 ring-zinc-200" : "bg-white/[0.04] ring-1 ring-white/10")}>
                {[
                  { v: "one_way", l: "Ida (one-way)", i: "ArrowRight" },
                  { v: "round_trip", l: "Ida e volta", i: "RefreshCcw" },
                  { v: "unknown", l: "?", i: "HelpCircle" },
                ].map((opt) => {
                  const active = opt.v === sample.tipo;
                  return (
                    <button
                      key={opt.v}
                      className={cx(
                        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] font-medium",
                        active
                          ? light
                            ? "bg-white text-zinc-900 ring-1 ring-zinc-200 shadow-sm"
                            : "bg-ink-300 text-zinc-50 ring-1 ring-white/10"
                          : light
                          ? "text-zinc-600 hover:text-zinc-900"
                          : "text-zinc-400 hover:text-zinc-100",
                      )}
                    >
                      <Icon name={opt.i} size={11} />
                      {opt.l}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="PA" value={sample.sinais.pa} light={light} mono />
            <Field label="FC · FR · SpO₂" value={`${sample.sinais.fc} · ${sample.sinais.fr} · ${sample.sinais.spo2}%`} light={light} mono />
            <Field label="GCS" value={sample.sinais.gcs} light={light} mono />
            <Field label="Temperatura" value={`${sample.sinais.temp.toFixed(1)} °C`} light={light} mono />

            <div className="col-span-2">
              <Field
                label="Hipóteses (separe por vírgula)"
                value="Hemorragia intracraniana · HAS desc."
                confidence="low"
                light={light}
                hint="parser inferiu da menção a TC + PA elevada"
              />
            </div>
          </div>

          <div className={cx("flex items-center gap-2 px-5 py-3 border-t shrink-0",
            light ? "border-zinc-200 bg-white" : "border-white/[0.06] bg-ink-100")}>
            <Button variant={light ? "ghost" : "ghost"}>
              <Icon name="ArrowLeft" size={13} />
              Voltar para fila
            </Button>
            <div className="flex-1" />
            <Button variant="danger_outline">
              <Icon name="Trash2" size={13} />
              Descartar mensagem
            </Button>
            <Button variant="primary">
              <Icon name="Check" size={13} />
              Salvar e aprovar
              <Kbd className="bg-white/20 ring-white/30">⌘↵</Kbd>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ReviewScreen, RichMessage });
