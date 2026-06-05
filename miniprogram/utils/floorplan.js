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

function normalizeRooms(rooms) {
  return (rooms || []).map((r, i) => ({
    id: `room_${i}`,
    name: r.name || ROOM_NAMES[r.type] || `房间${i + 1}`,
    type: r.type || 'other',
    area: r.area || 0,
    color: ROOM_COLORS[r.type] || ROOM_COLORS.other,
    walls: r.walls || [],
    doors: r.doors || [],
    windows: r.windows || [],
    features: r.features || [],
  }));
}

function scalePoint(p, width, height, targetW, targetH) {
  return {
    x: (p.x / width) * targetW,
    y: (p.y / height) * targetH,
  };
}

function normalizeFloorplanData(data, canvasW, canvasH) {
  if (!data) return null;
  const w = data.dimensions?.width || canvasW;
  const h = data.dimensions?.height || canvasH;
  return {
    walls: (data.walls || []).map(wl => ({
      start: scalePoint(wl.start, w, h, canvasW, canvasH),
      end:   scalePoint(wl.end,   w, h, canvasW, canvasH),
    })),
    doors:   (data.doors   || []).map(d => ({
      position: scalePoint(d.position, w, h, canvasW, canvasH),
      width:    (d.width    / w) * canvasW,
      height:   (d.height   / h) * canvasH,
    })),
    windows: (data.windows || []).map(wn => ({
      position: scalePoint(wn.position, w, h, canvasW, canvasH),
      width:    (wn.width    / w) * canvasW,
      height:   (wn.height   / h) * canvasH,
    })),
  };
}

module.exports = {
  normalizeRooms,
  normalizeFloorplanData,
  ROOM_COLORS,
  ROOM_NAMES,
};
