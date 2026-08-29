import { convertNumberToWords } from '../utils/numberToWords';

export interface ICalculationInputItem {
  productId: string | null;
  type: 'SERVICE' | 'PRODUCT';
  description: string;
  uom: string;
  quantity: number;
  unitPriceMinor: number;
  section?: 'ITEM' | 'LABOUR' | 'PART';
}

export interface ICalculationInput {
  items: ICalculationInputItem[];
  taxMode: 'NONE' | 'EXCLUSIVE' | 'INCLUSIVE';
  defaultTaxRateBps: number;
  discount: {
    type: 'NONE' | 'FIXED' | 'PERCENTAGE';
    value: number;
  };
}

export interface ICalculationResult {
  items: Array<{
    productId: string | null;
    type: 'SERVICE' | 'PRODUCT';
    description: string;
    uom: string;
    quantity: number;
    unitPriceMinor: number;
    taxableAmountMinor: number;
    taxes: Array<{
      type: string;
      rateBps: number;
      amountMinor: number;
    }>;
    taxAmountMinor: number;
    lineTotalMinor: number;
    section?: 'ITEM' | 'LABOUR' | 'PART';
  }>;
  totals: {
    subtotalMinor: number;
    discountMinor: number;
    taxableAmountMinor: number;
    taxes: Array<{
      type: string;
      rateBps: number;
      amountMinor: number;
    }>;
    taxTotalMinor: number;
    roundingMinor: number;
    grandTotalMinor: number;
    currency: 'INR';
  };
  amountInWords: string;
}

export class InvoiceCalculationService {
  public static calculate(input: ICalculationInput): ICalculationResult {
    if (!input.items || input.items.length === 0) {
      throw new Error('Invoice must contain at least one item');
    }

    const calculatedItems = [];
    let subtotalMinor = 0;

    // Process line-item levels
    for (const item of input.items) {
      if (!item.quantity || isNaN(item.quantity) || item.quantity <= 0) {
        throw new Error('Quantity must be a positive number greater than zero');
      }
      if (item.unitPriceMinor === undefined || isNaN(item.unitPriceMinor) || item.unitPriceMinor < 0) {
        throw new Error('Unit price must be a non-negative number');
      }

      // Quantity can be decimal (e.g. 2.5) -> round multiplication to integer paise
      const lineSubtotalMinor = Math.round(item.quantity * item.unitPriceMinor);

      let taxableAmountMinor = lineSubtotalMinor;
      let lineTaxAmountMinor = 0;
      let cgstAmountMinor = 0;
      let sgstAmountMinor = 0;
      let lineTotalMinor = lineSubtotalMinor;

      if (input.taxMode === 'EXCLUSIVE') {
        const rateBps = input.defaultTaxRateBps;
        if (rateBps > 0) {
          cgstAmountMinor = Math.round(lineSubtotalMinor * (rateBps / 2) / 10000);
          sgstAmountMinor = Math.round(lineSubtotalMinor * (rateBps / 2) / 10000);
          lineTaxAmountMinor = cgstAmountMinor + sgstAmountMinor;
          lineTotalMinor = lineSubtotalMinor + lineTaxAmountMinor;
        }
      } else if (input.taxMode === 'INCLUSIVE') {
        const rateBps = input.defaultTaxRateBps;
        if (rateBps > 0) {
          // taxableAmount = lineSubtotal / (1 + rateBps / 10000)
          taxableAmountMinor = Math.round(lineSubtotalMinor / (1 + rateBps / 10000));
          lineTaxAmountMinor = lineSubtotalMinor - taxableAmountMinor;

          // Split CGST/SGST equally
          cgstAmountMinor = Math.round(lineTaxAmountMinor / 2);
          sgstAmountMinor = lineTaxAmountMinor - cgstAmountMinor;
        }
      }

      subtotalMinor += lineSubtotalMinor;

      calculatedItems.push({
        productId: item.productId,
        type: item.type,
        description: item.description,
        uom: item.uom,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        taxableAmountMinor,
        taxes: lineTaxAmountMinor > 0 ? [
          { type: 'CGST', rateBps: input.defaultTaxRateBps / 2, amountMinor: cgstAmountMinor },
          { type: 'SGST', rateBps: input.defaultTaxRateBps / 2, amountMinor: sgstAmountMinor }
        ] : [],
        taxAmountMinor: lineTaxAmountMinor,
        lineTotalMinor,
        section: (item as any).section,
      });
    }

    // Invoice-level discounts
    let discountMinor = 0;
    const disc = input.discount || { type: 'NONE', value: 0 };
    if (disc.type === 'PERCENTAGE') {
      if (disc.value < 0 || disc.value > 10000) {
        throw new Error('Percentage discount must be between 0 and 100% (0 - 10000 Bps)');
      }
      discountMinor = Math.round(subtotalMinor * disc.value / 10000);
    } else if (disc.type === 'FIXED') {
      if (disc.value < 0) {
        throw new Error('Fixed discount value must be non-negative');
      }
      discountMinor = Math.min(disc.value, subtotalMinor);
    }

    const taxableAmountMinor = subtotalMinor - discountMinor;

    let taxTotalMinor = 0;
    let cgstAmountMinor = 0;
    let sgstAmountMinor = 0;
    let grandTotalPreRounding = taxableAmountMinor;
    let invoiceTaxableAmountMinor = taxableAmountMinor;

    if (input.taxMode === 'EXCLUSIVE') {
      const rateBps = input.defaultTaxRateBps;
      if (rateBps > 0) {
        cgstAmountMinor = Math.round(taxableAmountMinor * (rateBps / 2) / 10000);
        sgstAmountMinor = Math.round(taxableAmountMinor * (rateBps / 2) / 10000);
        taxTotalMinor = cgstAmountMinor + sgstAmountMinor;
        grandTotalPreRounding = taxableAmountMinor + taxTotalMinor;
      }
    } else if (input.taxMode === 'INCLUSIVE') {
      const rateBps = input.defaultTaxRateBps;
      if (rateBps > 0) {
        const taxableAmountPreTax = Math.round(taxableAmountMinor / (1 + rateBps / 10000));
        taxTotalMinor = taxableAmountMinor - taxableAmountPreTax;
        cgstAmountMinor = Math.round(taxTotalMinor / 2);
        sgstAmountMinor = taxTotalMinor - cgstAmountMinor;
        grandTotalPreRounding = taxableAmountMinor;
        invoiceTaxableAmountMinor = taxableAmountPreTax;
      }
    }

    // Round total to nearest Rupee (nearest 100 minor units)
    const grandTotalMinor = Math.round(grandTotalPreRounding / 100) * 100;
    const roundingMinor = grandTotalMinor - grandTotalPreRounding;

    const amountInWords = convertNumberToWords(Math.round(grandTotalMinor / 100));

    return {
      items: calculatedItems,
      totals: {
        subtotalMinor,
        discountMinor,
        taxableAmountMinor: invoiceTaxableAmountMinor,
        taxes: taxTotalMinor > 0 ? [
          { type: 'CGST', rateBps: input.defaultTaxRateBps / 2, amountMinor: cgstAmountMinor },
          { type: 'SGST', rateBps: input.defaultTaxRateBps / 2, amountMinor: sgstAmountMinor }
        ] : [],
        taxTotalMinor,
        roundingMinor,
        grandTotalMinor,
        currency: 'INR',
      },
      amountInWords,
    };
  }
}
