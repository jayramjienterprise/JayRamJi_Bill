import { IAmcContract } from '../database/models/AmcContract';
import { AmcServiceVisit } from '../database/models/AmcServiceVisit';

export interface PartCoverageResult {
  isCovered: boolean;
  coveredQuantity: number;
  chargeableQuantity: number;
  unitPrice: number;
  customerCharge: number;
  reason: string;
}

export interface GasCoverageResult {
  isCovered: boolean;
  coveredKg: number;
  chargeableKg: number;
  customerCharge: number;
  reason: string;
}

export class AmcCoverageEngine {
  /**
   * Evaluates spare part coverage against the contract's immutable planSnapshot
   */
  public static async evaluatePartCoverage(
    contract: IAmcContract,
    productId: string,
    quantityRequested: number,
    unitSellingPrice: number
  ): Promise<PartCoverageResult> {
    const snapshot = contract.planSnapshot;

    // 1. If Non-Comprehensive AMC: all spare parts are chargeable
    if (contract.contractType === 'NON_COMPREHENSIVE' || snapshot.planType === 'NON_COMPREHENSIVE') {
      return {
        isCovered: false,
        coveredQuantity: 0,
        chargeableQuantity: quantityRequested,
        unitPrice: unitSellingPrice,
        customerCharge: unitSellingPrice * quantityRequested,
        reason: 'Non-Comprehensive AMC covers labour only; spare parts are chargeable.',
      };
    }

    // 2. Comprehensive AMC: Look up specific product in planSnapshot
    const partRule = snapshot.partCoverages?.find(
      (p) => p.productId.toString() === productId.toString()
    );

    if (!partRule) {
      return {
        isCovered: false,
        coveredQuantity: 0,
        chargeableQuantity: quantityRequested,
        unitPrice: unitSellingPrice,
        customerCharge: unitSellingPrice * quantityRequested,
        reason: 'Spare part is not included in the Comprehensive AMC coverage schedule.',
      };
    }

    if (partRule.coverageType === 'NOT_COVERED') {
      return {
        isCovered: false,
        coveredQuantity: 0,
        chargeableQuantity: quantityRequested,
        unitPrice: unitSellingPrice,
        customerCharge: unitSellingPrice * quantityRequested,
        reason: 'Part is explicitly excluded under contract terms.',
      };
    }

    if (partRule.coverageType === 'DISCOUNTED') {
      const discount = partRule.discountPercent || 0;
      const discountedUnit = unitSellingPrice * (1 - discount / 100);
      return {
        isCovered: false,
        coveredQuantity: 0,
        chargeableQuantity: quantityRequested,
        unitPrice: discountedUnit,
        customerCharge: discountedUnit * quantityRequested,
        reason: `Part is covered with a ${discount}% AMC discount.`,
      };
    }

    // 3. FULL Coverage: Check annual quota limit
    if (partRule.quantityLimitPerYear && partRule.quantityLimitPerYear > 0) {
      // Aggregate completed visits to compute authoritative consumed count
      const completedVisits = await AmcServiceVisit.find({
        contractId: contract._id,
        status: 'COMPLETED',
        active: true,
      });

      let alreadyConsumed = 0;
      for (const v of completedVisits) {
        for (const item of v.sparesUsed) {
          if (item.productId.toString() === productId.toString() && item.isCoveredByAmc) {
            alreadyConsumed += item.quantity;
          }
        }
      }

      const remainingAllowed = Math.max(0, partRule.quantityLimitPerYear - alreadyConsumed);

      if (remainingAllowed >= quantityRequested) {
        return {
          isCovered: true,
          coveredQuantity: quantityRequested,
          chargeableQuantity: 0,
          unitPrice: unitSellingPrice,
          customerCharge: 0,
          reason: `Covered under Comprehensive AMC (${alreadyConsumed + quantityRequested}/${partRule.quantityLimitPerYear} annual quota used).`,
        };
      } else if (remainingAllowed > 0) {
        const coveredQty = remainingAllowed;
        const chargeableQty = quantityRequested - remainingAllowed;
        return {
          isCovered: false,
          coveredQuantity: coveredQty,
          chargeableQuantity: chargeableQty,
          unitPrice: unitSellingPrice,
          customerCharge: chargeableQty * unitSellingPrice,
          reason: `Annual limit partially exceeded. ${coveredQty} free, ${chargeableQty} chargeable at standard price.`,
        };
      } else {
        return {
          isCovered: false,
          coveredQuantity: 0,
          chargeableQuantity: quantityRequested,
          unitPrice: unitSellingPrice,
          customerCharge: quantityRequested * unitSellingPrice,
          reason: `Annual limit of ${partRule.quantityLimitPerYear} units reached under contract. Additional units are chargeable.`,
        };
      }
    }

    // Unlimited full coverage
    return {
      isCovered: true,
      coveredQuantity: quantityRequested,
      chargeableQuantity: 0,
      unitPrice: unitSellingPrice,
      customerCharge: 0,
      reason: 'Covered under Comprehensive AMC.',
    };
  }

