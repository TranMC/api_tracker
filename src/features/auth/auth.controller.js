import {
  loginUser,
  updateUserField,
  getUserProfile,
  getAllAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from "./auth.service.js";

export async function loginHandler(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Thiếu thông tin đăng nhập" });
    }

    const user = await loginUser(username, password);
    if (!user) {
      return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function getUserProfileHandler(req, res, next) {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: "Thiếu username" });
    }

    const user = await getUserProfile(username);
    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function updateUserHandler(req, res, next) {
  try {
    const { username, field, value } = req.body;
    if (!username || !field) {
      return res.status(400).json({ error: "Thiếu thông tin cập nhật" });
    }

    const success = await updateUserField(username, field, value);
    if (!success) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getAllAccountsHandler(req, res, next) {
  try {
    const requester = req.headers["x-requester-username"] || req.query.requester;
    const accounts = await getAllAccounts(requester);
    res.json(accounts);
  } catch (err) {
    next(err);
  }
}

export async function createAccountHandler(req, res, next) {
  try {
    const requester = req.headers["x-requester-username"] || req.body?.requesterUsername;
    const { username, password, fullName, email, customTitle, role, ratio } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Tên đăng nhập và mật khẩu là bắt buộc" });
    }

    const newAccount = await createAccount(
      {
        username,
        password,
        fullName,
        email,
        customTitle,
        role,
        ratio,
      },
      requester
    );
    res.status(201).json({ success: true, account: newAccount });
  } catch (err) {
    res.status(400).json({ error: err.message || "Không thể tạo tài khoản" });
  }
}

export async function updateAccountHandler(req, res, next) {
  try {
    const { username } = req.params;
    const requester = req.headers["x-requester-username"] || req.body?.requesterUsername;
    if (!username) {
      return res.status(400).json({ error: "Thiếu tên tài khoản" });
    }

    const updated = await updateAccount(username, req.body, requester);
    res.json({ success: true, account: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || "Không thể cập nhật tài khoản" });
  }
}

export async function deleteAccountHandler(req, res, next) {
  try {
    const { username } = req.params;
    const requester = req.headers["x-requester-username"] || req.query.requester;
    if (!username) {
      return res.status(400).json({ error: "Thiếu tên tài khoản" });
    }

    await deleteAccount(username, requester);
    res.json({ success: true, message: `Đã xóa tài khoản ${username}` });
  } catch (err) {
    res.status(400).json({ error: err.message || "Không thể xóa tài khoản" });
  }
}
