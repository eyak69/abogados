import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import dotenv from 'dotenv';

dotenv.config();

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
);

export interface UserSession {
    id: string;
    email: string;
    name: string | null;
    picture: string | null;
    role: string;
}

export class AuthService {
    
    /**
     * Genera la URL para iniciar el flujo de OAuth2 con Google.
     */
    static getAuthUrl(): string {
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email'
            ],
            prompt: 'consent'
        });
    }

    /**
     * Verifica un ID Token (credential) de Google y genera un JWT soberano.
     */
    static async authenticate(idToken: string): Promise<{ token: string; user: UserSession }> {
        try {
            console.log('🔑 [AuthService] Iniciando verificación de token Google...');
            
            const ticket = await client.verifyIdToken({
                idToken: idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload || !payload.email) throw new Error('Fallo al obtener perfil de Google.');
            
            console.log(`👤 [AuthService] Usuario detectado: ${payload.email}`);

            // Determinar rol inicial (Arquitectura Senior con Soberanía)
            const isAdmin = payload.email.toLowerCase().trim() === process.env.INITIAL_EDITOR_EMAIL?.toLowerCase().trim();
            const initialRole = isAdmin ? 'EDITOR' : 'VIEWER';

            // 1. Buscamos si el usuario ya existe para no pisar su rol si fue promovido manualmente
            const existingUser = await prisma.user.findUnique({
                where: { googleId: payload.sub! }
            });

            // Persistencia Soberana en MySQL (Prisma)
            const user = await prisma.user.upsert({
                where: { googleId: payload.sub! },
                update: {
                    name: payload.name || payload.email.split('@')[0],
                    picture: payload.picture,
                    // Si es admin, nos aseguramos que sea EDITOR. Si no, mantenemos lo que tenga.
                    role: isAdmin ? 'EDITOR' : (existingUser?.role || 'VIEWER')
                },
                create: {
                    googleId: payload.sub!,
                    email: payload.email,
                    name: payload.name || payload.email.split('@')[0],
                    picture: payload.picture,
                    role: initialRole
                },
            });

            console.log(`✅ [AuthService] Usuario persistido en MySQL con rol: ${user.role}`);


            // Generación de JWT (Soberanía de Sesión)
            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email,
                    role: user.role 
                },
                process.env.JWT_SECRET || 'secret-shhh',
                { expiresIn: '7d' }
            );

            return {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    picture: user.picture,
                    role: user.role
                }
            };
        } catch (error: any) {
            console.error('[AuthService Error]', error.message);
            throw new Error(`Error en la autenticación con Google: ${error.message}`);
        }
    }



    /**
     * Valida si una API Key es válida para servicios externos (n8n).
     */
    static async validateApiKey(key: string): Promise<boolean> {
        if (key === process.env.API_KEY_N8N) return true; // Master key de n8n
        
        const apiKey = await prisma.apiKey.findUnique({
            where: { key }
        });
        return !!apiKey;
    }
}
