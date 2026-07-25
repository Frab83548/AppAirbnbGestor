// Acceso a la base con service_role (bypassa RLS). Solo se usa dentro de la
// Edge Function, nunca expuesto al cliente.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type FixedConcept,
  type ParsedRecord,
  extractFixedAmounts,
} from "./openai.ts";

let cached: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (cached) return cached;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados");
  }
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

export interface AllowedUser {
  telegram_id: number;
  profile_id: string | null;
  full_name: string;
}

export async function getAllowedUser(
  telegramId: number,
): Promise<AllowedUser | null> {
  const { data } = await getClient()
    .from("telegram_allowed_users")
    .select("telegram_id, profile_id, full_name")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  return (data as AllowedUser) ?? null;
}

export interface Property {
  id: string;
  name: string;
}

export async function getProperties(): Promise<Property[]> {
  const { data } = await getClient()
    .from("properties")
    .select("id, name");
  return (data as Property[]) ?? [];
}

export function matchProperty(
  name: string | null,
  properties: Property[],
): Property | null {
  if (!name) return null;
  const norm = (s: string) => s.trim().toLowerCase();
  const target = norm(name);
  const exact = properties.find((p) => norm(p.name) === target);
  if (exact) return exact;
  const partial = properties.find(
    (p) => norm(p.name).includes(target) || target.includes(norm(p.name)),
  );
  return partial ?? null;
}

export type DraftKind = "ingreso" | "gasto" | "gasto_fijo" | "aclaracion";

export interface FixedExpensePayload {
  property_id: string;
  property_name: string;
  mes: number;
  anio: number;
  fecha: string;
  conceptos_fijos: Partial<Record<FixedConcept, number>>;
}

export interface Draft {
  id: string;
  telegram_id: number;
  chat_id: number;
  kind: DraftKind;
  payload: Record<string, unknown>;
}

