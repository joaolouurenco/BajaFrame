# BajaFrame 1.2

Visualizador 3D paramétrico de um frame Baja para a equipe explorar e discutir a estrutura.

## Para usar sem instalar nada

1. Extraia o ZIP recebido para uma pasta do computador. Não abra o HTML de dentro do ZIP.
2. Abra `BajaFrame.html` com dois cliques. Se necessário, use **Abrir com → Google Chrome ou Microsoft Edge**.
3. Use **Dimensões** para alterar medidas, **Estrutura** para trocar o travamento e **Pontos** para editar coordenadas.

A versão portátil inclui todo o programa em um único HTML. Não exige Node.js, Python, internet, conta Google, chave de IA ou servidor. Requer navegador moderno com WebGL 2 e aceleração gráfica disponível. O arquivo roda localmente e não envia os projetos a serviços externos.

## Controles

- Arraste o fundo da cena para girar em 3D; use a roda do mouse para zoom e o botão direito para deslocar.
- Em telas sensíveis ao toque, use um dedo para girar e dois para zoom/deslocamento.
- Use **3D / Lateral / Superior / Frontal** para mudar de vista e **Enquadrar frame** para reenquadrar.
- Mude uma medida pelo slider ou pelo campo numérico. Para confirmar uma medida digitada, pressione Enter ou saia do campo. Valores fora do intervalo são limitados ao intervalo do controle.
- Em **Estrutura**, configure **Pós-firewall** separadamente e ative/desative os travamentos **Dianteiro** e **Traseiro**. Abra **Avançado** para ajustar diâmetro externo, espessura e densidade.
- Clique em um tubo para ver categoria, comprimento, diâmetros externo e interno, espessura e massa estimada. A lista de membros em **Estrutura** oferece a mesma seleção sem precisar clicar no 3D. Os tubos herdam as propriedades globais da categoria; não há edição individual da seção.
- Em **Pontos**, selecione A, S, B, C, D, F ou R de um dos lados. Mova as setas coloridas ou digite X, Y e Z. A seleção abre os campos abaixo da lista; role o painel quando necessário.
- Os pontos H, I, U, V, P, Q e J são vinculados aos tubos de apoio. Eles acompanham as extremidades; não podem se desconectar por arraste livre. A posição de I é ajustável em **Estrutura**.
- **Simetria** espelha os ajustes dos pontos. Ao reativá-la após edições independentes, o lado esquerdo vira a referência. Tubos adicionais têm sua própria opção de par espelhado; um tubo unilateral não passa a ter um par automaticamente ao ativar a simetria dos pontos.
- **Restaurar este ponto** remove o deslocamento local do ponto e de seu par quando a simetria está ativada. O ponto retorna à geometria-base atual.
- **Desfazer/Refazer**, Ctrl+Z e Ctrl+Shift+Z (Cmd no macOS) recuperam até 50 alterações. Um gesto contínuo no slider ou no eixo 3D forma uma alteração. O histórico não persiste após recarregar.
- **Pontos**, **Nomes**, **Cotas** e **Eixos** mudam a visualização. Cotas são dimensões globais entre as linhas de centro, não dimensões externas dos tubos.

## Salvar e compartilhar

O programa tenta salvar automaticamente neste navegador. Este armazenamento depende do navegador e da localização do arquivo, pode ser bloqueado no modo privado e não acompanha o HTML para outra máquina.

Use **Salvar projeto** para baixar um arquivo `.bajaframe.json`. Envie esse JSON e a versão portátil para outra pessoa. Ela deve abrir o visualizador e clicar em **Abrir**, selecionando o JSON. Não há colaboração simultânea ou sincronização entre computadores. Arquivos JSON do programa são configurações; não são arquivos CAD.

Há três exemplos em `exemplos/`: traseiro, dianteiro e combinado. Eles são estudos geométricos ilustrativos.

