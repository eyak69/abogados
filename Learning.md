# Aprendizajes y Decisiones de Arquitectura

## Metodología: Integración de Superpowers (Abril 2026)
Se ha decidido integrar la metodología de "Superpowers" adaptada al español para elevar el rigor técnico del proyecto. 
- **Decisión**: No usar el plugin "as-is" para evitar conflictos con la Regla 2 y redundancias con el Planning Mode nativo.
- **Implementación**: Se crearon manuales locales en `.superpowers/` que actúan como el estándar de ingeniería para TDD, Debugging, Planes y Brainstorming.
- **Riesgo**: La rigidez del TDD podría afectar la velocidad de prototipado. Se acuerda priorizar rigor en lógica de negocio y backend.

## Decisiones Arquitectónicas
* **Uso de NotebookLM como Cerebro de Documentación:** Se decidió externalizar la base documental del proyecto "Abogados" hacia NotebookLM integrándolo a nuestro flujo de trabajo vía MCP. Esto es una ventaja estratégica: desacoplamos volúmenes inmensos de texto (leyes, minutas, requerimientos, guías) de nuestro repositorio principal, evitando el engorde inútil del control de versiones (Git). Además, nos regala capacidades de búqueda semántica RAG instantánea para poder auditar el negocio con prompts.
* **Modelo RAG Híbrido (Gemini + DB Vectorial Self-Hosted):** Ante la falta de hardware local para correr Ollama/Gemma4, adoptamos un LLM hospedado potente (Gemini) para la inferencia y generación de lenguaje, pero reteniendo control soberano de los datos al desplegar una Base de Datos Vectorial auto-gestionada en Coolify. Esta decisión equilibra inteligencia de alto nivel con absoluto control sobre el particionado y almacenamiento de los embeddings.
* **Orquestación Low-Code (n8n vs Custom Backend):** Se ha decidido utilizar n8n en lugar de un backend tradicional (Python/Node) para orquestar la inserción vectorial y la IA. Riesgo asumido: n8n dificulta los Test Unitarios (rompe la Regla 13 en parte) y el control de versiones. Se mitiga mediante exportación estricta de los flujos JSON a Git.
* **Diseño UI Delegado a Stitch (Regla 9):** Se provisionó el proyecto Stitch ID `7455800169574354083` forzando la creación de vistas responsivas en "Dark Mode" para mantener el paradigma "Premium Law Assistant".
* **Reversión de Integración NotebookLM vía MCP (2026-04-13):** Se decidió abortar y purgar la integración de Antigravity con NotebookLM debido a deuda técnica excesiva en el flujo de autenticación. Extraer la cookie manual rompe el concepto de "Developer Experience Cero Fricciones" (Regla 14 de arrancar rápido) al obligar al desarrollador a ser un intermediario orgánico para la conexión API. A nivel de seguridad y robustez, no se justificaba esta fragilidad y avanzaremos mediante infraestructura auto-hosteada.

## Problemas Técnicos Detectados y Resueltos
* **Bloqueo 403 Forbidden en Autenticación MCP de NotebookLM:**
  * **Fallo Base:** El ejecutable `notebooklm-mcp-auth` no maneja versiones recientes de las políticas de Chromium, bloqueando la conexión al puerto 9222.
  * **Solución de Infraestructura:** Nunca lanzar Chrome automáticamente sin parámetros. Aprendizaje: lanzar instancia limpia forzando `--remote-allow-origins=*` junto a un `--user-data-dir` temporal aislado para permitir la captura del cookie session.

## Historial de Decisiones de Rendimiento y UX
* **Subida Secuencial Asíncrona de PDFs (2026-04-14):**
  * **Problema originario:** n8n requiere asimilar los documentos de a uno para una vectorización controlada. Iterar desde el Frontend (React subiendo 1 a 1 y esperando el 200) bloqueaba la UX y si el usuario cerraba la pestaña, se cortaba el lote.
  * **Solución (Deuda en Memoria VS Estabilidad UX):** Implementamos un Backend Queue asíncrono. El Frontend envía todo de golpe al backend en ms, el backend responde un '200 OK' inmediato y procesa en background hacia n8n secuencialmente con reintento (Exponential Backoff). Si n8n tira '400 Bad Request', la falla se encapsula, se reporta en log y el servidor avanza al siguiente archivo sin tirar el proceso entero.

## Evolución Estética y Arquitectónica (Abril 2026)
* **Rediseño Radical Abogados v2 - Bento Dark Glass:** Ante la insatisfacción del usuario con el diseño previo, se ejecutó un cambio de paradigma total hacia un layout tipo "Bento Box" con estética Glassmorphism avanzada (Abogados Premium v2 en Stitch). 
  * **Decisión Técnica:** Se eliminó el monolitismo de `App.jsx`, refactorizando todas las funcionalidades en componentes modulares (`ChatPanel`, `FileUpload`, `StatusTracker`). Esto resuelve la deuda técnica de escalabilidad.
  * **Riesgo Mitigado:** Se encapsuló la lógica de SSE en el componente de tracking para asegurar que la UI no se bloquee por eventos de red, manteniendo el principio de "Single Responsibility" (Regla 12).
