import { prisma } from "../lib/prisma";
import { EventNotificationService } from "./eventNotificationService";

export class EventService {
  // ==========================================
  // 1. EVENT TYPE MASTER (SUPERADMIN)
  // ==========================================

  static async getEventTypes(onlyActive = true) {
    return prisma.eventTypeMaster.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { name: "asc" },
    });
  }

  static async createEventType(data: { name: string; description?: string }) {
    return prisma.eventTypeMaster.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        isActive: true,
      },
    });
  }

  static async updateEventType(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean },
  ) {
    return prisma.eventTypeMaster.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  static async deleteEventType(id: string) {
    return prisma.eventTypeMaster.delete({ where: { id } });
  }

  // ==========================================
  // 2. VENUE MASTER (SUPERADMIN)
  // ==========================================

  static async getVenues(onlyActive = true) {
    return prisma.venueMaster.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { name: "asc" },
    });
  }

  static async createVenue(data: {
    name: string;
    address?: string;
    capacity?: number;
    contactPerson?: string;
    contactNumber?: string;
    notes?: string;
  }) {
    return prisma.venueMaster.create({
      data: {
        name: data.name.trim(),
        address: data.address?.trim() || null,
        capacity: data.capacity ? Number(data.capacity) : null,
        contactPerson: data.contactPerson?.trim() || null,
        contactNumber: data.contactNumber?.trim() || null,
        notes: data.notes?.trim() || null,
        isActive: true,
      },
    });
  }

  static async updateVenue(
    id: string,
    data: {
      name?: string;
      address?: string;
      capacity?: number;
      contactPerson?: string;
      contactNumber?: string;
      notes?: string;
      isActive?: boolean;
    },
  ) {
    return prisma.venueMaster.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.address !== undefined ? { address: data.address?.trim() || null } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity ? Number(data.capacity) : null } : {}),
        ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson?.trim() || null } : {}),
        ...(data.contactNumber !== undefined ? { contactNumber: data.contactNumber?.trim() || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  static async deleteVenue(id: string) {
    return prisma.venueMaster.delete({ where: { id } });
  }

  // ==========================================
  // 3. HIERARCHICAL REQUIREMENT MASTER (SUPERADMIN)
  // ==========================================

  static async getRequirementsTree(onlyActive = true) {
    const allRequirements = await prisma.requirementMaster.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { name: "asc" },
    });

    const roots = allRequirements.filter((req) => !req.parentId);
    const buildTree = (parentReq: any): any => {
      const children = allRequirements.filter(
        (child) => child.parentId === parentReq.id,
      );
      return {
        ...parentReq,
        children: children.map((child: any) => buildTree(child)),
      };
    };

    return roots.map((root) => buildTree(root));
  }

  static async createRequirement(data: {
    parentId?: string | null;
    name: string;
    description?: string;
  }) {
    return prisma.requirementMaster.create({
      data: {
        parentId: data.parentId || null,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        isActive: true,
      },
    });
  }

  static async updateRequirement(
    id: string,
    data: {
      parentId?: string | null;
      name?: string;
      description?: string;
      isActive?: boolean;
    },
  ) {
    return prisma.requirementMaster.update({
      where: { id },
      data: {
        ...(data.parentId !== undefined ? { parentId: data.parentId || null } : {}),
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  static async deleteRequirement(id: string) {
    return prisma.requirementMaster.delete({ where: { id } });
  }

  // ==========================================
  // 4. VENUE OCCUPANCY CONFLICT CHECKER
  // ==========================================

  static async checkVenueOccupancyConflict(options: {
    mode: string;
    venueId?: string | null;
    customVenueName?: string | null;
    eventDate: Date;
    eventEndDate?: Date | null;
    startTime: Date;
    endTime?: Date | null;
    excludeEventId?: string;
  }) {
    if (options.mode === "ONLINE") return;

    const { venueId, customVenueName, eventDate, eventEndDate, startTime, endTime, excludeEventId } = options;

    if (!venueId && !customVenueName) return;

    const reqStartDateStr = eventDate.toISOString().substring(0, 10);
    const reqEndDateStr = eventEndDate ? eventEndDate.toISOString().substring(0, 10) : reqStartDateStr;

    const startHours = startTime.getHours();
    const startMins = startTime.getMinutes();

    let reqStartDateTime = new Date(`${reqStartDateStr}T${String(startHours).padStart(2, "0")}:${String(startMins).padStart(2, "0")}:00`);

    let reqEndDateTime: Date;
    if (endTime) {
      const endHours = endTime.getHours();
      const endMins = endTime.getMinutes();
      reqEndDateTime = new Date(`${reqEndDateStr}T${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}:00`);
    } else {
      reqEndDateTime = new Date(reqStartDateTime.getTime() + 2 * 60 * 60 * 1000);
    }

    const venueWhere: any = {
      status: { not: "CANCELLED" },
      mode: { in: ["OFFLINE", "HYBRID"] },
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
      OR: [
        ...(venueId ? [{ venueId }] : []),
        ...(customVenueName ? [{ customVenueName: { equals: customVenueName.trim() } }] : []),
      ],
    };

    const existingEvents = await prisma.event.findMany({
      where: venueWhere,
      include: { venue: true },
    });

    for (const ev of existingEvents) {
      const evStartDateStr = new Date(ev.eventDate).toISOString().substring(0, 10);
      const evEndDateStr = ev.eventEndDate ? new Date(ev.eventEndDate).toISOString().substring(0, 10) : evStartDateStr;

      const evStartH = new Date(ev.startTime).getHours();
      const evStartM = new Date(ev.startTime).getMinutes();

      const existingStart = new Date(`${evStartDateStr}T${String(evStartH).padStart(2, "0")}:${String(evStartM).padStart(2, "0")}:00`);

      let existingEnd: Date;
      if (ev.endTime) {
        const evEndH = new Date(ev.endTime).getHours();
        const evEndM = new Date(ev.endTime).getMinutes();
        existingEnd = new Date(`${evEndDateStr}T${String(evEndH).padStart(2, "0")}:${String(evEndM).padStart(2, "0")}:00`);
      } else {
        existingEnd = new Date(existingStart.getTime() + 2 * 60 * 60 * 1000);
      }

      if (reqStartDateTime < existingEnd && reqEndDateTime > existingStart) {
        const venueNameStr = ev.venue?.name || ev.customVenueName || "Selected Venue";
        const conflictTimeStr = `${existingStart.toLocaleDateString()} ${existingStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${existingEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        throw new Error(
          `🚫 Venue Occupied Conflict: The venue "${venueNameStr}" is already booked for event "${ev.title}" during ${conflictTimeStr}. Please choose a different time or venue.`,
        );
      }
    }
  }

  // ==========================================
  // 5. CORE EVENT LISTING & STATS
  // ==========================================

  static async getEvents(query: any, currentUser: any) {
    const {
      search,
      startDate,
      endDate,
      eventType,
      venueId,
      mode,
      priority,
      status,
      assignedEmployeeId,
      isOutsourced,
      page = 1,
      limit = 10,
    } = query;

    const where: any = {};

    if (currentUser.role === "EMPLOYEE") {
      where.OR = [
        { assignees: { some: { employeeId: currentUser.id } } },
        { requirements: { some: { assignedEmployeeId: currentUser.id } } },
        { eventHostId: currentUser.id },
      ];
    } else if (assignedEmployeeId) {
      where.assignees = {
        some: {
          employeeId: assignedEmployeeId,
        },
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { customVenueName: { contains: search } },
        { customEventType: { contains: search } },
        { customEventHostName: { contains: search } },
      ];
    }

    if (startDate && endDate) {
      where.eventDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.eventDate = { gte: new Date(startDate) };
    } else if (endDate) {
      where.eventDate = { lte: new Date(endDate) };
    }

    if (mode) where.mode = mode;
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (venueId) where.venueId = venueId;
    if (isOutsourced !== undefined) {
      where.isOutsourced = isOutsourced === "true" || isOutsourced === true;
    }

    if (eventType) {
      where.OR = [
        ...(where.OR || []),
        {
          eventTypes: {
            some: {
              eventTypeId: eventType,
            },
          },
        },
        { customEventType: { contains: eventType } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          venue: true,
          eventHostUser: {
            select: { id: true, firstName: true, lastName: true, email: true, department: true },
          },
          eventTypes: {
            include: { eventType: true },
          },
          assignees: {
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  department: true,
                },
              },
            },
          },
          requirements: {
            include: {
              assignedEmployee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  department: true,
                },
              },
            },
          },
        },
        orderBy: [{ eventDate: "asc" }, { startTime: "asc" }],
        skip,
        take,
      }),
      prisma.event.count({ where }),
    ]);

    const baseScopeWhere = currentUser.role === "EMPLOYEE"
      ? {
          OR: [
            { assignees: { some: { employeeId: currentUser.id } } },
            { requirements: { some: { assignedEmployeeId: currentUser.id } } },
            { eventHostId: currentUser.id },
          ],
        }
      : {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalEvents,
      upcomingEventsCount,
      todaysEventsCount,
      inProgressCount,
      completedCount,
      cancelledCount,
      nextUpcomingEventArr,
    ] = await Promise.all([
      prisma.event.count({ where: baseScopeWhere }),
      prisma.event.count({
        where: {
          ...baseScopeWhere,
          eventDate: { gte: tomorrow },
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
      }),
      prisma.event.count({
        where: {
          ...baseScopeWhere,
          eventDate: { gte: today, lt: tomorrow },
        },
      }),
      prisma.event.count({
        where: {
          ...baseScopeWhere,
          status: "IN_PROGRESS",
        },
      }),
      prisma.event.count({
        where: {
          ...baseScopeWhere,
          status: "COMPLETED",
        },
      }),
      prisma.event.count({
        where: {
          ...baseScopeWhere,
          status: "CANCELLED",
        },
      }),
      prisma.event.findMany({
        where: {
          ...baseScopeWhere,
          eventDate: { gte: today },
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
        include: {
          venue: true,
          eventHostUser: { select: { id: true, firstName: true, lastName: true } },
          assignees: {
            include: {
              employee: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: [{ eventDate: "asc" }, { startTime: "asc" }],
        take: 1,
      }),
    ]);

    return {
      events,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
      summary: {
        totalEvents,
        upcomingEvents: upcomingEventsCount,
        todaysEvents: todaysEventsCount,
        inProgress: inProgressCount,
        completed: completedCount,
        cancelled: cancelledCount,
        nextUpcomingEvent: nextUpcomingEventArr[0] || null,
      },
    };
  }

  // ==========================================
  // 6. EVENT DETAILS
  // ==========================================

  static async getEventById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        venue: true,
        eventHostUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
          },
        },
        eventTypes: {
          include: {
            eventType: true,
          },
        },
        requirements: {
          include: {
            requirement: {
              include: {
                parent: true,
              },
            },
            assignedEmployee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
              },
            },
          },
        },
        assignees: {
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
                profilePicture: true,
              },
            },
          },
        },
        checklists: {
          orderBy: { createdAt: "asc" },
        },
        attachments: {
          orderBy: { createdAt: "desc" },
        },
        activityLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!event) throw new Error("Event not found");
    return event;
  }

  // ==========================================
  // 7. CREATE EVENT
  // ==========================================

  static async createEvent(data: any, createdById: string) {
    const {
      title,
      description,
      eventDate,
      eventEndDate,
      startTime,
      endTime,
      priority = "NORMAL",
      mode = "OFFLINE",
      status = "SCHEDULED",
      onlinePlatform,
      meetingLink,
      meetingId,
      onlineNotes,
      venueId,
      customVenueName,
      customVenueAddress,
      eventHostId,
      customEventHostName,
      customEventType,
      eventTypeIdList = [],
      requirements = [],
      assignees = [],
      isOutsourced = false,
      outsourcingDescription,
      vendorName,
      vendorContactPerson,
      vendorContactNumber,
      vendorEmail,
      estimatedCost,
      outsourcingNotes,
      internalNotes,
      checklists = [],
      attachments = [],
    } = data;

    const startDt = new Date(startTime);
    const eventDateDt = new Date(eventDate);
    const eventEndDateDt = eventEndDate ? new Date(eventEndDate) : null;

    if (eventEndDateDt && eventEndDateDt < eventDateDt) {
      throw new Error("Event end date cannot be earlier than start date");
    }

    if (endTime) {
      const endDt = new Date(endTime);
      if (!eventEndDateDt && endDt < startDt) {
        throw new Error("End time cannot be earlier than start time on the same date");
      }
    }

    await this.checkVenueOccupancyConflict({
      mode,
      venueId,
      customVenueName,
      eventDate: eventDateDt,
      eventEndDate: eventEndDateDt,
      startTime: startDt,
      endTime: endTime ? new Date(endTime) : null,
    });

    const createdBy = await prisma.user.findUnique({
      where: { id: createdById },
      select: { firstName: true, lastName: true },
    });

    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        eventDate: eventDateDt,
        eventEndDate: eventEndDateDt,
        startTime: startDt,
        endTime: endTime ? new Date(endTime) : null,
        priority,
        mode,
        status,
        onlinePlatform: mode !== "OFFLINE" ? onlinePlatform || null : null,
        meetingLink: mode !== "OFFLINE" ? meetingLink || null : null,
        meetingId: mode !== "OFFLINE" ? meetingId || null : null,
        onlineNotes: mode !== "OFFLINE" ? onlineNotes || null : null,
        venueId: mode !== "ONLINE" && venueId ? venueId : null,
        customVenueName: mode !== "ONLINE" && customVenueName ? customVenueName.trim() : null,
        customVenueAddress: mode !== "ONLINE" && customVenueAddress ? customVenueAddress.trim() : null,
        eventHostId: eventHostId || null,
        customEventHostName: customEventHostName?.trim() || null,
        customEventType: customEventType?.trim() || null,
        isOutsourced: Boolean(isOutsourced),
        outsourcingDescription: isOutsourced ? outsourcingDescription?.trim() || null : null,
        vendorName: isOutsourced ? vendorName?.trim() || null : null,
        vendorContactPerson: isOutsourced ? vendorContactPerson?.trim() || null : null,
        vendorContactNumber: isOutsourced ? vendorContactNumber?.trim() || null : null,
        vendorEmail: isOutsourced ? vendorEmail?.trim() || null : null,
        estimatedCost: isOutsourced && estimatedCost ? Number(estimatedCost) : null,
        outsourcingNotes: isOutsourced ? outsourcingNotes?.trim() || null : null,
        internalNotes: internalNotes?.trim() || null,
        createdById,
        eventTypes: {
          create: eventTypeIdList.map((typeId: string) => ({
            eventTypeId: typeId,
          })),
        },
        requirements: {
          create: requirements.map((req: any) => ({
            requirementId: req.requirementId || null,
            customRequirement: req.customRequirement?.trim() || null,
            quantity: req.quantity ? Number(req.quantity) : null,
            unit: req.unit?.trim() || null,
            notes: req.notes?.trim() || null,
            departmentName: req.departmentName?.trim() || null,
            assignedEmployeeId: req.assignedEmployeeId || null,
          })),
        },
        assignees: {
          create: assignees.map((ass: any) => ({
            employeeId: ass.employeeId || null,
            externalName: ass.externalName?.trim() || null,
            responsibilityType: ass.responsibilityType || "Responsible Person",
            notes: ass.notes?.trim() || null,
            acknowledgementStatus: "PENDING",
          })),
        },
        checklists: {
          create: checklists.map((item: any) => ({
            title: typeof item === "string" ? item.trim() : item.title.trim(),
            completed: Boolean(item.completed),
          })),
        },
        attachments: {
          create: attachments.map((att: any) => ({
            name: att.name || "Attachment",
            fileUrl: att.fileUrl,
            fileSize: att.fileSize || null,
            fileType: att.fileType || null,
            uploadedById: createdById,
          })),
        },
        activityLogs: {
          create: {
            action: "CREATED",
            description: `Event created by ${createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : "HR User"}`,
            performedById: createdById,
          },
        },
      },
      include: {
        venue: true,
        eventHostUser: true,
        assignees: {
          include: {
            employee: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
        requirements: {
          include: {
            requirement: true,
            assignedEmployee: {
              select: { firstName: true, lastName: true, email: true, department: true },
            },
          },
        },
      },
    });

    try {
      await Promise.all([
        EventNotificationService.sendEventCreatedNotifications(event, createdBy),
        EventNotificationService.sendRequirementNotifications(event, createdBy),
      ]);
      EventNotificationService.triggerQueueProcessing();
    } catch (emailErr) {
      console.error("Failed to dispatch event email notifications:", emailErr);
    }

    return event;
  }

  // ==========================================
  // 8. UPDATE EVENT
  // ==========================================

  static async updateEvent(id: string, data: any, updatedById: string) {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) throw new Error("Event not found");

    const updatedBy = await prisma.user.findUnique({
      where: { id: updatedById },
      select: { firstName: true, lastName: true },
    });

    const {
      title,
      description,
      eventDate,
      eventEndDate,
      startTime,
      endTime,
      priority,
      mode,
      status,
      cancellationReason,
      onlinePlatform,
      meetingLink,
      meetingId,
      onlineNotes,
      venueId,
      customVenueName,
      customVenueAddress,
      eventHostId,
      customEventHostName,
      customEventType,
      eventTypeIdList = [],
      requirements = [],
      assignees = [],
      isOutsourced,
      outsourcingDescription,
      vendorName,
      vendorContactPerson,
      vendorContactNumber,
      vendorEmail,
      estimatedCost,
      outsourcingNotes,
      internalNotes,
    } = data;

    const eventDateDt = eventDate ? new Date(eventDate) : new Date(existing.eventDate);
    const eventEndDateDt = eventEndDate !== undefined ? (eventEndDate ? new Date(eventEndDate) : null) : existing.eventEndDate;
    const startDt = startTime ? new Date(startTime) : new Date(existing.startTime);
    const endDt = endTime !== undefined ? (endTime ? new Date(endTime) : null) : existing.endTime;

    if (eventEndDateDt && eventEndDateDt < eventDateDt) {
      throw new Error("Event end date cannot be earlier than start date");
    }

    await this.checkVenueOccupancyConflict({
      mode: mode || existing.mode,
      venueId: venueId !== undefined ? venueId : existing.venueId,
      customVenueName: customVenueName !== undefined ? customVenueName : existing.customVenueName,
      eventDate: eventDateDt,
      eventEndDate: eventEndDateDt,
      startTime: startDt,
      endTime: endDt,
      excludeEventId: id,
    });

    await Promise.all([
      prisma.eventEventType.deleteMany({ where: { eventId: id } }),
      prisma.eventRequirement.deleteMany({ where: { eventId: id } }),
      prisma.eventAssignee.deleteMany({ where: { eventId: id } }),
    ]);

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        ...(title ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(eventDate ? { eventDate: eventDateDt } : {}),
        eventEndDate: eventEndDateDt,
        ...(startTime ? { startTime: startDt } : {}),
        endTime: endDt,
        ...(priority ? { priority } : {}),
        ...(mode ? { mode } : {}),
        ...(status ? { status } : {}),
        ...(cancellationReason !== undefined ? { cancellationReason: cancellationReason?.trim() || null } : {}),
        onlinePlatform: mode !== "OFFLINE" ? onlinePlatform || null : null,
        meetingLink: mode !== "OFFLINE" ? meetingLink || null : null,
        meetingId: mode !== "OFFLINE" ? meetingId || null : null,
        onlineNotes: mode !== "OFFLINE" ? onlineNotes || null : null,
        venueId: mode !== "ONLINE" && venueId ? venueId : null,
        customVenueName: mode !== "ONLINE" && customVenueName ? customVenueName.trim() : null,
        customVenueAddress: mode !== "ONLINE" && customVenueAddress ? customVenueAddress.trim() : null,
        eventHostId: eventHostId || null,
        customEventHostName: customEventHostName?.trim() || null,
        customEventType: customEventType?.trim() || null,
        isOutsourced: Boolean(isOutsourced),
        outsourcingDescription: isOutsourced ? outsourcingDescription?.trim() || null : null,
        vendorName: isOutsourced ? vendorName?.trim() || null : null,
        vendorContactPerson: isOutsourced ? vendorContactPerson?.trim() || null : null,
        vendorContactNumber: isOutsourced ? vendorContactNumber?.trim() || null : null,
        vendorEmail: isOutsourced ? vendorEmail?.trim() || null : null,
        estimatedCost: isOutsourced && estimatedCost ? Number(estimatedCost) : null,
        outsourcingNotes: isOutsourced ? outsourcingNotes?.trim() || null : null,
        internalNotes: internalNotes?.trim() || null,
        eventTypes: {
          create: eventTypeIdList.map((typeId: string) => ({
            eventTypeId: typeId,
          })),
        },
        requirements: {
          create: requirements.map((req: any) => ({
            requirementId: req.requirementId || null,
            customRequirement: req.customRequirement?.trim() || null,
            quantity: req.quantity ? Number(req.quantity) : null,
            unit: req.unit?.trim() || null,
            notes: req.notes?.trim() || null,
            departmentName: req.departmentName?.trim() || null,
            assignedEmployeeId: req.assignedEmployeeId || null,
          })),
        },
        assignees: {
          create: assignees.map((ass: any) => ({
            employeeId: ass.employeeId || null,
            externalName: ass.externalName?.trim() || null,
            responsibilityType: ass.responsibilityType || "Responsible Person",
            notes: ass.notes?.trim() || null,
            acknowledgementStatus: ass.acknowledgementStatus || "PENDING",
          })),
        },
        activityLogs: {
          create: {
            action: "UPDATED",
            description: `Event details updated by ${updatedBy ? `${updatedBy.firstName} ${updatedBy.lastName}` : "User"}`,
            performedById: updatedById,
          },
        },
      },
      include: {
        venue: true,
        eventHostUser: true,
        assignees: {
          include: {
            employee: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        requirements: {
          include: {
            requirement: true,
            assignedEmployee: {
              select: { firstName: true, lastName: true, email: true, department: true },
            },
          },
        },
      },
    });

    try {
      await Promise.all([
        EventNotificationService.sendEventCreatedNotifications(updatedEvent, updatedBy, true),
        EventNotificationService.sendRequirementNotifications(updatedEvent, updatedBy, true),
      ]);
      EventNotificationService.triggerQueueProcessing();
    } catch (emailErr) {
      console.error("Failed to send event update emails:", emailErr);
    }

    return updatedEvent;
  }

  // ==========================================
  // 9. ACKNOWLEDGE ASSIGNMENT (RSVP ACCEPT / DECLINE)
  // ==========================================

  static async acknowledgeAssignment(
    eventId: string,
    acknowledgementStatus: "ACCEPTED" | "DECLINED",
    userId: string,
  ) {
    const assignee = await prisma.eventAssignee.findFirst({
      where: {
        eventId,
        employeeId: userId,
      },
    });

    if (!assignee) {
      throw new Error("You are not assigned to this event.");
    }

    const updatedAssignee = await prisma.eventAssignee.update({
      where: { id: assignee.id },
      data: {
        acknowledgementStatus,
        acknowledgedAt: new Date(),
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    await prisma.eventActivityLog.create({
      data: {
        eventId,
        action: "ACKNOWLEDGEMENT_UPDATED",
        description: `${user ? `${user.firstName} ${user.lastName}` : "Assigned Employee"} ${acknowledgementStatus === "ACCEPTED" ? "accepted" : "declined"} event assignment`,
        performedById: userId,
      },
    });

    return updatedAssignee;
  }

  // ==========================================
  // 10. UPDATE EVENT STATUS / CANCEL EVENT
  // ==========================================

  static async updateEventStatus(
    id: string,
    status: any,
    cancellationReason: string | undefined,
    userId: string,
  ) {
    const existing = await prisma.event.findUnique({
      where: { id },
      include: {
        assignees: {
          include: {
            employee: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!existing) throw new Error("Event not found");

    if (status === "CANCELLED" && !cancellationReason) {
      throw new Error("Cancellation reason is required when cancelling an event");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        status,
        ...(status === "CANCELLED"
          ? { cancellationReason: cancellationReason?.trim() || null }
          : {}),
        activityLogs: {
          create: {
            action: status === "CANCELLED" ? "CANCELLED" : "STATUS_CHANGED",
            description: `Status changed to ${status}${status === "CANCELLED" ? `. Reason: ${cancellationReason}` : ""} by ${user ? `${user.firstName} ${user.lastName}` : "User"}`,
            performedById: userId,
          },
        },
      },
    });

    if (status === "CANCELLED") {
      try {
        await EventNotificationService.sendEventCancelledNotifications(
          existing,
          cancellationReason || "",
          user,
        );
        EventNotificationService.triggerQueueProcessing();
      } catch (emailErr) {
        console.error("Failed to send cancellation notifications:", emailErr);
      }
    }

    return updatedEvent;
  }

  // ==========================================
  // 11. DELETE EVENT
  // ==========================================

  static async deleteEvent(id: string) {
    return prisma.event.delete({ where: { id } });
  }

  static async deleteBulkEvents(ids: string[]) {
    if (!ids || !ids.length) return { count: 0 };
    return prisma.event.deleteMany({
      where: {
        id: { in: ids },
      },
    });
  }

  // ==========================================
  // 12. CHECKLIST MANAGEMENT
  // ==========================================

  static async toggleChecklistItem(checklistId: string, completed: boolean, userId: string) {
    return prisma.eventChecklist.update({
      where: { id: checklistId },
      data: {
        completed,
        completedById: completed ? userId : null,
        completedAt: completed ? new Date() : null,
      },
    });
  }

  static async addChecklistItem(eventId: string, title: string) {
    return prisma.eventChecklist.create({
      data: {
        eventId,
        title: title.trim(),
        completed: false,
      },
    });
  }

  static async deleteChecklistItem(checklistId: string) {
    return prisma.eventChecklist.delete({ where: { id: checklistId } });
  }
}
