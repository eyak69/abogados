import fs from 'fs';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { prisma } from '../lib/prisma';
import { uploadEventEmitter } from './n8n.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;

dotenv.config();

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
export const qdrantUrl = process.env.QDRANT_URL?.replace(/\/$/, '') || 'http://qdrant:6333';
export const qdrantKey = process.env.QDRANT_API_KEY;
export const collectionName = process.env.QDRANT_COLLECTION_NAME || 'abogados_v2';


/**
 * Esquema de Metadatos Legal Discovery Pro (Evolutivo).
 * Ahora incluye una capa dinámica para capturar variables legales inesperadas.
 */
export interface ExtractedMetadata {
    // Identificación
    cuij: string;
    causa_nro: string;
    caratula: string;
    actoras: string[];
    demandados: string[];
    
    // Clasificación RAG Premium
    especialidad: string; 
    tipo_proceso: string; 
    instancia: string; 
    tribunal: string;
    
    // Inteligencia Sustantiva
    resumen_ejecutivo: string; 
    resultado: string; 
    postura_tribunal: string; 
    
    // Datos Cuantitativos
    monto_condena_estimado: number;
    monto_honorarios_total: number;
    fecha_sentencia: string; 
    
    // CAPA DINÁMICA (Hallazgos Fantásticos)
    // Aquí la IA guarda datos únicos del expediente que no caben en los campos fijos.
    datos_especificos: Record<string, any>;
    
    // Tags y Métricas
    ministros: string[];
    temas_clave: string[];
}

export class VectorService {

    /**
     * Motor de procesamiento Soberano.
     * @param filePath Ruta del archivo en disco.
     * @param originalName Nombre original para logs.
     * @param documentId ID de la DB para auditoría persistente.
     */
    static async processAndIngest(filePath: string, originalName: string, documentId: string) {
        let fileHash = '';
        try {
            console.log(`\n🚀 [PROCESO INICIADO] ${originalName}`);
            uploadEventEmitter.emit('progress', { 
                filename: originalName, 
                status: 'info', 
                message: 'Iniciando procesamiento de expediente...',
                log: `[${new Date().toLocaleTimeString()}] 🚀 Iniciando flujo soberano para: ${originalName}`
            });

            if (!fs.existsSync(filePath)) throw new Error(`Archivo no encontrado: ${filePath}`);

            const dataBuffer = fs.readFileSync(filePath);
            
            // Calculamos Hash real para unicidad
            fileHash = crypto.createHash('md5').update(dataBuffer).digest('hex');
            
            const existing = await this.findByHash(fileHash);
            if (existing) {
                uploadEventEmitter.emit('progress', { 
                    filename: originalName, 
                    status: 'duplicate', 
                    message: 'Documento ya existente.',
                    log: `[${new Date().toLocaleTimeString()}] ⚠️ El hash ${fileHash} ya existe en el repositorio.`
                });
                return { metadata: existing, fileHash };
            }

            let fullText: string;
            try {
                const pdfData = await pdf(dataBuffer);
                fullText = pdfData.text;
            } catch (err: any) {
                console.error(`❌ [PDF ERROR] typeof pdf=${typeof pdf}, error=${err.message}`, err.stack);
                throw new Error(`Error procesando PDF: ${err.message}`);
            }


            await this.saveLog(documentId, 'INFO', `🧠 Consultando modelos Gemini para extracción legal...`, originalName);

            const metadata = await this.extractStructuredMetadata(fullText);
            
            // Persistencia de Metadatos en el Documento Principal
            await prisma.document.update({
                where: { id: documentId },
                data: { 
                    metadata: metadata as any,
                    status: 'VECTORIZED'
                }
            });

            // Log de metadatos completos en formato JSON persistente
            await this.saveLog(documentId, 'INFO', `Metadatos detectados (IA):\n${JSON.stringify(metadata, null, 2)}`, originalName);
            
            await this.saveLog(documentId, 'INFO', `🔢 Generando vectores de alta dimensión (gemini-embedding-001)...`, originalName);

            const chunks = this.chunkBySentences(fullText, 1800, 400);
            await this.ensureCollection(0);

            const BATCH_SIZE_LIMIT = 3;
            for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE_LIMIT) {
                const batchChunks = chunks.slice(batchStart, batchStart + BATCH_SIZE_LIMIT);
                
                await this.saveLog(documentId, 'INFO', `📥 Indexando batch ${batchStart} - ${batchStart + batchChunks.length} en Qdrant...`, originalName);

                const vectors: number[][] = [];
                for (const chunk of batchChunks) {
                    vectors.push(await this.generateEmbedding(chunk));
                }

                const points = batchChunks.map((chunk, i) => ({
                    id: this.makePointId(fileHash, batchStart + i),
                    vector: vectors[i],
                    payload: {
                        content: chunk,
                        filename: originalName,
                        ...metadata, 
                        file_hash: fileHash
                    }
                }));
                await this.batchUpsertToQdrant(points);
                
                if (batchStart + BATCH_SIZE_LIMIT < chunks.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            await this.saveLog(documentId, 'SUCCESS', `✅ ¡Procesamiento completado con éxito!`, originalName);

            // --- PURGA AUTOMÁTICA (Regla 1: No es un repositorio de archivos) ---
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`♻️ [Purga] Archivo binario eliminado tras vectorización: ${originalName}`);
                    await this.saveLog(documentId, 'INFO', `♻️ Archivo físico purgado para optimizar almacenamiento.`, originalName);
                }
            } catch (purgeErr: any) {
                console.warn(`[Purga Error] No se pudo borrar ${filePath}: ${purgeErr.message}`);
            }