Os novos arquivos usam **schemaVersion 3**. Projetos V1 e V2 continuam abrindo. Em V1, a migração acrescenta paredes de **1,6/1,2 mm** e densidade de **7.850 kg/m³**; em V2, mantém as propriedades físicas salvas. Em ambos, preserva as posições existentes: a estrutura traseira começa oculta nos antigos projetos somente dianteiros e ativa nos demais. Sua largura inicial recebe a antiga largura da base; Q/P/J recebem os antigos percentuais 15/62/52. Não se criam tubos adicionais na migração.

O salvamento automático mantém a chave `bajaframe.project.v1` e usa a mesma migração, passando a salvar V3. Visualizadores antigos não abrem V3; compartilhe o HTML atualizado com o JSON. Os encontros dos tubos são recalculados, sem mover os apoios originais, e não são armazenados como resultados redundantes.

Se uma importação falhar, o projeto atual permanece aberto. Projetos acima de 256 KB, versões incompatíveis e parâmetros inválidos são rejeitados. **Reiniciar** restaura o exemplo inicial e também pode ser desfeito durante a sessão.

## Escopo e interpretação

O objetivo é visualizar a estrutura, conforme definido com a equipe. Não é um projeto pronto para fabricação nem um verificador integral do RATBSB.

- Coordenadas: **X para frente, Y para a esquerda, Z para cima**, em milímetros. L é esquerdo; R é direito. O ponto R_L/R_R identifica também o vértice do travamento traseiro.
- A base começa em Z=0; não é uma definição de altura em relação ao solo de um veículo completo.
- O 3D representa o diâmetro externo, sem desenhar o interior oco. A espessura é usada nos cálculos físicos; alterá-la não muda os pontos nem o volume externo renderizado. Não há cálculo de resistência, soldas, encaixes ou raios reais de dobra.
- Os segmentos consecutivos de um membro indicam seu percurso visual. Cantos gráficos não especificam cortes ou soldas.
- Cruzamentos reais dos eixos geram nós compartilhados. O visual mantém um tubo contínuo e ajusta as pontas dos demais à sua superfície externa. Isso é uma representação aproximada do encontro, não uma definição de junta ou recorte de fabricação.
- Banco, piloto, motor, suspensão e outros sistemas não fazem parte desta versão.
- As classes e siglas organizam o esboço. Nenhum indicador declara conformidade com o regulamento.
- Os intervalos dos sliders são limites de exploração da interface, **não limites regulamentares**.
- Os alertas apontam pontos coincidentes, forma dianteira invertida, ajustes locais, tubos inativos, trechos muito curtos e interferências entre membros. O teste de interferências compara distâncias dos eixos com os raios e desconsidera o contato local de ligações intencionais. Não é uma verificação completa dos sólidos, de auto-interferências de um mesmo membro ou de fabricação.
- Medidas-base e ajustes locais são separados: primeiro a geometria é calculada pelos parâmetros; depois os deslocamentos dos pontos são somados. As medidas inferiores mostram a geometria resultante.

## Pós-firewall, travamentos e tubos adicionais

**Pós-firewall** controla as ligações S–R, A–R e a travessa entre R_L/R_R, com extensão, altura e largura próprias. O arco traseiro é a referência; o painel firewall não é desenhado. Os pontos R podem ser movidos em XYZ. Alterar o travamento dianteiro não oculta essa região. Desativar a região desativa também seu travamento B–R, preservando medidas e offsets; reativá-la não liga B–R automaticamente.

Os interruptores de **Travamentos** ativam Q–P/P–J no dianteiro e B–R no traseiro. Ambos podem ficar desligados; as diagonais básicas do arco/assoalho permanecem. Ativar B–R também ativa a região pós-firewall, pois R é seu apoio. No padrão, há 30 membros com travamento traseiro, 32 com dianteiro e pós-firewall, 34 com ambos, e 27 com dianteiro e pós-firewall desligado.

