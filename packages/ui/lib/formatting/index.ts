import { format, formatDistance } from "date-fns";

export function shortAddress(address: any) {
  if (!address) return "";
  if (address?.length < 10) return address;
  return `${address?.substring(0, 6)}...${address?.substring(
    address?.length - 6,
    address?.length
  )}`;
}

export const formatExpiration = (date) => {
  return formatDistance(new Date(date), new Date(), { addSuffix: true });
};

export const formatDate = (date, formatter = "MM/dd/yyyy") => {
  return format(new Date(date), formatter);
};
