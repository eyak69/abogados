import fs from 'fs';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { uploadEventEmitter } from './n8n.service';

const pdf = require('pdf-parse');

dotenv.config();

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
export const qdrantUrl = process.env.QDRANT_URL?.replace(/\/$/, '') || 'https://qdrant.cristiananton.dev';
export const qdrantKey = process.env.QDRANT_API_KEY;
export const collectionName = process.env.QDRANT_COLLECTION_NAME || 'abogados_v2';

const BATCH_SIZE = 20;

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

    static async processAndIngest(filePath: string, originalName: string) {
        try {
            console.log(`\n🚀 [SOLICITUD RECIBIDA] Procesando: ${originalName}`);
            uploadEventEmitter.emit('progress', { filename: originalName, status: 'processing', message: 'Extrayendo texto...' });

            if (!fs.existsSync(filePath)) throw new Error(`Archivo no encontrado: ${filePath}`);

            const dataBuffer = fs.readFileSync(filePath);
            const fileHash = crypto.createHash('md5').update(dataBuffer).digest('hex');
            
            const existing = await this.findByHash(fileHash);
            if (existing) {
                console.log(`⚠️ [DUPLICADO] El archivo ya fue indexado.`);
                uploadEventEmitter.emit('progress', { filename: originalName, status: 'duplicate', message: 'El archivo ya fue indexado anteriormente.' });
                return existing;
            }

            let fullText: string;
            if (typeof pdf === 'function') {
                const pdfData = await pdf(dataBuffer);
                fullText = pdfData.text;
            } else if (pdf.PDFParse) {
                const parser = new pdf.PDFParse({ data: dataBuffer });
                const result = await parser.getText();
                fullText = result.text;
            } else {
                throw new Error('Estructura de pdf-parse no reconocida.');
            }
            console.log(`✅ [1/5] Texto extraído (${fullText.length} caracteres).`);

            console.log(`🧠 [2/5] Ejecutando Extracciones Dinámicas (IA)...`);
            uploadEventEmitter.emit('progress', { filename: originalName, status: 'processing', message: 'Ejecutando Legal Discovery Evolutivo (Datos Dinámicos)...' });
            
            const metadata = await this.extractStructuredMetadata(fullText);
            console.log(`📋 [METADATOS EXTRAÍDOS]:\n${JSON.stringify(metadata, null, 2)}`);

            // Log especial para Hallazgos Dinámicos
            const dynamicKeys = Object.keys(metadata.datos_especificos || {});
            if (dynamicKeys.length > 0) {
                console.log(`\n✨ [HALLAZGOS FANTÁSTICOS DETECTADOS]:`);
                dynamicKeys.forEach(key => {
                    console.log(`   🔸 ${key}: ${metadata.datos_especificos[key]}`);
                });
                console.log('');
            }

            if (metadata.cuij === 'N/A' && metadata.caratula === 'N/A') {
                throw new Error('Metadatos insuficientes para indexar.');
            }

            const chunks = this.chunkBySentences(fullText, 1500, 200);
            await this.ensureCollection(0);

            for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
                const batchChunks = chunks.slice(batchStart, batchStart + BATCH_SIZE);
                uploadEventEmitter.emit('progress', { filename: originalName, status: 'processing', message: `Vectorizando... (${batchStart + batchChunks.length}/${chunks.length})` });

                const vectors = await Promise.all(batchChunks.map(c => this.generateEmbedding(c)));

                const points = batchChunks.map((chunk, i) => {
                    const globalIndex = batchStart + i;
                    return {
                        id: this.makePointId(fileHash, globalIndex),
                        vector: vectors[i],
                        payload: {
                            content: chunk,
                            filename: originalName,
                            ...metadata, 
                            ingested_at: new Date().toISOString(),
                            file_hash: fileHash
                        }
                    };
                });
                await this.batchUpsertToQdrant(points);
            }

            console.log(`✨ [5/5] PROCESO COMPLETADO EXITOSAMENTE PARA: ${originalName}\n`);
            uploadEventEmitter.emit('progress', { filename: originalName, status: 'success', metadata });
            return metadata;

        } catch (error: any) {
            console.error(`❌ [VectorService Error] ${error.message}`);
            uploadEventEmitter.emit('progress', { filename: originalName, status: 'error', message: error.message });
            throw error;
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
        const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash-001", "gemini-2.0-flash-lite"];

        // PASADA 1: campos fijos con el encabezado del documento (rápido y confiable)
        const promptFijo = `Eres un Auditor Legal Senior. Analiza este fragmento de sentencia y extrae SOLO los campos fijos.
RESPONDE ÚNICAMENTE CON JSON VÁLIDO, sin markdown:
{
  "cuij": "formato XX-XXXXXXXX-X o N/A",
  "causa_nro": "string",
  "caratula": "string",
  "actoras": ["string"],
  "demandados": ["string"],
  "especialidad": "Laboral|Civil|Penal|Comercial|Familia|Administrativo",
  "tipo_proceso": "string",
  "instancia": "Primera Instancia|Cámara|Corte",
  "tribunal": "string",
  "resumen_ejecutivo": "3 párrafos: Hechos / Conflicto / Resolución",
  "resultado": "string",
  "postura_tribunal": "string",
  "monto_condena_estimado": 0,
  "monto_honorarios_total": 0,
  "fecha_sentencia": "YYYY-MM-DD o vacío",
  "ministros": ["string"],
  "temas_clave": ["string"]
}
TEXTO (primeros 12000 caracteres):
${fullText.substring(0, 12000)}`;

        // PASADA 2: datos dinámicos con el texto completo (detecta hallazgos en el cuerpo del fallo)
        const promptDinamico = `Eres un investigador legal forense. Analizá la sentencia completa e identificá entre 3 y 8 datos únicos y específicos de ESTE caso que no son genéricos.
Ejemplos de buenas claves: "tasa_interes_aplicada", "pericia_contable_resultado", "nombre_testigo_clave", "acuerdo_conciliatorio_monto", "norma_aplicada", "incumplimiento_detectado", "plazo_cumplimiento_dias".
NO uses claves genéricas como "observaciones" o "notas".
RESPONDE ÚNICAMENTE CON UN JSON PLANO (un solo nivel, sin anidamiento):
{ "clave_especifica": "valor concreto", ... }
Si no encontrás datos únicos relevantes, devolvé: {}
TEXTO COMPLETO:
${fullText.substring(0, 60000)}`;

        let base: Partial<ExtractedMetadata> = {};
        let dinamico: Record<string, any> = {};

        // Ejecutar ambas pasadas en paralelo
        const [resBase, resDinamico] = await Promise.allSettled(
            modelsToTry.slice(0, 1).flatMap(modelName => [
                (async () => {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const r = await model.generateContent(promptFijo);
                    return JSON.parse(r.response.text().replace(/```json|```/g, '').trim());
                })(),
                (async () => {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const r = await model.generateContent(promptDinamico);
                    return JSON.parse(r.response.text().replace(/```json|```/g, '').trim());
                })()
            ])
        );

        // Fallback a modelos alternativos si el primero falló
        if (resBase.status === 'fulfilled') {
            base = resBase.value;
        } else {
            console.error(`[VectorService Meta] Pasada 1 falló: ${resBase.reason?.message}`);
            for (const modelName of modelsToTry.slice(1)) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const r = await model.generateContent(promptFijo);
                    base = JSON.parse(r.response.text().replace(/```json|```/g, '').trim());
                    break;
                } catch (err: any) {
                    console.error(`[VectorService Meta] Fallback ${modelName} falló: ${err.message}`);
                }
            }
        }

        if (resDinamico.status === 'fulfilled') {
            dinamico = resDinamico.value;
        } else {
            console.warn(`[VectorService Meta] Pasada dinámica falló, continuando sin datos específicos.`);
        }

        if (!base.cuij) throw new Error("Fallo crítico en extracción de metadatos.");

        // Validación y sanitización de tipos
        return {
            cuij:                  String(base.cuij   ?? 'N/A'),
            causa_nro:             String(base.causa_nro ?? 'N/A'),
            caratula:              String(base.caratula ?? 'N/A'),
            actoras:               Array.isArray(base.actoras) ? base.actoras : [],
            demandados:            Array.isArray(base.demandados) ? base.demandados : [],
            especialidad:          String(base.especialidad ?? 'N/A'),
            tipo_proceso:          String(base.tipo_proceso ?? 'N/A'),
            instancia:             String(base.instancia ?? 'N/A'),
            tribunal:              String(base.tribunal ?? 'N/A'),
            resumen_ejecutivo:     String(base.resumen_ejecutivo ?? ''),
            resultado:             String(base.resultado ?? 'N/A'),
            postura_tribunal:      String(base.postura_tribunal ?? ''),
            monto_condena_estimado: Number(base.monto_condena_estimado) || 0,
            monto_honorarios_total: Number(base.monto_honorarios_total) || 0,
            fecha_sentencia:       String(base.fecha_sentencia ?? ''),
            ministros:             Array.isArray(base.ministros) ? base.ministros : [],
            temas_clave:           Array.isArray(base.temas_clave) ? base.temas_clave : [],
            datos_especificos:     typeof dinamico === 'object' && !Array.isArray(dinamico) ? dinamico : {},
        };
    }

    private static chunkBySentences(text: string, maxSize: number, overlap: number): string[] {
        const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 20);
        const chunks: string[] = [];
        let current = '';
        for (const para of paragraphs) {
            if ((current + '\n\n' + para).length <= maxSize) {
                current = current ? current + '\n\n' + para : para;
            } else {
                if (current) chunks.push(current.trim());
                current = para;
            }
        }
        if (current) chunks.push(current.trim());
        return chunks;
    }

    public static async generateEmbedding(text: string): Promise<number[]> {
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const result = await model.embedContent(text);
        return result.embedding.values;
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
        } catch {}
        return null;
    }

    private static async batchUpsertToQdrant(points: any[]) {
        await axios.put(`${qdrantUrl}/collections/${collectionName}/points`, { points }, {
            headers: { 'api-key': qdrantKey, 'Content-Type': 'application/json' }
        });
    }
}
