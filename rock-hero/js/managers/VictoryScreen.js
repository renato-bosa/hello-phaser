/**
 * VictoryScreen - Telas de vitória e ranking
 * Responsável por: goal reached, aviso de estrelas, vitória, mundo completo, ranking
 */
class VictoryScreen {
    constructor(scene) {
        this.scene = scene;
        this.starsWarningActive = false;
    }

    reachGoal() {
        const scene = this.scene;
        if (scene.hasWon) return;

        if (scene.totalStars > 0 && scene.starsCollected < scene.totalStars) {
            this._showStarsWarning();
            return;
        }

        scene.hasWon = true;
        scene.currentView = 'victory';
        SoundManager.play('goalReached');

        const player = scene.playerController.player;
        player.setVelocity(0, 0);
        player.anims.play('idle', true);

        const finalTime = scene.elapsedTime;

        GameData.markLevelComplete(scene.currentLevel);
        const result = GameData.saveRecord(scene.currentLevel, finalTime, scene.playerName);

        if (result.isRecord) {
            scene.time.delayedCall(
                GC.VICTORY.RECORD_PULSE_DELAY_MS, () => SoundManager.play('newRecord')
            );
        }

        this._celebrate(result.isRecord, () => this._showVictoryOverlay(finalTime, result));
    }

    /**
     * Batida de celebração antes do overlay, e só então `onDone`.
     *
     * O respiro é o ponto central: sem ele, o overlay cobria a tela no mesmo
     * frame do contato com a bandeira e nenhum efeito seria visto. O jogador
     * já está congelado aqui porque `GameScene.update()` retorna cedo com
     * `hasWon`, mas a física segue rodando — se ele tocou a bandeira no ar,
     * cai e pousa naturalmente durante a celebração.
     */
    _celebrate(isRecord, onDone) {
        const scene = this.scene;

        if (!GameData.isFeatureEnabled('victoryCelebration')) {
            onDone();
            return;
        }

        const cfg = GC.VICTORY;
        const goal = scene.goal;
        const origin = goal || scene.playerController.player;

        if (goal) {
            // Seguro tweenar escala: _applyTilesetTransform usa flipX/angle,
            // nunca scale, então não há flip para desfazer aqui.
            scene.tweens.add({
                targets: goal,
                scale: { from: goal.scale, to: goal.scale * cfg.FLAG_POP_SCALE },
                duration: cfg.FLAG_POP_MS,
                yoyo: true,
                ease: 'Back.easeOut'
            });
        }

        scene.effectsManager.createVictoryBurst(origin.x, origin.y, isRecord);

        const delay = isRecord ? cfg.OVERLAY_DELAY_RECORD_MS : cfg.OVERLAY_DELAY_MS;
        scene.time.delayedCall(delay, onDone);
    }

    _showStarsWarning() {
        if (this.starsWarningActive) return;
        this.starsWarningActive = true;
        SoundManager.play('warning');

        const scene = this.scene;
        const centerX = scene.cameras.main.centerX;
        const centerY = scene.cameras.main.centerY;
        const remaining = scene.totalStars - scene.starsCollected;
        const starWord = remaining === 1 ? 'estrela' : 'estrelas';

        const warningBg = scene.add.rectangle(centerX, centerY - 50, 420, 60, 0x000000, 0.85)
            .setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY);

        const warningText = scene.add.text(centerX, centerY - 50,
            `⭐ Faltam ${remaining} ${starWord}!`, {
            fontSize: '24px', fontFamily: 'Arial', color: '#ffff00',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);

        if (scene.hudManager.starHUD) {
            scene.tweens.add({
                targets: scene.hudManager.starHUD,
                scale: 1.4,
                duration: 150,
                yoyo: true,
                repeat: 2
            });
        }

        scene.time.delayedCall(2000, () => {
            warningBg.destroy();
            warningText.destroy();
            this.starsWarningActive = false;
        });
    }

    _showVictoryOverlay(finalTime, result) {
        const scene = this.scene;
        const centerX = scene.cameras.main.centerX;
        const centerY = scene.cameras.main.centerY;
        const nextLevel = scene.currentLevel + 1;
        const hasNextLevel = nextLevel < GameData.LEVELS.length;
        const completedWorld = GameData.checkWorldCompletion(scene.currentLevel);

        const overlay = scene.add.rectangle(centerX, centerY, 640, 400, 0x000000, 0.82)
            .setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY);
        scene.overlayElements.push(overlay);

        this._spawnOverlaySparkles(centerX, centerY);
        this._spawnOverlayConfetti();

        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const continueLabel = isMobile ? 'Pressione O' : 'ENTER';

