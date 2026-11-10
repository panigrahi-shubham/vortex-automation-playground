export default {
  id: 'frames',
  title: 'Nested iframes',
  tag: 'frameLocator()',
  level: 2,
  task: "Click the outer counter and submit your name inside the inner frame. Verify the counter and greeting.",
  body: challenge => `<iframe src="/lab/frame-outer${challenge ? '?challenge=1' : ''}" title="Outer frame" data-testid="outer-frame" style="width:100%;height:240px;border:1px solid var(--line);border-radius:8px"></iframe>`,
};
