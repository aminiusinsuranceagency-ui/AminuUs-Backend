import { Router } from 'express';
import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAppointmentById,
  getAllAppointments,
  getTodayAppointments,
  getAppointmentsForDate,
  getWeekViewAppointments,
  getCalendarAppointments,
  updateAppointmentStatus,
  searchAppointments,
  checkAppointmentConflicts,
  getAppointmentStatistics,
  searchClients
} from '../controllers/appointments';

const router = Router();

// ==================
// Specific routes first (to avoid conflicts with general routes)
// ==================

// Week view appointments
router.get('/:agentId/week', getWeekViewAppointments);

// Calendar appointments (requires month and year query params)
router.get('/:agentId/calendar', getCalendarAppointments);

// Appointment statistics
router.get('/:agentId/statistics', getAppointmentStatistics);

// Today's appointments
router.get('/:agentId/today', getTodayAppointments);

// Appointments for specific date (requires appointmentDate query param)
router.get('/:agentId/date', getAppointmentsForDate);

// Search appointments (requires searchTerm query param)
router.get('/:agentId/search', searchAppointments);

// Client search for autocomplete (requires 'q' query parameter)
router.get('/:agentId/clients/search', searchClients);

// Time conflict checking
router.post('/:agentId/check-conflicts', checkAppointmentConflicts);

// Update appointment status (separate endpoint for status updates)
router.put('/:agentId/:appointmentId/status', updateAppointmentStatus);

// ==================
// CRUD routes (order matters - more specific routes first)
// ==================

// Create new appointment
router.post('/:agentId', createAppointment);

// Update existing appointment
router.put('/:agentId/:appointmentId', updateAppointment);

// Get appointment by ID
router.get('/:agentId/:appointmentId', getAppointmentById);

// Delete appointment
router.delete('/:agentId/:appointmentId', deleteAppointment);

// Get all appointments with optional filters
// Supports query params: startDate, endDate, status, type, priority, clientId, searchTerm, pageSize, pageNumber
router.get('/:agentId', getAllAppointments);

export default router;