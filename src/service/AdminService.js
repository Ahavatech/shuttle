import bcrypt from "bcryptjs";
import {
  validateFields,
  validateAdminLoginDetails,
  jwtSign,
} from "../util/auth.helper.js";
import {
  checkAdminEmailValidity,
  checkAdminUsernameValidity,
} from "../util/db.helper.js";
import PaymentModel from "../model/payment.model.js";
import BookingModel from "../model/booking.model.js";
import AirportTransferBookingModel from "../model/airportTransferBooking.model.js";
import CarRentalBookingModel from "../model/carRentalBooking.model.js";
import PriorityPassBookingModel from "../model/priorityPassBooking.model.js";
import VisaOnArrivalBookingModel from "../model/visaOnArrivalBooking.model.js";
import UserModel from "../model/user.model.js";
import DriverModel from "../model/driver.model.js";
import CityModel from "../model/city.model.js";
import VendorModel from "../model/vendor.model.js";
import EnquiryModel from "../model/enquiry.model.js";
import {
  sendBulkEmail,
  sendEmail,
  sendSGDynamicEmail,
} from "../util/sendgrid.js";
import CurrencyModel from "../model/currency.model.js";
import RatePerMileModel from "../model/ratePerMile.model.js";
import VisaOnArrivalRateModel from "../model/visaOnArrivalRate.model.js";
import VoaBaseFeesModel from "../model/voaBaseFees.model.js";
import ReactDOMServer from "react-dom/server";

// Email templates
import AssignToBookingEmailTemplate from "../emailTemplates/driverEmailTemplates/AssignToBookingEmail/index.js";
import DriverAccountApprovalEmail from "../emailTemplates/driverEmailTemplates/DriverAccountApprovalEmail/index.js";
import AdminAccountCreationEmailTemplate from "../emailTemplates/adminEmailTemplates/AdminAccountCreationEmail/index.js";
import AdminAccountCreationSuccessfulEmailTemplate from "../emailTemplates/adminEmailTemplates/AdminAccountCreationSuccessfulEmail/index.js";
import {
  convertAmountToUserCurrency,
  generateBookingDetails,
  generateUserBookingDetails,
} from "../util/index.js";
import {
  firstEmailValue,
  formatEmailName,
} from "../util/emailFormatters.js";
import VendorAccountApprovalEmail from "../emailTemplates/vendorEmailTemplates/VendorAccountApprovalEmail/index.js";

// Node schedule
import schedule from "node-schedule";
import { sendSMS } from "../util/twilio.js";

// Auth
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import CarRentalCityModel from "../model/carRentalCity.model.js";
import priorityPassCityModel from "../model/priorityPassCity.model.js";
import PriorityPassService from "./PriorityPassService.js";
import { notifyUser, sendPushBroadcast } from "../util/pushNotifications.js";

export default class AdminService {
  constructor(ShuttlelaneAdminModel) {
    this.AdminModel = ShuttlelaneAdminModel;
  }

  // This service CREATES a new admin - Sign up service
  async signupAdmin(admin) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([
      admin.firstName,
      admin.lastName,
      admin.email,
      admin.username,
      admin.role,
      admin.accessRights,
    ]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if admin is already signed up with the email provided
    const adminAlreadyExistsWithEmail = await checkAdminEmailValidity(
      admin.email
    );

    // Check if admin is already signed up with username
    const adminAlreadyExistsWithUsername = await checkAdminUsernameValidity(
      admin.username
    );

    // If admin email already exists
    if (adminAlreadyExistsWithEmail.status === 409)
      return adminAlreadyExistsWithEmail;

    // If admin email already exists
    if (adminAlreadyExistsWithUsername.status === 409)
      return adminAlreadyExistsWithUsername;

    // Hash password
    // const salt = bcrypt.genSaltSync(10);
    // const hashedPassword = await bcrypt.hash(admin.password, salt);

    // If the email is available, then proceed to sign up the admin
    const newAdmin = await this.AdminModel.create({
      ...admin,
      //   password: hashedPassword,
    });

    // TO-DO: Send confirmation email here
    const fullName = `${newAdmin?.firstName} ${newAdmin?.lastName}`;
    const emailHTML = AdminAccountCreationEmailTemplate({
      fullName,
      email: newAdmin?.email,
      username: newAdmin?.username,
      role: newAdmin?.role,
      _id: newAdmin?._id,
    });

    const message = {
      to: newAdmin?.email,
      from: process.env.SENGRID_EMAIL,
      subject: "⚠ Action Required",
      html: ReactDOMServer.renderToString(emailHTML),
    };

    sendEmail(message);

    // Get admin accounts
    const adminAccounts = await this.AdminModel.find({});

    console.log("ADMIN:", newAdmin);
    return {
      status: 201,
      message: "Admin account has been created successfully!",
      admin: newAdmin,
      adminAccounts: adminAccounts,
    };
  }

  // This service CREATES a new admin - Sign up service
  async completeAdminAccountSignup(admin) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([
      admin.image,
      admin.password,
      admin._id,
    ]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = await bcrypt.hash(admin.password, salt);

    // If the email is available, then proceed to sign up the admin
    const newAdmin = await this.AdminModel.findOneAndUpdate(
      {
        _id: admin?._id,
      },
      {
        image: admin?.image,
        password: hashedPassword,
      }
    );

    // TO-DO: Send confirmation email here
    const fullName = `${newAdmin?.firstName} ${newAdmin?.lastName}`;
    const emailHTML = AdminAccountCreationSuccessfulEmailTemplate({
      role: newAdmin?.role,
    });

    const message = {
      to: newAdmin?.email,
      from: process.env.SENGRID_EMAIL,
      subject: "Admin Account Setup Completed!🎊",
      html: ReactDOMServer.renderToString(emailHTML),
    };

    sendEmail(message);

    return {
      status: 201,
      message: "Admin account setup completed!",
      admin: newAdmin,
    };
  }

  // This service DELETES an admin by id
  async deleteAdminAccountById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any admin exists with the _id
    const admin = await this.AdminModel.findOneAndRemove({ _id: _id });

    if (!admin) {
      return {
        status: 404,
        message: `No admin with _id ${_id} exists.`,
      };
    }

    const admins = await this.AdminModel.find({}).sort({ createdAt: -1 });

