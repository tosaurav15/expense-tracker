/**
 * ============================================================
 *  VAULT — OCR SERVICE  (src/services/ocrService.js)
 * ============================================================
 *
 *  What is OCR?
 *  ------------
 *  OCR = Optical Character Recognition.
 *  It reads text from images — the same way a human reads a sign.
 *
 *  This file uses Tesseract.js — an open-source OCR engine that
 *  runs entirely inside your browser. No image ever leaves your
 *  device. Everything happens locally.
 *
 *  How Tesseract.js works:
 *  -----------------------
 *  1. It downloads the English language model (~10MB) once
 *     on first use, then the browser caches it forever.
 *  2. It spins up a Web Worker (a background process) to do
 *     the heavy image analysis without freezing the screen.
 *  3. It returns a full list of recognized text with confidence
 *     scores per word.
 *
 *  After the first use, Vault can scan receipts fully offline.
 *
 *  ─────────────────────────────────────────────────────────
 *  EXPORTED FUNCTIONS
 *  ─────────────────────────────────────────────────────────
 *
 *  runOCR(imageSource, onProgress?)
 *    → Promise<OCRResult>
 *
 *    imageSource: File object, data URL string, or Blob
 *    onProgress:  optional callback(percent) for loading bar
 *
 *    OCRResult = {
 *      text:       string,     ← full extracted text
 *      lines:      string[],   ← text split into lines
 *      confidence: number,     ← 0–100 overall confidence
 *      words: [{ text, confidence, bbox }]  ← per-word detail
 *    }
 *
 *  preprocessImage(file)
 *    → Promise<string>  ← data URL with contrast/brightness boosted
 *    Improves OCR accuracy on dark or blurry receipts
 *
 *  isOCRReady()
 *    → boolean — whether the worker is already initialized
 *
 *  terminateOCR()
 *    → cleans up the Tesseract worker (call when leaving the page)
 */

import { createWorker } from 'tesseract.js';

// ─── WORKER SINGLETON ────────────────────────────────────────────────────────
// We keep one worker alive while the receipt page is open.
// Creating a worker is slow (~1-2 seconds), so we do it once and reuse it.

let _worker     = null;
let _workerReady = false;
let _initPromise = null;  // prevents creating two workers in parallel

/**
 * getWorker()
 *
 * Returns the shared Tesseract worker, creating it if needed.
 * The first call takes ~1-2 seconds (downloads/initialises the model).
 * All subsequent calls are instant.
 */
async function getWorker(onProgress) {
  // Already ready
  if (_worker && _workerReady) return _worker;

  // Already being initialized — wait for it
  if (_initPromise) return _initPromise;

  // Start initialising
  _initPromise = (async () => {
    try {
      console.log('Vault OCR: Initialising Tesseract worker…');

      _worker = await createWorker('eng', 1, {
        // Progress callback so UI can show a loading bar
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(Math.round(m.progress * 100));
          }
          if (m.status === 'loaded language traineddata') {
            if (onProgress) onProgress(30);
          }
        },
      });

      // Configure Tesseract for receipt-style text:
      // PSM 6 = Assume a single uniform block of text (good for receipts)
      await _worker.setParameters({
        tessedit_pageseg_mode: '6',
        // Tell Tesseract to accept these characters (avoids misreads)
        tessedit_char_whitelist:
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,/-:₹$€£@#&*()%+\n\r',
      });

      _workerReady = true;
      console.log('Vault OCR: Tesseract worker ready ✓');
      return _worker;
    } catch (err) {
      _initPromise = null;  // allow retry on next call
      throw new Error(`OCR engine failed to initialise: ${err.message}`);
    }
  })();

  return _initPromise;
}

// ─── MAIN EXPORT: runOCR ─────────────────────────────────────────────────────

/**
 * runOCR(imageSource, onProgress)
 *
 * The main function called by the receipt scanning UI.
 *
 * @param {File|string|Blob} imageSource - The receipt image
 * @param {Function}         onProgress  - Optional (percent: number) => void
 * @returns {Promise<OCRResult>}
 */
