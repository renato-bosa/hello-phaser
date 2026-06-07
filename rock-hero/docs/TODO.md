# TODO — Próximas refatorações e melhorias

> Lista viva de intenções de refatoração e dívida técnica reconhecida.
> Itens entram aqui quando a intenção está clara mas o plano detalhado ainda não foi escrito.
> Quando um item ganha plano formal, vira `REFACTOR-<Alvo>.md` no mesmo diretório.

---

## 🔴 Alta prioridade

### Refatorar `js/scenes/GameScene.js` (1.260 linhas)

**Motivação**: depois da quebra de `GameData.js` (-82,5%), `GameScene` virou o maior arquivo do projeto e o último "god object" remanescente. Apesar de já delegar comportamento para os managers (`PlayerController`, `EnemyManager`, `EffectsManager`, `HUDManager`, `PauseMenu`, `VictoryScreen`), ainda concentra responsabilidades demais.

**Responsabilidades atualmente misturadas dentro de `GameScene`**:

1. **Carregamento e construção do mapa** (`preload`, `createMap`, `setupTilesetAutoLoader`, `parseMapObjects`, `_playTilesetAnimation`, `_getNonEmptyFrameCount`)
2. **Animação de tiles** (`setupTileAnimations`, `setupAutoTileAnimations`, `setupLavaBubblesAnimation`, `getTilesetProperties`)
3. **Construção de items do nível** — 9 sub-criadores: `createGoal`, `createCheckpoints`, `createTrampolines`, `createStars`, `createSpeedBoosts`, `createExtraLives`, `createMushrooms`, `createMovingPlatforms`, `createWaterZones`
4. **Coleta de items** (`collectStar`, `collectExtraLife`, `collectMushroom`)
5. **Efeito do cogumelo / shader oscilação** (`_activateOscillationEffect`, lifecycle do `VerticalOscillationPipeline`)
6. **Plataformas móveis** (`createMovingPlatforms`, `updateMovingPlatforms`)
7. **Auto-scroll** (`_updateAutoScroll`)
8. **Vida perdida + Game Over** (`onPlayerDied`, `showLostLifeMessage`, `showGameOverScreen`, `_returnToWorldMap`) — ~250 linhas só dessas
9. **Countdown inicial** (`startCountdown`)
10. **Colisões cruzadas** (`setupPhysics`, `handleTileCollision`) — orquestração de overlaps/colliders

**Módulos propostos** (paralelo à divisão de `GameData`):

| Novo módulo | Foco | Tira de `GameScene` |
|---|---|---|
| `MapLoader` | Tilemap JSON + tilesets + parse de objects | ~250 linhas |
| `TileAnimationManager` | `setupTileAnimations` / `setupAutoTileAnimations` / `setupLavaBubblesAnimation` | ~120 linhas |
| `ItemsManager` (ou um por tipo) | Criação + coleta de stars/trampolines/speedBoosts/extraLives/mushrooms/checkpoints/goal | ~200 linhas |
| `MovingPlatformManager` | `createMovingPlatforms` + `updateMovingPlatforms` | ~60 linhas |
| `AutoScrollController` | `_updateAutoScroll` + setup inicial | ~80 linhas |
| `MushroomEffect` | Shader pipeline + fade-in/out + timers | ~90 linhas |
| `LifeScreen` | `onPlayerDied` + `showLostLifeMessage` + `showGameOverScreen` | ~250 linhas |
| `CountdownIntro` | `startCountdown` | ~70 linhas |

**Meta**: reduzir `GameScene` a ≤ 300 linhas (apenas orquestração: `create()` instancia managers, `update()` chama `manager.update()`, transições de view).

**Padrão a replicar** (de `REFACTOR-GameData.md`):
- Quebrar em **fases mergeáveis independentemente** (cada uma com smoke test no browser)
- Cada manager recebe `scene` no construtor (mesmo padrão dos managers atuais)
- Documentar trade-offs em `REFACTOR-GameScene.md` quando o plano detalhado for escrito
- **Sem big-bang**: managers podem coexistir com código residual em `GameScene` durante a transição

