# Xuất Google Calendar ra Excel + Google Maps

Website tĩnh dùng **Google Calendar API bằng API Key** để đọc danh sách lịch hẹn trong một Google Calendar công khai/public, tự nhận diện địa chỉ khách trong lịch hẹn, dùng **Google Maps JavaScript API + DirectionsService** để tính thời gian/quãng đường đi và về từ cửa hàng, sau đó xuất toàn bộ dữ liệu ra file Excel `.xlsx` bằng SheetJS.

Website chạy hoàn toàn bằng:

- HTML
- CSS
- JavaScript thuần
- Không cần backend
- Phù hợp để up trực tiếp lên GitHub Pages

## Địa chỉ cửa hàng cố định

```text
129 Cù Lao, Phường Cầu Kiệu, Phú Nhuận, Thành phố Hồ Chí Minh, Việt Nam
```

Website sẽ tính:

- Cửa hàng → Địa chỉ khách
- Địa chỉ khách → Cửa hàng

## Lưu ý rất quan trọng

Cách này **chỉ dùng được với Google Calendar public/công khai**.

Nếu lịch là private/riêng tư, bạn **không thể chỉ dùng API Key** để đọc lịch. Khi đó cần dùng:

- OAuth 2.0
- Backend như Firebase Functions hoặc Node.js
- Lưu token/secret ở server, không để ở frontend

Google Maps Platform thường yêu cầu project có bật billing. API Key đặt trong frontend có thể bị người khác nhìn thấy qua DevTools hoặc source code. Vì vậy bắt buộc phải restrict key trong Google Cloud Console.

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

## Cách lấy Google Calendar API Key

### Bước 1: Vào Google Cloud Console

Truy cập Google Cloud Console bằng tài khoản Google của bạn.

### Bước 2: Tạo project

1. Bấm chọn project ở thanh trên cùng.
2. Chọn **New Project**.
3. Đặt tên project, ví dụ:

