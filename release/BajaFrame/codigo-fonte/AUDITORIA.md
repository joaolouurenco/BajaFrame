# Auditoria da entrega — BajaFrame 1.1

Data: 26 de setembro de 2026. Este relatório descreve as verificações desta evolução; o relatório anterior permanece no histórico Git.

## Escopo entregue

Espessura global por categoria, densidade global, funções puras para diâmetro interno, área, volume e massa, totais do frame por categoria, controles recolhíveis em Estrutura → Avançado e propriedades do membro selecionado. O 3D continua usando o diâmetro externo. Arquivos V1 migram para V2; resultados derivados não são gravados no JSON. Não foram adicionados backend, dependências, STEP/STP, FEA ou certificação RATBSB.

Auditoria executada pelo agente implementador. Não constitui revisão independente de engenharia nem validação estrutural do chassi.

## Ambiente e comandos

Windows; Node.js 24.14.1; npm 11.11.0; navegador Chromium integrado com WebGL disponível. Aplicação de desenvolvimento em 127.0.0.1:3001; HTML compilado servido estaticamente por `npm run preview -- --port 4174`.

- `npm test`: **30 testes aprovados, zero falhas**.
- `npm run build`: TypeScript aprovado; Vite gerou um HTML com JavaScript e CSS embutidos, aproximadamente 888 kB. Permanecem dois avisos de empacotamento sobre `use client` em lucide-react; não impediram compilação ou execução nos fluxos testados.
- `node scripts/package.mjs`: regenerou `release/BajaFrame`, incluindo HTML, documentação, fontes, lockfile, testes, fixtures e três exemplos V2.
- `npm run audit:portable`: aprovado. Conferiu HTML igual ao build, recursos embutidos, documentos, licenças, exemplos V2 e igualdade das fontes/testes/scripts distribuídos com os originais.
- Nenhuma dependência foi acrescentada ou atualizada. O manifest e o lockfile receberam a versão 1.1.0 do aplicativo.

## Testes automatizados e regressões

Os 16 testes anteriores foram mantidos, com atualização do nome `outerDiameter` e da versão usada no caso de rejeição. Continuam cobrindo conectividade, simetria, offsets, edição independente, pontos derivados, limites de coordenadas, serialização, importações inválidas e comprimentos. O teste de extremos agora percorre os 17 parâmetros em três travamentos: **102 combinações**, além das **120 combinações de semente fixa** existentes.

Os 14 novos testes verificam padrões, herança por categoria, diâmetro interno, área, volume, conversão de massa, totais por categoria, efeito da densidade/parede sem alteração da geometria externa, rejeição de entradas físicas inválidas, migração V1 e leitura/escrita V2. As comparações físicas usam tolerância relativa de 1e-10, com piso absoluto de 1e-10.

`tests/fixtures/legacy-v1.json` foi capturado do modelo original antes da alteração, com offsets independentes e os três travamentos. Após a migração, os testes comparam exatamente pontos, conexões, identificadores, categorias, diâmetros externos, comprimentos e limites geométricos com essa referência. As comparações passaram.

Foram verificadas rejeições de paredes ausentes, não numéricas, não finitas, não positivas e fora dos limites, além da condição estrita `2t < D` nas funções físicas e na fronteira do modelo. O parser valida intervalos e chama a mesma validação física; os intervalos atuais da interface já impedem combinações com `2t >= D`.

## Verificações no navegador

| Cenário | Resultado observado |
| --- | --- |
| Estado inicial | Frame traseiro com 30 membros; massa 26,58 kg, primários 16,35 kg, secundários 10,23 kg |
| Parede primária | Mudança de 1,6 para 2 mm levou a massa a 30,39 kg |
| Desfazer e Refazer | Massa retornou a 26,58 kg e depois a 30,39 kg |
| Densidade | Com parede primária de 2 mm, mudar 7.850 para 15.700 kg/m³ levou a massa exibida a 60,79 kg; o teste numérico confirma duplicação antes do arredondamento |
| Membro selecionado | RRH_L mostrou categoria, comprimento 1.200,1 mm, diâmetro externo 31,8 mm, parede 2 mm, interno 27,8 mm e massa 3,528 kg na densidade de 15.700 kg/m³ |
| Persistência V2 | Após recarregar, parede de 2 mm, densidade de 15.700 kg/m³ e massa de 60,79 kg permaneceram |
| Importação V1 | Fixture combinado com offsets independentes abriu com 34 membros, paredes 1,6/1,2 mm, densidade 7.850 kg/m³ e massa 28,5 kg |
| Download e reabertura | JSON baixado foi lido no disco: schema 2, paredes, densidade, travamento e offsets presentes. O mesmo arquivo foi reaberto na interface |
| Importação inválida | Parede primária zero foi rejeitada com mensagem; o frame de 34 membros e 28,5 kg permaneceu |
| Limites e slider | Entrada -2 mm foi limitada a 0,5 mm; Desfazer recuperou o valor anterior. Seta direita no slider secundário mudou 1,2 para 1,3 mm |
| Travamentos | Dianteiro: 27 membros; traseiro: 30; combinado: 34 |
| Edição de pontos | Com simetria reativada, Y de B_L alterado para 450 mm produziu Y de B_R = -450 mm e largura de 900 mm |
| Migração real do localStorage | HTML V1 do commit anterior foi servido em uma rota temporária no mesmo endereço do preview; salvou altura 1.300 mm. Ao navegar para o HTML novo, a altura permaneceu e paredes/densidade foram preenchidas. A chave original foi mantida |
| HTML compilado | A versão 1.1 executou por HTTP local com renderização 3D e controles físicos |
| Tela estreita | Viewport 390 × 844: campos e massas acessíveis; largura útil e largura do documento iguais a 375 px, sem transbordamento horizontal. Tamanho restaurado após o teste |
| Restaurar frame | Retornou à massa inicial de 26,58 kg |
| Ocultar categoria | Ocultar secundários não alterou a massa total de 26,58 kg |
| Console | Nenhum erro registrado nas duas abas usadas nos fluxos observados |

## Distribuição e limites

O diretório `release/BajaFrame` foi atualizado. O HTML da entrega e `dist/index.html` têm SHA-256:

`438de7b59cff5cfa10569eb05326c70c5da27082d739e9eab108f448c396d96f`

O README documenta execução pelo HTML ou pelo código-fonte, unidades, fórmulas, intervalos, migração e limitações da estimativa. Para compartilhar, use o diretório atualizado ou compacte seu conteúdo; um ZIP antigo não é atualizado automaticamente.

- A abertura direta por duplo clique não foi testada nesta etapa. A auditoria anterior registrou bloqueio de navegação `file://` pelo navegador de automação; esse bloqueio não foi contornado. Foi exercitado o mesmo HTML via HTTP local.
- Não houve nova instalação limpa com `npm ci`, nova consulta `npm audit`, teste de ZIP, teste com rede desligada ou execução em outros navegadores/sistemas nesta etapa.
- A edição por coordenadas e o espelhamento foram exercitados no navegador; o arraste do manipulador 3D não foi repetido nesta etapa. O código do manipulador não foi modificado.
- As massas são estimativas de tubos uniformes ao longo dos eixos. Não descontam sobreposições, recortes e encaixes, nem incluem soldas, suportes ou correções reais de dobra. Nenhuma análise de resistência ou conformidade regulamentar foi realizada.

## Como repetir

```text
npm ci
npm test
npm run build
node scripts/package.mjs
npm run audit:portable
npm run preview
```

Abra o endereço local informado no terminal e repita os cenários da tabela. O código-fonte distribuído inclui as fixtures V1 para repetir os testes de regressão.
