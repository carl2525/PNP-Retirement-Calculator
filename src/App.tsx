import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  Info, 
  TrendingUp, 
  Wallet, 
  Calendar,
  ShieldCheck,
  User,
  History,
  Download,
  FileText,
  BadgeCheck,
  AlertCircle,
  X
} from 'lucide-react';
import { PNP_RANKS, RETIREMENT_CONSTANTS, type PNPRank } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to calculate date difference in Y, M, D
function dateDiff(start: Date, end: Date) {
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const lastMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += lastMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

export default function App() {
  const [currentRankId, setCurrentRankId] = useState<string>(PNP_RANKS[0].id);
  const [inputMode, setInputMode] = useState<'duration' | 'dates'>('duration');
  
  // Manual Duration State
  const [manualYears, setManualYears] = useState<number | ''>(0);
  const [manualMonths, setManualMonths] = useState<number | ''>(0);
  const [manualRetYear, setManualRetYear] = useState<number>(2026);

  // Date State
  const [birthDate, setBirthDate] = useState<string>('1975-01-01');
  const [entranceDate, setEntranceDate] = useState<string>('2000-01-01');
  const [retirementTargetDate, setRetirementTargetDate] = useState<string>('');
  
  const [retirementType, setRetirementType] = useState<'compulsory' | 'voluntary'>('compulsory');
  const [leaveCredits, setLeaveCredits] = useState<number | ''>(0);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Derived Dates (Auto Mode)
  const compulsoryDate = useMemo(() => {
    const dob = new Date(birthDate);
    if (isNaN(dob.getTime())) return new Date();
    return new Date(dob.getFullYear() + RETIREMENT_CONSTANTS.COMPULSORY_AGE, dob.getMonth(), dob.getDate());
  }, [birthDate]);

  const effectiveRetirementDate = useMemo(() => {
    if (inputMode === 'duration') {
      return new Date(manualRetYear, 0, 1); // Approximate for tranche selection
    }
    if (retirementType === 'compulsory') return compulsoryDate;
    if (retirementTargetDate) return new Date(retirementTargetDate);
    return new Date();
  }, [inputMode, retirementType, compulsoryDate, retirementTargetDate, manualRetYear]);

  const serviceDuration = useMemo(() => {
    if (inputMode === 'duration') {
      return { years: Number(manualYears || 0), months: Number(manualMonths || 0), days: 0 };
    }
    const start = new Date(entranceDate);
    const end = effectiveRetirementDate;
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return { years: 0, months: 0, days: 0 };
    return dateDiff(start, end);
  }, [inputMode, manualYears, manualMonths, entranceDate, effectiveRetirementDate]);

  const maxLeaveCredits = useMemo(() => {
    return Math.max(0, serviceDuration.years * RETIREMENT_CONSTANTS.LEAVE_DAYS_PER_YEAR);
  }, [serviceDuration.years]);

  const currentRank = useMemo(() => 
    PNP_RANKS.find(r => r.id === currentRankId) || PNP_RANKS[0], 
    [currentRankId]
  );

  const nextRank = useMemo(() => {
    const index = PNP_RANKS.findIndex(r => r.id === currentRankId);
    if (index <= 0) return PNP_RANKS[0]; // If "None" selected, next rank is also "None"
    if (index === PNP_RANKS.length - 1) return PNP_RANKS[index];
    return PNP_RANKS[index + 1];
  }, [currentRankId]);

  const calculations = useMemo(() => {
    const retirementYear = manualRetYear;
    const leaveVal = Number(leaveCredits || 0);
    
    // Select correct MBP (Monthly Base Pay) from tranches
    // Baseline is now 2026 as 2024/25 are obsolete
    let tranchePay = nextRank.salaries.y2026;
    
    if (retirementYear >= 2028) tranchePay = nextRank.salaries.y2028;
    else if (retirementYear >= 2027) tranchePay = nextRank.salaries.y2027;
    else tranchePay = nextRank.salaries.y2026;

    const basePayAtRetirement = tranchePay;
    const currentBasePay = nextRank.salaries.y2026; // Current baseline is 2026
    
    // Longevity Pay Schedule (Revised as per user requirement)
    // 1st 5: 10%, 2nd 5: 21%, 3rd 5: 33.1%, 4th 5: 46.4%, 20+: 50%
    let longevityMultiplier = 0;
    const yrs = serviceDuration.years;
    if (yrs > 20) longevityMultiplier = 0.50;
    else if (yrs === 20) longevityMultiplier = 0.464;
    else if (yrs >= 15) longevityMultiplier = 0.331;
    else if (yrs >= 10) longevityMultiplier = 0.21;
    else if (yrs >= 5) longevityMultiplier = 0.10;
    // Note: User's "1st 5 years" likely refers to completion of 1st interval.
    // If they meant Step 1 starts at year 1, usually longevity doesn't apply that early.
    // Keeping standard 5-year interval logic but with user's specific percentages.

    const longevityPay = basePayAtRetirement * longevityMultiplier;
    const totalPensionableBase = basePayAtRetirement + longevityPay;
    
    // Monthly Retirement Pay (MRP): 2.5% per year (including Mo/Day pro-rated)
    const fractionalYears = serviceDuration.years + (serviceDuration.months / 12) + (serviceDuration.days / 365.25);
    const pensionPercentage = Math.min(fractionalYears * 0.025, 0.90);
    
    const monthlyPension = serviceDuration.years >= 20 ? totalPensionableBase * pensionPercentage : 0;
    const lumpSum36Months = monthlyPension * 36;
    
    const terminalLeavePay = totalPensionableBase * Math.min(leaveVal, maxLeaveCredits) * 0.0481927;
    const totalRetirementPackage = lumpSum36Months + terminalLeavePay;

    return {
      retirementYear,
      nextRank,
      basePayAtRetirement,
      currentBasePay,
      longevityPay,
      longevityPercentage: (longevityMultiplier * 100).toFixed(1),
      totalPensionableBase,
      pensionPercentageRaw: pensionPercentage,
      pensionPercentageDisplay: (pensionPercentage * 100).toFixed(2),
      monthlyPension,
      lumpSum36Months,
      terminalLeavePay,
      totalRetirementPackage,
      isQualified: serviceDuration.years >= 20,
      fractionalYears: fractionalYears.toFixed(4)
    };
  }, [inputMode, manualRetYear, nextRank, serviceDuration, leaveCredits, effectiveRetirementDate, maxLeaveCredits]);

  const formatCurrency = (amt: number) => 
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amt);

  // Helper for PDF to avoid symbol encoding issues
  const formatCurrencyPDF = (amt: number) => 
    `PHP ${new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amt)}`;

  const handleGeneratePDF = useCallback(() => {
    const doc = new jsPDF();
    const margin = 20;
    
    // Header
    doc.setFillColor(0, 45, 98); // Refined PNP Blue
    doc.rect(0, 0, 210, 40, 'F');
    
    // Border for certificate feel
    doc.setDrawColor(197, 160, 57); // Gold
    doc.setLineWidth(1.5);
    doc.rect(5, 5, 200, 287);
    doc.setDrawColor(206, 17, 38); // Red accent
    doc.setLineWidth(0.5);
    doc.rect(7, 7, 196, 283);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('PNP RETIREMENT BENEFITS ESTIMATE', margin, 25);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, 32);

    // Watermark/Seal effect (light)
    doc.setTextColor(240, 240, 240);
    doc.setFontSize(60);
    doc.text('PROJECTED', 40, 150, { angle: 45 });

    // Metadata
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('PERSONNEL INFORMATION', margin, 55);
    
    autoTable(doc, {
      startY: 60,
      head: [['Field', 'Value']],
      body: [
        ['Current Rank', `${currentRank.name} (${currentRank.abbreviation})`],
        ['Retirement Rank', `${calculations.nextRank.name} (${calculations.nextRank.abbreviation})`],
        ['Calculation Mode', inputMode === 'duration' ? 'Manual Duration' : 'Date Computation'],
        ['Effective Retirement Date', effectiveRetirementDate.toLocaleDateString()],
        ['Length of Service', `${serviceDuration.years}Y ${serviceDuration.months}M ${serviceDuration.days}D`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [0, 45, 98] },
      alternateRowStyles: { fillColor: [245, 247, 250] }
    });

    // Computation
    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(14);
    doc.setTextColor(206, 17, 38); // PNP Red
    doc.text('FINANCIAL COMPUTATION', margin, finalY + 15);
    
    autoTable(doc, {
      startY: finalY + 20,
      head: [['Description', 'Computation', 'Amount']],
      body: [
        ['Baseline Base Pay (2026)', 'Rank: ' + calculations.nextRank.abbreviation, formatCurrencyPDF(calculations.currentBasePay)],
        ['Projected Base Pay', `Tranche Year: ${calculations.retirementYear}`, formatCurrencyPDF(calculations.basePayAtRetirement)],
        ['Longevity Pay', `${calculations.longevityPercentage}% of Base Pay`, formatCurrencyPDF(calculations.longevityPay)],
        ['Pensionable Base', 'Base Pay + Longevity Pay', formatCurrencyPDF(calculations.totalPensionableBase)],
        ['Monthly Pension (MRP)', `${calculations.pensionPercentageDisplay}% Multiplier`, formatCurrencyPDF(calculations.monthlyPension)],
        ['36-Month Lump Sum', 'Monthly Pension x 36', formatCurrencyPDF(calculations.lumpSum36Months)],
        ['Terminal Leave Pay', `(${formatCurrencyPDF(calculations.totalPensionableBase)} x ${leaveCredits}) x 0.0481927`, formatCurrencyPDF(calculations.terminalLeavePay)],
        ['TOTAL ESTIMATED PACKAGE', 'Sum of Lump Sum + TLP', formatCurrencyPDF(calculations.totalRetirementPackage)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [197, 160, 57], textColor: [0, 0, 0] },
      columnStyles: {
        2: { fontStyle: 'bold', textColor: [0, 45, 98] }
      },
      styles: { cellPadding: 5 }
    });

    // Sub-footer accent
    const finalTableY = (doc as any).lastAutoTable.finalY;
    doc.setFillColor(206, 17, 38);
    doc.rect(margin, finalTableY + 5, 170, 0.5, 'F');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This document is a projected estimate based on RA 6975 and current salary tranches. Not an official certification.', margin, Math.min(285, finalTableY + 20));

    doc.save(`PRBS_Estimate_${currentRank.abbreviation}.pdf`);
  }, [calculations, currentRank, inputMode, effectiveRetirementDate, serviceDuration, leaveCredits]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Skip to content for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-pnp-blue text-white p-4 z-[100] font-bold">
        Skip to content
      </a>

      {/* Top Navigation Header */}
      <header className="h-20 bg-pnp-blue text-white flex items-center justify-between px-4 md:px-10 border-b-4 border-pnp-gold shadow-md flex-shrink-0 relative z-50">
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-pnp-red opacity-50"></div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center p-1 shadow-inner relative ring-2 ring-pnp-gold/30">
            <div className="w-full h-full border-2 border-pnp-blue rounded-full bg-slate-50 flex items-center justify-center">
              <div className="w-4 h-4 bg-pnp-gold rotate-45 shadow-[0_0_8px_rgba(197,160,57,0.5)]"></div>
              <div className="w-1 h-3 bg-pnp-red absolute opacity-80 rotate-90"></div>
            </div>
          </div>
          <div>
            <h1 className="text-base md:text-xl font-black tracking-tight uppercase leading-none text-white">PNP Benefits Calculator</h1>
            <p className="text-[8px] md:text-[10px] text-pnp-gold uppercase tracking-[0.1em] md:tracking-[0.2em] font-bold mt-1">Personnel Retirement Service</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-[10px] font-black uppercase tracking-widest bg-white/10 px-4 py-2 rounded border border-white/20">
          <ShieldCheck className="w-4 h-4 text-pnp-gold" />
          <span className="text-pnp-gold">Official Projection Unit</span>
        </div>
      </header>

      {/* Main Layout Content */}
      <main id="main-content" className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
        
        {/* Input Section (Left) */}
        <div className="flex flex-col gap-6 md:gap-8">
          <div className="theme-card">
            <h2 className="text-lg font-black text-pnp-blue mb-6 flex items-center gap-2 uppercase italic tracking-tight">
              <span className="w-1 h-6 bg-pnp-gold rounded-full"></span>
              <span className="w-1 h-4 bg-pnp-red rounded-full -ml-1"></span>
              Service Parameters
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-1">
                <label className="theme-label">Current Rank Designation</label>
                <select 
                  value={currentRankId}
                  onChange={(e) => setCurrentRankId(e.target.value)}
                  className="theme-input text-sm md:text-base cursor-pointer hover:border-pnp-blue transition-colors"
                >
                  {PNP_RANKS.map((rank) => (
                    <option key={rank.id} value={rank.id}>
                      {rank.name} ({rank.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="theme-label">Projected Base Pay (Tranche)</label>
                <div className="flex flex-col gap-1 relative">
                  <input 
                    type="text" 
                    readOnly
                    value={formatCurrency(calculations.basePayAtRetirement)}
                    className="theme-input bg-slate-900/5 text-pnp-blue font-mono font-black border-pnp-blue/20 cursor-default"
                  />
                  <div className="absolute right-3 top-5 w-1.5 h-1.5 bg-pnp-red rounded-full"></div>
                  <div className="flex justify-between px-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Baseline (2026): <span className="text-slate-900">{formatCurrency(calculations.currentBasePay)}</span></span>
                    <span className="text-[9px] font-bold text-pnp-blue uppercase tracking-tighter">Effective Tranche: {calculations.retirementYear}</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-slate-100 p-1">
                <button 
                  onClick={() => setInputMode('duration')}
                  aria-pressed={inputMode === 'duration'}
                  aria-label="Set input mode to Manual Duration"
                  className={cn(
                    "py-2 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                    inputMode === 'duration' ? "bg-pnp-blue text-white shadow" : "text-slate-500 hover:bg-slate-200"
                  )}
                >
                  Quick Input (Years/Months)
                </button>
                <button 
                  onClick={() => setInputMode('dates')}
                  aria-pressed={inputMode === 'dates'}
                  aria-label="Set input mode to Exact Date Computation"
                  className={cn(
                    "py-2 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                    inputMode === 'dates' ? "bg-pnp-blue text-white shadow" : "text-slate-500 hover:bg-slate-200"
                  )}
                >
                  Exact Date Computation
                </button>
              </div>

              {inputMode === 'duration' ? (
                <>
                  <div className="space-y-1">
                    <label className="theme-label">Years in Service</label>
                    <input 
                      type="number"
                      value={manualYears}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setManualYears(val === '' ? '' : Math.max(0, parseInt(val) || 0));
                      }}
                      className="theme-input font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="theme-label">Months in Service</label>
                    <input 
                      type="number"
                      value={manualMonths}
                      max="11"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setManualMonths(val === '' ? '' : Math.min(11, Math.max(0, parseInt(val) || 0)));
                      }}
                      className="theme-input font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="theme-label">Retirement Year (For Tranche)</label>
                    <select 
                      value={manualRetYear}
                      onChange={(e) => setManualRetYear(parseInt(e.target.value))}
                      className="theme-input cursor-pointer"
                    >
                      {[2026, 2027, 2028].filter(y => y >= 2026).map(y => (
                        <option key={y} value={y}>
                          FY {y} {y === 2026 ? '(Current Tranche)' : 'Schedule'}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="theme-label">Date of Birth</label>
                    <input 
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="theme-input cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="theme-label">Date of Entrance (Entry)</label>
                    <input 
                      type="date"
                      value={entranceDate}
                      onChange={(e) => setEntranceDate(e.target.value)}
                      className="theme-input cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2 md:col-span-1">
                    <label className="theme-label">Projected Tranche Year</label>
                    <select 
                      value={manualRetYear}
                      onChange={(e) => setManualRetYear(parseInt(e.target.value))}
                      className="theme-input text-xs cursor-pointer"
                    >
                      {[2026, 2027, 2028].map(y => (
                        <option key={y} value={y}>FY {y} Schedule</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="theme-label">Retirement Framework</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setRetirementType('compulsory');
                      setRetirementTargetDate('');
                    }}
                    aria-pressed={retirementType === 'compulsory'}
                    aria-label="Selection: Compulsory Retirement"
                    className={cn(
                      "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer",
                      retirementType === 'compulsory' ? "bg-pnp-blue text-white border-pnp-blue shadow-lg" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    Compulsory
                  </button>
                  <button 
                    onClick={() => {
                      setRetirementType('voluntary');
                      if (inputMode === 'duration' && !retirementTargetDate) {
                        setRetirementTargetDate(new Date(manualRetYear, 0, 1).toISOString().split('T')[0]);
                      }
                    }}
                    aria-pressed={retirementType === 'voluntary'}
                    aria-label="Selection: Voluntary Retirement"
                    className={cn(
                      "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer",
                      retirementType === 'voluntary' ? "bg-pnp-blue text-white border-pnp-blue shadow-lg" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    Voluntary
                  </button>
                </div>
              </div>

              {retirementType === 'voluntary' && inputMode === 'dates' && (
                <div className="space-y-1 transition-all md:col-span-2">
                  <label className="theme-label">Target Retirement Date</label>
                  <input 
                    type="date"
                    value={retirementTargetDate}
                    onChange={(e) => setRetirementTargetDate(e.target.value)}
                    className="theme-input cursor-pointer"
                  />
                </div>
              )}

              <div className="space-y-1 md:col-span-2">
                <label className="theme-label">Accrued Leave Credits (Days)</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={leaveCredits}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLeaveCredits(val === '' ? '' : Math.min(maxLeaveCredits, Math.max(0, parseInt(val) || 0)));
                    }}
                    className="theme-input pr-24 font-mono font-bold"
                    placeholder="e.g. 300"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">MAX: {maxLeaveCredits} DAYS</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border-t-4 border-slate-300 p-8 shadow-sm flex-1 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-pnp-blue/5 rounded-bl-full -mr-10 -mt-10"></div>
            <h2 className="text-lg font-black text-slate-800 mb-6 uppercase italic flex items-center gap-2 relative z-10">
              <BadgeCheck className="w-5 h-5 text-pnp-gold" />
              Service Status Report
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-2 md:p-4 border-b-2 border-slate-200 rounded text-center shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-pnp-red/30"></div>
                  <div className="text-xl md:text-2xl font-black text-pnp-blue">{serviceDuration.years}</div>
                  <div className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase">Years</div>
                </div>
                <div className="bg-white p-2 md:p-4 border-b-2 border-slate-200 rounded text-center shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-pnp-blue/20"></div>
                  <div className="text-xl md:text-2xl font-black text-pnp-blue">{serviceDuration.months}</div>
                  <div className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase">Months</div>
                </div>
                <div className="bg-white p-2 md:p-4 border-b-2 border-slate-200 rounded text-center shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-pnp-gold/40"></div>
                  <div className="text-xl md:text-2xl font-black text-pnp-blue">{serviceDuration.days}</div>
                  <div className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase">Days</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-pnp-blue text-white rounded shadow-[0_10px_20px_-10px_rgba(0,45,98,0.5)] overflow-hidden relative gap-4 border-b-2 border-pnp-gold">
                <div className="absolute right-0 top-0 opacity-10"><Calendar className="w-20 h-20 -mr-4 -mt-4 text-pnp-gold" /></div>
                <div className="text-center sm:text-left">
                  <p className="text-[9px] md:text-[10px] font-bold text-pnp-gold uppercase tracking-widest">Effective Retirement Date</p>
                  <p className="text-lg md:text-xl font-bold">{effectiveRetirementDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-[9px] md:text-[10px] font-black text-pnp-gold uppercase tracking-widest leading-none mb-1">Retirement Year</p>
                  <p className="text-lg md:text-xl font-bold font-mono text-white leading-none">FY {calculations.retirementYear}</p>
                </div>
              </div>

              <div className="p-4 bg-[#E8F0F8] border-l-4 border-pnp-red rounded-r">
                <p className="text-[10px] md:text-[11px] text-slate-900 leading-relaxed font-medium">
                  <span className="font-black flex items-center gap-1 mb-1 text-pnp-blue uppercase tracking-wider text-[9px]"><Info className="w-3 h-3 text-pnp-red" /> National Policy:</span>
                  The Projected Base Pay is automatically selected for <strong className="text-pnp-blue font-black underline decoration-pnp-gold decoration-2">Tranche {calculations.retirementYear}</strong> as mandated by salary schedule adjustments.
                </p>
              </div>

              {/* Readiness & Timeline - Moved here to balance UI */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Readiness Checklist */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded shadow-sm">
                    <h5 className="text-[9px] font-black text-pnp-blue uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                      <BadgeCheck className="w-3 h-3 text-emerald-600" />
                      Pre-Retirement Checklist
                    </h5>
                    <ul className="space-y-2">
                      {[
                        { item: 'Updated Service Record', done: true },
                        { item: 'Unit Clearance Completed', done: false },
                        { item: 'SALN Validation (Last 3 Yrs)', done: false },
                        { item: 'DLOD/Legal Clearance', done: false }
                      ].map((check, i) => (
                        <li key={i} className="flex items-center gap-2 text-[10px] text-slate-600">
                          <div className={cn("w-1.5 h-1.5 rounded-full", check.done ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-slate-300")}></div>
                          {check.item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Procedural Path */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded shadow-sm">
                    <h5 className="text-[9px] font-black text-pnp-blue uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                      <History className="w-3 h-3 text-pnp-red" />
                      Processing Timeline
                    </h5>
                    <div className="space-y-3 relative">
                      <div className="absolute left-[3px] top-1 bottom-1 w-[1px] bg-slate-200"></div>
                      {[
                        { step: 'Letter of Intent', time: '6 Mos Prior' },
                        { step: 'Data Reconstruction', time: '4 Mos Prior' },
                        { step: 'Final Audit/Approval', time: '1 Mo Prior' }
                      ].map((path, i) => (
                        <div key={i} className="relative pl-4">
                          <div className="absolute left-0 top-1.5 w-1.5 h-1.5 bg-pnp-gold rounded-full ring-4 ring-slate-50"></div>
                          <p className="text-[10px] text-slate-900 font-bold leading-none">{path.step}</p>
                          <p className="text-[8px] text-slate-400 mt-1 uppercase font-black tracking-tighter">{path.time}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Disclaimer Mini-Panel */}
                <div className="p-3 bg-pnp-gold/10 rounded border border-pnp-gold/20 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-pnp-red flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[9px] text-slate-700 leading-relaxed italic">
                      <span className="font-black text-pnp-blue">OFFICIAL NOTICE:</span> These figures are projections based on current salary tranches and subject to final audit by PRBS.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section (Right) */}
        <div className="flex flex-col gap-8 lg:sticky lg:top-8">
          <AnimatePresence mode="wait">
            <motion.div 
              key={`${currentRankId}-${serviceDuration.years}-${calculations.retirementYear}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="contents"
            >
              <div className="bg-pnp-blue text-white p-6 md:p-10 shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[250px] md:min-h-[300px] rounded-t-xl">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-pnp-gold/10 rounded-full blur-3xl"></div>
                <div className="absolute left-6 top-6">
                  <ShieldCheck className="w-8 h-8 text-pnp-gold/20" />
                </div>
                <div className="relative z-10">
                  <p className="text-[9px] md:text-[10px] text-white font-black uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                    <span className="w-8 h-[1px] bg-pnp-red"></span>
                    Estimated Monthly Pension (MRP)
                  </p>
                  
                  {calculations.isQualified ? (
                    <h3 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-light tracking-tighter mb-8 md:mb-10 tabular-nums break-words leading-none text-white">
                      {formatCurrency(calculations.monthlyPension).split('.')[0]}
                      <span className="text-lg md:text-2xl lg:text-3xl opacity-70">.{formatCurrency(calculations.monthlyPension).split('.')[1]}</span>
                    </h3>
                  ) : (
                    <div className="mb-8 md:mb-10 p-5 bg-white shadow-xl rounded-lg border-l-4 border-pnp-red relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-2 h-full bg-pnp-red/10"></div>
                      <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase italic leading-tight flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-pnp-red" />
                        Accrued Leave Eligibility Only
                      </h3>
                      <p className="text-[10px] md:text-xs text-slate-600 mt-2 font-bold leading-relaxed">
                        Personnel with less than 20 years of active service are ineligible for Monthly Retirement Pay (MRP). 
                        Official benefits are limited to <span className="text-pnp-red font-black">Terminal Leave Pay (TLP)</span>.
                      </p>
                      <div className="mt-4 p-3 bg-pnp-blue/5 border border-pnp-blue/10 rounded flex items-start gap-2">
                        <BadgeCheck className="w-4 h-4 text-pnp-blue flex-shrink-0 mt-0.5" />
                        <p className="text-[9px] font-black text-pnp-blue uppercase tracking-tight">ACTION REQUIRED: Ensure Accrued Leave Credits are accurately entered below for calculation.</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-white p-4 md:p-6 mb-8 border-b-4 border-pnp-gold shadow-2xl rounded-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-2 h-full bg-pnp-red/10"></div>
                    <p className="text-[8px] md:text-[10px] text-pnp-blue font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3 text-pnp-red" />
                      Total Estimated Benefits Package
                    </p>
                    <div className="flex items-baseline gap-2">
                       <h4 className="text-2xl md:text-4xl lg:text-5xl font-black text-slate-900 tabular-nums tracking-tighter">
                        {formatCurrency(calculations.totalRetirementPackage)}
                       </h4>
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold mt-2 italic flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {calculations.isQualified 
                        ? "Sum of 36-Month Lump Sum & Accrued Leave Credits" 
                        : "Total based on Accrued Leave Credits (TLP) Only"}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10 border-t border-white/20 pt-6 md:pt-8 opacity-80 mb-10">
                    <div>
                      <p className="text-[8px] md:text-[10px] text-pnp-gold uppercase mb-1 md:2 font-black tracking-widest">Calculation Bench</p>
                      <p className="text-lg md:text-xl font-bold italic tracking-tight text-white">{calculations.nextRank.name}</p>
                    </div>
                    <div>
                      <p className="text-[8px] md:text-[10px] text-pnp-gold uppercase mb-1 md:2 font-black tracking-widest">Pension Multiplier</p>
                      <p className="text-lg md:text-xl font-bold tracking-tight text-white">{calculations.pensionPercentageDisplay}% Rate</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-pnp-gold p-6 md:p-10 shadow-xl flex-1 flex flex-col justify-between rounded-b-xl border-t border-black/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pnp-red/5 -mr-16 -mt-16 rotate-45 border-b-4 border-pnp-red/10"></div>
                <div className="space-y-6 relative z-10">
                  <div>
                    <h4 className="text-slate-900 font-black text-xl md:text-2xl uppercase italic mb-1 tracking-tighter flex items-center gap-2">
                      <Wallet className="w-5 h-5 md:w-6 md:h-6 text-pnp-blue" />
                      36-Month Lump Sum
                    </h4>
                    <p className="text-pnp-blue/80 text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] leading-tight flex items-center gap-2">
                      <span className="w-2 h-[2px] bg-pnp-red"></span>
                      Projected Advance Payment
                    </p>
                    <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-slate-950 tracking-tighter tabular-nums break-words drop-shadow-sm">
                      {formatCurrency(calculations.lumpSum36Months)}
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-black/10 pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 md:w-8 md:h-8 bg-pnp-blue text-pnp-gold rounded flex items-center justify-center text-[8px] md:text-[10px] font-black shadow-sm">TLP</div>
                        <div>
                          <p className="theme-label mb-0 text-pnp-blue text-[10px] md:text-xs">Terminal Leave Pay</p>
                          <p className="text-[8px] md:text-[10px] font-black text-slate-700 uppercase tracking-widest">{leaveCredits} Days Commuted</p>
                        </div>
                      </div>
                      <p className="text-lg md:text-xl font-black text-slate-900 font-mono">{formatCurrency(calculations.terminalLeavePay)}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 md:w-8 md:h-8 bg-pnp-blue text-pnp-gold rounded flex items-center justify-center text-[8px] md:text-[10px] font-black shadow-sm">LP</div>
                        <div>
                          <p className="theme-label mb-0 text-pnp-blue text-[10px] md:text-xs">Longevity Component</p>
                          <p className="text-[8px] md:text-[10px] font-black text-slate-700 uppercase tracking-widest">{calculations.longevityPercentage}% Incentive</p>
                        </div>
                      </div>
                      <p className="text-lg md:text-xl font-black text-slate-900 font-mono">{formatCurrency(calculations.longevityPay)}</p>
                    </div>
                  </div>

                  <div className="bg-white/40 backdrop-blur-sm p-4 border border-black/5 rounded flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-pnp-red" />
                    <div>
                      <p className="text-[10px] font-black text-pnp-blue uppercase tracking-widest leading-none">Pensionable Base (Rank + Long)</p>
                      <p className="text-xl font-black text-slate-950 font-mono italic">{formatCurrency(calculations.totalPensionableBase)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3 mt-8">
                  <button 
                    onClick={handleGeneratePDF}
                    aria-label="Download Official Benefits Estimate as PDF"
                    className="w-full bg-pnp-blue text-white py-4 md:py-5 font-black text-[10px] md:text-xs tracking-[0.15em] md:tracking-[0.3em] uppercase hover:bg-pnp-red hover:shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] border-b-4 border-pnp-gold cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-pnp-gold" aria-hidden="true" />
                    Generate Certification (PDF)
                  </button>

                  <button 
                    onClick={() => setShowBreakdown(true)}
                    aria-label="View Detailed calculation breakdown"
                    className="w-full bg-white border-2 border-pnp-blue text-pnp-blue py-3 md:py-4 font-black text-[9px] md:text-[10px] tracking-[0.1em] md:tracking-[0.2em] uppercase hover:bg-pnp-blue hover:text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                  >
                    <FileText className="w-3 h-3" aria-hidden="true" />
                    Detailed Breakdown
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Detailed Breakdown Modal */}
      <AnimatePresence>
        {showBreakdown && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-2xl h-[90vh] shadow-2xl overflow-hidden flex flex-col m-2 md:m-4 rounded-lg md:rounded-xl"
            >
              <div className="bg-pnp-blue p-4 md:p-6 text-white flex justify-between items-center border-b-2 md:border-b-4 border-pnp-gold relative overflow-hidden flex-shrink-0">
                <div className="absolute top-0 right-0 w-16 md:w-24 h-[1px] md:h-[2px] bg-pnp-red"></div>
                <h3 className="text-base md:text-xl font-black uppercase italic tracking-wider flex items-center gap-2 md:gap-3">
                  <FileText className="text-pnp-gold w-4 h-4 md:w-6 md:h-6" />
                  Calculation Breakdown
                </h3>
                <button 
                  onClick={() => setShowBreakdown(false)}
                  aria-label="Close Breakdown"
                  className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" aria-hidden="true" />
                </button>
              </div>

              <div className="p-4 md:p-8 space-y-4 md:space-y-6 flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div className="p-3 md:p-4 bg-white border-l-4 border-slate-400 italic shadow-sm rounded-r">
                    <p className="text-[8px] md:text-[10px] font-black text-slate-600 uppercase mb-1">Baseline Base (2026)</p>
                    <p className="text-base md:text-lg lg:text-xl font-black text-slate-900 leading-none tabular-nums tracking-tighter">{formatCurrency(calculations.currentBasePay)}</p>
                  </div>
                  <div className="p-3 md:p-4 bg-white border-l-4 border-pnp-blue italic shadow-sm rounded-r">
                    <p className="text-[8px] md:text-[10px] font-black text-pnp-blue uppercase mb-1">Projected Base ({calculations.retirementYear})</p>
                    <p className="text-base md:text-lg lg:text-xl font-black text-pnp-blue leading-none tabular-nums tracking-tighter">{formatCurrency(calculations.basePayAtRetirement)}</p>
                  </div>
                </div>

                <div className="bg-pnp-blue text-white p-4 md:p-6 rounded-lg shadow-lg border-b-2 md:border-b-4 border-pnp-gold relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-pnp-red/10 -mr-12 -mt-12 md:-mr-16 md:-mt-16 rotate-45"></div>
                  <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-pnp-gold mb-1 md:2 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 md:w-4 md:h-4" />
                    Total Combined Benefits
                  </p>
                  <p className="text-2xl md:text-5xl font-black tabular-nums tracking-tighter leading-none">{formatCurrency(calculations.totalRetirementPackage)}</p>
                  <p className="text-[8px] md:text-[10px] mt-1.5 md:2 opacity-70 italic font-medium">Sum of 36-Month Lump Sum ({formatCurrency(calculations.lumpSum36Months)}) + TLP</p>
                </div>

                {/* Breakdown List (Desktop Table / Mobile Stack) */}
                <div className="space-y-3 md:space-y-4">
                   <h4 className="text-[9px] md:text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-200 pb-2">Computation Log</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {[
                      { label: 'Longevity Pay', logic: `${serviceDuration.years}Y Service`, amount: calculations.longevityPay, sub: `${calculations.longevityPercentage}% Incentive` },
                      { label: 'Pensionable Base', logic: 'Rank Pay + Long Pay', amount: calculations.totalPensionableBase, highlight: true },
                      { label: '36-Month Lump Sum', logic: 'MRP x 36 Months', amount: calculations.lumpSum36Months },
                      { label: 'Terminal Leave Pay', logic: `${leaveCredits} Credits x Ratio`, amount: calculations.terminalLeavePay, gold: true },
                      { label: 'Monthly Pension (MRP)', logic: `${calculations.isQualified ? calculations.pensionPercentageDisplay + '%' : '0%'} Mult`, amount: calculations.monthlyPension, red: true, fullWidth: true },
                    ].map((item, idx) => (
                      <div key={idx} className={cn(
                        "p-3 md:p-4 border border-slate-200 relative group transition-all hover:bg-white bg-white shadow-sm rounded",
                        item.highlight && "bg-pnp-blue/[0.03] border-l-4 border-l-pnp-blue",
                        item.gold && "bg-pnp-gold/[0.03] border-l-4 border-l-pnp-gold",
                        item.fullWidth && "md:col-span-2 border-slate-300 shadow-md bg-slate-50/50"
                      )}>
                        <p className={cn("text-[8px] md:text-[9px] font-black uppercase tracking-widest mb-1", item.red ? "text-pnp-red" : "text-slate-600")}>
                          {item.label}
                        </p>
                        <div className="flex justify-between items-center md:items-end gap-2 text-right">
                          <p className="text-[8px] md:text-[10px] text-slate-600 font-bold italic whitespace-nowrap overflow-hidden text-ellipsis">{item.logic}</p>
                          <p className={cn("text-base md:text-lg font-black font-mono shrink-0", item.red ? "text-pnp-red" : "text-slate-950", item.fullWidth && "text-xl md:text-3xl")}>
                            {formatCurrency(item.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 md:p-4 bg-white border border-slate-200 border-l-4 border-l-pnp-red rounded shadow-sm">
                  <p className="text-[11px] font-black text-pnp-blue flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-pnp-red" />
                    SALARY TRUNCATION & POLICY NOTES
                  </p>
                  <ul className="text-[10px] space-y-2 text-slate-700 list-none pl-0 font-bold">
                    <li className="flex gap-2"><span className="text-pnp-red">●</span> Rank adjustment applied: One rank higher than {currentRank.abbreviation} ({nextRank.abbreviation})</li>
                    <li className="flex gap-2"><span className="text-pnp-red">●</span> Salary Schedule: Automatic projection for FY {calculations.retirementYear} based on EO Tranches.</li>
                    <li className="flex gap-2"><span className="text-pnp-red">●</span> Longevity Pay Logic: 5yr(10%), 10yr(21%), 15yr(33.1%), 20yr(46.4%), Over 20(50%)</li>
                  </ul>
                </div>
              </div>
              
              <div className="p-6 bg-slate-900 border-t border-pnp-red flex-shrink-0">
                <button 
                  onClick={() => setShowBreakdown(false)}
                  className="w-full py-4 bg-pnp-blue text-white font-black uppercase text-[10px] tracking-[0.2em] hover:bg-pnp-red transition-all cursor-pointer shadow-lg active:scale-95"
                >
                  Confirm & Return to Desk
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Bar */}
      <footer className="bg-slate-900 border-t-4 border-pnp-red flex flex-col md:flex-row items-center justify-between px-6 lg:px-10 py-6 md:py-8 lg:h-20 flex-shrink-0 gap-6 md:gap-4">
        <div className="flex items-center gap-4 text-[9px] md:text-[10px] font-black text-pnp-gold uppercase tracking-widest leading-none">
          <span className="text-white">Ver 5.0.4 Ultra</span>
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
          <span className="opacity-80">High Precision Engine</span>
        </div>
        <div className="text-[8px] md:text-[9px] font-black text-white/60 uppercase tracking-widest text-center md:text-right max-w-xs md:max-w-none leading-relaxed">
          © {new Date().getFullYear()} Philippine National Police <span className="text-pnp-gold mx-2">•</span> Pension & Retirement Benefits Administration
        </div>
      </footer>
    </div>
  );
}