export async function saveDraft(
  telegramId: number,
  chatId: number,
  kind: DraftKind,
  payload: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await getClient()
    .from("telegram_drafts")
    .insert({ telegram_id: telegramId, chat_id: chatId, kind, payload })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo guardar el borrador: ${error.message}`);
  return (data as { id: string }).id;
}

export async function getDraft(id: string): Promise<Draft | null> {
  const { data } = await getClient()
    .from("telegram_drafts")
    .select("id, telegram_id, chat_id, kind, payload")
    .eq("id", id)
    .maybeSingle();
  return (data as Draft) ?? null;
}

export async function deleteDraft(id: string): Promise<void> {
  await getClient().from("telegram_drafts").delete().eq("id", id);
}

export async function deleteClarificationDrafts(telegramId: number): Promise<void> {
  await getClient()
    .from("telegram_drafts")
    .delete()
    .eq("telegram_id", telegramId)
    .eq("kind", "aclaracion");
}

export async function getActiveClarificationDraft(
  telegramId: number,
): Promise<Draft | null> {
  const { data } = await getClient()
    .from("telegram_drafts")
    .select("id, telegram_id, chat_id, kind, payload")
    .eq("telegram_id", telegramId)
    .eq("kind", "aclaracion")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Draft) ?? null;
}

export async function saveClarificationDraft(
  telegramId: number,
  chatId: number,
  partial: ParsedRecord,
  contentType: string,
): Promise<string> {
  await deleteClarificationDrafts(telegramId);
  return saveDraft(telegramId, chatId, "aclaracion", {
    partial,
    content_type: contentType,
  });
}

export async function insertExpense(
  draft: Draft,
  createdBy: string | null,
): Promise<void> {
  const p = draft.payload as ParsedRecord & {
    property_id: string;
    fecha: string;
  };
  const { error } = await getClient().from("variable_expenses").insert({
    property_id: p.property_id,
    expense_date: p.fecha,
    category: p.categoria ?? "otros",
    description: p.descripcion ?? "",
    amount: p.monto,
    created_by: createdBy,
    updated_by: createdBy,
  });
  if (error) throw new Error(`No se pudo guardar el gasto: ${error.message}`);
}

const FIXED_DB_COLUMNS: Record<FixedConcept, string> = {
  expensas: "building_expenses",
  luz: "electricity",
  agua: "water",
  gas: "gas",
  internet: "internet",
  municipalidad: "municipality",
  otros: "others",
};

interface FixedExpenseRow {
  id: string;
  building_expenses: number;
  electricity: number;
  water: number;
  gas: number;
  internet: number;
  municipality: number;
  others: number;
}

export async function insertFixedExpense(
  draft: Draft,
  createdBy: string | null,
): Promise<void> {
  const p = draft.payload as FixedExpensePayload;
  const conceptos = p.conceptos_fijos;
  const amounts: Record<string, number> = {};
  for (const [concept, col] of Object.entries(FIXED_DB_COLUMNS)) {
    amounts[col] = conceptos[concept as FixedConcept] ?? 0;
  }

  const entryDate = p.fecha;

  const { data: existing } = await getClient()
    .from("fixed_expenses")
    .select("id, building_expenses, electricity, water, gas, internet, municipality, others")
    .eq("property_id", p.property_id)
    .eq("month", p.mes)
    .eq("year", p.anio)
    .eq("entry_date", entryDate)
    .maybeSingle();

  if (existing) {
    const row = existing as FixedExpenseRow;
    const { error } = await getClient()
      .from("fixed_expenses")
      .update({
        building_expenses: Number(row.building_expenses) + amounts.building_expenses,
        electricity: Number(row.electricity) + amounts.electricity,
        water: Number(row.water) + amounts.water,
        gas: Number(row.gas) + amounts.gas,
        internet: Number(row.internet) + amounts.internet,
        municipality: Number(row.municipality) + amounts.municipality,
        others: Number(row.others) + amounts.others,
        updated_by: createdBy,
      })
      .eq("id", row.id);
    if (error) {
      throw new Error(`No se pudo actualizar el gasto fijo: ${error.message}`);
    }
    return;
  }

  const { error } = await getClient().from("fixed_expenses").insert({
    property_id: p.property_id,
    month: p.mes,
    year: p.anio,
    entry_date: entryDate,
    building_expenses: amounts.building_expenses,
    electricity: amounts.electricity,
    water: amounts.water,
    gas: amounts.gas,
    internet: amounts.internet,
    municipality: amounts.municipality,
    others: amounts.others,
    created_by: createdBy,
    updated_by: createdBy,
  });
  if (error) throw new Error(`No se pudo guardar el gasto fijo: ${error.message}`);
}

export const DEFAULT_CLEANING = 10000;

export async function insertReservation(
  draft: Draft,
  createdBy: string | null,
): Promise<void> {
  const p = draft.payload as ParsedRecord & { property_id: string };
  const checkIn = p.check_in ?? p.fecha;
  const checkOut = p.check_out ?? checkIn;
  const cleaning = typeof p.limpieza === "number" && p.limpieza >= 0
    ? p.limpieza
    : DEFAULT_CLEANING;
  const { data, error } = await getClient().from("reservations").insert({
    property_id: p.property_id,
    check_in_date: checkIn,
    check_out_date: checkOut,
    platform: p.plataforma ?? "directo",
    amount_charged: p.monto,
    cleaning_cost: cleaning,
    notes: p.descripcion ?? "",
    created_by: createdBy,
    updated_by: createdBy,
  }).select("id").single();
  if (error) throw new Error(`No se pudo guardar el ingreso: ${error.message}`);

  if (cleaning > 0) {
    const reservationId = (data as { id: string }).id;
    const { error: expError } = await getClient()
      .from("variable_expenses")
      .insert({
        property_id: p.property_id,
        expense_date: checkIn,
        category: "limpieza",
        description: "Limpieza",
        amount: cleaning,
        reservation_id: reservationId,
        created_by: createdBy,
        updated_by: createdBy,
      });
    if (expError) {
      throw new Error(`No se pudo guardar la limpieza: ${expError.message}`);
    }
  }
}

export async function logMessage(
  telegramId: number,
  chatId: number | null,
  contentType: string,
  rawText: string | null,
  parsed: Record<string, unknown> | null,
): Promise<void> {
  try {
    await getClient().from("telegram_messages").insert({
      telegram_id: telegramId,
      chat_id: chatId,
      content_type: contentType,
      raw_text: rawText,
      parsed,
    });
  } catch (_) {
    // El log es best-effort: no interrumpe el flujo.
  }
}

// Normaliza mes/anio y conceptos fijos para guardar en borrador.
export function buildFixedExpensePayload(
  record: ParsedRecord,
  property: Property,
  today: string,
): FixedExpensePayload | null {
  const conceptos = extractFixedAmounts(record);
  if (Object.keys(conceptos).length === 0) return null;

  const [yearStr, monthStr] = today.split("-");
  const mes = record.mes ?? Number(monthStr);
  const anio = record.anio ?? Number(yearStr);
  const fecha = record.fecha ?? today;

  return {
    property_id: property.id,
    property_name: property.name,
    mes,
    anio,
    fecha,
    conceptos_fijos: conceptos,
  };
}
