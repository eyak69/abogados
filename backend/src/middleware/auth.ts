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

    // Caso 2: JWT (Frontend / Usuario Web)
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-shhh') as any;
            req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
            return next();
        } catch (err) {
            return res.status(401).json({ error: 'Sesión expirada o token inválido.' });
        }
    }


    return res.status(401).json({ error: 'No autorizado. Se requiere Token o API Key.' });
};
