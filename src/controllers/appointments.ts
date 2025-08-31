import { Request, Response } from 'express';
import { AppointmentsService } from '../services/appointment.service';
import { Appointment, CreateAppointmentRequest, AppointmentResponse, UpdateAppointmentRequest, AppointmentFilters, WeekViewData, CalendarViewData, ConflictCheckRequest, ConflictCheckResponse, AppointmentStatistics, ClientSearchResult } from '../interfaces/appointment';



const appointmentsService = new AppointmentsService();

export const createAppointment = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const {
      clientId,
      title,
      description,
      appointmentDate,
      startTime,
      endTime,
      location,
      type,
      status,
      priority,
      notes,
      reminderSet
    } = req.body;

    // Basic validation
    if (!clientId || !title || !appointmentDate || !startTime || !endTime || !type) {
      return res.status(400).json({
        Success: false,
        Message: "Missing required fields: clientId, title, appointmentDate, startTime, endTime, and type are required"
      });
    }

    const result = await appointmentsService.createAppointment(agentId, req.body);
    
    if (result.Success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    console.error('Error creating appointment:', err);
    res.status(500).json({
      Success: false,
      Message: err.message || 'Failed to create appointment due to server error'
    });
  }
};

export const updateAppointment = async (req: Request, res: Response) => {
  try {
    const { agentId, appointmentId } = req.params;
    
    const result = await appointmentsService.updateAppointment(agentId, appointmentId, req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Error updating appointment:', err);
    res.status(500).json({
      Success: false,
      Message: err.message || 'Failed to update appointment'
    });
  }
};

export const deleteAppointment = async (req: Request, res: Response) => {
  try {
    const { agentId, appointmentId } = req.params;
    
    const result = await appointmentsService.deleteAppointment(agentId, appointmentId);
    res.json(result);
  } catch (err: any) {
    console.error('Error deleting appointment:', err);
    res.status(500).json({
      Success: false,
      Message: err.message || 'Failed to delete appointment'
    });
  }
};

export const getAppointmentById = async (req: Request, res: Response) => {
  try {
    const { agentId, appointmentId } = req.params;
    
    const appointment = await appointmentsService.getAppointmentById(agentId, appointmentId);
    
    if (!appointment) {
      return res.status(404).json({
        error: 'Appointment not found'
      });
    }
    
    res.json(appointment);
  } catch (err: any) {
    console.error('Error getting appointment by ID:', err);
    res.status(500).json({
      error: 'Failed to get appointment',
      Message: err.message || 'Failed to retrieve appointment'
    });
  }
};

export const getAllAppointments = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    
    const filters = {
      pageSize: parseInt(req.query.pageSize as string) || 50,
      pageNumber: parseInt(req.query.pageNumber as string) || 1,
      status: req.query.status as string,
      type: req.query.type as string,
      priority: req.query.priority as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      clientId: req.query.clientId as string,
      searchTerm: req.query.searchTerm as string
    };
    
    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof typeof filters] === undefined) {
        delete filters[key as keyof typeof filters];
      }
    });

    const appointments = await appointmentsService.getAllAppointments(agentId, filters);
    res.json(appointments);
  } catch (err: any) {
    console.error('Error getting all appointments:', err);
    res.status(500).json({
      error: 'Failed to get appointments',
      Message: err.message || 'Failed to retrieve appointments'
    });
  }
};

export const getTodayAppointments = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    
    const appointments = await appointmentsService.getTodayAppointments(agentId);
    res.json(appointments);
  } catch (err: any) {
    console.error('Error getting today appointments:', err);
    res.status(500).json({
      error: 'Failed to get today appointments',
      Message: err.message || 'Failed to retrieve today\'s appointments'
    });
  }
};

