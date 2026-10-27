import * as Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene.js';

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#10131c',
  scene: [GameScene],
};

export default gameConfig;
