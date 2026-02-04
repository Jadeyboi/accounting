# Leave Notifications Implementation

## Overview
Added incoming leave notifications to the notification system so you can see whose approved leaves are starting within the next 7 days.

## Changes Made

### 1. Updated NotificationsBell.tsx
- Added `LeaveRequest` import from types
- Extended `Notification` interface to include `leaveType` and `leaveDays` properties
- Added 'leave' as a new notification type
- Updated `generateNotifications` function to include leave processing
- Updated `fetchNotifications` to query approved leave requests starting within 7 days

### 2. Updated Notifications.tsx
- Same changes as NotificationsBell.tsx for consistency
- Added green color scheme for leave notifications in `getNotificationColor` function
- Leave notifications use green background (`bg-green-50 border-green-200 text-green-800`)

## Features

### Leave Notification Logic
- **Scope**: Only shows approved leave requests starting within the next 7 days
- **Priority**: Leave notifications are sorted by urgency (days until start date)
- **Display**: Shows employee name, leave type, duration, and days until start

### Leave Types Supported
- Sick Leave
- Vacation Leave  
- Birthday Leave
- Emergency Leave
- Unpaid Leave
- Paternity Leave
- Maternity Leave

### Notification Messages
- **Today**: "🏖️ [Name] is on [Leave Type] today (X days)"
- **Tomorrow**: "🏖️ [Name] starts [Leave Type] tomorrow (X days)"
- **Future**: "🏖️ [Name] starts [Leave Type] in X days (X days)"

### Visual Indicators
- **Leave Icon**: 🏖️ (beach/vacation emoji)
- **Color Scheme**: Green background for leave notifications
- **Urgency Colors**: 
  - Red: Starting today
  - Orange: Starting in 1-3 days
  - Yellow: Starting in 4-7 days
  - Green: Default leave color for longer timeframes

## Database Query
The system queries the `leave_requests` table for:
- Status = 'approved'
- Start date between today and 7 days from now
- Ordered by start date

## Integration
- Leave notifications appear alongside existing birthday, regularization, and anniversary notifications
- All notifications are sorted by urgency (days until event)
- Leave notifications appear in both the notification bell badge count and the dropdown list
- Urgent leave notifications (within 7 days) show in the "Urgent" section

## Benefits
- **Proactive Planning**: See who will be out in advance
- **Resource Management**: Plan workload distribution
- **Team Coordination**: Ensure coverage for absent team members
- **Visual Alerts**: Clear, color-coded notifications for easy identification

## Testing
To test the leave notifications:
1. Create approved leave requests with start dates within the next 7 days
2. Check the notification bell for the badge count
3. Click the notification bell to see leave notifications in the dropdown
4. Verify different leave types display correctly
5. Confirm urgency colors work based on days until start date