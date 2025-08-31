import { poolPromise } from '../../db';
import { Appointment, CreateAppointmentRequest, AppointmentResponse, UpdateAppointmentRequest, AppointmentFilters, WeekViewData, CalendarViewData, ConflictCheckRequest, ConflictCheckResponse, AppointmentStatistics, ClientSearchResult } from '../interfaces/appointment';
import emailService from '../nodemailer/emailservice';


export class AppointmentsService {
  /**
   * Convert database row to consistent PascalCase Appointment format
   */
  private convertToAppointment(row: any): Appointment {
    return {
      appointmentId: row.appointment_id || row.appointmentId || row.appointmentid,
      clientId: row.client_id || row.clientId || row.clientid,
      agentId: row.agent_id || row.agentId || row.agentid,
      clientName: row.client_name || row.clientName || row.clientname,
      clientPhone: row.client_phone || row.clientPhone || row.clientphone,
      title: row.title,
      description: row.description,
      appointmentDate: row.appointment_date || row.appointmentDate || row.appointmentdate,
      startTime: row.start_time || row.startTime || row.starttime,
      endTime: row.end_time || row.endTime || row.endtime,
      location: row.location,
      type: row.type,
      status: row.status,
      priority: row.priority,
      notes: row.notes,
      reminderSet: row.reminder_set ?? row.reminderSet ?? row.reminderset ?? false,
      createdDate: row.created_date || row.createdDate || row.createddate,
      modifiedDate: row.modified_date || row.modifiedDate || row.modifieddate,
      isActive: row.is_active ?? row.isActive ?? row.isactive ?? true,
      clientEmail: row.client_email || row.clientEmail || row.clientemail,
      clientAddress: row.client_address || row.clientAddress || row.clientaddress,
      formattedTime: row.formatted_time || row.formattedTime || row.formattedtime
    };
  }

  /**
   * Convert array of database rows to Appointment array
   */
  private convertToAppointments(rows: any[]): Appointment[] {
    return rows.map(row => this.convertToAppointment(row));
  }

  /**
   * Create a new appointment
   */
  public async createAppointment(agentId: string, appointmentData: CreateAppointmentRequest): Promise<AppointmentResponse> {
    try {
      const pool = await poolPromise;
      
      const result = await pool.query(`
        SELECT * FROM sp_create_appointment(
          $1::UUID,
          $2::UUID,
          $3::VARCHAR(200),
          $4::TEXT,
          $5::DATE,
          $6::TIME,
          $7::TIME,
          $8::VARCHAR(200),
          $9::VARCHAR(50),
          $10::VARCHAR(50),
          $11::VARCHAR(20),
          $12::TEXT,
          $13::BOOLEAN
        )
      `, [
        agentId,
        appointmentData.clientId,
        appointmentData.title,
        appointmentData.description || null,
        appointmentData.appointmentDate,
        appointmentData.startTime,
        appointmentData.endTime,
        appointmentData.location || null,
        appointmentData.type,
        appointmentData.status,
        appointmentData.priority || 'Medium',
        appointmentData.notes || null,
        appointmentData.reminderSet ?? false
      ]);

      const row = result.rows[0];
      
      const response: AppointmentResponse = {
        Success: row.success === 1 || row.Success,
        Message: row.message || row.Message || 'Appointment created successfully',
        AppointmentId: row.appointment_id || row.AppointmentId || row.appointmentid
      };

      // Send appointment confirmation email if successful
      if (response.Success && response.AppointmentId) {
        try {
          const appointmentDetails = await this.getAppointmentById(agentId, response.AppointmentId);
          if (appointmentDetails && appointmentDetails.clientEmail) {
            const appointmentTime = new Date(`${appointmentData.appointmentDate}T${appointmentData.startTime}`);
            const formattedTime = appointmentTime.toLocaleString('en-KE', { 
              timeZone: 'Africa/Nairobi',
              dateStyle: 'full',
              timeStyle: 'short'
            });

            await emailService.sendMail(
              appointmentDetails.clientEmail,
              'Appointment Confirmation - Aminius App',
              `Hi ${appointmentDetails.clientName},\n\nYour appointment "${appointmentData.title}" has been scheduled for ${formattedTime}.\n\nLocation: ${appointmentData.location || 'Not specified'}\n\nThank you!`,
              `<h3>Appointment Confirmation</h3><p>Hi ${appointmentDetails.clientName},</p><p>Your appointment "<strong>${appointmentData.title}</strong>" has been scheduled for:</p><p><strong>${formattedTime}</strong></p><p>Location: ${appointmentData.location || 'Not specified'}</p>`
            );
          }
        } catch (emailError) {
          console.error('Failed to send appointment confirmation email:', emailError);
          // Don't fail the appointment creation if email fails
        }
      }

      return response;
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      
      if (error.code === '23505') {
        return {
          Success: false,
          Message: 'Appointment conflict detected - time slot already booked'
        };
      } else if (error.code === '23503') {
        return {
          Success: false,
          Message: 'Invalid client or agent ID provided'
        };
      } else if (error.code === '23514') {
        return {
          Success: false,
          Message: 'Invalid appointment data format'
        };
      } else {
        return {
          Success: false,
          Message: `Failed to create appointment: ${error.message || 'Unknown error'}`
        };
      }
    }
  }

