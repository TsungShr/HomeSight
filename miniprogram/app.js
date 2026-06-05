const config = require('./utils/config');

App({
  globalData: {
    API_BASE: config.API_BASE,
    openId: '',
    currentFloorPlan: null,
    roomData: null,
    layoutData: null,
    _openIdReadyCallbacks: [],

    notifyOpenIdReady(openId) {
      this.openId = openId;
      this._openIdReadyCallbacks.forEach(cb => cb(openId));
      this._openIdReadyCallbacks = [];
    },
    onOpenIdReady(cb) {
      if (this.openId) {
        cb(this.openId);
      } else {
        this._openIdReadyCallbacks.push(cb);
      }
    },
  },

  onLaunch() {
    this.initOpenId();
  },

  async initOpenId() {
    try {
      const cached = wx.getStorageSync('openId');
      if (cached) {
        this.globalData.notifyOpenIdReady(cached);
        return;
      }
      const loginRes = await wx.login();
      const res = await wx.request({
        url: `${this.globalData.API_BASE}/user/openid?code=${loginRes.code}`,
        fail: () => null,
      });
      const openId = res?.data?.data?.openId || 'dev_' + Date.now();
      this.globalData.notifyOpenIdReady(openId);
      wx.setStorageSync('openId', openId);
    } catch (e) {
      this.globalData.notifyOpenIdReady('dev_' + Date.now());
    }
  },
});
