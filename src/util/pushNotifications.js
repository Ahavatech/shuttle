import axios from "axios";
import DriverModel from "../model/driver.model.js";
import NotificationModel from "../model/notification.model.js";
import UserModel from "../model/user.model.js";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const IOS_TARGET = "ios";
const ANDROID_TARGET = "android";
const EVERYONE_TARGET = "everyone";

const chunkMessages = (messages, size = 100) => {
  const chunks = [];

  for (let index = 0; index < messages.length; index += size) {
    chunks.push(messages.slice(index, index + size));
  }

  return chunks;
};

export const isExpoPushToken = (token) =>
  typeof token === "string" && /^ExpoPushToken\[[A-Za-z0-9+/=_-]+\]$/.test(token);

export const filterPushTokens = (pushTokens = [], targetDevice = EVERYONE_TARGET) =>
  pushTokens.filter((entry) => {
    if (!entry?.token || entry?.isActive === false || !isExpoPushToken(entry.token)) {
      return false;
    }

    if (targetDevice === IOS_TARGET) {
      return entry?.platform === IOS_TARGET;
    }

    if (targetDevice === ANDROID_TARGET) {
      return entry?.platform === ANDROID_TARGET;
    }

    return true;
  });

export const sendExpoPushNotifications = async (messages = []) => {
  const validMessages = messages.filter((message) => isExpoPushToken(message?.to));

  if (!validMessages.length) {
    return {
      sentCount: 0,
      ticketResponses: [],
    };
  }

  const chunks = chunkMessages(validMessages);
  const ticketResponses = [];

  for (const chunk of chunks) {
    const payload = chunk.length === 1 ? chunk[0] : chunk;
    const response = await axios.post(EXPO_PUSH_ENDPOINT, payload, {
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
    });

    ticketResponses.push(response?.data);
  }

  return {
    sentCount: validMessages.length,
    ticketResponses,
  };
};

export const createUserNotification = async ({
  userId,
  title,
  body,
  category = "general",
  eventType = "general",
  source = "system",
  bookingId = null,
  bookingReference = "",
  data = {},
}) => {
  if (!userId || !title || !body) {
    return null;
  }

  return NotificationModel.create({
    recipientType: "User",
    recipientUser: userId,
    title,
    body,
    category,
    eventType,
    source,
    booking: bookingId || undefined,
    bookingReference,
    data,
  });
};

export const createDriverNotification = async ({
  driverId,
  title,
  body,
  category = "general",
  eventType = "general",
  source = "system",
  bookingId = null,
  bookingReference = "",
  data = {},
}) => {
  if (!driverId || !title || !body) {
    return null;
  }

  return NotificationModel.create({
    recipientType: "Driver",
    recipientDriver: driverId,
    title,
    body,
    category,
    eventType,
    source,
    booking: bookingId || undefined,
    bookingReference,
    data,
  });
};

export const notifyUser = async ({
  user,
  title,
  body,
  category = "booking",
  eventType = "general",
  source = "system",
  bookingId = null,
  bookingReference = "",
  data = {},
  respectPreferences = true,
  storeNotification = true,
  targetDevice = EVERYONE_TARGET,
}) => {
  if (!user?._id || !title || !body) {
    return {
      sentCount: 0,
      stored: false,
    };
  }

  const bookingUpdatesEnabled = user?.notificationPreferences?.bookingUpdates !== false;
  const canNotify = respectPreferences ? bookingUpdatesEnabled : true;
  let notification = null;

  if (storeNotification && canNotify) {
    notification = await createUserNotification({
      userId: user?._id,
      title,
      body,
      category,
      eventType,
      source,
      bookingId,
      bookingReference,
      data,
    });
  }

  if (!canNotify) {
    return {
      sentCount: 0,
      stored: Boolean(notification),
      notification,
    };
  }

  const activeTokens = filterPushTokens(user?.pushTokens, targetDevice);

  if (!activeTokens.length) {
    return {
      sentCount: 0,
      stored: Boolean(notification),
      notification,
    };
  }

  const payload = activeTokens.map((entry) => ({
    to: entry.token,
    title,
    body,
    sound: "default",
    data: {
      ...data,
      notificationId: notification?._id?.toString?.() ?? null,
      bookingId: bookingId ? bookingId.toString() : null,
      bookingReference,
      eventType,
      screen: "notifications",
    },
  }));

  const result = await sendExpoPushNotifications(payload);

  if (notification && result.sentCount > 0) {
    notification.deliveredAt = new Date();
    await notification.save();
  }

  return {
    ...result,
    stored: Boolean(notification),
    notification,
  };
};

