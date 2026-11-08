import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Download links for a loan repayment schedule. PDF is generated on the server,
 * while Excel and Word open the matching office format.
 */
export function LoanScheduleActions({
  loanId,
  className,
}: {
  loanId: string;
  className?: string;
}) {
  const base = `/api/loans/${loanId}/schedule`;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <Button size="sm" variant="outline" render={<a href={`${base}?format=pdf`} />}>
        <Download className="size-4" />
        PDF
      </Button>
      <Button size="sm" variant="outline" render={<a href={`${base}?format=xls`} />}>
        <FileSpreadsheet className="size-4" />
        Excel
      </Button>
      <Button size="sm" variant="outline" render={<a href={`${base}?format=doc`} />}>
        <FileText className="size-4" />
        Word
      </Button>
    </div>
  );
}
