import express from 'express';
import dotenv from 'dotenv';
import http from 'http';
import WebSocket from 'ws';
import chalk from 'chalk';
import { incomingCallRouter } from './routes/incomingCall';
import { simulateCallRouter } from './routes/simulateCall';
import { Orchestrator } from './lib/framework/Orchestrator';
import { SendCryptoAgent } from './lib/agents/SendCryptoAgent';
import { ExchangeTokensAgent } from './lib/agents/ExchangeTokensAgent';
import { CheckBalanceAgent } from './lib/agents/CheckBalanceAgent';
import { attachTwilio } from './lib/ws/twilio';
import { attachOrchestrator } from './lib/ws/orchestrator';
import { chatMessageHandler } from './routes/chatMessage';
import { agentsHandler } from './routes/agents';
import { ScheduledBalanceAgent } from './lib/agents/ScheduledBalanceAgent';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const orchestrator = new Orchestrator();
orchestrator.registerAgent(new SendCryptoAgent());
orchestrator.registerAgent(new ExchangeTokensAgent());
orchestrator.registerAgent(new CheckBalanceAgent());
orchestrator.registerAgent(new ScheduledBalanceAgent());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.log(chalk.redBright('Missing OPENAI_API_KEY in environment.'));
  throw new Error('Missing OPENAI_API_KEY in .env file.');
}

const PORT = parseInt(process.env.PORT || '5050');

const SYSTEM_MESSAGE = `
You are the Orchestration Assistant, responsible for coordinating with specialized sub-agents 
to fulfill user requests.

1. Discover & Call Agents: You have access to multiple registered agents (tools/functions). These agents 
   handle tasks such as sending crypto, exchanging tokens, checking balances, or performing environment lookups. 
   When you need specific functionality, call the relevant agent by name, providing correct JSON arguments 
   according to its schema.

2. Non-Deterministic Reasoning: You can reason about the user’s request in a flexible, non-deterministic way. 
   If necessary, break down complex requests into multiple steps. You may call multiple agents or re-check 
   environment data until you have sufficient information to respond confidently.

3. Central Coordination: You are the final decision maker. Defer tasks to sub-agents only when relevant, 
   then gather their results and form a concise, direct response or next action. If multiple agents can perform 
   similar tasks, select the one most appropriate based on context (e.g., best conversion rate, best yield, etc.).

4. Maintain Accuracy & Clarity: Ensure each agent call is valid and well-formed. Avoid speculation, and keep 
   track of context when deciding which agent to call next. If no agent is relevant, answer from your own 
   reasoning within these system instructions.

5. Concise Voice Responses: You will be speaking over a Twilio voice call. Keep responses short, direct, and 
   helpful to the user. Do not share internal chain-of-thought. 
   Only detail what's necessary to accomplish the user’s objective.
`;

app.get('/', (req, res) => {
  res.redirect('/index.html');
});

app.use('/incoming-call', incomingCallRouter);

app.post(
  '/chat-message',
  chatMessageHandler(orchestrator, SYSTEM_MESSAGE, OPENAI_API_KEY)
);

app.use('/simulate-call', simulateCallRouter);

app.use('/agents', agentsHandler(orchestrator));

const server = http.createServer(app);

const mediaStreamServer = new WebSocket.Server({ noServer: true });
attachTwilio(mediaStreamServer, orchestrator, OPENAI_API_KEY, SYSTEM_MESSAGE);

const orchestratorStreamServer = new WebSocket.Server({ noServer: true });
attachOrchestrator(orchestratorStreamServer, orchestrator);

const agentStreamServer = new WebSocket.Server({ noServer: true });
const agentStreamClients = new Set<WebSocket>();

agentStreamServer.on('connection', (ws) => {
  console.log(chalk.greenBright('Agent stream client connected.'));
  agentStreamClients.add(ws);
  const fullList = orchestrator.listAgents().map(agent => ({
    name: agent.getName(),
    description: agent.getDescription(),
    contextInfo: agent.getContextInfo(),
    status: orchestrator.getAgentStatus(agent.getName()) || 'IDLE'
  }));
  ws.send(JSON.stringify({ type: 'agent_full_list', agents: fullList }));

  ws.on('close', () => {
    console.log(chalk.yellow('Agent stream client disconnected.'));
    agentStreamClients.delete(ws);
  });
});

function broadcastAgentEvent(eventData: any) {
  console.log(chalk.magenta('Broadcasting agent event:'), eventData);
  for (const ws of agentStreamClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(eventData));
    }
  }
}

orchestrator.onAgentInvoked((agentName) => {
  console.log(chalk.blueBright(`Agent invoked: ${agentName}, setting status to ACTIVE.`));
  broadcastAgentEvent({ type: 'agent_status_changed', name: agentName, status: 'ACTIVE' });
});

orchestrator.onAgentResult((agentName, success) => {
  const status = success ? 'IDLE' : 'ERROR';
  console.log(chalk.blueBright(`Agent result: ${agentName}, success=${success}, new status=${status}`));
  broadcastAgentEvent({ type: 'agent_status_changed', name: agentName, status });
});

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/media-stream') {
    console.log(chalk.cyan('Upgrading connection to media-stream WebSocket.'));
    mediaStreamServer.handleUpgrade(request, socket, head, (ws) => {
      mediaStreamServer.emit('connection', ws, request);
    });
  } else if (request.url === '/orchestrator-stream') {
    console.log(chalk.cyan('Upgrading connection to orchestrator-stream WebSocket.'));
    orchestratorStreamServer.handleUpgrade(request, socket, head, (ws) => {
      orchestratorStreamServer.emit('connection', ws, request);
    });
  } else if (request.url === '/agent-stream') {
    console.log(chalk.cyan('Upgrading connection to agent-stream WebSocket.'));
    agentStreamServer.handleUpgrade(request, socket, head, (ws) => {
      agentStreamServer.emit('connection', ws, request);
    });
  } else {
    console.log(chalk.red(`Unknown WebSocket upgrade request: ${request.url}. Destroying socket.`));
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(chalk.green(`Server is listening on port ${PORT}`));
});
