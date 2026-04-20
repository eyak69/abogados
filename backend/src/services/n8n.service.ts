import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';
import crypto from 'crypto';

dotenv.config();

const UPLOAD_WEBHOOK = process.env.N8N_UPLOAD_WEBHOOK || '';
const CHAT_WEBHOOK = process.env.N8N_CHAT_WEBHOOK || '';

export const uploadEventEmitter = new EventEmitter();

const calculateMD5 = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', err => reject(err));
    });
};

/**
 * Background Service Queue to upload files to N8N Webhook sequentially
 */
export const n8nUploadServiceBackground = async (files: Express.Multer.File[]) => {
    for (const file of files) {
        try {
            uploadEventEmitter.emit('progress', { filename: file.originalname, status: 'processing' });
            const fileMd5 = await calculateMD5(file.path);
            
            const metadata = await uploadSingleFileWithRetry(file, fileMd5, 1);
            
            // Augment the JSON from n8n with filename and md5 securely
            if (typeof metadata === 'object' && metadata !== null) {
                metadata.md5 = fileMd5;
                metadata.filename = file.originalname;
            }
            
            console.log(`\n========================================`);
            console.log(`[Objeto Final Consolidado para MySQL]`);
            console.log(JSON.stringify(metadata, null, 2));
            console.log(`========================================\n`);

            uploadEventEmitter.emit('progress', { filename: file.originalname, status: 'success', metadata });
        } catch (error: any) {
            console.error(`[Background Queue] Fallo definitivo para el archivo ${file.originalname}:`, error.message);
            uploadEventEmitter.emit('progress', { filename: file.originalname, status: 'error', error: error.message });
            // Continuamos el bucle para no bloquear los documentos siguientes
        }
    }
}

const uploadSingleFileWithRetry = async (file: Express.Multer.File, fileMd5: string, attempt = 1): Promise<any> => {
    if (!UPLOAD_WEBHOOK) throw new Error('Webhook URL not configured');

    const form = new FormData();
    form.append('data', fs.createReadStream(file.path), file.originalname);

    try {
        const response = await axios.post(UPLOAD_WEBHOOK, form, {
            headers: {
                ...form.getHeaders()
            },
            timeout: 30000 // 30 second timeout per resilient practice
        });
        console.log(`[Background Queue] Archivo ${file.originalname} devuelto por n8n.`);
        return response.data;
    } catch (error: any) {
        const errorStatus = error.response ? error.response.status : null;
        
        // Regla: Si n8n arroja un 400 explícito, no hay "retry", abortamos este archivo.
        if (errorStatus === 400) {
            console.error(`[N8N Error 400] Rechazo explícito para el documento ${file.originalname}. Abortando reintento.`);
            throw new Error('N8N devolvió 400 Bad Request.');
        }

        // Exponential Backoff implementation (Rule 11)
        if (attempt <= 3) {
            console.warn(`[N8N Retry] Fallo de conexión de ${file.originalname}. Reintentando en ${attempt * 2}s...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            return uploadSingleFileWithRetry(file, fileMd5, attempt + 1);
        }
        throw new Error(`Expiraron los ${attempt} reintentos térmicos de red: ${error.message}`);
    }
}

/**
 * Service to proxy chat messages to N8N AI Chat Webhook
 */
export const n8nChatProxy = async (message: string, sessionId: string, attempt = 1): Promise<any> => {
    if (!CHAT_WEBHOOK) throw new Error('Chat Webhook URL not configured');

    try {
        const response = await axios.post(CHAT_WEBHOOK, { message, sessionId }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 120000 // 120 segundos para cadenas pesadas RAG/LLM
        });
        return response.data;
    } catch (error: any) {
        if (attempt <= 2) {
            console.warn(`[N8N Retry] Chat failed. Retrying in ${attempt * 2}s...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            return n8nChatProxy(message, sessionId, attempt + 1);
        }
        throw new Error(`Failed to reach AI service after ${attempt} attempts: ${error.message}`);
    }
}
