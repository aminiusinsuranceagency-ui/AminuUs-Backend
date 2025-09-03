// =============================================
// REMINDER ROUTES - routes/reminder.routes.ts
// Aligned with Frontend Service Expectations
// =============================================

import { Router } from 'express';
import { RemindersController } from '../controllers/reminder.controller';

const router = Router();
const remindersController = new RemindersController();

// =============================================
// CORE REMINDER ROUTES
// =============================================

// Create a new reminder
// POST /api/reminders
// Headers: x-agent-id (required)
// Body: CreateReminderRequest
router.post('/', remindersController.createReminder);

// Get all reminders with pagination and filters
// GET /api/reminders/agent/:agentId
// Query params: reminderType?, status?, priority?, startDate?, endDate?, clientId?, pageSize?, pageNumber?
router.get('/agent/:agentId', remindersController.getAllReminders);

// Get reminder by ID
// GET /api/reminders/agent/:agentId/reminder/:reminderId
router.get('/agent/:agentId/reminder/:reminderId', remindersController.getReminderById);

// Alternative route for getting reminder by ID (for backward compatibility)
// GET /api/reminders/:reminderId
// Headers: x-agent-id (required)
router.get('/:reminderId', remindersController.getReminderById);

// Update a reminder
// PUT /api/reminders/agent/:agentId/reminder/:reminderId
// Body: UpdateReminderRequest
router.put('/agent/:agentId/reminder/:reminderId', remindersController.updateReminder);

// Alternative route for updating reminder (for backward compatibility)
// PUT /api/reminders/:reminderId
// Headers: x-agent-id (required)
router.put('/:reminderId', remindersController.updateReminder);

// Delete a reminder
// DELETE /api/reminders/agent/:agentId/reminder/:reminderId
router.delete('/agent/:agentId/reminder/:reminderId', remindersController.deleteReminder);

// Alternative route for deleting reminder (for backward compatibility)
// DELETE /api/reminders/:reminderId
// Headers: x-agent-id (required)
router.delete('/:reminderId', remindersController.deleteReminder);

// Complete a reminder
// POST /api/reminders/agent/:agentId/reminder/:reminderId/complete
// Body: { notes?: string }
router.post('/agent/:agentId/reminder/:reminderId/complete', remindersController.completeReminder);

// Alternative route for completing reminder (for backward compatibility)
// POST /api/reminders/:reminderId/complete
// Headers: x-agent-id (required)
router.post('/:reminderId/complete', remindersController.completeReminder);

// =============================================
// SPECIALIZED REMINDER ROUTES
// =============================================

// Get today's reminders for an agent
// GET /api/reminders/agent/:agentId/today
router.get('/agent/:agentId/today', remindersController.getTodayReminders);

// Get reminders by type
// GET /api/reminders/agent/:agentId/type/:reminderType
router.get('/agent/:agentId/type/:reminderType', remindersController.getRemindersByType);

// Get reminders by status
// GET /api/reminders/agent/:agentId/status/:status
router.get('/agent/:agentId/status/:status', remindersController.getRemindersByStatus);

// Get birthday reminders
// GET /api/reminders/agent/:agentId/birthdays
router.get('/agent/:agentId/birthdays', remindersController.getBirthdayReminders);

// Get policy expiry reminders
// GET /api/reminders/agent/:agentId/policy-expiry
// Query params: daysAhead? (default: 30)
router.get('/agent/:agentId/policy-expiry', remindersController.getPolicyExpiryReminders);

// =============================================
// REMINDER STATISTICS ROUTES
// =============================================

// Get reminder statistics for an agent
// GET /api/reminders/agent/:agentId/statistics
router.get('/agent/:agentId/statistics', remindersController.getReminderStatistics);

// =============================================
// REMINDER SETTINGS ROUTES
// =============================================

// Get reminder settings for an agent
// GET /api/reminders/agent/:agentId/settings
router.get('/agent/:agentId/settings', remindersController.getReminderSettings);

// Update reminder settings for an agent
// PUT /api/reminders/agent/:agentId/settings
// Body: ReminderSettings
router.put('/agent/:agentId/settings', remindersController.updateReminderSettings);

// =============================================
// UTILITY ROUTES
// =============================================

// Validate phone number
// POST /api/reminders/validate-phone
// Body: { phoneNumber: string, countryCode?: string }
router.post('/validate-phone', remindersController.validatePhoneNumber);

// =============================================
// BACKWARD COMPATIBILITY ROUTES
// These routes use headers for agent ID instead of URL params
// =============================================

// Get today's reminders (backward compatibility)
// GET /api/reminders/today
// Headers: x-agent-id (required)
router.get('/today', remindersController.getTodayReminders);

// Get reminder statistics (backward compatibility)
// GET /api/reminders/statistics
// Headers: x-agent-id (required)
router.get('/statistics', remindersController.getReminderStatistics);

// Get reminder settings (backward compatibility)
// GET /api/reminders/settings
// Headers: x-agent-id (required)
router.get('/settings', remindersController.getReminderSettings);

// Update reminder settings (backward compatibility)
// PUT /api/reminders/settings
// Headers: x-agent-id (required)
router.put('/settings', remindersController.updateReminderSettings);

// Get birthday reminders (backward compatibility)
// GET /api/reminders/birthdays
// Headers: x-agent-id (required)
router.get('/birthdays', remindersController.getBirthdayReminders);

// Get policy expiry reminders (backward compatibility)
// GET /api/reminders/policy-expiry
// Headers: x-agent-id (required)
router.get('/policy-expiry', remindersController.getPolicyExpiryReminders);

export default router;