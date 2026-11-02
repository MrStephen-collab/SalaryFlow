import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Allocate the next employee number in the organization, following the
 * EMP-0001 pattern. Existing non-standard numbers (for example "RBH") are
 * ignored, and the highest numeric EMP-#### number wins.
 */
export async function allocateEmployeeNumber(
  supabase: SupabaseClient,
  organizationId: string
) {
  const { data } = await supabase
    .from("employees")
    .select("employee_number")
    .eq("organization_id", organizationId)
    .like("employee_number", "EMP-%");

  const highest = (data ?? []).reduce((max, row) => {
    const match = /^EMP-(\d+)$/.exec(String(row.employee_number ?? "").trim());
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `EMP-${String(highest + 1).padStart(4, "0")}`;
}
