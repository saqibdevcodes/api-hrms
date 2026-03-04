import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const createAdvanceSalaryRequest = async (req: Request, res: Response) => {
  const { employeeId, reason, daysCount, Status } = req.body;
  if (!req.body) {
    return res.status(400).json({ message: "Bad Request" });
  } else {
    //now first check if the record of the same user is already there for the same month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const checkUserData = await prisma.advanceSalary.findFirst({
      where: {
        userId: employeeId,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        Status: { in: ["APPROVED", "PENDING"] },
      },
    });
    //now check if the user has not already a record then procees the record in the db
    if (checkUserData === null) {
      const adavanceSalary = await prisma.advanceSalary.create({
        data: {
          user: {
            connect: {
              id: employeeId,
            },
          },
          reason,
          daysCount,
          Status: "PENDING",
          ApprovedBy: "null",
        },
      });
      return res.status(200).json({
        adavanceSalary,
      });
    } else {
      return res.status(400).json({
        message: "You have already Requested advance salary this month",
      });
    }
  }
};

const fetchAllAdvanceSalary = async (req: Request, res: Response) => {
  //fetching all the advance salary data of users
  const allAdvanceSalary = await prisma.advanceSalary.findMany();
  if (allAdvanceSalary) {
    return res.status(200).json({
      message: "Successfully fetched all the advance salary records",
      data: allAdvanceSalary,
    });
  } else {
    return res.status(201).json({
      message: "There is no record found for the advance salary records",
    });
  }
};

const fetchAdvanceSalaryByUserId = async (req: Request, res: Response) => {
  //fethcing with respect to the id
  const { id } = req.params;
  const advanceSalaryById = await prisma.advanceSalary.findMany({
    where: {
      userId: id,
    },
  });

  if (advanceSalaryById.length > 0) {
    return res.status(200).json({
      message: "Data for the specific users fetch successfully",
      data: advanceSalaryById,
    });
  } else {
    return res.status(400).json({
      message: "Error or can't find any data for the specific user",
    });
  }
};

const updateAdvaceSalaryStatus = async (req: Request, res: Response) => {
  //update the status here
  const { id } = req.params;
  const { status } = req.body;

  const statusChanged = await prisma.advanceSalary.update({
    where: {
      id: id,
    },
    data: {
      Status: status,
    },
  });

  if (statusChanged) {
    return res.status(200).json({
      message: "The status has been changed successfully",
      statusChanged,
    });
  } else {
    return res.status(400).json({
      message: "The status does not changed",
      statusChanged,
    });
  }
};

export {
  fetchAllAdvanceSalary,
  createAdvanceSalaryRequest,
  fetchAdvanceSalaryByUserId,
  updateAdvaceSalaryStatus,
};
