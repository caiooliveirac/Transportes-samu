CREATE TYPE "public"."delay_reason" AS ENUM('demora_viatura_disponivel', 'frota_toda_ocupada', 'viatura_pane_mecanica', 'troca_de_viatura', 'solicitacao_incompleta', 'divergencia_tipo_recurso', 'paciente_instabilizou', 'basica_pediu_avancada', 'estabilizacao_na_origem', 'paciente_recusou', 'obito', 'documentacao_incompleta', 'acompanhante_ausente', 'paciente_nao_preparado', 'origem_demorou_entrega', 'exame_atrasou_liberacao', 'transito_via_interditada', 'condicoes_climaticas', 'acesso_dificil', 'destino_demorou_acolher', 'retida_esperando_exame', 'sem_vaga_no_destino', 'destino_recusou_paciente', 'maca_retida_no_destino', 'procedimento_demorou', 'desviada_outra_ocorrencia', 'outro');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transport_delays" (
	"id" serial PRIMARY KEY NOT NULL,
	"transport_id" uuid NOT NULL,
	"reason" "delay_reason" NOT NULL,
	"impact_minutes" integer,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "delay_report" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_delays" ADD CONSTRAINT "transport_delays_transport_id_transport_requests_id_fk" FOREIGN KEY ("transport_id") REFERENCES "public"."transport_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_delays" ADD CONSTRAINT "transport_delays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transport_delays_transport_reason_uq" ON "transport_delays" USING btree ("transport_id","reason");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_delays_reason_idx" ON "transport_delays" USING btree ("reason");