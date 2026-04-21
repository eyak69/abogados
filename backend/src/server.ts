import dotenv from 'dotenv';
dotenv.config();
import crypto from 'crypto';

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

import { uploadEventEmitter } from './services/n8n.service';
import { VectorService } from './services/vector.service';
import { ChatService } from './services/chat.service';
import { ExportService } from './services/export.service';
import { authenticate } from './middleware/auth';
import { requireRole } from './middleware/role.middleware';
import authRoutes from './routes/auth.routes';
import { prisma } from './lib/prisma';

const app = express();

const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://veritas.cristiananton.dev',
    'http://localhost:5173'
].filter(Boolean) as string[];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS bloqueado: ${origin}`));
        }
    },
    credentials: true
}));
app.use(express.json());

/**
 * AUDITORÍA DE INFRAESTRUCTURA (Regla 11 & 14)
 * Realiza un chequeo proactivo de las bases de datos antes de habilitar el servicio.
 */
async function runStartupChecks() {
    console.log('\n🛡️  [AUDITORÍA] Iniciando validación de infraestructura...');
    
    // 1. MySQL Check
    try {
        await prisma.$connect();
        console.log('✅ [MYSQL] Conexión exitosa. Base de datos sincronizada.');
    } catch (err: any) {
        console.error('❌ [MYSQL] Error crítico de conexión:', err.message);
        console.log('   Sugerencia: Verificá que DATABASE_URL en Coolify sea correcta.');
    }

    // 2. Qdrant Check
    try {
        const qUrl = process.env.QDRANT_URL?.replace(/\/$/, '') || 'http://localhost:6333';
        const qKey = process.env.QDRANT_API_KEY;
        await axios.get(`${qUrl}/collections`, { 
            headers: qKey ? { 'api-key': qKey } : {},
            timeout: 5000 
        });
        console.log(`✅ [QDRANT] Conexión exitosa a la red vectorial en: ${qUrl}`);
    } catch (err: any) {
        console.error(`❌ [QDRANT] Fallo de comunicación en ${process.env.QDRANT_URL}:`, err.message);
        console.log('   Sugerencia: Si usás URL pública, el 401 puede ser el proxy. Probá con http://qdrant:6333');
    }

    // 3. Environment Check
    const required = ['JWT_SECRET', 'GEMINI_API_KEY', 'GOOGLE_CLIENT_ID', 'INITIAL_EDITOR_EMAIL'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
        console.warn(`⚠️  [ENV] Faltan variables críticas: ${missing.join(', ')}`);
    } else {
        console.log('✅ [ENV] Variables de entorno completas.');
    }
    
    console.log('🚀 [READY] El cerebro legal está Online.\n');
}

// Servir archivos estáticos de uploads para previsualización si se desea (Solo en Dev)
app.use('/api/files', authenticate, express.static(path.join(__dirname, '../uploads')));

// RUTAS DE AUTENTICACIÓN
app.use('/api/auth', authRoutes);

// CONFIGURACIÓN DE ALMACENAMIENTO (REGRESO A MULTER SEGURO)
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dest = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'expediente-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF.'));
        }
    }
});

// HEALTH CHECK
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// SSE: PROGRESO DE CARGA
app.get('/api/upload/status', authenticate, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onProgress = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    uploadEventEmitter.on('progress', onProgress);
    req.on('close', () => uploadEventEmitter.off('progress', onProgress));
});

// ENDPOINT: CARGAR DOCUMENTOS (PROTEGIDO)
app.post('/api/upload', authenticate, requireRole('EDITOR'), upload.array('data'), async (req: any, res: any) => {
    try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) return res.status(400).json({ error: 'No se subieron archivos.' });

        const userId = req.user?.id;

        for (const file of files) {
            // 1. Registro inicial del documento para obtener ID de auditoría (Regla 10)
            const document = await prisma.document.create({
                data: {
                    filename: file.filename,
                    originalName: file.originalname,
                    size: file.size,
                    fileHash: `PENDING-${crypto.randomUUID()}`,
                    userId: userId || null,
                    status: 'PROCESSING',
                    metadata: {}
                }
            });

            // 2. Ejecución en background pasando el ID de auditoría
            VectorService.processAndIngest(file.path, file.originalname, document.id)
                .then(async ({ metadata, fileHash }) => {
                    await prisma.document.update({
                        where: { id: document.id },
                        data: {
                            status: 'VECTORIZED',
                            fileHash: fileHash, // Hash real
                            metadata: metadata as any
                        }
                    });
                })
                .catch(async (err) => {
                    console.error(`[Fatal Vector] ${file.originalname}:`, err.message);
                    
                    if (err.message === "INCOHERENT_METADATA") {
                        // RECHAZO TOTAL: Borramos el registro para no ensuciar la grilla (Regla 10)
                        await prisma.document.delete({ where: { id: document.id } });
                        console.log(`🧹 [Atomic Cleanup] Registro borrado por incoherencia: ${document.id}`);
                    } else {
                        await prisma.document.update({
                            where: { id: document.id },
                            data: { status: 'FAILED' }
                        });
                    }
                });
        }

        return res.json({ message: 'Procesamiento de expedientes iniciado en background.' });
    } catch (error: any) {
        console.error('[Upload Error]', error.message);
        res.status(500).json({ error: 'Fallo crítico en el servidor de carga.' });
    }
});

// ENDPOINT: LISTAR REPOSITORIO
app.get('/api/documents', authenticate, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || '1')));
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'))));
        const skip = (page - 1) * limit;

        const [docs, total] = await Promise.all([
            prisma.document.findMany({
                orderBy: { uploadedAt: 'desc' },
                include: { user: { select: { name: true, email: true } } },
                skip,
                take: limit
            }),
            prisma.document.count()
        ]);
        res.json({ docs, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error: any) {
        res.status(500).json({ error: 'Fallo al consultar el repositorio legal.' });
    }
});

// ENDPOINT: BORRADO SINCRONIZADO
app.delete('/api/documents/:id', authenticate, requireRole('EDITOR'), async (req, res) => {
    try {
        const id = req.params.id as string;
        const doc = await prisma.document.findUnique({ where: { id } });
        if (!doc) return res.status(404).json({ error: 'Expediente no hallado.' });

        // 1. Lógica de Integridad: Solo borrar vectores si es la última copia (Regla 1)
        const sameHashCount = await prisma.document.count({
            where: { fileHash: doc.fileHash }
        });

        if (sameHashCount === 1) {
            console.log(`🗑️ [Vector Delete] Borrando vectores: es la última referencia para el hash ${doc.fileHash}`);
            const qdrantOk = await VectorService.deleteVectorsByHash(doc.fileHash);
            if (!qdrantOk) {
                console.warn(`[Delete] Qdrant falló para ${id} — abortando borrado para evitar inconsistencia.`);
                return res.status(500).json({ error: 'Fallo al borrar vectores. Reintentá en unos segundos.' });
            }
        } else {
            console.log(`🛡️ [Safe Delete] Conservando vectores: existen ${sameHashCount} documentos con el mismo hash.`);
        }

        // 2. Borrar Archivo Físico (si existe - ahora se purgan tras vectorizar)
        try {
            const filePath = path.join(__dirname, '../uploads', doc.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ [Delete] Archivo físico borrado: ${doc.filename}`);
            }
        } catch (fileErr: any) {
            console.warn(`[Delete] No se pudo borrar archivo físico (quizás ya purgado): ${fileErr.message}`);
        }

        // 3. Borrar en MySQL
        await prisma.document.delete({ where: { id } });

        res.json({ message: 'Expediente eliminado de todas las capas de memoria.' });
    } catch (error: any) {
        res.status(500).json({ error: 'Fallo en la sincronización de borrado.' });
    }
});

