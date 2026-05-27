"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DESTINOS } from "@samu-cru/shared";

type TripType = "one_way" | "round_trip" | "unknown";

interface FormState {
  patientName: string;
  patientBirthDate: string;
  patientAgeText: string;
  patientCns: string;
  patientCpf: string;
  destinationName: string;
  procedure: string;
  procedureDate: string;
  procedureTime: string;
  deadlineDate: string;
  deadlineTime: string;
  tripType: TripType;
  vitalsPa: string;
  vitalsFc: string;
  vitalsFr: string;
  vitalsSpo2: string;
  vitalsTemp: string;
  vitalsGlasgow: string;
  vitalsDextro: string;
  diagnosesText: string;
  notes: string;
}

const empty: FormState = {
  patientName: "",
  patientBirthDate: "",
  patientAgeText: "",
  patientCns: "",
  patientCpf: "",
  destinationName: "",
  procedure: "",
  procedureDate: "",
  procedureTime: "",
  deadlineDate: "",
  deadlineTime: "",
  tripType: "one_way",
  vitalsPa: "",
  vitalsFc: "",
  vitalsFr: "",
  vitalsSpo2: "",
  vitalsTemp: "",
  vitalsGlasgow: "",
  vitalsDextro: "",
  diagnosesText: "",
  notes: "",
};

function inputCls(extra = "") {
  return `surface-elevated w-full rounded-lg px-3 py-2 text-[14px] text-zinc-50 outline-none focus:ring-2 focus:ring-[color:var(--color-accent-info)] placeholder:text-zinc-500 ${extra}`;
}

function labelCls() {
  return "flex flex-col gap-1.5";
}

function labelText() {
  return "text-[11.5px] font-medium tracking-wide text-zinc-400 uppercase";
}

