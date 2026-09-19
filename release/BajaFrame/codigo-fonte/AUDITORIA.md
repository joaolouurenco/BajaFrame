# Auditoria da entrega — BajaFrame 1.0

Data: 19 de setembro de 2026.

## Resultado e escopo

A entrega implementa o escopo acordado: visualizador local do frame, parâmetros ajustáveis, identificação de membros, edição de pontos por coordenadas e eixos 3D, simetria, configurações de travamento, persistência e compartilhamento de configurações. Banco, piloto, motor e suspensão não foram agregados ao produto. Não há declaração de aprovação regulamentar, análise estrutural ou modelo de fabricação.

Auditoria realizada pelo próprio agente que implementou o projeto, com testes automatizados e inspeção da interface. Não é uma revisão independente de engenharia. A aprovação descrita abaixo é do funcionamento do software dentro do escopo, não do chassi segundo o regulamento.

## Ambiente

- Windows, Node.js 24.14.1, npm 11.11.0.
- Dependências exatas registradas no `package-lock.json`.
- Navegador Chromium integrado ao ambiente de trabalho, com WebGL disponível.
- Testes de interface em 1280 × 720 e em viewport estreito de 390 × 844. Nesse último, a área útil apresentou 375 px por conta da barra de rolagem; a largura do documento também foi 375 px, sem transbordamento horizontal.
- Desenvolvimento em `127.0.0.1:3000`; pacote estático em `127.0.0.1:4173`.

## Verificações automatizadas

`npm test`: **16 testes aprovados; 0 falhas**.

1. Grafo único e conectado para travamento dianteiro, traseiro e combinado; pontos e identificadores consistentes.
2. Valores mínimo e máximo de cada um dos 15 parâmetros nas três configurações: **90 combinações**.
3. **120 combinações adicionais**, com gerador pseudoaleatório de semente fixa para repetibilidade.
4. Movimento de cada um dos sete tipos de ponto, a partir de ambos os lados, preservando o espelhamento e as conexões.
5. Edição independente e reativação de simetria usando o lado esquerdo.
6. Desativação da simetria sem deslocamento inesperado de um ponto já ajustado.
7. Pontos derivados acompanhando seus membros de apoio.
8. Diâmetros independentes para membros primários e secundários.
9. Impossibilidade de mover livremente um ponto vinculado pela função de edição.
10. Limites de coordenadas na edição e rejeição de valores não finitos.
11. Serialização e leitura de JSON preservando a geometria.
12. Rejeição de versões incompatíveis, parâmetros fora de faixa e ajustes malformados.
13. Descarte de propriedades desconhecidas na importação.
14. Dimensões e soma dos comprimentos calculadas a partir da geometria efetiva.
15. Preservação dos deslocamentos locais ao mudar uma dimensão-base.
16. Aviso para pontos coincidentes, sem introduzir números inválidos no modelo.

`npm run build`: TypeScript sem erros e compilação concluída. O empacotador registra dois avisos sobre a diretiva `use client` da biblioteca de ícones; não há componentes de servidor neste aplicativo e os ícones foram verificados na interface. Os avisos não impediram a geração nem a execução.

`npm audit`: **0 vulnerabilidades conhecidas** reportadas na data da auditoria, incluindo dependências de desenvolvimento. É uma consulta ao banco do npm naquele momento, não garantia de ausência de falhas desconhecidas.

## Verificações em navegador real

