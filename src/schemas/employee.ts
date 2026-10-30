import { z } from "zod";

export const createEmployeeSchema = z.object({
  employeeNumber: z
    .string()
    .min(1, "Employee number is required")
    .max(50, "Employee number must be at most 50 characters"),
  firstName: z
    .string()
    .min(2, "First name is required")
    .max(100, "First name must be at most 100 characters"),
  lastName: z
    .string()
    .min(2, "Last name is required")
    .max(100, "Last name must be at most 100 characters"),
  otherNames: z
    .string()
    .max(100, "Other names must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(20, "Phone must be at most 20 characters")
    .optional()
    .or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z
    .enum(["Male", "Female", "Other"])
    .optional()
    .or(z.literal("")),
  address: z.string().max(255, "Address is too long").optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  lga: z.string().max(100).optional().or(z.literal("")),
  nin: z
    .string()
    .regex(/^\d{11}$/, "NIN must be 11 digits")
    .optional()
    .or(z.literal("")),
  ninDocumentUrl: z.string().optional().or(z.literal("")),
  department: z.string().max(100).optional().or(z.literal("")),
  position: z.string().max(100).optional().or(z.literal("")),
  employmentType: z.enum([
    "Full-time",
    "Part-time",
    "Contract",
    "Intern",
    "Casual",
  ]),
  employmentStatus: z.enum([
    "Active",
    "Suspended",
    "Terminated",
    "Resigned",
    "On Leave",
  ]),
  dateJoined: z.string().min(1, "Date joined is required"),
  salary: z
    .union([
      z.number(),
      z.string().regex(/^\d*(\.\d{0,2})?$/, "Enter a valid salary amount"),
    ])
    .optional()
    .or(z.literal("")),
  thriftEnabled: z.boolean().optional(),
  thriftAmount: z
    .union([
      z.number(),
      z.string().regex(/^\d*(\.\d{0,2})?$/, "Enter a valid thrift amount"),
    ])
    .optional()
    .or(z.literal("")),
  branchId: z.string().optional().or(z.literal("")),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const employeeImportSchema = z.object({
  rows: z.array(
    z.object({
      employeeNumber: z.string(),
      fullName: z.string(),
      basicSalary: z.number(),
      allowances: z.number().default(0),
      otherDeductions: z.number().default(0),
    })
  ),
});

export type CreateEmployeeValues = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeValues = z.infer<typeof updateEmployeeSchema>;
export type EmployeeImportValues = z.infer<typeof employeeImportSchema>;
