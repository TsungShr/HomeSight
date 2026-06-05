const app = getApp();
const request = require('../../utils/request');

Page({
  data: {
    previewImage: '',
    tempFilePath: '',
    uploading: false,
    history: [],
    showModelSheet: false,
    modelList: [
      { id: 'composer-2.5-fast',          name: 'Composer 2.5 Fast' },
      { id: 'claude-4-sonnet-medium',      name: 'Claude 4 Sonnet Medium' },
      { id: 'claude-opus-4-8-thinking',    name: 'Claude Opus 4 8K' },
      { id: 'gpt-5-5-none-fast',          name: 'GPT-5.5 Fast' },
    ],
    selectedModel: 'composer-2.5-fast',
    selectedModelName: 'Composer 2.5 Fast',
  },

  onLoad() {
    app.globalData.onOpenIdReady(() => this.loadHistory());
    const saved = wx.getStorageSync('selectedModel');
    if (saved) {
      const item = this.data.modelList.find(m => m.id === saved);
      this.setData({
        selectedModel: saved,
        selectedModelName: item ? item.name : 'Composer 2.5 Fast',
      });
    }
  },

  onShow() {
    app.globalData.onOpenIdReady(() => this.loadHistory());
  },

  onPullDownRefresh() {
    this.loadHistory();
    wx.stopPullDownRefresh();
  },

  loadHistory() {
    const openId = app.globalData.openId;
    if (!openId) return;
    request.get('/floorplans', { openId }).then(list => {
      this.setData({
        history: (list || []).slice(0, 5).map(fp => ({
          ...fp,
          statusText: { draft: '待分析', analyzed: '已分析', edited: '已编辑', layoutDone: '已完成' }[fp.status] || '未知',
        })),
      });
    }).catch(() => {});
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        const file = res.tempFiles[0];
        if (file.size > 10 * 1024 * 1024) {
          wx.showToast({ title: '图片需小于 10MB', icon: 'none' });
          return;
        }
        this.setData({
          previewImage: file.tempFilePath,
          tempFilePath: file.tempFilePath,
        });
      },
    });
  },

  selectModel(e) {
    const { id } = e.currentTarget.dataset;
    const item = this.data.modelList.find(m => m.id === id);
    if (!item) return;
    this.setData({ selectedModel: id, selectedModelName: item.name, showModelSheet: false });
    wx.setStorageSync('selectedModel', id);
  },

  showModelSheet() {
    this.setData({ showModelSheet: true });
  },

  hideModelSheet() {
    this.setData({ showModelSheet: false });
  },

  async uploadAndAnalyze() {
    if (!this.data.tempFilePath) {
      wx.showToast({ title: '请先选择户型图', icon: 'none' });
      return;
    }
    this.setData({ uploading: true });

    try {
      const base64 = await new Promise((resolve, reject) => {
        wx.getFileSystemManager().readFile({
          filePath: this.data.tempFilePath,
          encoding: 'base64',
          success: res => resolve(res.data),
          fail: err => reject(err),
        });
      });

      const openId = app.globalData.openId;
      const fileName = 'floorplan.jpg';

      const uploadRes = await request.post('/upload', {
        openId,
        imageBase64: base64,
        fileName,
      });

      const fpId = uploadRes.floorPlanId;

      wx.navigateTo({
        url: `/pages/analyze/analyze?floorPlanId=${fpId}&previewImage=${encodeURIComponent(this.data.previewImage)}&model=${encodeURIComponent(this.data.selectedModel)}`,
      });

    } catch (e) {
      console.error('上传失败:', e);
      const fpId = Date.now();
      wx.navigateTo({
        url: `/pages/analyze/analyze?floorPlanId=${fpId}&previewImage=${encodeURIComponent(this.data.previewImage)}&simulate=1&model=${encodeURIComponent(this.data.selectedModel)}`,
      });
    } finally {
      this.setData({ uploading: false });
    }
  },

  openHistory(e) {
    const { id } = e.currentTarget.dataset;
    const fp = this.data.history.find(f => f.id == id);
    if (!fp) return;
    const url = {
      draft: `/pages/analyze/analyze?floorPlanId=${id}`,
      analyzed: `/pages/analyze/analyze?floorPlanId=${id}`,
      edited: `/pages/edit/edit?floorPlanId=${id}`,
      layoutDone: `/pages/layout/layout?floorPlanId=${id}`,
    }[fp.status] || `/pages/analyze/analyze?floorPlanId=${id}`;
    wx.navigateTo({ url });
  },

  goToEdit() {
    wx.switchTab({ url: '/pages/edit/edit' });
  },
  goToLayout() {
    wx.switchTab({ url: '/pages/layout/layout' });
  },
  goToView3d() {
    const fp = app.globalData.currentFloorPlan;
    if (!fp) {
      wx.showToast({ title: '请先分析户型图', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/view3d/view3d?floorPlanId=${fp.id}` });
  },
  goToHistory() {
    wx.showToast({ title: '点击历史卡片即可打开', icon: 'none' });
  },
});
