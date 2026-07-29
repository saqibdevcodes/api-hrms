import { Request, Response } from "express";
import { EventService } from "../services/eventService";

export class EventController {
  /**
   * Get listing of events + summary metrics + next upcoming event
   */
  static async getEvents(req: Request, res: Response) {
    try {
      const currentUser = (req as any).user;
      const result = await EventService.getEvents(req.query, currentUser);
      res.json({
        success: true,
        message: "Events retrieved successfully",
        data: result,
      });
    } catch (error: any) {
      console.error("Error fetching events:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get single event by ID with full details
   */
  static async getEventById(req: Request, res: Response) {
    try {
      const event = await EventService.getEventById(req.params.id);
      res.json({ success: true, data: event });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  /**
   * Create new event
   */
  static async createEvent(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const event = await EventService.createEvent(req.body, userId);
      res.status(201).json({
        success: true,
        message: "Event created successfully",
        data: event,
      });
    } catch (error: any) {
      console.error("Error creating event:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Update existing event
   */
  static async updateEvent(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const event = await EventService.updateEvent(req.params.id, req.body, userId);
      res.json({
        success: true,
        message: "Event updated successfully",
        data: event,
      });
    } catch (error: any) {
      console.error("Error updating event:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Update status (e.g. Cancel Event)
   */
  static async updateEventStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { status, cancellationReason } = req.body;
      const event = await EventService.updateEventStatus(
        req.params.id,
        status,
        cancellationReason,
        userId,
      );
      res.json({
        success: true,
        message: `Event status updated to ${status}`,
        data: event,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Acknowledge Event Assignment (RSVP ACCEPT / DECLINE)
   */
  static async acknowledgeAssignment(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { status } = req.body;
      const updated = await EventService.acknowledgeAssignment(
        req.params.id,
        status,
        userId,
      );
      res.json({
        success: true,
        message: `Assignment acknowledged as ${status}`,
        data: updated,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Delete event
   */
  static async deleteEvent(req: Request, res: Response) {
    try {
      await EventService.deleteEvent(req.params.id);
      res.json({ success: true, message: "Event deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Bulk delete events
   */
  static async deleteBulkEvents(req: Request, res: Response) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || !ids.length) {
        return res.status(400).json({ success: false, message: "Please provide an array of event IDs to delete." });
      }
      const result = await EventService.deleteBulkEvents(ids);
      res.json({
        success: true,
        message: `Successfully deleted ${result.count} event(s)`,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Toggle checklist item completed
   */
  static async toggleChecklistItem(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { completed } = req.body;
      const item = await EventService.toggleChecklistItem(
        req.params.checklistId,
        Boolean(completed),
        userId,
      );
      res.json({ success: true, data: item });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Add checklist item to event
   */
  static async addChecklistItem(req: Request, res: Response) {
    try {
      const { title } = req.body;
      const item = await EventService.addChecklistItem(req.params.id, title);
      res.status(201).json({ success: true, data: item });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Delete checklist item
   */
  static async deleteChecklistItem(req: Request, res: Response) {
    try {
      await EventService.deleteChecklistItem(req.params.checklistId);
      res.json({ success: true, message: "Checklist item deleted" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
