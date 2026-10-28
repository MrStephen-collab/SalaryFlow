"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyForLoan } from "@/app/employee/actions";
import { LoanCalculationService } from "@/services/loan-calculation-service";
import type { InterestMethod } from "@/services/loan-calculation-service";
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
  maximum_salary_deduction_percentage: number;
  active: boolean;
}

interface Employee {
  id: string;
  salary: number;
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
  employee,
}: {
  products: LoanProduct[];
  employee: Employee;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [purpose, setPurpose] = useState("");

  const selectedProduct = products.find((p) => p.id === productId);

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

  const maxDeduction =
    employee.salary *
    ((selectedProduct?.maximum_salary_deduction_percentage ?? 30) / 100);
  const exceedsDeduction =
    calculation && calculation.monthlyPayment > maxDeduction;

  const handleSubmit = () => {
    if (!productId || !selectedProduct) {
      toast.error("Select a loan product");
      return;
    }
    if (amount <= 0) {
      toast.error("Enter a valid loan amount");
      return;
    }
    if (duration <= 0) {
      toast.error("Enter a valid duration");
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
                      <SelectValue placeholder="Select a loan product" />
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
                        {selectedProduct.duration_months} months
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label>Loan Amount (₦) *</Label>
                      <Input
                        type="number"
                        value={amount || ""}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        min={selectedProduct.minimum_amount}
                        max={selectedProduct.maximum_amount}
                        placeholder={`Min: ${naira(selectedProduct.minimum_amount)}, Max: ${naira(selectedProduct.maximum_amount)}`}
                      />
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
                  disabled={isPending || !productId || amount <= 0 || duration <= 0}
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

              {employee.salary > 0 && (
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">
                    Max Monthly Deduction ({selectedProduct?.maximum_salary_deduction_percentage}%)
                  </p>
                  <p className="text-sm font-medium">{naira(maxDeduction)}</p>
                </div>
              )}

              {exceedsDeduction && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>
                    Monthly payment of {naira(calculation.monthlyPayment)} exceeds
                    the maximum allowed deduction of {naira(maxDeduction)}.
                  </AlertDescription>
                </Alert>
              )}

              {!exceedsDeduction && calculation.monthlyPayment > 0 && (
                <Alert>
                  <CheckCircle2 className="size-4" />
                  <AlertDescription>
                    Monthly payment of {naira(calculation.monthlyPayment)} is
                    within the allowed deduction limit.
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