// Campos editáveis da landing page. As chaves devem bater com
// backend/landing_content/defaults.py, que também define os valores padrão.

export type ScalarType = 'text' | 'rich' | 'number' | 'toggle' | 'icon' | 'image' | 'url'

export type ScalarField = {
  key: string
  label: string
  type: ScalarType
  help?: string
  // Valor de um item novo em listas.
  initial?: string
}

export type ListField = {
  key: string
  label: string
  type: 'list'
  itemLabel: string
  of: 'text' | 'rich' | 'number' | ScalarField[]
}

export type Field = ScalarField | ListField

export type SectionSchema = {
  key: string
  title: string
  description: string
  fields: Field[]
}

export const ICON_OPTIONS = [
  { value: 'car', label: 'Carro' },
  { value: 'card', label: 'Cartão' },
  { value: 'refresh', label: 'Renovar' },
  { value: 'shield', label: 'Escudo' },
  { value: 'pin', label: 'Localização' },
  { value: 'calendar', label: 'Calendário' },
  { value: 'user', label: 'Pessoa' },
  { value: 'wallet', label: 'Carteira' },
  { value: 'phone', label: 'Celular' },
  { value: 'list', label: 'Lista' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'arrow', label: 'Seta' },
]

const enabled = (label: string): ScalarField => ({ key: 'enabled', label, type: 'toggle' })

