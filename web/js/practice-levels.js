export const levels = {
  1: { name: 'Beginner', description: 'Find controls, check visible states and verify a single response.' },
  2: { name: 'Intermediate', description: 'Test validation, filters, layout changes and connected steps.' },
  3: { name: 'Advanced', description: 'Test browser preferences, layout edge cases and multi-response contracts.' }
};

export const validLevel = value => Object.hasOwn(levels, value) ? value : '';

export function levelOptions() {
  return '<option value="">All levels</option>' + Object.entries(levels)
    .map(([level, { name }]) => `<option value="${level}">${level} · ${name}</option>`).join('');
}
