import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function listModels() {
    console.log('🔍 [Diagnostic] Iniciando listado de modelos...');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    
    try {
        // En el SDK de JS no hay un método directo 'listModels' público fácil, 
        // pero podemos probar instanciar y fallar rápido.
        const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp'];
        
        for (const m of models) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent("test");
                console.log(`✅ Modelo disponible: ${m}`);
            } catch (e) {
                console.log(`❌ Modelo NO disponible: ${m} - ${e.message}`);
            }
        }
    } catch (error) {
        console.error('Fallo crítico en el diagnóstico:', error.message);
    }
}

listModels();
