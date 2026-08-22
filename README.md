# Vantage — analizador de facturas para grupos con sucursales

Vantage convierte PDF, imagen, Word o texto a **texto plano en tu servidor** y recién ahí llama a **Gemini** con un prompt corto. Así se gasta poca cuota: no se manda el archivo pesado a la IA.

Pensado para empresas grandes o con muchas sucursales: sugiere sucursal, brief para el CFO, riesgos, vencimiento, líneas, preguntas para AP y chequeos del controller.

## Flujo

1. Subes la factura (Analizar).
2. Extracción local: PDF / DOCX / TXT / OCR de imagen.
3. Se recorta a ~8 000 caracteres.
4. Gemini (modelo flash) devuelve JSON + análisis en el idioma de la UI (ES / EN / PT).
5. El resultado queda en el registro y en el pulso por sucursal.

## Cómo correrlo

```bash
npm install
cp .env.example .env
# pon GEMINI_API_KEY en .env — nunca en el código
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Abre `http://127.0.0.1:43123` (entra a **Analizar**).

Variables (`.env.example`):

```
DATABASE_URL="file:./dev.db"
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
GEMINI_MAX_CHARS=8000
```

Si Gemini no responde, hay un borrador heurístico local para que la demo no se caiga.

## Lo que hace distinto a un OCR genérico

- Primero texto plano, después IA (menos tokens).
- Asignación de **sucursal**.
- Brief de 20 segundos para dirección.
- Preguntas concretas para cuentas por pagar.
- Lista de chequeos para el controller.
- Riesgo (duplicado, recargo, desvío vs PO, etc.).
- Idioma ES / EN / PT.

## Seguridad

No subas una API key al git. Si una clave se pegó en un chat, **rótala** en Google AI Studio.

Nunca uses este entorno con documentos productivos confidenciales sin revisar políticas de tu empresa: el texto plano sí se envía a Gemini.
