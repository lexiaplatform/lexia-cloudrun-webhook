import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { processMessageWithAgent } from "../services/vertex-ai";

export const vertexAiRouter = router({
  sendMessage: publicProcedure
    .input(
      z.object({
        message: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const agentResponse = await processMessageWithAgent(input.message);
        return {
          success: true,
          reply: agentResponse,
        };
      } catch (error) {
        console.error("Error sending message to agent:", error);
        throw new Error("Failed to get response from the agent.");
      }
    }),
});
