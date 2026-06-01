// Helpers para la Telegram Bot API.

const TELEGRAM_API = "https://api.telegram.org";

function botToken(): string {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN no configurado");
  return token;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

async function callApi<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram ${method} fallo: ${JSON.stringify(data)}`);
  }
  return data.result as T;
}

export function sendMessage(
  chatId: number,
  text: string,
  buttons?: InlineButton[][],
): Promise<unknown> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (buttons) {
    body.reply_markup = { inline_keyboard: buttons };
  }
  return callApi("sendMessage", body);
}

export function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<unknown> {
  return callApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text ?? "",
  });
}

// Edita un mensaje existente quitando los botones (tras confirmar/cancelar).
export function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
): Promise<unknown> {
  return callApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  });
}

// Obtiene la ruta del archivo y descarga su contenido como Uint8Array.
export async function downloadFile(fileId: string): Promise<{
  bytes: Uint8Array;
  filePath: string;
}> {
  const file = await callApi<{ file_path: string }>("getFile", {
    file_id: fileId,
  });
  const url = `${TELEGRAM_API}/file/bot${botToken()}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Descarga de archivo fallo: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  return { bytes: new Uint8Array(buffer), filePath: file.file_path };
}
