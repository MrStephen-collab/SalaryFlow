"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyForLoan } from "@/app/employee/actions";
import { LoanCalculationService } from "@/services/loan-calculation-service";
import type { InterestMethod } from "@/services/loan-calculation-service";
import { thriftBackedLoanLimit } from "@/lib/loan-eligibility";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calculator,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface LoanProduct {
  id: string;
  name: string;
  description: string | null;
  minimum_amount: number;
  maximum_amount: number;
  interest_rate: number;
  interest_method: string;
  duration_months: number;
  processing_fee: number;
  insurance_fee: number;
  active: boolean;
}

function naira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ApplyLoanForm({
  products,
  thriftAmount,
  thriftBalance,
}: {
  products: LoanProduct[];
  thriftAmount: number;
  thriftBalance: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [purpose, setPurpose] = useState("");

  const selectedProduct = products.find((p) => p.id === productId);
  const thriftLimit = thriftBackedLoanLimit(thriftBalance);
  const effectiveMax = selectedProduct
    ? Math.min(selectedProduct.maximum_amount, thriftLimit)
    : thriftLimit;
  const exceedsThriftLimit = amount > thriftLimit;

  const calculation =
    selectedProduct && amount > 0 && duration > 0
      ? LoanCalculationService.calculate({
          principal: amount,
          annualInterestRate: selectedProduct.interest_rate,
          interestMethod: selectedProduct.interest_method as InterestMethod,
          durationMonths: duration,
          processingFee: selectedProduct.processing_fee,
          insuranceFee: selectedProduct.insurance_fee,
        })
      : null;

  const exceedsMonthlyThrift =
    calculation != null && calculation.monthlyPayment > thriftAmount + 0.0001;

  const handleSubmit = () => {
    if (!productId || !selectedProduct) {
      toast.error("Select a loan product");
      return;
    }
    if (amount <= 0) {
      toast.error("Enter a valid loan amount");
      return;
    }
    if (amount > thriftLimit) {
      toast.error(
        thriftLimit <= 0
          ? "You need thrift savings before you can apply. Your loan limit is 3× your thrift savings."
          : `Your loan limit is ${naira(thriftLimit)} (3× your thrift savings).`
      );
      return;
    }
    if (amount < selectedProduct.minimum_amount) {
      toast.error(
        `The minimum amount for ${selectedProduct.name} is ${naira(
          selectedProduct.minimum_amount
        )}.`
      );
      return;
    }
    if (amount > selectedProduct.maximum_amount) {
      toast.error(
        `The maximum amount for ${selectedProduct.name} is ${naira(
          selectedProduct.maximum_amount
        )}.`
      );
      return;
    }
    if (duration <= 0) {
      toast.error("Enter a valid duration");
      return;
    }
    if (calculation && calculation.monthlyPayment > thriftAmount + 0.0001) {
      toast.error(
        `The monthly repayment of ${naira(
          calculation.monthlyPayment
        )} is more than your monthly thrift amount of ${naira(
          thriftAmount
        )}. Ask your admin to increase your thrift amount, or choose a smaller amount or longer duration.`
      );
      return;
    }

    startTransition(async () => {
      const result = await applyForLoan(
        productId,
        amount,
        duration,
        purpose || undefined
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Loan application submitted");
        router.push("/employee/loans");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="size-5" />
              Loan Application
            </CardTitle>
            <CardDescription>
              Select a product and enter your loan details
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {products.length === 0 ? (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertDescription>
                  No loan products are currently available in your organization.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Loan Product *</Label>
                  <Select
                    value={productId}
                    onValueChange={(v) => {
                      setProductId(v ?? "");
                      setAmount(0);
                      setDuration(0);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a loan product">
                        {(value) =>
                          products.find((p) => p.id === value)?.name ??
                          "Select a loan product"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {p.interest_rate}% {p.interest_method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProduct && (
                  <>
                    <Alert>
                      <AlertCircle className="size-4" />
                      <AlertDescription>
                        {selectedProduct.name}: {naira(selectedProduct.minimum_amount)}{" "}
                        – {naira(selectedProduct.maximum_amount)}, up to{" "}
                        {selectedProduct.duration_months} months.
                        <span className="mt-1 block">
                          Your thrift-backed limit:{" "}
                          <strong>{naira(thriftLimit)}</strong> (3× your{" "}
                          {naira(thriftBalance)} thrift savings).
                        </span>
                      </AlertDescription>
                    </Alert>

                    {thriftLimit <= 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertDescription>
                          You have no thrift savings yet. Save in thrift to
                          unlock a loan — your limit is three times your thrift
                          savings.
                        </AlertDescription>
                      </Alert>
                    )}

                    {thriftLimit > 0 &&
                      thriftLimit < selectedProduct.minimum_amount && (
                        <Alert variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertDescription>
                            Your thrift-backed limit of {naira(thriftLimit)} is
                            below this product&apos;s minimum loan amount of{" "}
                            {naira(selectedProduct.minimum_amount)}.
                          </AlertDescription>
                        </Alert>
                      )}

                    <div className="space-y-2">
                      <Label>Loan Amount (₦) *</Label>
                      <Input
                        type="number"
                        value={amount || ""}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isFinite(next) || next <= 0) {
                            setAmount(0);
                            return;
                          }
                          setAmount(Math.min(next, effectiveMax));
                        }}
                        min={selectedProduct.minimum_amount}
                        max={Math.max(0, effectiveMax)}
                        placeholder={`Min: ${naira(selectedProduct.minimum_amount)}, Max: ${naira(effectiveMax)}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum you can borrow now: {naira(effectiveMax)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Duration (Months) *</Label>
                      <Input
                        type="number"
                        value={duration || ""}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        min={1}
                        max={selectedProduct.duration_months}
                        placeholder={`Max: ${selectedProduct.duration_months} months`}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Purpose (optional)</Label>
                      <Textarea
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        placeholder="Why do you need this loan?"
                        rows={2}
                      />
                    </div>
                  </>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={
                    isPending ||
                    !productId ||
                    amount <= 0 ||
                    duration <= 0 ||
                    effectiveMax <= 0 ||
                    exceedsThriftLimit ||
                    exceedsMonthlyThrift
                  }
                  className="w-full"
                >
                  {isPending ? "Submitting..." : "Apply for Loan"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {calculation && (
          <Card>
            <CardHeader>
              <CardTitle>Loan Summary</CardTitle>
              <CardDescription>Calculated breakdown</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Principal</p>
                  <p className="text-lg font-bold">{naira(calculation.principal)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">
                    Thrift-backed Limit (3× savings)
                  </p>
                  <p className="text-lg font-bold">{naira(thriftLimit)}</p>
                  <p className="text-xs text-muted-foreground">
                    Savings: {naira(thriftBalance)}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Total Interest</p>
                  <p className="text-lg font-bold">{naira(calculation.totalInterest)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Monthly Payment</p>
                  <p className="text-lg font-bold text-primary">
                    {naira(calculation.monthlyPayment)}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Total Repayment</p>
                  <p className="text-lg font-bold">{naira(calculation.totalRepayment)}</p>
                </div>
              </div>

              {calculation.processingFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Processing Fee</span>
                  <span>{naira(calculation.processingFee)}</span>
                </div>
              )}
              {calculation.insuranceFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Insurance Fee</span>
                  <span>{naira(calculation.insuranceFee)}</span>
                </div>
              )}
              {calculation.totalUpfrontFees > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Net credited to wallet
                  </span>
                  <span className="font-medium">
                    {naira(
                      Math.max(0, calculation.principal - calculation.totalUpfrontFees)
                    )}
                  </span>
                </div>
              )}

              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">
                  Monthly Thrift Amount (repayment ceiling)
                </p>
                <p className="text-sm font-medium">{naira(thriftAmount)}</p>
              </div>

              {exceedsThriftLimit && amount > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>
                    The amount exceeds your thrift-backed limit of{" "}
                    {naira(thriftLimit)}. Save more in thrift or reduce the
                    amount.
                  </AlertDescription>
                </Alert>
              )}

              {exceedsMonthlyThrift && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>
                    Monthly payment of {naira(calculation.monthlyPayment)} is
                    more than your monthly thrift amount of {naira(thriftAmount)}.
                    Ask your admin to increase your thrift amount, or choose a
                    smaller amount or longer duration.
                  </AlertDescription>
                </Alert>
              )}

              {!exceedsMonthlyThrift && calculation.monthlyPayment > 0 && (
                <Alert>
                  <CheckCircle2 className="size-4" />
                  <AlertDescription>
                    Monthly payment of {naira(calculation.monthlyPayment)} fits
                    inside your monthly thrift amount.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}