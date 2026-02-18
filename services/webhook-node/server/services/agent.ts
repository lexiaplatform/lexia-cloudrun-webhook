import { invokeLLM, Message, Tool } from "../_core/llm";
import { getAsaasService } from "./asaas";
import { getInfosimplesService } from "./infosimples";
import { getDb } from "../db";
import { conversations, messages as dbMessages } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Léxia Agent Service
 * Centraliza a lógica do agente, persona e ferramentas
 */

const AGENT_INSTRUCTION = `
Você é a LIA (Lexia), assistente oficial da Léxia.

FUNIL (sempre):
1) Comece mostrando pelo menos 3 veículos disponíveis (nome + preço semanal + 1 linha).
2) Faça 1 pergunta por vez para recomendar a melhor opção (cidade, data de início, uso).
3) Peça o CPF em algum momento dizendo que é para calcular a melhor proposta e avançar na reserva.
4) Antes de pedir QUALQUER documento: para reservar e iniciar o cadastro, informe a taxa única de R$ 14,90 e pergunte se pode enviar o link de pagamento.
5) Ao confirmar pagamento (via webhook Asaas), execute as consultas de background usando run_infosimples_checks.
6) Só depois disso, continue o cadastro e solicite documentos se necessário.

Contatos oficiais (sempre que conveniente):
- Site: https://lexiaveiculos.com.br
- Instagram: https://www.instagram.com/lexiaveiculos/
- WhatsApp da empresa: (11) 94270-0854 (link: https://wa.me/5511942700854)

Regras:
- Responda em PT-BR, direto e profissional.
- Faça perguntas curtas, uma por vez.
- Não invente informações: se algo não estiver disponível, diga o que precisa.
- Sempre que o cliente demonstrar intenção de fechar, pedir ajuda humana, estiver com dúvida sobre pagamento/documentos, ou houver travamento na conversa, ofereça o WhatsApp e envie o link clicável.
- Se o cliente pedir “falar com atendente”, envie imediatamente o link do WhatsApp.
`;

const TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "list_available_vehicles",
      description: "Lista veículos disponíveis para aluguel",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", default: 3 }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_payment_link",
      description: "Cria um link de pagamento para a taxa de cadastro de R$ 14,90",
      parameters: {
        type: "object",
        properties: {
          cpf: { type: "string", description: "CPF do cliente" }
        },
        required: ["cpf"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_infosimples_checks",
      description: "Executa consultas de background (InfoSimples) após o pagamento",
      parameters: {
        type: "object",
        properties: {
          cpf: { type: "string", description: "CPF do cliente" }
        },
        required: ["cpf"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "build_customer_report",
      description: "Gera um relatório formatado dos dados encontrados no InfoSimples para o cliente",
      parameters: {
        type: "object",
        properties: {
          cpf: { type: "string" },
          infosimples_data: { type: "object" }
        },
        required: ["cpf", "infosimples_data"]
      }
    }
  }
];

export class AgentService {
  /**
   * Processar mensagem do usuário e retornar resposta do agente
   */
  async processMessage(sessionId: string, text: string, phoneNumber: string) {
    const db = await getDb();
    
    // 1. Obter histórico da conversa
    const history = await db
      .select()
      .from(dbMessages)
      .where(eq(dbMessages.from, phoneNumber))
      .orderBy(desc(dbMessages.createdAt))
      .limit(10);

    const messages: Message[] = [
      { role: "system", content: AGENT_INSTRUCTION },
      ...history.reverse().map(msg => ({
        role: (msg.from === phoneNumber ? "user" : "assistant") as any,
        content: msg.content || ""
      })),
      { role: "user", content: text }
    ];

    // 2. Chamar LLM
    let response = await invokeLLM({
      messages,
      tools: TOOLS,
      toolChoice: "auto"
    });

    let assistantMessage = response.choices[0].message;

    // 3. Lidar com chamadas de ferramentas (loop simples)
    if (assistantMessage.tool_calls) {
      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        let toolResult: any;

        try {
          if (toolCall.function.name === "list_available_vehicles") {
            toolResult = this.listVehicles();
          } else if (toolCall.function.name === "create_payment_link") {
            const asaas = getAsaasService();
            toolResult = await asaas.createSignupFeePaymentLink(sessionId, args.cpf);
          } else if (toolCall.function.name === "run_infosimples_checks") {
            const infosimples = getInfosimplesService();
            const cpfData = await infosimples.queryCPF(args.cpf);
            toolResult = {
              status: "success",
              data: cpfData,
              message: "Consultas realizadas com sucesso. Prossiga com o relatório."
            };
          } else if (toolCall.function.name === "build_customer_report") {
            toolResult = this.buildCustomerReport(args.cpf, args.infosimples_data);
          }
        } catch (error: any) {
          toolResult = { error: error.message };
        }

        messages.push(assistantMessage as any);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(toolResult)
        });
      }

      // Chamar novamente após ferramentas
      response = await invokeLLM({ messages });
      assistantMessage = response.choices[0].message;
    }

    return assistantMessage.content as string;
  }

  private listVehicles() {
    return [
      {
        id: "veh_001",
        title: "Hyundai HB20 1.0 (2023)",
        weekly_price: 650.00,
        description: "Completo, GNV, revisado e pronto para rodar.",
      },
      {
        id: "veh_002",
        title: "Chevrolet Onix 1.0 (2022)",
        weekly_price: 620.00,
        description: "Econômico, ar-condicionado e manutenção em dia.",
      },
      {
        id: "veh_003",
        title: "Fiat Cronos (2023)",
        weekly_price: 690.00,
        description: "Sedan confortável com porta-malas grande.",
      },
    ];
  }

  private buildCustomerReport(cpf: string, data: any) {
    const body = data.body || {};
    const endereco = body.endereco || {};
    
    let report = `📄 *Relatório de Validação — Pré-cadastro Léxia*\n`;
    report += `*CPF:* ${cpf}\n\n`;
    report += `*1) Resumo*\n- *Situação geral:* apto\n\n`;
    report += `*2) Dados encontrados*\n`;
    report += `- *Nome:* ${body.nome || "—"}\n`;
    report += `- *Data de nascimento:* ${body.data_nascimento || "—"}\n`;
    report += `- *Endereço/UF:* ${endereco.municipio || "—"}/${endereco.uf || "—"}\n`;
    report += `- *Situação fiscal:* ${body.situacao || "—"}\n\n`;
    report += `*3) Confirmação*\n`;
    report += `Você confirma que *nome, data de nascimento e endereço* acima estão corretos?\n`;
    report += `Se tiver algo errado, me diga exatamente *qual item* e a correção.`;

    return { report_text: report };
  }
}

export const agentService = new AgentService();
