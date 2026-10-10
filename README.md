# Oficina — gestão de ordens de serviço

API NestJS + TypeScript + Prisma/MySQL, painel Angular e aplicativo React Native/Expo. Uma única API organizada em módulos.

## Iniciar com Docker

Requisitos: Docker Desktop iniciado. Na pasta deste arquivo:

~~~powershell
Copy-Item .env.example .env
docker compose up --build -d
~~~

Painel: http://localhost:8080
API: http://localhost:3000/health

O contêiner aplica migrations e carrega dados de demonstração antes de iniciar. O seed é idempotente e não sobrescreve alterações existentes. A primeira compilação pode levar alguns minutos. Consulte os logs com:

~~~sh
docker compose logs -f api
~~~

Contas de demonstração, todas com senha **Demo12345!**:

| Perfil | E-mail |
| --- | --- |
| Gestor | gestor@demo.local |
| Técnica Ana | ana@demo.local |
| Técnico Lucas | lucas@demo.local |

As chaves e senhas de exemplo são de desenvolvimento. O seed é voltado à demonstração; remova sua execução automática e configure credenciais próprias antes de hospedar.

## Desenvolvimento local

Node 22.12+ ou 24. O lockfile acompanha a entrega.

~~~sh
npm ci
npm run db:generate
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev:api
~~~

Em outro terminal:

~~~sh
npm run dev:web
~~~

Abra http://localhost:4200. O proxy Angular encaminha /api para o NestJS. Após alterar a API, repita o comando de desenvolvimento para recompilar.

## Aplicativo do técnico

~~~powershell
Copy-Item apps/mobile/.env.example apps/mobile/.env
npm run dev:mobile
~~~

Use cliente Expo compatível com SDK 54 ou um development build correspondente. O aplicativo usa armazenamento seguro nativo para a sessão.

No emulador Android, a API é http://10.0.2.2:3000; no simulador iOS, http://localhost:3000. No celular físico, ajuste EXPO_PUBLIC_API_URL para o IP da máquina na rede local e permita a porta 3000 no firewall. Reinicie o Expo após alterar a variável.

O técnico consulta as próprias ordens, vê cliente/endereço e inicia, conclui ou cancela um atendimento. Arraste a lista para atualizar. O aplicativo depende de conexão; falhas são apresentadas com opção de repetir.

## Fluxo para demonstrar

1. Entre como gestor, abra Clientes e cadastre um contato. Consulte o CEP ou informe o endereço manualmente.
2. Em Ordens de serviço, abra uma ordem e atribua Ana ou Lucas.
3. Entre como técnico no celular ou painel. Somente as ordens atribuídas aparecem.
4. Inicie e conclua um atendimento. Atualize o painel do gestor para acompanhar.
5. Abra a mesma ordem em duas sessões. Salve uma alteração e tente salvar a versão antiga: a API responde 409.
6. Eventos pendentes ficam na tabela Outbox; confirmações ficam na WebhookReceipt.

## Qualidade e testes

~~~sh
npm run build
npm run check -w mobile
npm test
~~~

Sem TEST_DATABASE_URL, apenas os testes unitários executam; a suíte de integração fica explicitamente ignorada. Para integração, crie um banco separado e aplique as migrations nele. A suíte cria/remove registros com prefixo it- e exige permissão de escrita.

~~~powershell
$env:DATABASE_URL='mysql://root:SUA_SENHA@localhost:3306/oficina_test'
$env:TEST_DATABASE_URL=$env:DATABASE_URL
npm run db:migrate
npm test
~~~

A pipeline GitHub Actions sobe MySQL, aplica migrations, compila API/painel, verifica TypeScript do mobile e executa todos os testes. O workflow funciona quando este diretório for a raiz de um repositório GitHub.

## Contrato HTTP

Login: POST /auth/login com e-mail e senha. Demais rotas usam Authorization: Bearer TOKEN, exceto health e webhook.

| Método | Rota | Acesso / finalidade |
| --- | --- | --- |
| GET | /me | Sessão |
| GET, POST | /users | Gestor; listar/criar usuário |
| GET | /users/technicians | Gestor; atribuição |
| GET, POST | /customers | Gestor; listar/cadastrar |
| PUT | /customers/:id | Gestor; editar |
| GET | /orders?status=OPEN&page=1&q=texto | Gestor vê todas; técnico vê suas ordens |
| GET | /orders/:id | Mesma restrição da lista |
| POST | /orders | Gestor; abrir e atribuir |
| PUT | /orders/:id | Gestor; editar com versão |
| PATCH | /orders/:id/status | Responsável ou gestor; status + versão |
| GET | /postal/:zip | Autenticado; CEP com oito dígitos |
| POST | /webhooks/status | Assinatura HMAC |