| Cenário | Resultado observado |
| --- | --- |
| Inicialização do 3D | Frame renderizado, 30 membros no exemplo traseiro, sem erros de console nos fluxos observados |
| Campo numérico | Altura alterada de 1.180 para 1.300 mm; medida inferior atualizada |
| Desfazer | Altura retornou a 1.180 mm |
| Slider pelo teclado | Seta direita levou a altura a 1.190 mm |
| Espelhamento | B_L movido a Y=450 mm; B_R passou a Y=-450 mm e a largura a 900 mm |
| Arraste real do manipulador | Na vista lateral, eixo X de B_R arrastado de aproximadamente -209,8 mm a 20 mm; o frame acompanhou |
| Desfazer o arraste | Um único Desfazer restaurou X≈-209,8 mm |
| Configurações | 27 membros no dianteiro, 30 no traseiro e 34 no combinado |
| Importar exemplo | JSON combinado abriu com nome e 34 membros corretos |
| Download | Arquivo JSON foi encontrado na pasta de downloads e reaberto pelo aplicativo; o evento de download do conector expirou, mas o arquivo foi gerado corretamente |
| Reabrir JSON baixado | Configuração combinada restaurada com 34 membros |
| Persistência | Recarregamento preservou o projeto salvo automaticamente no navegador |
| Arquivo inválido | Importação da versão 99 foi rejeitada com mensagem; o frame de 34 membros permaneceu aberto |
| Vistas | Perspectiva, lateral, superior e frontal acionadas na interface |
| Cotas | Conferidas na vista superior; tamanho de texto ajustado para permanecer legível com a câmera |
| Responsividade | Cena, métricas, cabeçalho e controles acessíveis no viewport estreito, com rolagem vertical |
| Ajuda | Diálogo aberto e conteúdo de uso disponível |

## Distribuição

- `BajaFrame.html` contém JavaScript e CSS embutidos; não há `<script src>` ou folhas de estilo externas no documento final.
- Não existem chamadas a serviços de IA, fontes remotas ou APIs de backend no código da aplicação.
- O HTML estático foi executado por HTTP local sem servidor de desenvolvimento, usando o mesmo arquivo distribuído.
- O pacote inclui guia inicial, README, este relatório, licenças das bibliotecas embarcadas, três exemplos JSON, código-fonte, testes, scripts de construção e lockfile.
- O código-fonte é distribuído sem `node_modules`, chaves de API, arquivos `.env` ou materiais originais do usuário.
- `npm run audit:portable` confere que o HTML distribuído corresponde à compilação atual e que os documentos, licenças, lockfile, testes e exemplos estão presentes.
- O ZIP foi extraído em uma pasta de auditoria separada. `npm ci` instalou do lockfile sem reutilizar `node_modules`; os **16 testes e a compilação passaram nessa cópia limpa**. O HTML recompilado teve o mesmo SHA-256 da entrega.
- A integridade do ZIP foi conferida com leitura de todos os membros e teste CRC; nenhum arquivo corrompido foi encontrado.
- SHA-256 do HTML final: `b2c373c98483b42f4ed37b18d48f6de05ea9c48c32645423802f9aca8a7dddbe`.

## Limitações da auditoria

1. **Abertura por duplo clique:** o navegador de automação bloqueou navegação `file://`. Não foi tentado contornar esse bloqueio. O arquivo é autossuficiente e foi testado via servidor estático local, mas a abertura direta por duplo clique não pôde ser exercitada neste ambiente. A alternativa de execução pelo código-fonte está documentada.
2. **Outros navegadores e sistemas:** Firefox, Safari, macOS e Linux não foram executados nesta auditoria. A distribuição usa recursos web modernos e oferece instalação do código-fonte para Windows/macOS/Linux, porém compatibilidade real depende do navegador e da GPU.
3. **Rede desligada:** a independência de recursos externos foi verificada no conteúdo do HTML e no código da aplicação; não foi feito um ensaio com a interface de rede do computador desligada.
4. **Fabricação e regulamento:** não houve análise estrutural, simulação física, validação de soldas, dobras ou aprovação perante o RATBSB. Cruzamentos visuais não comprovam juntas de fabricação.
5. **Geometria livre:** o aplicativo preserva as conexões dos pontos definidos, mas não detecta todas as interseções, torções ou formas inadequadas que o usuário pode produzir.

## Como repetir

Dentro de `codigo-fonte` (ou na raiz do projeto de desenvolvimento):

```text
npm ci
npm run check
npm run package
npm run audit:portable
npm audit
```

Para a auditoria manual, use os cenários da tabela. A configuração padrão é um exemplo ilustrativo; não é uma recomendação de fabricação.