**Esforço estimado**: 15-25h (similar à refatoração de `GameData`, talvez ligeiramente menor por já ter o padrão estabelecido).

**Risco**: 🟡 Médio. Mexe em colisões e ordem de execução de `update()`. Smoke test crítico: cada fase do jogo precisa rodar idêntica.

---

## 🟡 Média prioridade

### Eliminar duplicação de detecção mobile
`'ontouchstart' in window || navigator.maxTouchPoints > 0` aparece em **7 arquivos**. Extrair para `GameState.isMobile()` (ou módulo `Platform`).

**Locais atuais**:
- `MenuScene.js`, `SlotSelectScene.js`, `CharacterSelectScene.js`, `WorldMapScene.js`, `GameScene.js`, `PauseMenu.js`, `VictoryScreen.js`

**Esforço**: 30min.

---

### Padrão de overlay reutilizável
Estrutura "retângulo escuro fullscreen + título + lista de botões + navegação + cleanup" aparece em ~6 lugares:
- `MenuScene.showRanking()`, `MenuScene.showEffectsMenu()`
- `PauseMenu.show()`
- `VictoryScreen.showRanking()`, `VictoryScreen._showVictoryOverlay()`
- `GameScene.showGameOverScreen()`, `GameScene.showLostLifeMessage()`

Extrair um helper `OverlayMenu` ou usar `scene.launch` para overlay como cena separada.

**Esforço**: 4-6h.

---

### Tilesets via propriedade `type` em vez de `tilesetName.includes(...)`
Em `GameScene.parseMapObjects`, o fallback por substring (`tilesetName.includes('sapo')`, `'star'`, `'trampoline'`...) é frágil — renomear um tileset no Tiled quebra silenciosamente.

**Sugestão**: padronizar 100% via propriedade `type` no Tiled. Logar warning quando cair no fallback de substring. Eventualmente remover o fallback.

**Esforço**: 2-3h.

---

### Bug sutil: `Phaser.Math.Between(0xRRGGBB, 0xRRGGBB)`
Em `WorldMapScene` (decoração de caverna), usado para "interpolar cor entre dois hex". `Between` retorna inteiro entre dois inteiros — não interpola RGB. Resultado raramente é uma cor visualmente intermediária.

Trocar por `Phaser.Display.Color.Interpolate.ColorWithColor` ou amostrar de uma palette fixa.

**Esforço**: 15min.

---

## 🟢 Baixa prioridade / nice-to-have

### Fase 8 da refatoração de `GameData` (opcional)
Migrar call sites de `GameData.X(...)` para `Module.X(...)` direto e deletar a fachada. Documentado em `REFACTOR-GameData.md`. Sem ganho funcional, só estilístico.

### ESLint + Prettier
Sem regras automatizadas hoje. Mínimo: `no-unused-vars`, `prefer-const`, `eqeqeq`.

### `BootScene` / `PreloadScene`
Cada cena recarrega sprites de personagem no próprio `preload()`. Phaser cacheia, mas uma cena dedicada de boot com barra de progresso seria mais limpa.

### Gravidade invertida por corpo (não global)
`upsideDown` muda `physics.world.gravity.y = -800`, afetando inimigos. Idealmente, gravidade individual no body do player.

### Single source of truth para `VERSION`
Hoje vive em 3 lugares: `<script>window.GAME_VERSION = '0.85'</script>` no HTML, `GameState.VERSION`, e `package.json` (desatualizado e nunca consultado). Resolver via build/CI no futuro.

### Testes automatizados
Pelo menos smoke tests de `SaveManager` e `ProgressTracker` (afetam saves de usuários reais). Os módulos puros pós-refactor já estão prontos para testes isolados.

### TypeScript gradual
Adicionar `// @ts-check` + JSDoc consistente nos arquivos novos (`core/`, `data/`, `loaders/`).

---

## ✅ Concluídos

- **Refatoração de `GameData.js`** (06-07/06/2026) — de 1.386 → 242 linhas (-82,5%), distribuído em 8 módulos. Ver `REFACTOR-GameData.md`.