            return { metadata, fileHash };

        } catch (error: any) {
            console.error(`❌ [VectorService Error] ${error.message}`);
            await this.saveLog(documentId, 'ERROR', `❌ Fallo crítico: ${error.message}`, originalName);
            throw error;
        }
    }

    /**
     * Limpia la base vectorial de todos los fragmentos asociados a un archivo.
     */
    public static async deleteVectorsByHash(fileHash: string) {
        try {
            console.log(`🗑️ [VectorService] Borrando vectores para hash: ${fileHash}`);
            await axios.post(`${qdrantUrl}/collections/${collectionName}/points/delete`, {
                filter: {
                    must: [{ key: 'file_hash', match: { value: fileHash } }]
                }
            }, { headers: { 'api-key': qdrantKey } });
            return true;
        } catch (error: any) {
            console.error(`[VectorService] Error al borrar vectores:`, error.message);
            return false;
        }
    }


    public static async searchRelevantContext(query: string, limit: number = 8) {
        try {
            console.log(`🔍 [RAG] Buscando para: "${query.substring(0, 50)}..."`);
            const vector = await this.generateEmbedding(query);
            const res = await axios.post(`${qdrantUrl}/collections/${collectionName}/points/search`, {
                vector, limit, with_payload: true, score_threshold: 0.45
            }, { headers: { 'api-key': qdrantKey, 'Content-Type': 'application/json' } });

            const results = res.data?.result || [];
            return results.map((r: any) => ({
                content: r.payload.content,
                filename: r.payload.filename,
                metadata: r.payload,
                score: r.score
            }));
        } catch (error: any) {
            console.error(`[VectorService] Error RAG:`, error.message);
            return [];
        }
    }

    private static async extractStructuredMetadata(fullText: string): Promise<ExtractedMetadata> {
        // Modelos disponibles en v1beta (Regla 11: Resiliencia ante cambios de Google)
        const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"];

        const defaultMetadata: ExtractedMetadata = {
            cuij: "N/A", causa_nro: "N/A", caratula: "N/A", actoras: [], demandados: [],
            especialidad: "Desconocida", tipo_proceso: "N/A", instancia: "N/A", tribunal: "N/A",
            resumen_ejecutivo: "Extracción automática fallida.", resultado: "N/A", postura_tribunal: "N/A",
            monto_condena_estimado: 0, monto_honorarios_total: 0, fecha_sentencia: "",
            ministros: [], temas_clave: [], datos_especificos: {}
        };

        const promptFijo = `Eres un Auditor Legal Senior. Analiza este fragmento de sentencia y extrae SOLO los campos fijos.
RESPONDE ÚNICAMENTE CON JSON VÁLIDO, sin markdown:
{
  "cuij": "XX-XXXXXXXX-X o N/A",
  "causa_nro": "string",
  "caratula": "string",
  "actoras": ["string"],
  "demandados": ["string"],
  "especialidad": "Laboral|Civil|Penal|Comercial|Familia|Administrativo",
  "tipo_proceso": "string",
  "instancia": "Primera Instancia|Cámara|Corte",
  "tribunal": "string",
  "resumen_ejecutivo": "Hechos / Conflicto / Resolución",
  "resultado": "string",
  "postura_tribunal": "string",
  "monto_condena_estimado": 0,
  "monto_honorarios_total": 0,
  "fecha_sentencia": "YYYY-MM-DD",
  "ministros": ["string"],
  "temas_clave": ["string"]
}
TEXTO:
${fullText.substring(0, 15000)}`;

        for (const modelName of modelsToTry) {
            try {
                console.log(`🧠 [IA] Intentando extracción con: ${modelName}...`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const r = await model.generateContent(promptFijo);
                
                const response = r.response;
                const rawText = response.text().replace(/```json|```/g, '').trim();
                const base = JSON.parse(rawText);

                console.log(`✅ [IA] Extracción exitosa con ${modelName}`);
                return {
                    ...defaultMetadata,
                    ...base,
                    cuij: String(base.cuij || 'N/A'),
                    caratula: String(base.caratula || 'N/A')
                };
            } catch (err: any) {
                // Manejo Senior de errores (Regla 11)
                const isOverloaded = err.message.includes('503') || err.message.includes('high demand');
                const isNotFound = err.message.includes('404') || err.message.includes('not found');
                
                if (isOverloaded) {
                    console.warn(`⚠️ [IA] Modelo ${modelName} saturado (503).`);
                } else if (isNotFound) {
                    console.warn(`⚠️ [IA] Modelo ${modelName} no disponible en este endpoint (404).`);
                } else {
                    console.warn(`⚠️ [IA] Error inesperado con ${modelName}: ${err.message}`);
                }
                continue; 
            }
        }

        throw new Error("Todos los modelos de IA fallaron. No se puede grabar sin metadatos legibles.");
    }


    private static chunkBySentences(text: string, maxSize: number, overlap: number): string[] {
        const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 20);
        const chunks: string[] = [];
        let current = '';

        for (let i = 0; i < paragraphs.length; i++) {
            const para = paragraphs[i];
            
            // Si el párrafo solo ya excede el tamaño, lo metemos como chunk único (aunque sea grande)
            if (para.length > maxSize) {
                if (current) chunks.push(current.trim());
                chunks.push(para.substring(0, maxSize));
                current = ""; // O podrías implementar lógica para el excedente
                continue;
            }

            if ((current + '\n\n' + para).length <= maxSize) {
                current = current ? current + '\n\n' + para : para;
            } else {
                if (current) chunks.push(current.trim());
                
                // --- LÓGICA DE OVERLAP REAL (Regla 7) ---
                // Retrocedemos un poco para que el siguiente chunk tenga contexto del anterior
                const lastContent = current.substring(current.length - overlap);
                current = lastContent + '\n\n' + para;
            }
        }
        if (current) chunks.push(current.trim());
        return chunks;
    }


    public static async generateEmbedding(text: string, attempt = 1): Promise<number[]> {
        try {
            // Reversión por estabilidad a gemini-embedding-001
            const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
            const result = await model.embedContent(text);
            return result.embedding.values;
        } catch (error: any) {
            const isRateLimit = error.message?.includes('429') || error.status === 429;
            if (isRateLimit && attempt <= 5) {
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                const warnMsg = `⚠️ [Cuota] 429 detectado. Reintento ${attempt}/5 en ${Math.round(delay)}ms...`;
                console.warn(warnMsg);
                
                uploadEventEmitter.emit('progress', { 
                    status: 'warn', 
                    log: `[${new Date().toLocaleTimeString()}] ${warnMsg}`
                });

                await new Promise(resolve => setTimeout(resolve, delay));
                return this.generateEmbedding(text, attempt + 1);
            }
            
            uploadEventEmitter.emit('progress', { 
                status: 'error', 
                log: `[${new Date().toLocaleTimeString()}] ❌ Error en IA: ${error.message}`
            });
            console.error(`❌ [VectorService Error]`, error.message);
            throw error;
        }
    }


    private static makePointId(fileHash: string, index: number): string {
        return crypto.createHash('md5').update(`${fileHash}::${index}`).digest('hex')
            .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    }

    private static async ensureCollection(vectorSize: number) {
        try {
            await axios.get(`${qdrantUrl}/collections/${collectionName}`, { headers: { 'api-key': qdrantKey } });
        } catch {
            if (vectorSize === 0) {
                const sample = await this.generateEmbedding('test');
                vectorSize = sample.length;
            }
            console.log(`[VectorService] Creando colección "${collectionName}"...`);
            await axios.put(`${qdrantUrl}/collections/${collectionName}`, {
                vectors: { size: vectorSize, distance: 'Cosine' }
            }, { headers: { 'api-key': qdrantKey, 'Content-Type': 'application/json' } });

            const fieldsToIndex = ['file_hash', 'cuij', 'especialidad', 'instancia', 'resultado'];
            for (const field of fieldsToIndex) {
                await axios.put(`${qdrantUrl}/collections/${collectionName}/index`, {
                    field_name: field,
                    field_schema: 'keyword'
                }, { headers: { 'api-key': qdrantKey } });
            }
        }
    }

    private static async findByHash(fileHash: string): Promise<any> {
        try {
            const res = await axios.post(`${qdrantUrl}/collections/${collectionName}/points/scroll`, {
                filter: { must: [{ key: 'file_hash', match: { value: fileHash } }] },
                limit: 1
            }, { headers: { 'api-key': qdrantKey } });
            if (res.data?.result?.points?.length > 0) return res.data.result.points[0].payload;
        } catch (err: any) {
            console.warn('[VectorService] findByHash: Qdrant no disponible:', err.message);
        }
        return null;
    }

    private static async batchUpsertToQdrant(points: any[]) {
        await axios.put(`${qdrantUrl}/collections/${collectionName}/points`, { points }, {
            headers: { 'api-key': qdrantKey, 'Content-Type': 'application/json' }
        });
    }

    // Helper para persistencia de logs (Regla 13)
    private static async saveLog(documentId: string, level: string, message: string, filename?: string) {
        try {
            await (prisma as any).documentLog.create({
                data: {
                    documentId: documentId,
                    level: level,
                    message: message
                }
            });

            // También emitir a la terminal activa por SSE
            uploadEventEmitter.emit('progress', { 
                filename: filename || 'system', 
                status: level.toLowerCase(), 
                log: `[${new Date().toLocaleTimeString()}] ${message}`
            });
        } catch (err) {
            console.error("Error guardando log persistente:", err);
        }
    }
}
