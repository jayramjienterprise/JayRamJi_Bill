import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../../../lib/api/client';
import { PaymentProof, UploadSession, UploadSessionStatus } from '../../../../lib/api/types';
import { UploadCloud, Smartphone, CheckCircle, Eye, RefreshCw, Trash2, X, FileText } from 'lucide-react';

interface PaymentProofUploaderProps {
  proof: PaymentProof | null;
  onProofChange: (proof: PaymentProof | null) => void;
  metadata?: {
    invoiceNumber?: string | null;
    amountMinor?: number | null;
    method?: string | null;
    customerName?: string | null;
  };
  invoiceId?: string;
  disabled?: boolean;
}

export default function PaymentProofUploader({
  proof,
  onProofChange,
  metadata,
  invoiceId,
  disabled = false,
}: PaymentProofUploaderProps) {
  const [uploadingDevice, setUploadingDevice] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // Phone QR modal state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<UploadSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<UploadSessionStatus>('CREATED');
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Lightbox preview modal state
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // File picker ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Polling ref
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  // 1. Device Upload Handler
  async function handleDeviceFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setDeviceError('File size exceeds the 10MB limit.');
      return;
    }

    setUploadingDevice(true);
    setDeviceError(null);

    try {
      const res = await apiClient.directUploadProof(file);
      onProofChange(res.proof);
    } catch (err: any) {
      setDeviceError(err.message || 'Failed uploading proof from device');
    } finally {
      setUploadingDevice(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // 2. Open Phone QR Upload Modal
  async function handleStartPhoneUpload() {
    setSessionLoading(true);
    setSessionError(null);
    setQrModalOpen(true);
    setCurrentSession(null);
    setSessionStatus('CREATED');

    try {
      const res = await apiClient.createUploadSession({
        invoiceId: invoiceId || undefined,
        metadata: {
          invoiceNumber: metadata?.invoiceNumber || undefined,
          amountMinor: metadata?.amountMinor || undefined,
          method: metadata?.method || undefined,
          customerName: metadata?.customerName || undefined,
        },
      });

      setCurrentSession(res);
      setSessionStatus(res.status);

      // Start live polling every 1.5 seconds
      startPolling(res.sessionId);
    } catch (err: any) {
      setSessionError(err.message || 'Failed creating temporary phone upload session');
    } finally {
      setSessionLoading(false);
    }
  }

  // 3. Real-time Status Polling
  function startPolling(sessionId: string) {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    pollingTimerRef.current = setInterval(async () => {
      try {
        const statusRes = await apiClient.getUploadSessionStatus(sessionId);
        setSessionStatus(statusRes.status);

        if (statusRes.status === 'COMPLETED' && statusRes.proof) {
          // Stop polling
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          onProofChange(statusRes.proof);
        } else if (statusRes.status === 'EXPIRED' || statusRes.status === 'CANCELLED' || statusRes.status === 'FAILED') {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
        }
      } catch (pollErr) {
        console.error('Phone upload status polling note:', pollErr);
      }
    }, 1500);
  }

  // 4. Cancel Phone Session
  async function handleCancelPhoneSession() {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }
    if (currentSession?.sessionId) {
      try {
        await apiClient.cancelUploadSession(currentSession.sessionId);
      } catch (err) {
        console.warn('Cancel session note:', err);
      }
    }
    setQrModalOpen(false);
    setCurrentSession(null);
  }

  // 5. Regenerate new QR Code
  async function handleRegenerateQR() {
    if (currentSession?.sessionId) {
      try {
        await apiClient.cancelUploadSession(currentSession.sessionId);
      } catch (ignore) {}
    }
    handleStartPhoneUpload();
  }

  return (
    <div className="space-y-2 text-xs">
      {/* Hidden Desktop File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
        onChange={handleDeviceFileSelected}
        className="hidden"
      />

      <label className="block text-text-secondary font-bold uppercase tracking-wider text-[11px]">
        Payment Proof <span className="text-text-muted font-normal text-[10px] lowercase">(optional)</span>
      </label>

      {deviceError && (
        <div className="p-2.5 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-lg font-medium">
          {deviceError}
        </div>
      )}

      {/* Case A: Proof is already uploaded & attached */}
      {proof && proof.secureUrl ? (
        <div className="bg-surface-2-app/50 border border-success-app/40 rounded-xl p-3.5 flex items-center justify-between flex-wrap gap-3 shadow-xs">
          <div className="flex items-center space-x-3 min-w-0">
            {proof.fileType?.includes('pdf') || proof.format === 'pdf' ? (
              <div className="w-10 h-10 rounded-lg bg-danger-soft border border-danger-app/20 text-danger-app flex items-center justify-center text-lg font-bold shrink-0">
                PDF
              </div>
            ) : (
              <img
                src={proof.secureUrl}
                alt="Proof Preview"
                className="w-10 h-10 rounded-lg object-cover border border-border-app shrink-0 shadow-xs"
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 text-success-app font-bold text-xs">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Payment proof uploaded</span>
              </div>
              <p className="text-[10.5px] text-text-muted truncate max-w-[220px]">
                {proof.publicId || 'proof_receipt'} ({proof.format?.toUpperCase() || 'IMAGE'})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="px-2.5 py-1.5 bg-surface-app hover:bg-surface-2-app border border-border-app rounded-lg text-xs font-bold text-text-primary transition cursor-pointer flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View</span>
            </button>
            {!disabled && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 bg-surface-app hover:bg-surface-2-app border border-border-app rounded-lg text-xs font-bold text-text-secondary transition cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Replace</span>
                </button>
                <button
                  type="button"
                  onClick={() => onProofChange(null)}
                  className="px-2.5 py-1.5 text-danger-app hover:bg-danger-soft rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Case B: No Proof Attached yet -> Two Action Buttons */
        <div className="flex items-center space-x-3">
          <button
            type="button"
            disabled={disabled || uploadingDevice}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2.5 px-3 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-xl text-xs font-bold text-text-primary flex items-center justify-center space-x-2 transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-primary-700" />
            <span>{uploadingDevice ? 'Uploading...' : 'Upload from Device'}</span>
          </button>

          <button
            type="button"
            disabled={disabled || sessionLoading}
            onClick={handleStartPhoneUpload}
            className="flex-1 py-2.5 px-3 bg-primary-700/10 hover:bg-primary-700/15 border border-primary-700/30 rounded-xl text-xs font-bold text-primary-700 flex items-center justify-center space-x-2 transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-primary-700" />
            <span>Upload from Phone</span>
          </button>
        </div>
      )}

      {/* Modal 1: Phone QR Code Upload Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center relative animate-in fade-in zoom-in-95 duration-150">
            
            {/* Close / Cancel button */}
            <button
              type="button"
              onClick={handleCancelPhoneSession}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary text-xl font-bold cursor-pointer"
            >
              &times;
            </button>

            <div>
              <h3 className="text-base font-black text-text-primary tracking-wide">
                Upload from Phone
              </h3>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Scan this QR code with your mobile phone camera to upload payment proof.
              </p>
            </div>

            {sessionLoading && (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700"></div>
                <p className="text-xs font-semibold text-text-secondary">Generating secure QR code...</p>
              </div>
            )}

            {sessionError && (
              <div className="p-3 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl font-medium">
                {sessionError}
              </div>
            )}

            {!sessionLoading && currentSession && (
              <div className="space-y-4">
                {/* QR Code Container */}
                <div className="p-3 bg-white rounded-2xl border-2 border-border-app inline-block shadow-inner">
                  {currentSession.qrCodeDataUrl ? (
                    <img
                      src={currentSession.qrCodeDataUrl}
                      alt="Phone Upload QR"
                      className="w-56 h-56 object-contain rounded-lg"
                    />
                  ) : null}
                </div>

                {/* Details pill */}
                <div className="bg-surface-2-app/60 border border-border-app rounded-xl p-2.5 text-xs text-left space-y-1">
                  {metadata?.invoiceNumber && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Invoice:</span>
                      <span className="font-mono font-bold text-text-primary">{metadata.invoiceNumber}</span>
                    </div>
                  )}
                  {metadata?.amountMinor !== undefined && metadata?.amountMinor !== null && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Amount:</span>
                      <span className="font-bold text-success-app">
                        ₹{(metadata.amountMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {metadata?.method && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Method:</span>
                      <span className="font-bold text-text-primary">{metadata.method}</span>
                    </div>
                  )}
                </div>

                {/* Dynamic Status Indicator */}
                <div className="space-y-2">
                  {sessionStatus === 'CREATED' && (
                    <div className="flex items-center justify-center space-x-2 text-xs text-text-secondary font-semibold animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-primary-700"></div>
                      <span>Waiting for phone...</span>
                    </div>
                  )}

                  {sessionStatus === 'SCANNED' && (
                    <div className="flex items-center justify-center space-x-2 text-xs text-primary-700 font-bold">
                      <div className="w-2 h-2 rounded-full bg-primary-700 animate-ping"></div>
                      <span>Phone connected • Waiting for upload...</span>
                    </div>
                  )}

                  {sessionStatus === 'UPLOADING' && (
                    <div className="flex items-center justify-center space-x-2 text-xs text-primary-700 font-bold">
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary-700"></div>
                      <span>Uploading payment proof from phone...</span>
                    </div>
                  )}

                  {sessionStatus === 'COMPLETED' && (
                    <div className="p-3 bg-success-soft border border-success-app/30 rounded-xl space-y-2">
                      <div className="text-xs font-bold text-success-app flex items-center justify-center space-x-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Payment proof uploaded successfully!</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQrModalOpen(false)}
                        className="w-full py-2 bg-success-app hover:bg-success-app/85 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  )}

                  {sessionStatus === 'EXPIRED' && (
                    <div className="p-3 bg-warning-soft border border-warning-app/30 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-warning-app">QR Code expired</p>
                      <button
                        type="button"
                        onClick={handleRegenerateQR}
                        className="w-full py-2 bg-primary-700 hover:bg-primary-800 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                      >
                        Generate New QR
                      </button>
                    </div>
                  )}
                </div>

                {/* Cancel Button */}
                {sessionStatus !== 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={handleCancelPhoneSession}
                    className="w-full py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-xl font-bold text-text-secondary text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Modal 2: Lightbox Proof Viewer */}
      {lightboxOpen && proof?.secureUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-border-light flex items-center justify-between">
              <div>
                <h4 className="font-bold text-text-primary text-sm">Payment Proof Document</h4>
                <p className="text-[11px] text-text-muted">
                  Uploaded {proof.uploadedAt ? new Date(proof.uploadedAt).toLocaleString('en-IN') : 'recently'}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={proof.secureUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg text-xs font-bold text-text-primary"
                >
                  Open Original ↗
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="text-text-muted hover:text-text-primary text-xl font-bold px-2 cursor-pointer"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/20 min-h-64">
              {proof.fileType?.includes('pdf') || proof.format === 'pdf' ? (
                <iframe
                  src={proof.secureUrl}
                  title="PDF Proof"
                  className="w-full h-96 rounded-lg border border-border-app"
                />
              ) : (
                <img
                  src={proof.secureUrl}
                  alt="Proof Full View"
                  className="max-h-[70vh] w-auto object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
