import { Router } from 'express';
import { AuthService } from '../services/auth.service';

const router = Router();

/**
 * Inicia el flujo de Google OAuth2.
 */
router.get('/google', (req, res) => {
    const url = AuthService.getAuthUrl();
    res.json({ url });
});

/**
 * Login/Registro con Google (Credential Flow)
 * Recibe la 'credential' (ID Token) desde el frontend.
 */
router.post('/google', async (req, res) => {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Token de Google (credential) faltante.' });

    try {
        const { token, user } = await AuthService.authenticate(credential);
        // Retornamos el JWT soberano y los datos del usuario
        res.json({ token, user });
    } catch (error: any) {
        res.status(401).json({ error: error.message });
    }
});


export default router;
