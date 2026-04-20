// En producción el frontend y backend corren en el mismo origen (mismo container Docker).
// VITE_API_URL solo se usa en desarrollo local para apuntar a localhost:4000.
export const API_URL = import.meta.env.VITE_API_URL || '';
