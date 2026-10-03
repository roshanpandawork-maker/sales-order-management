# Payroll v2 customization

## Company payroll rules implemented

1. Enter **total monthly salary** in the employee master.
2. Daily rate is calculated automatically as:
   **Monthly salary ÷ 30**
3. Salary does not change just because the calendar month has 31 or 28/29 days.
4. Every employee has a default **4 paid-leave days per month**.
5. `L` attendance uses the paid-leave quota and does not reduce the monthly salary.
6. `LW` means the employee worked on a paid-leave day. Each LW day adds one daily-rate payment, with a maximum of 4 paid-leave-work days per month.
7. `A` is an unpaid absence and deducts one daily rate.
8. `H` deducts half of one daily rate.
9. Paid leave above the configured quota is treated as unpaid at the daily rate.
10. Bonus and Overtime are additions; Advance and Deduction are subtractions.
11. Unmarked attendance is not automatically treated as absence, so the administrator can complete the attendance sheet without accidental salary deductions.

## New attendance cycle

`P → H → L → LW → A → blank`

- P = Present
- H = Half day
- L = Paid leave
- LW = Worked on paid leave (extra daily-rate payment)
- A = Absent

## Files changed

- `js/payroll.js`
- `supabase/04_payroll.sql`
- `CHANGES.md`

Run the updated `supabase/04_payroll.sql` in Supabase before using the new Payroll v2 fields/status.
