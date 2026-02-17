import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

async function getAccessToken() {
  try {
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    return accessToken.token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw new Error('Failed to authenticate with Google Cloud.');
  }
}

export async function processMessageWithAgent(message: string): Promise<string> {
  const accessToken = await getAccessToken();

  const apiUrl = `https://${process.env.GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/${process.env.GOOGLE_CLOUD_LOCATION}/agents/${process.env.AGENT_ID}/sessions/12345:detectIntent`;

  const requestBody = {
    queryInput: {
      text: {
        text: message,
      },
      languageCode: 'pt-BR',
    },
  };

  try {
    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const fulfillmentText = response.data.queryResult.fulfillmentText;
    return fulfillmentText;
  } catch (error) {
    console.error('Error communicating with Vertex AI agent:', error.response.data);
    throw new Error('Failed to get response from the agent.');
  }
}
