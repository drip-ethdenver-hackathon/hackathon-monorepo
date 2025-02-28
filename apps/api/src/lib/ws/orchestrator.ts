import WebSocket from 'ws';
import { Orchestrator } from '../framework/Orchestrator';


export function attachOrchestrator(
  wss: WebSocket.Server,
  orchestrator: Orchestrator
) {
  wss.on('connection', (ws) => {
    console.log("Orchestrator stream client connected.");
    // Subscribe this WS to orchestrator events
    orchestrator.subscribe(ws);
  });
}
