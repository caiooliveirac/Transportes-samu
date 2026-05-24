// Components showcase tab — all card states with labels.

function CardCase({ label, sublabel, t, light = false }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="w-[340px]">
        <TransportCard t={t} light={light} />
      </div>
      <div className="px-1">
        <p className={cx("text-[11px] font-mono",
          light ? "text-zinc-700" : "text-zinc-300")}>
          {label}
        </p>
        {sublabel && (
          <p className={cx("text-[10.5px]",
            light ? "text-zinc-500" : "text-zinc-500")}>
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}

function makeT(over) {
  return T({
    paciente: "João da Silva",
    idade: 60,
    origem: "upa_pirajá",
    destino: "Hospital Manoel Victorino",
    procedimento: "Internamento",
    deadline: inMin(45),
    tipo: "one_way",
    status: "novo",
    ...over,
  });
}

function ComponentsScreen({ light = false }) {
  const cases = [
    { label: "novo", sub: "sky · base", t: makeT({ status: "novo", deadline: inMin(60) }) },
    { label: "aguardando_viatura", sub: "slate · base", t: makeT({ status: "aguardando_viatura", deadline: inMin(50) }) },
    { label: "viatura_designada", sub: "violet", t: makeT({ status: "viatura_designada", deadline: inMin(80), tipo: "round_trip", destino: "HGCA — Hosp. Geral Cleriston Andrade", procedimento: "Avaliação cardio." }) },
    { label: "em_deslocamento_origem", sub: "indigo", t: makeT({ status: "em_deslocamento_origem", deadline: inMin(40), destino: "Hospital Couto Maia" }) },
    { label: "paciente_embarcado", sub: "blue-600", t: makeT({ status: "paciente_embarcado", deadline: inMin(30), destino: "Hospital Roberto Santos" }) },
    { label: "em_deslocamento_destino", sub: "cyan", t: makeT({ status: "em_deslocamento_destino", deadline: inMin(20), destino: "Hospital Sta. Izabel" }) },
    { label: "chegou_destino", sub: "emerald", t: makeT({ status: "chegou_destino", deadline: inMin(-10), destino: "Hospital Ana Nery" }) },
    { label: "retornando_origem", sub: "teal · round-trip", t: makeT({ status: "retornando_origem", deadline: inMin(90), tipo: "round_trip", procedimento: "Consulta neuro." }) },
    { label: "concluido", sub: "zinc · opacity-60", t: makeT({ status: "concluido", deadline: inMin(-120), destino: "Hospital Português" }) },
    { label: "cancelado", sub: "stripes · strikethrough", t: makeT({ status: "cancelado", deadline: inMin(60), procedimento: "Avaliação cardio." }) },
    { label: "pendente_revisao", sub: "amber · alert icon", t: makeT({ status: "pendente_revisao", deadline: inMin(90), destino: "Hospital Roberto Santos", procedimento: "TC crânio" }) },
    { label: "atrasado", sub: "rose · pulsando + clock", t: makeT({ status: "em_deslocamento_destino", deadline: inMin(-22), destino: "Hospital Geral do Estado", procedimento: "Trauma neurocir." }) },
    { label: "deadline próximo", sub: "border dupla rose-500 (<30min)", t: makeT({ status: "aguardando_viatura", deadline: inMin(8), destino: "Hospital Roberto Santos", procedimento: "Sepse" }) },
    { label: "round-trip · unknown tipo", sub: "ícone HelpCircle", t: makeT({ status: "novo", tipo: "unknown", deadline: inMin(60), destino: "Hospital São Rafael", procedimento: "—" }) },
  ];

  return (
    <div className={cx("h-full overflow-auto p-8",
      light ? "theme-light bg-zinc-50 text-zinc-900" : "bg-ink-0 text-zinc-200")}>
      <div className="max-w-[1280px] mx-auto flex flex-col gap-10">
        {/* Card states */}
        <section>
          <div className="mb-5">
            <h2 className={cx("text-[20px] font-semibold tracking-tight",
              light ? "text-zinc-900" : "text-zinc-50")}>
              Card de transporte · estados
            </h2>
            <p className={cx("text-[13px] mt-1", light ? "text-zinc-600" : "text-zinc-400")}>
              Componente crítico. Altura 48px. Borda lateral 4px com cor do status. Mascaramento de PII implícito.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
            {cases.map((c, i) => (
              <CardCase key={i} label={c.label} sublabel={c.sub} t={c.t} light={light} />
            ))}
          </div>
        </section>

        {/* Status pills */}
        <section>
          <h2 className={cx("text-[20px] font-semibold tracking-tight mb-4",
            light ? "text-zinc-900" : "text-zinc-50")}>
            Status pills
          </h2>
          <div className="flex flex-wrap gap-2">
            {STATUS_ORDER.map((s) => (
              <StatusPill key={s} status={s} light={light} />
            ))}
          </div>
        </section>

        {/* Buttons */}
        <section>
          <h2 className={cx("text-[20px] font-semibold tracking-tight mb-4",
            light ? "text-zinc-900" : "text-zinc-50")}>
            Buttons
          </h2>
          <div className={cx("rounded-md p-5 flex flex-wrap gap-3",
            light ? "bg-white ring-1 ring-zinc-200" : "bg-ink-100 ring-1 ring-white/[0.06]")}>
            <Button variant="primary"><Icon name="Plus" size={13} />Novo</Button>
            <Button variant="default"><Icon name="Pencil" size={13} />Editar</Button>
            <Button variant="secondary"><Icon name="Filter" size={13} />Filtrar</Button>
            <Button variant="outline"><Icon name="Settings" size={13} />Configurar</Button>
            <Button variant="ghost"><Icon name="X" size={13} />Fechar</Button>
            <Button variant="danger_outline"><Icon name="Ban" size={13} />Cancelar transporte</Button>
            <Button variant="destructive"><Icon name="Trash2" size={13} />Apagar</Button>
            <Button variant="primary" size="sm">Pequeno</Button>
            <Button variant="primary" size="lg">Grande</Button>
            <Button variant="ghost" size="icon"><Icon name="MoreHorizontal" size={14} /></Button>
          </div>
        </section>

        {/* Vital cells */}
        <section>
          <h2 className={cx("text-[20px] font-semibold tracking-tight mb-4",
            light ? "text-zinc-900" : "text-zinc-50")}>
            Sinais vitais — normal vs. alterado
          </h2>
          <div className="grid grid-cols-6 gap-2 max-w-2xl">
            <VitalCell label="PA" value="120/80" light={light} />
            <VitalCell label="FC" value="88" light={light} />
            <VitalCell label="FR" value="18" light={light} />
            <VitalCell label="SpO₂" value="97%" light={light} />
            <VitalCell label="GCS" value="15" light={light} />
            <VitalCell label="T°" value="36.6" light={light} />

            <VitalCell label="PA" value="90/55" light={light} alt />
            <VitalCell label="FC" value="132" light={light} alt />
            <VitalCell label="FR" value="28" light={light} alt />
            <VitalCell label="SpO₂" value="89%" light={light} alt />
            <VitalCell label="GCS" value="9" light={light} alt />
            <VitalCell label="T°" value="39.0" light={light} alt />
          </div>
        </section>

        {/* Confidence + Field */}
        <section>
          <h2 className={cx("text-[20px] font-semibold tracking-tight mb-4",
            light ? "text-zinc-900" : "text-zinc-50")}>
            Form fields · confiança do parser
          </h2>
          <div className={cx("rounded-md p-5 grid grid-cols-2 gap-4 max-w-3xl",
            light ? "bg-white ring-1 ring-zinc-200" : "bg-ink-100 ring-1 ring-white/[0.06]")}>
            <Field label="Paciente" value="João da Silva" light={light} />
            <Field label="Destino" value="" empty light={light} />
            <Field label="Procedimento" value="Avaliação cardiológica" confidence="med" light={light} />
            <Field label="Deadline" value="hoje à tarde" confidence="low" light={light} mono />
          </div>
        </section>

        {/* Misc */}
        <section>
          <h2 className={cx("text-[20px] font-semibold tracking-tight mb-4",
            light ? "text-zinc-900" : "text-zinc-50")}>
            Diversos
          </h2>
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-2">
              <Kbd>⌘</Kbd><Kbd>K</Kbd>
              <span className={cx("text-[12px]", light ? "text-zinc-600" : "text-zinc-400")}>command menu</span>
            </div>
            <div className="flex items-center gap-2">
              <Kbd>/</Kbd>
              <span className={cx("text-[12px]", light ? "text-zinc-600" : "text-zinc-400")}>focar busca</span>
            </div>
            <Badge tone="amber"><Icon name="AlertTriangle" size={10} />pendente</Badge>
            <Badge tone="rose"><Icon name="Clock" size={10} />atrasado</Badge>
            <Badge tone="emerald"><Icon name="Check" size={10} />ok</Badge>
            <Badge tone="sky">novo</Badge>
            <Badge tone="violet">designado</Badge>
          </div>
        </section>

        <div className="h-8" />
      </div>
    </div>
  );
}

Object.assign(window, { ComponentsScreen });
