import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Purchase, calculateOverallReceivingStatus } from '../../database/models/Purchase';
import { PurchaseReceipt, IPurchaseReceiptItem } from '../../database/models/PurchaseReceipt';
import { Product } from '../../database/models/Product';
import { InventoryTransaction } from '../../database/models/InventoryTransaction';
import { InvoiceSequence } from '../../database/models/InvoiceSequence';
import { AppError } from '../../middleware/errorHandler';

const receiveItemsSchema = z.object({
  items: z
    .array(
      z.object({
        purchaseItemId: z.string().min(1, 'Purchase item ID is required'),
        quantityReceived: z.number().min(1, 'Received quantity must be at least 1'),
      })
    )
    .min(1, 'At least one item must be received'),
  deliveryChallanNumber: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  receivedAt: z.string().or(z.date()).optional(),
});

/**
 * Generate sequential receipt number (e.g. REC-2526-0001)
 */
export async function generateReceiptNumber(businessId: Types.ObjectId | string): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYear = (startYear + 1) % 100;
  const fyPrefix = `${startYear.toString().slice(-2)}${endYear.toString().padStart(2, '0')}`;

  const seq = await InvoiceSequence.findOneAndUpdate(
    { businessId: new Types.ObjectId(businessId), key: 'PURCHASE_RECEIPT' },
    { $inc: { nextNumber: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const formattedNum = String(seq.nextNumber).padStart(4, '0');
  return `REC-${fyPrefix}-${formattedNum}`;
}

/**
 * Core internal function to execute physical receipt, stock increment, and inventory transactions
 */
export async function processReceiving(params: {
  businessId: Types.ObjectId | string;
  purchase: any;
  itemsToReceive: { purchaseItemId: string | Types.ObjectId; quantityReceived: number }[];
  receivedBy: Types.ObjectId | string;
  deliveryChallanNumber?: string | null;
  notes?: string | null;
  receivedAt?: Date;
  idempotencyKey?: string | null;
}): Promise<any> {
  const { businessId, purchase, itemsToReceive, receivedBy, deliveryChallanNumber, notes, receivedAt } = params;
  const idempotencyKey = params.idempotencyKey ? params.idempotencyKey.trim() : null;
  const bId = new Types.ObjectId(businessId);

  if (purchase.status === 'CANCELLED') {
    throw new AppError('Cannot receive items for a cancelled purchase', 400, 'PURCHASE_CANCELLED');
  }

  // Phase 4.2 Step 0: Idempotency & Crash-Recovery Pre-check
  if (idempotencyKey) {
    const existingReceipt = await PurchaseReceipt.findOne({
      businessId: bId,
      purchaseId: purchase._id,
      idempotencyKey,
    });

    if (existingReceipt) {
      // Crash-recovery reconciliation:
      // Verify if any inventory transactions or stock increments were missed due to a mid-operation crash
      for (const recItem of existingReceipt.items) {
        const itemTxKey = `RECEIPT_ITEM_${existingReceipt._id}_${recItem.purchaseItemId}`;
        const existingTx = await InventoryTransaction.findOne({
          businessId: bId,
          idempotencyKey: itemTxKey,
        });

        if (!existingTx) {
          // Transaction missing! Server crashed after receipt creation but before transaction/stock update.
          // Increment stock and record immutable transaction
          await Product.findByIdAndUpdate(recItem.productId, {
            $inc: { stockQuantity: recItem.quantityReceived },
            $set: {
              lastPurchasePriceMinor: Math.round((recItem.unitPurchasePrice || 0) * 100),
            },
          });

          try {
            await InventoryTransaction.create({
              businessId: bId,
              productId: recItem.productId,
              quantity: recItem.quantityReceived,
              transactionType: 'PURCHASE_RECEIPT',
              referenceType: 'PURCHASE_RECEIPT',
              referenceId: existingReceipt._id,
              purchaseId: purchase._id,
              unitCostPrice: recItem.unitPurchasePrice,
              idempotencyKey: itemTxKey,
              notes: existingReceipt.deliveryChallanNumber
                ? `Purchase Receipt ${existingReceipt.receiptNumber} (Challan: ${existingReceipt.deliveryChallanNumber})`
                : `Purchase Receipt ${existingReceipt.receiptNumber}`,
            });
          } catch (txErr: any) {
            if (txErr.code !== 11000) throw txErr;
          }
        }
      }

      // Reconcile purchase line item quantities if not yet reflected
      let purchaseDirty = false;
      for (const recItem of existingReceipt.items) {
        const pItem = purchase.items.find(
          (it: any) => it._id.toString() === recItem.purchaseItemId.toString()
        );
        if (pItem && pItem.receivedQuantity < recItem.quantityReceived) {
          pItem.receivedQuantity = recItem.quantityReceived;
          pItem.remainingQuantity = Math.max(0, pItem.orderedQuantity - pItem.receivedQuantity);
          if (pItem.receivedQuantity >= pItem.orderedQuantity) {
            pItem.receivingStatus = 'RECEIVED';
          } else if (pItem.receivedQuantity > 0) {
            pItem.receivingStatus = 'PARTIALLY_RECEIVED';
          }
          purchaseDirty = true;
        }
      }

      const calculatedStatus = calculateOverallReceivingStatus(purchase.items);
      if (purchase.receivingStatus !== calculatedStatus) {
        purchase.receivingStatus = calculatedStatus;
        purchaseDirty = true;
      }

      if (purchaseDirty) {
        await purchase.save();
      }

      return existingReceipt;
    }
  }

  // 1. Validation & over-receiving check
  const receiptItems: IPurchaseReceiptItem[] = [];

  for (const itemInput of itemsToReceive) {
    const purchaseItem = purchase.items.find(
      (it: any) => it._id.toString() === itemInput.purchaseItemId.toString()
    );

    if (!purchaseItem) {
      throw new AppError(
        `Purchase item ${itemInput.purchaseItemId} not found in this purchase`,
        400,
        'ITEM_NOT_FOUND'
      );
    }

    if (itemInput.quantityReceived > purchaseItem.remainingQuantity) {
      throw new AppError(
        `Cannot receive ${itemInput.quantityReceived} units for "${purchaseItem.productNameSnapshot}". Remaining quantity is only ${purchaseItem.remainingQuantity}.`,
        400,
        'OVER_RECEIVING_NOT_ALLOWED'
      );
    }

    receiptItems.push({
      purchaseItemId: purchaseItem._id,
      productId: purchaseItem.productId,
      productNameSnapshot: purchaseItem.productNameSnapshot,
      quantityReceived: itemInput.quantityReceived,
      unitPurchasePrice: purchaseItem.unitPurchasePrice,
    });
  }

  // 2. Generate receipt sequence
  const receiptNumber = await generateReceiptNumber(businessId);

  // 3. Create PurchaseReceipt audit record (with unique idempotencyKey protection)
  let receipt: any;
  try {
    receipt = await PurchaseReceipt.create({
      businessId: bId,
      purchaseId: purchase._id,
      receiptNumber,
      receivedBy: new Types.ObjectId(receivedBy),
      receivedAt: receivedAt || new Date(),
      items: receiptItems,
      deliveryChallanNumber: deliveryChallanNumber || null,
      notes: notes || null,
      idempotencyKey,
    });
  } catch (err: any) {
    if (
      err.code === 11000 &&
      idempotencyKey &&
      (err.keyPattern?.idempotencyKey || JSON.stringify(err.keyValue || {}).includes('idempotencyKey'))
    ) {
      // Race condition handled: Fetch receipt created by winning concurrent request
      const raceReceipt = await PurchaseReceipt.findOne({
        businessId: bId,
        purchaseId: purchase._id,
        idempotencyKey,
      });
      if (raceReceipt) {
        return raceReceipt;
      }
    }
    throw err;
  }

  // 4. Update Purchase line items and status
  for (const recItem of receiptItems) {
    const pItem = purchase.items.find((it: any) => it._id.toString() === recItem.purchaseItemId.toString());
    pItem.receivedQuantity += recItem.quantityReceived;
    pItem.remainingQuantity = Math.max(0, pItem.orderedQuantity - pItem.receivedQuantity);

    if (pItem.receivedQuantity >= pItem.orderedQuantity) {
      pItem.receivingStatus = 'RECEIVED';
    } else if (pItem.receivedQuantity > 0) {
      pItem.receivingStatus = 'PARTIALLY_RECEIVED';
    } else {
      pItem.receivingStatus = 'NOT_RECEIVED';
    }

    const itemTxKey = `RECEIPT_ITEM_${receipt._id}_${recItem.purchaseItemId}`;

    // Check if transaction already exists (safety guard against duplicate stock increments)
    const existingTx = await InventoryTransaction.findOne({
      businessId: bId,
      idempotencyKey: itemTxKey,
    });

    if (!existingTx) {
      // 5. Atomic Stock Update & Last Purchase Price Update
      await Product.findByIdAndUpdate(recItem.productId, {
        $inc: { stockQuantity: recItem.quantityReceived },
        $set: {
          lastPurchasePriceMinor: Math.round((recItem.unitPurchasePrice || 0) * 100),
        },
      });

      // 6. Immutable Inventory Transaction Record
      try {
        await InventoryTransaction.create({
          businessId: bId,
          productId: recItem.productId,
          quantity: recItem.quantityReceived, // Positive for stock inward
          transactionType: 'PURCHASE_RECEIPT',
          referenceType: 'PURCHASE_RECEIPT',
          referenceId: receipt._id,
          purchaseId: purchase._id,
          unitCostPrice: recItem.unitPurchasePrice,
          idempotencyKey: itemTxKey,
          notes: deliveryChallanNumber
            ? `Purchase Receipt ${receiptNumber} (Challan: ${deliveryChallanNumber})`
            : `Purchase Receipt ${receiptNumber}`,
        });
      } catch (txErr: any) {
        if (txErr.code !== 11000) {
          throw txErr;
        }
      }
    }
  }

  // 7. Update overall purchase receiving status
  purchase.receivingStatus = calculateOverallReceivingStatus(purchase.items);
  await purchase.save();

  return receipt;
}

/**
 * Controller: Receive products against an active purchase order
 */
export async function receivePurchaseProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return next(new AppError('Business context required', 400, 'BUSINESS_REQUIRED'));
    }

    const { purchaseId } = req.params;
    const userId = (req as any).user?.id || (req as any).user?._id;
    const validated = receiveItemsSchema.parse(req.body);

    const purchase = await Purchase.findOne({ _id: purchaseId, businessId });
    if (!purchase) {
      return next(new AppError('Purchase not found', 404, 'PURCHASE_NOT_FOUND'));
    }

    const rawIdemp = req.headers['idempotency-key'] || req.body.idempotencyKey;
    const idempotencyKey = typeof rawIdemp === 'string' ? rawIdemp.trim() : null;

    const receipt = await processReceiving({
      businessId,
      purchase,
      itemsToReceive: validated.items,
      receivedBy: userId,
      deliveryChallanNumber: validated.deliveryChallanNumber,
      notes: validated.notes,
      receivedAt: validated.receivedAt ? new Date(validated.receivedAt) : undefined,
      idempotencyKey,
    });

    res.status(201).json({
      success: true,
      data: {
        receipt,
        purchase,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: List all receipts for a purchase
 */
export async function listPurchaseReceipts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { purchaseId } = req.params;

    const receipts = await PurchaseReceipt.find({ purchaseId, businessId })
      .populate('receivedBy', 'name email')
      .sort({ receivedAt: -1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        receipts: receipts.map((r) => ({
          ...r,
          id: r._id.toString(),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}