  /**
   * Update an existing appointment
   */
  public async updateAppointment(agentId: string, appointmentId: string, appointmentData: UpdateAppointmentRequest): Promise<AppointmentResponse> {
    try {
      const pool = await poolPromise;
      
      const result = await pool.query(`
        SELECT * FROM sp_update_appointment(
          $1::UUID,
          $2::UUID,
          $3::UUID,
          $4::VARCHAR(200),
          $5::TEXT,
          $6::DATE,
          $7::TIME,
          $8::TIME,
          $9::VARCHAR(200),
          $10::VARCHAR(50),
          $11::VARCHAR(50),
          $12::VARCHAR(20),
          $13::TEXT,
          $14::BOOLEAN
        )
      `, [
        appointmentId,
        agentId,
        appointmentData.clientId || null,
        appointmentData.title || null,
        appointmentData.description || null,
        appointmentData.appointmentDate || null,
        appointmentData.startTime || null,
        appointmentData.endTime || null,
        appointmentData.location || null,
        appointmentData.type || null,
        appointmentData.status || null,
        appointmentData.priority || null,
        appointmentData.notes || null,
        appointmentData.reminderSet ?? null
      ]);

      const row = result.rows[0];
      
      return {
        Success: row.success === 1 || row.Success,
        Message: row.message || row.Message || 'Appointment updated successfully'
      };
    } catch (error: any) {
      console.error('Error updating appointment:', error);
      throw new Error(`Failed to update appointment: ${error.message}`);
    }
  }

  /**
   * Delete an appointment
   */
  public async deleteAppointment(agentId: string, appointmentId: string): Promise<AppointmentResponse> {
    try {
      const pool = await poolPromise;
      
      const result = await pool.query('SELECT * FROM sp_delete_appointment($1,$2)', [appointmentId, agentId]);
      const row = result.rows[0];
      
      return {
        Success: row.success === 1 || row.Success,
        Message: row.message || row.Message || 'Appointment deleted successfully'
      };
    } catch (error: any) {
      console.error('Error deleting appointment:', error);
      throw new Error(`Failed to delete appointment: ${error.message}`);
    }
  }

  /**
   * Get appointment by ID
   */
  public async getAppointmentById(agentId: string, appointmentId: string): Promise<Appointment | null> {
    try {
      const pool = await poolPromise;
      const result = await pool.query('SELECT * FROM sp_get_appointment_by_id($1,$2)', [appointmentId, agentId]);
      
      if (!result.rows.length) return null;
      
      return this.convertToAppointment(result.rows[0]);
    } catch (error: any) {
      console.error('Error getting appointment by ID:', error);
      throw new Error(`Failed to get appointment: ${error.message}`);
    }
  }

  /**
   * Get all appointments with optional filters
   */
  public async getAllAppointments(agentId: string, filters?: AppointmentFilters): Promise<Appointment[]> {
    try {
      const pool = await poolPromise;
      
      const result = await pool.query(`
        SELECT * FROM sp_get_all_appointments(
          $1::UUID,
          $2::INTEGER,
          $3::INTEGER,
          $4::VARCHAR(50),
          $5::VARCHAR(50),
          $6::VARCHAR(20),
          $7::DATE,
          $8::DATE,
          $9::UUID,
          $10::VARCHAR(100)
        )
      `, [
        agentId,
        filters?.pageSize || 100,
        filters?.pageNumber || 1,
        filters?.status || null,
        filters?.type || null,
        filters?.priority || null,
        filters?.startDate || null,
        filters?.endDate || null,
        filters?.clientId || null,
        filters?.searchTerm || null
      ]);
      
      return this.convertToAppointments(result.rows);
    } catch (error: any) {
      console.error('Error getting all appointments:', error);
      throw new Error(`Failed to get appointments: ${error.message}`);
    }
  }