Em **Ajustar dianteiro**, edite inclinação e comprimento pelos campos ou sliders. A inclinação é o ângulo absoluto com o plano horizontal (XY). Mudar comprimento ou ângulo desloca Q ou J ao longo do tubo de apoio: os dois valores são relacionados e não podem ser escolhidos arbitrariamente de forma independente. Os limites mudam conforme a geometria. Quando há duas soluções, usa-se a mais próxima da posição atual.

Os controles usam o lado esquerdo como referência e compartilham os percentuais entre lados. Com offsets assimétricos, consulte os membros do lado direito para conferir seus comprimentos. Q percorre C → D, P percorre S → D e J percorre A → F, entre 5% e 95%. Mover P altera os limites dos dois trechos.

Em **Tubos adicionais**, selecione dois apoios, a categoria e se deseja um par espelhado. São permitidas até 32 definições; uma definição espelhada gera dois membros, exceto travessas cujo par seria o mesmo tubo. Duplicatas e sobreposição com uma ligação existente são rejeitadas ao adicionar. A lista permite remover e o histórico permite desfazer. Se a região de um apoio for desligada, seu tubo fica inativo e volta quando o apoio reaparece; não entra na massa enquanto estiver inativo.

**Encontros e interferências** mostra os pares que ainda precisam de ajuste. Clique no identificador para selecionar o tubo. Cruzamentos reais são ligados; aproximações em planos diferentes não recebem uma ligação artificial. Afaste ou reposicione apoios para tratar sobreposições entre diâmetros. Trechos inteiramente contidos nos encontros podem não aparecer no modo sólido; um aviso orienta a usar **Eixos** para conferir. As terminações visuais não alteram os comprimentos/massas calculados pelo eixo.

## Propriedades físicas e massa estimada

Em **Estrutura → Avançado**, a massa do frame e os subtotais de primários e secundários se atualizam com as medidas, pontos, travamento, seções e densidade. Ocultar uma categoria no 3D não a remove do cálculo.

| Propriedade | Padrão | Intervalo da interface |
| --- | --- | --- |
| Diâmetro externo primário | 31,8 mm | 20–50 mm |
| Parede primária | 1,6 mm | 0,5–5 mm, passo 0,1 mm |
| Diâmetro externo secundário | 25,4 mm | 15–40 mm |
| Parede secundária | 1,2 mm | 0,5–5 mm, passo 0,1 mm |
| Densidade global | 7.850 kg/m³ (aço) | 1–30.000 kg/m³ |

Esses valores são ilustrativos, não especificações regulamentares ou de fabricação. O modelo exige valores finitos, parede positiva e **2 × parede < diâmetro externo**. Importações fora dos intervalos são rejeitadas; campos numéricos limitam a entrada ao intervalo indicado.

As funções puras de `src/model.ts` recebem D, t e L em mm. Calculam `d = D − 2t`, `A = π/4 × (D² − d²)` em mm², `V = A × L` em mm³ e `m = V × 10⁻⁹ × densidade` em kg. L é a soma dos segmentos do eixo do membro. Área, volume, diâmetro interno e massas são derivados; o JSON armazena apenas os dados necessários para recalculá-los.

A estimativa soma tubos de seção uniforme ao longo dos eixos. Não desconta sobreposições, recortes ou encaixes e não acrescenta soldas, suportes ou correções de dobra. Não substitui pesagem, CAD de fabricação, FEA ou avaliação de conformidade RATBSB. Não há exportação STEP/STP nesta etapa.

## Para desenvolver ou executar pelo código-fonte

Esta seção é opcional. Quem só quer visualizar pode usar o HTML pronto.

Requisitos: **Node.js 22.12 ou superior (recomendado 24 LTS)**, npm e internet apenas para baixar as dependências. No pacote entregue, entre na pasta `codigo-fonte`; no projeto original, esta pasta é a raiz.

