const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');

router.post('/register', auth.registerValidators, auth.register);
router.post('/login', auth.loginValidators, auth.login);

module.exports = router;
