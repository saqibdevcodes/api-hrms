export class ICalGenerator {
  /**
   * Format Date object into iCalendar UTC datetime format (YYYYMMDDTHHMMSSZ)
   */
  private static formatICalDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  /**
   * Generate RFC 5545 iCalendar (.ics) string for an event
   */
  static generateICS(eventData: {
    eventId: string;
    title: string;
    description?: string;
    eventDate: Date | string;
    eventEndDate?: Date | string | null;
    startTime: Date | string;
    endTime?: Date | string | null;
    venueName?: string;
    meetingLink?: string;
    recipientName: string;
    recipientEmail: string;
  }): string {
    const {
      eventId,
      title,
      description = "",
      eventDate,
      eventEndDate,
      startTime,
      endTime,
      venueName = "Specified Venue",
      meetingLink,
      recipientName,
      recipientEmail,
    } = eventData;

    const reqStartDateStr = new Date(eventDate).toISOString().substring(0, 10);
    const reqEndDateStr = eventEndDate ? new Date(eventEndDate).toISOString().substring(0, 10) : reqStartDateStr;

    const startDtObj = new Date(startTime);
    const startH = startDtObj.getHours();
    const startM = startDtObj.getMinutes();

    const startDateTime = new Date(`${reqStartDateStr}T${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}:00`);

    let endDateTime: Date;
    if (endTime) {
      const endDtObj = new Date(endTime);
      const endH = endDtObj.getHours();
      const endM = endDtObj.getMinutes();
      endDateTime = new Date(`${reqEndDateStr}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`);
    } else {
      endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);
    }

    const dtStart = this.formatICalDate(startDateTime);
    const dtEnd = this.formatICalDate(endDateTime);
    const dtStamp = this.formatICalDate(new Date());
    const location = meetingLink || venueName || "Specified Venue";

    const cleanTitle = title.replace(/[\r\n]/g, " ");
    const cleanDesc = (description + (meetingLink ? `\nMeeting Link: ${meetingLink}` : "")).replace(/[\r\n]/g, "\\n");

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Iris HRMS//Event Management Module//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:event-${eventId}-${Date.now()}@iris-hrms`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${cleanTitle}`,
      `DESCRIPTION:${cleanDesc}`,
      `LOCATION:${location}`,
      "STATUS:CONFIRMED",
      "SEQUENCE:0",
      `ORGANIZER;CN=Iris HRMS:mailto:noreply@iris-communications.com`,
      `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${recipientName}:mailto:${recipientEmail}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
  }

  /**
   * Generate quick Google Calendar link
   */
  static generateGoogleCalendarLink(eventData: {
    title: string;
    description?: string;
    eventDate: Date | string;
    eventEndDate?: Date | string | null;
    startTime: Date | string;
    endTime?: Date | string | null;
    venueName?: string;
    meetingLink?: string;
  }): string {
    const { title, description = "", eventDate, eventEndDate, startTime, endTime, venueName, meetingLink } = eventData;

    const reqStartDateStr = new Date(eventDate).toISOString().substring(0, 10);
    const reqEndDateStr = eventEndDate ? new Date(eventEndDate).toISOString().substring(0, 10) : reqStartDateStr;

    const startDtObj = new Date(startTime);
    const startH = startDtObj.getHours();
    const startM = startDtObj.getMinutes();

    const startDateTime = new Date(`${reqStartDateStr}T${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}:00`);

    let endDateTime: Date;
    if (endTime) {
      const endDtObj = new Date(endTime);
      const endH = endDtObj.getHours();
      const endM = endDtObj.getMinutes();
      endDateTime = new Date(`${reqEndDateStr}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`);
    } else {
      endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);
    }

    const dtStart = this.formatICalDate(startDateTime);
    const dtEnd = this.formatICalDate(endDateTime);

    const location = encodeURIComponent(meetingLink || venueName || "");
    const details = encodeURIComponent(description + (meetingLink ? `\nMeeting Link: ${meetingLink}` : ""));
    const text = encodeURIComponent(title);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dtStart}/${dtEnd}&details=${details}&location=${location}`;
  }
}
