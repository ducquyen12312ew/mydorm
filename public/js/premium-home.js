(function () {
    /* Suppress MapLibre fill-extrusion null-height warning (OSM buildings without height data) */
    var _origWarn = console.warn;
    console.warn = function () {
        var m = arguments[0];
        if (typeof m === 'string' && m.indexOf('Expected value to be of type number') !== -1) return;
        _origWarn.apply(console, arguments);
    };

    /* ── State ── */
    var _map = null;
    var _mapDorms = [];
    var _dormMarkers = [];   // { marker, data, el }
    var _activeDormId = null;
    var _activeMarkerEl = null;
    var _userMarker = null;
    var _satOn = false;
    var _routeAnimId = null;
    var _fallbackIdx = 0;

    /* ── Map constants ── */
    var HUST_LNG = 105.843220;
    var HUST_LAT = 21.007119;

    /* Static KTX positions relative to HUST (~70m/min walk)
       1°lat≈111km | 1°lng≈103.6km at lat 21° */
    var DORM_MAP_CONFIG = {
        'A1': { lat: 21.009347, lng: 105.840832, minutes: 5  },   /* NW */
        'B2': { lat: 21.003999, lng: 105.846564, minutes: 7  },   /* SE */
        'C3': { lat: 21.003553, lng: 105.839398, minutes: 8  },   /* SW */
        'D4': { lat: 21.011132, lng: 105.847520, minutes: 9  },   /* NE */
        'E5': { lat: 21.013425, lng: 105.843220, minutes: 10 },   /* N  */
        'F6': { lat: 21.001443, lng: 105.843220, minutes: 9  }    /* S  */
    };

    var FALLBACK_POS = [
        { lat: 21.008500, lng: 105.841800, minutes: 6 },
        { lat: 21.005200, lng: 105.845800, minutes: 8 },
        { lat: 21.010100, lng: 105.844200, minutes: 7 }
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
        var dist = function () { return window.innerWidth < 576 ? 300 : window.innerWidth < 920 ? 340 : 404; };
        if (roomPrev) roomPrev.addEventListener('click', function () { roomGrid.scrollBy({ left: -dist(), behavior: 'smooth' }); });
        if (roomNext) roomNext.addEventListener('click', function () { roomGrid.scrollBy({ left: dist(), behavior: 'smooth' }); });
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

    /* Extract code like 'A1', 'B2' from dorm name */
    function getDormCode(name) {
        if (!name) return null;
        var m = (String(name)).toUpperCase().match(/([A-Z]\d+)/);
        return m ? m[1] : null;
    }

    /* Get static config for a dorm */
    function getDormCfg(dorm) {
        var code = getDormCode(dorm.name || '');
        return code ? (DORM_MAP_CONFIG[code] || null) : null;
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
    function createDormMarkerEl(dorm, cfg) {
        var minutes = cfg ? cfg.minutes : 0;
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
    function setActiveMarker(el) {
        _dormMarkers.forEach(function (m) {
            m.el.classList.remove('active', 'dimmed');
        });
        if (el) {
            el.classList.add('active');
            _dormMarkers.forEach(function (m) {
                if (m.el !== el) m.el.classList.add('dimmed');
            });
        }
        _activeMarkerEl = el || null;
    }

    /* ═══════════════════════════════════════════════════════
       ROUTE — real walking route via OSRM (openstreetmap routing)
    ═══════════════════════════════════════════════════════ */
    function fetchAndDrawRoute(fromLng, fromLat) {
        clearRoute();
        if (!_map) return;

        /* Show loading in panel subtitle while fetching */
        var subEl = document.getElementById('dpSubtitle');
        if (subEl && subEl.textContent === '') subEl.textContent = 'Đang tính đường đi bộ...';

        var url = 'https://router.project-osrm.org/route/v1/foot/' +
                  fromLng + ',' + fromLat + ';' + HUST_LNG + ',' + HUST_LAT +
                  '?overview=full&geometries=geojson';

        fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
                    _drawRouteFallback(fromLng, fromLat);
                    return;
                }
                var route = data.routes[0];
                var coords = route.geometry.coordinates; /* [[lng,lat], ...] */
                var distM = Math.round(route.distance);
                var timeMin = Math.ceil(route.duration / 60);

                _animateRouteCoords(coords);

                /* Update sidebar subtitle + badges */
                var distStr = distM < 1000 ? distM + 'm' : (distM / 1000).toFixed(1) + 'km';
                if (subEl) subEl.textContent = timeMin + ' phút đi bộ đến HUST';
                var badgesEl = document.getElementById('dpCoverBadges');
                if (badgesEl) {
                    badgesEl.innerHTML =
                        '<span class="dp-cover-badge">' + timeMin + ' phút đi bộ</span>' +
                        '<span class="dp-cover-badge">' + distStr + ' từ HUST</span>';
                }
            })
            .catch(function () { _drawRouteFallback(fromLng, fromLat); });
    }

    function _drawRouteFallback(fromLng, fromLat) {
        /* Bezier curve fallback when OSRM is unavailable */
        var STEPS = 80;
        var coords = [];
        var midLng = (fromLng + HUST_LNG) / 2 + (fromLat - HUST_LAT) * 0.10;
        var midLat = (fromLat + HUST_LAT) / 2 + (HUST_LNG - fromLng) * 0.10;
        for (var i = 0; i <= STEPS; i++) {
            var t = i / STEPS; var u = 1 - t;
            coords.push([
                u * u * fromLng + 2 * u * t * midLng + t * t * HUST_LNG,
                u * u * fromLat + 2 * u * t * midLat + t * t * HUST_LAT
            ]);
        }
        _animateRouteCoords(coords);
    }

    function _animateRouteCoords(coords) {
        if (!_map) return;
        var STEP_CHUNK = 3;
        _map.addSource('dorm-route', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
        });
        _map.addLayer({
            id: 'dorm-route-glow', type: 'line', source: 'dorm-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#E74C5B', 'line-width': 10, 'line-opacity': 0.12, 'line-blur': 6 }
        });
        _map.addLayer({
            id: 'dorm-route-line', type: 'line', source: 'dorm-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#E74C5B', 'line-width': 3, 'line-opacity': 0.92 }
        });
        var step = 0;
        var src = _map.getSource('dorm-route');
        function animate() {
            if (!src || step >= coords.length) { _routeAnimId = null; return; }
            step = Math.min(step + STEP_CHUNK, coords.length);
            src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords.slice(0, step) } });
            _routeAnimId = requestAnimationFrame(animate);
        }
        _routeAnimId = requestAnimationFrame(animate);
    }

    function clearRoute() {
        if (_routeAnimId) { cancelAnimationFrame(_routeAnimId); _routeAnimId = null; }
        if (!_map) return;
        try {
            if (_map.getLayer('dorm-route-line')) _map.removeLayer('dorm-route-line');
            if (_map.getLayer('dorm-route-glow')) _map.removeLayer('dorm-route-glow');
            if (_map.getSource('dorm-route')) _map.removeSource('dorm-route');
        } catch (e) { /* style may already be gone */ }
    }

    /* ═══════════════════════════════════════════════════════
       MAP SETUP
    ═══════════════════════════════════════════════════════ */
    function setupMap(dormitories) {
        var mapEl = document.getElementById('dormitory-map');
        if (!mapEl || !window.maplibregl) return;

        _mapDorms = dormitories;

        /* Pre-fetch style and strip fill-extrusion layers so the MapLibre worker
           never receives them — eliminates null-height console warnings from OSM
           buildings that lack height data */
        fetch('https://tiles.openfreemap.org/styles/liberty')
            .then(function (r) { return r.json(); })
            .then(function (style) {
                style.layers = (style.layers || []).filter(function (l) { return l.type !== 'fill-extrusion'; });
                _createMap(style, dormitories);
            })
            .catch(function () {
                _createMap('https://tiles.openfreemap.org/styles/liberty', dormitories);
            });
    }

    function _createMap(style, dormitories) {
        _map = new maplibregl.Map({
            container: 'dormitory-map',
            style: style,
            center: [HUST_LNG, HUST_LAT],
            zoom: 14,
            attributionControl: false
        });
        /* Suppress "Image X could not be loaded" warnings for unused sprite icons */
        _map.on('styleimagemissing', function (e) {
            if (!_map.hasImage(e.id)) {
                _map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
            }
        });

        _map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        var _mapReadyCalled = false;
        function onMapReady() {
            if (_mapReadyCalled) return;
            _mapReadyCalled = true;
            addHustMarker();
            addDormsToMap(dormitories);
            setupMapControls();
            setupMapSearch();
            bindDormPanelEvents();
        }
        _map.on('load', onMapReady);
        setTimeout(function () { onMapReady(); }, 5000);
    }

    /* HUST university marker */
    function addHustMarker() {
        var el = document.createElement('div');
        el.className = 'map-hust-pin';
        el.innerHTML = '<img src="/image/university.png" width="36" height="36" alt="HUST" onerror="this.style.display=\'none\'">';
        el.title = 'Đại học Bách Khoa Hà Nội';
        new maplibregl.Marker({ element: el })
            .setLngLat([HUST_LNG, HUST_LAT])
            .setPopup(new maplibregl.Popup({ offset: 26, maxWidth: '280px' }).setHTML(
                '<div class="mlgl-popup"><strong>Đại học Bách Khoa Hà Nội</strong>' +
                '<p>Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội</p>' +
                '<a href="https://hust.edu.vn" target="_blank" rel="noopener">hust.edu.vn ↗</a></div>'
            ))
            .addTo(_map);
    }

    /* Dormitory markers with new pill design */
    function addDormsToMap(dorms) {
        _fallbackIdx = 0;

        dorms.forEach(function (dorm) {
            var cfg = getDormCfg(dorm);
            var lat, lng;

            if (cfg) {
                lat = cfg.lat; lng = cfg.lng;
            } else {
                if (dorm.location && Array.isArray(dorm.location.coordinates) && dorm.location.coordinates.length >= 2) {
                    lng = dorm.location.coordinates[0]; lat = dorm.location.coordinates[1];
                } else {
                    lat = dorm.latitude; lng = dorm.longitude;
                }
                if (typeof lat !== 'number' || !isFinite(lat) || typeof lng !== 'number' || !isFinite(lng)) {
                    var fb = FALLBACK_POS[_fallbackIdx % FALLBACK_POS.length];
                    lat = fb.lat; lng = fb.lng; _fallbackIdx++;
                }
            }

            var el = createDormMarkerEl(dorm, cfg);
            /* Capture loop variables */
            var dormLat = lat, dormLng = lng;

            el.addEventListener('click', function (e) {
                e.stopPropagation();
                setActiveMarker(el);
                fetchAndDrawRoute(dormLng, dormLat);
                openDormPanel(dorm._id, dorm);
                _map.flyTo({ center: [dormLng, dormLat], zoom: 15.5, speed: 1.0 });
            });

            var marker = new maplibregl.Marker({ element: el })
                .setLngLat([lng, lat])
                .addTo(_map);

            _dormMarkers.push({ marker: marker, data: dorm, el: el });
        });

        /* Fit bounds: include HUST + all dorm positions */
        if (_dormMarkers.length > 0) {
            var lngs = _dormMarkers.map(function (m) { return m.marker.getLngLat().lng; }).concat([HUST_LNG]);
            var lats = _dormMarkers.map(function (m) { return m.marker.getLngLat().lat; }).concat([HUST_LAT]);
            _map.fitBounds(
                [[Math.min.apply(null, lngs), Math.min.apply(null, lats)],
                 [Math.max.apply(null, lngs), Math.max.apply(null, lats)]],
                { padding: { top: 80, bottom: 80, left: 80, right: 80 }, maxZoom: 14.5 }
            );
        }
    }

    function clearMarkers() {
        _dormMarkers.forEach(function (m) { m.marker.remove(); });
        _dormMarkers = [];
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
                        _map.flyTo({ center: [lng, lat], zoom: 16, speed: 1.1 });
                        if (_userMarker) _userMarker.remove();
                        var uel = document.createElement('div');
                        uel.className = 'map-user-pin';
                        _userMarker = new maplibregl.Marker({ element: uel })
                            .setLngLat([lng, lat])
                            .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML('<strong>Vị trí của bạn</strong>'))
                            .addTo(_map);
                    },
                    function () { locateBtn.classList.remove('mc-btn--loading'); }
                );
            });
        }

        var zoomIn = document.getElementById('mapZoomIn');
        if (zoomIn) zoomIn.addEventListener('click', function () { _map && _map.zoomIn(); });
        var zoomOut = document.getElementById('mapZoomOut');
        if (zoomOut) zoomOut.addEventListener('click', function () { _map && _map.zoomOut(); });

        var resetBtn = document.getElementById('mapResetView');
        if (resetBtn) resetBtn.addEventListener('click', function () {
            if (!_map) return;
            closeDormPanel();
            _map.flyTo({ center: [HUST_LNG, HUST_LAT], zoom: 14, speed: 1.0 });
        });

        var satBtn = document.getElementById('mapSatellite');
        if (satBtn) {
            satBtn.addEventListener('click', function () {
                if (!_map) return;
                _satOn = !_satOn;
                clearRoute();
                var nextStyleUrl = _satOn
                    ? 'https://tiles.openfreemap.org/styles/positron'
                    : 'https://tiles.openfreemap.org/styles/liberty';
                satBtn.classList.toggle('mc-btn--active', _satOn);
                satBtn.title = _satOn ? 'Chế độ đường phố' : 'Chế độ nhạt';
                fetch(nextStyleUrl)
                    .then(function (r) { return r.json(); })
                    .then(function (style) {
                        style.layers = (style.layers || []).filter(function (l) { return l.type !== 'fill-extrusion'; });
                        _map.setStyle(style);
                    })
                    .catch(function () { _map.setStyle(nextStyleUrl); });
                _map.once('styledata', function () {
                    clearMarkers();
                    addHustMarker();
                    addDormsToMap(_mapDorms);
                });
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
                var cfg = getDormCfg(d);
                var mins = cfg ? cfg.minutes + ' phút' : '';
                return '<div class="msr-item" data-id="' + escapeHtml(String(d._id || '')) + '">' +
                    '<i class="fas fa-building msr-icon"></i>' +
                    '<div><div class="msr-name">' + escapeHtml(d.name || '') + '</div>' +
                    '<div class="msr-addr">' + (mins ? mins + ' đi bộ · ' : '') + escapeHtml((d.address || '').slice(0, 50)) + '</div></div>' +
                    '</div>';
            }).join('');
            resultsEl.style.display = 'block';

            resultsEl.querySelectorAll('.msr-item[data-id]').forEach(function (item) {
                item.addEventListener('click', function () {
                    var id = item.getAttribute('data-id');
                    var dorm = _mapDorms.find(function (d) { return String(d._id) === id; });
                    if (!dorm) return;

                    var cfg = getDormCfg(dorm);
                    var lat, lng;
                    if (cfg) { lat = cfg.lat; lng = cfg.lng; }
                    else if (dorm.location && dorm.location.coordinates && dorm.location.coordinates.length >= 2) {
                        lng = dorm.location.coordinates[0]; lat = dorm.location.coordinates[1];
                    } else { lat = dorm.latitude; lng = dorm.longitude; }

                    if (typeof lat === 'number' && isFinite(lat)) {
                        _map.flyTo({ center: [lng, lat], zoom: 15.5, speed: 1.1 });
                    }

                    /* Activate corresponding marker */
                    var dm = _dormMarkers.find(function (m) { return String(m.data._id) === id; });
                    if (dm && typeof lat === 'number' && isFinite(lat)) {
                        setActiveMarker(dm.el);
                        fetchAndDrawRoute(lng, lat);
                    }

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

        var cfg = getDormCfg(dorm);
        var minutes = cfg ? cfg.minutes : 0;

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

        /* Subtitle: reset to show static time; OSRM will update it after route fetch */
        var subEl = document.getElementById('dpSubtitle');
        if (subEl) {
            subEl.textContent = minutes > 0
                ? minutes + ' phút đi bộ đến HUST'
                : 'Ký túc xá Đại học Bách Khoa Hà Nội';
        }

        /* Cover badges: reset — will be updated by fetchAndDrawRoute */
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
                var cfg = getDormCfg(d);
                var lat, lng;
                if (cfg) { lat = cfg.lat; lng = cfg.lng; }
                else if (d.location && Array.isArray(d.location.coordinates) && d.location.coordinates.length >= 2) {
                    lng = d.location.coordinates[0]; lat = d.location.coordinates[1];
                } else { lat = d.latitude; lng = d.longitude; }
                if (!lat || !lng || !isFinite(lat) || !isFinite(lng)) return;

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

        var cfg = getDormCfg(dorm);
        var nameEl  = document.getElementById('cesiumInfoName');
        var metaEl  = document.getElementById('cesiumInfoMeta');
        var imgEl   = document.getElementById('cesiumInfoImg');
        var btnDet  = document.getElementById('cesiumInfoBtnDetail');
        var btnReg  = document.getElementById('cesiumInfoBtnRegister');
        var closeBtn = document.getElementById('cesiumInfoClose');

        if (nameEl) nameEl.textContent = dorm.name || 'Ký túc xá';
        if (metaEl) {
            var mins = cfg ? cfg.minutes : 0;
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
