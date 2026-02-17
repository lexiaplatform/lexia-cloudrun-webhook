import React from 'react';
import { useNavigate } from 'wouter';

/**
 * ActionButtons Component
 * Centraliza todos os botões de ação do sistema
 * Garante que todos os botões levem ao chat interno (exceto WhatsApp)
 */

export type ActionType = 'chat' | 'whatsapp' | 'payment' | 'info' | 'navigate';

export interface ActionButtonProps {
  label: string;
  action: ActionType;
  payload?: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function ActionButton({
  label,
  action,
  payload,
  onClick,
  className = '',
  disabled = false,
  variant = 'primary',
}: ActionButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    // Executar callback customizado se fornecido
    if (onClick) {
      onClick();
    }

    // Roteamento automático baseado no tipo de ação
    switch (action) {
      case 'chat':
        // Abrir chat interno
        window.dispatchEvent(
          new CustomEvent('openChat', {
            detail: { payload, context: 'button_click' },
          })
        );
        navigate('/chat');
        break;

      case 'whatsapp':
        // Redirecionar para WhatsApp
        const phoneNumber = '15557668506';
        const message = payload || 'Olá, gostaria de mais informações sobre os serviços da Léxia.';
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        break;

      case 'payment':
        // Abrir modal de pagamento
        window.dispatchEvent(
          new CustomEvent('openPayment', {
            detail: { payload, context: 'button_click' },
          })
        );
        navigate('/payment');
        break;

      case 'info':
        // Mostrar informação em modal
        window.dispatchEvent(
          new CustomEvent('showInfo', {
            detail: { payload, context: 'button_click' },
          })
        );
        break;

      case 'navigate':
        // Navegar para rota específica
        if (payload) {
          navigate(payload);
        }
        break;

      default:
        console.warn(`Unknown action type: ${action}`);
    }
  };

  // Classes de estilo baseadas no variant
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  const baseClasses =
    'px-4 py-2 rounded font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      title={payload}
    >
      {label}
    </button>
  );
}

/**
 * ActionButtonGroup Component
 * Agrupa múltiplos botões de ação
 */

export interface ActionButtonGroupProps {
  buttons: ActionButtonProps[];
  layout?: 'horizontal' | 'vertical';
  className?: string;
}

export function ActionButtonGroup({
  buttons,
  layout = 'horizontal',
  className = '',
}: ActionButtonGroupProps) {
  const layoutClasses = layout === 'horizontal' ? 'flex gap-2' : 'flex flex-col gap-2';

  return (
    <div className={`${layoutClasses} ${className}`}>
      {buttons.map((button, index) => (
        <ActionButton key={index} {...button} />
      ))}
    </div>
  );
}

/**
 * QuickActionButtons Component
 * Botões de ação rápida pré-configurados
 */

export interface QuickActionButtonsProps {
  onChatClick?: () => void;
  onWhatsAppClick?: () => void;
  onPaymentClick?: () => void;
  className?: string;
}

export function QuickActionButtons({
  onChatClick,
  onWhatsAppClick,
  onPaymentClick,
  className = '',
}: QuickActionButtonsProps) {
  const buttons: ActionButtonProps[] = [
    {
      label: '💬 Chat Interno',
      action: 'chat',
      payload: 'Iniciar conversa',
      onClick: onChatClick,
    },
    {
      label: '📱 WhatsApp',
      action: 'whatsapp',
      payload: 'Olá, gostaria de mais informações',
      onClick: onWhatsAppClick,
    },
    {
      label: '💳 Pagamento',
      action: 'payment',
      payload: 'Iniciar pagamento',
      onClick: onPaymentClick,
      variant: 'primary',
    },
  ];

  return <ActionButtonGroup buttons={buttons} layout="horizontal" className={className} />;
}
