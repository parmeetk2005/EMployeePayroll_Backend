// routes/payroll.js
const express = require('express');
const router = express.Router();

const payrollCtrl = require('../controllers/payrollController');
const { authMiddleware, authorizeRoles } = require('../middleware/auth');

// 👉 NEW: Salary calculation route (MUST exist in controller)
router.post(
  '/calc',
  authMiddleware,
  authorizeRoles('admin', 'hr'),
  payrollCtrl.calculatePayroll
);

// Generate payroll (queued job)
router.post(
  '/generate',
  authMiddleware,
  authorizeRoles('admin', 'hr'),
  payrollCtrl.generatePayroll
);

// Update payroll
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles('admin', 'hr'),
  payrollCtrl.updatePayroll
);

// Get payslip
router.get(
  '/:id/payslip',
  authMiddleware,
  authorizeRoles('admin', 'hr', 'employee'),
  payrollCtrl.generatePayslip
);

module.exports = router;
