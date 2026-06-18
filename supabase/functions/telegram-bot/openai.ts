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
    h["X-Title"] = "gestorAirbnb Bot";
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

export const FIXED_CONCEPTS = [
  "expensas",
  "luz",
  "agua",
  "gas",
  "internet",
  "municipalidad",
  "otros",
] as const;

export const PLATFORMS = ["airbnb", "booking", "directo", "otra"] as const;

export type FixedConcept = (typeof FIXED_CONCEPTS)[number];

export const FIXED_CONCEPT_LABELS: Record<FixedConcept, string> = {
  expensas: "Expensas",
  luz: "Luz",
  agua: "Agua",
  gas: "Gas",
  internet: "Internet",
  municipalidad: "Municipalidad",
  otros: "Otros",
};

// Resultado estructurado que el modelo devuelve a partir del mensaje.
export interface ParsedRecord {
  tipo: "ingreso" | "gasto" | "gasto_fijo" | "desconocido";
  propiedad: string | null;
  monto: number | null;
  fecha: string | null; // ISO yyyy-MM-dd
  categoria: (typeof EXPENSE_CATEGORIES)[number] | null;
  plataforma: (typeof PLATFORMS)[number] | null;
  check_in: string | null; // ISO yyyy-MM-dd (ingresos)
  check_out: string | null; // ISO yyyy-MM-dd (ingresos)
  limpieza: number | null; // costo de limpieza del ingreso (default si null)
  mes: number | null; // 1-12 (gastos fijos mensuales)
  anio: number | null;
  concepto_fijo: FixedConcept | null; // cuando hay un solo concepto + monto
  conceptos_fijos: Partial<Record<FixedConcept, number>> | null;
  descripcion: string;
  confianza: number | null; // 0-1, sobre todo en fotos
  necesita_aclaracion: boolean;
  mensaje_aclaracion: string;
}

function buildSystemPrompt(propertyNames: string[], today: string): string {
  const [year, month] = today.split("-");
  return [
    "Sos un asistente que extrae datos financieros de mensajes de un administrador",
    "de alquileres temporarios (Airbnb/Booking). Devolves SOLO un JSON valido.",
    "",
    "Clasifica el mensaje en uno de estos tipos:",
    "- 'ingreso': cobro de una reserva / alquiler temporario.",
    "- 'gasto': gasto operativo puntual (limpieza, insumos, reparacion, etc.).",
    "- 'gasto_fijo': gasto mensual fijo de una propiedad (expensas, luz, agua, gas,",
    "  internet, municipalidad). Facturas de servicios suelen ser gasto_fijo.",
    "- 'desconocido': si no podes determinarlo.",
    "",
    `Propiedades existentes (elegi el nombre EXACTO de esta lista): ${JSON.stringify(propertyNames)}.`,
    "Si el usuario menciona una propiedad que se parece a una de la lista, devolve el nombre exacto de la lista.",
    "",
    `Categorias de gasto variable validas: ${JSON.stringify(EXPENSE_CATEGORIES)}.`,
    `Conceptos de gasto fijo validos: ${JSON.stringify(FIXED_CONCEPTS)}.`,
    "Mapeo de facturas: EDESUR/EDENOR/electricidad->luz, AYSA/agua->agua, Metrogas/gas->gas,",
    "expensas/consorcio->expensas, internet/WiFi->internet, municipalidad/ABL->municipalidad.",
    `Plataformas validas para ingresos: ${JSON.stringify(PLATFORMS)}.`,
    "",
    `La fecha de hoy es ${today} (zona America/Argentina/Buenos_Aires).`,
    "Interpreta fechas relativas (hoy, ayer, el lunes) en base a esa fecha.",
    "Todas las fechas en formato ISO yyyy-MM-dd.",
    "Los montos son numeros sin simbolos ni separadores de miles (usa punto decimal).",
    "",
    "Reglas:",
    "- Para gastos variables: completa 'categoria' y 'fecha'.",
    "- Para gastos fijos: completa 'mes' y 'anio' (default mes actual " + month +
      " y anio " + year + " si no se menciona).",
    "  Usa 'concepto_fijo' + 'monto' para UN concepto, o 'conceptos_fijos' con varios.",
    "  Ejemplo: luz 15000 gas 8000 en Trejo -> conceptos_fijos: {luz:15000,gas:8000}.",
    "- Para ingresos: completa 'plataforma', 'monto' y fechas de estadia si las hay.",
    "- Para ingresos, si se menciona limpieza ponela en 'limpieza'; si no, null.",
    "- En fotos/facturas: indica 'confianza' (0 a 1) de tu lectura.",
    "  Si la imagen es borrosa, ilegible o falta propiedad/concepto/monto,",
    "  marca necesita_aclaracion=true y pregunta concreto en mensaje_aclaracion.",
    "- Si falta info critica, necesita_aclaracion=true y mensaje_aclaracion claro.",
    "- 'descripcion' es un resumen corto legible de la operacion.",
    "",
    "Responde UNICAMENTE con un objeto JSON con esta estructura exacta:",
    JSON.stringify(
      {
        tipo: "ingreso|gasto|gasto_fijo|desconocido",
        propiedad: "string|null",
        monto: "number|null",
        fecha: "yyyy-MM-dd|null",
        categoria: "string|null",
        plataforma: "string|null",
        check_in: "yyyy-MM-dd|null",
        check_out: "yyyy-MM-dd|null",
        limpieza: "number|null",
        mes: "number|null",
        anio: "number|null",
        concepto_fijo: "expensas|luz|agua|gas|internet|municipalidad|otros|null",
        conceptos_fijos: "{luz?:number, gas?:number, ...}|null",
        descripcion: "string",
        confianza: "number|null",
        necesita_aclaracion: "boolean",
        mensaje_aclaracion: "string",
      },
      null,
      0,
    ),
  ].join("\n");
}

