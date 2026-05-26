/**
 * 360 DEGREE ROOM VIEWER SERVICE
 * Manages 360-degree panoramic room images and viewing experience
 * Uses Photo Sphere Viewer library (lightweight, no backend required)
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../config/logger');

class RoomViewerService {
  /**
   * Initialize room viewer data for a specific room
   * @param {String} roomId - Room identifier
   * @param {Object} viewData - { panoramaImages, thumbnails, metadata }
   */
  static async setupRoomView(roomId, viewData) {
    try {
      // Validate required images
      if (!viewData.panoramaImages || viewData.panoramaImages.length === 0) {
        throw new Error('At least one panorama image is required');
      }

      const roomView = {
        roomId,
        images: viewData.panoramaImages.map((img, idx) => ({
          id: `view-${idx}`,
          url: img.url,
          title: img.title || `Room View ${idx + 1}`,
          hotspots: img.hotspots || [] // Interactive points
        })),
        metadata: {
          roomType: viewData.metadata?.roomType || 'Standard',
          capacity: viewData.metadata?.capacity || 4,
          facilities: viewData.metadata?.facilities || [],
          floor: viewData.metadata?.floor || 'Unknown',
          building: viewData.metadata?.building || 'Unknown'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.info('Room view initialized', { roomId, imageCount: viewData.panoramaImages.length });
      return roomView;
    } catch (error) {
      logger.error('Room view setup failed', { roomId, error: error.message });
      throw error;
    }
  }

  /**
   * Generate Photo Sphere Viewer configuration
   * @param {Object} roomView - Room view data
   * @returns {Object} PSV configuration
   */
  static generateViewerConfig(roomView) {
    return {
      container: 'viewer-container',
      panorama: roomView.images[0].url, // Main panorama
      caption: roomView.images[0].title,
      navbar: [
        'autorotate',
        'zoom',
        'move',
        'download',
        'fullscreen'
      ],
      navbar_side: 'left',
      loading_spinner: true,
      loading_img: '/img/loading.gif',
      autorotate_speed: '2rpm',
      default_long: 0,
      default_lat: 0,
      min_fov: 30,
      max_fov: 120,
      default_fov: 70,
      allow_swipe: true,
      allow_user_interactions: true,

      // Hotspots for interactive points
      hotspots: roomView.images[0].hotspots.map(hs => ({
        longitude: hs.longitude || 0,
        latitude: hs.latitude || 0,
        id: hs.id,
        tooltip: hs.name,
        image: hs.icon || '/img/hotspot-icon.png'
      })),

      // Additional views in a list
      scenes: roomView.images.map(img => ({
        id: img.id,
        name: img.title,
        panorama: img.url,
        thumbnail: img.url.replace('.jpg', '_thumb.jpg')
      }))
    };
  }

  /**
   * Get room viewer HTML embed code
   */
  static getViewerEmbed(roomView, options = {}) {
    const config = this.generateViewerConfig(roomView);

    const html = `
<div id="viewer-wrapper" style="width: 100%; height: 600px; position: relative; background: #000;">
  <div id="viewer-container" style="width: 100%; height: 100%;"></div>
  
  <!-- Room Info Panel -->
  <div id="room-info-panel" style="position: absolute; bottom: 20px; left: 20px; background: rgba(0,0,0,0.7); color: white; padding: 15px; border-radius: 8px; max-width: 300px; z-index: 100;">
    <h3 style="margin: 0 0 10px 0; font-size: 1.1rem;">
      ${roomView.metadata.roomType} - ${roomView.metadata.building}
    </h3>
    <p style="margin: 5px 0; font-size: 0.9rem;">
      <strong>Capacity:</strong> ${roomView.metadata.capacity} students
    </p>
    <p style="margin: 5px 0; font-size: 0.9rem;">
      <strong>Floor:</strong> ${roomView.metadata.floor}
    </p>
    <div style="margin-top: 10px; font-size: 0.85rem;">
      <strong>Facilities:</strong>
      <ul style="margin: 5px 0; padding-left: 20px;">
        ${roomView.metadata.facilities.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
  </div>

  <!-- Scene Selector (multiple views) -->
  ${roomView.images.length > 1 ? `
  <div id="scene-selector" style="position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.8); padding: 10px; border-radius: 8px; z-index: 100;">
    <p style="color: white; margin: 0 0 8px 0; font-size: 0.9rem;"><strong>Views</strong></p>
    <select id="view-select" style="padding: 5px; border-radius: 4px; background: #333; color: white; border: 1px solid #666;">
      ${roomView.images.map(img => `
        <option value="${img.id}">${img.title}</option>
      `).join('')}
    </select>
  </div>
  ` : ''}

  <!-- Controls Guide -->
  <div id="controls-guide" style="position: absolute; top: 20px; left: 20px; background: rgba(0,0,0,0.7); color: white; padding: 12px; border-radius: 6px; font-size: 0.8rem; max-width: 250px; z-index: 100;">
    <p style="margin: 0 0 8px 0; font-weight: bold;">💡 Controls</p>
    <p style="margin: 3px 0;">🖱️ Drag to rotate</p>
    <p style="margin: 3px 0;">🔍 Scroll to zoom</p>
    <p style="margin: 3px 0;">📱 Mobile: Touch to rotate</p>
  </div>
</div>

<!-- Photo Sphere Viewer Library -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/photo-sphere-viewer@5.5.0/index.min.css">
<script src="https://cdn.jsdelivr.net/npm/photo-sphere-viewer@5.5.0/index.min.js"></script>

<script>
  // Initialize Photo Sphere Viewer
  const psv = new PhotoSphereViewer(${JSON.stringify(config)});

  // Scene switching
  const viewSelect = document.getElementById('view-select');
  if (viewSelect) {
    viewSelect.addEventListener('change', (e) => {
      const scene = ${JSON.stringify(config.scenes)}.find(s => s.id === e.target.value);
      if (scene) {
        psv.setPanorama(scene.panorama);
        psv.setCaption(scene.name);
      }
    });
  }

  // Hotspot click handler
  psv.on('hotspot-click', (data, e) => {
    console.log('Hotspot clicked:', data.id);
    alert('Hotspot: ' + data.id + '\\n' + (data.tooltip || 'No info'));
  });

  // Autorotate controls
  document.addEventListener('DOMContentLoaded', () => {
    psv.autorotate.start();
  });
</script>
    `;

    return html;
  }

  /**
   * Get sample room view data (for demo)
   */
  static getSampleRoomData(roomId = 'sample') {
    return {
      roomId,
      images: [
        {
          id: 'main-view',
          url: '/img/nophoto.png', // Fallback to placeholder
          title: 'Main View',
          hotspots: [
            {
              id: 'hs-bathroom',
              name: 'Bathroom',
              longitude: 100,
              latitude: 20,
              icon: '/img/bathroom-icon.png'
            },
            {
              id: 'hs-window',
              name: 'Window',
              longitude: 200,
              latitude: 10,
              icon: '/img/window-icon.png'
            }
          ]
        }
      ],
      metadata: {
        roomType: 'Standard Double',
        capacity: 2,
        facilities: ['Air Conditioning', 'Study Desk', 'WiFi', 'Shared Bathroom'],
        floor: '3rd Floor',
        building: 'Building A'
      }
    };
  }

  /**
   * Convert regular images to 360 panorama (placeholder for future AI conversion)
   */
  static async convertToPanorama(imagePath) {
    try {
      // For now, just validate the image exists
      if (!fs.existsSync(imagePath)) {
        throw new Error('Image not found');
      }

      logger.info('Image converted to panorama', { originalPath: imagePath });
      return imagePath; // TODO: Implement actual 360 conversion if needed

    } catch (error) {
      logger.error('Panorama conversion failed', { imagePath, error: error.message });
      throw error;
    }
  }
}

module.exports = RoomViewerService;
