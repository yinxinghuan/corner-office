type Locale = 'zh' | 'en';

const dict: Record<Locale, Record<string, string>> = {
  zh: {
    title: 'CORNER OFFICE',
    tagline: '不能不往上爬。',
    floor: '楼层',
    best: '最高',
    again: '再来一次',
    leaderboard: '排行榜',
    new_best: '新纪录！',
    final_floor: '最终楼层',
    cleared: '终身成就',
    cleared_sub: '— 棺材即奖杯 —',
    fired: '被解雇于',
    fired_sub: '— HR 已护送出门 —',
    tut_line1: '拖动 移动',
    tut_line2: '吃咖啡 躲红泡',
    pickups: '战利品',
    burnouts: '崩溃',
    floor_n: 'FL.{n}',
    exec_floor: '顶层 100',
  },
  en: {
    title: 'CORNER OFFICE',
    tagline: 'You can’t NOT climb.',
    floor: 'Floor',
    best: 'Best',
    again: 'Climb again',
    leaderboard: 'Leaderboard',
    new_best: 'New high!',
    final_floor: 'Final floor',
    cleared: 'EXECUTIVE LIFETIME',
    cleared_sub: '— the coffin opens —',
    fired: 'TERMINATED ON',
    fired_sub: '— HR has escorted you out —',
    tut_line1: 'DRAG TO MOVE',
    tut_line2: 'GRAB LATTES · DODGE BURNOUTS',
    pickups: 'Perks',
    burnouts: 'Burnouts',
    floor_n: 'FL.{n}',
    exec_floor: 'FLOOR 100',
  },
};

function detectLocale(): Locale {
  const override = typeof localStorage !== 'undefined' ? localStorage.getItem('game_locale') : null;
  if (override === 'en' || override === 'zh') return override;
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

const locale = detectLocale();

export function t(key: string, vars?: { n?: number | string }): string {
  const raw = dict[locale][key] ?? dict.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k as keyof typeof vars] ?? ''));
}
