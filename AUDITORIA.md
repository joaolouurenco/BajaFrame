# Auditoria — BajaFrame 1.2

Data: 25 de outubro de 2026. Relatório desta rodada de refinamento; os relatórios anteriores permanecem no histórico Git.

## Escopo verificado

Separação entre pós-firewall e travamento traseiro; edição de inclinação, comprimento e apoios do dianteiro; tubos adicionais; nós compartilhados nos cruzamentos reais; terminações visuais e lista de interferências. O schema passou a V3, com leitura de V1/V2. Exportação CAD/SolidWorks/STEP continua em standby por solicitação do usuário.

As decisões e limitações estão em `REFINAMENTOS.md`. Esta é uma auditoria do software feita pelo agente implementador, não uma revisão independente de engenharia.

## Comandos e ambiente

Windows, Node.js 24.14.1, npm 11.11.0. Navegador Chromium integrado com WebGL. Desenvolvimento em 127.0.0.1:3002; compilação estática em 127.0.0.1:4176.

- `npm run package`: aprovado; executou os testes, a verificação TypeScript, o build e a preparação do pacote.
- `npm test`: **45 testes aprovados, zero falhas**.
- `npm run build`: aprovado; HTML único de aproximadamente 905 kB. Permanecem dois avisos sobre `use client` em lucide-react; não impediram a execução observada.
- `npm run audit:portable`: aprovado; HTML distribuído idêntico ao build, recursos embutidos, documentos/licenças, três exemplos V3 e fontes/testes/scripts iguais aos originais.
- `git diff --check`: sem problemas de whitespace nos arquivos rastreados.
- Nenhuma dependência adicionada ou atualizada. Manifest e lockfile recebem a versão 1.2.0 do aplicativo.

SHA-256 de `dist/index.html` e do HTML distribuído:

`4c0b9293648e20e0c99fc6604317bc9156859fa88d8f0a32d03b685ff5392dd7`

## Cobertura automatizada

Os 30 testes anteriores foram mantidos e adaptados às mudanças intencionais do schema, da presença da traseira e dos nós intermediários. Permanecem as verificações de conectividade, simetria, offsets, pontos vinculados, propriedades físicas, entradas inválidas e persistência. O teste de extremos percorre agora 21 parâmetros em três configurações: **126 combinações**, além das **120 combinações de semente fixa**.

A referência V1 capturada anteriormente continua verificando as coordenadas originais, limites, categorias, diâmetros, sequência dos apoios originais e comprimentos. Novos nós de ligação e os rótulos pós-firewall são mudanças intencionais. Os comprimentos são comparados com tolerância numérica; nenhum apoio original da fixture foi deslocado pela migração.

Os 15 testes de refinamento cobrem:

- Dianteiro com pós-firewall independente, medidas traseiras e ausência de B–R.
- Ativação/desativação da traseira, dependência de B–R, manutenção dos offsets e modo sem travamentos adicionais.
- Migração V2 preservando espessuras, densidade e presença/ausência original da traseira.
- Edição inversa de inclinação/comprimento superior e inferior, inclusive com offset; apoios permanecem nos tubos. Valores fora da faixa são limitados e valores não finitos são rejeitados.
- Separação entre contato intencional de uma ligação e interferência entre duas barras próximas.
- Inclusão de par espelhado, soma de massa, leitura/escrita V3, suspensão e retorno dos tubos cujos apoios foram ocultados.
- Rejeição de duplicatas, sobreposições ao adicionar, dados malformados e excesso de tubos. Travessa espelhada não é contada duas vezes.
- Interseção em X com um nó compartilhado, pontos de término na superfície circular e casos de segmentos paralelos, degenerados ou com aproximação em planos distintos.
- Aviso de trechos sem espaço entre encontros, preservando seus eixos e propriedades do projeto.
- Arranjos iniciais rear/front/both/none com encontros conectados, nenhuma interferência apontada e nenhum trecho ocultado por ser curto.

## Navegador real

| Cenário | Observação |
| --- | --- |
| Independência da traseira | Dianteiro ativo, traseiro desligado e pós-firewall ativo: 32 membros |
| Largura traseira | Alterada para 900 mm com travamento traseiro desligado; largura do frame passou a 900 mm |
| Inclinação superior | Q–P alterado para 70°; comprimento passou a 513,4 mm |
| Histórico | Desfazer recuperou aproximadamente 82°; Refazer reaplicou a edição |
| Comprimento inferior | P–J recebeu 500 mm; inclinação exibida de 57,1° |
| Avisos após edição | Aproximação de J à travessa I produziu quatro pares de interferência; o modelo não deslocou os apoios automaticamente |
| Tubo adicional | Q_L → F_L com par: contagem passou de 32 a 34; remoção voltou a 32 e Desfazer recuperou 34 |
| Persistência | Recarregamento manteve os 34 membros do projeto salvo |
| JSON V3 | Download lido no disco: schema 3, bracing front, rearEnabled true, largura 900 e tubo T1 espelhado presentes |
| Importação V2 | Exemplo dianteiro do commit anterior abriu com 27 membros e pós-firewall desligado |
| Ativar traseira após importação | Passou a 32 membros, mantendo o travamento traseiro desligado |
| Sobreposição ao adicionar | Tentativa C_L → D_L rejeitada com mensagem; não criou um tubo duplicado |
| HTML compilado | Executou por HTTP local; reabriu o JSON V3 baixado com 34 membros, inclinação 70° e largura 900 mm |
| Inspeção visual | Conferidas vistas 3D, lateral e superior; a terminação foi refinada para acompanhar a superfície receptora, evitando o vão do primeiro recuo plano |
| Tela estreita | Viewport 390 × 844: controles de inclusão e apoios acessíveis; largura útil e documento com 375 px, sem transbordamento horizontal. Viewport restaurado após teste |
| Console | Nenhum erro registrado nos fluxos observados em desenvolvimento e no HTML compilado |

## Limites desta auditoria

- A lista de interferências usa segmentos de eixos e raios, com exclusão do contato local junto a um nó compartilhado. Não testa integralmente sólidos, soldas, raios de dobra, auto-interferências de um mesmo membro ou resistência.
- A terminação da malha é aproximada. Não gera geometria CAD de fabricação. Alterações livres ainda podem produzir interferências ou trechos muito curtos; os avisos orientam o ajuste.
- O cálculo de massa continua baseado nos eixos e não desconta recortes/encaixes. A visualização não declara conformidade RATBSB.
- A abertura direta por duplo clique não foi repetida: o navegador de automação havia bloqueado `file://` na auditoria anterior. O bloqueio não foi contornado; o mesmo HTML foi testado via HTTP local.
- Não houve nesta rodada instalação limpa, consulta de vulnerabilidades, teste de ZIP, rede desligada, teste em outros navegadores/sistemas ou repetição do arraste manual de eixos 3D. Simetria, offsets e edição dos pontos permanecem cobertos pelos testes de modelo.

## Repetir

```text
npm ci
npm run package
npm run audit:portable
npm run preview
```

A pasta `release/BajaFrame` contém o HTML atualizado, documentação, exemplos V3, código, testes e lockfile. Um ZIP antigo não é atualizado automaticamente; compacte novamente essa pasta se precisar distribuir por ZIP.