export function SolicitarForm() {
  const router = useRouter();
  const [s, setS] = useState<FormState>(empty);
  const [showVitals, setShowVitals] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, val: FormState[K]) {
    setS((prev) => ({ ...prev, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!s.patientBirthDate && !s.patientAgeText) {
      setError("Informe data de nascimento OU idade.");
      setSubmitting(false);
      return;
    }

    const deadlineAt =
      s.deadlineDate && s.deadlineTime
        ? new Date(`${s.deadlineDate}T${s.deadlineTime}:00`).toISOString()
        : "";

    const payload = {
      patientName: s.patientName,
      patientBirthDate: s.patientBirthDate,
      patientAgeText: s.patientAgeText,
      patientCns: s.patientCns,
      patientCpf: s.patientCpf,
      destinationName: s.destinationName,
      procedure: s.procedure,
      procedureDate: s.procedureDate,
      procedureTime: s.procedureTime,
      deadlineAt,
      tripType: s.tripType,
      vitals: {
        pa: s.vitalsPa || undefined,
        fc: s.vitalsFc || undefined,
        fr: s.vitalsFr || undefined,
        spo2: s.vitalsSpo2 || undefined,
        temp: s.vitalsTemp || undefined,
        glasgow: s.vitalsGlasgow || undefined,
        dextro: s.vitalsDextro || undefined,
      },
      diagnosesText: s.diagnosesText,
      notes: s.notes,
    };

    try {
      const r = await fetch("/api/solicitar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(
          j.message ||
            (j.issues?.[0]?.message
              ? `${j.issues[0].path?.join(".")}: ${j.issues[0].message}`
              : "Não foi possível enviar."),
        );
        setSubmitting(false);
        return;
      }
      setDone(j.id);
      setS(empty);
      setShowVitals(false);
      setSubmitting(false);
      setTimeout(() => router.push("/solicitar/minhas"), 1200);
    } catch {
      setError("Erro de rede.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {/* Paciente */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[11px] font-semibold tracking-[0.15em] text-[color:var(--color-ice)] uppercase">
          Paciente
        </legend>
        <label className={labelCls()}>
          <span className={labelText()}>Nome completo *</span>
          <input
            required
            value={s.patientName}
            onChange={(e) => update("patientName", e.target.value)}
            className={inputCls()}
            placeholder="Fulano de Tal"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelCls()}>
            <span className={labelText()}>Data de nascimento</span>
            <input
              type="date"
              value={s.patientBirthDate}
              onChange={(e) => update("patientBirthDate", e.target.value)}
              className={inputCls()}
            />
          </label>
          <label className={labelCls()}>
            <span className={labelText()}>Ou idade aproximada</span>
            <input
              value={s.patientAgeText}
              onChange={(e) => update("patientAgeText", e.target.value)}
              placeholder="65a, 8m, 2 anos"
              className={inputCls()}
            />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelCls()}>
            <span className={labelText()}>CNS</span>
            <input
              value={s.patientCns}
              onChange={(e) => update("patientCns", e.target.value)}
              inputMode="numeric"
              maxLength={18}
              className={inputCls()}
            />
          </label>
          <label className={labelCls()}>
            <span className={labelText()}>CPF</span>
            <input
              value={s.patientCpf}
              onChange={(e) => update("patientCpf", e.target.value)}
              inputMode="numeric"
              maxLength={14}
              className={inputCls()}
            />
          </label>
        </div>
      </fieldset>

      {/* Rota / Procedimento */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[11px] font-semibold tracking-[0.15em] text-[color:var(--color-gold)] uppercase">
          Destino & procedimento
        </legend>
        <label className={labelCls()}>
          <span className={labelText()}>Destino *</span>
          <input
            list="destinos-list"
            required
            value={s.destinationName}
            onChange={(e) => update("destinationName", e.target.value)}
            className={inputCls()}
            placeholder="Hospital ou clínica"
          />
          <datalist id="destinos-list">
            {DESTINOS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </label>
        <label className={labelCls()}>
          <span className={labelText()}>Procedimento / motivo *</span>
          <textarea
            required
            value={s.procedure}
            onChange={(e) => update("procedure", e.target.value)}
            rows={3}
            className={inputCls()}
            placeholder="Ex.: Internamento por insuficiência respiratória; tomografia de crânio; consulta cardio…"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className={labelCls()}>
            <span className={labelText()}>Data apresentação</span>
            <input
              type="date"
              value={s.procedureDate}
              onChange={(e) => update("procedureDate", e.target.value)}
              className={inputCls()}
            />
          </label>
          <label className={labelCls()}>
            <span className={labelText()}>Horário</span>
            <input
              value={s.procedureTime}
              onChange={(e) => update("procedureTime", e.target.value)}
              placeholder="14h, IMEDIATO, até 18h…"
              className={inputCls()}
            />
          </label>
          <label className={labelCls()}>
            <span className={labelText()}>Tipo de transporte</span>
            <select
              value={s.tripType}
              onChange={(e) => update("tripType", e.target.value as TripType)}
              className={inputCls()}
            >
              <option value="one_way">Só ida</option>
              <option value="round_trip">Ida e volta</option>
              <option value="unknown">A definir</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelCls()}>
            <span className={labelText()}>Prazo (data)</span>
            <input
              type="date"
              value={s.deadlineDate}
              onChange={(e) => update("deadlineDate", e.target.value)}
              className={inputCls()}
            />
          </label>
          <label className={labelCls()}>
            <span className={labelText()}>Prazo (hora)</span>
            <input
              type="time"
              value={s.deadlineTime}
              onChange={(e) => update("deadlineTime", e.target.value)}
              className={inputCls()}
            />
          </label>
        </div>
      </fieldset>

      {/* Clínica */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 flex items-center justify-between text-[11px] font-semibold tracking-[0.15em] text-[color:var(--color-warm-green)] uppercase">
          <span>Clínica (opcional)</span>
          <button
            type="button"
            onClick={() => setShowVitals((v) => !v)}
            className="text-[11px] text-zinc-400 normal-case hover:text-zinc-200"
          >
            {showVitals ? "ocultar sinais vitais" : "+ sinais vitais"}
          </button>
        </legend>
        <label className={labelCls()}>
          <span className={labelText()}>Hipóteses diagnósticas</span>
          <textarea
            value={s.diagnosesText}
            onChange={(e) => update("diagnosesText", e.target.value)}
            rows={2}
            className={inputCls()}
            placeholder="Separe por vírgula: HAS, AVC isquêmico, pneumonia"
          />
        </label>
        {showVitals && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className={labelCls()}>
              <span className={labelText()}>PA</span>
              <input
                value={s.vitalsPa}
                onChange={(e) => update("vitalsPa", e.target.value)}
                placeholder="120x80"
                className={inputCls()}
              />
            </label>
            <label className={labelCls()}>
              <span className={labelText()}>FC</span>
              <input
                value={s.vitalsFc}
                onChange={(e) => update("vitalsFc", e.target.value)}
                inputMode="numeric"
                placeholder="bpm"
                className={inputCls()}
              />
            </label>
            <label className={labelCls()}>
              <span className={labelText()}>FR</span>
              <input
                value={s.vitalsFr}
                onChange={(e) => update("vitalsFr", e.target.value)}
                inputMode="numeric"
                placeholder="irpm"
                className={inputCls()}
              />
            </label>
            <label className={labelCls()}>
              <span className={labelText()}>SpO₂</span>
              <input
                value={s.vitalsSpo2}
                onChange={(e) => update("vitalsSpo2", e.target.value)}
                inputMode="numeric"
                placeholder="%"
                className={inputCls()}
              />
            </label>
            <label className={labelCls()}>
              <span className={labelText()}>Temp</span>
              <input
                value={s.vitalsTemp}
                onChange={(e) => update("vitalsTemp", e.target.value)}
                inputMode="decimal"
                placeholder="°C"
                className={inputCls()}
              />
            </label>
            <label className={labelCls()}>
              <span className={labelText()}>Glasgow</span>
              <input
                value={s.vitalsGlasgow}
                onChange={(e) => update("vitalsGlasgow", e.target.value)}
                inputMode="numeric"
                placeholder="3-15"
                className={inputCls()}
              />
            </label>
            <label className={labelCls()}>
              <span className={labelText()}>Dextro</span>
              <input
                value={s.vitalsDextro}
                onChange={(e) => update("vitalsDextro", e.target.value)}
                inputMode="numeric"
                placeholder="mg/dL"
                className={inputCls()}
              />
            </label>
          </div>
        )}
      </fieldset>

      <label className={labelCls()}>
        <span className={labelText()}>Observações</span>
        <textarea
          value={s.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={2}
          className={inputCls()}
          placeholder="Algo que o regulador precise saber"
        />
      </label>

      {error && (
        <div className="rounded-lg border border-[color:var(--color-accent-fraud)]/30 bg-[color:var(--color-accent-fraud)]/10 px-3 py-2 text-[13px] text-[color:var(--color-accent-fraud)]">
          {error}
        </div>
      )}
      {done && (
        <div className="rounded-lg border border-[color:var(--color-accent-confirm)]/30 bg-[color:var(--color-accent-confirm)]/10 px-3 py-2 text-[13px] text-[color:var(--color-accent-confirm)]">
          Solicitação enviada. Redirecionando para &ldquo;Minhas solicitações&rdquo;…
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 inline-flex items-center justify-center rounded-lg bg-[color:var(--color-accent-confirm)] px-4 py-3 text-[14px] font-semibold text-zinc-900 shadow-lg shadow-[color:var(--color-accent-confirm)]/20 transition-all hover:brightness-110 disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Enviar solicitação"}
      </button>
    </form>
  );
}
