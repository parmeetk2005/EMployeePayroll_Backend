// controllers/authController.js
const userService = require('../services/userService');
const { generateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

exports.registerValidators = [
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
];

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, email, password, role } = req.body;
  try {
    const user = await userService.createUser({ name, email, password, role });
    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.loginValidators = [
  body('email').isEmail(),
  body('password').notEmpty()
];

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password } = req.body;
  try {
    const user = await userService.findUserByEmail(email);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const match = await userService.comparePassword(user.password, password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    const token = generateToken(user);
    const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ token, user: publicUser });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
