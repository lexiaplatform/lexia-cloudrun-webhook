import express, { Request, Response } from 'express';
import { processMessageWithAgent } from '../services/vertex-ai';

const router = express.Router();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'lexia_token_123';

// Webhook verification
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
});

// Message handling
router.post('/webhook', async (req: Request, res: Response) => {
  const body = req.body;

  if (body.object) {
    if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const from = body.entry[0].changes[0].value.messages[0].from; // sender phone number
      const msg_body = body.entry[0].changes[0].value.messages[0].text.body; // message body

      try {
        const agentResponse = await processMessageWithAgent(msg_body);

        // TODO: Send the agent's response back to the user via WhatsApp Cloud API

        res.sendStatus(200);
      } catch (error) {
        console.error('Error processing message:', error);
        res.sendStatus(500);
      }
    }
  } else {
    res.sendStatus(404);
  }
});

export const createWhatsAppRouter = () => router;
