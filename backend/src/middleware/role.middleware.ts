import { Request, Response, NextFunction } from 'express';

export const requireRole = (role: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // El usuario ya debe estar autenticado por el middleware de Auth
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ error: 'Usuario no autenticado.' });
        }

        // Fallback Senior: Si es el email del administrador oficial, permitimos acceso
        // Sanitizamos para evitar fallos por capitalización (Regla 10)
        const userEmail = user.email ? String(user.email).toLowerCase().trim() : '';
        const isAdminEmail = userEmail === 'cfanton@gmail.com';
        const hasRequiredRole = user.role === role || user.role === 'EDITOR';

        if (!isAdminEmail && !hasRequiredRole) {
            console.warn(`[Security] Acceso denegado: ${userEmail} -> Requisito: ${role}`);
            return res.status(403).json({ 
                error: 'Acceso denegado.', 
                message: `Se requieren permisos de ${role} para realizar esta acción.` 
            });
        }



        next();
    };
};