function normalizeConcepts(
  raw: Partial<Record<string, number>> | null | undefined,
): Partial<Record<FixedConcept, number>> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Partial<Record<FixedConcept, number>> = {};
  for (const key of FIXED_CONCEPTS) {
    const val = raw[key];
    if (typeof val === "number" && val > 0) out[key] = val;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function normalizeConcept(value: string | null | undefined): FixedConcept | null {
  if (!value) return null;
  return FIXED_CONCEPTS.includes(value as FixedConcept)
    ? (value as FixedConcept)
    : null;
}

// Extrae los conceptos fijos con montos del registro parseado.
export function extractFixedAmounts(
  record: ParsedRecord,
): Partial<Record<FixedConcept, number>> {
  const result: Partial<Record<FixedConcept, number>> = {};
  const fromObject = normalizeConcepts(record.conceptos_fijos);
  if (fromObject) {
    for (const [k, v] of Object.entries(fromObject)) {
      result[k as FixedConcept] = v;
    }
  }
  const concept = normalizeConcept(record.concepto_fijo);
  if (concept && typeof record.monto === "number" && record.monto > 0) {
    result[concept] = (result[concept] ?? 0) + record.monto;
  }
  return result;
}

export function fixedAmountsTotal(
  amounts: Partial<Record<FixedConcept, number>>,
): number {
  return Object.values(amounts).reduce((sum, n) => sum + (n ?? 0), 0);
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
    mes: typeof parsed.mes === "number" ? parsed.mes : null,
    anio: typeof parsed.anio === "number" ? parsed.anio : null,
    concepto_fijo: normalizeConcept(parsed.concepto_fijo),
    conceptos_fijos: normalizeConcepts(parsed.conceptos_fijos),
    descripcion: parsed.descripcion ?? "",
    confianza: typeof parsed.confianza === "number" ? parsed.confianza : null,
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
          text:
            "Extrae los datos financieros de este comprobante/foto. " +
            "Si es una factura de servicio (luz, gas, agua, expensas, etc.) clasificalo como gasto_fijo. " +
            "Si no podes leer bien algun dato, indica confianza baja y pide aclaracion. " +
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

// Combina un parseo parcial (ej. de una foto) con la respuesta del usuario.
export function mergeFromClarification(
  partial: ParsedRecord,
  userReply: string,
  propertyNames: string[],
  today: string,
): Promise<ParsedRecord> {
  const cfg = getConfig();
  return chatToJson(cfg, cfg.textModel, [
    { role: "system", content: buildSystemPrompt(propertyNames, today) },
    {
      role: "user",
      content: [
        "Tuve un parseo parcial de una foto/comprobante y el usuario aclaro datos.",
        "Combina ambos y devolve el JSON final completo.",
        "",
        "Parseo parcial:",
        JSON.stringify(partial, null, 2),
        "",
        "Aclaracion del usuario:",
        userReply,
      ].join("\n"),
    },
  ]);
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
