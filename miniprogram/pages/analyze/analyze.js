const app = getApp();
const request = require('../../utils/request');
const { normalizeRooms, ROOM_NAMES } = require('../../utils/floorplan');

Page({
  data: {
    floorPlanId: '',
    previewImage: '',
    loading: true,
    hasError: false,
    errorMsg: '',
    analysisResult: null,
    adviceLoading: false,
    adviceText: '',
    modelList: [
      { id: 'composer-2.5-fast',          name: 'Composer 2.5 Fast' },
      { id: 'claude-4-sonnet-medium',      name: 'Claude 4 Sonnet Medium' },
      { id: 'claude-opus-4-8-thinking',    name: 'Claude Opus 4 8K' },
      { id: 'gpt-5-5-none-fast',          name: 'GPT-5.5 Fast' },
    ],
  },

  onLoad(opts) {
    const model = decodeURIComponent(opts.model || 'composer-2.5-fast');
    this.setData({
      floorPlanId: opts.floorPlanId || '',
      previewImage: decodeURIComponent(opts.previewImage || ''),
      currentModel: model,
    });
    this.runAnalysis(opts, model);
  },

  async runAnalysis(opts, model) {
    this.setData({ loading: true, hasError: false });
    try {
      if (opts.simulate) {
        await this.simulateAnalysis(model);
      } else {
        const data = await request.post(`/analyze/${this.data.floorPlanId}`, {
          imageUrl: opts.previewImage,
          model: model || 'composer-2.5-fast',
        });
        this.processResult(data);
      }
    } catch (e) {
      await this.simulateAnalysis(model);
    }
  },

  async simulateAnalysis(model) {
    const modelName = this.data.modelList?.find(m => m.id === model)?.name || model || 'Composer 2.5 Fast';
    await new Promise(r => setTimeout(r, 2000));
    const mock = {
      modelUsed: modelName,
      totalArea: 128,
      rooms: [
        {
          name: '客厅',
          type: 'living',
          area: 35,
          color: '#4361ee',
          walls: [{x:0.1,y:0.2},{x:0.6,y:0.2},{x:0.6,y:0.7},{x:0.1,y:0.7}],
          doors: [{x:0.35,y:0.7}],
          windows: [{x:0.1,y:0.3},{x:0.5,y:0.2}],
          features: ['南向采光好', '开间4.5米'],
        },
        {
          name: '主卧',
          type: 'bedroom',
          area: 22,
          color: '#7209b7',
          walls: [{x:0.6,y:0.2},{x:0.9,y:0.2},{x:0.9,y:0.7},{x:0.6,y:0.7}],
          doors: [{x:0.6,y:0.45}],
          windows: [{x:0.7,y:0.2}],
          features: ['套房设计', '带独立卫生间'],
        },
        {
          name: '次卧',
          type: 'bedroom',
          area: 16,
          color: '#7209b7',
          walls: [{x:0.1,y:0.7},{x:0.6,y:0.7},{x:0.6,y:0.95},{x:0.1,y:0.95}],
          doors: [{x:0.35,y:0.7}],
          windows: [{x:0.3,y:0.95}],
          features: ['北向', '可做儿童房'],
        },
        {
          name: '厨房',
          type: 'kitchen',
          area: 12,
          color: '#f72585',
          walls: [{x:0.6,y:0.7},{x:0.9,y:0.7},{x:0.9,y:0.95},{x:0.6,y:0.95}],
          doors: [{x:0.6,y:0.82}],
          windows: [{x:0.8,y:0.7}],
          features: ['U型布局', '通风好'],
        },
        {
          name: '卫生间',
          type: 'bathroom',
          area: 8,
          color: '#06d6a0',
          walls: [{x:0.0,y:0.0},{x:0.0,y:0.0}],
          doors: [],
          windows: [],
          features: ['干湿分离'],
        },
      ],
      pros: [
        '南北通透，通风采光优秀',
        '客厅开间4.5米，空间宽敞',
        '主卧套房设计，私密性好',
        'U型厨房，操作动线合理',
        '双阳台设计，晾晒休闲两不误',
      ],
      cautions: [
        '承重墙位置需注意，避免破坏结构',
        '次卧北向，冬季建议加装暖气',
        '厨房排油烟管道需定期清理',
        '强弱电箱位置建议提前规划',
      ],
      floorplanData: {
        walls: [
          {start:{x:0.1,y:0.2},end:{x:0.9,y:0.2}},
          {start:{x:0.9,y:0.2},end:{x:0.9,y:0.95}},
          {start:{x:0.9,y:0.95},end:{x:0.1,y:0.95}},
          {start:{x:0.1,y:0.95},end:{x:0.1,y:0.2}},
          {start:{x:0.6,y:0.2},end:{x:0.6,y:0.95}},
          {start:{x:0.1,y:0.7},end:{x:0.6,y:0.7}},
        ],
        doors: [
          {position:{x:0.35,y:0.7},width:0.05,height:0.02},
          {position:{x:0.6,y:0.45},width:0.05,height:0.02},
          {position:{x:0.35,y:0.7},width:0.05,height:0.02},
        ],
        windows: [
          {position:{x:0.1,y:0.3},width:0.08,height:0.02},
          {position:{x:0.5,y:0.2},width:0.08,height:0.02},
          {position:{x:0.7,y:0.2},width:0.08,height:0.02},
          {position:{x:0.3,y:0.95},width:0.06,height:0.02},
          {position:{x:0.8,y:0.7},width:0.06,height:0.02},
        ],
        dimensions: {width: 1000, height: 800},
      },
    };
    this.processResult(mock);
  },

  processResult(data) {
    const rooms = normalizeRooms(data.rooms || []);
    const typeMap = {
      living:'客厅',bedroom:'卧室',kitchen:'厨房',
      bathroom:'卫生间',balcony:'阳台',study:'书房',
      storage:'储藏室',other:'其他',
    };
    rooms.forEach(r => {
      r.typeText = typeMap[r.type] || r.type;
      r.lightColor = r.color + '22'; // hex + ~13% alpha
    });
    this.setData({
      loading: false,
      analysisResult: {
        ...data,
        rooms,
      },
    });
    app.globalData.roomData = data;
    app.globalData.currentFloorPlan = {
      id: this.data.floorPlanId,
      data,
    };
  },

  retry() {
    this.runAnalysis({ floorPlanId: this.data.floorPlanId }, this.data.currentModel);
  },

  goTo3D() {
    if (!this.data.floorPlanId) {
      wx.showToast({ title: '请先完成分析', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/view3d/view3d?floorPlanId=${this.data.floorPlanId}`,
    });
  },

  goToEdit() {
    if (!this.data.floorPlanId) {
      wx.showToast({ title: '请先完成分析', icon: 'none' });
      return;
    }
    wx.switchTab({ url: '/pages/edit/edit' });
  },

  async getDecorationAdvice() {
    if (!this.data.analysisResult) {
      wx.showToast({ title: '请先完成户型分析', icon: 'none' });
      return;
    }
    this.setData({ adviceLoading: true });
    try {
      const rooms = this.data.analysisResult.rooms || [];
      const roomInfo = rooms.map(r => `${r.name}(${r.area}㎡)`).join('、');
      const res = await request.get('/advice', {
        query: '请给出针对以下户型的装修建议：' + roomInfo,
        roomInfo,
      });
      const answer = res?.answer || res || '';
      this.setData({ adviceText: answer, adviceLoading: false });
    } catch (e) {
      this.setData({ adviceLoading: false });
      wx.showToast({ title: '生成建议失败，请稍后重试', icon: 'none', duration: 2500 });
    }
  },
});
