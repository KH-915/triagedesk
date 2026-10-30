import { Router } from 'express';
import {
  createTicketHandler,
  listTicketsHandler,
  getTicketHandler,
  updateTicketHandler,
} from '../controllers/ticket.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// All ticket routes require authentication.
// Fine-grained role checks happen inside the service layer (ticket.service.ts)
// rather than at the route level, so a single middleware here is enough.
router.use(authenticate);

router.get('/', listTicketsHandler);
router.post('/', createTicketHandler);
router.get('/:id', getTicketHandler);
router.patch('/:id', updateTicketHandler);

export default router;
