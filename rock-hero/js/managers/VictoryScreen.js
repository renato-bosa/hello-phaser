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
            scene.time.delayedCall(500, () => SoundManager.play('newRecord'));
        }

        this._showVictoryOverlay(finalTime, result);
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

        const overlay = scene.add.rectangle(centerX, centerY, 640, 400, 0x000000, 0.8)
            .setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY);
        scene.overlayElements.push(overlay);

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
            this._addOverlayText(centerX, centerY - 60, '✅ FASE COMPLETA!', '32px', '#00ff00', 4);
            this._addOverlayText(centerX, centerY - 15, `⏱ Tempo: ${GameData.formatTime(finalTime)}${rankLabel}`, '20px', timeColor, 3, 'monospace');
            this._addOverlayText(centerX, centerY + 55, `${continueLabel} para continuar`, '16px', '#ffffff');

            const handleContinue = () => {
                GameData.saveMapPosition(GameData.state.currentWorld, nextLevel, 'victory:nextLevel');
                scene.scene.start('WorldMapScene', {});
            };

            this._bindContinueInput(handleContinue);
        } else {
            this._addOverlayText(centerX, centerY - 80, '🎉 VOCÊ ZEROU O JOGO! 🎉', '28px', '#ffff00', 4);
            this._addOverlayText(centerX, centerY - 35, `⏱ Fase: ${GameData.formatTime(finalTime)}${rankLabel}`, '18px', timeColor, 2, 'monospace');

            const totalBest = GameData.getTotalBestTime();
            if (totalBest !== null) {
                this._addOverlayText(centerX, centerY + 5, `🏅 Tempo Total: ${GameData.formatTime(totalBest)}`, '22px', '#00ffff', 3, 'monospace');
            }

            this._addOverlayText(centerX, centerY + 55, `${continueLabel} para voltar ao mapa`, '16px', '#ffffff');

            const handleBackToMap = () => {
                GameData.saveMapPosition(GameData.state.currentWorld, scene.currentLevel, 'victory:gameComplete');
                scene.scene.start('WorldMapScene', {});
            };

            this._bindContinueInput(handleBackToMap);
        }
    }

    _showWorldCompleteTransition(centerX, centerY, finalTime, rankLabel, timeColor, world, continueLabel) {
        const scene = this.scene;

        this._addOverlayText(centerX, centerY - 70, '✅ FASE COMPLETA!', '28px', '#00ff00', 4);
        this._addOverlayText(centerX, centerY - 30, `⏱ Tempo: ${GameData.formatTime(finalTime)}${rankLabel}`, '18px', timeColor, 3, 'monospace');

        const worldText = scene.add.text(centerX, centerY + 20, `🌟 ${world.name.toUpperCase()} COMPLETO! 🌟`, {
            fontSize: '20px', fontFamily: 'Arial', color: '#ffd700',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GC.DEPTH.OVERLAY_TEXT);

        scene.tweens.add({
            targets: worldText,
            scale: { from: 1, to: 1.1 },
            duration: 400,
            yoyo: true,
            repeat: -1
        });

        this._addOverlayText(centerX, centerY + 65, `${continueLabel} para ver a recompensa!`, '14px', '#ffffff');

        const handleWorldComplete = () => {
            scene.scene.start('WorldCompleteScene', {
                world: world,
                playerName: scene.playerName,
                totalTime: finalTime
            });
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
