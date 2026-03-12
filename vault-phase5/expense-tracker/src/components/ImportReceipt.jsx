/**
 * ============================================================
 *  VAULT — IMPORT RECEIPT  (src/components/ImportReceipt.jsx)
 * ============================================================
 *
 *  This is the receipt scanning wizard. It has 4 stages:
 *
 *  Stage 1 — CAPTURE
 *    Camera button (opens phone camera directly on mobile)
 *    Gallery button (choose an image from photos)
 *    Shows tips for getting a good scan
 *
 *  Stage 2 — SCANNING
 *    Animated progress bar while Tesseract reads the image
 *    Shows the uploaded receipt image as a preview
 *    Live status updates ("Loading OCR...", "Reading text...")
 *
 *  Stage 3 — REVIEW
 *    Shows what was extracted:
 *      Merchant name (editable)
 *      Amount (editable)
 *      Date (editable)
 *      Category (tappable cycle through categories)
 *      Payment method (selector)
 *    Confidence indicators so user knows what was certain vs guessed
 *    "Save Transaction" button
 *
 *  Stage 4 — DONE
 *    Success confirmation + option to scan another
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { runOCR, terminateOCR } from '../services/ocrService';
import { parseReceipt } from '../services/receiptParser';
import { updateCategoryLearning } from '../services/merchantLearningService';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Net Banking', 'Wallet'];

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 1 — CAPTURE SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function CaptureStage({ onImage, onBack }) {
  const cameraRef  = useRef(null);
  const galleryRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, HEIC)');
      return;
    }
    // Check file size (10MB limit — OCR needs full resolution)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image is too large. Please use a photo under 10MB.');
      return;
    }
    onImage(file);
  };

  return (
    <div className="page-enter px-5 pt-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl tap-active flex-shrink-0"
            style={{ background: '#151E35', border: '1px solid #1E2D4F' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8899BB" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <div>
          <h2 className="text-xl" style={{ fontFamily: 'DM Serif Display, serif' }}>Scan Receipt</h2>
          <p className="text-xs" style={{ color: '#8899BB' }}>Extract transaction data from a receipt photo</p>
        </div>
      </div>

      {/* Big camera button */}
      <button
        onClick={() => cameraRef.current?.click()}
        className="w-full py-8 rounded-3xl flex flex-col items-center gap-4 mb-4 tap-active"
        style={{
          background: 'linear-gradient(145deg, rgba(240,165,0,0.12), rgba(240,165,0,0.06))',
          border: '2px dashed rgba(240,165,0,0.4)',
        }}
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(240,165,0,0.15)', border: '1px solid rgba(240,165,0,0.3)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F0A500" strokeWidth="1.8">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="font-semibold" style={{ color: '#F0A500' }}>Take Photo</p>
          <p className="text-xs mt-1" style={{ color: '#8899BB' }}>Opens your camera</p>
        </div>
        {/* Hidden camera input — capture="environment" opens back camera on mobile */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment"
          onChange={e => handleFile(e.target.files?.[0])} className="hidden" style={{ display: 'none' }} />
      </button>

      {/* Gallery button */}
      <button
        onClick={() => galleryRef.current?.click()}
        className="w-full py-5 rounded-2xl flex items-center justify-center gap-3 mb-6 tap-active"
        style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: '#151E35', border: '1px solid #1E2D4F' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8899BB" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
        </div>
        <div className="text-left">
          <p className="text-sm font-medium" style={{ color: '#E8EEFF' }}>Choose from Gallery</p>
          <p className="text-xs" style={{ color: '#5A6A8A' }}>Select existing receipt photo</p>
        </div>
        <input ref={galleryRef} type="file" accept="image/*"
          onChange={e => handleFile(e.target.files?.[0])} className="hidden" style={{ display: 'none' }} />
      </button>

      {/* Tips */}
      <div className="rounded-2xl p-4" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: '#8899BB' }}>💡 Tips for best results</p>
        <div className="space-y-2">
          {[
            { icon: '☀️', text: 'Good lighting — avoid shadows on the receipt' },
            { icon: '📐', text: 'Hold camera flat above the receipt' },
            { icon: '🔍', text: 'Make sure all text is in frame and sharp' },
            { icon: '📄', text: 'Works best with printed receipts (not handwritten)' },
          ].map(tip => (
            <div key={tip.text} className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0">{tip.icon}</span>
              <p className="text-xs leading-relaxed" style={{ color: '#5A6A8A' }}>{tip.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy badge */}
      <div className="flex items-center gap-2 justify-center mt-5">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#06D6A0' }} />
        <p className="text-xs" style={{ color: '#5A6A8A' }}>
          OCR runs entirely on your device · no image is uploaded
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 2 — SCANNING SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function ScanningStage({ imagePreview, progress, statusText }) {
  return (
    <div className="flex flex-col items-center px-6 pt-10 pb-10 gap-6">
      {/* Receipt preview with scanner overlay */}
      <div className="relative w-full max-w-xs rounded-2xl overflow-hidden"
        style={{ border: '1px solid #1E2D4F' }}>
        {imagePreview && (
          <img src={imagePreview} alt="Receipt" className="w-full object-contain"
            style={{ maxHeight: '260px', objectFit: 'cover', opacity: 0.7 }} />
        )}
        {/* Animated scanning line */}
        <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'hidden' }}>
          <div
            className="absolute left-0 right-0 h-0.5"
            style={{
              background: 'linear-gradient(90deg, transparent, #F0A500, transparent)',
              animation: 'scanLine 2s linear infinite',
              boxShadow: '0 0 12px rgba(240,165,0,0.8)',
            }}
          />
        </div>
        {/* Corner markers */}
        {[
          'top-2 left-2 border-t-2 border-l-2',
          'top-2 right-2 border-t-2 border-r-2',
          'bottom-2 left-2 border-b-2 border-l-2',
          'bottom-2 right-2 border-b-2 border-r-2',
        ].map((cls, i) => (
          <div key={i} className={`absolute w-6 h-6 ${cls} rounded-sm`}
            style={{ borderColor: '#F0A500' }} />
        ))}
      </div>

      {/* Progress */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between mb-2">
          <p className="text-sm font-medium" style={{ color: '#E8EEFF' }}>{statusText}</p>
          <p className="text-sm" style={{ color: '#F0A500', fontFamily: 'JetBrains Mono' }}>
            {progress}%
          </p>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: '#1E2D4F' }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #F0A500, #FFD166)' }} />
        </div>
      </div>

      {/* Step indicators */}
      <div className="space-y-2 w-full max-w-xs">
        {[
          { label: 'Pre-processing image',    done: progress > 10 },
          { label: 'Loading OCR engine',      done: progress > 30 },
          { label: 'Recognising text',        done: progress > 80 },
          { label: 'Extracting transaction',  done: progress >= 100 },
        ].map(step => (
          <div key={step.label} className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: step.done ? 'rgba(6,214,160,0.2)' : 'rgba(30,45,79,0.5)',
                border: `1px solid ${step.done ? '#06D6A0' : '#1E2D4F'}`,
              }}>
              {step.done && (
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5 4-4" stroke="#06D6A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <p className="text-xs" style={{ color: step.done ? '#8899BB' : '#3A4A6A' }}>
              {step.label}
            </p>
          </div>
        ))}
      </div>

      {/* Scan line animation CSS */}
      <style>{`
        @keyframes scanLine {
          0%   { top: 0%; }
          50%  { top: 95%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 3 — REVIEW SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function ReviewStage({ draft, categories, imagePreview, onSave, onRescan }) {
  const [merchant, setMerchant]   = useState(draft.merchant || '');
  const [amount, setAmount]       = useState(String(draft.amount || ''));
  const [date, setDate]           = useState(draft.date || new Date().toISOString().split('T')[0]);
  const [category, setCategory]   = useState(draft.category || 'other');
  const [payment, setPayment]     = useState(draft.paymentMethod || 'Cash');
  const [notes, setNotes]         = useState(draft.notes || '');
  const [saving, setSaving]       = useState(false);
  const [amountError, setAmountError] = useState('');

  const cycleCategory = () => {
    const idx  = categories.findIndex(c => c.id === category);
    const next = categories[(idx + 1) % categories.length];
    setCategory(next.id);
  };

  const cat = categories.find(c => c.id === category);

  // Confidence helpers
  const ConfidenceDot = ({ value }) => {
    const color = value >= 75 ? '#06D6A0' : value >= 50 ? '#F0A500' : '#FF6B6B';
    const label = value >= 75 ? 'High confidence' : value >= 50 ? 'Medium' : 'Guessed';
    return (
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-[9px]" style={{ color: '#5A6A8A' }}>{label}</span>
      </div>
    );
  };

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={onRescan}
            className="w-8 h-8 flex items-center justify-center rounded-xl tap-active flex-shrink-0"
            style={{ background: '#151E35', border: '1px solid #1E2D4F' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8899BB" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#E8EEFF' }}>Review Receipt</h2>
            <p className="text-xs" style={{ color: '#5A6A8A' }}>Edit any field before saving</p>
          </div>
        </div>
      </div>

      {/* Thumbnail */}
      {imagePreview && (
        <div className="px-5 mb-4">
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
            <img src={imagePreview} alt="Receipt" className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
              style={{ border: '1px solid #1E2D4F' }} />
            <div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#06D6A0' }} />
                <p className="text-xs font-medium" style={{ color: '#06D6A0' }}>Receipt scanned</p>
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#5A6A8A' }}>
                Overall confidence: {draft.confidence?.overall ?? 0}%
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 space-y-3 pb-32">
        {/* Merchant */}
        <div className="rounded-2xl p-4" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-semibold" style={{ color: '#8899BB' }}>MERCHANT</label>
            <ConfidenceDot value={draft.confidence?.merchant ?? 0} />
          </div>
          <input
            value={merchant}
            onChange={e => setMerchant(e.target.value)}
            className="w-full bg-transparent text-base font-medium outline-none"
            style={{ color: '#E8EEFF', fontFamily: 'DM Sans' }}
            placeholder="Merchant name"
          />
        </div>

        {/* Amount */}
        <div className="rounded-2xl p-4" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-semibold" style={{ color: '#8899BB' }}>AMOUNT</label>
            <ConfidenceDot value={draft.confidence?.amount ?? 0} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl" style={{ color: '#5A6A8A' }}>₹</span>
            <input
              type="number"
              value={amount}
              onChange={e => { setAmount(e.target.value); setAmountError(''); }}
              className="flex-1 bg-transparent text-2xl font-light outline-none"
              style={{ color: '#FF6B6B', fontFamily: 'DM Serif Display, serif' }}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
          {amountError && <p className="text-xs mt-1" style={{ color: '#FF6B6B' }}>{amountError}</p>}
        </div>

        {/* Date */}
        <div className="rounded-2xl p-4" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-semibold" style={{ color: '#8899BB' }}>DATE</label>
            <ConfidenceDot value={draft.confidence?.date ?? 0} />
          </div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-transparent text-base outline-none"
            style={{ color: '#E8EEFF', fontFamily: 'DM Sans', colorScheme: 'dark' }}
          />
        </div>

        {/* Category */}
        <div className="rounded-2xl p-4" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          <label className="text-xs font-semibold block mb-3" style={{ color: '#8899BB' }}>CATEGORY</label>
          <button onClick={cycleCategory}
            className="flex items-center gap-3 tap-active w-full">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: (cat?.color || '#5A6A8A') + '22', border: `1px solid ${cat?.color || '#5A6A8A'}44` }}>
              {cat?.icon || '📦'}
            </div>
            <div className="flex-1 text-left">
              <p className="text-base font-medium" style={{ color: '#E8EEFF' }}>{cat?.name || 'Other'}</p>
              <p className="text-xs" style={{ color: '#5A6A8A' }}>Tap to change</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2A3A5C" strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Payment method */}
        <div className="rounded-2xl p-4" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          <label className="text-xs font-semibold block mb-3" style={{ color: '#8899BB' }}>PAYMENT METHOD</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map(m => (
              <button key={m} onClick={() => setPayment(m)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium tap-active"
                style={{
                  background: payment === m ? 'rgba(240,165,0,0.15)' : '#151E35',
                  color:      payment === m ? '#F0A500' : '#5A6A8A',
                  border:     `1px solid ${payment === m ? 'rgba(240,165,0,0.4)' : '#1E2D4F'}`,
                }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-2xl p-4" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          <label className="text-xs font-semibold block mb-2" style={{ color: '#8899BB' }}>NOTES</label>
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: '#8899BB' }}
            placeholder="Optional note…"
          />
        </div>
      </div>

      {/* Save button */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4 max-w-lg mx-auto"
        style={{ background: 'linear-gradient(to top, #080C18 70%, transparent)', zIndex: 30 }}>
        <button
          onClick={() => {
            const a = parseFloat(amount);
            if (!a || a <= 0) { setAmountError('Enter a valid amount'); return; }
            onSave({ merchant, amount: a, date, category, paymentMethod: payment, notes, type: 'expense', tags: ['receipt', 'scanned'] });
          }}
          disabled={saving}
          className="w-full py-4 rounded-2xl font-semibold text-base tap-active"
          style={{
            background: 'linear-gradient(135deg,#F0A500,#FFD166)',
            color: '#080C18',
            boxShadow: '0 4px 20px rgba(240,165,0,0.35)',
          }}
        >
          {saving ? 'Saving…' : 'Save Transaction'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 4 — DONE SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function DoneStage({ savedTxn, categories, onScanAnother, onClose }) {
  const cat = categories.find(c => c.id === savedTxn?.category);
  return (
    <div className="flex flex-col items-center py-16 px-8 text-center gap-5">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
        style={{ background: 'rgba(6,214,160,0.12)', border: '1px solid rgba(6,214,160,0.3)' }}>
        ✅
      </div>
      <div>
        <h2 className="text-xl mb-1" style={{ fontFamily: 'DM Serif Display, serif' }}>Receipt saved!</h2>
        <p className="text-sm" style={{ color: '#8899BB' }}>Transaction added to Vault.</p>
      </div>
      {savedTxn && (
        <div className="w-full p-4 rounded-2xl" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: (cat?.color || '#5A6A8A') + '22', border: `1px solid ${cat?.color || '#5A6A8A'}44` }}>
              {cat?.icon || '📦'}
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold" style={{ color: '#E8EEFF' }}>{savedTxn.merchant || 'Receipt'}</p>
              <p className="text-xs" style={{ color: '#5A6A8A' }}>{cat?.name} · {savedTxn.date}</p>
            </div>
            <p className="text-lg font-medium" style={{ color: '#FF6B6B', fontFamily: 'JetBrains Mono' }}>
              {savedTxn.amount ? `−₹${savedTxn.amount.toLocaleString('en-IN')}` : ''}
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 w-full mt-2">
        <button onClick={onScanAnother}
          className="w-full py-3.5 rounded-2xl font-medium text-sm tap-active"
          style={{ background: 'linear-gradient(135deg,#F0A500,#FFD166)', color: '#080C18' }}>
          Scan Another Receipt
        </button>
        <button onClick={onClose}
          className="w-full py-3.5 rounded-2xl font-medium text-sm tap-active"
          style={{ background: '#151E35', border: '1px solid #1E2D4F', color: '#8899BB' }}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ERROR SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function ErrorStage({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center py-16 px-8 text-center gap-5">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
        style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)' }}>
        😵
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: '#E8EEFF' }}>Scan Failed</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#8899BB' }}>{message}</p>
      </div>
      <button onClick={onRetry}
        className="w-full py-3.5 rounded-2xl font-medium text-sm tap-active"
        style={{ background: 'linear-gradient(135deg,#F0A500,#FFD166)', color: '#080C18' }}>
        Try Again
      </button>
      <div className="p-3 rounded-xl text-xs text-left space-y-1 w-full"
        style={{ background: '#0F1629', border: '1px solid #1E2D4F', color: '#5A6A8A' }}>
        <p className="font-medium" style={{ color: '#8899BB' }}>💡 Troubleshooting:</p>
        <p>• Use good lighting — avoid shadows across the receipt</p>
        <p>• Hold the camera directly above and level</p>
        <p>• Make sure the whole receipt is in frame</p>
        <p>• Try a higher-resolution photo</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportReceipt({ onClose }) {
  const { categories, addTxn, navigate, showNotif } = useApp();

  const [stage, setStage]             = useState('capture');
  const [imagePreview, setImagePreview] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus]     = useState('Preparing…');
  const [draft, setDraft]             = useState(null);
  const [savedTxn, setSavedTxn]       = useState(null);
  const [errorMsg, setErrorMsg]       = useState('');

  // Clean up the OCR worker when the user leaves this page
  useEffect(() => {
    return () => { terminateOCR(); };
  }, []);

  // ── HANDLE IMAGE SELECTED ─────────────────────────────────
  const handleImage = useCallback(async (file) => {
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setOcrProgress(0);
    setStage('scanning');

    try {
      // Run OCR with progress updates
      setOcrStatus('Pre-processing image…');
      const ocrResult = await runOCR(file, (pct) => {
        setOcrProgress(pct);
        if (pct < 15) setOcrStatus('Pre-processing image…');
        else if (pct < 40) setOcrStatus('Loading OCR engine…');
        else if (pct < 90) setOcrStatus('Reading receipt text…');
        else setOcrStatus('Extracting transaction…');
      });

      if (!ocrResult.text || ocrResult.text.trim().length < 3) {
        throw new Error(
          'Could not read any text from this image. ' +
          'Please try a clearer photo with better lighting.'
        );
      }

      // Parse the OCR result into a transaction draft
      const transactionDraft = await parseReceipt(ocrResult);
      setDraft(transactionDraft);
      setStage('review');

    } catch (err) {
      setErrorMsg(err.message || 'Scan failed. Please try again.');
      setStage('error');
    }
  }, []);

  // ── HANDLE SAVE ───────────────────────────────────────────
  const handleSave = useCallback(async (txnData) => {
    try {
      const saved = await addTxn(txnData);

      // If user changed the category vs what was auto-detected,
      // teach the learning engine for next time
      if (txnData.merchant && txnData.category) {
        await updateCategoryLearning(txnData.merchant, txnData.category);
      }

      setSavedTxn({ ...txnData, id: saved?.id });
      setStage('done');
      showNotif('Receipt saved to Vault ✓');
    } catch (err) {
      showNotif(err.message || 'Could not save transaction', 'error');
    }
  }, [addTxn, showNotif]);

  const handleReset = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setDraft(null);
    setSavedTxn(null);
    setErrorMsg('');
    setOcrProgress(0);
    setStage('capture');
  };

  const handleClose = () => {
    handleReset();
    if (onClose) onClose();
    else navigate('dashboard');
  };

  return (
    <div className="pb-6">
      {stage === 'capture'  && <CaptureStage  onImage={handleImage} onBack={handleClose} />}
      {stage === 'scanning' && <ScanningStage imagePreview={imagePreview} progress={ocrProgress} statusText={ocrStatus} />}
      {stage === 'review'   && draft && (
        <ReviewStage
          draft={draft}
          categories={categories}
          imagePreview={imagePreview}
          onSave={handleSave}
          onRescan={handleReset}
        />
      )}
      {stage === 'done'     && (
        <DoneStage
          savedTxn={savedTxn}
          categories={categories}
          onScanAnother={handleReset}
          onClose={handleClose}
        />
      )}
      {stage === 'error'    && <ErrorStage message={errorMsg} onRetry={handleReset} />}
    </div>
  );
}
