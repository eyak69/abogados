import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pdf = require('pdf-parse');

async function probe() {
    console.log("--- PROBING PDF-PARSE ---");
    console.log("Type of pdf:", typeof pdf);
    console.log("PDF Keys:", Object.keys(pdf));
    if (typeof pdf === 'function') {
        console.log("Success: pdf is a function");
    } else {
        console.log("Failure: pdf is not a function");
        if (pdf.default && typeof pdf.default === 'function') {
            console.log("Success: pdf.default is a function");
        }
    }

    console.log("\n--- PROBING GEMINI MODELS ---");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    try {
        // En algunas versiones del SDK no se puede listar modelos fácilmente sin el cliente de Admin
        // Intentaremos generar una respuesta mínima con un nombre alternativo
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Model instance created for gemini-1.5-flash");
        
        // Probamos con gemini-pro que es más universal si el flash falla
        const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" });
        console.log("Model instance created for gemini-pro");

    } catch (err: any) {
        console.error("Error probing models:", err.message);
    }
}

probe();
