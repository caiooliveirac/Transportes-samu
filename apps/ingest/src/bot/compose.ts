import {
  MISSING_DESTINATION,
  MISSING_PATIENT_NAME,
  MISSING_PROCEDURE,
} from "@samu-cru/shared";

/**
 * O que o bot perguntaria no grupo.
 *
 * Duas regras que valem mais que o texto em si:
 *
 * 1. **Ele assina.** A sessão do gateway é o número do chefe de plantão —
 *    mensagem sem assinatura chega como se fosse ele perguntando, e quem
 *    responder vai achar que falou com uma pessoa. Num grupo que move
 *    ambulância, quem falou importa tanto quanto o que foi dito.
 * 2. **Ele pergunta uma coisa só.** A resposta vai voltar como citação, e
 *    pergunta dupla devolve resposta ambígua — que é exatamente o
 *    problema que ele existe para resolver.
 */
const SIGNATURE = "🤖 *Painel de transportes*";

export type BotMessageKind = "ask_target" | "ask_field";

export interface ComposedMessage {
  kind: BotMessageKind;
  body: string;
}

/**
 * Pedido do grupo que não deu para ligar a nenhum caso — a mensagem não
 * citou a solicitação e a unidade tem mais de um caso aberto (ou nenhum).
 */
export function composeAskTarget(intent: string): ComposedMessage {
  const assunto =
    intent === "cancel"
      ? "um pedido de cancelamento"
      : intent === "chase"
        ? "uma cobrança de posição"
        : "uma mensagem sobre um transporte";
  return {
    kind: "ask_target",
    body:
      `${SIGNATURE} — recebi ${assunto}, mas não identifiquei de qual paciente se trata. ` +
      `Responda esta mensagem com o nome do paciente.`,
  };
}

/**
 * Solicitação que entrou com campo crítico vazio. Pergunta o campo pelo
 * nome que o grupo usa, não pelo nome da coluna.
 */
export function composeAskField(params: {
  destinationName: string;
  procedure: string;
  patientName?: string;
}): ComposedMessage | null {
  const faltando: string[] = [];
  // Nome vazio acontece de verdade: a unidade manda "*NOME:*" e segue
  // para a data de nascimento. Sem nome o regulador não chama ninguém.
  if (params.patientName === MISSING_PATIENT_NAME) faltando.push("o *nome do paciente*");
  if (params.destinationName === MISSING_DESTINATION) faltando.push("o *hospital de destino*");
  if (params.procedure === MISSING_PROCEDURE) faltando.push("o *procedimento*");
  if (faltando.length === 0) return null;

  const campos = faltando.join(" e ");
  const exemplo =
    faltando.length > 1
      ? "os campos que faltaram"
      : faltando[0]!.includes("destino")
        ? "`DESTINO: <hospital>`"
        : faltando[0]!.includes("nome")
          ? "`NOME: <paciente>`"
          : "`PROCEDIMENTO: <procedimento>`";

  return {
    kind: "ask_field",
    body:
      `${SIGNATURE} — registrei esta solicitação, mas não consegui ler ${campos}. ` +
      `Responda esta mensagem com ${exemplo} que eu completo o card.`,
  };
}