export async function runOCR(imageSource, onProgress) {
  // Step 1: Pre-process the image to improve OCR accuracy
  let processedImage;
  try {
    processedImage = await preprocessImage(imageSource);
    if (onProgress) onProgress(10);
  } catch (err) {
    // If preprocessing fails, just use the original
    processedImage = imageSource;
  }

  // Step 2: Get (or create) the Tesseract worker
  const worker = await getWorker((pct) => {
    // Map worker's 0-100% into our 10-90% range
    // (10 was preprocessing, 90+ is post-processing)
    if (onProgress) onProgress(10 + Math.round(pct * 0.8));
  });

  // Step 3: Run recognition
  let rawResult;
  try {
    rawResult = await worker.recognize(processedImage);
  } catch (err) {
    throw new Error(
      `Could not read this image: ${err.message}. ` +
      'Try a clearer photo with good lighting.'
    );
  }

  if (onProgress) onProgress(95);

  // Step 4: Extract and structure the results
  const fullText = rawResult.data?.text || '';
  const words    = rawResult.data?.words || [];

  // Split into clean lines (remove empty ones)
  const lines = fullText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Calculate overall confidence (average of word confidences)
  const confidence = words.length > 0
    ? Math.round(words.reduce((sum, w) => sum + (w.confidence || 0), 0) / words.length)
    : 0;

  if (onProgress) onProgress(100);

  return {
    text:       fullText,
    lines,
    confidence,
    words:      words.map(w => ({
      text:       w.text,
      confidence: w.confidence,
      // bbox tells us where on the page the word appeared
      bbox:       w.bbox,
    })),
  };
}

// ─── IMAGE PRE-PROCESSOR ─────────────────────────────────────────────────────

/**
 * preprocessImage(imageSource)
 *
 * Uses the browser's Canvas API to improve receipt images before OCR.
 * Applies: increased contrast + brightness + converts to greyscale.
 *
 * Why this helps:
 *   Receipts are often low-contrast (light grey text on white paper)
 *   or taken in poor lighting. This makes the text clearer for Tesseract.
 *
 * Returns a data URL (base64 image) the OCR engine can read directly.
 *
 * @param {File|string|Blob} imageSource
 * @returns {Promise<string>} data URL
 */
export async function preprocessImage(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas  = document.createElement('canvas');
      const ctx     = canvas.getContext('2d');

      // Scale down if the image is very large (OCR doesn't need >2000px)
      const MAX_DIM = 2000;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height);
        width  = Math.round(width  * scale);
        height = Math.round(height * scale);
      }

      canvas.width  = width;
      canvas.height = height;

      // Draw the image
      ctx.drawImage(img, 0, 0, width, height);

      // Apply greyscale + contrast boost via CSS filter
      // This is the easiest reliable way to do it in a browser
      ctx.filter = 'grayscale(100%) contrast(130%) brightness(110%)';
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/png', 1.0));
    };

    img.onerror = () => reject(new Error('Could not load image for preprocessing'));

    // Handle different input types
    if (typeof imageSource === 'string') {
      // Already a data URL or URL
      img.src = imageSource;
    } else if (imageSource instanceof File || imageSource instanceof Blob) {
      // File or Blob — create an object URL
      const url = URL.createObjectURL(imageSource);
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);  // clean up memory
        const canvas = document.createElement('canvas');
        const ctx    = canvas.getContext('2d');

        let { naturalWidth: w, naturalHeight: h } = img;
        const MAX_DIM = 2000;
        if (w > MAX_DIM || h > MAX_DIM) {
          const scale = MAX_DIM / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        canvas.width  = w;
        canvas.height = h;
        ctx.filter = 'grayscale(100%) contrast(130%) brightness(110%)';
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png', 1.0));
      };
    } else {
      reject(new Error('Unsupported image source type'));
    }
  });
}

// ─── STATUS HELPERS ──────────────────────────────────────────────────────────

/** Returns true if the Tesseract worker is already loaded and ready */
export function isOCRReady() {
  return _workerReady;
}

/**
 * terminateOCR()
 * Frees the Tesseract worker's memory.
 * Call this when the user leaves the receipt scanning page.
 */
export async function terminateOCR() {
  if (_worker) {
    try {
      await _worker.terminate();
    } catch { /* ignore */ }
    _worker      = null;
    _workerReady = false;
    _initPromise = null;
    console.log('Vault OCR: Worker terminated');
  }
}
