/**
 * Intercorrências / motivos de demora de um transporte.
 *
 * Fonte única da taxonomia (mesmo padrão de enums.ts): o pgEnum do banco
 * deriva destas tuplas — mudanças aqui exigem nova migration no @samu-cru/db.
 *
 * Organizado por fase do ciclo de vida do transporte para o painel de
 * gargalos poder agregar por fase ("40% dos atrasos são no destino").
 */

export const DELAY_PHASE = [
  "regulacao",
  "clinica",
  "origem",
  "trajeto",
  "destino",
  "retorno",
  "outro",
] as const;

export type DelayPhase = (typeof DELAY_PHASE)[number];

export const DELAY_PHASE_META: Record<DelayPhase, { label: string }> = {
  regulacao: { label: "Regulação / Recurso" },
  clinica: { label: "Clínica / Equipe" },
  origem: { label: "Origem" },
  trajeto: { label: "Trajeto" },
  destino: { label: "Destino" },
  retorno: { label: "Retorno" },
  outro: { label: "Outro" },
};

export const DELAY_REASON = [
  // Regulação / Recurso
  "demora_viatura_disponivel",
  "frota_toda_ocupada",
  "viatura_pane_mecanica",
  "troca_de_viatura",
  "solicitacao_incompleta",
  "divergencia_tipo_recurso",
  // Clínica / Equipe
  "paciente_instabilizou",
  "basica_pediu_avancada",
  "estabilizacao_na_origem",
  "paciente_recusou",
  "obito",
  // Origem
  "documentacao_incompleta",
  "acompanhante_ausente",
  "paciente_nao_preparado",
  "origem_demorou_entrega",
  "exame_atrasou_liberacao",
  // Trajeto
  "transito_via_interditada",
  "condicoes_climaticas",
  "acesso_dificil",
  // Destino
  "destino_demorou_acolher",
  "retida_esperando_exame",
  "sem_vaga_no_destino",
  "destino_recusou_paciente",
  "maca_retida_no_destino",
  "procedimento_demorou",
  // Retorno
  "desviada_outra_ocorrencia",
  // Fallback
  "outro",
] as const;

export type DelayReason = (typeof DELAY_REASON)[number];

export interface DelayReasonMeta {
  key: DelayReason;
  phase: DelayPhase;
  /** Rótulo do chip — curto de propósito (uso mobile). */
  label: string;
}

export const DELAY_REASON_META: Record<DelayReason, DelayReasonMeta> = {
  demora_viatura_disponivel: {
    key: "demora_viatura_disponivel",
    phase: "regulacao",
    label: "Demora por viatura disponível",
  },
  frota_toda_ocupada: {
    key: "frota_toda_ocupada",
    phase: "regulacao",
    label: "Frota toda ocupada",
  },
  viatura_pane_mecanica: {
    key: "viatura_pane_mecanica",
    phase: "regulacao",
    label: "Viatura quebrou / pane",
  },
  troca_de_viatura: {
    key: "troca_de_viatura",
    phase: "regulacao",
    label: "Troca de viatura",
  },
  solicitacao_incompleta: {
    key: "solicitacao_incompleta",
    phase: "regulacao",
    label: "Solicitação incompleta",
  },
  divergencia_tipo_recurso: {
    key: "divergencia_tipo_recurso",
    phase: "regulacao",
    label: "Divergência USB × USA",
  },
  paciente_instabilizou: {
    key: "paciente_instabilizou",
    phase: "clinica",
    label: "Paciente instabilizou",
  },
  basica_pediu_avancada: {
    key: "basica_pediu_avancada",
    phase: "clinica",
    label: "Básica pediu avançada",
  },
  estabilizacao_na_origem: {
    key: "estabilizacao_na_origem",
    phase: "clinica",
    label: "Estabilização antes de embarcar",
  },
  paciente_recusou: {
    key: "paciente_recusou",
    phase: "clinica",
    label: "Paciente recusou / não colaborou",
  },
  obito: {
    key: "obito",
    phase: "clinica",
    label: "Óbito",
  },
  documentacao_incompleta: {
    key: "documentacao_incompleta",
    phase: "origem",
    label: "Documentação incompleta",
  },
  acompanhante_ausente: {
    key: "acompanhante_ausente",
    phase: "origem",
    label: "Acompanhante ausente",
  },
  paciente_nao_preparado: {
    key: "paciente_nao_preparado",
    phase: "origem",
    label: "Paciente não estava pronto",
  },
  origem_demorou_entrega: {
    key: "origem_demorou_entrega",
    phase: "origem",
    label: "Origem demorou a entregar",
  },
  exame_atrasou_liberacao: {
    key: "exame_atrasou_liberacao",
    phase: "origem",
    label: "Exame atrasou liberação",
  },
  transito_via_interditada: {
    key: "transito_via_interditada",
    phase: "trajeto",
    label: "Trânsito / via interditada",
  },
  condicoes_climaticas: {
    key: "condicoes_climaticas",
    phase: "trajeto",
    label: "Condições climáticas",
  },
  acesso_dificil: {
    key: "acesso_dificil",
    phase: "trajeto",
    label: "Acesso difícil",
  },
  destino_demorou_acolher: {
    key: "destino_demorou_acolher",
    phase: "destino",
    label: "Destino demorou a acolher",
  },
  retida_esperando_exame: {
    key: "retida_esperando_exame",
    phase: "destino",
    label: "Retida esperando exame",
  },
  sem_vaga_no_destino: {
    key: "sem_vaga_no_destino",
    phase: "destino",
    label: "Sem vaga / leito no destino",
  },
  destino_recusou_paciente: {
    key: "destino_recusou_paciente",
    phase: "destino",
    label: "Destino recusou paciente",
  },
  maca_retida_no_destino: {
    key: "maca_retida_no_destino",
    phase: "destino",
    label: "Maca retida no destino",
  },
  procedimento_demorou: {
    key: "procedimento_demorou",
    phase: "destino",
    label: "Procedimento demorou",
  },
  desviada_outra_ocorrencia: {
    key: "desviada_outra_ocorrencia",
    phase: "retorno",
    label: "Desviada p/ outra ocorrência",
  },
  outro: {
    key: "outro",
    phase: "outro",
    label: "Outro",
  },
};

/** Motivos agrupados por fase, na ordem canônica — pronto para render. */
export const DELAY_REASONS_BY_PHASE: ReadonlyArray<{
  phase: DelayPhase;
  label: string;
  reasons: DelayReasonMeta[];
}> = DELAY_PHASE.map((phase) => ({
  phase,
  label: DELAY_PHASE_META[phase].label,
  reasons: DELAY_REASON.filter((r) => DELAY_REASON_META[r].phase === phase).map(
    (r) => DELAY_REASON_META[r],
  ),
}));
