# Integrante 2 — Transacciones, OCR, Recurrencia y Multimoneda

Implementado directamente sobre tu proyecto real (`famibalance-backend`).
Cubre **RF-06, RF-07, RF-09, RF-10**.

## 1. Instalar dependencias nuevas

```bash
npm install multer node-cron
```

Opcional, solo si vas a usar OCR real (no simulado) sobre PDFs:
```bash
npm install pdf-parse
```

## 2. Actualizar la base de datos (nuevo campos en Transaction)

Se agregaron a `prisma/schema.prisma`: `baseAmount`, `frequency`,
`nextRunDate`, `parentRecurringId`. Corre la migración:

```bash
npx prisma migrate dev --name transactions_multicurrency_recurring
```

Esto regenera el cliente de Prisma y crea la migración SQL real contra
tu base de datos — no la escribí a mano para evitar que quede
desincronizada de lo que Prisma genera.

## 3. Variables de entorno (.env)

```
BASE_CURRENCY=PEN
OCR_MODE=simulated   # cambia a "real" para parsear PDFs de verdad
```

## 4. Qué cambié en `index.js` (archivo compartido)

Solo 3 cosas, para no pisar el trabajo de tus compañeros:
1. `export const prisma = ...` (antes era `const`, sin export) — necesario
   para que mis archivos en `src/` puedan reusar la misma instancia.
2. Import de `transactionsRouter` y `startRecurringTransactionsJob`.
3. Reemplacé el bloque `// TODO: Implementar rutas de transacciones aquí`
   por `app.use('/api/transactions', transactionsRouter);`, y agregué
   `startRecurringTransactionsJob();` antes de `app.listen`.

Todo lo demás (auth, family, dashboard) quedó intacto.

## 5. Archivos nuevos

```
src/routes/transactions.routes.js       ← los 6 endpoints
src/services/currencyConversion.service.js  ← RF-10
src/services/receiptExtraction.service.js   ← RF-07
src/jobs/recurringTransactions.job.js       ← RF-09 (cron diario)
```

## 6. Endpoints entregados

| Método | Ruta | RF |
|---|---|---|
| GET | /api/transactions | RF-06 |
| GET | /api/transactions?scope=family | RF-06 (solo JEFE) |
| POST | /api/transactions | RF-06, RF-10 |
| PUT | /api/transactions/:id | RF-06 |
| DELETE | /api/transactions/:id | RF-06 |
| POST | /api/transactions/ocr | RF-07 |
| POST | /api/transactions/recurring | RF-09 |

Todos requieren `Authorization: Bearer <token>`.

## 7. Decisión importante: valores de `type` en español

El endpoint `GET /api/dashboard/personal` (Integrante 4) ya filtra
transacciones con los literales `"INGRESO"` y `"EGRESO"`. Aunque me
pediste todo el código en inglés, **mantuve esos dos valores de datos
tal cual** — el código (nombres de variables, comentarios, mensajes)
está en inglés, pero si cambio los valores a `"INCOME"`/`"EXPENSE"` el
dashboard de tu compañero deja de sumar nada. Si el equipo decide migrar
todo a inglés, hay que coordinar el cambio en los 3 endpoints que ya
existen (`/api/dashboard/personal`, `/api/family/analytics`, y los
míos) al mismo tiempo.

## 8. Body de ejemplo — POST /api/transactions

```json
{
  "description": "Grocery shopping",
  "amount": 120.5,
  "currency": "USD",
  "type": "EGRESO",
  "paymentMethod": "CARD",
  "categoryId": "<uuid-de-una-categoria-existente>"
}
```

Respuesta:
```json
{
  "msg": "Transaction created",
  "data": {
    "transaction": { "...": "...", "baseAmount": 446.30, "exchangeRate": 3.7 },
    "alertTriggered": false
  }
}
```

## 9. Nota sobre el checkeo de presupuesto

Como Integrante 3 todavía no entregó RF-11/RF-12, incluí un
`checkBudgetAlert` mínimo *dentro de* `transactions.routes.js` (no un
archivo aparte) para no inventarte una API que después no calce con la
suya. Está comentado en el código — en cuanto ellos entreguen su
función real, se reemplaza esa llamada por la de ellos.
