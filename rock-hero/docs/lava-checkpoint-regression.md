# Lava e checkpoint — investigação de 20/10/2026

Base inspecionada: `38d3f48cbb18383ab3019a9fe504d3031c75aaea`.
Não foi necessário alterar `GameScene.handleTileCollision()`.

## Resultado da inspeção e execução em Node

O jogo usa Phaser 3.80.1 (`index.html`). Seu parser Tiled lê
`tilesets[].tiles[].properties` e copia essas propriedades para cada `Tile`.
Propriedades em `tilesets[].properties` não são herdadas pelos tiles de um
tileset baseado em imagem. Isso foi verificado executando o parser real,
além da leitura de
[ParseTilesets](https://github.com/phaserjs/phaser/blob/v3.80.1/src/tilemaps/parsers/tiled/ParseTilesets.js)
e [AssignTileProperties](https://github.com/phaserjs/phaser/blob/v3.80.1/src/tilemaps/parsers/tiled/AssignTileProperties.js).

| Mapa / tileset | IDs locais / GIDs | Instâncias em solids | Diagnóstico |
| --- | --- | --- | --- |
| Caverna / lava-laranja-6fps | 0–3 / 65–68 | 11, todas inicialmente GID 65 | ID 0 tinha `jumpback_to_checkpoint`; dano não era acionado. |
| Caverna / lava-laranja-profunda-6fps | 0–3 / 52–55 | 9, todas inicialmente GID 52 | Nenhum frame tinha propriedade de dano. Mesmo líquido de lava da encosta, também corrigido. |
| Chefe / lava-roxa-animated | 0–3 / 9–12 | 28, todas inicialmente GID 9 | Os quatro IDs já tinham `jump_back_to_checkpoint`; não foi demonstrada falha de dano neste grupo. Removida apenas propriedade incorreta redundante do tileset. |

As 6 instâncias GID 9 do chefe em `fg_decoration` são decorativas: o collider
do jogador usa somente `solids`. As bolhas em `bg_decoration` também não fazem
parte desta correção. Os quatro frames de ambas as lavas laranja agora têm a
propriedade canônica, incluindo frames que possam ser pintados diretamente no
Tiled. A animação do jogo altera `tile.index`, preservando `tile.properties`.

Coordenadas de grade, base zero, em `solids`:

- Caverna, GID 65: (41,14), (42,15), (43,16), (44,17), (45,18), (46,19), (47,20), (48,20), (49,21), (50,21), (51,21).
- Caverna, GID 52: (41,15), (42,16), (43,17), (44,18), (45,19), (46,20), (46,21), (47,21), (48,21).
- Chefe, GID 9: x de 4 a 31, y=12.

O arquivo `map-5--caverna.tmj` é uma versão anterior diferente do mapa JSON
carregado pelo jogo; não foi sobrescrito ou sincronizado automaticamente.

## Reproduzir a verificação

Com Node.js 22, na pasta `rock-hero`:

```sh
npm ci --ignore-scripts
npm test
```

A suíte usa o parser real de Phaser 3.80.1, com versão fixada e lockfile.
Verifica os frames e todas as instâncias citadas, a ausência da grafia errada,
a não herança de propriedades do tileset e a preservação das propriedades
durante a animação real de `GameScene`.

Também executa os métodos reais `handleTileCollision`, `takeDamage` e
`respawnAtCheckpoint`, com sprite, HUD e tween simulados. Confere redução de
corações, destino do tween, desativação e reativação do corpo, proteção contra
dano repetido, invencibilidade, vitória e fluxo de morte no último coração.
O tween é concluído pelo teste; isto não constitui execução da física no navegador.

Na base original, 3 dos 5 testes falharam: validação dos mapas (incluindo a
entrada redundante do chefe) e dano da caverna. O teste comportamental do chefe
já passou antes da correção. Com os mapas corrigidos, os 5 testes passaram.

## Verificação no navegador ainda pendente

Não havia navegador Chromium instalado no ambiente local. Não foi reproduzida
uma colisão física nem observada visualmente a animação de retorno. Para validar:

1. Inicie `npm start` e abra a caverna com pelo menos dois corações.
2. Ative um checkpoint. Colida com a lava superficial em (41,14), centro em
   (1328,464) pixels, e com a profunda em (41,15), centro em (1328,496), usando
   depuração para alcançar a profunda se a superfície impedir o acesso.
3. Confirme perda de um coração, retorno ao checkpoint ativo e ausência de dano
   duplicado durante retorno/invencibilidade. Repita após alguns ciclos da animação.
4. No chefe, repita em (4,12), centro em (144,400), sobre a lava em `solids`.
   Confirme que a decoração não dispara dano por si só.
5. Repita com um coração: deve seguir o fluxo de morte/perda de vida existente,
   em vez do retorno normal ao checkpoint.
