# Refinamento conjunto — BajaFrame 1.2

25 de outubro de 2026.

## Solicitação e mudanças

| Pedido | Implementação nesta etapa |
| --- | --- |
| Tubos atravessando outros em várias regiões | Busca global de cruzamentos entre eixos de membros; inserção de nó compartilhado; pontas visuais ajustadas à superfície do tubo contínuo. Lista selecionável de interferências para aproximações sem interseção dos eixos e sobreposições colineares. |
| Variar ângulo e medida do travamento, principalmente dianteiro | Q–P e P–J com controles de inclinação e comprimento, resolução da posição do apoio e limites dinâmicos. Controles percentuais Q/P/J para ajustar diretamente os apoios. |
| Adicionar tubos | Ligações entre pontos existentes, categoria primária/secundária, par espelhado opcional, remoção e desfazer. |
| Traseira pós-firewall independente | Ativação e extensão/altura/largura próprias; ajustes XYZ nos pontos R. As ligações S–R e A–R deixam de depender da opção de travamento traseiro; apenas B–R é controlada por esse travamento. |
| Arquivo para SolidWorks/outros CAD | **Em standby por solicitação do usuário. Não implementado.** O arquivo de projeto continua `.bajaframe.json`. |

## Decisões desta primeira rodada

1. O pós-firewall continua com a topologia simples já existente, centrada em R_L/R_R. Não foi presumida uma estrutura de motor, suspensão, transmissão ou um painel firewall físico. As referências FABMID/FABLOW são mantidas internamente para compatibilidade, mas seus rótulos explicam que pertencem à região pós-firewall.
2. Um cruzamento real em 3D passa a representar uma ligação no esboço. Um tubo é considerado contínuo e os demais terminam nele visualmente. A prioridade do tubo contínuo é primário antes de secundário, seguida da ordem estável do modelo. Isso não define a sequência de fabricação.
3. A malha recebe terminações aproximadas na superfície externa do tubo receptor; não usa operações CAD booleanas, detalhes de solda ou raios de dobra. Setores muito curtos podem se fechar; trechos cujo eixo não tem espaço entre encontros são omitidos no modo sólido e geram aviso. O modo Eixos preserva o percurso do projeto.
4. Não se desloca automaticamente um tubo para eliminar uma aproximação sem cruzamento: isso mudaria a forma escolhida. A lista de interferências indica os membros para ajuste. O detector não é uma análise exaustiva de sólidos, interferências internas a um mesmo membro ou resistência.
5. Comprimento e inclinação dependem dos apoios. A edição inversa move Q ou J sobre o tubo receptor, mantendo P como referência. A edição é baseada no lado esquerdo; percentuais são globais, e offsets podem gerar resultados diferentes no lado direito.
6. Tubos adicionais só ligam pontos nomeados existentes. Não há pontos soltos ou biblioteca de conexões nesta rodada. Seu par espelhado é independente da opção de espelhar os ajustes dos pontos. Um tubo com apoio oculto é conservado no projeto, porém inativo no frame e na massa.
7. As estimativas físicas continuam baseadas nas seções e nos comprimentos dos eixos. Não são descontados recortes, sobreposições ou perdas de fabricação.

## Compatibilidade e dados

- Schema novo: **V3**, com `rearEnabled`, `extraTubes`, `rearWidth` e percentuais de Q/P/J. `bracing` também aceita `none`.
- Leitura de V1/V2 continua disponível. A migração mantém a presença/ausência anterior da traseira, medidas, offsets e propriedades físicas aplicáveis; introduz apenas os parâmetros que faltavam.
- Os nós de encontro são derivados e recalculados. Seus identificadores N1, N2 etc. não devem ser usados como apoios persistentes de tubos adicionais.
- A chave de localStorage foi preservada. Undo/redo registra também ativação de regiões, medidas do travamento e inclusão/remoção de tubos.
- Código-fonte, testes, exemplos e HTML único são distribuídos juntos. Nenhuma dependência adicional foi instalada.

## O que refinar juntos a seguir

- Confirmar se todo cruzamento real deve ser ligado ou se alguma região precisa de duas barras em planos distintos, sem ligação. Esta rodada usa a primeira interpretação, explicitada na interface.
- Avaliar se a topologia simples da traseira é suficiente ou se queremos dois níveis de longarinas com mais pontos editáveis.
- Testar os limites do dianteiro com as proporções que a equipe pretende usar; ajustar os intervalos com base nesses estudos.
- Avaliar edição de tubos adicionais já criados e novos apoios sobre membros, além da inclusão/remoção atual.
- Retomar a exportação CAD apenas quando solicitado: decidir se o objetivo é levar eixos editáveis ou sólidos tubulares e qual fluxo deverá ser conferido no software de destino.

Os itens acima são decisões futuras, não funcionalidades prometidas ou já implementadas. Resultados de testes desta entrega estão em `AUDITORIA.md`.
