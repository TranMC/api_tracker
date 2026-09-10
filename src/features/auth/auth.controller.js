import { loginUser, updateUserField } from "./auth.service.js";

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
