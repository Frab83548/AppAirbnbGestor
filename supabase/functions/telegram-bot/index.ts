// Edge Function: webhook del bot de Telegram para registrar ingresos y gastos.
// Recibe texto, audios y fotos; los interpreta con OpenAI; pide confirmacion
// y guarda en Supabase con service_role.
import {
  answerCallbackQuery,
  downloadFile,
  editMessageText,
  type InlineButton,
  sendMessage,
} from "./telegram.ts";
import {
  FIXED_CONCEPT_LABELS,
  type FixedConcept,
  extractFromImage,
  extractFromText,
  extractFixedAmounts,
  fixedAmountsTotal,
  mergeFromClarification,
  type ParsedRecord,
  transcribeAudio,
} from "./openai.ts";
import {
  DEFAULT_CLEANING,
  type Draft,
  type DraftKind,
  type FixedExpensePayload,
  buildFixedExpensePayload,
  deleteDraft,
  getActiveClarificationDraft,
  getAllowedUser,
  getDraft,
  getProperties,
  insertExpense,
  insertFixedExpense,
  insertReservation,
  logMessage,
  matchProperty,
  type Property,
  saveClarificationDraft,
  saveDraft,
} from "./db.ts";

const IMAGE_CONFIDENCE_THRESHOLD = 0.6;

