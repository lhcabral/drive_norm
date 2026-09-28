==========================================================================
 DRIVE NORM - DEPLOY E PRIMEIRO ACESSO
 Servidor: Oracle Cloud, Ubuntu 24.04 LTS
 Domínio:  drivenorm.com.br (DNS no Registro.br)
 Código:   /drive (clonado do GitHub)
==========================================================================

ENDEREÇOS DO SISTEMA
--------------------------------------------------------------------------
  https://drivenorm.com.br          Landing page (site de divulgação)
  https://www.drivenorm.com.br      Landing page
  https://app.drivenorm.com.br      App (PWA) e painel do administrador
  https://app.drivenorm.com.br/admin    Django admin (uso técnico)

O que roda no servidor:
  - Nginx: recebe os acessos (portas 80/443) e cuida do HTTPS
  - Daphne: backend Django (API + WebSocket), serviço "drivenorm-daphne"
  - Celery: expira propostas de corrida, serviço "drivenorm-celery"
  - PostgreSQL: banco de dados
  - Redis: tempo real (WebSocket) e fila do Celery


==========================================================================
 PARTE 1 - DEPLOY
==========================================================================

1) CRIAR A VM NA ORACLE CLOUD
--------------------------------------------------------------------------
  - Compute > Instances > Create instance
  - Imagem: Canonical Ubuntu 24.04
  - Shape: VM.Standard.A1.Flex (ARM, Always Free), sugestão 2 OCPU / 12 GB
  - Marque "Assign a public IPv4 address" e cadastre sua chave SSH
  - Reserve o IP como fixo: Networking > IP Management > Reserved Public IPs
    (sem isso o IP pode mudar ao reiniciar a VM e o DNS para de funcionar)


2) LIBERAR AS PORTAS 80 E 443 NA ORACLE
--------------------------------------------------------------------------
  Networking > Virtual Cloud Networks > (sua VCN) > Security Lists >
  Default Security List > Add Ingress Rules. Crie duas regras:

    Source CIDR: 0.0.0.0/0   Protocolo: TCP   Porta de destino: 80
    Source CIDR: 0.0.0.0/0   Protocolo: TCP   Porta de destino: 443

  O firewall interno do Ubuntu (iptables) é liberado pelo script do passo 6.


3) CONFIGURAR O DNS NO REGISTRO.BR
--------------------------------------------------------------------------
  - Entre em https://registro.br e clique no domínio drivenorm.com.br
  - Na seção DNS, clique em "Editar zona" (use os servidores DNS do
    Registro.br; se o domínio usa DNS de outra empresa, crie lá)
  - Clique em "Nova entrada" e crie três registros do tipo A:

      Tipo   Nome            Dados
      A      (deixe vazio)   IP_PUBLICO_DA_VM
      A      www             IP_PUBLICO_DA_VM
      A      app             IP_PUBLICO_DA_VM

  - Salve. Pode levar de minutos a algumas horas para propagar.

  Para conferir (no servidor):
      getent hosts drivenorm.com.br www.drivenorm.com.br app.drivenorm.com.br
  Os três devem responder com o IP da VM.


4) CLONAR O CÓDIGO EM /drive
--------------------------------------------------------------------------
  Acesse o servidor:
      ssh -i ~/.ssh/SUA_CHAVE ubuntu@IP_PUBLICO_DA_VM

  Crie a pasta e clone DIRETO nela (o "/drive" no fim do comando é
  obrigatório; sem ele o Git cria uma subpasta e os scripts falham):
      sudo mkdir -p /drive
      sudo chown ubuntu:ubuntu /drive
      git clone https://github.com/lhcabral/drive_norm.git /drive

  Confira:
      ls /drive/deploy/systemd
  Deve listar drivenorm-daphne.service e drivenorm-celery.service.

  Repositório privado: use um Personal Access Token do GitHub como senha
  ou cadastre uma deploy key do servidor no repositório.


5) CRIAR O ARQUIVO /drive/.env
--------------------------------------------------------------------------
      cd /drive
      cp deploy/.env.production .env
      sed -i "s|TROCAR_CHAVE_SECRETA|$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')|" .env
      sed -i "s|TROCAR_SENHA_DO_BANCO|$(openssl rand -hex 24)|" .env

  Opcional agora (pode fazer depois): abra com "nano .env" e preencha
  o e-mail (EMAIL_HOST, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD...) para a
  recuperação de senha funcionar.

  Nunca envie o .env para o GitHub (ele já está no .gitignore).


6) INSTALAR TUDO
--------------------------------------------------------------------------
      bash /drive/deploy/setup-server.sh

  O script instala Python, Node 22, PostgreSQL, Redis e Nginx, libera o
  firewall, cria o banco com a senha do .env, registra os serviços, roda
  as migrações, faz o build do app e sobe tudo. Pode ser executado de
  novo sem problema, caso pare no meio.


7) ATIVAR O HTTPS (só depois que o DNS do passo 3 responder)
--------------------------------------------------------------------------
      sudo certbot --nginx -d drivenorm.com.br -d www.drivenorm.com.br -d app.drivenorm.com.br

  O Certbot configura o redirecionamento de http para https e a
  renovação automática. Para testar a renovação:
      sudo certbot renew --dry-run


8) CONFERIR SE ESTÁ NO AR
--------------------------------------------------------------------------
      sudo systemctl status drivenorm-daphne drivenorm-celery nginx --no-pager

  Os três devem estar "active (running)". Depois abra no navegador:
      https://drivenorm.com.br       (landing page)
      https://app.drivenorm.com.br   (tela de login)


