import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const url = "https://qdrant.cristiananton.dev";
const apiKey = process.env.QDRANT_API_KEY;
const collectionName = process.env.QDRANT_COLLECTION_NAME || 'abogados_v2';

async function testConnectionAxios() {
    console.log(`[Qdrant Test Axios] Conectando a ${url}/collections...`);
    
    try {
        const response = await axios.get(`${url}/collections`, {
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json'
            }
        });

        console.log('[Qdrant Test Axios] Éxito! Colecciones:', JSON.stringify(response.data.result, null, 2));

        // Verificar si la colección existe
        const collections = response.data.result.collections;
        const exists = collections.some((c: any) => c.name === collectionName);

        if (!exists) {
            console.log(`[Qdrant Test Axios] Creando colección "${collectionName}"...`);
            await axios.put(`${url}/collections/${collectionName}`, {
                vectors: {
                    size: 768,
                    distance: 'Cosine'
                }
            }, {
                headers: { 'api-key': apiKey }
            });
            console.log('[Qdrant Test Axios] Colección creada.');
        } else {
            console.log(`[Qdrant Test Axios] La colección "${collectionName}" ya existe.`);
        }

    } catch (error: any) {
        console.error('[Qdrant Test Axios] Error:', error.response?.data || error.message);
    }
}

testConnectionAxios();