export const notifyDriver = async ({
  driver,
  title,
  body,
  category = "general",
  eventType = "general",
  source = "system",
  bookingId = null,
  bookingReference = "",
  data = {},
  storeNotification = true,
  targetDevice = EVERYONE_TARGET,
}) => {
  if (!driver?._id || !title || !body) {
    return {
      sentCount: 0,
      stored: false,
    };
  }

  let notification = null;

  if (storeNotification) {
    notification = await createDriverNotification({
      driverId: driver?._id,
      title,
      body,
      category,
      eventType,
      source,
      bookingId,
      bookingReference,
      data,
    });
  }

  const activeTokens = filterPushTokens(driver?.pushTokens, targetDevice);

  if (!activeTokens.length) {
    return {
      sentCount: 0,
      stored: Boolean(notification),
      notification,
    };
  }

  const payload = activeTokens.map((entry) => ({
    to: entry.token,
    title,
    body,
    sound: "default",
    data: {
      ...data,
      notificationId: notification?._id?.toString?.() ?? null,
      bookingId: bookingId ? bookingId.toString() : null,
      bookingReference,
      eventType,
      screen: "notifications",
    },
  }));

  const result = await sendExpoPushNotifications(payload);

  if (notification && result.sentCount > 0) {
    notification.deliveredAt = new Date();
    await notification.save();
  }

  return {
    ...result,
    stored: Boolean(notification),
    notification,
  };
};

export const sendPushBroadcast = async ({
  targetAudience = "users",
  targetDevice = EVERYONE_TARGET,
  title,
  body,
  source = "admin",
}) => {
  const normalizedAudience = String(targetAudience || "").toLowerCase();
  const includeUsers =
    normalizedAudience === "everyone" || normalizedAudience === "users";
  const includeDrivers =
    normalizedAudience === "everyone" || normalizedAudience === "drivers";

  let userRecipients = [];
  let driverRecipients = [];

  if (includeUsers) {
    userRecipients = await UserModel.find({
      "pushTokens.0": { $exists: true },
    });
  }

  if (includeDrivers) {
    driverRecipients = await DriverModel.find({
      "pushTokens.0": { $exists: true },
    });
  }

  const messages = [];
  const userNotifications = [];
  const driverNotifications = [];

  userRecipients.forEach((user) => {
    const tokens = filterPushTokens(user?.pushTokens, targetDevice);

    if (!tokens.length) {
      return;
    }

    userNotifications.push({
      recipientType: "User",
      recipientUser: user?._id,
      title,
      body,
      category: "broadcast",
      eventType: "admin-broadcast",
      source,
      data: {
        screen: "notifications",
      },
      deliveredAt: new Date(),
    });

    tokens.forEach((entry) => {
      messages.push({
        to: entry.token,
        title,
        body,
        sound: "default",
        data: {
          screen: "notifications",
          eventType: "admin-broadcast",
        },
      });
    });
  });

  driverRecipients.forEach((driver) => {
    const tokens = filterPushTokens(driver?.pushTokens, targetDevice);

    if (!tokens.length) {
      return;
    }

    driverNotifications.push({
      recipientType: "Driver",
      recipientDriver: driver?._id,
      title,
      body,
      category: "broadcast",
      eventType: "admin-broadcast",
      source,
      data: {},
      deliveredAt: new Date(),
    });

    tokens.forEach((entry) => {
      messages.push({
        to: entry.token,
        title,
        body,
        sound: "default",
        data: {
          eventType: "admin-broadcast",
        },
      });
    });
  });

  if (userNotifications.length) {
    await NotificationModel.insertMany(userNotifications);
  }

  if (driverNotifications.length) {
    await NotificationModel.insertMany(driverNotifications);
  }

  const result = await sendExpoPushNotifications(messages);

  return {
    status: 201,
    sentCount: result?.sentCount ?? 0,
    targetUsers: userRecipients.length,
    targetDrivers: driverRecipients.length,
    message:
      result?.sentCount > 0
        ? "Push notification broadcast sent successfully."
        : "No active push devices were found for the selected audience.",
  };
};
