// controllers/payrollController.js
const employeeService = require('../services/employeeService');
const payrollService = require('../services/payrollService');
const { getRedis } = require('../services/redisClient');

exports.generatePayroll = async (req, res) => {
  try {
    const { employeeId, period, customDeductions = 0, professionalTaxCountry = 'IN', bonus = 0 } = req.body;
    const emp = await employeeService.getEmployeeById(employeeId);
    if (!emp) return res.status(404).json({ message: 'Employee not found' });

    // build payrollInput
    const payrollInput = {
      basic: Number(emp.basicSalary),
      allowances: emp.allowances || {},
      bonus: Number(bonus) || 0,
      customDeductions: Number(customDeductions) || 0,
      professionalTaxCountry
    };

    // push job to redis list
    const redis = getRedis();
    const job = { employeeId: emp.id, period, payrollInput, requestedBy: req.user.id };
    await redis.lPush('payroll_tasks', JSON.stringify(job));
    // respond accepted
    res.status(202).json({ message: 'Payroll job queued', job });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.viewPayroll = async (req, res) => {
  try {
    const { employeeId, period } = req.query;
    const data = await payrollService.getPayrolls({ employeeId, period });
    if (res.locals.cacheKey) {
      try {
        const redis = getRedis();
        await redis.set(res.locals.cacheKey, JSON.stringify({ data }), { EX: 60 * 5 });
      } catch (e) {}
    }
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePayroll = async (req, res) => {
  try {
    const pay = await payrollService.updatePayroll(req.params.id, req.body);
    try { const redis = getRedis(); await redis.del(`payroll:${req.params.id}`); await redis.del('payroll:/api/payroll'); } catch (e) {}
    res.json(pay);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.generatePayslip = async (req, res) => {
  try {
    const payroll = await payrollService.getPayrollById(req.params.id);
    if (!payroll) return res.status(404).json({ message: 'Not found' });
    const payslip = {
      employee: payroll.employeeSnapshot,
      period: payroll.period,
      grossPay: payroll.grossPay,
      totalDeductions: payroll.totalDeductions,
      netPay: payroll.netPay,
      breakdown: payroll.breakdown
    };
    res.json({ payslip });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
