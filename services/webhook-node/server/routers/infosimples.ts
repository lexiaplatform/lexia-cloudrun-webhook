import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getInfosimplesService } from "../services/infosimples";

/**
 * Infosimples Router
 * Consultas de CPF/CNPJ via API Infosimples
 */

export const infosimplesRouter = router({
  /**
   * Consultar dados de CPF
   * POST /api/trpc/infosimples.queryCPF
   */
  queryCPF: protectedProcedure
    .input(
      z.object({
        cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getInfosimplesService();

        // Validar CPF
        if (!service.validateCPF(input.cpf)) {
          throw new Error("CPF inválido");
        }

        // Consultar
        const result = await service.queryCPF(input.cpf);

        if (result.status !== 200) {
          throw new Error(`Infosimples error: ${result.status}`);
        }

        console.log(`[Infosimples] CPF query successful: ${input.cpf}`);

        return {
          success: true,
          data: result.body,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("[Infosimples] Error querying CPF:", error);
        throw error;
      }
    }),

  /**
   * Consultar dados de CNPJ
   * POST /api/trpc/infosimples.queryCNPJ
   */
  queryCNPJ: protectedProcedure
    .input(
      z.object({
        cnpj: z.string().regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getInfosimplesService();

        // Validar CNPJ
        if (!service.validateCNPJ(input.cnpj)) {
          throw new Error("CNPJ inválido");
        }

        // Consultar
        const result = await service.queryCNPJ(input.cnpj);

        if (result.status !== 200) {
          throw new Error(`Infosimples error: ${result.status}`);
        }

        console.log(`[Infosimples] CNPJ query successful: ${input.cnpj}`);

        return {
          success: true,
          data: result.body,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("[Infosimples] Error querying CNPJ:", error);
        throw error;
      }
    }),

  /**
   * Validar CPF
   * POST /api/trpc/infosimples.validateCPF
   */
  validateCPF: publicProcedure
    .input(
      z.object({
        cpf: z.string(),
      })
    )
    .query(({ input }) => {
      try {
        const service = getInfosimplesService();
        const isValid = service.validateCPF(input.cpf);

        return {
          isValid,
          formatted: isValid ? service.formatCPF(input.cpf) : null,
        };
      } catch (error) {
        console.error("[Infosimples] Error validating CPF:", error);
        return {
          isValid: false,
          formatted: null,
        };
      }
    }),

  /**
   * Validar CNPJ
   * POST /api/trpc/infosimples.validateCNPJ
   */
  validateCNPJ: publicProcedure
    .input(
      z.object({
        cnpj: z.string(),
      })
    )
    .query(({ input }) => {
      try {
        const service = getInfosimplesService();
        const isValid = service.validateCNPJ(input.cnpj);

        return {
          isValid,
          formatted: isValid ? service.formatCNPJ(input.cnpj) : null,
        };
      } catch (error) {
        console.error("[Infosimples] Error validating CNPJ:", error);
        return {
          isValid: false,
          formatted: null,
        };
      }
    }),

  /**
   * Formatar CPF
   * GET /api/trpc/infosimples.formatCPF
   */
  formatCPF: publicProcedure
    .input(
      z.object({
        cpf: z.string(),
      })
    )
    .query(({ input }) => {
      try {
        const service = getInfosimplesService();
        const formatted = service.formatCPF(input.cpf);

        return {
          success: true,
          formatted,
        };
      } catch (error) {
        console.error("[Infosimples] Error formatting CPF:", error);
        throw error;
      }
    }),

  /**
   * Formatar CNPJ
   * GET /api/trpc/infosimples.formatCNPJ
   */
  formatCNPJ: publicProcedure
    .input(
      z.object({
        cnpj: z.string(),
      })
    )
    .query(({ input }) => {
      try {
        const service = getInfosimplesService();
        const formatted = service.formatCNPJ(input.cnpj);

        return {
          success: true,
          formatted,
        };
      } catch (error) {
        console.error("[Infosimples] Error formatting CNPJ:", error);
        throw error;
      }
    }),
});