    return {
      status: 201,
      message: `Admin deleted successfully.`,
      adminAccounts: admins,
    };
  }

  // This service GETS all admin accounts
  async fetchAdminAccounts() {
    // Get admin accounts
    const adminAccounts = await this.AdminModel.find({});

    return {
      status: 200,
      message: `Fetched admin accounts.`,
      adminAccounts: adminAccounts,
    };
  }

  // This service logs in the admin
  async loginAdmin(username, password) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([username, password]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // If the fields are not empty, check the DB for username
    const adminExists = await validateAdminLoginDetails(username, password);

    // TODO: If admin has 2FA turned on, Send OTP to admin's username
    // return {
    //     status: 200,
    //     message: 'An OTP was sent to your registered username.'
    // }

    return adminExists;
  }

  // This service GETS a admin by their email
  async getAdminByEmail(email) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([email]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any admin exists with the email
    const admin = await this.AdminModel.findOne({
      email: email,
    });

    if (!admin) {
      return {
        status: 404,
        message: "No admin exists with the email specified.",
        admin: admin,
      };
    }

    return {
      status: 200,
      message: `Fetched admin with email ${email}.`,
      admin: admin,
    };
  }

  // This service GETS dashboard statistics
  async getStatistics() {
    // Fetch the number of airport transfer bookings
    const numberOfAirportTransferBookings =
      await AirportTransferBookingModel.find().count();
    // Fetch the number of car rental bookings
    const numberOfCarRentalBookings =
      await CarRentalBookingModel.find().count();
    // Fetch the number of priority pass bookings
    const numberOfPriorityPassBookings =
      await PriorityPassBookingModel.find().count();
    // Fetch the number of visa on arrival bookings
    const numberOfVisaOnArrivalBookings =
      await VisaOnArrivalBookingModel.find().count();
    // Fetch users
    const users = await UserModel.find();
    // Fetch drivers
    const drivers = await DriverModel.find();
    // Fetch upcomingBookings
    const today = new Date(); // Get today's date
    const upcomingBookings = await BookingModel.find({
      pickupDate: { $gt: today },
    })
      .populate("paymentId")
      .populate("user")
      .populate("booking");

    // Fetch the total revenue
    const totalPayments = await PaymentModel.find({});

    // Fetch all bookings from all months
    const data = await BookingModel.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
          users: { $push: "$$ROOT" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    return {
      status: 200,
      message: `Fetched statistics`,
      numberOfAirportTransferBookings: numberOfAirportTransferBookings,
      numberOfCarRentalBookings: numberOfCarRentalBookings,
      numberOfPriorityPassBookings: numberOfPriorityPassBookings,
      numberOfVisaOnArrivalBookings: numberOfVisaOnArrivalBookings,
      drivers: drivers,
      users: users,
      upcomingBookings: upcomingBookings,
      bookingData: data,
    };
  }

  // This service CREATES a new city
  async createCity(cityName, type) {
    let cities, city;
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([cityName, type]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    switch (type) {
      case "airport":
        city = await CityModel.findOne({
          cityName,
        });

        if (city) {
          return {
            status: 409,
            message:
              "This city already exists. Try adding a city with a different name.",
          };
        }

        await CityModel.create({
          cityName: cityName,
        });

        // Fetch all cities (So the frontend can be update without having to refresh the page & to prevent making another request to get cities)
        cities = await CityModel.find().sort({ cityName: 1 });
        break;

      case "car":
        city = await CarRentalCityModel.findOne({
          cityName,
        });

        if (city) {
          return {
            status: 409,
            message:
              "This city already exists. Try adding a city with a different name.",
          };
        }

        await CarRentalCityModel.create({
          cityName: cityName,
        });

        // Fetch all cities (So the frontend can be update without having to refresh the page & to prevent making another request to get cities)
        cities = await CarRentalCityModel.find().sort({ cityName: 1 });
        break;

      case "priority":
        city = await priorityPassCityModel.findOne({
          cityName,
        });

        if (city) {
          return {
            status: 409,
            message:
              "This city already exists. Try adding a city with a different name.",
          };
        }

        await priorityPassCityModel.create({
          cityName: cityName,
        });

        // Fetch all cities (So the frontend can be update without having to refresh the page & to prevent making another request to get cities)
        cities = await priorityPassCityModel.find().sort({ cityName: 1 });
        break;

      default:
        break;
    }

    return {
      status: 201,
      message: `City created successfully!`,
      cities: cities,
    };
  }

  // This service fetches all cities
  async getCities(type) {
    let cities;

    switch (type) {
      case "airport":
        cities = await CityModel.find({})
          .sort({ cityName: 1 })
          .populate("vehicleClasses")
          .populate("cars");
        break;

      case "car":
        cities = await CarRentalCityModel.find({})
          .sort({ cityName: 1 })
          .populate("cars");
        break;

      case "priority":
        cities = await priorityPassCityModel
          .find({})
          .sort({ cityName: 1 })
          .populate("passes");
        break;

      default:
        break;
    }

    // Return a response
    return {
      status: 200,
      message: `Cities fetched`,
      cities: cities,
    };
  }

  // This service fetches a city
  async getCity(cityId, userCountry, isAdminRequest, type) {
    let city;

    switch (type) {
      case "airport":
        city = await CityModel.findOne({ _id: cityId })
          .populate("vehicleClasses")
          .populate("cars");
        break;

      case "car":
        city = await CarRentalCityModel.findOne({ _id: cityId })
          .sort({ cityName: 1 })
          .populate("cars");
        break;

      case "priority":
        city = await priorityPassCityModel
          .findOne({ _id: cityId })
          .sort({ cityName: 1 })
          .populate("passes");
        break;

      default:
        break;
    }

    if (isAdminRequest) {
      // Return a response
      return {
        status: 200,
        message: `City fetched`,
        city: city,
      };
    }

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
      let vehicleClassesWithConvertedRates = [];

      if (type === "airport") {
        for (let i = 0; i < city?.vehicleClasses?.length; i++) {
          let convertedRate = await convertAmountToUserCurrency(
            allowedCurrency,
            city?.vehicleClasses[i]?.basePrice
          );
          city.vehicleClasses[i].basePrice = convertedRate;
          vehicleClassesWithConvertedRates.push(city?.vehicleClasses[i]);
        }
      }

      let carsWithConvertedRates = [];
      if (type === "car") {
        for (let i = 0; i < city?.cars?.length; i++) {
          let convertedRate = await convertAmountToUserCurrency(
            allowedCurrency,
            city?.cars[i]?.price
          );
          city.cars[i].price = convertedRate;
          carsWithConvertedRates.push(city?.cars[i]);
        }
      }

      let passesWithConvertedRates = [];
      if (type === "priority") {
        for (let i = 0; i < city?.passes?.length; i++) {
          let convertedRate = await convertAmountToUserCurrency(
            allowedCurrency,
            city?.passes[i]?.price,
            false
          );
          city.passes[i].price = convertedRate;
          passesWithConvertedRates.push(city?.passes[i]);
        }
      }

      let cityWithConvertedRate;
      if (type === "airport") {
        cityWithConvertedRate = {
          _id: city?._id,
          cityName: city?.cityName,
          airports: city?.airports,
          vehicleClasses: vehicleClassesWithConvertedRates,
          cars: carsWithConvertedRates,
        };
      } else if (type === "car") {
        cityWithConvertedRate = {
          _id: city?._id,
          cityName: city?.cityName,
          cars: carsWithConvertedRates,
        };
      } else if (type === "priority") {
        cityWithConvertedRate = {
          _id: city?._id,
          cityName: city?.cityName,
          passes: passesWithConvertedRates,
        };
      }

      console.log("CITIES HERE =>", cityWithConvertedRate);

      // Return a response
      return {
        status: 200,
        message: `Cities fetched`,
        city: cityWithConvertedRate,
        currency: allowedCurrency,
      };
    } else {
      // Default to Dollars
      const userCurrency = await CurrencyModel.findOne({
        symbol: "$",
        alias: "USD",
      });

      let vehicleClassesWithConvertedRates = [];

      if (type === "airport") {
        for (let i = 0; i < city?.vehicleClasses?.length; i++) {
          let convertedRate = await convertAmountToUserCurrency(
            userCurrency,
            city?.vehicleClasses[i]?.basePrice,
            true
          );
          city.vehicleClasses[i].basePrice = convertedRate;
          vehicleClassesWithConvertedRates.push(city?.vehicleClasses[i]);
        }
      }

      let carsWithConvertedRates = [];
      if (type === "car") {
        for (let i = 0; i < city?.cars?.length; i++) {
          let convertedRate = await convertAmountToUserCurrency(
            userCurrency,
            city?.cars[i]?.price,
            true
          );
          city.cars[i].price = convertedRate;
          carsWithConvertedRates.push(city?.cars[i]);
        }
      }

      let passesWithConvertedRates = [];
      if (type === "priority") {
        for (let i = 0; i < city?.passes?.length; i++) {
          let convertedRate = await convertAmountToUserCurrency(
            userCurrency,
            city?.passes[i]?.price,
            false
          );
          city.passes[i].price = convertedRate;
          passesWithConvertedRates.push(city?.passes[i]);
        }
      }

      // Create a city object with converted rates
      let cityWithConvertedRate;
      if (type === "airport") {
        cityWithConvertedRate = {
          _id: city?._id,
          cityName: city?.cityName,
          airports: city?.airports,
          vehicleClasses: vehicleClassesWithConvertedRates,
          cars: carsWithConvertedRates,
        };
      } else if (type === "car") {
        cityWithConvertedRate = {
          _id: city?._id,
          cityName: city?.cityName,
          cars: carsWithConvertedRates,
        };
      } else if (type === "priority") {
        cityWithConvertedRate = {
          _id: city?._id,
          cityName: city?.cityName,
          passes: passesWithConvertedRates,
        };
      }

      // Return a response
      return {
        status: 200,
        message: `City fetched`,
        city: cityWithConvertedRate,
        currency: userCurrency,
      };
    }
  }

  // This service adds an airport to a city
  async addAirportToCity(cityId, airport) {
    const city = await CityModel.findOne({ _id: cityId });

    city.airports?.push(airport);
    await city.save();

    const cities = await CityModel.find({}).sort({ cityName: 1 });

    // Return a response
    return {
      status: 201,
      message: `New airport added to ${city?.cityName} successfully!`,
      cities: cities,
    };
  }

  // This service UPDATES a city by id
  async updateCityById(_id, updatedCity, type) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id, updatedCity, type]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    let city, cities, cityModel;
    switch (type) {
      case "airport":
        city = await CityModel.findOneAndUpdate(
          { _id: _id },
          { ...updatedCity }
        );
        cityModel = CityModel;
        break;
      case "car":
        city = await CarRentalCityModel.findOneAndUpdate(
          { _id: _id },
          { ...updatedCity }
        );
        cityModel = CarRentalCityModel;
        break;
      case "priority":
        city = await priorityPassCityModel.findOneAndUpdate(
          { _id: _id },
          { ...updatedCity }
        );
        cityModel = priorityPassCityModel;
        break;

      default:
        break;
    }

    if (!city) {
      return {
        status: 404,
        message: `No city with _id ${_id} exists.`,
      };
    }

    cities = await cityModel.find({}).sort({ cityName: 1 });

    return {
      status: 201,
      message: `City updated successfully.`,
      cities: cities,
    };
  }

  // This service DELETES a city by id
  async deleteCityById(_id, type) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    let city, cities, cityModel;
    switch (type) {
      case "airport":
        city = await CityModel.findOneAndRemove({ _id: _id });
        cityModel = CityModel;
        break;
      case "car":
        city = await CarRentalCityModel.findOneAndRemove({ _id: _id });
        cityModel = CarRentalCityModel;
        break;
      case "priority":
        city = await priorityPassCityModel.findOneAndRemove({ _id: _id });
        cityModel = priorityPassCityModel;
        break;

      default:
        break;
    }

    if (!city) {
      return {
        status: 404,
        message: `No city with _id ${_id} exists.`,
      };
    }

    cities = await cityModel.find({}).sort({ cityName: 1 });

    return {
      status: 201,
      message: `City deleted successfully.`,
      cities: cities,
    };
  }

  // This service GETS all users
  async getUsers() {
    // Get users
    const users = await UserModel.find({}).populate({
      path: "bookings",
    });

    const data = await UserModel.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
          users: { $push: "$$ROOT" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    console.log("users:", users);
    console.log("data:", data);

    return {
      status: 200,
      message: `Fetched users.`,
      users: users,
      data: data,
    };
  }

  // This service GETS a user by their id
  async getUserById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any user exists with the user id
    const user = await UserModel.findOne({
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

  // This service DELETES a user by id
  async deleteUserById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any user exists with the _id
    const user = await UserModel.findOneAndRemove({ _id: _id });

    if (!user) {
      return {
        status: 404,
        message: `No user with _id ${_id} exists.`,
      };
    }

    const users = await UserModel.find({}).sort({ createdAt: -1 });
    const data = await UserModel.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
          users: { $push: "$$ROOT" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    return {
      status: 201,
      message: `User deleted successfully.`,
      users: users,
      data: data,
    };
  }

  // This service GETS all drivers
  async getDrivers() {
    // Get drivers
    const drivers = await DriverModel.find({
      isAccountApproved: true,
      isAccountBlocked: false,
    }).populate({
      path: "bookingsAssignedTo",
    });

    const data = await DriverModel.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
          drivers: { $push: "$$ROOT" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    console.log("drivers:", drivers);
    console.log("data:", data);

    return {
      status: 200,
      message: `Fetched drivers.`,
      drivers: drivers,
      data: data,
    };
  }

  // This service GETS all drivers
  async getApprovedDrivers() {
    // Get drivers
    const drivers = await DriverModel.find({
      isAccountApproved: true,
      isAccountBlocked: false,
    });

    const data = await DriverModel.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
          drivers: { $push: "$$ROOT" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    console.log("drivers:", drivers);
    console.log("data:", data);

    return {
      status: 200,
      message: `Fetched drivers.`,
      drivers: drivers,
      data: data,
    };
  }

  // This service GETS a driver by their id
  async getDriverById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any driver exists with the driver id
    const driver = await DriverModel.findOne({
      _id: _id,
    }).populate({
      path: "bookings",
    });

    if (!driver) {
      return {
        status: 404,
        message: "No driver exists with the id specified.",
        driver: driver,
      };
    }

    return {
      status: 200,
      message: `Fetched driver with id ${_id}.`,
      driver: driver,
    };
  }

  // This service GETS all drivers
  async getApprovedDrivers() {
    // Get drivers
    const drivers = await DriverModel.find({
      isAccountApproved: true,
    });

    const data = await DriverModel.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
          drivers: { $push: "$$ROOT" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    console.log("drivers:", drivers);
    console.log("data:", data);

    return {
      status: 200,
      message: `Fetched drivers.`,
      drivers: drivers,
      data: data,
    };
  }

  // This service GETS all unappoved drivers
  async getUnapprovedDrivers() {
    // Get unapproved drivers
    const drivers = await DriverModel.find({
      isAccountApproved: false,
    });

    return {
      status: 200,
      message: `Fetched unapproved drivers.`,
      drivers: drivers,
    };
  }

  // This service GETS a driver by their id
  async getDriverById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any driver exists with the driver id
    const driver = await DriverModel.findOne({
      _id: _id,
    }).populate({
      path: "bookings",
    });

    if (!driver) {
      return {
        status: 404,
        message: "No driver exists with the id specified.",
        driver: driver,
      };
    }

    return {
      status: 200,
      message: `Fetched driver with id ${_id}.`,
      driver: driver,
    };
  }

  // This service APPROVES a driver account by their id
  async approveDriverAccount(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any driver exists with the driver id
    const driver = await DriverModel.findOneAndUpdate(
      {
        _id: _id,
      },
      { isAccountApproved: true }
    );

    if (!driver) {
      return {
        status: 404,
        message: "No driver exists with the id specified.",
        driver: driver,
      };
    }

    // TO-DO: Send driver a confirmation email here
    let dynamicTemplateData = {
      driverName: formatEmailName(driver?.firstName, driver?.lastName),
    };

    const templateId = "d-8ab1ed96c87d452dbfe0be4d0f48b6c4";

    let msg = {
      to: driver?.email,
      from: "info@shuttlelane.com",
      subject: `Driver Account Has Been Approved🎉`,
      templateId: templateId,
      dynamicTemplateData,
    };

    await sendSGDynamicEmail(msg);

    const drivers = await DriverModel.find({});

    return {
      status: 201,
      message: `Driver account has been approved`,
      drivers: drivers,
    };
  }

  // This service fetches SUSPENDED driver accounts
  async fetchSuspendedDriverAccounts() {
    const suspendedDriverAccounts = await DriverModel.find({
      isAccountBlocked: true,
    }).sort({ createdAt: -1 });

    return {
      status: 200,
      message: `All suspended driver accounts fetched`,
      suspendedDriverAccounts: suspendedDriverAccounts,
    };
  }

  // This service REJECTS a driver account application by their id
  async rejectDriverAccount(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any driver exists with the driver id
    const driver = await DriverModel.findOneAndUpdate(
      {
        _id: _id,
      },
      { isAccountApproved: false }
    );

    if (!driver) {
      return {
        status: 404,
        message: "No driver exists with the id specified.",
        driver: driver,
      };
    }

    // TO-DO: Send driver a confirmation email here
    let dynamicTemplateData = {
      driverName: formatEmailName(driver?.firstName, driver?.lastName),
    };

    const templateId = "d-4ca77bcd72064605ba885f8df8606659";

    let msg = {
      to: driver?.email,
      from: "info@shuttlelane.com",
      subject: `Driver Application Rejected`,
      templateId: templateId,
      dynamicTemplateData,
    };

    await sendSGDynamicEmail(msg);

    const drivers = await DriverModel.find({});

    return {
      status: 201,
      message: `Driver application has been successfully rejected`,
      drivers: drivers,
    };
  }

  // This service SUSPENDS a driver account by their id
  async suspendDriverAccount(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any driver exists with the driver id
    const driver = await DriverModel.findOneAndUpdate(
      {
        _id: _id,
      },
      { isAccountBlocked: true }
    );

    if (!driver) {
      return {
        status: 404,
        message: "No driver exists with the id specified.",
        driver: driver,
      };
    }

    // TO-DO: Send driver a confirmation email here
    let dynamicTemplateData = {
      driverName: formatEmailName(driver?.firstName, driver?.lastName),
    };

    const templateId = "d-0ee57e699a5847a4bb0ad1c96e4b361f";

    let msg = {
      to: driver?.email,
      from: "info@shuttlelane.com",
      subject: `Driver Account Suspended`,
      templateId: templateId,
      dynamicTemplateData,
    };

    await sendSGDynamicEmail(msg);

    const drivers = await DriverModel.find({
      isAccountApproved: true,
      isAccountBlocked: false,
    }).sort({ createdAt: -1 });
    const suspendedDriverAccounts = await DriverModel.find({
      isAccountBlocked: true,
    }).sort({ createdAt: -1 });

    return {
      status: 201,
      message: `Driver account has been suspended`,
      drivers: drivers,
      suspendedDriverAccounts: suspendedDriverAccounts,
    };
  }

  // This service UNSUSPENDS a driver account by their id
  async unsuspendDriverAccount(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any driver exists with the driver id
    const driver = await DriverModel.findOneAndUpdate(
      {
        _id: _id,
      },
      { isAccountBlocked: false }
    );

    if (!driver) {
      return {
        status: 404,
        message: "No driver exists with the id specified.",
        driver: driver,
      };
    }

    // TO-DO: Send driver a confirmation email here
    let dynamicTemplateData = {
      driverName: formatEmailName(driver?.firstName, driver?.lastName),
    };

    const templateId = "d-fd004f719e354bdf9c70f1c4fe419a97";

    let msg = {
      to: driver?.email,
      from: "info@shuttlelane.com",
      subject: `Welcome Back!`,
      templateId: templateId,
      dynamicTemplateData,
    };

    await sendSGDynamicEmail(msg);

    const drivers = await DriverModel.find({
      isAccountApproved: true,
      isAccountBlocked: false,
    }).sort({ createdAt: -1 });
    const suspendedDriverAccounts = await DriverModel.find({
      isAccountBlocked: true,
    }).sort({ createdAt: -1 });

    return {
      status: 201,
      message: `Driver account has been unsuspended`,
      drivers: drivers,
      suspendedDriverAccounts: suspendedDriverAccounts,
    };
  }

  // This service ASSIGNS a PARTNER (Driver or Vendor) to a job
  async assignDriverToJob(
    userType,
    userId,
    bookingId,
    bookingRate,
    unregisteredDriver = null,
    unregisteredCar = null
  ) {
    console.log(
      "VALUES:",
      userType,
      userId,
      bookingId,
      bookingRate,
      unregisteredDriver,
      unregisteredCar
    );

    // Validate if fields are empty
    const areFieldsEmpty = validateFields([
      userType,
      userId,
      bookingId,
      bookingRate,
    ]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    let vendor, driver;

    if (userType == "Driver") {
      // Check if any driver exists with the driver id
      driver = await DriverModel.findOne({
        _id: userId,
        isAccountApproved: true,
      }).populate({
        path: "bookingsAssignedTo",
      });

      if (!driver) {
        return {
          status: 404,
          message: "No driver exists with the id specified.",
          driver: driver,
        };
      }

      driver?.bookingsAssignedTo?.push(bookingId);
      console.log("DBAT:", driver?.bookingsAssignedTo);

      const updateDriver = await DriverModel.findOneAndUpdate(
        { _id: driver?._id },
        {
          bookingsAssignedTo: driver?.bookingsAssignedTo,
        }
      );

      const updateBooking = await BookingModel.findOneAndUpdate(
        {
          _id: bookingId,
        },
        {
          driverJobWasSentTo: driver?._id,
          hasDriverAccepted: false,
          hasDriverDeclined: false,
          isAssignedToDriver: true,
          isAssignedToVendor: false,
          bookingStatus: "Awaiting response",
          bookingRate: bookingRate,
        }
      ).populate({
        path: "booking",
      });

      const booking = await BookingModel.findOne({ _id: bookingId })
        .populate("booking")
        .populate("user")
        .populate("assignedDriver")
        .populate("assignedVendor")
        .populate("vendorAssignedDriver")
        .populate("assignedCar")
        .populate("bookingCurrency");
      const bookingDetails = await generateBookingDetails(booking);
      // TO-DO: Send confirmation email here
      let dynamicTemplateData = {
        driverName: `${driver?.firstName} ${driver?.lastName}`,
        bookingDetails: bookingDetails,
      };

      const templateId = "d-509719020e154d5aa26ce543aa362ea0";
      let msg = {
        to: driver?.email,
        from: "booking@shuttlelane.com",
        subject: `New Booking Notification🚨`,
        templateId: templateId,
        dynamicTemplateData,
      };

      await sendSGDynamicEmail(msg);

      await sendSMS(
        driver?.mobile,
        `Dear ${driver?.firstName}, a booking has been assigned to you with reference: ${booking?.bookingReference}. Please, log in to accept this booking https://www.shuttlelane.com. If you would not be available at the the specified booking date, please feel free to decline the booking. Thank you, The Shuttlelane Team.`
      );

      await notifyUser({
        user: booking?.user,
        title: "Driver assigned",
        body: `${driver?.firstName} ${driver?.lastName} has been assigned to your booking.`,
        category: "booking",
        eventType: "driver-assigned",
        source: "admin",
        bookingId: booking?._id,
        bookingReference: booking?.bookingReference,
        data: {
          bookingId: booking?._id?.toString?.(),
          bookingReference: booking?.bookingReference,
          bookingType: booking?.bookingType,
        },
      });

      // Schedule SMS job here (Should fire 10 minutes after job has been received)
      let scheduledSMSDate = new Date();
      scheduledSMSDate.setMinutes(scheduledSMSDate.getMinutes() + 10);

      // Send a reminder SMS to the driver after 10 minutes of booking assignment
      await schedule.scheduleJob(scheduledSMSDate, async () => {
        // Get the current booking status to check if driver has accepted the job
        const scheduledBooking = await BookingModel.findOne({ _id: bookingId })
          .populate("driverJobWasSentTo")
          .populate("assignedDriver");

        // Send SMS only if driver has not accepted it
        if (
          (scheduledBooking?.hasDriverAccepted === false ||
            !scheduledBooking?.assignedDriver) &&
          scheduledBooking?.driverJobWasSentTo?._id ==
            booking?.driverJobWasSentTo?._id
        ) {
          await sendSMS(
            scheduledBooking?.driverJobWasSentTo?.mobile,
            `Dear ${driver?.firstName}, we noticed you have not yet accepted your most recent booking assigned to you with reference: ${booking?.bookingReference}. Please, ensure to accept this booking immediately. If you would not be available at the the specified booking date, please feel free to decline the booking. Thank you, The Shuttlelane Team.`
          );
        }
      });

      // Send a reminder SMS to both the user and the driver 30 minutes before the booking time
      const bookingReminderSMSDate = new Date(
        booking?.booking?.pickupDate
      ).setMinutes(booking?.booking?.pickupDate?.getMinutes() - 60);

      await schedule.scheduleJob(bookingReminderSMSDate, async () => {
        // Get the current booking status to check if driver has accepted the job
        const scheduledBooking = await BookingModel.findOne({ _id: bookingId })
          .populate("driverJobWasSentTo")
          .populate("assignedDriver")
          .populate("user");

        // Send SMS only if driver has accepted it
        if (
          booking?.bookingStatus === "Scheduled" &&
          booking?.isAssignedToDriver
        ) {
          await sendSMS(
            scheduledBooking?.assignedDriver?.mobile,
            `Dear ${scheduledBooking?.assignedDriver?.firstName}, you have a booking in 1 hour (Ref: ${scheduledBooking?.bookingReference}). Please, ensure to arrive on time. Thank you, The Shuttlelane Team.`
          );

          await sendSMS(
            scheduledBooking?.user?.mobile ?? scheduledBooking?.mobile,
            `Dear ${scheduledBooking?.user?.title ?? scheduledBooking?.title} ${
              scheduledBooking?.user?.firstName ?? scheduledBooking?.firstName
            }, your driver, ${
              scheduledBooking?.assignedDriver?.firstName
            } is close by and will arrive soon. You can reach out to your driver via this number: ${
              scheduledBooking?.assignedDriver?.mobile
            }. For complaints, please contact booking@shuttlelane.com. Thank you, The Shuttlelane Team.`
          );
        }
      });

      const bookingsAwaitingAssignment = await BookingModel.find({
        bookingStatus: "Not yet assigned",
      })
        .populate("booking")
        .populate("paymentId");

      const updatedUnassignedBookings = bookingsAwaitingAssignment?.filter(
        (booking) => {
          return (
            booking?.bookingType !== "Visa" &&
            booking?.paymentId?.paymentStatus === "Successful"
          );
        }
      );

      return {
        status: 201,
        updatedUnassignedBookings,
        message: `Booking has been successfully assigned to ${driver?.firstName} ${driver?.lastName}.`,
      };
    } else if (userType == "Vendor") {
      console.log("HELLO 1111");
      // Check if any vendor exists with the vendor id
      vendor = await VendorModel.findOne({
        _id: userId,
        isAccountApproved: true,
      }).populate({
        path: "bookingsAssignedTo",
      });

      console.log("HELLO 2222");

      if (!vendor) {
        return {
          status: 404,
          message:
            "No vendor exists with the id specified or this account has ont been approved yet.",
          vendor: vendor,
        };
      }

      console.log("HELLO 3333");

      vendor?.bookingsAssignedTo?.push(bookingId);
      console.log("DBAT:", vendor?.bookingsAssignedTo);

      const updateVendor = await VendorModel.findOneAndUpdate(
        { _id: vendor?._id },
        {
          bookingsAssignedTo: vendor?.bookingsAssignedTo,
        }
      );

      console.log("HELLO 4444");

      const updateBooking = await BookingModel.findOneAndUpdate(
        {
          _id: bookingId,
        },
        {
          vendorJobWasSentTo: vendor?._id,
          hasVendorAccepted: false,
          hasVendorDeclined: false,
          isAssignedToDriver: false,
          isAssignedToVendor: true,
          bookingStatus: "Awaiting response",
          bookingRate: bookingRate,
        }
      ).populate({
        path: "booking",
      });

      const booking = await BookingModel.findOne({ _id: bookingId })
        .populate("booking")
        .populate("user")
        .populate("assignedDriver")
        .populate("assignedVendor")
        .populate("vendorAssignedDriver")
        .populate("assignedCar")
        .populate("bookingCurrency");

      const bookingDetails = await generateBookingDetails(booking);

      // TO-DO: Send confirmation email here
      let dynamicTemplateData = {
        companyName: vendor?.companyName,
        bookingDetails: bookingDetails,
      };

      const templateId = "d-e84ddb740d574cc09100710b40a02a22";

      let msg = {
        to: vendor?.companyEmail ?? vendor?.contactEmail,
        from: "booking@shuttlelane.com",
        subject: `New Booking Notification🚨`,
        templateId: templateId,
        dynamicTemplateData,
      };

      await sendSGDynamicEmail(msg);

      await notifyUser({
        user: booking?.user,
        title: "Driver assigned",
        body: `${unregisteredDriver?.firstName} ${unregisteredDriver?.lastName} has been assigned to your booking.`,
        category: "booking",
        eventType: "driver-assigned",
        source: "admin",
        bookingId: booking?._id,
        bookingReference: booking?.bookingReference,
        data: {
          bookingId: booking?._id?.toString?.(),
          bookingReference: booking?.bookingReference,
          bookingType: booking?.bookingType,
        },
      });

      await sendSMS(
        vendor?.contactMobile,
        `Dear ${vendor?.companyName}, a booking has been assigned to you with reference: ${booking?.bookingReference}. Please, log in to accept this booking https://www.shuttlelane.com. If you would not be available at the the specified booking date, please feel free to decline the booking. Thank you, The Shuttlelane Team.`
      );

      // Schedule SMS job here (Should fire 10 minutes after job has been received)
      let scheduledSMSDate = new Date();
      scheduledSMSDate.setMinutes(scheduledSMSDate.getMinutes() + 10);

      // Send a reminder SMS to the driver after 10 minutes of booking assignment
      await schedule.scheduleJob(scheduledSMSDate, async () => {
        // Get the current booking status to check if driver has accepted the job
        const scheduledBooking = await BookingModel.findOne({ _id: bookingId })
          .populate("vendorJobWasSentTo")
          .populate("assignedVendor");

        // Send SMS only if driver has not accepted it
        if (
          (scheduledBooking?.hasVendorAccepted == false ||
            !scheduledBooking?.assignedVendor) &&
          scheduledBooking?.vendorJobWasSentTo?._id ==
            booking?.vendorJobWasSentTo?._id
        ) {
          if (
            scheduledBooking?.vendorJobWasSentTo?.contactMobile ||
            scheduledBooking?.assignedVendor?.contactMobile
          ) {
            await sendSMS(
              scheduledBooking?.vendorJobWasSentTo?.contactMobile ??
                scheduledBooking?.assignedVendor?.contactMobile,
              `Dear ${scheduledBooking?.vendorJobWasSentTo?.companyName}, we noticed you have not yet accepted your most recent booking assigned to you with reference: ${booking?.bookingReference}. Please, ensure to accept this booking immediately. If you would not be available at the the specified booking date, please feel free to decline the booking. Thank you, The Shuttlelane Team.`
            );
          }
        }
      });

      // Send a reminder SMS to both the user and the driver 30 minutes before the booking time
      const bookingReminderSMSDate = new Date(
        booking?.booking?.pickupDate
      ).setMinutes(booking?.booking?.pickupDate?.getMinutes() - 60);

      await schedule.scheduleJob(bookingReminderSMSDate, async () => {
        // Get the current booking status to check if driver has accepted the job
        const scheduledBooking = await BookingModel.findOne({ _id: bookingId })
          .populate("vendorJobWasSentTo")
          .populate("assignedDriver")
          .populate("vendorAssignedDriver")
          .populate("user");

        // Send SMS only if driver has not accepted it
        if (
          booking?.bookingStatus === "Scheduled" &&
          booking?.isAssignedToVendor
        ) {
          await sendSMS(
            scheduledBooking?.vendorAssignedDriver?.mobile,
            `Dear ${vendorAssignedDriver?.firstName}, you have a booking in 1 hour (Ref: ${scheduledBooking?.bookingReference}). Please, ensure to arrive on time. Thank you, The Shuttlelane Team.`
          );

          await sendSMS(
            scheduledBooking?.user?.mobile ?? scheduledBooking?.mobile,
            `Dear ${scheduledBooking?.user?.title ?? scheduledBooking?.title} ${
              scheduledBooking?.user?.firstName ?? scheduledBooking?.firstName
            }, your driver, ${
              scheduledBooking?.vendorAssignedDriver?.firstName
            } is close by and will arrive soon. You can reach out to your driver via this number: ${
              scheduledBooking?.vendorAssignedDriver?.mobile
            }. For complaints, please contact booking@shuttlelane.com. Thank you, The Shuttlelane Team.`
          );
        }
      });

      const bookingsAwaitingAssignment = await BookingModel.find({
        bookingStatus: "Not yet assigned",
      })
        .populate({
          path: "booking",
        })
        .populate({
          path: "bookingCurrency",
        })
        .populate({
          path: "assignedDriver",
        })
        .populate({
          path: "assignedVendor",
        })
        .populate({
          path: "paymentId",
        })
        .populate({
          path: "assignedDriver",
        })
        .populate({
          path: "user",
        })
        .sort({ createdAt: -1 });

      const updatedUnassignedBookings = bookingsAwaitingAssignment?.filter(
        (booking) => {
          return (
            booking?.bookingType !== "Visa" &&
            booking?.paymentId?.paymentStatus == "Successful"
          );
        }
      );

      return {
        status: 201,
        updatedUnassignedBookings,
        message: `Booking has been successfully assigned to ${vendor?.companyName}`,
      };
    } else if (userType == "Unregistered Driver") {
      const updateBooking = await BookingModel.findOneAndUpdate(
        {
          _id: bookingId,
        },
        {
          isAssignedToUnregisteredDriver: true,
          assignedUnregisteredDriver: unregisteredDriver,
          assignedUnregisteredCar: unregisteredCar,
          hasDriverAccepted: true,
          hasDriverDeclined: false,
          isAssignedToDriver: false,
          isAssignedToVendor: false,
          bookingStatus: "Scheduled",
          bookingRate: bookingRate,
        }
      ).populate({
        path: "booking",
      });

      const booking = await BookingModel.findOne({ _id: bookingId })
        .populate("booking")
        .populate("user")
        .populate("assignedDriver")
        .populate("assignedVendor")
        .populate("vendorAssignedDriver")
        .populate("assignedCar")
        .populate("bookingCurrency");

      await sendSMS(
        unregisteredDriver?.mobile,
        `Dear ${unregisteredDriver?.firstName}, a booking has been assigned to you with reference: ${booking?.bookingReference}. Thank you, The Shuttlelane Team.`
      );

      // Send email to user here
      // Send a notification to the user
      const userBookingDetails = await generateUserBookingDetails(booking);
      let dynamicTemplateData = {
        bookingReference: booking?.bookingReference,
        title: firstEmailValue(booking?.user?.title, booking?.title, "Customer"),
        firstName: firstEmailValue(
          booking?.user?.firstName,
          booking?.firstName,
          "Customer"
        ),
        bookingDetails: userBookingDetails,
      };

      let msg = {
        to: booking?.email ?? booking?.user?.email,
        from: "booking@shuttlelane.com",
        subject: "Your Booking Has Been Scheduled",
        templateId: "d-07c6b4b45f944ef38c55af74685e7143",
        dynamicTemplateData,
      };

      await sendSGDynamicEmail(msg);

      // TO-DO: Send confirmation email to driver here
      const bookingDetails = await generateBookingDetails(booking);
      const driverDynamicTemplateData = {
        driverName: formatEmailName(
          unregisteredDriver?.firstName,
          unregisteredDriver?.lastName
        ),
        bookingDetails: bookingDetails,
      };

      msg = {
        to: unregisteredDriver?.email,
        from: "booking@shuttlelane.com",
        subject: `Booking Confirmation: ${booking?.bookingReference}`,
        templateId: "d-373023cee4eb4b9b8ad2c5e121bd0354",
        dynamicTemplateData: driverDynamicTemplateData,
      };

      await sendSGDynamicEmail(msg);

      const bookingsAwaitingAssignment = await BookingModel.find({
        bookingStatus: "Not yet assigned",
      })
        .populate("booking")
        .populate("paymentId");

      const updatedUnassignedBookings = bookingsAwaitingAssignment?.filter(
        (booking) => {
          return (
            booking?.bookingType !== "Visa" &&
            booking?.paymentId?.paymentStatus === "Successful"
          );
        }
      );

      return {
        status: 201,
        updatedUnassignedBookings,
        message: `Booking has been successfully assigned to ${unregisteredDriver?.firstName} ${unregisteredDriver?.lastName}.`,
      };
    }
  }

  // This service GETS upcoming bookings i.e Bookings that have been assigned to a driver but have not been completed
  async getUpcomingBookings() {
    // Fetch upcoming bookings
    const upcomingBookings = await BookingModel.find({
      bookingStatus: "Scheduled",
    })
      .populate("paymentId")
      .populate("user")
      .populate("booking")
      .sort({ createdAt: -1 });

    return {
      status: 200,
      message: `Fetched upcoming bookings.`,
      bookings: upcomingBookings,
    };
  }

  // This service GETS bookings that have not been assigned to a driver / vendor
  async getVisaOnArrivalBookings() {
    // Fetch upcoming bookings
    const visaOnArrivalBookings = await BookingModel.find({
      bookingType: "Visa",
    })
      .populate("paymentId")
      .populate("user")
      .populate("booking");

    return {
      status: 200,
      message: `Fetched visa on arrival bookings.`,
      bookings: visaOnArrivalBookings,
    };
  }

  // This service GETS bookings that have not been assigned to a driver / vendor
  async getBookingsAwaitingAssignment() {
    console.log("OVER HERE 1");
    // Fetch upcoming bookings
    const bookingsAwaitingAssignment = await BookingModel.find({
      bookingStatus: "Not yet assigned",
    })
      .populate({
        path: "booking",
      })
      .populate({
        path: "bookingCurrency",
      })
      .populate({
        path: "assignedDriver",
      })
      .populate({
        path: "assignedVendor",
      })
      .populate({
        path: "paymentId",
      })
      .populate({
        path: "assignedDriver",
      })
      .populate({
        path: "user",
      })
      .sort({ createdAt: -1 });

    // Remove Visa On Arrival Bookings and return only bookings with successful payments
    const filteredBookings = bookingsAwaitingAssignment?.filter((booking) => {
      return (
        booking?.bookingType !== "Visa" &&
        booking?.paymentId?.paymentStatus == "Successful"
      );
    });

    return {
      status: 200,
      message: `Fetched all bookings awaiting assignment.`,
      bookings: filteredBookings,
    };
  }

  // This service DELETES a driver by id
  async deleteDriverById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any driver exists with the _id
    const driver = await DriverModel.findOneAndRemove({ _id: _id });

    if (!driver) {
      return {
        status: 404,
        message: `No driver with _id ${_id} exists.`,
      };
    }

    const drivers = await DriverModel.find({}).sort({ createdAt: -1 });
    const data = await DriverModel.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
          drivers: { $push: "$$ROOT" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    return {
      status: 201,
      message: `Driver deleted successfully.`,
      drivers: drivers,
      data: data,
    };
  }

  // VENDORS
  // This service GETS all vendors
  async getVendors() {
    // Get vendors
    const vendors = await VendorModel.find({
      isAccountApproved: true,
      isAccountBlocked: false,
    })
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      })
      .populate({
        path: "fleet",
      })
      .populate({
        path: "drivers",
      })
      .populate({
        path: "completedBookings",
      })
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "upcomingBookings",
      });

    console.log("VENDORS FROM GET VENDORS:", vendors);

    const data = await VendorModel.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
          vendors: { $push: "$$ROOT" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    console.log("vendors:", vendors);

    return {
      status: 200,
      message: `Fetched vendors.`,
      vendors: vendors,
      data: data,
    };
  }

  // This service GETS all approved Vendors
  async getApprovedVendors() {
    // Get vendors
    const vendors = await VendorModel.find({
      isAccountApproved: true,
      isAccountBlocked: false,
    })
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      });

    const data = await VendorModel.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
          vendors: { $push: "$$ROOT" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    console.log("vendors:", vendors);
    console.log("data:", data);

    return {
      status: 200,
      message: `Fetched approved vendors.`,
      vendors: vendors,
      data: data,
    };
  }

  // This service GETS all unapproved Vendors
  async getUnapprovedVendors() {
    // Get vendors
    const vendors = await VendorModel.find({
      isAccountApproved: false,
    })
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      });

    return {
      status: 200,
      message: `Fetched unapproved vendors.`,
      vendors: vendors,
    };
  }

  // This service GETS a vendor by their id
  async getVendorById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any vendor exists with the vendor id
    const vendor = await VendorModel.findOne({
      _id: _id,
    })
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      });

    if (!vendor) {
      return {
        status: 404,
        message: "No vendor exists with the id specified.",
        vendor: vendor,
      };
    }

    return {
      status: 200,
      message: `Fetched vendor with id ${_id}.`,
      vendor: vendor,
    };
  }

  // This service APPROVES a vendor account by their id
  async approveVendorAccount(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any vendor exists with the vendor id
    const updatedVendor = await VendorModel.findOneAndUpdate(
      {
        _id: _id,
      },
      { isAccountApproved: true }
    )
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      });

    // Get the vendor
    const vendor = await VendorModel.findOne({
      _id: _id,
    })
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      });

    if (!vendor) {
      return {
        status: 404,
        message: "No vendor exists with the id specified.",
        vendor: vendor,
      };
    }

    // TO-DO: Send vendor a confirmation email here
    let dynamicTemplateData = {
      companyName: vendor?.companyName,
    };

    const templateId = "d-0ea2352470254998bcd00d840a37bb0b";

    let msg = {
      to: vendor?.companyEmail ?? vendor?.contactEmail,
      from: "info@shuttlelane.com",
      subject: "Vendor Account Has Been Approved🎉",
      templateId: templateId,
      dynamicTemplateData,
    };

    await sendSGDynamicEmail(msg);

    const vendors = await VendorModel.find({});

    return {
      status: 201,
      message: `Vendor account has been approved`,
      vendors: vendors,
    };
  }

  // This service REJECTS a vendor account application by their id
  async rejectVendorAccount(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any vendor exists with the vendor id
    const updatedVendor = await VendorModel.findOneAndUpdate(
      {
        _id: _id,
      },
      { isAccountApproved: false }
    )
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      });

    // Get the vendor
    const vendor = await VendorModel.findOne({
      _id: _id,
    })
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      });

    if (!vendor) {
      return {
        status: 404,
        message: "No vendor exists with the id specified.",
        vendor: vendor,
      };
    }

    // TO-DO: Send vendor a confirmation email here
    let dynamicTemplateData = {
      companyName: vendor?.companyName,
    };

    const templateId = "d-9608d98927a04818a2e41e57f9ec4111";

    let msg = {
      to: vendor?.companyEmail ?? vendor?.contactEmail,
      from: "info@shuttlelane.com",
      subject: "Vendor Account Application Has Been Rejected",
      templateId: templateId,
      dynamicTemplateData,
    };

    await sendSGDynamicEmail(msg);

    const vendors = await VendorModel.find({});

    return {
      status: 201,
      message: `Vendor application has been rejected`,
      vendors: vendors,
    };
  }

  // This service fetches SUSPENDED vendor accounts
  async fetchSuspendVendorAccounts() {
    const suspendedVendorAccounts = await VendorModel.find({
      isAccountBlocked: true,
    }).sort({ createdAt: -1 });

    return {
      status: 200,
      message: `All suspended vendor accounts fetched`,
      suspendedVendorAccounts: suspendedVendorAccounts,
    };
  }

  // This service SUSPENDS a vendor account by their id
  async suspendVendorAccount(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any vendor exists with the vendor id
    const updatedVendor = await VendorModel.findOneAndUpdate(
      {
        _id: _id,
      },
      { isAccountBlocked: true }
    )
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      });

    // Get the vendor
    const vendor = await VendorModel.findOne({
      _id: _id,
    })
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      });

    if (!vendor) {
      return {
        status: 404,
        message: "No vendor exists with the id specified.",
        vendor: vendor,
      };
    }

    // TO-DO: Send vendor a confirmation email here
    let dynamicTemplateData = {
      companyName: vendor?.companyName,
    };

    const templateId = "d-865b59a46cb347ab914ec3886e6f03a0";

    let msg = {
      to: vendor?.companyEmail ?? vendor?.contactEmail,
      from: "info@shuttlelane.com",
      subject: "Vendor Account Has Been Temporarily Suspended",
      templateId: templateId,
      dynamicTemplateData,
    };

    await sendSGDynamicEmail(msg);

    const vendors = await VendorModel.find({
      isAccountApproved: true,
      isAccountBlocked: false,
    }).sort({ createdAt: -1 });

    const suspendedVendorAccounts = await VendorModel.find({
      isAccountBlocked: true,
    }).sort({ createdAt: -1 });

    return {
      status: 201,
      message: `Vendor account has been suspended`,
      vendors: vendors,
      suspendedVendorAccounts: suspendedVendorAccounts,
    };
  }

  // This service UNSUSPENDS a vendor account by their id
  async unsuspendVendorAccount(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any vendor exists with the vendor id
    const updatedVendor = await VendorModel.findOneAndUpdate(
      {
        _id: _id,
      },
      { isAccountBlocked: false }
    )
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      });

    // Get the vendor
    const vendor = await VendorModel.findOne({
      _id: _id,
    })
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      });

    if (!vendor) {
      return {
        status: 404,
        message: "No vendor exists with the id specified.",
        vendor: vendor,
      };
    }

    // TO-DO: Send vendor a confirmation email here
    let dynamicTemplateData = {
      companyName: vendor?.companyName,
    };

    const templateId = "d-79a6c8bf25f942aba3f3fa9f33096db8";

    let msg = {
      to: vendor?.companyEmail ?? vendor?.contactEmail,
      from: "info@shuttlelane.com",
      subject: "Welcome Back!",
      templateId: templateId,
      dynamicTemplateData,
    };

    await sendSGDynamicEmail(msg);

    const vendors = await VendorModel.find({
      isAccountApproved: true,
      isAccountBlocked: false,
    }).sort({ createdAt: -1 });

    const suspendedVendorAccounts = await VendorModel.find({
      isAccountBlocked: true,
    }).sort({ createdAt: -1 });

    return {
      status: 201,
      message: `Vendor account has been unsuspended`,
      vendors: vendors,
      suspendedVendorAccounts: suspendedVendorAccounts,
    };
  }

  // This service DELETES a vendor by id
  async deleteVendorById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any vendor exists with the _id
    const vendor = await VendorModel.findOneAndRemove({ _id: _id });

    if (!vendor) {
      return {
        status: 404,
        message: `No vendor with _id ${_id} exists.`,
      };
    }

    const vendors = await VendorModel.find({})
      .sort({ createdAt: -1 })
      .populate({
        path: "bookingsAssignedTo",
      })
      .populate({
        path: "operatingCities",
      });
    const data = await VendorModel.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
          vendors: { $push: "$$ROOT" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    return {
      status: 201,
      message: `Vendor deleted successfully.`,
      vendors: vendors,
      data: data,
    };
  }

  // ENQUIRIES
  // This service GETS all enquiries
  async getEnquiries() {
    // Get enquiries
    const enquiries = await EnquiryModel.find({}).sort({ createdAt: -1 });

    return {
      status: 200,
      message: `Fetched enquiries.`,
      enquiries: enquiries,
    };
  }

  // This service GETS a enquiry by their id
  async getEnquiryById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any enquiry exists with the enquiry id
    const enquiry = await EnquiryModel.findOne({
      _id: _id,
    });

    if (!enquiry) {
      return {
        status: 404,
        message: "No enquiry exists with the id specified.",
        enquiry: enquiry,
      };
    }

    return {
      status: 200,
      message: `Fetched enquiry with id ${_id}.`,
      enquiry: enquiry,
    };
  }

  // This service marks an enquiry as read
  async markEnquiryAsRead(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any enquiry exists with the enquiry id
    const enquiry = await EnquiryModel.findOneAndUpdate(
      {
        _id: _id,
      },
      { isRead: true }
    );

    if (!enquiry) {
      return {
        status: 404,
        message: "No enquiry exists with the id specified.",
        enquiry: enquiry,
      };
    }

    const enquiries = await EnquiryModel.find({});

    return {
      status: 201,
      message: `Enquiry marked as read`,
      enquiry: enquiry,
      enquiries: enquiries,
    };
  }

  // This service marks an enquiry as unread
  async markEnquiryAsUnread(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any enquiry exists with the enquiry id
    const enquiry = await EnquiryModel.findOneAndUpdate(
      {
        _id: _id,
      },
      { isRead: false }
    );

    if (!enquiry) {
      return {
        status: 404,
        message: "No enquiry exists with the id specified.",
        enquiry: enquiry,
      };
    }

    const enquiries = await EnquiryModel.find({});

    return {
      status: 201,
      message: `Enquiry marked as read`,
      enquiry: enquiry,
      enquiries: enquiries,
    };
  }

  // This service DELETES a enquiry by id
  async deleteEnquiryById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any enquiry exists with the _id
    const enquiry = await EnquiryModel.findOneAndRemove({ _id: _id });

    if (!enquiry) {
      return {
        status: 404,
        message: `No enquiry with _id ${_id} exists.`,
      };
    }

    const enquiries = await EnquiryModel.find({}).sort({ createdAt: -1 });

    return {
      status: 201,
      message: `Enquiry deleted successfully.`,
      enquiries: enquiries,
    };
  }

  // BULK EMAIL
  // This service sends bulk email to a select target audience
  async handleSendBulkEmail(targetAudience, subject, email) {
    // Get users
    const users = await UserModel.find({});
    const drivers = await DriverModel.find({});
    const vendors = await VendorModel.find({});

    // Prepare email addresses
    let recipients;
    if (targetAudience === "users") {
      recipients = users;
    } else if (targetAudience === "drivers") {
      recipients = drivers;
    } else if (targetAudience === "vendors") {
      recipients = vendors;
    } else {
      recipients = [...users, ...drivers, ...vendors];
    }

    if (!recipients || recipients?.length < 1) {
      return {
        status: 404,
        message: "There are no recipients in the chosen category.",
      };
    }

    const response = await sendBulkEmail(recipients, subject, email);

    return {
      status: response?.status,
      message: response?.message,
    };
  }

  async handleSendPushNotifications(targetAudience, targetDevice, title, message) {
    const areFieldsEmpty = validateFields([
      targetAudience,
      targetDevice,
      title,
      message,
    ]);

    if (areFieldsEmpty) return areFieldsEmpty;

    const response = await sendPushBroadcast({
      targetAudience,
      targetDevice,
      title,
      body: message,
      source: "admin",
    });

    return response;
  }

  // CURRENCY AND RATES
  // This service GETS all currencies
  async getCurrencies() {
    // Get currencies
    const currencies = await CurrencyModel.find({}).sort({ createdAt: -1 });

    return {
      status: 200,
      message: `Fetched currencies.`,
      currencies: currencies,
    };
  }
  // This service creates a new currency
  async createNewCurrency(
    currencyLabel,
    exchangeRatePercentage,
    additionalRate,
    currencySymbol,
    currenncyAlias,
    supportedCountries
  ) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([
      currencyLabel,
      exchangeRatePercentage,
      additionalRate,
      currencySymbol,
      currenncyAlias,
      supportedCountries,
    ]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any admin exists with the adminname
    const currencyExists = await CurrencyModel.findOne({
      currencyLabel: currencyLabel,
    });

    if (currencyExists) {
      return {
        status: 403,
        message: "A currency with the specified label already exists!",
      };
    }

    const newCurrency = await CurrencyModel.create({
      currencyLabel,
      exchangeRatePercentage,
      additionalRate,
      symbol: currencySymbol,
      alias: currenncyAlias,
      supportedCountries,
    });

    const currencies = await CurrencyModel.find({}).sort({ createdAt: -1 });

    return {
      status: 201,
      message: `Currency created successfully~`,
      currencies: currencies,
    };
  }
  // This service UPDATES a currency
  async updateCurrency(
    _id,
    currencyLabel,
    exchangeRatePercentage,
    additionalRate,
    symbol,
    alias,
    supportedCountries
  ) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([
      _id,
      currencyLabel,
      exchangeRatePercentage,
      additionalRate,
      symbol,
      alias,
      supportedCountries,
    ]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Update currency
    const updatedCurrency = await CurrencyModel.findOneAndUpdate(
      { _id },
      {
        currencyLabel,
        exchangeRatePercentage,
        additionalRate,
        symbol,
        alias,
        supportedCountries,
      }
    );

    const currencies = await CurrencyModel.find({}).sort({
      createdAt: -1,
    });

    return {
      status: 201,
      message: `Currency updated successfully!`,
      currencies,
    };
  }

  // This service DELETES a currency
  async deleteCurrency(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any currency exists with the id provided
    const currencyExists = await CurrencyModel.findOneAndDelete({
      _id: _id,
    });

    if (!currencyExists) {
      return {
        status: 404,
        message: "No currency exists with the id specified!",
      };
    }

    const currencies = await CurrencyModel.find({}).sort({
      createdAt: -1,
    });

    return {
      status: 201,
      message: `Currency deleted successfully!`,
      currencies,
    };
  }

  // RATE PER MILE
  // This service sets the rate per mile
  async setRatePerMile(rate, mile, city) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([rate, mile, city]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any RATE PER MILE exists with the specified city
    const rpmExists = await RatePerMileModel.findOne({ city: city });

    console.log("HELLO FROM HERE:::", rpmExists);

    // If there is a document already, update it
    if (rpmExists) {
      const updatedRPM = await RatePerMileModel.findOneAndUpdate(
        { _id: rpmExists?._id },
        { rate, mile, city }
      );
      const updatedRPMs = await RatePerMileModel.find({}).populate("city");
      return {
        status: 201,
        message: `Rate per mile updated successfully!`,
        ratePerMile: updatedRPM,
        ratesPerMile: updatedRPMs,
      };
    }

    const newRPM = await RatePerMileModel.create({
      rate,
      mile,
      city,
    });

    const updatedRPMs = await RatePerMileModel.find({}).populate("city");

    return {
      status: 201,
      message: `Rate per mile updated successfully~`,
      ratePerMile: newRPM,
      ratesPerMile: updatedRPMs,
    };
  }

  // This service DELETES a rate
  async deleteRatePerMile(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any currency exists with the id provided
    const rpmExists = await RatePerMileModel.findOneAndDelete({
      _id: _id,
    });

    if (!rpmExists) {
      return {
        status: 404,
        message: "No rate exists with the id specified!",
      };
    }

    const ratesPerMile = await RatePerMileModel.find({}).populate("city");

    return {
      status: 201,
      message: `Rate deleted successfully!`,
      ratesPerMile,
    };
  }

  // This service GETS all rates per mile
  async getRatesPerMile() {
    // Get rates per mile
    const ratesPerMile = await RatePerMileModel.find({}).populate("city");

    return {
      status: 200,
      message: `Fetched rates.`,
      ratesPerMile: ratesPerMile,
    };
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

  // This service creates a new visa on arrival rate
  async createNewVisaOnArrivalRate(
    country,
    visaFee,
    isNigerianVisaRequired,
    isBiometricsRequired,
    enableDifferentBiometricFee,
    biometricFee
  ) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([
      country,
      visaFee,
      isNigerianVisaRequired,
      isBiometricsRequired,
    ]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any admin exists with the adminname
    const countryExists = await VisaOnArrivalRateModel.findOne({
      country: country,
    });

    if (countryExists) {
      return {
        status: 403,
        message: "This country already exists!",
      };
    }

    // Get base fees
    const voaBaseFees = await VoaBaseFeesModel.find();
    if (!voaBaseFees) {
      return {
        status: 404,
        message:
          "You must set the base fees first before performing this action!",
      };
    }

    // Calculate total fees
    let totalFees;
    if (isBiometricsRequired == true) {
      const biometricFeeToUse = enableDifferentBiometricFee
        ? biometricFee
        : voaBaseFees[0]?.biometricFee;
      totalFees = Number(
        +voaBaseFees[0]?.transactionFee +
          +voaBaseFees[0]?.processingFee +
          +biometricFeeToUse +
          +visaFee
      ).toFixed(2);
    } else {
      totalFees = Number(
        +voaBaseFees[0]?.transactionFee +
          +voaBaseFees[0]?.processingFee +
          +visaFee
      ).toFixed(2);
    }

    // Calculate VAT - 7.5%
    const vat = Number((7.5 / 100) * totalFees).toFixed(2);

    const total = Number(+totalFees + +vat).toFixed(2);

    // Create Visa on arrival rate
    const newVisaOnArrivalRate = await VisaOnArrivalRateModel.create({
      country,
      isNigerianVisaRequired,
      isBiometricsRequired,
      voaBaseFees: voaBaseFees[0]?._id,
      visaFee,
      enableDifferentBiometricFee,
      biometricFee,
      vat,
      total,
    });

    const visaOnArrivalRates = await VisaOnArrivalRateModel.find({})
      .sort({
        createdAt: -1,
      })
      .populate("voaBaseFees");

    return {
      status: 201,
      message: `Country added successfully!`,
      visaOnArrivalRates,
    };
  }

  // This service UPDATES a visa on arrival rate
  async updateVisaOnArrivalRate(
    _id,
    country,
    visaFee,
    isNigerianVisaRequired,
    isBiometricsRequired,
    voaBaseFeeId,
    enableDifferentBiometricFee,
    biometricFee
  ) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([
      _id,
      country,
      visaFee,
      isNigerianVisaRequired,
      isBiometricsRequired,
      voaBaseFeeId,
    ]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any visaOnArrivalRate exists with the id provided
    const countryExists = await VisaOnArrivalRateModel.findOne({
      _id: _id,
    });

    if (!countryExists) {
      return {
        status: 404,
        message: "No country / rate exists with the id specified!",
      };
    }

    // Get base fees
    const voaBaseFees = await VoaBaseFeesModel.findOne({ _id: voaBaseFeeId });
    if (!voaBaseFees) {
      return {
        status: 404,
        message:
          "You must set the base fees first before performing this action!",
      };
    }

    // Calculate total fees
    let totalFees;
    if (isBiometricsRequired == true) {
      const biometricFeeToUse = enableDifferentBiometricFee
        ? biometricFee
        : voaBaseFees?.biometricFee;

      console.log(
        "ENABLE DIFFERENT BIOMETRIC FEE:",
        enableDifferentBiometricFee
      );
      console.log("BIOMETRIC FEE TO USE:", biometricFeeToUse);
      console.log("BASE RATES:", voaBaseFees);
      console.log("BIOMETRIC FEE:", voaBaseFees?.biometricFee);

      totalFees = Number(
        +voaBaseFees?.transactionFee +
          +voaBaseFees?.processingFee +
          +biometricFeeToUse +
          +visaFee
      ).toFixed(2);
    } else {
      totalFees = Number(
        +voaBaseFees?.transactionFee + +voaBaseFees?.processingFee + +visaFee
      ).toFixed(2);
    }

    // Calculate VAT - 7.5%
    const vat = Number((7.5 / 100) * totalFees).toFixed(2);

    const total = Number(+totalFees + +vat).toFixed(2);

    // Update Visa on arrival rate
    const updatedVisaOnArrivalRate =
      await VisaOnArrivalRateModel.findOneAndUpdate(
        { _id },
        {
          country,
          visaFee,
          vat,
          total,
          isNigerianVisaRequired,
          isBiometricsRequired,
          enableDifferentBiometricFee,
          biometricFee,
        }
      );

    const visaOnArrivalRates = await VisaOnArrivalRateModel.find({})
      .sort({
        createdAt: -1,
      })
      .populate("voaBaseFees");

    return {
      status: 201,
      message: `Country rate updated successfully!`,
      visaOnArrivalRates,
    };
  }

  // This service DELETES a visa on arrival rate
  async deleteVisaOnArrivalRate(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any visaOnArrivalRate exists with the id provided
    const countryExists = await VisaOnArrivalRateModel.findOneAndDelete({
      _id: _id,
    });

    if (!countryExists) {
      return {
        status: 404,
        message: "No country / rate exists with the id specified!",
      };
    }

    const visaOnArrivalRates = await VisaOnArrivalRateModel.find({})
      .sort({
        createdAt: -1,
      })
      .populate("voaBaseFees");

    return {
      status: 201,
      message: `Country rate deleted successfully!`,
      visaOnArrivalRates,
    };
  }

  // VOA BASE FEES
  // This service GETS the base fees for visa on arrival
  async getVisaOnArrivalBaseRates() {
    // Get visaOnArrivalBaseRates
    const voaBaseFees = await VoaBaseFeesModel.find({});

    return {
      status: 200,
      message: `Fetched visa on arrival BASE rates.`,
      voaBaseFees: voaBaseFees[0],
    };
  }
  // This service sets the base rates for visa on arrival
  async setVisaOnArrivalBaseRates(
    transactionFee,
    processingFee,
    biometricFee,
    _id
  ) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([
      transactionFee,
      processingFee,
      biometricFee,
      _id,
    ]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any document already exists (CAN ONLY HAVE 1 VOA BASE RATE DOCUMENT)
    const voaBaseRateExists = await VoaBaseFeesModel.findOne({ _id });

    console.log("HELLO FROM HERE:::", voaBaseRateExists);

    // If the voaBaseRate already exists i.e If there is an existing document on the database
    if (voaBaseRateExists) {
      voaBaseRateExists.transactionFee = transactionFee;
      voaBaseRateExists.processingFee = processingFee;
      voaBaseRateExists.biometricFee = biometricFee;

      console.log("HELLO UPDATED VOA BASE FEES:", voaBaseRateExists);
      await voaBaseRateExists.save();

      // Loop through all the visa on arrival rates / countries and update their tax and total fees
      const visaOnArrivalRates = await VisaOnArrivalRateModel.find({});

      let totalFees, vat, total;
      visaOnArrivalRates?.forEach(async (rate) => {
        // Calculate total fees
        totalFees =
          +voaBaseRateExists?.transactionFee +
          +voaBaseRateExists?.processingFee +
          +voaBaseRateExists?.biometricFee +
          +rate?.visaFee;

        // Calculate VAT - 7.5%
        vat = Number((7.5 / 100) * totalFees).toFixed(2);

        total = Number(+totalFees + +vat).toFixed(2);

        rate.total = total;
        rate.vat = vat;

        console.log("TOTAL::", total);
        console.log("VAT::", vat);

        await rate.save();
      });

      const voaRates = await VisaOnArrivalRateModel.find({});
      return {
        status: 201,
        message: `Base rates updated successfully!`,
        voaBaseRates: voaBaseRateExists,
        visaOnArrivalRates: voaRates,
      };
    }

    // If there is no voaBaseRate document on the database, then create one
    const newVoaBaseRate = await VoaBaseFeesModel.create({
      transactionFee,
      processingFee,
      biometricFee,
    });

    return {
      status: 201,
      message: `Base rates updated successfully!`,
      voaBaseRates: newVoaBaseRate,
    };
  }

  // This service GETS an admin by their id
  async getAdminById(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any admin exists with the adminname
    const admin = await this.AdminModel.findOne({
      _id: _id,
    }).populate({
      path: "bookings",
    });

    if (!admin) {
      return {
        status: 404,
        message: "No admin exists with the id specified.",
        admin: admin,
      };
    }

    return {
      status: 200,
      message: `Fetched admin with id ${_id}.`,
      admin: admin,
    };
  }

  // This service DELETES admin by email
  // TO-DO: Send OTP along with the email to verify the admin is actually sending the request to delete his/her account
  async deleteAdminByEmail(email) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([email]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any admin exists with the email
    const admin = await this.AdminModel.findOneAndRemove({ email: email });

    if (!admin) {
      return {
        status: 404,
        message: `No admin with email ${email} exists.`,
      };
    }

    return {
      status: 201,
      message: `Admin with email ${email} has been deleted successfully.`,
    };
  }

  // This service UPDATES a admin by id
  async updateAdminById(_id, updatedAdmin) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id, updatedAdmin]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Check if any admin exists with the _id
    const admin = await this.AdminModel.findOneAndUpdate(
      { _id: _id },
      { ...updatedAdmin }
    );

    if (!admin) {
      return {
        status: 404,
        message: `No admin with _id ${_id} exists.`,
      };
    }

    return {
      status: 201,
      message: `Admin with _id ${_id} has been updated successfully.`,
    };
  }

  // This service UPDATES a booking status by id
  async updateBookingStatus(
    _id,
    bookingStatus,
    bookingType,
    isDashboardHomeRequest = false
  ) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id, bookingStatus, bookingType]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Update the booking
    const updatedBooking = await BookingModel.findOneAndUpdate(
      { _id: _id },
      { bookingStatus: bookingStatus }
    );

    if (!updatedBooking) {
      return {
        status: 404,
        message: `No booking with _id ${_id} exists.`,
      };
    }

    // Upcoming bookings
    let upcomingBookings, bookings;

    if (bookingType == "airport") {
      upcomingBookings = isDashboardHomeRequest
        ? await BookingModel.find({
            bookingStatus: "Scheduled",
          })
            .sort({ createdAt: -1 })
            .populate("booking")
            .populate("paymentId")
        : await BookingModel.find({
            bookingStatus: "Scheduled",
            bookingType: "Airport",
          })
            .sort({ createdAt: -1 })
            .populate("booking")
            .populate("paymentId");
      bookings = await BookingModel.find({ bookingType: "Airport" })
        .sort({ createdAt: -1 })
        .populate("booking")
        .populate("paymentId");
    } else if (bookingType == "car") {
      upcomingBookings = isDashboardHomeRequest
        ? await BookingModel.find({
            bookingStatus: "Scheduled",
          })
            .sort({ createdAt: -1 })
            .populate("booking")
            .populate("paymentId")
        : await BookingModel.find({
            bookingStatus: "Scheduled",
            bookingType: "Car",
          })
            .sort({ createdAt: -1 })
            .populate("booking")
            .populate("paymentId");
      bookings = await BookingModel.find({ bookingType: "Car" })
        .sort({ createdAt: -1 })
        .populate("booking")
        .populate("paymentId");
    } else if (bookingType == "priority") {
      upcomingBookings = isDashboardHomeRequest
        ? await BookingModel.find({
            bookingStatus: "Scheduled",
          })
            .sort({ createdAt: -1 })
            .populate("booking")
            .populate("paymentId")
        : await BookingModel.find({
            bookingStatus: "Scheduled",
            bookingType: "Priority",
          })
            .sort({ createdAt: -1 })
            .populate("booking")
            .populate("paymentId");
      bookings = await BookingModel.find({ bookingType: "Priority" })
        .sort({ createdAt: -1 })
        .populate("booking")
        .populate("paymentId");
    } else if (bookingType == "visa") {
      upcomingBookings = isDashboardHomeRequest
        ? await BookingModel.find({
            bookingStatus: "Scheduled",
          })
            .sort({ createdAt: -1 })
            .populate("booking")
            .populate("paymentId")
        : await BookingModel.find({
            bookingStatus: "Scheduled",
            bookingType: "Visa",
          })
            .sort({ createdAt: -1 })
            .populate("booking")
            .populate("paymentId");

      bookings = await BookingModel.find({ bookingType: "Visa" })
        .sort({ createdAt: -1 })
        .populate("booking")
        .populate("paymentId");
    }

    const bookingsAwaitingAssignment = await BookingModel.find({
      bookingStatus: "Not yet assigned",
    })
      .populate("booking")
      .populate("paymentId")
      .sort({ createdAt: -1 });

    const updatedUnassignedBookings = bookingsAwaitingAssignment?.filter(
      (booking) => {
        return (
          booking?.bookingType !== "Visa" &&
          booking?.paymentId?.paymentStatus === "Successful"
        );
      }
    );

    return {
      status: 201,
      message: `Booking status has been updated.`,
      bookings: bookings,
      upcomingBookings: upcomingBookings,
      unassignedBookings: updatedUnassignedBookings,
    };
  }

  // This service GENERATES an auth secret for the admin
  async generateAuthSecret(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Find the admin
    const admin = await this.AdminModel.findOne({ _id: _id });

    if (!admin) {
      return {
        status: 404,
        message: `No admin exists with _id ${_id}.`,
      };
    }

    // Generate auth token
    // Generate the TOTP secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `Shuttlelane Admin:${admin?.email}`,
    });

    const otpAuthUrl = speakeasy.otpauthURL({
      secret: secret.ascii,
      label: `Shuttlelane Admin:${admin?.email}`,
      encoding: "ascii",
    });
    // Generate the QR code as a data URL
    const qrCodeUrl = await qrcode.toDataURL(otpAuthUrl);

    return {
      status: 200,
      secret: secret,
      qrCode: qrCodeUrl,
    };
  }

  // This service ENABLES 2fa for an admin
  async enable2fa(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Update the admin
    const admin = await this.AdminModel.findOneAndUpdate(
      { _id: _id },
      { is2faTurnedOn: true }
    );

    if (!admin) {
      return {
        status: 404,
        message: `No admin exists with _id ${_id}.`,
      };
    }

    const updatedAdmin = await this.AdminModel.findOne({ _id: _id });

    return {
      status: 201,
      admin: updatedAdmin,
    };
  }

  // This service DISABLES 2fa for an admin
  async disable2fa(_id) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Update the admin
    const admin = await this.AdminModel.findOneAndUpdate(
      { _id: _id },
      { is2faTurnedOn: false }
    );

    if (!admin) {
      return {
        status: 404,
        message: `No admin exists with _id ${_id}.`,
      };
    }

    console.log("ADMIN:", admin);

    const updatedAdmin = await this.AdminModel.findOne({ _id: _id });
    console.log("UPDATED ADMIN:", updatedAdmin);

    return {
      status: 201,
      admin: updatedAdmin,
    };
  }

  // This service GENERATES an auth secret for the admin
  async verifyAuthOtp(_id, code) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([_id]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Find the admin
    const admin = await this.AdminModel.findOne({ _id: _id });

    if (!admin) {
      return {
        status: 404,
        message: `No admin exists with _id ${_id}.`,
      };
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: admin.authSecret, // Retrieve the admin's secret from the database
      encoding: "base32",
      token: code,
    });

    if (verified) {
      const token = jwtSign(admin);
      return {
        status: 200,
        token: token,
        admin: admin,
        message: "Authentication succecssful",
      };
    } else {
      return {
        status: 403,
        message: "Authentication failed. Crosscheck the otp you have provided",
      };
    }
  }

  // --- NEW METHODS FOR PRIORITY PASSES (Similar to Car methods) ---

  // This service CREATES a new pass and adds it to a specified city's passes array
  async createPassForCity(cityId, name, price) {
    const areFieldsEmpty = validateFields([cityId, name, price]);
    if (areFieldsEmpty) return areFieldsEmpty;

    // Delegate to PriorityPassService to create and add to city
    const result = await new PriorityPassService(
      PriorityPassBookingModel
    ).createPass(name, price, cityId);

    // If result contains a `city` object, it means the operation was successful
    if (result.status === 201 && result.city) {
      return {
        status: 201,
        message: result.message,
        city: result.city, // Return the updated city with populated passes
      };
    } else {
      return result; // Propagate error or specific message
    }
  }

  // This service UPDATES a pass within a city
  async updatePassInCity(passId, values, cityId) {
    const areFieldsEmpty = validateFields([passId, values, cityId]);
    if (areFieldsEmpty) return areFieldsEmpty;

    // Delegate to PriorityPassService to update the pass
    const result = await new PriorityPassService(
      PriorityPassBookingModel
    ).updatePass(passId, values, cityId);

    if (result.status === 201 && result.city) {
      return {
        status: 201,
        message: result.message,
        city: result.city, // Return the updated city with populated passes
      };
    } else {
      return result;
    }
  }

  // This service DELETES a pass from a city
  async deletePassFromCity(passId, cityId) {
    const areFieldsEmpty = validateFields([passId, cityId]);
    if (areFieldsEmpty) return areFieldsEmpty;

    // Delegate to PriorityPassService to delete the pass
    const result = await new PriorityPassService(
      PriorityPassBookingModel
    ).deletePass(passId, cityId);

    if (result.status === 201 && result.city) {
      return {
        status: 201,
        message: result.message,
        city: result.city, // Return the updated city with populated passes
      };
    } else {
      return result;
    }
  }
}