  /**
   * Evaluates refrigerant gas coverage against the contract's immutable planSnapshot
   */
  public static async evaluateGasCoverage(
    contract: IAmcContract,
    refrigerantType: string,
    kgRequested: number,
    isPipingDamage: boolean,
    unitGasPricePerKg: number
  ): Promise<GasCoverageResult> {
    const gasRule = contract.planSnapshot.gasCoverage;

    if (!gasRule || !gasRule.included) {
      return {
        isCovered: false,
        coveredKg: 0,
        chargeableKg: kgRequested,
        customerCharge: kgRequested * unitGasPricePerKg,
        reason: 'Refrigerant gas charging is not included in this AMC contract.',
      };
    }

    if (isPipingDamage && gasRule.excludeDamagePipingLeaks) {
      return {
        isCovered: false,
        coveredKg: 0,
        chargeableKg: kgRequested,
        customerCharge: kgRequested * unitGasPricePerKg,
        reason: 'Gas leakage caused by damaged external piping or physical trauma is excluded from warranty.',
      };
    }

    if (
      gasRule.refrigerantTypes &&
      gasRule.refrigerantTypes.length > 0 &&
      !gasRule.refrigerantTypes.includes(refrigerantType)
    ) {
      return {
        isCovered: false,
        coveredKg: 0,
        chargeableKg: kgRequested,
        customerCharge: kgRequested * unitGasPricePerKg,
        reason: `Refrigerant type ${refrigerantType} is not covered under this agreement.`,
      };
    }

    if (gasRule.quantityLimitKg && gasRule.quantityLimitKg > 0) {
      const completedVisits = await AmcServiceVisit.find({
        contractId: contract._id,
        status: 'COMPLETED',
        active: true,
      });

      let alreadyConsumedKg = 0;
      for (const v of completedVisits) {
        if (v.gasCoveredByAmc && v.gasRefilledKg) {
          alreadyConsumedKg += v.gasRefilledKg;
        }
      }

      const remainingKg = Math.max(0, gasRule.quantityLimitKg - alreadyConsumedKg);

      if (remainingKg >= kgRequested) {
        return {
          isCovered: true,
          coveredKg: kgRequested,
          chargeableKg: 0,
          customerCharge: 0,
          reason: `Refrigerant gas covered (${alreadyConsumedKg + kgRequested}/${gasRule.quantityLimitKg} kg annual limit used).`,
        };
      } else if (remainingKg > 0) {
        const chargeableKg = kgRequested - remainingKg;
        return {
          isCovered: false,
          coveredKg: remainingKg,
          chargeableKg,
          customerCharge: chargeableKg * unitGasPricePerKg,
          reason: `Gas limit partially reached. ${remainingKg} kg free, ${chargeableKg} kg chargeable.`,
        };
      } else {
        return {
          isCovered: false,
          coveredKg: 0,
          chargeableKg: kgRequested,
          customerCharge: kgRequested * unitGasPricePerKg,
          reason: `Annual gas quota limit of ${gasRule.quantityLimitKg} kg exceeded under this contract.`,
        };
      }
    }

    return {
      isCovered: true,
      coveredKg: kgRequested,
      chargeableKg: 0,
      customerCharge: 0,
      reason: 'Refrigerant gas covered under contract.',
    };
  }
}

export default AmcCoverageEngine;
