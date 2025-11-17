// services/queueWorker.js
const { getRedis } = require('./redisClient');
const employeeService = require('./employeeService');
const payrollService = require('./payrollService');

const QUEUE_KEY = 'payroll_tasks'; // list. push: LPUSH, worker: BRPOP

let running = false;

async function startQueueWorker() {
  if (running) return;
  running = true;
  const redis = getRedis();
  console.log('Starting Redis queue worker (blocking BRPOP)...');

  while (running) {
    try {
      // BRPOP returns [key, value] or null on timeout. Use 0 for infinite block.
      const res = await redis.brPop(QUEUE_KEY, 0);
      if (!res) continue;
      const payloadRaw = res.element || res[1] || res[1]; // redis v4 returns {key, element} when streaming; handle both
      const job = JSON.parse(payloadRaw);
      console.log('Worker: picked job', job);
      // job: { employeeId, period, payrollInput, requestedBy }
      // find employee by id (we store employee id)
      const emp = await employeeService.getEmployeeById(job.employeeId);
      if (!emp) {
        console.warn('Worker: employee not found', job.employeeId);
        continue;
      }
      const employeeSnapshot = {
        employeeId: emp.employeeId,
        name: `${emp.firstName} ${emp.lastName || ''}`.trim(),
        designation: emp.designation,
        department: emp.department
      };
      const rec = await payrollService.createPayrollRecord({
        employee: job.employeeId,
        employeeSnapshot,
        period: job.period,
        input: job.payrollInput
      });
      console.log('Worker: payroll created', rec.id);
    } catch (err) {
      console.error('Queue worker error', err);
      // brief delay to avoid tight error loop
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

module.exports = { startQueueWorker };
