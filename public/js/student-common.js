// student-common.js - File JavaScript chung cho các trang student

// Notification System Variables
let notifications = [];
let currentTab = 'all';
let isDropdownOpen = false;

// DOM elements
const notificationBtn = document.getElementById('notificationBtn');
const notificationDropdown = document.getElementById('notificationDropdown');
const notificationList = document.getElementById('notificationList');
const notificationBadge = document.getElementById('notificationBadge');
const notificationCount = document.getElementById('notificationCount');
const overlay = document.getElementById('overlay');
const tabBtns = document.querySelectorAll('.tab-btn');

// Initialize notification system
document.addEventListener('DOMContentLoaded', function() {
    if (notificationBtn && notificationDropdown) {
        loadNotifications();
        
        // Event listeners
        notificationBtn.addEventListener('click', toggleNotificationDropdown);
        
        if (overlay) {
            overlay.addEventListener('click', closeNotificationDropdown);
        }

        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                switchTab(tab);
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!notificationBtn.contains(e.target) && !notificationDropdown.contains(e.target)) {
                closeNotificationDropdown();
            }
        });

        // Refresh notifications every 30 seconds
        setInterval(loadNotifications, 30000);
    }

    // Mobile menu initialization
    initMobileMenu();
});

// Load notifications from API
async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications');
        if (response.ok) {
            const data = await response.json();
            notifications = data.notifications || [];
            updateNotificationBadge(data.unreadCount || 0);
            renderNotifications();
        } else {
            console.error('Failed to load notifications');
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Toggle notification dropdown
function toggleNotificationDropdown() {
    isDropdownOpen = !isDropdownOpen;
    
    if (isDropdownOpen) {
        notificationDropdown.classList.add('show');
        if (overlay) overlay.classList.add('show');
    } else {
        closeNotificationDropdown();
    }
}

// Close notification dropdown
function closeNotificationDropdown() {
    isDropdownOpen = false;
    notificationDropdown.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
}

// Switch notification tab
function switchTab(tab) {
    currentTab = tab;
    
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });
    
    renderNotifications();
}

// Render notifications
function renderNotifications() {
    const filteredNotifications = currentTab === 'unread' 
        ? notifications.filter(n => !n.isRead)
        : notifications;
    
    if (filteredNotifications.length === 0) {
        notificationList.innerHTML = `
            <div class="notification-empty">
                <i class="fas fa-bell-slash"></i>
                <p>${currentTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo mới'}</p>
            </div>
        `;
        return;
    }

    notificationList.innerHTML = filteredNotifications.map(notification => `
        <div class="notification-item ${!notification.isRead ? 'unread' : ''}" onclick="markAsRead('${notification._id}')">
            <div class="notification-icon-wrapper ${notification.type}">
                ${getNotificationIcon(notification.type)}
            </div>
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${formatTime(notification.createdAt)}</div>
            </div>
        </div>
    `).join('');
}

// Get notification icon
function getNotificationIcon(type) {
    const icons = {
        success: '<i class="fas fa-check-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        info: '<i class="fas fa-info-circle"></i>',
        error: '<i class="fas fa-times-circle"></i>'
    };
    return icons[type] || icons.info;
}

// Format time
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    
    if (diff < 60000) { // Less than 1 minute
        return 'Vừa xong';
    } else if (diff < 3600000) { // Less than 1 hour
        return Math.floor(diff / 60000) + ' phút trước';
    } else if (diff < 86400000) { // Less than 1 day
        return Math.floor(diff / 3600000) + ' giờ trước';
    } else {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${hours}:${minutes} • ${days[date.getDay()]} ${day}/${month}/${year}`;
    }
}

// Mark notification as read
async function markAsRead(notificationId) {
    try {
        const response = await fetch(`/api/notifications/${notificationId}/read`, {
            method: 'POST'
        });

        if (response.ok) {
            // Update local state
            const notification = notifications.find(n => n._id === notificationId);
            if (notification && !notification.isRead) {
                notification.isRead = true;
                const unreadCount = notifications.filter(n => !n.isRead).length;
                updateNotificationBadge(unreadCount);
                renderNotifications();
            }
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Update notification badge
function updateNotificationBadge(count) {
    if (count > 0) {
        notificationBadge.textContent = count > 99 ? '99+' : count;
        notificationBadge.style.display = 'flex';
        notificationCount.textContent = `Mới ${count}`;
    } else {
        notificationBadge.style.display = 'none';
        notificationCount.textContent = 'Không có mới';
    }
}

// Mobile menu toggle
function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const navContainer = document.getElementById('navContainer');
    
    if (menuToggle && navContainer) {
        menuToggle.addEventListener('click', function() {
            navContainer.classList.toggle('active');
            
            const spans = this.querySelectorAll('span');
            if (navContainer.classList.contains('active')) {
                spans[0].style.transform = 'translateY(9px) rotate(45deg)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'translateY(-9px) rotate(-45deg)';
            } else {
                spans[0].style.transform = '';
                spans[1].style.opacity = '';
                spans[2].style.transform = '';
            }
        });
    }
    
    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
        if (navContainer && menuToggle && 
            !navContainer.contains(event.target) && 
            !menuToggle.contains(event.target) && 
            navContainer.classList.contains('active')) {
            
            navContainer.classList.remove('active');
            
            const spans = menuToggle.querySelectorAll('span');
            spans[0].style.transform = '';
            spans[1].style.opacity = '';
            spans[2].style.transform = '';
        }
    });
}