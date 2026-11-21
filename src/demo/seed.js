// DEMO ONLY: fills an empty demo database with test accounts and sample data
// so every page of the old Shuttlelane UI can be explored. Runs once at start-up
// when SEED_DEMO=true. Never point this at a production database.
import bcrypt from "bcryptjs";
import AdminModel from "../model/admin.model.js";
import UserModel from "../model/user.model.js";
import DriverModel from "../model/driver.model.js";
import VendorModel from "../model/vendor.model.js";
import VendorFleetModel from "../model/vendorFleet.model.js";
import VendorDriverModel from "../model/vendorDriver.model.js";
import CurrencyModel from "../model/currency.model.js";
import VehicleClassModel from "../model/vehicleClass.model.js";
import CityModel from "../model/city.model.js";
import RatePerMileModel from "../model/ratePerMile.model.js";
import CarModel from "../model/car.model.js";
import CarRentalCityModel from "../model/carRentalCity.model.js";
import PriorityPassModel from "../model/priorityPass.model.js";
import PriorityPassCityModel from "../model/priorityPassCity.model.js";
import VoaBaseFeesModel from "../model/voaBaseFees.model.js";
import VisaOnArrivalRateModel from "../model/visaOnArrivalRate.model.js";
import AirportTransferBookingModel from "../model/airportTransferBooking.model.js";
import CarRentalBookingModel from "../model/carRentalBooking.model.js";
import BookingModel from "../model/booking.model.js";
import PaymentModel from "../model/payment.model.js";
import PayoutsModel from "../model/payout.model.js";
import BlogModel from "../model/blog.model.js";
import EnquiryModel from "../model/enquiry.model.js";
import NotificationModel from "../model/notification.model.js";

const PASSWORD = "Demo@12345";
const img = (text) =>
  `https://placehold.co/600x400/262471/ffffff?text=${encodeURIComponent(text)}`;
const daysFromNow = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);

