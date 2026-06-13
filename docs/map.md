# Tài liệu Kỹ thuật — Hệ thống Bản đồ KTX HUST

## 1. Kiến trúc tổng quan

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Bản đồ 2D | **MapLibre GL JS v4.7.1** | Bản đồ chính, không cần API key |
| Tile server | **OpenFreeMap** (liberty style) | Tile miễn phí, không giới hạn |
| Trực quan 3D | **CesiumJS 1.123** | Globe 3D, camera fly animation |
| Ảnh vệ tinh (Cesium) | OpenStreetMap imagery | Miễn phí, không API key |
| Ảnh 360° | Photo Sphere Viewer (đã có) | `/rooms/:id/view` |
| Tọa độ dữ liệu | MongoDB GeoJSON `[lng, lat]` | REST API `/api/dormitories` |

---

## 2. Lý do chọn MapLibre + CesiumJS (thay Google Maps)

| Tiêu chí | Google Maps | MapLibre + CesiumJS |
|---|---|---|
| Chi phí | $7/1,000 loads (sau $200 free) | **Hoàn toàn miễn phí** |
| API Key | Bắt buộc, cần billing | **Không cần** |
| 3D thực sự | Chỉ satellite + tilt 45° | **CesiumJS: globe, terrain, fly animation** |
| Open source | Không | **MapLibre: MIT. CesiumJS: Apache 2.0** |
| Offline/self-host | Không thể | **Có thể** |
| Fly-through animation | Không (chỉ setTilt) | **CesiumJS: camera.flyTo() đầy đủ** |
| 360° tích hợp | Street View riêng | **Photo Sphere Viewer (đã có)** |

**Kết luận:** MapLibre + CesiumJS cho trải nghiệm 3D ấn tượng hơn, hoàn toàn miễn phí, phù hợp cho demo đồ án.

---

## 3. Luồng trải nghiệm người dùng

```
Trang /map
   │
   ├── Bản đồ 2D (MapLibre)
   │     ├── Click marker KTX → Side Panel (chi tiết, phòng, đăng ký)
   │     └── Nút "Khám phá 3D"
   │
   └── Chế độ 3D (CesiumJS Overlay)
         ├── Camera bay: Việt Nam → Hà Nội → HUST → KTX
         ├── Click entity KTX → Side Panel
         └── Nút "Xem 360°" → /rooms/:id/view
```

---

## 4. Cấu hình

### 4.1 Biến môi trường

Không bắt buộc, nhưng có thể thêm Cesium Ion token để dùng terrain/assets cao cấp:

```env
# .env (tùy chọn)
CESIUM_ION_TOKEN=your_token_here
```

