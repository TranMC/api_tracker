import { getSheetData, getSheetHeaders, updateSheetRow } from "../../common/sheets.dao.js";

export function normalizeUser(rawUser) {
  if (!rawUser) return null;
  const copy = { ...rawUser };
  // Không gửi password về client
  delete copy.password;
  delete copy.Password;

  return {
    ...copy,
    username: rawUser.username || "",
    fullName:
      rawUser.fullName ||
      rawUser["Full Name"] ||
      rawUser["Họ và tên"] ||
      rawUser.fullname ||
      rawUser.name ||
      rawUser.username ||
      "",
    role: rawUser.role || rawUser.Role || "user",
    ratio:
      rawUser.ratio !== undefined && rawUser.ratio !== ""
        ? rawUser.ratio
        : rawUser.Ratio !== undefined && rawUser.Ratio !== ""
        ? rawUser.Ratio
        : rawUser["Đơn giá"] || rawUser["Hệ số"] || "",
  };
}

export async function loginUser(username, password) {
  const accounts = await getSheetData("accounts");
  const user = accounts.find(
    acc => String(acc.username).trim() === String(username).trim() && String(acc.password) === String(password)
  );
  return normalizeUser(user);
}

export async function getUserProfile(username) {
  const accounts = await getSheetData("accounts");
  const user = accounts.find(
    acc => String(acc.username).trim() === String(username).trim()
  );
  return normalizeUser(user);
}

export async function updateUserField(username, field, value) {
  const accounts = await getSheetData("accounts");
  const rowIndex = accounts.findIndex(acc => String(acc.username).trim() === String(username).trim());
  if (rowIndex === -1) return false;

  const headers = await getSheetHeaders("accounts");
  const updated = { ...accounts[rowIndex] };
  updated[field] = value;
  if (field === "username") updated.username = value;

  const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
  await updateSheetRow("accounts", rowIndex, rowValues);
  return true;
}
