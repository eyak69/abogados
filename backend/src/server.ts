import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

import { uploadEventEmitter } from './services/n8n.service';
import { VectorService, qdrantUrl, qdrantKey, collectionName } from './services/vector.service';
import { ChatService } from './services/chat.service';
import { ExportService } from './services/export.service';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Disk Storage configuration securely inside the volume
const storage = multer.diskStorage({
    destination: (req, res, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Health Check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// SSE Route: Live progress updates to Frontend
app.get('/api/upload/status', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // For CORS environments, flush headers directly:
    res.flushHeaders();

    const onProgress = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    uploadEventEmitter.on('progress', onProgress);

    req.on('close', () => {
        uploadEventEmitter.off('progress', onProgress);
    });
});

// Route: Upload to Backend and Forward to N8N
app.post('/api/upload', upload.array('data'), async (req, res) => {
    try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files provided' });
        }

        // Internal Vectorization Experiment (Back-Direct-to-Qdrant)
        (async () => {
            for (const file of files) {
                try {
                    await VectorService.processAndIngest(file.path, file.originalname);
                } catch (err) {
                    console.error(`[Experiment Error] Fallo en ${file.originalname}:`, err);
                }
            }
        })().catch(err => console.error('[Fatal Background Error]', err));

        // TODO: Save securely to MySQL database using Prisma
        
        return res.status(200).json({ 
            message: 'Archivos recibidos. Iniciando experiment de vectorización directa a Qdrant.'
        });
    } catch (error: any) {
        console.error('Upload Error:', error.message);
        return res.status(500).json({ error: 'Server error processing file upload' });
    }
});

// Route: Re-index all PDFs in uploads/
app.post('/api/reindex', async (_req, res) => {
    const uploadsDir = path.join(__dirname, '../uploads');
    const files = fs.readdirSync(uploadsDir).filter((f: string) => f.endsWith('.pdf'));

    if (files.length === 0) {
        return res.status(400).json({ error: 'No hay PDFs en uploads/' });
    }

    // Borrar colección entera para empezar limpio
    try {
        await axios.delete(`${qdrantUrl}/collections/${collectionName}`, {
            headers: { 'api-key': qdrantKey }
        });
        console.log(`🗑️ [REINDEX] Colección "${collectionName}" borrada.`);
    } catch {
        console.log(`[REINDEX] Colección no existía, continuando...`);
    }

    res.status(202).json({ message: `Re-indexando ${files.length} archivos en background...` });

    (async () => {
        console.log(`\n🔄 [REINDEX] Iniciando re-indexación de ${files.length} archivos...`);
        for (const filename of files) {
            const filePath = path.join(uploadsDir, filename);
            try {
                await VectorService.processAndIngest(filePath, filename);
            } catch (err) {
                console.error(`[REINDEX] Fallo en ${filename}:`, err);
            }
        }
        console.log(`✅ [REINDEX] Re-indexación completa.`);
    })().catch(err => console.error('[REINDEX Fatal]', err));
});

// Route: Chatbot Proxy to N8N
app.post('/api/chat', async (req, res) => {
    try {
        // Sanitize Input carefully here to prevent Prompt Injection
        const { message, sessionId } = req.body;
        if (!message) return res.status(400).json({ error: 'Message payload missing' });

        const aiResponse = await ChatService.processChat(message, sessionId);

        // TODO: Store chat exchange in MySQL database

        return res.status(200).json(aiResponse);
    } catch (error: any) {
        console.error('Chat Service Error:', error.message);
        return res.status(500).json({ error: 'Fallo al contactar al servicio de IA soberano.' });
    }
});

// Route: Export Single Message or History to PDF
app.post('/api/chat/export/pdf', async (req, res) => {
    try {
        const { content, title } = req.body;
        if (!content) return res.status(400).json({ error: 'Content is required' });

        console.log(`🖨️ [EXPORT] Generando PDF: ${title || 'Informe'}`);
        const pdfBuffer = await ExportService.generatePDF(content, title);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(title || 'informe')}.pdf`);
        return res.send(pdfBuffer);
    } catch (error: any) {
        console.error('PDF Export Error:', error.message);
        return res.status(500).json({ error: 'Fallo al generar el PDF legal.' });
    }
});

// Route: Export Single Message or History to Word
app.post('/api/chat/export/word', async (req, res) => {
    try {
        const { content, title } = req.body;
        if (!content) return res.status(400).json({ error: 'Content is required' });

        console.log(`📝 [EXPORT] Generando Word: ${title || 'Informe'}`);
        const docxBuffer = await ExportService.generateWord(content, title);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(title || 'informe')}.docx`);
        return res.send(docxBuffer);
    } catch (error: any) {
        console.error('Word Export Error:', error.message);
        return res.status(500).json({ error: 'Fallo al generar el documento Word.' });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Abogados API Server running securely on port ${PORT}`);
});
