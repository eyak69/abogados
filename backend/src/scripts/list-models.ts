import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function listModels() {
    console.log("--- LISTING GEMINI MODELS ---");
    // El SDK de JS no tiene un método directo listModels() en la clase base genAI.
    // Usualmente se usa el cliente de Node o simplemente probamos nombres comunes.
    
    const testModels = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-pro",
        "text-embedding-004",
        "embedding-001"
    ];

    for (const m of testModels) {
        try {
            const model = genAI.getGenerativeModel({ model: m });
            // Intentamos una llamada mínima para ver si el modelo responde o da 404
            if (m.includes("embedding")) {
                await model.embedContent("test");
            } else {
                await model.generateContent("test");
            }
            console.log(`✅ Model ${m}: AVAILABLE`);
        } catch (err: any) {
            console.log(`❌ Model ${m}: FAILED (${err.message.split('\n')[0]})`);
        }
    }
}

listModels();
