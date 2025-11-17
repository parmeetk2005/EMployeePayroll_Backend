// controllers/employeeController.js
const employeeService = require('../services/employeeService');
const { validationResult, body } = require('express-validator');

exports.createValidators = [
  body('employeeId').notEmpty(),
  body('firstName').notEmpty(),
  body('email').isEmail(),
  body('basicSalary').isFloat({ gt: 0 })
];

exports.createEmployee = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const emp = await employeeService.createEmployee(req.body);
    // invalidate caches (simple approach)
    try { const redis = require('../services/redisClient').getRedis(); await redis.del('employees:/api/employees'); } catch (e) {}
    res.status(201).json(emp);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const emp = await employeeService.updateEmployee(req.params.id, req.body);
    try { const redis = require('../services/redisClient').getRedis(); await redis.del(`employee:${req.params.id}`); await redis.del('employees:/api/employees'); } catch (e) {}
    res.json(emp);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    await employeeService.deleteEmployee(req.params.id);
    try { const redis = require('../services/redisClient').getRedis(); await redis.del('employees:/api/employees'); } catch (e) {}
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const results = await employeeService.getEmployees(req.query);
    if (res.locals.cacheKey) {
      try {
        const redis = require('../services/redisClient').getRedis();
        await redis.set(res.locals.cacheKey, JSON.stringify(results), { EX: 60 * 5 });
      } catch (e) {}
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const emp = await employeeService.getEmployeeById(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Not found' });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
