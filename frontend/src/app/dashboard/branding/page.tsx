'use client';

import { useEffect, useState } from 'react';
import { useDashboard } from '../layout';
import { apiClient } from '../../../lib/api/client';
import { Asset } from '../../../lib/api/types';

export default function BrandingPage() {
  const { activeBusinessId, businesses } = useDashboard();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<'LOGO' | 'STAMP' | 'SIGNATURE' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Get current user role in the active business context
  const activeBusiness = businesses.find((b) => b.id === activeBusinessId);
  const userRole = activeBusiness?.role || 'STAFF';
  const isReadOnly = userRole === 'STAFF';

  async function loadAssets() {
    if (!activeBusinessId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiClient.listAssets();
      setAssets(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load branding assets');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssets();
  }, [activeBusinessId]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'LOGO' | 'STAMP' | 'SIGNATURE') {
    const file = e.target.files?.[0];
    if (!file || !activeBusinessId) return;

    // File Validation: size, format
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      setErrorMsg('Only PNG, JPG, JPEG, and WEBP image extensions are supported');
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setErrorMsg('File size exceeds the maximum limit of 5MB');
      return;
    }

    setUploadingType(type);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiClient.uploadAsset(file, type);
      setSuccessMsg(`${type} uploaded and set as active successfully!`);
      loadAssets();
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to upload ${type.toLowerCase()}`);
    } finally {
      setUploadingType(null);
      // Reset input value
      e.target.value = '';
    }
  }

  async function handleActivate(id: string, type: string) {
    if (isReadOnly) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.activateAsset(id);
      setSuccessMsg(`Active ${type.toLowerCase()} version updated`);
      loadAssets();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to activate asset');
    }
  }

  async function handleDeactivate(id: string, type: string) {
    if (isReadOnly) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.deactivateAsset(id);
      setSuccessMsg(`${type} deactivated successfully`);
      loadAssets();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to deactivate asset');
    }
  }

  // Filter assets by types
  const activeLogo = assets.find((a) => a.type === 'LOGO' && a.active);
  const activeStamp = assets.find((a) => a.type === 'STAMP' && a.active);
  const activeSignature = assets.find((a) => a.type === 'SIGNATURE' && a.active);

  const historicalLogos = assets.filter((a) => a.type === 'LOGO' && !a.active);
  const historicalStamps = assets.filter((a) => a.type === 'STAMP' && !a.active);
  const historicalSignatures = assets.filter((a) => a.type === 'SIGNATURE' && !a.active);

  if (loading && assets.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
        <p className="text-sm text-text-secondary">Loading branding assets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Business Branding</h1>
        <p className="text-sm text-text-secondary mt-1">
          Upload and configure your business logo, official stamp, and authorized signature.
        </p>
      </div>

      {isReadOnly && (
        <div className="p-3 bg-surface-2-app border border-border-app rounded-lg text-xs text-text-secondary">
          <span>Manage permissions are restricted to OWNER or ADMIN roles. STAFF accounts operate in view-only mode.</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-success-soft border border-success-app/20 text-success-app text-sm rounded-lg font-medium">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-sm rounded-lg font-medium">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LOGO SECTION */}
        <div className="bg-surface-app border border-border-app rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary border-b border-border-light pb-2">Business Logo</h3>
            <p className="text-xs text-text-secondary mt-1">Displays in the header of invoices.</p>

            {/* Active Preview */}
            <div className="mt-4 border border-dashed border-border-app rounded-lg h-36 flex items-center justify-center bg-surface-2-app overflow-hidden p-2 relative">
              {activeLogo ? (
                <img src={activeLogo.secureUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-text-muted">No active logo</span>
              )}
            </div>
            {activeLogo && (
              <div className="mt-2 text-[10px] text-text-secondary space-y-0.5">
                <p>Format: {activeLogo.format} | Size: {activeLogo.width}x{activeLogo.height}px</p>
                <p>Status: <span className="text-success-app font-semibold">ACTIVE</span></p>
              </div>
            )}
          </div>

          <div>
            {/* Upload form for LOGO */}
            {!isReadOnly && (
              <label className="block w-full text-center py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm">
                {uploadingType === 'LOGO' ? 'Uploading...' : 'Upload Logo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'LOGO')}
                  disabled={uploadingType !== null}
                  className="hidden"
                />
              </label>
            )}
            {activeLogo && !isReadOnly && (
              <button
                onClick={() => handleDeactivate(activeLogo.id || (activeLogo as any)._id, 'LOGO')}
                className="mt-2 w-full text-center py-1.5 border border-border-app hover:bg-surface-2-app text-text-secondary rounded-lg text-xs font-medium cursor-pointer"
              >
                Deactivate Logo
              </button>
            )}

            {/* Historical list */}
            {historicalLogos.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-border-light pt-3">
                <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wide">Historical versions</h4>
                <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                  {historicalLogos.map((hl) => (
                    <div key={hl.id || (hl as any)._id || hl.cloudinaryPublicId} className="flex items-center justify-between p-1 bg-surface-2-app rounded-md text-[10px]">
                      <span className="truncate flex-1 pr-2 text-text-secondary">{hl.cloudinaryPublicId.split('/').pop()}</span>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleActivate(hl.id || (hl as any)._id, 'LOGO')}
                          className="text-primary-700 font-semibold cursor-pointer"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STAMP SECTION */}
        <div className="bg-surface-app border border-border-app rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary border-b border-border-light pb-2">Official Stamp</h3>
            <p className="text-xs text-text-secondary mt-1">Displays on finalized tax invoice footer copies.</p>

            {/* Active Preview */}
            <div className="mt-4 border border-dashed border-border-app rounded-lg h-36 flex items-center justify-center bg-surface-2-app overflow-hidden p-2 relative">
              {activeStamp ? (
                <img src={activeStamp.secureUrl} alt="Stamp" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-text-muted">No active stamp</span>
              )}
            </div>
            {activeStamp && (
              <div className="mt-2 text-[10px] text-text-secondary space-y-0.5">
                <p>Format: {activeStamp.format} | Size: {activeStamp.width}x{activeStamp.height}px</p>
                <p>Status: <span className="text-success-app font-semibold">ACTIVE</span></p>
              </div>
            )}
          </div>

          <div>
            {!isReadOnly && (
              <label className="block w-full text-center py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm">
                {uploadingType === 'STAMP' ? 'Uploading...' : 'Upload Stamp'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'STAMP')}
                  disabled={uploadingType !== null}
                  className="hidden"
                />
              </label>
            )}
            {activeStamp && !isReadOnly && (
              <button
                onClick={() => handleDeactivate(activeStamp.id || (activeStamp as any)._id, 'STAMP')}
                className="mt-2 w-full text-center py-1.5 border border-border-app hover:bg-surface-2-app text-text-secondary rounded-lg text-xs font-medium cursor-pointer"
              >
                Deactivate Stamp
              </button>
            )}

            {/* Historical list */}
            {historicalStamps.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-border-light pt-3">
                <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wide">Historical versions</h4>
                <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                  {historicalStamps.map((hs) => (
                    <div key={hs.id || (hs as any)._id || hs.cloudinaryPublicId} className="flex items-center justify-between p-1 bg-surface-2-app rounded-md text-[10px]">
                      <span className="truncate flex-1 pr-2 text-text-secondary">{hs.cloudinaryPublicId.split('/').pop()}</span>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleActivate(hs.id || (hs as any)._id, 'STAMP')}
                          className="text-primary-700 font-semibold cursor-pointer"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SIGNATURE SECTION */}
        <div className="bg-surface-app border border-border-app rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary border-b border-border-light pb-2">Authorized Signature</h3>
            <p className="text-xs text-text-secondary mt-1">Displays on digital signature validation panels.</p>

            {/* Active Preview */}
            <div className="mt-4 border border-dashed border-border-app rounded-lg h-36 flex items-center justify-center bg-surface-2-app overflow-hidden p-2 relative">
              {activeSignature ? (
                <img src={activeSignature.secureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-text-muted">No active signature</span>
              )}
            </div>
            {activeSignature && (
              <div className="mt-2 text-[10px] text-text-secondary space-y-0.5">
                <p>Format: {activeSignature.format} | Size: {activeSignature.width}x{activeSignature.height}px</p>
                <p>Status: <span className="text-success-app font-semibold">ACTIVE</span></p>
              </div>
            )}
          </div>

          <div>
            {!isReadOnly && (
              <label className="block w-full text-center py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm">
                {uploadingType === 'SIGNATURE' ? 'Uploading...' : 'Upload Signature'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'SIGNATURE')}
                  disabled={uploadingType !== null}
                  className="hidden"
                />
              </label>
            )}
            {activeSignature && !isReadOnly && (
              <button
                onClick={() => handleDeactivate(activeSignature.id || (activeSignature as any)._id, 'SIGNATURE')}
                className="mt-2 w-full text-center py-1.5 border border-border-app hover:bg-surface-2-app text-text-secondary rounded-lg text-xs font-medium cursor-pointer"
              >
                Deactivate Signature
              </button>
            )}

            {/* Historical list */}
            {historicalSignatures.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-border-light pt-3">
                <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wide">Historical versions</h4>
                <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                  {historicalSignatures.map((hsi) => (
                    <div key={hsi.id || (hsi as any)._id || hsi.cloudinaryPublicId} className="flex items-center justify-between p-1 bg-surface-2-app rounded-md text-[10px]">
                      <span className="truncate flex-1 pr-2 text-text-secondary">{hsi.cloudinaryPublicId.split('/').pop()}</span>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleActivate(hsi.id || (hsi as any)._id, 'SIGNATURE')}
                          className="text-primary-700 font-semibold cursor-pointer"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
