// How a study budget is split between participants and the platform.
// This mirrors api/src/lib/money.js, so a change here must be made there too.

// HumAIn Labs keeps this share of every study budget to run the platform.
export const PLATFORM_FEE_RATE = 0.2;
export const FEE_PERCENT = Math.round(PLATFORM_FEE_RATE * 100) + "%";

// Money is worked out in pence, so adding rewards never drifts the way decimals do.
const pence = (n) => Math.round(Number(n || 0) * 100);
const pounds = (p) => Math.round(p) / 100;
export const gbp = (n) => "£" + Number(n || 0).toFixed(2);

// Splits a budget into the platform fee, what is left for participants, and what that pays for.
export function feeBreakdown(budget, participantsWanted, rewardEach) {
  const total = pence(budget);
  const fee = Math.round(total * PLATFORM_FEE_RATE);
  const available = total - fee;
  const allocated = pence(rewardEach) * (Number(participantsWanted) || 0);
  return {
    budget: pounds(total),
    fee: pounds(fee),
    available: pounds(available),
    allocated: pounds(allocated),
    // What comes back if the study doesn't fill every place.
    unallocated: pounds(available - allocated),
    overspent: allocated > available,
  };
}