export const LANDING_SECTIONS: SectionSchema[] = [
  {
    key: 'general',
    title: 'Configurações gerais',
    description: 'Título da aba do navegador, links do app e número do WhatsApp usado em todos os botões.',
    fields: [
      { key: 'page_title', label: 'Título da página (aba do navegador)', type: 'text' },
      { key: 'meta_description', label: 'Descrição para buscadores', type: 'text' },
      {
        key: 'app_url',
        label: 'Endereço do app',
        type: 'url',
        help: 'Deixe vazio para usar automaticamente o endereço do app deste servidor (mostrado em cinza). Os botões levam para este endereço + /cadastro, /login, /recarregar…',
      },
      {
        key: 'whatsapp_number',
        label: 'Número do WhatsApp',
        type: 'text',
        help: 'Apenas dígitos, com DDI e DDD. Ex.: 5584921601952',
      },
    ],
  },
  {
    key: 'header',
    title: 'Cabeçalho e menu',
    description: 'Logo e itens do menu no topo da página.',
    fields: [
      { key: 'logo_text', label: 'Logo — primeira parte', type: 'text' },
      { key: 'logo_highlight', label: 'Logo — parte em destaque', type: 'text' },
      { key: 'menu_promo', label: 'Menu: Promoções', type: 'text' },
      { key: 'menu_how', label: 'Menu: Como funciona', type: 'text' },
      { key: 'menu_examples', label: 'Menu: Exemplos', type: 'text' },
      { key: 'menu_faq', label: 'Menu: Dúvidas', type: 'text' },
      { key: 'menu_contact', label: 'Menu: Contato', type: 'text' },
      { key: 'cta_label', label: 'Botão do menu', type: 'text' },
    ],
  },
  {
    key: 'hero',
    title: 'Destaque principal',
    description: 'Primeira área da página, com a chamada da promoção e a foto do carro.',
    fields: [
      { key: 'tagline', label: 'Frase manuscrita', type: 'text' },
      { key: 'title_line1', label: 'Título — linha 1', type: 'text' },
      { key: 'title_line2', label: 'Título — linha 2 (amarela)', type: 'text' },
      { key: 'title_line3', label: 'Título — linha 3', type: 'text' },
      { key: 'title_line4', label: 'Título — linha 4 (pincelada)', type: 'text' },
      { key: 'subtitle', label: 'Subtítulo', type: 'rich' },
      { key: 'text', label: 'Texto', type: 'rich' },
      { key: 'primary_label', label: 'Botão principal', type: 'text' },
      { key: 'whatsapp_label', label: 'Botão do WhatsApp', type: 'text' },
      { key: 'whatsapp_message', label: 'Mensagem enviada no WhatsApp', type: 'text' },
      { key: 'image', label: 'Foto', type: 'image' },
      { key: 'image_alt', label: 'Descrição da foto (acessibilidade)', type: 'text' },
      { key: 'badge', label: 'Etiqueta amarela', type: 'text' },
    ],
  },
  {
    key: 'offer',
    title: 'Oferta (paga × recebe)',
    description: 'Cartão com o valor pago e o valor recebido em créditos.',
    fields: [
      enabled('Exibir esta seção'),
      { key: 'pay_label', label: 'Rótulo "paga"', type: 'text' },
      { key: 'pay_value', label: 'Valor pago', type: 'text' },
      { key: 'pay_note', label: 'Observação do valor pago', type: 'text' },
      { key: 'receive_label', label: 'Rótulo "recebe"', type: 'text' },
      { key: 'receive_value', label: 'Valor recebido', type: 'text' },
      { key: 'receive_note', label: 'Observação do valor recebido', type: 'text' },
      { key: 'usage_line1', label: 'Frase de uso — linha 1', type: 'text' },
      { key: 'usage_line2', label: 'Frase de uso — linha 2 (amarela)', type: 'text' },
    ],
  },
  {
    key: 'promo',
    title: 'Promoção do mês',
    description: 'Lista de vantagens, botões e panfleto da promoção.',
    fields: [
      enabled('Exibir esta seção'),
      { key: 'badge', label: 'Etiqueta', type: 'text' },
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'title_highlight', label: 'Título — parte em destaque', type: 'text' },
      { key: 'items', label: 'Vantagens', type: 'list', itemLabel: 'Vantagem', of: 'rich' },
      { key: 'primary_label', label: 'Botão principal', type: 'text' },
      { key: 'secondary_label', label: 'Botão secundário', type: 'text' },
      { key: 'show_brands', label: 'Exibir bandeiras (Visa, Master, Elo, PIX)', type: 'toggle' },
      { key: 'flyer_image', label: 'Panfleto', type: 'image' },
      { key: 'flyer_alt', label: 'Descrição do panfleto (acessibilidade)', type: 'text' },
    ],
  },
  {
    key: 'how',
    title: 'Como funciona',
    description: 'Passo a passo do aplicativo e atalhos para as telas do app.',
    fields: [
      enabled('Exibir esta seção'),
      { key: 'kicker', label: 'Etiqueta', type: 'text' },
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'title_highlight', label: 'Título — parte em destaque', type: 'text' },
      { key: 'subtitle', label: 'Subtítulo', type: 'text' },
      {
        key: 'steps',
        label: 'Passos',
        type: 'list',
        itemLabel: 'Passo',
        of: [
          { key: 'icon', label: 'Ícone', type: 'icon' },
          { key: 'title', label: 'Título', type: 'text' },
          { key: 'text', label: 'Texto', type: 'rich' },
        ],
      },
      { key: 'app_title', label: 'Quadro do app — título', type: 'text' },
      { key: 'app_text', label: 'Quadro do app — texto', type: 'rich' },
      {
        key: 'app_links',
        label: 'Atalhos do app',
        type: 'list',
        itemLabel: 'Atalho',
        of: [
          { key: 'icon', label: 'Ícone', type: 'icon' },
          { key: 'title', label: 'Título', type: 'text' },
          { key: 'subtitle', label: 'Subtítulo', type: 'text' },
          {
            key: 'path',
            label: 'Tela do app',
            type: 'text',
            help: 'Ex.: /cadastro, /login, /recarregar, /corridas',
            initial: '/',
          },
        ],
      },
    ],
  },
  {
    key: 'examples',
    title: 'Exemplos de uso',
    description: 'Simulação de corridas descontando do saldo e lista de diferenciais.',
    fields: [
      enabled('Exibir esta seção'),
      { key: 'label', label: 'Etiqueta', type: 'text' },
      { key: 'start_balance', label: 'Saldo inicial da simulação (R$)', type: 'number' },
      { key: 'rides', label: 'Valores das corridas (R$)', type: 'list', itemLabel: 'Corrida', of: 'number' },
      { key: 'footnote', label: 'Texto abaixo dos exemplos', type: 'rich' },
      {
        key: 'perks',
        label: 'Diferenciais',
        type: 'list',
        itemLabel: 'Diferencial',
        of: [
          { key: 'icon', label: 'Ícone', type: 'icon' },
          { key: 'text', label: 'Texto', type: 'text' },
        ],
      },
    ],
  },
  {
    key: 'faq',
    title: 'Dúvidas frequentes',
    description: 'Perguntas e respostas exibidas em lista expansível.',
    fields: [
      enabled('Exibir esta seção'),
      { key: 'kicker', label: 'Etiqueta', type: 'text' },
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'title_highlight', label: 'Título — parte em destaque', type: 'text' },
      {
        key: 'items',
        label: 'Perguntas',
        type: 'list',
        itemLabel: 'Pergunta',
        of: [
          { key: 'question', label: 'Pergunta', type: 'text' },
          { key: 'answer', label: 'Resposta', type: 'rich' },
        ],
      },
    ],
  },
  {
    key: 'contact',
    title: 'Contato e parcelamento',
    description: 'Quadro de parcelamento e cartão de reserva pelo WhatsApp.',
    fields: [
      enabled('Exibir esta seção'),
      { key: 'installments_line1', label: 'Parcelamento — linha 1', type: 'text' },
      { key: 'installments_highlight', label: 'Parcelamento — destaque', type: 'text' },
      { key: 'installments_line2', label: 'Parcelamento — linha 2', type: 'text' },
      { key: 'installments_brush', label: 'Parcelamento — pincelada', type: 'text' },
      { key: 'whatsapp_title', label: 'WhatsApp — título', type: 'text' },
      { key: 'whatsapp_subtitle', label: 'WhatsApp — subtítulo', type: 'text' },
      { key: 'whatsapp_display', label: 'Número exibido', type: 'text' },
      { key: 'whatsapp_message', label: 'Mensagem enviada no WhatsApp', type: 'text' },
    ],
  },
  {
    key: 'footer',
    title: 'Rodapé',
    description: 'Frase final, nome da empresa e botão flutuante do WhatsApp.',
    fields: [
      { key: 'slogan', label: 'Frase manuscrita', type: 'text' },
      { key: 'company', label: 'Nome da empresa (direitos autorais)', type: 'text' },
      { key: 'float_enabled', label: 'Exibir botão flutuante do WhatsApp', type: 'toggle' },
      { key: 'float_message', label: 'Mensagem do botão flutuante', type: 'text' },
    ],
  },
]
