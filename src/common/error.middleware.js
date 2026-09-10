export function errorHandler(err, req, res, next) {
  console.error(`[ERROR] [${req.method}] ${req.originalUrl}:`, err);

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  res.status(statusCode).json({
    error: err.message || "Lỗi máy chủ nội bộ",
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
}
