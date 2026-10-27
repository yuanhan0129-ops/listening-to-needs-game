import * as Phaser from 'phaser';
import { firstEpisode } from '../data/scenarios.js';

const COLORS = {
  background: 0xf4f1ea,
  paper: 0xfffefa,
  ink: 0x34433d,
  muted: 0x728078,
  line: 0xd9dfd7,
  sage: 0x6d887b,
  sageLight: 0xe5ece6,
  blue: 0x748b98,
  blueLight: 0xe8eef0,
  clay: 0xb8795f,
  clayLight: 0xf3e5dd,
  white: 0xffffff,
};

const FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.stage = 'dialogue';
    this.dialogueIndex = 0;
    this.selectedEmotionId = null;
    this.selectedNeedId = null;
    this.selectedResponseId = null;
    this.visitedPaths = new Set();
    this.uiObjects = [];
    this.choiceActions = [];
    this.primaryAction = null;
  }

  preload() {
    this.load.image('yu-an', `${import.meta.env.BASE_URL}assets/images/characters/yu-an.svg?v=2`);
  }

  create() {
    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.handleResize, this);
      this.input.keyboard?.off('keydown', this.handleKeyboard, this);
    });
    this.input.keyboard?.on('keydown', this.handleKeyboard, this);
    this.renderScreen();
  }

  handleResize(gameSize) {
    this.cameras.resize(gameSize.width, gameSize.height);
    this.renderScreen();
  }

  handleKeyboard(event) {
    if (event.repeat) return;

    if (event.key === 'Enter' && this.primaryAction) {
      event.preventDefault();
      this.primaryAction();
      return;
    }

    if (event.key === 'Escape' && this.stage === 'reflection') {
      event.preventDefault();
      this.finishStory();
      return;
    }

    const choiceIndex = Number(event.key) - 1;
    if (Number.isInteger(choiceIndex) && choiceIndex >= 0) {
      this.choiceActions[choiceIndex]?.();
    }
  }

  renderScreen() {
    this.clearScreen();
    this.choiceActions = [];
    this.primaryAction = null;

    const width = Math.max(320, this.scale.width || 960);
    const height = Math.max(400, this.scale.height || 640);
    const safePadding = width < 440 ? 18 : width < 760 ? 28 : 48;
    const contentWidth = Math.min(width - safePadding * 2, 880);
    this.layout = {
      width,
      height,
      compact: width < 620 || height < 620,
      padding: (width - contentWidth) / 2,
    };

    this.drawBackground();
    this.drawHeader();

    switch (this.stage) {
      case 'dialogue':
        this.renderDialogue();
        break;
      case 'inference':
        this.renderInference();
        break;
      case 'response':
        this.renderResponses();
        break;
      case 'ending':
        this.renderEnding();
        break;
      case 'reflection':
        this.renderReflection();
        break;
      case 'complete':
        this.renderComplete();
        break;
      default:
        this.stage = 'dialogue';
        this.renderDialogue();
    }
  }

  clearScreen() {
    this.uiObjects.forEach((object) => object.destroy());
    this.uiObjects = [];
  }

  keep(object) {
    this.uiObjects.push(object);
    return object;
  }

  drawBackground() {
    const { width, height } = this.layout;
    const background = this.keep(this.add.rectangle(0, 0, width, height, COLORS.background));
    background.setOrigin(0);

    const decoration = this.keep(this.add.graphics());
    decoration.fillStyle(COLORS.sage, 0.08);
    decoration.fillCircle(width - 28, 42, Math.min(110, width * 0.18));
    decoration.fillStyle(COLORS.clay, 0.07);
    decoration.fillCircle(16, height - 18, Math.min(92, width * 0.15));
  }

  drawHeader() {
    const { width, padding, compact } = this.layout;
    const titleSize = compact ? 25 : 31;
    const tagWidth = width < 370 ? 82 : 112;

    this.addText('聽見需要', padding, 14, compact ? 16 : 18, COLORS.sage, {
      fontStyle: 'bold',
    });
    this.drawPill(
      width - padding - tagWidth,
      12,
      tagWidth,
      28,
      width < 370 ? `${firstEpisode.number} · ${firstEpisode.category}` : `故事 ${firstEpisode.number} · ${firstEpisode.category}`,
      COLORS.sageLight,
      COLORS.sage,
      compact ? 12 : 13,
    );
    this.addText(firstEpisode.title, padding, 48, titleSize, COLORS.ink, {
      fontStyle: 'bold',
      wrapWidth: width - padding * 2,
    });
    this.addText(firstEpisode.description, padding, compact ? 86 : 94, compact ? 14 : 16, COLORS.muted, {
      wrapWidth: width - padding * 2,
    });
  }

  renderDialogue() {
    const { width, height, padding, compact } = this.layout;
    const contentWidth = width - padding * 2;
    const panelHeight = compact
      ? Math.min(310, Math.max(190, height - 260))
      : Math.min(340, Math.max(224, height - 260));
    const contentHeight = panelHeight + 66;
    const panelY = Math.max(132, Math.round(108 + (height - contentHeight - 108) * 0.32));
    const panelX = padding;
    const avatarSize = compact ? 58 : 74;
    const line = firstEpisode.dialogue[this.dialogueIndex];

    this.addText('對話線索', panelX, panelY - 22, compact ? 13 : 14, COLORS.muted, {
      fontStyle: 'bold',
    });
    this.drawPanel(panelX, panelY, contentWidth, panelHeight, COLORS.paper, COLORS.line, 22);
    this.keep(
      this.add
        .image(panelX + 22, panelY + 20, firstEpisode.character.portrait)
        .setDisplaySize(avatarSize, avatarSize)
        .setOrigin(0),
    );
    this.addText(firstEpisode.character.name, panelX + avatarSize + 38, panelY + 28, compact ? 17 : 19, COLORS.ink, {
      fontStyle: 'bold',
    });
    this.addText(firstEpisode.character.role, panelX + avatarSize + 38, panelY + 55, compact ? 13 : 14, COLORS.muted);

    const dialogueY = panelY + avatarSize + 44;
    this.addText(`「${line}」`, panelX + 24, dialogueY, compact ? 18 : 22, COLORS.ink, {
      wrapWidth: contentWidth - 48,
      lineSpacing: 7,
    });
    this.addText(`${this.dialogueIndex + 1} / ${firstEpisode.dialogue.length}`, panelX + 24, panelY + panelHeight - 28, 13, COLORS.muted);

    const isLastLine = this.dialogueIndex === firstEpisode.dialogue.length - 1;
    this.drawMainButton(
      isLastLine ? '推敲感受與需要' : '繼續對話',
      padding,
      panelY + panelHeight + 18,
      contentWidth,
      48,
      () => {
        if (isLastLine) {
          this.stage = 'inference';
        } else {
          this.dialogueIndex += 1;
        }
        this.renderScreen();
      },
    );
  }

  renderInference() {
    const { width, height, padding, compact } = this.layout;
    const contentWidth = width - padding * 2;
    const cardGap = 10;
    const cardWidth = (contentWidth - cardGap) / 2;
    const cardHeight = height < 620 ? 42 : width < 520 ? 48 : 52;
    const firstHeaderY = 185;
    const firstGridY = firstHeaderY + 29;
    const secondHeaderY = firstGridY + cardHeight * 2 + 19;
    const secondGridY = secondHeaderY + 29;
    const noteY = secondGridY + cardHeight * 2 + 18;

    this.addText('你聽見了什麼？', padding, 126, compact ? 20 : 22, COLORS.ink, {
      fontStyle: 'bold',
    });
    this.addText('選擇一種可能的情緒和需求。沒有唯一標準答案。', padding, 154, compact ? 13 : 15, COLORS.muted, {
      wrapWidth: contentWidth,
    });
    this.addText('可能的情緒', padding, firstHeaderY, compact ? 15 : 16, COLORS.ink, { fontStyle: 'bold' });

    firstEpisode.emotions.forEach((emotion, index) => {
      const x = padding + (index % 2) * (cardWidth + cardGap);
      const y = firstGridY + Math.floor(index / 2) * (cardHeight + 8);
      this.drawOptionCard(
        `${index + 1}. ${emotion.label}`,
        x,
        y,
        cardWidth,
        cardHeight,
        this.selectedEmotionId === emotion.id,
        () => {
          this.selectedEmotionId = emotion.id;
          this.renderScreen();
        },
      );
    });

    this.addText('可能的需求', padding, secondHeaderY, compact ? 15 : 16, COLORS.ink, { fontStyle: 'bold' });
    firstEpisode.needs.forEach((need, index) => {
      const x = padding + (index % 2) * (cardWidth + cardGap);
      const y = secondGridY + Math.floor(index / 2) * (cardHeight + 8);
      this.drawOptionCard(
        `${index + 5}. ${need.label}`,
        x,
        y,
        cardWidth,
        cardHeight,
        this.selectedNeedId === need.id,
        () => {
          this.selectedNeedId = need.id;
          this.renderScreen();
        },
      );
    });

    this.addText('你可以先選一個暫時的理解，之後也能再調整。', padding, noteY, compact ? 12 : 14, COLORS.muted, {
      wrapWidth: contentWidth,
    });

    const canContinue = Boolean(this.selectedEmotionId && this.selectedNeedId);
    this.drawMainButton(
      '選擇回應',
      padding,
      Math.min(height - 62, noteY + 38),
      contentWidth,
      46,
      () => {
        if (!canContinue) return;
        this.stage = 'response';
        this.renderScreen();
      },
      { disabled: !canContinue },
    );
  }

  renderResponses() {
    const { width, height, padding, compact } = this.layout;
    const contentWidth = width - padding * 2;
    const titleY = 128;
    const cardTop = 180;
    const cardHeight = height < 620 ? 90 : width < 520 ? 98 : 94;
    const gap = 10;

    this.addText('你想怎麼接住這段對話？', padding, titleY, compact ? 19 : 22, COLORS.ink, {
      fontStyle: 'bold',
      wrapWidth: contentWidth,
    });
    this.addText('每一種回應都可能帶出不同發展。', padding, titleY + 30, compact ? 13 : 15, COLORS.muted);

    firstEpisode.responses.forEach((response, index) => {
      const y = cardTop + index * (cardHeight + gap);
      this.drawResponseCard(response, index, padding, y, contentWidth, cardHeight, () => {
        this.selectedResponseId = response.id;
        this.visitedPaths.add(response.id);
        this.stage = 'ending';
        this.renderScreen();
      });
    });

    this.addText('鍵盤可按 1–3 選擇；觸控或滑鼠也可以。', padding, cardTop + firstEpisode.responses.length * (cardHeight + gap) + 18, 12, COLORS.muted);
  }

  renderEnding() {
    const { width, height, padding, compact } = this.layout;
    const contentWidth = width - padding * 2;
    const response = this.getSelectedResponse();
    const panelY = 158;
    const panelHeight = Math.min(226, Math.max(174, height * 0.37));

    this.addText('對話接下來這樣發展', padding, 126, compact ? 18 : 20, COLORS.ink, {
      fontStyle: 'bold',
    });
    this.drawPanel(padding, panelY, contentWidth, panelHeight, COLORS.paper, COLORS.line, 22);
    this.keep(
      this.add
        .image(padding + 18, panelY + 18, firstEpisode.character.portrait)
        .setDisplaySize(compact ? 48 : 56, compact ? 48 : 56)
        .setOrigin(0),
    );
    this.addText(firstEpisode.character.name, padding + (compact ? 76 : 86), panelY + 26, compact ? 15 : 17, COLORS.ink, {
      fontStyle: 'bold',
    });
    this.addText(`「${response.ending}」`, padding + 22, panelY + (compact ? 82 : 92), compact ? 16 : 18, COLORS.ink, {
      wrapWidth: contentWidth - 44,
      lineSpacing: 5,
    });

    const summaryY = panelY + panelHeight + 12;
    const summaryHeight = height < 620 ? 64 : 78;
    this.drawPanel(padding, summaryY, contentWidth, summaryHeight, COLORS.sageLight, COLORS.sageLight, 18);
    this.addText('這條對話路徑', padding + 16, summaryY + 10, compact ? 12 : 13, COLORS.sage, {
      fontStyle: 'bold',
    });
    this.addText(response.outcome, padding + 16, summaryY + 29, compact ? 13 : 15, COLORS.ink, {
      wrapWidth: contentWidth - 32,
      lineSpacing: 3,
    });

    const actionY = Math.min(height - 98, summaryY + summaryHeight + 18);
    this.drawMainButton('想想自己此刻的感受與需要', padding, actionY, contentWidth, 44, () => {
      this.stage = 'reflection';
      this.renderScreen();
    });
    this.drawTextButton('略過反思，完成故事', width / 2, actionY + 66, () => this.finishStory());
  }

  renderReflection() {
    const { width, height, padding, compact } = this.layout;
    const contentWidth = width - padding * 2;
    const panelY = 174;
    const panelHeight = Math.min(250, Math.max(190, height * 0.4));

    this.addText('留一點空間給自己', padding, 128, compact ? 19 : 22, COLORS.ink, {
      fontStyle: 'bold',
    });
    this.drawPanel(padding, panelY, contentWidth, panelHeight, COLORS.paper, COLORS.line, 22);
    this.addText('不用輸入，也不會儲存。你可以只在心裡想一想：', padding + 24, panelY + 30, compact ? 15 : 17, COLORS.muted, {
      wrapWidth: contentWidth - 48,
    });
    this.addText('此刻的我，正在感受什麼？\n我可能需要什麼？', padding + 24, panelY + 92, compact ? 21 : 26, COLORS.ink, {
      fontStyle: 'bold',
      wrapWidth: contentWidth - 48,
      lineSpacing: 10,
    });
    this.addText('任何答案都可以，也可以什麼都不做。', padding + 24, panelY + panelHeight - 42, compact ? 13 : 15, COLORS.muted, {
      wrapWidth: contentWidth - 48,
    });

    const actionY = Math.min(height - 98, panelY + panelHeight + 18);
    this.drawMainButton('完成這段故事', padding, actionY, contentWidth, 44, () => this.finishStory());
    this.drawTextButton('略過', width / 2, actionY + 66, () => this.finishStory());
  }

  renderComplete() {
    const { width, height, padding, compact } = this.layout;
    const contentWidth = width - padding * 2;
    const panelY = 158;

    this.addText('這段對話已完成', padding, 126, compact ? 19 : 22, COLORS.ink, {
      fontStyle: 'bold',
    });
    this.drawPanel(padding, panelY, contentWidth, 192, COLORS.paper, COLORS.line, 22);

    const emotion = firstEpisode.emotions.find((item) => item.id === this.selectedEmotionId);
    const need = firstEpisode.needs.find((item) => item.id === this.selectedNeedId);
    this.addText('你當時的推敲', padding + 22, panelY + 22, compact ? 13 : 14, COLORS.sage, {
      fontStyle: 'bold',
    });
    const pillGap = 8;
    const pillWidth = (contentWidth - 44 - pillGap) / 2;
    this.drawPill(padding + 22, panelY + 54, pillWidth, 34, emotion?.label ?? '一種情緒', COLORS.sageLight, COLORS.ink, compact ? 12 : 14);
    this.drawPill(padding + 22 + pillWidth + pillGap, panelY + 54, pillWidth, 34, need?.label ?? '一種需求', COLORS.blueLight, COLORS.ink, compact ? 12 : 14);
    this.addText('情緒和需求可能有不只一種讀法。你可以重看線索，探索其他對話走向。', padding + 22, panelY + 108, compact ? 14 : 16, COLORS.ink, {
      wrapWidth: contentWidth - 44,
      lineSpacing: 5,
    });
    this.addText(`已探索 ${this.visitedPaths.size} / ${firstEpisode.responses.length} 種對話發展`, padding + 22, panelY + 164, compact ? 12 : 13, COLORS.muted);

    const actionY = Math.min(height - 106, panelY + 192 + 22);
    this.drawMainButton('看看另一種回應', padding, actionY, contentWidth, 46, () => {
      this.stage = 'response';
      this.selectedResponseId = null;
      this.renderScreen();
    });
    this.drawTextButton('重新讀一次故事', width / 2, actionY + 68, () => this.restartStory());
  }

  drawPanel(x, y, width, height, fill, stroke, radius = 20) {
    const graphics = this.keep(this.add.graphics());
    graphics.fillStyle(fill, 1);
    graphics.fillRoundedRect(x, y, width, height, radius);
    if (stroke !== fill) {
      graphics.lineStyle(1, stroke, 1);
      graphics.strokeRoundedRect(x, y, width, height, radius);
    }
    return graphics;
  }

  drawPill(x, y, width, height, label, fill, textColor, fontSize = 13) {
    const graphics = this.keep(this.add.graphics());
    graphics.fillStyle(fill, 1);
    graphics.fillRoundedRect(x, y, width, height, height / 2);
    this.addText(label, x + width / 2, y + height / 2, fontSize, textColor, {
      originX: 0.5,
      originY: 0.5,
      wrapWidth: width - 14,
      align: 'center',
    });
  }

  drawOptionCard(label, x, y, width, height, selected, onSelect) {
    const fill = selected ? COLORS.sageLight : COLORS.paper;
    const stroke = selected ? COLORS.sage : COLORS.line;
    const graphics = this.keep(this.add.graphics());
    const paint = (nextFill, nextStroke) => {
      graphics.clear();
      graphics.fillStyle(nextFill, 1);
      graphics.fillRoundedRect(x, y, width, height, 15);
      graphics.lineStyle(selected ? 2 : 1, nextStroke, 1);
      graphics.strokeRoundedRect(x, y, width, height, 15);
    };
    paint(fill, stroke);
    this.addText(selected ? `✓ ${label}` : label, x + 12, y + height / 2, this.layout.compact ? 14 : 16, COLORS.ink, {
      originY: 0.5,
      wrapWidth: width - 24,
      align: 'center',
    });

    const zone = this.keep(this.add.zone(x + width / 2, y + height / 2, width, height));
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      if (!selected) paint(COLORS.sageLight, COLORS.sage);
    });
    zone.on('pointerout', () => paint(fill, stroke));
    zone.on('pointerdown', onSelect);
    this.choiceActions.push(onSelect);
  }

  drawResponseCard(response, index, x, y, width, height, onSelect) {
    const graphics = this.keep(this.add.graphics());
    const paint = (fill, stroke) => {
      graphics.clear();
      graphics.fillStyle(fill, 1);
      graphics.fillRoundedRect(x, y, width, height, 18);
      graphics.lineStyle(1, stroke, 1);
      graphics.strokeRoundedRect(x, y, width, height, 18);
    };
    paint(COLORS.paper, COLORS.line);
    this.addText(`${index + 1}. ${response.title}`, x + 18, y + 10, this.layout.compact ? 13 : 14, COLORS.sage, {
      fontStyle: 'bold',
      wrapWidth: width - 36,
    });
    this.addText(`「${response.text}」`, x + 18, y + 34, this.layout.compact ? 14 : 16, COLORS.ink, {
      wrapWidth: width - 36,
      lineSpacing: 3,
    });

    const zone = this.keep(this.add.zone(x + width / 2, y + height / 2, width, height));
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => paint(COLORS.sageLight, COLORS.sage));
    zone.on('pointerout', () => paint(COLORS.paper, COLORS.line));
    zone.on('pointerdown', onSelect);
    this.choiceActions.push(onSelect);
  }

  drawMainButton(label, x, y, width, height, onClick, { disabled = false } = {}) {
    const buttonWidth = Math.min(width, 390);
    const buttonX = x + (width - buttonWidth) / 2;
    const fill = disabled ? 0xd7ddd8 : COLORS.sage;
    const graphics = this.keep(this.add.graphics());
    const paint = (color) => {
      graphics.clear();
      graphics.fillStyle(color, 1);
      graphics.fillRoundedRect(buttonX, y, buttonWidth, height, 16);
    };
    paint(fill);
    this.addText(label, buttonX + buttonWidth / 2, y + height / 2, this.layout.compact ? 15 : 17, disabled ? COLORS.ink : COLORS.white, {
      originX: 0.5,
      originY: 0.5,
      wrapWidth: buttonWidth - 24,
      align: 'center',
      fontStyle: 'bold',
    });

    const zone = this.keep(this.add.zone(buttonX + buttonWidth / 2, y + height / 2, buttonWidth, height));
    if (!disabled) {
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => paint(0x587565));
      zone.on('pointerout', () => paint(COLORS.sage));
      zone.on('pointerdown', onClick);
      this.primaryAction = onClick;
    }
  }

  drawTextButton(label, centerX, centerY, onClick) {
    const text = this.addText(label, centerX, centerY, this.layout.compact ? 13 : 14, COLORS.muted, {
      originX: 0.5,
      originY: 0.5,
    });
    const zone = this.keep(this.add.zone(centerX, centerY, Math.max(150, text.width + 32), 34));
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => text.setColor('#34433d'));
    zone.on('pointerout', () => text.setColor('#728078'));
    zone.on('pointerdown', onClick);
  }

  addText(text, x, y, fontSize, color, options = {}) {
    const style = {
      fontFamily: FONT_STACK,
      fontSize: `${fontSize}px`,
      resolution: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
      color: typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color,
      lineSpacing: options.lineSpacing ?? 4,
      align: options.align ?? 'left',
    };
    if (options.fontStyle) style.fontStyle = options.fontStyle;
    if (options.wrapWidth) {
      style.wordWrap = { width: options.wrapWidth, useAdvancedWrap: true };
    }
    const object = this.keep(this.add.text(x, y, text, style));
    object.setOrigin(options.originX ?? 0, options.originY ?? 0);
    return object;
  }

  getSelectedResponse() {
    return firstEpisode.responses.find((response) => response.id === this.selectedResponseId) ?? firstEpisode.responses[0];
  }

  finishStory() {
    this.stage = 'complete';
    this.renderScreen();
  }

  restartStory() {
    this.stage = 'dialogue';
    this.dialogueIndex = 0;
    this.selectedEmotionId = null;
    this.selectedNeedId = null;
    this.selectedResponseId = null;
    this.renderScreen();
  }
}