```text
npm ci
npm run dev
```

Abra o endereço exibido no terminal, normalmente `http://127.0.0.1:3000`. O servidor fica limitado ao próprio computador. Se a porta 3000 estiver ocupada, use `npm run dev -- --port 3001` e abra o novo endereço. Para encerrar, pressione Ctrl+C no terminal.

```text
npm test              # Geometria, propriedades físicas, validação e migração JSON
npm run build        # Verificação TypeScript + HTML portátil em dist/index.html
npm run preview      # Servir a compilação localmente
npm run package      # Testar, compilar e preparar release/BajaFrame/
npm run audit:portable # Conferir recursos embutidos e conteúdo do pacote
npm audit            # Consultar vulnerabilidades conhecidas das dependências
```

O lockfile está incluído para instalações reproduzíveis. `npm run package` produz uma pasta distribuível: compacte o conteúdo de `release/BajaFrame` ou compartilhe essa pasta. `BajaFrame.html` também funciona sozinho; mantenha os avisos de licença junto ao distribuir.

## Organização do código

| Arquivo | Responsabilidade |
| --- | --- |
| `src/model.ts` | Geometria, propriedades físicas, simetria, tubos adicionais e migração V1/V2 → V3 |
| `src/connections.ts` | Interseções, nós compartilhados, interferências e terminações visuais |
| `src/bracing.ts` | Medidas, limites e edição inversa de ângulo/comprimento do dianteiro |
| `src/Viewport.tsx` | Cena 3D, seleção, vistas, cotas e manipulador de eixos |
| `src/App.tsx` | Controles, histórico, importação/exportação JSON e salvamento local |
| `src/styles.css` | Interface responsiva e apresentação |
| `tests/model.test.ts` | Testes automatizados independentes da renderização |
| `tests/refinement.test.ts` | Traseira independente, novos travamentos, tubos e encontros |
| `scripts/package.mjs` | Preparação do pacote portátil e do código-fonte |
| `scripts/audit-portable.mjs` | Verificações de distribuição e recursos externos |
| `AUDITORIA.md` | Evidências, resultados e limites da auditoria desta entrega |
| `REFINAMENTOS.md` | Mudanças desta etapa, decisões abertas e exportação CAD em standby |

## Problemas comuns

- **Arquivo abre como texto:** escolha Chrome ou Edge em “Abrir com”. Confirme que a extensão é `.html`.
- **Cena 3D indisponível:** use um navegador atualizado com aceleração gráfica. Restrições de GPU/WebGL de dispositivos gerenciados podem impedir a renderização. Os campos de configuração continuam disponíveis quando a criação do contexto falha.
- **Alterações não aparecem:** os campos numéricos confirmam ao pressionar Enter ou perder o foco. Nos sliders, a alteração é imediata.
- **Ponto parece diferente da medida-base:** existe um ajuste local. Restaure o ponto ou remova os ajustes locais.
- **O frame saiu da tela:** clique em Enquadrar frame.
- **Projeto sumiu ao trocar de computador:** abra o JSON salvo. O armazenamento local não é um serviço de sincronização.
- **PowerShell bloqueou `npm.ps1`:** use `npm.cmd ci` e `npm.cmd run dev`, ou abra o Prompt de Comando. Não é necessário alterar a política de segurança do Windows.

## Origem

Desenvolvido a partir do escopo discutido com a equipe e da análise dos protótipos enviados (Claude/Python e Google AI Studio/React). A organização de siglas tem como referência o RATBSB Emenda 7 enviado pelo usuário. O regulamento e os arquivos originais não foram modificados nem são redistribuídos neste pacote. A geometria e a interface foram reorganizadas para o escopo de visualização. Não se trata de ferramenta oficial da SAE BRASIL.

Bibliotecas de terceiros e suas licenças acompanham a distribuição em `THIRD-PARTY-NOTICES.txt`.
