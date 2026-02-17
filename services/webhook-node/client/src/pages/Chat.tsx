import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Send, Phone, X } from 'lucide-react';
import { trpc } from '@/_core/trpc';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: string;
  type: 'text' | 'system';
}

interface Conversation {
  id: number;
  phoneNumber: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  status: 'active' | 'closed' | 'archived';
  createdAt: string;
}

/**
 * Chat Page Component
 * Interface de chat interno para comunicação com usuários
 * Integrado com WhatsApp e banco de dados
 */
export default function ChatPage() {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // tRPC queries and mutations
  const conversationsQuery = trpc.chat.listConversations.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const historyQuery = trpc.chat.getHistory.useQuery(
    { conversationId: selectedConversation?.id || 0, limit: 50 },
    { enabled: !!selectedConversation }
  );

  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setInput('');
      historyQuery.refetch();
    },
    onError: (error) => {
      console.error('Erro ao enviar mensagem:', error);
    },
  });

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Atualizar mensagens quando histórico muda
  useEffect(() => {
    if (historyQuery.data) {
      setMessages(
        historyQuery.data.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.createdAt,
          type: 'text',
        }))
      );
    }
  }, [historyQuery.data]);

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedConversation || isLoading) return;

    setIsLoading(true);

    try {
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConversation.id,
        message: input.trim(),
      });

      // Adicionar mensagem do usuário localmente
      const newMessage: Message = {
        id: Date.now().toString(),
        content: input,
        sender: 'user',
        timestamp: new Date().toISOString(),
        type: 'text',
      };

      setMessages((prev) => [...prev, newMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Acesso Restrito</h2>
          <p className="text-gray-600 mb-6">Você precisa estar autenticado para acessar o chat.</p>
          <Button onClick={() => (window.location.href = '/api/oauth/login')}>
            Fazer Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Lista de Conversas */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold">Conversas</h2>
          <p className="text-sm text-gray-500">{user?.name || 'Usuário'}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversationsQuery.isLoading ? (
            <div className="p-4 flex justify-center">
              <Loader2 className="animate-spin" />
            </div>
          ) : conversationsQuery.data && conversationsQuery.data.length > 0 ? (
            conversationsQuery.data.map((conv: Conversation) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition ${
                  selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-semibold text-sm">{conv.phoneNumber}</div>
                <div className="text-xs text-gray-500 truncate">
                  {conv.lastMessage || 'Sem mensagens'}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(conv.lastMessageAt || conv.createdAt).toLocaleDateString('pt-BR')}
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">Nenhuma conversa</div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold">{selectedConversation.phoneNumber}</h3>
                <p className="text-sm text-gray-500">
                  Status: <span className="capitalize">{selectedConversation.status}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedConversation(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {historyQuery.isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="animate-spin" />
                </div>
              ) : messages.length > 0 ? (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Nenhuma mensagem ainda
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Digite sua mensagem..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !input.trim()}
                  size="icon"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Selecione uma conversa para começar
          </div>
        )}
      </div>
    </div>
  );
}
