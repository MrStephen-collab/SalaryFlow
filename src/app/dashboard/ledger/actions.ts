"use server";

import { LedgerService } from "@/services/ledger-service";
import { FundService } from "@/services/fund-service";

export async function listLedgerTransactions(limit?: number) {
  const service = await LedgerService.create();
  return service.listTransactions(limit);
}

export async function getLedgerTransaction(transactionId: string) {
  const service = await LedgerService.create();
  return service.getTransaction(transactionId);
}

export async function reverseLedgerTransaction(transactionId: string, reason: string) {
  const service = await LedgerService.create();
  return service.reverseTransaction(transactionId, reason);
}

export async function listFundAccounts() {
  const service = await FundService.create();
  return service.listFundAccounts();
}

export async function getFundAccount(fundAccountId: string) {
  const service = await FundService.create();
  return service.getFundAccount(fundAccountId);
}

export async function createFundAccount(name: string, openingBalance: number) {
  const service = await FundService.create();
  return service.createFundAccount(name, openingBalance);
}

export async function recordFundMovement(
  fundAccountId: string,
  transactionType: "OPENING" | "FUNDING" | "DISBURSEMENT" | "REPAYMENT" | "WITHDRAWAL" | "ADJUSTMENT",
  amount: number,
  direction: "IN" | "OUT",
  description: string
) {
  const service = await FundService.create();
  return service.recordMovement(fundAccountId, transactionType, amount, direction, description);
}

export async function fundAccountBalance(fundAccountId: string) {
  const service = await FundService.create();
  return service.fundAccountBalance(fundAccountId);
}

export async function listFundTransactions(fundAccountId?: string, limit?: number) {
  const service = await FundService.create();
  return service.listFundTransactions(fundAccountId, limit);
}
