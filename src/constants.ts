
export interface PNPSalarySchedule {
  y2024: number;
  y2026: number; // 1st Tranche
  y2027: number; // 2nd Tranche
  y2028: number; // 3rd Tranche
}

export interface PNPRank {
  id: string;
  name: string;
  abbreviation: string;
  salaries: PNPSalarySchedule;
}

export const PNP_RANKS: PNPRank[] = [
  { id: 'none', name: 'Select Rank Designation', abbreviation: 'None', salaries: { y2024: 0, y2026: 0, y2027: 0, y2028: 0 } },
  { id: 'pat', name: 'Patrolman / Patrolwoman', abbreviation: 'Pat', salaries: { y2024: 29668, y2026: 31151, y2027: 32634, y2028: 34119 } },
  { id: 'pcpl', name: 'Police Corporal', abbreviation: 'PCpl', salaries: { y2024: 30867, y2026: 32410, y2027: 33953, y2028: 35498 } },
  { id: 'pssg', name: 'Police Staff Sergeant', abbreviation: 'PSSg', salaries: { y2024: 32114, y2026: 33720, y2027: 35325, y2028: 36932 } },
  { id: 'pmsg', name: 'Police Master Sergeant', abbreviation: 'PMSg', salaries: { y2024: 33411, y2026: 35082, y2027: 36752, y2028: 38424 } },
  { id: 'psms', name: 'Police Senior Master Sergeant', abbreviation: 'PSMS', salaries: { y2024: 34761, y2026: 35783, y2027: 37486, y2028: 39192 } },
  { id: 'pcms', name: 'Police Chief Master Sergeant', abbreviation: 'PCMS', salaries: { y2024: 36131, y2026: 36499, y2027: 38236, y2028: 39976 } },
  { id: 'pems', name: 'Police Executive Master Sergeant', abbreviation: 'PEMS', salaries: { y2024: 37556, y2026: 40284, y2027: 42202, y2028: 44122 } },
  { id: 'plt', name: 'Police Lieutenant', abbreviation: 'PLT', salaries: { y2024: 43685, y2026: 52004, y2027: 54479, y2028: 56958 } },
  { id: 'pcpt', name: 'Police Captain', abbreviation: 'PCPT', salaries: { y2024: 48137, y2026: 59411, y2027: 62239, y2028: 65071 } },
  { id: 'pmaj', name: 'Police Major', abbreviation: 'PMAJ', salaries: { y2024: 54711, y2026: 65683, y2027: 68810, y2028: 71941 } },
  { id: 'pltcol', name: 'Police Lieutenant Colonel', abbreviation: 'PLTCOL', salaries: { y2024: 61041, y2026: 74879, y2027: 78443, y2028: 82012 } },
  { id: 'pcol', name: 'Police Colonel', abbreviation: 'PCOL', salaries: { y2024: 71313, y2026: 84612, y2027: 88640, y2028: 92673 } },
  { id: 'pbgen', name: 'Police Brigadier General', abbreviation: 'PBGEN', salaries: { y2024: 79466, y2026: 95611, y2027: 100162, y2028: 104719 } },
  { id: 'pmgen', name: 'Police Major General', abbreviation: 'PMGEN', salaries: { y2024: 88545, y2026: 108041, y2027: 113184, y2028: 118334 } },
  { id: 'pltgen', name: 'Police Lieutenant General', abbreviation: 'PLTGEN', salaries: { y2024: 98660, y2026: 131853, y2027: 138129, y2028: 144414 } },
  { id: 'pgen', name: 'Police General', abbreviation: 'PGEN', salaries: { y2024: 109935, y2026: 157274, y2027: 164760, y2028: 172257 } },
];

export const RETIREMENT_CONSTANTS = {
  MIN_YEARS_VOLUNTARY: 20,
  COMPULSORY_AGE: 56,
  PENSION_MULTIPLIER_PER_YEAR: 0.025,
  MAX_PENSION_PERCENTAGE: 0.90, // 90%
  MAX_SERVICE_YEARS: 40,
  LUMP_SUM_MONTHS: 36,
  LEAVE_DAYS_PER_YEAR: 30,
};
