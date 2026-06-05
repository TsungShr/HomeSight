const app = getApp();
const ThreeHelper = require('../../utils/three-helper');

const ROOM_ICONS = {
  living:'sofa.png',    bedroom:'bed.png',     kitchen:'plug.png',
  bathroom:'water.png', balcony:'curtain.png', study:'bookshelf.png',
  storage:'wardrobe.png', other:'floorplan.png',
};

Page({
  data: {
    rooms: [],
    activeRoom: '',
    activeRoomData: null,
    wireframe: false,
    autoRotate: false,
    threeHelper: null,
  },

  onLoad(opts) {
    const roomData = app.globalData.roomData;
    if (!roomData) {
      this.loadMockData();
    } else {
      this.processRooms(roomData.rooms || []);
    }
  },

  onReady() {
    this.initCanvas();
  },

  loadMockData() {
    const mock = {
      rooms: [
        { id:'room_0', name:'客厅', type:'living', area:35, color:'#4361ee',
          walls:[{x:0.1,y:0.2},{x:0.6,y:0.2},{x:0.6,y:0.7},{x:0.1,y:0.7}],
          doors:[{x:0.35,y:0.7}], windows:[{x:0.1,y:0.3}], features:['南向采光','开间4.5米'] },
        { id:'room_1', name:'主卧', type:'bedroom', area:22, color:'#7209b7',
          walls:[{x:0.6,y:0.2},{x:0.9,y:0.2},{x:0.9,y:0.7},{x:0.6,y:0.7}],
          doors:[{x:0.6,y:0.45}], windows:[{x:0.7,y:0.2}], features:['套房设计'] },
        { id:'room_2', name:'次卧', type:'bedroom', area:16, color:'#7209b7',
          walls:[{x:0.1,y:0.7},{x:0.6,y:0.7},{x:0.6,y:0.95},{x:0.1,y:0.95}],
          doors:[{x:0.35,y:0.7}], windows:[{x:0.3,y:0.95}], features:['北向'] },
        { id:'room_3', name:'厨房', type:'kitchen', area:12, color:'#f72585',
          walls:[{x:0.6,y:0.7},{x:0.9,y:0.7},{x:0.9,y:0.95},{x:0.6,y:0.95}],
          doors:[{x:0.6,y:0.82}], windows:[{x:0.8,y:0.7}], features:['U型布局'] },
        { id:'room_4', name:'卫生间', type:'bathroom', area:8, color:'#06d6a0',
          walls:[], doors:[], windows:[], features:['干湿分离'] },
      ],
    };
    this.processRooms(mock.rooms);
  },

  processRooms(rooms) {
    const processed = (rooms || []).map((r, i) => ({
      ...r,
      id: r.id || `room_${i}`,
      color: r.color || '#4361ee',
      icon: ROOM_ICONS[r.type] || ROOM_ICONS.other,
      walls: r.walls || [],
      doors: r.doors || [],
      windows: r.windows || [],
      features: r.features || [],
    }));
    this.setData({
      rooms: processed,
      activeRoom: processed[0]?.id || '',
      activeRoomData: processed[0] || null,
    });
    if (this._canvasReady) {
      this.renderScene();
    }
  },

  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#threeCanvas').node(res => {
      const canvas = res.node;
      if (!canvas) return;
      const info = wx.getSystemInfoSync();
      canvas.width  = info.windowWidth * info.pixelRatio;
      canvas.height = info.windowHeight * 0.55 * info.pixelRatio;
      canvas.style.width  = info.windowWidth + 'px';
      canvas.style.height = info.windowHeight * 0.55 + 'px';

      try {
        const helper = new ThreeHelper(canvas, {
          cameraY: 300,
          fov: 50,
        });
        this._threeHelper = helper;
        this._canvasReady = true;
        this.renderScene();
      } catch (e) {
        console.error('WebGL init failed:', e);
        this.setData({ threeError: true });
      }
    }).exec();
  },

  renderScene() {
    const h = this._threeHelper;
    if (!h || !this.data.rooms.length) return;
    h.renderFloorplan(this.data.rooms, 600, 600);
    if (this._autoRotateTimer) clearInterval(this._autoRotateTimer);
    if (this.data.autoRotate) {
      this._autoRotateTimer = setInterval(() => {
        if (this._threeHelper) {
          this._threeHelper.rotY += 0.005;
          this._threeHelper.render();
        }
      }, 30);
    }
  },

  selectRoom(e) {
    const { id } = e.currentTarget.dataset;
    const room = this.data.rooms.find(r => r.id === id);
    this.setData({ activeRoom: id, activeRoomData: room || null });
  },

  resetCamera() {
    this._threeHelper?.resetCamera();
  },

  toggleWireframe() {
    this.setData({ wireframe: !this.data.wireframe });
  },

  toggleAutoRotate() {
    this.setData({ autoRotate: !this.data.autoRotate }, () => this.renderScene());
  },

  screenshot() {
    wx.showToast({ title: '截图功能需在真机调试', icon: 'none' });
  },

  onTouchStart(e) {
    if (e.touches.length === 1) {
      this._touchStartX = e.touches[0].clientX;
      this._touchStartY = e.touches[0].clientY;
    }
  },
  onTouchMove(e) {
    if (e.touches.length === 1 && this._threeHelper) {
      const dx = e.touches[0].clientX - (this._lastTouchX || this._touchStartX);
      const dy = e.touches[0].clientY - (this._lastTouchY || this._touchStartY);
      this._threeHelper.rotY += dx * 0.01;
      this._threeHelper.rotX += dy * 0.01;
      this._threeHelper.render();
      this._lastTouchX = e.touches[0].clientX;
      this._lastTouchY = e.touches[0].clientY;
    }
  },
  onTouchEnd() {
    this._lastTouchX = 0;
    this._lastTouchY = 0;
  },

  goBack() {
    wx.navigateBack();
  },
  goToEdit() {
    wx.switchTab({ url: '/pages/edit/edit' });
  },

  onUnload() {
    if (this._autoRotateTimer) clearInterval(this._autoRotateTimer);
    this._threeHelper?.dispose();
  },
});
