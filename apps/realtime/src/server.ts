import { createApiApp } from "./http/createApiApp.js";

const port = Number.parseInt(
  process.env.PORT ?? process.env.REALTIME_PORT ?? "2567",
  10,
);

const app = createApiApp();

app.listen(port, () => {
  console.log(`KR Geo Guess API listening on port ${port}`);
});
