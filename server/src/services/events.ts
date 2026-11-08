import type { FastifyReply } from 'fastify';

class EventBroker {
  private clients: Set<FastifyReply> = new Set();

  addClient(reply: FastifyReply) {
    this.clients.add(reply);
    reply.raw.on('close', () => {
      this.clients.delete(reply);
    });
  }

  broadcast(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const reply of this.clients) {
      try {
        reply.raw.write(payload);
      } catch (err) {
        this.clients.delete(reply);
      }
    }
  }
}

export const eventBroker = new EventBroker();
