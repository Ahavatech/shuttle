import AdminModel from "../model/admin.model.js";
import PriorityPassModel from "../model/priorityPass.model.js";
import priorityPassCityModel from "../model/priorityPassCity.model.js";
import AdminService from "../service/AdminService.js";
import PriorityPassService from "../service/PriorityPassService.js";

// Generic messages
const internalServerError =
  "An error occured while we processed your request. Please try again.";

// SERVICE INSTANCES
// Create a new priorityPassService instance
const priorityPassService = new PriorityPassService(PriorityPassModel);
const adminService = new AdminService(AdminModel);

// PRIORITY PASSES
// Get Passes (now effectively "Get Passes for a Specific City")
export const fetchPasses = async (req, res) => {
  try {
    const { userCountry, isAdminRequest, cityId, city } = req.query; // Destructure cityId

    let cityIdToUse = cityId; // Use a different variable to avoid confusion

    if (city) {
      // If city is provided, we can use it to fetch the cityId
      const cityData = await priorityPassCityModel.findOne({ cityName: city });
      if (!cityData) {
        return res.status(404).json({
          message: "City not found.",
          status: 404,
        });
      }
      // Use the cityId from the fetched city data
      cityIdToUse = cityData._id; // Assuming cityData has an _id field
      console.log("city id to use:", cityIdToUse);
    }

    // Validate if cityId is present
    if (!cityIdToUse) {
      return res.status(400).json({
        message: "cityId is required to fetch passes for a specific city.",
        status: 400,
      });
    }

    // Fetch passes for the specified city
    // Instead of priorityPassService.getPasses, we'll use AdminService.getCity
    // This assumes you have access to an `adminService` instance here.
    // If not, you might need to import AdminService and instantiate it, or adjust your dependency injection.
    // For this example, let's assume 'adminService' is available globally or imported.
    const response = await adminService.getCity(
      cityIdToUse, // Use the cityId from the query or fetched from the city name
      userCountry,
      isAdminRequest,
      "priority" // Specify the type as 'priority'
    );

    console.log("city:", response?.city);

    // Return a response
    return res.status(response?.status).json({
      // We are now returning the entire city object, which contains the 'passes' array
      passes: response?.city?.passes ?? null,
      currency: response?.currency ?? null, // Currency might still be relevant if converted
      message: response?.message,
    });
  } catch (error) {
    console.error("Error fetching passes (by city):", error); // More specific error logging
    // Ensure `internalServerError` is defined where this controller is used
    return res
      .status(500)
      .json({ message: internalServerError, error: error.message });
  }
};
