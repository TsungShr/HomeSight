const app = getApp();
const request = require('../../utils/request');

Page({
  data: {
    req: {
      outletLevel: '标准',
      networkLevel: '全屋WiFi',
      hasSmartHome: true,
    },
    generating: false,
    generatingImage: false,
    visible: { power: true, network: true, switches: true, water: true, electric: true },
    layoutData: null,
    displayPoints: [],
    tips: [],
    // Agent + 豆包图生图结果
    agentTextAdvice: '',
    agentImageUrl: '',
    canvasW: 375,
    canvasH: 400,
    scale: 350,
    offsetX: 20,
    offsetY: 20,
  },

  onLoad() {
    const info = wx.getSystemInfoSync();
    this.setData({ canvasW: info.windowWidth - 48, canvasH: info.windowHeight * 0.5 });
    this.drawCanvas();
  },

  onShow() {
    this.drawCanvas();
  },

  setReq(e) {
    const { key } = e.currentTarget.dataset;
    const val = e.currentTarget.dataset.val;
    this.setData({ [`req.${key}`]: val });
  },

  toggleSmart(e) {
    this.setData({ 'req.hasSmartHome': e.detail.value });
  },

  toggleLayer(e) {
    const layer = e.currentTarget.dataset.layer;
    this.setData({ [`visible.${layer}`]: !this.data.visible[layer] }, () => this.drawCanvas());
  },

  async generateLayout() {
    if (this.data.generating) return;
    this.setData({ generating: true });
    try {
      const roomData = app.globalData.roomData;
      if (!roomData) {
        await this.generateMockLayout();
        return;
      }
      const data = await request.post('/layout/' + (app.globalData.currentFloorPlan?.id || 0), {
        roomDataJson: JSON.stringify(roomData),
        ...this.data.req,
      });
      this.setLayoutData(data);
    } catch {
      await this.generateMockLayout();
    } finally {
      this.setData({ generating: false });
    }
  },

  async generateMockLayout() {
    await new Promise(r => setTimeout(r, 2000));
    const mock = {
      powerOutlets: [
        {x:0.2,y:0.3,type:'普通插座',roomId:'客厅'},
        {x:0.4,y:0.3,type:'USB插座',roomId:'客厅'},
        {x:0.55,y:0.5,type:'大功率插座',roomId:'客厅'},
        {x:0.75,y:0.3,type:'普通插座',roomId:'主卧'},
        {x:0.85,y:0.5,type:'USB插座',roomId:'主卧'},
        {x:0.2,y:0.8,type:'普通插座',roomId:'次卧'},
        {x:0.5,y:0.85,type:'USB插座',roomId:'厨房'},
        {x:0.8,y:0.85,type:'大功率插座',roomId:'厨房'},
        {x:0.5,y:0.9,type:'普通插座',roomId:'卫生间'},
      ],
      networkPorts: [
        {x:0.3,y:0.25,type:'RJ45网口',roomId:'客厅'},
        {x:0.8,y:0.25,type:'WiFi AP',roomId:'主卧'},
        {x:0.3,y:0.85,type:'RJ45网口',roomId:'书房'},
      ],
      switches: [
        {x:0.1,y:0.5,type:'智能开关',roomId:'客厅'},
        {x:0.6,y:0.5,type:'双开开关',roomId:'客厅'},
        {x:0.7,y:0.2,type:'单开开关',roomId:'主卧'},
        {x:0.1,y:0.85,type:'智能开关',roomId:'厨房'},
      ],
      waterLines: [
        {points:[{x:0.5,y:0.7},{x:0.5,y:0.9}],roomId:'客厅'},
        {points:[{x:0.7,y:0.7},{x:0.8,y:0.9}],roomId:'厨房'},
      ],
      electricalRoutes: [
        {points:[{x:0.1,y:0.2},{x:0.3,y:0.3}],roomId:'客厅'},
        {points:[{x:0.6,y:0.2},{x:0.8,y:0.3}],roomId:'主卧'},
      ],
      tips: [
        '客厅沙发区建议预留至少3个插座，含1个USB',
        '电视墙强电与弱电（网线）保持30cm以上间距，防止干扰',
        '厨房水槽下方建议预留2个插座（净水器+厨余处理器）',
        '卫生间干区墙插安装高度不低于1.5m，防止溅水',
        '全屋WiFi建议每个房间预留一个86型网口，便于Mesh组网',
        '智能家居建议从入户弱电箱单独布一根6类网线到电视柜',
      ],
    };
    this.setLayoutData(mock);
  },

  setLayoutData(data) {
    this.setData({ layoutData: data, tips: data.tips || [] });
    this.rebuildPoints();
    this.drawCanvas();
    wx.showToast({ title: '生成成功', icon: 'success' });
  },

  // ─── Agent + 豆包图生图 ───────────────────────────────────────────────

  async generateLayoutWithAgent() {
    if (this.data.generatingImage) return;
    const floorPlanId = app.globalData.currentFloorPlan?.id;
    if (!floorPlanId) {
      wx.showToast({ title: '请先上传户型图', icon: 'none' }); return;
    }
    this.setData({ generatingImage: true });
    try {
      const data = await request.post('/layout-agent/' + floorPlanId, {
        roomDataJson: JSON.stringify(app.globalData.roomData),
        ...this.data.req,
      });
      this.setData({
        agentTextAdvice: data.textAdvice || '',
        agentImageUrl: data.imageUrl || '',
        // 如果 Agent 没返回图片，用结构化数据画布兜底
        layoutData: data.imageUrl ? null : (data.powerOutlets ? data : null),
        tips: data.textAdvice ? [] : (data.tips || []),
      });
      if (data.imageUrl) {
        this.drawCanvas();
      }
      wx.showToast({ title: '布局图生成成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '生成失败，可尝试基础模式', icon: 'none' });
    } finally {
      this.setData({ generatingImage: false });
    }
  },

  rebuildPoints() {
    const pts = [];
    const v = this.data.visible;
    const d = this.data.layoutData;
    if (!d) return;
    if (v.power) {
      (d.powerOutlets || []).forEach(p => pts.push({
        x: p.x, y: p.y,
        icon: p.type === 'USB插座' ? '🔌' : '🔌',
        typeClass: 'point-power',
      }));
    }
    if (v.network) {
      (d.networkPorts || []).forEach(p => pts.push({
        x: p.x, y: p.y,
        icon: p.type === 'WiFi AP' ? '📶' : '🌐',
        typeClass: 'point-network',
      }));
    }
    if (v.switches) {
      (d.switches || []).forEach(p => pts.push({
        x: p.x, y: p.y,
        icon: p.type === '智能开关' ? '🤖' : '🔘',
        typeClass: 'point-switch',
      }));
    }
    this.setData({ displayPoints: pts });
  },

  drawCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#layoutCanvas').fields({ node: true, size: true }).exec(res => {
      if (!res[0]?.node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const w = this.data.canvasW, h = this.data.canvasH;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, w, h);

      const layoutData = this.data.layoutData;
      if (!layoutData) {
        this.drawFloorplanSkeleton(ctx, w, h, true);
        return;
      }

      this.drawFloorplanSkeleton(ctx, w, h, false);
      this.drawWaterLines(ctx, layoutData.waterLines || []);
      this.drawElectricalRoutes(ctx, layoutData.electricalRoutes || []);
      this.drawPoints(ctx, layoutData);
    });
  },

  drawFloorplanSkeleton(ctx, w, h, showPlaceholder) {
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.setLineDash([]);
    if (showPlaceholder) {
      ctx.fillStyle = '#999';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('请先生成水电布局', w / 2, h / 2);
    }
  },

  drawWaterLines(ctx, lines) {
    if (!this.data.visible.water) return;
    const v = this.data.visible;
    ctx.strokeStyle = '#00b4d8';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 3]);
    (lines || []).forEach(line => {
      if ((line.points || []).length < 2) return;
      ctx.beginPath();
      line.points.forEach((p, i) => {
        const x = p.x * this.data.scale + this.data.offsetX;
        const y = p.y * this.data.scale + this.data.offsetY;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.setLineDash([]);
  },

  drawElectricalRoutes(ctx, lines) {
    if (!this.data.visible.electric) return;
    ctx.strokeStyle = '#ef476f';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 3]);
    (lines || []).forEach(line => {
      if ((line.points || []).length < 2) return;
      ctx.beginPath();
      line.points.forEach((p, i) => {
        const x = p.x * this.data.scale + this.data.offsetX;
        const y = p.y * this.data.scale + this.data.offsetY;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.setLineDash([]);
  },

  drawPoints(ctx, d) {
    const v = this.data.visible;
    const r = 8;
    if (v.power) {
      (d.powerOutlets || []).forEach(p => {
        const x = p.x * this.data.scale + this.data.offsetX;
        const y = p.y * this.data.scale + this.data.offsetY;
        ctx.fillStyle = '#ef476f';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      });
    }
    if (v.network) {
      (d.networkPorts || []).forEach(p => {
        const x = p.x * this.data.scale + this.data.offsetX;
        const y = p.y * this.data.scale + this.data.offsetY;
        ctx.fillStyle = '#4361ee';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x - r, y - r, r * 2, r * 2);
      });
    }
    if (v.switches) {
      (d.switches || []).forEach(p => {
        const x = p.x * this.data.scale + this.data.offsetX;
        const y = p.y * this.data.scale + this.data.offsetY;
        ctx.fillStyle = '#06d6a0';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      });
    }
  },

  resetLayout() {
    wx.showModal({
      title: '确认重置',
      content: '确定要清空当前水电布局吗？',
      success: res => {
        if (res.confirm) {
          this.setData({ layoutData: null, displayPoints: [], tips: [] });
          this.drawCanvas();
        }
      },
    });
  },

  onCanvasTouch(e) {},
  onCanvasTouchMove(e) {},
  onCanvasTouchEnd(e) {},
  onPointTouch(e) { e.stopPropagation(); },
  onPointTap(e) { e.stopPropagation(); },

  exportImage() {
    if (!this.data.layoutData) {
      wx.showToast({ title: '先生成水电布局', icon: 'none' });
      return;
    }
    wx.canvasToTempFilePath({
      canvasId: 'layoutCanvas',
      success: res => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
          fail: () => wx.showToast({ title: '请允许保存相册权限', icon: 'none' }),
        });
      },
      fail: () => wx.showToast({ title: '导出失败，请真机调试', icon: 'none' }),
    });
  },
});
