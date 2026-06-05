/**
 * Canvas 2D 水电图画布渲染工具
 */
class ShapeRenderer {
  constructor(ctx, canvas) {
    this.ctx    = ctx;
    this.canvas = canvas;
  }

  clear(color = '#f5f5f5') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawFloorplan(floorplanData, scale = 1, offsetX = 0, offsetY = 0) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#888888';
    ctx.lineWidth   = 2;
    ctx.setLineDash([]);

    (floorplanData.walls || []).forEach(wall => {
      ctx.beginPath();
      ctx.moveTo(wall.start.x * scale + offsetX, wall.start.y * scale + offsetY);
      ctx.lineTo(wall.end.x   * scale + offsetX, wall.end.y   * scale + offsetY);
      ctx.stroke();
    });

    (floorplanData.doors || []).forEach(door => {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(
        door.position.x * scale + offsetX,
        door.position.y * scale + offsetY - 6,
        door.width  * scale,
        12,
      );
    });

    (floorplanData.windows || []).forEach(wn => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        wn.position.x * scale + offsetX,
        wn.position.y * scale + offsetY - 5,
        wn.width  * scale,
        10,
      );
      ctx.strokeStyle = '#4361ee';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        wn.position.x * scale + offsetX,
        wn.position.y * scale + offsetY - 5,
        wn.width  * scale,
        10,
      );
    });

    ctx.restore();
  }

  drawLayout(layoutData, scale = 1, offsetX = 0, offsetY = 0) {
    const ctx = this.ctx;
    (layoutData.waterLines || []).forEach(line => {
      if (line.points.length < 2) return;
      ctx.strokeStyle = '#00b4d8';
      ctx.lineWidth   = 4;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      line.points.forEach((p, i) => {
        const x = p.x * scale + offsetX;
        const y = p.y * scale + offsetY;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    });

    (layoutData.electricalRoutes || []).forEach(line => {
      if (line.points.length < 2) return;
      ctx.strokeStyle = '#ef476f';
      ctx.lineWidth   = 3;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      line.points.forEach((p, i) => {
        const x = p.x * scale + offsetX;
        const y = p.y * scale + offsetY;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  drawPoint(x, y, type, scale = 1, offsetX = 0, offsetY = 0) {
    const ctx = this.ctx;
    const px  = x * scale + offsetX;
    const py  = y * scale + offsetY;
    const r   = 10;

    const colors = {
      '普通插座': '#ef476f',
      '大功率插座': '#ef476f',
      'USB插座': '#f72585',
      'RJ45网口': '#4361ee',
      'WiFi AP': '#7209b7',
      '单开开关': '#06d6a0',
      '双开开关': '#06d6a0',
      '智能开关': '#ffd166',
    };

    ctx.fillStyle = colors[type] || '#999999';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.fillStyle   = '#ffffff';
    ctx.font        = '10px sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(type.slice(0, 4), px, py - r - 4);
  }

  drawLayoutData(layoutData, scale = 1, offsetX = 0, offsetY = 0) {
    const ctx = this.ctx;
    this.drawLayout(layoutData, scale, offsetX, offsetY);

    (layoutData.powerOutlets || []).forEach(p =>
      this.drawPoint(p.x, p.y, p.type, scale, offsetX, offsetY));

    (layoutData.networkPorts || []).forEach(p =>
      this.drawPoint(p.x, p.y, p.type, scale, offsetX, offsetY));

    (layoutData.switches || []).forEach(s =>
      this.drawPoint(s.x, s.y, s.type, scale, offsetX, offsetY));
  }

  exportToImage() {
    return wx.canvasToTempFilePath({
      canvasId: this.canvas.id,
      success: res => res.tempFilePath,
      fail: () => null,
    });
  }
}

module.exports = ShapeRenderer;