  /**
   * Get today's appointments
   */
  public async getTodayAppointments(agentId: string): Promise<Appointment[]> {
    try {
      const pool = await poolPromise;
      const result = await pool.query('SELECT * FROM sp_get_today_appointments($1)', [agentId]);
      
      return this.convertToAppointments(result.rows);
    } catch (error: any) {
      console.error('Error getting today appointments:', error);
      throw new Error(`Failed to get today's appointments: ${error.message}`);
    }
  }

  /**
   * Get appointments for specific date
   */
  public async getAppointmentsForDate(agentId: string, appointmentDate: string): Promise<Appointment[]> {
    try {
      const pool = await poolPromise;
      const result = await pool.query('SELECT * FROM sp_get_appointments_for_date($1,$2)', [agentId, appointmentDate]);
      
      return this.convertToAppointments(result.rows);
    } catch (error: any) {
      console.error('Error getting appointments for date:', error);
      throw new Error(`Failed to get appointments for date: ${error.message}`);
    }
  }

  /**
   * Get week view appointments
   */
  public async getWeekViewAppointments(agentId: string, weekStartDate?: string): Promise<WeekViewData[]> {
    try {
      const pool = await poolPromise;
      const result = await pool.query('SELECT * FROM sp_get_week_view_appointments($1,$2)', [
        agentId, 
        weekStartDate || null
      ]);
      
      // Group appointments by date
      const weekData: { [key: string]: WeekViewData } = {};
      
      result.rows.forEach(row => {
        const date = row.appointment_date || row.date;
        const dayName = row.day_name || row.dayName;
        
        if (!weekData[date]) {
          weekData[date] = {
            date,
            dayName,
            appointments: []
          };
        }
        
        if (row.appointment_id || row.appointmentId || row.appointmentid) {
          weekData[date].appointments.push(this.convertToAppointment(row));
        }
      });
      
      return Object.values(weekData);
    } catch (error: any) {
      console.error('Error getting week view appointments:', error);
      throw new Error(`Failed to get week view: ${error.message}`);
    }
  }

  /**
   * Get calendar view appointments
   */
  public async getCalendarViewAppointments(agentId: string, month: number, year: number): Promise<CalendarViewData[]> {
    try {
      const pool = await poolPromise;
      const result = await pool.query('SELECT * FROM sp_get_calendar_appointments($1,$2,$3)', [agentId, month, year]);
      
      // Group appointments by date
      const calendarData: { [key: string]: CalendarViewData } = {};
      
      result.rows.forEach(row => {
        const date = row.appointment_date || row.date;
        
        if (!calendarData[date]) {
          calendarData[date] = {
            date,
            appointmentCount: 0,
            appointments: []
          };
        }
        
        if (row.appointment_id || row.appointmentId || row.appointmentid) {
          calendarData[date].appointments.push(this.convertToAppointment(row));
          calendarData[date].appointmentCount++;
        }
      });
      
      return Object.values(calendarData);
    } catch (error: any) {
      console.error('Error getting calendar view appointments:', error);
      throw new Error(`Failed to get calendar view: ${error.message}`);
    }
  }

  /**
   * Update appointment status
   */
  public async updateAppointmentStatus(agentId: string, appointmentId: string, status: string): Promise<AppointmentResponse> {
    try {
      const pool = await poolPromise;
      const result = await pool.query('SELECT * FROM sp_update_appointment_status($1,$2,$3)', [
        appointmentId, 
        agentId, 
        status
      ]);
      
      const row = result.rows[0];
      
      return {
        Success: row.success === 1 || row.Success,
        Message: row.message || row.Message || 'Status updated successfully'
      };
    } catch (error: any) {
      console.error('Error updating appointment status:', error);
      throw new Error(`Failed to update status: ${error.message}`);
    }
  }

  /**
   * Search appointments
   */
  public async searchAppointments(agentId: string, searchTerm: string): Promise<Appointment[]> {
    try {
      const pool = await poolPromise;
      const result = await pool.query('SELECT * FROM sp_search_appointments($1,$2)', [agentId, searchTerm]);
      
      return this.convertToAppointments(result.rows);
    } catch (error: any) {
      console.error('Error searching appointments:', error);
      throw new Error(`Failed to search appointments: ${error.message}`);
    }
  }

