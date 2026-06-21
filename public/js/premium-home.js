(function () {

    /* ── State ── */
    var _leafletMap = null;
    var _leafletMarkers = []; // { marker, data, el, lat, lng }
    var _mapDorms = [];
    var _activeDormId = null;
    var _activeMarkerEl = null;
    var _userMarker = null;
    var _satOn = false;
    var _routePolyline = null;
    var _gateMarker = null;
    var _satLayer = null;
    var _baseLayer = null;
    var _fallbackIdx = 0;

    /* ── Map constants ── */
    var HUST_LNG = 105.843220;
    var HUST_LAT = 21.007119;

    /* Hardcoded dorm coordinates [lat, lng] — override DB values */
    var DORM_COORDS = {
        'KTX E5 - Bách Khoa': [21.010077, 105.840734],
        'KTX A1 - Bách Khoa': [21.011219, 105.847086],
        'KTX D4 - Bách Khoa': [21.007078, 105.846018],
        'KTX B2 - Bách Khoa': [21.005068, 105.840691],
        'KTX C3 - Bách Khoa': [21.005919, 105.840906],
        'KTX G7 - Bách Khoa': [21.005666, 105.846147],
        'KTX F6 - Bách Khoa': [21.006739, 105.845944],
    };

    var GATES = {
        parabol:      [21.00748,  105.843121],
        tranDaiNghia: [21.00558,  105.845383],
    };

    var GATE_NAMES = {
        parabol:      'Cổng Parabol ĐHBK',
        tranDaiNghia: 'Cổng Trần Đại Nghĩa ĐHBK',
    };

    var STATIC_ROUTES = {
        'KTX E5 - Bách Khoa': {
            gate: 'parabol',
            waypoints: [
                [21.010077, 105.840734],
                [21.009781, 105.841196],
                [21.007528, 105.841279],
                [21.00748,  105.843121],
            ],
        },
        'KTX A1 - Bách Khoa': {
            gate: 'parabol',
            waypoints: [
                [21.011219, 105.847086],
                [21.011103, 105.847098],
                [21.011036, 105.846728],
                [21.011085, 105.846533],
                [21.011197, 105.846516],
                [21.011218, 105.846393],
                [21.011247, 105.84638],
                [21.011348, 105.845922],
                [21.010852, 105.845823],
                [21.009822, 105.845608],
                [21.009056, 105.845952],
                [21.008099, 105.846073],
                [21.007845, 105.846096],
                [21.007631, 105.844187],
                [21.007557, 105.843211],
                [21.00748,  105.843121],
            ],
        },
        'KTX D4 - Bách Khoa': {
            gate: 'tranDaiNghia',
            waypoints: [
                [21.007078, 105.846018],
                [21.007068, 105.8461],
                [21.006668, 105.846207],
                [21.006647, 105.845746],
                [21.006301, 105.845769],
                [21.006102, 105.845652],
                [21.00558,  105.845383],
            ],
        },
        'KTX B2 - Bách Khoa': {
            gate: 'parabol',
            waypoints: [
                [21.005068, 105.840691],
                [21.005068, 105.840767],
                [21.005156, 105.840755],
                [21.005149, 105.841179],
                [21.006921, 105.841198],
                [21.006932, 105.841625],
                [21.007496, 105.841701],
                [21.007549, 105.843047],
                [21.00748,  105.843121],
            ],
        },
        'KTX C3 - Bách Khoa': {
            gate: 'parabol',
            waypoints: [
                [21.005954, 105.840883],
                [21.005964, 105.841753],
                [21.00691,  105.841825],
                [21.007193, 105.842649],
                [21.00748,  105.843121],
            ],
        },
        'KTX G7 - Bách Khoa': {
            gate: 'tranDaiNghia',
            waypoints: [
                [21.005666, 105.846147],
                [21.00558,  105.845383],
            ],
        },
        'KTX F6 - Bách Khoa': {
            gate: 'tranDaiNghia',
            waypoints: [
                [21.006739, 105.845944],
                [21.006657, 105.845764],
                [21.00627,  105.845768],
                [21.006108, 105.845622],
                [21.00558,  105.845383],
            ],
        },
    };

    var FALLBACK_POS = [
        { lat: 21.008500, lng: 105.841800 },
        { lat: 21.005200, lng: 105.845800 },
        { lat: 21.010100, lng: 105.844200 },
    ];

    var DEFAULT_AMENITIES = [
        'WiFi tốc độ cao', 'Bãi đỗ xe', 'Bảo vệ 24/7', 'Phòng tự học',
        'Máy giặt', 'Sân thể thao', 'Căng tin', 'Thang máy'
    ];

    var DORM_AMENITIES_MAP = {
        'A1': ['WiFi tốc độ cao', 'Bãi đỗ xe', 'Máy giặt tự động', 'Bảo vệ 24/7'],
        'B2': ['WiFi tốc độ cao', 'Phòng sinh hoạt chung', 'Bãi đỗ xe'],
        'C3': ['WiFi tốc độ cao', 'Máy giặt tự động', 'Bảo vệ 24/7'],
        'D4': ['WiFi tốc độ cao', 'Phòng tự học', 'Bãi đỗ xe', 'Bảo vệ 24/7'],
        'E5': ['WiFi tốc độ cao', 'Máy giặt tự động', 'Căng tin'],
        'F6': ['WiFi tốc độ cao', 'Bãi đỗ xe', 'Phòng sinh hoạt chung', 'Bảo vệ 24/7']
    };

    var AVATAR_COLORS = ['#E74C5B','#3498db','#27ae60','#9b59b6','#f39c12','#1abc9c','#e67e22','#2980b9'];
    function avatarColor(str) {
        var s = 0; for (var i = 0; i < str.length; i++) s += str.charCodeAt(i);
        return AVATAR_COLORS[s % AVATAR_COLORS.length];
    }

    var DORM_REVIEWS = {
        'A1': [
            { name: 'Nguyễn Minh Tuấn', year: 'Kỹ thuật Điện · Năm 3', rating: 5, avatar: 'MT', text: 'Gần trường cực kỳ tiện, sáng 7h mới dậy vẫn kịp 7h30. WiFi ban đêm khá ổn định. Ở 2 năm rồi không có ý định chuyển đi.' },
            { name: 'Trần Thu Hương',    year: 'Công nghệ Thông tin · Năm 2', rating: 4, avatar: 'TH', text: 'Bảo vệ trực 24/7, về muộn không lo. Phòng hơi nhỏ nhưng bố trí ổn. Tiếng ồn cuối tuần hơi nhiều.' },
            { name: 'Lê Văn Đức',        year: 'Cơ khí · Năm 4', rating: 4, avatar: 'VĐ', text: 'Máy giặt hoạt động tốt, không phải xếp hàng lâu. Bạn cùng phòng thân thiện, hay chia sẻ đồ ăn.' },
            { name: 'Phạm Thị Mai',      year: 'Điện tử Viễn thông · Năm 3', rating: 5, avatar: 'TM', text: 'Đi bộ đến cổng trường B1 chỉ mất 5 phút. Phòng sạch sẽ, quản lý kiểm tra định kỳ.' },
            { name: 'Hoàng Quốc Anh',   year: 'Vật lý Kỹ thuật · Năm 1', rating: 3, avatar: 'QA', text: 'WiFi ổn nhưng điện nước thỉnh thoảng trục trặc vào giờ cao điểm. Nhìn chung tạm được.' }
        ],
        'B2': [
            { name: 'Vũ Thị Ngọc',      year: 'Toán - Tin · Năm 3', rating: 5, avatar: 'TN', text: 'KTX yên tĩnh, học bài rất tập trung. Phòng sinh hoạt chung rộng, có TV và bàn bóng bàn.' },
            { name: 'Đặng Văn Bình',    year: 'Xây dựng · Năm 2', rating: 4, avatar: 'VB', text: 'Gần khu ăn vặt Tạ Quang Bửu, tối nào cũng ra ăn. Bãi xe rộng, để xe đạp thoải mái.' },
            { name: 'Đinh Thị Lan',      year: 'Quản trị Kinh doanh · Năm 3', rating: 4, avatar: 'TL', text: 'Quản lý nhiệt tình, lần trước điều hòa hỏng được sửa trong vòng 1 ngày.' },
            { name: 'Ngô Tiến Đạt',     year: 'CNTT · Năm 2', rating: 3, avatar: 'TĐ', text: 'Khoảng cách 7 phút đi bộ ổn nếu có xe đạp. WiFi đôi khi lag vào giờ học online.' },
            { name: 'Bùi Thị Phương',   year: 'Hóa học · Năm 4', rating: 5, avatar: 'TP', text: 'Toilet sạch sẽ, vệ sinh hàng ngày. Bạn cùng phòng chăm học, không khí học rất tốt.' }
        ],
        'C3': [
            { name: 'Phan Thị Hà',       year: 'Điện - Điện tử · Năm 3', rating: 4, avatar: 'TH', text: 'Máy giặt nhiều, ít phải chờ. Bảo vệ kiểm tra thẻ nghiêm chỉnh, cảm giác an toàn.' },
            { name: 'Trương Văn Nam',    year: 'Cơ khí · Năm 2', rating: 3, avatar: 'VN', text: 'Phòng hơi cũ nhưng giá rẻ hơn ngoài. 8 phút đi bộ đến trường là chấp nhận được.' },
            { name: 'Lý Thị Bảo',        year: 'Hàng không · Năm 3', rating: 4, avatar: 'TB', text: 'Khu vực yên tĩnh, ít người qua lại vào ban đêm. Ngủ ngon không bị ảnh hưởng.' },
            { name: 'Hồ Minh Quân',      year: 'CNTT · Năm 4', rating: 5, avatar: 'MQ', text: 'WiFi ổn định, học online không bị lag. Tiết kiệm được rất nhiều so với thuê nhà ngoài.' },
            { name: 'Nguyễn Thúy Vân',  year: 'Kinh tế · Năm 3', rating: 4, avatar: 'TV', text: 'Ban quản lý xử lý phản ánh nhanh. Cuối năm tổ chức tổng vệ sinh, phòng sạch sẽ hơn.' }
        ],
        'D4': [
            { name: 'Cao Thị Thanh',     year: 'Điện tử · Năm 4', rating: 5, avatar: 'TT', text: 'Phòng tự học mở đến 23h, thi cuối kỳ không phải thuê chỗ học ngoài. Tiện cực.' },
            { name: 'Đỗ Việt Hùng',     year: 'Kỹ thuật Máy tính · Năm 3', rating: 4, avatar: 'VH', text: 'An ninh nghiêm ngặt, khách vào phải đăng ký. An tâm để laptop và đồ đạc trong phòng.' },
            { name: 'Mai Thị Loan',      year: 'Vật liệu · Năm 2', rating: 3, avatar: 'TL', text: 'Cách trường 9 phút đi bộ, hơi xa nhưng đường đẹp. Bù lại phòng rộng hơn so với khu A.' },
            { name: 'Vương Đức Thịnh',  year: 'Cơ điện tử · Năm 4', rating: 5, avatar: 'ĐT', text: 'Bãi đỗ xe rộng, để xe máy và xe đạp đều ổn. Không bị nhét chật như một số KTX khác.' },
            { name: 'Lê Thị Hồng',       year: 'Điện · Năm 3', rating: 4, avatar: 'TH', text: 'Bạn cùng phòng đều sinh viên năm 3-4, ai cũng nghiêm túc học. Không khí phòng rất tốt.' }
        ],
        'E5': [
            { name: 'Trần Văn Kiên',     year: 'Kỹ thuật Hóa · Năm 3', rating: 4, avatar: 'VK', text: 'Căng tin mở đến 9 giờ tối, học muộn không lo đói. Cơm bụi giá sinh viên ổn.' },
            { name: 'Nguyễn Thị Diệu',  year: 'Toán Ứng dụng · Năm 2', rating: 5, avatar: 'TĐ', text: 'Máy giặt mới thay năm ngoái, giặt nhanh sạch. Sân phơi rộng, không tranh chỗ.' },
            { name: 'Phùng Thế Anh',    year: 'Vật lý · Năm 1', rating: 3, avatar: 'TA', text: '10 phút đi bộ hơi xa, nhưng khu xung quanh yên tĩnh. Phù hợp bạn cần tập trung học.' },
            { name: 'Đinh Thị Xuân',    year: 'CNTT · Năm 3', rating: 4, avatar: 'TX', text: 'WiFi ổn định, học online không bị đứt giữa chừng. Phòng 4 người vừa đủ thoáng mát.' },
            { name: 'Ngô Quốc Bảo',    year: 'Điện tử · Năm 2', rating: 4, avatar: 'QB', text: 'Nhân viên vệ sinh dọn hành lang hằng ngày. KTX E5 sạch sẽ hơn nhiều so với mình tưởng.' },
            { name: 'Hoàng Thị Thu',    year: 'Hóa học · Năm 4', rating: 5, avatar: 'TT', text: 'Ở từ năm nhất đến năm tư, không thấy lý do gì phải chuyển. Ổn định, an toàn, giá hợp lý.' }
        ],
        'F6': [
            { name: 'Lê Thị Phúc',      year: 'Cơ khí · Năm 2', rating: 4, avatar: 'TP', text: 'Phòng sinh hoạt chung có máy chiếu, hay tổ chức xem phim với bạn cùng tầng. Vui lắm.' },
            { name: 'Nguyễn Văn Cường', year: 'Kỹ thuật Điện · Năm 3', rating: 4, avatar: 'VC', text: 'Bảo vệ trực đêm nghiêm, đúng giờ giới nghiêm. An tâm để xe và đồ đạc.' },
            { name: 'Đặng Thị Huyền',   year: 'Kinh tế · Năm 2', rating: 3, avatar: 'TH', text: 'KTX ở cực nam khuôn viên nên xa trường hơn. Nhưng giá rẻ nhất, hợp sinh viên tiết kiệm.' },
            { name: 'Bùi Minh Tú',      year: 'Xây dựng · Năm 3', rating: 5, avatar: 'MT', text: 'Bãi xe có bảo vệ trông suốt ngày, chưa bao giờ mất xe hay hỏng gì.' },
            { name: 'Tạ Thị Ngân',      year: 'CNTT · Năm 4', rating: 4, avatar: 'TN', text: 'WiFi khá ổn, có lúc lag nhưng không nhiều. Nhà vệ sinh sạch, dọn 2 lần mỗi ngày.' }
        ]
    };

    /* ─────────────────── MENU ─────────────────── */
    function setupMenu() {
        var menuToggle = document.getElementById('menuToggle');
        var navContainer = document.getElementById('navContainer');
        if (!menuToggle || !navContainer) return;
        if (navContainer.dataset.navReady === 'true') return;
        menuToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            navContainer.classList.toggle('active');
        });
        navContainer.querySelectorAll('.nav-link').forEach(function (l) {
            l.addEventListener('click', function () { navContainer.classList.remove('active'); });
        });
        document.addEventListener('click', function (e) {
            if (!navContainer.contains(e.target) && !menuToggle.contains(e.target)) {
                navContainer.classList.remove('active');
            }
        });
    }

    /* ─────────────────── PROFILE DROPDOWN ─────────────────── */
    function setupProfileDropdown() {
        var avatarToggle = document.getElementById('avatarToggle');
        var dropdownMenu = document.getElementById('dropdownMenu');
        var wrap = document.getElementById('userProfileWrap');
        if (!avatarToggle || !dropdownMenu || !wrap) return;
        if (wrap.dataset.dropdownReady === 'true') return;
        avatarToggle.addEventListener('click', function (e) {
            e.preventDefault();
            dropdownMenu.classList.toggle('show');
        });
        document.addEventListener('click', function (e) {
            if (!wrap.contains(e.target)) dropdownMenu.classList.remove('show');
        });
    }

    /* ─────────────────── DORM STATS ─────────────────── */
    function countActiveOccupants(occupants) {
        if (!Array.isArray(occupants)) return 0;
        return occupants.filter(function (o) { return o && o.active; }).length;
    }

    function getDormStats(dorm) {
        var totalRooms = 0, occupied = 0, capacity = 0;
        (dorm.floors || []).forEach(function (floor) {
            (floor.rooms || []).forEach(function (room) {
                totalRooms++;
                capacity += Number(room.maxCapacity) || 0;
                occupied += countActiveOccupants(room.occupants);
            });
        });
        return { totalRooms: totalRooms, occupied: occupied, availableBeds: Math.max(capacity - occupied, 0) };
    }

    /* ─────────────────── ROOM CARDS ─────────────────── */
    function renderLoadingSkeleton(roomGrid) {
        if (!roomGrid) return;
        roomGrid.innerHTML = '<div class="rooms-loading">' +
            '<div class="skeleton-card"><div class="skeleton-media"></div><div class="skeleton-body"><div class="skeleton-line wide"></div><div class="skeleton-line mid"></div><div class="skeleton-line wide"></div></div></div>'.repeat(3) +
            '</div>';
    }

    function renderDormCards(roomGrid, dormitories) {
        if (!roomGrid) return;
        if (!dormitories.length) { renderLoadingSkeleton(roomGrid); return; }
        var fallback = [
            'https://res.cloudinary.com/dysgt8t4d/image/upload/v1780930501/anhj_qhplyx.jpg',
            'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773732655/right_kglglh.png',
            'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773142008/5deb042e-de1a-4ca0-8f2d-c28eae9f995f_oioewe.png',
            'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773732656/left_vqkrse.png'
        ];
        roomGrid.innerHTML = dormitories.map(function (dorm, i) {
            var img = dorm.imageUrl || fallback[i % fallback.length];
            var stats = getDormStats(dorm);
            var href = dorm._id ? '/dormitory/' + dorm._id : '/';
            var desc = (dorm.address || 'Khu ký túc xá Đại học Bách Khoa').slice(0, 78);
            var defaultImg = fallback[0];
            return '<article class="room-card">' +
                '<div class="room-media"><img class="room-image" src="' + img + '" alt="' + (dorm.name || '') + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + defaultImg + '\'" /></div>' +
                '<div class="room-body">' +
                    '<h3 class="room-type">' + (dorm.name || 'Ký túc xá') + '</h3>' +
                    '<p class="room-meta">' + desc + '</p>' +
                    '<div class="room-tags"><span class="room-tag">' + stats.totalRooms + ' phòng</span><span class="room-tag">' + stats.availableBeds + ' chỗ trống</span></div>' +
                    '<a href="' + href + '" class="book-btn">Khám phá ngay <i class="fas fa-arrow-right"></i></a>' +
                '</div>' +
            '</article>';
        }).join('');
    }

    /* ─────────────────── ROOM CAROUSEL ─────────────────── */
    function setupRoomCarousel() {
        var roomGrid = document.getElementById('roomGrid');
        var roomPrev = document.getElementById('roomPrev');
        var roomNext = document.getElementById('roomNext');
        if (!roomGrid) return {};

        var offset = 0;

        function cardStep() {
            var card = roomGrid.querySelector('.room-card');
            var gap = 24;
            return card ? card.offsetWidth + gap : (window.innerWidth < 576 ? 336 : window.innerWidth < 920 ? 376 : 524);
        }

        function maxNegOffset() {
            var container = roomGrid.parentElement;
            if (!container) return 0;
            return Math.max(0, roomGrid.scrollWidth - container.offsetWidth);
        }

        function applyOffset() {
            roomGrid.style.transform = 'translateX(' + offset + 'px)';
        }

        if (roomPrev) roomPrev.addEventListener('click', function () {
            offset = Math.min(0, offset + cardStep());
            applyOffset();
        });
        if (roomNext) roomNext.addEventListener('click', function () {
            offset = Math.max(-maxNegOffset(), offset - cardStep());
            applyOffset();
        });

        function updateSliderBtns() {
            var cards = roomGrid.querySelectorAll('.room-card');
            var hide = cards.length <= 3;
            if (roomPrev) roomPrev.style.display = hide ? 'none' : '';
            if (roomNext) roomNext.style.display = hide ? 'none' : '';
            /* reset position on re-render */
            offset = 0;
            applyOffset();
        }

        var observer = new MutationObserver(updateSliderBtns);
        observer.observe(roomGrid, { childList: true, subtree: false });
        updateSliderBtns();

        return { roomGrid: roomGrid };
    }

    /* ─────────────────── XSS SAFE ─────────────────── */
    function escapeHtml(v) {
        return String(v || '').replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c];
        });
    }

    /* ═══════════════════════════════════════════════════════
       MAP HELPERS
    ═══════════════════════════════════════════════════════ */

    /* Extract code like 'A1', 'B2' from dorm name (used for amenities/reviews lookup) */
    function getDormCode(name) {
        if (!name) return null;
        var m = (String(name)).toUpperCase().match(/([A-Z]\d+)/);
        return m ? m[1] : null;
    }

    /* Resolve [lat, lng] for a dorm: hardcoded DORM_COORDS override DB values */
    function getDormPos(dorm) {
        var name = dorm.name || '';
        if (DORM_COORDS[name]) {
            return { lat: DORM_COORDS[name][0], lng: DORM_COORDS[name][1] };
        }
        if (dorm.location && Array.isArray(dorm.location.coordinates) && dorm.location.coordinates.length >= 2) {
            return { lat: dorm.location.coordinates[1], lng: dorm.location.coordinates[0] };
        }
        if (typeof dorm.latitude === 'number' && isFinite(dorm.latitude)) {
            return { lat: dorm.latitude, lng: dorm.longitude };
        }
        return null;
    }

    function haversineMeters(lat1, lng1, lat2, lng2) {
        var R = 6371000;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLng = (lng2 - lng1) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function calcWalkMinutes(dormName) {
        var route = STATIC_ROUTES[dormName];
        if (!route || !route.waypoints || route.waypoints.length < 2) return 0;
        var totalM = 0;
        for (var i = 0; i < route.waypoints.length - 1; i++) {
            var w1 = route.waypoints[i], w2 = route.waypoints[i + 1];
            totalM += haversineMeters(w1[0], w1[1], w2[0], w2[1]);
        }
        return Math.max(1, Math.ceil(totalM / 70));
    }

    function getAmenitiesForDorm(dorm) {
        var code = getDormCode(dorm.name || '');
        return (code && DORM_AMENITIES_MAP[code]) ? DORM_AMENITIES_MAP[code] : DEFAULT_AMENITIES.slice(0, 4);
    }

    function getReviewsForDorm(dorm) {
        var code = getDormCode(dorm.name || '');
        return (code && DORM_REVIEWS[code]) ? DORM_REVIEWS[code] : [];
    }

    /* Create pill-style marker */
    function createDormMarkerEl(dorm, minutes) {
        var el = document.createElement('div');
        el.className = 'map-dorm-pill';
        el.setAttribute('data-dorm-id', String(dorm._id || ''));
        el.innerHTML =
            '<div class="mdp-time-badge">' +
                '<span class="mdp-num">' + (minutes || '—') + '</span>' +
                '<span class="mdp-unit">min</span>' +
            '</div>' +
            '<span class="mdp-name">' + escapeHtml(dorm.name || 'KTX') + '</span>';
        return el;
    }

    /* Manage active / dimmed states across all markers */
    function setActiveMarker(clickedMarker) {
        _leafletMarkers.forEach(function (m) {
            var el = m.marker.getElement ? m.marker.getElement() : null;
            if (el) {
                var pill = el.querySelector('.map-dorm-pill');
                if (pill) { pill.classList.remove('active', 'dimmed'); }
            }
        });
        _leafletMarkers.forEach(function (m) {
            var el = m.marker.getElement ? m.marker.getElement() : null;
            if (!el) return;
            var pill = el.querySelector('.map-dorm-pill');
            if (!pill) return;
            if (m.marker === clickedMarker) pill.classList.add('active');
            else pill.classList.add('dimmed');
        });
        _activeMarkerEl = clickedMarker || null;
    }

    /* ═══════════════════════════════════════════════════════
       ROUTE — static polylines (Leaflet)
    ═══════════════════════════════════════════════════════ */
    function drawStaticRoute(dormName) {
        clearRoute();
        if (!_leafletMap) return;
        var route = STATIC_ROUTES[dormName];
        if (!route || !route.waypoints || !route.waypoints.length) return;

        var latlngs = route.waypoints.map(function (wp) { return [wp[0], wp[1]]; });
        _routePolyline = L.polyline(latlngs, {
            color: '#C8102E', weight: 4, opacity: 0.85
        }).addTo(_leafletMap);

        var gateKey = route.gate;
        var gateLatLng = GATES[gateKey];
        if (gateLatLng) {
            _gateMarker = L.marker([gateLatLng[0], gateLatLng[1]])
                .bindPopup('<div style="font-size:11px;font-weight:700">' +
                           escapeHtml(GATE_NAMES[gateKey] || gateKey) + '</div>')
                .addTo(_leafletMap)
                .openPopup();
        }
    }

    function clearRoute() {
        if (_routePolyline && _leafletMap) { _leafletMap.removeLayer(_routePolyline); _routePolyline = null; }
        if (_gateMarker && _leafletMap) { _leafletMap.removeLayer(_gateMarker); _gateMarker = null; }
    }

    /* ═══════════════════════════════════════════════════════
       MAP SETUP (Leaflet)
    ═══════════════════════════════════════════════════════ */
    function setupMap(dormitories) {
        var mapEl = document.getElementById('dormitory-map');
        if (!mapEl || !window.L) return;
        _mapDorms = dormitories;

        _baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        });

        _leafletMap = L.map('dormitory-map', { zoomControl: false })
            .setView([HUST_LAT, HUST_LNG], 16);

        _baseLayer.addTo(_leafletMap);

        addHustMarker();
        addDormsToMap(dormitories);
        setupMapControls();
        setupMapSearch();
        bindDormPanelEvents();
    }

    /* HUST university marker */
    function addHustMarker() {
        var icon = L.divIcon({
            className: 'map-hust-pin',
            html: '<img src="/image/university.png" width="36" height="36" alt="HUST" onerror="this.style.display=\'none\'">',
            iconSize: [36, 36],
            iconAnchor: [18, 36]
        });
        L.marker([HUST_LAT, HUST_LNG], { icon: icon })
            .bindPopup('<div class="mlgl-popup"><strong>Đại học Bách Khoa Hà Nội</strong><p>Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội</p><a href="https://hust.edu.vn" target="_blank" rel="noopener">hust.edu.vn ↗</a></div>')
            .addTo(_leafletMap);
    }

    /* Dormitory markers with pill design */
    function addDormsToMap(dorms) {
        clearMarkers();
        _fallbackIdx = 0;
        var bounds = [[HUST_LAT, HUST_LNG]];

        dorms.forEach(function (dorm) {
            var pos = getDormPos(dorm);
            var lat, lng;
            if (pos) { lat = pos.lat; lng = pos.lng; }
            else {
                var fb = FALLBACK_POS[_fallbackIdx % FALLBACK_POS.length];
                lat = fb.lat; lng = fb.lng; _fallbackIdx++;
            }

            var dormName = dorm.name || '';
            var minutes = calcWalkMinutes(dormName);
            var elDiv = createDormMarkerEl(dorm, minutes);

            var icon = L.divIcon({
                className: '',
                html: elDiv.outerHTML,
                iconSize: null,
                iconAnchor: [0, 0]
            });

            var marker = L.marker([lat, lng], { icon: icon }).addTo(_leafletMap);
            (function (dormRef, dormLat, dormLng, markerRef) {
                markerRef.on('click', function () {
                    setActiveMarker(markerRef);
                    drawStaticRoute(dormRef.name || '');
                    openDormPanel(dormRef._id, dormRef);
                    _leafletMap.setView([dormLat, dormLng], 17, { animate: true });
                });
            }(dorm, lat, lng, marker));

            _leafletMarkers.push({ marker: marker, data: dorm, el: elDiv, lat: lat, lng: lng });
            bounds.push([lat, lng]);
        });

        if (bounds.length > 1) {
            _leafletMap.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
        }
    }

    function clearMarkers() {
        _leafletMarkers.forEach(function (m) { if (_leafletMap) _leafletMap.removeLayer(m.marker); });
        _leafletMarkers = [];
        _activeMarkerEl = null;
    }

    /* ─────────────────── MAP CONTROLS ─────────────────── */
    function setupMapControls() {
        var locateBtn = document.getElementById('mapLocateMe');
        if (locateBtn) {
            locateBtn.addEventListener('click', function () {
                if (!navigator.geolocation) return;
                locateBtn.classList.add('mc-btn--loading');
                navigator.geolocation.getCurrentPosition(
                    function (pos) {
                        locateBtn.classList.remove('mc-btn--loading');
                        var lat = pos.coords.latitude, lng = pos.coords.longitude;
                        _leafletMap.setView([lat, lng], 16, { animate: true });
                        if (_userMarker) _leafletMap.removeLayer(_userMarker);
                        _userMarker = L.circleMarker([lat, lng], {
                            radius: 8, fillColor: '#3b82f6', color: '#fff', weight: 2, fillOpacity: 1
                        }).bindPopup('<strong>Vị trí của bạn</strong>').addTo(_leafletMap).openPopup();
                    },
                    function () { locateBtn.classList.remove('mc-btn--loading'); }
                );
            });
        }

        var zoomIn = document.getElementById('mapZoomIn');
        if (zoomIn) zoomIn.addEventListener('click', function () { _leafletMap && _leafletMap.zoomIn(); });
        var zoomOut = document.getElementById('mapZoomOut');
        if (zoomOut) zoomOut.addEventListener('click', function () { _leafletMap && _leafletMap.zoomOut(); });

        var resetBtn = document.getElementById('mapResetView');
        if (resetBtn) resetBtn.addEventListener('click', function () {
            if (!_leafletMap) return;
            _leafletMap.setView([HUST_LAT, HUST_LNG], 16, { animate: true });
        });

        /* Satellite toggle — swap tile layer */
        var satBtn = document.getElementById('mapSatellite');
        if (satBtn) {
            satBtn.addEventListener('click', function () {
                _satOn = !_satOn;
                if (_satOn) {
                    if (_baseLayer) _leafletMap.removeLayer(_baseLayer);
                    if (!_satLayer) _satLayer = L.tileLayer(
                        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                        { maxZoom: 19, attribution: 'Tiles © Esri' }
                    );
                    _satLayer.addTo(_leafletMap);
                } else {
                    if (_satLayer) _leafletMap.removeLayer(_satLayer);
                    if (_baseLayer) _baseLayer.addTo(_leafletMap);
                }
                satBtn.classList.toggle('mc-btn--active', _satOn);
            });
        }
    }

    /* ─────────────────── MAP SEARCH ─────────────────── */
    function setupMapSearch() {
        var input = document.getElementById('mapSearchInput');
        var resultsEl = document.getElementById('mapSearchResults');
        if (!input || !resultsEl) return;

        input.addEventListener('input', function () {
            var q = this.value.trim().toLowerCase();
            if (!q) { resultsEl.style.display = 'none'; return; }

            var matches = _mapDorms.filter(function (d) {
                return (d.name || '').toLowerCase().includes(q) || (d.address || '').toLowerCase().includes(q);
            });

            if (!matches.length) {
                resultsEl.innerHTML = '<div class="msr-item msr-empty"><i class="fas fa-search-minus"></i> Không tìm thấy kết quả</div>';
                resultsEl.style.display = 'block';
                return;
            }

            resultsEl.innerHTML = matches.slice(0, 6).map(function (d) {
                var mins = calcWalkMinutes(d.name || '');
                var minsStr = mins > 0 ? mins + ' phút' : '';
                return '<div class="msr-item" data-id="' + escapeHtml(String(d._id || '')) + '">' +
                    '<i class="fas fa-building msr-icon"></i>' +
                    '<div><div class="msr-name">' + escapeHtml(d.name || '') + '</div>' +
                    '<div class="msr-addr">' + (minsStr ? minsStr + ' đi bộ · ' : '') + escapeHtml((d.address || '').slice(0, 50)) + '</div></div>' +
                    '</div>';
            }).join('');
            resultsEl.style.display = 'block';

            resultsEl.querySelectorAll('.msr-item[data-id]').forEach(function (item) {
                item.addEventListener('click', function () {
                    var id = item.getAttribute('data-id');
                    var dorm = _mapDorms.find(function (d) { return String(d._id) === id; });
                    if (!dorm) return;

                    var pos = getDormPos(dorm);
                    if (pos) _leafletMap.setView([pos.lat, pos.lng], 17, { animate: true });

                    var dm = _leafletMarkers.find(function (m) { return String(m.data._id) === id; });
                    if (dm) { setActiveMarker(dm.marker); drawStaticRoute(dorm.name || ''); }

                    openDormPanel(dorm._id, dorm);
                    input.value = dorm.name || '';
                    resultsEl.style.display = 'none';
                });
            });
        });

        document.addEventListener('click', function (e) {
            var sb = document.querySelector('.map-searchbar');
            if (sb && !sb.contains(e.target)) resultsEl.style.display = 'none';
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { resultsEl.style.display = 'none'; input.blur(); }
        });
    }

    /* ═══════════════════════════════════════════════════════
       DORM SIDE PANEL
    ═══════════════════════════════════════════════════════ */
    function bindDormPanelEvents() {
        var closeBtn = document.getElementById('dormPanelClose');
        var backdrop = document.getElementById('dormPanelBackdrop');
        if (closeBtn) closeBtn.addEventListener('click', closeDormPanel);
        if (backdrop) backdrop.addEventListener('click', closeDormPanel);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDormPanel(); });
    }

    function openDormPanel(dormId, dormData) {
        _activeDormId = dormId;

        if (dormData) {
            renderDormPanel(dormData);
        } else {
            var nameEl = document.getElementById('dpName');
            if (nameEl) nameEl.textContent = 'Đang tải...';
            fetch('/api/dormitories/' + dormId)
                .then(function (r) { return r.json(); })
                .then(function (d) { renderDormPanel(d.dormitory || d); })
                .catch(function () {
                    var n = document.getElementById('dpName');
                    if (n) n.textContent = 'Lỗi tải dữ liệu';
                });
        }

        var panel = document.getElementById('dormPanel');
        var backdrop = document.getElementById('dormPanelBackdrop');
        if (panel) panel.classList.add('open');
        if (backdrop) backdrop.classList.add('show');
    }

    function closeDormPanel() {
        var panel = document.getElementById('dormPanel');
        var backdrop = document.getElementById('dormPanelBackdrop');
        if (panel) panel.classList.remove('open');
        if (backdrop) backdrop.classList.remove('show');
        _activeDormId = null;
        clearRoute();
        setActiveMarker(null);
    }

    function renderDormPanel(dorm) {
        if (!dorm) return;

        var minutes = calcWalkMinutes(dorm.name || '');

        /* Cover image */
        var coverImg = document.getElementById('dpCoverImg');
        if (coverImg) {
            var imgSrc = dorm.coverImage || dorm.imageUrl || '';
            if (imgSrc) {
                coverImg.src = imgSrc;
                coverImg.alt = dorm.name || '';
                coverImg.style.display = 'block';
                coverImg.onerror = function () { coverImg.style.display = 'none'; };
            } else {
                coverImg.style.display = 'none';
            }
        }

        /* Name */
        var nameEl = document.getElementById('dpName');
        var rawName = String(dorm.name || 'Ký túc xá');
        var displayName = rawName.toLowerCase().includes('bách khoa') ? rawName : rawName + ' - Bách Khoa';
        if (nameEl) nameEl.textContent = displayName;

        /* Subtitle */
        var subEl = document.getElementById('dpSubtitle');
        if (subEl) {
            subEl.textContent = minutes > 0
                ? minutes + ' phút đi bộ đến HUST'
                : 'Ký túc xá Đại học Bách Khoa Hà Nội';
        }

        /* Cover badges */
        var badgesEl = document.getElementById('dpCoverBadges');
        if (badgesEl) {
            badgesEl.innerHTML = minutes > 0
                ? '<span class="dp-cover-badge">~' + minutes + ' phút đi bộ</span>'
                : '';
        }

        /* Phone */
        var phone = (dorm.contact && dorm.contact.phone) ? String(dorm.contact.phone) : '';
        var contactEl = document.getElementById('dpContact');
        var phoneEl = document.getElementById('dpPhone');
        if (contactEl && phoneEl) {
            if (phone) {
                phoneEl.textContent = phone;
                contactEl.style.display = 'flex';
            } else {
                contactEl.style.display = 'none';
            }
        }

        /* Amenities — per-dorm curated list, no checkmarks */
        var amenities = getAmenitiesForDorm(dorm);
        var amenEl = document.getElementById('dpAmenities');
        if (amenEl) {
            amenEl.innerHTML = amenities.map(function (a) {
                return '<span class="dp-amen-tag">' + escapeHtml(String(a || '')) + '</span>';
            }).join('');
        }

        /* Reviews */
        var reviews = getReviewsForDorm(dorm);
        var reviewsEl = document.getElementById('dpReviews');
        if (reviewsEl) {
            if (reviews.length) {
                reviewsEl.innerHTML = reviews.map(function (r) {
                    var stars = '';
                    for (var i = 1; i <= 5; i++) {
                        stars += '<span class="dp-star' + (i <= r.rating ? ' dp-star--on' : '') + '">★</span>';
                    }
                    var color = avatarColor(r.name);
                    return '<div class="dp-review-item">' +
                        '<div class="dp-review-avatar" style="background:' + color + '">' + escapeHtml(r.avatar) + '</div>' +
                        '<div class="dp-review-body">' +
                            '<div class="dp-review-top">' +
                                '<div class="dp-review-meta">' +
                                    '<div class="dp-review-name">' + escapeHtml(r.name) + '</div>' +
                                    (r.year ? '<div class="dp-review-year">' + escapeHtml(r.year) + '</div>' : '') +
                                '</div>' +
                                '<div class="dp-review-stars">' + stars + '</div>' +
                            '</div>' +
                            '<p class="dp-review-text">' + escapeHtml(r.text) + '</p>' +
                        '</div>' +
                    '</div>';
                }).join('');
            } else {
                reviewsEl.innerHTML = '<p class="dp-no-review">Chưa có đánh giá</p>';
            }
        }

        /* "Xem phòng" button — public, no auth required */
        var viewBtn = document.getElementById('dpBtnView');
        if (viewBtn && dorm._id) viewBtn.href = '/dormitory/' + dorm._id;

        /* "Đăng ký phòng" button — always /login (page is for non-auth users) */
        var regBtn = document.getElementById('dpBtnRegister');
        if (regBtn) regBtn.href = '/login';
    }

    /* ═══════════════════════════════════════════════════════
       3D VIEWER (hero section)
    ═══════════════════════════════════════════════════════ */
    function setupViewer() {
        var hero = document.getElementById('hero');
        var openBtn = document.getElementById('open3DViewer');
        var closeBtn = document.getElementById('closeViewer');
        var mount = document.getElementById('three-viewer');
        var roomSwitch = document.getElementById('roomSwitch');
        var viewerReset = document.getElementById('viewerReset');
        var viewerFocus = document.getElementById('viewerFocus');
        var roomForward = document.getElementById('roomForward');
        var roomBackward = document.getElementById('roomBackward');
        var roomLeft = document.getElementById('roomLeft');
        var roomRight = document.getElementById('roomRight');
        var sceneIndicator = document.getElementById('sceneIndicator');

        if (!hero || !openBtn || !mount) return;

        var sceneGraph = [
            { id: 'MAIN',  name: 'Trung tâm',  image: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773732655/main_autvkg.png',  neighbors: { left: 'LEFT', right: 'RIGHT', forward: 'CLOSE', back: null } },
            { id: 'LEFT',  name: 'Góc trái',   image: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773732656/left_vqkrse.png',  neighbors: { left: null, right: 'MAIN', forward: null, back: null } },
            { id: 'RIGHT', name: 'Góc phải',   image: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773732655/right_kglglh.png', neighbors: { left: 'MAIN', right: null, forward: null, back: null } },
            { id: 'CLOSE', name: 'Phía trước', image: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773732654/close_lopycx.png', neighbors: { left: null, right: null, forward: null, back: 'MAIN' } }
        ];
        var sceneById = sceneGraph.reduce(function (acc, item, i) {
            acc[item.id] = { data: item, index: i }; return acc;
        }, {});

        var threeSources = [
            'https://unpkg.com/three@0.160.0/build/three.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/r160/three.min.js'
        ];

        var renderer = null, scene = null, camera = null, clock = null, animationId = null;
        var dragActive = false, lastX = 0, lastY = 0, yaw = Math.PI, pitch = 0, fov = 74;
        var shell = null, starField = null, activeSceneId = 'MAIN', isSwitching = false;
        var textureCache = {}, texturesReady = false;

        function loadScript(src) {
            return new Promise(function (resolve, reject) {
                var s = document.createElement('script'); s.src = src; s.async = true;
                s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
            });
        }

        async function ensureThreeLoaded() {
            if (window.THREE) return;
            for (var i = 0; i < threeSources.length; i++) {
                try { await loadScript(threeSources[i]); if (window.THREE) return; } catch (e) {}
            }
            throw new Error('THREE_NOT_LOADED');
        }

        function updateSceneIndicator(id) {
            var node = sceneById[id]; if (!node) return;
            if (roomSwitch) roomSwitch.value = String(node.index);
            if (sceneIndicator) sceneIndicator.textContent = 'Vị trí: ' + node.data.name;
        }

        function updateDirectionButtons(id) {
            var node = sceneById[id]; if (!node) return;
            var nb = node.data.neighbors;
            if (roomLeft)     roomLeft.disabled     = !nb.left    || isSwitching;
            if (roomRight)    roomRight.disabled    = !nb.right   || isSwitching;
            if (roomForward)  roomForward.disabled  = !nb.forward || isSwitching;
            if (roomBackward) roomBackward.disabled = !nb.back    || isSwitching;
        }

        function preloadTextures() {
            if (texturesReady) return Promise.resolve();
            var loader = new THREE.TextureLoader();
            return Promise.all(sceneGraph.map(function (sn) {
                return new Promise(function (resolve, reject) {
                    loader.load(sn.image, function (t) {
                        t.colorSpace = THREE.SRGBColorSpace; t.minFilter = t.magFilter = THREE.LinearFilter;
                        textureCache[sn.id] = t; resolve();
                    }, undefined, reject);
                });
            })).then(function () { texturesReady = true; });
        }

        function resetView() {
            yaw = Math.PI; pitch = 0; fov = 74;
            if (camera) { camera.position.set(0, 0, 0); camera.fov = fov; camera.updateProjectionMatrix(); }
        }

        function initScene() {
            activeSceneId = 'MAIN'; resetView();
            if (shell && textureCache.MAIN) { shell.material.map = textureCache.MAIN; shell.material.needsUpdate = true; }
            updateSceneIndicator(activeSceneId); updateDirectionButtons(activeSceneId);
        }

        function switchScene(sceneId) {
            if (isSwitching || !shell || sceneId === activeSceneId || !textureCache[sceneId]) return Promise.resolve(false);
            isSwitching = true; updateDirectionButtons(activeSceneId);
            return new Promise(function (resolve) {
                mount.style.transition = 'opacity 170ms ease'; mount.style.opacity = '0.22';
                setTimeout(function () {
                    shell.material.map = textureCache[sceneId]; shell.material.needsUpdate = true;
                    activeSceneId = sceneId; updateSceneIndicator(activeSceneId); mount.style.opacity = '1';
                    setTimeout(function () { isSwitching = false; updateDirectionButtons(activeSceneId); resolve(true); }, 190);
                }, 170);
            });
        }

        function moveByDirection(dir) {
            var node = sceneById[activeSceneId]; if (!node) return;
            var next = node.data.neighbors[dir]; if (next) switchScene(next);
        }

        function handleMovement(e) {
            var k = e.key.toLowerCase();
            if (['w', 'a', 's', 'd'].includes(k)) {
                e.preventDefault();
                moveByDirection({ w: 'forward', a: 'left', s: 'back', d: 'right' }[k]);
            }
        }

        function animate() {
            animationId = requestAnimationFrame(animate);
            var delta = Math.min(clock.getDelta(), 0.03);
            var t = new THREE.Vector3(
                Math.cos(pitch) * Math.sin(yaw),
                Math.sin(pitch) + Math.sin(performance.now() * 0.0012) * 0.003,
                Math.cos(pitch) * Math.cos(yaw)
            );
            camera.lookAt(t);
            if (starField) starField.rotation.y += delta * 0.006;
            renderer.render(scene, camera);
        }

        function initViewer() {
            if (renderer) return;
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(fov, mount.clientWidth / mount.clientHeight, 0.1, 2400);
            camera.position.set(0, 0, 0); clock = new THREE.Clock();
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(mount.clientWidth, mount.clientHeight);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            mount.appendChild(renderer.domElement);
            var geo = new THREE.SphereGeometry(500, 72, 72); geo.scale(-1, 1, 1);
            shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: textureCache.MAIN }));
            scene.add(shell);
            var sg = new THREE.BufferGeometry(); var stars = [];
            for (var i = 0; i < 160; i++) stars.push((Math.random() - 0.5) * 1600, (Math.random() - 0.4) * 900, (Math.random() - 0.5) * 1600);
            sg.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
            starField = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xf4deca, size: 1.5, transparent: true, opacity: 0.2 }));
            scene.add(starField);
            mount.addEventListener('mousedown', function (e) { dragActive = true; lastX = e.clientX; lastY = e.clientY; });
            mount.addEventListener('mousemove', function (e) {
                if (!dragActive || document.pointerLockElement === mount) return;
                yaw -= (e.clientX - lastX) * 0.0022; pitch -= (e.clientY - lastY) * 0.0022;
                pitch = Math.max(-1.45, Math.min(1.45, pitch)); lastX = e.clientX; lastY = e.clientY;
            });
            mount.addEventListener('mouseup', function () { dragActive = false; });
            mount.addEventListener('mouseleave', function () { dragActive = false; });
            mount.addEventListener('wheel', function (e) {
                e.preventDefault(); fov = Math.max(42, Math.min(95, fov + e.deltaY * 0.02));
                camera.fov = fov; camera.updateProjectionMatrix();
            }, { passive: false });
            mount.addEventListener('click', function () { if (mount.requestPointerLock) mount.requestPointerLock(); });
            document.addEventListener('mousemove', function (e) {
                if (document.pointerLockElement !== mount) return;
                yaw -= e.movementX * 0.0019; pitch -= e.movementY * 0.0017;
                pitch = Math.max(-1.45, Math.min(1.45, pitch));
            });
            document.addEventListener('pointerlockchange', function () {
                if (viewerFocus) viewerFocus.textContent = document.pointerLockElement === mount ? 'Đang bắt chuột' : 'Bắt chuột';
            });
            document.addEventListener('keydown', handleMovement);
            window.addEventListener('resize', function () {
                if (!renderer || !camera) return;
                camera.aspect = mount.clientWidth / mount.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(mount.clientWidth, mount.clientHeight);
            });
            if (roomSwitch) {
                roomSwitch.innerHTML = sceneGraph.map(function (sn, i) { return '<option value="' + i + '">' + sn.name + '</option>'; }).join('');
                roomSwitch.addEventListener('change', function (e) {
                    var idx = Number(e.target.value);
                    if (!isNaN(idx) && sceneGraph[idx]) switchScene(sceneGraph[idx].id);
                });
            }
            if (roomLeft)     roomLeft.addEventListener('click',     function () { moveByDirection('left'); });
            if (roomRight)    roomRight.addEventListener('click',    function () { moveByDirection('right'); });
            if (roomForward)  roomForward.addEventListener('click',  function () { moveByDirection('forward'); });
            if (roomBackward) roomBackward.addEventListener('click', function () { moveByDirection('back'); });
            initScene();
        }

        async function startViewer() {
            try { await ensureThreeLoaded(); await preloadTextures(); initViewer(); initScene(); }
            catch (err) { alert('Không thể mở chế độ xem phòng 3D. Vui lòng thử lại sau.'); return; }
            hero.classList.add('viewer-active');
            if (renderer) {
                camera.aspect = mount.clientWidth / mount.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(mount.clientWidth, mount.clientHeight);
            }
            if (!animationId) animate();
        }

        function stopViewer() {
            hero.classList.remove('viewer-active');
            if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
            if (document.pointerLockElement === mount && document.exitPointerLock) document.exitPointerLock();
        }

        openBtn.addEventListener('click', startViewer);
        if (closeBtn) closeBtn.addEventListener('click', stopViewer);
        if (viewerFocus) viewerFocus.addEventListener('click', function () { if (mount.requestPointerLock) mount.requestPointerLock(); });
        if (viewerReset) viewerReset.addEventListener('click', initScene);
    }

    /* ─────────────────── INIT ─────────────────── */
    function normalizeDormitories(payload) {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload && payload.dormitories)) return payload.dormitories;
        return [];
    }

    function init() {
        setupMenu();
        setupProfileDropdown();

        var roomState = setupRoomCarousel();
        if (roomState.roomGrid) renderLoadingSkeleton(roomState.roomGrid);

        Promise.all([
            fetch('/api/dormitories').then(function (r) { return r.ok ? r.json() : { dormitories: [] }; }).catch(function () { return { dormitories: [] }; }),
            fetch('/api/map-data').then(function (r) { return r.ok ? r.json() : { dormitories: [] }; }).catch(function () { return { dormitories: [] }; })
        ]).then(function (results) {
            var dormitories = normalizeDormitories(results[0]);
            var mapDormitories = normalizeDormitories(results[1]);
            var sourceDorms = mapDormitories.length ? mapDormitories : dormitories;

            if (roomState.roomGrid) renderDormCards(roomState.roomGrid, dormitories);

            var mapSection = document.getElementById('map-section');
            if (mapSection && window.IntersectionObserver) {
                var obs = new IntersectionObserver(function (entries) {
                    if (entries[0].isIntersecting) { obs.disconnect(); setupMap(sourceDorms); }
                }, { rootMargin: '200px' });
                obs.observe(mapSection);
            } else {
                setupMap(sourceDorms);
            }
        });

        setupViewer();
        setupCesium3D();
    }

    /* ═══════════════════════════════════════════════
       CESIUM 3D OVERLAY — lazy-load from CDN
       ═══════════════════════════════════════════════ */
    var _cesiumLoaded = false;
    var _cesiumViewer = null;

    function setupCesium3D() {
        var openBtn = document.getElementById('open3DExplore');
        var overlay  = document.getElementById('cesiumOverlay');
        var closeBtn = document.getElementById('cesiumClose');
        if (!openBtn || !overlay || !closeBtn) return;

        openBtn.addEventListener('click', function () { openCesiumOverlay(); });
        closeBtn.addEventListener('click', function () { closeCesiumOverlay(); });

        overlay.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeCesiumOverlay();
        });
    }

    function openCesiumOverlay() {
        var overlay = document.getElementById('cesiumOverlay');
        if (!overlay) return;
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        if (!_cesiumLoaded) {
            loadCesiumCDN(function () {
                _cesiumLoaded = true;
                initCesiumViewer();
            });
        } else if (!_cesiumViewer) {
            initCesiumViewer();
        }
    }

    function closeCesiumOverlay() {
        var overlay = document.getElementById('cesiumOverlay');
        if (!overlay) return;
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function loadCesiumCDN(cb) {
        if (window.Cesium) { cb(); return; }

        window.CESIUM_BASE_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.120/Build/Cesium/';

        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.120/Build/Cesium/Widgets/widgets.css';
        document.head.appendChild(link);

        var script = document.createElement('script');
        script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.120/Build/Cesium/Cesium.js';
        script.onload = cb;
        script.onerror = function () {
            var loading = document.getElementById('cesiumLoading');
            if (loading) loading.innerHTML = '<div class="cesium-loading-inner"><p style="color:#E74C5B">Không thể tải bản đồ 3D.<br>Vui lòng kiểm tra kết nối mạng.</p></div>';
        };
        document.head.appendChild(script);
    }

    /* ── Cesium marker canvas generators ── */
    function _createMarkerCanvas(letter, bgColor, size) {
        var canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size + 14;
        var ctx = canvas.getContext('2d');
        var r = size / 2;
        var cx = r, cy = r;

        /* Drop shadow */
        ctx.shadowColor = 'rgba(0,0,0,0.42)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;

        /* Circle */
        ctx.beginPath();
        ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
        ctx.fillStyle = bgColor;
        ctx.fill();

        /* White border */
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        /* Triangle pointer */
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy + r - 4);
        ctx.lineTo(cx + 7, cy + r - 4);
        ctx.lineTo(cx, cy + r + 12);
        ctx.fillStyle = bgColor;
        ctx.fill();

        /* Letter */
        ctx.font = 'bold ' + Math.round(r * 0.68) + 'px Inter, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, cx, cy);

        return canvas.toDataURL();
    }

    function initCesiumViewer() {
        var container = document.getElementById('cesiumContainer');
        var loading   = document.getElementById('cesiumLoading');
        if (!container || !window.Cesium) return;

        try {
            _cesiumViewer = new Cesium.Viewer('cesiumContainer', {
                baseLayer: false,
                terrainProvider: new Cesium.EllipsoidTerrainProvider(),
                baseLayerPicker: false,
                geocoder: false,
                homeButton: false,
                sceneModePicker: false,
                navigationHelpButton: false,
                animation: false,
                timeline: false,
                fullscreenButton: false,
                infoBox: false,
                selectionIndicator: false,
                creditContainer: document.createElement('div')
            });

            /* Esri World Imagery — satellite photorealistic, free, no API key */
            _cesiumViewer.imageryLayers.add(
                new Cesium.ImageryLayer(
                    new Cesium.UrlTemplateImageryProvider({
                        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                        credit: 'Esri, DigitalGlobe, GeoEye, i-cubed, USDA, USGS, AEX, Getmapping, IGN',
                        maximumLevel: 19
                    })
                )
            );

            /* Enable scene depth testing for realistic rendering */
            _cesiumViewer.scene.globe.depthTestAgainstTerrain = false;

            /* Tilted camera fly-in to HUST (photorealistic angle) */
            _cesiumViewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(HUST_LNG, HUST_LAT, 2200),
                orientation: {
                    heading: Cesium.Math.toRadians(20),
                    pitch: Cesium.Math.toRadians(-65),
                    roll: 0
                },
                duration: 2.8
            });

            /* HUST marker */
            _cesiumViewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(HUST_LNG, HUST_LAT),
                billboard: {
                    image: _createMarkerCanvas('H', '#2563EB', 40),
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scale: 1.0
                },
                label: {
                    text: 'Đại học Bách Khoa HN',
                    font: '700 12px Inter, sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    outlineColor: Cesium.Color.fromCssColorString('#2563EB'),
                    outlineWidth: 3,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -60),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scale: 1.0
                }
            });

            /* KTX entities with branded markers */
            _mapDorms.forEach(function (d) {
                var pos = getDormPos(d);
                if (!pos) return;
                var lat = pos.lat, lng = pos.lng;

                var code = getDormCode(d.name || '') || 'K';
                var entity = _cesiumViewer.entities.add({
                    position: Cesium.Cartesian3.fromDegrees(lng, lat),
                    billboard: {
                        image: _createMarkerCanvas(code.charAt(0), '#E74C5B', 44),
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        scale: 1.0
                    },
                    label: {
                        text: d.name || 'KTX',
                        font: '700 12px Inter, sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        outlineColor: Cesium.Color.fromCssColorString('#c0392b'),
                        outlineWidth: 3,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -64),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        scale: 0.95
                    }
                });
                entity._dormData = d;
                entity._dormLng = lng;
                entity._dormLat = lat;
            });

            /* Click → fly to KTX + show info card (overlay stays open) */
            var handler = new Cesium.ScreenSpaceEventHandler(_cesiumViewer.scene.canvas);
            handler.setInputAction(function (movement) {
                var picked = _cesiumViewer.scene.pick(movement.position);
                if (Cesium.defined(picked) && picked.id && picked.id._dormData) {
                    var ent = picked.id;
                    var dData = ent._dormData;
                    var dLng = ent._dormLng || HUST_LNG;
                    var dLat = ent._dormLat || HUST_LAT;

                    /* Fly to the dorm with dramatic angle */
                    _cesiumViewer.camera.flyTo({
                        destination: Cesium.Cartesian3.fromDegrees(dLng, dLat, 700),
                        orientation: {
                            heading: Cesium.Math.toRadians(Math.random() * 360),
                            pitch: Cesium.Math.toRadians(-62),
                            roll: 0
                        },
                        duration: 2.0
                    });

                    showCesiumInfoCard(dData);
                }
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

            /* Hide loading */
            if (loading) {
                loading.classList.add('hidden');
                setTimeout(function () { loading.style.display = 'none'; }, 400);
            }

        } catch (err) {
            if (loading) loading.innerHTML = '<div class="cesium-loading-inner"><p style="color:#E74C5B">Lỗi khởi tạo bản đồ 3D.</p></div>';
        }
    }

    function showCesiumInfoCard(dorm) {
        var card = document.getElementById('cesiumInfoCard');
        if (!card) return;

        var minutes = calcWalkMinutes(dorm.name || '');
        var nameEl  = document.getElementById('cesiumInfoName');
        var metaEl  = document.getElementById('cesiumInfoMeta');
        var imgEl   = document.getElementById('cesiumInfoImg');
        var btnDet  = document.getElementById('cesiumInfoBtnDetail');
        var btnReg  = document.getElementById('cesiumInfoBtnRegister');
        var closeBtn = document.getElementById('cesiumInfoClose');

        if (nameEl) nameEl.textContent = dorm.name || 'Ký túc xá';
        if (metaEl) {
            var mins = minutes;
            metaEl.textContent = mins > 0
                ? mins + ' phút đi bộ · Đại học Bách Khoa Hà Nội'
                : 'Đại học Bách Khoa Hà Nội';
        }
        if (imgEl) {
            var imgSrc = dorm.coverImage || dorm.imageUrl || '';
            if (imgSrc) { imgEl.src = imgSrc; imgEl.style.display = 'block'; }
            else imgEl.style.display = 'none';
        }
        if (btnDet && dorm._id) btnDet.href = '/dormitory/' + dorm._id;
        if (btnReg) btnReg.href = '/login';

        card.style.display = 'block';

        if (closeBtn) {
            closeBtn.onclick = function () { card.style.display = 'none'; };
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
