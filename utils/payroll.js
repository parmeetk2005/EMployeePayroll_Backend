/**
 * Payroll Calculation Utility (same logic as earlier)
 */
const { isNumber } = require('./validation');

function calcIncomeTax(annualIncome, country = 'IN') {
  let tax = 0;
  if (country === 'IN') {
    if (annualIncome <= 250000) tax = 0;
    else if (annualIncome <= 500000) tax = (annualIncome - 250000) * 0.05;
    else if (annualIncome <= 1000000) tax = (250000 * 0.05) + (annualIncome - 500000) * 0.2;
    else tax = (250000 * 0.05) + (500000 * 0.2) + (annualIncome - 1000000) * 0.3;
  } else {
    tax = annualIncome * 0.15;
  }
  return tax;
}

function calcProfessionalTax(monthlyGross, country = 'IN') {
  if (country === 'IN') {
    if (monthlyGross <= 15000) return 150;
    if (monthlyGross <= 25000) return 200;
    return 250;
  }
  if (country === 'US') return 0;
  return 0;
}

function calculatePF(basic, pfPercent = 12) {
  const employee = (basic * pfPercent) / 100;
  const employer = employee;
  return { employee, employer };
}

function validatePayrollInput(input) {
  if (!isNumber(input.basic) || input.basic <= 0) return { valid: false, message: 'Invalid basic salary' };
  if (input.allowances) {
    const { hra = 0, conveyance = 0, special = 0 } = input.allowances;
    if (![hra, conveyance, special].every(a => isNumber(a))) return { valid: false, message: 'Invalid allowances' };
  }
  if (input.bonus && !isNumber(input.bonus)) return { valid: false, message: 'Invalid bonus' };
  if (input.customDeductions && !isNumber(input.customDeductions)) return { valid: false, message: 'Invalid custom deductions' };
  return { valid: true };
}

function calculatePayroll(input) {
  const { basic, allowances = {}, bonus = 0, customDeductions = 0, professionalTaxCountry = 'IN' } = input;
  const v = validatePayrollInput(input);
  if (!v.valid) throw new Error(v.message);

  const totalEarnings = basic + (allowances.hra || 0) + (allowances.conveyance || 0) + (allowances.special || 0) + (bonus || 0);
  const grossPay = totalEarnings;

  const annualIncome = grossPay * 12;
  const annualTax = calcIncomeTax(annualIncome, professionalTaxCountry);
  const monthlyTax = annualTax / 12;

  const tds = monthlyTax;
  const professionalTax = calcProfessionalTax(grossPay, professionalTaxCountry);

  const pf = calculatePF(basic);
  const pfEmployee = pf.employee;
  const pfEmployer = pf.employer;

  const tax = monthlyTax;
  const totalDeductions = tax + tds + professionalTax + pfEmployee + (customDeductions || 0);

  const netPay = Math.max(0, grossPay - totalDeductions);

  const breakdown = {
    tax: Number(tax.toFixed(2)),
    tds: Number(tds.toFixed(2)),
    professionalTax: Number(professionalTax.toFixed(2)),
    pfEmployer: Number(pfEmployer.toFixed(2)),
    pfEmployee: Number(pfEmployee.toFixed(2)),
    customDeductions: Number((customDeductions || 0).toFixed(2))
  };

  return {
    grossPay: Number(grossPay.toFixed(2)),
    totalDeductions: Number(totalDeductions.toFixed(2)),
    netPay: Number(netPay.toFixed(2)),
    breakdown
  };
}

module.exports = { calculatePayroll, validatePayrollInput };
