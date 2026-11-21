import bcrypt from "bcryptjs";
import {
  generateVerificationCode,
  jwtSign,
  validateFields,
  validateUserLoginDetails,
} from "../util/auth.helper.js";
import jsonwebtoken from "jsonwebtoken";
import { checkUserEmailValidity } from "../util/db.helper.js";
import PaymentModel from "../model/payment.model.js";
import BookingModel from "../model/booking.model.js";
import CityModel from "../model/city.model.js";
import VisaOnArrivalRateModel from "../model/visaOnArrivalRate.model.js";
import EnquiryNotificationTemplate from "../emailTemplates/adminEmailTemplates/EnquiryNotificationEmail/index.js";
import { sendEmail } from "../util/sendgrid.js";
import ReactDOMServer from "react-dom/server";
import CurrencyModel from "../model/currency.model.js";
import { convertAmountToUserCurrency } from "../util/index.js";
import VerificationModel from "../model/verification.model.js";
import { sendSMS } from "../util/twilio.js";
import CarRentalCityModel from "../model/carRentalCity.model.js";
import priorityPassCityModel from "../model/priorityPassCity.model.js";

export default class UserService {
  constructor(ShuttlelaneUserModel) {
    this.UserModel = ShuttlelaneUserModel;
  }

  // This service CREATES a new user - Sign up service
  async signupUser(user) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([
      user.firstName,
      user.lastName,
      user.emailAddress,
      user.phoneNumber,
      user.password,
    ]);

    console.log(
      "FIELDS",
      user.firstName,
      user.lastName,
      user.emailAddress,
      user.phoneNumber,
      user.password
    );

    console.log("ARE FIELDS EMPTY:", areFieldsEmpty);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if user is already signed up
    const userAlreadyExistsWithEmail = await checkUserEmailValidity(
      user.emailAddress
    );

    // If user email already exists
    if (userAlreadyExistsWithEmail.status === 409)
      return userAlreadyExistsWithEmail;

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = await bcrypt.hash(user.password, salt);

    console.log("hp:", hashedPassword);

    // If the email is available, then proceed to sign up the user
    const newUser = await this.UserModel.create({
      ...user,
      password: hashedPassword,
    });

    // TO-DO: Send phone verification SMS here
    // Generate verification code
    const smsVerificationCode = generateVerificationCode(4); // '4' refers to the
    // Add verification code to the verification model
    const verificationRecord = await VerificationModel.create({
      userId: newUser?._id,
      code: smsVerificationCode,
    });
    // Update User document to include the verification
    const userVerification = await this.UserModel.findOneAndUpdate(
      { _id: newUser?._id },
      {
        phoneVerification: true,
      }
    );

    // Send sms
    const smsMessage = `Welcome to Shuttlelane! Use this code to verify your phone number: ${smsVerificationCode}`;
    await sendSMS(newUser.phoneNumber, smsMessage)
      .then((res) => console.log("SMS sent successfully!"))
      .catch((err) =>
        console.log(
          "An error occured while sending the verification SMS => ",
          err
        )
      );

    const token = jwtSign(newUser);

    // TO-DO: Send confirmation email here
    console.log("HELLO:", newUser);

