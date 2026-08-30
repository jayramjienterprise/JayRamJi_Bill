'use client';

import { useEffect, useState, useRef, use } from 'react';
import { apiClient } from '../../../lib/api/client';
import { PublicUploadSessionInfo } from '../../../lib/api/types';
import { Camera, Image as ImageIcon, FileText, CheckCircle, AlertCircle, Lock, Upload } from 'lucide-react';

export default function MobileProofUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<PublicUploadSessionInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected file & preview
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);

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
      } catch (err: any) {
        setErrorMsg(err.message || 'This upload session has expired or is invalid.');
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [token]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File is too large. Please select a photo or document under 10MB.');
      return;
    }

    setErrorMsg(null);
    setSelectedFile(file);

    if (file.type === 'application/pdf') {
      setIsPdf(true);
      setPreviewUrl(null);
    } else {
      setIsPdf(false);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
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
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mb-4"></div>
        <p className="text-sm font-semibold text-slate-300">Connecting to secure upload session...</p>
      </div>
    );
  }

  if (errorMsg && !sessionInfo && !uploadSuccess) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Upload Session Expired</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          {errorMsg}
        </p>
        <p className="text-xs text-slate-500">
          Please ask the billing operator on the desktop computer to generate a fresh QR code.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-6 px-4 max-w-md mx-auto">
      {/* Hidden File Inputs */}
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
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xl font-black mb-1">
          JR
        </div>
        <h1 className="text-lg font-black tracking-wide uppercase text-amber-400">
          {sessionInfo?.businessName || 'Jay Ramji Enterprise'}
        </h1>
        <p className="text-xs font-semibold text-slate-400">
          Payment Proof Upload
        </p>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 space-y-4">
        
        {/* Success Screen */}
        {uploadSuccess ? (
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-emerald-400">
                Proof Uploaded Successfully!
              </h2>
              <p className="text-xs text-slate-300">
                Your payment screenshot / document has been securely attached to the billing record on the computer.
              </p>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
              You can safely close this browser window.
            </div>
          </div>
        ) : (
          <>
            {/* Invoice Info Card */}
            {sessionInfo && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-md">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider">Invoice Reference</span>
                  <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {sessionInfo.invoiceNumber || 'Draft Bill'}
                  </span>
                </div>

                {sessionInfo.amountMinor !== null && sessionInfo.amountMinor !== undefined && (
                  <div className="flex justify-between items-center text-xs border-t border-slate-800/80 pt-2">
                    <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider">Payment Amount</span>
                    <span className="text-base font-black text-emerald-400">
                      ₹{(sessionInfo.amountMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {sessionInfo.method && (
                  <div className="flex justify-between items-center text-xs border-t border-slate-800/80 pt-2">
                    <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider">Method</span>
                    <span className="font-bold text-slate-200 uppercase tracking-wide text-[11px]">
                      {sessionInfo.method.replace('_', ' ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            {/* Step 1: File Selection Buttons (when no file chosen yet) */}
            {!selectedFile && (
              <div className="space-y-3 pt-2">
                <p className="text-center text-xs font-semibold text-slate-400">
                  Select payment screenshot, cheque photo, or receipt:
                </p>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full py-4 px-4 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 rounded-2xl font-black text-sm flex items-center justify-center space-x-3 shadow-lg shadow-amber-500/20 transition cursor-pointer"
                >
                  <Camera className="w-5 h-5" />
                  <span>Take Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full py-4 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 active:scale-98 text-slate-100 rounded-2xl font-bold text-sm flex items-center justify-center space-x-3 shadow-md transition cursor-pointer"
                >
                  <ImageIcon className="w-5 h-5" />
                  <span>Choose from Gallery / Files</span>
                </button>
              </div>
            )}

            {/* Step 2: Image / Document Preview and Confirmation */}
            {selectedFile && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Preview Proof</span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    disabled={uploading}
                    className="text-xs text-rose-400 hover:underline font-semibold cursor-pointer"
                  >
                    Change / Retake
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center p-2 min-h-48 max-h-72">
                  {isPdf ? (
                    <div className="text-center p-4 space-y-2">
                      <FileText className="w-12 h-12 mx-auto text-amber-400" />
                      <p className="text-xs font-bold text-slate-200">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-400">PDF Document ({(selectedFile.size / 1024).toFixed(1)} KB)</p>
                    </div>
                  ) : previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Proof Preview"
                      className="max-h-68 w-auto object-contain rounded-lg shadow-sm"
                    />
                  ) : null}
                </div>

                <div className="text-[11px] text-slate-400 flex justify-between px-1">
                  <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                  <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>

                {/* Upload Action Button */}
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleUpload}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-950"></div>
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
      <footer className="text-center text-[10.5px] text-slate-400 pt-6 flex items-center justify-center gap-1.5">
        <Lock className="w-3.5 h-3.5" />
        <span>End-to-End Secure One-Time Session • Jay Ramji Billing Engine</span>
      </footer>
    </div>
  );
}
