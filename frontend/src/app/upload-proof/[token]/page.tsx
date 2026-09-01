'use client';

import { useEffect, useState, useRef, use } from 'react';
import { apiClient } from '../../../lib/api/client';
import { PublicUploadSessionInfo } from '../../../lib/api/types';
import { Camera, Image as ImageIcon, FileText, CheckCircle, AlertCircle, Lock, Upload, RefreshCw } from 'lucide-react';

/**
 * Compresses large mobile camera photos before upload to prevent browser memory exhaustion.
 */
async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file;
  // If file is already small (< 1MB), no compression needed
  if (file.size < 1024 * 1024) return file;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDimension = 1920;
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

export default function MobileProofUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<PublicUploadSessionInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected file & preview
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);

  // Uploading state
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // File input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadSession() {
      if (!token) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const data = await apiClient.getPublicUploadSession(token);
        setSessionInfo(data);
        if (data.status === 'COMPLETED') {
          setUploadSuccess(true);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'This upload session has expired or is invalid.');
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [token]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setErrorMsg(null);
    setProcessingImage(true);

    try {
      // Immediate instant preview from original file
      if (rawFile.type === 'application/pdf') {
        setIsPdf(true);
        setPreviewUrl(null);
        setSelectedFile(rawFile);
      } else {
        setIsPdf(false);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const instantUrl = URL.createObjectURL(rawFile);
        setPreviewUrl(instantUrl);

        // Memory-safe compression in background
        const compressedFile = await compressImageIfNeeded(rawFile);
        setSelectedFile(compressedFile);
      }
    } catch (err) {
      console.warn('Image process note:', err);
      setSelectedFile(rawFile);
    } finally {
      setProcessingImage(false);
      // Reset input element value to allow picking or snapping the same or new photo immediately
      if (e.target) e.target.value = '';
    }
  }

  function handleClearSelection() {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setIsPdf(false);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }

  function handleReUploadNewProof() {
    setUploadSuccess(false);
    handleClearSelection();
  }

  async function handleUpload() {
    if (!selectedFile || !token) return;
    setUploading(true);
    setErrorMsg(null);

    try {
      await apiClient.uploadPublicProof(token, selectedFile);
      setUploadSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload proof. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-app flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700 mb-4"></div>
        <p className="text-sm font-semibold text-text-secondary">Connecting to secure upload session...</p>
      </div>
    );
  }

  if (errorMsg && !sessionInfo && !uploadSuccess) {
    return (
      <div className="min-h-screen bg-background-app text-text-primary flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-danger-soft text-danger-app flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Upload Session Expired</h2>
        <p className="text-sm text-text-secondary max-w-sm mb-6">
          {errorMsg}
        </p>
        <p className="text-xs text-text-muted">
          Please ask the billing operator on the desktop computer to generate a fresh QR code.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-app text-text-primary flex flex-col justify-between py-6 px-4 max-w-md mx-auto">
      {/* Hidden File Inputs: Camera input uses capture="environment" to directly open phone camera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <header className="text-center space-y-1 mb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-900 text-white text-xl font-black mb-1 shadow-xs">
          JR
        </div>
        <h1 className="text-lg font-black tracking-wide uppercase text-primary-900">
          {sessionInfo?.businessName || 'Jay Ramji Enterprise'}
        </h1>
        <p className="text-xs font-semibold text-text-secondary">
          Payment Proof Upload
        </p>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 space-y-4">
        
        {/* Success Screen */}
        {uploadSuccess ? (
          <div className="bg-surface-app border border-success-app/20 rounded-2xl p-6 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-success-soft text-success-app flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-success-app">
                Proof Uploaded Successfully!
              </h2>
              <p className="text-xs text-text-secondary">
                Your payment screenshot / document has been securely attached to the billing record on the computer.
              </p>
            </div>
            
            {/* Action buttons on success */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleReUploadNewProof}
                className="w-full py-3 bg-surface-2-app hover:bg-surface-app active:scale-98 text-text-primary border border-border-app rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-primary-700" />
                <span>Upload Another / Replace Receipt</span>
              </button>

              <div className="p-3 bg-surface-2-app rounded-xl border border-border-app text-[11px] text-text-muted">
                You can now safely close this browser window.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Invoice Info Card */}
            {sessionInfo && (
              <div className="bg-surface-app border border-border-app rounded-2xl p-4 space-y-2.5 shadow-xs">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-muted uppercase font-semibold text-[10px] tracking-wider">Invoice Reference</span>
                  <span className="font-mono font-bold text-primary-700 bg-primary-700/10 px-2 py-0.5 rounded border border-primary-700/20">
                    {sessionInfo.invoiceNumber || 'Draft Bill'}
                  </span>
                </div>

                {sessionInfo.amountMinor !== null && sessionInfo.amountMinor !== undefined && (
                  <div className="flex justify-between items-center text-xs border-t border-border-light pt-2">
                    <span className="text-text-muted uppercase font-semibold text-[10px] tracking-wider">Payment Amount</span>
                    <span className="text-base font-black text-emerald-600">
                      ₹{(sessionInfo.amountMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {sessionInfo.method && (
                  <div className="flex justify-between items-center text-xs border-t border-border-light pt-2">
                    <span className="text-text-muted uppercase font-semibold text-[10px] tracking-wider">Method</span>
                    <span className="font-bold text-text-primary uppercase tracking-wide text-[11px]">
                      {sessionInfo.method.replace('_', ' ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            {/* Step 1: File Selection Buttons (when no file chosen yet) */}
            {!selectedFile && (
              <div className="space-y-3 pt-2">
                <p className="text-center text-xs font-semibold text-text-secondary">
                  Select payment screenshot, cheque photo, or receipt:
                </p>

                <button
                  type="button"
                  disabled={processingImage}
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full py-4 px-4 bg-primary-700 hover:bg-primary-800 active:scale-98 text-white rounded-2xl font-bold text-sm flex items-center justify-center space-x-3 shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-5 h-5" />
                  <span>Take Photo / Camera</span>
                </button>

                <button
                  type="button"
                  disabled={processingImage}
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full py-4 px-4 bg-surface-app hover:bg-surface-2-app border border-border-app active:scale-98 text-text-primary rounded-2xl font-bold text-sm flex items-center justify-center space-x-3 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <ImageIcon className="w-5 h-5 text-primary-700" />
                  <span>Choose from Gallery / Files</span>
                </button>

                {processingImage && (
                  <div className="text-center py-2 text-xs text-primary-700 flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary-700"></div>
                    <span>Optimizing photo memory...</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Image / Document Preview and Confirmation */}
            {selectedFile && (
              <div className="bg-surface-app border border-border-app rounded-2xl p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Preview Proof</span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    disabled={uploading}
                    className="text-xs text-danger-app hover:underline font-semibold cursor-pointer"
                  >
                    Change / Retake
                  </button>
                </div>

                <div className="bg-surface-2-app border border-border-app rounded-xl overflow-hidden flex items-center justify-center p-2 min-h-48 max-h-72">
                  {isPdf ? (
                    <div className="text-center p-4 space-y-2">
                      <FileText className="w-12 h-12 mx-auto text-primary-700" />
                      <p className="text-xs font-bold text-text-primary">{selectedFile.name}</p>
                      <p className="text-[10px] text-text-muted">PDF Document ({(selectedFile.size / 1024).toFixed(1)} KB)</p>
                    </div>
                  ) : previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Proof Preview"
                      className="max-h-68 w-auto object-contain rounded-lg shadow-xs"
                    />
                  ) : null}
                </div>

                <div className="text-[11px] text-text-muted flex justify-between px-1">
                  <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                  <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>

                {/* Upload Action Button */}
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleUpload}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Uploading to Computer...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Confirm & Upload Proof</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-[10.5px] text-text-muted pt-6 flex items-center justify-center gap-1.5">
        <Lock className="w-3.5 h-3.5 text-text-muted" />
        <span>End-to-End Secure One-Time Session • Jay Ramji Billing Engine</span>
      </footer>
    </div>
  );
}
