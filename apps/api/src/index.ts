import express from 'express';
import dotenv from 'dotenv';
import http from 'http';
import WebSocket from 'ws';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

// Our orchestrator + agents
import { Orchestrator } from './lib/framework/Orchestrator';
import { SendCryptoAgent } from './lib/agents/SendCryptoAgent';
import { ExchangeTokensAgent } from './lib/agents/ExchangeTokensAgent';
import { CheckBalanceAgent } from './lib/agents/CheckBalanceAgent';

import { attachTwilio } from './lib/ws/twilio';
import { attachOrchestrator } from './lib/ws/orchestrator';

dotenv.config();

const app = express();

// Create orchestrator and register agents
const orchestrator = new Orchestrator();
orchestrator.registerAgent(new SendCryptoAgent());
orchestrator.registerAgent(new ExchangeTokensAgent());
orchestrator.registerAgent(new CheckBalanceAgent());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY in .env file.');
}

const PORT = parseInt(process.env.PORT || '5050');

// System message for GPT-based orchestration
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

// Basic middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    status: true,
    message: 'Up and running.'
  });
});

app.all('/incoming-call', (req, res) => {
  const response = new VoiceResponse();
  const host = req.get('host');
  response.connect().stream({ url: `wss://${host}/media-stream` });

  res.type('text/xml');
  res.send(response.toString());
});

const server = http.createServer(app);

// =========== TWILIO MEDIA STREAM =============
const mediaStreamServer = new WebSocket.Server({ noServer: true });
attachTwilio(mediaStreamServer, orchestrator, OPENAI_API_KEY, SYSTEM_MESSAGE);

// =========== ORCHESTRATOR LOG STREAM =========
const orchestratorStreamServer = new WebSocket.Server({ noServer: true });
attachOrchestrator(orchestratorStreamServer, orchestrator);

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/media-stream') {
    mediaStreamServer.handleUpgrade(request, socket, head, (ws) => {
      mediaStreamServer.emit('connection', ws, request);
    });
  } else if (request.url === '/orchestrator-stream') {
    orchestratorStreamServer.handleUpgrade(request, socket, head, (ws) => {
      orchestratorStreamServer.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Start listening
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