==========================================================================
 PARTE 2 - PRIMEIRO ACESSO
==========================================================================

1) CRIAR O ADMINISTRADOR
--------------------------------------------------------------------------
  O sistema começa sem nenhum usuário. No servidor, rode:

      cd /drive/backend
      ../venv/bin/python manage.py shell -c "import getpass; from accounts.models import User; User.objects.create_superuser(input('Usuário: '), input('E-mail: '), getpass.getpass('Senha: '), role=User.Role.ADMIN)"

  Informe usuário, e-mail e senha (a senha não aparece enquanto digita).

  NÃO rode "seed_demo" em produção: ele cria usuários de demonstração com
  senhas conhecidas (admin123, cliente123, motorista123).


2) ENTRAR NO PAINEL
--------------------------------------------------------------------------
  - Abra https://app.drivenorm.com.br
  - Entre com o usuário e a senha criados acima
  - O administrador cai direto no painel, que tem as abas:
      Clientes           busca, ficha, saldo, extrato, crédito/débito
                         manual, bloqueio e senha dos clientes
      Motoristas         cadastro e edição dos motoristas
      PIX e pagamentos   token do Mercado Pago e lista de recargas
      Landing page       editor do site drivenorm.com.br
      Administradores    criar admins, editar e-mail, trocar senha e
                         bloquear. Contas com "acesso total" só podem ser
                         alteradas por outro admin com acesso total


3) CONFIGURAR O PIX (MERCADO PAGO)
--------------------------------------------------------------------------
  - Crie uma aplicação em https://www.mercadopago.com.br/developers/panel/app
    e copie o Access Token de PRODUÇÃO
  - No painel, aba "PIX e pagamentos", cole o token e salve
    (ele é validado com o Mercado Pago antes de salvar)
  - No Mercado Pago Developers, cadastre o webhook (evento Pagamentos):
      https://app.drivenorm.com.br/api/payments/webhook/mercadopago/

  Sem token, o PIX fica DESATIVADO em produção.


4) CADASTRAR OS MOTORISTAS
--------------------------------------------------------------------------
  - Aba "Motoristas" > preencha nome, usuário para login, senha,
    telefone/WhatsApp, e-mail e veículo
  - Passe o usuário e a senha para o motorista. Ele entra pelo mesmo
    endereço: https://app.drivenorm.com.br
  - Motoristas só podem ser cadastrados pelo administrador.


5) CLIENTES
--------------------------------------------------------------------------
  - O cliente cria a própria conta em https://app.drivenorm.com.br,
    no link de cadastro da tela de login
  - Cada cliente recebe um código único (ex.: DN-A7K2), que o motorista
    usa para encontrá-lo, lançar crédito e enviar a proposta da corrida
  - Recarga: pelo app, via PIX (depois do passo 3), ou crédito manual
    feito pelo motorista ou pelo administrador


6) INSTALAR O APP NO CELULAR (PWA)
--------------------------------------------------------------------------
  Android (Chrome): abra https://app.drivenorm.com.br > menu (três pontos)
                    > "Instalar app" ou "Adicionar à tela inicial"
  iPhone (Safari):  abra https://app.drivenorm.com.br > botão Compartilhar
                    > "Adicionar à Tela de Início"


7) EDITAR A LANDING PAGE
--------------------------------------------------------------------------
  - Aba "Landing page": cada seção pode ser editada, ocultada e ter a
    imagem trocada. "Salvar seção" publica na hora.
  - Em "Configurações gerais", confira o número do WhatsApp. O campo
    "Endereço do app" pode ficar vazio: os botões da landing usam
    automaticamente o FRONTEND_URL do .env (https://app.drivenorm.com.br).
    Só preencha se o app estiver em outro endereço.
  - O botão "Ver página" abre https://drivenorm.com.br


8) TESTE RÁPIDO DO TEMPO REAL
--------------------------------------------------------------------------
  Com um motorista e um cliente logados (aparelhos ou abas diferentes),
  o motorista envia uma proposta de corrida para o código do cliente.
  Ela deve aparecer na hora para o cliente aceitar ou recusar.


==========================================================================
 ATUALIZAR O SISTEMA
==========================================================================
  Na sua máquina:
      git add -A && git commit -m "descrição da mudança" && git push

  No servidor:
      cd /drive && git pull && bash deploy/deploy.sh

  Não edite arquivos direto no servidor: o próximo "git pull" vai
  reclamar de alterações locais. Se acontecer:
      git stash && git pull


==========================================================================
 COMANDOS ÚTEIS E PROBLEMAS COMUNS
==========================================================================
  Logs do backend (e dos e-mails, se EMAIL_HOST estiver vazio):
      journalctl -u drivenorm-daphne -f
  Logs do Celery:
      journalctl -u drivenorm-celery -f
  Erros do Nginx:
      sudo tail -f /var/log/nginx/error.log
  Reiniciar o backend (ex.: depois de alterar o .env):
      sudo systemctl restart drivenorm-daphne drivenorm-celery

  Site não abre de fora     portas 80/443 fechadas na Security List
  502 Bad Gateway           backend parado: veja o log do daphne
  400 Bad Request           domínio faltando em DJANGO_ALLOWED_HOSTS
  Proposta não chega        Redis parado ou CHANNEL_LAYER_BACKEND != redis
  Esqueci minha senha não   EMAIL_* não preenchido no .env
  envia e-mail
  App antigo após update    feche e abra o app de novo (cache do PWA)

  Backup do banco: veja a seção "Backup do banco" em deploy/DEPLOY.md.
==========================================================================