        let rankLabel = '';
        if (result.isRecord) {
            rankLabel = ' 🏆 NOVO RECORDE!';
        } else if (result.saved) {
            rankLabel = ` 🎖️ ${result.position}º lugar!`;
        }
        const timeColor = result.saved ? '#ffd700' : '#ffffff';

        if (completedWorld) {
            this._showWorldCompleteTransition(centerX, centerY, finalTime, rankLabel, timeColor, completedWorld, continueLabel);
            return;
        }

        if (hasNextLevel) {
            this._buildPhaseCompletePanel(centerX, centerY, {
                finalTime,
                rankLabel,
                timeColor,
                continueText: `${continueLabel} para continuar`,
                continueY: centerY + 88
            });

            const handleContinue = () => {
                GameData.saveMapPosition(GameData.state.currentWorld, nextLevel, 'victory:nextLevel');
                scene.scene.start('WorldMapScene', {});
            };

            this._bindContinueInput(handleContinue);
        } else {
            this._buildPhaseCompletePanel(centerX, centerY, {
                title: '🎉 VOCÊ ZEROU O JOGO! 🎉',
                titleColor: '#ffff00',
                titleSize: '26px',
                finalTime,
                rankLabel,
                timeColor,
                continueText: `${continueLabel} para voltar ao mapa`,
                continueY: centerY + 110,
                extra: () => {
                    const totalBest = GameData.getTotalBestTime();
                    if (totalBest !== null) {
                        const total = this._addOverlayText(
                            centerX, centerY + 68,
                            `🏅 Tempo Total: ${GameData.formatTime(totalBest)}`,
                            '20px', '#7ef0c0', 3, 'monospace'
                        );
                        this._popIn(total, 280);
                    }
                }
            });

            const handleBackToMap = () => {
                GameData.saveMapPosition(GameData.state.currentWorld, scene.currentLevel, 'victory:gameComplete');
                scene.scene.start('WorldMapScene', {});
            };

            this._bindContinueInput(handleBackToMap);
        }
    }

    /**
     * Layout compartilhado da tela de fase completa:
     * nome da fase → título (pill) → estrelas → tempo → (extra) → continue.
     */
    _buildPhaseCompletePanel(centerX, centerY, opts) {
        const scene = this.scene;
        const levelName = GameData.LEVELS[scene.currentLevel]?.name || `Fase ${scene.currentLevel + 1}`;

        const nameText = this._addOverlayText(
            centerX, centerY - 108,
            levelName,
            '14px', '#aaaaaa', 2
        );
        this._popIn(nameText, 40);

        // Faixa decorativa atrás do título (pill: radius = 50% da altura)
        const bannerW = 380;
        const bannerH = 44;
        const bannerR = bannerH / 2;
        const banner = scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(GC.DEPTH.OVERLAY)
            .setPosition(centerX, centerY - 78)
            .setScale(0.6)
            .setAlpha(0);
        banner.fillStyle(0x1a3a1a, 0.9);
        banner.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, bannerR);
        banner.lineStyle(2, 0x44cc66, 1);
        banner.strokeRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, bannerR);
        scene.overlayElements.push(banner);
        scene.tweens.add({
            targets: banner,
            scaleX: 1, scaleY: 1, alpha: 1,
            duration: 280,
            ease: 'Back.easeOut'
        });

        const title = this._addOverlayText(
            centerX, centerY - 78,
            opts.title || '✅ FASE COMPLETA!',
            opts.titleSize || '28px',
            opts.titleColor || '#66ff88',
            4
        );
        this._popIn(title, 100);

        const starsY = centerY - 12;
        this._addStarsRow(centerX, starsY);

        const timeText = this._addOverlayText(
            centerX, centerY + 36,
            `⏱ ${GameData.formatTime(opts.finalTime)}${opts.rankLabel || ''}`,
            '20px', opts.timeColor || '#ffffff', 3, 'monospace'
        );
        this._popIn(timeText, 220);

        if (typeof opts.extra === 'function') {
            opts.extra();
        }

        const continueText = this._addOverlayText(
            centerX, opts.continueY || centerY + 88,
            opts.continueText,
            '15px', '#ffffff', 2
        );
        this._popIn(continueText, 360);
        scene.tweens.add({
            targets: continueText,
            alpha: { from: 1, to: 0.45 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            delay: 500
        });
    }

    /**
     * Fila de sprites de estrela + contador "coletadas/total".
     * Cada estrela entra com pop escalonado.
     */
    _addStarsRow(centerX, y) {
        const scene = this.scene;
        const collected = scene.starsCollected || 0;
        const total = scene.totalStars || 0;

        if (total <= 0) {
            const seal = this._addOverlayText(centerX, y, '★ CONCLUÍDA ★', '16px', '#ffd700', 3);
            this._popIn(seal, 140);
            return;
        }

        const spacing = 36;
        const countGap = 28;
        const countApproxWidth = 48;
        const starsWidth = (total - 1) * spacing;
        const groupWidth = starsWidth + countGap + countApproxWidth;
        const groupStartX = centerX - groupWidth / 2;

        for (let i = 0; i < total; i++) {
            const star = scene.add.sprite(groupStartX + i * spacing, y, 'star', 0)
                .setScrollFactor(0)
                .setDepth(GC.DEPTH.OVERLAY_TEXT)
                .setScale(0)
                .setAlpha(0);

            if (i < collected) {
                star.setTint(0xffffff);
                if (scene.anims.exists('star-spin')) {
                    star.anims.play('star-spin', true);
                }
            } else {
                star.setTint(0x444444);
            }

            scene.overlayElements.push(star);
            scene.tweens.add({
                targets: star,
                scale: { from: 0, to: 1.15 },
                alpha: i < collected ? 1 : 0.35,
                duration: 320,
                delay: 120 + i * 90,
                ease: 'Back.easeOut',
                onComplete: () => {
                    if (i < collected) {
                        scene.tweens.add({
                            targets: star,
                            scale: 1,
                            duration: 120
                        });
                    }
                }
            });
        }

        const countLabel = this._addOverlayText(
            groupStartX + starsWidth + countGap,
            y,
            `${collected}/${total}`,
            '18px', '#ffd700', 3, 'monospace'
        );
        countLabel.setOrigin(0, 0.5);
        this._popIn(countLabel, 120 + total * 90);
    }

    /** Partículas de brilho fixas no overlay (espaço de tela). */
    _spawnOverlaySparkles(centerX, centerY) {
        const scene = this.scene;
        const colors = [0xffd447, 0xffffff, 0x66ff88, 0x9be7ff];

        for (let i = 0; i < 18; i++) {
            const x = centerX + Phaser.Math.Between(-280, 280);
            const y = centerY + Phaser.Math.Between(-140, 140);
            const size = Phaser.Math.Between(1, 3);
            const spark = scene.add.circle(x, y, size, Phaser.Math.RND.pick(colors), 0)
                .setScrollFactor(0)
                .setDepth(GC.DEPTH.OVERLAY);

            scene.overlayElements.push(spark);
            scene.tweens.add({
                targets: spark,
                alpha: { from: 0, to: Phaser.Math.FloatBetween(0.35, 0.9) },
                scale: { from: 0.5, to: 1.4 },
                duration: Phaser.Math.Between(600, 1400),
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 800)
            });
        }
    }

    /** Confete caindo pela tela do overlay. */
    _spawnOverlayConfetti() {
        const scene = this.scene;
        const cam = scene.cameras.main;
        const colors = GC.VICTORY.CONFETTI_COLORS;

        for (let i = 0; i < 28; i++) {
            const x = Phaser.Math.Between(20, cam.width - 20);
            const piece = scene.add.rectangle(
                x,
                Phaser.Math.Between(-40, -8),
                Phaser.Math.Between(3, 5),
                Phaser.Math.Between(5, 9),
                Phaser.Math.RND.pick(colors)
            ).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY).setAlpha(0.85);

            scene.overlayElements.push(piece);
            scene.tweens.add({
                targets: piece,
                y: cam.height + 20,
                x: x + Phaser.Math.Between(-40, 40),
                angle: Phaser.Math.Between(-360, 360),
                alpha: 0,
                duration: Phaser.Math.Between(2200, 4200),
                delay: Phaser.Math.Between(0, 900),
                ease: 'Sine.easeIn'
            });
        }
    }

    _popIn(target, delay = 0) {
        if (!target) return;
        target.setScale(0.5).setAlpha(0);
        this.scene.tweens.add({
            targets: target,
            scale: 1,
            alpha: 1,
            duration: 280,
            delay,
            ease: 'Back.easeOut'
        });
    }

    _showWorldCompleteTransition(centerX, centerY, finalTime, rankLabel, timeColor, world, continueLabel) {
        const scene = this.scene;

        this._buildPhaseCompletePanel(centerX, centerY - 10, {
            finalTime,
            rankLabel,
            timeColor,
            continueText: `${continueLabel} para ver a recompensa!`,
            continueY: centerY + 100,
            extra: () => {
                const worldText = scene.add.text(
                    centerX, centerY + 58,
                    `🌟 ${world.name.toUpperCase()} COMPLETO! 🌟`,
                    {
                        fontSize: '18px', fontFamily: 'Arial', color: '#ffd700',
                        stroke: '#000000', strokeThickness: 3
                    }
                ).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
                scene.overlayElements.push(worldText);
                this._popIn(worldText, 280);
                scene.tweens.add({
                    targets: worldText,
                    scale: { from: 1, to: 1.08 },
                    duration: 450,
                    yoyo: true,
                    repeat: -1,
                    delay: 400
                });
            }
        });

        const handleWorldComplete = () => {
            const worldCompleteData = {
                world: world,
                playerName: scene.playerName,
                totalTime: finalTime
            };

            if (world.id === 1) {
                scene.scene.start('CutsceneScene', {
                    cutsceneId: 'world1Complete',
                    next: {
                        scene: 'WorldCompleteScene',
                        data: worldCompleteData
                    }
                });
                return;
            }

            scene.scene.start('WorldCompleteScene', worldCompleteData);
        };

        this._bindContinueInput(handleWorldComplete);
    }

    // --- Ranking ---

    showRanking() {
        const scene = this.scene;
        scene.currentView = 'ranking';
        scene.pausedAtTime = scene.time.now;

        const centerX = scene.cameras.main.centerX;
        const centerY = scene.cameras.main.centerY;

        const overlay = scene.add.rectangle(centerX, centerY, 640, 352, 0x000000, 0.95)
            .setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY);
        scene.overlayElements.push(overlay);

        const title = scene.add.text(centerX, centerY - 160, '🏆 RANKING DE HI-SCORES 🏆', {
            fontSize: '24px', fontFamily: 'Arial', color: '#ffd700',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
        scene.overlayElements.push(title);

        let y = centerY - 120;
        for (let level = 0; level < GameData.LEVELS.length; level++) {
            y = this._renderRankingTable(level, y);
            y += 20;
        }

        const closeText = scene.add.text(centerX, centerY + 150, 'Pressione ESC para fechar', {
            fontSize: '16px', fontFamily: 'Arial', color: '#aaaaaa'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
        scene.overlayElements.push(closeText);
    }

    _renderRankingTable(level, startY) {
        const scene = this.scene;
        const records = GameData.getTopRecords(level, 4);
        const levelName = GameData.LEVELS[level]?.name || `Fase ${level + 1}`;
        const centerX = scene.cameras.main.centerX;
        let y = startY;

        const faseTitle = scene.add.text(centerX, y, levelName.toUpperCase(), {
            fontSize: '18px', fontFamily: 'Arial', color: '#00ff00', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
        scene.overlayElements.push(faseTitle);
        y += 25;

        [{ text: 'TEMPO', x: -150 }, { text: 'JOGADOR', x: 0 }, { text: 'DATA/HORA', x: 150 }].forEach(h => {
            const header = scene.add.text(centerX + h.x, y, h.text, {
                fontSize: '14px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
            scene.overlayElements.push(header);
        });
        y += 20;

        if (records.length > 0) {
            records.forEach(record => {
                const timeText = scene.add.text(centerX - 150, y, GameData.formatTime(record.time), {
                    fontSize: '12px', fontFamily: 'monospace', color: '#00ffff'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
                scene.overlayElements.push(timeText);

                const playerText = scene.add.text(centerX, y, record.playerName || 'Anônimo', {
                    fontSize: '12px', fontFamily: 'Arial', color: '#ffffff'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
                scene.overlayElements.push(playerText);

                const dateText = scene.add.text(centerX + 150, y, GameData.formatDate(record.date), {
                    fontSize: '11px', fontFamily: 'Arial', color: '#aaaaaa'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
                scene.overlayElements.push(dateText);

                y += 18;
            });
        } else {
            const noRecord = scene.add.text(centerX, y, 'Nenhum recorde ainda', {
                fontSize: '12px', fontFamily: 'Arial', color: '#666666'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
            scene.overlayElements.push(noRecord);
            y += 18;
        }

        return y;
    }

    closeRanking() {
        const scene = this.scene;

        if (scene.pausedAtTime) {
            const pauseDuration = scene.time.now - scene.pausedAtTime;
            scene.levelStartTime += pauseDuration;
            scene.pausedAtTime = null;
        }

        scene.currentView = 'gameplay';
        scene.overlayElements.forEach(el => { if (el && el.destroy) el.destroy(); });
        scene.overlayElements = [];
    }

    // --- Helpers ---

    _addOverlayText(x, y, content, fontSize, color, strokeThickness = 0, fontFamily = 'Arial') {
        const text = this.scene.add.text(x, y, content, {
            fontSize, fontFamily, color,
            stroke: '#000000', strokeThickness: strokeThickness
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);
        this.scene.overlayElements.push(text);
        return text;
    }

    _bindContinueInput(handler) {
        const scene = this.scene;
        scene.input.keyboard.once('keydown-SPACE', handler);
        scene.input.keyboard.once('keydown-ENTER', handler);

        scene.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => {
                if (scene.virtualControls.jumpJustPressed) {
                    scene.virtualControls.jumpJustPressed = false;
                    handler();
                }
            }
        });
    }
}
