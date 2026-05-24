// App shell with internal tab navigation.

const TABS = [
  { id: "main_dark", label: "Painel · dark", icon: "Monitor" },
  { id: "main_light", label: "Painel · light", icon: "Sun" },
  { id: "detail", label: "Detalhes (Sheet)", icon: "PanelRightOpen" },
  { id: "review", label: "Fila de revisão", icon: "Inbox" },
  { id: "mobile", label: "Mobile", icon: "Smartphone" },
  { id: "components", label: "Componentes", icon: "Boxes" },
];

function ShowcaseChrome({ tab, setTab, children }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top showcase strip */}
      <div className="shrink-0 bg-ink-0 border-b border-white/[0.06]">
        <div className="flex items-center gap-4 px-5 h-12">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gradient-to-br from-rose-500 to-amber-500 text-white">
              <Icon name="Heart" size={13} stroke={2.25} />
            </span>
            <div className="leading-tight">
              <p className="text-[13px] font-semibold tracking-tight text-zinc-50">
                Dashboard de Transportes — SAMU/CRU
              </p>
              <p className="text-[11px] text-zinc-500">
                Hi-fi mockup · React · Tailwind · shadcn-style · Framer Motion · Lucide
              </p>
            </div>
          </div>
          <div className="flex-1" />
          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
            <Icon name="GitBranch" size={11} />
            mock/showcase
          </span>
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-[12px] text-zinc-300 hover:text-zinc-100"
          >
            <Icon name="ExternalLink" size={12} />
            Especificação
          </a>
        </div>
        {/* Tabs */}
        <div className="flex items-stretch gap-1 px-3 -mb-px overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  "shrink-0 relative group inline-flex items-center gap-1.5 px-3 h-10 text-[12.5px] font-medium border-b-2 transition-colors whitespace-nowrap",
                  active
                    ? "text-zinc-50 border-sky-400"
                    : "text-zinc-400 hover:text-zinc-200 border-transparent",
                )}
              >
                <Icon name={t.icon} size={13} className="opacity-90" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 relative">{children}</div>
    </div>
  );
}

// A wrapping container that simulates a 1440-wide monitor when shown in showcase
function FullStage({ children, light = false, minWidth = 1280 }) {
  return (
    <div className={cx("absolute inset-0 overflow-x-auto overflow-y-hidden",
      light ? "bg-zinc-100" : "bg-ink-0")}>
      <div className="h-full relative" style={{ minWidth }}>
        {children}
      </div>
    </div>
  );
}

function DetailShowcase({ light = false }) {
  // Pick a representative transport (the overdue Maria das Graças)
  const t = TRANSPORTS.find((x) => x.id === "T-1001") || TRANSPORTS[0];
  return (
    <div className="relative h-full w-full overflow-hidden">
      <DesktopMainScreen light={light} onSelectTransport={() => {}} />
      <DetailSheet open={true} transport={t} onClose={() => {}} light={light} />
    </div>
  );
}

function App() {
  const [tab, setTab] = useState("main_dark");
  const [selected, setSelected] = useState(null);

  // Keyboard nav
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ShowcaseChrome tab={tab} setTab={setTab}>
      {tab === "main_dark" && (
        <FullStage>
          <DesktopMainScreen light={false} onSelectTransport={setSelected} />
          <DetailSheet
            open={!!selected}
            transport={selected}
            onClose={() => setSelected(null)}
            light={false}
          />
        </FullStage>
      )}
      {tab === "main_light" && (
        <FullStage light>
          <DesktopMainScreen light={true} onSelectTransport={setSelected} />
          <DetailSheet
            open={!!selected}
            transport={selected}
            onClose={() => setSelected(null)}
            light={true}
          />
        </FullStage>
      )}
      {tab === "detail" && (
        <FullStage>
          <DetailShowcase light={false} />
        </FullStage>
      )}
      {tab === "review" && (
        <FullStage>
          <ReviewScreen light={false} />
        </FullStage>
      )}
      {tab === "mobile" && (
        <FullStage>
          <MobileScreen light={false} />
        </FullStage>
      )}
      {tab === "components" && (
        <FullStage>
          <ComponentsScreen light={false} />
        </FullStage>
      )}
    </ShowcaseChrome>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
