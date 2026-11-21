import express from "express";
import {
  getCarRentalCities,
  getCities,
  getPriorityPassCities,
} from "../controller/user.controller.js";

const cityRouter = express.Router();

// Routes
// Get Airport Transfer Cities
cityRouter.get("/", getCities);
// Get Car Rental Cities
cityRouter.get("/car-rental", getCarRentalCities);
// Get Priority Pass Cities
cityRouter.get("/priority-pass", getPriorityPassCities);

export default cityRouter;
