import express from "express";
import { loadConfig } from "./config";

const config = loadConfig();
const app = express();

app.listen(config.port, () => {
  console.log(`listening on port ${config.port}`);
});
