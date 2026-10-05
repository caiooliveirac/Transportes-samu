import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@samu-cru/db";

export const dynamic = "force-dynamic";

/**
 * Pedidos de unidade avançada (grupo de apoio de UTI) feitos numa janela —
 * o que o relatório da chefia (relatorio.mnrs.com.br) pré-preenche na seção
 * Transportes. Sem dado de paciente: só rota, hora, viatura e situação.
 *
 * Serviço entre apps do mesmo host: header `x-relatorio-token` =
 * RELATORIO_TOKEN. Sem token configurado, a rota não responde.
 */
export async function GET(req: NextRequest) {
  const esperado = process.env.RELATORIO_TOKEN ?? "";
  const recebido = req.headers.get("x-relatorio-token") ?? "";
  if (
    !esperado ||
    recebido.length !== esperado.length ||
    !timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const inicio = new Date(req.nextUrl.searchParams.get("inicio") ?? "");
  const fim = new Date(req.nextUrl.searchParams.get("fim") ?? "");
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    return NextResponse.json({ error: "inicio e fim (ISO) obrigatórios" }, { status: 400 });
  }

  const rows = await db.execute(sql`
    select t.id,
           t.created_at as pedido_em,
           coalesce(u.name, nullif(t.origin_unit_raw, '—')) as origem,
           nullif(t.destination_name, '(sem destino)') as destino,
           t.status,
           t.ambulance_label as viatura,
           exists (select 1 from transport_followups f
                    where f.transport_id = t.id and f.intent = 'cancel') as cancelamento_pedido
      from transport_requests t
      left join units u on u.id = t.origin_unit_id
     where t.requested_kind = 'USA'
       and t.created_at >= ${inicio.toISOString()}::timestamptz
       and t.created_at < ${fim.toISOString()}::timestamptz
     order by t.created_at`);

  return NextResponse.json(
    { ok: true, transportes: rows },
    { headers: { "Cache-Control": "no-store" } },
  );
}
