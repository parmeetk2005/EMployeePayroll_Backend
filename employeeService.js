// services/employeeService.js
const { v4: uuidv4 } = require('uuid');
const { getRedis } = require('./redisClient');

const EMPLOYEES_SET = 'employees:set'; // set of employee ids

async function createEmployee(payload) {
  const redis = getRedis();
  // require employeeId and email unique checks
  const { employeeId, email } = payload;
  const existsByEmp = await redis.get(`employee:employeeId:${employeeId}`);
  if (existsByEmp) throw new Error('employeeId already exists');
  const existsByEmail = await redis.get(`employee:email:${email}`);
  if (existsByEmail) throw new Error('email already exists');

  const id = uuidv4();
  const record = {
    id,
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await redis.hSet(`employee:${id}`, serialize(record));
  await redis.sAdd(EMPLOYEES_SET, id);
  await redis.set(`employee:employeeId:${employeeId}`, id);
  await redis.set(`employee:email:${email}`, id);
  return record;
}

function serialize(obj) {
  // convert nested objects to JSON strings for hSet
  const out = {};
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    out[k] = (typeof val === 'object') ? JSON.stringify(val) : String(val);
  }
  return out;
}
function deserialize(raw) {
  if (!raw || !raw.id) return null;
  const obj = {};
  for (const k of Object.keys(raw)) {
    let v = raw[k];
    // try parse JSON for nested fields
    try {
      const parsed = JSON.parse(v);
      v = parsed;
    } catch (e) {
      // keep string
    }
    // coerce numbers if applicable
    if (!isNaN(v) && typeof v === 'string' && v.trim() !== '') {
      // careful: JSON.parse already handles numbers inside arrays/objects; leave strings that are numeric
      const num = Number(v);
      if (!Number.isNaN(num)) v = num;
    }
    obj[k] = v;
  }
  return obj;
}

async function updateEmployee(id, updates) {
  const redis = getRedis();
  const raw = await redis.hGetAll(`employee:${id}`);
  if (!raw || !raw.id) throw new Error('Employee not found');
  const current = deserialize(raw);
  const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };
  await redis.hSet(`employee:${id}`, serialize(merged));
  // update email/employeeId indexes if changed
  if (updates.email && updates.email !== current.email) {
    await redis.del(`employee:email:${current.email}`);
    await redis.set(`employee:email:${updates.email}`, id);
  }
  if (updates.employeeId && updates.employeeId !== current.employeeId) {
    await redis.del(`employee:employeeId:${current.employeeId}`);
    await redis.set(`employee:employeeId:${updates.employeeId}`, id);
  }
  return merged;
}

async function deleteEmployee(id) {
  const redis = getRedis();
  const raw = await redis.hGetAll(`employee:${id}`);
  if (!raw || !raw.id) throw new Error('Not found');
  const emp = deserialize(raw);
  await redis.del(`employee:${id}`);
  await redis.sRem(EMPLOYEES_SET, id);
  await redis.del(`employee:email:${emp.email}`);
  await redis.del(`employee:employeeId:${emp.employeeId}`);
  return true;
}

async function getEmployees({ q, department, designation, page = 1, limit = 20 }) {
  const redis = getRedis();
  const ids = await redis.sMembers(EMPLOYEES_SET);
  let items = [];
  for (const id of ids) {
    const raw = await redis.hGetAll(`employee:${id}`);
    if (!raw || !raw.id) continue;
    items.push(deserialize(raw));
  }
  // apply filters/search
  if (q) {
    const r = new RegExp(q, 'i');
    items = items.filter(e => r.test(e.firstName || '') || r.test(e.lastName || '') || r.test(e.email || '') || r.test(e.employeeId || ''));
  }
  if (department) items = items.filter(e => e.department === department);
  if (designation) items = items.filter(e => e.designation === designation);
  const total = items.length;
  const start = (Math.max(1, page) - 1) * limit;
  const paged = items.slice(start, start + Number(limit));
  return { data: paged, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function getEmployeeById(id) {
  const redis = getRedis();
  const raw = await redis.hGetAll(`employee:${id}`);
  return deserialize(raw);
}

module.exports = { createEmployee, updateEmployee, deleteEmployee, getEmployees, getEmployeeById };
