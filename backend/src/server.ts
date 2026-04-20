import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';

// Import Routes (To be created)
import { n8nUploadServiceBackground, n8nChatProxy, uploadEventEmitter } from './services/n8n.service';

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

        // Forward to n8n webhook IN BACKGROUND (in-memory queue for sequential process)
        n8nUploadServiceBackground(files).catch((err) => {
            console.error('[Background Worker Error]', err);
        });

        // TODO: Save securely to MySQL database using Prisma
        
        return res.status(200).json({ 
            message: 'Archivos recibidos en el backend. Procesando cola hacia n8n en segundo plano.'
        });
    } catch (error: any) {
        console.error('Upload Error:', error.message);
        return res.status(500).json({ error: 'Server error processing file upload' });
    }
});

// Route: Chatbot Proxy to N8N
app.post('/api/chat', async (req, res) => {
    try {
        // Sanitize Input carefully here to prevent Prompt Injection
        const { message, sessionId } = req.body;
        if (!message) return res.status(400).json({ error: 'Message payload missing' });

        const aiResponse = await n8nChatProxy(message, sessionId);

        // TODO: Store chat exchange in MySQL database

        return res.status(200).json(aiResponse);
    } catch (error: any) {
        console.error('Chat Proxy Error:', error.message);
        return res.status(500).json({ error: 'Failed to contact AI service. Graceful degradation applied.' });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Abogados API Server running securely on port ${PORT}`);
});
