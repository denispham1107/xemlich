# Xuất Google Calendar ra Excel

Website tĩnh dùng **Google Calendar API bằng API Key** để đọc danh sách lịch hẹn trong một Google Calendar công khai/public, sau đó xuất toàn bộ lịch hẹn ra file Excel `.xlsx` bằng SheetJS.

Website chạy hoàn toàn bằng:

- HTML
- CSS
- JavaScript thuần
- Không cần backend
- Phù hợp để up trực tiếp lên GitHub Pages

## Lưu ý rất quan trọng

Cách này **chỉ dùng được với Google Calendar public/công khai**.

Nếu lịch là private/riêng tư, bạn **không thể chỉ dùng API Key** để đọc lịch. Khi đó cần dùng:

- OAuth 2.0
- Backend như Firebase Functions hoặc Node.js
- Lưu token/secret ở server, không để ở frontend

API Key đặt trong frontend có thể bị người khác nhìn thấy qua DevTools hoặc source code. Vì vậy bắt buộc phải restrict key trong Google Cloud Console.

## Cấu trúc file

```text
index.html
styles.css
app.js
README.md
```

## Cách chạy local

Cách nhanh nhất:

1. Tải toàn bộ 4 file về cùng một thư mục.
2. Mở file `index.html` bằng trình duyệt.

Cách tốt hơn khi test:

1. Mở thư mục bằng VS Code.
2. Cài extension **Live Server**.
3. Bấm chuột phải vào `index.html`.
4. Chọn **Open with Live Server**.

## Cách deploy lên GitHub Pages

1. Tạo repo mới trên GitHub.
2. Upload 4 file:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. Vào repo trên GitHub.
4. Chọn **Settings**.
5. Chọn **Pages**.
6. Ở phần **Build and deployment**, chọn:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
7. Bấm **Save**.
8. Chờ GitHub tạo link Pages.
9. Mở link GitHub Pages để sử dụng website.

## Cách lấy API Key Google Calendar

### Bước 1: Vào Google Cloud Console

Truy cập Google Cloud Console bằng tài khoản Google của bạn.

### Bước 2: Tạo project

1. Bấm chọn project ở thanh trên cùng.
2. Chọn **New Project**.
3. Đặt tên project, ví dụ:

```text
calendar-exporter
```

4. Bấm **Create**.

### Bước 3: Bật Google Calendar API

1. Vào **APIs & Services**.
2. Chọn **Library**.
3. Tìm **Google Calendar API**.
4. Bấm vào Google Calendar API.
5. Bấm **Enable**.

### Bước 4: Tạo API Key

1. Vào **APIs & Services**.
2. Chọn **Credentials**.
3. Bấm **Create Credentials**.
4. Chọn **API key**.
5. Copy API Key vừa tạo.

## Cách bảo mật API Key

API Key dùng ở frontend không phải bí mật tuyệt đối. Người khác có thể xem được key nếu mở DevTools.

Bạn cần restrict key như sau:

### 1. Restrict theo website/domain

Vào API Key vừa tạo, ở phần **Application restrictions**, chọn:

```text
HTTP referrers (web sites)
```

Thêm domain GitHub Pages của bạn, ví dụ:

```text
https://ten-github-cua-ban.github.io/*
https://ten-github-cua-ban.github.io/ten-repo-cua-ban/*
```

Nếu test local có thể thêm:

```text
http://localhost:5500/*
http://127.0.0.1:5500/*
```

### 2. Restrict chỉ cho Google Calendar API

Ở phần **API restrictions**, chọn:

```text
Restrict key
```

Sau đó chỉ chọn:

```text
Google Calendar API
```

Bấm **Save**.

## Cách lấy Calendar ID

1. Mở Google Calendar.
2. Bấm biểu tượng bánh răng **Settings**.
3. Chọn lịch muốn xuất dữ liệu.
4. Kéo xuống phần **Integrate calendar**.
5. Copy mục **Calendar ID**.

Calendar ID có thể có dạng:

```text
abc@gmail.com
```

hoặc:

```text
xxxxxxxxxxxxxxxx@group.calendar.google.com
```

## Cách public Google Calendar