Cadastro de usuário:

~~~json
{"name":"Ana","email":"ana@empresa.com","password":"senha-forte","role":"TECHNICIAN"}
~~~

Não existe registro público. O gestor também pode cadastrar outro MANAGER.

Ordem:

~~~json
{"title":"Manutenção","description":"Verificar equipamento","customerId":"...","technicianId":"..."}
~~~

Para editar, acrescente version com a versão atual. Técnico vazio remove a atribuição.

Atualização de status:

~~~json
{"status":"IN_PROGRESS","version":1}
~~~

Transições: OPEN → IN_PROGRESS ou CANCELED; IN_PROGRESS → DONE ou CANCELED. DONE/CANCELED são terminais.

## Concorrência e permissões

O usuário é consultado no banco em cada requisição autenticada. Seu papel não é aceito do corpo nem confiado a um papel antigo no token. Consultas e alterações do técnico incluem seu technicianId; ordem alheia retorna 404.

A versão é conferida no próprio UPDATE. Zero linhas alteradas retorna 409. Alteração de status e criação do evento acontecem na mesma transação. Os detalhes do painel oferecem atualização para obter a versão corrente, sem mesclar alterações automaticamente.

## Webhooks

WEBHOOK_URL é configurado somente no servidor. No Docker aponta para o próprio receptor de demonstração. Fora do Docker, valor vazio desativa envios. O receptor confirma eventos de ordens existentes: registra seu ID e não altera novamente o status.

Headers:

- x-event-id: ID estável da outbox
- x-timestamp: segundos Unix
- x-signature: HMAC-SHA256 hexadecimal sobre ID.TIMESTAMP.CORPO_ORIGINAL

A assinatura cobre os bytes exatos do JSON, ID e timestamp. A janela aceita cinco minutos. Comparação em tempo constante; ID único no MySQL deduplica inclusive chamadas concorrentes. Recibo e qualquer efeito futuro do consumidor devem permanecer na mesma transação.

O worker executa a cada cinco segundos. Timeout de cinco segundos e retentativas com espera exponencial limitada a uma hora. Reiniciar preserva eventos pendentes. Entrega pelo menos uma vez: se a resposta se perder após o receptor salvar, o envio é repetido com o mesmo ID. O receptor deduplica.

O projeto prevê uma instância da API. Várias instâncias podem reenviar o mesmo evento: consumidores sempre precisam deduplicar. Eventos não são descartados automaticamente após muitas falhas.

## CEP e indisponibilidade

Consulta ViaCEP com timeout de três segundos. CEP malformado: 400; inexistente: 404; timeout: 504; falha de rede/HTTP/resposta inválida: 503. O cadastro permite endereço manual. As interfaces exibem falhas sem fingir que o dado foi salvo.

## Consulta lenta e índices

Índices iniciais: (technicianId, status, createdAt) e (status, createdAt). Atendem igualdade por técnico/status seguida de ordenação por data. Sem status ou com busca textual contains, o comportamento muda; esses índices não tornam busca com porcentagem inicial eficiente.

Investigue numa cópia representativa da base:

~~~sql
EXPLAIN ANALYZE
SELECT id, title, status, createdAt
FROM ServiceOrder
WHERE technicianId = 'tech-ana' AND status = 'OPEN'
ORDER BY createdAt DESC
LIMIT 10;
~~~

Compare linhas examinadas, índice escolhido, filesort e tempo com/sem índice em teste. Não desative índices em produção para demonstrar. O seed pequeno não comprova ganho. Paginação profunda com OFFSET e busca textual podem exigir cursor/full-text depois de medir.

## Limites da entrega

Uma empresa por instalação; não é SaaS multiempresa. Painel atualiza sob demanda. Usuários são cadastrados pela API do gestor. Histórico de alterações e reset de senha ficam fora deste MVP. Token do painel fica na sessão do navegador; mobile usa SecureStore.

Confira VALIDACAO.md para resultados efetivamente executados e limitações do ambiente.

Referências: [NestJS](https://docs.nestjs.com/techniques/validation), [Prisma](https://www.prisma.io/docs/orm/fundamentals/transactions), [ViaCEP](https://viacep.com.br/).
