import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/auth.js";
import { uploadFileToCloud } from "../services/storage.service.js";
import { HttpError } from "../utils/http-error.js";
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
router.use(requireAuth);
router.post("/upload", upload.single("file"), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new HttpError(400, "No file uploaded.");
        }
        const result = await uploadFileToCloud({
            filename: req.file.originalname,
            mimeType: req.file.mimetype,
            buffer: req.file.buffer,
        });
        return res.status(201).json(result);
    }
    catch (error) {
        return next(error);
    }
});
export default router;