Lấy token miễn phí tại [cesium.com/ion](https://cesium.com/ion) (1M requests/tháng free).

Không có token vẫn hoạt động bình thường với OSM imagery.

### 4.2 Server truyền token vào view

**File:** `src/routes/public-routes.js`

```js
res.render('public/map', {
    dormitories: JSON.stringify(dormitories),
    cesiumToken: process.env.CESIUM_ION_TOKEN || ''
});
```

### 4.3 EJS nhận token

```html
<script>window.CESIUM_ION_TOKEN = '<%= typeof cesiumToken !== "undefined" ? cesiumToken : "" %>';</script>
```

---

## 5. MapLibre GL JS — Bản đồ 2D

### 5.1 Khởi tạo

```js
map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [105.843220, 21.007119], // [lng, lat] — HUST
    zoom: 14,
    attributionControl: false
});
```

> **Quan trọng:** MapLibre (và GeoJSON) dùng thứ tự `[longitude, latitude]`, không phải `[lat, lng]` như Google Maps.

### 5.2 Thêm marker

```js
const el = document.createElement('div');
el.className = 'marker-dorm';
el.innerHTML = '<img src="/image/location.png" width="40" height="40">';

new maplibregl.Marker({ element: el })
    .setLngLat([lng, lat])
    .addTo(map);
```

### 5.3 Popup

```js
new maplibregl.Popup({ offset: 25, maxWidth: '280px' })
    .setHTML('<h3>Tên KTX</h3><p>Địa chỉ...</p>');
```

### 5.4 Bay tới vị trí

```js
map.flyTo({ center: [lng, lat], zoom: 17, speed: 1.2 });
```

---

## 6. CesiumJS — Chế độ 3D

### 6.1 Lazy load (chỉ tải khi nhấn "Khám phá 3D")

```js
const script = document.createElement('script');
script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.123/Build/Cesium/Cesium.js';
script.onload = () => initCesium();
document.head.appendChild(script);
```

### 6.2 Khởi tạo Viewer

```js
cesiumViewer = new Cesium.Viewer('cesiumContainer', {
    imageryProvider: new Cesium.OpenStreetMapImageryProvider({
        url: 'https://tile.openstreetmap.org/'
    }),
    baseLayerPicker: false,
    geocoder: false,
    // ... tắt các UI không cần thiết
});
```

### 6.3 Thêm entity marker cho KTX

```js
cesiumViewer.entities.add({
    name: dorm.name,
    position: Cesium.Cartesian3.fromDegrees(lng, lat, 30),
    dormData: dorm, // custom property để truy cập khi click
    billboard: {
        image: '/image/location.png',
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    },
    label: {
        text: dorm.name,
        font: '13px Inter, Arial',
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3000)
    }
});
```

### 6.4 Camera fly sequence

```js
// Bắt đầu từ cao → Hà Nội → HUST → KTX
camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(106.0, 16.0, 1800000) // Việt Nam
});

camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(105.843, 21.007, 25000), // Hà Nội
    orientation: { pitch: Cesium.Math.toRadians(-55) },
    duration: 3
});
```

### 6.5 Xử lý click trên entity

```js
cesiumViewer.screenSpaceEventHandler.setInputAction(movement => {
    const picked = cesiumViewer.scene.pick(movement.position);
    if (Cesium.defined(picked) && picked.id && picked.id.dormData) {
        openSidePanel(picked.id.dormData._id, picked.id.dormData);
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
```

---

## 7. Side Panel — Chi tiết KTX

Side panel trượt từ phải vào (thay cho popup) khi click marker trên bản đồ 2D hoặc entity trong Cesium.

**HTML elements:**

| ID | Chức năng |
|---|---|
| `dormSidePanel` | Container panel, thêm class `open` để hiện |
| `sidePanelBackdrop` | Overlay tối phía sau, thêm class `show` |
| `sidePanelImg` | Ảnh ký túc xá (background-image) |
| `sidePanelBadges` | Badges trạng thái |
| `sidePanelName` | Tên KTX |
| `sidePanelAddr` | Địa chỉ |
| `sidePanelStats` | Grid stats (sức chứa, giá, liên hệ) |
| `sidePanelAmenities` | Tiện ích |
| `sidePanelRegister` | Nút đăng ký |
| `sidePanelRooms` | Nút xem/ẩn danh sách phòng |
| `sidePanelDirections` | Nút chỉ đường (Google Maps) |
| `sidePanelView360` | Nút xem phòng 360° |
| `sidePanelRoomsSection` | Section danh sách phòng |
| `sidePanelRoomsGrid` | Grid card phòng |

---

## 8. Ảnh 360°

Đã được triển khai qua Photo Sphere Viewer + Three.js tại route:

```
GET /rooms/:roomId/view
```

Từ Side Panel, nút "Xem 360°" fetch API để lấy `roomId` đầu tiên của KTX rồi mở tab mới:

```js
window.open(`/rooms/${roomId}/view`, '_blank');
```

---

## 9. Thêm ký túc xá mới

1. Tạo dormitory qua admin dashboard hoặc seed script
2. Đảm bảo field `location.coordinates` có dạng `[longitude, latitude]` (GeoJSON)
3. Marker tự động xuất hiện khi `/api/map-data` trả về

**Ví dụ tọa độ HUST:**
```json
{
  "location": {
    "type": "Point",
    "coordinates": [105.843220, 21.007119]
  }
}
```

---

## 10. Thêm điểm nhìn 360°

1. Upload ảnh equirectangular lên Cloudinary
2. Lưu URL vào `room.panoramaUrl` trong database
3. Photo Sphere Viewer tự động render tại `/rooms/:roomId/view`

---

## 11. Tùy chỉnh chuỗi bay Cesium

Hàm `runFlySequence(dorms)` trong `views/public/map.ejs`:

```js
// Bước 1: Việt Nam (1,800 km)
camera.setView({ destination: Cesium.Cartesian3.fromDegrees(106.0, 16.0, 1800000) });

// Bước 2: Hà Nội (25 km) — sau 1.5s
camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(105.843, 21.007, 25000), duration: 3 });

// Bước 3: HUST campus (1.2 km) — sau 5.5s
camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(105.843220, 21.007119, 1200), duration: 3.5 });

// Bước 4: Zoom KTX đầu tiên (600m) — sau 10s
```

Điều chỉnh `duration` (giây) và altitude (tham số thứ 3 của `fromDegrees`) để thay đổi tốc độ và góc nhìn.

---

## 12. Deploy

1. Không cần API key Maps nào
2. Tùy chọn: thêm `CESIUM_ION_TOKEN` vào `.env` production để dùng Cesium Ion assets
3. Đảm bảo `/image/location.png` và `/image/university.png` có trong `public/image/`
4. MapLibre và CesiumJS load từ CDN — cần kết nối internet

---

## 13. Bảo trì

| Vấn đề | Nguyên nhân | Giải pháp |
|---|---|---|
| Map 2D không load | CDN unpkg chậm | Tải local: `npm install maplibre-gl` |
| Cesium không hiển thị | Script CDN chưa load | F12 → Network tab kiểm tra lỗi |
| Marker không xuất hiện | `location.coordinates` null | Kiểm tra seed data trong MongoDB |
| Side panel không mở | `dormData` undefined | Kiểm tra API `/api/dormitories/:id` |
| 360° không mở | Room không có panoramaUrl | Upload ảnh panorama cho phòng đó |
