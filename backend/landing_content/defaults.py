"""Conteúdo padrão da landing page.

Deve refletir exatamente o texto estático de `landing/index.html`, que é exibido
quando a API não responde. "Restaurar padrão" no painel volta para estes valores.

Nos campos de texto longo, `**texto**` vira negrito, `*texto*` vira itálico e
quebras de linha são preservadas.
"""

ICONS = (
    "car",
    "card",
    "refresh",
    "shield",
    "pin",
    "calendar",
    "user",
    "wallet",
    "phone",
    "list",
    "whatsapp",
    "arrow",
)

DEFAULT_CONTENT = {
    "general": {
        "page_title": "Drive Norm — Pague R$ 100 e receba R$ 120 em corridas",
        "meta_description": (
            "Corridas seguras e confortáveis. Pague R$ 100 e receba R$ 120 em créditos "
            "para suas corridas. Parcele em até 5x sem juros no cartão."
        ),
        # Vazio: a landing usa o FRONTEND_URL do servidor.
        "app_url": "",
        "whatsapp_number": "5584921601952",
    },
    "header": {
        "logo_text": "Drive",
        "logo_highlight": "Norm",
        "menu_promo": "Promoções",
        "menu_how": "Como funciona",
        "menu_examples": "Exemplos",
        "menu_faq": "Dúvidas",
        "menu_contact": "Contato",
        "cta_label": "Acessar app",
    },
    "hero": {
        "tagline": "Mais mobilidade para o seu dia!",
        "title_line1": "Pague",
        "title_line2": "R$100",
        "title_line3": "e receba",
        "title_line4": "R$120",
        "subtitle": "em créditos para *suas corridas*",
        "text": (
            "Crie sua conta no app, carregue seus créditos e use em quantas viagens quiser "
            "até consumir todo o saldo. Simples, seguro e com bônus de **20%**."
        ),
        "primary_label": "Quero meu bônus",
        "whatsapp_label": "Reservar corrida",
        "whatsapp_message": "Olá! Quero reservar uma corrida.",
        "image": "assets/carro-destaque.jpg",
        "image_alt": "Carro branco da Drive Norm",
        "badge": "Mais viagens por você!",
    },
    "offer": {
        "enabled": True,
        "pay_label": "Você paga",
        "pay_value": "R$100",
        "pay_note": "no cartão de crédito ou PIX",
        "receive_label": "E recebe",
        "receive_value": "R$120",
        "receive_note": "em créditos para usar em corridas",
        "usage_line1": "Use em quantas viagens quiser,",
        "usage_line2": "até consumir os R$ 120.",
    },
    "promo": {
        "enabled": True,
        "badge": "Promoção do mês",
        "title": "Crédito com",
        "title_highlight": "20% de bônus",
        "items": [
            "Pague R$ 100 e ganhe R$ 120 para rodar",
            "Parcele em até **5x sem juros** no cartão",
            "Créditos válidos por 30 dias",
            "Saldo e extrato sempre à mão no app",
        ],
        "primary_label": "Criar conta e aproveitar",
        "secondary_label": "Já tenho conta: recarregar",
        "show_brands": True,
        "flyer_image": "assets/promo-120.jpg",
        "flyer_alt": "Panfleto da promoção: pague R$ 100 e receba R$ 120 em créditos",
    },
    "how": {
        "enabled": True,
        "kicker": "Passo a passo",
        "title": "Como funciona o",
        "title_highlight": "aplicativo",
        "subtitle": "Tudo pelo celular: cadastro, pagamento e acompanhamento das suas corridas.",
        "steps": [
            {
                "icon": "user",
                "title": "Crie sua conta",
                "text": (
                    "Cadastre-se em poucos segundos. Você recebe um **código pessoal** "
                    "(ex.: DN-A7K2) que identifica sua carteira."
                ),
            },
            {
                "icon": "wallet",
                "title": "Carregue créditos",
                "text": (
                    "Recarregue pelo app via **PIX** ou pague no **cartão** direto com o "
                    "motorista, em até 5x sem juros."
                ),
            },
            {
                "icon": "phone",
                "title": "Aprove a corrida",
                "text": (
                    "No embarque, informe seu código. O valor da corrida chega no seu celular "
                    "e você **aceita ou recusa** na hora."
                ),
            },
            {
                "icon": "list",
                "title": "Acompanhe tudo",
                "text": (
                    "Veja seu **saldo**, o **extrato** de movimentações e o "
                    "**histórico de corridas** quando quiser."
                ),
            },
        ],
        "app_title": "Acesse o app Drive Norm",
        "app_text": (
            "Funciona direto no navegador e pode ser instalado na tela inicial do celular: "
            "abra o app e toque em **“Adicionar à tela inicial”**."
        ),
        "app_links": [
            {"icon": "user", "title": "Cadastro", "subtitle": "Criar minha conta", "path": "/cadastro"},
            {"icon": "card", "title": "Pagamento", "subtitle": "Recarregar créditos", "path": "/recarregar"},
            {"icon": "car", "title": "Minhas corridas", "subtitle": "Ver histórico", "path": "/corridas"},
            {"icon": "arrow", "title": "Entrar", "subtitle": "Já tenho conta", "path": "/login"},
        ],
    },
    "examples": {
        "enabled": True,
        "label": "Exemplos de uso:",
        "start_balance": 120,
        "rides": [20, 15, 25, 10, 30],
        "footnote": (
            "Começando com **R$ 120** de crédito. O saldo é descontado a cada corrida "
            "aprovada por você."
        ),
        "perks": [
            {"icon": "shield", "text": "Corridas seguras e confortáveis"},
            {"icon": "pin", "text": "Atendimento rápido e eficiente"},
            {"icon": "card", "text": "Pague no cartão de crédito ou PIX"},
            {"icon": "calendar", "text": "Validade dos créditos: 30 dias"},
        ],
    },
    "faq": {
        "enabled": True,
        "kicker": "Dúvidas frequentes",
        "title": "Ficou com alguma",
        "title_highlight": "dúvida?",
        "items": [
            {
                "question": "Como recebo os R$ 20 de bônus?",
                "answer": (
                    "Ao pagar R$ 100, sua carteira no app recebe R$ 120 em créditos. "
                    "O bônus já entra junto com a recarga."
                ),
            },
            {
                "question": "Posso parcelar?",
                "answer": (
                    "Sim! No cartão de crédito com o motorista você parcela em até 5x sem "
                    "juros (Visa, Mastercard e Elo)."
                ),
            },
            {
                "question": "Como pago a corrida usando os créditos?",
                "answer": (
                    "Informe seu código pessoal ao motorista. Ele envia o valor da corrida "
                    "para o seu app e você aprova com um toque. O valor é descontado do seu saldo."
                ),
            },
            {
                "question": "Quanto tempo os créditos valem?",
                "answer": "Os créditos são válidos por 30 dias a partir da recarga.",
            },
            {
                "question": "Preciso baixar algo da loja de aplicativos?",
                "answer": (
                    "Não. O app funciona no navegador do celular e pode ser adicionado à "
                    "tela inicial como um aplicativo comum."
                ),
            },
        ],
    },
    "contact": {
        "enabled": True,
        "installments_line1": "Parcelamos em até",
        "installments_highlight": "Cinco vezes",
        "installments_line2": "no cartão de crédito,",
        "installments_brush": "sem juros.",
        "whatsapp_title": "Faça já sua reserva",
        "whatsapp_subtitle": "pelo WhatsApp",
        "whatsapp_display": "84 92160-1952",
        "whatsapp_message": "Olá! Gostaria de fazer uma reserva.",
    },
    "footer": {
        "slogan": "Sua corrida, do seu jeito!",
        "company": "Drive Norm",
        "float_enabled": True,
        "float_message": "Olá! Vim pelo site e quero uma corrida.",
    },
}

SECTION_KEYS = tuple(DEFAULT_CONTENT)
