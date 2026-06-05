const app = getApp();
const request = require('../../utils/request');
const floorplan = require('../../utils/floorplan');

const ROOM_COLORS = {
  living:    '#4361ee',
  bedroom:   '#7209b7',
  kitchen:   '#f72585',
  bathroom:  '#06d6a0',
  balcony:   '#ffd166',
  study:     '#fb5607',
  storage:   '#9b5de5',
  cloakroom: '#00b4d8',
  nursery:   '#ff6b6b',
  gaming:    '#c77dff',
  other:     '#3a0ca3',
};

const ROOM_NAMES = {
  living:    '客厅',
  bedroom:   '卧室',
  kitchen:   '厨房',
  bathroom:  '卫生间',
  balcony:   '阳台',
  study:     '书房',
  storage:   '储藏室',
  cloakroom: '衣帽间',
  nursery:   '婴儿房',
  gaming:    '电竞房',
  other:     '其他',
};

const ROOM_TYPES = [
  { type: 'living',    name: '客厅' },
  { type: 'bedroom',   name: '卧室' },
  { type: 'cloakroom', name: '衣帽间' },
  { type: 'nursery',   name: '婴儿房' },
  { type: 'bathroom',  name: '卫生间' },
  { type: 'kitchen',   name: '厨房' },
  { type: 'gaming',    name: '电竞房' },
  { type: 'balcony',   name: '阳台' },
  { type: 'study',     name: '书房' },
  { type: 'storage',   name: '储藏室' },
  { type: 'other',     name: '其他' },
];

const ROOM_ICONS = {
  living:    'sofa.png',
  bedroom:   'bed.png',
  cloakroom: 'wardrobe.png',
  nursery:   'bed.png',
  bathroom:  'toilet.png',
  kitchen:   'stove.png',
  gaming:    'camera.png',
  balcony:   'curtain.png',
  study:     'bookshelf.png',
  storage:   'wardrobe.png',
  other:     'floorplan.png',
};

const FURNITURE_CATALOG = {
  furniture: [
    { type:'sofa',           name:'L型沙发',      width:120, height:70,  iconImg:'sofa.png'      },
    { type:'sofa2',          name:'双人沙发',      width:90,  height:50,  iconImg:'sofa.png'      },
    { type:'bed',            name:'双人床',        width:180, height:200, iconImg:'bed.png'       },
    { type:'bed_single',     name:'单人床',        width:100, height:200, iconImg:'bed.png'       },
    { type:'table',          name:'茶几',          width:80,  height:50,  iconImg:'table.png'    },
    { type:'tv_stand',       name:'电视柜',        width:120, height:45,  iconImg:'tv.png'       },
    { type:'wardrobe',       name:'衣柜',          width:120, height:60,  iconImg:'wardrobe.png' },
    { type:'desk',           name:'书桌',          width:120, height:60,  iconImg:'table.png'    },
    { type:'bookshelf',      name:'书架',          width:80,  height:30,  iconImg:'bookshelf.png'},
    { type:'dining_table',   name:'餐桌',          width:120, height:80,  iconImg:'table.png'    },
    { type:'dining_chair',   name:'餐椅',          width:40,  height:40,  iconImg:'chair.png'    },
    { type:'curtain',        name:'窗帘',          width:120, height:20,  iconImg:'curtain.png'  },
  ],
  appliance: [
    { type:'tv',             name:'电视',          width:120, height:20,  iconImg:'tv.png'       },
    { type:'fridge',         name:'冰箱',          width:60,  height:70,  iconImg:'fridge.png'   },
    { type:'washer',         name:'洗衣机',        width:60,  height:60,  iconImg:'washer.png'  },
    { type:'ac',             name:'空调',          width:50,  height:50,  iconImg:'aircon.png'   },
    { type:'water_heater',   name:'热水器',        width:50,  height:50,  iconImg:'water_heater.png' },
    { type:'stove',          name:'燃气灶',        width:80,  height:45,  iconImg:'stove.png'  },
    { type:'range_hood',     name:'油烟机',        width:80,  height:45,  iconImg:'plug.png'    },
    { type:'microwave',      name:'微波炉',        width:45,  height:35,  iconImg:'microwave.png' },
    { type:'toilet',         name:'马桶',          width:45,  height:65,  iconImg:'toilet.png'  },
    { type:'bathroom_cabinet',name:'浴室柜',      width:80,  height:45,  iconImg:'wardrobe.png'},
  ],
  smart: [
    { type:'camera',         name:'摄像头',        width:30,  height:30,  iconImg:'camera.png'  },
    { type:'speaker',        name:'智能音箱',      width:30,  height:30,  iconImg:'speaker.png' },
    { type:'gateway',        name:'网关',          width:30,  height:30,  iconImg:'sensor.png'  },
    { type:'sensor_temp',    name:'温湿度传感器',  width:25,  height:25,  iconImg:'sensor.png' },
    { type:'sensor_smoke',   name:'烟雾报警器',    width:25,  height:25,  iconImg:'sensor.png' },
    { type:'door_lock',      name:'智能门锁',      width:30,  height:30,  iconImg:'door_lock.png' },
    { type:'curtain_motor',  name:'窗帘电机',      width:30,  height:30,  iconImg:'curtain.png' },
    { type:'robot_vacuum',  name:'扫地机器人',    width:45,  height:45,  iconImg:'robot.png'  },
  ],
};

