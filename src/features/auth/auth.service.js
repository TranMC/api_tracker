import {
  getSheetData,
  getSheetHeaders,
  appendSheetRows,
  updateSheetRow,
  clearSheetRow,
} from "../../common/sheets.dao.js";

export function normalizeUser(rawUser) {
  if (!rawUser) return null;
  const copy = { ...rawUser };
  // Không gửi password thô về client
  delete copy.password;
  delete copy.Password;

  return {
    ...copy,
    username: String(rawUser.username || "").trim(),
    fullName:
      rawUser.fullName ||
      rawUser.FullName ||
      rawUser["Full Name"] ||
      rawUser["Họ và tên"] ||
      rawUser.fullname ||
      rawUser.name ||
      rawUser.username ||
      "",
    FullName:
      rawUser.FullName ||
      rawUser.fullName ||
      rawUser["Full Name"] ||
      rawUser["Họ và tên"] ||
      rawUser.name ||
      "",
    email: rawUser.email || rawUser.Email || "",
    customTitle: rawUser.CustomTitle || rawUser.customTitle || rawUser["Chức danh"] || "",
    CustomTitle: rawUser.CustomTitle || rawUser.customTitle || rawUser["Chức danh"] || "",
    role: String(rawUser.role || rawUser.Role || "user").trim().toLowerCase(),
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

/**
 * Lấy danh sách tài khoản theo phân quyền:
 * - Admin: Xem được toàn bộ danh sách tài khoản
 * - User/Giáo viên thường: CHỈ xem được thông tin của chính mình
 */
export async function getAllAccounts(requesterUsername) {
  const accounts = await getSheetData("accounts");

  if (requesterUsername) {
    const requester = accounts.find(
      acc => String(acc.username).trim().toLowerCase() === String(requesterUsername).trim().toLowerCase()
    );
    const isAdmin = requester && String(requester.role || requester.Role).trim().toLowerCase() === "admin";
    if (!isAdmin) {
      // User thường chỉ nhận được chính tài khoản của họ
      const selfIndex = accounts.findIndex(
        acc => String(acc.username).trim().toLowerCase() === String(requesterUsername).trim().toLowerCase()
      );
      if (selfIndex !== -1) {
        return [{
          ...normalizeUser(accounts[selfIndex]),
          _rowIndex: selfIndex,
          hasPassword: !!(accounts[selfIndex].password || accounts[selfIndex].Password),
        }];
      }
      return [];
    }
  }

  // Admin hoặc gọi nội bộ: trả về toàn bộ
  return accounts
    .filter(acc => acc.username && String(acc.username).trim() !== "")
    .map((acc, index) => ({
      ...normalizeUser(acc),
      _rowIndex: index,
      hasPassword: !!(acc.password || acc.Password),
    }));
}

/**
 * Tạo mới tài khoản (Chỉ Admin mới có quyền tạo)
 */
export async function createAccount({ username, password, fullName, email, customTitle, role, ratio }, requesterUsername) {
  const accounts = await getSheetData("accounts");

  if (requesterUsername) {
    const requester = accounts.find(
      acc => String(acc.username).trim().toLowerCase() === String(requesterUsername).trim().toLowerCase()
    );
    const isAdmin = requester && String(requester.role || requester.Role).trim().toLowerCase() === "admin";
    if (!isAdmin) {
      throw new Error("Chỉ Quản trị viên (Admin) mới có quyền tạo tài khoản mới");
    }
  }

  if (!username || !password) {
    throw new Error("Tên đăng nhập và mật khẩu là bắt buộc");
  }
  const cleanUsername = String(username).trim();
  const exists = accounts.some(
    acc => String(acc.username).trim().toLowerCase() === cleanUsername.toLowerCase()
  );
  if (exists) {
    throw new Error(`Tài khoản "${cleanUsername}" đã tồn tại trong hệ thống`);
  }

  const headers = await getSheetHeaders("accounts", [
    "username",
    "password",
    "FullName",
    "email",
    "CustomTitle",
    "role",
    "ratio",
  ]);

  const newRowObj = {
    username: cleanUsername,
    password: String(password).trim(),
    FullName: fullName || "",
    email: email || "",
    CustomTitle: customTitle || "",
    role: role || "user",
    ratio: ratio !== undefined && ratio !== "" ? String(ratio) : "",
  };

  const rowValues = headers.map(h => {
    const low = h.toLowerCase();
    if (low === "username") return newRowObj.username;
    if (low === "password") return newRowObj.password;
    if (low === "fullname" || low === "full name" || low === "họ và tên") return newRowObj.FullName;
    if (low === "email") return newRowObj.email;
    if (low === "customtitle" || low === "chức danh") return newRowObj.CustomTitle;
    if (low === "role") return newRowObj.role;
    if (low === "ratio" || low === "hệ số" || low === "đơn giá") return newRowObj.ratio;
    return newRowObj[h] !== undefined ? newRowObj[h] : "";
  });

  await appendSheetRows("accounts", [rowValues]);
  return normalizeUser(newRowObj);
}

/**
 * Cập nhật thông tin tài khoản:
 * - Admin: Sửa được mọi tài khoản (họ tên, email, customTitle, role, ratio, mật khẩu)
 * - User thường: CHỈ sửa được của chính mình, KHÔNG được sửa role và ratio!
 */
export async function updateAccount(username, data, requesterUsername) {
  const cleanUsername = String(username).trim();
  const accounts = await getSheetData("accounts");
  const rowIndex = accounts.findIndex(
    acc => String(acc.username).trim().toLowerCase() === cleanUsername.toLowerCase()
  );
  if (rowIndex === -1) {
    throw new Error(`Không tìm thấy tài khoản "${cleanUsername}"`);
  }

  const requester = requesterUsername
    ? accounts.find(
        acc => String(acc.username).trim().toLowerCase() === String(requesterUsername).trim().toLowerCase()
      )
    : null;
  const isAdmin = requester && String(requester.role || requester.Role).trim().toLowerCase() === "admin";

  // Nếu không phải admin:
  if (requesterUsername && !isAdmin) {
    if (cleanUsername.toLowerCase() !== String(requesterUsername).trim().toLowerCase()) {
      throw new Error("Bạn không có quyền chỉnh sửa tài khoản của người khác");
    }
    // Nghiêm cấm user thường tự sửa vai trò (role) hoặc đơn giá lương (ratio)
    delete data.role;
    delete data.ratio;
  }

  const headers = await getSheetHeaders("accounts");
  const current = accounts[rowIndex];
  const updated = { ...current };

  if (data.fullName !== undefined) {
    updated.FullName = data.fullName;
    updated.fullName = data.fullName;
  }
  if (data.email !== undefined) updated.email = data.email;
  if (data.customTitle !== undefined) {
    updated.CustomTitle = data.customTitle;
    updated.customTitle = data.customTitle;
  }
  if (data.role !== undefined && isAdmin) updated.role = data.role;
  if (data.ratio !== undefined && isAdmin) updated.ratio = data.ratio;
  if (data.password && String(data.password).trim() !== "") {
    updated.password = String(data.password).trim();
  }

  const rowValues = headers.map(h => {
    const low = h.toLowerCase();
    if (low === "username") return updated.username || current.username;
    if (low === "password") return updated.password || current.password;
    if (low === "fullname" || low === "full name" || low === "họ và tên")
      return updated.FullName !== undefined ? updated.FullName : (current.FullName || current.fullName || "");
    if (low === "email") return updated.email !== undefined ? updated.email : (current.email || "");
    if (low === "customtitle" || low === "chức danh")
      return updated.CustomTitle !== undefined ? updated.CustomTitle : (current.CustomTitle || "");
    if (low === "role") return updated.role !== undefined ? updated.role : (current.role || "");
    if (low === "ratio" || low === "hệ số" || low === "đơn giá")
      return updated.ratio !== undefined ? updated.ratio : (current.ratio || "");
    return updated[h] !== undefined ? updated[h] : (current[h] || "");
  });

  await updateSheetRow("accounts", rowIndex, rowValues);
  return normalizeUser(updated);
}

/**
 * Xóa tài khoản khỏi Sheet (Chỉ Admin mới có quyền xóa)
 */
export async function deleteAccount(username, requesterUsername) {
  const cleanUsername = String(username).trim();
  const accounts = await getSheetData("accounts");

  if (requesterUsername) {
    const requester = accounts.find(
      acc => String(acc.username).trim().toLowerCase() === String(requesterUsername).trim().toLowerCase()
    );
    const isAdmin = requester && String(requester.role || requester.Role).trim().toLowerCase() === "admin";
    if (!isAdmin) {
      throw new Error("Chỉ Quản trị viên mới có quyền xóa tài khoản");
    }
    if (cleanUsername.toLowerCase() === String(requesterUsername).trim().toLowerCase()) {
      throw new Error("Không thể tự xóa tài khoản của chính mình");
    }
  }

  const rowIndex = accounts.findIndex(
    acc => String(acc.username).trim().toLowerCase() === cleanUsername.toLowerCase()
  );
  if (rowIndex === -1) {
    throw new Error(`Không tìm thấy tài khoản "${cleanUsername}"`);
  }

  const headers = await getSheetHeaders("accounts");
  await clearSheetRow("accounts", rowIndex, headers.length);
  return true;
}
