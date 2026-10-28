export type InterestMethod = "FLAT" | "REDUCING_BALANCE" | "AMORTIZED";

export interface LoanCalculationInput {
  principal: number;
  annualInterestRate: number;
  interestMethod: InterestMethod;
  durationMonths: number;
  processingFee?: number;
  insuranceFee?: number;
}

export interface LoanCalculationResult {
  principal: number;
  totalInterest: number;
  totalRepayment: number;
  monthlyPayment: number;
  processingFee: number;
  insuranceFee: number;
  totalUpfrontFees: number;
  schedule: ScheduleEntry[];
}

export interface ScheduleEntry {
  month: number;
  openingBalance: number;
  principalPayment: number;
  interestPayment: number;
  totalPayment: number;
  closingBalance: number;
}

export class LoanCalculationService {
  static calculate(input: LoanCalculationInput): LoanCalculationResult {
    const {
      principal,
      annualInterestRate,
      interestMethod,
      durationMonths,
      processingFee = 0,
      insuranceFee = 0,
    } = input;

    const monthlyRate = annualInterestRate / 100 / 12;

    let totalInterest: number;
    let schedule: ScheduleEntry[];

    switch (interestMethod) {
      case "FLAT":
        totalInterest = principal * (annualInterestRate / 100);
        schedule = LoanCalculationService.generateFlatSchedule(
          principal,
          annualInterestRate / 100,
          durationMonths
        );
        break;

      case "REDUCING_BALANCE":
        totalInterest = LoanCalculationService.calculateReducingBalanceInterest(
          principal,
          monthlyRate,
          durationMonths
        );
        schedule = LoanCalculationService.generateReducingBalanceSchedule(
          principal,
          monthlyRate,
          durationMonths
        );
        break;

      case "AMORTIZED":
        totalInterest = LoanCalculationService.calculateAmortizedInterest(
          principal,
          monthlyRate,
          durationMonths
        );
        schedule = LoanCalculationService.generateAmortizedSchedule(
          principal,
          monthlyRate,
          durationMonths
        );
        break;

      default:
        throw new Error(`Unknown interest method: ${interestMethod}`);
    }

    const totalRepayment = principal + totalInterest;
    const monthlyPayment =
      durationMonths > 0
        ? LoanCalculationService.round2(totalRepayment / durationMonths)
        : 0;
    const totalUpfrontFees = processingFee + insuranceFee;

    return {
      principal,
      totalInterest: LoanCalculationService.round2(totalInterest),
      totalRepayment: LoanCalculationService.round2(totalRepayment),
      monthlyPayment,
      processingFee,
      insuranceFee,
      totalUpfrontFees,
      schedule,
    };
  }

  private static generateFlatSchedule(
    principal: number,
    totalRate: number,
    durationMonths: number
  ): ScheduleEntry[] {
    const totalInterest = principal * totalRate;
    const totalRepayment = principal + totalInterest;
    const monthlyPayment = LoanCalculationService.round2(
      totalRepayment / durationMonths
    );
    const principalPerMonth = LoanCalculationService.round2(
      principal / durationMonths
    );
    const interestPerMonth = LoanCalculationService.round2(
      totalInterest / durationMonths
    );

    const schedule: ScheduleEntry[] = [];
    let balance = principal;

    for (let i = 1; i <= durationMonths; i++) {
      const openingBalance = balance;
      const isLastMonth = i === durationMonths;
      const interestPayment =
        i <= durationMonths
          ? interestPerMonth
          : LoanCalculationService.round2(
              totalInterest - interestPerMonth * (durationMonths - 1)
            );
      const princPay = isLastMonth ? balance : principalPerMonth;
      const totalPayment = isLastMonth
        ? LoanCalculationService.round2(
            princPay + totalInterest - interestPerMonth * (durationMonths - 1)
          )
        : monthlyPayment;
      const closingBalance = LoanCalculationService.round2(
        openingBalance - princPay
      );

      schedule.push({
        month: i,
        openingBalance,
        principalPayment: princPay,
        interestPayment,
        totalPayment,
        closingBalance: Math.max(0, closingBalance),
      });

      balance = Math.max(0, closingBalance);
    }

    return schedule;
  }

  private static calculateReducingBalanceInterest(
    principal: number,
    monthlyRate: number,
    durationMonths: number
  ): number {
    let balance = principal;
    let totalInterest = 0;

    for (let i = 0; i < durationMonths; i++) {
      const interest = LoanCalculationService.round2(balance * monthlyRate);
      totalInterest += interest;
      const principalPerMonth = LoanCalculationService.round2(
        principal / durationMonths
      );
      balance = LoanCalculationService.round2(balance - principalPerMonth);
    }

    return totalInterest;
  }

