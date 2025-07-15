Chắc chắn rồi\! Dưới đây là nội dung của bạn đã được trang trí lại cho dễ đọc và dễ theo dõi hơn.

-----

## ⚙️ Hướng Dẫn Cấu Hình File `.env` Để Chạy Local

Để chạy dự án trên máy của bạn, hãy tạo một file tên là `.env` ở thư mục gốc và thiết lập các biến môi trường sau:

  * ### `SHEET_ID` 🔗

    Đây là ID của file Google Sheet bạn đang sử dụng. Bạn có thể lấy ID này trực tiếp từ URL của trang tính.

    ```
    # Ví dụ:
    SHEET_ID=12345abcdeFGHIJKLmnOPQRSTUvwxyz
    ```

  * ### `GOOGLE_SERVICE_ACCOUNT_JSON` 🔑

    Đây là thông tin xác thực để ứng dụng có thể giao tiếp với Google Sheets API.

    1.  Lấy file JSON credentials từ Google Cloud Console (sau khi đã bật Google Sheets API).
    2.  **Quan trọng:** Đừng quên **chia sẻ (share)** file Google Sheet với địa chỉ email của service account (có dạng `...@...iam.gserviceaccount.com`) để cấp quyền chỉnh sửa.
    3.  **Copy toàn bộ nội dung file JSON** và dán vào biến này. Hãy sử dụng một công cụ *JSON minify* để đảm bảo tất cả nằm trên một dòng duy nhất, không có dấu xuống dòng.

  * ### `PORT` 🔌

    Cổng mà backend server sẽ chạy. Bạn có thể chọn một cổng bất kỳ mà bạn muốn.

    ```
    # Ví dụ:
    PORT=3001
    ```

-----

## 🚀 Lưu Ý Khi Deploy Lên Render.com

Khi bạn triển khai (deploy) ứng dụng lên các dịch vụ như **Render.com**, bạn không cần dùng file `.env`. Thay vào đó, hãy vào phần cài đặt **Environment** của dịch vụ và thêm các biến môi trường tương ứng như trên là được.