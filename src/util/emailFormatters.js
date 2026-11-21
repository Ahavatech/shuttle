import moment from "moment";

export const isEmailValuePresent = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim() !== "";
  }

  return true;
};

export const pickEmailValue = (...values) => values.find(isEmailValuePresent);

export const firstEmailValue = (...values) => {
  const matchedValue = pickEmailValue(...values);
  return matchedValue ?? "N/A";
};

export const formatEmailName = (...parts) => {
  const cleanedParts = parts
    .filter(isEmailValuePresent)
    .map((part) => String(part).trim());

  return cleanedParts.length ? cleanedParts.join(" ") : "N/A";
};

export const formatEmailDate = (
  dateValue,
  outputFormat = "dddd, MMMM DD YYYY"
) => {
  if (!isEmailValuePresent(dateValue)) {
    return "N/A";
  }

  const parsedDate = moment(dateValue, moment.ISO_8601, true);
  if (parsedDate.isValid()) {
    return parsedDate.format(outputFormat);
  }

  return String(dateValue);
};

export const formatEmailPickupTime = (pickupTime) => {
  if (pickupTime === null || pickupTime === undefined || pickupTime === "") {
    return "N/A";
  }

  const parsedPickupTime = moment(
    pickupTime,
    [moment.ISO_8601, "HH:mm", "H:mm", "h:mm A", "h:mmA"],
    true
  );

  if (parsedPickupTime.isValid()) {
    return parsedPickupTime.format("h:mm A");
  }

  return String(pickupTime);
};

export const formatEmailNairaAmount = (amount) => {
  if (amount === null || amount === undefined || amount === "") {
    return "N/A";
  }

  const normalizedAmount = String(amount).trim();
  return normalizedAmount.startsWith("₦")
    ? normalizedAmount
    : `₦${normalizedAmount}`;
};

export const formatEmailCurrencyAmount = (symbol, amount) => {
  if (!isEmailValuePresent(amount)) {
    return "N/A";
  }

  return `${isEmailValuePresent(symbol) ? symbol : ""}${String(amount).trim()}`;
};

export const sanitizeEmailDetailItems = (detailItems = []) => {
  return detailItems.map((detailItem) => ({
    ...detailItem,
    value: firstEmailValue(detailItem?.value),
  }));
};
