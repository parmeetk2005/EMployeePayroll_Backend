const express = require('express');
const router = express.Router();
const empCtrl = require('../controllers/employeeController');
const { authMiddleware, authorizeRoles } = require('../middleware/auth');
const { cache } = require('../middleware/cache');

router.post('/', authMiddleware, authorizeRoles('admin', 'hr'), empCtrl.createValidators, empCtrl.createEmployee);
router.put('/:id', authMiddleware, authorizeRoles('admin', 'hr'), empCtrl.updateEmployee);
router.delete('/:id', authMiddleware, authorizeRoles('admin'), empCtrl.deleteEmployee);
router.get('/', authMiddleware, authorizeRoles('admin', 'hr'), cache('employees'), empCtrl.getEmployees);
router.get('/:id', authMiddleware, authorizeRoles('admin', 'hr', 'employee'), empCtrl.getEmployeeById);

module.exports = router;
