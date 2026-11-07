// The learning order is independent of review order and does not alter saved lesson sources.
export const EVIU_PHASES = [
  {
    phase: 1,
    title: 'Học từ vựng & đời sống',
    startModule: 1,
    names: ['Phương pháp & sinh hoạt', 'Nhà cửa, sức khỏe & ăn uống', 'Mua sắm & đi lại'],
  },
  {
    phase: 2,
    title: 'Giao tiếp & công việc',
    startModule: 4,
    names: ['Giao tiếp & sự nghiệp', 'Cụm từ & công sở', 'Giao tiếp chuyên nghiệp'],
  },
  {
    phase: 3,
    title: 'Động từ & ngữ pháp từ',
    startModule: 7,
    names: ['Động từ thông dụng', 'Phrasal verbs & từ loại', 'Giới từ theo cụm'],
  },
];

const modules = [
  [1, 2, 3, 16, 17],
  [18, 19, 20, 24, 25],
  [21, 23, 28, 29, 26],
  [65, 66, 35, 36, 37],
  [74, 38, 39, 40, 75],
  [76, 53, 55, 95, 98],
  [81, 82, 83, 84, 79],
  [80, 86, 89, 90, 91],
  [77],
];

const positions = new Map(
  modules.flatMap((units, index) =>
    units.map((unit) => [
      `unit-${String(unit).padStart(2, '0')}`,
      { phase: Math.floor(index / 3) + 1, module: index + 1 },
    ]),
  ),
);

export function eviuPosition(id) {
  const position = positions.get(id);
  if (!position) throw new Error(`Unit EVIU không hợp lệ: ${id}`);
  return position;
}