    return {
      status: 201,
      message: "Your account has been created successfully!",
      user: newUser,
      token,
    };
  }

  // This service logs in the user
  async loginUser(email, password) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([email, password]);

    console.log("ARE FIELDS EMPTY:", areFieldsEmpty);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // If the fields are not empty, check the DB for email
    const userExists = await validateUserLoginDetails(email, password);

    return userExists;
  }

  // This service GETS a user by their email
  async getUserByEmail(email) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([email]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any user exists with the email
    const user = await this.UserModel.findOne({
      email: email,
    }).populate({
      path: "bookings",
    });

    if (!user) {
      return {
        status: 404,
        message: "No user exists with the email specified.",
        user: user,
      };
    }

    return {
      status: 200,
      message: `Fetched user with email ${email}.`,
      user: user,
    };
  }

  // This service GETS a user by their id
  async getUserById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any user exists with the username
    const user = await this.UserModel.findOne({
      _id: _id,
    }).populate({
      path: "bookings",
    });

    if (!user) {
      return {
        status: 404,
        message: "No user exists with the id specified.",
        user: user,
      };
    }

    return {
      status: 200,
      message: `Fetched user with id ${_id}.`,
      user: user,
    };
  }

  // This service DELETES user by email
  // TO-DO: Send OTP along with the email to verify the user is actually sending the request to delete his/her account
  async deleteUserByEmail(email) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([email]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any user exists with the email
    const user = await this.UserModel.findOneAndRemove({ email: email });

    if (!user) {
      return {
        status: 404,
        message: `No user with email ${email} exists.`,
      };
    }

    return {
      status: 201,
      message: `User with email ${email} has been deleted successfully.`,
    };
  }

  // This service DELETES user by id
  async deleteUserById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any user exists with the _id
    const user = await this.UserModel.findOneAndRemove({ _id: _id });

    if (!user) {
      return {
        status: 404,
        message: `No user with _id ${_id} exists.`,
      };
    }

    return {
      status: 201,
      message: `User with _id ${_id} has been deleted successfully.`,
    };
  }

  // This service UPDATES a user by id
  async updateUserById(_id, updatedUser) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id, updatedUser]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any user exists with the _id
    const user = await this.UserModel.findOneAndUpdate(
      { _id: _id },
      { ...updatedUser }
    );

    if (!user) {
      return {
        status: 404,
        message: `No user with _id ${_id} exists.`,
      };
    }

    return {
      status: 201,
      message: `User with _id ${_id} has been updated successfully.`,
    };
  }

  // This service GETS the user's total spend by the user id
  async getUserTotalSpendByUserId(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Fetch all payments with the _id provided
    const payments = await PaymentModel.find({ userId: _id });

    return {
      status: 200,
      message: `All user's payments have been fetched successfully.`,
      payments: payments,
    };
  }

  // This service GETS the user's bookings the user id
  async getUserBookingsByUserId(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Fetch all bookings with the _id provided
    const bookings = await BookingModel.find({ user: _id });

    console.log("BOOKINGS:", bookings);

    return {
      status: 200,
      message: `All user's bookings have been fetched successfully.`,
      bookings: bookings,
    };
  }

  // This service GETS all cities - BY DEFAULT this is airport transfer cities
  async getCities(type, userCountry) {
    let cities;
    let itemsToConvert = []; // Will store the field name to convert based on type

    // Fetch cities based on type
    switch (type) {
      case "airport":
        cities = await CityModel.find({})
          .sort({ cityName: 1 })
          .populate("vehicleClasses")
          .populate("cars");
        itemsToConvert = ["vehicleClasses"]; // Convert vehicleClasses.basePrice
        break;

      case "car":
        cities = await CarRentalCityModel.find({})
          .sort({ cityName: 1 })
          .populate("cars");
        itemsToConvert = ["cars"]; // Convert cars.price
        break;

      case "priority":
        cities = await priorityPassCityModel
          .find({})
          .sort({ cityName: 1 })
          .populate("passes");
        itemsToConvert = ["passes"]; // Convert passes.price
        break;

      default:
        return {
          status: 400,
          message: `Invalid type provided`,
          cities: [],
        };
    }

    // If no userCountry provided, return cities without conversion
    if (!userCountry) {
      return {
        status: 200,
        message: `Cities fetched`,
        cities: cities,
      };
    }

    // Get currency based on user's country
    let allowedCurrency;
    try {
      allowedCurrency = await CurrencyModel.findOne({
        supportedCountries: { $in: [userCountry] },
      });
    } catch (err) {
      console.log("ERROR fetching currency:", err);
    }

    // If no currency found for user's country, default to USD
    if (!allowedCurrency) {
      try {
        allowedCurrency = await CurrencyModel.findOne({
          symbol: "$",
          alias: "USD",
        });
      } catch (err) {
        console.log("ERROR fetching default currency:", err);
        // Return without conversion if currency fetch fails
        return {
          status: 200,
          message: `Cities fetched (no currency conversion)`,
          cities: cities,
        };
      }
    }

    // Convert rates for each city
    const citiesWithConvertedRates = [];

    for (const city of cities) {
      const cityWithConvertedRate = {
        _id: city._id,
        cityName: city.cityName,
      };

      // Convert rates based on type
      for (const itemType of itemsToConvert) {
        if (city[itemType] && Array.isArray(city[itemType])) {
          const convertedItems = [];

          for (const item of city[itemType]) {
            let convertedItem = { ...item.toObject() }; // Convert mongoose doc to plain object

            try {
              // Determine which price field to convert based on type
              let priceField;
              switch (itemType) {
                case "vehicleClasses":
                  priceField = "basePrice";
                  break;
                case "cars":
                  priceField = "price";
                  break;
                case "passes":
                  priceField = "price";
                  break;
                default:
                  priceField = "price";
              }

              // Convert the price if it exists
              if (item[priceField] !== undefined) {
                const convertedRate = await convertAmountToUserCurrency(
                  allowedCurrency,
                  item[priceField]
                );
                convertedItem[priceField] = convertedRate;
              }
            } catch (err) {
              console.log(`ERROR converting ${itemType} rate:`, err);
              // Keep original price if conversion fails
            }

            convertedItems.push(convertedItem);
          }

          cityWithConvertedRate[itemType] = convertedItems;
        } else {
          // If the field doesn't exist or isn't an array, keep original
          cityWithConvertedRate[itemType] = city[itemType];
        }
      }

      // Add any other fields that might exist (like airports for airport type)
      Object.keys(city.toObject()).forEach((key) => {
        if (
          !itemsToConvert.includes(key) &&
          !["_id", "cityName"].includes(key)
        ) {
          cityWithConvertedRate[key] = city[key];
        }
      });

      citiesWithConvertedRates.push(cityWithConvertedRate);
    }

    // Return response with converted rates
    return {
      status: 200,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} cities fetched`,
      cities: citiesWithConvertedRates,
      currency: allowedCurrency,
    };
  }

  // This service GETS all car rental cities
  async getCarRentalCities(userCountry) {
    // Fetch cities
    const cities = await CarRentalCityModel.find({})
      .sort({ cityName: 1 })
      .populate("cars");

    // Get currency (UPDATE LATER TO INCLUDE MORE THAN ONE COUNTRY) where the userCountry is listed
    const allowedCurrency = await CurrencyModel.findOne({
      supportedCountries: { $in: [userCountry] },
    })
      .then((res) => {
        return res;
      })
      .catch((err) => {
        console.log("ERROR:", err);
      });

    // Check if the user's country has been added to a currency
    if (allowedCurrency) {
      let citiesWithConvertedRates = [];

      for (let i = 0; i < cities?.length; i++) {
        let carsWithConvertedRates = [];
        for (let i = 0; i < cities[i]?.cars?.length; i++) {
          let convertedRate = await convertAmountToUserCurrency(
            allowedCurrency,
            cities[i]?.cars[i]?.price
          );
          cities[i].cars[i].price = convertedRate;
          carsWithConvertedRates.push(cities[i]?.cars[i]);
        }

        let cityWithConvertedRate = {
          _id: cities[i]?._id,
          cityName: cities[i]?.cityName,
          cars: carsWithConvertedRates,
        };
        citiesWithConvertedRates.push(cityWithConvertedRate);
      }

      // Return a response
      return {
        status: 200,
        message: `Car rental cities fetched`,
        cities: citiesWithConvertedRates,
        currency: allowedCurrency,
      };
    } else {
      // Default to Dollars
      const userCurrency = await CurrencyModel.findOne({
        symbol: "$",
        alias: "USD",
      });

      let citiesWithConvertedRates = [];

      for (let i = 0; i < cities?.length; i++) {
        let carsWithConvertedRates = [];
        for (let i = 0; i < cities[i]?.cars?.length; i++) {
          let convertedRate = await convertAmountToUserCurrency(
            userCurrency,
            cities[i]?.cars[i]?.price
          );
          cities[i].cars[i].price = convertedRate;
          carsWithConvertedRates.push(cities[i]?.cars[i]);
        }

        let cityWithConvertedRate = {
          _id: cities[i]?._id,
          cityName: cities[i]?.cityName,
          cars: carsWithConvertedRates,
        };
        citiesWithConvertedRates.push(cityWithConvertedRate);
      }

      // Return a response
      return {
        status: 200,
        message: `Car rental cities fetched`,
        cities: citiesWithConvertedRates,
        currency: userCurrency,
      };
    }
  }

  // This service GETS all priority pass cities
  async getPriorityPassCities(userCountry) {
    // Fetch cities
    const cities = await priorityPassCityModel
      .find({})
      .sort({ cityName: 1 })
      .populate("passes");

    // Get currency (UPDATE LATER TO INCLUDE MORE THAN ONE COUNTRY) where the userCountry is listed
    const allowedCurrency = await CurrencyModel.findOne({
      supportedCountries: { $in: [userCountry] },
    })
      .then((res) => {
        return res;
      })
      .catch((err) => {
        console.log("ERROR:", err);
      });

    // Check if the user's country has been added to a currency
    if (allowedCurrency) {
      let citiesWithConvertedRates = [];

      for (let i = 0; i < cities?.length; i++) {
        let passesWithConvertedRates = [];
        for (let i = 0; i < cities[i]?.passes?.length; i++) {
          let convertedRate = await convertAmountToUserCurrency(
            allowedCurrency,
            cities[i]?.passes[i]?.price
          );
          cities[i].passes[i].price = convertedRate;
          passesWithConvertedRates.push(cities[i]?.passes[i]);
        }

        let cityWithConvertedRate = {
          _id: cities[i]?._id,
          cityName: cities[i]?.cityName,
          passes: passesWithConvertedRates,
        };
        citiesWithConvertedRates.push(cityWithConvertedRate);
      }

      // Return a response
      return {
        status: 200,
        message: `Priority pass cities fetched`,
        cities: citiesWithConvertedRates,
        currency: allowedCurrency,
      };
    } else {
      // Default to Dollars
      const userCurrency = await CurrencyModel.findOne({
        symbol: "$",
        alias: "USD",
      });

      let citiesWithConvertedRates = [];

      for (let i = 0; i < cities?.length; i++) {
        let passesWithConvertedRates = [];
        for (let i = 0; i < cities[i]?.passes?.length; i++) {
          let convertedRate = await convertAmountToUserCurrency(
            userCurrency,
            cities[i]?.passes[i]?.price
          );
          cities[i].passes[i].price = convertedRate;
          passesWithConvertedRates.push(cities[i]?.passes[i]);
        }

        let cityWithConvertedRate = {
          _id: cities[i]?._id,
          cityName: cities[i]?.cityName,
          passes: passesWithConvertedRates,
        };
        citiesWithConvertedRates.push(cityWithConvertedRate);
      }

      // Return a response
      return {
        status: 200,
        message: `Priority pass cities fetched`,
        cities: citiesWithConvertedRates,
        currency: userCurrency,
      };
    }
  }

  // VISA ON ARRIVAL RATES
  // This service GETS all visa on arrival rates
  async getVisaOnArrivalRates() {
    // Get visaOnArrivalRates
    const visaOnArrivalRates = await VisaOnArrivalRateModel.find({}).sort({
      createdAt: -1,
    });

    return {
      status: 200,
      message: `Fetched visa on arrival rates.`,
      visaOnArrivalRates: visaOnArrivalRates,
    };
  }
  // This service GETS all visa on arrival rates THAT REQUIRE NIGERIAN VISA
  async getVisaOnArrivalRatesWithNigerianVisa() {
    // Get getVisaOnArrivalRatesWithNigerianVisa
    const visaOnArrivalRates = await VisaOnArrivalRateModel.find({
      isNigerianVisaRequired: true,
    }).sort({
      createdAt: -1,
    });

    console.log("VOA RATES:", visaOnArrivalRates);

    return {
      status: 200,
      message: `Fetched visa on arrival rates with Nigerian visa requirement.`,
      visaOnArrivalRates: visaOnArrivalRates,
    };
  }

  // ENQUIRY
  // This service SENDS an email from the Get in touch form
  async sendEnquiryEmail(fullName, email, message) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([fullName, email, message]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Send Email
    const emailHTML = EnquiryNotificationTemplate({
      fullName,
      email,
      message,
    });

    const emailMessage = {
      to: "info@shuttlelane.com",
      from: process.env.SENGRID_EMAIL,
      subject: "🔔You just received a message on Shuttlelane.com",
      html: ReactDOMServer.renderToString(emailHTML),
    };
    await sendEmail(emailMessage);

    return {
      status: 200,
      message: `Message sent! Our team will be in touch shortly.`,
    };
  }
}
