// Interpretacion de texto, audio y fotos con un LLM compatible con la API de
// OpenAI. Soporta OpenAI directo y OpenRouter (se autodetecta por el prefijo
// de la API key, o se puede forzar con OPENAI_BASE_URL).

const OPENAI_BASE = "https://api.openai.com/v1";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

interface LlmConfig {
  baseUrl: string;
  key: string;
  isOpenRouter: boolean;
  textModel: string;
  visionModel: string;
  audioModel: string;
}

function getConfig(): LlmConfig {
  const key = Deno.env.get("OPENAI_API_KEY") ??
    Deno.env.get("OPENROUTER_API_KEY") ?? "";
  if (!key) {
    throw new Error("OPENAI_API_KEY (o OPENROUTER_API_KEY) no configurado");
  }
  const forcedBase = Deno.env.get("OPENAI_BASE_URL");
  const isOpenRouter = key.startsWith("sk-or-") ||
    (forcedBase ?? "").includes("openrouter");
  const baseUrl = forcedBase ?? (isOpenRouter ? OPENROUTER_BASE : OPENAI_BASE);
  return {
    baseUrl,
    key,
    isOpenRouter,
    textModel: Deno.env.get("LLM_TEXT_MODEL") ??
      (isOpenRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini"),
    visionModel: Deno.env.get("LLM_VISION_MODEL") ??
      (isOpenRouter ? "openai/gpt-4o" : "gpt-4o"),
    audioModel: Deno.env.get("LLM_AUDIO_MODEL") ??
      (isOpenRouter ? "google/gemini-2.5-flash" : "whisper-1"),
  };
}

function headers(cfg: LlmConfig): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${cfg.key}`,
    "Content-Type": "application/json",
  };
  if (cfg.isOpenRouter) {
    h["HTTP-Referer"] = "https://app-finanzas.vercel.app";
    h["X-Title"] = "App Finanzas Bot";
  }
  return h;
}

export const EXPENSE_CATEGORIES = [
  "limpieza",
  "insumos",
  "reparaciones",
  "mantenimiento",
  "sabanas",
  "viaticos",
  "otros",
] as const;

export const PLATFORMS = ["airbnb", "booking", "directo", "otra"] as const;

// Resultado estructurado que el modelo devuelve a partir del mensaje.
export interface ParsedRecord {
  tipo: "ingreso" | "gasto" | "desconocido";
  propiedad: string | null;
  monto: number | null;
  fecha: string | null; // ISO yyyy-MM-dd
  categoria: (typeof EXPENSE_CATEGORIES)[number] | null;
  plataforma: (typeof PLATFORMS)[number] | null;
  check_in: string | null; // ISO yyyy-MM-dd (ingresos)
  check_out: string | null; // ISO yyyy-MM-dd (ingresos)
  limpieza: number | null; // costo de limpieza del ingreso (default si null)
  descripcion: string;
  // El modelo puede pedir aclaracion si falta info critica.
  necesita_aclaracion: boolean;
  mensaje_aclaracion: string;
}

function buildSystemPrompt(propertyNames: string[], today: string): string {
  return [
    "Sos un asistente que extrae datos financieros de mensajes de un administrador",
    "de alquileres temporarios (Airbnb/Booking). Devolves SOLO un JSON valido.",
    "",
    "Clasifica el mensaje como 'ingreso' (cobro de una reserva) o 'gasto'",
    "(gasto operativo de una propiedad). Si no podes determinarlo, usa 'desconocido'.",
    "",
    `Propiedades existentes (elegi el nombre EXACTO de esta lista): ${JSON.stringify(propertyNames)}.`,
    "Si el usuario menciona una propiedad que se parece a una de la lista, devolve el nombre exacto de la lista.",
    "",
    `Categorias de gasto validas: ${JSON.stringify(EXPENSE_CATEGORIES)}.`,
    `Plataformas validas para ingresos: ${JSON.stringify(PLATFORMS)}.`,
    "",
    `La fecha de hoy es ${today} (zona America/Argentina/Buenos_Aires).`,
    "Interpreta fechas relativas (hoy, ayer, el lunes) en base a esa fecha.",
    "Todas las fechas en formato ISO yyyy-MM-dd.",
    "Los montos son numeros sin simbolos ni separadores de miles (usa punto decimal).",
    "",
    "Reglas:",
    "- Para gastos: completa 'categoria' (la mas adecuada, 'otros' si no encaja) y 'fecha'.",
    "- Para ingresos: completa 'plataforma' (default 'directo' si no se menciona),",
    "  'monto' (lo cobrado) y, si hay fechas de estadia, 'check_in' y 'check_out'.",
    "- Para ingresos, si se menciona un costo de limpieza, ponelo en 'limpieza';",
    "  si no se menciona, deja 'limpieza' en null (se usara el valor por defecto).",
    "- Si falta el monto o la propiedad no se puede determinar, marca",
    "  'necesita_aclaracion' = true y explica brevemente en 'mensaje_aclaracion'.",
    "- 'descripcion' es un resumen corto legible de la operacion.",
    "",
    "Responde UNICAMENTE con un objeto JSON con esta estructura exacta:",
    JSON.stringify(
      {
        tipo: "ingreso|gasto|desconocido",
        propiedad: "string|null",
        monto: "number|null",
        fecha: "yyyy-MM-dd|null",
        categoria: "string|null",
        plataforma: "string|null",
        check_in: "yyyy-MM-dd|null",
        check_out: "yyyy-MM-dd|null",
        limpieza: "number|null",
        descripcion: "string",
        necesita_aclaracion: "boolean",
        mensaje_aclaracion: "string",
      },
      null,
      0,
    ),
  ].join("\n");
}

// Extrae el primer objeto JSON del contenido (tolera texto alrededor o fences).
function parseJsonResponse(content: string): ParsedRecord {
  let raw = content.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  if (!raw.startsWith("{")) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
  }
  const parsed = JSON.parse(raw) as Partial<ParsedRecord>;
  return {
    tipo: parsed.tipo ?? "desconocido",
    propiedad: parsed.propiedad ?? null,
    monto: typeof parsed.monto === "number" ? parsed.monto : null,
    fecha: parsed.fecha ?? null,
    categoria: parsed.categoria ?? null,
    plataforma: parsed.plataforma ?? null,
    check_in: parsed.check_in ?? null,
    check_out: parsed.check_out ?? null,
    limpieza: typeof parsed.limpieza === "number" ? parsed.limpieza : null,
    descripcion: parsed.descripcion ?? "",
    necesita_aclaracion: parsed.necesita_aclaracion ?? false,
    mensaje_aclaracion: parsed.mensaje_aclaracion ?? "",
  };
}

async function chatToJson(
  cfg: LlmConfig,
  model: string,
  messages: unknown[],
): Promise<ParsedRecord> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM (${model}) fallo: ${await res.text()}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`LLM (${model}) sin contenido`);
  return parseJsonResponse(content);
}

// Transcribe audio a texto. Con OpenAI usa Whisper; con OpenRouter usa un
// modelo con entrada de audio (chat completions).
export async function transcribeAudio(
  bytes: Uint8Array,
  filename: string,
): Promise<string> {
  const cfg = getConfig();

  if (!cfg.isOpenRouter && cfg.audioModel === "whisper-1") {
    const form = new FormData();
    form.append("file", new Blob([bytes]), filename);
    form.append("model", "whisper-1");
    form.append("language", "es");
    const res = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}` },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Transcripcion fallo: ${await res.text()}`);
    }
    const data = await res.json();
    return data.text ?? "";
  }

  // OpenRouter (o modelo de chat con audio).
  const format = (filename.split(".").pop() ?? "ogg").toLowerCase();
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify({
      model: cfg.audioModel,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Transcribi este audio a texto en español. Devolve solo la transcripcion, sin comillas ni texto extra.",
            },
            {
              type: "input_audio",
              input_audio: { data: encodeBase64(bytes), format },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Transcripcion (${cfg.audioModel}) fallo: ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Extrae datos estructurados a partir de texto libre.
export function extractFromText(
  text: string,
  propertyNames: string[],
  today: string,
): Promise<ParsedRecord> {
  const cfg = getConfig();
  return chatToJson(cfg, cfg.textModel, [
    { role: "system", content: buildSystemPrompt(propertyNames, today) },
    { role: "user", content: text },
  ]);
}

// Extrae datos estructurados a partir de una foto (comprobante/factura).
export function extractFromImage(
  bytes: Uint8Array,
  mimeType: string,
  caption: string,
  propertyNames: string[],
  today: string,
): Promise<ParsedRecord> {
  const cfg = getConfig();
  const base64 = encodeBase64(bytes);
  return chatToJson(cfg, cfg.visionModel, [
    { role: "system", content: buildSystemPrompt(propertyNames, today) },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Extrae los datos financieros de este comprobante/foto. " +
            (caption ? `Contexto del usuario: "${caption}".` : ""),
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}` },
        },
      ],
    },
  ]);
}

// Codifica bytes a base64 sin desbordar el call stack en imagenes grandes.
function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
