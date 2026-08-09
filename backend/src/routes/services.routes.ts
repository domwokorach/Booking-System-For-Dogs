import { Router } from "express";

import { prisma } from "../config/prisma.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        active: true,
      },
    });

    return res.json({ services });
  } catch (error) {
    return next(error);
  }
});

export default router;