export default async function seedDemo() {
  try {
    if (await AdminModel.findOne({ username: "demoadmin" })) {
      console.log("DEMO SEED: data already present, skipping");
      return;
    }
    console.log("DEMO SEED: creating demo data...");
    const hash = bcrypt.hashSync(PASSWORD, 10);

    // ---------- Admin (all access rights) ----------
    const accessRights = Object.fromEntries(
      [
        "addBooking", "airportTransfer", "assignPartner", "blog", "bookingRates",
        "bulkEmail", "carRental", "citiesAndAirports", "deleteBooking",
        "exchangeRates", "manageAdminAccounts", "manageDrivers", "manageUsers",
        "manageVendors", "priorityPass", "pushNotifications", "visaOnArrival",
      ].map((k) => [k, true])
    );
    const admin = await AdminModel.create({
      firstName: "Demo", lastName: "Admin", email: "demo.admin@shuttlelane-demo.com",
      username: "demoadmin", password: hash, role: "Super Admin", accessRights,
      is2faTurnedOn: false,
    });
    await AdminModel.create({
      firstName: "Ada", lastName: "Blogger", email: "ada.blogger@shuttlelane-demo.com",
      username: "demoblogger", password: hash, role: "Blogger",
      accessRights: { blog: true }, is2faTurnedOn: false,
    });

    // ---------- Currencies ----------
    const [ngn, usd] = await CurrencyModel.insertMany([
      { currencyLabel: "Naira", supportedCountries: ["Nigeria"], exchangeRatePercentage: 0, additionalRate: 0, symbol: "₦", alias: "NGN" },
      { currencyLabel: "US Dollar", supportedCountries: ["United States"], exchangeRatePercentage: 3, additionalRate: 0, symbol: "$", alias: "USD" },
      { currencyLabel: "Pound Sterling", supportedCountries: ["United Kingdom"], exchangeRatePercentage: 3, additionalRate: 0, symbol: "£", alias: "GBP" },
      { currencyLabel: "Euro", supportedCountries: ["Germany", "France"], exchangeRatePercentage: 3, additionalRate: 0, symbol: "€", alias: "EUR" },
    ]);

    // ---------- Vehicle classes (from the client's fleet content) ----------
    const classes = await VehicleClassModel.insertMany([
      ["Economy", "Affordable and reliable airport transportation for individuals and small groups.", "3", "2", "35000"],
      ["Business SUV", "Comfortable executive transportation for business and leisure travellers.", "4", "3", "55000"],
      ["SUV", "Premium space, comfort and versatility.", "6", "4", "65000"],
      ["Executive", "Premium vehicles and professional chauffeurs for executives and VIPs.", "3", "3", "90000"],
      ["Premium Van", "Spacious transportation for families and small groups.", "8", "8", "110000"],
      ["Luxury", "Prestigious chauffeur-driven vehicles with refined interiors.", "3", "3", "150000"],
      ["Mini Bus", "Group transportation for conferences and tours.", "14", "14", "180000"],
    ].map(([className, description, passengers, luggages, basePrice]) => ({
      image: img(className), className, description, passengers, luggages, basePrice,
    })));

    // ---------- Cars (car rental) ----------
    const cars = await CarModel.insertMany([
      { name: "Toyota Camry 2020", price: "45000" },
      { name: "Toyota Prado 2021", price: "85000" },
      { name: "Mercedes-Benz S-Class", price: "200000" },
    ]);

    // ---------- Cities with airports ----------
    const lagos = await CityModel.create({
      cityName: "Lagos",
      airports: [
        { airportName: "Murtala Muhammed International Airport (LOS)", lat: 6.5774, lng: 3.3212 },
        { airportName: "Murtala Muhammed Domestic Airport (MM2)", lat: 6.5833, lng: 3.3278 },
      ],
      vehicleClasses: classes.map((c) => c._id),
      cars: cars.map((c) => c._id),
    });
    const abuja = await CityModel.create({
      cityName: "Abuja",
      airports: [{ airportName: "Nnamdi Azikiwe International Airport (ABV)", lat: 9.0068, lng: 7.2632 }],
      vehicleClasses: classes.slice(0, 4).map((c) => c._id),
      cars: cars.slice(0, 2).map((c) => c._id),
    });
    await CityModel.create({
      cityName: "Accra",
      airports: [{ airportName: "Kotoka International Airport (ACC)", lat: 5.6052, lng: -0.1668 }],
      vehicleClasses: classes.slice(0, 3).map((c) => c._id),
      cars: [],
    });
    await CarModel.updateMany({ _id: { $in: cars.map((c) => c._id) } }, { city: lagos._id });
    await RatePerMileModel.insertMany([
      { rate: "1500", mile: "1", city: lagos._id },
      { rate: "1200", mile: "1", city: abuja._id },
    ]);
    const rentalCity = await CarRentalCityModel.create({ cityName: "Lagos", cars: cars.map((c) => c._id) });
    await CarRentalCityModel.create({ cityName: "Abuja", cars: cars.slice(0, 2).map((c) => c._id) });

    // ---------- Priority pass ----------
    const passes = await PriorityPassModel.insertMany([
      { name: "Standard Pass", price: "25000" },
      { name: "Premium Pass", price: "45000" },
    ]);
    await PriorityPassCityModel.create({ cityName: "Lagos", passes: passes.map((p) => p._id) });
    await PriorityPassCityModel.create({ cityName: "Abuja", passes: passes.map((p) => p._id) });

    // ---------- Visa on arrival ----------
    const voaBase = await VoaBaseFeesModel.create({ transactionFee: "20", processingFee: "50", biometricFee: "85" });
    await VisaOnArrivalRateModel.insertMany([
      { country: "United Kingdom", isNigerianVisaRequired: true, isBiometricsRequired: true, visaFee: "160", voaBaseFees: voaBase._id, vat: "7.5", total: "345" },
      { country: "United States", isNigerianVisaRequired: true, isBiometricsRequired: true, visaFee: "180", voaBaseFees: voaBase._id, vat: "7.5", total: "365" },
      { country: "Germany", isNigerianVisaRequired: true, isBiometricsRequired: false, visaFee: "150", voaBaseFees: voaBase._id, vat: "7.5", total: "235" },
    ]);

    // ---------- Accounts ----------
    const user = await UserModel.create({
      firstName: "Tola", lastName: "Customer", emailAddress: "demo.user@shuttlelane-demo.com",
      phoneNumber: "+2348000000001", password: hash, phoneVerification: true,
    });
    const driver = await DriverModel.create({
      image: img("Driver"), firstName: "Emeka", lastName: "Driver", middleName: "Demo",
      gender: "Male", mobile: "+2348000000002", alternateMobile: "+2348000000003",
      education: "Secondary", carType: "SUV", carName: "Toyota", carModel: "Highlander",
      carYear: "2019", carColor: "Black", carPlateNumber: "LAG-123-DM", maritalStatus: "Married",
      nin: "12345678901", address: "12 Demo Street, Ikeja", city: "Lagos", state: "Lagos",
      dateOfBirth: "1988-04-12", driverLicense: "DEMO-LIC-0001",
      email: "demo.driver@shuttlelane-demo.com", password: hash,
      isDrivingForHailingPlatforms: true, hailingPlatforms: "Uber, Bolt",
      emergencyFirstName: "Ngozi", emergencyLastName: "Driver", emergencyAddress: "12 Demo Street, Ikeja",
      emergencyMobile: "+2348000000004", emergencyRelationship: "Spouse",
      bank: "Access Bank", accountName: "Emeka Driver", accountNumber: "0123456789",
      phoneVerification: true, isAccountApproved: true, isAccountBlocked: false,
    });
    // A second driver still waiting for approval (shows the pending state in admin)
    await DriverModel.create({
      ...driver.toObject(), _id: undefined, firstName: "Bayo", lastName: "Pending",
      email: "demo.pendingdriver@shuttlelane-demo.com", mobile: "+2348000000005",
      carPlateNumber: "LAG-456-DM", isAccountApproved: false,
      bookingsAssignedTo: [], completedBookings: [], upcomingBookings: [],
      createdAt: undefined, updatedAt: undefined,
    });
    const vendor = await VendorModel.create({
      image: img("Vendor"), companyName: "Demo Fleet Partners Ltd", rcNumber: "RC1234567",
      isRcNumberVerified: true, isOpen24Hours: true, companyEmail: "demo.vendor@shuttlelane-demo.com",
      address: "5 Partner Road, Victoria Island", city: "Lagos", country: "Nigeria",
      operatingCities: ["Lagos", "Abuja"], fleetSize: "10-20", fleetType: ["SUV", "Executive", "Premium Van"],
      contactName: "Funmi Vendor", contactEmail: "funmi@shuttlelane-demo.com", contactMobile: "+2348000000006",
      password: hash, bank: "GTBank", accountName: "Demo Fleet Partners Ltd", accountNumber: "0987654321",
      phoneVerification: true, isAccountApproved: true, isAccountBlocked: false,
    });
    const fleet = await VendorFleetModel.insertMany([
      { carName: "Toyota", carModel: "Prado", carType: "SUV", carYear: "2021", carColor: "White", carPlateNumber: "VEN-001-DM", vendor: vendor._id },
      { carName: "Mercedes-Benz", carModel: "E-Class", carType: "Executive", carYear: "2022", carColor: "Black", carPlateNumber: "VEN-002-DM", vendor: vendor._id },
    ]);
    const vDrivers = await VendorDriverModel.insertMany([
      { firstName: "Sola", lastName: "Partner", mobile: "+2348000000007", dateOfBirth: new Date("1990-01-01"), nin: "22222222222", license: "VEN-LIC-001", isLicenseVerified: true, isNinVerified: true, email: "sola@shuttlelane-demo.com", vendor: vendor._id },
      { firstName: "Kunle", lastName: "Partner", mobile: "+2348000000008", dateOfBirth: new Date("1987-06-15"), nin: "33333333333", license: "VEN-LIC-002", isLicenseVerified: true, isNinVerified: true, email: "kunle@shuttlelane-demo.com", vendor: vendor._id },
    ]);
    vendor.fleet = fleet.map((f) => f._id);
    vendor.drivers = vDrivers.map((d) => d._id);
    await vendor.save();

    // ---------- Bookings ----------
    let n = 1;
    const ref = () => `SHL-DEMO-${String(n++).padStart(3, "0")}`;
    const passenger = (i) => ({
      title: "Mr", firstName: ["James", "Amaka", "Peter", "Grace", "David", "Zainab", "Michael", "Chioma", "Samuel", "Ruth"][i % 10],
      lastName: "Traveller", email: `passenger${i}@shuttlelane-demo.com`, mobile: `+44700000000${i % 10}`,
    });

    async function airportBooking(i, opts = {}, days = 3) {
      const reference = ref();
      const at = await AirportTransferBookingModel.create({
        bookingReference: reference, isRoundTrip: i % 3 === 0, passengers: 1 + (i % 4),
        airline: "British Airways", flightNumber: `BA0${70 + i}`, vehicleClass: classes[i % classes.length]._id,
        city: "Lagos", pickupAddress: "Murtala Muhammed International Airport (LOS)",
        pickupCoordinates: { lat: "6.5774", lng: "3.3212" }, pickupDate: daysFromNow(days),
        pickupTime: "14:30", pickupTimeZone: "Africa/Lagos",
        dropoffAddress: "Eko Hotel & Suites, Victoria Island", dropoffCoordinates: { lat: 6.4253, lng: 3.4296 },
      });
      const total = String(Number(classes[i % classes.length].basePrice) + 15000);
      const b = await BookingModel.create({
        booking: at._id, bookingSchemaType: "AirportTransferBooking", bookingType: "Airport",
        bookingReference: reference, bookingCurrency: ngn._id, countryBookingWasMadeFrom: "United Kingdom",
        bookingTotal: total, user: i % 2 === 0 ? user._id : undefined, ...passenger(i),
        bookingRate: String(Math.round(Number(total) * 0.8)), ...opts,
      });
      const p = await PaymentModel.create({
        amount: total, currency: ngn._id, paymentStatus: "Successful", booking: b._id,
        gateway: ["Paystack", "Flutterwave", "Stripe", "PayPal"][i % 4], firstName: b.firstName,
        lastName: b.lastName, email: b.email, user: b.user,
      });
      b.paymentId = p._id;
      await b.save();
      return b;
    }

    const bookings = [];
    // Unassigned (admin needs to assign)
    bookings.push(await airportBooking(0, { bookingStatus: "Not yet assigned" }, 2));
    bookings.push(await airportBooking(1, { bookingStatus: "Not yet assigned" }, 4));
    // Driver: new job waiting for response
    const dAwait = await airportBooking(2, { bookingStatus: "Awaiting response", driverJobWasSentTo: driver._id, isAssignedToDriver: true }, 1);
    // Driver: accepted / upcoming
    const dUpcoming = await airportBooking(3, { bookingStatus: "Scheduled", driverJobWasSentTo: driver._id, assignedDriver: driver._id, isAssignedToDriver: true, hasDriverAccepted: true }, 3);
    // Driver: ongoing
    const dOngoing = await airportBooking(4, { bookingStatus: "Ongoing", driverJobWasSentTo: driver._id, assignedDriver: driver._id, isAssignedToDriver: true, hasDriverAccepted: true }, 0);
    // Driver: completed
    const dDone1 = await airportBooking(5, { bookingStatus: "Completed", driverJobWasSentTo: driver._id, assignedDriver: driver._id, isAssignedToDriver: true, hasDriverAccepted: true }, -3);
    const dDone2 = await airportBooking(6, { bookingStatus: "Completed", driverJobWasSentTo: driver._id, assignedDriver: driver._id, isAssignedToDriver: true, hasDriverAccepted: true }, -9);
    // Vendor: new job waiting for response
    const vAwait = await airportBooking(7, { bookingStatus: "Awaiting response", vendorJobWasSentTo: String(vendor._id), isAssignedToVendor: true }, 2);
    // Vendor: accepted, needs driver
    const vAccepted = await airportBooking(8, { bookingStatus: "Accepted", vendorJobWasSentTo: String(vendor._id), assignedVendor: vendor._id, isAssignedToVendor: true, hasVendorAccepted: true }, 5);
    // Vendor: scheduled with driver and car
    const vSched = await airportBooking(9, { bookingStatus: "Scheduled", vendorJobWasSentTo: String(vendor._id), assignedVendor: vendor._id, isAssignedToVendor: true, hasVendorAccepted: true, vendorAssignedDriver: vDrivers[0]._id, assignedCar: fleet[0]._id }, 6);
    // Vendor: ongoing and completed
    const vOngoing = await airportBooking(10, { bookingStatus: "Ongoing", vendorJobWasSentTo: String(vendor._id), assignedVendor: vendor._id, isAssignedToVendor: true, hasVendorAccepted: true, vendorAssignedDriver: vDrivers[1]._id, assignedCar: fleet[1]._id }, 0);
    const vDone = await airportBooking(11, { bookingStatus: "Completed", vendorJobWasSentTo: String(vendor._id), assignedVendor: vendor._id, isAssignedToVendor: true, hasVendorAccepted: true, vendorAssignedDriver: vDrivers[0]._id, assignedCar: fleet[0]._id }, -5);
    // Other statuses for the admin lists
    bookings.push(await airportBooking(12, { bookingStatus: "Cancelled" }, -1));
    bookings.push(await airportBooking(13, { bookingStatus: "Customer no show", assignedDriver: driver._id, driverJobWasSentTo: driver._id, hasDriverAccepted: true }, -2));

    // Car rental booking
    const crRef = ref();
    const cr = await CarRentalBookingModel.create({
      bookingReference: crRef, days: 3, city: rentalCity._id, pickupAddress: "Ikeja GRA, Lagos",
      pickupCoordinates: { lat: "6.5833", lng: "3.3500" }, pickupDate: daysFromNow(7),
      pickupTime: "09:00", pickupTimeZone: "Africa/Lagos", car: cars[1]._id,
    });
    const crBooking = await BookingModel.create({
      booking: cr._id, bookingSchemaType: "CarRentalBooking", bookingType: "Car", bookingReference: crRef,
      bookingCurrency: ngn._id, countryBookingWasMadeFrom: "Nigeria", bookingTotal: "255000",
      user: user._id, ...passenger(14), bookingStatus: "Not yet assigned",
    });
    cr.bookingId = crBooking._id;
    await cr.save();

    // Link bookings to accounts
    driver.bookingsAssignedTo = [dAwait, dUpcoming, dOngoing, dDone1, dDone2].map((b) => b._id);
    driver.upcomingBookings = [dUpcoming._id];
    driver.completedBookings = [dDone1._id, dDone2._id];
    await driver.save();
    vendor.bookingsAssignedTo = [vAwait, vAccepted, vSched, vOngoing, vDone].map((b) => b._id);
    vendor.upcomingBookings = [vSched._id];
    vendor.completedBookings = [vDone._id];
    await vendor.save();
    user.bookings = (await BookingModel.find({ user: user._id })).map((b) => b._id);
    await user.save();

    // Payouts for completed jobs
    await PayoutsModel.insertMany([
      { userId: driver._id, booking: dDone1._id, pickupDate: daysFromNow(-3), hasBeenSettled: false },
      { userId: driver._id, booking: dDone2._id, pickupDate: daysFromNow(-9), hasBeenSettled: true },
      { userId: vendor._id, booking: vDone._id, pickupDate: daysFromNow(-5), hasBeenSettled: false },
    ]);

    // Blog, enquiries, notifications
    await BlogModel.insertMany([
      { image: img("Lagos Airport Guide"), title: "Your Guide to Arriving at Lagos Airport", slug: "guide-to-arriving-at-lagos-airport", content: "<p>Everything you need to know when you land at Murtala Muhammed International Airport, from meeting your chauffeur to getting into the city.</p>", author: admin._id },
      { image: img("Executive Travel"), title: "Why Executives Choose Chauffeur Airport Transfers", slug: "why-executives-choose-chauffeur-transfers", content: "<p>Punctuality, comfort and safety: how professional airport transfers save business travellers time.</p>", author: admin._id },
    ]);
    await EnquiryModel.insertMany([
      { subject: "Corporate account enquiry", message: "We would like to set up monthly airport transfers for our staff.", fullName: "Kemi Corporate", email: "kemi@example.com" },
      { subject: "Wedding transport", message: "Do you provide luxury cars for a wedding in December?", fullName: "Tunde Groom", email: "tunde@example.com", isRead: true },
    ]);
    await NotificationModel.insertMany([
      { recipientType: "Driver", recipientDriver: driver._id, title: "New job assigned", body: `You have a new airport pickup (${dAwait.bookingReference}).`, booking: dAwait._id, bookingReference: dAwait.bookingReference },
      { recipientType: "User", recipientUser: user._id, title: "Booking confirmed", body: "Your airport transfer has been confirmed." },
    ]);

    console.log("DEMO SEED: done. Password for all demo accounts:", PASSWORD);
  } catch (err) {
    console.log("DEMO SEED ERROR:", err?.message, err);
  }
}
