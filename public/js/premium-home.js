(function () {
    function setupMenu() {
        const menuToggle = document.getElementById('menuToggle');
        const navContainer = document.getElementById('navContainer');
        if (!menuToggle || !navContainer) return;
        if (navContainer.dataset.navReady === 'true') return;

        menuToggle.addEventListener('click', function (event) {
            event.stopPropagation();
            navContainer.classList.toggle('active');
        });

        navContainer.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', function () {
                navContainer.classList.remove('active');
            });
        });

        document.addEventListener('click', function (event) {
            if (!navContainer.contains(event.target) && !menuToggle.contains(event.target)) {
                navContainer.classList.remove('active');
            }
        });
    }

    function setupProfileDropdown() {
        const avatarToggle = document.getElementById('avatarToggle');
        const dropdownMenu = document.getElementById('dropdownMenu');
        const userProfileWrap = document.getElementById('userProfileWrap');

        if (!avatarToggle || !dropdownMenu || !userProfileWrap) return;
        if (userProfileWrap.dataset.dropdownReady === 'true') return;

        avatarToggle.addEventListener('click', function (event) {
            event.preventDefault();
            dropdownMenu.classList.toggle('show');
        });

        document.addEventListener('click', function (event) {
            if (!userProfileWrap.contains(event.target)) {
                dropdownMenu.classList.remove('show');
            }
        });
    }

    function countActiveOccupants(occupants) {
        if (!Array.isArray(occupants)) return 0;
        return occupants.filter(function (item) { return item && item.active; }).length;
    }

    function getDormStats(dorm) {
        let totalRooms = 0;
        let occupied = 0;
        let capacity = 0;

        (dorm.floors || []).forEach(function (floor) {
            (floor.rooms || []).forEach(function (room) {
                totalRooms += 1;
                const roomCapacity = Number(room.maxCapacity) || 0;
                const roomOccupied = countActiveOccupants(room.occupants);
                capacity += roomCapacity;
                occupied += roomOccupied;
            });
        });

        return {
            totalRooms: totalRooms,
            occupied: occupied,
            availableBeds: Math.max(capacity - occupied, 0)
        };
    }

    function renderLoadingSkeleton(roomGrid) {
        if (!roomGrid) return;
        roomGrid.innerHTML = '<div class="rooms-loading"><div class="skeleton-card"><div class="skeleton-media"></div><div class="skeleton-body"><div class="skeleton-line wide"></div><div class="skeleton-line mid"></div><div class="skeleton-line wide"></div><div class="skeleton-line btn"></div></div></div><div class="skeleton-card"><div class="skeleton-media"></div><div class="skeleton-body"><div class="skeleton-line wide"></div><div class="skeleton-line mid"></div><div class="skeleton-line wide"></div><div class="skeleton-line btn"></div></div></div><div class="skeleton-card"><div class="skeleton-media"></div><div class="skeleton-body"><div class="skeleton-line wide"></div><div class="skeleton-line mid"></div><div class="skeleton-line wide"></div><div class="skeleton-line btn"></div></div></div><div class="skeleton-card"><div class="skeleton-media"></div><div class="skeleton-body"><div class="skeleton-line wide"></div><div class="skeleton-line mid"></div><div class="skeleton-line wide"></div><div class="skeleton-line btn"></div></div></div></div>';
    }

    function renderDormCards(roomGrid, dormitories) {
        if (!roomGrid) return;

        if (!dormitories.length) {
            roomGrid.innerHTML = '<div class="rooms-loading"><div class="skeleton-card"><div class="skeleton-media"></div><div class="skeleton-body"><div class="skeleton-line wide"></div><div class="skeleton-line mid"></div><div class="skeleton-line wide"></div><div class="skeleton-line btn"></div></div></div></div>';
            return;
        }

        const fallbackImages = [
            'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1598928636135-d146006ff4be?auto=format&fit=crop&w=900&q=80'
        ];

        roomGrid.innerHTML = dormitories.map(function (dorm, index) {
            const imageUrl = dorm.imageUrl || fallbackImages[index % fallbackImages.length];
            const stats = getDormStats(dorm);
            const href = dorm._id ? '/dormitory/' + dorm._id : '/map';
            const desc = (dorm.address || 'Khu ký túc xá Đại học Bách Khoa').slice(0, 78);

            return (
                '<article class="room-card">' +
                    '<div class="room-media">' +
                        '<img class="room-image" src="' + imageUrl + '" alt="' + (dorm.name || 'Ký túc xá') + '" />' +
                    '</div>' +
                    '<div class="room-body">' +
                        '<h3 class="room-type">' + (dorm.name || 'Ký túc xá') + '</h3>' +
                        '<p class="room-meta">' + desc + '</p>' +
                        '<div class="room-tags">' +
                            '<span class="room-tag">' + stats.totalRooms + ' phòng</span>' +
                            '<span class="room-tag">' + stats.availableBeds + ' chỗ trống</span>' +
                        '</div>' +
                        '<a href="' + href + '" class="book-btn">Khám phá ngay <i class="fas fa-arrow-right"></i></a>' +
                    '</div>' +
                '</article>'
            );
        }).join('');
    }

    function setupRoomCarousel() {
        const roomGrid = document.getElementById('roomGrid');
        const roomPrev = document.getElementById('roomPrev');
        const roomNext = document.getElementById('roomNext');

        if (!roomGrid) return {};

        // Responsive scroll distance
        const getScrollDistance = function() {
            const width = window.innerWidth;
            if (width < 576) return 300;
            if (width < 920) return 340;
            return 404; // card width (380px) + gap (24px)
        };

        if (roomPrev) {
            roomPrev.addEventListener('click', function () {
                roomGrid.scrollBy({ left: -getScrollDistance(), behavior: 'smooth' });
            });
        }

        if (roomNext) {
            roomNext.addEventListener('click', function () {
                roomGrid.scrollBy({ left: getScrollDistance(), behavior: 'smooth' });
            });
        }

        return { roomGrid: roomGrid };
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function setupMap(dormitories) {
        const mapEl = document.getElementById('dormitory-map');
        if (!mapEl || !window.L) return;

        const map = L.map(mapEl, { zoomControl: true }).setView([21.007119, 105.84322], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        const mapSidebar = document.getElementById('mapSidebar');
        const clusters = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 42,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false
        });

        const fallbackImage = 'https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=900&q=80';
        const bounds = [];
        const sidebarItems = [];

        dormitories.forEach(function (dorm, idx) {
            let lat = dorm.latitude;
            let lng = dorm.longitude;

            if (Array.isArray(dorm.location && dorm.location.coordinates) && dorm.location.coordinates.length >= 2) {
                lng = dorm.location.coordinates[0];
                lat = dorm.location.coordinates[1];
            }

            if (typeof lat !== 'number' || typeof lng !== 'number') return;

            const stats = getDormStats(dorm);
            const href = dorm._id ? '/dormitory/' + dorm._id : '/map';
            const image = dorm.imageUrl || fallbackImage;

            const marker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: 'map-pin-wrap',
                    html: '<span class="map-pin"></span>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            });

            marker.bindPopup(
                '<div class="map-popup">' +
                    '<img src="' + image + '" alt="' + escapeHtml(dorm.name || 'Ký túc xá') + '" />' +
                    '<h4>' + escapeHtml(dorm.name || 'Ký túc xá') + '</h4>' +
                    '<p>' + escapeHtml(dorm.address || 'Đại Cồ Việt, Hai Bà Trưng, Hà Nội') + '</p>' +
                    '<p class="map-popup-meta">' + stats.totalRooms + ' phòng · ' + stats.availableBeds + ' chỗ trống</p>' +
                    '<a class="map-popup-btn" href="' + href + '">Xem chi tiết</a>' +
                '</div>'
            );

            marker.on('click', function () {
                sidebarItems.forEach(function (item) {
                    item.classList.remove('active');
                });
                if (sidebarItems[idx]) sidebarItems[idx].classList.add('active');
            });

            clusters.addLayer(marker);
            bounds.push([lat, lng]);

            if (mapSidebar) {
                const item = document.createElement('div');
                item.className = 'map-sidebar-item';
                item.innerHTML =
                    '<div class="map-sidebar-title">' + escapeHtml(dorm.name || 'Ký túc xá') + '</div>' +
                    '<div class="map-sidebar-meta">' + stats.totalRooms + ' phòng · ' + stats.availableBeds + ' chỗ trống</div>';

                item.addEventListener('click', function () {
                    map.flyTo([lat, lng], 16, { duration: 0.6 });
                    marker.openPopup();
                    sidebarItems.forEach(function (node) { node.classList.remove('active'); });
                    item.classList.add('active');
                });

                mapSidebar.appendChild(item);
                sidebarItems.push(item);
            }
        });

        map.addLayer(clusters);

        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [34, 34] });
        } else {
            L.marker([21.007119, 105.84322]).addTo(map).bindPopup('<b>Đại học Bách Khoa Hà Nội</b>');
        }

        setTimeout(function () {
            map.invalidateSize();
        }, 240);
    }

    function setupViewer() {
        const hero = document.getElementById('hero');
        const openBtn = document.getElementById('open3DViewer');
        const closeBtn = document.getElementById('closeViewer');
        const mount = document.getElementById('three-viewer');
        const roomSwitch = document.getElementById('roomSwitch');
        const viewerReset = document.getElementById('viewerReset');
        const viewerFocus = document.getElementById('viewerFocus');
        const roomForward = document.getElementById('roomForward');
        const roomBackward = document.getElementById('roomBackward');
        const roomLeft = document.getElementById('roomLeft');
        const roomRight = document.getElementById('roomRight');
        const sceneIndicator = document.getElementById('sceneIndicator');

        if (!hero || !openBtn || !mount) return;

        const sceneGraph = [
            {
                id: 'MAIN',
                name: 'Trung tâm',
                image: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773732655/main_autvkg.png',
                neighbors: { left: 'LEFT', right: 'RIGHT', forward: 'CLOSE', back: null }
            },
            {
                id: 'LEFT',
                name: 'Góc trái',
                image: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773732656/left_vqkrse.png',
                neighbors: { left: null, right: 'MAIN', forward: null, back: null }
            },
            {
                id: 'RIGHT',
                name: 'Góc phải',
                image: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773732655/right_kglglh.png',
                neighbors: { left: 'MAIN', right: null, forward: null, back: null }
            },
            {
                id: 'CLOSE',
                name: 'Phía trước',
                image: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773732654/close_lopycx.png',
                neighbors: { left: null, right: null, forward: null, back: 'MAIN' }
            }
        ];
        const sceneById = sceneGraph.reduce(function (acc, item, index) {
            acc[item.id] = { data: item, index: index };
            return acc;
        }, {});

        const threeSources = [
            'https://unpkg.com/three@0.160.0/build/three.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/r160/three.min.js'
        ];

        let renderer = null;
        let scene = null;
        let camera = null;
        let clock = null;
        let animationId = null;
        let dragActive = false;
        let lastX = 0;
        let lastY = 0;
        let yaw = Math.PI;
        let pitch = 0;
        let fov = 74;
        let shell = null;
        let starField = null;
        let activeSceneId = 'MAIN';
        let isSwitching = false;

        const textureCache = {};
        let texturesReady = false;

        function loadScript(src) {
            return new Promise(function (resolve, reject) {
                const script = document.createElement('script');
                script.src = src;
                script.async = true;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        async function ensureThreeLoaded() {
            if (window.THREE) return;
            for (let i = 0; i < threeSources.length; i++) {
                try {
                    await loadScript(threeSources[i]);
                    if (window.THREE) return;
                } catch (e) {}
            }
            throw new Error('THREE_NOT_LOADED');
        }

        function updateSceneIndicator(sceneId) {
            const node = sceneById[sceneId];
            if (!node) return;
            if (roomSwitch) roomSwitch.value = String(node.index);
            if (sceneIndicator) {
                sceneIndicator.textContent = 'Vị trí: ' + node.data.name;
            }
        }

        function updateDirectionButtons(sceneId) {
            const node = sceneById[sceneId];
            if (!node) return;
            const neighbors = node.data.neighbors;

            if (roomLeft) roomLeft.disabled = !neighbors.left || isSwitching;
            if (roomRight) roomRight.disabled = !neighbors.right || isSwitching;
            if (roomForward) roomForward.disabled = !neighbors.forward || isSwitching;
            if (roomBackward) roomBackward.disabled = !neighbors.back || isSwitching;
        }

        function preloadTextures() {
            if (texturesReady) return Promise.resolve();

            const loader = new THREE.TextureLoader();
            const jobs = sceneGraph.map(function (sceneNode) {
                return new Promise(function (resolve, reject) {
                    loader.load(
                        sceneNode.image,
                        function (texture) {
                            texture.colorSpace = THREE.SRGBColorSpace;
                            texture.minFilter = THREE.LinearFilter;
                            texture.magFilter = THREE.LinearFilter;
                            textureCache[sceneNode.id] = texture;
                            resolve();
                        },
                        undefined,
                        reject
                    );
                });
            });

            return Promise.all(jobs).then(function () {
                texturesReady = true;
            });
        }

        function initScene() {
            activeSceneId = 'MAIN';
            resetView();
            if (shell && textureCache.MAIN) {
                shell.material.map = textureCache.MAIN;
                shell.material.needsUpdate = true;
            }
            updateSceneIndicator(activeSceneId);
            updateDirectionButtons(activeSceneId);
        }

        function requestPointerLock() {
            if (!mount || !mount.requestPointerLock) return;
            mount.requestPointerLock();
        }

        function onPointerLockChange() {
            if (!viewerFocus) return;
            const locked = document.pointerLockElement === mount;
            viewerFocus.textContent = locked ? 'Đang bắt chuột' : 'Bắt chuột';
        }

        function startDrag(event) {
            dragActive = true;
            lastX = event.clientX;
            lastY = event.clientY;
        }

        function dragLook(event) {
            if (!dragActive || document.pointerLockElement === mount) return;
            const dx = event.clientX - lastX;
            const dy = event.clientY - lastY;
            lastX = event.clientX;
            lastY = event.clientY;
            yaw -= dx * 0.0022;
            pitch -= dy * 0.0022;
            pitch = Math.max(-1.45, Math.min(1.45, pitch));
        }

        function endDrag() {
            dragActive = false;
        }

        function onPointerLockMove(event) {
            if (document.pointerLockElement !== mount) return;
            yaw -= event.movementX * 0.0019;
            pitch -= event.movementY * 0.0017;
            pitch = Math.max(-1.45, Math.min(1.45, pitch));
        }

        function onWheel(event) {
            event.preventDefault();
            fov += event.deltaY * 0.02;
            fov = Math.max(42, Math.min(95, fov));
            camera.fov = fov;
            camera.updateProjectionMatrix();
        }

        function onResize() {
            if (!renderer || !camera) return;
            camera.aspect = mount.clientWidth / mount.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(mount.clientWidth, mount.clientHeight);
        }

        function resetView() {
            yaw = Math.PI;
            pitch = 0;
            fov = 74;
            if (camera) {
                camera.position.set(0, 0, 0);
                camera.fov = fov;
                camera.updateProjectionMatrix();
            }
        }

        function switchScene(sceneId) {
            if (isSwitching || !shell || sceneId === activeSceneId || !textureCache[sceneId]) {
                return Promise.resolve(false);
            }

            isSwitching = true;
            updateDirectionButtons(activeSceneId);

            return new Promise(function (resolve) {
                const fadeMs = 170;
                mount.style.transition = 'opacity ' + fadeMs + 'ms ease';
                mount.style.opacity = '0.22';

                setTimeout(function () {
                    shell.material.map = textureCache[sceneId];
                    shell.material.needsUpdate = true;
                    activeSceneId = sceneId;
                    updateSceneIndicator(activeSceneId);
                    mount.style.opacity = '1';

                    setTimeout(function () {
                        isSwitching = false;
                        updateDirectionButtons(activeSceneId);
                        resolve(true);
                    }, fadeMs + 20);
                }, fadeMs);
            });
        }

        function moveByDirection(direction) {
            const node = sceneById[activeSceneId];
            if (!node) return;
            const nextSceneId = node.data.neighbors[direction];
            if (nextSceneId) {
                switchScene(nextSceneId);
            }
        }

        function handleMovement(event) {
            const key = event.key.toLowerCase();

            if (key === 'w') {
                event.preventDefault();
                moveByDirection('forward');
            } else if (key === 'a') {
                event.preventDefault();
                moveByDirection('left');
            } else if (key === 'd') {
                event.preventDefault();
                moveByDirection('right');
            } else if (key === 's') {
                event.preventDefault();
                moveByDirection('back');
            }
        }

        function animate() {
            animationId = requestAnimationFrame(animate);
            const delta = Math.min(clock.getDelta(), 0.03);

            const target = new THREE.Vector3(
                camera.position.x + Math.cos(pitch) * Math.sin(yaw),
                camera.position.y + Math.sin(pitch) + Math.sin(performance.now() * 0.0012) * 0.003,
                camera.position.z + Math.cos(pitch) * Math.cos(yaw)
            );

            camera.lookAt(target);
            if (starField) starField.rotation.y += delta * 0.006;
            renderer.render(scene, camera);
        }

        function initViewer() {
            if (renderer) return;

            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(fov, mount.clientWidth / mount.clientHeight, 0.1, 2400);
            camera.position.set(0, 0, 0);
            clock = new THREE.Clock();

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(mount.clientWidth, mount.clientHeight);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            mount.appendChild(renderer.domElement);

            const geometry = new THREE.SphereGeometry(500, 72, 72);
            geometry.scale(-1, 1, 1);
            const material = new THREE.MeshBasicMaterial({ map: textureCache.MAIN, transparent: false, opacity: 1 });
            shell = new THREE.Mesh(geometry, material);
            scene.add(shell);

            const starsGeometry = new THREE.BufferGeometry();
            const stars = [];
            for (let i = 0; i < 160; i++) {
                stars.push((Math.random() - 0.5) * 1600);
                stars.push((Math.random() - 0.4) * 900);
                stars.push((Math.random() - 0.5) * 1600);
            }
            starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
            starField = new THREE.Points(
                starsGeometry,
                new THREE.PointsMaterial({ color: 0xf4deca, size: 1.5, transparent: true, opacity: 0.2 })
            );
            scene.add(starField);

            mount.addEventListener('mousedown', startDrag);
            mount.addEventListener('mousemove', dragLook);
            mount.addEventListener('mouseup', endDrag);
            mount.addEventListener('mouseleave', endDrag);
            mount.addEventListener('wheel', onWheel, { passive: false });
            mount.addEventListener('click', requestPointerLock);

            document.addEventListener('mousemove', onPointerLockMove);
            document.addEventListener('pointerlockchange', onPointerLockChange);
            document.addEventListener('keydown', handleMovement);
            window.addEventListener('resize', onResize);

            if (roomSwitch) {
                roomSwitch.innerHTML = sceneGraph.map(function (sceneNode, index) {
                    return '<option value="' + index + '">' + sceneNode.name + '</option>';
                }).join('');
                roomSwitch.addEventListener('change', function (event) {
                    const idx = Number(event.target.value);
                    if (!Number.isNaN(idx) && sceneGraph[idx]) {
                        switchScene(sceneGraph[idx].id);
                    }
                });
            }

            if (roomLeft) roomLeft.addEventListener('click', function () { moveByDirection('left'); });
            if (roomRight) roomRight.addEventListener('click', function () { moveByDirection('right'); });
            if (roomForward) roomForward.addEventListener('click', function () { moveByDirection('forward'); });
            if (roomBackward) roomBackward.addEventListener('click', function () { moveByDirection('back'); });

            initScene();
        }

        async function startViewer() {
            try {
                await ensureThreeLoaded();
                await preloadTextures();
                initViewer();
                initScene();
            } catch (error) {
                alert('Không thể mở chế độ xem phòng 3D lúc này. Vui lòng thử lại sau.');
                return;
            }

            hero.classList.add('viewer-active');
            onResize();
            if (!animationId) animate();
        }

        function stopViewer() {
            hero.classList.remove('viewer-active');
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            if (document.pointerLockElement === mount && document.exitPointerLock) {
                document.exitPointerLock();
            }
        }

        openBtn.addEventListener('click', startViewer);
        if (closeBtn) closeBtn.addEventListener('click', stopViewer);

        if (viewerFocus) viewerFocus.addEventListener('click', requestPointerLock);
        if (viewerReset) viewerReset.addEventListener('click', initScene);
    }

    function normalizeDormitories(payload) {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload && payload.dormitories)) return payload.dormitories;
        return [];
    }

    function init() {
        setupMenu();
        setupProfileDropdown();

        const roomState = setupRoomCarousel();
        if (roomState.roomGrid) renderLoadingSkeleton(roomState.roomGrid);

        Promise.all([
            fetch('/api/dormitories').then(function (res) {
                if (!res.ok) throw new Error('Cannot fetch dormitories');
                return res.json();
            }).catch(function () { return { dormitories: [] }; }),
            fetch('/api/map-data').then(function (res) {
                if (!res.ok) throw new Error('Cannot fetch map data');
                return res.json();
            }).catch(function () { return { dormitories: [] }; })
        ]).then(function (results) {
            const dormitories = normalizeDormitories(results[0]);
            const mapDormitories = normalizeDormitories(results[1]);
            const sourceDorms = mapDormitories.length ? mapDormitories : dormitories;

            if (roomState.roomGrid) {
                renderDormCards(roomState.roomGrid, dormitories);
            }

            const mapSidebar = document.getElementById('mapSidebar');
            if (mapSidebar) mapSidebar.innerHTML = '';
            setupMap(sourceDorms);
        });

        setupViewer();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
