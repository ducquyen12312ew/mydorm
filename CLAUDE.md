# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a dormitory management system for HUST (Hanoi University of Science and Technology) students. The system handles dormitory registration, room assignments, application approvals, and student management with role-based access (admin and student).

## Development Commands

**Start the development server:**
```bash
npm start
```
This runs `nodemon index` which automatically restarts the server on file changes. The server runs on port 5000 by default.

**MongoDB Connection:**
The application connects to MongoDB at `mongodb://0.0.0.0:27017/Dormitory`. Ensure MongoDB is running before starting the server.

**Default Admin Account:**
- Username: `admin`
- Password: `admin123`
- Created automatically on first run if no admin exists

## Architecture Overview

### Technology Stack
- **Backend:** Node.js + Express.js
- **Database:** MongoDB with Mongoose ODM
- **View Engine:** EJS (Embedded JavaScript Templates)
- **Session Management:** express-session
- **Authentication:** bcrypt for password hashing

### Core Data Models (src/config.js)

1. **StudentCollection** - User accounts (both students and admins)
   - Contains user credentials, profile info, and room assignments
   - Role field determines admin/student access
   - `dormitoryId` and `roomNumber` track current room assignment

2. **DormitoryCollection** - Building information with nested structure
   - Uses GeoJSON for location (2dsphere index for map queries)
   - Nested floors → rooms → occupants hierarchy
   - `totalFloors` auto-calculated on save via pre-save hook
   - `priceRange` auto-calculated from room prices

3. **PendingApplicationCollection** - Registration workflow
   - Tracks applications through pending → approved/rejected states
   - Stores approver/rejecter admin IDs and timestamps
   - Critical for preventing duplicate student registrations

4. **NotificationCollection** - In-app notification system
   - Supports targeted (specific users) and global notifications
   - Tracks read status per user with timestamps
   - Priority levels and expiration dates

5. **ActivityLogCollection** - Audit trail
   - Records all major user actions (registration, approval, profile updates, etc.)
   - Linked to StudentCollection via userId

### Route Structure

All API routes are prefixed with `/api` except room-status routes:

- **src/index.js** - Main application entry, handles:
  - Session configuration and authentication middleware
  - View routes for home, login, signup, profile, map
  - Admin view routes (`/admin/*`)
  - Notification APIs (`/api/notifications`)
  - Application approval logic (`/admin/approve-application`)
  - Global functions: `sendNotificationOnEvent()`, `createActivityLog()`

- **src/dormitory-routes.js** - Dormitory CRUD operations (prefix: `/api`)
  - `GET /dormitories` - List all dormitories
  - `GET /dormitories/filter` - Filter by category, roomType, availability
  - `GET /dormitories/search` - Search by name/address (regex)
  - `GET /dormitories/:id/room-status` - Room availability by floor
  - `POST /dormitories/:dormId/floors/:floorNum/rooms/:roomNum/toggle-spot/:spotIndex` - Add/remove occupants
  - **IMPORTANT:** `checkStudentExistsInSystem()` function prevents duplicate registrations across entire system using MongoDB aggregation

- **src/registration-routes.js** - Student registration workflow (prefix: `/api`)
  - `GET /dormitories/registration` - Available dormitories for registration
  - `POST /registration` - Submit new application (creates PendingApplication)
  - `GET /registration/status/:studentId` - Check application status

- **src/admin-application-routes.js** - Admin application management (prefix: `/api/admin`)
  - `GET /admin/applications` - List applications with optional status filter
  - `GET /admin/applications/:id` - Detailed application view with room capacity check
  - `PUT /admin/applications/:id/update-status` - Approve/reject applications
  - **CRITICAL:** Uses `checkStudentExistsInSystem()` before approving to prevent duplicate room assignments

- **src/room-status-routes.js** - Student room information (no prefix)
  - `GET /room-status` - View page for students
  - `GET /api/student/current-room` - Student's current room info with roommates
  - `GET /api/student/applications` - Student's application history

### Authentication & Authorization

**Middleware Functions:**
- `isAuthenticated` - Checks session for userId, redirects to login if missing
- `isAdmin` - Checks session for admin role, returns 403 or redirects if not admin

**Session Structure:**
```javascript
req.session = {
  userId: ObjectId,      // MongoDB _id from StudentCollection
  name: String,          // Student/admin name
  role: 'user'|'admin',  // Access level
  studentId: String      // Student ID (may be different from userId)
}
```

### Critical Business Logic

**Application Approval Flow (src/index.js:792-1014):**
1. Check application exists and is pending
2. Verify student doesn't already exist in ANY dormitory/room (prevent duplicates)
3. Verify target room has available capacity
4. Add student to room occupants array with `active: true`
5. Update StudentCollection with dormitoryId and roomNumber
6. Send notification and create activity log
7. Mark application as approved with admin ID and timestamp

**Duplicate Prevention:**
The system enforces one-room-per-student across the entire system using:
- `checkStudentExistsInSystem()` - MongoDB aggregation that unwinds floors/rooms/occupants
- Checks both studentId and name for duplicates
- Used in both admin approval and manual occupant addition

**Occupant Management:**
- Occupants are never deleted, only marked `active: false`
- Room capacity checked by counting `occupants.filter(o => o.active).length`
- Spot toggle endpoint handles both add (with body) and remove (no body)

## Key Implementation Patterns

**Error Handling:**
- Most routes return `{ success: boolean, error/message: string }` JSON format
- Admin routes use 403 for authorization failures
- 404 for missing resources, 400 for validation errors

**MongoDB Virtuals (not saved to DB):**
- `RoomSchema.virtual('currentOccupants')` - Count active occupants
- `RoomSchema.virtual('available')` - Boolean for room availability

**Pre-save Hooks:**
- `DormitorySchema.pre('save')` - Auto-calculates totalFloors and priceRange from nested data
- **IMPORTANT:** Always ensure `dormitory.details.totalFloors` is set before saving to prevent validation errors

**Global Functions (set in src/index.js:1379-1380):**
- `global.sendNotificationOnEvent` - Creates notifications for various events (welcome, approval, rejection, etc.)
- `global.createActivityLog` - Records user actions for audit trail

## Common Development Tasks

**Adding a new dormitory (admin):**
- POST to `/api/dormitories` with full structure including floors/rooms
- If `floorRoomConfigs` not provided, uses default generation logic
- Always provide `location.coordinates` [longitude, latitude] or defaults to HUST coordinates

**Approving an application:**
- Use `/admin/approve-application` POST endpoint (not PUT)
- Requires `{ applicationId, action: 'approve'|'reject', rejectionReason? }`
- Automatically handles room assignment and notification

**Checking room availability:**
- Use `/api/dormitories/:id/room-status` for full building overview
- Returns nested structure: floors → rooms with capacity info

**Adding/removing occupants manually (admin):**
- POST to `/api/dormitories/:dormId/floors/:floorNum/rooms/:roomNum/toggle-spot/:spotIndex`
- With body = add occupant, without body = remove occupant
- System checks for duplicates across all dormitories before allowing addition

## Important Notes

- Session cookie name is `dormitory_session` (not default `connect.sid`)
- The main entry point is `src/index.js` (not root `index.js`)
- Views are in `/views` directory with `.ejs` extension
- Public static files in `/public` directory
- Vietnamese language is used for user-facing messages
- Always check `active: true` when counting occupants or checking room availability
- MongoDB aggregation is preferred for complex queries involving nested arrays (floors/rooms/occupants)
