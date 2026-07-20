import { httpServer } from './spike/server';

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`[TicketFlow Backend] Server running on port ${PORT}`);
});
