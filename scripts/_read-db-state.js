require('dotenv').config();
const cfg = require('../src/config/config');
const mongoose = cfg.DormitoryCollection.db;

require('../src/config/config'); // triggers connect

mongoose.connection ? null : null;
const conn = require('mongoose').connection;

conn.once('connected', async () => {
  const { DormitoryCollection, StudentCollection } = require('../src/config/config');
  const dorms = await DormitoryCollection.find({ isDeleted: { $ne: true } }).lean();
  let totalBeds = 0, totalRooms = 0, occupied = 0;
  dorms.forEach(d => {
    (d.floors || []).forEach(f => (f.rooms || []).forEach(r => {
      totalBeds += r.maxCapacity || 0;
      occupied  += (r.occupants || []).filter(o => o.active).length;
      totalRooms++;
    }));
  });

  console.log('=== DB STATE ===');
  console.log('Dorms:', dorms.length, '| Rooms:', totalRooms, '| Beds:', totalBeds);
  console.log('Occupied:', occupied, '| Empty:', totalBeds - occupied);
  console.log('Occupancy:', Math.round(occupied / totalBeds * 100) + '%');
  console.log('Target 82%:', Math.floor(totalBeds * 0.82), 'occupied');
  dorms.forEach(d => {
    let db = 0, doc = 0;
    (d.floors || []).forEach(f => (f.rooms || []).forEach(r => {
      db  += r.maxCapacity || 0;
      doc += (r.occupants || []).filter(o => o.active).length;
    }));
    console.log(' ', d.name, ':', db, 'beds,', doc, 'occupied', d.gender || '');
  });

  const sc = await StudentCollection.countDocuments({ role: { $ne: 'admin' } });
  console.log('Students (non-admin):', sc);
  process.exit(0);
});
