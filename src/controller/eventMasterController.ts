import { Request, Response } from "express";
import { EventService } from "../services/eventService";

export class EventMasterController {
  // ==========================================
  // EVENT TYPE MASTER
  // ==========================================

  static async getEventTypes(req: Request, res: Response) {
    try {
      const onlyActive = req.query.all !== "true";
      const eventTypes = await EventService.getEventTypes(onlyActive);
      res.json({ success: true, data: eventTypes });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createEventType(req: Request, res: Response) {
    try {
      const eventType = await EventService.createEventType(req.body);
      res.status(201).json({ success: true, message: "Event type created successfully", data: eventType });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateEventType(req: Request, res: Response) {
    try {
      const eventType = await EventService.updateEventType(req.params.id, req.body);
      res.json({ success: true, message: "Event type updated successfully", data: eventType });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteEventType(req: Request, res: Response) {
    try {
      await EventService.deleteEventType(req.params.id);
      res.json({ success: true, message: "Event type deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // ==========================================
  // VENUE MASTER
  // ==========================================

  static async getVenues(req: Request, res: Response) {
    try {
      const onlyActive = req.query.all !== "true";
      const venues = await EventService.getVenues(onlyActive);
      res.json({ success: true, data: venues });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createVenue(req: Request, res: Response) {
    try {
      const venue = await EventService.createVenue(req.body);
      res.status(201).json({ success: true, message: "Venue created successfully", data: venue });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateVenue(req: Request, res: Response) {
    try {
      const venue = await EventService.updateVenue(req.params.id, req.body);
      res.json({ success: true, message: "Venue updated successfully", data: venue });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteVenue(req: Request, res: Response) {
    try {
      await EventService.deleteVenue(req.params.id);
      res.json({ success: true, message: "Venue deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // ==========================================
  // REQUIREMENT MASTER HIERARCHY
  // ==========================================

  static async getRequirementsTree(req: Request, res: Response) {
    try {
      const onlyActive = req.query.all !== "true";
      const tree = await EventService.getRequirementsTree(onlyActive);
      res.json({ success: true, data: tree });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createRequirement(req: Request, res: Response) {
    try {
      const requirement = await EventService.createRequirement(req.body);
      res.status(201).json({ success: true, message: "Requirement created successfully", data: requirement });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateRequirement(req: Request, res: Response) {
    try {
      const requirement = await EventService.updateRequirement(req.params.id, req.body);
      res.json({ success: true, message: "Requirement updated successfully", data: requirement });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteRequirement(req: Request, res: Response) {
    try {
      await EventService.deleteRequirement(req.params.id);
      res.json({ success: true, message: "Requirement deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
