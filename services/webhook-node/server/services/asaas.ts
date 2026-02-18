import axios from "axios";

/**
 * Asaas Integration Service
 * Gerencia links de pagamento e cobranças
 */

interface AsaasConfig {
  apiKey: string;
  baseUrl: string;
}

export class AsaasService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.ASAAS_API_KEY || "";
    this.baseUrl = process.env.ASAAS_ENV === "sandbox" 
      ? "https://api-sandbox.asaas.com/v3" 
      : "https://api.asaas.com/v3";

    if (!this.apiKey) {
      console.warn("[AsaasService] ASAAS_API_KEY not configured");
    }
  }

  private get headers() {
    return {
      "access_token": this.apiKey,
      "Content-Type": "application/json"
    };
  }

  /**
   * Criar link de pagamento para taxa de cadastro
   */
  async createSignupFeePaymentLink(sessionId: string, cpf: string, value: number = 14.90) {
    try {
      const payload = {
        name: "Taxa de cadastro Léxia",
        description: `Taxa única para reservar veículo e iniciar cadastro (CPF: ${cpf}).`,
        value: value,
        billingType: "UNDEFINED",
        chargeType: "DETACHED",
        dueDateLimitDays: 3,
        externalReference: sessionId,
      };

      const response = await axios.post(`${this.baseUrl}/paymentLinks`, payload, {
        headers: this.headers
      });

      return {
        id: response.data.id,
        url: response.data.url,
        raw: response.data
      };
    } catch (error: any) {
      console.error("[AsaasService] Error creating payment link:", error.response?.data || error.message);
      throw new Error(`Asaas error: ${error.response?.data?.errors?.[0]?.description || error.message}`);
    }
  }
}

let asaasService: AsaasService | null = null;

export function getAsaasService(): AsaasService {
  if (!asaasService) {
    asaasService = new AsaasService();
  }
  return asaasService;
}
