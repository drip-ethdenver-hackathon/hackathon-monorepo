// src/routes/incomingCall.ts
import { Router } from 'express';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

export const incomingCallRouter = Router();

incomingCallRouter.all('/', (req, res) => {
  const response = new VoiceResponse();
  const host = req.get('host');

  response.connect().stream({ url: `wss://${host}/media-stream` });

  res.type('text/xml');
  res.send(response.toString());
});
