/**
 * Apresentação HTML dos textos de vitória. Os Text objects e seus tweens
 * continuam pertencendo à cena; o DOM apenas projeta o resultado visual.
 * Não altera câmera, canvas, input, progresso ou relógio do jogo.
 */
class VictoryTextLayer {
    constructor(scene) {
        this.scene = scene;
        this.items = new Map();
        this.root = document.createElement('div');
        this.root.className = 'victory-text-layer';
        this.root.setAttribute('role', 'status');
        Object.assign(this.root.style, {
            position: 'fixed', overflow: 'hidden', pointerEvents: 'none',
            userSelect: 'none', zIndex: '20'
        });
        document.body.appendChild(this.root);
        // A matriz da câmera já inclui zoom e shake depois do render.
        scene.game.events.on('postrender', this.sync, this);
        this.sync();
    }

    add(text) {
        const element = document.createElement('span');
        Object.assign(element.style, {
            position: 'absolute', whiteSpace: 'pre', lineHeight: '1.2',
            pointerEvents: 'none', paintOrder: 'stroke fill', opacity: '0'
        });
        this.root.appendChild(element);
        const onDestroy = () => {
            element.remove();
            this.items.delete(text);
        };
        this.items.set(text, { element, onDestroy, visible: text.visible });
        text.once('destroy', onDestroy);
        // O objeto segue ativo para os tweens, mas não duplica o texto no canvas.
        text.setVisible(false);
        return text;
    }

    sync() {
        const scene = this.scene;
        if (!this.root || !scene) return;
        const canvas = scene.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const camera = scene.cameras.main;
        const gameSize = scene.scale.gameSize;
        if (!rect.width || !rect.height || !scene.sys.isVisible()) {
            this.root.style.display = 'none';
            return;
        }
        Object.assign(this.root.style, {
            display: 'block', left: `${rect.left}px`, top: `${rect.top}px`,
            width: `${rect.width}px`, height: `${rect.height}px`
        });
        const displayX = rect.width / gameSize.width;
        const displayY = rect.height / gameSize.height;
        const matrix = camera.matrix;

        this.items.forEach(({ element }, text) => {
            const x = text.x - camera.scrollX * text.scrollFactorX;
            const y = text.y - camera.scrollY * text.scrollFactorY;
            const px = (matrix.a * x + matrix.c * y + matrix.e) * displayX;
            const py = (matrix.b * x + matrix.d * y + matrix.f) * displayY;
            const sx = camera.zoomX * text.scaleX * displayX;
            const sy = camera.zoomY * text.scaleY * displayY;
            if (sx <= 0 || sy <= 0 || !text.active) {
                element.style.visibility = 'hidden';
                return;
            }
            const style = text.style;
            if (element.textContent !== text.text) element.textContent = text.text;
            Object.assign(element.style, {
                visibility: 'visible', left: `${px}px`, top: `${py}px`,
                // Fonte no tamanho final em CSS, sem ampliar um bitmap de baixa resolução.
                fontSize: `${parseFloat(style.fontSize) * sy}px`,
                fontFamily: style.fontFamily, color: style.color,
                fontWeight: style.fontStyle.includes('bold') ? 'bold' : 'normal',
                fontStyle: style.fontStyle.includes('italic') ? 'italic' : 'normal',
                opacity: String(text.alpha * camera.alpha),
                webkitTextStroke: `${Math.min(style.strokeThickness / 2, 1.5) * sy}px ${style.stroke}`,
                transformOrigin: `${text.originX * 100}% ${text.originY * 100}%`,
                transform: `translate(${-text.originX * 100}%, ${-text.originY * 100}%) rotate(${camera.rotation + text.rotation}rad) scaleX(${sx / sy})`
            });
        });
    }

    destroy() {
        if (!this.scene) return;
        this.scene.game.events.off('postrender', this.sync, this);
        this.items.forEach(({ element, onDestroy, visible }, text) => {
            text.off('destroy', onDestroy);
            if (text.scene) text.setVisible(visible);
            element.remove();
        });
        this.items.clear();
        this.root.remove();
        this.root = null;
        this.scene = null;
    }
}
