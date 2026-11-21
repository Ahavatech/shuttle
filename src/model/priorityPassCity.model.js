import mongoose from "mongoose";

// SCHEMA: This schema is for cities on the priority pass service
const priorityPassCitySchema = new mongoose.Schema(
  {
    cityName: {
      type: String,
      required: true,
    },

    passes: [
      {
        type: mongoose.Types.ObjectId,
        ref: "PriorityPass",
      },
    ],
  },
  { timestamps: true }
);

const priorityPassCityModel = mongoose.model(
  "priorityPassCity",
  priorityPassCitySchema
);

export default priorityPassCityModel;
