require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");

const { connectRedis, getRedis } = require("./services/redisClient");
const authRoutes = require("./routes/auth");
const employeeRoutes = require("./routes/employees");
const payrollRoutes = require("./routes/payroll");

const { initSocket } = require("./services/socketService");
const nodeCron = require("node-cron");

const http = require("http");

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/payroll", payrollRoutes);

app.get("/health", (req, res) =>
  res.json({ status: "ok", time: new Date() })
);

async function start() {
  const PORT = process.env.PORT || 5000;

  if (!process.env.REDIS_URL) throw new Error("REDIS_URL not set");

  await connectRedis(process.env.REDIS_URL);

  const server = http.createServer(app);
  const io = initSocket(server);

  // -------------------------------
  // FIX: SAFE NON-BLOCKING QUEUE POLLING
  // -------------------------------
  const redis = getRedis();

  setInterval(async () => {
    try {
      const task = await redis.lPop("payroll_tasks"); // NON-BLOCKING
      if (task) {
        const data = JSON.parse(task);
        console.log("Processing payroll task:", data);

        // broadcast via WebSocket to UI
        io.emit("payrollGenerated", data);
      }
    } catch (err) {
      console.error("Queue polling error:", err);
    }
  }, 500); // safe polling every 500ms

  // --------------------------------
  // CRON JOB (safe)
  // --------------------------------
  if (process.env.ENABLE_CRON === "true") {
    const schedule = process.env.CRON_SCHEDULE || "0 1 * * *";

    nodeCron.schedule(schedule, async () => {
      try {
        console.log("Cron: queue monthly payroll for all employees");

        const employeeService = require("./services/employeeService");
        const all = await employeeService.getEmployees({
          page: 1,
          limit: 1000000,
        });

        const period = new Date().toISOString().slice(0, 7);

        for (const e of all.data) {
          const job = {
            employeeId: e.id,
            period,
            payrollInput: {
              basic: Number(e.basicSalary),
              allowances: e.allowances || {},
              bonus: 0,
              customDeductions: 0,
              professionalTaxCountry: "IN",
            },
            requestedBy: "cron",
          };

          await redis.lPush("payroll_tasks", JSON.stringify(job));
        }
      } catch (e) {
        console.error("Cron error:", e);
      }
    });

    console.log("Cron scheduled:", schedule);
  }

  // Start server
  server.listen(PORT, () =>
    console.log(`Server running with WebSocket on port ${PORT}`)
  );
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
