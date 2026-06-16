/**
 * capacityHelper — tổng sức chứa KTX (Σ floors.rooms.maxCapacity) tính động từ DB.
 * Cache module-level 5 phút, fallback 1450 nếu DB rỗng/lỗi.
 */

const DEFAULT_CAPACITY = 1450;
const CACHE_TTL_MS = 5 * 60 * 1000;

const _cache = { value: null, at: 0 };

/**
 * @param {import('mongoose').Model} DormitoryCollection model dormitories
 * @param {Object} [opts] { fresh?:bool } bỏ qua cache
 * @returns {Promise<number>}
 */
async function getDormCapacity(DormitoryCollection, opts = {}) {
  if (!opts.fresh && _cache.value && (Date.now() - _cache.at) < CACHE_TTL_MS) {
    return _cache.value;
  }
  try {
    const agg = await DormitoryCollection.aggregate([
      { $unwind: '$floors' },
      { $unwind: '$floors.rooms' },
      { $group: { _id: null, total: { $sum: '$floors.rooms.maxCapacity' } } }
    ]);
    const total = agg.length ? (agg[0].total || 0) : 0;
    const value = total > 0 ? total : DEFAULT_CAPACITY;
    _cache.value = value;
    _cache.at = Date.now();
    return value;
  } catch (err) {
    console.error('[capacityHelper] aggregate failed, dùng fallback:', err.message);
    return DEFAULT_CAPACITY;
  }
}

function invalidateCapacityCache() {
  _cache.value = null;
  _cache.at = 0;
}

module.exports = { getDormCapacity, invalidateCapacityCache, DEFAULT_CAPACITY };
