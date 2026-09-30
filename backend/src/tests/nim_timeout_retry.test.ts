import mongoose, { Types } from 'mongoose';
import {
  NvidiaNimClient,
  NvidiaTimeoutError,
} from '../modules/purchase/scanner/nvidiaNimClient';
import {
  parseBillDocument,
  mapRawToPurchaseBillExtraction,
  ExtractionError,
} from '../modules/purchase/scanner/billParser.service';
import {
  purchaseScannerService,
  ScanDocumentInput,
} from '../modules/purchase/scanner/purchaseScanner.service';
import { DocumentPreprocessingResult } from '../modules/purchase/scanner/preprocessingTypes';
import { env } from '../config/env';
import { Purchase } from '../database/models/Purchase';
import { Vendor } from '../database/models/Vendor';
import { Product } from '../database/models/Product';
import { PurchaseDraft } from '../database/models/PurchaseDraft';
import * as cloudinaryService from '../services/cloudinary';
import * as preprocessModule from '../modules/purchase/scanner/documentPreprocessor';
import * as parserModule from '../modules/purchase/scanner/billParser.service';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test';

function createDummyPreprocessingResult(): DocumentPreprocessingResult {
  return {
    documentType: 'IMAGE',
    originalMimeType: 'image/png',
    originalFileName: 'test_bill.png',
    fileSizeBytes: 1024,
    pageCount: 1,
    pages: [
      {
        pageNumber: 1,
        width: 800,
        height: 1000,
        mimeType: 'image/png',
        buffer: Buffer.from('fake-png-data'),
        rotation: 0,
        originalDimensions: { width: 800, height: 1000 },
        preprocessingApplied: ['colorspace_srgb'],
        warnings: [],
      },
    ],
    warnings: [],
    processingMetadata: {
      durationMs: 5,
      maxPagesConfigured: 10,
      maxFileSizeBytesConfigured: 15 * 1024 * 1024,
      rendererUsed: 'test-mock',
    },
  };
}

const VALID_NIM_JSON_RESPONSE = JSON.stringify({
  supplier: {
    name: 'Balaji Traders',
    gstin: '24ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    address: '123 Market Yard',
    city: 'Ahmedabad',
    state: 'Gujarat',
    stateCode: '24',
    pincode: '380001',
  },
  invoice: {
    invoiceNumber: 'INV-2026-001',
    invoiceDate: '2026-09-20',
  },
  lineItems: [
    {
      description: 'Pipes 100mm',
      hsnCode: '7304',
      quantity: 10,
      unit: 'NOS',
      unitPrice: 500,
      cgstRate: 9,
      cgstAmount: 450,
      sgstRate: 9,
      sgstAmount: 450,
      taxableAmount: 5000,
      totalAmount: 5900,
    },
  ],
  totals: {
    subtotal: 5000,
    cgstAmount: 450,
    sgstAmount: 450,
    grandTotal: 5900,
  },
});

