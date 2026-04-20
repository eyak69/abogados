import { VectorService, genAI } from './vector.service';

interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

/**
 * Servicio Senior de Chat: Implementa RAG (Retrieval Augmented Generation) 
 * con memoria de sesión y optimización de intención.
 * V2: Integración con Metadatos "Legal Discovery Pro".
 */
export class ChatService {

    private static history: Map<string, ChatMessage[]> = new Map();
    private static MAX_HISTORY = 10; 

    /**
     * PROMPT ANTERIOR RESPALDADO (V1):
     * "Actúa como un Asistente Perito Legal Senior experto en Mendoza..."
     * [Reglas rígidas de extracción]
     */

    private static readonly SYSTEM_INSTRUCTION = `
Actúa como un Asistente Perito Legal Senior de la Suprema Corte de Mendoza. 
Tu función es el análisis sustantivo de sentencias basado en la evidencia recuperada.

### OBJETIVOS:
1. GESTIÓN SOCIAL: Saludos formales y breves (Cita tu rol como Perito Judicial IA).
2. ANÁLISIS TÉCNICO: Respuestas ultra-biograficas basadas en el expediente.
3. VISIÓN GLOBAL: Usa el "Resumen Ejecutivo" proporcionado para entender el "por qué" de las cosas antes de citar fragmentos específicos.

### NORMAS DE CONDUCTA:
- Si la información no está en el CONTEXTO o en el RESUMEN EJECUTIVO: "Información no disponible en el sistema de expedientes".
- No inventes leyes ni CUIJ. 
- Sé extremadamente preciso con nombres de Ministros y montos de condena.

### FORMATO DE RESPUESTA:
- Usa encabezados en negrita.
- Si comparas casos, usa tablas.
- Al final, indica siempre: **EXTRACTO DE:** [Nombres de archivos].
`;