export const getAppointmentsForDate = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { appointmentDate } = req.query;
    
    if (!appointmentDate || typeof appointmentDate !== 'string') {
      return res.status(400).json({
        error: 'appointmentDate query parameter is required'
      });
    }
    
    const appointments = await appointmentsService.getAppointmentsForDate(agentId, appointmentDate);
    res.json(appointments);
  } catch (err: any) {
    console.error('Error getting appointments for date:', err);
    res.status(500).json({
      error: 'Failed to get appointments for date',
      Message: err.message || 'Failed to retrieve appointments for the specified date'
    });
  }
};

export const getWeekViewAppointments = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { weekStartDate } = req.query;
    
    const weekView = await appointmentsService.getWeekViewAppointments(agentId, weekStartDate as string);
    res.json(weekView);
  } catch (err: any) {
    console.error('Error getting week view appointments:', err);
    res.status(500).json({
      error: 'Failed to get week view',
      Message: err.message || 'Failed to retrieve week view appointments'
    });
  }
};

export const getCalendarAppointments = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { month, year } = req.query;
    
    if (!month || !year || isNaN(Number(month)) || isNaN(Number(year))) {
      return res.status(400).json({
        error: 'Invalid or missing month/year parameters'
      });
    }
    
    const calendar = await appointmentsService.getCalendarViewAppointments(
      agentId, 
      Number(month), 
      Number(year)
    );
    res.json(calendar);
  } catch (err: any) {
    console.error('Error getting calendar appointments:', err);
    res.status(500).json({
      error: 'Failed to get calendar view',
      Message: err.message || 'Failed to retrieve calendar appointments'
    });
  }
};

export const updateAppointmentStatus = async (req: Request, res: Response) => {
  try {
    const { agentId, appointmentId } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        Success: false,
        Message: 'Status is required'
      });
    }
    
    const result = await appointmentsService.updateAppointmentStatus(agentId, appointmentId, status);
    res.json(result);
  } catch (err: any) {
    console.error('Error updating appointment status:', err);
    res.status(500).json({
      Success: false,
      Message: err.message || 'Failed to update appointment status'
    });
  }
};

export const searchAppointments = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { searchTerm } = req.query;
    
    if (!searchTerm || typeof searchTerm !== 'string') {
      return res.status(400).json({
        error: 'searchTerm query parameter is required'
      });
    }
    
    const appointments = await appointmentsService.searchAppointments(agentId, searchTerm);
    res.json(appointments);
  } catch (err: any) {
    console.error('Error searching appointments:', err);
    res.status(500).json({
      error: 'Failed to search appointments',
      Message: err.message || 'Failed to search appointments'
    });
  }
};

export const checkAppointmentConflicts = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { appointmentDate, startTime, endTime, excludeAppointmentId } = req.body;
    
    if (!appointmentDate || !startTime || !endTime) {
      return res.status(400).json({
        hasConflicts: false,
        message: 'appointmentDate, startTime, and endTime are required'
      });
    }
    
    const conflicts = await appointmentsService.checkAppointmentConflicts(agentId, {
      appointmentDate,
      startTime,
      endTime,
      excludeAppointmentId
    });
    
    res.json(conflicts);
  } catch (err: any) {
    console.error('Error checking appointment conflicts:', err);
    res.status(500).json({
      hasConflicts: false,
      message: err.message || 'Failed to check conflicts'
    });
  }
};

export const getAppointmentStatistics = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    
    const stats = await appointmentsService.getAppointmentStatistics(agentId);
    res.json(stats);
  } catch (err: any) {
    console.error('Error getting appointment statistics:', err);
    res.status(500).json({
      error: 'Failed to get statistics',
      Message: err.message || 'Failed to retrieve appointment statistics'
    });
  }
};

export const searchClients = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.trim().length < 1) {
      return res.status(400).json({
        error: 'Search term (q) is required and must be at least 1 character'
      });
    }
    
    const clients = await appointmentsService.searchClients(agentId, q.trim());
    res.json(clients);
  } catch (err: any) {
    console.error('Error searching clients:', err);
    res.status(500).json({
      error: 'Failed to search clients',
      Message: err.message || 'Failed to search clients'
    });
  }
};