function todayInArgentina(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function currentMonthYear(today: string): { mes: number; anio: number } {
  const [anio, mes] = today.split("-").map(Number);
  return { mes, anio };
}

function formatMoney(n: number | null): string {
  if (n === null || n === undefined) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDdMmYyyy(iso: string | null): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatMonthYear(mes: number, anio: number): string {
  return `${String(mes).padStart(2, "0")}/${anio}`;
}

function buildFixedSummary(payload: FixedExpensePayload): string {
  const lines = [
    "<b>Confirmar gasto fijo</b>",
    `Propiedad: <b>${payload.property_name}</b>`,
    `Periodo: <b>${formatMonthYear(payload.mes, payload.anio)}</b>`,
  ];
  for (const concept of Object.keys(payload.conceptos_fijos) as FixedConcept[]) {
    const amount = payload.conceptos_fijos[concept];
    if (amount && amount > 0) {
      lines.push(`${FIXED_CONCEPT_LABELS[concept]}: <b>${formatMoney(amount)}</b>`);
    }
  }
  lines.push(
    `Total: <b>${formatMoney(fixedAmountsTotal(payload.conceptos_fijos))}</b>`,
  );
  return lines.join("\n");
}

function buildSummary(
  kind: DraftKind,
  record: ParsedRecord,
  propertyName: string,
  fixedPayload?: FixedExpensePayload,
): string {
  if (kind === "gasto_fijo" && fixedPayload) {
    return buildFixedSummary(fixedPayload);
  }
  if (kind === "gasto") {
    return [
      "<b>Confirmar gasto variable</b>",
      `Propiedad: <b>${propertyName}</b>`,
      `Monto: <b>${formatMoney(record.monto)}</b>`,
      `Categoria: <b>${record.categoria ?? "otros"}</b>`,
      `Fecha: <b>${formatDdMmYyyy(record.fecha)}</b>`,
      record.descripcion ? `Detalle: ${record.descripcion}` : "",
    ].filter(Boolean).join("\n");
  }
  const checkIn = record.check_in ?? record.fecha;
  const checkOut = record.check_out ?? checkIn;
  const cleaning = typeof record.limpieza === "number" && record.limpieza >= 0
    ? record.limpieza
    : DEFAULT_CLEANING;
  return [
    "<b>Confirmar ingreso</b>",
    `Propiedad: <b>${propertyName}</b>`,
    `Monto cobrado: <b>${formatMoney(record.monto)}</b>`,
    `Limpieza (gasto): <b>${formatMoney(cleaning)}</b>`,
    `Plataforma: <b>${record.plataforma ?? "directo"}</b>`,
    `Check-in: <b>${formatDdMmYyyy(checkIn)}</b>`,
    `Check-out: <b>${formatDdMmYyyy(checkOut)}</b>`,
    record.descripcion ? `Detalle: ${record.descripcion}` : "",
  ].filter(Boolean).join("\n");
}

const confirmButtons = (draftId: string): InlineButton[][] => [[
  { text: "Confirmar", callback_data: `confirm:${draftId}` },
  { text: "Cancelar", callback_data: `cancel:${draftId}` },
]];

function needsImageClarification(
  record: ParsedRecord,
  contentType: string,
): boolean {
  if (contentType !== "foto") return false;
  if (record.necesita_aclaracion) return true;
  if (record.tipo === "desconocido") return true;
  if (record.confianza !== null && record.confianza < IMAGE_CONFIDENCE_THRESHOLD) {
    return true;
  }
  if (record.tipo === "gasto" && record.monto === null) return true;
  if (record.tipo === "gasto_fijo") {
    return Object.keys(extractFixedAmounts(record)).length === 0;
  }
  return false;
}

async function askForClarification(
  chatId: number,
  telegramId: number,
  record: ParsedRecord,
  contentType: string,
): Promise<void> {
  await saveClarificationDraft(telegramId, chatId, record, contentType);
  const msg = record.mensaje_aclaracion ||
    "No pude interpretar bien la foto. Contame: que propiedad es, que tipo de gasto " +
      "(luz, gas, expensas, etc.) y el monto.";
  await sendMessage(chatId, msg);
}

async function handleParsedRecord(
  chatId: number,
  telegramId: number,
  record: ParsedRecord,
  properties: Property[],
  contentType: string,
  rawText: string | null,
): Promise<void> {
  await logMessage(telegramId, chatId, contentType, rawText, { ...record });

  if (needsImageClarification(record, contentType)) {
    await askForClarification(chatId, telegramId, record, contentType);
    return;
  }

  if (record.tipo === "desconocido") {
    await sendMessage(
      chatId,
      "No pude entender si es un ingreso, gasto variable o gasto fijo. Proba ser mas especifico.\n\n" +
        "Ejemplos:\n" +
        "- <i>Gasto de limpieza 8000 en Trejo hoy</i>\n" +
        "- <i>Gasto fijo luz 15000 en Independencia mayo</i>\n" +
        "- <i>Ingreso 95000 en Trejo por Airbnb</i>",
    );
    return;
  }

  if (record.necesita_aclaracion) {
    const msg = record.mensaje_aclaracion ||
      "Me falta informacion. Indicame los datos que faltan, por favor.";
    await sendMessage(chatId, msg);
    return;
  }

  const property = matchProperty(record.propiedad, properties);
  if (!property) {
    const names = properties.map((p) => p.name).join(", ");
    await sendMessage(
      chatId,
      `No encontre la propiedad${
        record.propiedad ? ` "${record.propiedad}"` : ""
      }. Propiedades disponibles: ${names}.`,
    );
    return;
  }

  const today = todayInArgentina();

  if (record.tipo === "gasto_fijo") {
    const fixedPayload = buildFixedExpensePayload(record, property, today);
    if (!fixedPayload) {
      await sendMessage(
        chatId,
        "No pude identificar los conceptos del gasto fijo (luz, gas, expensas, etc.) " +
          "ni sus montos. Indicalos, por favor.",
      );
      return;
    }
    const draftId = await saveDraft(telegramId, chatId, "gasto_fijo", fixedPayload);
    await sendMessage(
      chatId,
      buildSummary("gasto_fijo", record, property.name, fixedPayload),
      confirmButtons(draftId),
    );
    return;
  }

  if (record.tipo === "gasto") {
    if (record.monto === null) {
      await sendMessage(chatId, "Me falta el monto del gasto. Indicame el importe, por favor.");
      return;
    }
    if (!record.fecha) record.fecha = today;
    const payload = {
      ...record,
      property_id: property.id,
      property_name: property.name,
    };
    const draftId = await saveDraft(telegramId, chatId, "gasto", payload);
    await sendMessage(
      chatId,
      buildSummary("gasto", record, property.name),
      confirmButtons(draftId),
    );
    return;
  }

  // ingreso
  if (record.monto === null) {
    await sendMessage(chatId, "Me falta el monto del ingreso. Indicame el importe, por favor.");
    return;
  }
  const payload = {
    ...record,
    property_id: property.id,
    property_name: property.name,
  };
  const draftId = await saveDraft(telegramId, chatId, "ingreso", payload);
  await sendMessage(
    chatId,
    buildSummary("ingreso", record, property.name),
    confirmButtons(draftId),
  );
}

async function handleMessage(
  message: Record<string, any>,
  properties: Property[],
): Promise<void> {
  const chatId = message.chat.id as number;
  const telegramId = (message.from?.id as number) ?? chatId;
  const today = todayInArgentina();

  const text: string | undefined = message.text;
  if (text && text.startsWith("/")) {
    if (text.startsWith("/start") || text.startsWith("/help")) {
      const { mes, anio } = currentMonthYear(today);
      await sendMessage(
        chatId,
        "Hola! Mandame un <b>texto</b>, <b>audio</b> o <b>foto</b> y lo registro.\n\n" +
          "<b>Ingresos</b> (reservas):\n" +
          "- <i>Ingreso 95000 en Independencia por Airbnb, check-in 5/6 check-out 8/6</i>\n\n" +
          "<b>Gastos variables</b> (puntuales):\n" +
          "- <i>Gasto de limpieza 8000 en Trejo hoy</i>\n\n" +
          "<b>Gastos fijos</b> (mensuales: luz, gas, expensas...):\n" +
          `- <i>Gasto fijo luz 15000 gas 8000 en Trejo ${mes}/${anio}</i>\n` +
          "- Tambien podes mandar una <b>foto de la factura</b>.\n" +
          "  Si no la interpreto bien, te pregunto para completar.\n\n" +
          "Antes de guardar te pido confirmacion.",
      );
      return;
    }
  }

  try {
    // Si hay una aclaracion pendiente (ej. foto mal leida), el texto la completa.
    if (text && !text.startsWith("/")) {
      const pending = await getActiveClarificationDraft(telegramId);
      if (pending) {
        const partial = pending.payload.partial as ParsedRecord;
        const merged = await mergeFromClarification(
          partial,
          text,
          properties.map((p) => p.name),
          today,
        );
        await deleteDraft(pending.id);
        await handleParsedRecord(
          chatId,
          telegramId,
          merged,
          properties,
          "texto_aclaracion",
          text,
        );
        return;
      }
    }

    if (message.voice || message.audio) {
      const fileId = (message.voice ?? message.audio).file_id as string;
      const { bytes, filePath } = await downloadFile(fileId);
      const filename = filePath.split("/").pop() ?? "audio.ogg";
      const transcript = await transcribeAudio(bytes, filename);
      if (!transcript.trim()) {
        await sendMessage(chatId, "No pude entender el audio. Proba de nuevo.");
        return;
      }
      const record = await extractFromText(
        message.caption ? `${message.caption}. ${transcript}` : transcript,
        properties.map((p) => p.name),
        today,
      );
      await handleParsedRecord(
        chatId,
        telegramId,
        record,
        properties,
        "audio",
        transcript,
      );
      return;
    }

    if (message.photo && Array.isArray(message.photo)) {
      const largest = message.photo[message.photo.length - 1];
      const { bytes } = await downloadFile(largest.file_id as string);
      const record = await extractFromImage(
        bytes,
        "image/jpeg",
        message.caption ?? "",
        properties.map((p) => p.name),
        today,
      );
      await handleParsedRecord(
        chatId,
        telegramId,
        record,
        properties,
        "foto",
        message.caption ?? null,
      );
      return;
    }

    if (text) {
      const record = await extractFromText(
        text,
        properties.map((p) => p.name),
        today,
      );
      await handleParsedRecord(
        chatId,
        telegramId,
        record,
        properties,
        "text",
        text,
      );
      return;
    }

    await sendMessage(
      chatId,
      "Mandame un texto, audio o foto con el ingreso o gasto.",
    );
  } catch (err) {
    console.error("Error procesando mensaje:", err);
    await sendMessage(
      chatId,
      "Hubo un error procesando tu mensaje. Intenta de nuevo en un momento.",
    );
  }
}

async function handleCallback(
  callback: Record<string, any>,
): Promise<void> {
  const data = callback.data as string;
  const chatId = callback.message?.chat?.id as number;
  const messageId = callback.message?.message_id as number;
  const telegramId = callback.from?.id as number;
  const [action, draftId] = data.split(":");

  await answerCallbackQuery(callback.id);

  const draft = await getDraft(draftId) as Draft | null;
  if (!draft) {
    await editMessageText(
      chatId,
      messageId,
      "Este borrador ya no esta disponible (vencido o ya procesado).",
    );
    return;
  }

  if (action === "cancel") {
    await deleteDraft(draftId);
    await editMessageText(chatId, messageId, "Operacion cancelada.");
    return;
  }

  if (action === "confirm") {
    try {
      const allowed = await getAllowedUser(telegramId);
      const createdBy = allowed?.profile_id ?? null;
      if (draft.kind === "gasto") {
        await insertExpense(draft, createdBy);
      } else if (draft.kind === "gasto_fijo") {
        await insertFixedExpense(draft, createdBy);
      } else {
        await insertReservation(draft, createdBy);
      }
      await deleteDraft(draftId);
      const savedMsg = draft.kind === "gasto"
        ? "Gasto variable guardado correctamente."
        : draft.kind === "gasto_fijo"
        ? "Gasto fijo guardado correctamente."
        : "Ingreso guardado correctamente.";
      await editMessageText(chatId, messageId, savedMsg);
    } catch (err) {
      console.error("Error guardando:", err);
      await editMessageText(
        chatId,
        messageId,
        "No se pudo guardar. Intenta de nuevo.",
      );
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  const gotSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (expectedSecret && gotSecret !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: Record<string, any>;
  try {
    update = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    const message = update.message ?? update.edited_message;
    const callback = update.callback_query;
    const fromId = (callback?.from?.id ?? message?.from?.id) as number | undefined;

    if (fromId !== undefined) {
      const allowed = await getAllowedUser(fromId);
      if (!allowed) {
        const chatId = (callback?.message?.chat?.id ?? message?.chat?.id) as
          | number
          | undefined;
        if (chatId !== undefined) {
          await sendMessage(
            chatId,
            "No estas autorizado para usar este bot.",
          );
        }
        return new Response("OK", { status: 200 });
      }
    }

    if (callback) {
      await handleCallback(callback);
    } else if (message) {
      const properties = await getProperties();
      await handleMessage(message, properties);
    }
  } catch (err) {
    console.error("Error en webhook:", err);
  }

  return new Response("OK", { status: 200 });
});