describe('Phase 5.13.1 — NVIDIA NIM Timeout & Retry Reliability Suite', () => {
  let originalFetch: typeof global.fetch;

  beforeAll(async () => {
    originalFetch = global.fetch;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGO_URI);
    }
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // TEST 1: Default & Configured Timeouts
  // --------------------------------------------------------------------------
  it('1. NvidiaNimClient respects configured timeoutMs and defaults to 20000ms from env', () => {
    const clientDefault = new NvidiaNimClient();
    expect((clientDefault as any).timeoutMs).toBe(60000);
    expect((clientDefault as any).totalBudgetMs).toBe(90000);
    expect((clientDefault as any).maxRetries).toBe(1);

    const clientCustom = new NvidiaNimClient({
      timeoutMs: 15000,
      totalBudgetMs: 30000,
      maxRetries: 0,
    });
    expect((clientCustom as any).timeoutMs).toBe(15000);
    expect((clientCustom as any).totalBudgetMs).toBe(30000);
    expect((clientCustom as any).maxRetries).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Max 2 Attempts on Timeout
  // --------------------------------------------------------------------------
  it('2. NvidiaNimClient performs at most 2 attempts (maxRetries=1) on timeout and halts', async () => {
    let callCount = 0;
    // Mock fetch to simulate AbortError (timeout)
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++;
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      return Promise.reject(abortError);
    }) as any;

    const client = new NvidiaNimClient({ timeoutMs: 50, totalBudgetMs: 20000 });
    const payload = {
      model: 'meta/llama-3.2-11b-vision-instruct',
      pages: [{ pageNumber: 1, mimeType: 'image/png' as const, base64Data: 'dGVzdA==' }],
      prompt: 'Extract bill',
    };

    await expect(client.extractDocumentVision(payload)).rejects.toThrow(NvidiaTimeoutError);
    expect(callCount).toBe(2); // exactly 1 initial + 1 retry = 2 attempts, NEVER 3
  });

  // --------------------------------------------------------------------------
  // TEST 3: Correct Status Code 504 and Code NVIDIA_TIMEOUT
  // --------------------------------------------------------------------------
  it('3. NvidiaNimClient throws NvidiaTimeoutError with statusCode 504 and errorCode NVIDIA_TIMEOUT', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      return Promise.reject(abortError);
    }) as any;

    const client = new NvidiaNimClient({ timeoutMs: 50, totalBudgetMs: 200 });
    const payload = {
      model: 'meta/llama-3.2-11b-vision-instruct',
      pages: [{ pageNumber: 1, mimeType: 'image/png' as const, base64Data: 'dGVzdA==' }],
      prompt: 'Extract bill',
    };

    try {
      await client.extractDocumentVision(payload);
      fail('Expected extractDocumentVision to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(NvidiaTimeoutError);
      expect(err.statusCode).toBe(504);
      expect(err.errorCode).toBe('NVIDIA_TIMEOUT');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Error Details Track Per-Attempt Durations
  // --------------------------------------------------------------------------
  it('4. NvidiaNimClient error details contain attemptCount, attemptDurations, and totalElapsedMs', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      return Promise.reject(abortError);
    }) as any;

    const client = new NvidiaNimClient({ timeoutMs: 50, totalBudgetMs: 20000 });
    const payload = {
      model: 'meta/llama-3.2-11b-vision-instruct',
      pages: [{ pageNumber: 1, mimeType: 'image/png' as const, base64Data: 'dGVzdA==' }],
      prompt: 'Extract bill',
    };

    try {
      await client.extractDocumentVision(payload);
      fail('Expected to throw');
    } catch (err: any) {
      expect(err.details).toBeDefined();
      expect(err.details.attemptCount).toBe(2);
      expect(Array.isArray(err.details.attemptDurations)).toBe(true);
      expect(err.details.attemptDurations.length).toBe(2);
      expect(typeof err.details.totalElapsedMs).toBe('number');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Error Message Contains Breakdown
  // --------------------------------------------------------------------------
  it('5. NvidiaNimClient error message provides clear attempt count and per-attempt duration breakdown', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      return Promise.reject(abortError);
    }) as any;

    const client = new NvidiaNimClient({ timeoutMs: 50, totalBudgetMs: 20000 });
    const payload = {
      model: 'meta/llama-3.2-11b-vision-instruct',
      pages: [{ pageNumber: 1, mimeType: 'image/png' as const, base64Data: 'dGVzdA==' }],
      prompt: 'Extract bill',
    };

    try {
      await client.extractDocumentVision(payload);
      fail('Expected to throw');
    } catch (err: any) {
      expect(err.message).toMatch(/NVIDIA NIM extraction failed after 2 attempt\(s\)/);
      expect(err.message).toMatch(/attempt 1:/);
      expect(err.message).toMatch(/attempt 2:/);
      expect(err.message).toMatch(/Total:/);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Successful Extraction Returns Attempt Metrics in Metadata
  // --------------------------------------------------------------------------
  it('6. parseBillDocument returns attemptCount and attemptDurations in extraction metadata', async () => {
    const mockClient = {
      extractDocumentVision: jest.fn().mockResolvedValue({
        rawText: VALID_NIM_JSON_RESPONSE,
        model: 'meta/llama-3.2-11b-vision-instruct',
        durationMs: 1500,
        attemptCount: 1,
        attemptDurations: [1500],
      }),
    } as unknown as NvidiaNimClient;

    const preprocessing = createDummyPreprocessingResult();
    const result = await parseBillDocument(preprocessing, { client: mockClient });

    expect(result.metadata.nimAttemptCount).toBe(1);
    expect(result.metadata.nimAttemptDurations).toEqual([1500]);
    expect(result.metadata.repaired).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Budget Check Skips Repair if Remaining Budget < 12000ms
  // --------------------------------------------------------------------------
  it('7. parseBillDocument skips repair and throws NVIDIA_TIMEOUT if remaining budget < 12000ms', async () => {
    // Return unparseable JSON on first attempt
    const mockClient = {
      extractDocumentVision: jest.fn().mockImplementation(async () => {
        // Artificially simulate delay so remaining budget is exhausted
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          rawText: '<<<INVALID MALFORMED JSON>>>',
          model: 'meta/llama-3.2-11b-vision-instruct',
          durationMs: 110000, // Large duration to exhaust budget
          attemptCount: 1,
          attemptDurations: [110000],
        };
      }),
    } as unknown as NvidiaNimClient;

    // Temporarily mock env.NVIDIA_NIM_TOTAL_TIMEOUT_MS to a small value so parserBudgetMs < 12000ms
    const origBudget = env.NVIDIA_NIM_TOTAL_TIMEOUT_MS;
    (env as any).NVIDIA_NIM_TOTAL_TIMEOUT_MS = 500; // parser budget = 2*500 + 10000 = 11000ms (< 12000ms min repair budget)

    try {
      const preprocessing = createDummyPreprocessingResult();
      await parseBillDocument(preprocessing, { client: mockClient });
      fail('Expected parseBillDocument to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ExtractionError);
      expect(err.statusCode).toBe(504);
      expect(err.errorCode).toBe('NVIDIA_TIMEOUT');
      expect(err.message).toContain('no budget remains for repair');
    } finally {
      (env as any).NVIDIA_NIM_TOTAL_TIMEOUT_MS = origBudget;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Repair Client Uses Capped Budget
  // --------------------------------------------------------------------------
  it('8. parseBillDocument uses capped budget for repair client and records attempt metrics', async () => {
    let callNum = 0;
    const mockClient = {
      extractDocumentVision: jest.fn().mockImplementation(async () => {
        callNum++;
        if (callNum === 1) {
          return {
            rawText: 'MALFORMED JSON WITHOUT BRACES',
            model: 'meta/llama-3.2-11b-vision-instruct',
            durationMs: 2000,
            attemptCount: 1,
            attemptDurations: [2000],
          };
        }
        return {
          rawText: VALID_NIM_JSON_RESPONSE,
          model: 'meta/llama-3.2-11b-vision-instruct',
          durationMs: 3000,
          attemptCount: 1,
          attemptDurations: [3000],
        };
      }),
    } as unknown as NvidiaNimClient;

    const preprocessing = createDummyPreprocessingResult();
    const result = await parseBillDocument(preprocessing, { client: mockClient });

    expect(callNum).toBe(2);
    expect(result.metadata.repaired).toBe(true);
    expect(result.metadata.nimAttemptCount).toBe(2);
    expect(result.metadata.nimAttemptDurations).toEqual([2000, 3000]);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Max 1 Repair Attempt (Never Loops)
  // --------------------------------------------------------------------------
  it('9. parseBillDocument never executes more than 1 repair attempt when repair returns malformed JSON', async () => {
    let callNum = 0;
    const mockClient = {
      extractDocumentVision: jest.fn().mockImplementation(async () => {
        callNum++;
        return {
          rawText: 'MALFORMED UNPARSABLE OUTPUT ON EVERY CALL',
          model: 'meta/llama-3.2-11b-vision-instruct',
          durationMs: 1000,
          attemptCount: 1,
          attemptDurations: [1000],
        };
      }),
    } as unknown as NvidiaNimClient;

    const preprocessing = createDummyPreprocessingResult();
    await expect(parseBillDocument(preprocessing, { client: mockClient })).rejects.toThrow(
      ExtractionError
    );
    expect(callNum).toBe(2); // exactly 1 initial + 1 repair attempt = 2, NEVER loops to 3
  });

  // --------------------------------------------------------------------------
  // TEST 10: Global Deadline Promise.race in scanAndCreateDraft
  // --------------------------------------------------------------------------
  it('10. scanAndCreateDraft enforces global deadline and throws NvidiaTimeoutError if execution hangs', async () => {
    const origDeadline = env.GLOBAL_SCANNER_DEADLINE_MS;
    (env as any).GLOBAL_SCANNER_DEADLINE_MS = 200; // 200ms global deadline for test

    // Mock document preprocessor to hang indefinitely
    jest.spyOn(preprocessModule, 'preprocessDocument').mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    );

    const input: ScanDocumentInput = {
      businessId: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      fileBuffer: Buffer.from('test-file'),
      fileName: 'invoice.png',
      mimeType: 'image/png',
      fileSize: 100,
      idempotencyKey: `IDEMP_TIMEOUT_${Date.now()}`,
    };

    try {
      await purchaseScannerService.scanAndCreateDraft(input);
      fail('Expected to time out');
    } catch (err: any) {
      expect(err).toBeInstanceOf(NvidiaTimeoutError);
      expect(err.statusCode).toBe(504);
      expect(err.errorCode).toBe('NVIDIA_TIMEOUT');
    } finally {
      (env as any).GLOBAL_SCANNER_DEADLINE_MS = origDeadline;
      jest.restoreAllMocks();
    }
  });

  // --------------------------------------------------------------------------
  // TEST 11: Idempotency Lock Cleanup on Timeout Failure
  // --------------------------------------------------------------------------
  it('11. scanAndCreateDraft releases activeScanLocks on timeout failure allowing retry', async () => {
    const origDeadline = env.GLOBAL_SCANNER_DEADLINE_MS;
    (env as any).GLOBAL_SCANNER_DEADLINE_MS = 150;

    jest.spyOn(preprocessModule, 'preprocessDocument').mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    );

    const businessId = new Types.ObjectId();
    const idempotencyKey = `IDEMP_LOCK_TEST_${Date.now()}`;
    const input: ScanDocumentInput = {
      businessId,
      userId: new Types.ObjectId(),
      fileBuffer: Buffer.from('lock-test-file'),
      fileName: 'lock_invoice.png',
      mimeType: 'image/png',
      fileSize: 100,
      idempotencyKey,
    };

    // First attempt times out
    await expect(purchaseScannerService.scanAndCreateDraft(input)).rejects.toThrow(
      NvidiaTimeoutError
    );

    // Verify lock is deleted from activeScanLocks
    const lockKey = `${businessId.toString()}:${idempotencyKey}`;
    expect((purchaseScannerService.constructor as any).activeScanLocks.has(lockKey)).toBe(false);

    (env as any).GLOBAL_SCANNER_DEADLINE_MS = origDeadline;
    jest.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // TEST 12: Cloudinary Asset Cleanup on NIM Timeout
  // --------------------------------------------------------------------------
  it('12. scanAndCreateDraft cleans up Cloudinary assets when scanner fails or times out', async () => {
    const cleanupSpy = jest.fn().mockResolvedValue({ result: 'ok' });
    const uploadSpy = jest.spyOn(cloudinaryService, 'uploadBufferToCloudinary').mockResolvedValue({
      public_id: 'draft_test_cleanup_123',
      secure_url: 'https://cloudinary.com/draft_test_cleanup_123',
    } as any);

    if (cloudinaryService.cloudinary?.uploader) {
      jest.spyOn(cloudinaryService.cloudinary.uploader, 'destroy').mockImplementation(cleanupSpy);
    } else {
      (cloudinaryService.cloudinary as any).uploader = { destroy: cleanupSpy };
    }

    jest.spyOn(preprocessModule, 'preprocessDocument').mockResolvedValue(
      createDummyPreprocessingResult()
    );
    jest.spyOn(parserModule, 'parseBillDocument').mockRejectedValue(
      new NvidiaTimeoutError(20000)
    );

    const input: ScanDocumentInput = {
      businessId: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      fileBuffer: Buffer.from('cloudinary-test-file'),
      fileName: 'invoice.png',
      mimeType: 'image/png',
      fileSize: 100,
      idempotencyKey: `IDEMP_CLOUDINARY_${Date.now()}`,
    };

    await expect(purchaseScannerService.scanAndCreateDraft(input)).rejects.toThrow(
      NvidiaTimeoutError
    );

    expect(uploadSpy).toHaveBeenCalled();
    expect(cleanupSpy).toHaveBeenCalledWith('draft_test_cleanup_123', { resource_type: 'image' });

    jest.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // TEST 13: Zero Business Side-Effects on Timeout Failure
  // --------------------------------------------------------------------------
  it('13. scanAndCreateDraft produces ZERO business side effects on timeout failure', async () => {
    const bId = new Types.ObjectId();
    const purchaseCountBefore = await Purchase.countDocuments({ businessId: bId });
    const vendorCountBefore = await Vendor.countDocuments({ businessId: bId });
    const productCountBefore = await Product.countDocuments({ businessId: bId });
    const draftCountBefore = await PurchaseDraft.countDocuments({ businessId: bId });

    jest.spyOn(preprocessModule, 'preprocessDocument').mockResolvedValue(
      createDummyPreprocessingResult()
    );
    jest.spyOn(parserModule, 'parseBillDocument').mockRejectedValue(
      new NvidiaTimeoutError(20000)
    );

    const input: ScanDocumentInput = {
      businessId: bId,
      userId: new Types.ObjectId(),
      fileBuffer: Buffer.from('zero-side-effects-file'),
      fileName: 'invoice.png',
      mimeType: 'image/png',
      fileSize: 100,
      idempotencyKey: `IDEMP_ZERO_SIDE_EFFECTS_${Date.now()}`,
    };

    await expect(purchaseScannerService.scanAndCreateDraft(input)).rejects.toThrow(
      NvidiaTimeoutError
    );

    const purchaseCountAfter = await Purchase.countDocuments({ businessId: bId });
    const vendorCountAfter = await Vendor.countDocuments({ businessId: bId });
    const productCountAfter = await Product.countDocuments({ businessId: bId });
    const draftCountAfter = await PurchaseDraft.countDocuments({ businessId: bId });

    expect(purchaseCountAfter).toBe(purchaseCountBefore);
    expect(vendorCountAfter).toBe(vendorCountBefore);
    expect(productCountAfter).toBe(productCountBefore);
    expect(draftCountAfter).toBe(draftCountBefore);

    jest.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // TEST 14: Stage Durations & Metrics Observability
  // --------------------------------------------------------------------------
  it('14. Stage durations correctly include nimAttemptCount, per-attempt durations, and repair status', async () => {
    const rawParsed = JSON.parse(VALID_NIM_JSON_RESPONSE);
    const mockExtractionResult = {
      rawResponse: rawParsed,
      normalizedExtraction: mapRawToPurchaseBillExtraction(rawParsed),
      metadata: {
        durationMs: 4500,
        initialNimDurationMs: 2000,
        initialParseDurationMs: 10,
        repairNimDurationMs: 2500,
        repairParseDurationMs: 15,
        repaired: true,
        modelUsed: 'meta/llama-3.2-11b-vision-instruct',
        pageCount: 1,
        warnings: [],
        nimAttemptCount: 2,
        nimAttemptDurations: [2000, 2500],
      },
    };

    jest.spyOn(preprocessModule, 'preprocessDocument').mockResolvedValue(
      createDummyPreprocessingResult()
    );
    jest.spyOn(parserModule, 'parseBillDocument').mockResolvedValue(mockExtractionResult);
    jest.spyOn(cloudinaryService, 'uploadBufferToCloudinary').mockResolvedValue({
      public_id: 'draft_stage_test_123',
      secure_url: 'https://cloudinary.com/test',
    } as any);

    const input: ScanDocumentInput = {
      businessId: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      fileBuffer: Buffer.from('stage-metrics-test'),
      fileName: 'invoice.png',
      mimeType: 'image/png',
      fileSize: 100,
      idempotencyKey: `IDEMP_STAGE_METRICS_${Date.now()}`,
    };

    const draft = await purchaseScannerService.scanAndCreateDraft(input);
    expect(draft).toBeDefined();

    // Clean up draft created in test
    await PurchaseDraft.deleteOne({ _id: draft._id });
    jest.restoreAllMocks();
  });
});
