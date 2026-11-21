import express from "express";
import cors from "cors";

export default async function expressLoader(app) {
  // DEMO ONLY: allow any origin so the demo frontend can call the API
  app.use(cors());
  app.enable("trust proxy");
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: false }));
  return app;
}
