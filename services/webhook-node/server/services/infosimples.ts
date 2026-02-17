import axios, { AxiosInstance } from "axios";

/**
 * Infosimples Integration Service
 * Consulta dados de CPF/CNPJ via API Infosimples
 * Documentação: https://www.infosimples.com/
 */

interface InfosimplesConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
}

interface CPFQueryResult {
  status: number;
  body: {
    cpf: string;
    nome: string;
    data_nascimento: string;
    sexo: string;
    situacao: string;
    endereco: {
      logradouro: string;
      numero: string;
      complemento: string;
      bairro: string;
      municipio: string;
      uf: string;
      cep: string;
    };
  };
}

interface CNPJQueryResult {
  status: number;
  body: {
    cnpj: string;
    razao_social: string;
    nome_fantasia: string;
    situacao: string;
    data_abertura: string;
    endereco: {
      logradouro: string;
      numero: string;
      complemento: string;
      bairro: string;
      municipio: string;
      uf: string;
      cep: string;
    };
  };
}

class InfosimplesService {
  private client: AxiosInstance;
  private config: InfosimplesConfig;

  constructor(config: Partial<InfosimplesConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.INFOSIMPLES_API_KEY || "",
      baseUrl: config.baseUrl || "https://api.infosimples.com",
      timeout: config.timeout || 10000,
    };

    if (!this.config.apiKey) {
      throw new Error("INFOSIMPLES_API_KEY not configured");
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // Interceptor para logging
    this.client.interceptors.request.use((config) => {
      console.log(`[Infosimples] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[Infosimples] Response: ${response.status}`);
        return response;
      },
      (error) => {
        console.error(`[Infosimples] Error: ${error.message}`);
        throw error;
      }
    );
  }

  /**
   * Consultar dados de CPF
   * @param cpf CPF sem formatação (11 dígitos)
   * @returns Dados do CPF
   */
  async queryCPF(cpf: string): Promise<CPFQueryResult> {
    try {
      // Validar CPF
      const cleanCPF = cpf.replace(/\D/g, "");
      if (cleanCPF.length !== 11) {
        throw new Error("CPF inválido: deve conter 11 dígitos");
      }

      const response = await this.client.get<CPFQueryResult>(`/v1/consultas/cpf`, {
        params: { cpf: cleanCPF },
      });

      if (response.data.status !== 200) {
        console.warn(`[Infosimples] CPF query failed: ${response.data.status}`);
      }

      return response.data;
    } catch (error) {
      console.error("[Infosimples] Error querying CPF:", error);
      throw error;
    }
  }

  /**
   * Consultar dados de CNPJ
   * @param cnpj CNPJ sem formatação (14 dígitos)
   * @returns Dados do CNPJ
   */
  async queryCNPJ(cnpj: string): Promise<CNPJQueryResult> {
    try {
      // Validar CNPJ
      const cleanCNPJ = cnpj.replace(/\D/g, "");
      if (cleanCNPJ.length !== 14) {
        throw new Error("CNPJ inválido: deve conter 14 dígitos");
      }

      const response = await this.client.get<CNPJQueryResult>(`/v1/consultas/cnpj`, {
        params: { cnpj: cleanCNPJ },
      });

      if (response.data.status !== 200) {
        console.warn(`[Infosimples] CNPJ query failed: ${response.data.status}`);
      }

      return response.data;
    } catch (error) {
      console.error("[Infosimples] Error querying CNPJ:", error);
      throw error;
    }
  }

  /**
   * Validar CPF (apenas formato)
   * @param cpf CPF com ou sem formatação
   * @returns true se válido, false caso contrário
   */
  validateCPF(cpf: string): boolean {
    const cleanCPF = cpf.replace(/\D/g, "");

    if (cleanCPF.length !== 11) {
      return false;
    }

    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cleanCPF)) {
      return false;
    }

    // Verificar dígitos verificadores (algoritmo simples)
    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) {
      remainder = 0;
    }

    if (remainder !== parseInt(cleanCPF.substring(9, 10))) {
      return false;
    }

    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) {
      remainder = 0;
    }

    if (remainder !== parseInt(cleanCPF.substring(10, 11))) {
      return false;
    }

    return true;
  }

  /**
   * Validar CNPJ (apenas formato)
   * @param cnpj CNPJ com ou sem formatação
   * @returns true se válido, false caso contrário
   */
  validateCNPJ(cnpj: string): boolean {
    const cleanCNPJ = cnpj.replace(/\D/g, "");

    if (cleanCNPJ.length !== 14) {
      return false;
    }

    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
      return false;
    }

    // Verificar dígitos verificadores
    let size = cleanCNPJ.length - 2;
    let numbers = cleanCNPJ.substring(0, size);
    let digits = cleanCNPJ.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += numbers.charAt(size - i) * pos--;
      if (pos < 2) {
        pos = 9;
      }
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) {
      return false;
    }

    size = size + 1;
    numbers = cleanCNPJ.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += numbers.charAt(size - i) * pos--;
      if (pos < 2) {
        pos = 9;
      }
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) {
      return false;
    }

    return true;
  }

  /**
   * Formatar CPF para exibição
   * @param cpf CPF sem formatação
   * @returns CPF formatado (XXX.XXX.XXX-XX)
   */
  formatCPF(cpf: string): string {
    const clean = cpf.replace(/\D/g, "");
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  /**
   * Formatar CNPJ para exibição
   * @param cnpj CNPJ sem formatação
   * @returns CNPJ formatado (XX.XXX.XXX/XXXX-XX)
   */
  formatCNPJ(cnpj: string): string {
    const clean = cnpj.replace(/\D/g, "");
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
}

// Singleton instance
let infosimplesService: InfosimplesService | null = null;

export function getInfosimplesService(): InfosimplesService {
  if (!infosimplesService) {
    infosimplesService = new InfosimplesService();
  }
  return infosimplesService;
}

export { InfosimplesService, CPFQueryResult, CNPJQueryResult };