```text
calendar-maps-exporter
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

## Cách bật Google Maps API

### Bước 1: Chọn project

Dùng cùng project với Google Calendar API hoặc tạo project mới.

### Bước 2: Bật Maps JavaScript API

1. Vào **APIs & Services**.
2. Chọn **Library**.
3. Tìm **Maps JavaScript API**.
4. Bấm **Enable**.

### Bước 3: Kiểm tra billing

Google Maps Platform thường cần project đã gắn billing account.

Nếu chưa bật billing, Maps có thể báo lỗi:

```text
REQUEST_DENIED
```

hoặc không load được bản đồ/dịch vụ đường đi.

### Bước 4: Tạo hoặc dùng API Key hiện có

Bạn có thể dùng:

- 1 API Key chung cho cả Calendar + Maps
- hoặc 2 API Key riêng: một key cho Calendar, một key cho Maps

Nếu dùng chung một key, phần API restrictions cần cho phép:

- Google Calendar API
- Maps JavaScript API

Nếu dùng riêng, key Calendar chỉ cho Google Calendar API, key Maps chỉ cho Maps JavaScript API.

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

### 2. Restrict API

Ở phần **API restrictions**, chọn:

```text
Restrict key
```

Nếu là Calendar API Key, chọn:

```text
Google Calendar API
```

Nếu là Maps API Key, chọn:

```text
Maps JavaScript API
```

Nếu dùng chung một API Key cho cả hai, chọn cả:

```text
Google Calendar API
Maps JavaScript API
```

Bấm **Save**.

## Cách lấy Calendar ID

1. Mở Google Calendar.
2. Bấm biểu tượng bánh răng **Settings**.
3. Chọn lịch muốn xuất dữ liệu.
4. Kéo xuống phần **Integrate calendar / Tích hợp lịch**.
5. Copy mục **Calendar ID / ID lịch**.

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

## Cách ghi địa chỉ trong Google Calendar

Website ưu tiên lấy địa chỉ theo thứ tự:

1. Trường **Location / Địa điểm** của event.
2. Nếu Location trống, tách địa chỉ từ **tiêu đề lịch hẹn**.

Các kiểu tiêu đề hỗ trợ tốt:

```text
Giao bé Miu - 25 Nguyễn Văn Trỗi, Phú Nhuận
Đón chó khách 45/2 Lê Văn Sỹ Q3
Spa Mimi | 129/5 Cù Lao Phú Nhuận
Khách Lan - địa chỉ: 12 Hoa Sứ, Phú Nhuận
Tắm bé Bông - 88 Nguyễn Đình Chính
```

Nếu tiêu đề có từ khóa sau, website sẽ lấy phần phía sau làm địa chỉ:

```text
địa chỉ:
dia chi:
address:
```

Nếu có dấu ` - ` hoặc ` | `, website ưu tiên lấy phần cuối cùng làm địa chỉ.

## Cách sử dụng website

1. Mở website.
2. Nhập **Google Calendar API Key**.
3. Nhập **Calendar ID**.
4. Nhập **Google Maps API Key**.
5. Chọn **Từ ngày** và **Đến ngày**.
6. Nếu muốn lưu key trên máy hiện tại, tick các checkbox ghi nhớ.
7. Bấm **Tải lịch**.
8. Kiểm tra cột **Địa chỉ khách**.
9. Bấm **Tính thời gian di chuyển**.
10. Kiểm tra cột:
    - Shop → Khách
    - Km Shop → Khách
    - Khách → Shop
    - Km Khách → Shop
    - Trạng thái Maps
11. Bấm **Xuất Excel** để tải file `.xlsx`.

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
- Địa chỉ khách
- Thời gian Shop → Khách
- Quãng đường Shop → Khách
- Thời gian Khách → Shop
- Quãng đường Khách → Shop
- Trạng thái Maps
- Lỗi Maps nếu có
- Mô tả
- Người tạo
- Email người tạo
- Trạng thái
- Link Google Calendar

## Troubleshooting

### Lỗi Calendar 403

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

### Lỗi Calendar 404

Nguyên nhân thường gặp:

- Calendar ID sai.
- Copy nhầm Calendar ID.
- Lịch không tồn tại hoặc chưa public đúng cách.

Cách xử lý:

- Vào Google Calendar → Settings → chọn lịch → Integrate calendar → copy lại Calendar ID.

### Maps không load

Nguyên nhân thường gặp:

- Google Maps API Key sai.
- Chưa bật Maps JavaScript API.
- Chưa bật billing.
- API key bị restrict sai domain.
- Trình duyệt chặn script từ Google.

Cách xử lý:

- Kiểm tra API key.
- Kiểm tra Maps JavaScript API đã Enable.
- Kiểm tra billing account.
- Kiểm tra HTTP referrers.

### RefererNotAllowedMapError

Lỗi này thường do domain website chưa được thêm vào HTTP referrers.

Nếu GitHub Pages là:

```text
https://username.github.io/repository-name/
```

Nên thêm:

```text
https://username.github.io/*
https://username.github.io/repository-name/*
```

### REQUEST_DENIED

Nguyên nhân thường gặp:

- API key bị từ chối.
- Chưa bật Maps JavaScript API.
- Chưa bật billing.
- API restrictions không cho Maps JavaScript API.

### OVER_QUERY_LIMIT

Nguyên nhân thường gặp:

- Gọi API quá nhanh.
- Vượt quota.
- Project bị giới hạn billing/quota.

Website đã xử lý tuần tự và có delay nhỏ giữa request, nhưng nếu quá nhiều lịch hẹn vẫn có thể gặp giới hạn.

### ZERO_RESULTS

Google Maps không tìm được đường đi giữa cửa hàng và địa chỉ khách.

Cách xử lý:

- Kiểm tra lại địa chỉ khách.
- Ghi địa chỉ đầy đủ hơn trong Google Calendar.
- Nên thêm quận/thành phố nếu địa chỉ dễ trùng.

### Không tách được địa chỉ từ tiêu đề

Cách xử lý:

- Điền địa chỉ vào trường **Location / Địa điểm** của Google Calendar.
- Hoặc viết tiêu đề theo mẫu:

```text
Tên lịch - địa chỉ: 12 Hoa Sứ, Phú Nhuận
```

### Có địa chỉ nhưng Google không tìm được đường đi

Cách xử lý:

- Ghi địa chỉ đầy đủ hơn.
- Thêm quận, thành phố.
- Tránh viết tắt quá khó hiểu.

## Muốn đọc lịch riêng tư thì làm thế nào?

Phiên bản này chỉ dùng API Key nên chỉ đọc lịch public.

Nếu muốn đọc lịch riêng tư, phiên bản sau nên làm bằng:

- OAuth 2.0
- Firebase Functions hoặc Node.js backend
- Lưu Client Secret và Refresh Token ở backend
- Frontend gọi backend, không gọi Google Calendar private trực tiếp bằng API Key

Cách đó an toàn hơn và đúng cho dữ liệu riêng tư của shop/doanh nghiệp.
