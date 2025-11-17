// services/userService.js
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { getRedis } = require('./redisClient');

const USERS_SET = 'users:set';

async function createUser({ name, email, password, role = 'employee' }) {
  const redis = getRedis();

  // check existing by email: store email->id mapping
  const existingId = await redis.get(`user:email:${email}`);
  if (existingId) throw new Error('Email already in use');

  const id = uuidv4();
  const hashed = await bcrypt.hash(password, 10);
  const userObj = { id, name, email, password: hashed, role, createdAt: new Date().toISOString() };

  await redis.hSet(`user:${id}`, userObj);
  await redis.sAdd(USERS_SET, id);
  await redis.set(`user:email:${email}`, id);
  return { id, name, email, role };
}

async function findUserByEmail(email) {
  const redis = getRedis();
  const id = await redis.get(`user:email:${email}`);
  if (!id) return null;
  const raw = await redis.hGetAll(`user:${id}`);
  if (!raw || !raw.id) return null;
  return { ...raw };
}

async function findUserById(id) {
  const redis = getRedis();
  const raw = await redis.hGetAll(`user:${id}`);
  if (!raw || !raw.id) return null;
  return { ...raw };
}

async function comparePassword(storedHash, candidate) {
  return bcrypt.compare(candidate, storedHash);
}

module.exports = { createUser, findUserByEmail, findUserById, comparePassword };
