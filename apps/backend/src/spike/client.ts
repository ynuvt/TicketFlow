import { io, Socket } from 'socket.io-client';
import { KitchenEvent, ReplayResponsePayload } from '../types/events';

export class ReconnectClient {
  public socket: Socket;
  public lastProcessedSequence: number = 0;
  public receivedEvents: KitchenEvent[] = [];
  public status: 'CONNECTING' | 'ONLINE' | 'SYNCING' = 'CONNECTING';
  private liveBuffer: KitchenEvent[] = [];

  constructor(private serverUrl: string, private kitchenId: string, private stationId: string) {
    this.socket = io(this.serverUrl, { autoConnect: false });
    this.setupListeners();
  }

  public connect() {
    this.socket.connect();
  }

  public disconnect() {
    this.socket.disconnect();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      this.socket.emit('station:join', { kitchenId: this.kitchenId, stationId: this.stationId });

      if (this.lastProcessedSequence > 0) {
        this.requestReplay();
      } else {
        this.status = 'ONLINE';
      }
    });

    this.socket.on('order:transition', (event: KitchenEvent) => {
      this.handleIncomingEvent(event);
    });

    this.socket.on('order:replayResponse', (response: ReplayResponsePayload) => {
      this.handleReplayResponse(response);
    });
  }

  public requestReplay() {
    this.status = 'SYNCING';
    this.socket.emit('order:replayRequest', {
      kitchenId: this.kitchenId,
      stationId: this.stationId,
      lastProcessedSequence: this.lastProcessedSequence,
    });
  }

  public handleIncomingEvent(event: KitchenEvent) {
    if (this.status === 'SYNCING') {
      this.liveBuffer.push(event);
      return;
    }

    if (event.sequenceNumber <= this.lastProcessedSequence) {
      return;
    }

    if (event.sequenceNumber === this.lastProcessedSequence + 1) {
      this.applyEvent(event);
      return;
    }

    if (event.sequenceNumber > this.lastProcessedSequence + 1) {
      this.liveBuffer.push(event);
      this.requestReplay();
    }
  }

  public handleReplayResponse(response: ReplayResponsePayload) {
    const sortedReplayed = [...response.events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    for (const evt of sortedReplayed) {
      if (evt.sequenceNumber > this.lastProcessedSequence) {
        this.applyEvent(evt);
      }
    }

    const sortedBuffer = [...this.liveBuffer].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    this.liveBuffer = [];

    for (const evt of sortedBuffer) {
      if (evt.sequenceNumber > this.lastProcessedSequence) {
        if (evt.sequenceNumber === this.lastProcessedSequence + 1) {
          this.applyEvent(evt);
        } else if (evt.sequenceNumber > this.lastProcessedSequence + 1) {
          this.liveBuffer.push(evt);
          this.requestReplay();
          return;
        }
      }
    }

    this.status = 'ONLINE';
  }

  private applyEvent(event: KitchenEvent) {
    this.lastProcessedSequence = event.sequenceNumber;
    this.receivedEvents.push(event);
  }
}
