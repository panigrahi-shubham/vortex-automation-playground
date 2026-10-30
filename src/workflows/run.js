// Steps must be synchronous: an in-memory transaction cannot span an await.
// Register compensation before running a step, including partial failures.
function run(steps) {
  const completed = [];
  try {
    for (const step of steps) {
      completed.push(step);
      step.execute();
    }
  } catch (cause) {
    const failures = [];
    for (const step of completed.reverse()) {
      try { step.undo(); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError([cause, ...failures], 'Workflow and compensation failed');
    throw cause;
  }
}
module.exports = { run };