  private static generateReducingBalanceSchedule(
    principal: number,
    monthlyRate: number,
    durationMonths: number
  ): ScheduleEntry[] {
    const principalPerMonth = LoanCalculationService.round2(
      principal / durationMonths
    );

    const schedule: ScheduleEntry[] = [];
    let balance = principal;

    for (let i = 1; i <= durationMonths; i++) {
      const openingBalance = balance;
      const interestPayment = LoanCalculationService.round2(
        balance * monthlyRate
      );
      const isLastMonth = i === durationMonths;
      const princPay = isLastMonth ? balance : principalPerMonth;
      const totalPay = LoanCalculationService.round2(princPay + interestPayment);
      const closingBalance = LoanCalculationService.round2(
        openingBalance - princPay
      );

      schedule.push({
        month: i,
        openingBalance,
        principalPayment: princPay,
        interestPayment,
        totalPayment: totalPay,
        closingBalance: Math.max(0, closingBalance),
      });

      balance = Math.max(0, closingBalance);
    }

    return schedule;
  }

  private static calculateAmortizedInterest(
    principal: number,
    monthlyRate: number,
    durationMonths: number
  ): number {
    if (monthlyRate === 0) return 0;

    const monthlyPayment =
      principal *
      (monthlyRate * Math.pow(1 + monthlyRate, durationMonths)) /
      (Math.pow(1 + monthlyRate, durationMonths) - 1);

    const totalPayment = monthlyPayment * durationMonths;
    return LoanCalculationService.round2(totalPayment - principal);
  }

  private static generateAmortizedSchedule(
    principal: number,
    monthlyRate: number,
    durationMonths: number
  ): ScheduleEntry[] {
    if (monthlyRate === 0) {
      const monthlyPayment = LoanCalculationService.round2(
        principal / durationMonths
      );
      const schedule: ScheduleEntry[] = [];
      let balance = principal;

      for (let i = 1; i <= durationMonths; i++) {
        const openingBalance = balance;
        const isLast = i === durationMonths;
        const princPay = isLast ? balance : monthlyPayment;
        const totalPay = princPay;
        const closing = LoanCalculationService.round2(openingBalance - princPay);

        schedule.push({
          month: i,
          openingBalance,
          principalPayment: princPay,
          interestPayment: 0,
          totalPayment: totalPay,
          closingBalance: Math.max(0, closing),
        });

        balance = Math.max(0, closing);
      }

      return schedule;
    }

    const monthlyPayment =
      principal *
      (monthlyRate * Math.pow(1 + monthlyRate, durationMonths)) /
      (Math.pow(1 + monthlyRate, durationMonths) - 1);

    const schedule: ScheduleEntry[] = [];
    let balance = principal;

    for (let i = 1; i <= durationMonths; i++) {
      const openingBalance = balance;
      const interestPayment = LoanCalculationService.round2(
        balance * monthlyRate
      );
      const isLast = i === durationMonths;
      const princPay = isLast
        ? balance
        : LoanCalculationService.round2(monthlyPayment - interestPayment);
      const totalPay = isLast
        ? LoanCalculationService.round2(balance + interestPayment)
        : LoanCalculationService.round2(monthlyPayment);
      const closing = LoanCalculationService.round2(openingBalance - princPay);

      schedule.push({
        month: i,
        openingBalance,
        principalPayment: princPay,
        interestPayment,
        totalPayment: totalPay,
        closingBalance: Math.max(0, closing),
      });

      balance = Math.max(0, closing);
    }

    return schedule;
  }

  static calculateEligibleLoanAmount(
    salary: number,
    maxDeductionPercentage: number,
    effectiveRate: number,
    durationMonths: number,
    interestMethod: InterestMethod
  ): number {
    const maxMonthlyDeduction = salary * (maxDeductionPercentage / 100);

    if (effectiveRate === 0 || durationMonths === 0) return 0;

    switch (interestMethod) {
      case "FLAT": {
        // effectiveRate is treated as the flat total-rate fraction (e.g. 0.10)
        const factor = 1 + effectiveRate;
        return LoanCalculationService.round2(
          (maxMonthlyDeduction * durationMonths) / factor
        );
      }
      case "REDUCING_BALANCE": {
        let low = 0;
        let high = salary * durationMonths;
        for (let iter = 0; iter < 50; iter++) {
          const mid = (low + high) / 2;
          const totalInterest =
            LoanCalculationService.calculateReducingBalanceInterest(
              mid,
              effectiveRate,
              durationMonths
            );
          const monthlyPayment = (mid + totalInterest) / durationMonths;
          if (monthlyPayment > maxMonthlyDeduction) {
            high = mid;
          } else {
            low = mid;
          }
        }
        return LoanCalculationService.round2(low);
      }
      case "AMORTIZED": {
        if (effectiveRate === 0) return maxMonthlyDeduction * durationMonths;
        const principal =
          maxMonthlyDeduction *
          ((Math.pow(1 + effectiveRate, durationMonths) - 1) /
            (effectiveRate * Math.pow(1 + effectiveRate, durationMonths)));
        return LoanCalculationService.round2(principal);
      }
      default:
        return 0;
    }
  }

  private static round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