Page({
  data: {
    rooms: [],
    activeRoom: '',
    furnitureList: [],
    selectedId: '',
    furnitureTab: 'furniture',
    furnitureTabs: [
      { key:'furniture', label:'家具' },
      { key:'appliance', label:'家电' },
      { key:'smart',     label:'智能' },
    ],
    currentFurnitureList: FURNITURE_CATALOG.furniture,
    canvasW: 375,
    canvasH: 300,
    roomFurniture: {},
    showRoomSheet: false,
    showEditRoomSheet: false,
    editRoomData: null,
    dragGhost: null,
    showSizeSheet: false,
    tempSize: { width: 80, height: 60, name: '' },
    roomTypes: ROOM_TYPES.map(t => ({ ...t, color: ROOM_COLORS[t.type] })),
  },

  onLoad() {
    const info = wx.getSystemInfoSync();
    this.setData({ canvasW: info.windowWidth - 48, canvasH: 300 });
    this._dpr = info.pixelRatio;
    this._catalogDragItem = null;
    this._catalogDragHasMoved = false;
    this._drag = null;
    this.loadRooms();
  },

  onShow() {
    if (this.data.activeRoom) this.loadFurniture(this.data.activeRoom);
    this.drawCanvas();
  },

  loadRooms() {
    const globalRoomData = app.globalData.roomData;
    try {
      const stored = wx.getStorageSync('customRooms');
      if (stored) {
        const rooms = JSON.parse(stored).map(r => this._normalizeRoom(r));
        this.setData({ rooms, activeRoom: rooms[0]?.id || '' });
        if (rooms.length > 0) this.loadFurniture(rooms[0].id);
      } else if (globalRoomData?.rooms?.length > 0) {
        const rooms = globalRoomData.rooms.map((r, i) => this._normalizeRoom({
          ...r,
          id: `room_${i}`,
          name: r.name || ROOM_NAMES[r.type] || `房间${i + 1}`,
          type: r.type || 'other',
        }));
        this.setData({ rooms, activeRoom: rooms[0]?.id || '' });
        if (rooms.length > 0) this.loadFurniture(rooms[0].id);
      } else {
        this.setDefaultRooms();
      }
    } catch {
      this.setDefaultRooms();
    }
    this.drawCanvas();
  },

  setDefaultRooms() {
    const defaults = [
      { id:'room_0', name:'客厅',    type:'living',    area:30, color: ROOM_COLORS.living,    icon: ROOM_ICONS.living,    walls:[], doors:[], windows:[], features:[], rect:null },
      { id:'room_1', name:'主卧',    type:'bedroom',   area:20, color: ROOM_COLORS.bedroom,   icon: ROOM_ICONS.bedroom,   walls:[], doors:[], windows:[], features:[], rect:null },
      { id:'room_2', name:'次卧',    type:'bedroom',   area:15, color: ROOM_COLORS.bedroom,   icon: ROOM_ICONS.bedroom,   walls:[], doors:[], windows:[], features:[], rect:null },
      { id:'room_3', name:'厨房',    type:'kitchen',   area:10, color: ROOM_COLORS.kitchen,   icon: ROOM_ICONS.kitchen,   walls:[], doors:[], windows:[], features:[], rect:null },
      { id:'room_4', name:'卫生间',  type:'bathroom',  area:6,  color: ROOM_COLORS.bathroom,  icon: ROOM_ICONS.bathroom,  walls:[], doors:[], windows:[], features:[], rect:null },
      { id:'room_5', name:'电竞房',  type:'gaming',    area:10, color: ROOM_COLORS.gaming,    icon: ROOM_ICONS.gaming,    walls:[], doors:[], windows:[], features:[], rect:null },
    ];
    this.setData({ rooms: defaults, activeRoom: defaults[0]?.id || '' });
    if (defaults.length > 0) this.loadFurniture(defaults[0].id);
  },

  _normalizeRoom(r) {
    return {
      ...r,
      color: ROOM_COLORS[r.type] || ROOM_COLORS.other,
      icon: ROOM_ICONS[r.type] || ROOM_ICONS.other,
      rect: r.rect || null,
    };
  },

  saveRooms() {
    const rooms = this.data.rooms.map(r => {
      const { icon: _icon, ...rest } = r;
      return rest;
    });
    wx.setStorageSync('customRooms', JSON.stringify(rooms));
  },

  // --- 房间切换 ---
  switchRoom(e) {
    const { id } = e.currentTarget.dataset;
    this.saveFurniture(this.data.activeRoom);
    this.setData({ activeRoom: id, selectedId: '' });
    this.loadFurniture(id);
    this.drawCanvas();
  },

  // --- 删除房间 ---
  deleteRoomFromChip(e) {
    const { id } = e.currentTarget.dataset;
    const room = this.data.rooms.find(r => r.id === id);
    if (!room) return;
    wx.showModal({
      title: '删除房间',
      content: `确定要删除「${room.name}」吗？该房间的家具数据也会一并清除。`,
      success: res => {
        if (!res.confirm) return;
        const rooms = this.data.rooms.filter(r => r.id !== id);
        if (rooms.length === 0) {
          this.setData({ rooms: [], activeRoom: '' });
          wx.removeStorageSync('customRooms');
          return;
        }
        const activeRoom = id === this.data.activeRoom ? rooms[0].id : this.data.activeRoom;
        this.setData({ rooms, activeRoom });
        wx.removeStorageSync(`furniture_${id}`);
        this.saveRooms();
        this.loadFurniture(activeRoom);
        this.drawCanvas();
      },
    });
  },

  // --- 添加房间 ---
  showAddRoom() {
    this.setData({ showRoomSheet: true });
  },

  hideRoomSheet() {
    this.setData({ showRoomSheet: false });
  },

  addRoom(e) {
    const { type } = e.currentTarget.dataset;
    const name = ROOM_NAMES[type] || type;
    const id = 'room_' + Date.now();
    const newRoom = {
      id, name, type,
      area: 0,
      color: ROOM_COLORS[type] || ROOM_COLORS.other,
      icon: ROOM_ICONS[type] || ROOM_ICONS.other,
      walls: [], doors: [], windows: [], features: [],
      rect: null,
    };
    const rooms = [...this.data.rooms, newRoom];
    this.setData({ rooms, activeRoom: id, showRoomSheet: false, selectedId: '' });
    this.saveRooms();
    this.loadFurniture(id);
    this.drawCanvas();
  },

  // --- 编辑房间 ---
  showEditRoom() {
    const room = this.data.rooms.find(r => r.id === this.data.activeRoom);
    if (!room) return;
    this.setData({ showEditRoomSheet: true, editRoomData: { name: room.name, area: room.area } });
  },

  hideEditRoomSheet() {
    this.setData({ showEditRoomSheet: false });
  },

  onEditRoomNameInput(e) {
    this.setData({ editRoomData: { ...this.data.editRoomData, name: e.detail.value } });
  },

  onEditRoomAreaInput(e) {
    const val = parseInt(e.detail.value) || 0;
    this.setData({ editRoomData: { ...this.data.editRoomData, area: val } });
  },

  saveRoomEdit() {
    const { name, area } = this.data.editRoomData;
    const rooms = this.data.rooms.map(r => {
      if (r.id === this.data.activeRoom) return { ...r, name, area };
      return r;
    });
    this.setData({ rooms, showEditRoomSheet: false });
    this.saveRooms();
    this.drawCanvas();
  },

  deleteRoom() {
    const room = this.data.rooms.find(r => r.id === this.data.activeRoom);
    if (!room) return;
    wx.showModal({
      title: '删除房间',
      content: `确定要删除「${room.name}」吗？家具数据也会一并清除。`,
      success: res => {
        if (!res.confirm) return;
        const rooms = this.data.rooms.filter(r => r.id !== this.data.activeRoom);
        if (rooms.length === 0) {
          this.setData({ rooms: [], activeRoom: '', showEditRoomSheet: false });
          wx.removeStorageSync('customRooms');
          this.drawCanvas();
          return;
        }
        const activeRoom = rooms[0].id;
        this.setData({ rooms, activeRoom, showEditRoomSheet: false });
        wx.removeStorageSync(`furniture_${room.id}`);
        this.saveRooms();
        this.loadFurniture(activeRoom);
        this.drawCanvas();
      },
    });
  },

  // --- 家具 ---
  switchFurnitureTab(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({
      furnitureTab: key,
      currentFurnitureList: FURNITURE_CATALOG[key] || [],
    });
  },

  preventScroll() { return; },

  addFurniture(e) {
    const { type } = e.currentTarget.dataset;
    const catalog = Object.values(FURNITURE_CATALOG).flat();
    const item = catalog.find(c => c.type === type);
    if (!item) return;
    const id = 'f_' + Date.now();
    const cw = this.data.canvasW, ch = this.data.canvasH;
    const fw = Math.min(item.width, cw * 0.6), fh = Math.min(item.height, ch * 0.6);
    this.setData({
      furnitureList: [...this.data.furnitureList, {
        id, type: item.type, name: item.name, iconImg: item.iconImg,
        x: (cw - fw) / 2, y: (ch - fh) / 2,
        width: fw, height: fh, rotation: 0,
      }],
      selectedId: id,
    });
    this.saveFurniture(this.data.activeRoom);
  },

  // --- 家具目录拖放入布局区 ---
  onCatalogDragStart(e) {
    const { type, name, icon, width, height } = e.currentTarget.dataset;
    const touch = e.touches[0];
    const catalog = Object.values(FURNITURE_CATALOG).flat();
    const item = catalog.find(c => c.type === type) || { width, height };
    this._catalogDragItem = { type, name, icon, width: item.width, height: item.height };
    this._catalogDragStartX = touch.clientX;
    this._catalogDragStartY = touch.clientY;
    this._catalogDragHasMoved = false;
    this._catalogTouchId = e.touches[0].identifier;
    // Show ghost immediately
    this.setData({
      dragGhost: { x: touch.clientX, y: touch.clientY, icon, name },
    });
  },

  onCatalogDragMove(e) {
    if (!this._catalogDragItem) return;
    // Ignore multi-touch
    if (e.touches.length > 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - this._catalogDragStartX;
    const dy = touch.clientY - this._catalogDragStartY;
    if (!this._catalogDragHasMoved && Math.sqrt(dx * dx + dy * dy) < 5) return;
    this._catalogDragHasMoved = true;
    this.setData({ dragGhost: { x: touch.clientX, y: touch.clientY, icon: this._catalogDragItem.icon, name: this._catalogDragItem.name } });
  },

  onCatalogDragEnd(e) {
    if (!this._catalogDragItem) return;
    const item = this._catalogDragItem;
    this._catalogDragItem = null;
    this.setData({ dragGhost: null });

    // If it was just a tap (no significant drag), fall back to size sheet
    if (!this._catalogDragHasMoved) {
      this._pendingDrop = {
        type: item.type,
        name: item.name,
        iconImg: item.icon,
        defaultW: item.width,
        defaultH: item.height,
        localX: this.data.canvasW / 2,
        localY: this.data.canvasH / 2,
      };
      this.setData({
        showSizeSheet: true,
        tempSize: { width: item.width, height: item.height, name: item.name },
      });
      return;
    }

    // Capture last ghost position before clearing
    const lastGhost = this.data.dragGhost;

    // Drop on canvas: find canvas position
    const query = wx.createSelectorQuery();
    query.select('#canvasWrapper').boundingClientRect(rect => {
      if (!rect || !lastGhost) return;

      const canvasLeft = rect.left;
      const canvasTop = rect.top;
      const canvasRight = rect.right;
      const canvasBottom = rect.bottom;

      // If dropped inside canvas
      if (lastGhost.x >= canvasLeft && lastGhost.x <= canvasRight &&
          lastGhost.y >= canvasTop && lastGhost.y <= canvasBottom) {
        const localX = lastGhost.x - canvasLeft;
        const localY = lastGhost.y - canvasTop;
        const cw = this.data.canvasW, ch = this.data.canvasH;
        const fw = Math.min(item.width, cw * 0.6);
        const fh = Math.min(item.height, ch * 0.6);
        const id = 'f_' + Date.now();
        this.setData({
          furnitureList: [...this.data.furnitureList, {
            id,
            type: item.type,
            name: item.name,
            iconImg: item.icon,
            x: Math.max(0, Math.min(localX - fw / 2, cw - fw)),
            y: Math.max(0, Math.min(localY - fh / 2, ch - fh)),
            width: fw,
            height: fh,
            rotation: 0,
          }],
          selectedId: id,
        });
        this.saveFurniture(this.data.activeRoom);
      }
    }).exec();
  },

  // --- 家具卡片长按弹出尺寸框放入布局区 (fallback) ---
  onFurnitureCardLongPress(e) {
    const { type, name, icon } = e.currentTarget.dataset;
    const catalog = Object.values(FURNITURE_CATALOG).flat();
    const item = catalog.find(c => c.type === type);
    if (!item) return;
    this._pendingDrop = {
      type: item.type,
      name: item.name,
      iconImg: item.icon || item.iconImg,
      defaultW: item.width,
      defaultH: item.height,
      localX: this.data.canvasW / 2,
      localY: this.data.canvasH / 2,
    };
    this.setData({
      showSizeSheet: true,
      tempSize: { width: item.width, height: item.height, name: item.name },
    });
  },

  showSizeSheet() {
    this.setData({ showSizeSheet: true });
  },

  hideSizeSheet() {
    this.setData({ showSizeSheet: false });
  },

  onSizeInput(e) {
    const { dim } = e.currentTarget.dataset;
    this.setData({ tempSize: { ...this.data.tempSize, [dim]: Number(e.detail.value) } });
  },

  applySize() {
    const { width, height } = this.data.tempSize;
    if (!width || !height || width < 10 || height < 10) {
      wx.showToast({ title: '请填写有效尺寸', icon: 'none' }); return;
    }
    const cw = this.data.canvasW, ch = this.data.canvasH;
    const fw = Math.min(width, cw - 20), fh = Math.min(height, ch - 20);
    const drop = this._pendingDrop;

    if (drop) {
      // 新建家具
      const id = 'f_' + Date.now();
      this.setData({
        furnitureList: [...this.data.furnitureList, {
          id,
          type: drop.type,
          name: drop.name,
          iconImg: drop.iconImg,
          x: Math.max(0, Math.min(drop.localX - fw / 2, cw - fw)),
          y: Math.max(0, Math.min(drop.localY - fh / 2, ch - fh)),
          width: fw,
          height: fh,
          rotation: 0,
        }],
        selectedId: id,
        showSizeSheet: false,
      });
      this._pendingDrop = null;
    } else if (this.data.selectedId) {
      // 编辑现有家具尺寸
      this.setData({
        furnitureList: this.data.furnitureList.map(f => {
          if (f.id === this.data.selectedId) {
            return { ...f, width: fw, height: fh };
          }
          return f;
        }),
        showSizeSheet: false,
      });
    } else {
      this.setData({ showSizeSheet: false });
      return;
    }
    this.saveFurniture(this.data.activeRoom);
    this.drawCanvas();
  },

  deselectFurniture() {
    this.setData({ selectedId: '' });
  },

  onFurnitureTouch(e) {
    const touches = e.touches;
    if (touches.length === 2) {
      const t0 = touches[0], t1 = touches[1];
      const dist0 = this._pinchDist(t0, t1);
      const sel = this.data.furnitureList.find(f => f.id === this.data.selectedId);
      if (sel) {
        this._pinch = {
          startDist: dist0,
          startW: sel.width,
          startH: sel.height,
          cx: sel.x + sel.width / 2,
          cy: sel.y + sel.height / 2,
        };
      }
      return;
    }
    const touch = e.touches[0];
    const target = e.target?.dataset;
    if (target?.id) {
      this.setData({ selectedId: target.id });
    }
    this._drag = { x: touch.clientX, y: touch.clientY };
    this._tapStart = Date.now();
  },

  onFurnitureMove(e) {
    const touches = e.touches;
    if (touches.length === 2 && this._pinch && this.data.selectedId) {
      const t0 = touches[0], t1 = touches[1];
      const dist = this._pinchDist(t0, t1);
      const ratio = dist / this._pinch.startDist;
      const newW = Math.max(20, Math.min(300, Math.round(this._pinch.startW * ratio)));
      const newH = Math.max(20, Math.min(300, Math.round(this._pinch.startH * ratio)));
      this.setData({
        furnitureList: this.data.furnitureList.map(f => {
          if (f.id !== this.data.selectedId) return f;
          return { ...f, x: this._pinch.cx - newW / 2, y: this._pinch.cy - newH / 2, width: newW, height: newH };
        }),
      });
      return;
    }
    if (!this.data.selectedId || !this._drag) return;
    if (touches.length > 1) return;
    const touch = touches[0];
    const dx = touch.clientX - this._drag.x;
    const dy = touch.clientY - this._drag.y;
    this._drag = { x: touch.clientX, y: touch.clientY };
    this.setData({
      furnitureList: this.data.furnitureList.map(f => {
        if (f.id !== this.data.selectedId) return f;
        return { ...f, x: Math.max(0, Math.min(f.x + dx, this.data.canvasW - f.width)), y: Math.max(0, Math.min(f.y + dy, this.data.canvasH - f.height)) };
      }),
    });
  },

  onFurnitureTouchEnd() {
    const hadPinch = !!this._pinch;
    const hadDrag = !!this._drag;
    const duration = this._tapStart ? Date.now() - this._tapStart : 999;
    this._drag = null;
    this._pinch = null;
    this._tapStart = null;
    if (hadPinch || hadDrag) this.saveFurniture(this.data.activeRoom);
  },

  _pinchDist(t0, t1) {
    const dx = t0.clientX - t1.clientX;
    const dy = t0.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  openResizeSheet() {
    const item = this.data.furnitureList.find(f => f.id === this.data.selectedId);
    if (!item) return;
    this.setData({
      showSizeSheet: true,
      tempSize: { width: item.width, height: item.height, name: item.name },
    });
  },

  rotateFurniture() {
    if (!this.data.selectedId) return;
    this.setData({
      furnitureList: this.data.furnitureList.map(f => {
        if (f.id === this.data.selectedId) return { ...f, rotation: (f.rotation + 90) % 360 };
        return f;
      }),
    });
    this.saveFurniture(this.data.activeRoom);
  },

  deleteFurniture() {
    if (!this.data.selectedId) return;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这件家具吗？',
      success: res => {
        if (!res.confirm) return;
        this.setData({
          furnitureList: this.data.furnitureList.filter(f => f.id !== this.data.selectedId),
          selectedId: '',
        });
        this.saveFurniture(this.data.activeRoom);
      },
    });
  },

  duplicateFurniture() {
    if (!this.data.selectedId) return;
    const item = this.data.furnitureList.find(f => f.id === this.data.selectedId);
    if (!item) return;
    const id = 'f_' + Date.now();
    const dup = { ...item, id, x: item.x + 16, y: item.y + 16 };
    this.setData({ furnitureList: [...this.data.furnitureList, dup], selectedId: id });
    this.saveFurniture(this.data.activeRoom);
  },

  clearAll() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空当前房间所有家具吗？',
      success: res => {
        if (!res.confirm) return;
        this.setData({ furnitureList: [], selectedId: '' });
        this.saveFurniture(this.data.activeRoom);
      },
    });
  },

  onCanvasTap() {
    this.setData({ selectedId: '' });
  },

  saveFurniture(roomId) {
    wx.setStorageSync(`furniture_${roomId}`, JSON.stringify(this.data.furnitureList));
  },

  loadFurniture(roomId) {
    try {
      const stored = wx.getStorageSync(`furniture_${roomId}`);
      this.setData({ furnitureList: stored ? JSON.parse(stored) : [] });
    } catch {
      this.setData({ furnitureList: [] });
    }
  },

  // --- Canvas 绘制：单房间户型图 ---
  drawCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#editorCanvas').fields({ node: true, size: true }).exec(res => {
      if (!res[0]?.node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = this._dpr;
      canvas.width  = this.data.canvasW * dpr;
      canvas.height = this.data.canvasH * dpr;
      ctx.scale(dpr, dpr);

      const cw = this.data.canvasW, ch = this.data.canvasH;

      // 背景格
      ctx.fillStyle = '#f5f5f7';
      ctx.fillRect(0, 0, cw, ch);
      this._drawGrid(ctx, cw, ch);

      const room = this.data.rooms.find(r => r.id === this.data.activeRoom);
      if (!room) return;

      const fpData = app.globalData.roomData?.floorplanData;

      if (room.walls && room.walls.length >= 3) {
        // 有户型数据：以归一化坐标绘制房间多边形
        this._drawRoomFloorplan(ctx, room, fpData, cw, ch);
      } else {
        // 无户型数据：画简化房间矩形
        this._drawSimpleRoom(ctx, room, cw, ch);
      }
    });
  },

  _drawGrid(ctx, w, h) {
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 0.5;
    const step = 20;
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  },

  _drawRoomFloorplan(ctx, room, fpData, cw, ch) {
    const poly = room.walls;
    if (!poly || poly.length < 3) return;

    // 计算包围盒
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    poly.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    const srcW = maxX - minX || 1;
    const srcH = maxY - minY || 1;
    const pad = 40;
    const availW = cw - pad * 2;
    const availH = ch - pad * 2;
    const scale = Math.min(availW / srcW, availH / srcH);

    const sx = pad + (availW - srcW * scale) / 2 - minX * scale;
    const sy = pad + (availH - srcH * scale) / 2 - minY * scale;

    const toCanvas = p => ({ x: p.x * scale + sx, y: p.y * scale + sy });

    // 填充
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = room.color;
    ctx.beginPath();
    const cp0 = toCanvas(poly[0]);
    ctx.moveTo(cp0.x, cp0.y);
    for (let i = 1; i < poly.length; i++) {
      const cp = toCanvas(poly[i]);
      ctx.lineTo(cp.x, cp.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // 墙线
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cp0.x, cp0.y);
    for (let i = 1; i < poly.length; i++) {
      const cp = toCanvas(poly[i]);
      ctx.lineTo(cp.x, cp.y);
    }
    ctx.closePath();
    ctx.stroke();

    // 门
    (room.doors || []).forEach(d => {
      const cp = toCanvas(d);
      ctx.strokeStyle = '#b5651d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 窗
    (room.windows || []).forEach(wn => {
      const cp = toCanvas(wn);
      ctx.strokeStyle = '#64b5f6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cp.x - 10, cp.y);
      ctx.lineTo(cp.x + 10, cp.y);
      ctx.stroke();
    });

    // 房间名称
    ctx.fillStyle = room.color;
    ctx.font = `bold 14px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(room.name, cw / 2, ch - 20);

    // 面积
    if (room.area > 0) {
      ctx.fillStyle = '#888';
      ctx.font = `12px -apple-system, sans-serif`;
      ctx.fillText(`${room.area}㎡`, cw / 2, ch - 6);
    }
  },

  _drawSimpleRoom(ctx, room, cw, ch) {
    // 按面积比例计算矩形尺寸
    const area = room.area || 15;
    const aspect = 1.4;
    const maxRW = cw - 48, maxRH = ch - 80;
    // 线性比例：20㎡=0.65倍，30㎡≈1.0倍，上限不超出画布
    const scale = Math.min(Math.max(area / 30, 0.5), 1.0);
    const rw = maxRW * scale;
    const rh = Math.min(rw / aspect, maxRH);
    const rx = (cw - rw) / 2;
    const ry = (ch - rh) / 2 - 10;

    const r = 8;

    // 填充
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = room.color;
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.lineTo(rx + rw - r, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + r, r);
    ctx.lineTo(rx + rw, ry + rh - r);
    ctx.arcTo(rx + rw, ry + rh, rx + rw - r, ry + rh, r);
    ctx.lineTo(rx + r, ry + rh);
    ctx.arcTo(rx, ry + rh, rx, ry + rh - r, r);
    ctx.lineTo(rx, ry + r);
    ctx.arcTo(rx, ry, rx + r, ry, r);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 边框
    ctx.strokeStyle = room.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.lineTo(rx + rw - r, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + r, r);
    ctx.lineTo(rx + rw, ry + rh - r);
    ctx.arcTo(rx + rw, ry + rh, rx + rw - r, ry + rh, r);
    ctx.lineTo(rx + r, ry + rh);
    ctx.arcTo(rx, ry + rh, rx, ry + rh - r, r);
    ctx.lineTo(rx, ry + r);
    ctx.arcTo(rx, ry, rx + r, ry, r);
    ctx.stroke();

    // 门洞（示意）
    ctx.strokeStyle = '#b5651d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, ry + rh * 0.6, 8, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // 窗洞（示意）
    ctx.strokeStyle = '#64b5f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rx + rw * 0.3, ry);
    ctx.lineTo(rx + rw * 0.6, ry);
    ctx.stroke();

    // 房间名称
    ctx.fillStyle = room.color;
    ctx.font = `bold 15px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(room.name, cw / 2, ch - 22);

    if (area > 0) {
      ctx.fillStyle = '#999';
      ctx.font = `12px -apple-system, sans-serif`;
      ctx.fillText(`${area}㎡`, cw / 2, ch - 8);
    }
  },

  async saveLayout() {
    this.saveFurniture(this.data.activeRoom);
    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  goToLayout() {
    this.saveFurniture(this.data.activeRoom);
    wx.switchTab({ url: '/pages/layout/layout' });
  },
});
