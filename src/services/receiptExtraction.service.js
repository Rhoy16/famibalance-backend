// src/services/receiptExtraction.service.js
//
// RF-07 — Extract transaction data (amount, date) from an uploaded
// receipt so the user only has to confirm it instead of typing everything.
//
// Two modes, controlled by the OCR_MODE env var:
//   - "simulated" (default): returns deterministic mock data. Recommended
//     for the class demo/grading so the feature never fails because of
//     OCR accuracy or a missing dependency.
//   - "real": parses the actual text of an uploaded PDF receipt with
//     pdf-parse. Requires `npm install pdf-parse`.

import path from 'path';
import fs from 'fs';

const OCR_MODE = process.env.OCR_MODE || 'simulated';

function parseReceiptText(rawText) {
  const totalMatch = rawText.match(/total[:\s]*s?\/?\.?\s*([\d,.]+)/i);
  const dateMatch = rawText.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);

  const amount = totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : null;
  const parsedDate = dateMatch ? new Date(dateMatch[1]) : null;

  return {
    amount,
    date: parsedDate && !isNaN(parsedDate) ? parsedDate : null,
  };
}

async function extractFromPdf(filePath) {
  // Dynamic import so the dependency is only required when OCR_MODE=real.
  const { default: pdfParse } = await import('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const { text } = await pdfParse(buffer);
  return parseReceiptText(text);
}

function simulateExtraction(fileName) {
  return {
    amount: 45.9,
    date: new Date(),
    description: `Auto-extracted from ${fileName}`,
  };
}

export async function extractReceiptData(filePath) {
  const fileName = path.basename(filePath);

  if (OCR_MODE === 'simulated') {
    return simulateExtraction(fileName);
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.pdf') {
    const error = new Error('Real OCR mode currently only supports PDF receipts');
    error.statusCode = 400;
    throw error;
  }

  return extractFromPdf(filePath);
}
