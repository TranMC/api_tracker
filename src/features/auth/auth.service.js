import { getSheetData, getSheetHeaders, updateSheetRow } from "../../common/sheets.dao.js";

export async function loginUser(username, password) {
  const accounts = await getSheetData("accounts");
  const user = accounts.find(
    acc => acc.username === username && acc.password === password
  );
  return user || null;
}

export async function updateUserField(username, field, value) {
  const accounts = await getSheetData("accounts");
  const rowIndex = accounts.findIndex(acc => acc.username === username);
  if (rowIndex === -1) return false;

  const headers = await getSheetHeaders("accounts");
  const updated = { ...accounts[rowIndex] };
  updated[field] = value;
  if (field === "username") updated.username = value;

  const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
  await updateSheetRow("accounts", rowIndex, rowValues);
  return true;
}
