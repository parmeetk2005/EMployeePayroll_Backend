// services/payrollService.js
const { v4: uuidv4 } = require('uuid');
const { getRedis } = require('./redisClient');
const { calculatePayroll } = require('../utils/payroll');

const PAYROLL_SET = 'payroll:set'; // all payroll ids

function serialize(obj) {
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
    try {
      v = JSON.parse(v);
    } catch (e) {
      // keep string
    }
    if (!isNaN(v) && typeof v === 'string' && v.trim() !== '') {
      const num = Number(v);
      if (!Number.isNaN(num)) v = num;
    }
    obj[k] = v;
  }
  return obj;
}

async function createPayrollRecord({ employee, employeeSnapshot, period, input }) {
  const redis = getRedis();

  // compute payroll
  const result = calculatePayroll(input);

  // ensure uniqueness: employee + period should be unique -> use key payroll:employee:{id}:period:{period}
  const uniqueKey = `payroll:employee:${employee}:period:${period}`;
  const existing = await redis.get(uniqueKey);
  let id;
  if (existing) {
    id = existing;
  } else {
    id = uuidv4();
    await redis.set(uniqueKey, id);
  }

  const record = {
    id,
    employee,
    employeeSnapshot,
    period,
    grossPay: result.grossPay,
    totalDeductions: result.totalDeductions,
    netPay: result.netPay,
    breakdown: result.breakdown,
    status: 'generated',
    generatedAt: new Date().toISOString()
  };

  await redis.hSet(`payroll:${id}`, serialize(record));
  await redis.sAdd(PAYROLL_SET, id);
  // add to period index
  await redis.sAdd(`payroll:period:${period}`, id);

  // publish pubsub channel for notifications
  await redis.publish('payroll:channel', JSON.stringify({ id: record.id, employee, period, netPay: record.netPay }));

  return record;
}

async function getPayrolls({ employeeId, period }) {
  const redis = getRedis();
  let ids = await redis.sMembers(PAYROLL_SET);
  let items = [];
  for (const id of ids) {
    const raw = await redis.hGetAll(`payroll:${id}`);
    if (!raw || !raw.id) continue;
    items.push(deserialize(raw));
  }
  if (employeeId) items = items.filter(p => p.employee === employeeId);
  if (period) items = items.filter(p => p.period === period);
  return items;
}

async function getPayrollById(id) {
  const redis = getRedis();
  const raw = await redis.hGetAll(`payroll:${id}`);
  return deserialize(raw);
}

async function updatePayroll(id, updates) {
  const redis = getRedis();
  const raw = await redis.hGetAll(`payroll:${id}`);
  if (!raw || !raw.id) throw new Error('Payroll not found');
  const current = deserialize(raw);
  const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };
  await redis.hSet(`payroll:${id}`, serialize(merged));
  return merged;
}

module.exports = { createPayrollRecord, getPayrolls, getPayrollById, updatePayroll };