// ENDPOINT: CONSULTAR LOGS DE AUDITORÍA (Regla 13)
app.get('/api/documents/:id/logs', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const logs = await (prisma as any).documentLog.findMany({
            where: { documentId: id },
            orderBy: { timestamp: 'asc' }
        });
        res.json(logs);
    } catch (error: any) {
        res.status(500).json({ error: 'Fallo al recuperar logs de auditoría.' });
    }
});

// ENDPOINT: CHAT PROXY
app.post('/api/chat', authenticate, async (req: any, res: any) => {
    try {
        const { message, sessionId } = req.body;
        if (!message) return res.status(400).json({ error: 'Mensaje vacío.' });

        const aiResponse = await ChatService.processChat(message, sessionId);
        res.json(aiResponse);
    } catch (error: any) {
        res.status(500).json({ error: 'Error de comunicación con el cerebro IA.' });
    }
});

// ENDPOINTS: EXPORTACIÓN
app.post('/api/chat/export/pdf', authenticate, async (req, res) => {
    try {
        const { content, title } = req.body;
        const pdfBuffer = await ExportService.generatePDF(content, title);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=informe.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ error: 'Fallo en generación de PDF.' });
    }
});

app.post('/api/chat/export/word', authenticate, async (req, res) => {
    try {
        const { content, title } = req.body;
        const docxBuffer = await ExportService.generateWord(content, title);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=informe.docx`);
        res.send(docxBuffer);
    } catch (error) {
        res.status(500).json({ error: 'Fallo en generación de Word.' });
    }
});

// SERVIR FRONTEND (Solo en Producción / Docker Unificado)
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
    console.log('📦 Integrando Frontend: Sirviendo estáticos desde', frontendDistPath);
    app.use(express.static(frontendDistPath));
    // Cualquier ruta no capturada por la API sirve el index.html (SPA Routing)
    app.get(/^\/(?!api).*/, (_req, res) => {
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
} else {
    console.warn('⚠️  Frontend dist no hallada. El servidor solo responderá a endpoints de la API.');
}

const PORT = Number(process.env.PORT) || 4000;
// INICIO DE SERVIDOR
const startServer = async () => {
    await runStartupChecks();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`
    ==================================================
        ⚖️  LEGAL DISCOVERY ENGINE - PRODUCCIÓN
        📡 Puerto: ${PORT}
        🌍 Entorno: ${process.env.NODE_ENV}
        🚀 Estado: Operativo
    ==================================================
        `);
    });
};

startServer();
