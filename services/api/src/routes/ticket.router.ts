import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { Role } from '@prisma/client';
import {
  createTicketHandler,
  listTicketsHandler,
  getTicketHandler,
  updateTicketHandler,
  importTicketsHandler,
} from '../controllers/ticket.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { AppError } from '../middleware/errorHandler';
import { IMPORT_MAX_BYTES } from '../validators/ticket.validator';

const router = Router();

// Import files are small (≤ 5 MB) and parsed immediately, so keep them in memory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_MAX_BYTES, files: 1 },
}).single('file');

/** Runs multer and turns its errors (size, unexpected field) into the API's error shape. */
function uploadFile(req: Request, res: Response, next: NextFunction): void {
  upload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(
        err.code === 'LIMIT_FILE_SIZE'
          ? new AppError(413, 'FILE_TOO_LARGE', 'The file is larger than the 5 MB limit.')
          : new AppError(400, 'VALIDATION_ERROR', `Upload error: ${err.message}.`),
      );
    }
    next(err);
  });
}

// All ticket routes require authentication.
// Fine-grained role checks happen inside the service layer (ticket.service.ts)
// rather than at the route level, so a single middleware here is enough.
// Import is the exception: the role is checked before accepting the upload.
router.use(authenticate);

router.get('/', listTicketsHandler);
router.post('/', createTicketHandler);
router.post('/import', requireRole(Role.AGENT), uploadFile, importTicketsHandler);
router.get('/:id', getTicketHandler);
router.patch('/:id', updateTicketHandler);

export default router;
