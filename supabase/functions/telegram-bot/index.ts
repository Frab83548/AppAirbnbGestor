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
  extractFromImage,
  extractFromText,
  type ParsedRecord,
  transcribeAudio,
} from "./openai.ts";
import {
  type Draft,
  deleteDraft,
  getAllowedUser,
  getDraft,
  getProperties,
  insertExpense,
  insertReservation,
  logMessage,
  matchProperty,
  type Property,
  saveDraft,
} from "./db.ts";

// Fecha de hoy en zona America/Argentina/Buenos_Aires (ISO yyyy-MM-dd).
function todayInArgentina(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
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

function buildSummary(
  kind: "ingreso" | "gasto",
  record: ParsedRecord,
  propertyName: string,
): string {
  if (kind === "gasto") {
    return [
      "<b>Confirmar gasto</b>",
      `Propiedad: <b>${propertyName}</b>`,
      `Monto: <b>${formatMoney(record.monto)}</b>`,
      `Categoria: <b>${record.categoria ?? "otros"}</b>`,
      `Fecha: <b>${formatDdMmYyyy(record.fecha)}</b>`,
      record.descripcion ? `Detalle: ${record.descripcion}` : "",
    ].filter(Boolean).join("\n");
  }
  const checkIn = record.check_in ?? record.fecha;
  const checkOut = record.check_out ?? checkIn;
  return [
    "<b>Confirmar ingreso</b>",
    `Propiedad: <b>${propertyName}</b>`,
    `Monto cobrado: <b>${formatMoney(record.monto)}</b>`,
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

// Procesa un registro ya interpretado: valida, guarda borrador y pide confirmacion.
async function handleParsedRecord(
  chatId: number,
  telegramId: number,
  record: ParsedRecord,
  properties: Property[],
  contentType: string,
  rawText: string | null,
): Promise<void> {
  await logMessage(telegramId, chatId, contentType, rawText, { ...record });

  if (record.tipo === "desconocido") {
    await sendMessage(
      chatId,
      "No pude entender si es un ingreso o un gasto. Proba ser mas especifico, " +
        "por ejemplo: <i>Gasto de limpieza 8000 en Trejo</i>.",
    );
    return;
  }

  if (record.necesita_aclaracion || record.monto === null) {
    const msg = record.mensaje_aclaracion ||
      "Me falta el monto. Indicame el importe, por favor.";
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

  const kind = record.tipo === "ingreso" ? "ingreso" : "gasto";
  if (kind === "gasto" && !record.fecha) {
    record.fecha = todayInArgentina();
  }

  const payload = {
    ...record,
    property_id: property.id,
    property_name: property.name,
  };
  const draftId = await saveDraft(telegramId, chatId, kind, payload);
  await sendMessage(
    chatId,
    buildSummary(kind, record, property.name),
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

  // Comandos basicos.
  const text: string | undefined = message.text;
  if (text && text.startsWith("/")) {
    if (text.startsWith("/start") || text.startsWith("/help")) {
      await sendMessage(
        chatId,
        "Hola! Mandame un <b>texto</b>, <b>audio</b> o <b>foto</b> de un ingreso o gasto " +
          "y lo registro.\n\nEjemplos:\n" +
          "- <i>Gasto de limpieza 8000 en Trejo hoy</i>\n" +
          "- <i>Ingreso 95000 en Independencia por Airbnb, check-in 5/6 check-out 8/6</i>\n\n" +
          "Antes de guardar te pido confirmacion.",
      );
      return;
    }
  }

  try {
    let record: ParsedRecord | null = null;

    if (message.voice || message.audio) {
      const fileId = (message.voice ?? message.audio).file_id as string;
      const { bytes, filePath } = await downloadFile(fileId);
      const filename = filePath.split("/").pop() ?? "audio.ogg";
      const transcript = await transcribeAudio(bytes, filename);
      if (!transcript.trim()) {
        await sendMessage(chatId, "No pude entender el audio. Proba de nuevo.");
        return;
      }
      record = await extractFromText(
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
      // El array viene ordenado de menor a mayor resolucion.
      const largest = message.photo[message.photo.length - 1];
      const { bytes } = await downloadFile(largest.file_id as string);
      record = await extractFromImage(
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
      record = await extractFromText(
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
      "Hubo un error procesando tu mensaje. Intenta de nuevo en un momento.\n\n" +
        `<code>${String((err as Error)?.message ?? err).slice(0, 500)}</code>`,
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
      } else {
        await insertReservation(draft, createdBy);
      }
      await deleteDraft(draftId);
      await editMessageText(
        chatId,
        messageId,
        draft.kind === "gasto"
          ? "Gasto guardado correctamente."
          : "Ingreso guardado correctamente.",
      );
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

  // Validacion del secret del webhook.
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

    // Whitelist de usuarios autorizados.
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
    // Siempre responder 200 para que Telegram no reintente en loop.
    console.error("Error en webhook:", err);
  }

  return new Response("OK", { status: 200 });
});
