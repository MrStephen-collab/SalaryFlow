"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintNowButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer />
      Print / Save PDF
    </Button>
  );
}
