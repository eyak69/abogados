import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/auth.service';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
    isExternal?: boolean;
}

/**
 * Middleware Dual: Valida JWT del Navegador o API Key de n8n.
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];

    // Caso 1: API Key (n8n / Servicios Externos)
    if (apiKeyHeader) {
        const isValid = await AuthService.validateApiKey(String(apiKeyHeader));
        if (isValid) {
            req.isExternal = true;
            // Para servicios externos, asignamos rol EDITOR por defecto para permitir carga
            req.user = { id: 'external', email: 'service@n8n.internal', role: 'EDITOR' };
            return next();
        }
        return res.status(401).json({ error: 'API Key inválida o expirada.' });
    }

    // Caso 2: JWT (Frontend / Usuario Web) — también acepta ?token= para SSE (EventSource no soporta headers)
    const queryToken = typeof req.query?.token === 'string' ? req.query.token : null;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (bearerToken || queryToken) {
        const token = bearerToken || queryToken!;
        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) return res.status(500).json({ error: 'Configuración de servidor inválida.' });
            const decoded = jwt.verify(token, secret) as any;
            req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
            return next();
        } catch (err) {
            return res.status(401).json({ error: 'Sesión expirada o token inválido.' });
        }
    }


    return res.status(401).json({ error: 'No autorizado. Se requiere Token o API Key.' });
};