1. Mở Google Calendar.
2. Bấm bánh răng **Settings**.
3. Chọn lịch cần public.
4. Vào phần **Access permissions for events**.
5. Bật **Make available to public**.
6. Chọn mức hiển thị phù hợp.

Lưu ý: Khi public lịch, người khác có thể xem được thông tin lịch tùy mức quyền bạn chọn. Không nên public lịch có dữ liệu riêng tư hoặc nhạy cảm.

## Cách sử dụng website

1. Mở website.
2. Nhập **API Key**.
3. Nhập **Calendar ID**.
4. Chọn **Từ ngày** và **Đến ngày**.
5. Nếu muốn lưu API Key và Calendar ID trên máy hiện tại, tick:

```text
Ghi nhớ API Key và Calendar ID trên máy này
```

6. Bấm **Tải lịch**.
7. Kiểm tra danh sách lịch hẹn trong bảng.
8. Có thể tìm nhanh bằng ô tìm kiếm.
9. Bấm **Xuất Excel** để tải file `.xlsx`.

## Dữ liệu xuất ra Excel

File Excel có tên dạng:

```text
google-calendar-export-YYYY-MM-DD.xlsx
```

Sheet tên:

```text
Lich hen
```

Các cột trong Excel:

- STT
- Tiêu đề lịch hẹn
- Ngày bắt đầu
- Giờ bắt đầu
- Ngày kết thúc
- Giờ kết thúc
- Cả ngày
- Địa điểm
- Mô tả
- Người tạo
- Email người tạo
- Trạng thái
- Link Google Calendar

## Troubleshooting

### Lỗi 403

Nguyên nhân thường gặp:

- Calendar chưa public.
- API Key bị restrict sai domain.
- Chưa bật Google Calendar API.
- API Key bị hết quota.
- API Key không được phép gọi Google Calendar API.

Cách xử lý:

- Kiểm tra lại lịch đã public chưa.
- Kiểm tra domain GitHub Pages đã được thêm vào HTTP referrers chưa.
- Kiểm tra API restrictions có chọn Google Calendar API chưa.
- Kiểm tra Google Calendar API đã Enable chưa.

### Lỗi 404

Nguyên nhân thường gặp:

- Calendar ID sai.
- Copy nhầm Calendar ID.
- Lịch không tồn tại hoặc chưa public đúng cách.

Cách xử lý:

- Vào Google Calendar → Settings → chọn lịch → Integrate calendar → copy lại Calendar ID.

### Không thấy lịch hẹn

Nguyên nhân thường gặp:

- Khoảng ngày chọn không có sự kiện.
- Sự kiện nằm ngoài khoảng ngày đã chọn.
- Lịch đang private.
- Calendar ID không đúng lịch cần đọc.

Cách xử lý:

- Chọn khoảng ngày rộng hơn.
- Kiểm tra đúng Calendar ID.
- Kiểm tra lịch đã public.

### Không xuất được Excel

Nguyên nhân thường gặp:

- Chưa bấm **Tải lịch**.
- Không có dữ liệu để xuất.
- Trình duyệt không tải được thư viện SheetJS từ CDN.

Cách xử lý:

- Kiểm tra Internet.
- Tải lại trang.
- Bấm **Tải lịch** trước, sau đó bấm **Xuất Excel**.

### API Key bị chặn do domain chưa đúng

Nếu bạn deploy lên GitHub Pages, domain thường có dạng:

```text
https://username.github.io/repository-name/
```

Trong HTTP referrers nên thêm:

```text
https://username.github.io/*
https://username.github.io/repository-name/*
```

## Muốn đọc lịch riêng tư thì làm thế nào?

Phiên bản này chỉ dùng API Key nên chỉ đọc lịch public.

Nếu muốn đọc lịch riêng tư, phiên bản sau nên làm bằng:

- OAuth 2.0
- Firebase Functions hoặc Node.js backend
- Lưu Client Secret và Refresh Token ở backend
- Frontend gọi backend, không gọi Google Calendar private trực tiếp bằng API Key

Cách đó an toàn hơn và đúng cho dữ liệu riêng tư của shop/doanh nghiệp.
