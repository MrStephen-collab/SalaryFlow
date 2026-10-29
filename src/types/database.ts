// Types for the SalaryFlow Supabase schema.
// Regenerate with `supabase gen types typescript` once the project is linked.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          organization_id: string | null
          user_agent: string | null
          user_id: string | null
        };
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at: string
          entity_id?: string | null
          entity_type: string
          id: string
          ip_address?: string | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        };
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        };
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string | null
          bank_name: string
          created_at: string
          deleted_at: string | null
          employee_id: string
          id: string
          is_default: boolean
          organization_id: string
          updated_at: string
          verified: boolean
          verified_at: string | null
        };
        Insert: {
          account_name: string
          account_number: string
          bank_code?: string | null
          bank_name: string
          created_at: string
          deleted_at?: string | null
          employee_id: string
          id: string
          is_default: boolean
          organization_id: string
          updated_at: string
          verified: boolean
          verified_at?: string | null
        };
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string | null
          bank_name?: string
          created_at?: string
          deleted_at?: string | null
          employee_id?: string
          id?: string
          is_default?: boolean
          organization_id?: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
        };
        Relationships: [];
      };
      branches: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          lga: string | null
          manager_id: string | null
          name: string
          organization_id: string
          state: string | null
          updated_at: string
        };
        Insert: {
          active: boolean
          address?: string | null
          created_at: string
          id: string
          lga?: string | null
          manager_id?: string | null
          name: string
          organization_id: string
          state?: string | null
          updated_at: string
        };
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          lga?: string | null
          manager_id?: string | null
          name?: string
          organization_id?: string
          state?: string | null
          updated_at?: string
        };
        Relationships: [];
      };
      deduction_records: {
        Row: {
          actual_amount: number
          created_at: string
          deduction_type: string
          employee_id: string
          expected_amount: number
          id: string
          loan_application_id: string | null
          notes: string | null
          organization_id: string
          processed_at: string | null
          reference: string
          remaining_balance: number
          salary_period_id: string
          schedule_id: string | null
          shortfall: number
          status: string
          updated_at: string
        };
        Insert: {
          actual_amount: number
          created_at: string
          deduction_type: string
          employee_id: string
          expected_amount: number
          id: string
          loan_application_id?: string | null
          notes?: string | null
          organization_id: string
          processed_at?: string | null
          reference: string
          remaining_balance: number
          salary_period_id: string
          schedule_id?: string | null
          shortfall: number
          status: string
          updated_at: string
        };
        Update: {
          actual_amount?: number
          created_at?: string
          deduction_type?: string
          employee_id?: string
          expected_amount?: number
          id?: string
          loan_application_id?: string | null
          notes?: string | null
          organization_id?: string
          processed_at?: string | null
          reference?: string
          remaining_balance?: number
          salary_period_id?: string
          schedule_id?: string | null
          shortfall?: number
          status?: string
          updated_at?: string
        };
        Relationships: [];
      };
      departments: {
        Row: {
          active: boolean
          created_at: string
          head_id: string | null
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          updated_at: string
        };
        Insert: {
          active: boolean
          created_at: string
          head_id?: string | null
          id: string
          name: string
          organization_id: string
          parent_id?: string | null
          updated_at: string
        };
        Update: {
          active?: boolean
          created_at?: string
          head_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          updated_at?: string
        };
        Relationships: [];
      };
      employees: {
        Row: {
          address: string | null
          branch: string | null
          branch_id: string | null
          confirmation_date: string | null
          created_at: string
          date_joined: string
          date_of_birth: string | null
          department: string | null
          email: string
          employee_number: string
          employment_status: string
          employment_type: string
          first_name: string
          gender: string | null
          id: string
          job_title: string | null
          last_name: string
          lga: string | null
          organization_id: string
          other_names: string | null
          phone: string
          position: string | null
          salary: number
          state: string | null
          termination_date: string | null
          updated_at: string
          user_id: string | null
        };
        Insert: {
          address?: string | null
          branch?: string | null
          branch_id?: string | null
          confirmation_date?: string | null
          created_at: string
          date_joined: string
          date_of_birth?: string | null
          department?: string | null
          email: string
          employee_number: string
          employment_status: string
          employment_type: string
          first_name: string
          gender?: string | null
          id: string
          job_title?: string | null
          last_name: string
          lga?: string | null
          organization_id: string
          other_names?: string | null
          phone: string
          position?: string | null
          salary: number
          state?: string | null
          termination_date?: string | null
          updated_at: string
          user_id?: string | null
        };
        Update: {
          address?: string | null
          branch?: string | null
          branch_id?: string | null
          confirmation_date?: string | null
          created_at?: string
          date_joined?: string
          date_of_birth?: string | null
          department?: string | null
          email?: string
          employee_number?: string
          employment_status?: string
          employment_type?: string
          first_name?: string
          gender?: string | null
          id?: string
          job_title?: string | null
          last_name?: string
          lga?: string | null
          organization_id?: string
          other_names?: string | null
          phone?: string
          position?: string | null
          salary?: number
          state?: string | null
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        };
        Relationships: [];
      };
      financial_accounts: {
        Row: {
          account_type: string
          created_at: string
          currency: string
          employee_id: string
          id: string
          organization_id: string
          status: string
          updated_at: string
        };
        Insert: {
          account_type: string
          created_at: string
          currency: string
          employee_id: string
          id: string
          organization_id: string
          status: string
          updated_at: string
        };
        Update: {
          account_type?: string
          created_at?: string
          currency?: string
          employee_id?: string
          id?: string
          organization_id?: string
          status?: string
          updated_at?: string
        };
        Relationships: [];
      };
      fund_accounts: {
        Row: {
          created_at: string
          currency: string
          id: string
          name: string
          opening_balance: number
          organization_id: string
          status: string
          updated_at: string
        };
        Insert: {
          created_at: string
          currency: string
          id: string
          name: string
          opening_balance: number
          organization_id: string
          status: string
          updated_at: string
        };
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          opening_balance?: number
          organization_id?: string
          status?: string
          updated_at?: string
        };
        Relationships: [];
      };
      fund_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          direction: string
          fund_account_id: string
          id: string
          organization_id: string
          reference: string
          related_loan_application_id: string | null
          transaction_type: string
        };
        Insert: {
          amount: number
          created_at: string
          created_by?: string | null
          description?: string | null
          direction: string
          fund_account_id: string
          id: string
          organization_id: string
          reference: string
          related_loan_application_id?: string | null
          transaction_type: string
        };
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: string
          fund_account_id?: string
          id?: string
          organization_id?: string
          reference?: string
          related_loan_application_id?: string | null
          transaction_type?: string
        };
        Relationships: [];
      };
      ledger_accounts: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          type: string
          updated_at: string
        };
        Insert: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          parent_id?: string | null
          type: string
          updated_at: string
        };
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          type?: string
          updated_at?: string
        };
        Relationships: [];
      };
      ledger_entries: {
        Row: {
          account_id: string | null
          created_at: string
          credit: number
          debit: number
          description: string | null
          financial_account_id: string | null
          id: string
          organization_id: string
          transaction_id: string
        };
        Insert: {
          account_id?: string | null
          created_at: string
          credit: number
          debit: number
          description?: string | null
          financial_account_id?: string | null
          id: string
          organization_id: string
          transaction_id: string
        };
        Update: {
          account_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          financial_account_id?: string | null
          id?: string
          organization_id?: string
          transaction_id?: string
        };
        Relationships: [];
      };
      ledger_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          reference: string
          reversal_of: string | null
          status: string
          transaction_date: string
          transaction_type: string
        };
        Insert: {
          created_at: string
          created_by?: string | null
          description?: string | null
          id: string
          organization_id: string
          reference: string
          reversal_of?: string | null
          status: string
          transaction_date: string
          transaction_type: string
        };
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          reference?: string
          reversal_of?: string | null
          status?: string
          transaction_date?: string
          transaction_type?: string
        };
        Relationships: [];
      };
      loan_applications: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          disbursed_at: string | null
          duration_months: number
          employee_id: string
          id: string
          interest_method: string
          interest_rate: number
          loan_product_id: string
          monthly_deduction: number
          notes: string | null
          organization_id: string
          purpose: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          total_interest: number
          total_repayment: number
          updated_at: string
        };
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at: string
          disbursed_at?: string | null
          duration_months: number
          employee_id: string
          id: string
          interest_method: string
          interest_rate: number
          loan_product_id: string
          monthly_deduction: number
          notes?: string | null
          organization_id: string
          purpose?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: string
          submitted_at?: string | null
          total_interest: number
          total_repayment: number
          updated_at: string
        };
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          disbursed_at?: string | null
          duration_months?: number
          employee_id?: string
          id?: string
          interest_method?: string
          interest_rate?: number
          loan_product_id?: string
          monthly_deduction?: number
          notes?: string | null
          organization_id?: string
          purpose?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          total_interest?: number
          total_repayment?: number
          updated_at?: string
        };
        Relationships: [];
      };
      loan_products: {
        Row: {
          active: boolean
          collateral_required: boolean
          created_at: string
          description: string | null
          duration_months: number
          guarantor_required: boolean
          id: string
          insurance_fee: number
          interest_method: string
          interest_rate: number
          maximum_amount: number
          maximum_salary_deduction_percentage: number
          minimum_amount: number
          minimum_employment_period_months: number
          minimum_salary: number
          name: string
          organization_id: string
          processing_fee: number
          repayment_frequency: string
          updated_at: string
        };
        Insert: {
          active: boolean
          collateral_required: boolean
          created_at: string
          description?: string | null
          duration_months: number
          guarantor_required: boolean
          id: string
          insurance_fee: number
          interest_method: string
          interest_rate: number
          maximum_amount: number
          maximum_salary_deduction_percentage: number
          minimum_amount: number
          minimum_employment_period_months: number
          minimum_salary: number
          name: string
          organization_id: string
          processing_fee: number
          repayment_frequency: string
          updated_at: string
        };
        Update: {
          active?: boolean
          collateral_required?: boolean
          created_at?: string
          description?: string | null
          duration_months?: number
          guarantor_required?: boolean
          id?: string
          insurance_fee?: number
          interest_method?: string
          interest_rate?: number
          maximum_amount?: number
          maximum_salary_deduction_percentage?: number
          minimum_amount?: number
          minimum_employment_period_months?: number
          minimum_salary?: number
          name?: string
          organization_id?: string
          processing_fee?: number
          repayment_frequency?: string
          updated_at?: string
        };
        Relationships: [];
      };
      loan_repayments: {
        Row: {
          amount: number
          created_at: string
          id: string
          loan_application_id: string
          notes: string | null
          payment_method: string | null
          recorded_at: string
          recorded_by: string | null
          reference_number: string | null
          schedule_id: string | null
        };
        Insert: {
          amount: number
          created_at: string
          id: string
          loan_application_id: string
          notes?: string | null
          payment_method?: string | null
          recorded_at: string
          recorded_by?: string | null
          reference_number?: string | null
          schedule_id?: string | null
        };
        Update: {
          amount?: number
          created_at?: string
          id?: string
          loan_application_id?: string
          notes?: string | null
          payment_method?: string | null
          recorded_at?: string
          recorded_by?: string | null
          reference_number?: string | null
          schedule_id?: string | null
        };
        Relationships: [];
      };
      loan_schedules: {
        Row: {
          closing_balance: number
          created_at: string
          due_date: string | null
          id: string
          interest_payment: number
          loan_application_id: string
          month_number: number
          opening_balance: number
          paid_amount: number
          paid_at: string | null
          principal_payment: number
          status: string
          total_payment: number
          updated_at: string
        };
        Insert: {
          closing_balance: number
          created_at: string
          due_date?: string | null
          id: string
          interest_payment: number
          loan_application_id: string
          month_number: number
          opening_balance: number
          paid_amount: number
          paid_at?: string | null
          principal_payment: number
          status: string
          total_payment: number
          updated_at: string
        };
        Update: {
          closing_balance?: number
          created_at?: string
          due_date?: string | null
          id?: string
          interest_payment?: number
          loan_application_id?: string
          month_number?: number
          opening_balance?: number
          paid_amount?: number
          paid_at?: string | null
          principal_payment?: number
          status?: string
          total_payment?: number
          updated_at?: string
        };
        Relationships: [];
      };
      organization_settings: {
        Row: {
          approval_workflow: string
          created_at: string
          default_interest_method: string
          default_interest_rate: number | null
          salary_payment_day: number | null
          auto_disburse_salaries: boolean
          savings_min_membership_months: number
          member_loan_multiplier: number
          member_savings_withdrawals_enabled: boolean
          guarantor_required: boolean
          id: string
          max_loan_amount: number | null
          max_salary_deduction_percentage: number
          max_tenure: number
          min_employment_period_months: number
          min_salary: number
          organization_id: string
          salary_cycle: string
          updated_at: string
          withdrawals_enabled: boolean
        };
        Insert: {
          approval_workflow: string
          created_at: string
          default_interest_method: string
          default_interest_rate?: number | null
          guarantor_required: boolean
          id: string
          max_loan_amount?: number | null
          max_salary_deduction_percentage: number
          max_tenure: number
          min_employment_period_months: number
          min_salary: number
          organization_id: string
          salary_cycle: string
          updated_at: string
          withdrawals_enabled: boolean
        };
        Update: {
          approval_workflow?: string
          created_at?: string
          default_interest_method?: string
          default_interest_rate?: number | null
          guarantor_required?: boolean
          id?: string
          max_loan_amount?: number | null
          max_salary_deduction_percentage?: number
          max_tenure?: number
          min_employment_period_months?: number
          min_salary?: number
          organization_id?: string
          salary_cycle?: string
          updated_at?: string
          withdrawals_enabled?: boolean
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          address: string
          created_at: string
          currency: string
          email: string
          id: string
          lga: string
          logo_url: string | null
          name: string
          phone: string
          primary_color: string | null
          registration_number: string | null
          secondary_color: string | null
          state: string
          type: string
          updated_at: string
        };
        Insert: {
          address: string
          created_at: string
          currency: string
          email: string
          id: string
          lga: string
          logo_url?: string | null
          name: string
          phone: string
          primary_color?: string | null
          registration_number?: string | null
          secondary_color?: string | null
          state: string
          type: string
          updated_at: string
        };
        Update: {
          address?: string
          created_at?: string
          currency?: string
          email?: string
          id?: string
          lga?: string
          logo_url?: string | null
          name?: string
          phone?: string
          primary_color?: string | null
          registration_number?: string | null
          secondary_color?: string | null
          state?: string
          type?: string
          updated_at?: string
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          name: string
          resource: string
        };
        Insert: {
          action: string
          created_at: string
          description?: string | null
          id: string
          name: string
          resource: string
        };
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          resource?: string
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          id: string
          permission_id: string
          role_id: string
        };
        Insert: {
          id: string
          permission_id: string
          role_id: string
        };
        Update: {
          id?: string
          permission_id?: string
          role_id?: string
        };
        Relationships: [];
      };
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
        };
        Insert: {
          created_at: string
          description?: string | null
          id: string
          is_system: boolean
          name: string
        };
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
        };
        Relationships: [];
      };
      salary_import_rows: {
        Row: {
          allowances: number | null
          basic_salary: number | null
          created_at: string
          employee_name: string | null
          employee_number: string | null
          error_message: string | null
          id: string
          import_id: string
          other_deductions: number | null
          row_status: string
        };
        Insert: {
          allowances?: number | null
          basic_salary?: number | null
          created_at: string
          employee_name?: string | null
          employee_number?: string | null
          error_message?: string | null
          id: string
          import_id: string
          other_deductions?: number | null
          row_status: string
        };
        Update: {
          allowances?: number | null
          basic_salary?: number | null
          created_at?: string
          employee_name?: string | null
          employee_number?: string | null
          error_message?: string | null
          id?: string
          import_id?: string
          other_deductions?: number | null
          row_status?: string
        };
        Relationships: [];
      };
      salary_imports: {
        Row: {
          created_at: string
          duplicate_rows: number
          filename: string
          id: string
          imported_by: string | null
          invalid_rows: number
          organization_id: string
          salary_period_id: string | null
          status: string
          total_rows: number
          valid_rows: number
        };
        Insert: {
          created_at: string
          duplicate_rows: number
          filename: string
          id: string
          imported_by?: string | null
          invalid_rows: number
          organization_id: string
          salary_period_id?: string | null
          status: string
          total_rows: number
          valid_rows: number
        };
        Update: {
          created_at?: string
          duplicate_rows?: number
          filename?: string
          id?: string
          imported_by?: string | null
          invalid_rows?: number
          organization_id?: string
          salary_period_id?: string | null
          status?: string
          total_rows?: number
          valid_rows?: number
        };
        Relationships: [];
      };
      salary_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          organization_id: string
          payment_date: string
          start_date: string
          status: string
          updated_at: string
        };
        Insert: {
          created_at: string
          end_date: string
          id: string
          name: string
          organization_id: string
          payment_date: string
          start_date: string
          status: string
          updated_at: string
        };
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          organization_id?: string
          payment_date?: string
          start_date?: string
          status?: string
          updated_at?: string
        };
        Relationships: [];
      };
      salary_records: {
        Row: {
          allowances: number
          basic_salary: number
          created_at: string
          employee_id: string
          gross_salary: number
          id: string
          loan_deductions: number
          net_salary: number
          organization_id: string
          other_deductions: number
          salary_period_id: string
          status: string
          updated_at: string
        };
        Insert: {
          allowances: number
          basic_salary: number
          created_at: string
          employee_id: string
          gross_salary: number
          id: string
          loan_deductions: number
          net_salary: number
          organization_id: string
          other_deductions: number
          salary_period_id: string
          status: string
          updated_at: string
        };
        Update: {
          allowances?: number
          basic_salary?: number
          created_at?: string
          employee_id?: string
          gross_salary?: number
          id?: string
          loan_deductions?: number
          net_salary?: number
          organization_id?: string
          other_deductions?: number
          salary_period_id?: string
          status?: string
          updated_at?: string
        };
        Relationships: [];
      };
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          features: Json
          id: string
          max_active_loans: number
          max_branches: number
          max_employees: number
          name: string
          price_annually: number
          price_monthly: number
          updated_at: string
        };
        Insert: {
          active: boolean
          created_at: string
          description?: string | null
          features: Json
          id: string
          max_active_loans: number
          max_branches: number
          max_employees: number
          name: string
          price_annually: number
          price_monthly: number
          updated_at: string
        };
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          max_active_loans?: number
          max_branches?: number
          max_employees?: number
          name?: string
          price_annually?: number
          price_monthly?: number
          updated_at?: string
        };
        Relationships: [];
      };
      subscription_usage: {
        Row: {
          active_loans_count: number
          branches_count: number
          created_at: string
          employees_count: number
          id: string
          notifications_count: number
          organization_id: string
          period_end: string
          period_start: string
          storage_bytes: number
          subscription_id: string
        };
        Insert: {
          active_loans_count: number
          branches_count: number
          created_at: string
          employees_count: number
          id: string
          notifications_count: number
          organization_id: string
          period_end: string
          period_start: string
          storage_bytes: number
          subscription_id: string
        };
        Update: {
          active_loans_count?: number
          branches_count?: number
          created_at?: string
          employees_count?: number
          id?: string
          notifications_count?: number
          organization_id?: string
          period_end?: string
          period_start?: string
          storage_bytes?: number
          subscription_id?: string
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          organization_id: string
          plan_id: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        };
        Insert: {
          canceled_at?: string | null
          created_at: string
          current_period_end?: string | null
          current_period_start?: string | null
          id: string
          organization_id: string
          plan_id: string
          status: string
          trial_ends_at?: string | null
          updated_at: string
        };
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string
          plan_id?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: string
          updated_at: string
          user_id: string
        };
        Insert: {
          created_at: string
          id: string
          organization_id?: string | null
          role: string
          updated_at: string
          user_id: string
        };
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        };
        Relationships: [];
      };
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        };
        Insert: {
          avatar_url?: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at: string
        };
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        };
        Relationships: [];
      };
      withdrawal_requests: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          bank_account_id: string
          created_at: string
          employee_id: string
          failure_reason: string | null
          fee: number
          id: string
          net_amount: number
          notes: string | null
          organization_id: string
          paid_at: string | null
          processed_at: string | null
          processed_by: string | null
          provider_reference: string | null
          reference: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        };
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id: string
          created_at: string
          employee_id: string
          failure_reason?: string | null
          fee: number
          id: string
          net_amount: number
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          provider_reference?: string | null
          reference: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: string
          updated_at: string
        };
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string
          created_at?: string
          employee_id?: string
          failure_reason?: string | null
          fee?: number
          id?: string
          net_amount?: number
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          provider_reference?: string | null
          reference?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      user_has_role: {
        Args: { required_role: string };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OrganizationSettings = Database["public"]["Tables"]["organization_settings"]["Row"];
