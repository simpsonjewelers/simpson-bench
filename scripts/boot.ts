import { spawn } from "node:child_process"
import { getDb } from "../lib/db"
import { seedDemo } from "./seed"

async function main() {
  if (!process.env.PORT) process.env.PORT = "3847"
  const demoMode = process.env.DEMO_MODE === "1" || process.env.DEMO_MODE === "true"
  const seed = demoMode || process.env.SEED_DEMO === "1" || process.env.SEED_DEMO === "true"
  if (demoMode) {
    console.log("Demo mode: reseeding sample tickets. Data on this instance resets at every boot.")
    await seedDemo(true)
  } else if (seed) {
    const row = getDb().prepare("SELECT COUNT(*) AS n FROM items").get() as { n: number }
    if (!row.n) {
      console.log("SEED_DEMO is set and the bench is empty. Loading sample tickets.")
      await seedDemo(false)
    }
  }

  const child = spawn(process.execPath, ["./node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"], {
    stdio: "inherit",
    env: process.env,
  })
  const stop = (signal: NodeJS.Signals) => child.kill(signal)
  process.on("SIGTERM", () => stop("SIGTERM"))
  process.on("SIGINT", () => stop("SIGINT"))
  child.on("exit", (code) => process.exit(code ?? 0))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