  /**
   * Check for appointment conflicts
   */
  public async checkAppointmentConflicts(agentId: string, conflictData: ConflictCheckRequest): Promise<ConflictCheckResponse> {
    try {
      const pool = await poolPromise;
      const result = await pool.query(`
        SELECT * FROM sp_check_appointment_conflicts(
          $1::UUID,
          $2::DATE,
          $3::TIME,
          $4::TIME,
          $5::UUID
        )
      `, [
        agentId,
        conflictData.appointmentDate,
        conflictData.startTime,
        conflictData.endTime,
        conflictData.excludeAppointmentId || null
      ]);

      const row = result.rows[0];
      const hasConflicts = row.has_conflicts || row.hasConflicts || false;
      
      let conflictingAppointments: Appointment[] = [];
      if (hasConflicts && result.rows.length > 0) {
        conflictingAppointments = result.rows
          .filter(r => r.appointment_id || r.appointmentId || r.appointmentid)
          .map(r => this.convertToAppointment(r));
      }

      return {
        conflicts: row.conflicts || hasConflicts,
        hasConflicts,
        conflictingAppointments,
        message: row.message || row.Message || (hasConflicts ? 'Time conflicts found' : 'No conflicts')
      };
    } catch (error: any) {
      console.error('Error checking appointment conflicts:', error);
      throw new Error(`Failed to check conflicts: ${error.message}`);
    }
  }

  /**
   * Get appointment statistics
   */
  public async getAppointmentStatistics(agentId: string): Promise<AppointmentStatistics> {
    try {
      const pool = await poolPromise;
      const result = await pool.query('SELECT * FROM sp_get_appointment_statistics($1)', [agentId]);
      
      if (!result.rows.length) {
        return {
          todayCount: 0,
          weekCount: 0,
          monthCount: 0,
          completedCount: 0,
          totalAppointments: 0,
          todayAppointments: 0,
          weekAppointments: 0,
          monthAppointments: 0,
          completedAppointments: 0,
          pendingAppointments: 0,
          statusBreakdown: {},
          typeBreakdown: {},
          scheduledCount: 0,
          confirmedCount: 0,
          cancelledCount: 0
        };
      }

      const row = result.rows[0];
      
      return {
        todayCount: row.today_count || row.todayCount || 0,
        weekCount: row.week_count || row.weekCount || 0,
        monthCount: row.month_count || row.monthCount || 0,
        completedCount: row.completed_count || row.completedCount || 0,
        totalAppointments: row.total_appointments || row.totalAppointments || 0,
        todayAppointments: row.today_appointments || row.todayAppointments || 0,
        weekAppointments: row.week_appointments || row.weekAppointments || 0,
        monthAppointments: row.month_appointments || row.monthAppointments || 0,
        completedAppointments: row.completed_appointments || row.completedAppointments || 0,
        pendingAppointments: row.pending_appointments || row.pendingAppointments || 0,
        statusBreakdown: row.status_breakdown || row.statusBreakdown || {},
        typeBreakdown: row.type_breakdown || row.typeBreakdown || {},
        scheduledCount: row.scheduled_count || row.scheduledCount || 0,
        confirmedCount: row.confirmed_count || row.confirmedCount || 0,
        cancelledCount: row.cancelled_count || row.cancelledCount || 0
      };
    } catch (error: any) {
      console.error('Error getting appointment statistics:', error);
      throw new Error(`Failed to get statistics: ${error.message}`);
    }
  }

  /**
   * Search clients for appointments
   */
  public async searchClients(agentId: string, searchTerm: string): Promise<ClientSearchResult[]> {
    try {
      const pool = await poolPromise;
      const result = await pool.query('SELECT * FROM sp_search_clients_for_appointments($1,$2)', [agentId, searchTerm]);
      
      return result.rows.map(row => ({
        clientId: row.client_id || row.clientId || row.clientid,
        clientName: row.client_name || row.clientName || row.clientname,
        phone: row.phone,
        email: row.email,
        address: row.address,
        policyNumber: row.policy_number || row.policyNumber || row.policynumber,
        status: row.status
      }));
    } catch (error: any) {
      console.error('Error searching clients:', error);
      throw new Error(`Failed to search clients: ${error.message}`);
    }
  }
}