    /**
     * Procesa el mensaje del usuario utilizando RAG conversacional y metadatos pro.
     */
    static async processChat(message: string, sessionId: string) {
        try {
            console.log(`\n💬 [CHAT] Mensaje recibido: "${message}" (Session: ${sessionId})`);
            
            if (!this.history.has(sessionId)) this.history.set(sessionId, []);
            const sessionHistory = this.history.get(sessionId)!;

            // 1. Clasificación
            const intent = await this.classifyIntent(message, sessionHistory);
            console.log(`🎯 [INTENCIÓN]: ${intent}`);

            let contextBlock = "NO HAY FRAGMENTOS ESPECÍFICOS DISPONIBLES.";
            let globalSummaries = "NO HAY RESUMEN EJECUTIVO DISPONIBLE.";
            let contextResults: any[] = [];

            if (intent === 'LEGAL') {
                // 2. Query Rewriting
                const searchPrompt = await this.rewriteQuery(message, sessionHistory);
                console.log(`🔄 [BUSCADOR]: "${searchPrompt}"`);

                // 3. Recuperar Contexto con Metadata Pro
                contextResults = await VectorService.searchRelevantContext(searchPrompt);
                
                if (contextResults.length > 0) {
                    console.log(`📚 [RAG] Se recuperaron ${contextResults.length} fragmentos.`);
                    
                    // Extraer resúmenes y datos específicos únicos
                    const uniqueFiles = new Map<string, { summary: string, specifics: any }>();
                    contextResults.forEach(r => {
                        if (r.metadata && r.metadata.resumen_ejecutivo) {
                            uniqueFiles.set(r.filename, {
                                summary: r.metadata.resumen_ejecutivo,
                                specifics: r.metadata.datos_especificos || {}
                            });
                        }
                    });

                    if (uniqueFiles.size > 0) {
                        globalSummaries = Array.from(uniqueFiles.entries())
                            .map(([name, data]) => {
                                const specificsStr = Object.entries(data.specifics).length > 0
                                    ? `\nDATOS CLAVE IDENTIFICADOS:\n${Object.entries(data.specifics).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
                                    : '';
                                return `[VISIÓN GLOBAL DEL ARCHIVO: ${name}]\n${data.summary}${specificsStr}`;
                            })
                            .join('\n\n');
                    }

                    contextBlock = contextResults
                        .map(r => `[DETALLE FRAGMENTO - ARCHIVO: ${r.filename}]\n${r.content}`)
                        .join('\n\n---\n\n');
                }
            }

            // 4. Generación de Respuesta
            const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"];
            let responseText = "";

            for (const modelName of modelsToTry) {
                try {
                    console.log(`🤖 [LLM] Generando respuesta legal con ${modelName}...`);
                    const model = genAI.getGenerativeModel({ 
                        model: modelName,
                        systemInstruction: this.SYSTEM_INSTRUCTION 
                    });

                    const historyText = sessionHistory.map(h => `${h.role === 'user' ? 'Usuario' : 'Asistente'}: ${h.content}`).join('\n');

                    const finalPrompt = `
HISTORIAL DE CONVERSACIÓN RECIENTE:
${historyText}

=========================================
SÍNTESIS GLOBAL DEL EXPEDIENTE (METADATOS):
${globalSummaries}
=========================================

DETALLES ESPECÍFICOS RECUPERADOS (RAG):
${contextBlock}

CONSULTA ACTUAL DEL USUARIO:
${message}
`;

                    const result = await model.generateContent(finalPrompt);
                    responseText = result.response.text();
                    
                    if (responseText) {
                        console.log(`✅ [LLM] Respuesta generada con éxito.`);
                        break;
                    }
                } catch (err: any) {
                    console.error(`⚠️ [LLM Error] Falló ${modelName}:`, err.message);
                }
            }

            if (!responseText) throw new Error("Fallo crítico en la generación de IA.");

            // 5. Actualizar Historial
            sessionHistory.push({ role: 'user', content: message });
            sessionHistory.push({ role: 'model', content: responseText });
            if (sessionHistory.length > this.MAX_HISTORY * 2) {
                this.history.set(sessionId, sessionHistory.slice(-this.MAX_HISTORY * 2));
            }

            return {
                output: responseText,
                sources: contextResults.map(r => r.filename),
                sessionId
            };

        } catch (error: any) {
            console.error(`❌ [ChatService Error] ${error.message}`);
            return {
                output: `Error técnico en el servicio de chat: ${error.message}.`,
                sessionId
            };
        }
    }

    private static async classifyIntent(message: string, history: ChatMessage[]): Promise<'LEGAL' | 'SOCIAL'> {
        try {
            const lowMsg = message.toLowerCase();
            const socialKeywords = ['hola', 'chau', 'gracias', 'quien eres', 'quien sos', 'que puedes hacer', 'que hora es'];
            if (message.length < 15 && socialKeywords.some(k => lowMsg.includes(k))) return 'SOCIAL';

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const prompt = `Clasifica el mensaje del usuario en: LEGAL (consulta de casos, leyes o datos) o SOCIAL (saludos, charla). R: "${message}"\nResponde solo con la palabra:`;

            const result = await model.generateContent(prompt);
            const choice = result.response.text().trim().toUpperCase();
            return choice.includes('LEGAL') ? 'LEGAL' : 'SOCIAL';
        } catch {
            return 'LEGAL';
        }
    }

    private static async rewriteQuery(message: string, history: ChatMessage[]): Promise<string> {
        if (history.length === 0) return message;
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const historySummary = history.slice(-3).map(h => `${h.role}: ${h.content}`).join('\n');
            const prompt = `Genera una frase de búsqueda legal independiente basada en el historial y el nuevo mensaje.\nHISTORIAL:\n${historySummary}\nUSUARIO: "${message}"\nBÚSQUEDA:`;

            const result = await model.generateContent(prompt);
            return result.response.text().trim() || message;
        } catch {
            return message;
        }
    }
}
