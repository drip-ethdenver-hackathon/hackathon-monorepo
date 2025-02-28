import WebSocket from 'ws';
import chalk from 'chalk';
import { Orchestrator } from '../framework/Orchestrator';


export function attachOrchestrator(
  wss: WebSocket.Server,
  orchestrator: Orchestrator
) {
  wss.on('connection', (ws) => {
    console.log(chalk.greenBright("Orchestrator stream client connected."));
    orchestrator.subscribe(ws);
  });
}
