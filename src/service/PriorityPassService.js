// @ts-nocheck
import CurrencyModel from "../model/currency.model.js";
import { validateFields } from "../util/auth.helper.js";
import { convertAmountToUserCurrency } from "../util/index.js";
import PriorityPassCityModel from "../model/priorityPassCity.model.js"; // Import the city model for passes

export default class PriorityPassService {
  constructor(ShuttlelanePriorityPassModel) {
    this.PriorityPassModel = ShuttlelanePriorityPassModel;
  }

  // This service CREATES a new priority pass and ADDS it to a city
  async createPass(name, price, cityId) {
    // Added cityId here
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([name, price, cityId]);

    if (areFieldsEmpty) return areFieldsEmpty;

    // Find the city
    const city = await PriorityPassCityModel.findById(cityId);
    if (!city) {
      return {
        status: 404,
        message: "City not found.",
      };
    }

    // Check if a pass with the same name already exists within THIS city
    // You might need a more robust check if `name` is unique only per city,
    // or if it's globally unique. For now, we'll check against existing passes
    // that are *associated* with this city.
    // This requires populating passes or iterating through them.
    await city.populate("passes"); // Populate to check existing names
    const passExistsInCity = city.passes.some((p) => p.name === name);

    if (passExistsInCity) {
      return {
        status: 409,
        message: `A pass with the name '${name}' already exists in ${city.cityName}. Try adding a pass with a different name.`,
      };
    }

    const newPass = await this.PriorityPassModel.create({
      name,
      price,
      // If you added `city` reference in PriorityPassModel, add it here:
      // city: cityId,
    });

    // Add the new pass's ID to the city's passes array
    city.passes.push(newPass._id);
    await city.save();

    // Re-fetch the city with populated passes to send updated data to frontend
    // This is important because the frontend expects the `city` object with its `passes`
    const updatedCity = await PriorityPassCityModel.findById(cityId).populate(
      "passes"
    );

    return {
      status: 201,
      message: `Pass '${name}' created successfully in ${city.cityName}!`,
      city: updatedCity, // Return the updated city with populated passes
    };
  }

  // This service fetches all passes (GLOBAL) - reconsider if truly needed if passes are city-specific
  // If your frontend only ever asks for passes *within a city*, this method might be deprecated or changed.
  // For now, keeping it as is, but it will only return all passes, not city-specific ones.
  // The `getCity` method in `AdminService` will be the primary way to get city-specific passes.
  async getPasses(userCountry, isAdminRequest) {
    const passes = await this.PriorityPassModel.find({});

    if (isAdminRequest) {
      return {
        status: 200,
        message: `Passes fetched`,
        passes: passes,
      };
    }

    const allowedCurrency = await CurrencyModel.findOne({
      supportedCountries: { $in: [userCountry] },
    });

    let passesWithConvertedRates = [];
    const currencyToUse =
      allowedCurrency ||
      (await CurrencyModel.findOne({ symbol: "$", alias: "USD" }));

    if (passes?.length > 0) {
      for (const pass of passes) {
        const convertedRate = await convertAmountToUserCurrency(
          currencyToUse,
          pass.price,
          false
        );
        passesWithConvertedRates.push({
          ...pass.toObject(),
          price: convertedRate,
        });
      }
    }

    return {
      status: 200,
      message: `Passes fetched`,
      passes: passesWithConvertedRates,
      currency: currencyToUse,
    };
  }

  // This service fetches a single pass by its ID (global lookup)
  async getPass(passId) {
    const areFieldsEmpty = validateFields([passId]);
    if (areFieldsEmpty) return areFieldsEmpty;

    const pass = await this.PriorityPassModel.findById(passId);

    if (!pass) {
      return {
        status: 404,
        message: `No pass with _id ${passId} exists.`,
      };
    }

    return {
      status: 200,
      message: `Pass fetched`,
      pass: pass,
    };
  }

  // This service UPDATES a pass within a specific city
  async updatePass(passId, values, cityId) {
    // Added cityId
    const areFieldsEmpty = validateFields([passId, values, cityId]);

    if (areFieldsEmpty) return areFieldsEmpty;

    // Find the pass globally
    const pass = await this.PriorityPassModel.findById(passId);
    if (!pass) {
      return {
        status: 404,
        message: `No pass with _id ${passId} exists.`,
      };
    }

    // Update the pass document
    pass.set(values);
    await pass.save();

    // Re-fetch the city with populated passes to send updated data to frontend
    const updatedCity = await PriorityPassCityModel.findById(cityId).populate(
      "passes"
    );

    return {
      status: 201,
      message: `Pass updated successfully.`,
      city: updatedCity, // Return the updated city with populated passes
    };
  }

  // This service DELETES a pass from a specific city
  async deletePass(passId, cityId) {
    // Added cityId
    const areFieldsEmpty = validateFields([passId, cityId]);

    if (areFieldsEmpty) return areFieldsEmpty;

    // Find the city
    const city = await PriorityPassCityModel.findById(cityId);
    if (!city) {
      return {
        status: 404,
        message: "City not found.",
      };
    }

    console.log("HI FROM HERE 1 =>", city);

    // Remove the pass ID from the city's passes array
    city.passes = city.passes.filter(
      (id) => id.toString() !== passId.toString()
    );
    console.log("HI FROM HERE 2 =>", city.passes);
    await city.save();

    // Delete the pass document itself (optional, but good for cleanup)
    const pass = await this.PriorityPassModel.deleteOne({ _id: passId });

    console.log("HI FROM HERE 3 =>", pass);

    if (!pass) {
      // It's possible the pass was already removed from the city array,
      // but the pass document might not have existed.
      // We'll still return success if it was removed from the city's array.
      console.warn(`Pass document with _id ${passId} not found for deletion.`);
    }

    console.log("HI FROM HERE 4 =>", pass);
    // Re-fetch the city with populated passes to send updated data to frontend
    const updatedCity = await PriorityPassCityModel.findById(cityId).populate(
      "passes"
    );

    return {
      status: 201,
      message: `Pass deleted successfully from ${city.cityName}.`,
      city: updatedCity, // Return the updated city with populated passes
    };
  }
}
