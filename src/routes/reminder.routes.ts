// =============================================
// FIXED REMINDERS ROUTES - reminders.routes.ts
// =============================================

import { Router } from 'express';
import { RemindersController } from '../controllers/reminder.controller';

const router = Router();
const controller = new RemindersController();

/**
 * =====================
 * AGENT-SPECIFIC ROUTES (with agentId parameter)
 * =====================
 */

// Statistics route for specific agent
router.get('/:agentId/statistics', controller.getReminderStatistics);

// Settings routes for specific agent
router.get('/:agentId/settings', controller.getReminderSettings);
router.put('/:agentId/settings', controller.updateReminderSettings);

// Today's reminders for specific agent
router.get('/:agentId/today', controller.getTodayReminders);

// Birthday reminders for specific agent
router.get('/:agentId/birthdays', controller.getBirthdayReminders);

// Policy expiry reminders for specific agent
router.get('/:agentId/policy-expiries', controller.getPolicyExpiryReminders);

// Filter routes for specific agent
router.get('/:agentId/type/:reminderType', controller.getRemindersByType);
router.get('/:agentId/status/:status', controller.getRemindersByStatus);

// Create reminder for specific agent
router.post('/:agentId', controller.createReminder);

// Get all reminders for specific agent (THIS WAS THE MISSING ROUTE!)
router.get('/:agentId', controller.getAllReminders);

// Complete reminder - specific action
router.post('/:agentId/:reminderId/complete', controller.completeReminder);

// Individual reminder CRUD for specific agent
router.get('/:agentId/:reminderId', controller.getReminderById);
router.put('/:agentId/:reminderId', controller.updateReminder);
router.delete('/:agentId/:reminderId', controller.deleteReminder);

/**
 * =====================
 * GLOBAL ROUTES (without agentId - for header-based authentication)
 * =====================
 */

// Phone validation route (global utility)
router.post('/validate-phone', controller.validatePhoneNumber);

// Fallback routes that use x-agent-id header instead of URL parameter
router.get('/statistics', controller.getReminderStatistics);
router.get('/settings', controller.getReminderSettings);
router.put('/settings', controller.updateReminderSettings);
router.get('/today', controller.getTodayReminders);
router.get('/birthdays', controller.getBirthdayReminders);
router.get('/policy-expiries', controller.getPolicyExpiryReminders);
router.get('/type/:reminderType', controller.getRemindersByType);
router.get('/status/:status', controller.getRemindersByStatus);
router.post('/', controller.createReminder);
router.get('/', controller.getAllReminders);
router.post('/:reminderId/complete', controller.completeReminder);
router.get('/:reminderId', controller.getReminderById);
router.put('/:reminderId', controller.updateReminder);
router.delete('/:reminderId', controller.deleteReminder);

/**
 * =====================
 * Debugging middleware
 * =====================
 */
router.use((req, res, next) => {
    console.log(`🛣️ Reminder Route: ${req.method} ${req.originalUrl}`);
    console.log(`🛣️ Params:`, req.params);
    console.log(`🛣️ Query:`, req.query);
    console.log(`🛣️ Headers x-agent-id:`, req.headers['x-agent-id']);
    next();
});

export default router;