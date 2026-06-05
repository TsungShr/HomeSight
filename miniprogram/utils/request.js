const config = require('./config');

/**
 * Silent offline mode: when the backend is unreachable,
 * silently fall back to local simulation instead of showing errors.
 */
function request(url, method = 'GET', data = {}, header = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.API_BASE + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'X-OpenId': wx.getStorageSync('openId') || '',
        ...header,
      },
      success(res) {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          resolve(res.data.data);
        } else {
          const msg = res.data && res.data.msg ? res.data.msg : '请求失败';
          wx.showToast({ title: msg, icon: 'none', duration: 2000 });
          reject(res.data || {});
        }
      },
      fail() {
        // Network unreachable — silent fallback, do not show error toast
        reject({ _offline: true });
      },
    });
  });
}

module.exports = {
  post: (url, data) => request(url, 'POST', data),
  get:  (url, data) => request(url, 'GET',  data),
};
