# Validação da entrega

Executado em 9 de outubro de 2026 (horário de São Paulo):

- Compilação TypeScript da API: aprovada.
- Compilação de produção Angular: aprovada.
- Verificação TypeScript do aplicativo Expo: aprovada.
- Jest: 3 suítes, 19 testes aprovados, incluindo 9 testes com MySQL 8.4 real em banco separado.
- Permissões: autenticação obrigatória; técnico não consulta nem altera ordens alheias e não cria ordens/lista clientes.
- Concorrência: duas atualizações paralelas geram um HTTP 200 e um HTTP 409; apenas um evento é persistido.
- Edição com versão antiga: HTTP 409, sem sobrescrever a versão corrente.
- Webhook duplicado concorrente: dois HTTP 200, um único recibo persistido; segunda entrega marcada como duplicada.
- HMAC: corpo alterado, assinatura ausente e timestamp expirado rejeitados.
- CEP: formato inválido, inexistência, timeout, indisponibilidade e resposta inválida testados; endereço válido retornado.
- Migrations aplicadas em MySQL e seed idempotente executado.
- EXPLAIN: consulta por technicianId + status escolheu ServiceOrder_technicianId_status_createdAt_idx, com Backward index scan e estimativa de uma linha no seed. Isso valida o uso do índice; não é benchmark de carga.

## Limitações de verificação

A ferramenta de navegador não iniciou por falha do ambiente restrito (helper_unknown_error: setup refresh had errors). Não foi possível realizar inspeção visual ou teste de interação no navegador. Não foi usado emulador/celular para validar gestos, teclado, armazenamento nativo ou permissões do sistema operacional.

GitHub Actions foi configurado, mas não executado no GitHub porque não foi criado/publicado repositório.

## Dependências

A auditoria npm identificou 59 ocorrências (47 altas e 12 moderadas) na árvore de dependências, incluindo ferramentas Expo/Metro/Jest e Prisma CLI. npm audit fix não encontrou correções compatíveis com as versões selecionadas. Não foi aplicado audit fix --force, pois propõe mudanças de versão principal que exigem migração e nova validação do cliente mobile e do banco.

Este é um MVP local demonstrável. Antes de exposição pública, é necessário atualizar e revalidar essa cadeia de dependências, remover contas/chaves de demonstração, configurar HTTPS, limitação de tentativas de login, recuperação de conta e operação de backups. Não houve auditoria de segurança completa.

## Verificação final em execução

- Docker Compose: banco, API e Nginx compilados e iniciados com sucesso.
- Painel HTTP 200 em http://localhost:8080; health da API retornou ok.
- Login e listagem executados pelo proxy /api do Nginx.
- Uma nova ordem foi criada, atribuída a Ana e atualizada para IN_PROGRESS, versão 2.
- Worker enviou um evento real ao receptor; MySQL confirmou um evento entregue e um recibo.
- Exportação Android do Expo concluída com sucesso: 576 módulos e bundle Hermes de aproximadamente 1,75 MB. Isso valida empacotamento, mas não substitui teste em dispositivo.
